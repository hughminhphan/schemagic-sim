import { canonicalVectorName } from "./rawfile.mjs";

export const DEFAULT_TOLERANCES = Object.freeze({
  op: { rtol: 1e-3, atol: 1e-9 },
  tran: { rtol: 1e-2, atol: 1e-9 },
  ac: { rtol: 1e-2, atol: 1e-9, phaseDeg: 1 },
});

function vectorMap(rawfile) {
  const map = new Map();
  for (const vector of rawfile.vectors) {
    const canonical = canonicalVectorName(vector.name, vector.type);
    if (map.has(canonical)) {
      throw new Error(`Duplicate canonical vector ${canonical}: ${map.get(canonical).name}, ${vector.name}`);
    }
    map.set(canonical, vector);
  }
  return map;
}

function realPart(value) {
  return typeof value === "number" ? value : value.real;
}

function interpolate(xs, ys, target) {
  if (xs.length !== ys.length || xs.length === 0) throw new Error("Cannot interpolate an empty or mismatched vector");
  const first = realPart(xs[0]);
  const last = realPart(xs.at(-1));
  const epsilon = Math.max(1e-15, Math.abs(last - first) * 1e-12);
  if (target < first - epsilon || target > last + epsilon) {
    throw new Error(`Target ${target} lies outside interpolation range [${first}, ${last}]`);
  }
  if (target <= first) return ys[0];
  if (target >= last) return ys.at(-1);

  let low = 0;
  let high = xs.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (realPart(xs[middle]) <= target) low = middle;
    else high = middle;
  }

  const x0 = realPart(xs[low]);
  const x1 = realPart(xs[high]);
  if (x1 === x0) return ys[high];
  const alpha = (target - x0) / (x1 - x0);
  const y0 = ys[low];
  const y1 = ys[high];
  if (typeof y0 === "number" && typeof y1 === "number") return y0 + alpha * (y1 - y0);
  return {
    real: y0.real + alpha * (y1.real - y0.real),
    img: y0.img + alpha * (y1.img - y0.img),
  };
}

function wrapPhaseDelta(degrees) {
  return Math.abs(((degrees + 180) % 360 + 360) % 360 - 180);
}

function compareReal(nativeValues, wasmValues, analysis, tolerances) {
  const differences = nativeValues.map((reference, index) => Math.abs(wasmValues[index] - reference));
  const maxAbsError = Math.max(0, ...differences);

  if (analysis === "tran") {
    const nativeNumbers = nativeValues.map(Number);
    const range = Math.max(...nativeNumbers) - Math.min(...nativeNumbers);
    const peak = Math.max(0, ...nativeNumbers.map(Math.abs));
    const fullScale = Math.max(range, peak, tolerances.atol);
    return {
      metric: "full-scale",
      maxAbsError,
      maxRelativeError: maxAbsError / fullScale,
      pass: maxAbsError <= tolerances.atol + tolerances.rtol * fullScale,
    };
  }

  let maxRelativeError = 0;
  let pass = true;
  for (let index = 0; index < nativeValues.length; index += 1) {
    const reference = Math.abs(nativeValues[index]);
    maxRelativeError = Math.max(maxRelativeError, differences[index] / Math.max(reference, tolerances.atol));
    if (differences[index] > tolerances.atol + tolerances.rtol * reference) pass = false;
  }
  return { metric: "point-relative", maxAbsError, maxRelativeError, pass };
}

function compareComplex(nativeValues, wasmValues, tolerances) {
  let maxAbsError = 0;
  let maxRelativeError = 0;
  let maxPhaseErrorDeg = 0;
  let pass = true;

  for (let index = 0; index < nativeValues.length; index += 1) {
    const nativeValue = nativeValues[index];
    const wasmValue = wasmValues[index];
    const nativeMagnitude = Math.hypot(nativeValue.real, nativeValue.img);
    const wasmMagnitude = Math.hypot(wasmValue.real, wasmValue.img);
    const magnitudeError = Math.abs(wasmMagnitude - nativeMagnitude);
    const relativeError = magnitudeError / Math.max(nativeMagnitude, tolerances.atol);
    maxAbsError = Math.max(maxAbsError, magnitudeError);
    maxRelativeError = Math.max(maxRelativeError, relativeError);
    if (magnitudeError > tolerances.atol + tolerances.rtol * nativeMagnitude) pass = false;

    if (Math.max(nativeMagnitude, wasmMagnitude) > tolerances.atol) {
      const nativePhase = Math.atan2(nativeValue.img, nativeValue.real) * 180 / Math.PI;
      const wasmPhase = Math.atan2(wasmValue.img, wasmValue.real) * 180 / Math.PI;
      const phaseError = wrapPhaseDelta(wasmPhase - nativePhase);
      maxPhaseErrorDeg = Math.max(maxPhaseErrorDeg, phaseError);
      if (phaseError > tolerances.phaseDeg) pass = false;
    }
  }

  return {
    metric: "magnitude-relative",
    maxAbsError,
    maxRelativeError,
    maxPhaseErrorDeg,
    pass,
  };
}

function alignedValues(nativeRawfile, wasmRawfile, nativeVector, wasmVector, analysis) {
  if (analysis === "op") {
    if (nativeVector.values.length !== wasmVector.values.length) {
      throw new Error(`Point count differs for ${nativeVector.name}`);
    }
    return wasmVector.values;
  }

  const axisName = analysis === "tran" ? "time" : "frequency";
  const nativeAxis = vectorMap(nativeRawfile).get(axisName);
  const wasmAxis = vectorMap(wasmRawfile).get(axisName);
  if (!nativeAxis || !wasmAxis) throw new Error(`Missing ${axisName} scale vector`);
  return nativeAxis.values.map((value) => interpolate(wasmAxis.values, wasmVector.values, realPart(value)));
}

function validateAnalysis(rawfile, vectors, analysis, label) {
  const expectedType = analysis === "ac" ? "complex" : "real";
  if (rawfile.dataType !== expectedType) {
    throw new Error(`${label} produced ${rawfile.dataType} data for ${analysis}, expected ${expectedType}`);
  }
  const requiredScale = analysis === "tran" ? "time" : analysis === "ac" ? "frequency" : null;
  if (requiredScale && !vectors.has(requiredScale)) {
    throw new Error(`${label} ${analysis} plot is missing ${requiredScale}`);
  }
  if (analysis === "op" && (vectors.has("time") || vectors.has("frequency"))) {
    throw new Error(`${label} plot is not an operating point`);
  }
}

export function compareRawfiles(nativeRawfile, wasmRawfile, options) {
  const { analysis } = options;
  if (!DEFAULT_TOLERANCES[analysis]) throw new Error(`Unsupported analysis: ${analysis}`);
  const tolerances = { ...DEFAULT_TOLERANCES[analysis], ...options.tolerances };
  for (const key of ["rtol", "atol", ...(analysis === "ac" ? ["phaseDeg"] : [])]) {
    if (!Number.isFinite(tolerances[key]) || tolerances[key] < 0) throw new Error(`${key} must be a non-negative number`);
  }

  const nativeVectors = vectorMap(nativeRawfile);
  const wasmVectors = vectorMap(wasmRawfile);
  validateAnalysis(nativeRawfile, nativeVectors, analysis, "Native ngspice");
  validateAnalysis(wasmRawfile, wasmVectors, analysis, "WASM ngspice");
  const scaleName = analysis === "tran" ? "time" : analysis === "ac" ? "frequency" : null;
  const vectorNames = [...new Set([...nativeVectors.keys(), ...wasmVectors.keys()])]
    .filter((name) => name !== scaleName)
    .sort();
  const vectors = [];

  for (const name of vectorNames) {
    const nativeVector = nativeVectors.get(name);
    const wasmVector = wasmVectors.get(name);
    if (!nativeVector || !wasmVector) {
      vectors.push({
        name,
        nativeName: nativeVector?.name ?? null,
        wasmName: wasmVector?.name ?? null,
        nativePoints: nativeVector?.values.length ?? 0,
        wasmPoints: wasmVector?.values.length ?? 0,
        metric: "missing",
        maxAbsError: null,
        maxRelativeError: null,
        pass: false,
      });
      continue;
    }

    try {
      const wasmValues = alignedValues(nativeRawfile, wasmRawfile, nativeVector, wasmVector, analysis);
      const nativeValues = nativeVector.values;
      const nativeComplex = typeof nativeValues[0] === "object";
      const wasmComplex = typeof wasmValues[0] === "object";
      if (nativeComplex !== wasmComplex) throw new Error("real/complex data type differs");
      const metrics = nativeComplex
        ? compareComplex(nativeValues, wasmValues, tolerances)
        : compareReal(nativeValues, wasmValues, analysis, tolerances);
      vectors.push({
        name,
        nativeName: nativeVector.name,
        wasmName: wasmVector.name,
        nativePoints: nativeValues.length,
        wasmPoints: wasmVector.values.length,
        ...metrics,
      });
    } catch (error) {
      vectors.push({
        name,
        nativeName: nativeVector.name,
        wasmName: wasmVector.name,
        nativePoints: nativeVector.values.length,
        wasmPoints: wasmVector.values.length,
        metric: "alignment-error",
        error: error.message,
        maxAbsError: null,
        maxRelativeError: null,
        pass: false,
      });
    }
  }

  return {
    analysis,
    tolerances,
    nativePlot: nativeRawfile.plotName,
    wasmPlot: wasmRawfile.plotName,
    vectors,
    pass: vectors.length > 0 && vectors.every((vector) => vector.pass),
  };
}
