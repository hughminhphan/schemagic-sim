import { describe, expect, it } from "vitest";
import { snapCursorIndex } from "../src/cursor";

describe("cursor snapping", () => {
  const x = Float64Array.from([1, 2, 4, 8, 16]);

  it("snaps to the closest exact sample", () => {
    expect(snapCursorIndex(x, 3.1)).toBe(2);
    expect(snapCursorIndex(x, 2.9)).toBe(1);
    expect(snapCursorIndex(x, -10)).toBe(0);
    expect(snapCursorIndex(x, 99)).toBe(4);
  });

  it("uses log distance for frequency cursors", () => {
    expect(snapCursorIndex(x, Math.sqrt(8), true)).toBe(1);
    expect(snapCursorIndex(x, 3.9, true)).toBe(2);
  });
});
