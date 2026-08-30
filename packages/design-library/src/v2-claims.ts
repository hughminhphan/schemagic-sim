import { parseElectricalDesignRequestV2 } from "@opencircuit/design-schema";
import { compareAscii, deepFreeze, detachedJsonSnapshot } from "./canonical";
import type { ProfileQuantity, ProfileUnit } from "./types";
import type {
  ClaimEvaluationContextV2,
  ClaimResolutionV2,
  PowerExternalFetSynchronousBuckFactsV2,
  PowerClaimCandidateConditionStateV2,
  PowerClaimContextRequestV2,
  PowerIntegratedSynchronousBuckFactsV2,
  ProfileConditionV2,
  ProfileQuantityClaimV2,
  QuantityClaimBasisV2,
  QuantityClaimKindV2,
} from "./v2-types";

export interface QuantityClaimSpecV2 {
  unit: ProfileUnit;
  claimKind: QuantityClaimKindV2;
  basis: QuantityClaimBasisV2;
  domain: "positive" | "nonnegative";
}

export type ClaimConditionParameterSpecV2 = Readonly<
  | { kind: "quantity_range"; unit: ProfileUnit; domain: "positive" | "nonnegative" }
  | { kind: "token_equals" }
>;

export const POWER_CONDITION_PARAMETER_SPECS_V2 = deepFreeze({
  "ambient-temperature": { kind: "quantity_range", unit: "K", domain: "positive" },
  "board-layout": { kind: "token_equals" },
  "input-voltage": { kind: "quantity_range", unit: "V", domain: "positive" },
  "junction-temperature": { kind: "quantity_range", unit: "K", domain: "positive" },
  "operating-mode": { kind: "token_equals" },
  "output-current": { kind: "quantity_range", unit: "A", domain: "nonnegative" },
  "output-voltage": { kind: "quantity_range", unit: "V", domain: "positive" },
  "switch-current": { kind: "quantity_range", unit: "A", domain: "nonnegative" },
  "switching-frequency": { kind: "quantity_range", unit: "Hz", domain: "positive" },
} as const satisfies Readonly<Record<string, ClaimConditionParameterSpecV2>>);

const Q = (
  unit: ProfileUnit,
  claimKind: QuantityClaimKindV2,
  basis: QuantityClaimBasisV2,
  domain: QuantityClaimSpecV2["domain"] = "positive",
): QuantityClaimSpecV2 => ({ unit, claimKind, basis, domain });

type IntegratedClaimFieldV2 = Exclude<
  keyof PowerIntegratedSynchronousBuckFactsV2,
  "controlEvidenceBasis" | "mountedGeometry"
>;

type ExternalClaimFieldV2 = Exclude<
  keyof PowerExternalFetSynchronousBuckFactsV2,
  "controlEvidenceBasis" | "currentSenseThresholdOptions" | "gateDriveVoltageOptions" | "mountedGeometry"
>;

export const POWER_INTEGRATED_CLAIM_SPECS_V2 = deepFreeze({
  inputVoltageMinimum: Q("V", "guaranteed_minimum", "operating_range"),
  inputVoltageMaximum: Q("V", "guaranteed_maximum", "operating_range"),
  outputVoltageMinimum: Q("V", "guaranteed_minimum", "operating_range"),
  outputVoltageMaximum: Q("V", "guaranteed_maximum", "operating_range"),
  outputCurrentCapabilityMinimum: Q("A", "guaranteed_minimum", "normal_operation_rating"),
  currentLimitMinimum: Q("A", "guaranteed_minimum", "production_spread"),
  currentLimitTypical: Q("A", "typical", "production_spread"),
  currentLimitMaximum: Q("A", "guaranteed_maximum", "production_spread"),
  switchingFrequencyMinimum: Q("Hz", "guaranteed_minimum", "operating_range"),
  switchingFrequencyRecommended: Q("Hz", "recommended", "recommended_setting"),
  switchingFrequencyMaximum: Q("Hz", "guaranteed_maximum", "operating_range"),
  minimumOnTimeMaximum: Q("s", "guaranteed_maximum", "production_spread", "nonnegative"),
  minimumOffTimeMaximum: Q("s", "guaranteed_maximum", "production_spread", "nonnegative"),
  feedbackReferenceMinimum: Q("V", "guaranteed_minimum", "production_spread"),
  feedbackReferenceTypical: Q("V", "typical", "production_spread"),
  feedbackReferenceMaximum: Q("V", "guaranteed_maximum", "production_spread"),
  quiescentCurrentMaximum: Q("A", "guaranteed_maximum", "production_spread", "nonnegative"),
  junctionToAmbientThermalResistanceMaximum: Q("K/W", "guaranteed_maximum", "test_characteristic"),
  maximumJunctionTemperature: Q("K", "absolute_maximum", "absolute_rating"),
  highSideOnResistanceMaximum: Q("ohm", "guaranteed_maximum", "test_characteristic", "nonnegative"),
  lowSideOnResistanceMaximum: Q("ohm", "guaranteed_maximum", "test_characteristic", "nonnegative"),
  riseTimeMaximum: Q("s", "guaranteed_maximum", "test_characteristic", "nonnegative"),
  fallTimeMaximum: Q("s", "guaranteed_maximum", "test_characteristic", "nonnegative"),
} as const satisfies Readonly<Record<IntegratedClaimFieldV2, QuantityClaimSpecV2>>);

export const POWER_EXTERNAL_CLAIM_SPECS_V2 = deepFreeze({
  inputVoltageMinimum: Q("V", "guaranteed_minimum", "operating_range"),
  inputVoltageMaximum: Q("V", "guaranteed_maximum", "operating_range"),
  outputVoltageMinimum: Q("V", "guaranteed_minimum", "operating_range"),
  outputVoltageMaximum: Q("V", "guaranteed_maximum", "operating_range"),
  switchingFrequencyMinimum: Q("Hz", "guaranteed_minimum", "operating_range"),
  switchingFrequencyRecommended: Q("Hz", "recommended", "recommended_setting"),
  switchingFrequencyMaximum: Q("Hz", "guaranteed_maximum", "operating_range"),
  minimumOnTimeMaximum: Q("s", "guaranteed_maximum", "production_spread", "nonnegative"),
  minimumOffTimeMaximum: Q("s", "guaranteed_maximum", "production_spread", "nonnegative"),
  feedbackReferenceMinimum: Q("V", "guaranteed_minimum", "production_spread"),
  feedbackReferenceTypical: Q("V", "typical", "production_spread"),
  feedbackReferenceMaximum: Q("V", "guaranteed_maximum", "production_spread"),
  quiescentCurrentMaximum: Q("A", "guaranteed_maximum", "production_spread", "nonnegative"),
  junctionToAmbientThermalResistanceMaximum: Q("K/W", "guaranteed_maximum", "test_characteristic"),
  maximumJunctionTemperature: Q("K", "absolute_maximum", "absolute_rating"),
  gateSourceCurrentMinimum: Q("A", "guaranteed_minimum", "normal_operation_rating"),
  gateSinkCurrentMinimum: Q("A", "guaranteed_minimum", "normal_operation_rating"),
  gatePullupResistanceMaximum: Q("ohm", "guaranteed_maximum", "test_characteristic", "nonnegative"),
  gatePulldownResistanceMaximum: Q("ohm", "guaranteed_maximum", "test_characteristic", "nonnegative"),
  deadTimeMaximum: Q("s", "guaranteed_maximum", "production_spread", "nonnegative"),
  controllerLossMaximum: Q("W", "guaranteed_maximum", "test_characteristic", "nonnegative"),
} as const satisfies Readonly<Record<ExternalClaimFieldV2, QuantityClaimSpecV2>>);

export const POWER_INTEGRATED_REQUIRED_CONDITIONS_V2 = deepFreeze({
  inputVoltageMinimum: [],
  inputVoltageMaximum: [],
  outputVoltageMinimum: ["input-voltage"],
  outputVoltageMaximum: ["input-voltage"],
  outputCurrentCapabilityMinimum: ["input-voltage", "output-voltage"],
  currentLimitMinimum: ["input-voltage"],
  currentLimitTypical: ["input-voltage"],
  currentLimitMaximum: ["input-voltage"],
  switchingFrequencyMinimum: ["input-voltage"],
  switchingFrequencyRecommended: ["input-voltage"],
  switchingFrequencyMaximum: ["input-voltage"],
  minimumOnTimeMaximum: ["input-voltage", "junction-temperature"],
  minimumOffTimeMaximum: ["input-voltage", "junction-temperature"],
  feedbackReferenceMinimum: ["junction-temperature"],
  feedbackReferenceTypical: ["junction-temperature"],
  feedbackReferenceMaximum: ["junction-temperature"],
  quiescentCurrentMaximum: ["input-voltage", "junction-temperature", "operating-mode"],
  junctionToAmbientThermalResistanceMaximum: ["ambient-temperature", "board-layout"],
  maximumJunctionTemperature: [],
  highSideOnResistanceMaximum: ["junction-temperature", "switch-current"],
  lowSideOnResistanceMaximum: ["junction-temperature", "switch-current"],
  riseTimeMaximum: ["input-voltage", "output-current"],
  fallTimeMaximum: ["input-voltage", "output-current"],
} as const satisfies Readonly<Record<IntegratedClaimFieldV2, readonly string[]>>);

export const POWER_EXTERNAL_REQUIRED_CONDITIONS_V2 = deepFreeze({
  inputVoltageMinimum: [],
  inputVoltageMaximum: [],
  outputVoltageMinimum: ["input-voltage"],
  outputVoltageMaximum: ["input-voltage"],
  switchingFrequencyMinimum: ["input-voltage"],
  switchingFrequencyRecommended: ["input-voltage"],
  switchingFrequencyMaximum: ["input-voltage"],
  minimumOnTimeMaximum: ["input-voltage", "junction-temperature"],
  minimumOffTimeMaximum: ["input-voltage", "junction-temperature"],
  feedbackReferenceMinimum: ["junction-temperature"],
  feedbackReferenceTypical: ["junction-temperature"],
  feedbackReferenceMaximum: ["junction-temperature"],
  quiescentCurrentMaximum: ["input-voltage", "junction-temperature", "operating-mode"],
  junctionToAmbientThermalResistanceMaximum: ["ambient-temperature", "board-layout"],
  maximumJunctionTemperature: [],
  gateSourceCurrentMinimum: ["input-voltage"],
  gateSinkCurrentMinimum: ["input-voltage"],
  gatePullupResistanceMaximum: ["junction-temperature"],
  gatePulldownResistanceMaximum: ["junction-temperature"],
  deadTimeMaximum: ["junction-temperature"],
  controllerLossMaximum: ["input-voltage", "output-current", "switching-frequency"],
} as const satisfies Readonly<Record<ExternalClaimFieldV2, readonly string[]>>);

export const POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2 = deepFreeze({
  currentSenseThresholdOptions: ["input-voltage", "junction-temperature"],
  gateDriveVoltageOptions: ["input-voltage", "junction-temperature"],
} as const);

const ELECTRICAL_TOKEN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

function inDomain(value: number, domain: "positive" | "nonnegative"): boolean {
  return Number.isFinite(value) && (domain === "positive" ? value > 0 : value >= 0) && !Object.is(value, -0);
}

function quantityInterval(
  parameterId: string,
  minimum: ProfileQuantity,
  maximum: ProfileQuantity,
) {
  return { parameterId, kind: "quantity_range" as const, minimum, maximum };
}

export function buildPowerClaimEvaluationContextV2(
  request: Readonly<PowerClaimContextRequestV2>,
  state: Readonly<PowerClaimCandidateConditionStateV2>,
): Readonly<ClaimEvaluationContextV2> {
  const parsedRequest = parseElectricalDesignRequestV2(request);
  if (parsedRequest.application !== "power.buck") throw new Error("V2 Power claim context requires a power.buck request");
  const requirements = parsedRequest.requirements;
  const entries: ClaimEvaluationContextV2["values"] = [
    quantityInterval("ambient-temperature", requirements.ambientTemperature, requirements.ambientTemperature),
    quantityInterval("input-voltage", requirements.inputVoltage.minimum, requirements.inputVoltage.maximum),
    quantityInterval("junction-temperature", requirements.ambientTemperature, parsedRequest.constraints.maximumJunctionTemperature),
    quantityInterval(
      "output-current",
      { value: 0, unit: "A", displayUnit: requirements.maximumOutputCurrent.displayUnit },
      requirements.maximumOutputCurrent,
    ),
    quantityInterval("output-voltage", requirements.outputVoltage, requirements.outputVoltage),
  ];
  if (
    requirements.inputVoltage.nominal.value < requirements.inputVoltage.minimum.value
    || requirements.inputVoltage.nominal.value > requirements.inputVoltage.maximum.value
    || parsedRequest.constraints.maximumJunctionTemperature.value < requirements.ambientTemperature.value
  ) {
    throw new Error("V2 Power claim context request ranges are inconsistent");
  }
  if (state.boardLayout !== null) throw new Error("V2 board-layout claim context requires a future verified placement-artifact capability");
  if (state.operatingMode !== null) entries.push({ parameterId: "operating-mode", kind: "token", value: state.operatingMode });
  if (state.selectedSwitchingFrequency !== null) {
    entries.push(quantityInterval("switching-frequency", state.selectedSwitchingFrequency, state.selectedSwitchingFrequency));
  }
  if (state.switchCurrent !== null) entries.push(quantityInterval("switch-current", state.switchCurrent.minimum, state.switchCurrent.maximum));
  entries.sort((left, right) => compareAscii(left.parameterId, right.parameterId));
  const result = detachedJsonSnapshot({ values: entries }) as ClaimEvaluationContextV2;
  assertContextOrder(result);
  deepFreeze(result);
  return result;
}

function assertConditionOrder(conditions: readonly ProfileConditionV2[]): void {
  let prior: string | undefined;
  for (const condition of conditions) {
    if (!ELECTRICAL_TOKEN.test(condition.parameterId)) {
      throw new Error("V2 claim condition parameterId is outside the closed electrical-token grammar");
    }
    const spec = (POWER_CONDITION_PARAMETER_SPECS_V2 as Readonly<Record<string, ClaimConditionParameterSpecV2>>)[condition.parameterId];
    if (condition.evidence.length === 0) throw new Error("Every V2 claim condition requires evidence");
    if (!spec || condition.kind !== spec.kind) {
      throw new Error("V2 claim condition is outside the closed Power condition vocabulary");
    }
    if (condition.kind === "token_equals") {
      if (!ELECTRICAL_TOKEN.test(condition.value)) throw new Error("V2 token condition value is outside the closed electrical-token grammar");
    } else {
      if (spec.kind !== "quantity_range") throw new Error("V2 quantity condition requires a quantity-range parameter");
      if (condition.minimum === null && condition.maximum === null) throw new Error("V2 quantity condition requires at least one bound");
      if (
        (condition.minimum !== null && (condition.minimum.unit !== spec.unit || !inDomain(condition.minimum.value, spec.domain)))
        || (condition.maximum !== null && (condition.maximum.unit !== spec.unit || !inDomain(condition.maximum.value, spec.domain)))
        || (condition.minimum !== null && condition.maximum !== null && condition.minimum.value > condition.maximum.value)
      ) {
        throw new Error("V2 quantity condition has an invalid unit, value, or range order");
      }
    }
    if (prior !== undefined && compareAscii(prior, condition.parameterId) >= 0) {
      throw new Error("V2 claim conditions must be unique and strictly code-unit sorted");
    }
    prior = condition.parameterId;
  }
}

function assertContextOrder(context: Readonly<ClaimEvaluationContextV2>): void {
  let prior: string | undefined;
  for (const entry of context.values) {
    if (!ELECTRICAL_TOKEN.test(entry.parameterId)) {
      throw new Error("V2 claim context parameterId is outside the closed electrical-token grammar");
    }
    const spec = (POWER_CONDITION_PARAMETER_SPECS_V2 as Readonly<Record<string, ClaimConditionParameterSpecV2>>)[entry.parameterId];
    if (!spec || (spec.kind === "quantity_range" ? entry.kind !== "quantity_range" : entry.kind !== "token")) {
      throw new Error("V2 claim context is outside the closed Power condition vocabulary");
    }
    if (entry.kind === "quantity_range") {
      if (
        spec.kind !== "quantity_range"
        || entry.minimum.unit !== spec.unit
        || entry.maximum.unit !== spec.unit
        || !inDomain(entry.minimum.value, spec.domain)
        || !inDomain(entry.maximum.value, spec.domain)
        || entry.minimum.value > entry.maximum.value
      ) {
        throw new Error("V2 claim context quantity interval has an invalid unit, value, or order");
      }
    } else if (!ELECTRICAL_TOKEN.test(entry.value)) {
      throw new Error("V2 claim context token is outside the closed electrical-token grammar");
    }
    if (prior !== undefined && compareAscii(prior, entry.parameterId) >= 0) {
      throw new Error("V2 claim context values must be unique and strictly code-unit sorted");
    }
    prior = entry.parameterId;
  }
}

function conditionFailure(
  conditions: readonly ProfileConditionV2[],
  context: Readonly<ClaimEvaluationContextV2>,
): ClaimResolutionV2<ProfileUnit> | undefined {
  assertConditionOrder(conditions);
  assertContextOrder(context);
  for (const condition of conditions) {
    const supplied = context.values.find((entry) => entry.parameterId === condition.parameterId);
    if (!supplied) {
      return deepFreeze({ status: "unknown", reason: "missing_condition", parameterId: condition.parameterId });
    }
    if (condition.kind === "token_equals") {
      if (supplied.kind !== "token" || supplied.value !== condition.value) {
        return deepFreeze({ status: "unknown", reason: "condition_out_of_range", parameterId: condition.parameterId });
      }
      continue;
    }
    if (supplied.kind !== "quantity_range") {
      return deepFreeze({ status: "unknown", reason: "condition_out_of_range", parameterId: condition.parameterId });
    }
    const expectedUnit = condition.minimum?.unit ?? condition.maximum?.unit;
    if (
      expectedUnit === undefined
      || supplied.minimum.unit !== expectedUnit
      || supplied.maximum.unit !== expectedUnit
      || (condition.minimum !== null && supplied.minimum.value < condition.minimum.value)
      || (condition.maximum !== null && supplied.maximum.value > condition.maximum.value)
    ) {
      return deepFreeze({ status: "unknown", reason: "condition_out_of_range", parameterId: condition.parameterId });
    }
  }
  return undefined;
}

function resolveReviewedClaim<Unit extends ProfileUnit>(
  claim: ProfileQuantityClaimV2<Unit>,
  context: Readonly<ClaimEvaluationContextV2>,
  expectedKind: QuantityClaimKindV2,
  expectedBasis: QuantityClaimBasisV2,
): ClaimResolutionV2<Unit> {
  if (claim.claimKind !== expectedKind || claim.basis !== expectedBasis) {
    throw new Error(`V2 quantity claim must be ${expectedKind}/${expectedBasis}`);
  }
  assertContextOrder(context);
  if (claim.state === "unknown") {
    if (claim.value !== null || claim.evidence.length !== 0 || claim.validFor.length !== 0) {
      throw new Error("Unknown V2 quantity claims must have null value, no evidence, and no conditions");
    }
    return deepFreeze({ status: "unknown", reason: "claim_unknown", parameterId: null });
  }
  if (claim.value === null || claim.evidence.length === 0) throw new Error("Known V2 quantity claims require a value and evidence");
  if (claim.state !== "reviewed") {
    return deepFreeze({ status: "unknown", reason: "claim_not_reviewed", parameterId: null });
  }
  const failed = conditionFailure(claim.validFor, context);
  if (failed) return failed as ClaimResolutionV2<Unit>;
  const result: ClaimResolutionV2<Unit> = detachedJsonSnapshot({
    status: "known" as const,
    quantity: claim.value,
    evidence: claim.evidence,
    conditions: claim.validFor,
  });
  deepFreeze(result);
  return result;
}

export function guaranteedLowerEndpoint<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit> {
  return resolveReviewedClaim(claim, context, "guaranteed_minimum", "operating_range");
}

export function guaranteedUpperEndpoint<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit> {
  return resolveReviewedClaim(claim, context, "guaranteed_maximum", "operating_range");
}

export function guaranteedMinimumCapability<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit> {
  return resolveReviewedClaim(claim, context, "guaranteed_minimum", "normal_operation_rating");
}

export function worstCaseProductionMaximum<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit> {
  return resolveReviewedClaim(claim, context, "guaranteed_maximum", "production_spread");
}

export function worstCaseProductionMinimum<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit> {
  return resolveReviewedClaim(claim, context, "guaranteed_minimum", "production_spread");
}

export function worstCaseCharacteristicMaximum<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit> {
  return resolveReviewedClaim(claim, context, "guaranteed_maximum", "test_characteristic");
}

export function typicalProductionTarget<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit> {
  return resolveReviewedClaim(claim, context, "typical", "production_spread");
}

export function recommendedSettingTarget<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit> {
  return resolveReviewedClaim(claim, context, "recommended", "recommended_setting");
}

export function absoluteMaximumRating<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit> {
  return resolveReviewedClaim(claim, context, "absolute_maximum", "absolute_rating");
}
