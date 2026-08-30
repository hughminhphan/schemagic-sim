import { describe, expect, it } from "vitest";
import {
  FACTS_SCHEMA_VERSION_V2,
  admissionContentHash,
  canonicalDesignProfileEnvelope,
  compareAscii,
  contentHash,
  designProfileEnvelopeContentHash,
  designProfilePath,
  loadReviewedDesignLibrary,
  loadReviewedDesignLibraryEnvelope,
  reviewedAdmissionProjection,
  validateDesignLibraryEnvelope,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileEnvelope,
  type DesignProfileV1,
  type DesignProfileWithFactsV2,
  type FactsV2For,
  type ManufacturerRegistryV1,
} from "../src";
import { createSyntheticReviewedLibraryFixture, createSyntheticReviewedProfile } from "../src/fixtures";

function switchingDiodeV2(
  v1 = createSyntheticReviewedProfile("shared.switching-diode"),
): DesignProfileWithFactsV2<"shared.switching-diode", FactsV2For<"shared.switching-diode">> {
  const evidence = structuredClone(v1.commonFacts.packageName.evidence);
  const unknownGeometry = (label: string) => ({
    value: null,
    state: "unknown" as const,
    evidence: [],
    validFor: [],
    explanation: `${label} is represented only by facts.mountedGeometry in facts schema 2.0.0.`,
  });
  return {
    ...structuredClone(v1),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      ...structuredClone(v1.commonFacts),
      boardArea: unknownGeometry("Board area"),
      maximumHeight: unknownGeometry("Maximum height"),
    },
    facts: {
      ...structuredClone(v1.facts),
      mountedGeometry: {
        boardArea: {
          value: {
            area: { value: 2e-6, unit: "m2", displayUnit: "mm²" },
            basis: "manufacturer_recommended_land_pattern_bounding_box",
            calculation: "maximum_x_span_times_maximum_y_span",
            sourceDimensions: [
              { axis: "x", dimensionId: "land-length", multiplier: 1, maximum: { value: 1e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(evidence) },
              { axis: "y", dimensionId: "land-width", multiplier: 1, maximum: { value: 2e-3, unit: "m", displayUnit: "mm" }, evidence: structuredClone(evidence) },
            ],
          },
          state: "calculated",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Canonical reviewed manufacturer land-pattern rectangle.",
        },
        maximumHeight: {
          value: {
            height: { value: 5e-4, unit: "m", displayUnit: "mm" },
            basis: "manufacturer_package_maximum_in_surface_mount_orientation",
          },
          state: "reviewed",
          evidence: structuredClone(evidence),
          validFor: [],
          explanation: "Reviewed maximum mounted package height.",
        },
      },
    },
  };
}

function refreshEnvelopeRelease(documents: DesignLibraryDocuments): void {
  const registry = documents.manufacturerRegistry as ManufacturerRegistryV1;
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  const release = documents.catalogRelease as DesignCatalogReleaseV1;
  const profiles = Object.values(documents.profiles) as DesignProfileEnvelope[];
  release.admissionContentHash = admissionContentHash(admission);
  release.contentHash = contentHash({
    manufacturerRegistry: registry,
    admission: reviewedAdmissionProjection(admission),
    profiles: [...profiles]
      .sort((left, right) => compareAscii(designProfilePath(left.partClass, left.part), designProfilePath(right.partClass, right.part)))
      .map((profile) => canonicalDesignProfileEnvelope(profile)),
  });
}

function mixedDocuments(): DesignLibraryDocuments {
  const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor", "shared.switching-diode"]);
  const v1 = Object.values(documents.profiles).find((entry) => (entry as DesignProfileEnvelope).partClass === "shared.switching-diode") as ReturnType<typeof createSyntheticReviewedProfile<"shared.switching-diode">>;
  const profile = switchingDiodeV2(v1);
  const path = designProfilePath(profile.partClass, profile.part);
  (documents.profiles as Record<string, unknown>)[path] = profile;
  const hash = designProfileEnvelopeContentHash(profile);
  const admission = documents.admission as DesignProfileAdmissionLedgerV1;
  admission.entries.find((entry) => entry.profilePath === path)!.profileContentHash = hash;
  const release = documents.catalogRelease as DesignCatalogReleaseV1;
  release.profiles.find((entry) => entry.profilePath === path)!.profileContentHash = hash;
  refreshEnvelopeRelease(documents);
  return documents;
}

describe("mixed facts-version reviewed library loading", () => {
  it("preserves V1 output and loads a stable profile-ID-sorted V1/V2 mix", () => {
    const v1 = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    expect(loadReviewedDesignLibraryEnvelope(v1)).toEqual(loadReviewedDesignLibrary(v1));

    const documents = mixedDocuments();
    expect(validateDesignLibraryEnvelope(documents)).toEqual([]);
    const first = loadReviewedDesignLibraryEnvelope(documents);
    const reversedFiles = { ...documents, profiles: Object.fromEntries(Object.entries(documents.profiles).reverse()) };
    expect(loadReviewedDesignLibraryEnvelope(reversedFiles)).toEqual(first);
    expect(first.profiles.map((profile) => profile.factsSchemaVersion)).toEqual(["1.0.0", "2.0.0"]);
    expect(first.profiles.map((profile) => designProfilePath(profile.partClass, profile.part)))
      .toEqual([...first.profiles.map((profile) => designProfilePath(profile.partClass, profile.part))].sort(compareAscii));
    expect(() => loadReviewedDesignLibrary(documents)).toThrow(/invalid_facts_version/);
  });

  it("requires exact envelope profile, admission, and release hashes", () => {
    const documents = mixedDocuments();
    const profile = Object.values(documents.profiles).find((entry) => (entry as DesignProfileEnvelope).factsSchemaVersion === "2.0.0") as ReturnType<typeof switchingDiodeV2>;
    profile.facts.forwardVoltage.value!.value += 0.1;
    expect(validateDesignLibraryEnvelope(documents).map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "profile_hash_mismatch",
      "self_declared_check",
      "catalog_hash_mismatch",
    ]));
    expect(() => loadReviewedDesignLibraryEnvelope(documents)).toThrow(/profile_content_hash|profile_hash_mismatch/);
  });

  it("enforces review and release chronology at nested V2 dimension evidence paths", () => {
    const documents = mixedDocuments();
    const profile = Object.values(documents.profiles).find((entry) => (entry as DesignProfileEnvelope).factsSchemaVersion === "2.0.0") as ReturnType<typeof switchingDiodeV2>;
    const lateEvidence = structuredClone(profile.facts.mountedGeometry.boardArea.evidence);
    lateEvidence[0]!.retrievedAt = "2026-08-24T00:00:00.000Z";
    profile.facts.mountedGeometry.boardArea.evidence = structuredClone(lateEvidence);
    for (const dimension of profile.facts.mountedGeometry.boardArea.value!.sourceDimensions) dimension.evidence = structuredClone(lateEvidence);
    const path = designProfilePath(profile.partClass, profile.part);
    const hash = designProfileEnvelopeContentHash(profile);
    const admission = documents.admission as DesignProfileAdmissionLedgerV1;
    admission.entries.find((entry) => entry.profilePath === path)!.profileContentHash = hash;
    const release = documents.catalogRelease as DesignCatalogReleaseV1;
    release.profiles.find((entry) => entry.profilePath === path)!.profileContentHash = hash;
    refreshEnvelopeRelease(documents);

    expect(validateDesignLibraryEnvelope(documents)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: `profiles.${path}.facts.mountedGeometry.boardArea.value.sourceDimensions.0.evidence.0.retrievedAt`,
        code: "evidence_after_review",
      }),
      expect.objectContaining({
        path: `profiles.${path}.facts.mountedGeometry.boardArea.value.sourceDimensions.1.evidence.0.retrievedAt`,
        code: "evidence_after_release",
      }),
    ]));
  });

  it("rejects released-profile accessors without invoking them", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const profile = Object.values(documents.profiles)[0] as DesignProfileV1;
    let reads = 0;
    Object.defineProperty(profile, "factsSchemaVersion", {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return "1.0.0";
      },
    });
    expect(validateDesignLibraryEnvelope(documents)).toContainEqual(expect.objectContaining({
      path: expect.stringContaining("factsSchemaVersion"),
      code: "invalid_data_boundary",
    }));
    expect(reads).toBe(0);
    expect(() => loadReviewedDesignLibraryEnvelope(documents)).toThrow(/invalid_data_boundary/);
    expect(reads).toBe(0);
  });
});
