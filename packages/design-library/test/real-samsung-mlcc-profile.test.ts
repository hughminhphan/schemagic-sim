import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.mlcc-capacitor/samsung-electro-mechanics/CL31A106KBHNNNE.json";
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

describe("exact Samsung Electro-Mechanics CL31A106KBHNNNE facts-V2 profile", () => {
  it("keeps exact electrical facts, conservative reflow geometry, and unknown optional claims closed", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99");

    expect(profile.part).toEqual({
      manufacturerId: "samsung-electro-mechanics",
      manufacturerPartNumber: "CL31A106KBHNNNE",
    });
    expect(profile.factsSchemaVersion).toBe("2.0.0");
    const facts = profile.facts as Record<string, any>;
    expect(facts.nominalCapacitance.value).toEqual({ value: 0.00001, unit: "F", displayUnit: "10 µF" });
    expect(facts.ratedVoltage.value).toEqual({ value: 50, unit: "V", displayUnit: "50 VDC" });
    expect(facts.temperatureCharacteristic.value).toBe("X5R (-55 to +85 °C, ±15 %)");
    expect(facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.0000081468, unit: "m2", displayUnit: "8.15 mm²" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", dimensionId: "reflow-inner-pad-gap-a", multiplier: 1, maximum: { value: 0.00176, unit: "m" } },
        { axis: "x", dimensionId: "reflow-pad-length-b", multiplier: 2, maximum: { value: 0.00131, unit: "m" } },
        { axis: "y", dimensionId: "reflow-pad-height-c", multiplier: 1, maximum: { value: 0.00186, unit: "m" } },
      ],
    });
    expect(facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.0018, unit: "m", displayUnit: "1.80 mm" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });

    for (const key of ["effectiveCapacitance", "biasDeratingRatio", "equivalentSeriesResistance", "rippleCurrent"] as const) {
      expect(facts[key]).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    }

    const exactEvidence = [
      ...facts.nominalCapacitance.evidence,
      ...facts.ratedVoltage.evidence,
      ...facts.temperatureCharacteristic.evidence,
      ...facts.mountedGeometry.maximumHeight.evidence,
    ];
    for (const item of exactEvidence) {
      expect(item.contentHash).toBe("sha256:23d0c65c65188eebbe1a1e30b702ee4e2fc249e232c1f293e7f282f1e86fbfbc");
      expect(item.url).toBe("https://product.samsungsem.com/mlcc/CL31A106KBHNNN.do");
    }

    const geometryEvidence = [
      ...facts.mountedGeometry.boardArea.evidence,
      ...facts.mountedGeometry.boardArea.value.sourceDimensions.flatMap((dimension: any) => dimension.evidence),
    ];
    for (const item of geometryEvidence) {
      expect(item.contentHash).toBe("sha256:99f87a705209ab4e097df75e0bdaf61cb7abd162b60e88fdb376d121f952e0b7");
      expect(item.url).toBe("https://product.samsungsem.com/resources/file/product-catalog/MLCC_2512.pdf");
    }
  });
});
