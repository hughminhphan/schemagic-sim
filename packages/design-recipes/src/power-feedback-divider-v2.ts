import {
  canonicalProfileNumberV2,
  designProfileId,
  getDesignProfileCodecForVersion,
  parseDesignProfileForV2,
  typicalProductionTarget,
  worstCaseProductionMaximum,
  worstCaseProductionMinimum,
  type ClaimEvaluationContextV2,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type ManufacturerRegistryV1,
  type ProfileQuantity,
} from "@opencircuit/design-library/v2-runtime";
import {
  canonicalDesignV2Number,
  compareDesignV2Tokens,
  detachedFrozenDesignV2Value,
} from "@opencircuit/design-schema";

export const POWER_OUTPUT_VOLTAGE_TOLERANCE_V2 = 0.01 as const;
export const POWER_FEEDBACK_DIVIDER_V2_MAX_PAIR_EVALUATIONS = 65_536 as const;

export type PowerFeedbackDividerPrimaryClassV2 =
  | "power.integrated-synchronous-buck-regulator"
  | "power.external-fet-synchronous-buck-controller";

export interface PowerFeedbackDividerInputV2 {
  primaryPartClass: PowerFeedbackDividerPrimaryClassV2;
  primaryProfile: unknown;
  resistorProfiles: readonly unknown[];
  requestedOutputVoltage: ProfileQuantity<"V">;
  claimContext: Readonly<ClaimEvaluationContextV2>;
  manufacturerRegistry?: ManufacturerRegistryV1;
}

export interface PowerFeedbackDividerPointV2 {
  outputVoltage: number;
  error: number;
}

export interface SelectedPowerFeedbackDividerV2 {
  upperProfileId: string;
  lowerProfileId: string;
  threshold: number;
  nominal: PowerFeedbackDividerPointV2;
  lowCorner: PowerFeedbackDividerPointV2;
  highCorner: PowerFeedbackDividerPointV2;
}

export type PowerFeedbackDividerSelectionV2 = Readonly<
  | ({ status: "selected" } & SelectedPowerFeedbackDividerV2)
  | ({
      status: "unknown";
      reason:
        | "no_resistor_profiles"
        | "feedback_reference_typical_unknown"
        | "feedback_reference_minimum_unknown"
        | "feedback_reference_maximum_unknown"
        | "feedback_divider_pair_work_budget_exceeded"
        | "resistor_resistance_unknown"
        | "resistor_tolerance_unknown";
      profileId: string;
      parameterId: string | null;
    })
  | ({
      status: "rejected";
      reason: "invalid_requested_output_voltage" | "invalid_resistance" | "invalid_tolerance";
      profileId: string | null;
    })
  | ({ status: "rejected"; reason: "corner_error_exceeded" } & SelectedPowerFeedbackDividerV2)
>;

type ResistorProfileV2 = DesignProfileWithFactsV2<
  "shared.general-purpose-resistor",
  FactsV2For<"shared.general-purpose-resistor">
>;

interface ResistorValueV2 {
  profileId: string;
  resistance: number;
  tolerance: number;
}

interface NominalPairV2 {
  upper: ResistorValueV2;
  lower: ResistorValueV2;
  nominal: PowerFeedbackDividerPointV2;
}

function compareNominalPairs(left: NominalPairV2, right: NominalPairV2): number {
  if (left.nominal.error !== right.nominal.error) {
    return left.nominal.error < right.nominal.error ? -1 : 1;
  }
  return compareDesignV2Tokens(left.upper.profileId, right.upper.profileId)
    || compareDesignV2Tokens(left.lower.profileId, right.lower.profileId);
}

function canon(value: number): number {
  const designValue = canonicalDesignV2Number(value);
  const profileValue = canonicalProfileNumberV2(value);
  if (designValue !== profileValue) throw new Error("Design and profile V2 canonical arithmetic diverged");
  return designValue;
}

function frozenResult<Result extends PowerFeedbackDividerSelectionV2>(result: Result): Result {
  return detachedFrozenDesignV2Value(result);
}

function point(
  feedbackReference: number,
  upperResistance: number,
  lowerResistance: number,
  requestedOutputVoltage: number,
): PowerFeedbackDividerPointV2 {
  const ratio = canon(upperResistance / lowerResistance);
  const gain = canon(1 + ratio);
  const outputVoltage = canon(feedbackReference * gain);
  const error = canon(Math.abs(canon(outputVoltage - requestedOutputVoltage)));
  return { outputVoltage, error };
}

function threshold(requestedOutputVoltage: number): number {
  return canon(Math.max(
    canon(Math.abs(requestedOutputVoltage) * POWER_OUTPUT_VOLTAGE_TOLERANCE_V2),
    1e-9,
  ));
}

function profileId(profile: ResistorProfileV2): string {
  return designProfileId(profile.partClass, profile.part);
}

function unknownClaim(
  reason:
    | "feedback_reference_typical_unknown"
    | "feedback_reference_minimum_unknown"
    | "feedback_reference_maximum_unknown",
  primaryProfileId: string,
  parameterId: string | null,
): PowerFeedbackDividerSelectionV2 {
  return frozenResult({ status: "unknown", reason, profileId: primaryProfileId, parameterId });
}

/**
 * Pure facts-V2 divider selection. This utility is not called by the installed
 * production recipe and cannot widen its current V1 catalog contract.
 */
export function selectPowerFeedbackDividerV2(
  input: Readonly<PowerFeedbackDividerInputV2>,
): PowerFeedbackDividerSelectionV2 {
  if (
    input.requestedOutputVoltage.unit !== "V"
    || !Number.isFinite(input.requestedOutputVoltage.value)
  ) {
    return frozenResult({ status: "rejected", reason: "invalid_requested_output_voltage", profileId: null });
  }

  const primaryCodec = getDesignProfileCodecForVersion(input.primaryPartClass, "2.0.0");
  const primary = parseDesignProfileForV2(
    primaryCodec,
    input.primaryProfile,
    input.manufacturerRegistry,
  );
  const primaryProfileId = designProfileId(primary.partClass, primary.part);
  const typical = typicalProductionTarget(primary.facts.feedbackReferenceTypical, input.claimContext);
  if (typical.status === "unknown") {
    return unknownClaim("feedback_reference_typical_unknown", primaryProfileId, typical.parameterId);
  }

  const maximumResistorProfiles = Math.floor(Math.sqrt(POWER_FEEDBACK_DIVIDER_V2_MAX_PAIR_EVALUATIONS));
  if (input.resistorProfiles.length > maximumResistorProfiles) {
    return frozenResult({
      status: "unknown",
      reason: "feedback_divider_pair_work_budget_exceeded",
      profileId: primaryProfileId,
      parameterId: null,
    });
  }

  const resistorCodec = getDesignProfileCodecForVersion("shared.general-purpose-resistor", "2.0.0");
  const resistorProfiles = input.resistorProfiles
    .map((candidate) => parseDesignProfileForV2(resistorCodec, candidate, input.manufacturerRegistry))
    .sort((left, right) => compareDesignV2Tokens(profileId(left), profileId(right)));
  if (resistorProfiles.length === 0) {
    return frozenResult({
      status: "unknown",
      reason: "no_resistor_profiles",
      profileId: primaryProfileId,
      parameterId: null,
    });
  }

  const resistorValues: ResistorValueV2[] = [];
  for (const profile of resistorProfiles) {
    const id = profileId(profile);
    const tolerance = profile.facts.tolerance;
    if (tolerance.state !== "reviewed" || tolerance.value === null) {
      return frozenResult({
        status: "unknown",
        reason: "resistor_tolerance_unknown",
        profileId: id,
        parameterId: null,
      });
    }
    const toleranceValue = tolerance.value.value;
    if (!Number.isFinite(toleranceValue) || toleranceValue < 0 || toleranceValue >= 1) {
      return frozenResult({ status: "rejected", reason: "invalid_tolerance", profileId: id });
    }
    resistorValues.push({ profileId: id, resistance: 0, tolerance: toleranceValue });
  }

  for (let index = 0; index < resistorProfiles.length; index += 1) {
    const profile = resistorProfiles[index]!;
    const resistance = profile.facts.resistance;
    const id = resistorValues[index]!.profileId;
    if (resistance.state !== "reviewed" || resistance.value === null) {
      return frozenResult({
        status: "unknown",
        reason: "resistor_resistance_unknown",
        profileId: id,
        parameterId: null,
      });
    }
    if (!Number.isFinite(resistance.value.value) || resistance.value.value <= 0) {
      return frozenResult({ status: "rejected", reason: "invalid_resistance", profileId: id });
    }
    resistorValues[index]!.resistance = resistance.value.value;
  }

  let selected: NominalPairV2 | undefined;
  for (const upper of resistorValues) {
    for (const lower of resistorValues) {
      const candidate: NominalPairV2 = {
        upper,
        lower,
        nominal: point(
          typical.quantity.value,
          upper.resistance,
          lower.resistance,
          input.requestedOutputVoltage.value,
        ),
      };
      if (selected === undefined || compareNominalPairs(candidate, selected) < 0) selected = candidate;
    }
  }
  if (selected === undefined) throw new Error("Feedback-divider pair selection lost a non-empty resistor set");

  const minimum = worstCaseProductionMinimum(primary.facts.feedbackReferenceMinimum, input.claimContext);
  if (minimum.status === "unknown") {
    return unknownClaim("feedback_reference_minimum_unknown", primaryProfileId, minimum.parameterId);
  }
  const maximum = worstCaseProductionMaximum(primary.facts.feedbackReferenceMaximum, input.claimContext);
  if (maximum.status === "unknown") {
    return unknownClaim("feedback_reference_maximum_unknown", primaryProfileId, maximum.parameterId);
  }

  const upperMinimum = canon(selected.upper.resistance * canon(1 - selected.upper.tolerance));
  const upperMaximum = canon(selected.upper.resistance * canon(1 + selected.upper.tolerance));
  const lowerMinimum = canon(selected.lower.resistance * canon(1 - selected.lower.tolerance));
  const lowerMaximum = canon(selected.lower.resistance * canon(1 + selected.lower.tolerance));
  const limit = threshold(input.requestedOutputVoltage.value);
  const result: SelectedPowerFeedbackDividerV2 = {
    upperProfileId: selected.upper.profileId,
    lowerProfileId: selected.lower.profileId,
    threshold: limit,
    nominal: selected.nominal,
    lowCorner: point(
      minimum.quantity.value,
      upperMinimum,
      lowerMaximum,
      input.requestedOutputVoltage.value,
    ),
    highCorner: point(
      maximum.quantity.value,
      upperMaximum,
      lowerMinimum,
      input.requestedOutputVoltage.value,
    ),
  };
  if (result.lowCorner.error > limit || result.highCorner.error > limit) {
    return frozenResult({ status: "rejected", reason: "corner_error_exceeded", ...result });
  }
  return frozenResult({ status: "selected", ...result });
}
