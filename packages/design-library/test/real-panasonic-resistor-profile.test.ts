import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.general-purpose-resistor/panasonic-industry/ERJ3EKF1003V.json";
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

describe("real Panasonic resistor facts-V2 profile", () => {
  it("keeps exact-MPN facts, conservative mounted geometry, and evidence boundaries closed", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:56f2022018a349a1bd48bf60804aa6147967fc3173e5ffea78d001a0c162e0a1");
    expect(profile.part).toEqual({
      manufacturerId: "panasonic-industry",
      manufacturerPartNumber: "ERJ3EKF1003V",
    });
    expect(profile.factsSchemaVersion).toBe("2.0.0");

    const facts = profile.facts as Record<string, any>;
    expect(facts.resistance.value).toEqual({ value: 100000, unit: "ohm", displayUnit: "100 kΩ" });
    expect(facts.tolerance.value).toEqual({ value: 0.01, unit: "1", displayUnit: "±1 %" });
    expect(facts.temperatureCoefficient.value).toEqual({ value: 0.0001, unit: "1/K", displayUnit: "±100 ppm/K" });
    expect(facts.continuousPower.value).toEqual({ value: 0.1, unit: "W", displayUnit: "100 mW" });
    expect(facts.continuousPower.validFor[0]).toMatchObject({
      parameterId: "ambientTemperature",
      minimum: { value: 343.15, unit: "K" },
      maximum: { value: 343.15, unit: "K" },
    });
    expect(facts.workingVoltage.value).toEqual({ value: 75, unit: "V", displayUnit: "75 V" });
    expect(facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.0000022, unit: "m2", displayUnit: "2.20 mm²" },
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", dimensionId: "recommended-total-span-b", multiplier: 1, maximum: { value: 0.0022, unit: "m" } },
        { axis: "y", dimensionId: "recommended-pad-width-c", multiplier: 1, maximum: { value: 0.001, unit: "m" } },
      ],
    });
    expect(facts.mountedGeometry.maximumHeight.value.height).toEqual({ value: 0.00055, unit: "m", displayUnit: "0.55 mm" });
    expect(facts.pulsePower).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });

    const evidence = JSON.stringify(profile);
    expect(evidence).toContain("sha256:b10d2a5a712dff63185fc939fbe58e7ac0fbdd14488187c232259722ce103901");
    expect(evidence).toContain("sha256:78825b819853a63f57cc18214f321d2f1da9dc205a7e58af7db18ae73563e378");
    expect(evidence).toContain("sha256:fc707b230cce91d464bc3aaf1ed614fa5b412f40cbe7df7cab1541d2c164a882");
    expect(evidence).not.toMatch(/stock|availability|distributor|simulation/i);
  });
});
