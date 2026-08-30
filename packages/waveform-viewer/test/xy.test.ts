import { describe, expect, it } from "vitest";
import { orderedXYPoints } from "../src/xy";

describe("ordered XY rendering", () => {
  it("preserves source order for a non-monotonic closed path", () => {
    const x = Float64Array.of(0, 1, 0, -1, 0);
    const y = Float64Array.of(1, 0, -1, 0, 1);
    const points = orderedXYPoints(x, y, -1, 1, 100);

    expect(points.map((point) => point.index)).toEqual([0, 1, 2, 3, 4]);
    expect(points.map((point) => point.x)).toEqual([0, 1, 0, -1, 0]);
  });

  it("thins in source order without min/max sorting", () => {
    const x = Float64Array.from({ length: 101 }, (_, index) => Math.sin(index));
    const y = Float64Array.from({ length: 101 }, (_, index) => Math.cos(index));
    const points = orderedXYPoints(x, y, -1, 1, 12);

    expect(points[0]?.index).toBe(0);
    expect(points.at(-1)?.index).toBe(100);
    expect(points.every((point, index) => index === 0 || point.index > points[index - 1]!.index)).toBe(true);
  });
});
