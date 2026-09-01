import {
  compareAscii,
  designProfileEnvelopeContentHash,
  getBundledDesignLibraryDocuments,
  validateDesignLibraryEnvelope,
  validateDesignProfileEnvelope,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileEnvelope,
  type ManufacturerRegistryV1,
} from "@opencircuit/design-library";
import type { DesignRecipeRefV2 } from "@opencircuit/design-engine";
import {
  buildReviewedProfileCatalogV2,
  getInstalledPowerRecipeRefsV2,
} from "@opencircuit/design-engine/v2-power-runtime";
import {
  assessPowerDesignV2ProductionReadiness,
  type PowerDesignV2ProductionStatus,
} from "../v2-readiness";
import { REAL_PRIMARY_PART_CATALOG } from "./profiles";
import { buildRealCatalogFactsV2ReadinessReport } from "./facts-v2-readiness";
import { validateRealPrimaryPartCatalog } from "./validation";
import type {
  FactsV2ReviewedReleaseReconciliation,
  FactsV2ReviewedReleaseReconciliationFailure,
  FactsV2ReviewedReleaseReconciliationScope,
  ManifestCoverageGap,
  ManifestOwnershipGap,
  RealCatalogAdmissionGapReport,
  RealCatalogFactsV2ReadinessReport,
  RealPrimaryPartCatalog,
  RealPrimaryPartClass,
  RealPrimaryPartProfile,
  SourceContentHashGap,
} from "./types";

const INTEGRATED_CLASS = "power.integrated-synchronous-buck-regulator";
const CONTROLLER_CLASS = "power.external-fet-synchronous-buck-controller";
const TPS54302_PROFILE_ID = "real.texas-instruments.tps54302ddcr";
const TPS54302_PROFILE_PATH = "packages/design-library/parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json";
const TPS54302_PROFILE_CONTENT_HASH = "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c";
const TPS54302_RECIPE_ID = "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified";
const TPS54302_RECIPE_VERSION = "3.4.6";
const TPS54302_RECIPE_CONTENT_HASH = "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c";
const REQUIRED_REVIEW_CHECKS = Object.freeze([
  "class.power.integrated-synchronous-buck-regulator.facts_semantics",
  "contract.closed_profile",
  "contract.commercial_boundary",
  "contract.identity_path",
  "contract.profile_content_hash",
  "evidence.primary",
  "facts.reviewed_and_conditioned",
  "review.independent",
] as const);

export interface BuildRealCatalogAdmissionGapReportOptions {
  readonly catalog?: Readonly<RealPrimaryPartCatalog>;
  readonly documents?: Readonly<DesignLibraryDocuments>;
  readonly installedPowerRecipeRefs?: readonly DesignRecipeRefV2[];
}

const TPS54302_RECONCILIATION_SCOPE: Readonly<FactsV2ReviewedReleaseReconciliationScope> = Object.freeze({
  claim: "exact_reviewed_release_production_enumeration_only",
  stagedAssessment: "retained_not_promoted",
  versionPolicy: "additive_exact_version_match",
  sourceProfileId: TPS54302_PROFILE_ID,
  partClass: INTEGRATED_CLASS,
  part: Object.freeze({
    manufacturerId: "texas-instruments",
    manufacturerPartNumber: "TPS54302DDCR",
  }),
  stagedFactsSchemaVersion: "2.0.0",
  releasedFactsSchemaVersion: "3.3.0",
  releasedProfileId: TPS54302_PROFILE_PATH,
  releasedProfilePath: TPS54302_PROFILE_PATH,
  releasedProfileContentHash: TPS54302_PROFILE_CONTENT_HASH,
  recipe: Object.freeze({
    id: TPS54302_RECIPE_ID,
    version: TPS54302_RECIPE_VERSION,
    contentHash: TPS54302_RECIPE_CONTENT_HASH,
  }),
});

function samePart(
  left: Readonly<{ manufacturerId: string; manufacturerPartNumber: string }> | undefined,
  right: Readonly<{ manufacturerId: string; manufacturerPartNumber: string }>,
): boolean {
  return left?.manufacturerId === right.manufacturerId
    && left.manufacturerPartNumber === right.manufacturerPartNumber;
}

function hasCompleteExactReadinessMembership(
  catalog: Readonly<RealPrimaryPartCatalog>,
  readiness: Readonly<RealCatalogFactsV2ReadinessReport>,
): boolean {
  const profileIds = catalog.profiles.map((profile) => profile.profileId).sort(compareAscii);
  const assessedProfileIds = readiness.profileGaps.map((gap) => gap.profileId).sort(compareAscii);
  return readiness.catalogVersion === catalog.version
    && readiness.profileCount === catalog.profiles.length
    && readiness.profileGaps.length === catalog.profiles.length
    && new Set(profileIds).size === profileIds.length
    && new Set(assessedProfileIds).size === assessedProfileIds.length
    && profileIds.every((profileId, index) => profileId === assessedProfileIds[index]);
}

function derivePowerProductionStatus(
  documents: Readonly<DesignLibraryDocuments>,
  installedRecipeRefs: readonly DesignRecipeRefV2[],
): Readonly<PowerDesignV2ProductionStatus> | null {
  try {
    return assessPowerDesignV2ProductionReadiness(
      buildReviewedProfileCatalogV2(documents),
      installedRecipeRefs,
    );
  } catch {
    return null;
  }
}

function reconcileTps54302ReviewedRelease(
  catalog: Readonly<RealPrimaryPartCatalog>,
  readiness: Readonly<RealCatalogFactsV2ReadinessReport>,
  documents: Readonly<DesignLibraryDocuments>,
  installedRecipeRefs: readonly DesignRecipeRefV2[],
  productionStatus: Readonly<PowerDesignV2ProductionStatus> | null,
): FactsV2ReviewedReleaseReconciliation {
  const failures = new Set<FactsV2ReviewedReleaseReconciliationFailure>();
  if (!validateRealPrimaryPartCatalog(catalog).valid) failures.add("staged_catalog_invalid");
  const sourceProfiles = catalog.profiles.filter((profile) => profile.profileId === TPS54302_PROFILE_ID);
  const sourceProfile = sourceProfiles.length === 1 ? sourceProfiles[0] : undefined;
  if (
    sourceProfiles.length !== 1
    || sourceProfile?.partClass !== TPS54302_RECONCILIATION_SCOPE.partClass
    || !samePart(sourceProfile?.identity.part, TPS54302_RECONCILIATION_SCOPE.part)
  ) {
    failures.add("source_profile_identity_mismatch");
  }

  const stagedAssessments = readiness.profileGaps.filter((gap) => gap.profileId === TPS54302_PROFILE_ID);
  const stagedAssessment = stagedAssessments.length === 1 ? stagedAssessments[0] : undefined;
  if (
    !hasCompleteExactReadinessMembership(catalog, readiness)
    || stagedAssessments.length !== 1
    || stagedAssessment?.partClass !== TPS54302_RECONCILIATION_SCOPE.partClass
    || stagedAssessment.targetFactsSchemaVersion !== TPS54302_RECONCILIATION_SCOPE.stagedFactsSchemaVersion
    || stagedAssessment.code !== "facts_v2_profile_not_independently_reviewed_or_admitted"
    || !stagedAssessment.sourceHashComplete
    || stagedAssessment.independentlyReviewedClaimCount !== 0
  ) {
    failures.add("staged_facts_v2_assessment_mismatch");
  }

  if (validateDesignLibraryEnvelope(documents as DesignLibraryDocuments).length > 0) {
    failures.add("reviewed_release_documents_invalid");
  }

  const release = documents.catalogRelease as DesignCatalogReleaseV1;
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  const releasedRefs = Array.isArray(release?.profiles)
    ? release.profiles.filter((entry) =>
        entry.profileId === TPS54302_RECONCILIATION_SCOPE.releasedProfileId
        && entry.profilePath === TPS54302_RECONCILIATION_SCOPE.releasedProfilePath
      )
    : [];
  const releasedRef = releasedRefs.length === 1 ? releasedRefs[0] : undefined;
  if (
    releasedRefs.length !== 1
    || releasedRef === undefined
    || releasedRef.partClass !== TPS54302_RECONCILIATION_SCOPE.partClass
    || !samePart(releasedRef.part, TPS54302_RECONCILIATION_SCOPE.part)
    || releasedRef.profileContentHash !== TPS54302_RECONCILIATION_SCOPE.releasedProfileContentHash
  ) {
    failures.add("released_profile_reference_mismatch");
  }

  const rawProfile = documents.profiles[TPS54302_RECONCILIATION_SCOPE.releasedProfilePath];
  let profileHash: `sha256:${string}` | null = null;
  if (
    rawProfile === undefined
    || validateDesignProfileEnvelope(rawProfile, documents.manufacturerRegistry as ManufacturerRegistryV1).length > 0
  ) {
    failures.add("released_profile_bytes_mismatch");
  } else {
    const profile = rawProfile as DesignProfileEnvelope;
    profileHash = designProfileEnvelopeContentHash(profile);
    if (
      profile.partClass !== TPS54302_RECONCILIATION_SCOPE.partClass
      || !samePart(profile.part, TPS54302_RECONCILIATION_SCOPE.part)
      || profile.factsSchemaVersion !== TPS54302_RECONCILIATION_SCOPE.releasedFactsSchemaVersion
      || profileHash !== TPS54302_RECONCILIATION_SCOPE.releasedProfileContentHash
      || releasedRef?.profileContentHash !== profileHash
    ) {
      failures.add("released_profile_bytes_mismatch");
    }
  }

  const admissionEntries = Array.isArray(admission?.entries)
    ? admission.entries.filter((entry) => entry.profilePath === TPS54302_RECONCILIATION_SCOPE.releasedProfilePath)
    : [];
  const admissionEntry = admissionEntries.length === 1 ? admissionEntries[0] : undefined;
  const passedChecks = new Set(admissionEntry?.checks
    .filter((check) => check.status === "pass")
    .map((check) => check.checkId) ?? []);
  if (
    admissionEntries.length !== 1
    || admissionEntry === undefined
    || admissionEntry.state !== "reviewed"
    || admissionEntry.ownerTrack !== "power"
    || admissionEntry.reviewerTrack !== "integration-data-review"
    || admissionEntry.partClass !== TPS54302_RECONCILIATION_SCOPE.partClass
    || !samePart(admissionEntry.part, TPS54302_RECONCILIATION_SCOPE.part)
    || admissionEntry.profileContentHash === null
    || admissionEntry.profileContentHash !== TPS54302_RECONCILIATION_SCOPE.releasedProfileContentHash
    || admissionEntry.profileContentHash !== releasedRef?.profileContentHash
    || admissionEntry.profileContentHash !== profileHash
    || admissionEntry.authoredBy === null
    || admissionEntry.reviewedBy === null
    || admissionEntry.authoredBy === admissionEntry.reviewedBy
    || admissionEntry.authoredAt === null
    || admissionEntry.reviewedAt === null
    || admissionEntry.checks.length !== passedChecks.size
    || !REQUIRED_REVIEW_CHECKS.every((checkId) => passedChecks.has(checkId))
  ) {
    failures.add("reviewed_admission_mismatch");
  }

  if (productionStatus === null || release?.version !== productionStatus.catalogVersion) {
    failures.add("catalog_runtime_version_mismatch");
  }

  const installedRecipes = installedRecipeRefs.filter((recipe) =>
    recipe.id === TPS54302_RECIPE_ID && recipe.version === TPS54302_RECIPE_VERSION
  );
  const installedRecipe = installedRecipes.length === 1 ? installedRecipes[0] : undefined;
  if (
    installedRecipes.length !== 1
    || installedRecipe?.contentHash !== TPS54302_RECIPE_CONTENT_HASH
    || installedRecipe.applications.length !== 1
    || installedRecipe.applications[0] !== "power.buck"
  ) {
    failures.add("installed_recipe_identity_mismatch");
  }

  const recipeReadinessMatches = productionStatus?.recipeReadiness.filter((recipe) =>
    recipe.recipeId === TPS54302_RECIPE_ID && recipe.recipeVersion === TPS54302_RECIPE_VERSION
  ) ?? [];
  const recipeReadiness = recipeReadinessMatches.length === 1 ? recipeReadinessMatches[0] : undefined;
  const primaryRequirements = recipeReadiness?.profileRequirements.filter((requirement) =>
    requirement.partClass === INTEGRATED_CLASS
  ) ?? [];
  const primaryRequirement = primaryRequirements.length === 1 ? primaryRequirements[0] : undefined;
  if (
    productionStatus === null
    || productionStatus.status !== "ready"
    || !productionStatus.installedRecipeSet
    || productionStatus.readyRecipeIds.filter((recipeId) => recipeId === TPS54302_RECIPE_ID).length !== 1
    || recipeReadinessMatches.length !== 1
    || recipeReadiness?.recognizedContract !== true
    || recipeReadiness.releaseEligible !== true
    || recipeReadiness.ready !== true
    || primaryRequirements.length !== 1
    || primaryRequirement?.factsSchemaVersion !== TPS54302_RECONCILIATION_SCOPE.releasedFactsSchemaVersion
    || primaryRequirement.reviewedProfileCount < 1
  ) {
    failures.add("recipe_not_production_ready");
  }

  const sortedFailures = [...failures].sort();
  if (
    sortedFailures.length > 0
    || releasedRef === undefined
    || admissionEntry === undefined
    || admissionEntry.profileContentHash === null
    || installedRecipe === undefined
    || profileHash === null
  ) {
    return {
      status: "blocked",
      scope: TPS54302_RECONCILIATION_SCOPE,
      failures: sortedFailures,
      evidence: null,
    };
  }

  return {
    status: "reconciled",
    scope: TPS54302_RECONCILIATION_SCOPE,
    failures: [],
    evidence: {
      catalogReleaseVersion: release.version,
      releasedProfile: {
        profileId: releasedRef.profileId,
        profilePath: releasedRef.profilePath,
        profileContentHash: releasedRef.profileContentHash,
        factsSchemaVersion: "3.3.0",
      },
      admission: {
        state: "reviewed",
        ownerTrack: "power",
        reviewerTrack: "integration-data-review",
        profileContentHash: admissionEntry.profileContentHash,
        independentlyReviewed: true,
        allChecksPass: true,
      },
      recipe: {
        id: installedRecipe.id,
        version: installedRecipe.version,
        contentHash: installedRecipe.contentHash,
        ready: true,
        requiredFactsSchemaVersion: "3.3.0",
      },
    },
  };
}

export function encodeExactMpnPathToken(mpn: string): string {
  return Array.from(new TextEncoder().encode(mpn), (byte) => {
    const isAllowedAscii =
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a) ||
      (byte >= 0x30 && byte <= 0x39) ||
      byte === 0x5f ||
      byte === 0x2d;
    return isAllowedAscii ? String.fromCharCode(byte) : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }).join("");
}

function ownershipGap(
  profile: RealPrimaryPartProfile,
  bundledProfiles: Readonly<Record<string, unknown>>,
): ManifestOwnershipGap {
  const part = profile.identity.part;
  const profilePath = `packages/design-library/parts/${profile.partClass}/${part.manufacturerId}/${encodeExactMpnPathToken(part.manufacturerPartNumber)}.json`;
  return {
    code: "missing_exact_mpn_ownership",
    profileId: profile.profileId,
    requiredManifestEntry: {
      part,
      part_class_id: profile.partClass,
      profile_path: profilePath,
      owning_track: "power",
      review_track: "integration-data-review",
      review_state: Object.prototype.hasOwnProperty.call(bundledProfiles, profilePath) ? "authored" : "researching",
    },
  };
}

function hasExactOwnership(
  profile: RealPrimaryPartProfile,
  admission: DesignProfileAdmissionLedgerV1,
  bundledProfiles: Readonly<Record<string, unknown>>,
): boolean {
  const expected = ownershipGap(profile, bundledProfiles).requiredManifestEntry;
  const hasMaterializedProfile = Object.prototype.hasOwnProperty.call(bundledProfiles, expected.profile_path);
  return admission.entries.some((entry) =>
    entry.partClass === expected.part_class_id
    && entry.part.manufacturerId === expected.part.manufacturerId
    && entry.part.manufacturerPartNumber === expected.part.manufacturerPartNumber
    && entry.profilePath === expected.profile_path
    && entry.ownerTrack === expected.owning_track
    && entry.reviewerTrack === expected.review_track
    && (hasMaterializedProfile
      ? entry.state === "authored" || entry.state === "reviewed"
      : entry.state === expected.review_state)
  );
}

function sourceContentHashGaps(profiles: readonly RealPrimaryPartProfile[]): SourceContentHashGap[] {
  return profiles.flatMap((profile) => profile.sources.flatMap((source) =>
    source.contentHash.state === "missing"
      ? [{
          code: "missing_source_content_hash" as const,
          profileId: profile.profileId,
          sourceId: source.sourceId,
          url: source.url,
          reason: source.contentHash.reason,
        }]
      : []
  ));
}

function authoredIntegratedMaximum(
  profiles: readonly RealPrimaryPartProfile[],
  factForProfile: (profile: Extract<RealPrimaryPartProfile, { partClass: typeof INTEGRATED_CLASS }>) => RealPrimaryPartProfile["facts"]["electrical"]["inputVoltage"],
  unit: "V" | "A",
): number | null {
  const maxima = profiles.flatMap((profile) => {
    if (profile.partClass !== INTEGRATED_CLASS) return [];
    const fact = factForProfile(profile);
    return fact.state === "primary_source"
      && fact.unit === unit
      && fact.maximum !== null
      && Number.isFinite(fact.maximum)
      ? [fact.maximum]
      : [];
  });
  return maxima.length === 0 ? null : Math.max(...maxima);
}

function coverageGaps(
  profilesByPartClass: Readonly<Record<RealPrimaryPartClass, number>>,
  manufacturersByPartClass: Readonly<Record<RealPrimaryPartClass, number>>,
  profiles: readonly RealPrimaryPartProfile[],
): ManifestCoverageGap[] {
  const integratedInputMaximumV = authoredIntegratedMaximum(profiles, (profile) => profile.facts.electrical.inputVoltage, "V");
  const integratedOutputMaximumV = authoredIntegratedMaximum(profiles, (profile) => profile.facts.electrical.outputVoltage, "V");
  const integratedOutputCurrentMaximumA = authoredIntegratedMaximum(profiles, (profile) => profile.facts.electrical.maximumOutputCurrent, "A");
  const integratedInputCoverageGaps: ManifestCoverageGap[] = integratedInputMaximumV === null || integratedInputMaximumV < 60
    ? [{
        code: "integrated_input_envelope_incomplete",
        partClass: INTEGRATED_CLASS,
        message: integratedInputMaximumV === null
          ? "No authored primary-source maximum input-voltage bound covers the 60 V end of the Power V1 envelope."
          : `Authored primary-source extractions reach ${integratedInputMaximumV} V maximum input; the 60 V end of the Power V1 envelope is not covered.`,
      }]
    : [];
  const integratedOutputCoverageGaps: ManifestCoverageGap[] = integratedOutputMaximumV === null || integratedOutputMaximumV < 24
    ? [{
        code: "integrated_output_envelope_incomplete",
        partClass: INTEGRATED_CLASS,
        message: integratedOutputMaximumV === null
          ? "No authored primary-source maximum output-voltage bound covers the 24 V end of the Power V1 envelope."
          : `Authored primary-source extractions reach ${integratedOutputMaximumV} V maximum output; the 24 V end of the Power V1 envelope is not covered.`,
      }]
    : [];
  const integratedCurrentCoverageGaps: ManifestCoverageGap[] = integratedOutputCurrentMaximumA === null || integratedOutputCurrentMaximumA < 10
    ? [{
        code: "integrated_current_envelope_incomplete",
        partClass: INTEGRATED_CLASS,
        message: integratedOutputCurrentMaximumA === null
          ? "No authored primary-source maximum continuous-output-current bound covers the 10 A end of the Power V1 envelope."
          : `Authored primary-source extractions reach ${integratedOutputCurrentMaximumA} A continuous output; the 10 A end of the Power V1 envelope is not covered.`,
      }]
    : [];
  return [
    {
      code: "integrated_profile_count_below_manifest_target",
      partClass: INTEGRATED_CLASS,
      message: `${profilesByPartClass[INTEGRATED_CLASS]} authored profiles; manifest target is 12 (${Math.max(0, 12 - profilesByPartClass[INTEGRATED_CLASS])} remain).`,
    },
    ...integratedInputCoverageGaps,
    ...integratedOutputCoverageGaps,
    ...integratedCurrentCoverageGaps,
    {
      code: "controller_profile_count_below_manifest_target",
      partClass: CONTROLLER_CLASS,
      message: `${profilesByPartClass[CONTROLLER_CLASS]} authored profiles; manifest target is 6 (${Math.max(0, 6 - profilesByPartClass[CONTROLLER_CLASS])} remain).`,
    },
    {
      code: "controller_manufacturer_count_below_manifest_target",
      partClass: CONTROLLER_CLASS,
      message: `${manufacturersByPartClass[CONTROLLER_CLASS]} manufacturers represented; manifest target is 3 (${Math.max(0, 3 - manufacturersByPartClass[CONTROLLER_CLASS])} remain).`,
    },
    {
      code: "controller_stability_evidence_unavailable",
      partClass: CONTROLLER_CLASS,
      message: "Part-only evidence cannot establish application-specific loop crossover, phase margin, or stability; all such facts remain unknown.",
    },
  ];
}

export function buildRealCatalogAdmissionGapReport(
  options: Readonly<BuildRealCatalogAdmissionGapReportOptions> = {},
): RealCatalogAdmissionGapReport {
  const catalog = options.catalog ?? REAL_PRIMARY_PART_CATALOG;
  const profilesByPartClass: Record<RealPrimaryPartClass, number> = {
    [INTEGRATED_CLASS]: 0,
    [CONTROLLER_CLASS]: 0,
  };
  const manufacturerSets: Record<RealPrimaryPartClass, Set<string>> = {
    [INTEGRATED_CLASS]: new Set<string>(),
    [CONTROLLER_CLASS]: new Set<string>(),
  };

  for (const profile of catalog.profiles) {
    profilesByPartClass[profile.partClass] += 1;
    manufacturerSets[profile.partClass].add(profile.identity.part.manufacturerId);
  }

  const manufacturersByPartClass: Record<RealPrimaryPartClass, number> = {
    [INTEGRATED_CLASS]: manufacturerSets[INTEGRATED_CLASS].size,
    [CONTROLLER_CLASS]: manufacturerSets[CONTROLLER_CLASS].size,
  };
  const bundledDocuments = options.documents ?? getBundledDesignLibraryDocuments();
  const rawAdmission = bundledDocuments.admission as Partial<DesignProfileAdmissionLedgerV1>;
  const admission = (Array.isArray(rawAdmission?.entries)
    ? rawAdmission
    : { entries: [] }) as DesignProfileAdmissionLedgerV1;
  const missingExactMpnOwnership = catalog.profiles
    .filter((profile) => !hasExactOwnership(profile, admission, bundledDocuments.profiles))
    .map((profile) => ownershipGap(profile, bundledDocuments.profiles));
  const missingSourceContentHashes = sourceContentHashGaps(catalog.profiles);
  const factsV2Readiness = buildRealCatalogFactsV2ReadinessReport(
    catalog as RealPrimaryPartCatalog,
    bundledDocuments.profiles,
  );
  const installedRecipeRefs = options.installedPowerRecipeRefs ?? getInstalledPowerRecipeRefsV2();
  const productionStatus = derivePowerProductionStatus(bundledDocuments, installedRecipeRefs);
  const reconciliation = reconcileTps54302ReviewedRelease(
    catalog,
    factsV2Readiness,
    bundledDocuments,
    installedRecipeRefs,
    productionStatus,
  );
  const reconciledProfileIds = new Set(reconciliation.status === "reconciled"
    ? [reconciliation.scope.sourceProfileId]
    : []);
  const factsV2ProfileAuthoring = factsV2Readiness.profileGaps
    .filter((gap) => !reconciledProfileIds.has(gap.profileId));

  return {
    catalogVersion: catalog.version,
    profileCount: catalog.profiles.length,
    manufacturerCount: new Set(catalog.profiles.map((profile) => profile.identity.part.manufacturerId)).size,
    profilesByPartClass,
    manufacturersByPartClass,
    admissionEligibleProfileCount: reconciledProfileIds.size,
    admissionBlockerCount: missingExactMpnOwnership.length + missingSourceContentHashes.length + factsV2ProfileAuthoring.length,
    factsV2AuthoringAssessments: factsV2Readiness.profileGaps,
    factsV2ReviewedReleaseReconciliations: [reconciliation],
    admissionBlockers: {
      missingExactMpnOwnership,
      missingSourceContentHashes,
      factsV2ProfileAuthoring,
    },
    coverageGaps: coverageGaps(profilesByPartClass, manufacturersByPartClass, catalog.profiles),
  };
}

export const REAL_PRIMARY_PART_ADMISSION_GAP_REPORT = buildRealCatalogAdmissionGapReport();
