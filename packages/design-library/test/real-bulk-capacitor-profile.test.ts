import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.bulk-capacitor/panasonic-industry/EEHZS1V331V.json";
import manufacturers from "../manufacturers.json";
import {
  designProfileEnvelopeContentHash,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type DesignProfileWithFactsV2,
  type ManufacturerRegistryV1,
  type PartClassId,
} from "../src";

const profile = profileJson as DesignProfileWithFactsV2<PartClassId, object>;
const registry = manufacturers as ManufacturerRegistryV1;

describe("real EEHZS1V331V facts-V2 profile", () => {
  it("keeps the exact conditioned endurance, conservative ripple rating, and G12 geometry closed", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:e718d9dd57fad4ff5283c1d0d926477e514365a3fb64088b446577f44e2c4f90");
    const facts = profile.facts as Record<string, any>;
    expect(facts.nominalCapacitance.value).toEqual({ value: 0.00033, unit: "F", displayUnit: "330 µF" });
    expect(facts.ratedVoltage.value).toEqual({ value: 35, unit: "V", displayUnit: "35 VDC" });
    expect(facts.equivalentSeriesResistance.value).toEqual({ value: 0.014, unit: "ohm", displayUnit: "14 mΩ max" });
    expect(facts.rippleCurrent.value).toEqual({ value: 2.5, unit: "A", displayUnit: "2.5 A rms" });
    expect(facts.lifetime.value).toEqual({ value: 14400000, unit: "s", displayUnit: "4000 h" });
    expect(facts.lifetime.validFor.map((entry: { parameterId: string }) => entry.parameterId)).toEqual([
      "ambientTemperature", "testCurrent", "switchingFrequency", "testVoltage",
    ]);
    expect(facts.mountedGeometry.boardArea.value.area.value).toBe(0.00005969);
    expect(facts.mountedGeometry.maximumHeight.value.height.value).toBe(0.0131);
    for (const key of ["effectiveCapacitance", "biasDeratingRatio", "transientEnergyAssumption"] as const) {
      expect(facts[key]).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    }
  });
});
