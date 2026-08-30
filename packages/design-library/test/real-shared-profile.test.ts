import { describe, expect, it } from "vitest";
import crcw0603100kfkea from "../parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603100KFKEA.json";
import crcw0603732kfkea from "../parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json";
import c1608x7r1h104k080aa from "../parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json";
import c3216x7r1h106k160ac from "../parts/shared.mlcc-capacitor/tdk-corporation/C3216X7R1H106K160AC.json";
import manufacturers from "../manufacturers.json";
import {
  designProfileEnvelopeContentHash,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type DesignProfileWithFactsV2,
  type ManufacturerRegistryV1,
  type PartClassId,
} from "../src";

const profile = crcw0603100kfkea as DesignProfileWithFactsV2<PartClassId, object>;
const highValueResistorProfile = crcw0603732kfkea as DesignProfileWithFactsV2<PartClassId, object>;
const smallMlccProfile = c1608x7r1h104k080aa as DesignProfileWithFactsV2<PartClassId, object>;
const mlccProfile = c3216x7r1h106k160ac as DesignProfileWithFactsV2<PartClassId, object>;
const registry = manufacturers as ManufacturerRegistryV1;

describe("real shared facts-V2 profile", () => {
  it("keeps the exact CRCW0603100KFKEA source, geometry, and admission semantics closed", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:f0320c991d8cf882396657e8d0b23aa3c8253b7d7be16f3aff6a29a15a6b83a0");
    expect(profile.factsSchemaVersion).toBe("2.0.0");
    const facts = profile.facts as Record<string, any>;
    expect(facts.resistance.value).toEqual({ value: 100000, unit: "ohm", displayUnit: "100 kΩ" });
    expect(facts.continuousPower.validFor[0]).toMatchObject({
      parameterId: "ambientTemperature",
      minimum: { value: 343.15, unit: "K" },
      maximum: { value: 343.15, unit: "K" },
    });
    expect(facts.mountedGeometry.boardArea.value.area.value).toBe(0.00000225);
    expect(facts.mountedGeometry.maximumHeight.value.height.value).toBe(0.0005);
    expect(facts.pulsePower).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    for (const evidence of [
      ...profile.commonFacts.packageName.evidence,
      ...facts.resistance.evidence,
      ...facts.tolerance.evidence,
      ...facts.temperatureCoefficient.evidence,
      ...facts.continuousPower.evidence,
      ...facts.workingVoltage.evidence,
      ...facts.mountedGeometry.boardArea.evidence,
      ...facts.mountedGeometry.maximumHeight.evidence,
    ]) expect(evidence.contentHash).toBe("sha256:1f5e20329c74727da629b92e2bfbdbdb3fa3be57229e3208e24058173f9cecf3");
  });

  it("keeps the exact CRCW0603732KFKEA source, geometry, and admission semantics closed", () => {
    expect(validateDesignProfileEnvelope(highValueResistorProfile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(highValueResistorProfile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(highValueResistorProfile)).toBe("sha256:30d45602549f1ab1c4f9434b419ccdfa95a5381ef70ff4297d7ceb6ae50259c4");
    const facts = highValueResistorProfile.facts as Record<string, any>;
    expect(facts.resistance.value).toEqual({ value: 732000, unit: "ohm", displayUnit: "732 kΩ" });
    expect(facts.continuousPower.value).toEqual({ value: 0.1, unit: "W", displayUnit: "100 mW" });
    expect(facts.continuousPower.validFor).toMatchObject([{
      parameterId: "ambientTemperature",
      minimum: { value: 298.15, unit: "K" },
      maximum: { value: 343.15, unit: "K" },
    }]);
    expect(facts.continuousPower.evidence[0].locator).toContain("P70 = 0.10 W");
    expect(facts.continuousPower.evidence[0].locator).toContain("flat at 0.10 W from -55 °C through 70 °C ambient");
    expect(facts.workingVoltage.value).toEqual({ value: 75, unit: "V", displayUnit: "75 V" });
    expect(facts.mountedGeometry.boardArea.value.area.value).toBe(0.00000225);
    expect(facts.mountedGeometry.maximumHeight.value.height.value).toBe(0.0005);
    expect(facts.pulsePower).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    for (const evidence of [
      ...highValueResistorProfile.commonFacts.packageName.evidence,
      ...facts.resistance.evidence,
      ...facts.tolerance.evidence,
      ...facts.temperatureCoefficient.evidence,
      ...facts.continuousPower.evidence,
      ...facts.workingVoltage.evidence,
      ...facts.mountedGeometry.boardArea.evidence,
      ...facts.mountedGeometry.maximumHeight.evidence,
    ]) expect(evidence.contentHash).toBe("sha256:124bdade8ba3957ee1b925d51a2d95ce571075780645d3d75b4a8502fc6cf068");
  });

  it("keeps the exact C3216X7R1H106K160AC source, conservative geometry, and admission semantics closed", () => {
    expect(validateDesignProfileEnvelope(mlccProfile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(mlccProfile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(mlccProfile)).toBe("sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd");
    const facts = mlccProfile.facts as Record<string, any>;
    expect(facts.nominalCapacitance.value).toEqual({ value: 0.00001, unit: "F", displayUnit: "10 µF" });
    expect(facts.ratedVoltage.value).toEqual({ value: 50, unit: "V", displayUnit: "50 VDC" });
    expect(facts.temperatureCharacteristic.value).toBe("X7R (±15 %)");
    expect(facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.00000768, unit: "m2" },
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", dimensionId: "reflow-inner-pad-gap-pa", multiplier: 1, maximum: { value: 0.0024, unit: "m" } },
        { axis: "x", dimensionId: "reflow-pad-length-pb", multiplier: 2, maximum: { value: 0.0012, unit: "m" } },
        { axis: "y", dimensionId: "reflow-pad-height-pc", multiplier: 1, maximum: { value: 0.0016, unit: "m" } },
      ],
    });
    expect(facts.mountedGeometry.maximumHeight.value.height.value).toBe(0.0019);
    for (const key of ["effectiveCapacitance", "biasDeratingRatio", "equivalentSeriesResistance", "rippleCurrent"] as const) {
      expect(facts[key]).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    }
    for (const evidence of [
      ...mlccProfile.commonFacts.packageName.evidence,
      ...facts.nominalCapacitance.evidence,
      ...facts.ratedVoltage.evidence,
      ...facts.temperatureCharacteristic.evidence,
      ...facts.mountedGeometry.boardArea.evidence,
      ...facts.mountedGeometry.maximumHeight.evidence,
    ]) expect(evidence.contentHash).toBe("sha256:16485a74132615e22292df1ff573670f87d28825eabce176c2bbeb5ee93d378d");
  });

  it("keeps the exact C1608X7R1H104K080AA source, conservative geometry, and admission semantics closed", () => {
    expect(validateDesignProfileEnvelope(smallMlccProfile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(smallMlccProfile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(smallMlccProfile)).toBe("sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6");
    const facts = smallMlccProfile.facts as Record<string, any>;
    expect(facts.nominalCapacitance.value).toEqual({ value: 0.0000001, unit: "F", displayUnit: "100 nF" });
    expect(facts.ratedVoltage.value).toEqual({ value: 50, unit: "V", displayUnit: "50 VDC" });
    expect(facts.temperatureCharacteristic.value).toBe("X7R (±15 %)");
    expect(facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.00000192, unit: "m2" },
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", dimensionId: "reflow-inner-pad-gap-pa", multiplier: 1, maximum: { value: 0.0008, unit: "m" } },
        { axis: "x", dimensionId: "reflow-pad-length-pb", multiplier: 2, maximum: { value: 0.0008, unit: "m" } },
        { axis: "y", dimensionId: "reflow-pad-height-pc", multiplier: 1, maximum: { value: 0.0008, unit: "m" } },
      ],
    });
    expect(facts.mountedGeometry.maximumHeight.value.height.value).toBe(0.0009);
    for (const key of ["effectiveCapacitance", "biasDeratingRatio", "equivalentSeriesResistance", "rippleCurrent"] as const) {
      expect(facts[key]).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    }
    for (const evidence of [
      ...smallMlccProfile.commonFacts.packageName.evidence,
      ...facts.nominalCapacitance.evidence,
      ...facts.ratedVoltage.evidence,
      ...facts.temperatureCharacteristic.evidence,
      ...facts.mountedGeometry.boardArea.evidence,
      ...facts.mountedGeometry.maximumHeight.evidence,
    ]) expect(evidence.contentHash).toBe("sha256:3e0a984b0dffd02e9e5c4aea085588df4491bc1dd74e85b5b32502acdc790c12");
  });
});
