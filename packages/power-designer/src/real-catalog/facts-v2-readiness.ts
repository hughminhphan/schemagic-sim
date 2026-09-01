import {
  FACTS_SCHEMA_VERSION_V2,
  POWER_CONDITION_PARAMETER_SPECS_V2,
  POWER_EXTERNAL_CLAIM_SPECS_V2,
  POWER_EXTERNAL_REQUIRED_CONDITIONS_V2,
  POWER_INTEGRATED_CLAIM_SPECS_V2,
  POWER_INTEGRATED_REQUIRED_CONDITIONS_V2,
  compareAscii,
  designProfilePath,
  getBundledDesignLibraryDocuments,
  type ProfileUnit,
  type QuantityClaimBasisV2,
  type QuantityClaimKindV2,
} from "@opencircuit/design-library";
import { REAL_PRIMARY_PART_CATALOG } from "./profiles";
import type {
  FactsV2ClaimCandidate,
  FactsV2ClaimCandidateStatus,
  FactsV2ClaimSourceCandidate,
  FactsV2CandidateObservedCondition,
  NumericFact,
  RealCatalogFactsV2ReadinessReport,
  RealPrimaryPartCatalog,
  RealPrimaryPartProfile,
  SourceLocator,
} from "./types";

type ValueSlot = FactsV2ClaimSourceCandidate["valueSlot"];
type NumericMapping = Readonly<{
  path: string;
  fact: NumericFact;
  valueSlot: ValueSlot;
  observedConditions?: readonly FactsV2CandidateObservedCondition[];
  semanticMismatchReason?: string;
}>;

const COMMON_UNRESOLVED_PATHS = [
  "/commonFacts/packageName",
  "/facts/mountedGeometry/boardArea",
  "/facts/mountedGeometry/maximumHeight",
] as const;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function sourceHashesVerified(profile: RealPrimaryPartProfile, refs: readonly SourceLocator[]): boolean {
  const sources = new Map(profile.sources.map((source) => [source.sourceId, source]));
  return refs.length > 0 && refs.every((ref) => sources.get(ref.sourceId)?.contentHash.state === "verified");
}

function quantityCondition(
  parameterId: string,
  minimum: number,
  maximum: number,
  unit: "V" | "A" | "K",
  sourceRef: SourceLocator,
): FactsV2CandidateObservedCondition {
  return {
    parameterId,
    factsV2ParameterId: parameterId,
    minimum: { value: minimum, unit },
    maximum: { value: maximum, unit },
    setting: null,
    minimumExclusive: false,
    maximumExclusive: false,
    sourceRefs: [sourceRef],
  };
}

function settingCondition(
  parameterId: string,
  setting: string,
  sourceRef: SourceLocator,
  factsV2ParameterId: string | null = parameterId,
): FactsV2CandidateObservedCondition {
  return {
    parameterId,
    factsV2ParameterId,
    minimum: null,
    maximum: null,
    setting,
    minimumExclusive: false,
    maximumExclusive: false,
    sourceRefs: [sourceRef],
  };
}

function unrepresentableQuantityCondition(
  parameterId: string,
  value: number,
  unit: "V" | "A" | "K",
  sourceRef: SourceLocator,
): FactsV2CandidateObservedCondition {
  return {
    ...quantityCondition(parameterId, value, value, unit, sourceRef),
    factsV2ParameterId: null,
  };
}

function ncp1599FeedbackConditions(
  profile: RealPrimaryPartProfile,
  valueSlot: ValueSlot,
): readonly FactsV2CandidateObservedCondition[] {
  if (profile.profileId !== "real.onsemi.ncp1599mntwg") return [];
  const sourceRef = profile.facts.electrical.feedbackReference.sourceRefs[0];
  if (sourceRef === undefined) return [];
  return [
    settingCondition("feedback-test-connection", "vfb-equals-vcomp", sourceRef, null),
    quantityCondition(
      "junction-temperature",
      valueSlot === "typical" ? 298.15 : 233.15,
      valueSlot === "typical" ? 298.15 : 398.15,
      "K",
      sourceRef,
    ),
  ];
}

function ncp1599OnResistanceConditions(
  profile: RealPrimaryPartProfile,
  side: "high" | "low",
): readonly FactsV2CandidateObservedCondition[] {
  if (profile.profileId !== "real.onsemi.ncp1599mntwg") return [];
  if (profile.partClass !== "power.integrated-synchronous-buck-regulator") return [];
  const fact = side === "high"
    ? profile.integratedPowerStage.highSideOnResistance
    : profile.integratedPowerStage.lowSideOnResistance;
  const sourceRef = fact.sourceRefs[0];
  if (sourceRef === undefined) return [];
  return [
    unrepresentableQuantityCondition("gate-source-voltage", 5, "V", sourceRef),
    quantityCondition("junction-temperature", 233.15, 398.15, "K", sourceRef),
    quantityCondition("switch-current", 0.1, 0.1, "A", sourceRef),
  ];
}

function ncp1599ClaimConditions(
  profile: RealPrimaryPartProfile,
  field: "currentLimit" | "minimumOnTime",
): readonly FactsV2CandidateObservedCondition[] {
  if (profile.profileId !== "real.onsemi.ncp1599mntwg") return [];
  const fact = field === "currentLimit"
    ? profile.facts.electrical.currentLimit
    : profile.facts.timing.minimumOnTime;
  const sourceRef = fact.sourceRefs[0];
  if (sourceRef === undefined) return [];
  const common = [
    quantityCondition("input-voltage", field === "currentLimit" ? 4 : 3, 5.5, "V", sourceRef),
    quantityCondition("junction-temperature", 298.15, 298.15, "K", sourceRef),
  ];
  return field === "currentLimit"
    ? [
        ...common,
        settingCondition("operating-mode", "normal-regulation", sourceRef),
        quantityCondition("output-voltage", 1.2, 1.2, "V", sourceRef),
      ]
    : [
        ...common,
        quantityCondition("output-voltage", 1.2, 1.2, "V", sourceRef),
      ];
}

function conditionsAreRepresentable(conditions: readonly FactsV2CandidateObservedCondition[]): boolean {
  let prior: string | undefined;
  for (const condition of conditions) {
    if (
      condition.factsV2ParameterId === null
      || condition.factsV2ParameterId !== condition.parameterId
      || (prior !== undefined && compareAscii(prior, condition.parameterId) >= 0)
      || condition.minimumExclusive
      || condition.maximumExclusive
    ) return false;
    const spec = (POWER_CONDITION_PARAMETER_SPECS_V2 as Readonly<Record<string, { kind: string; unit?: ProfileUnit }>>)[condition.parameterId];
    if (spec === undefined) return false;
    if (spec.kind === "token_equals") {
      if (
        condition.setting === null
        || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(condition.setting)
        || condition.minimum !== null
        || condition.maximum !== null
      ) return false;
    } else {
      if (
        condition.setting !== null
        || (condition.minimum === null && condition.maximum === null)
        || (condition.minimum !== null && !Number.isFinite(condition.minimum.value))
        || (condition.maximum !== null && !Number.isFinite(condition.maximum.value))
        || (condition.minimum !== null && condition.minimum.unit !== spec.unit)
        || (condition.maximum !== null && condition.maximum.unit !== spec.unit)
        || (condition.minimum !== null && condition.maximum !== null && condition.minimum.value > condition.maximum.value)
      ) return false;
    }
    prior = condition.parameterId;
  }
  return true;
}

function integratedMapping(profile: Extract<RealPrimaryPartProfile, { partClass: "power.integrated-synchronous-buck-regulator" }>, field: string): NumericMapping | null {
  const electrical = profile.facts.electrical;
  const timing = profile.facts.timing;
  switch (field) {
    case "inputVoltageMinimum": return { path: "facts.electrical.inputVoltage", fact: electrical.inputVoltage, valueSlot: "minimum" };
    case "inputVoltageMaximum": return { path: "facts.electrical.inputVoltage", fact: electrical.inputVoltage, valueSlot: "maximum" };
    case "outputVoltageMinimum": return { path: "facts.electrical.outputVoltage", fact: electrical.outputVoltage, valueSlot: "minimum" };
    case "outputVoltageMaximum": return { path: "facts.electrical.outputVoltage", fact: electrical.outputVoltage, valueSlot: "maximum" };
    case "outputCurrentCapabilityMinimum": return {
      path: "facts.electrical.maximumOutputCurrent",
      fact: electrical.maximumOutputCurrent,
      valueSlot: "maximum",
      semanticMismatchReason: "A published maximum-output-current headline cannot be relabeled as a guaranteed minimum usable capability without semantic review.",
    };
    case "currentLimitMinimum": return { path: "facts.electrical.currentLimit", fact: electrical.currentLimit, valueSlot: "minimum", observedConditions: ncp1599ClaimConditions(profile, "currentLimit") };
    case "currentLimitTypical": return { path: "facts.electrical.currentLimit", fact: electrical.currentLimit, valueSlot: "typical", observedConditions: ncp1599ClaimConditions(profile, "currentLimit") };
    case "currentLimitMaximum": return { path: "facts.electrical.currentLimit", fact: electrical.currentLimit, valueSlot: "maximum", observedConditions: ncp1599ClaimConditions(profile, "currentLimit") };
    case "switchingFrequencyMinimum": return { path: "facts.timing.switchingFrequency", fact: timing.switchingFrequency, valueSlot: "minimum" };
    case "switchingFrequencyRecommended": return {
      path: "facts.timing.switchingFrequency",
      fact: timing.switchingFrequency,
      valueSlot: "typical",
      semanticMismatchReason: "A typical oscillator value is not automatically a recommended configurable setting.",
    };
    case "switchingFrequencyMaximum": return { path: "facts.timing.switchingFrequency", fact: timing.switchingFrequency, valueSlot: "maximum" };
    case "minimumOnTimeMaximum": return { path: "facts.timing.minimumOnTime", fact: timing.minimumOnTime, valueSlot: "maximum", observedConditions: ncp1599ClaimConditions(profile, "minimumOnTime") };
    case "minimumOffTimeMaximum": return { path: "facts.timing.minimumOffTime", fact: timing.minimumOffTime, valueSlot: "maximum" };
    case "feedbackReferenceMinimum": return { path: "facts.electrical.feedbackReference", fact: electrical.feedbackReference, valueSlot: "minimum", observedConditions: ncp1599FeedbackConditions(profile, "minimum") };
    case "feedbackReferenceTypical": return { path: "facts.electrical.feedbackReference", fact: electrical.feedbackReference, valueSlot: "typical", observedConditions: ncp1599FeedbackConditions(profile, "typical") };
    case "feedbackReferenceMaximum": return { path: "facts.electrical.feedbackReference", fact: electrical.feedbackReference, valueSlot: "maximum", observedConditions: ncp1599FeedbackConditions(profile, "maximum") };
    case "maximumJunctionTemperature": return profile.facts.thermal.maximumJunctionTemperature.state === "primary_source"
      ? {
          path: "facts.thermal.maximumJunctionTemperature",
          fact: profile.facts.thermal.maximumJunctionTemperature,
          valueSlot: "maximum",
        }
      : {
          path: "facts.thermal.operatingJunctionTemperature",
          fact: profile.facts.thermal.operatingJunctionTemperature,
          valueSlot: "maximum",
          semanticMismatchReason: "A recommended operating-junction maximum in degC is not an absolute-maximum junction rating in K.",
        };
    case "highSideOnResistanceMaximum": return { path: "integratedPowerStage.highSideOnResistance", fact: profile.integratedPowerStage.highSideOnResistance, valueSlot: "maximum", observedConditions: ncp1599OnResistanceConditions(profile, "high") };
    case "lowSideOnResistanceMaximum": return { path: "integratedPowerStage.lowSideOnResistance", fact: profile.integratedPowerStage.lowSideOnResistance, valueSlot: "maximum", observedConditions: ncp1599OnResistanceConditions(profile, "low") };
    default: return null;
  }
}

function externalMapping(profile: Extract<RealPrimaryPartProfile, { partClass: "power.external-fet-synchronous-buck-controller" }>, field: string): NumericMapping | null {
  const electrical = profile.facts.electrical;
  const timing = profile.facts.timing;
  const gate = profile.externalGateDrive;
  switch (field) {
    case "inputVoltageMinimum": return { path: "facts.electrical.inputVoltage", fact: electrical.inputVoltage, valueSlot: "minimum" };
    case "inputVoltageMaximum": return { path: "facts.electrical.inputVoltage", fact: electrical.inputVoltage, valueSlot: "maximum" };
    case "outputVoltageMinimum": return { path: "facts.electrical.outputVoltage", fact: electrical.outputVoltage, valueSlot: "minimum" };
    case "outputVoltageMaximum": return { path: "facts.electrical.outputVoltage", fact: electrical.outputVoltage, valueSlot: "maximum" };
    case "switchingFrequencyMinimum": return { path: "facts.timing.switchingFrequency", fact: timing.switchingFrequency, valueSlot: "minimum" };
    case "switchingFrequencyRecommended": return {
      path: "facts.timing.switchingFrequency",
      fact: timing.switchingFrequency,
      valueSlot: "typical",
      semanticMismatchReason: "A typical oscillator value is not automatically a recommended configured setting.",
    };
    case "switchingFrequencyMaximum": return { path: "facts.timing.switchingFrequency", fact: timing.switchingFrequency, valueSlot: "maximum" };
    case "minimumOnTimeMaximum": return { path: "facts.timing.minimumOnTime", fact: timing.minimumOnTime, valueSlot: "maximum" };
    case "minimumOffTimeMaximum": return { path: "facts.timing.minimumOffTime", fact: timing.minimumOffTime, valueSlot: "maximum" };
    case "feedbackReferenceMinimum": return { path: "facts.electrical.feedbackReference", fact: electrical.feedbackReference, valueSlot: "minimum" };
    case "feedbackReferenceTypical": return { path: "facts.electrical.feedbackReference", fact: electrical.feedbackReference, valueSlot: "typical" };
    case "feedbackReferenceMaximum": return { path: "facts.electrical.feedbackReference", fact: electrical.feedbackReference, valueSlot: "maximum" };
    case "maximumJunctionTemperature": return {
      path: "facts.thermal.operatingJunctionTemperature",
      fact: profile.facts.thermal.operatingJunctionTemperature,
      valueSlot: "maximum",
      semanticMismatchReason: "A recommended operating-junction maximum in degC is not an absolute-maximum junction rating in K.",
    };
    case "gateSourceCurrentMinimum": return { path: "externalGateDrive.sourceCurrent", fact: gate.sourceCurrent, valueSlot: "minimum" };
    case "gateSinkCurrentMinimum": return { path: "externalGateDrive.sinkCurrent", fact: gate.sinkCurrent, valueSlot: "minimum" };
    case "deadTimeMaximum": return { path: "externalGateDrive.deadTime", fact: gate.deadTime, valueSlot: "maximum" };
    default: return null;
  }
}

function claimCandidate(
  profile: RealPrimaryPartProfile,
  field: string,
  spec: { unit: ProfileUnit; claimKind: QuantityClaimKindV2; basis: QuantityClaimBasisV2 },
  requiredConditionIds: readonly string[],
  mapping: NumericMapping | null,
): FactsV2ClaimCandidate {
  const targetPath = `/facts/${field}` as const;
  if (mapping === null) {
    return {
      targetPath,
      targetUnit: spec.unit,
      claimKind: spec.claimKind,
      basis: spec.basis,
      requiredConditionIds: [...requiredConditionIds],
      sourceCandidate: null,
      status: "blocked_missing_source_fact",
      reason: "The authored real-catalog extraction has no source fact for this facts-V2 claim.",
    };
  }

  const fact = mapping.fact;
  const value = fact[mapping.valueSlot];
  const sourceCandidate: FactsV2ClaimSourceCandidate = {
    path: mapping.path,
    valueSlot: mapping.valueSlot,
    value,
    unit: fact.unit,
    qualification: fact.state === "primary_source" ? fact.qualification : null,
    sourceRefs: [...fact.sourceRefs],
    observedConditions: [...(mapping.observedConditions ?? [])],
  };
  let status: FactsV2ClaimCandidateStatus;
  let reason: string;
  if (mapping.semanticMismatchReason !== undefined) {
    status = "blocked_semantic_mismatch";
    reason = mapping.semanticMismatchReason;
  } else if (fact.state !== "primary_source" || value === null) {
    status = "blocked_missing_source_fact";
    reason = `The source extraction does not contain the required ${mapping.valueSlot} value.`;
  } else if (fact.unit !== spec.unit) {
    status = "blocked_semantic_mismatch";
    reason = `The source unit ${fact.unit} cannot be relabeled as facts-V2 unit ${spec.unit}.`;
  } else if (!sourceHashesVerified(profile, [
    ...fact.sourceRefs,
    ...(mapping.observedConditions ?? []).flatMap((condition) => condition.sourceRefs),
  ])) {
    status = "blocked_unverified_source_bytes";
    reason = "At least one cited official source still lacks an exact-byte SHA-256 binding.";
  } else if (requiredConditionIds.length > 0) {
    const observedConditions = mapping.observedConditions ?? [];
    const authoredConditionIds = new Set(observedConditions.map((condition) => condition.factsV2ParameterId));
    if (observedConditions.length > 0 && !conditionsAreRepresentable(observedConditions)) {
      status = "blocked_unrepresentable_condition";
      reason = "The complete source-stated applicability includes at least one condition outside the closed facts-V2 Power condition grammar.";
    } else if (
      observedConditions.length === 0
      || requiredConditionIds.some((conditionId) => !authoredConditionIds.has(conditionId))
    ) {
      status = "needs_condition_authoring_and_independent_review";
      reason = "The scalar extraction does not encode every required facts-V2 applicability condition and has not been independently reviewed.";
    } else {
      status = "needs_independent_review";
      reason = "The value and complete source-stated applicability are exact-source-bound but remain authored extractions, not an independently reviewed facts-V2 claim.";
    }
  } else {
    status = "needs_independent_review";
    reason = "The value is exact-source-bound but remains an authored extraction, not an independently reviewed facts-V2 claim.";
  }
  return {
    targetPath,
    targetUnit: spec.unit,
    claimKind: spec.claimKind,
    basis: spec.basis,
    requiredConditionIds: [...requiredConditionIds],
    sourceCandidate,
    status,
    reason,
  };
}

function unresolvedPaths(profile: RealPrimaryPartProfile, claimFields: readonly string[]): string[] {
  const classSpecific = profile.partClass === "power.integrated-synchronous-buck-regulator"
    ? ["/facts/controlEvidenceBasis", ...claimFields.map((field) => `/facts/${field}`)]
    : [
        "/facts/controlEvidenceBasis",
        "/facts/currentSenseThresholdOptions",
        "/facts/gateDriveVoltageOptions",
        ...claimFields.map((field) => `/facts/${field}`),
      ];
  return [...new Set([...COMMON_UNRESOLVED_PATHS, ...classSpecific])].sort(compareAscii);
}

function buildProfileGap(
  profile: RealPrimaryPartProfile,
  materializedProfileIds: ReadonlySet<string>,
) {
  const integrated = profile.partClass === "power.integrated-synchronous-buck-regulator";
  const specs = integrated ? POWER_INTEGRATED_CLAIM_SPECS_V2 : POWER_EXTERNAL_CLAIM_SPECS_V2;
  const required = integrated ? POWER_INTEGRATED_REQUIRED_CONDITIONS_V2 : POWER_EXTERNAL_REQUIRED_CONDITIONS_V2;
  const optionalFields = new Set(integrated ? ["riseTimeMaximum", "fallTimeMaximum"] : ["controllerLossMaximum"]);
  const fields = Object.keys(specs).filter((field) => !optionalFields.has(field)).sort(compareAscii);
  const claimCandidates = fields.map((field) => {
    const spec = specs[field as keyof typeof specs];
    const conditions = required[field as keyof typeof required] as readonly string[];
    const mapping = integrated
      ? integratedMapping(profile, field)
      : externalMapping(profile, field);
    return claimCandidate(profile, field, spec, conditions, mapping);
  });
  const candidateValues = claimCandidates.filter((candidate) => candidate.sourceCandidate?.value !== null && candidate.sourceCandidate?.value !== undefined);
  const hasMaterializedProfile = materializedProfileIds.has(profile.profileId);
  return {
    code: hasMaterializedProfile
      ? "facts_v2_profile_not_independently_reviewed_or_admitted" as const
      : "facts_v2_profile_not_authored_or_independently_reviewed" as const,
    profileId: profile.profileId,
    partClass: profile.partClass,
    targetFactsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    sourceHashComplete: profile.sources.every((source) => source.contentHash.state === "verified"),
    candidateValueCount: candidateValues.length,
    verifiedSourceCandidateValueCount: candidateValues.filter((candidate) =>
      candidate.sourceCandidate !== null && sourceHashesVerified(profile, candidate.sourceCandidate.sourceRefs)
    ).length,
    independentlyReviewedClaimCount: 0 as const,
    unresolvedPaths: unresolvedPaths(profile, fields),
    claimCandidates,
  };
}

export function buildRealCatalogFactsV2ReadinessReport(
  catalog: RealPrimaryPartCatalog = REAL_PRIMARY_PART_CATALOG,
  bundledProfiles: Readonly<Record<string, unknown>> = getBundledDesignLibraryDocuments().profiles,
): RealCatalogFactsV2ReadinessReport {
  const materializedProfileIds = new Set(REAL_PRIMARY_PART_CATALOG.profiles
    .filter((profile) => Object.prototype.hasOwnProperty.call(
      bundledProfiles,
      designProfilePath(profile.partClass, profile.identity.part),
    ))
    .map((profile) => profile.profileId));
  const profileGaps = catalog.profiles
    .map((profile) => buildProfileGap(profile, materializedProfileIds))
    .sort((left, right) => compareAscii(left.profileId, right.profileId));
  return deepFreeze({
    catalogVersion: catalog.version,
    profileCount: profileGaps.length,
    factsV2DraftCount: 1,
    admissionReadyProfileCount: 0 as const,
    sourceHashCompleteProfileCount: profileGaps.filter((gap) => gap.sourceHashComplete).length,
    profileGaps,
  }) as RealCatalogFactsV2ReadinessReport;
}

export const REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT = buildRealCatalogFactsV2ReadinessReport();
