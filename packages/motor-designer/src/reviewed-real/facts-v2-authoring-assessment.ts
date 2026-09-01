import { PART_CLASS_SPECS, compareAscii } from "@opencircuit/design-library";
import type { EvidenceRef } from "@opencircuit/design-schema";
import { REVIEWED_REAL_MOTOR_CATALOG } from "./catalog";
import {
  REVIEWED_REAL_MOTOR_FACTS_V2_CANDIDATE_PROFILE_PLANS,
  buildReviewedRealMotorFactsV2CandidateProfilePlans,
} from "./facts-v2-candidate-plans";
import {
  GATE_DRIVER_FACT_IDS,
  INTEGRATED_BRIDGE_FACT_IDS,
  type GateDriverFactId,
  type IntegratedBridgeFactId,
  type MotorFactsV2AuthoringGap,
  type MotorFactsV2AuthoringGapCategory,
  type MotorFactsV2CandidateProfilePlan,
  type MotorFactsV2DraftAuthoringAssessment,
  type MotorFactsV2ExactByteEvidenceBinding,
  type MotorFactsV2ProfileAuthoringAssessment,
  type ReviewedFact,
  type ReviewedRealMotorCatalog,
  type ReviewedRealMotorProfile,
} from "./types";
import { assertValidReviewedRealMotorCatalog } from "./validation";

const INTEGRATED_FACT_TARGETS: readonly (readonly [IntegratedBridgeFactId, string])[] = [
  ["bridgeTopology", "bridgeTopology"],
  ["powerStage", "powerStage"],
  ["supplyMinimumV", "supplyMinimum"],
  ["supplyMaximumV", "supplyMaximum"],
  ["absoluteMaximumV", "absoluteMaximum"],
  ["continuousCurrentA", "continuousCurrent"],
  ["peakCurrentA", "peakCurrent"],
  ["currentLimitMinimumA", "currentLimitMinimum"],
  ["currentLimitMaximumA", "currentLimitMaximum"],
  ["logicHighThresholdMaximumV", "logicHighThresholdMaximum"],
  ["pwmMaximumHz", "pwmMaximum"],
  ["minimumPulseWidthS", "minimumPulseWidth"],
  ["pathResistanceOhm", "pathResistance"],
  ["switchingTransitionTimeS", "switchingTransitionTime"],
  ["quiescentCurrentA", "quiescentCurrent"],
  ["thetaJaKPerW", "junctionToAmbientThermalResistance"],
  ["maximumJunctionTemperatureK", "maximumJunctionTemperature"],
  ["highSideSupply", "highSideSupply"],
  ["maximumHighSideDutyCycle", "maximumHighSideDutyCycle"],
  ["localDecouplingMinimumF", "localDecouplingMinimum"],
  ["bulkCapacitanceMinimumF", "bulkCapacitanceMinimum"],
];

const GATE_DRIVER_FACT_TARGETS: readonly (readonly [GateDriverFactId, string])[] = [
  ["bridgeTopology", "bridgeTopology"],
  ["powerStage", "powerStage"],
  ["supplyMinimumV", "supplyMinimum"],
  ["supplyMaximumV", "supplyMaximum"],
  ["absoluteMaximumV", "absoluteMaximum"],
  ["driverBiasMinimumV", "driverBiasMinimum"],
  ["driverBiasMaximumV", "driverBiasMaximum"],
  ["logicHighThresholdMaximumV", "logicHighThresholdMaximum"],
  ["pwmMaximumHz", "pwmMaximum"],
  ["minimumPulseWidthS", "minimumPulseWidth"],
  ["sourceCurrentA", "sourceCurrent"],
  ["sinkCurrentA", "sinkCurrent"],
  ["gateVoltageV", "gateVoltage"],
  ["deadTimeS", "deadTime"],
  ["highSideSupply", "highSideSupply"],
  ["bootstrapMaximumDutyCycle", "bootstrapMaximumDutyCycle"],
  ["bootstrapAllowedRippleV", "bootstrapAllowedRipple"],
  ["bootstrapOverheadChargeC", "bootstrapOverheadCharge"],
  ["quiescentCurrentA", "quiescentCurrent"],
  ["thetaJaKPerW", "junctionToAmbientThermalResistance"],
  ["maximumJunctionTemperatureK", "maximumJunctionTemperature"],
  ["senseMaximumVoltageV", "senseMaximumVoltage"],
  ["localDecouplingMinimumF", "localDecouplingMinimum"],
];

const SEMANTIC_MISMATCH_FACTS: Readonly<Record<string, readonly (IntegratedBridgeFactId | GateDriverFactId)[]>> = {
  "motor.real.integrated.ti-drv8876pwpr": [
    "currentLimitMinimumA",
    "currentLimitMaximumA",
    "bulkCapacitanceMinimumF",
  ],
  "motor.real.integrated.st-stspin840": [
    "peakCurrentA",
    "currentLimitMinimumA",
    "currentLimitMaximumA",
    "quiescentCurrentA",
    "localDecouplingMinimumF",
    "bulkCapacitanceMinimumF",
  ],
  "motor.real.integrated.toshiba-tb67h450afng": [
    "continuousCurrentA",
    "currentLimitMinimumA",
    "currentLimitMaximumA",
    "localDecouplingMinimumF",
    "bulkCapacitanceMinimumF",
  ],
  "motor.real.integrated.ti-drv8262ddvr": [
    "peakCurrentA",
    "currentLimitMinimumA",
    "currentLimitMaximumA",
    "pwmMaximumHz",
    "localDecouplingMinimumF",
    "bulkCapacitanceMinimumF",
  ],
  "motor.real.gate-driver.ti-drv8701erger": [
    "driverBiasMinimumV",
    "driverBiasMaximumV",
    "bootstrapAllowedRippleV",
    "bootstrapOverheadChargeC",
  ],
  "motor.real.gate-driver.allegro-a3941klptr-t": [
    "driverBiasMinimumV",
    "driverBiasMaximumV",
    "deadTimeS",
  ],
  "motor.real.gate-driver.renesas-hip4081aibz": [
    "supplyMinimumV",
    "supplyMaximumV",
    "deadTimeS",
  ],
};

const SELECTION_POLICY = "fewest_draft_blockers_then_fewest_geometry_gaps_then_fewest_semantic_mismatches_then_fewest_missing_sources_then_most_source_bound_facts_then_ascii_profile_id" as const;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value as Readonly<T>;
}

function exactByteEvidence(entries: readonly EvidenceRef[]): readonly MotorFactsV2ExactByteEvidenceBinding[] {
  const result = entries.map((entry) => {
    if (entry.contentHash === undefined || !/^sha256:[0-9a-f]{64}$/.test(entry.contentHash)) {
      throw new Error(`Missing exact-byte evidence hash for ${entry.sourceId}`);
    }
    if (entry.retrievedAt === undefined) throw new Error(`Missing exact-byte retrieval for ${entry.sourceId}`);
    return {
      sourceId: entry.sourceId,
      contentHash: entry.contentHash as `sha256:${string}`,
      locator: entry.locator,
      retrievedAt: entry.retrievedAt,
      licenseNote: entry.licenseNote,
    };
  });
  return [...new Map(result.map((entry) => [
    `${entry.sourceId}\u0000${entry.contentHash}\u0000${entry.locator}\u0000${entry.retrievedAt}`,
    entry,
  ])).values()].sort((left, right) =>
    compareAscii(left.sourceId, right.sourceId)
    || compareAscii(left.locator, right.locator)
    || compareAscii(left.contentHash, right.contentHash)
  );
}

function reviewGap(
  targetPath: string,
  sourceFactId: IntegratedBridgeFactId | GateDriverFactId | null,
  evidence: readonly MotorFactsV2ExactByteEvidenceBinding[],
): MotorFactsV2AuthoringGap {
  if (evidence.length === 0) throw new Error(`Independent-review gap lacks exact-byte evidence at ${targetPath}`);
  return {
    targetPath,
    category: "independent_review",
    blocksDraftAuthoring: false,
    sourceFactId,
    reason: "The candidate is bound to pinned primary-source bytes but remains authored work, not an independently reviewed facts-V2 fact.",
    requiredResolution: "An independent reviewer must verify the exact MPN, source bytes, locator, value semantics, units, and applicability before admission.",
    exactByteEvidence: evidence,
  };
}

function scalarGap(
  profile: ReviewedRealMotorProfile,
  factId: IntegratedBridgeFactId | GateDriverFactId,
  targetFactId: string,
): MotorFactsV2AuthoringGap {
  const fact = (profile.facts as Record<string, ReviewedFact>)[factId];
  if (fact === undefined) throw new Error(`Missing source fact ${profile.id}.${factId}`);
  const targetPath = `/facts/${targetFactId}`;
  if (fact.state === "reviewed") return reviewGap(targetPath, factId, exactByteEvidence(fact.evidence));
  const semanticMismatch = (SEMANTIC_MISMATCH_FACTS[profile.id] ?? []).includes(factId);
  return {
    targetPath,
    category: semanticMismatch ? "semantic_mismatch" : "missing_source",
    blocksDraftAuthoring: true,
    sourceFactId: factId,
    reason: fact.explanation,
    requiredResolution: semanticMismatch
      ? "Obtain evidence with the exact facts-V2 semantics or deliberately revise the class schema; do not promote a non-equivalent observation or application choice."
      : "Obtain an exact primary-source fact for this required facts-V2 field, preserve its applicability, and leave the authored mapping pending independent review.",
    exactByteEvidence: [],
  };
}

function geometryGap(targetPath: string, reason: string, requiredResolution: string, evidence: readonly MotorFactsV2ExactByteEvidenceBinding[] = []): MotorFactsV2AuthoringGap {
  return {
    targetPath,
    category: "geometry",
    blocksDraftAuthoring: true,
    sourceFactId: null,
    reason,
    requiredResolution,
    exactByteEvidence: evidence,
  };
}

function countCategories(gaps: readonly MotorFactsV2AuthoringGap[]): Readonly<Record<MotorFactsV2AuthoringGapCategory, number>> {
  return {
    missing_source: gaps.filter((gap) => gap.category === "missing_source").length,
    semantic_mismatch: gaps.filter((gap) => gap.category === "semantic_mismatch").length,
    geometry: gaps.filter((gap) => gap.category === "geometry").length,
    independent_review: gaps.filter((gap) => gap.category === "independent_review").length,
  };
}

function assertClosedTargetMap(): void {
  const assertKind = (
    allFactIds: readonly string[],
    targets: readonly (readonly [string, string])[],
    partClass: "motor.integrated-h-bridge" | "motor.full-bridge-gate-driver",
  ): void => {
    const expected = allFactIds.filter((factId) => factId !== "operatingAmbientMinimumK" && factId !== "operatingAmbientMaximumK").sort(compareAscii);
    const actual = targets.map(([factId]) => factId).sort(compareAscii);
    if (actual.length !== expected.length || actual.some((factId, index) => factId !== expected[index])) {
      throw new Error(`Facts-V2 ${partClass} source map is incomplete`);
    }
    const schemaTargets = Object.keys(PART_CLASS_SPECS[partClass].facts).sort(compareAscii);
    const mappedTargets = targets.map(([, target]) => target).sort(compareAscii);
    if (mappedTargets.length !== schemaTargets.length || mappedTargets.some((target, index) => target !== schemaTargets[index])) {
      throw new Error(`Facts-V2 ${partClass} target map does not match the design-library schema`);
    }
  };
  assertKind(INTEGRATED_BRIDGE_FACT_IDS, INTEGRATED_FACT_TARGETS, "motor.integrated-h-bridge");
  assertKind(GATE_DRIVER_FACT_IDS, GATE_DRIVER_FACT_TARGETS, "motor.full-bridge-gate-driver");
}

function assertSemanticMismatchMap(catalog: ReviewedRealMotorCatalog): void {
  const profiles = new Map([...catalog.integratedBridges, ...catalog.gateDrivers].map((profile) => [profile.id, profile]));
  for (const [profileId, factIds] of Object.entries(SEMANTIC_MISMATCH_FACTS)) {
    const profile = profiles.get(profileId);
    if (profile === undefined) throw new Error(`Semantic-mismatch map references missing profile ${profileId}`);
    for (const factId of factIds) {
      const fact = (profile.facts as Record<string, ReviewedFact>)[factId];
      if (fact?.state !== "unknown") throw new Error(`Semantic-mismatch map must reference an unknown fact: ${profileId}.${factId}`);
    }
  }
}

function assessProfile(
  profile: ReviewedRealMotorProfile,
  gatePlan: MotorFactsV2CandidateProfilePlan | undefined,
): MotorFactsV2ProfileAuthoringAssessment {
  const targets = profile.kind === "integrated_bridge" ? INTEGRATED_FACT_TARGETS : GATE_DRIVER_FACT_TARGETS;
  const gaps: MotorFactsV2AuthoringGap[] = targets.map(([factId, targetFactId]) => scalarGap(profile, factId, targetFactId));

  if (profile.kind === "gate_driver") {
    if (gatePlan === undefined) throw new Error(`Missing gate-driver exact-byte candidate plan for ${profile.id}`);
    for (const entry of gatePlan.mandatoryEvidenceMap) {
      if (entry.status === "source_bound_pending_independent_review") {
        gaps.push(reviewGap(entry.targetPath, null, entry.exactByteEvidence));
      } else {
        gaps.push(geometryGap(entry.targetPath, entry.blockingReason, entry.requiredResolution, entry.exactByteEvidence));
      }
    }
  } else {
    gaps.push(reviewGap("/commonFacts/packageName", null, exactByteEvidence(profile.package.name.evidence)));
    gaps.push(geometryGap(
      "/facts/mountedGeometry/boardArea",
      "The staged package-body area is not a manufacturer-recommended mounted land-pattern bounding box and cannot be relabeled as mounted board area.",
      "Bind a dimensioned manufacturer-recommended land pattern to the exact MPN, author every maximum x/y projection term, and obtain independent review.",
    ));
    gaps.push(geometryGap(
      "/facts/mountedGeometry/maximumHeight",
      "No exact-MPN maximum mounted package height has been source-bound for this integrated bridge.",
      "Bind a manufacturer maximum package height in surface-mount orientation to exact source bytes and obtain independent review.",
    ));
  }

  gaps.sort((left, right) => compareAscii(left.targetPath, right.targetPath));
  const expectedTargetCount = targets.length + 3;
  if (gaps.length !== expectedTargetCount || new Set(gaps.map((gap) => gap.targetPath)).size !== gaps.length) {
    throw new Error(`Facts-V2 assessment is not exhaustive for ${profile.id}`);
  }
  const semanticFacts = new Set(SEMANTIC_MISMATCH_FACTS[profile.id] ?? []);
  const observedSemanticFacts = new Set(gaps.filter((gap) => gap.category === "semantic_mismatch").map((gap) => gap.sourceFactId));
  if (semanticFacts.size !== observedSemanticFacts.size || [...semanticFacts].some((factId) => !observedSemanticFacts.has(factId))) {
    throw new Error(`Semantic-mismatch assessment drift for ${profile.id}`);
  }
  const gapCounts = countCategories(gaps);
  const blockers = gaps.filter((gap) => gap.blocksDraftAuthoring);
  if (blockers.length === 0) throw new Error(`Facts-V2 draft is authorable and must not remain null: ${profile.id}`);
  return {
    sourceProfileId: profile.id,
    partClass: profile.kind === "integrated_bridge" ? "motor.integrated-h-bridge" : "motor.full-bridge-gate-driver",
    part: { ...profile.part },
    targetFactsSchemaVersion: "2.0.0",
    sourceHashComplete: true,
    assessedTargetPaths: gaps.map((gap) => gap.targetPath),
    gaps,
    gapCounts,
    sourceBoundFactCount: gapCounts.independent_review,
    draftAuthorable: false,
    draftAuthoringBlockerCount: blockers.length,
    draftAuthoringBlockers: blockers,
    independentReviewState: "pending",
    admissionState: "isolated_not_admitted",
    draft: null,
  };
}

/**
 * Audits every staged Motor profile against every facts-V2 admission path.
 * Ranking compares evidence closure only and never authorizes a draft.
 */
export function buildReviewedRealMotorFactsV2DraftAuthoringAssessment(
  catalog: ReviewedRealMotorCatalog = REVIEWED_REAL_MOTOR_CATALOG,
  candidatePlans: readonly MotorFactsV2CandidateProfilePlan[] = buildReviewedRealMotorFactsV2CandidateProfilePlans(catalog),
): MotorFactsV2DraftAuthoringAssessment {
  assertValidReviewedRealMotorCatalog(catalog);
  assertClosedTargetMap();
  assertSemanticMismatchMap(catalog);
  const gatePlans = new Map(candidatePlans.map((plan) => [plan.sourceProfileId, plan]));
  if (gatePlans.size !== candidatePlans.length || gatePlans.size !== catalog.gateDrivers.length) {
    throw new Error("Draft authoring assessment requires one exact-byte candidate plan per gate driver");
  }
  const profiles = [...catalog.integratedBridges, ...catalog.gateDrivers];
  const profileAssessments = profiles
    .map((profile) => assessProfile(profile, gatePlans.get(profile.id)))
    .sort((left, right) => compareAscii(left.sourceProfileId, right.sourceProfileId));
  if (profileAssessments.length !== profiles.length || new Set(profileAssessments.map((entry) => entry.sourceProfileId)).size !== profiles.length) {
    throw new Error("Draft authoring assessment must cover every Motor profile exactly once");
  }
  const ranked = [...profileAssessments].sort((left, right) =>
    left.draftAuthoringBlockerCount - right.draftAuthoringBlockerCount
    || left.gapCounts.geometry - right.gapCounts.geometry
    || left.gapCounts.semantic_mismatch - right.gapCounts.semantic_mismatch
    || left.gapCounts.missing_source - right.gapCounts.missing_source
    || right.sourceBoundFactCount - left.sourceBoundFactCount
    || compareAscii(left.sourceProfileId, right.sourceProfileId)
  );
  const authorableProfileIds = ranked.filter((entry) => entry.draftAuthoringBlockerCount === 0).map((entry) => entry.sourceProfileId);
  if (authorableProfileIds.length > 0) {
    throw new Error(`Facts-V2 draft is authorable and must not remain null: ${authorableProfileIds.join(",")}`);
  }
  const selected = ranked[0];
  if (selected === undefined) throw new Error("No Motor profiles are available for authoring assessment");
  return deepFreeze({
    evaluatedProfileIds: profileAssessments.map((entry) => entry.sourceProfileId),
    rankedProfileIds: ranked.map((entry) => entry.sourceProfileId),
    selectionPolicy: SELECTION_POLICY,
    selectedProfileId: selected.sourceProfileId,
    selectedScore: {
      draftAuthoringBlockerCount: selected.draftAuthoringBlockerCount,
      missingSourceGapCount: selected.gapCounts.missing_source,
      semanticMismatchGapCount: selected.gapCounts.semantic_mismatch,
      geometryGapCount: selected.gapCounts.geometry,
      independentReviewGapCount: selected.gapCounts.independent_review,
      sourceBoundFactCount: selected.sourceBoundFactCount,
    },
    profileAssessments,
    authorableProfileCount: 0 as const,
    authorableProfileIds,
    decision: "no_honest_draft" as const,
    independentReviewState: "pending" as const,
    admissionState: "isolated_not_admitted" as const,
    selectedProfileBlockers: selected.draftAuthoringBlockers,
    draft: null,
  }) as MotorFactsV2DraftAuthoringAssessment;
}

export const REVIEWED_REAL_MOTOR_FACTS_V2_DRAFT_AUTHORING_ASSESSMENT =
  buildReviewedRealMotorFactsV2DraftAuthoringAssessment(
    REVIEWED_REAL_MOTOR_CATALOG,
    REVIEWED_REAL_MOTOR_FACTS_V2_CANDIDATE_PROFILE_PLANS,
  );
