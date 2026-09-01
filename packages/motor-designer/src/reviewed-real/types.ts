import type { EvidenceRef } from "@opencircuit/design-schema";
import type { ManufacturerPartIdentity } from "@opencircuit/sourcing-schema";

export const INTEGRATED_BRIDGE_FACT_IDS = [
  "bridgeTopology",
  "powerStage",
  "supplyMinimumV",
  "supplyMaximumV",
  "absoluteMaximumV",
  "continuousCurrentA",
  "peakCurrentA",
  "currentLimitMinimumA",
  "currentLimitMaximumA",
  "logicHighThresholdMaximumV",
  "pwmMaximumHz",
  "minimumPulseWidthS",
  "pathResistanceOhm",
  "switchingTransitionTimeS",
  "quiescentCurrentA",
  "thetaJaKPerW",
  "maximumJunctionTemperatureK",
  "operatingAmbientMinimumK",
  "operatingAmbientMaximumK",
  "highSideSupply",
  "maximumHighSideDutyCycle",
  "localDecouplingMinimumF",
  "bulkCapacitanceMinimumF",
] as const;

export const GATE_DRIVER_FACT_IDS = [
  "bridgeTopology",
  "powerStage",
  "supplyMinimumV",
  "supplyMaximumV",
  "absoluteMaximumV",
  "driverBiasMinimumV",
  "driverBiasMaximumV",
  "logicHighThresholdMaximumV",
  "pwmMaximumHz",
  "minimumPulseWidthS",
  "sourceCurrentA",
  "sinkCurrentA",
  "gateVoltageV",
  "deadTimeS",
  "highSideSupply",
  "bootstrapMaximumDutyCycle",
  "bootstrapAllowedRippleV",
  "bootstrapOverheadChargeC",
  "quiescentCurrentA",
  "thetaJaKPerW",
  "maximumJunctionTemperatureK",
  "operatingAmbientMinimumK",
  "operatingAmbientMaximumK",
  "senseMaximumVoltageV",
  "localDecouplingMinimumF",
] as const;

export type IntegratedBridgeFactId = typeof INTEGRATED_BRIDGE_FACT_IDS[number];
export type GateDriverFactId = typeof GATE_DRIVER_FACT_IDS[number];

export type ReviewedFact<T = number | string> =
  | {
      value: T;
      state: "reviewed";
      evidence: EvidenceRef[];
      explanation: string;
    }
  | {
      value: null;
      state: "unknown";
      evidence: [];
      explanation: string;
    };

export interface ReviewedPackageFacts {
  name: ReviewedFact<string>;
  bodyAreaM2: ReviewedFact<number>;
}

export interface ReviewedProfileStatus {
  provenanceState: "authored_from_primary_sources";
  catalogAdmission: "pending_independent_review";
  ownerTrack: "motor";
  authoredAt: string;
  note: string;
}

interface ReviewedRealProfileBase {
  id: string;
  part: ManufacturerPartIdentity;
  identityEvidence: EvidenceRef[];
  package: ReviewedPackageFacts;
  authorship: ReviewedProfileStatus;
}

export interface ReviewedIntegratedBridgeProfile extends ReviewedRealProfileBase {
  kind: "integrated_bridge";
  facts: Record<IntegratedBridgeFactId, ReviewedFact>;
}

export interface ReviewedGateDriverProfile extends ReviewedRealProfileBase {
  kind: "gate_driver";
  facts: Record<GateDriverFactId, ReviewedFact>;
}

export type ReviewedRealMotorProfile = ReviewedGateDriverProfile | ReviewedIntegratedBridgeProfile;

export interface ReviewedManufacturer {
  readonly id: string;
  readonly displayName: string;
  readonly primarySourceHosts: readonly string[];
}

export interface ReviewedRealMotorCatalog {
  schemaVersion: "motor-primary-source-tranche.v1alpha2";
  catalogId: "schemagic-motor-a4-primary-tranche";
  provenanceState: "authored_from_primary_sources";
  catalogAdmission: "pending_independent_review";
  retrievedAt: string;
  manufacturers: readonly ReviewedManufacturer[];
  integratedBridges: ReviewedIntegratedBridgeProfile[];
  gateDrivers: ReviewedGateDriverProfile[];
}

export interface MotorFactsV2ExactByteEvidenceBinding {
  sourceId: string;
  contentHash: `sha256:${string}`;
  locator: string;
  retrievedAt: string;
  licenseNote: string;
}

export type MotorFactsV2MandatoryEvidenceCandidate =
  | {
      kind: "text";
      value: string;
    }
  | {
      kind: "maximum_height";
      height: {
        value: number;
        unit: "m";
        displayUnit: "mm";
      };
      basis: "manufacturer_package_maximum_in_surface_mount_orientation";
    };

export type MotorFactsV2MandatoryEvidenceStatus =
  | "source_bound_pending_independent_review"
  | "blocked_missing_bounded_geometry";

/**
 * Exact-byte authoring map for one structurally mandatory facts-V2 path. A
 * non-null candidate remains authored work and is not an independently
 * reviewed profile fact.
 */
export interface MotorFactsV2MandatoryEvidenceEntry {
  targetPath: string;
  status: MotorFactsV2MandatoryEvidenceStatus;
  candidate: MotorFactsV2MandatoryEvidenceCandidate | null;
  exactByteEvidence: readonly MotorFactsV2ExactByteEvidenceBinding[];
  blockingReason: string;
  requiredResolution: string;
}

/**
 * An isolated facts-V2 authoring plan for an exact staged gate-driver MPN.
 * draft stays null until every mandatory path and the complete profile have
 * passed independent evidence review.
 */
export interface MotorFactsV2CandidateProfilePlan {
  sourceProfileId: string;
  partClass: "motor.full-bridge-gate-driver";
  part: ManufacturerPartIdentity;
  targetFactsSchemaVersion: "2.0.0";
  status: "needs_evidence";
  sourceHashComplete: true;
  sourceBoundMandatoryEvidenceCount: number;
  schemaDraftBlockingPaths: readonly string[];
  mandatoryEvidenceMap: readonly MotorFactsV2MandatoryEvidenceEntry[];
  independentReviewState: "pending";
  admissionState: "isolated_not_admitted";
  draft: null;
}

export type MotorFactsV2AuthoringGapCategory =
  | "missing_source"
  | "semantic_mismatch"
  | "geometry"
  | "independent_review";

/**
 * One exhaustive facts-V2 authoring or review gap. Review gaps are deliberately
 * non-blocking for draft authoring; they still block admission.
 */
export interface MotorFactsV2AuthoringGap {
  targetPath: string;
  category: MotorFactsV2AuthoringGapCategory;
  blocksDraftAuthoring: boolean;
  sourceFactId: IntegratedBridgeFactId | GateDriverFactId | null;
  reason: string;
  requiredResolution: string;
  exactByteEvidence: readonly MotorFactsV2ExactByteEvidenceBinding[];
}

export interface MotorFactsV2ProfileAuthoringAssessment {
  sourceProfileId: string;
  partClass: "motor.integrated-h-bridge" | "motor.full-bridge-gate-driver";
  part: ManufacturerPartIdentity;
  targetFactsSchemaVersion: "2.0.0";
  sourceHashComplete: true;
  assessedTargetPaths: readonly string[];
  gaps: readonly MotorFactsV2AuthoringGap[];
  gapCounts: Readonly<Record<MotorFactsV2AuthoringGapCategory, number>>;
  sourceBoundFactCount: number;
  draftAuthorable: false;
  draftAuthoringBlockerCount: number;
  draftAuthoringBlockers: readonly MotorFactsV2AuthoringGap[];
  independentReviewState: "pending";
  admissionState: "isolated_not_admitted";
  draft: null;
}

/**
 * Complete six-profile comparison. Selection identifies the strongest current
 * evidence position only; it cannot imply review, admission, or generator use.
 */
export interface MotorFactsV2DraftAuthoringAssessment {
  evaluatedProfileIds: readonly string[];
  rankedProfileIds: readonly string[];
  selectionPolicy: "fewest_draft_blockers_then_fewest_geometry_gaps_then_fewest_semantic_mismatches_then_fewest_missing_sources_then_most_source_bound_facts_then_ascii_profile_id";
  selectedProfileId: string;
  selectedScore: {
    draftAuthoringBlockerCount: number;
    missingSourceGapCount: number;
    semanticMismatchGapCount: number;
    geometryGapCount: number;
    independentReviewGapCount: number;
    sourceBoundFactCount: number;
  };
  profileAssessments: readonly MotorFactsV2ProfileAuthoringAssessment[];
  authorableProfileCount: 0;
  authorableProfileIds: readonly string[];
  decision: "no_honest_draft";
  independentReviewState: "pending";
  admissionState: "isolated_not_admitted";
  selectedProfileBlockers: readonly MotorFactsV2AuthoringGap[];
  draft: null;
}
