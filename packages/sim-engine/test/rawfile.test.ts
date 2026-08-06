import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseBinaryRawfile } from "../src/rawfile";

const fixturePath = fileURLToPath(new URL("./fixtures/simple-real.raw", import.meta.url));

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
});
