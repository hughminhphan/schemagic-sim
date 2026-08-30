import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  admissionContentHash,
  designCatalogContentHash,
  designProfileContentHash,
  manufacturerRegistryContentHash,
  requiredAdmissionCheckIds,
  validateDesignLibrary,
  validateDesignProfileAdmission,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionEntryV1,
  type DesignProfileAdmissionLedgerV1,
  type ManufacturerRegistryV1,
} from "../src";
import { createSyntheticReviewedLibraryFixture } from "../src/fixtures";

function plannedSeed(): DesignProfileAdmissionEntryV1 {
  const ledger = JSON.parse(readFileSync(new URL("../admission.json", import.meta.url), "utf8")) as DesignProfileAdmissionLedgerV1;
  return structuredClone(ledger.entries[0]!);
}

function refreshRelease(documents: DesignLibraryDocuments): void {
  const registry = documents.manufacturerRegistry as ManufacturerRegistryV1;
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  const release = documents.catalogRelease as DesignCatalogReleaseV1;
  const profiles = admission.entries.filter((entry) => entry.state === "reviewed").map((entry) => documents.profiles[entry.profilePath] as any);
  release.manufacturerRegistryContentHash = manufacturerRegistryContentHash(registry);
  release.admissionContentHash = admissionContentHash(admission);
  release.contentHash = designCatalogContentHash(registry, admission, profiles);
}

describe("admission and file boundary", () => {
  it("requires the exact common and class check set", () => {
    const baseline = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const ledger = baseline.admission as DesignProfileAdmissionLedgerV1;
    expect(ledger.entries[0]!.checks.map((check) => check.checkId)).toEqual(requiredAdmissionCheckIds("shared.general-purpose-resistor"));

    const missing = structuredClone(ledger);
    missing.entries[0]!.checks.pop();
    expect(validateDesignProfileAdmission(missing)).toContainEqual(expect.objectContaining({ code: "missing_required_check" }));

    const extra = structuredClone(ledger);
    extra.entries[0]!.checks.push({ checkId: "self.declared.ad_hoc", status: "pass" });
    extra.entries[0]!.checks.sort((left, right) => left.checkId < right.checkId ? -1 : 1);
    expect(validateDesignProfileAdmission(extra)).toContainEqual(expect.objectContaining({ code: "extra_admission_check" }));
  });

  it("rejects self-declared or stale statuses against deterministic checks", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const path = Object.keys(documents.profiles)[0]!;
    (documents.profiles[path] as any).facts.resistance.value.value = -1;
    expect(validateDesignLibrary(documents).map((entry) => entry.code)).toEqual(expect.arrayContaining(["self_declared_check", "quantity_not_positive"]));

    const reserved = createSyntheticReviewedLibraryFixture([]);
    const admission = reserved.admission as DesignProfileAdmissionLedgerV1;
    admission.entries = [plannedSeed()];
    admission.entries[0]!.checks[0]!.status = "pass";
    refreshRelease(reserved);
    expect(validateDesignLibrary(reserved)).toContainEqual(expect.objectContaining({ code: "self_declared_check" }));
  });

  it("joins every present file to its ledger identity and requires files for authored/review states", () => {
    const reviewed = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const reviewedPath = Object.keys(reviewed.profiles)[0]!;
    delete (reviewed.profiles as Record<string, unknown>)[reviewedPath];
    expect(validateDesignLibrary(reviewed)).toContainEqual(expect.objectContaining({ code: "missing_profile" }));

    for (const state of ["authored", "in_independent_review"] as const) {
      const documents = createSyntheticReviewedLibraryFixture([]);
      const entry = plannedSeed();
      entry.state = state;
      entry.authoredBy = "synthetic-author";
      entry.authoredAt = "2026-08-23T00:00:00.000Z";
      (documents.admission as DesignProfileAdmissionLedgerV1).entries = [entry];
      refreshRelease(documents);
      expect(validateDesignLibrary(documents), state).toContainEqual(expect.objectContaining({ code: "missing_profile" }));
    }

    for (const state of ["planned", "researching", "blocked"] as const) {
      const documents = createSyntheticReviewedLibraryFixture([]);
      const entry = plannedSeed();
      entry.state = state;
      (documents.admission as DesignProfileAdmissionLedgerV1).entries = [entry];
      refreshRelease(documents);
      expect(validateDesignLibrary(documents), state).toEqual([]);
    }

    const wrongIdentity = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const path = Object.keys(wrongIdentity.profiles)[0]!;
    (wrongIdentity.profiles[path] as any).part.manufacturerPartNumber = "DIFFERENT-MPN";
    expect(validateDesignLibrary(wrongIdentity).map((entry) => entry.code)).toEqual(expect.arrayContaining(["profile_admission_identity_mismatch", "self_declared_check"]));

    const malformedIdentity = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    (malformedIdentity.profiles[Object.keys(malformedIdentity.profiles)[0]!] as any).part = null;
    expect(() => validateDesignLibrary(malformedIdentity)).not.toThrow();
    expect(validateDesignLibrary(malformedIdentity).map((entry) => entry.code)).toEqual(expect.arrayContaining(["invalid_object", "self_declared_check"]));
  });

  it("hashes only registry, reviewed admissions, and sorted reviewed profile bytes", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const baselineHash = (documents.catalogRelease as DesignCatalogReleaseV1).contentHash;
    const baselineAdmissionHash = (documents.catalogRelease as DesignCatalogReleaseV1).admissionContentHash;
    const admission = documents.admission as DesignProfileAdmissionLedgerV1;
    admission.entries.push(plannedSeed());
    admission.entries.sort((left, right) => left.profilePath < right.profilePath ? -1 : 1);
    const release = documents.catalogRelease as DesignCatalogReleaseV1;
    release.version = "different-release-label";
    release.releasedAt = "2030-01-01T00:00:00.000Z";
    refreshRelease(documents);
    expect(release.admissionContentHash).toBe(baselineAdmissionHash);
    expect(release.contentHash).toBe(baselineHash);
    expect(validateDesignLibrary(documents)).toEqual([]);

    const changedReviewed = structuredClone(documents) as DesignLibraryDocuments;
    (changedReviewed.admission as DesignProfileAdmissionLedgerV1).entries.find((entry) => entry.state === "reviewed")!.reviewedBy = "different-independent-reviewer";
    refreshRelease(changedReviewed);
    expect((changedReviewed.catalogRelease as DesignCatalogReleaseV1).contentHash).not.toBe(baselineHash);
  });

  it("enforces authorship, review, evidence, and release chronology", () => {
    const admissionOnly = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]).admission as DesignProfileAdmissionLedgerV1;
    admissionOnly.entries[0]!.authoredAt = "2026-08-24T00:00:00Z";
    expect(validateDesignProfileAdmission(admissionOnly)).toContainEqual(expect.objectContaining({ code: "invalid_chronology" }));

    const earlyRelease = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    (earlyRelease.catalogRelease as DesignCatalogReleaseV1).releasedAt = "2026-08-22T23:59:59Z";
    expect(validateDesignLibrary(earlyRelease)).toContainEqual(expect.objectContaining({ code: "review_after_release" }));

    const lateEvidence = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const path = Object.keys(lateEvidence.profiles)[0]!;
    const profile = lateEvidence.profiles[path] as any;
    profile.facts.resistance.evidence[0].retrievedAt = "2026-08-24T00:00:00Z";
    const profileHash = designProfileContentHash(profile);
    const admission = lateEvidence.admission as DesignProfileAdmissionLedgerV1;
    admission.entries[0]!.profileContentHash = profileHash;
    const release = lateEvidence.catalogRelease as DesignCatalogReleaseV1;
    release.profiles[0]!.profileContentHash = profileHash;
    refreshRelease(lateEvidence);
    expect(validateDesignLibrary(lateEvidence).map((entry) => entry.code)).toEqual(expect.arrayContaining(["evidence_after_review", "evidence_after_release"]));
  });

  it("keeps the data-manifest ownership projection equal to the real admission reservations", () => {
    const admission = JSON.parse(readFileSync(new URL("../admission.json", import.meta.url), "utf8")) as DesignProfileAdmissionLedgerV1;
    const manifest = JSON.parse(readFileSync(new URL("../../../docs/designer-v1-data-manifest.json", import.meta.url), "utf8")) as {
      exact_mpn_ownership: Array<{
        part: { manufacturerId: string; manufacturerPartNumber: string };
        part_class_id: string;
        profile_path: string;
        owning_track: string;
        review_track: string;
        review_state: string;
      }>;
    };
    const normalizedAdmission = admission.entries
      .filter((entry) => !entry.part.manufacturerId.startsWith("schemagic-synthetic-"))
      .map((entry) => [entry.partClass, entry.part, entry.profilePath, entry.ownerTrack, entry.reviewerTrack, entry.state]);
    const normalizedManifest = manifest.exact_mpn_ownership
      .map((entry) => [entry.part_class_id, entry.part, entry.profile_path, entry.owning_track, entry.review_track, entry.review_state]);
    expect(normalizedManifest).toEqual(normalizedAdmission);
  });
});
