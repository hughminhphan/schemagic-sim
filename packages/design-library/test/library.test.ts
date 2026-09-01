import { describe, expect, it } from "vitest";
import {
  designCatalogContentHash,
  loadReviewedDesignLibrary,
  manufacturerRegistryContentHash,
  validateDesignLibrary,
  validateDesignProfileAdmission,
  validateProfileAdmissionRules,
  type DesignCatalogReleaseV1,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionLedgerV1,
  type ManufacturerRegistryV1,
} from "../src";
import { createSyntheticReviewedLibraryFixture, createSyntheticReviewedProfile } from "../src/fixtures";

describe("reviewed design-library loading", () => {
  it("loads only hash-matching reviewed profiles in release order with stable bytes", () => {
    const documents = createSyntheticReviewedLibraryFixture();
    expect(validateDesignLibrary(documents)).toEqual([]);
    const first = loadReviewedDesignLibrary(documents);
    const second = loadReviewedDesignLibrary(structuredClone(documents));
    expect(first).toEqual(second);
    const reversedFiles = {
      ...documents,
      profiles: Object.fromEntries(Object.entries(documents.profiles).reverse()),
    };
    expect(loadReviewedDesignLibrary(reversedFiles)).toEqual(first);
    expect(first.profiles).toHaveLength(12);
    expect(first.profiles.map((profile) => profile.partClass)).toEqual([...first.profiles.map((profile) => profile.partClass)].sort());
    expect(first.diagnostics).toEqual([]);
  });

  it("keeps profile eligibility and order neutral to manufacturer display aliases", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.mlcc-capacitor", "shared.n-channel-power-mosfet"]);
    const baseline = loadReviewedDesignLibrary(documents);
    const changed = structuredClone(documents) as DesignLibraryDocuments;
    const registry = changed.manufacturerRegistry as ManufacturerRegistryV1;
    registry.manufacturers[0]!.displayName = "Anonymous Synthetic Manufacturer";
    const release = changed.catalogRelease as DesignCatalogReleaseV1;
    release.manufacturerRegistryContentHash = manufacturerRegistryContentHash(registry);
    release.contentHash = designCatalogContentHash(registry, changed.admission as DesignProfileAdmissionLedgerV1, Object.values(changed.profiles) as any[]);
    const anonymized = loadReviewedDesignLibrary(changed);
    expect(anonymized.profiles).toEqual(baseline.profiles);
    expect(anonymized.profiles.map((profile) => profile.part)).toEqual(baseline.profiles.map((profile) => profile.part));
  });

  it("rejects profile, admission, registry, and release hash disagreement", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const path = Object.keys(documents.profiles)[0]!;
    const changed = structuredClone(documents) as DesignLibraryDocuments;
    const profile = changed.profiles[path] as any;
    profile.facts.resistance.value.value += 1;
    expect(validateDesignLibrary(changed).map((entry) => entry.code)).toContain("profile_hash_mismatch");
    expect(() => loadReviewedDesignLibrary(changed)).toThrow(/profile_content_hash|profile_hash_mismatch/);

    const changedAdmission = structuredClone(documents) as DesignLibraryDocuments;
    (changedAdmission.admission as DesignProfileAdmissionLedgerV1).entries[0]!.profileContentHash = `sha256:${"1".repeat(64)}`;
    expect(validateDesignLibrary(changedAdmission).map((entry) => entry.code)).toContain("admission_hash_mismatch");
  });

  it("rejects files that have no bidirectional admission identity join", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const orphan = createSyntheticReviewedProfile("shared.mlcc-capacitor", 99);
    const extended: DesignLibraryDocuments = {
      ...documents,
      profiles: { ...documents.profiles, "packages/design-library/parts/orphan.json": orphan },
    };
    expect(validateDesignLibrary(extended)).toContainEqual(expect.objectContaining({ code: "profile_without_admission" }));
    expect(() => loadReviewedDesignLibrary(extended)).toThrow(/profile_without_admission/);
  });

  it("requires independent review, passed checks, exact hashes, and reviewed facts", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.current-sense-resistor"]);
    const admission = structuredClone(documents.admission) as DesignProfileAdmissionLedgerV1;
    admission.entries[0]!.reviewerTrack = admission.entries[0]!.ownerTrack;
    admission.entries[0]!.checks[0]!.status = "fail";
    expect(validateDesignProfileAdmission(admission).map((entry) => entry.code)).toEqual(expect.arrayContaining(["non_independent_review", "checks_not_passed"]));

    const profile = createSyntheticReviewedProfile("shared.current-sense-resistor");
    profile.facts.temperatureCoefficient.state = "estimated";
    expect(validateProfileAdmissionRules(profile).map((entry) => entry.path)).toContain("facts.temperatureCoefficient.state");

    const mosfet = createSyntheticReviewedProfile("shared.n-channel-power-mosfet");
    mosfet.facts.onResistance.validFor = mosfet.facts.onResistance.validFor
      .filter((range) => range.parameterId !== "junctionTemperature");
    expect(validateProfileAdmissionRules(mosfet)).toContainEqual(expect.objectContaining({
      path: "facts.onResistance.validFor",
      code: "missing_required_range",
    }));

    const nonPrimary = createSyntheticReviewedProfile("shared.general-purpose-resistor");
    nonPrimary.facts.resistance.evidence[0]!.kind = "authored_derivation";
    expect(validateProfileAdmissionRules(nonPrimary)).toContainEqual(expect.objectContaining({
      path: "facts.resistance.evidence.0.kind",
      code: "non_primary_review_evidence",
    }));
  });
});
