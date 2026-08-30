import { dcSweepRangePointCount } from "@opencircuit/circuit-schema";
import type { DCSweepResultMetadata, DCSweepRunSpec, NoiseResultMetadata, NoiseRunSpec, VectorMeta } from "./types";

const DEFAULT_MAX_RAWFILE_BYTES = 128 * 1024 * 1024;
const DEFAULT_MAX_SAMPLES = 1_000_000;

export interface ParsedRawfile {
  vectors: VectorMeta[];
  buffers: ArrayBuffer[];
  numPoints: number;
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
  while (bytes[dataAt] === 32 || bytes[dataAt] === 9) dataAt += 1;
  if (bytes[dataAt] === 13 && bytes[dataAt + 1] === 10) dataAt += 2;
  else if (bytes[dataAt] === 10) dataAt += 1;
  else throw new Error("Rawfile Binary: marker has no line ending");

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
  const complex = field("Flags").toLowerCase().split(/\s+/).includes("complex");
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

  const expectedBytes = samples * Float64Array.BYTES_PER_ELEMENT;
  const availableBytes = bytes.byteLength - dataAt;
  if (availableBytes < expectedBytes) throw new Error(`Rawfile is truncated: expected ${expectedBytes} data bytes, got ${availableBytes}`);
  if (availableBytes > expectedBytes) throw new Error(`Rawfile has trailing data: expected ${expectedBytes} data bytes, got ${availableBytes}`);

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
      sourceOffset += 8;
      if (complex) {
        target[targetOffset + 1] = source.getFloat64(sourceOffset, true);
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
  return { vectors, buffers, numPoints, complex, bytes: bytes.byteLength };
}

function vectorValues(parsed: ParsedRawfile, name: string): Float64Array {
  const vector = parsed.vectors.find((candidate) => candidate.name === name);
  const buffer = vector ? parsed.buffers[vector.bufferIndex] : undefined;
  if (!vector || !buffer) throw new Error(`Noise rawfile is missing ${name}`);
  return new Float64Array(buffer);
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
  const density = parseBinaryRawfile(densityBytes, limits);
  const integrated = parseBinaryRawfile(integratedBytes, limits);
  if (density.complex || integrated.complex) throw new Error("Noise rawfiles must contain real vectors");
  if (integrated.numPoints !== 1) throw new Error(`Integrated noise rawfile returned ${integrated.numPoints} points, expected 1`);
  const frequency = vectorValues(density, "frequency");
  const inputDensity = vectorValues(density, "inoise_spectrum");
  const outputDensity = vectorValues(density, "onoise_spectrum");
  if (frequency.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("Noise frequency vector must contain positive finite values");
  if (inputDensity.some((value) => !Number.isFinite(value) || value < 0) || outputDensity.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Noise spectral density vectors must contain non-negative finite values");
  }
  const outputRms = vectorValues(integrated, "v(onoise_total)")[0];
  const inputRms = vectorValues(integrated, "v(inoise_total)")[0];
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
