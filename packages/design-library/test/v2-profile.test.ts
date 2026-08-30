import { describe, expect, it } from "vitest";
import {
  assertBoardAreaProjectionArithmeticV2,
  assertMountedGeometryFactsV2,
  absoluteMaximumRating,
  calculateBoardAreaV2,
  buildPowerClaimEvaluationContextV2,
  canonicalProfileNumberV2,
  guaranteedLowerEndpoint,
  recommendedSettingTarget,
  typicalProductionTarget,
  worstCaseProductionMinimum,
  worstCaseProductionMaximum,
  type BoardAreaDimensionTermV2,
  type BoardAreaProjectionV2,
} from "../src";

const evidence = Object.freeze([{
  kind: "synthetic_fixture" as const,
  sourceId: "schemagic.synthetic.v2-profile-test",
  locator: "V2 profile primitive test",
  licenseNote: "Synthetic test fixture.",
  retrievedAt: null,
  contentHash: null,
  url: null,
  revision: null,
  publicationBasis: null,
}]);

function term(axis: "x" | "y", dimensionId: string, multiplier: number, maximum: number): BoardAreaDimensionTermV2 {
  return { axis, dimensionId, multiplier, maximum: { value: maximum, unit: "m", displayUnit: "m" }, evidence: [...evidence] };
}

describe("design-profile V2 arithmetic primitives", () => {
  it("rounds finite binary64 values to twelve significant digits and normalizes negative zero", () => {
    expect(canonicalProfileNumberV2(1.23456789012345)).toBe(1.23456789012);
    expect(canonicalProfileNumberV2(-0)).toBe(0);
    expect(Object.is(canonicalProfileNumberV2(-0), -0)).toBe(false);
    expect(() => canonicalProfileNumberV2(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it("keeps claim direction and evidence basis in the semantic accessor boundary", () => {
    const claim = {
      claimKind: "typical" as const,
      basis: "production_spread" as const,
      value: { value: 0.596, unit: "V" as const, displayUnit: "V" },
      state: "reviewed" as const,
      evidence: [...evidence],
      validFor: [],
      explanation: "Reviewed typical feedback reference.",
    };
    const emptyContext = { values: [] };
    expect(typicalProductionTarget(claim, emptyContext)).toMatchObject({ status: "known", quantity: { value: 0.596 } });
    expect(() => guaranteedLowerEndpoint(claim, emptyContext)).toThrow(/guaranteed_minimum\/operating_range/);
    expect(() => worstCaseProductionMaximum(claim, emptyContext)).toThrow(/guaranteed_maximum/);
    expect(() => worstCaseProductionMinimum(claim, emptyContext)).toThrow(/guaranteed_minimum/);
    expect(() => recommendedSettingTarget(claim, emptyContext)).toThrow(/recommended\/recommended_setting/);
    expect(() => absoluteMaximumRating(claim, emptyContext)).toThrow(/absolute_maximum/);
    expect(typicalProductionTarget({ ...claim, state: "unknown", value: null, evidence: [], validFor: [] }, emptyContext)).toEqual({
      status: "unknown",
      reason: "claim_unknown",
      parameterId: null,
    });
    expect(typicalProductionTarget({ ...claim, state: "estimated" }, emptyContext)).toEqual({
      status: "unknown",
      reason: "claim_not_reviewed",
      parameterId: null,
    });
    expect(worstCaseProductionMinimum({ ...claim, claimKind: "guaranteed_minimum" }, emptyContext).status).toBe("known");
    expect(recommendedSettingTarget({ ...claim, claimKind: "recommended", basis: "recommended_setting" }, emptyContext).status).toBe("known");
  });

  it("requires exact sorted condition context and uses inclusive bounds", () => {
    const claim = {
      claimKind: "guaranteed_maximum" as const,
      basis: "production_spread" as const,
      value: { value: 0.61, unit: "V" as const, displayUnit: "V" },
      state: "reviewed" as const,
      evidence: [...evidence],
      validFor: [{
        parameterId: "ambient-temperature",
        kind: "quantity_range" as const,
        minimum: { value: 233.15, unit: "K" as const, displayUnit: "°C" },
        maximum: { value: 398.15, unit: "K" as const, displayUnit: "°C" },
        evidence: [...evidence],
      }],
      explanation: "Reviewed production maximum.",
    };
    expect(worstCaseProductionMaximum(claim, {
      values: [{
        parameterId: "ambient-temperature",
        kind: "quantity_range",
        minimum: { value: 233.15, unit: "K", displayUnit: "°C" },
        maximum: { value: 398.15, unit: "K", displayUnit: "°C" },
      }],
    }).status).toBe("known");
    expect(worstCaseProductionMaximum(claim, { values: [] })).toEqual({
      status: "unknown",
      reason: "missing_condition",
      parameterId: "ambient-temperature",
    });
    expect(worstCaseProductionMaximum(claim, {
      values: [{
        parameterId: "ambient-temperature",
        kind: "quantity_range",
        minimum: { value: 233.15, unit: "K", displayUnit: "°C" },
        maximum: { value: 398.16, unit: "K", displayUnit: "°C" },
      }],
    })).toEqual({
      status: "unknown",
      reason: "condition_out_of_range",
      parameterId: "ambient-temperature",
    });
    expect(() => worstCaseProductionMaximum({
      ...claim,
      validFor: [{ ...claim.validFor[0]!, evidence: [] }],
    }, { values: [] })).toThrow(/condition requires evidence/);
  });

  it("projects Power request ranges and only available derived state into claim context", () => {
    const request = {
      format: "schemagic-design-request",
      schemaVersion: 2,
      application: "power.buck",
      requirements: {
        inputVoltage: {
          minimum: { value: 8, unit: "V", displayUnit: "V" },
          nominal: { value: 12, unit: "V", displayUnit: "V" },
          maximum: { value: 16, unit: "V", displayUnit: "V" },
        },
        outputVoltage: { value: 5, unit: "V", displayUnit: "V" },
        maximumOutputCurrent: { value: 4, unit: "A", displayUnit: "A" },
        ambientTemperature: { value: 313.15, unit: "K", displayUnit: "°C" },
        switchingFrequency: {
          selection: "automatic",
          minimum: { value: 100_000, unit: "Hz", displayUnit: "kHz" },
          preferred: null,
          maximum: { value: 1_000_000, unit: "Hz", displayUnit: "MHz" },
        },
        maximumOutputRipple: { value: 0.05, unit: "V", displayUnit: "mV" },
        loadTransientTarget: null,
      },
      objective: "area",
      constraints: {
        allowedTopologyFamilies: ["power.buck.integrated-synchronous"],
        maximumJunctionTemperature: { value: 398.15, unit: "K", displayUnit: "°C" },
        allowedPackages: [],
        maximumComponentHeight: null,
        maximumBoardArea: null,
        allowEstimatedValues: false,
        allowUnknownWarnings: false,
        allowUnknownHardConstraints: false,
      },
      assumptions: [{
        id: "claim-context-test",
        description: "Synthetic request used only to exercise the condition-context projection.",
        source: "fixture",
        affects: ["claim-context"],
      }],
      libraryVersion: "claim-context-test.1",
    } as Parameters<typeof buildPowerClaimEvaluationContextV2>[0];
    const context = buildPowerClaimEvaluationContextV2(request, {
      selectedSwitchingFrequency: { value: 500_000, unit: "Hz", displayUnit: "kHz" },
      switchCurrent: null,
      operatingMode: "forced-pwm",
      boardLayout: null,
    });
    expect(context.values.map((entry) => entry.parameterId)).toEqual([
      "ambient-temperature",
      "input-voltage",
      "junction-temperature",
      "operating-mode",
      "output-current",
      "output-voltage",
      "switching-frequency",
    ]);
    expect(context.values.find((entry) => entry.parameterId === "input-voltage")).toMatchObject({
      minimum: { value: 8 },
      maximum: { value: 16 },
    });
    expect(context.values.some((entry) => entry.parameterId === "board-layout")).toBe(false);
    expect(Object.isFrozen(context.values)).toBe(true);
    expect(() => buildPowerClaimEvaluationContextV2({
      ...request,
      requirements: {
        ...request.requirements,
        inputVoltage: { ...request.requirements.inputVoltage, nominal: { ...request.requirements.inputVoltage.nominal, value: Number.NaN } },
      },
    }, {
      selectedSwitchingFrequency: null,
      switchCurrent: null,
      operatingMode: null,
      boardLayout: null,
    })).toThrow();
    expect(() => buildPowerClaimEvaluationContextV2(request, {
      selectedSwitchingFrequency: null,
      switchCurrent: null,
      operatingMode: null,
      boardLayout: "self-asserted-layout",
    } as unknown as Parameters<typeof buildPowerClaimEvaluationContextV2>[1])).toThrow(/placement-artifact capability/);
  });

  it("calculates the researched TDK, Coilcraft, and Vishay maximum land-pattern rectangles", () => {
    expect(calculateBoardAreaV2([
      term("x", "gap-a", 1, 2.4e-3),
      term("x", "land-b", 2, 1.2e-3),
      term("y", "land-c", 1, 1.6e-3),
    ])).toBe(7.68e-6);
    expect(calculateBoardAreaV2([
      term("x", "inner-gap", 1, 2.94e-3),
      term("x", "land-length", 2, 1.58e-3),
      term("y", "land-width", 1, 6.5e-3),
    ])).toBe(39.65e-6);
    expect(calculateBoardAreaV2([
      term("x", "land-x", 1, 1e-3),
      term("y", "land-z", 1, 2.25e-3),
    ])).toBe(2.25e-6);
  });

  it("canonicalizes only after multiplication at the frozen arithmetic boundary", () => {
    expect(calculateBoardAreaV2([
      term("x", "long-mantissa", 999_999_999_999, 1.000000000001e-12),
      term("y", "unit-span", 1, 1),
    ])).toBe(1);
  });

  it("rejects unsorted, duplicate, incomplete, and tampered projections", () => {
    const dimensions = [term("x", "land-x", 1, 1e-3), term("y", "land-z", 1, 2.25e-3)];
    const projection: BoardAreaProjectionV2 = {
      area: { value: 2.25e-6, unit: "m2", displayUnit: "mm²" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: dimensions,
    };
    expect(() => assertBoardAreaProjectionArithmeticV2(projection)).not.toThrow();
    expect(() => calculateBoardAreaV2([...dimensions].reverse())).toThrow(/sorted/);
    expect(() => calculateBoardAreaV2([dimensions[0]!, dimensions[0]!, dimensions[1]!])).toThrow(/unique/);
    expect(() => calculateBoardAreaV2([dimensions[0]!])).toThrow(/each axis/);
    expect(() => assertBoardAreaProjectionArithmeticV2({ ...projection, area: { ...projection.area, value: 2.2e-6 } })).toThrow(/does not equal/);
  });

  it("requires exact mounted-geometry fact states, domains, and evidence projection", () => {
    const dimensions = [term("x", "land-x", 1, 1e-3), term("y", "land-z", 1, 2.25e-3)];
    const geometry = {
      boardArea: {
        value: {
          area: { value: 2.25e-6, unit: "m2" as const, displayUnit: "mm²" },
          basis: "manufacturer_recommended_land_pattern_bounding_box" as const,
          calculation: "maximum_x_span_times_maximum_y_span" as const,
          sourceDimensions: dimensions,
        },
        state: "calculated" as const,
        evidence: [...evidence],
        validFor: [],
        explanation: "Canonical land-pattern bounding rectangle.",
      },
      maximumHeight: {
        value: {
          height: { value: 0.5e-3, unit: "m" as const, displayUnit: "mm" },
          basis: "manufacturer_package_maximum_in_surface_mount_orientation" as const,
        },
        state: "reviewed" as const,
        evidence: [...evidence],
        validFor: [],
        explanation: "Reviewed maximum mounted height.",
      },
    };
    expect(() => assertMountedGeometryFactsV2(geometry)).not.toThrow();
    expect(() => assertMountedGeometryFactsV2({ ...geometry, maximumHeight: { ...geometry.maximumHeight, state: "calculated" } })).toThrow(/reviewed/);
    expect(() => assertMountedGeometryFactsV2({
      ...geometry,
      maximumHeight: { ...geometry.maximumHeight, value: { ...geometry.maximumHeight.value, height: { ...geometry.maximumHeight.value.height, value: 0 } } },
    })).toThrow(/positive finite/);
    expect(() => assertMountedGeometryFactsV2({ ...geometry, boardArea: { ...geometry.boardArea, evidence: [] } })).toThrow(/evidence/);
  });
});
