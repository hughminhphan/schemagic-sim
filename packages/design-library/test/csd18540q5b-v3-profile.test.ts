import { describe, expect, it } from "vitest";
import profileJson from "../parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json";
import manufacturersJson from "../manufacturers.json";
import type { ManufacturerRegistryV1 } from "../src/types";
import type { DesignProfileV3 } from "../src/v3-types";
import {
  designProfileContentHashV3,
  parseDesignProfileV3,
  validateDesignProfileV3,
  validateProfileAdmissionRulesV3,
  validateProfileSemanticsV3,
} from "../src/v3-validation";

const profile = profileJson as unknown as DesignProfileV3<"shared.n-channel-power-mosfet">;
const registry = manufacturersJson as ManufacturerRegistryV1;

describe("exact TI CSD18540Q5B facts-V3 profile", () => {
  it("closes parser, semantic, and admission validation against the exact primary source", () => {
    expect(validateDesignProfileV3(profile, registry)).toEqual([]);
    expect(validateProfileSemanticsV3(profile)).toEqual([]);
    expect(validateProfileAdmissionRulesV3(profile)).toEqual([]);

    const parsed = parseDesignProfileV3(profile, registry);
    expect(parsed).toEqual(profile);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.factsSchemaVersion).toBe("3.0.0");
    expect(parsed.part).toEqual({
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: "CSD18540Q5B",
    });
    expect(designProfileContentHashV3(parsed)).toBe("sha256:551796851f2c60f698c3ca054e338cdac0ec8fe034e4d7217ee6a758a7ab86e8");
  });

  it("keeps conservative ratings, exact conditions, and mounted geometry", () => {
    expect(profile.facts.drainSourceVoltage.value).toEqual({ value: 60, unit: "V", displayUnit: "60 V" });
    expect(profile.facts.continuousDrainCurrent).toMatchObject({
      value: { value: 29, unit: "A" },
      state: "reviewed",
      validFor: [{
        parameterId: "ambientTemperature",
        minimum: { value: 298.15, unit: "K" },
        maximum: { value: 298.15, unit: "K" },
      }],
    });
    expect(profile.facts.pulsedDrainCurrent).toMatchObject({
      value: { value: 400, unit: "A" },
      state: "reviewed",
      validFor: [
        { parameterId: "dutyCycle", minimum: null, maximum: { value: 0.01, unit: "1" } },
        { parameterId: "pulseDuration", minimum: null, maximum: { value: 0.0001, unit: "s" } },
      ],
    });
    expect(profile.facts.onResistance).toMatchObject({
      value: { value: 0.0022, unit: "ohm" },
      state: "reviewed",
      validFor: [
        { parameterId: "ambientTemperature", minimum: { value: 298.15, unit: "K" }, maximum: { value: 298.15, unit: "K" } },
        { parameterId: "drainCurrent", minimum: { value: 28, unit: "A" }, maximum: { value: 28, unit: "A" } },
        { parameterId: "gateVoltage", minimum: { value: 10, unit: "V" }, maximum: { value: 10, unit: "V" } },
      ],
    });
    expect(profile.facts.totalGateCharge).toMatchObject({
      value: { value: 5.3e-8, unit: "C" },
      state: "reviewed",
      validFor: [
        { parameterId: "gateVoltage" },
        { parameterId: "testCurrent" },
        { parameterId: "testVoltage" },
      ],
    });
    expect(profile.facts.mountedGeometry.boardArea).toMatchObject({
      state: "calculated",
      value: {
        area: { value: 0.00003124224, unit: "m2" },
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          { axis: "x", dimensionId: "recommended-center-pad-span", multiplier: 1, maximum: { value: 0.00444, unit: "m" } },
          { axis: "x", dimensionId: "recommended-center-pad-to-right-row-gap", multiplier: 1, maximum: { value: 0.0011, unit: "m", displayUnit: "1.100 mm" } },
          { axis: "x", dimensionId: "recommended-right-row-pad-width", multiplier: 1, maximum: { value: 0.001372, unit: "m" } },
          { axis: "y", dimensionId: "recommended-pattern-height", multiplier: 1, maximum: { value: 0.00452, unit: "m" } },
        ],
      },
    });
    expect(profile.facts.mountedGeometry.boardArea.explanation).toContain("6.912 mm");
    expect(profile.facts.mountedGeometry.boardArea.explanation).toContain("0.710-mm drawing callout is vertical pad height");
    expect(profile.facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.00105, unit: "m", displayUnit: "1.05 mm maximum" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });
    for (const key of ["riseTime", "fallTime", "reverseRecoveryCharge"] as const) {
      expect(profile.facts[key]).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    }

    const evidence = JSON.stringify(profile);
    expect(evidence).toContain("sha256:2e43c4a2ac82af8a089be0a9e413282326f8d7857254ac07390b458deca854e0");
    expect(evidence).toContain("https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf");
  });
});
