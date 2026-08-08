import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseBinaryRawfile, parseDCSweepRawfile, parseNoiseRawfiles } from "../src/rawfile";
import type { DCSweepRunSpec, NoiseRunSpec } from "../src/types";

const fixturePath = fileURLToPath(new URL("./fixtures/simple-real.raw", import.meta.url));

function dcRawfile(rows: number[][]): Uint8Array {
  const variables = ["v(v-sweep)\tvoltage", "v(out)\tvoltage"];
  const header = new TextEncoder().encode([
    "Title: dc sweep fixture",
    "Plotname: DC transfer characteristic",
    "Flags: real",
    `No. Variables: ${variables.length}`,
    `No. Points: ${rows.length}`,
    "Variables:",
    ...variables.map((variable, index) => `\t${index}\t${variable}`),
    "Binary:\n",
  ].join("\n"));
  const data = new Uint8Array(rows.length * variables.length * 8);
  const view = new DataView(data.buffer);
  let offset = 0;
  for (const row of rows) for (const value of row) { view.setFloat64(offset, value, true); offset += 8; }
  const output = new Uint8Array(header.length + data.length);
  output.set(header);
  output.set(data, header.length);
  return output;
}

function realRawfile(plotname: string, variables: string[], rows: number[][]): Uint8Array {
  const header = new TextEncoder().encode([
    "Title: noise fixture",
    `Plotname: ${plotname}`,
    "Flags: real",
    `No. Variables: ${variables.length}`,
    `No. Points: ${rows.length}`,
    "Variables:",
    ...variables.map((variable, index) => `\t${index}\t${variable}`),
    "Binary:\n",
  ].join("\n"));
  const data = new Uint8Array(rows.length * variables.length * 8);
  const view = new DataView(data.buffer);
  let offset = 0;
  for (const row of rows) for (const value of row) { view.setFloat64(offset, value, true); offset += 8; }
  const output = new Uint8Array(header.length + data.length);
  output.set(header);
  output.set(data, header.length);
  return output;
}

const primary = { componentId: "c1", name: "V1", unit: "V", start: 0, stop: 2, step: 1 } as const;

describe("parseBinaryRawfile", () => {
  it("parses validated real binary vectors into Float64 transfer buffers", () => {
    const parsed = parseBinaryRawfile(new Uint8Array(readFileSync(fixturePath)));
    expect(parsed.numPoints).toBe(3);
    expect(parsed.complex).toBe(false);
    expect(parsed.vectors.map((vector) => vector.name)).toEqual(["time", "v(out)"]);
    expect([...new Float64Array(parsed.buffers[0]!)]).toEqual([0, 0.5, 1]);
    expect([...new Float64Array(parsed.buffers[1]!)]).toEqual([1, 2, 3]);
  });

  it("rejects truncated and over-limit fixtures before allocation", () => {
    const bytes = new Uint8Array(readFileSync(fixturePath));
    expect(() => parseBinaryRawfile(bytes.subarray(0, bytes.length - 8))).toThrow(/truncated/i);
    expect(() => parseBinaryRawfile(bytes, { maxSamples: 5 })).toThrow(/sample limit/i);
  });

  it("parses a one-source DC sweep with an explicit sweep axis", () => {
    const parsed = parseDCSweepRawfile(dcRawfile([[0, 0], [1, 0.7], [2, 0.75]]), { primary });
    expect(parsed.vectors[0]).toMatchObject({ name: "sweep", kind: "sweep", length: 3 });
    expect([...new Float64Array(parsed.buffers[0]!)]).toEqual([0, 1, 2]);
    expect([...new Float64Array(parsed.buffers[1]!)]).toEqual([0, 0.7, 0.75]);
    expect(parsed.sweep).toEqual({ axisVector: "sweep", primary, segments: [{ startIndex: 0, length: 3 }] });
  });

  it("parses noise density vectors and integrated RMS plus mean-square totals", () => {
    const spec: NoiseRunSpec = {
      output: { probeId: "p1", positiveNode: "n2", negativeNode: "0" },
      input: { componentId: "c1", name: "V1", unit: "V" },
      frequency: { sweep: "dec", pointsPerDecade: 10, fstart: 10, fstop: 1000 },
      temperatureC: 27,
    };
    const density = realRawfile("Noise Spectral Density Curves", [
      "frequency\tfrequency",
      "inoise_spectrum\tvoltage-density",
      "onoise_spectrum\tvoltage-density",
    ], [[10, 4e-9, 2e-9], [100, 4e-9, 2e-9], [1000, 4e-9, 2e-9]]);
    const integrated = realRawfile("Integrated Noise", [
      "v(onoise_total)\tvoltage",
      "v(inoise_total)\tvoltage",
    ], [[6e-8, 1.2e-7]]);
    const parsed = parseNoiseRawfiles(density, integrated, spec);
    expect(parsed.vectors).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "onoise_spectrum", kind: "output-noise-density" }),
      expect.objectContaining({ name: "inoise_spectrum", kind: "input-noise-density" }),
    ]));
    expect(parsed.noise.output).toMatchObject({ densityUnit: "V/√Hz", total: { rms: 6e-8, rmsUnit: "V", meanSquareUnit: "V²" } });
    expect(parsed.noise.output.total.meanSquare).toBeCloseTo(3.6e-15, 20);
    expect(parsed.noise.input).toMatchObject({ densityUnit: "V/√Hz", total: { rms: 1.2e-7, rmsUnit: "V", meanSquareUnit: "V²" } });
    expect(parsed.noise.input.total.meanSquare).toBeCloseTo(1.44e-14, 20);
  });

  it("parses a two-source DC sweep into stepped curve segments", () => {
    const sweep: DCSweepRunSpec = {
      primary,
      secondary: { componentId: "c2", name: "I2", unit: "A", start: 0, stop: 0.001, step: 0.0005 },
    };
    const parsed = parseDCSweepRawfile(dcRawfile([
      [0, 0], [1, 0.7], [2, 0.75],
      [0, 0.1], [1, 0.72], [2, 0.78],
      [0, 0.2], [1, 0.74], [2, 0.81],
    ]), sweep);
    expect(parsed.numPoints).toBe(9);
    expect(parsed.sweep.segments).toEqual([
      { startIndex: 0, length: 3, secondaryValue: 0 },
      { startIndex: 3, length: 3, secondaryValue: 0.0005 },
      { startIndex: 6, length: 3, secondaryValue: 0.001 },
    ]);
  });
});
