import { compareAscii, contentHash, detachedJsonSnapshot } from "./canonical";
import { designProfilePath } from "./path";
import {
  admissionContentHash,
  assertValidDesignCatalogRelease,
  assertValidDesignProfileAdmission,
  assertValidManufacturerRegistry,
  designCatalogContentHash,
  designProfileContentHash,
  manufacturerRegistryContentHash,
  parseDesignProfile,
  reviewedAdmissionProjection,
  requiredAdmissionCheckIds,
  validateCommercialDataBoundary,
  validateDesignCatalogRelease,
  validateDesignProfile,
  validateDesignProfileAdmission,
  validateFactsForCodec,
  validateManufacturerRegistry,
  validateProfileAdmissionRules,
} from "./validation";
import {
  canonicalDesignProfileEnvelope,
  designProfileEnvelopeContentHash,
  parseDesignProfileEnvelope,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
} from "./v2-validation";
import type {
  AdmissionCheckV1,
  DesignCatalogReleaseV1,
  DesignLibraryDocuments,
  DesignProfileAdmissionEntryV1,
  DesignProfileAdmissionLedgerV1,
  DesignProfileV1,
  ManufacturerRegistryV1,
  ProfileEvidenceRef,
  ProfileFact,
  ReviewedDesignLibrary,
  ValidationIssue,
} from "./types";
import { FACTS_SCHEMA_VERSION_V2, type DesignProfileEnvelope, type ReviewedDesignLibraryEnvelope } from "./v2-types";
import { FACTS_SCHEMA_VERSION_V3, type DesignProfileV3 } from "./v3-types";
import { FACTS_SCHEMA_VERSION_V31, type DesignProfileV31 } from "./v31-types";
import { FACTS_SCHEMA_VERSION_V32, type DesignProfileV32 } from "./v32-types";
import { FACTS_SCHEMA_VERSION_V33, type DesignProfileV33 } from "./v33-types";
import { FACTS_SCHEMA_VERSION_V34, type DesignProfileV34 } from "./v34-types";
import { FACTS_SCHEMA_VERSION_V35, type DesignProfileV35 } from "./v35-types";
import { validateProfileAdmissionRulesV35, validateProfileSemanticsV35 } from "./v35-validation";
import {
  validateProfileAdmissionRulesV3,
  validateProfileAdmissionRulesV31,
  validateProfileSemanticsV3,
  validateProfileSemanticsV31,
} from "./v3-validation";
import {
  validateProfileAdmissionRulesV32,
  validateProfileSemanticsV32,
} from "./v32-validation";
import {
  validateProfileAdmissionRulesV33,
  validateProfileSemanticsV33,
} from "./v33-validation";
import {
  validateProfileAdmissionRulesV34,
  validateProfileSemanticsV34,
} from "./v34-validation";
import { DescriptorSafeJsonSnapshotError, descriptorSafeJsonSnapshot } from "./data-snapshot";

const FILE_REQUIRED_STATES = new Set(["authored", "in_independent_review", "reviewed"]);

function samePart(left: { manufacturerId: string; manufacturerPartNumber: string }, right: { manufacturerId: string; manufacturerPartNumber: string }): boolean {
  return left.manufacturerId === right.manufacturerId && left.manufacturerPartNumber === right.manufacturerPartNumber;
}

function isPartIdentity(value: unknown): value is { manufacturerId: string; manufacturerPartNumber: string } {
  return typeof value === "object" && value !== null
    && typeof (value as { manufacturerId?: unknown }).manufacturerId === "string"
    && typeof (value as { manufacturerPartNumber?: unknown }).manufacturerPartNumber === "string";
}

function profileDocument(documents: DesignLibraryDocuments, profilePath: string): unknown {
  return Object.prototype.hasOwnProperty.call(documents.profiles, profilePath) ? documents.profiles[profilePath] : undefined;
}

function profileEvidence(profile: DesignProfileV1): Array<{ path: string; evidence: ProfileEvidenceRef }> {
  const result: Array<{ path: string; evidence: ProfileEvidenceRef }> = [];
  const collect = (fact: ProfileFact<unknown>, path: string): void => {
    fact.evidence.forEach((evidence, index) => result.push({ path: `${path}.evidence.${index}`, evidence }));
    fact.validFor.forEach((range, rangeIndex) => range.evidence.forEach((evidence, evidenceIndex) => result.push({ path: `${path}.validFor.${rangeIndex}.evidence.${evidenceIndex}`, evidence })));
  };
  Object.entries(profile.commonFacts).forEach(([factId, fact]) => collect(fact, `commonFacts.${factId}`));
  Object.entries(profile.facts as Record<string, ProfileFact<unknown>>).forEach(([factId, fact]) => collect(fact, `facts.${factId}`));
  return result;
}

function profileEnvelopeEvidence(profile: DesignProfileEnvelope): Array<{ path: string; evidence: ProfileEvidenceRef }> {
  if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V2 && profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V3 && profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V31 && profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V32 && profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V33 && profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V34 && profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V35) return profileEvidence(profile);
  const result: Array<{ path: string; evidence: ProfileEvidenceRef }> = [];
  const collect = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => collect(entry, path ? `${path}.${index}` : String(index)));
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const object = value as Record<string, unknown>;
    if ("kind" in object && "sourceId" in object && "locator" in object && "licenseNote" in object) {
      result.push({ path, evidence: value as ProfileEvidenceRef });
      return;
    }
    for (const [key, entry] of Object.entries(object)) collect(entry, path ? `${path}.${key}` : key);
  };
  collect(profile, "");
  return result;
}

function validateEnvelopeAdmissionRules(profile: DesignProfileEnvelope): ValidationIssue[] {
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V2) return validateProfileAdmissionRulesV2(profile);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V3) return validateProfileAdmissionRulesV3(profile);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V31) return validateProfileAdmissionRulesV31(profile);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V32) return validateProfileAdmissionRulesV32(profile);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V33) return validateProfileAdmissionRulesV33(profile);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V34) return validateProfileAdmissionRulesV34(profile);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V35) return validateProfileAdmissionRulesV35(profile as DesignProfileV35);
  return validateProfileAdmissionRules(profile);
}

function validateEnvelopeClassSemantics(
  profile: DesignProfileEnvelope,
  manufacturer: ManufacturerRegistryV1["manufacturers"][number] | undefined,
): ValidationIssue[] {
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V2) return [];
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V3) return validateProfileSemanticsV3(profile as DesignProfileV3);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V31) return validateProfileSemanticsV31(profile as DesignProfileV31);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V32) return validateProfileSemanticsV32(profile as DesignProfileV32);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V33) return validateProfileSemanticsV33(profile as DesignProfileV33);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V34) return validateProfileSemanticsV34(profile as DesignProfileV34);
  if (profile.factsSchemaVersion === FACTS_SCHEMA_VERSION_V35) return validateProfileSemanticsV35(profile as DesignProfileV35);
  return validateFactsForCodec(profile.facts, profile.partClass, manufacturer);
}

function prefixed(prefix: string, issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.map((entry) => ({ ...entry, path: entry.path ? `${prefix}.${entry.path}` : prefix }));
}

interface ParsedDocuments {
  registry: ManufacturerRegistryV1;
  admission: DesignProfileAdmissionLedgerV1;
  release: DesignCatalogReleaseV1;
}

function structurallyParse(documents: DesignLibraryDocuments, issues: ValidationIssue[]): ParsedDocuments | undefined {
  const registryIssues = validateManufacturerRegistry(documents.manufacturerRegistry);
  const admissionIssues = validateDesignProfileAdmission(documents.admission);
  const releaseIssues = validateDesignCatalogRelease(documents.catalogRelease);
  issues.push(...prefixed("manufacturerRegistry", registryIssues), ...prefixed("admission", admissionIssues), ...prefixed("catalogRelease", releaseIssues));
  if (issues.length > 0) return undefined;
  assertValidManufacturerRegistry(documents.manufacturerRegistry);
  assertValidDesignProfileAdmission(documents.admission);
  assertValidDesignCatalogRelease(documents.catalogRelease);
  return { registry: documents.manufacturerRegistry, admission: documents.admission, release: documents.catalogRelease };
}

type CheckStatus = AdmissionCheckV1["status"];

function contextualCheckStatuses(entry: DesignProfileAdmissionEntryV1, rawProfile: unknown, registry: ManufacturerRegistryV1): ReadonlyMap<string, CheckStatus> {
  const statuses = new Map<string, CheckStatus>(requiredAdmissionCheckIds(entry.partClass).map((checkId) => [checkId, "not_run"]));
  if (rawProfile === undefined) return statuses;
  const profileIssues = validateDesignProfile(rawProfile, registry);
  const boundaryIssues = validateCommercialDataBoundary(rawProfile);
  statuses.set("contract.closed_profile", profileIssues.filter((candidate) => candidate.code !== "commercial_boundary_violation").length === 0 ? "pass" : "fail");
  statuses.set("contract.commercial_boundary", boundaryIssues.length === 0 ? "pass" : "fail");
  const raw = rawProfile as Partial<DesignProfileV1>;
  const identityMatches = raw.partClass === entry.partClass && isPartIdentity(raw.part) && samePart(raw.part, entry.part);
  statuses.set("contract.identity_path", identityMatches ? "pass" : "fail");
  if (entry.profileContentHash === null) statuses.set("contract.profile_content_hash", "not_run");
  else {
    try {
      statuses.set("contract.profile_content_hash", designProfileContentHash(rawProfile as DesignProfileV1) === entry.profileContentHash ? "pass" : "fail");
    } catch {
      statuses.set("contract.profile_content_hash", "fail");
    }
  }
  const classCheckId = `class.${entry.partClass}.facts_semantics`;
  if (profileIssues.length === 0) {
    const profile = parseDesignProfile(rawProfile, registry);
    const admissionIssues = validateProfileAdmissionRules(profile);
    statuses.set("evidence.primary", admissionIssues.some((candidate) => candidate.code === "non_primary_review_evidence") ? "fail" : "pass");
    statuses.set("facts.reviewed_and_conditioned", admissionIssues.some((candidate) => candidate.code !== "non_primary_review_evidence") ? "fail" : "pass");
    statuses.set(classCheckId, validateFactsForCodec(profile.facts, profile.partClass, registry.manufacturers.find((candidate) => candidate.manufacturerId === profile.part.manufacturerId)).length === 0 ? "pass" : "fail");
  } else {
    statuses.set("evidence.primary", "fail");
    statuses.set("facts.reviewed_and_conditioned", "fail");
    statuses.set(classCheckId, "fail");
  }
  if (entry.state === "reviewed") {
    const independent = entry.ownerTrack !== entry.reviewerTrack && entry.authoredBy !== null && entry.reviewedBy !== null
      && entry.authoredBy !== entry.reviewedBy && entry.authoredAt !== null && entry.reviewedAt !== null;
    statuses.set("review.independent", independent ? "pass" : "fail");
  }
  return statuses;
}

function validateDeclaredCheckStatuses(entry: DesignProfileAdmissionEntryV1, entryIndex: number, rawProfile: unknown, registry: ManufacturerRegistryV1): ValidationIssue[] {
  const expected = contextualCheckStatuses(entry, rawProfile, registry);
  const issues: ValidationIssue[] = [];
  entry.checks.forEach((check, checkIndex) => {
    const actual = expected.get(check.checkId);
    if (actual === undefined || actual === check.status) return;
    issues.push({
      path: `admission.entries.${entryIndex}.checks.${checkIndex}.status`,
      code: check.status === "pass" ? "self_declared_check" : "stale_admission_check",
      message: `Declared ${check.status} does not match deterministically evaluated ${actual} for ${check.checkId}`,
    });
  });
  return issues;
}

function contextualEnvelopeCheckStatuses(entry: DesignProfileAdmissionEntryV1, rawProfile: unknown, registry: ManufacturerRegistryV1): ReadonlyMap<string, CheckStatus> {
  const statuses = new Map<string, CheckStatus>(requiredAdmissionCheckIds(entry.partClass).map((checkId) => [checkId, "not_run"]));
  if (rawProfile === undefined) return statuses;
  const profileIssues = validateDesignProfileEnvelope(rawProfile, registry);
  const boundaryIssues = validateCommercialDataBoundary(rawProfile);
  statuses.set("contract.closed_profile", profileIssues.filter((candidate) => candidate.code !== "commercial_boundary_violation").length === 0 ? "pass" : "fail");
  statuses.set("contract.commercial_boundary", boundaryIssues.length === 0 ? "pass" : "fail");
  const raw = rawProfile as Partial<DesignProfileV1>;
  const identityMatches = raw.partClass === entry.partClass && isPartIdentity(raw.part) && samePart(raw.part, entry.part);
  statuses.set("contract.identity_path", identityMatches ? "pass" : "fail");
  if (entry.profileContentHash === null) statuses.set("contract.profile_content_hash", "not_run");
  else {
    try {
      statuses.set("contract.profile_content_hash", designProfileEnvelopeContentHash(rawProfile as DesignProfileEnvelope) === entry.profileContentHash ? "pass" : "fail");
    } catch {
      statuses.set("contract.profile_content_hash", "fail");
    }
  }
  const classCheckId = `class.${entry.partClass}.facts_semantics`;
  if (profileIssues.length === 0) {
    const profile = parseDesignProfileEnvelope(rawProfile, registry);
    const admissionIssues = validateEnvelopeAdmissionRules(profile);
    statuses.set("evidence.primary", admissionIssues.some((candidate) => candidate.code === "non_primary_review_evidence") ? "fail" : "pass");
    statuses.set("facts.reviewed_and_conditioned", admissionIssues.some((candidate) => candidate.code !== "non_primary_review_evidence") ? "fail" : "pass");
    statuses.set(classCheckId, validateEnvelopeClassSemantics(
      profile,
      registry.manufacturers.find((candidate) => candidate.manufacturerId === profile.part.manufacturerId),
    ).length === 0 ? "pass" : "fail");
  } else {
    statuses.set("evidence.primary", "fail");
    statuses.set("facts.reviewed_and_conditioned", "fail");
    statuses.set(classCheckId, "fail");
  }
  if (entry.state === "reviewed") {
    const independent = entry.ownerTrack !== entry.reviewerTrack && entry.authoredBy !== null && entry.reviewedBy !== null
      && entry.authoredBy !== entry.reviewedBy && entry.authoredAt !== null && entry.reviewedAt !== null;
    statuses.set("review.independent", independent ? "pass" : "fail");
  }
  return statuses;
}

function validateDeclaredEnvelopeCheckStatuses(entry: DesignProfileAdmissionEntryV1, entryIndex: number, rawProfile: unknown, registry: ManufacturerRegistryV1): ValidationIssue[] {
  const expected = contextualEnvelopeCheckStatuses(entry, rawProfile, registry);
  const issues: ValidationIssue[] = [];
  entry.checks.forEach((check, checkIndex) => {
    const actual = expected.get(check.checkId);
    if (actual === undefined || actual === check.status) return;
    issues.push({
      path: `admission.entries.${entryIndex}.checks.${checkIndex}.status`,
      code: check.status === "pass" ? "self_declared_check" : "stale_admission_check",
      message: `Declared ${check.status} does not match deterministically evaluated ${actual} for ${check.checkId}`,
    });
  });
  return issues;
}

function designCatalogEnvelopeContentHash(
  registry: ManufacturerRegistryV1,
  admission: DesignProfileAdmissionLedgerV1,
  reviewedProfiles: readonly DesignProfileEnvelope[],
): `sha256:${string}` {
  const profiles = [...reviewedProfiles]
    .sort((left, right) => compareAscii(designProfilePath(left.partClass, left.part), designProfilePath(right.partClass, right.part)))
    .map((profile) => canonicalDesignProfileEnvelope(profile));
  return contentHash({
    manufacturerRegistry: registry,
    admission: reviewedAdmissionProjection(admission),
    profiles,
  });
}

export function validateDesignLibrary(documents: DesignLibraryDocuments): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parsed = structurallyParse(documents, issues);
  if (!parsed) return issues;
  if (parsed.release.manufacturerRegistryContentHash !== manufacturerRegistryContentHash(parsed.registry)) {
    issues.push({ path: "catalogRelease.manufacturerRegistryContentHash", code: "registry_hash_mismatch", message: "Release does not pin the supplied manufacturer registry" });
  }
  if (parsed.release.admissionContentHash !== admissionContentHash(parsed.admission)) {
    issues.push({ path: "catalogRelease.admissionContentHash", code: "admission_hash_mismatch", message: "Release does not pin the reviewed admission projection" });
  }
  const admissionByPath = new Map(parsed.admission.entries.map((entry, index) => [entry.profilePath, { entry, index }]));
  const releaseByPath = new Map(parsed.release.profiles.map((entry, index) => [entry.profilePath, { ref: entry, index }]));
  const parsedReviewedProfiles: DesignProfileV1[] = [];
  for (const filePath of Object.keys(documents.profiles).sort(compareAscii)) {
    if (!admissionByPath.has(filePath)) issues.push({ path: `profiles.${filePath}`, code: "profile_without_admission", message: "Every present profile file must join to one admission ledger path" });
  }
  for (const [entryIndex, entry] of parsed.admission.entries.entries()) {
    if (entry.reviewedAt !== null && Date.parse(entry.reviewedAt) > Date.parse(parsed.release.releasedAt)) {
      issues.push({ path: `admission.entries.${entryIndex}.reviewedAt`, code: "review_after_release", message: "reviewedAt must not be later than the catalog release" });
    }
    const rawProfile = profileDocument(documents, entry.profilePath);
    if (rawProfile === undefined) {
      if (FILE_REQUIRED_STATES.has(entry.state)) issues.push({ path: `profiles.${entry.profilePath}`, code: "missing_profile", message: `${entry.state} admission requires its exact profile file` });
      issues.push(...validateDeclaredCheckStatuses(entry, entryIndex, rawProfile, parsed.registry));
      continue;
    }
    const profileIssues = validateDesignProfile(rawProfile, parsed.registry);
    issues.push(...prefixed(`profiles.${entry.profilePath}`, profileIssues));
    issues.push(...validateDeclaredCheckStatuses(entry, entryIndex, rawProfile, parsed.registry));
    if (profileIssues.length > 0) continue;
    const profile = parseDesignProfile(rawProfile, parsed.registry);
    if (profile.partClass !== entry.partClass || !samePart(profile.part, entry.part)) issues.push({ path: `profiles.${entry.profilePath}`, code: "profile_admission_identity_mismatch", message: "Profile identity and class must exactly match the admission path reservation" });
    const actualHash = designProfileContentHash(profile);
    if (entry.profileContentHash !== null && actualHash !== entry.profileContentHash) issues.push({ path: `profiles.${entry.profilePath}`, code: "profile_hash_mismatch", message: "Canonical profile hash must match its admission entry" });
    if (entry.state === "reviewed") {
      issues.push(...prefixed(`profiles.${entry.profilePath}`, validateProfileAdmissionRules(profile)));
      for (const evidence of profileEvidence(profile)) {
        if (evidence.evidence.retrievedAt === null) continue;
        const retrieved = Date.parse(evidence.evidence.retrievedAt);
        if (entry.reviewedAt !== null && retrieved > Date.parse(entry.reviewedAt)) issues.push({ path: `profiles.${entry.profilePath}.${evidence.path}.retrievedAt`, code: "evidence_after_review", message: "Evidence must be retrieved no later than independent review" });
        if (retrieved > Date.parse(parsed.release.releasedAt)) issues.push({ path: `profiles.${entry.profilePath}.${evidence.path}.retrievedAt`, code: "evidence_after_release", message: "Released evidence cannot be retrieved after the catalog release" });
      }
      parsedReviewedProfiles.push(profile);
    }
  }
  for (const entry of parsed.admission.entries.filter((candidate) => candidate.state === "reviewed")) {
    if (!releaseByPath.has(entry.profilePath)) issues.push({ path: `admission.${entry.profilePath}`, code: "reviewed_profile_missing_from_release", message: "Every reviewed admission must be pinned by the release" });
  }
  for (const [index, ref] of parsed.release.profiles.entries()) {
    const admission = admissionByPath.get(ref.profilePath)?.entry;
    if (!admission || admission.state !== "reviewed") issues.push({ path: `catalogRelease.profiles.${index}`, code: "profile_not_reviewed", message: "Release profiles require a matching reviewed admission entry" });
    else if (admission.profileContentHash !== ref.profileContentHash || admission.partClass !== ref.partClass || !samePart(admission.part, ref.part)) issues.push({ path: `catalogRelease.profiles.${index}`, code: "admission_ref_mismatch", message: "Release profile ref must exactly match reviewed admission identity, class, and hash" });
  }
  if (parsedReviewedProfiles.length === parsed.admission.entries.filter((entry) => entry.state === "reviewed").length) {
    const expectedCatalogHash = designCatalogContentHash(parsed.registry, parsed.admission, parsedReviewedProfiles);
    if (parsed.release.contentHash !== expectedCatalogHash) issues.push({ path: "catalogRelease.contentHash", code: "catalog_hash_mismatch", message: "Catalog hash must bind only registry, reviewed admission projection, and sorted reviewed profile bytes" });
  }
  return issues;
}

export function validateDesignLibraryEnvelope(input: DesignLibraryDocuments): ValidationIssue[] {
  let documents: DesignLibraryDocuments;
  try {
    documents = descriptorSafeJsonSnapshot(input) as DesignLibraryDocuments;
  } catch (error) {
    return [{
      path: error instanceof DescriptorSafeJsonSnapshotError ? error.path : "",
      code: "invalid_data_boundary",
      message: "Mixed-version library documents must be finite own enumerable data without accessors, exotic prototypes, sparse arrays, or cycles",
    }];
  }
  const issues: ValidationIssue[] = [];
  const parsed = structurallyParse(documents, issues);
  if (!parsed) return issues;
  if (parsed.release.manufacturerRegistryContentHash !== manufacturerRegistryContentHash(parsed.registry)) {
    issues.push({ path: "catalogRelease.manufacturerRegistryContentHash", code: "registry_hash_mismatch", message: "Release does not pin the supplied manufacturer registry" });
  }
  if (parsed.release.admissionContentHash !== admissionContentHash(parsed.admission)) {
    issues.push({ path: "catalogRelease.admissionContentHash", code: "admission_hash_mismatch", message: "Release does not pin the reviewed admission projection" });
  }
  const admissionByPath = new Map(parsed.admission.entries.map((entry, index) => [entry.profilePath, { entry, index }]));
  const releaseByPath = new Map(parsed.release.profiles.map((entry, index) => [entry.profilePath, { ref: entry, index }]));
  const parsedReviewedProfiles: DesignProfileEnvelope[] = [];
  for (const filePath of Object.keys(documents.profiles).sort(compareAscii)) {
    if (!admissionByPath.has(filePath)) issues.push({ path: `profiles.${filePath}`, code: "profile_without_admission", message: "Every present profile file must join to one admission ledger path" });
  }
  for (const [entryIndex, entry] of parsed.admission.entries.entries()) {
    if (entry.reviewedAt !== null && Date.parse(entry.reviewedAt) > Date.parse(parsed.release.releasedAt)) {
      issues.push({ path: `admission.entries.${entryIndex}.reviewedAt`, code: "review_after_release", message: "reviewedAt must not be later than the catalog release" });
    }
    const rawProfile = profileDocument(documents, entry.profilePath);
    if (rawProfile === undefined) {
      if (FILE_REQUIRED_STATES.has(entry.state)) issues.push({ path: `profiles.${entry.profilePath}`, code: "missing_profile", message: `${entry.state} admission requires its exact profile file` });
      issues.push(...validateDeclaredEnvelopeCheckStatuses(entry, entryIndex, rawProfile, parsed.registry));
      continue;
    }
    const profileIssues = validateDesignProfileEnvelope(rawProfile, parsed.registry);
    issues.push(...prefixed(`profiles.${entry.profilePath}`, profileIssues));
    issues.push(...validateDeclaredEnvelopeCheckStatuses(entry, entryIndex, rawProfile, parsed.registry));
    if (profileIssues.length > 0) continue;
    const profile = parseDesignProfileEnvelope(rawProfile, parsed.registry);
    if (profile.partClass !== entry.partClass || !samePart(profile.part, entry.part)) issues.push({ path: `profiles.${entry.profilePath}`, code: "profile_admission_identity_mismatch", message: "Profile identity and class must exactly match the admission path reservation" });
    const actualHash = designProfileEnvelopeContentHash(profile);
    if (entry.profileContentHash !== null && actualHash !== entry.profileContentHash) issues.push({ path: `profiles.${entry.profilePath}`, code: "profile_hash_mismatch", message: "Canonical profile hash must match its admission entry" });
    if (entry.state === "reviewed") {
      const admissionIssues = validateEnvelopeAdmissionRules(profile);
      issues.push(...prefixed(`profiles.${entry.profilePath}`, admissionIssues));
      for (const evidence of profileEnvelopeEvidence(profile)) {
        if (evidence.evidence.retrievedAt === null) continue;
        const retrieved = Date.parse(evidence.evidence.retrievedAt);
        if (entry.reviewedAt !== null && retrieved > Date.parse(entry.reviewedAt)) issues.push({ path: `profiles.${entry.profilePath}.${evidence.path}.retrievedAt`, code: "evidence_after_review", message: "Evidence must be retrieved no later than independent review" });
        if (retrieved > Date.parse(parsed.release.releasedAt)) issues.push({ path: `profiles.${entry.profilePath}.${evidence.path}.retrievedAt`, code: "evidence_after_release", message: "Released evidence cannot be retrieved after the catalog release" });
      }
      parsedReviewedProfiles.push(profile);
    }
  }
  for (const entry of parsed.admission.entries.filter((candidate) => candidate.state === "reviewed")) {
    if (!releaseByPath.has(entry.profilePath)) issues.push({ path: `admission.${entry.profilePath}`, code: "reviewed_profile_missing_from_release", message: "Every reviewed admission must be pinned by the release" });
  }
  for (const [index, ref] of parsed.release.profiles.entries()) {
    const admission = admissionByPath.get(ref.profilePath)?.entry;
    if (!admission || admission.state !== "reviewed") issues.push({ path: `catalogRelease.profiles.${index}`, code: "profile_not_reviewed", message: "Release profiles require a matching reviewed admission entry" });
    else if (admission.profileContentHash !== ref.profileContentHash || admission.partClass !== ref.partClass || !samePart(admission.part, ref.part)) issues.push({ path: `catalogRelease.profiles.${index}`, code: "admission_ref_mismatch", message: "Release profile ref must exactly match reviewed admission identity, class, and hash" });
  }
  if (parsedReviewedProfiles.length === parsed.admission.entries.filter((entry) => entry.state === "reviewed").length) {
    const expectedCatalogHash = designCatalogEnvelopeContentHash(parsed.registry, parsed.admission, parsedReviewedProfiles);
    if (parsed.release.contentHash !== expectedCatalogHash) issues.push({ path: "catalogRelease.contentHash", code: "catalog_hash_mismatch", message: "Catalog hash must bind only registry, reviewed admission projection, and sorted reviewed profile bytes" });
  }
  return issues;
}

function diagnosticsFor(documents: DesignLibraryDocuments, admission: DesignProfileAdmissionLedgerV1): string[] {
  const diagnostics: string[] = [];
  for (const entry of admission.entries) {
    if (entry.state !== "reviewed" && profileDocument(documents, entry.profilePath) !== undefined) diagnostics.push(`Excluded ${entry.state} profile ${entry.profilePath}`);
    if (!FILE_REQUIRED_STATES.has(entry.state) && profileDocument(documents, entry.profilePath) === undefined) diagnostics.push(`Reserved ${entry.state} admission without profile ${entry.profilePath}`);
  }
  return diagnostics.sort(compareAscii);
}

export function loadReviewedDesignLibrary(documents: DesignLibraryDocuments): ReviewedDesignLibrary {
  const snapshot = detachedJsonSnapshot(documents) as DesignLibraryDocuments;
  const first = validateDesignLibrary(snapshot)[0];
  if (first) throw new Error(`${first.path} [${first.code}]: ${first.message}`);
  const registry = snapshot.manufacturerRegistry as ManufacturerRegistryV1;
  const admission = snapshot.admission as DesignProfileAdmissionLedgerV1;
  const release = snapshot.catalogRelease as DesignCatalogReleaseV1;
  const profiles = release.profiles.map((ref) => parseDesignProfile(profileDocument(snapshot, ref.profilePath), registry));
  return detachedJsonSnapshot({ version: release.version, contentHash: release.contentHash, profiles, diagnostics: diagnosticsFor(snapshot, admission) }) as ReviewedDesignLibrary;
}

export function loadReviewedDesignLibraryEnvelope(documents: DesignLibraryDocuments): ReviewedDesignLibraryEnvelope {
  let snapshot: DesignLibraryDocuments;
  try {
    snapshot = descriptorSafeJsonSnapshot(documents) as DesignLibraryDocuments;
  } catch (error) {
    const path = error instanceof DescriptorSafeJsonSnapshotError ? error.path : "";
    throw new Error(`${path || "documents"} [invalid_data_boundary]: Mixed-version library documents must be finite own enumerable data without accessors, exotic prototypes, sparse arrays, or cycles`);
  }
  const first = validateDesignLibraryEnvelope(snapshot)[0];
  if (first) throw new Error(`${first.path} [${first.code}]: ${first.message}`);
  const registry = snapshot.manufacturerRegistry as ManufacturerRegistryV1;
  const admission = snapshot.admission as DesignProfileAdmissionLedgerV1;
  const release = snapshot.catalogRelease as DesignCatalogReleaseV1;
  const profiles = release.profiles.map((ref) => parseDesignProfileEnvelope(profileDocument(snapshot, ref.profilePath), registry));
  return detachedJsonSnapshot({ version: release.version, contentHash: release.contentHash, profiles, diagnostics: diagnosticsFor(snapshot, admission) }) as ReviewedDesignLibraryEnvelope;
}

export function reviewedAdmissionEntries(admission: DesignProfileAdmissionLedgerV1): DesignProfileAdmissionEntryV1[] {
  return admission.entries.filter((entry) => entry.state === "reviewed").sort((left, right) => compareAscii(left.profilePath, right.profilePath));
}
