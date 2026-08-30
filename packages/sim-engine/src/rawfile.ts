import { dcSweepRangePointCount } from "@opencircuit/circuit-schema";
import { DEFAULT_MAX_RAWFILE_BYTES, DEFAULT_MAX_SAMPLES } from "./identity";
import type { DCSweepResultMetadata, DCSweepRunSpec, NoiseResultMetadata, NoiseRunSpec, VectorMeta } from "./types";

export interface ParsedRawfile {
  vectors: VectorMeta[];
  buffers: ArrayBuffer[];
  numPoints: number;
  samples: number;
  complex: boolean;
  bytes: number;
}

export interface RawfileLimits {
  maxRawfileBytes?: number;
  maxSamples?: number;
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

function classifyVariable(type: string): VectorMeta["kind"] {
  const normalized = type.toLowerCase();
  if (normalized === "voltage") return "voltage";
  if (normalized === "current") return "current";
  if (normalized === "time") return "time";
  if (normalized === "frequency") return "frequency";
  return "unknown";
}

function validateAxis(vectors: readonly VectorMeta[], arrays: readonly Float64Array[], complex: boolean): void {
  const axis = vectors[0];
  const values = arrays[0];
  if (!axis || !values) throw new Error("Rawfile has no independent axis");
  if (axis.kind !== "time" && axis.kind !== "frequency") return;
  let previous = -Infinity;
  for (let index = 0; index < axis.length; index += 1) {
    const real = values[index * (complex ? 2 : 1)];
    const imaginary = complex ? values[index * 2 + 1] : 0;
    if (real === undefined || imaginary === undefined || !Number.isFinite(real) || !Number.isFinite(imaginary)) {
      throw new Error(`${axis.kind} axis contains a non-finite value`);
    }
    if (imaginary !== 0) throw new Error(`${axis.kind} axis must have a zero imaginary component`);
    if (axis.kind === "frequency" && real <= 0) throw new Error("Frequency axis must contain positive values");
    if (index > 0 && real <= previous) throw new Error(`${axis.kind} axis must be strictly increasing`);
    previous = real;
  }
}

export function rawVectorValues(parsed: ParsedRawfile, name: string): Float64Array {
  const normalized = name.toLowerCase();
  const vector = parsed.vectors.find((candidate) => candidate.name === normalized);
  const buffer = vector ? parsed.buffers[vector.bufferIndex] : undefined;
  if (!vector || !buffer) throw new Error(`Rawfile is missing ${name}`);
  return new Float64Array(buffer);
}

export function complexReal(values: Float64Array): Float64Array {
  if (values.length % 2 !== 0) throw new Error("Interleaved complex vector length must be even");
  return Float64Array.from({ length: values.length / 2 }, (_, index) => values[index * 2]!);
}

export function complexImaginary(values: Float64Array): Float64Array {
  if (values.length % 2 !== 0) throw new Error("Interleaved complex vector length must be even");
  return Float64Array.from({ length: values.length / 2 }, (_, index) => values[index * 2 + 1]!);
}

export function complexMagnitude(values: Float64Array): Float64Array {
  if (values.length % 2 !== 0) throw new Error("Interleaved complex vector length must be even");
  return Float64Array.from({ length: values.length / 2 }, (_, index) => Math.hypot(values[index * 2]!, values[index * 2 + 1]!));
}

export function complexPhaseDegrees(values: Float64Array): Float64Array {
  if (values.length % 2 !== 0) throw new Error("Interleaved complex vector length must be even");
  return Float64Array.from({ length: values.length / 2 }, (_, index) => Math.atan2(values[index * 2 + 1]!, values[index * 2]!) * 180 / Math.PI);
}

export interface ParsedDCSweepRawfile extends ParsedRawfile {
  sweep: DCSweepResultMetadata;
}

export interface ParsedNoiseRawfile extends ParsedRawfile {
  noise: NoiseResultMetadata;
}

export function parseBinaryRawfile(bytes: Uint8Array, limits: RawfileLimits = {}): ParsedRawfile {
  const maxRawfileBytes = limits.maxRawfileBytes ?? DEFAULT_MAX_RAWFILE_BYTES;
  const maxSamples = limits.maxSamples ?? DEFAULT_MAX_SAMPLES;
  if (bytes.byteLength > maxRawfileBytes) throw new Error(`Rawfile exceeds ${maxRawfileBytes} byte limit`);

  const marker = new TextEncoder().encode("Binary:");
  const markerAt = indexOfBytes(bytes, marker);
  if (markerAt < 0) throw new Error("Rawfile has no Binary: marker");
  let dataAt = markerAt + marker.length;
  if (bytes[dataAt] === 13) dataAt += 1;
  if (bytes[dataAt] !== 10) throw new Error("Rawfile Binary marker must end with a newline");
  dataAt += 1;

  const header = new TextDecoder().decode(bytes.subarray(0, markerAt));
  const lines = header.split(/\r?\n/);
  const field = (name: string): string => {
    const line = lines.find((entry) => entry.toLowerCase().startsWith(`${name.toLowerCase()}:`));
    if (!line) throw new Error(`Rawfile is missing ${name}`);
    return line.slice(line.indexOf(":") + 1).trim();
  };

  const numVariables = Number(field("No. Variables"));
  const numPoints = Number(field("No. Points"));
  if (!Number.isSafeInteger(numVariables) || numVariables < 1) throw new Error("Rawfile variable count is invalid");
  if (!Number.isSafeInteger(numPoints) || numPoints < 1) throw new Error("Rawfile point count is invalid");
  const flags = field("Flags").toLowerCase().split(/\s+/).filter(Boolean);
  const allowedFlags = new Set(["real", "complex"]);
  if (flags.some((flag) => !allowedFlags.has(flag)) || flags.length !== 1 || (flags[0] !== "real" && flags[0] !== "complex")) {
    throw new Error(`Rawfile flags are invalid: ${flags.join(" ") || "none"}`);
  }
  const complex = flags[0] === "complex";
  const samples = numVariables * numPoints * (complex ? 2 : 1);
  if (!Number.isSafeInteger(samples) || samples > maxSamples) throw new Error(`Rawfile exceeds ${maxSamples} sample limit`);

  const variablesAt = lines.findIndex((line) => line.trim().toLowerCase() === "variables:");
  if (variablesAt < 0) throw new Error("Rawfile is missing Variables section");
  const variableLines = lines.slice(variablesAt + 1, variablesAt + 1 + numVariables);
  if (variableLines.length !== numVariables) throw new Error("Rawfile variable table is truncated");
  const variables = variableLines.map((line, index) => {
    const columns = line.trim().split(/\s+/);
    const name = columns[1];
    const type = columns[2];
    if (!name || !type || Number(columns[0]) !== index) throw new Error(`Rawfile variable ${index} is invalid`);
    return { name: name.toLowerCase(), kind: classifyVariable(type) };
  });
  if (new Set(variables.map((variable) => variable.name)).size !== variables.length) throw new Error("Rawfile vector names must be unique");

  const expectedBytes = samples * Float64Array.BYTES_PER_ELEMENT;
  const availableBytes = bytes.byteLength - dataAt;
  if (availableBytes !== expectedBytes) {
    if (availableBytes < expectedBytes) throw new Error(`Rawfile is truncated: expected ${expectedBytes} data bytes, got ${availableBytes}`);
    throw new Error(`Rawfile has ${availableBytes - expectedBytes} trailing data bytes`);
  }

  const source = new DataView(bytes.buffer, bytes.byteOffset + dataAt, expectedBytes);
  const valuesPerPoint = complex ? 2 : 1;
  const arrays = variables.map(() => new Float64Array(numPoints * valuesPerPoint));
  let sourceOffset = 0;
  for (let point = 0; point < numPoints; point += 1) {
    for (let variable = 0; variable < numVariables; variable += 1) {
      const target = arrays[variable];
      if (!target) throw new Error("Rawfile parser allocation failed");
      const targetOffset = point * valuesPerPoint;
      target[targetOffset] = source.getFloat64(sourceOffset, true);
      if (!Number.isFinite(target[targetOffset])) throw new Error(`Rawfile vector ${variables[variable]!.name} contains a non-finite value`);
      sourceOffset += 8;
      if (complex) {
        target[targetOffset + 1] = source.getFloat64(sourceOffset, true);
        if (!Number.isFinite(target[targetOffset + 1])) throw new Error(`Rawfile vector ${variables[variable]!.name} contains a non-finite value`);
        sourceOffset += 8;
      }
    }
  }

  const buffers = arrays.map((array) => array.buffer);
  const vectors: VectorMeta[] = variables.map((variable, index) => ({
    name: variable.name,
    kind: variable.kind,
    length: numPoints,
    complex,
    bufferIndex: index,
  }));
  validateAxis(vectors, arrays, complex);
  return { vectors, buffers, numPoints, samples, complex, bytes: bytes.byteLength };
}

export function parseDCSweepRawfile(bytes: Uint8Array, sweep: DCSweepRunSpec, limits: RawfileLimits = {}): ParsedDCSweepRawfile {
  const parsed = parseBinaryRawfile(bytes, limits);
  if (parsed.complex) throw new Error("DC sweep rawfile must contain real vectors");
  const primaryPoints = dcSweepRangePointCount({ sourceId: sweep.primary.componentId, start: sweep.primary.start, stop: sweep.primary.stop, step: sweep.primary.step });
  const secondaryPoints = sweep.secondary
    ? dcSweepRangePointCount({ sourceId: sweep.secondary.componentId, start: sweep.secondary.start, stop: sweep.secondary.stop, step: sweep.secondary.step })
    : 1;
  if (primaryPoints < 1 || secondaryPoints < 1) throw new Error("DC sweep request has an invalid range");
  const expectedPoints = primaryPoints * secondaryPoints;
  if (parsed.numPoints !== expectedPoints) throw new Error(`DC sweep returned ${parsed.numPoints} points, expected ${expectedPoints}`);
  const axis = parsed.vectors[0];
  if (!axis) throw new Error("DC sweep rawfile has no sweep axis");
  const axisValues = rawVectorValues(parsed, axis.name);
  const tolerance = Math.max(1, Math.abs(sweep.primary.start), Math.abs(sweep.primary.stop)) * 1e-10;
  for (let secondary = 0; secondary < secondaryPoints; secondary += 1) {
    for (let primary = 0; primary < primaryPoints; primary += 1) {
      const actual = axisValues[secondary * primaryPoints + primary];
      const expected = sweep.primary.start + primary * sweep.primary.step;
      if (actual === undefined || Math.abs(actual - expected) > tolerance) {
        throw new Error(`DC sweep axis mismatch at point ${secondary * primaryPoints + primary}: returned ${String(actual)}, expected ${expected}`);
      }
    }
  }
  const vectors: VectorMeta[] = parsed.vectors.map((vector, index) => index === 0 ? { ...vector, name: "sweep", kind: "sweep" } : vector);
  const segments = Array.from({ length: secondaryPoints }, (_, index) => ({
    startIndex: index * primaryPoints,
    length: primaryPoints,
    ...(sweep.secondary ? { secondaryValue: sweep.secondary.start + index * sweep.secondary.step } : {}),
  }));
  return {
    ...parsed,
    vectors,
    sweep: {
      axisVector: "sweep",
      primary: sweep.primary,
      ...(sweep.secondary ? { secondary: sweep.secondary } : {}),
      segments,
    },
  };
}

export function parseNoiseRawfiles(
  densityBytes: Uint8Array,
  integratedBytes: Uint8Array,
  spec: NoiseRunSpec,
  limits: RawfileLimits = {},
): ParsedNoiseRawfile {
  const maxRawfileBytes = limits.maxRawfileBytes ?? DEFAULT_MAX_RAWFILE_BYTES;
  if (densityBytes.byteLength + integratedBytes.byteLength > maxRawfileBytes) throw new Error(`Combined noise rawfiles exceed ${maxRawfileBytes} byte limit`);
  const density = parseBinaryRawfile(densityBytes, limits);
  const integrated = parseBinaryRawfile(integratedBytes, limits);
  const maxSamples = limits.maxSamples ?? DEFAULT_MAX_SAMPLES;
  if (density.samples + integrated.samples > maxSamples) throw new Error(`Combined noise rawfiles exceed ${maxSamples} sample limit`);
  if (density.complex || integrated.complex) throw new Error("Noise rawfiles must contain real vectors");
  if (integrated.numPoints !== 1) throw new Error(`Integrated noise rawfile returned ${integrated.numPoints} points, expected 1`);
  const frequency = rawVectorValues(density, "frequency");
  const inputDensity = rawVectorValues(density, "inoise_spectrum");
  const outputDensity = rawVectorValues(density, "onoise_spectrum");
  if (frequency.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("Noise frequency vector must contain positive finite values");
  if (inputDensity.some((value) => !Number.isFinite(value) || value < 0) || outputDensity.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Noise spectral density vectors must contain non-negative finite values");
  }
  const outputRms = rawVectorValues(integrated, "v(onoise_total)")[0];
  const inputRms = rawVectorValues(integrated, "v(inoise_total)")[0];
  if (!Number.isFinite(outputRms) || outputRms! < 0 || !Number.isFinite(inputRms) || inputRms! < 0) throw new Error("Integrated noise totals are invalid");
  const vectors = density.vectors.map((vector) => vector.name === "onoise_spectrum"
    ? { ...vector, kind: "output-noise-density" as const }
    : vector.name === "inoise_spectrum"
      ? { ...vector, kind: "input-noise-density" as const }
      : vector);
  const inputRmsUnit = spec.input.unit;
  return {
    ...density,
    vectors,
    bytes: density.bytes + integrated.bytes,
    noise: {
      frequencyVector: "frequency",
      outputVector: "onoise_spectrum",
      inputVector: "inoise_spectrum",
      output: {
        ...spec.output,
        densityUnit: "V/√Hz",
        total: { rms: outputRms!, meanSquare: outputRms! ** 2, rmsUnit: "V", meanSquareUnit: "V²" },
      },
      input: {
        ...spec.input,
        densityUnit: inputRmsUnit === "V" ? "V/√Hz" : "A/√Hz",
        total: {
          rms: inputRms!,
          meanSquare: inputRms! ** 2,
          rmsUnit: inputRmsUnit,
          meanSquareUnit: inputRmsUnit === "V" ? "V²" : "A²",
        },
      },
      frequency: spec.frequency,
      temperatureC: spec.temperatureC,
    },
  };
}
