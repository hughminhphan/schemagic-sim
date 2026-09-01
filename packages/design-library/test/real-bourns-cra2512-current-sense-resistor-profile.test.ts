import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.current-sense-resistor/bourns/CRA2512-FZ-R020ELF.json";
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

describe("real Bourns CRA2512 independently reviewed current-sense-resistor facts-V2 profile", () => {
  it("pins exact-MPN facts, two-terminal truth, qualification pulse, and full land-pattern geometry", () => {
    expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:b00c25d940ca0c61e717b9d2b5cdb8b6fcd3382d29f5cf0ed98114e459e6cf6d");
    expect(profile.part).toEqual({
      manufacturerId: "bourns",
      manufacturerPartNumber: "CRA2512-FZ-R020ELF",
    });
    expect(profile.commonFacts.packageName.state).toBe("reviewed");

    const facts = profile.facts as Record<string, any>;
    expect(facts.resistance).toMatchObject({
      state: "reviewed",
      value: { value: 0.02, unit: "ohm", displayUnit: "20 mΩ" },
    });
    expect(facts.resistance.validFor[0]).toMatchObject({
      parameterId: "ambientTemperature",
      minimum: { value: 218.15, unit: "K" },
      maximum: { value: 443.15, unit: "K" },
    });
    expect(facts.tolerance).toMatchObject({ state: "reviewed", value: { value: 0.01, unit: "1", displayUnit: "±1 %" } });
    expect(facts.temperatureCoefficient).toMatchObject({ state: "reviewed", value: { value: 0.00005, unit: "1/K", displayUnit: "±50 ppm/K" } });
    expect(facts.continuousPower).toMatchObject({ state: "reviewed", value: { value: 3, unit: "W", displayUnit: "3 W" } });
    expect(facts.continuousPower.validFor[0]).toMatchObject({
      parameterId: "ambientTemperature",
      minimum: { value: 343.15, unit: "K" },
      maximum: { value: 343.15, unit: "K" },
    });
    expect(facts.pulsePower).toMatchObject({ state: "reviewed", value: { value: 15, unit: "W", displayUnit: "15 W" } });
    expect(facts.pulsePower.validFor[0]).toMatchObject({
      parameterId: "pulseDuration",
      minimum: { value: 5, unit: "s" },
      maximum: { value: 5, unit: "s" },
    });
    expect(facts.pulseDuration).toMatchObject({ state: "reviewed", value: { value: 5, unit: "s", displayUnit: "5 s" } });
    expect(facts.thermalLimit).toMatchObject({ state: "reviewed", value: { value: 443.15, unit: "K", displayUnit: "170 °C" } });
    expect(facts.kelvinTerminals).toMatchObject({ state: "reviewed", value: false });

    expect(facts.mountedGeometry.boardArea).toMatchObject({
      state: "calculated",
      value: {
        area: { value: 0.0000332, unit: "m2", displayUnit: "33.2 mm²" },
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          { axis: "x", dimensionId: "recommended-inner-gap-l", multiplier: 1, maximum: { value: 0.0041, unit: "m" } },
          { axis: "x", dimensionId: "recommended-pad-length-b", multiplier: 2, maximum: { value: 0.0021, unit: "m" } },
          { axis: "y", dimensionId: "recommended-pad-width-a", multiplier: 1, maximum: { value: 0.004, unit: "m" } },
        ],
      },
    });
    expect(facts.mountedGeometry.maximumHeight).toMatchObject({
      state: "reviewed",
      value: {
        height: { value: 0.0011, unit: "m", displayUnit: "1.10 mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
    });

    const evidence = JSON.stringify(profile);
    expect(evidence).toContain("sha256:1f164410b98c77f69adae78fea4fba158b47fd35c14c241f5af7321b380ee362");
    expect(evidence).not.toMatch(/stock|availability|distributor|simulation/i);
  });

  it("passes facts-V2 admission rules after independent source and geometry review", () => {
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
  });
});
