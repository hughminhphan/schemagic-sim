import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json";
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
const bundledRegistry = manufacturers as ManufacturerRegistryV1;
describe("real Bourns general-purpose-resistor facts-V2 profile", () => {
  it("closes exact-MPN ratings, conservative recommended-land geometry, and evidence boundaries", () => {
    expect(validateDesignProfileEnvelope(profile, bundledRegistry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(profile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(profile)).toBe("sha256:d9fb252c5e2440b34f7b4fc844497b2c4fcc8f6f3573b531da4f602804a677f6");
    expect(profile.part).toEqual({
      manufacturerId: "bourns",
      manufacturerPartNumber: "CR0603-FX-1003ELF",
    });
    expect(profile.factsSchemaVersion).toBe("2.0.0");

    const facts = profile.facts as Record<string, any>;
    expect(facts.resistance.value).toEqual({ value: 100000, unit: "ohm", displayUnit: "100 kΩ" });
    expect(facts.tolerance.value).toEqual({ value: 0.01, unit: "1", displayUnit: "±1 %" });
    expect(facts.temperatureCoefficient.value).toEqual({ value: 0.0001, unit: "1/K", displayUnit: "±100 ppm/K" });
    expect(facts.continuousPower.value).toEqual({ value: 0.1, unit: "W", displayUnit: "100 mW" });
    expect(facts.continuousPower.validFor).toMatchObject([{
      parameterId: "ambientTemperature",
      minimum: { value: 298.15, unit: "K" },
      maximum: { value: 343.15, unit: "K" },
    }]);
    expect(facts.continuousPower.evidence[0].locator).toContain("Power Rating @ 70 °C = 1/10 W");
    expect(facts.continuousPower.evidence[0].locator).toContain("100 % power-ratio plateau includes 25 °C through 70 °C ambient");
    expect(facts.workingVoltage.value).toEqual({ value: 75, unit: "V", displayUnit: "75 V" });
    expect(facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.0000022, unit: "m2", displayUnit: "2.20 mm²" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", dimensionId: "recommended-total-span-b", multiplier: 1, maximum: { value: 0.0022, unit: "m" } },
        { axis: "y", dimensionId: "recommended-pad-width-c", multiplier: 1, maximum: { value: 0.001, unit: "m" } },
      ],
    });
    expect(facts.mountedGeometry.maximumHeight.value.height).toEqual({ value: 0.00055, unit: "m", displayUnit: "0.55 mm" });
    expect(facts.pulsePower).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });

    const evidence = JSON.stringify(profile);
    expect(evidence).toContain("sha256:97eac911e95cfefa618eedfbd990c5f2cd0104a1528ddb27eb46fbc79ac919bb");
    expect(evidence).not.toMatch(/stock|availability|distributor|simulation/i);
  });

  it("binds every source to the independently integrated Bourns registry entry", () => {
    expect(validateDesignProfileEnvelope(profile, bundledRegistry)).toEqual([]);
  });
});
