import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { Simulation } from "eecircuit-engine";

const HERE = dirname(fileURLToPath(import.meta.url));
const NATIVE_NGSPICE = "/opt/homebrew/bin/ngspice";
const tests = {
  op: "op-diode-divider.cir",
  tran: "rc-transient.cir",
  ac: "rc-ac.cir",
};

const fmt = (value, digits = 9) => Number(value).toExponential(digits);
const relError = (actual, reference) =>
  Math.abs(actual - reference) / Math.max(Math.abs(reference), 1e-15);

function normalizeResult(result) {
  const data = new Map(result.data.map((series) => [series.name.toLowerCase(), series.values]));
  return { dataType: result.dataType, numPoints: result.numPoints, data };
}

function parseNgspiceRaw(bytes) {
  const marker = Buffer.from("Binary:");
  const markerAt = bytes.indexOf(marker);
  if (markerAt < 0) throw new Error("Native ngspice rawfile has no Binary: marker");

  let dataAt = markerAt + marker.length;
  while (dataAt < bytes.length && (bytes[dataAt] === 10 || bytes[dataAt] === 13 || bytes[dataAt] === 32)) dataAt++;

  const header = bytes.subarray(0, markerAt).toString("utf8");
  const lines = header.split(/\r?\n/);
  const field = (name) => {
    const line = lines.find((entry) => entry.startsWith(name));
    if (!line) throw new Error(`Native rawfile is missing ${name}`);
    return line.slice(line.indexOf(":") + 1).trim();
  };

  const numVariables = Number(field("No. Variables"));
  const numPoints = Number(field("No. Points"));
  const isComplex = field("Flags").includes("complex");
  const variablesAt = lines.indexOf("Variables:");
  const variables = lines.slice(variablesAt + 1, variablesAt + 1 + numVariables).map((line) => {
    const columns = line.trim().split(/\s+/);
    return { name: columns[1].toLowerCase(), type: columns[2] };
  });

  const doublesPerValue = isComplex ? 2 : 1;
  const expectedBytes = numPoints * numVariables * doublesPerValue * 8;
  if (bytes.length - dataAt < expectedBytes) {
    throw new Error(`Native rawfile is truncated: expected ${expectedBytes} data bytes, got ${bytes.length - dataAt}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + dataAt, expectedBytes);
  const series = variables.map(() => []);
  let offset = 0;
  for (let point = 0; point < numPoints; point++) {
    for (let variable = 0; variable < numVariables; variable++) {
      const real = view.getFloat64(offset, true);
      offset += 8;
      if (isComplex) {
        const img = view.getFloat64(offset, true);
        offset += 8;
        series[variable].push({ real, img });
      } else {
        series[variable].push(real);
      }
    }
  }

  return {
    dataType: isComplex ? "complex" : "real",
    numPoints,
    data: new Map(variables.map((variable, index) => [variable.name, series[index]])),
  };
}

function realSeries(result, name) {
  const values = result.data.get(name.toLowerCase());
  if (!values) throw new Error(`Missing series ${name}; got ${[...result.data.keys()].join(", ")}`);
  return values;
}

function interpolateReal(xs, ys, target) {
  if (target <= xs[0]) return ys[0];
  if (target >= xs.at(-1)) return ys.at(-1);
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= target) lo = mid;
    else hi = mid;
  }
  const alpha = (target - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + alpha * (ys[hi] - ys[lo]);
}

function complexMagnitude(value) {
  return Math.hypot(value.real, value.img);
}

function complexPhaseDeg(value) {
  return Math.atan2(value.img, value.real) * 180 / Math.PI;
}

function nearestIndex(xs, target) {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < xs.length; index++) {
    const value = typeof xs[index] === "number" ? xs[index] : xs[index].real;
    const distance = Math.abs(Math.log(value / target));
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

async function runWasm(sim, netlist) {
  sim.setNetList(netlist);
  const started = performance.now();
  const result = await sim.runSim();
  return { result: normalizeResult(result), ms: performance.now() - started };
}

function runNative(netlistPath, rawPath) {
  const started = performance.now();
  const child = spawnSync(NATIVE_NGSPICE, ["-b", "-r", rawPath, netlistPath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const ms = performance.now() - started;
  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(`Native ngspice failed (${child.status})\n${child.stdout}\n${child.stderr}`);
  }
  return { ms };
}

async function main() {
  const netlists = Object.fromEntries(
    await Promise.all(Object.entries(tests).map(async ([name, filename]) => [name, await readFile(join(HERE, filename), "utf8")]))
  );
  const tempDir = await mkdtemp(join(HERE, ".run-test-"));

  try {
    const sim = new Simulation();
    const initStarted = performance.now();
    await sim.start();
    const wasmInitMs = performance.now() - initStarted;
    const wasmVersion = sim.getInitInfo().match(/ngspice-[^: \n]+/)?.[0] ?? "unknown";

    const wasm = {};
    for (const name of ["op", "tran", "ac"]) wasm[name] = await runWasm(sim, netlists[name]);
    const repeatedOp = await runWasm(sim, netlists.op);

    const native = {};
    for (const [name, filename] of Object.entries(tests)) {
      const rawPath = join(tempDir, `${name}.raw`);
      const timing = runNative(join(HERE, filename), rawPath);
      native[name] = { result: parseNgspiceRaw(await readFile(rawPath)), ms: timing.ms };
    }

    console.log(`WASM engine: eecircuit-engine 1.7.0 (${wasmVersion}, KLU)`);
    console.log(`Native reference: ${NATIVE_NGSPICE} (ngspice-46, KLU)`);
    console.log(`WASM init: ${wasmInitMs.toFixed(1)} ms`);

    const opRows = ["v(in)", "v(out)"].map((name) => {
      const wasmValue = realSeries(wasm.op.result, name)[0];
      const nativeValue = realSeries(native.op.result, name)[0];
      return {
        quantity: name,
        WASM: fmt(wasmValue),
        native46: fmt(nativeValue),
        relError: fmt(relError(wasmValue, nativeValue), 3),
      };
    });
    console.log("\nDC operating point");
    console.table(opRows);

    const transientTimes = [0.25e-3, 1e-3, 2e-3, 5e-3, 6e-3, 9e-3, 11e-3, 15e-3, 19e-3];
    const wasmTime = realSeries(wasm.tran.result, "time");
    const nativeTime = realSeries(native.tran.result, "time");
    const wasmOut = realSeries(wasm.tran.result, "v(out)");
    const nativeOut = realSeries(native.tran.result, "v(out)");
    const transientRows = transientTimes.map((time) => {
      const wasmValue = interpolateReal(wasmTime, wasmOut, time);
      const nativeValue = interpolateReal(nativeTime, nativeOut, time);
      return {
        time_ms: (time * 1e3).toFixed(2),
        WASM_V: fmt(wasmValue),
        native46_V: fmt(nativeValue),
        relError: fmt(relError(wasmValue, nativeValue), 3),
        normError_FS: fmt(Math.abs(wasmValue - nativeValue) / 5, 3),
      };
    });
    console.log("\nRC transient checkpoints (linear interpolation)");
    console.table(transientRows);

    const acFrequencies = [10, 100, 1000, 10000, 100000];
    const wasmFrequency = realSeries(wasm.ac.result, "frequency");
    const nativeFrequency = realSeries(native.ac.result, "frequency");
    const wasmAcOut = realSeries(wasm.ac.result, "v(out)");
    const nativeAcOut = realSeries(native.ac.result, "v(out)");
    const acRows = acFrequencies.map((frequency) => {
      const wi = nearestIndex(wasmFrequency, frequency);
      const ni = nearestIndex(nativeFrequency, frequency);
      const wasmValue = wasmAcOut[wi];
      const nativeValue = nativeAcOut[ni];
      const wasmMag = complexMagnitude(wasmValue);
      const nativeMag = complexMagnitude(nativeValue);
      const wasmPhase = complexPhaseDeg(wasmValue);
      const nativePhase = complexPhaseDeg(nativeValue);
      return {
        frequency_Hz: frequency,
        WASM_mag: fmt(wasmMag),
        native46_mag: fmt(nativeMag),
        magRelError: fmt(relError(wasmMag, nativeMag), 3),
        WASM_phase_deg: wasmPhase.toFixed(6),
        native46_phase_deg: nativePhase.toFixed(6),
        phaseDelta_deg: Math.abs(wasmPhase - nativePhase).toExponential(3),
      };
    });
    console.log("\nRC AC sweep checkpoints");
    console.table(acRows);

    const repeatDelta = Math.abs(realSeries(wasm.op.result, "v(out)")[0] - realSeries(repeatedOp.result, "v(out)")[0]);
    console.log("\nRun timings and reuse");
    console.table([
      { analysis: "op", WASM_ms: wasm.op.ms.toFixed(2), native46_ms: native.op.ms.toFixed(2) },
      { analysis: "transient", WASM_ms: wasm.tran.ms.toFixed(2), native46_ms: native.tran.ms.toFixed(2) },
      { analysis: "AC", WASM_ms: wasm.ac.ms.toFixed(2), native46_ms: native.ac.ms.toFixed(2) },
      { analysis: "op repeated", WASM_ms: repeatedOp.ms.toFixed(2), native46_ms: "n/a" },
    ]);
    console.log(`Repeated-run v(out) absolute delta: ${repeatDelta.toExponential(3)} V`);

    const maxOpError = Math.max(...opRows.map((row) => Number(row.relError)));
    const maxTransientFsError = Math.max(...transientRows.map((row) => Number(row.normError_FS)));
    const maxAcMagnitudeError = Math.max(...acRows.map((row) => Number(row.magRelError)));
    const maxAcPhaseDelta = Math.max(...acRows.map((row) => Number(row.phaseDelta_deg)));

    const pass = maxOpError < 1e-3 && maxTransientFsError < 1e-2 && maxAcMagnitudeError < 1e-2 && maxAcPhaseDelta < 1 && repeatDelta < 1e-12;
    console.log(`\nThresholds: op rel < 1e-3; transient full-scale error < 1e-2; AC magnitude rel < 1e-2; AC phase delta < 1 deg; repeated result delta < 1e-12 V`);
    console.log(pass ? "PASS: WASM and native ngspice agree." : "FAIL: comparison exceeded a threshold.");
    if (!pass) process.exitCode = 1;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
