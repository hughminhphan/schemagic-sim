import { describe, expect, it } from "vitest";
import profileJson from "../parts/power.integrated-synchronous-buck-regulator/onsemi/NCP1599MNTWG.json";
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

function collectUnknownPaths(value: unknown, path = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  if (object.state === "unknown") return [path];
  return Object.entries(object)
    .flatMap(([key, child]) => collectUnknownPaths(child, `${path}/${key}`))
    .sort();
}

describe("real NCP1599MNTWG facts-V2 authored profile", () => {
  it("materializes the exact source-bound partial draft without implying admission", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:5428b2d89f35c3305cb22e417b4f88a0aba1c4bdc5fafc3f6bb7ae11946e5414");
    expect(profile).toMatchObject({
      partClass: "power.integrated-synchronous-buck-regulator",
      part: { manufacturerId: "onsemi", manufacturerPartNumber: "NCP1599MNTWG" },
      factsSchemaVersion: "2.0.0",
      commonFacts: {
        packageName: {
          value: "DFN6 3 mm x 3 mm, 0.95 mm pitch (CASE 506AH)",
          state: "estimated",
        },
      },
    });

    const facts = profile.facts as Record<string, any>;
    const authoredClaims = [
      ["inputVoltageMinimum", 3],
      ["inputVoltageMaximum", 5.5],
      ["currentLimitMinimum", 3.83],
      ["currentLimitTypical", 4.18],
      ["currentLimitMaximum", 4.54],
      ["minimumOnTimeMaximum", 50e-9],
      ["maximumJunctionTemperature", 423.15],
    ] as const;
    for (const [field, value] of authoredClaims) {
      expect(facts[field]).toMatchObject({ state: "estimated", value: { value } });
      expect(facts[field].evidence).toEqual([
        expect.objectContaining({
          sourceId: "onsemi-ncp1599-datasheet",
          contentHash: "sha256:40e0c29696d6adb4b35e8f331fc404d5c4efab35a15f8b449223c97931fc5650",
          kind: "manufacturer_datasheet",
        }),
      ]);
    }
    expect(facts.currentLimitMinimum.validFor.map((condition: { parameterId: string }) => condition.parameterId)).toEqual([
      "input-voltage", "junction-temperature", "operating-mode", "output-voltage",
    ]);
    expect(facts.currentLimitTypical.validFor).toEqual(facts.currentLimitMinimum.validFor);
    expect(facts.currentLimitMaximum.validFor).toEqual(facts.currentLimitMinimum.validFor);
    expect(facts.minimumOnTimeMaximum.validFor.map((condition: { parameterId: string }) => condition.parameterId)).toEqual([
      "input-voltage", "junction-temperature", "output-voltage",
    ]);
    expect(facts.mountedGeometry).toMatchObject({
      boardArea: {
        state: "calculated",
        value: {
          area: { value: 8.606e-6, unit: "m2" },
          basis: "manufacturer_recommended_land_pattern_bounding_box",
          calculation: "maximum_x_span_times_maximum_y_span",
          sourceDimensions: [
            { axis: "x", dimensionId: "land-pattern-x-span", multiplier: 1, maximum: { value: 0.0026, unit: "m" } },
            { axis: "y", dimensionId: "land-pattern-y-span", multiplier: 1, maximum: { value: 0.00331, unit: "m" } },
          ],
        },
      },
      maximumHeight: {
        state: "reviewed",
        value: {
          height: { value: 0.001, unit: "m" },
          basis: "manufacturer_package_maximum_in_surface_mount_orientation",
        },
      },
    });

    expect(collectUnknownPaths(profile)).toEqual([
      "/commonFacts/boardArea",
      "/commonFacts/maximumHeight",
      "/facts/controlEvidenceBasis",
      "/facts/fallTimeMaximum",
      "/facts/feedbackReferenceMaximum",
      "/facts/feedbackReferenceMinimum",
      "/facts/feedbackReferenceTypical",
      "/facts/highSideOnResistanceMaximum",
      "/facts/junctionToAmbientThermalResistanceMaximum",
      "/facts/lowSideOnResistanceMaximum",
      "/facts/minimumOffTimeMaximum",
      "/facts/outputCurrentCapabilityMinimum",
      "/facts/outputVoltageMaximum",
      "/facts/outputVoltageMinimum",
      "/facts/quiescentCurrentMaximum",
      "/facts/riseTimeMaximum",
      "/facts/switchingFrequencyMaximum",
      "/facts/switchingFrequencyMinimum",
      "/facts/switchingFrequencyRecommended",
    ]);

    expect(validateProfileAdmissionRulesV2(profile).map(({ path, code }) => ({ path, code }))).toEqual([
      { path: "commonFacts.packageName.state", code: "not_reviewed" },
      { path: "facts.inputVoltageMinimum.state", code: "not_reviewed" },
      { path: "facts.inputVoltageMaximum.state", code: "not_reviewed" },
      { path: "facts.outputVoltageMinimum.state", code: "not_reviewed" },
      { path: "facts.outputVoltageMaximum.state", code: "not_reviewed" },
      { path: "facts.outputCurrentCapabilityMinimum.state", code: "not_reviewed" },
      { path: "facts.currentLimitMinimum.state", code: "not_reviewed" },
      { path: "facts.currentLimitTypical.state", code: "not_reviewed" },
      { path: "facts.currentLimitMaximum.state", code: "not_reviewed" },
      { path: "facts.switchingFrequencyMinimum.state", code: "not_reviewed" },
      { path: "facts.switchingFrequencyRecommended.state", code: "not_reviewed" },
      { path: "facts.switchingFrequencyMaximum.state", code: "not_reviewed" },
      { path: "facts.minimumOnTimeMaximum.state", code: "not_reviewed" },
      { path: "facts.minimumOffTimeMaximum.state", code: "not_reviewed" },
      { path: "facts.feedbackReferenceMinimum.state", code: "not_reviewed" },
      { path: "facts.feedbackReferenceTypical.state", code: "not_reviewed" },
      { path: "facts.feedbackReferenceMaximum.state", code: "not_reviewed" },
      { path: "facts.quiescentCurrentMaximum.state", code: "not_reviewed" },
      { path: "facts.junctionToAmbientThermalResistanceMaximum.state", code: "not_reviewed" },
      { path: "facts.maximumJunctionTemperature.state", code: "not_reviewed" },
      { path: "facts.highSideOnResistanceMaximum.state", code: "not_reviewed" },
      { path: "facts.lowSideOnResistanceMaximum.state", code: "not_reviewed" },
      { path: "facts.controlEvidenceBasis.state", code: "not_reviewed" },
    ]);
  });
});
