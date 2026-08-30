import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.switching-diode/vishay-intertechnology/1N4148-TAP.json";
import manufacturers from "../manufacturers.json";
import {
  designProfileContentHash,
  validateDesignProfile,
  validateProfileAdmissionRules,
  type DesignProfileV1,
  type ManufacturerRegistryV1,
} from "../src";

const profile = profileJson as DesignProfileV1;
const registry = manufacturers as ManufacturerRegistryV1;

describe("real Vishay 1N4148-TAP profile", () => {
  it("pins exact ordering identity and manufacturer-supported electrical facts", () => {
    expect(validateDesignProfile(profile, registry)).toEqual([]);
    expect(designProfileContentHash(profile)).toBe("sha256:fcee6db60c9d66e33eede2527be8d6565e5883ffbd7313543a27d6de1947d045");
    expect(profile.part).toEqual({
      manufacturerId: "vishay-intertechnology",
      manufacturerPartNumber: "1N4148-TAP",
    });
    expect(profile.commonFacts.packageName.value).toBe("DO-35 (DO-204AH), TAP ammopack");

    const facts = profile.facts as Record<string, any>;
    expect(facts.reverseVoltage.value).toEqual({ value: 75, unit: "V", displayUnit: "V" });
    expect(facts.continuousForwardCurrent.value).toEqual({ value: 0.3, unit: "A", displayUnit: "300 mA" });
    expect(facts.forwardVoltage.value).toEqual({ value: 1, unit: "V", displayUnit: "V" });
    expect(facts.forwardVoltage.validFor).toEqual(expect.arrayContaining([
      expect.objectContaining({ parameterId: "testCurrent", minimum: expect.objectContaining({ value: 0.01, unit: "A" }), maximum: expect.objectContaining({ value: 0.01, unit: "A" }) }),
      expect.objectContaining({ parameterId: "ambientTemperature", minimum: expect.objectContaining({ value: 298.15, unit: "K" }), maximum: expect.objectContaining({ value: 298.15, unit: "K" }) }),
    ]));
    expect(facts.reverseRecoveryTime.value).toEqual({ value: 4e-9, unit: "s", displayUnit: "4 ns" });
    expect(facts.reverseRecoveryTime.validFor).toEqual(expect.arrayContaining([
      expect.objectContaining({ parameterId: "testCurrent", minimum: expect.objectContaining({ value: 0.01, unit: "A" }), maximum: expect.objectContaining({ value: 0.01, unit: "A" }) }),
      expect.objectContaining({ parameterId: "testVoltage", minimum: expect.objectContaining({ value: 6, unit: "V" }), maximum: expect.objectContaining({ value: 6, unit: "V" }) }),
      expect.objectContaining({ parameterId: "ambientTemperature", minimum: expect.objectContaining({ value: 298.15, unit: "K" }), maximum: expect.objectContaining({ value: 298.15, unit: "K" }) }),
    ]));
    expect(facts.reverseRecoveryCharge).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });

    const evidence = JSON.stringify(profile);
    expect(evidence).toContain("sha256:aefe85400a427ed886a4e1c88205ceabb9f9b38044b29c6acee4bb00146a44b7");
    expect(evidence).toContain("https://www.vishay.com/docs/81857/1n4148.pdf");
    expect(evidence).not.toMatch(/stock|availability|distributor|simulation/i);
  });

  it("keeps admission blocked without manufacturer-defined installed geometry", () => {
    expect(profile.commonFacts.boardArea).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(profile.commonFacts.maximumHeight).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(validateProfileAdmissionRules(profile)).toEqual([
      expect.objectContaining({ path: "commonFacts.boardArea.state", code: "not_reviewed" }),
      expect.objectContaining({ path: "commonFacts.maximumHeight.state", code: "not_reviewed" }),
    ]);
  });
});
