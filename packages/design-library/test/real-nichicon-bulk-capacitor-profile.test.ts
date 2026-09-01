import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.bulk-capacitor/nichicon/UCM1V331MNS1GS.json";
import manufacturersJson from "../manufacturers.json";
import {
  designProfileEnvelopeContentHash,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type DesignProfileWithFactsV2,
  type ManufacturerRegistryV1,
  type PartClassId,
} from "../src";

const profile = profileJson as DesignProfileWithFactsV2<PartClassId, object>;
const bundledRegistry = manufacturersJson as ManufacturerRegistryV1;
function collectUnknownPaths(value: unknown, path = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  if (object.state === "unknown") return [path];
  return Object.entries(object)
    .flatMap(([key, child]) => collectUnknownPaths(child, `${path}/${key}`))
    .sort();
}

describe("real Nichicon UCM1V331MNS1GS independently reviewed bulk-capacitor profile", () => {
  it("is schema-valid against the independently integrated Nichicon registry identity", () => {
    expect(validateDesignProfileEnvelope(profile, bundledRegistry)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:b2c178e7c4169ca7374e01c74adde0c5d2d7d03d07cc1e1e894cbc9de77ffa83");
    expect(profile).toMatchObject({
      partClass: "shared.bulk-capacitor",
      part: { manufacturerId: "nichicon", manufacturerPartNumber: "UCM1V331MNS1GS" },
      factsSchemaVersion: "2.0.0",
      commonFacts: {
        packageName: {
          state: "reviewed",
          value: "UCM φ8 × 10 mm vibration-resistant surface-mount aluminum electrolytic capacitor, NS configuration, GS taping",
        },
      },
    });
  });

  it("keeps exact source conditions, conservative geometry, and unsupported assumptions explicit", () => {
    const facts = profile.facts as Record<string, any>;
    expect(facts.nominalCapacitance).toMatchObject({
      state: "reviewed",
      value: { value: 0.00033, unit: "F", displayUnit: "330 µF" },
    });
    expect(facts.ratedVoltage).toMatchObject({
      state: "reviewed",
      value: { value: 35, unit: "V", displayUnit: "35 VDC" },
    });
    expect(facts.equivalentSeriesResistance).toMatchObject({
      state: "reviewed",
      value: { value: 0.08, unit: "ohm", displayUnit: "80 mΩ conservative upper bound" },
    });
    expect(facts.equivalentSeriesResistance.explanation).toContain("ESR ≤ |Z|");
    expect(facts.equivalentSeriesResistance.explanation).toContain("not a direct ESR tabulation");
    expect(facts.equivalentSeriesResistance.validFor.map((condition: { parameterId: string }) => condition.parameterId)).toEqual([
      "switchingFrequency", "ambientTemperature",
    ]);
    expect(facts.rippleCurrent).toMatchObject({
      state: "reviewed",
      value: { value: 0.85, unit: "A", displayUnit: "850 mA rms" },
    });
    expect(facts.rippleCurrent.validFor).toMatchObject([
      { parameterId: "switchingFrequency", minimum: { value: 100000 }, maximum: { value: 100000 } },
      { parameterId: "ambientTemperature", minimum: { value: 378.15 }, maximum: { value: 378.15 } },
    ]);
    expect(facts.lifetime).toMatchObject({
      state: "reviewed",
      value: { value: 7200000, unit: "s", displayUnit: "2000 h" },
    });
    expect(facts.lifetime.validFor.map((condition: { parameterId: string }) => condition.parameterId)).toEqual([
      "ambientTemperature", "testVoltage",
    ]);
    expect(facts.lifetime.explanation).toContain("not a field-life prediction");
    expect(facts.ratedTemperature).toMatchObject({
      state: "reviewed",
      value: { value: 378.15, unit: "K", displayUnit: "105 °C" },
    });
    expect(facts.mountedGeometry).toMatchObject({
      boardArea: {
        state: "calculated",
        value: {
          area: { value: 0.00005418, unit: "m2", displayUnit: "54.18 mm²" },
          basis: "manufacturer_recommended_land_pattern_bounding_box",
          calculation: "maximum_x_span_times_maximum_y_span",
          sourceDimensions: [
            { axis: "x", dimensionId: "vibration-resistant-land-width-x", multiplier: 1, maximum: { value: 0.0043 } },
            { axis: "y", dimensionId: "vibration-resistant-land-gap-a", multiplier: 1, maximum: { value: 0.002 } },
            { axis: "y", dimensionId: "vibration-resistant-land-height-y", multiplier: 2, maximum: { value: 0.0053 } },
          ],
        },
      },
      maximumHeight: {
        state: "reviewed",
        value: {
          height: { value: 0.011, unit: "m", displayUnit: "11.0 mm" },
          basis: "manufacturer_package_maximum_in_surface_mount_orientation",
        },
      },
    });
    expect(collectUnknownPaths(profile)).toEqual([
      "/commonFacts/boardArea",
      "/commonFacts/maximumHeight",
      "/facts/biasDeratingRatio",
      "/facts/effectiveCapacitance",
      "/facts/transientEnergyAssumption",
    ]);
  });

  it("retains exact-byte official evidence and satisfies the profile admission rules", () => {
    const serialized = JSON.stringify(profile);
    for (const expected of [
      "sha256:83286dc2f748f0039d092a9e3787247256fd42edc58cd6764a7a8339fc40377b",
      "sha256:56b4294a63f7f3a6ec64319f9a912a8f067005c3b4ff18efcdc22e121f8dff7c",
      "sha256:7bcf8f75062ecc0c24f3561658d56d025e82d6eb68fa6818a3cadb0a44d70ab9",
      "2026-08-24T06:43:47Z",
    ]) expect(serialized).toContain(expected);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
  });
});
