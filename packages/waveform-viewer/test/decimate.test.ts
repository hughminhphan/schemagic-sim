import { describe, expect, it } from "vitest";
import { decimateMinMax } from "../src/decimate";

describe("min/max decimation", () => {
  it("preserves both extrema in each occupied pixel column", () => {
    const x = Float64Array.from({ length: 100 }, (_, index) => index);
    const y = Float64Array.from({ length: 100 }, (_, index) => Math.sin(index));
    y[22] = -50;
    y[27] = 75;
    const points = decimateMinMax(x, y, 0, 99, 10);
    expect(points.some((point) => point.index === 22 && point.y === -50)).toBe(true);
    expect(points.some((point) => point.index === 27 && point.y === 75)).toBe(true);
    expect(points.length).toBeLessThanOrEqual(20);
  });

  it("retains source order within a column", () => {
    const points = decimateMinMax(
      Float64Array.from([0, 0.1, 0.2, 0.3]),
      Float64Array.from([0, 8, -5, 1]),
      0,
      1,
      1,
    );
    expect(points.map((point) => point.index)).toEqual([1, 2]);
  });
});
