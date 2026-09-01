import { describe, expect, it } from "vitest";
import murataProfileJson from "../parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json";
import {
  designProfileEnvelopeContentHash,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type DesignProfileWithFactsV2,
  type ManufacturerRegistryV1,
  type PartClassId,
} from "../src";

const profile = murataProfileJson as DesignProfileWithFactsV2<PartClassId, object>;
const registry = {
  format: "schemagic-manufacturer-registry",
  schemaVersion: "1.0.0",
  manufacturers: [{
    manufacturerId: "murata-manufacturing",
    displayName: "Murata Manufacturing Co., Ltd.",
    primaryEvidenceHosts: ["search.murata.co.jp"],
  }],
} as ManufacturerRegistryV1;

describe("exact Murata GRM31CR61H106KA12L facts-V2 profile", () => {
  it("keeps exact electrical facts, conservative reflow geometry, and unknown optional claims closed", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992");

    expect(profile.part).toEqual({
      manufacturerId: "murata-manufacturing",
      manufacturerPartNumber: "GRM31CR61H106KA12L",
    });
    expect(profile.factsSchemaVersion).toBe("2.0.0");
    const facts = profile.facts as Record<string, any>;
    expect(facts.nominalCapacitance.value).toEqual({ value: 0.00001, unit: "F", displayUnit: "10 µF" });
    expect(facts.ratedVoltage.value).toEqual({ value: 50, unit: "V", displayUnit: "50 VDC" });
    expect(facts.temperatureCharacteristic.value).toBe("X5R (-15 to +15 %)");
    expect(facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.00000748, unit: "m2", displayUnit: "7.48 mm²" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", dimensionId: "reflow-inner-pad-gap-a", multiplier: 1, maximum: { value: 0.002, unit: "m" } },
        { axis: "x", dimensionId: "reflow-pad-length-b", multiplier: 2, maximum: { value: 0.0012, unit: "m" } },
        { axis: "y", dimensionId: "reflow-pad-height-c", multiplier: 1, maximum: { value: 0.0017, unit: "m" } },
      ],
    });
    expect(facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.0018, unit: "m", displayUnit: "1.80 mm" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });

    for (const key of ["effectiveCapacitance", "biasDeratingRatio", "equivalentSeriesResistance", "rippleCurrent"] as const) {
      expect(facts[key]).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    }

    const evidence = [
      ...profile.commonFacts.packageName.evidence,
      ...facts.nominalCapacitance.evidence,
      ...facts.ratedVoltage.evidence,
      ...facts.temperatureCharacteristic.evidence,
      ...facts.mountedGeometry.boardArea.evidence,
      ...facts.mountedGeometry.boardArea.value.sourceDimensions.flatMap((dimension: any) => dimension.evidence),
      ...facts.mountedGeometry.maximumHeight.evidence,
    ];
    expect(evidence.length).toBe(11);
    for (const item of evidence) {
      expect(item.contentHash).toBe("sha256:e04aa9dfbe1759bb9a8f56ba4f92802a000a4c60b406b32766cf15bb4eef67a5");
      expect(item.url).toBe("https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM31CR61H106KA12-01.pdf");
    }
  });
});
