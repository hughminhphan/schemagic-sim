import { describe, expect, it } from "vitest";
import { linearTicks, logTicks, niceStep } from "../src/ticks";

describe("tick generation", () => {
  it("uses 1-2-5 steps", () => {
    expect(niceStep(9, 6)).toBe(2);
    expect(niceStep(24, 6)).toBe(5);
    expect(niceStep(70, 6)).toBe(20);
  });

  it("generates stable linear ticks", () => {
    expect(linearTicks(-0.2, 1.1, 5).map((tick) => tick.value)).toEqual([0, 0.5, 1]);
  });

  it("generates log decades with 2 and 5 minors", () => {
    expect(logTicks(10, 1000)).toEqual([
      { value: 10, major: true }, { value: 20, major: false }, { value: 50, major: false },
      { value: 100, major: true }, { value: 200, major: false }, { value: 500, major: false },
      { value: 1000, major: true },
    ]);
  });
});
