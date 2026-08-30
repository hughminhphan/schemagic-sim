import { describe, expect, it } from "vitest";
import {
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION_V2,
  POWER_CONDITION_PARAMETER_SPECS_V2,
  POWER_INTEGRATED_CLAIM_SPECS_V2,
  POWER_INTEGRATED_REQUIRED_CONDITIONS_V2,
  canonicalProfileNumberV2,
  designProfileId,
  type ClaimEvaluationContextV2,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type MountedGeometryFactsV2,
  type ProfileConditionV2,
  type ProfileEvidenceRef,
} from "@opencircuit/design-library";
import {
  SYNTHETIC_MANUFACTURER_REGISTRY,
  createSyntheticReviewedProfile,
} from "@opencircuit/design-library/fixtures";
import { canonicalDesignV2Number } from "@opencircuit/design-schema";
import {
  POWER_FEEDBACK_DIVIDER_V2_MAX_PAIR_EVALUATIONS,
  POWER_OUTPUT_VOLTAGE_TOLERANCE_V2,
  selectPowerFeedbackDividerV2,
} from "../src";

const CLAIM_CONTEXT: ClaimEvaluationContextV2 = {
  values: [{
    parameterId: "junction-temperature",
    kind: "quantity_range",
    minimum: { value: 200, unit: "K", displayUnit: "K" },
    maximum: { value: 500, unit: "K", displayUnit: "K" },
  }],
};

type IntegratedProfileV2 = DesignProfileWithFactsV2<
  "power.integrated-synchronous-buck-regulator",
  FactsV2For<"power.integrated-synchronous-buck-regulator">
>;

type ResistorProfileV2 = DesignProfileWithFactsV2<
  "shared.general-purpose-resistor",
  FactsV2For<"shared.general-purpose-resistor">
>;

type FeedbackField =
  | "feedbackReferenceMinimum"
  | "feedbackReferenceTypical"
  | "feedbackReferenceMaximum";

function evidence(): ProfileEvidenceRef[] {
  return structuredClone(createSyntheticReviewedProfile("shared.general-purpose-resistor").commonFacts.packageName.evidence);
}

function unknownLegacyGeometry(label: string) {
  return {
    value: null,
    state: "unknown" as const,
    evidence: [],
    validFor: [],
    explanation: `${label} is carried only by mountedGeometry in facts schema V2.`,
  };
}

function mountedGeometry(): MountedGeometryFactsV2["mountedGeometry"] {
  const sourceEvidence = evidence();
  return {
    boardArea: {
      value: {
        area: { value: 2e-6, unit: "m2", displayUnit: "mm²" },
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          {
            axis: "x",
            dimensionId: "land-x",
            multiplier: 1,
            maximum: { value: 1e-3, unit: "m", displayUnit: "mm" },
            evidence: structuredClone(sourceEvidence),
          },
          {
            axis: "y",
            dimensionId: "land-y",
            multiplier: 1,
            maximum: { value: 2e-3, unit: "m", displayUnit: "mm" },
            evidence: structuredClone(sourceEvidence),
          },
        ],
      },
      state: "calculated",
      evidence: structuredClone(sourceEvidence),
      validFor: [],
      explanation: "Synthetic manufacturer land-pattern rectangle.",
    },
    maximumHeight: {
      value: {
        height: { value: 1e-3, unit: "m", displayUnit: "mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation",
      },
      state: "reviewed",
      evidence: structuredClone(sourceEvidence),
      validFor: [],
      explanation: "Synthetic maximum mounted package height.",
    },
  };
}

function condition(parameterId: string): ProfileConditionV2 {
  const spec = POWER_CONDITION_PARAMETER_SPECS_V2[
    parameterId as keyof typeof POWER_CONDITION_PARAMETER_SPECS_V2
  ];
  if (spec.kind === "token_equals") {
    return {
      parameterId,
      kind: "token_equals",
      value: "synthetic-condition",
      evidence: evidence(),
    };
  }
  const minimum = spec.domain === "positive" ? 1 : 0;
  const maximum = spec.unit === "Hz" ? 1e9 : spec.unit === "K" ? 500 : 100;
  return {
    parameterId,
    kind: "quantity_range",
    minimum: { value: minimum, unit: spec.unit, displayUnit: spec.unit },
    maximum: { value: maximum, unit: spec.unit, displayUnit: spec.unit },
    evidence: evidence(),
  };
}

function claimValue(field: keyof typeof POWER_INTEGRATED_CLAIM_SPECS_V2): number {
  const values: Partial<Record<keyof typeof POWER_INTEGRATED_CLAIM_SPECS_V2, number>> = {
    inputVoltageMinimum: 3,
    inputVoltageMaximum: 20,
    outputVoltageMinimum: 0.5,
    outputVoltageMaximum: 10,
    outputCurrentCapabilityMinimum: 5,
    currentLimitMinimum: 5,
    currentLimitTypical: 6,
    currentLimitMaximum: 7,
    switchingFrequencyMinimum: 100_000,
    switchingFrequencyRecommended: 500_000,
    switchingFrequencyMaximum: 1_000_000,
    minimumOnTimeMaximum: 1e-7,
    minimumOffTimeMaximum: 1e-7,
    feedbackReferenceMinimum: 1,
    feedbackReferenceTypical: 1,
    feedbackReferenceMaximum: 1,
    quiescentCurrentMaximum: 1e-3,
    junctionToAmbientThermalResistanceMaximum: 40,
    maximumJunctionTemperature: 400,
    highSideOnResistanceMaximum: 0.1,
    lowSideOnResistanceMaximum: 0.1,
    riseTimeMaximum: 1e-8,
    fallTimeMaximum: 1e-8,
  };
  return values[field]!;
}

function integratedProfile(options: Readonly<{
  minimum?: number;
  typical?: number;
  maximum?: number;
  unknown?: FeedbackField;
}> = {}): IntegratedProfileV2 {
  const base = createSyntheticReviewedProfile("power.integrated-synchronous-buck-regulator");
  const claims = Object.fromEntries(
    Object.entries(POWER_INTEGRATED_CLAIM_SPECS_V2).map(([rawField, spec]) => {
      const field = rawField as keyof typeof POWER_INTEGRATED_CLAIM_SPECS_V2;
      const value = field === "feedbackReferenceMinimum"
        ? options.minimum ?? 1
        : field === "feedbackReferenceTypical"
          ? options.typical ?? 1
          : field === "feedbackReferenceMaximum"
            ? options.maximum ?? 1
            : claimValue(field);
      const unknown = options.unknown === field;
      return [field, {
        claimKind: spec.claimKind,
        basis: spec.basis,
        value: { value, unit: spec.unit, displayUnit: spec.unit },
        state: unknown ? "estimated" : "reviewed",
        evidence: evidence(),
        validFor: POWER_INTEGRATED_REQUIRED_CONDITIONS_V2[field].map(condition),
        explanation: `Synthetic ${field} claim.`,
      }];
    }),
  );
  return {
    ...structuredClone(base),
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      packageName: structuredClone(base.commonFacts.packageName),
      boardArea: unknownLegacyGeometry("Board area"),
      maximumHeight: unknownLegacyGeometry("Maximum height"),
    },
    facts: {
      ...claims,
      controlEvidenceBasis: {
        value: "synthetic-datasheet-control-table",
        state: "reviewed",
        evidence: evidence(),
        validFor: [],
        explanation: "Synthetic control evidence basis.",
      },
      mountedGeometry: mountedGeometry(),
    },
  } as unknown as IntegratedProfileV2;
}

function resistorProfile(
  manufacturerPartNumber: string,
  resistance: number,
  tolerance: number | null = 0,
): ResistorProfileV2 {
  const base = createSyntheticReviewedProfile("shared.general-purpose-resistor");
  const toleranceFact = tolerance === null
    ? {
        value: null,
        state: "unknown" as const,
        evidence: [],
        validFor: [],
        explanation: "Tolerance is not reviewed.",
      }
    : {
        ...structuredClone(base.facts.tolerance),
        value: { value: tolerance, unit: "1" as const, displayUnit: "%" },
      };
  return {
    ...structuredClone(base),
    part: { ...base.part, manufacturerPartNumber },
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      packageName: structuredClone(base.commonFacts.packageName),
      boardArea: unknownLegacyGeometry("Board area"),
      maximumHeight: unknownLegacyGeometry("Maximum height"),
    },
    facts: {
      ...structuredClone(base.facts),
      resistance: {
        ...structuredClone(base.facts.resistance),
        value: { value: resistance, unit: "ohm", displayUnit: "Ω" },
      },
      tolerance: toleranceFact,
      mountedGeometry: mountedGeometry(),
    },
  } as ResistorProfileV2;
}

function select(
  primaryProfile: IntegratedProfileV2,
  resistorProfiles: readonly ResistorProfileV2[],
  requestedOutputVoltage = 2,
) {
  return selectPowerFeedbackDividerV2({
    primaryPartClass: "power.integrated-synchronous-buck-regulator",
    primaryProfile,
    resistorProfiles,
    requestedOutputVoltage: { value: requestedOutputVoltage, unit: "V", displayUnit: "V" },
    claimContext: CLAIM_CONTEXT,
    manufacturerRegistry: SYNTHETIC_MANUFACTURER_REGISTRY,
  });
}

describe("facts-V2 Power feedback-divider selection", () => {
  it("selects the nominal ordered pair with the exact canonical operation sequence", () => {
    const lower = resistorProfile("R-LOWER", 1_000);
    const upper = resistorProfile("R-UPPER", 2_000);
    const result = select(integratedProfile(), [lower, upper], 3);
    expect(result).toEqual({
      status: "selected",
      upperProfileId: designProfileId(upper.partClass, upper.part),
      lowerProfileId: designProfileId(lower.partClass, lower.part),
      threshold: 0.03,
      nominal: { outputVoltage: 3, error: 0 },
      lowCorner: { outputVoltage: 3, error: 0 },
      highCorner: { outputVoltage: 3, error: 0 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status !== "selected") throw new Error("Expected a selected divider");
    expect(Object.isFrozen(result.nominal)).toBe(true);
    expect(POWER_OUTPUT_VOLTAGE_TOLERANCE_V2).toBe(0.01);
    expect(POWER_FEEDBACK_DIVIDER_V2_MAX_PAIR_EVALUATIONS).toBe(65_536);
    expect(canonicalDesignV2Number(1.23456789012345)).toBe(canonicalProfileNumberV2(1.23456789012345));
  });

  it("preflights the exact quadratic work budget before pair allocation or arithmetic", () => {
    const resistor = resistorProfile("R-WORK-BUDGET", 1_000);
    const maximumProfiles = Math.floor(Math.sqrt(POWER_FEEDBACK_DIVIDER_V2_MAX_PAIR_EVALUATIONS));
    const result = select(integratedProfile(), Array.from({ length: maximumProfiles + 1 }, () => resistor));
    expect(result).toEqual({
      status: "unknown",
      reason: "feedback_divider_pair_work_budget_exceeded",
      profileId: designProfileId("power.integrated-synchronous-buck-regulator", integratedProfile().part),
      parameterId: null,
    });
  });

  it("passes exact one-percent equality and rejects either exceeded corner", () => {
    const resistor = resistorProfile("R-BOUNDARY", 1_000);
    const cases = [
      {
        label: "exact boundary",
        primary: integratedProfile({ minimum: 0.99, maximum: 1.01 }),
        status: "selected",
        lowError: 0.02,
        highError: 0.02,
      },
      {
        label: "minimum corner exceeded",
        primary: integratedProfile({ minimum: 0.98, maximum: 1 }),
        status: "rejected",
        lowError: 0.04,
        highError: 0,
      },
      {
        label: "maximum corner exceeded",
        primary: integratedProfile({ minimum: 1, maximum: 1.02 }),
        status: "rejected",
        lowError: 0,
        highError: 0.04,
      },
    ] as const;
    for (const entry of cases) {
      const result = select(entry.primary, [resistor]);
      expect(result.status, entry.label).toBe(entry.status);
      expect("lowCorner" in result ? result.lowCorner.error : null, entry.label).toBe(entry.lowError);
      expect("highCorner" in result ? result.highCorner.error : null, entry.label).toBe(entry.highError);
      if (entry.status === "rejected") {
        expect(result).toMatchObject({ reason: "corner_error_exceeded", threshold: 0.02 });
      }
    }
  });

  it("returns exact hard unknowns for missing feedback corners or reviewed tolerance", () => {
    const resistor = resistorProfile("R-MISSING", 1_000);
    const cases: Array<{
      label: string;
      primary: IntegratedProfileV2;
      resistors: ResistorProfileV2[];
      reason: string;
    }> = [
      {
        label: "typical",
        primary: integratedProfile({ unknown: "feedbackReferenceTypical" }),
        resistors: [resistor],
        reason: "feedback_reference_typical_unknown",
      },
      {
        label: "minimum",
        primary: integratedProfile({ unknown: "feedbackReferenceMinimum" }),
        resistors: [resistor],
        reason: "feedback_reference_minimum_unknown",
      },
      {
        label: "maximum",
        primary: integratedProfile({ unknown: "feedbackReferenceMaximum" }),
        resistors: [resistor],
        reason: "feedback_reference_maximum_unknown",
      },
      {
        label: "tolerance",
        primary: integratedProfile(),
        resistors: [resistorProfile("R-UNKNOWN-TOLERANCE", 1_000, null)],
        reason: "resistor_tolerance_unknown",
      },
    ];
    for (const entry of cases) {
      expect(select(entry.primary, entry.resistors), entry.label).toMatchObject({
        status: "unknown",
        reason: entry.reason,
      });
    }
  });

  it("rejects tolerance one before divider arithmetic", () => {
    const resistor = resistorProfile("R-TOLERANCE-ONE", 1_000, 1);
    expect(select(integratedProfile(), [resistor])).toEqual({
      status: "rejected",
      reason: "invalid_tolerance",
      profileId: designProfileId(resistor.partClass, resistor.part),
    });
  });

  it("uses profile-ID code-unit tie breaks and is invariant to reversed input", () => {
    const codeUnitFirst = resistorProfile("Z-PART", 1_000);
    const codeUnitSecond = resistorProfile("a-PART", 1_000);
    const expectedId = designProfileId(codeUnitFirst.partClass, codeUnitFirst.part);
    const forward = select(integratedProfile(), [codeUnitFirst, codeUnitSecond]);
    const reversed = select(integratedProfile(), [codeUnitSecond, codeUnitFirst]);
    expect(forward).toEqual(reversed);
    expect(forward).toMatchObject({
      status: "selected",
      upperProfileId: expectedId,
      lowerProfileId: expectedId,
    });
  });

  it("does not admit a facts-V1 primary through the additive selector", () => {
    expect(() => selectPowerFeedbackDividerV2({
      primaryPartClass: "power.integrated-synchronous-buck-regulator",
      primaryProfile: createSyntheticReviewedProfile("power.integrated-synchronous-buck-regulator"),
      resistorProfiles: [resistorProfile("R-V2", 1_000)],
      requestedOutputVoltage: { value: 2, unit: "V", displayUnit: "V" },
      claimContext: CLAIM_CONTEXT,
      manufacturerRegistry: SYNTHETIC_MANUFACTURER_REGISTRY,
    })).toThrow(/codec_mismatch/);
  });
});
