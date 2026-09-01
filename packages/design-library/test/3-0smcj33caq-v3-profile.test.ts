import { describe, expect, it } from "vitest";
import profileJson from "../parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json";
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

describe("real Diodes Incorporated 3.0SMCJ33CAQ authored facts-V3 profile", () => {
  it("parses the exact bidirectional automotive TVS facts and admits the profile", () => {
    expect(validateDesignProfileV3(profile, registry)).toEqual([]);
    expect(validateProfileSemanticsV3(profile)).toEqual([]);
    expect(validateProfileAdmissionRulesV3(profile)).toEqual([]);

    const parsed = parseDesignProfileV3(profile, registry);
    expect(parsed.part).toEqual({
      manufacturerId: "diodes-incorporated",
      manufacturerPartNumber: "3.0SMCJ33CAQ",
    });
    expect(parsed.factsSchemaVersion).toBe("3.0.0");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(designProfileContentHashV3(parsed)).toBe("sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474");
  });

  it("pins the exact source-conditioned voltage ladder without claiming coordination", () => {
    expect(profile.facts.standOffVoltage.value).toMatchObject({ value: 33, unit: "V" });
    expect(profile.facts.breakdownVoltageMinimum.value).toMatchObject({ value: 36.7, unit: "V" });
    expect(profile.facts.breakdownVoltageMaximum.value).toMatchObject({ value: 40.6, unit: "V" });
    expect(profile.facts.clampingBehavior).toMatchObject({ state: "reviewed", value: "avalanche" });
    expect(profile.facts.clampingVoltage.value).toMatchObject({ value: 53.3, unit: "V" });
    expect(profile.facts.pulseCurrent.value).toMatchObject({ value: 56.3, unit: "A" });
    expect(profile.facts.pulseWaveform.value).toBe("non-repetitive 10 × 1000 µs current pulse");
    expect(profile.facts.clampingVoltage.validFor).toEqual(profile.facts.pulseCurrent.validFor);
    expect(profile.facts.clampingVoltage.validFor.map((condition) => condition.parameterId)).toEqual([
      "ambientTemperature",
      "pulseDuration",
      "testCurrent",
    ]);
    expect(profile.facts.clampingVoltage.validFor[1]).toMatchObject({
      minimum: { value: 0.001, unit: "s" },
      maximum: { value: 0.001, unit: "s" },
    });
    expect(profile.facts.clampingVoltage.validFor[2]).toMatchObject({
      minimum: { value: 56.3, unit: "A" },
      maximum: { value: 56.3, unit: "A" },
    });
    expect(profile.facts.pulseEnergy).toEqual({
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
      explanation: "The manufacturer datasheet does not publish a pulse-energy rating for the exact device. No joule value is synthesized from peak power, voltage, current, or waveform duration.",
    });
  });

  it("pins the conservative SMC land-pattern rectangle and package height", () => {
    expect(profile.facts.mountedGeometry.boardArea).toMatchObject({
      state: "calculated",
      value: {
        area: { value: 0.00003102, unit: "m2", displayUnit: "31.02 mm²" },
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
      },
    });
    expect(profile.facts.mountedGeometry.maximumHeight).toMatchObject({
      state: "reviewed",
      value: {
        height: { value: 0.00318, unit: "m", displayUnit: "3.18 mm maximum" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
    });
  });
});
