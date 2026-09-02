import { describe, expect, it } from "vitest";
import {
  calculateIntegratedBuckCurrentLimitV1,
  calculateIntegratedBuckJunctionTemperatureV1,
  calculateIntegratedBuckLossV1,
} from "@opencircuit/design-recipes/power-engine-internal";

describe("integrated synchronous buck calculators", () => {
  it("computes 12 V to 5 V loss as 0.2283 W conduction + 0.18 W switching + 0.0012 W quiescent", () => {
    const result = calculateIntegratedBuckLossV1({
      inputVoltageV: 12,
      outputVoltageV: 5,
      outputCurrentA: 2,
      switchingFrequencyHz: 500_000,
      inductanceMinimumH: 10e-6,
      highSideOnResistanceMaximumOhm: 0.08,
      lowSideOnResistanceMaximumOhm: 0.04,
      nonSwitchingSupplyCurrentMaximumA: 100e-6,
      switchingTransitionMaximumS: 30e-9,
    });
    expect(result.disposition).toBe("pass");
    if (result.disposition !== "pass") throw new Error("Expected a closed loss result");
    // D = 5/12; delta-I = 5*(1-5/12)/(500 kHz*10 uH) = 0.583333 A.
    // I_rms^2 = 2^2 + 0.583333^2/12 = 4.028356 A^2.
    // P_cond = I_rms^2 * (D*0.08 + (1-D)*0.04) = 0.228274 W.
    // P_sw = 0.5*12*2*(20 ns+10 ns)*500 kHz = 0.18 W.
    // P_q = 12*100 uA = 0.0012 W.
    expect(result.dutyCycle).toBeCloseTo(5 / 12, 12);
    expect(result.rippleCurrentA).toBeCloseTo(7 / 12, 12);
    expect(result.conductionLossW).toBeCloseTo(0.22827353395, 9);
    expect(result.switchingLossW).toBeCloseTo(0.18, 12);
    expect(result.quiescentLossW).toBeCloseTo(0.0012, 12);
    expect(result.totalLossW).toBeCloseTo(0.40947353395, 9);
  });

  it("names the frozen facts 3.5 schema gap when no transition bound is available", () => {
    expect(calculateIntegratedBuckLossV1({
      inputVoltageV: 12,
      outputVoltageV: 5,
      outputCurrentA: 2,
      switchingFrequencyHz: 500_000,
      inductanceMinimumH: 10e-6,
      highSideOnResistanceMaximumOhm: 0.08,
      lowSideOnResistanceMaximumOhm: 0.04,
      nonSwitchingSupplyCurrentMaximumA: 100e-6,
      switchingTransitionMaximumS: null,
    })).toEqual({
      disposition: "unknown",
      missingInputs: ["facts 3.5 has no switching-transition bound field"],
    });
  });

  it("computes junction temperature as 298.15 K + 0.5 W * 50 K/W = 323.15 K", () => {
    const result = calculateIntegratedBuckJunctionTemperatureV1({
      totalLossW: 0.5,
      ambientTemperatureK: 298.15,
      thermalResistanceJunctionAmbientMaximumKPerW: 50,
      datasheetMaximumJunctionTemperatureK: 423.15,
      designMaximumJunctionTemperatureK: 373.15,
    });
    expect(result).toEqual({
      disposition: "pass",
      junctionTemperatureK: 323.15,
      limitK: 373.15,
      marginK: 50,
    });
  });

  it("fails junction temperature when 350 K + 2 W * 50 K/W = 450 K exceeds 423.15 K", () => {
    const result = calculateIntegratedBuckJunctionTemperatureV1({
      totalLossW: 2,
      ambientTemperatureK: 350,
      thermalResistanceJunctionAmbientMaximumKPerW: 50,
      datasheetMaximumJunctionTemperatureK: 423.15,
      designMaximumJunctionTemperatureK: 450,
    });
    expect(result.disposition).toBe("fail");
    if (result.disposition === "unknown") throw new Error("Expected a closed junction result");
    expect(result.junctionTemperatureK).toBe(450);
    expect(result.marginK).toBeCloseTo(-26.85, 12);
  });

  it("passes 4 A minimum limit over 2 A + 0.291667 A ripple half with 20 percent margin", () => {
    const result = calculateIntegratedBuckCurrentLimitV1({
      inputVoltageMaximumV: 12,
      outputVoltageV: 5,
      outputCurrentMaximumA: 2,
      switchingFrequencyMinimumHz: 500_000,
      inductanceMinimumH: 10e-6,
      currentLimitMinimumA: 4,
      requiredMarginRatio: 0.2,
    });
    expect(result.disposition).toBe("pass");
    if (result.disposition === "unknown") throw new Error("Expected a closed current-limit result");
    // delta-I = 0.583333 A, I_peak = 2.291667 A, required = 2.75 A.
    expect(result.rippleCurrentA).toBeCloseTo(7 / 12, 12);
    expect(result.peakInductorCurrentA).toBeCloseTo(55 / 24, 12);
    expect(result.requiredCurrentLimitA).toBeCloseTo(2.75, 12);
    expect(result.marginA).toBeCloseTo(1.25, 12);
  });

  it("fails a 2.5 A minimum limit against the same 2.75 A requirement", () => {
    const result = calculateIntegratedBuckCurrentLimitV1({
      inputVoltageMaximumV: 12,
      outputVoltageV: 5,
      outputCurrentMaximumA: 2,
      switchingFrequencyMinimumHz: 500_000,
      inductanceMinimumH: 10e-6,
      currentLimitMinimumA: 2.5,
      requiredMarginRatio: 0.2,
    });
    expect(result.disposition).toBe("fail");
    if (result.disposition === "unknown") throw new Error("Expected a closed current-limit result");
    expect(result.marginA).toBeCloseTo(-0.25, 12);
  });

  it("keeps missing minimum inductance honest", () => {
    expect(calculateIntegratedBuckCurrentLimitV1({
      inputVoltageMaximumV: 12,
      outputVoltageV: 5,
      outputCurrentMaximumA: 2,
      switchingFrequencyMinimumHz: 500_000,
      inductanceMinimumH: null,
      currentLimitMinimumA: 4,
      requiredMarginRatio: 0.2,
    })).toEqual({ disposition: "unknown", missingInputs: ["inductanceMinimumH"] });
  });
});
