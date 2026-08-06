import { describe, expect, it } from "vitest";
import { complexToBode } from "../src/ac";

describe("complex Bode conversion", () => {
  it("converts interleaved complex values to dB and degrees", () => {
    const result = complexToBode(Float64Array.from([1, 0, 0, 1, -1, 0]));
    expect([...result.magnitudeDb]).toEqual([0, 0, 0]);
    expect([...result.phaseDeg]).toEqual([0, 90, 180]);
  });

  it("optionally unwraps phase", () => {
    const polar = (degrees: number): [number, number] => {
      const radians = degrees * Math.PI / 180;
      return [Math.cos(radians), Math.sin(radians)];
    };
    const input = Float64Array.from([...polar(170), ...polar(-170), ...polar(-150)]);
    expect([...complexToBode(input, false).phaseDeg].map(Math.round)).toEqual([170, -170, -150]);
    expect([...complexToBode(input, true).phaseDeg].map(Math.round)).toEqual([170, 190, 210]);
  });

  it("rejects malformed AC vectors", () => {
    expect(() => complexToBode(Float64Array.from([1, 2, 3]))).toThrow(/interleaved/);
  });
});
