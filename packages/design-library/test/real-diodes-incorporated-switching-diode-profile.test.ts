import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.switching-diode/diodes-incorporated/1N4148W-7-F.json";
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

describe("real Diodes Incorporated 1N4148W-7-F authored facts-V2 profile", () => {
  it("pins the exact order code, electrical limits, and manufacturer-suggested SOD123 geometry", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:3097a64d364b938e643be348db243b97e7394dc783f4a98028f0fbf41967a5d2");
    expect(profile.part).toEqual({
      manufacturerId: "diodes-incorporated",
      manufacturerPartNumber: "1N4148W-7-F",
    });
    expect(profile.factsSchemaVersion).toBe("2.0.0");

    const facts = profile.facts as Record<string, any>;
    expect([
      profile.commonFacts.packageName.state,
      facts.reverseVoltage.state,
      facts.continuousForwardCurrent.state,
      facts.forwardVoltage.state,
    ]).toEqual(["reviewed", "reviewed", "reviewed", "reviewed"]);
    expect(facts.reverseVoltage.value).toEqual({ value: 100, unit: "V", displayUnit: "100 V" });
    expect(facts.continuousForwardCurrent.value).toEqual({ value: 0.3, unit: "A", displayUnit: "300 mA" });
    expect(facts.forwardVoltage.value).toEqual({ value: 0.855, unit: "V", displayUnit: "855 mV" });
    expect(facts.forwardVoltage.validFor).toEqual(expect.arrayContaining([
      expect.objectContaining({ parameterId: "ambientTemperature", minimum: expect.objectContaining({ value: 298.15, unit: "K" }) }),
      expect.objectContaining({ parameterId: "testCurrent", minimum: expect.objectContaining({ value: 0.01, unit: "A" }) }),
    ]));
    expect(facts.reverseRecoveryTime.value).toEqual({ value: 4e-9, unit: "s", displayUnit: "4 ns" });
    expect(facts.reverseRecoveryTime.state).toBe("estimated");
    expect(facts.reverseRecoveryCharge).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.0000038475, unit: "m2", displayUnit: "3.8475 mm²" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", dimensionId: "suggested-pad-layout-x1-total-span", multiplier: 1, maximum: { value: 0.00405, unit: "m" } },
        { axis: "y", dimensionId: "suggested-pad-layout-y-pad-height", multiplier: 1, maximum: { value: 0.00095, unit: "m" } },
      ],
    });
    expect(facts.mountedGeometry.maximumHeight.value.height).toEqual({ value: 0.00135, unit: "m", displayUnit: "1.35 mm" });
    expect(facts.mountedGeometry.boardArea.evidence.map((item: any) => item.locator)).toEqual([
      "page 4, SOD123 Suggested Pad Layout: pad height Y = 0.950 mm",
      "page 4, SOD123 Suggested Pad Layout: total horizontal span X1 = 4.050 mm",
    ]);

    const evidence = JSON.stringify(profile);
    expect(evidence).toContain("sha256:39c16a6888bdab22418e93e17182174aad763a66957a4632e70c944194e3fc08");
    expect(evidence).toContain("https://www.diodes.com/datasheet/download/1N4148W.pdf");
    expect(evidence).not.toMatch(/stock|availability|distributor|simulation/i);
  });
});
