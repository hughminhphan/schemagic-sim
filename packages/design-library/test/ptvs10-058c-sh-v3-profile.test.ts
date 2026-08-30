import { describe, expect, it } from "vitest";
import profileJson from "../parts/motor.supply-tvs-diode/bourns/PTVS10-058C-SH.json";
import manufacturers from "../manufacturers.json";
import {
  designProfileContentHashV3,
  parseDesignProfileV3,
  validateDesignProfileV3,
  validateProfileAdmissionRulesV3,
  validateProfileSemanticsV3,
  type DesignProfileV3,
  type ManufacturerRegistryV1,
} from "../src";

const profile = profileJson as DesignProfileV3<"motor.supply-tvs-diode">;
const registry = manufacturers as ManufacturerRegistryV1;

describe("real Bourns PTVS10-058C-SH independently reviewed facts-V3 profile", () => {
  it("parses the exact-MPN avalanche TVS facts and admits the profile", () => {
    expect(validateDesignProfileV3(profile, registry)).toEqual([]);
    expect(validateProfileSemanticsV3(profile)).toEqual([]);
    expect(validateProfileAdmissionRulesV3(profile)).toEqual([]);

    const parsed = parseDesignProfileV3(profile, registry);
    expect(parsed.part).toEqual({
      manufacturerId: "bourns",
      manufacturerPartNumber: "PTVS10-058C-SH",
    });
    expect(parsed.factsSchemaVersion).toBe("3.0.0");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(designProfileContentHashV3(parsed)).toBe("sha256:0081a82fec8b84cba1ad935db25324c7ee10794cb5de609d3c33f9f7de9b4add");
  });

  it("pins the reviewed voltage ladder and the byte-identical IEC surge conditions", () => {
    expect(profile.facts.standOffVoltage.value).toMatchObject({ value: 58, unit: "V" });
    expect(profile.facts.breakdownVoltageMinimum.value).toMatchObject({ value: 64, unit: "V" });
    expect(profile.facts.breakdownVoltageMaximum.value).toMatchObject({ value: 70, unit: "V" });
    expect(profile.facts.clampingBehavior).toMatchObject({ state: "reviewed", value: "avalanche" });
    expect(profile.facts.clampingVoltage.value).toMatchObject({ value: 110, unit: "V" });
    expect(profile.facts.pulseCurrent.value).toMatchObject({ value: 10000, unit: "A" });
    expect(profile.facts.pulseWaveform.value).toBe("IEC 61000-4-5 8/20 µs current surge");
    expect(profile.facts.clampingVoltage.validFor).toEqual(profile.facts.pulseCurrent.validFor);
    expect(profile.facts.clampingVoltage.validFor.map((condition) => condition.parameterId)).toEqual([
      "ambientTemperature",
      "pulseDuration",
      "testCurrent",
    ]);
    expect(profile.facts.clampingVoltage.validFor[1]).toMatchObject({
      minimum: { value: 0.00002, unit: "s" },
      maximum: { value: 0.00002, unit: "s" },
    });
    expect(profile.facts.clampingVoltage.validFor[2]).toMatchObject({
      minimum: { value: 10000, unit: "A" },
      maximum: { value: 10000, unit: "A" },
    });

    const sourceHash = "sha256:87b049b09fbd42f87dc3b9bc89243ac3221420d528aa3005bb42333133eb1255";
    expect(profile.facts.clampingVoltage.evidence[0]?.contentHash).toBe(sourceHash);
    expect(profile.facts.pulseCurrent.evidence[0]?.contentHash).toBe(sourceHash);
    expect(profile.facts.pulseWaveform.evidence[0]?.contentHash).toBe(sourceHash);
  });

  it("keeps unpublished pulse energy unknown and pins exact datasheet geometry", () => {
    expect(profile.facts.pulseEnergy).toEqual({
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
      explanation: "The manufacturer datasheet does not publish a pulse-energy rating. No value is derived from voltage, current, or waveform duration.",
    });
    expect(profile.facts.mountedGeometry.boardArea).toMatchObject({
      state: "calculated",
      value: {
        area: { value: 0.0002156, unit: "m2", displayUnit: "215.6 mm²" },
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          { axis: "x", dimensionId: "recommended-inner-gap", multiplier: 1, maximum: { value: 0.0126, unit: "m" } },
          { axis: "x", dimensionId: "recommended-pad-width", multiplier: 2, maximum: { value: 0.0035, unit: "m" } },
          { axis: "y", dimensionId: "recommended-pad-length", multiplier: 1, maximum: { value: 0.011, unit: "m" } },
        ],
      },
    });
    expect(profile.facts.mountedGeometry.maximumHeight).toMatchObject({
      state: "reviewed",
      value: {
        height: { value: 0.011, unit: "m", displayUnit: "11.00 mm maximum" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
    });
  });
});
