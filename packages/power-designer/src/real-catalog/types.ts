import type { ManufacturerPartIdentity } from "@opencircuit/sourcing-schema";
import type {
  DesignProfileWithFactsV2,
  PowerIntegratedSynchronousBuckFactsV2,
  ProfileUnit,
  QuantityClaimBasisV2,
  QuantityClaimKindV2,
} from "@opencircuit/design-library";

export const REAL_PRIMARY_PART_CLASSES = [
  "power.integrated-synchronous-buck-regulator",
  "power.external-fet-synchronous-buck-controller",
] as const;

export type RealPrimaryPartClass = (typeof REAL_PRIMARY_PART_CLASSES)[number];
export type RealCatalogReviewState = "authored";
export type RealCatalogAdmissionState = "blocked_facts_v2_authoring_review_and_admission";
export type RealEvidenceReviewState = "authored_primary_source_extraction";
export type SourceType = "manufacturer_product_page" | "manufacturer_datasheet";
export type RetrievalMethod = "official_manufacturer_https";
export type PublicationRights = "link_and_factual_extract_only";
export type NumericUnit = "V" | "A" | "Hz" | "s" | "ohm" | "K" | "degC" | "degree";
export type ControlMode = "peak_current_mode" | "current_mode" | "voltage_mode";
export type CompensationMode = "internal" | "external" | "application_dependent";
export type CurrentSenseMechanism =
  | "integrated_switch_current"
  | "external_sense_resistor"
  | "low_side_rds_on_or_shunt"
  | "rsense_or_inductor_dcr";

export interface RealManufacturerIdentity {
  manufacturerId: string;
  displayName: string;
  officialDomains: readonly string[];
}

export interface PrimarySource {
  sourceId: string;
  manufacturerId: string;
  sourceType: SourceType;
  title: string;
  url: string;
  documentId: string | null;
  revision: string | null;
  publicationDate: string | null;
  retrievedAt: string;
  contentHash: SourceContentHash;
  retrievalMethod: RetrievalMethod;
  publicationRights: PublicationRights;
  licenseNote: string;
}

export interface SourceLocator {
  sourceId: string;
  locator: string;
}

export interface VerifiedSourceContentHash {
  state: "verified";
  value: `sha256:${string}`;
  reason: null;
}

export interface MissingSourceContentHash {
  state: "missing";
  value: null;
  reason: string;
}

export type SourceContentHash = VerifiedSourceContentHash | MissingSourceContentHash;

export interface PrimarySourceNumericFact {
  state: "primary_source";
  minimum: number | null;
  typical: number | null;
  maximum: number | null;
  unit: NumericUnit;
  qualification: string | null;
  sourceRefs: readonly SourceLocator[];
}

export interface UnknownNumericFact {
  state: "unknown";
  minimum: null;
  typical: null;
  maximum: null;
  unit: NumericUnit;
  reason: string;
  sourceRefs: readonly [];
}

export type NumericFact = PrimarySourceNumericFact | UnknownNumericFact;

export interface PrimarySourceTextFact<T extends string = string> {
  state: "primary_source";
  value: T;
  qualification: string | null;
  sourceRefs: readonly SourceLocator[];
}

export interface UnknownTextFact {
  state: "unknown";
  value: null;
  reason: string;
  sourceRefs: readonly [];
}

export type TextFact<T extends string = string> = PrimarySourceTextFact<T> | UnknownTextFact;

export interface RealPartIdentity {
  part: ManufacturerPartIdentity;
  manufacturerDisplayName: string;
  sourceRefs: readonly SourceLocator[];
}

export interface RealElectricalFacts {
  inputVoltage: NumericFact;
  outputVoltage: NumericFact;
  maximumOutputCurrent: NumericFact;
  feedbackReference: NumericFact;
  currentLimit: NumericFact;
  currentSenseThreshold: NumericFact;
  currentSenseMechanism: TextFact<CurrentSenseMechanism>;
}

export interface RealTimingFacts {
  switchingFrequency: NumericFact;
  minimumOnTime: NumericFact;
  minimumOffTime: NumericFact;
  softStartTime: NumericFact;
}

export interface RealThermalFacts {
  operatingJunctionTemperature: NumericFact;
  maximumJunctionTemperature: NumericFact;
  thermalShutdownTemperature: NumericFact;
}

export interface RealControlFacts {
  mode: TextFact<ControlMode>;
  compensation: TextFact<CompensationMode>;
  loopCrossoverFrequency: NumericFact;
  phaseMargin: NumericFact;
  stabilityAssessment: UnknownTextFact;
}

export interface RealCommonFacts {
  electrical: RealElectricalFacts;
  timing: RealTimingFacts;
  thermal: RealThermalFacts;
  control: RealControlFacts;
}

export interface IntegratedPowerStageFacts {
  highSideOnResistance: NumericFact;
  lowSideOnResistance: NumericFact;
}

export interface ExternalGateDriveFacts {
  voltage: NumericFact;
  sourceCurrent: NumericFact;
  sinkCurrent: NumericFact;
  deadTime: NumericFact;
}

export interface RealPrimaryProfileBase {
  schemaVersion: "1.0.0";
  profileKind: "real_primary_part_evidence";
  profileId: string;
  displayName: string;
  identity: RealPartIdentity;
  evidenceReviewState: RealEvidenceReviewState;
  manifestReviewState: RealCatalogReviewState;
  admissionState: RealCatalogAdmissionState;
  sources: readonly PrimarySource[];
  facts: RealCommonFacts;
}

export interface RealIntegratedRegulatorProfile extends RealPrimaryProfileBase {
  partClass: "power.integrated-synchronous-buck-regulator";
  integratedPowerStage: IntegratedPowerStageFacts;
}

export interface RealExternalControllerProfile extends RealPrimaryProfileBase {
  partClass: "power.external-fet-synchronous-buck-controller";
  externalGateDrive: ExternalGateDriveFacts;
}

export type RealPrimaryPartProfile = RealIntegratedRegulatorProfile | RealExternalControllerProfile;

export interface RealPrimaryPartCatalog {
  schemaVersion: "1.0.0";
  catalogKind: "real_primary_part_evidence_tranche";
  version: string;
  authoredAt: string;
  manufacturers: readonly RealManufacturerIdentity[];
  profiles: readonly RealPrimaryPartProfile[];
}

export interface CatalogValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface CatalogValidationResult {
  valid: boolean;
  issues: readonly CatalogValidationIssue[];
}

export interface ManifestOwnershipGap {
  code: "missing_exact_mpn_ownership";
  profileId: string;
  requiredManifestEntry: {
    part: ManufacturerPartIdentity;
    part_class_id: RealPrimaryPartClass;
    profile_path: string;
    owning_track: "power";
    review_track: "integration-data-review";
    review_state: "researching" | "authored";
  };
}

export interface ManifestCoverageGap {
  code: string;
  partClass: RealPrimaryPartClass;
  message: string;
}

export interface SourceContentHashGap {
  code: "missing_source_content_hash";
  profileId: string;
  sourceId: string;
  url: string;
  reason: string;
}

export type FactsV2ClaimCandidateStatus =
  | "blocked_missing_source_fact"
  | "blocked_semantic_mismatch"
  | "blocked_unrepresentable_condition"
  | "blocked_unverified_source_bytes"
  | "needs_condition_authoring_and_independent_review"
  | "needs_independent_review";

export interface FactsV2ClaimSourceCandidate {
  path: string;
  valueSlot: "minimum" | "typical" | "maximum";
  value: number | null;
  unit: NumericUnit;
  qualification: string | null;
  sourceRefs: readonly SourceLocator[];
  /** Complete source-stated applicability retained in the closed Power condition grammar. */
  observedConditions: readonly FactsV2CandidateObservedCondition[];
}

/**
 * A deterministic authoring aid, never a reviewed facts-V2 claim. It preserves
 * the source extraction and names the semantic/condition work still required.
 */
export interface FactsV2ClaimCandidate {
  targetPath: `/facts/${string}`;
  targetUnit: ProfileUnit;
  claimKind: QuantityClaimKindV2;
  basis: QuantityClaimBasisV2;
  requiredConditionIds: readonly string[];
  sourceCandidate: FactsV2ClaimSourceCandidate | null;
  status: FactsV2ClaimCandidateStatus;
  reason: string;
}

export interface FactsV2ProfileAuthoringGap {
  code:
    | "facts_v2_profile_not_authored_or_independently_reviewed"
    | "facts_v2_profile_not_independently_reviewed_or_admitted";
  profileId: string;
  partClass: RealPrimaryPartClass;
  targetFactsSchemaVersion: "2.0.0";
  sourceHashComplete: boolean;
  candidateValueCount: number;
  verifiedSourceCandidateValueCount: number;
  independentlyReviewedClaimCount: 0;
  unresolvedPaths: readonly string[];
  claimCandidates: readonly FactsV2ClaimCandidate[];
}

export interface RealCatalogFactsV2ReadinessReport {
  catalogVersion: string;
  profileCount: number;
  factsV2DraftCount: number;
  admissionReadyProfileCount: 0;
  sourceHashCompleteProfileCount: number;
  profileGaps: readonly FactsV2ProfileAuthoringGap[];
}

export interface FactsV2ExactByteEvidenceBinding {
  sourceId: string;
  sourceType: SourceType;
  contentHash: `sha256:${string}`;
  url: string;
  locator: string;
}

export interface FactsV2CandidateDimensionTerm {
  axis: "x" | "y";
  dimensionId: string;
  multiplier: number;
  maximum: {
    value: number;
    unit: "m";
    displayUnit: "mm";
  };
  sourceRefs: readonly SourceLocator[];
}

export interface FactsV2CandidateObservedCondition {
  parameterId: string;
  factsV2ParameterId: string | null;
  minimum: { value: number; unit: "V" | "A" | "K" } | null;
  maximum: { value: number; unit: "V" | "A" | "K" } | null;
  setting: string | null;
  minimumExclusive: boolean;
  maximumExclusive: boolean;
  sourceRefs: readonly SourceLocator[];
}

export interface FactsV2ConfiguredProductionSpreadObservation {
  settingId: string;
  setting: string;
  minimum: { value: number; unit: "V" };
  typical: { value: number; unit: "V" };
  maximum: { value: number; unit: "V" };
  /** Complete applicability set stated by the exact source claim. */
  sourceRequiredConditionIds: readonly string[];
  /** Subset representable by the current closed facts-V2 condition grammar. */
  factsV2RequiredConditionIds: readonly string[];
  observedConditions: readonly FactsV2CandidateObservedCondition[];
}

export type FactsV2MandatoryEvidenceCandidate =
  | {
      kind: "text";
      value: string;
    }
  | {
      kind: "board_area_projection";
      area: {
        value: number;
        unit: "m2";
        displayUnit: "mm2";
      };
      basis: "manufacturer_recommended_land_pattern_bounding_box";
      calculation: "maximum_x_span_times_maximum_y_span";
      sourceDimensions: readonly FactsV2CandidateDimensionTerm[];
    }
  | {
      kind: "maximum_height";
      height: {
        value: number;
        unit: "m";
        displayUnit: "mm";
      };
      basis: "manufacturer_package_maximum_in_surface_mount_orientation";
    }
  | {
      /** A source observation only; this is not a schema-valid configured option. */
      kind: "configured_production_spread_observation";
    } & FactsV2ConfiguredProductionSpreadObservation
  | {
      /** Multiple source observations only; this is not a schema-valid options array. */
      kind: "configured_production_spread_observations";
      options: readonly FactsV2ConfiguredProductionSpreadObservation[];
    };

export type FactsV2MandatoryEvidenceStatus =
  | "source_bound_pending_independent_review"
  | "blocked_missing_profile_evidence"
  | "blocked_unrepresentable_condition";

/**
 * Exact-byte authoring map for one mandatory facts-V2 path. A non-null
 * candidate is still authored work and never implies independent review.
 */
export interface FactsV2MandatoryEvidenceEntry {
  targetPath: string;
  status: FactsV2MandatoryEvidenceStatus;
  candidate: FactsV2MandatoryEvidenceCandidate | null;
  exactByteEvidence: readonly FactsV2ExactByteEvidenceBinding[];
  blockingReason: string;
  requiredResolution: string;
}

export type FactsV2DraftAuthoringBlockerCode =
  | Exclude<FactsV2ClaimCandidateStatus, "needs_independent_review">
  | Exclude<FactsV2MandatoryEvidenceStatus, "source_bound_pending_independent_review">;

/** A current authoring blocker, distinct from independent review still to come. */
export interface FactsV2DraftAuthoringBlocker {
  targetPath: string;
  /** Atomic facts-V2 validation group which owns this blocker. */
  groupPath: string;
  /** Complete, sorted membership of the atomic validation group. */
  groupMemberPaths: readonly string[];
  source: "claim_candidate" | "mandatory_evidence";
  code: FactsV2DraftAuthoringBlockerCode;
  reason: string;
  requiredResolution: string;
  exactByteEvidence: readonly FactsV2ExactByteEvidenceBinding[];
}

export type FactsV2PartialNonAdmittedDraft = DesignProfileWithFactsV2<
  "power.integrated-synchronous-buck-regulator",
  PowerIntegratedSynchronousBuckFactsV2
>;

/**
 * An isolated authoring plan, not a facts-V2 design-profile envelope. The
 * authoritative migration contract requires draft:null until every listed
 * structurally mandatory path has evidence-backed authored data.
 */
export interface FactsV2CandidateProfilePlan {
  sourceProfileId: string;
  partClass: RealPrimaryPartClass;
  part: ManufacturerPartIdentity;
  targetFactsSchemaVersion: "2.0.0";
  status: "needs_evidence" | "partial_non_admitted";
  sourceHashComplete: true;
  sourceBoundClaimCount: number;
  sourceBoundMandatoryEvidenceCount: number;
  schemaDraftBlockingPaths: readonly string[];
  mandatoryEvidenceMap: readonly FactsV2MandatoryEvidenceEntry[];
  draftAuthorable: false;
  draftAuthoringBlockerCount: number;
  draftAuthoringBlockers: readonly FactsV2DraftAuthoringBlocker[];
  admissionUnresolvedPaths: readonly string[];
  /** Exact JSON-pointer membership of explicit unknown facts in a partial draft. */
  draftUnknownPaths: readonly string[];
  draftContentHash: `sha256:${string}` | null;
  independentReviewState: "pending";
  admissionState: "isolated_not_admitted";
  draft: FactsV2PartialNonAdmittedDraft | null;
}

/**
 * Fail-closed result of comparing every exact-byte-bound plan for draft
 * authorability. Selection means strongest evidence only, never admission.
 */
export interface FactsV2DraftAuthoringAssessment {
  evaluatedProfileIds: readonly string[];
  selectionPolicy: "fewest_draft_blockers_then_most_source_bound_claims_then_most_source_bound_mandatory_facts_then_most_candidate_values_then_ascii_profile_id";
  selectedProfileId: string;
  selectedScore: {
    draftAuthoringBlockerCount: number;
    sourceBoundClaimCount: number;
    sourceBoundMandatoryEvidenceCount: number;
    candidateValueCount: number;
  };
  authorableProfileCount: 0;
  authorableProfileIds: readonly string[];
  decision: "no_honest_draft" | "partial_non_admitted_draft";
  independentReviewState: "pending";
  admissionState: "isolated_not_admitted";
  selectedProfileBlockers: readonly FactsV2DraftAuthoringBlocker[];
  draftUnknownPaths: readonly string[];
  draftContentHash: `sha256:${string}` | null;
  draft: FactsV2PartialNonAdmittedDraft | null;
}

export type FactsV2ReviewedReleaseReconciliationFailure =
  | "staged_catalog_invalid"
  | "source_profile_identity_mismatch"
  | "staged_facts_v2_assessment_mismatch"
  | "reviewed_release_documents_invalid"
  | "released_profile_reference_mismatch"
  | "released_profile_bytes_mismatch"
  | "reviewed_admission_mismatch"
  | "catalog_runtime_version_mismatch"
  | "installed_recipe_identity_mismatch"
  | "recipe_not_production_ready";

/**
 * Closed scope for retiring one staged facts-V2 admission blocker through an
 * independently reviewed additive release. This never promotes or rewrites the
 * staged facts-V2 authoring assessment.
 */
export interface FactsV2ReviewedReleaseReconciliationScope {
  claim: "exact_reviewed_release_production_enumeration_only";
  stagedAssessment: "retained_not_promoted";
  versionPolicy: "additive_exact_version_match";
  sourceProfileId: string;
  partClass: RealPrimaryPartClass;
  part: ManufacturerPartIdentity;
  stagedFactsSchemaVersion: "2.0.0";
  releasedFactsSchemaVersion: "3.3.0";
  releasedProfileId: string;
  releasedProfilePath: string;
  releasedProfileContentHash: `sha256:${string}`;
  recipe: {
    id: string;
    version: string;
    contentHash: `sha256:${string}`;
  };
}

export interface FactsV2ReviewedReleaseReconciliationEvidence {
  catalogReleaseVersion: string;
  releasedProfile: {
    profileId: string;
    profilePath: string;
    profileContentHash: `sha256:${string}`;
    factsSchemaVersion: "3.3.0";
  };
  admission: {
    state: "reviewed";
    ownerTrack: "power";
    reviewerTrack: "integration-data-review";
    profileContentHash: `sha256:${string}`;
    independentlyReviewed: true;
    allChecksPass: true;
  };
  recipe: {
    id: string;
    version: string;
    contentHash: `sha256:${string}`;
    ready: true;
    requiredFactsSchemaVersion: "3.3.0";
  };
}

export interface FactsV2ReviewedReleaseReconciliation {
  status: "reconciled" | "blocked";
  scope: FactsV2ReviewedReleaseReconciliationScope;
  failures: readonly FactsV2ReviewedReleaseReconciliationFailure[];
  evidence: FactsV2ReviewedReleaseReconciliationEvidence | null;
}

export interface RealCatalogAdmissionGapReport {
  catalogVersion: string;
  profileCount: number;
  manufacturerCount: number;
  profilesByPartClass: Readonly<Record<RealPrimaryPartClass, number>>;
  manufacturersByPartClass: Readonly<Record<RealPrimaryPartClass, number>>;
  admissionEligibleProfileCount: number;
  admissionBlockerCount: number;
  /** Complete staged assessment set, including assessments reconciled below. */
  factsV2AuthoringAssessments: readonly FactsV2ProfileAuthoringGap[];
  factsV2ReviewedReleaseReconciliations: readonly FactsV2ReviewedReleaseReconciliation[];
  admissionBlockers: {
    missingExactMpnOwnership: readonly ManifestOwnershipGap[];
    missingSourceContentHashes: readonly SourceContentHashGap[];
    factsV2ProfileAuthoring: readonly FactsV2ProfileAuthoringGap[];
  };
  coverageGaps: readonly ManifestCoverageGap[];
}
