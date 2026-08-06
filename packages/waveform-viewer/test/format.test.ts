import { describe, expect, it } from "vitest";
import { formatValue } from "../src/format";

describe("engineering value formatting", () => {
  it("uses engineering prefixes and three significant figures", () => {
    expect(formatValue(0.0000047, { unit: "A", reserveSign: false })).toBe("4.70 µA");
    expect(formatValue(-4700, { unit: "Ω" })).toBe("−4.70 kΩ");
  });

  it("keeps dB and phase in their native units", () => {
    expect(formatValue(-0.189, { unit: "dB" })).toBe("−0.189 dB");
    expect(formatValue(89.4, { unit: "°", reserveSign: false })).toBe("89.4 °");
  });
});
