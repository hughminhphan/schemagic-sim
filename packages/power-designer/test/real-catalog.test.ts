import { describe, expect, it } from "vitest";
import { canonicalStringify, type DesignRecipeRefV2 } from "@opencircuit/design-engine";
import { getInstalledPowerRecipeRefsV2 } from "@opencircuit/design-engine/v2-power-runtime";
import {
  designProfileEnvelopeContentHash,
  getBundledDesignLibraryDocuments,
  POWER_EXTERNAL_CLAIM_SPECS_V2,
  POWER_INTEGRATED_CLAIM_SPECS_V2,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type DesignLibraryDocuments,
  type ManufacturerRegistryV1,
} from "@opencircuit/design-library";
import * as rootApi from "../src";
import {
  REAL_PRIMARY_PART_CATALOG,
  REAL_PRIMARY_PART_ADMISSION_GAP_REPORT,
  REAL_PRIMARY_PART_FACTS_V2_CANDIDATE_PROFILE_PLANS,
  REAL_PRIMARY_PART_FACTS_V2_DRAFT_AUTHORING_ASSESSMENT,
  REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT,
  assertValidRealPrimaryPartCatalog,
  buildRealCatalogAdmissionGapReport,
  buildRealCatalogFactsV2CandidateProfilePlans,
  buildRealCatalogFactsV2DraftAuthoringAssessment,
  buildRealCatalogFactsV2ReadinessReport,
  encodeExactMpnPathToken,
  validateRealPrimaryPartCatalog,
} from "../src/real-catalog";
import {
  generateP1CompactFixture,
  generateP2HighVoltageFixture,
} from "../src/fixtures";

type JsonObject = Record<string, unknown>;
const TPS54302_PROFILE_PATH = "packages/design-library/parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json";

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object");
  return value as JsonObject;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected array");
  return value;
}

function mutableCatalog(): JsonObject {
  return structuredClone(REAL_PRIMARY_PART_CATALOG) as unknown as JsonObject;
}

function mutableDesignLibraryDocuments(): DesignLibraryDocuments {
  return structuredClone(getBundledDesignLibraryDocuments()) as DesignLibraryDocuments;
}

function tps54302ReleaseRef(documents: DesignLibraryDocuments): JsonObject {
  const entry = array(object(documents.catalogRelease).profiles)
    .map(object)
    .find((candidate) => candidate.profileId === TPS54302_PROFILE_PATH);
  if (entry === undefined) throw new Error("Expected TPS54302DDCR release ref");
  return entry;
}

function tps54302AdmissionEntry(documents: DesignLibraryDocuments): JsonObject {
  const entry = array(object(documents.admission).entries)
    .map(object)
    .find((candidate) => candidate.profilePath === TPS54302_PROFILE_PATH);
  if (entry === undefined) throw new Error("Expected TPS54302DDCR admission entry");
  return entry;
}

function firstProfile(catalog: JsonObject): JsonObject {
  return object(array(catalog.profiles)[0]);
}

function knownFacts(value: unknown, result: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(value)) {
    value.forEach((entry) => knownFacts(entry, result));
  } else if (value && typeof value === "object") {
    const entry = value as JsonObject;
    if (entry.state === "primary_source") result.push(entry);
    Object.values(entry).forEach((child) => knownFacts(child, result));
  }
  return result;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

function primaryPartNumbers(generation: ReturnType<typeof generateP1CompactFixture>): string[] {
  return generation.candidates.map((candidate) => {
    const primary = candidate.components.find((component) =>
      component.role === "power.regulator" || component.role === "power.controller"
    );
    if (!primary) throw new Error(`Candidate ${candidate.id} has no primary power part`);
    return primary.part.manufacturerPartNumber;
  });
}

describe("scheMAGIC Power Designer Track B4 real primary-part tranche", () => {
  it("accepts the closed catalog with seven exact identities across both recipe classes", () => {
    expect(validateRealPrimaryPartCatalog(REAL_PRIMARY_PART_CATALOG)).toEqual({ valid: true, issues: [] });
    expect(() => assertValidRealPrimaryPartCatalog(REAL_PRIMARY_PART_CATALOG)).not.toThrow();
    expect(REAL_PRIMARY_PART_CATALOG.profiles.map((profile) => profile.identity.part.manufacturerPartNumber).sort()).toEqual([
      "LM5145RGYR",
      "LM70880RRXR",
      "LT8640SIV#PBF",
      "LTC3891EFE#PBF",
      "LTC3895EFE#PBF",
      "NCP1599MNTWG",
      "TPS54302DDCR",
    ]);
    expect(REAL_PRIMARY_PART_CATALOG.profiles.filter((profile) => profile.partClass === "power.integrated-synchronous-buck-regulator")).toHaveLength(4);
    expect(REAL_PRIMARY_PART_CATALOG.profiles.filter((profile) => profile.partClass === "power.external-fet-synchronous-buck-controller")).toHaveLength(3);
    expect(new Set(REAL_PRIMARY_PART_CATALOG.profiles.map((profile) => profile.identity.part.manufacturerId))).toEqual(
      new Set(["analog-devices", "onsemi", "texas-instruments"]),
    );
    expect(Object.isFrozen(REAL_PRIMARY_PART_CATALOG)).toBe(true);
    expect(REAL_PRIMARY_PART_CATALOG.profiles.every(Object.isFrozen)).toBe(true);
    expect(REAL_PRIMARY_PART_CATALOG.profiles.every((profile) => profile.evidenceReviewState === "authored_primary_source_extraction")).toBe(true);
    expect(REAL_PRIMARY_PART_CATALOG.profiles.every((profile) => profile.manifestReviewState === "authored")).toBe(true);
  });

  it("binds every populated fact to official manufacturer HTTPS evidence with a precise locator", () => {
    const verifiedHashes = new Map([
      ["ti-tps54302ddcr-product", "sha256:ea48851586f05be8121ec68a1ad7f237f16ca3a230d9bec6d8290e02251838a0"],
      ["ti-tps54302-product", "sha256:ea48851586f05be8121ec68a1ad7f237f16ca3a230d9bec6d8290e02251838a0"],
      ["ti-tps54302-datasheet", "sha256:1632b388d1ba3a46c8e8f090ddfec2114c0f538cfb8364ddcda583fee3fdbdc5"],
      ["ti-lm70880-datasheet", "sha256:f6115dacb305ac44d58d1985647095d05406861532e22d8d8643cb215561f3dc"],
      ["adi-lt8640s-product", "sha256:0a2d3920d5535affa071f25ac995f2ecc243e9a341bb569355d397eb8073dec8"],
      ["adi-lt8640s-datasheet", "sha256:489bb5559a2103cb9f90b59ae9e6e45b7a4e06f5c3df8c7154a9e23c5f457ecc"],
      ["onsemi-ncp1599-datasheet", "sha256:40e0c29696d6adb4b35e8f331fc404d5c4efab35a15f8b449223c97931fc5650"],
      ["ti-lm5145rgyr-product", "sha256:4e177c79e7235d5932fc56b5f16427284c30f8d0182dd5447b37088b0af8f681"],
      ["ti-lm5145-datasheet", "sha256:9916caabb1429cc97985e260e0d0b0ccce1850156ac31557c9be079f7dd00a9e"],
      ["adi-ltc3891-product", "sha256:d3c5306b703ea1d23601d909bf7ba658ef6921d9c896caae74dc139de27641ff"],
      ["adi-ltc3891-datasheet", "sha256:21a46463d6a45e3ce64349c2359866de6eeb819a33372c909f1426af8ef1aba6"],
      ["adi-ltc3895-product", "sha256:77c7dd92d532fc02fd0692afa346ff415ab6c4717c032bdb3951ee2f141ed324"],
      ["adi-ltc3895-datasheet", "sha256:33b389917fddb3be0e9e549217a41b791445c8acb34349dfe711a9e786105c09"],
    ]);
    for (const profile of REAL_PRIMARY_PART_CATALOG.profiles) {
      const sourceById = new Map(profile.sources.map((source) => [source.sourceId, source]));
      expect(profile.sources.length).toBeGreaterThan(0);
      for (const source of profile.sources) {
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.retrievalMethod).toBe("official_manufacturer_https");
        expect(source.retrievedAt).toMatch(/(?:Z|[+-]\d{2}:\d{2})$/);
        expect(verifiedHashes.get(source.sourceId)).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(source.contentHash).toEqual({ state: "verified", value: verifiedHashes.get(source.sourceId), reason: null });
        expect(source.publicationRights).toBe("link_and_factual_extract_only");
        expect(source.licenseNote).toContain("No PDF or model is redistributed");
      }
      for (const fact of knownFacts(profile)) {
        const refs = array(fact.sourceRefs);
        expect(refs.length).toBeGreaterThan(0);
        for (const entry of refs) {
          const sourceRef = object(entry);
          expect(sourceById.has(String(sourceRef.sourceId))).toBe(true);
          expect(String(sourceRef.locator).length).toBeGreaterThan(12);
        }
      }
    }
  });

  it("binds canonical TI product captures without collapsing fact-specific source identities", () => {
    const expected = [
      {
        profileId: "real.texas-instruments.tps54302ddcr",
        sourceIds: ["ti-tps54302ddcr-product", "ti-tps54302-product"],
        url: "https://www.ti.com/product/TPS54302",
        retrievedAt: "2026-08-24T11:13:12+10:00",
        hash: "sha256:ea48851586f05be8121ec68a1ad7f237f16ca3a230d9bec6d8290e02251838a0",
      },
      {
        profileId: "real.texas-instruments.lm5145rgyr",
        sourceIds: ["ti-lm5145rgyr-product"],
        url: "https://www.ti.com/product/LM5145",
        retrievedAt: "2026-08-24T11:13:38+10:00",
        hash: "sha256:4e177c79e7235d5932fc56b5f16427284c30f8d0182dd5447b37088b0af8f681",
      },
    ];

    for (const capture of expected) {
      const profile = REAL_PRIMARY_PART_CATALOG.profiles.find((entry) => entry.profileId === capture.profileId);
      expect(profile).toBeDefined();
      for (const sourceId of capture.sourceIds) {
        expect(profile?.sources.find((source) => source.sourceId === sourceId)).toMatchObject({
          sourceId,
          url: capture.url,
          retrievedAt: capture.retrievedAt,
          contentHash: { state: "verified", value: capture.hash, reason: null },
        });
      }
    }
  });

  it("binds the replay-verified six-source ADI capture receipt without retaining vendor bytes", () => {
    const expected = new Map([
      ["adi-lt8640s-product", "sha256:0a2d3920d5535affa071f25ac995f2ecc243e9a341bb569355d397eb8073dec8"],
      ["adi-lt8640s-datasheet", "sha256:489bb5559a2103cb9f90b59ae9e6e45b7a4e06f5c3df8c7154a9e23c5f457ecc"],
      ["adi-ltc3891-product", "sha256:d3c5306b703ea1d23601d909bf7ba658ef6921d9c896caae74dc139de27641ff"],
      ["adi-ltc3891-datasheet", "sha256:21a46463d6a45e3ce64349c2359866de6eeb819a33372c909f1426af8ef1aba6"],
      ["adi-ltc3895-product", "sha256:77c7dd92d532fc02fd0692afa346ff415ab6c4717c032bdb3951ee2f141ed324"],
      ["adi-ltc3895-datasheet", "sha256:33b389917fddb3be0e9e549217a41b791445c8acb34349dfe711a9e786105c09"],
    ]);
    const sources = REAL_PRIMARY_PART_CATALOG.profiles.flatMap((profile) => profile.sources)
      .filter((source) => source.sourceId.startsWith("adi-"));
    expect(sources.map((source) => source.sourceId).sort()).toEqual([...expected.keys()].sort());
    for (const source of sources) {
      expect(source.retrievedAt).toBe("2026-08-24T03:45:21.324Z");
      expect(source.contentHash).toEqual({ state: "verified", value: expected.get(source.sourceId), reason: null });
      expect(source.licenseNote).toContain("No PDF or model is redistributed");
    }
  });

  it("keeps loop facts and stability assessments unknown rather than manufacturing a pass", () => {
    for (const profile of REAL_PRIMARY_PART_CATALOG.profiles) {
      expect(profile.facts.control.loopCrossoverFrequency.state).toBe("unknown");
      expect(profile.facts.control.phaseMargin.state).toBe("unknown");
      expect(profile.facts.control.stabilityAssessment).toEqual(expect.objectContaining({
        state: "unknown",
        value: null,
        sourceRefs: [],
      }));
      expect(profile.facts.control.stabilityAssessment.reason).toContain("cannot produce a stability pass");
    }
  });

  it("retains the corrected NCP1599 bounds without promoting them to reviewed facts", () => {
    const profile = REAL_PRIMARY_PART_CATALOG.profiles.find((entry) => entry.profileId === "real.onsemi.ncp1599mntwg");
    expect(profile).toBeDefined();
    expect(profile?.facts.timing.minimumOnTime).toMatchObject({
      state: "primary_source",
      minimum: null,
      typical: null,
      maximum: 50e-9,
      unit: "s",
      qualification: "Guaranteed maximum by design.",
    });
    expect(profile?.facts.electrical.currentLimit).toMatchObject({
      state: "primary_source",
      minimum: 3.83,
      typical: 4.18,
      maximum: 4.54,
      unit: "A",
    });
    expect(profile?.facts.thermal.maximumJunctionTemperature).toMatchObject({
      state: "primary_source",
      minimum: null,
      typical: null,
      maximum: 423.15,
      unit: "K",
      qualification: "Absolute maximum rating; not a recommended operating-junction limit.",
    });
    expect(profile?.manifestReviewState).toBe("authored");
    expect(profile?.admissionState).toBe("blocked_facts_v2_authoring_review_and_admission");
  });

  it("retains LM70880 operating limits without promoting absolute, paired, or calculated values", () => {
    const profile = REAL_PRIMARY_PART_CATALOG.profiles.find((entry) => entry.profileId === "real.texas-instruments.lm70880rrxr");
    expect(profile).toBeDefined();
    if (profile?.partClass !== "power.integrated-synchronous-buck-regulator") {
      throw new Error("Expected LM70880RRXR to be an integrated synchronous buck regulator");
    }
    expect(profile?.identity.part).toEqual({
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: "LM70880RRXR",
    });
    expect(profile?.sources).toEqual([expect.objectContaining({
      sourceId: "ti-lm70880-datasheet",
      url: "https://www.ti.com/lit/ds/symlink/lm70880.pdf",
      documentId: "SNVSCD3",
      retrievedAt: "2026-08-25T20:56:38Z",
      contentHash: {
        state: "verified",
        value: "sha256:f6115dacb305ac44d58d1985647095d05406861532e22d8d8643cb215561f3dc",
        reason: null,
      },
    })]);
    expect(profile?.facts.electrical.inputVoltage).toMatchObject({ minimum: 4.5, maximum: 80, unit: "V" });
    expect(profile.facts.electrical.inputVoltage.state).toBe("primary_source");
    if (profile.facts.electrical.inputVoltage.state !== "primary_source") {
      throw new Error("Expected a primary-source LM70880RRXR input-voltage fact");
    }
    expect(profile.facts.electrical.inputVoltage.qualification).toContain("87.5 V absolute maximum");
    expect(profile?.facts.electrical.maximumOutputCurrent).toMatchObject({ maximum: 8, unit: "A" });
    expect(profile.facts.electrical.maximumOutputCurrent.state).toBe("primary_source");
    if (profile.facts.electrical.maximumOutputCurrent.state !== "primary_source") {
      throw new Error("Expected a primary-source LM70880RRXR output-current fact");
    }
    expect(profile.facts.electrical.maximumOutputCurrent.qualification).toContain("16 A headline requires two");
    expect(profile?.facts.electrical.currentLimit).toMatchObject({ state: "unknown", minimum: null, typical: null, maximum: null, unit: "A" });
    expect(profile.facts.electrical.currentLimit.state).toBe("unknown");
    if (profile.facts.electrical.currentLimit.state !== "unknown") {
      throw new Error("Expected LM70880RRXR current limit in amperes to remain unknown");
    }
    expect(profile.facts.electrical.currentLimit.reason).toContain("calculated electrical evidence");
    expect(profile?.facts.electrical.currentSenseThreshold).toMatchObject({ minimum: 0.05, typical: 0.056, maximum: 0.062, unit: "V" });
    expect(profile.facts.electrical.feedbackReference).toMatchObject({
      minimum: 0.794,
      typical: 0.8,
      maximum: 0.806,
      unit: "V",
      qualification: "At VIN = 12 V: minimum and maximum apply over TJ = -40 deg C to 150 deg C; typical applies at TJ = 25 deg C.",
    });
    expect(profile.facts.timing.switchingFrequency).toMatchObject({
      minimum: null,
      typical: 440000,
      maximum: null,
      unit: "Hz",
      qualification: expect.stringContaining("RRT = 49.9 kohm, TJ = 25 deg C, and VIN = 12 V only"),
    });
    expect(profile.facts.timing.minimumOnTime).toMatchObject({
      minimum: null,
      typical: 25e-9,
      maximum: null,
      unit: "s",
      qualification: "Typical at TJ = 25 deg C and VIN = 12 V; specified by design and not production tested.",
    });
    expect(profile.facts.timing.minimumOffTime).toMatchObject({
      minimum: null,
      typical: 88e-9,
      maximum: 126e-9,
      unit: "s",
      qualification: "At VIN = 12 V: the 126 ns maximum applies over TJ = -40 deg C to 150 deg C; the 88 ns typical applies at TJ = 25 deg C.",
    });
    expect(profile?.facts.control.compensation).toMatchObject({ state: "primary_source", value: "application_dependent" });
    expect(profile.integratedPowerStage.highSideOnResistance).toMatchObject({ state: "unknown" });
    expect(profile.integratedPowerStage.lowSideOnResistance).toMatchObject({ state: "unknown" });
  });

  it("keeps the real tranche isolated from the synthetic P1/P2 golden generator", () => {
    expect("REAL_PRIMARY_PART_CATALOG" in rootApi).toBe(false);
    expect("REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT" in rootApi).toBe(false);
    expect("REAL_PRIMARY_PART_FACTS_V2_CANDIDATE_PROFILE_PLANS" in rootApi).toBe(false);
    expect(primaryPartNumbers(generateP1CompactFixture()).every((mpn) => mpn.startsWith("SYN-P1-"))).toBe(true);
    expect(primaryPartNumbers(generateP2HighVoltageFixture()).every((mpn) => mpn.startsWith("SYN-P2-"))).toBe(true);
    expect(canonicalStringify(generateP1CompactFixture())).toBe(canonicalStringify(generateP1CompactFixture()));
    expect(canonicalStringify(generateP2HighVoltageFixture())).toBe(canonicalStringify(generateP2HighVoltageFixture()));
  });

  it("rejects duplicate profiles and exact manufacturer-plus-MPN identities", () => {
    const duplicate = mutableCatalog();
    const profiles = array(duplicate.profiles);
    profiles.push(structuredClone(profiles[0]));
    const codes = validateRealPrimaryPartCatalog(duplicate).issues.map((issue) => issue.code);
    expect(codes).toContain("duplicate_profile_id");
    expect(codes).toContain("duplicate_part_identity");
  });

  it("rejects inverted ranges and recursively rejects unknown keys", () => {
    const invalidRange = mutableCatalog();
    const inputVoltage = object(object(object(firstProfile(invalidRange).facts).electrical).inputVoltage);
    inputVoltage.minimum = 30;
    inputVoltage.maximum = 20;
    expect(validateRealPrimaryPartCatalog(invalidRange).issues.map((issue) => issue.code)).toContain("invalid_range");

    const openShape = mutableCatalog();
    object(firstProfile(openShape).facts).unreviewedGuess = true;
    expect(validateRealPrimaryPartCatalog(openShape).issues).toContainEqual(expect.objectContaining({
      code: "unknown_key",
      path: "$.profiles[0].facts.unreviewedGuess",
    }));
  });

  it("rejects non-manufacturer source domains and dangling fact provenance", () => {
    const badDomain = mutableCatalog();
    object(array(firstProfile(badDomain).sources)[0]).url = "https://example.com/unreviewed";
    expect(validateRealPrimaryPartCatalog(badDomain).issues.map((issue) => issue.code)).toContain("non_manufacturer_domain");

    const dangling = mutableCatalog();
    const identityRef = object(array(object(firstProfile(dangling).identity).sourceRefs)[0]);
    identityRef.sourceId = "undeclared-source";
    expect(validateRealPrimaryPartCatalog(dangling).issues.map((issue) => issue.code)).toContain("dangling_source_ref");
  });

  it("does not let mutable catalog registry data redefine the code-owned manufacturer trust boundary", () => {
    const drift = mutableCatalog();
    const manufacturers = array(drift.manufacturers);
    const texasInstruments = manufacturers.map(object).find((entry) => entry.manufacturerId === "texas-instruments");
    if (!texasInstruments) throw new Error("Missing Texas Instruments fixture registry entry");
    array(texasInstruments.officialDomains)[0] = "evil.www.ti.com";
    object(array(firstProfile(drift).sources)[0]).url = "https://evil.www.ti.com/forged-source";
    const driftCodes = validateRealPrimaryPartCatalog(drift).issues.map((issue) => issue.code);
    expect(driftCodes).toContain("manufacturer_domain_drift");
    expect(driftCodes).toContain("non_manufacturer_domain");

    const fake = mutableCatalog();
    array(fake.manufacturers).push({
      manufacturerId: "fake-semiconductor",
      displayName: "Fake Semiconductor",
      officialDomains: ["fake.example"],
    });
    expect(validateRealPrimaryPartCatalog(fake).issues.map((issue) => issue.code)).toContain("unexpected_manufacturer");
  });

  it("validates explicit source hash state without inventing unavailable hashes", () => {
    const malformedHash = mutableCatalog();
    const source = object(array(firstProfile(malformedHash).sources)[0]);
    source.contentHash = { state: "verified", value: "sha256:not-a-digest", reason: null };
    expect(validateRealPrimaryPartCatalog(malformedHash).issues).toContainEqual(expect.objectContaining({
      code: "invalid_content_hash",
      path: "$.profiles[0].sources[0].contentHash.value",
    }));
  });

  it("rejects stale pre-capture admission state and any post-capture source-hash regression", () => {
    const staleState = mutableCatalog();
    firstProfile(staleState).admissionState = "blocked_missing_source_hashes_and_profile_admission";
    expect(validateRealPrimaryPartCatalog(staleState).issues).toContainEqual(expect.objectContaining({
      code: "invalid_admission_state",
      path: "$.profiles[0].admissionState",
    }));

    const missingHash = mutableCatalog();
    object(array(firstProfile(missingHash).sources)[0]).contentHash = {
      state: "missing",
      value: null,
      reason: "Exact source bytes were removed after capture.",
    };
    expect(validateRealPrimaryPartCatalog(missingHash).issues).toContainEqual(expect.objectContaining({
      code: "post_capture_state_requires_verified_source_hash",
      path: "$.profiles[0].sources[0].contentHash.state",
    }));
  });

  it("rejects language that would misrepresent authored extraction as completed review", () => {
    const misleadingState = mutableCatalog();
    firstProfile(misleadingState).evidenceReviewState = "primary_sources_reviewed";
    expect(validateRealPrimaryPartCatalog(misleadingState).issues).toContainEqual(expect.objectContaining({
      code: "invalid_review_state",
      path: "$.profiles[0].evidenceReviewState",
    }));
  });

  it("uses reversible exact-byte MPN tokens that preserve case and encode reserved bytes", () => {
    expect(encodeExactMpnPathToken("LT8640SIV#PBF")).toBe("LT8640SIV%23PBF");
    expect(encodeExactMpnPathToken("A.B/C\\D%E Ω")).toBe("A%2EB%2FC%5CD%25E%20%CE%A9");
  });

  it("reconciles only the exact reviewed TPS54302 release while retaining its staged facts-V2 assessment", () => {
    const report = REAL_PRIMARY_PART_ADMISSION_GAP_REPORT;
    expect(report).toMatchObject({
      profileCount: 7,
      manufacturerCount: 3,
      admissionEligibleProfileCount: 1,
      admissionBlockerCount: 6,
      profilesByPartClass: {
        "power.integrated-synchronous-buck-regulator": 4,
        "power.external-fet-synchronous-buck-controller": 3,
      },
      manufacturersByPartClass: {
        "power.integrated-synchronous-buck-regulator": 3,
        "power.external-fet-synchronous-buck-controller": 2,
      },
    });
    expect(report.admissionBlockers.missingExactMpnOwnership).toEqual([]);
    expect(report.admissionBlockers.missingSourceContentHashes).toEqual([]);
    expect(report.coverageGaps.map((gap) => gap.code)).toEqual(expect.arrayContaining([
      "integrated_profile_count_below_manifest_target",
      "integrated_current_envelope_incomplete",
      "controller_profile_count_below_manifest_target",
      "controller_manufacturer_count_below_manifest_target",
      "controller_stability_evidence_unavailable",
    ]));
    expect(report.coverageGaps.map((gap) => gap.code)).not.toContain("integrated_output_envelope_incomplete");
    expect(report.coverageGaps).toContainEqual({
      code: "integrated_profile_count_below_manifest_target",
      partClass: "power.integrated-synchronous-buck-regulator",
      message: "4 authored profiles; manifest target is 12 (8 remain).",
    });
    expect(report.coverageGaps).toContainEqual({
      code: "integrated_current_envelope_incomplete",
      partClass: "power.integrated-synchronous-buck-regulator",
      message: "Authored primary-source extractions reach 8 A continuous output; the 10 A end of the Power V1 envelope is not covered.",
    });
    expect(report.coverageGaps.map((gap) => gap.code)).not.toContain("integrated_input_envelope_incomplete");
    expect(report.factsV2AuthoringAssessments).toHaveLength(7);
    expect(report.factsV2AuthoringAssessments).toContainEqual(expect.objectContaining({
      profileId: "real.texas-instruments.lm70880rrxr",
      code: "facts_v2_profile_not_authored_or_independently_reviewed",
      sourceHashComplete: true,
      independentlyReviewedClaimCount: 0,
    }));
    expect(report.factsV2AuthoringAssessments.map((gap) => gap.profileId)).toContain("real.texas-instruments.tps54302ddcr");
    expect(report.admissionBlockers.factsV2ProfileAuthoring).toHaveLength(6);
    expect(report.admissionBlockers.factsV2ProfileAuthoring.map((gap) => gap.profileId)).toContain("real.texas-instruments.lm70880rrxr");
    expect(report.admissionBlockers.factsV2ProfileAuthoring.map((gap) => gap.profileId)).not.toContain("real.texas-instruments.tps54302ddcr");
    expect(report.factsV2ReviewedReleaseReconciliations).toEqual([
      expect.objectContaining({
        status: "reconciled",
        failures: [],
        scope: expect.objectContaining({
          claim: "exact_reviewed_release_production_enumeration_only",
          stagedAssessment: "retained_not_promoted",
          sourceProfileId: "real.texas-instruments.tps54302ddcr",
          stagedFactsSchemaVersion: "2.0.0",
          releasedFactsSchemaVersion: "3.3.0",
          releasedProfileId: TPS54302_PROFILE_PATH,
          releasedProfilePath: TPS54302_PROFILE_PATH,
          releasedProfileContentHash: "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
          recipe: {
            id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
            version: "3.4.6",
            contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
          },
        }),
        evidence: expect.objectContaining({
          releasedProfile: expect.objectContaining({
            profilePath: TPS54302_PROFILE_PATH,
            profileContentHash: "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
            factsSchemaVersion: "3.3.0",
          }),
          admission: expect.objectContaining({
            state: "reviewed",
            independentlyReviewed: true,
            allChecksPass: true,
          }),
          recipe: expect.objectContaining({
            id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
            version: "3.4.6",
            ready: true,
            requiredFactsSchemaVersion: "3.3.0",
          }),
        }),
      }),
    ]);
    expect(report.admissionBlockerCount).toBe(
      report.admissionBlockers.missingExactMpnOwnership.length
      + report.admissionBlockers.missingSourceContentHashes.length
      + report.admissionBlockers.factsV2ProfileAuthoring.length,
    );
    expect(REAL_PRIMARY_PART_CATALOG.profiles.every((profile) => profile.admissionState === "blocked_facts_v2_authoring_review_and_admission")).toBe(true);
  });

  it("derives the integrated output envelope from authored primary-source maxima", () => {
    const catalog = mutableCatalog();
    const tps54302 = array(catalog.profiles)
      .map(object)
      .find((profile) => profile.profileId === "real.texas-instruments.tps54302ddcr");
    if (tps54302 === undefined) throw new Error("Expected staged TPS54302DDCR profile");
    const outputVoltage = object(object(object(tps54302.facts).electrical).outputVoltage);
    expect(outputVoltage).toMatchObject({ state: "primary_source", unit: "V", maximum: 26 });
    outputVoltage.maximum = 10;
    for (const profile of array(catalog.profiles).map(object)) {
      if (profile.partClass !== "power.integrated-synchronous-buck-regulator") continue;
      const candidate = object(object(object(profile.facts).electrical).outputVoltage);
      if (typeof candidate.maximum === "number" && candidate.maximum > 10) candidate.maximum = 10;
    }

    const report = buildRealCatalogAdmissionGapReport({
      catalog: catalog as unknown as typeof REAL_PRIMARY_PART_CATALOG,
    });
    expect(report.coverageGaps).toContainEqual({
      code: "integrated_output_envelope_incomplete",
      partClass: "power.integrated-synchronous-buck-regulator",
      message: "Authored primary-source extractions reach 10 V maximum output; the 24 V end of the Power V1 envelope is not covered.",
    });

    for (const profile of array(catalog.profiles).map(object)) {
      if (profile.partClass !== "power.integrated-synchronous-buck-regulator") continue;
      object(object(object(profile.facts).electrical).outputVoltage).maximum = null;
    }
    const noAuthoredMaximumReport = buildRealCatalogAdmissionGapReport({
      catalog: catalog as unknown as typeof REAL_PRIMARY_PART_CATALOG,
    });
    expect(noAuthoredMaximumReport.coverageGaps).toContainEqual({
      code: "integrated_output_envelope_incomplete",
      partClass: "power.integrated-synchronous-buck-regulator",
      message: "No authored primary-source maximum output-voltage bound covers the 24 V end of the Power V1 envelope.",
    });
  });

  it("derives input and continuous-current envelopes only from authored primary-source maxima", () => {
    const catalog = mutableCatalog();
    for (const profile of array(catalog.profiles).map(object)) {
      if (profile.partClass !== "power.integrated-synchronous-buck-regulator") continue;
      const electrical = object(object(profile.facts).electrical);
      const inputVoltage = object(electrical.inputVoltage);
      const maximumOutputCurrent = object(electrical.maximumOutputCurrent);
      if (typeof inputVoltage.maximum === "number" && inputVoltage.maximum > 42) inputVoltage.maximum = 42;
      if (typeof maximumOutputCurrent.maximum === "number" && maximumOutputCurrent.maximum > 6) maximumOutputCurrent.maximum = 6;
    }
    const report = buildRealCatalogAdmissionGapReport({
      catalog: catalog as unknown as typeof REAL_PRIMARY_PART_CATALOG,
    });
    expect(report.coverageGaps).toContainEqual({
      code: "integrated_input_envelope_incomplete",
      partClass: "power.integrated-synchronous-buck-regulator",
      message: "Authored primary-source extractions reach 42 V maximum input; the 60 V end of the Power V1 envelope is not covered.",
    });
    expect(report.coverageGaps).toContainEqual({
      code: "integrated_current_envelope_incomplete",
      partClass: "power.integrated-synchronous-buck-regulator",
      message: "Authored primary-source extractions reach 6 A continuous output; the 10 A end of the Power V1 envelope is not covered.",
    });

    for (const profile of array(catalog.profiles).map(object)) {
      if (profile.partClass !== "power.integrated-synchronous-buck-regulator") continue;
      const electrical = object(object(profile.facts).electrical);
      object(electrical.inputVoltage).maximum = null;
      object(electrical.maximumOutputCurrent).maximum = null;
    }
    const noAuthoredMaximumReport = buildRealCatalogAdmissionGapReport({
      catalog: catalog as unknown as typeof REAL_PRIMARY_PART_CATALOG,
    });
    expect(noAuthoredMaximumReport.coverageGaps).toContainEqual({
      code: "integrated_input_envelope_incomplete",
      partClass: "power.integrated-synchronous-buck-regulator",
      message: "No authored primary-source maximum input-voltage bound covers the 60 V end of the Power V1 envelope.",
    });
    expect(noAuthoredMaximumReport.coverageGaps).toContainEqual({
      code: "integrated_current_envelope_incomplete",
      partClass: "power.integrated-synchronous-buck-regulator",
      message: "No authored primary-source maximum continuous-output-current bound covers the 10 A end of the Power V1 envelope.",
    });
  });

  it.each([
    {
      name: "wrong released path",
      failure: "released_profile_reference_mismatch",
      mutate: (documents: DesignLibraryDocuments) => {
        tps54302ReleaseRef(documents).profilePath = `${TPS54302_PROFILE_PATH}.wrong`;
      },
    },
    {
      name: "wrong released hash",
      failure: "released_profile_bytes_mismatch",
      mutate: (documents: DesignLibraryDocuments) => {
        tps54302ReleaseRef(documents).profileContentHash = `sha256:${"0".repeat(64)}`;
      },
    },
    {
      name: "wrong released MPN",
      failure: "released_profile_reference_mismatch",
      mutate: (documents: DesignLibraryDocuments) => {
        object(tps54302ReleaseRef(documents).part).manufacturerPartNumber = "TPS54302DDCT";
      },
    },
    {
      name: "wrong released facts version",
      failure: "released_profile_bytes_mismatch",
      mutate: (documents: DesignLibraryDocuments) => {
        object(documents.profiles[TPS54302_PROFILE_PATH]).factsSchemaVersion = "3.2.0";
      },
    },
    {
      name: "non-reviewed admission state",
      failure: "reviewed_admission_mismatch",
      mutate: (documents: DesignLibraryDocuments) => {
        tps54302AdmissionEntry(documents).state = "authored";
      },
    },
  ])("fails closed for $name", ({ failure, mutate }) => {
    const documents = mutableDesignLibraryDocuments();
    mutate(documents);
    const report = buildRealCatalogAdmissionGapReport({ documents });
    expect(report.admissionEligibleProfileCount).toBe(0);
    expect(report.admissionBlockers.factsV2ProfileAuthoring).toHaveLength(7);
    expect(report.factsV2AuthoringAssessments).toHaveLength(7);
    expect(report.factsV2ReviewedReleaseReconciliations[0]).toMatchObject({
      status: "blocked",
      evidence: null,
      failures: expect.arrayContaining([failure, "reviewed_release_documents_invalid"]),
    });
  });

  it("does not reconcile by MPN alone when the staged manufacturer identity is wrong", () => {
    const catalog = mutableCatalog();
    const tps54302 = array(catalog.profiles)
      .map(object)
      .find((profile) => profile.profileId === "real.texas-instruments.tps54302ddcr");
    if (tps54302 === undefined) throw new Error("Expected staged TPS54302DDCR profile");
    object(object(tps54302.identity).part).manufacturerId = "onsemi";
    const report = buildRealCatalogAdmissionGapReport({
      catalog: catalog as unknown as typeof REAL_PRIMARY_PART_CATALOG,
    });
    expect(report.admissionEligibleProfileCount).toBe(0);
    expect(report.admissionBlockers.factsV2ProfileAuthoring).toHaveLength(7);
    expect(report.factsV2ReviewedReleaseReconciliations[0]).toMatchObject({
      status: "blocked",
      failures: expect.arrayContaining(["source_profile_identity_mismatch"]),
      evidence: null,
    });
  });

  it("fails closed when the installed ready recipe identity hash is not exact", () => {
    const installedPowerRecipeRefs = structuredClone(getInstalledPowerRecipeRefsV2()) as DesignRecipeRefV2[];
    const recipe = installedPowerRecipeRefs.find((entry) => entry.id === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified");
    if (recipe === undefined) throw new Error("Expected installed facts-v3-4 recipe");
    recipe.contentHash = `sha256:${"0".repeat(64)}`;
    const report = buildRealCatalogAdmissionGapReport({ installedPowerRecipeRefs });
    expect(report.admissionEligibleProfileCount).toBe(0);
    expect(report.admissionBlockers.factsV2ProfileAuthoring).toHaveLength(7);
    expect(report.factsV2ReviewedReleaseReconciliations[0]).toMatchObject({
      status: "blocked",
      failures: expect.arrayContaining([
        "installed_recipe_identity_mismatch",
        "recipe_not_production_ready",
      ]),
      evidence: null,
    });
  });

  it("fails closed on duplicate installed recipe identities even when one exact ref is ready", () => {
    const installedPowerRecipeRefs = structuredClone(getInstalledPowerRecipeRefsV2()) as DesignRecipeRefV2[];
    const recipe = installedPowerRecipeRefs.find((entry) => entry.id === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified");
    if (recipe === undefined) throw new Error("Expected installed facts-v3-4 recipe");
    installedPowerRecipeRefs.push(structuredClone(recipe));
    const report = buildRealCatalogAdmissionGapReport({ installedPowerRecipeRefs });
    expect(report.admissionEligibleProfileCount).toBe(0);
    expect(report.admissionBlockers.factsV2ProfileAuthoring).toHaveLength(7);
    expect(report.factsV2ReviewedReleaseReconciliations[0]).toMatchObject({
      status: "blocked",
      failures: expect.arrayContaining([
        "installed_recipe_identity_mismatch",
        "recipe_not_production_ready",
      ]),
      evidence: null,
    });
  });

  it("derives duplicate staged gaps from a duplicate source profile and refuses ambiguous reconciliation", () => {
    const catalog = mutableCatalog();
    const profiles = array(catalog.profiles);
    const tps54302 = profiles.map(object)
      .find((profile) => profile.profileId === "real.texas-instruments.tps54302ddcr");
    if (tps54302 === undefined) throw new Error("Expected staged TPS54302DDCR profile");
    profiles.push(structuredClone(tps54302));
    const report = buildRealCatalogAdmissionGapReport({
      catalog: catalog as unknown as typeof REAL_PRIMARY_PART_CATALOG,
    });
    expect(report.admissionEligibleProfileCount).toBe(0);
    expect(report.factsV2AuthoringAssessments.filter((gap) => gap.profileId === "real.texas-instruments.tps54302ddcr")).toHaveLength(2);
    expect(report.admissionBlockers.factsV2ProfileAuthoring).toHaveLength(8);
    expect(report.factsV2ReviewedReleaseReconciliations[0]).toMatchObject({
      status: "blocked",
      failures: expect.arrayContaining([
        "staged_catalog_invalid",
        "source_profile_identity_mismatch",
        "staged_facts_v2_assessment_mismatch",
      ]),
      evidence: null,
    });
  });

  it("derives an omitted exact staged assessment from the supplied catalog and keeps TPS blocked", () => {
    const catalog = mutableCatalog();
    const profiles = array(catalog.profiles);
    const tpsIndex = profiles.findIndex((profile) => object(profile).profileId === "real.texas-instruments.tps54302ddcr");
    if (tpsIndex < 0) throw new Error("Expected staged TPS54302DDCR profile");
    profiles.splice(tpsIndex, 1);
    const report = buildRealCatalogAdmissionGapReport({
      catalog: catalog as unknown as typeof REAL_PRIMARY_PART_CATALOG,
    });
    expect(report.admissionEligibleProfileCount).toBe(0);
    expect(report.factsV2AuthoringAssessments.map((gap) => gap.profileId)).not.toContain("real.texas-instruments.tps54302ddcr");
    expect(report.factsV2ReviewedReleaseReconciliations[0]).toMatchObject({
      status: "blocked",
      failures: expect.arrayContaining([
        "source_profile_identity_mismatch",
        "staged_facts_v2_assessment_mismatch",
      ]),
      evidence: null,
    });
  });

  it.each([
    {
      name: "duplicate exact admission",
      failure: "reviewed_admission_mismatch",
      mutate: (documents: DesignLibraryDocuments) => {
        const entries = array(object(documents.admission).entries);
        entries.push(structuredClone(tps54302AdmissionEntry(documents)));
      },
    },
    {
      name: "duplicate exact release ref",
      failure: "released_profile_reference_mismatch",
      mutate: (documents: DesignLibraryDocuments) => {
        const refs = array(object(documents.catalogRelease).profiles);
        refs.push(structuredClone(tps54302ReleaseRef(documents)));
      },
    },
  ])("fails closed for $name rather than selecting the first match", ({ failure, mutate }) => {
    const documents = mutableDesignLibraryDocuments();
    mutate(documents);
    const report = buildRealCatalogAdmissionGapReport({ documents });
    expect(report.admissionEligibleProfileCount).toBe(0);
    expect(report.admissionBlockers.factsV2ProfileAuthoring).toHaveLength(7);
    expect(report.factsV2ReviewedReleaseReconciliations[0]).toMatchObject({
      status: "blocked",
      failures: expect.arrayContaining([
        failure,
        "reviewed_release_documents_invalid",
      ]),
      evidence: null,
    });
  });

  it("projects exact facts-V2 authoring gaps without promoting source extractions to reviewed claims", () => {
    const report = REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT;
    const rebuilt = buildRealCatalogFactsV2ReadinessReport();
    expect(rebuilt).not.toBe(report);
    expect(canonicalStringify(rebuilt)).toBe(canonicalStringify(report));
    expect(report).toMatchObject({
      catalogVersion: REAL_PRIMARY_PART_CATALOG.version,
      profileCount: 7,
      factsV2DraftCount: 1,
      admissionReadyProfileCount: 0,
      sourceHashCompleteProfileCount: 7,
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(report.profileGaps.every(Object.isFrozen)).toBe(true);
    expect(report.profileGaps.map((gap) => gap.profileId)).toEqual([...report.profileGaps.map((gap) => gap.profileId)].sort());
    expect(report.profileGaps.filter((gap) => gap.sourceHashComplete).map((gap) => gap.profileId)).toEqual([
      "real.analog-devices.lt8640siv-pbf",
      "real.analog-devices.ltc3891efe-pbf",
      "real.analog-devices.ltc3895efe-pbf",
      "real.onsemi.ncp1599mntwg",
      "real.texas-instruments.lm5145rgyr",
      "real.texas-instruments.lm70880rrxr",
      "real.texas-instruments.tps54302ddcr",
    ]);

    for (const gap of report.profileGaps) {
      expect(gap).toMatchObject({
        targetFactsSchemaVersion: "2.0.0",
        independentlyReviewedClaimCount: 0,
      });
      expect(gap.code).toBe([
        "real.onsemi.ncp1599mntwg",
        "real.texas-instruments.tps54302ddcr",
      ].includes(gap.profileId)
        ? "facts_v2_profile_not_independently_reviewed_or_admitted"
        : "facts_v2_profile_not_authored_or_independently_reviewed");
      expect(gap.unresolvedPaths).toContain("/commonFacts/packageName");
      expect(gap.unresolvedPaths).toContain("/facts/mountedGeometry/boardArea");
      expect(gap.unresolvedPaths).toContain("/facts/mountedGeometry/maximumHeight");
      expect(gap.unresolvedPaths).toContain("/facts/controlEvidenceBasis");
      expect(gap.unresolvedPaths).toEqual([...new Set(gap.unresolvedPaths)].sort());
      expect(gap.claimCandidates.every((candidate) => !candidate.status.includes("ready"))).toBe(true);
      expect(new Set(gap.claimCandidates.map((candidate) => candidate.targetPath)).size).toBe(gap.claimCandidates.length);
      const expectedClaimCount = gap.partClass === "power.integrated-synchronous-buck-regulator"
        ? Object.keys(POWER_INTEGRATED_CLAIM_SPECS_V2).length - 2
        : Object.keys(POWER_EXTERNAL_CLAIM_SPECS_V2).length - 1;
      expect(gap.claimCandidates).toHaveLength(expectedClaimCount);
    }

    const tps54302 = report.profileGaps.find((gap) => gap.profileId === "real.texas-instruments.tps54302ddcr");
    const tpsInputMinimum = tps54302?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/inputVoltageMinimum");
    expect(tpsInputMinimum).toEqual(expect.objectContaining({
      targetUnit: "V",
      claimKind: "guaranteed_minimum",
      basis: "operating_range",
      requiredConditionIds: [],
      status: "needs_independent_review",
      sourceCandidate: expect.objectContaining({
        path: "facts.electrical.inputVoltage",
        valueSlot: "minimum",
        value: 4.5,
        unit: "V",
      }),
    }));
    expect(tps54302?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/outputVoltageMinimum")?.status)
      .toBe("needs_condition_authoring_and_independent_review");
    expect(tps54302?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/outputCurrentCapabilityMinimum")?.status)
      .toBe("blocked_semantic_mismatch");
    expect(tps54302?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/minimumOnTimeMaximum")?.status)
      .toBe("blocked_missing_source_fact");

    const lt8640s = report.profileGaps.find((gap) => gap.profileId === "real.analog-devices.lt8640siv-pbf");
    expect(lt8640s?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/inputVoltageMinimum")?.status)
      .toBe("needs_independent_review");

    const ncp1599 = report.profileGaps.find((gap) => gap.profileId === "real.onsemi.ncp1599mntwg");
    const ncpCurrentLimits = ["currentLimitMinimum", "currentLimitTypical", "currentLimitMaximum"].map((field) =>
      ncp1599?.claimCandidates.find((candidate) => candidate.targetPath === `/facts/${field}`)
    );
    expect(ncpCurrentLimits.every((candidate) => candidate?.status === "needs_independent_review")).toBe(true);
    expect(ncpCurrentLimits.map((candidate) => canonicalStringify(candidate?.sourceCandidate?.observedConditions))).toEqual([
      canonicalStringify(ncpCurrentLimits[0]?.sourceCandidate?.observedConditions),
      canonicalStringify(ncpCurrentLimits[0]?.sourceCandidate?.observedConditions),
      canonicalStringify(ncpCurrentLimits[0]?.sourceCandidate?.observedConditions),
    ]);
    expect(ncpCurrentLimits[0]?.sourceCandidate?.observedConditions).toEqual([
      expect.objectContaining({ parameterId: "input-voltage", factsV2ParameterId: "input-voltage", minimum: { value: 4, unit: "V" }, maximum: { value: 5.5, unit: "V" } }),
      expect.objectContaining({ parameterId: "junction-temperature", factsV2ParameterId: "junction-temperature", minimum: { value: 298.15, unit: "K" }, maximum: { value: 298.15, unit: "K" } }),
      expect.objectContaining({ parameterId: "operating-mode", factsV2ParameterId: "operating-mode", setting: "normal-regulation" }),
      expect.objectContaining({ parameterId: "output-voltage", factsV2ParameterId: "output-voltage", minimum: { value: 1.2, unit: "V" }, maximum: { value: 1.2, unit: "V" } }),
    ]);
    expect(ncp1599?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/minimumOnTimeMaximum")).toMatchObject({
      status: "needs_independent_review",
      claimKind: "guaranteed_maximum",
      basis: "production_spread",
      sourceCandidate: {
        path: "facts.timing.minimumOnTime",
        valueSlot: "maximum",
        value: 50e-9,
        unit: "s",
        observedConditions: [
          expect.objectContaining({ parameterId: "input-voltage", minimum: { value: 3, unit: "V" }, maximum: { value: 5.5, unit: "V" } }),
          expect.objectContaining({ parameterId: "junction-temperature", minimum: { value: 298.15, unit: "K" }, maximum: { value: 298.15, unit: "K" } }),
          expect.objectContaining({ parameterId: "output-voltage", minimum: { value: 1.2, unit: "V" }, maximum: { value: 1.2, unit: "V" } }),
        ],
      },
    });
    expect(ncp1599?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/maximumJunctionTemperature")).toMatchObject({
      status: "needs_independent_review",
      claimKind: "absolute_maximum",
      basis: "absolute_rating",
      sourceCandidate: {
        path: "facts.thermal.maximumJunctionTemperature",
        valueSlot: "maximum",
        value: 423.15,
        unit: "K",
      },
    });
    const ncpFeedback = ncp1599?.claimCandidates.filter((candidate) => candidate.targetPath.startsWith("/facts/feedbackReference")) ?? [];
    expect(ncpFeedback).toHaveLength(3);
    expect(ncpFeedback.every((candidate) => candidate.status === "blocked_unrepresentable_condition")).toBe(true);
    expect(ncpFeedback.every((candidate) => candidate.sourceCandidate?.observedConditions.some((condition) =>
      condition.parameterId === "feedback-test-connection"
      && condition.factsV2ParameterId === null
      && condition.setting === "vfb-equals-vcomp"
    ))).toBe(true);
    for (const targetPath of ["/facts/highSideOnResistanceMaximum", "/facts/lowSideOnResistanceMaximum"]) {
      const candidate = ncp1599?.claimCandidates.find((entry) => entry.targetPath === targetPath);
      expect(candidate?.status).toBe("blocked_unrepresentable_condition");
      expect(candidate?.sourceCandidate?.observedConditions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          parameterId: "gate-source-voltage",
          factsV2ParameterId: null,
          minimum: { value: 5, unit: "V" },
          maximum: { value: 5, unit: "V" },
        }),
        expect.objectContaining({
          parameterId: "switch-current",
          factsV2ParameterId: "switch-current",
          minimum: { value: 0.1, unit: "A" },
          maximum: { value: 0.1, unit: "A" },
        }),
      ]));
    }
    expect(ncp1599?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/outputVoltageMinimum")?.status)
      .toBe("needs_condition_authoring_and_independent_review");

    const lm5145 = report.profileGaps.find((gap) => gap.profileId === "real.texas-instruments.lm5145rgyr");
    expect(lm5145?.unresolvedPaths).toContain("/facts/currentSenseThresholdOptions");
    expect(lm5145?.unresolvedPaths).toContain("/facts/gateDriveVoltageOptions");
    expect(lm5145?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/maximumJunctionTemperature")?.status)
      .toBe("blocked_semantic_mismatch");

    const lm70880 = report.profileGaps.find((gap) => gap.profileId === "real.texas-instruments.lm70880rrxr");
    expect(lm70880?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/inputVoltageMaximum")).toMatchObject({
      status: "needs_independent_review",
      sourceCandidate: { path: "facts.electrical.inputVoltage", valueSlot: "maximum", value: 80, unit: "V" },
    });
    expect(lm70880?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/currentLimitTypical")).toMatchObject({
      status: "blocked_missing_source_fact",
      sourceCandidate: { path: "facts.electrical.currentLimit", valueSlot: "typical", value: null, unit: "A" },
    });
    expect(lm70880?.claimCandidates.find((candidate) => candidate.targetPath === "/facts/maximumJunctionTemperature")).toMatchObject({
      status: "needs_independent_review",
      sourceCandidate: { path: "facts.thermal.maximumJunctionTemperature", valueSlot: "maximum", value: 423.15, unit: "K" },
    });
  });

  it("keeps hash-complete facts-V2 plans isolated while allowing only the bounded NCP1599 partial draft", () => {
    const plans = REAL_PRIMARY_PART_FACTS_V2_CANDIDATE_PROFILE_PLANS;
    const rebuilt = buildRealCatalogFactsV2CandidateProfilePlans();
    expect(rebuilt).not.toBe(plans);
    expect(canonicalStringify(rebuilt)).toBe(canonicalStringify(plans));
    expect(plans.map((plan) => plan.sourceProfileId)).toEqual([
      "real.analog-devices.lt8640siv-pbf",
      "real.analog-devices.ltc3891efe-pbf",
      "real.analog-devices.ltc3895efe-pbf",
      "real.onsemi.ncp1599mntwg",
      "real.texas-instruments.lm5145rgyr",
      "real.texas-instruments.lm70880rrxr",
      "real.texas-instruments.tps54302ddcr",
    ]);
    expect(plans.filter((plan) => plan.part.manufacturerId === "analog-devices")).toHaveLength(3);
    expect(plans.every((plan) => plan.sourceHashComplete)).toBe(true);
    expect(plans.every((plan) => plan.sourceBoundClaimCount > 0)).toBe(true);
    expect(plans.filter((plan) => plan.sourceProfileId !== "real.texas-instruments.lm70880rrxr")
      .every((plan) => plan.sourceBoundMandatoryEvidenceCount === 3)).toBe(true);
    expect(plans.find((plan) => plan.sourceProfileId === "real.texas-instruments.lm70880rrxr")?.sourceBoundMandatoryEvidenceCount)
      .toBe(2);
    expect(plans.filter((plan) => plan.status === "partial_non_admitted").map((plan) => plan.sourceProfileId))
      .toEqual(["real.onsemi.ncp1599mntwg"]);
    expect(plans.filter((plan) => plan.status === "needs_evidence")).toHaveLength(6);
    expect(plans.every((plan) => plan.independentReviewState === "pending")).toBe(true);
    expect(plans.every((plan) => plan.admissionState === "isolated_not_admitted")).toBe(true);
    expect(plans.every((plan) => plan.draftAuthorable === false)).toBe(true);
    expect(plans.every((plan) => plan.draftAuthoringBlockerCount === plan.draftAuthoringBlockers.length)).toBe(true);
    expect(plans.every((plan) => plan.draftAuthoringBlockerCount > 0)).toBe(true);
    expect(plans.filter((plan) => plan.draft !== null)).toHaveLength(1);
    expect(plans.filter((plan) => plan.draft === null).every((plan) =>
      plan.draftContentHash === null && plan.draftUnknownPaths.length === 0
    )).toBe(true);
    expect(Object.isFrozen(plans)).toBe(true);
    expect(plans.every(Object.isFrozen)).toBe(true);
    expectDeeplyFrozen(plans);
    for (const plan of plans) {
      expect(plan.schemaDraftBlockingPaths).toContain("/commonFacts/packageName");
      expect(plan.schemaDraftBlockingPaths).toContain("/facts/controlEvidenceBasis");
      expect(plan.schemaDraftBlockingPaths).toContain("/facts/mountedGeometry/boardArea");
      expect(plan.schemaDraftBlockingPaths).toContain("/facts/mountedGeometry/maximumHeight");
      expect(plan.schemaDraftBlockingPaths).toEqual([...new Set(plan.schemaDraftBlockingPaths)].sort());
      expect(plan.mandatoryEvidenceMap.map((entry) => entry.targetPath)).toEqual(plan.schemaDraftBlockingPaths);
      expect(plan.mandatoryEvidenceMap.every((entry) => entry.exactByteEvidence.length > 0)).toBe(true);
      expect(plan.mandatoryEvidenceMap.every((entry) => entry.blockingReason.length > 0 && entry.requiredResolution.length > 0)).toBe(true);
      expect(plan.mandatoryEvidenceMap.filter((entry) => entry.status === "source_bound_pending_independent_review"))
        .toHaveLength(plan.sourceProfileId === "real.texas-instruments.lm70880rrxr" ? 2 : 3);
      const sourceProfile = REAL_PRIMARY_PART_CATALOG.profiles.find((profile) => profile.profileId === plan.sourceProfileId);
      expect(sourceProfile).toBeDefined();
      const sourceById = new Map(sourceProfile?.sources.map((source) => [source.sourceId, source]));
      for (const entry of plan.mandatoryEvidenceMap) {
        const evidenceKeys = entry.exactByteEvidence.map((evidence) => `${evidence.sourceId}\u0000${evidence.locator}`);
        expect(evidenceKeys).toEqual([...new Set(evidenceKeys)].sort());
        for (const evidence of entry.exactByteEvidence) {
          expect(sourceById.get(evidence.sourceId)?.contentHash).toEqual({
            state: "verified",
            value: evidence.contentHash,
            reason: null,
          });
        }
      }
      expect(plan.admissionUnresolvedPaths).toEqual([...new Set(plan.admissionUnresolvedPaths)].sort());
      expect(plan.draftAuthoringBlockers.map((blocker) => `${blocker.targetPath}\u0000${blocker.source}\u0000${blocker.code}`))
        .toEqual([...plan.draftAuthoringBlockers.map((blocker) => `${blocker.targetPath}\u0000${blocker.source}\u0000${blocker.code}`)].sort());
      expect(plan.draftAuthoringBlockers.every((blocker) => blocker.source === "claim_candidate" || blocker.source === "mandatory_evidence")).toBe(true);
      expect(plan.draftAuthoringBlockers.every((blocker) => blocker.reason.length > 0 && blocker.requiredResolution.length > 0)).toBe(true);
      expect(plan.draftAuthoringBlockers.every((blocker) => blocker.groupMemberPaths.includes(blocker.targetPath))).toBe(true);
      expect(plan.draftAuthoringBlockers.every((blocker) =>
        blocker.groupMemberPaths.length > 0
        && blocker.groupMemberPaths.join("\u0000") === [...new Set(blocker.groupMemberPaths)].sort().join("\u0000")
      )).toBe(true);
    }

    const expectedAreas = new Map([
      ["real.analog-devices.lt8640siv-pbf", 20.7025e-6],
      ["real.analog-devices.ltc3891efe-pbf", 42.545e-6],
      ["real.analog-devices.ltc3895efe-pbf", 62.7455e-6],
      ["real.onsemi.ncp1599mntwg", 8.606e-6],
      ["real.texas-instruments.lm5145rgyr", 14.19e-6],
      ["real.texas-instruments.tps54302ddcr", 9.5e-6],
    ]);
    for (const plan of plans) {
      const boardAreaEntry = plan.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/mountedGeometry/boardArea");
      if (plan.sourceProfileId === "real.texas-instruments.lm70880rrxr") {
        expect(boardAreaEntry).toMatchObject({
          status: "blocked_missing_profile_evidence",
          candidate: null,
        });
        continue;
      }
      const boardArea = boardAreaEntry?.candidate;
      expect(boardArea?.kind).toBe("board_area_projection");
      if (boardArea?.kind !== "board_area_projection") throw new Error("Expected board-area candidate");
      expect(boardArea.area.value).toBe(expectedAreas.get(plan.sourceProfileId));
      const xSpan = boardArea.sourceDimensions.filter((term) => term.axis === "x")
        .reduce((sum, term) => sum + term.multiplier * term.maximum.value, 0);
      const ySpan = boardArea.sourceDimensions.filter((term) => term.axis === "y")
        .reduce((sum, term) => sum + term.multiplier * term.maximum.value, 0);
      expect(boardArea.area.value).toBeCloseTo(xSpan * ySpan, 15);
      expect(boardArea.sourceDimensions.map((term) => `${term.axis}\u0000${term.dimensionId}`))
        .toEqual([...boardArea.sourceDimensions.map((term) => `${term.axis}\u0000${term.dimensionId}`)].sort());
    }

    const adiPlans = plans.filter((plan) => plan.part.manufacturerId === "analog-devices");
    const adiDatasheetHashes = new Map([
      ["adi-lt8640s-datasheet", "sha256:489bb5559a2103cb9f90b59ae9e6e45b7a4e06f5c3df8c7154a9e23c5f457ecc"],
      ["adi-ltc3891-datasheet", "sha256:21a46463d6a45e3ce64349c2359866de6eeb819a33372c909f1426af8ef1aba6"],
      ["adi-ltc3895-datasheet", "sha256:33b389917fddb3be0e9e549217a41b791445c8acb34349dfe711a9e786105c09"],
    ]);
    for (const plan of adiPlans) {
      for (const entry of plan.mandatoryEvidenceMap) {
        expect(entry.exactByteEvidence.length).toBeGreaterThan(0);
        for (const evidence of entry.exactByteEvidence) {
          expect(evidence.sourceType).toBe("manufacturer_datasheet");
          expect(evidence.contentHash).toBe(adiDatasheetHashes.get(evidence.sourceId));
        }
      }
    }

    const lt8640sPlan = plans.find((plan) => plan.sourceProfileId === "real.analog-devices.lt8640siv-pbf");
    expect(lt8640sPlan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/commonFacts/packageName")?.candidate).toEqual({
      kind: "text",
      value: "24-lead 4 mm x 4 mm x 0.94 mm LQFN with QFN footprint",
    });
    expect(lt8640sPlan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/controlEvidenceBasis")).toMatchObject({
      status: "blocked_missing_profile_evidence",
      candidate: null,
    });
    expect(lt8640sPlan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/mountedGeometry/maximumHeight")?.candidate)
      .toMatchObject({ kind: "maximum_height", height: { value: 1.03e-3, unit: "m" } });

    const lm70880Plan = plans.find((plan) => plan.sourceProfileId === "real.texas-instruments.lm70880rrxr");
    expect(lm70880Plan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/commonFacts/packageName")?.candidate).toEqual({
      kind: "text",
      value: "VQFN (RRX), 29-pin",
    });
    expect(lm70880Plan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/controlEvidenceBasis")).toMatchObject({
      status: "blocked_missing_profile_evidence",
      candidate: null,
    });
    expect(lm70880Plan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/mountedGeometry/boardArea")).toMatchObject({
      status: "blocked_missing_profile_evidence",
      candidate: null,
      blockingReason: expect.stringContaining("reference-only"),
      requiredResolution: expect.stringContaining("bounded maximum land-pattern extents"),
      exactByteEvidence: [expect.objectContaining({
        sourceId: "ti-lm70880-datasheet",
        locator: expect.stringContaining("asymmetric 3.2 mm and 2.9 mm"),
        contentHash: "sha256:f6115dacb305ac44d58d1985647095d05406861532e22d8d8643cb215561f3dc",
      })],
    });
    expect(lm70880Plan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/mountedGeometry/maximumHeight")?.candidate)
      .toMatchObject({ kind: "maximum_height", height: { value: 1e-3, unit: "m" } });

    const ncpPlan = plans.find((plan) => plan.sourceProfileId === "real.onsemi.ncp1599mntwg");
    expect(ncpPlan).toMatchObject({
      status: "partial_non_admitted",
      draftAuthorable: false,
      independentReviewState: "pending",
      admissionState: "isolated_not_admitted",
      draftContentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });
    if (ncpPlan?.draft === null || ncpPlan?.draft === undefined) throw new Error("Expected bounded NCP1599 partial draft");
    const bundledDocuments = getBundledDesignLibraryDocuments();
    expect(canonicalStringify(bundledDocuments.profiles[
      "packages/design-library/parts/power.integrated-synchronous-buck-regulator/onsemi/NCP1599MNTWG.json"
    ])).toBe(canonicalStringify(ncpPlan.draft));
    expect(ncpPlan.draftUnknownPaths).toEqual([
      "/commonFacts/boardArea",
      "/commonFacts/maximumHeight",
      "/facts/controlEvidenceBasis",
      "/facts/fallTimeMaximum",
      "/facts/feedbackReferenceMaximum",
      "/facts/feedbackReferenceMinimum",
      "/facts/feedbackReferenceTypical",
      "/facts/highSideOnResistanceMaximum",
      "/facts/junctionToAmbientThermalResistanceMaximum",
      "/facts/lowSideOnResistanceMaximum",
      "/facts/minimumOffTimeMaximum",
      "/facts/outputCurrentCapabilityMinimum",
      "/facts/outputVoltageMaximum",
      "/facts/outputVoltageMinimum",
      "/facts/quiescentCurrentMaximum",
      "/facts/riseTimeMaximum",
      "/facts/switchingFrequencyMaximum",
      "/facts/switchingFrequencyMinimum",
      "/facts/switchingFrequencyRecommended",
    ]);
    expect(ncpPlan.draftContentHash).toBe(designProfileEnvelopeContentHash(ncpPlan.draft));
    const registry = bundledDocuments.manufacturerRegistry as ManufacturerRegistryV1;
    expect(validateDesignProfileEnvelope(ncpPlan.draft, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(ncpPlan.draft).length).toBeGreaterThan(0);
    expect(ncpPlan.draft.commonFacts.packageName).toMatchObject({
      value: "DFN6 3 mm x 3 mm, 0.95 mm pitch (CASE 506AH)",
      state: "estimated",
    });
    expect(ncpPlan.draft.facts.mountedGeometry).toMatchObject({
      boardArea: { state: "calculated", value: { area: { value: 8.606e-6, unit: "m2" } } },
      maximumHeight: { value: { height: { value: 1e-3, unit: "m" } } },
    });
    expect([
      ncpPlan.draft.facts.inputVoltageMinimum.value?.value,
      ncpPlan.draft.facts.inputVoltageMaximum.value?.value,
      ncpPlan.draft.facts.currentLimitMinimum.value?.value,
      ncpPlan.draft.facts.currentLimitTypical.value?.value,
      ncpPlan.draft.facts.currentLimitMaximum.value?.value,
      ncpPlan.draft.facts.minimumOnTimeMaximum.value?.value,
      ncpPlan.draft.facts.maximumJunctionTemperature.value?.value,
    ]).toEqual([3, 5.5, 3.83, 4.18, 4.54, 50e-9, 423.15]);
    expect([
      ncpPlan.draft.facts.currentLimitMinimum,
      ncpPlan.draft.facts.currentLimitTypical,
      ncpPlan.draft.facts.currentLimitMaximum,
    ].map((claim) => canonicalStringify(claim.validFor))).toEqual([
      canonicalStringify(ncpPlan.draft.facts.currentLimitMinimum.validFor),
      canonicalStringify(ncpPlan.draft.facts.currentLimitMinimum.validFor),
      canonicalStringify(ncpPlan.draft.facts.currentLimitMinimum.validFor),
    ]);
    expect(ncpPlan.draft.facts.currentLimitMinimum.validFor.map((condition) => condition.parameterId)).toEqual([
      "input-voltage",
      "junction-temperature",
      "operating-mode",
      "output-voltage",
    ]);
    expect(ncpPlan.draft.facts.minimumOnTimeMaximum.validFor.map((condition) => condition.parameterId)).toEqual([
      "input-voltage",
      "junction-temperature",
      "output-voltage",
    ]);
    for (const unknown of [
      ncpPlan.draft.facts.switchingFrequencyRecommended,
      ncpPlan.draft.facts.outputCurrentCapabilityMinimum,
      ncpPlan.draft.facts.controlEvidenceBasis,
      ncpPlan.draft.facts.junctionToAmbientThermalResistanceMaximum,
      ncpPlan.draft.facts.highSideOnResistanceMaximum,
      ncpPlan.draft.facts.lowSideOnResistanceMaximum,
    ]) {
      expect(unknown).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    }

    const adiExternalPlans = plans.filter((plan) => (
      plan.sourceProfileId === "real.analog-devices.ltc3891efe-pbf"
      || plan.sourceProfileId === "real.analog-devices.ltc3895efe-pbf"
    ));
    const expectedOptionCounts = new Map([
      ["real.analog-devices.ltc3891efe-pbf", { currentSense: 3, gateDrive: 2 }],
      ["real.analog-devices.ltc3895efe-pbf", { currentSense: 3, gateDrive: 7 }],
    ]);
    for (const plan of adiExternalPlans) {
      const expectedCounts = expectedOptionCounts.get(plan.sourceProfileId);
      for (const [targetPath, expectedCount] of [
        ["/facts/currentSenseThresholdOptions", expectedCounts?.currentSense],
        ["/facts/gateDriveVoltageOptions", expectedCounts?.gateDrive],
      ] as const) {
        const entry = plan.mandatoryEvidenceMap.find((candidate) => candidate.targetPath === targetPath);
        expect(entry?.status).toBe("blocked_unrepresentable_condition");
        expect(entry?.candidate?.kind).toBe("configured_production_spread_observations");
        if (entry?.candidate?.kind !== "configured_production_spread_observations") throw new Error("Expected configured production-spread observations");
        expect(entry.candidate.options).toHaveLength(expectedCount ?? -1);
        for (const option of entry.candidate.options) {
          expect(option.minimum.unit).toBe("V");
          expect(option.typical.unit).toBe("V");
          expect(option.maximum.unit).toBe("V");
          expect(option.minimum.value).toBeLessThanOrEqual(option.typical.value);
          expect(option.typical.value).toBeLessThanOrEqual(option.maximum.value);
          const conditionIds = option.observedConditions.map((condition) => condition.parameterId);
          expect(conditionIds).toEqual([...new Set(conditionIds)].sort());
          expect(option.sourceRequiredConditionIds).toEqual(conditionIds);
          expect(option.factsV2RequiredConditionIds).toEqual(["input-voltage", "junction-temperature"]);
          expect(option.observedConditions.some((condition) => condition.factsV2ParameterId === null)).toBe(true);
          for (const condition of option.observedConditions) {
            expect((condition.setting === null) !== (condition.minimum === null && condition.maximum === null)).toBe(true);
          }
        }
      }
      expect(plan.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/controlEvidenceBasis")).toMatchObject({
        status: "blocked_missing_profile_evidence",
        candidate: null,
      });
      expect(plan.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/mountedGeometry/maximumHeight")?.candidate)
        .toMatchObject({ kind: "maximum_height", height: { value: 1.2e-3, unit: "m" } });
    }
    const ltc3891Plan = plans.find((plan) => plan.sourceProfileId === "real.analog-devices.ltc3891efe-pbf");
    const ltc3891Sense = ltc3891Plan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/currentSenseThresholdOptions");
    if (ltc3891Sense?.candidate?.kind !== "configured_production_spread_observations") throw new Error("Expected LTC3891 current-sense observations");
    expect(ltc3891Sense.candidate.options.map((option) => [option.settingId, option.minimum.value, option.typical.value, option.maximum.value])).toEqual([
      ["ilim-ground", 0.022, 0.03, 0.036],
      ["ilim-intvcc", 0.043, 0.05, 0.057],
      ["ilim-float", 0.064, 0.075, 0.085],
    ]);
    expect(ltc3891Sense.blockingReason).toContain("RSENSE or inductor-DCR network remains an application choice");
    const ltc3895Plan = plans.find((plan) => plan.sourceProfileId === "real.analog-devices.ltc3895efe-pbf");
    const ltc3895Sense = ltc3895Plan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/currentSenseThresholdOptions");
    if (ltc3895Sense?.candidate?.kind !== "configured_production_spread_observations") throw new Error("Expected LTC3895 current-sense observations");
    expect(ltc3895Sense.candidate.options.map((option) => [option.settingId, option.minimum.value, option.typical.value, option.maximum.value])).toEqual([
      ["ilim-float", 0.066, 0.075, 0.084],
      ["ilim-ground", 0.043, 0.05, 0.057],
      ["ilim-intvcc", 0.09, 0.1, 0.109],
    ]);
    const ltc3895Gate = ltc3895Plan?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/gateDriveVoltageOptions");
    if (ltc3895Gate?.candidate?.kind !== "configured_production_spread_observations") throw new Error("Expected LTC3895 gate-drive observations");
    expect(ltc3895Gate.candidate.options.map((option) => option.settingId)).toEqual([
      "ndrv-external-6v",
      "ndrv-external-10v",
      "internal-vin-ldo-6v",
      "internal-vin-ldo-10v",
      "internal-extvcc-ldo-6v",
      "internal-extvcc-ldo-10v",
      "programmable-70kohm",
    ]);
    expect(ltc3895Gate.blockingReason).toContain("50 kohm and 90 kohm programmable rows provide typical values only");

    const external = plans.find((plan) => plan.sourceProfileId === "real.texas-instruments.lm5145rgyr");
    expect(external?.schemaDraftBlockingPaths).toEqual([
      "/commonFacts/packageName",
      "/facts/controlEvidenceBasis",
      "/facts/currentSenseThresholdOptions",
      "/facts/gateDriveVoltageOptions",
      "/facts/mountedGeometry/boardArea",
      "/facts/mountedGeometry/maximumHeight",
    ]);
    const currentSense = external?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/currentSenseThresholdOptions");
    expect(currentSense).toMatchObject({
      status: "blocked_missing_profile_evidence",
      candidate: null,
    });
    expect(currentSense?.blockingReason).toContain("external RILIM");
    const gateDrive = external?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/gateDriveVoltageOptions");
    expect(gateDrive?.status).toBe("blocked_unrepresentable_condition");
    expect(gateDrive?.candidate?.kind).toBe("configured_production_spread_observation");
    if (gateDrive?.candidate?.kind !== "configured_production_spread_observation") throw new Error("Expected gate-drive observation");
    expect(gateDrive.candidate).toMatchObject({
      settingId: "internal-vcc-regulator",
      minimum: { value: 7.3, unit: "V" },
      typical: { value: 7.5, unit: "V" },
      maximum: { value: 7.7, unit: "V" },
      sourceRequiredConditionIds: [
        "input-voltage",
        "junction-temperature",
        "ss-trk-voltage",
        "vcc-output-current",
      ],
      factsV2RequiredConditionIds: ["input-voltage", "junction-temperature"],
    });
    expect(gateDrive.candidate.observedConditions.map((condition) => condition.parameterId)).toEqual([
      "input-voltage",
      "junction-temperature",
      "ss-trk-voltage",
      "vcc-output-current",
    ]);
    expect(gateDrive.candidate.sourceRequiredConditionIds)
      .toEqual(gateDrive.candidate.observedConditions.map((condition) => condition.parameterId));
    expect(gateDrive.candidate.factsV2RequiredConditionIds).toEqual(
      gateDrive.candidate.observedConditions
        .filter((condition) => condition.factsV2ParameterId !== null)
        .map((condition) => condition.factsV2ParameterId),
    );
    expect(gateDrive.candidate.observedConditions.filter((condition) => condition.factsV2ParameterId === null).map((condition) => condition.parameterId)).toEqual([
      "ss-trk-voltage",
      "vcc-output-current",
    ]);
    expect(external?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/controlEvidenceBasis")).toMatchObject({
      status: "blocked_missing_profile_evidence",
      candidate: null,
    });
    const frozenArea = external?.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/mountedGeometry/boardArea")?.candidate;
    expect(() => {
      if (frozenArea?.kind === "board_area_projection") (frozenArea.area as { value: number }).value = 1;
    }).toThrow();
    expect(REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT.factsV2DraftCount).toBe(1);
    expect(REAL_PRIMARY_PART_ADMISSION_GAP_REPORT.admissionEligibleProfileCount).toBe(1);
    expect(REAL_PRIMARY_PART_ADMISSION_GAP_REPORT.admissionBlockerCount).toBe(6);
  });

  it("selects the bounded NCP1599 partial draft without implying review or admission", () => {
    const assessment = REAL_PRIMARY_PART_FACTS_V2_DRAFT_AUTHORING_ASSESSMENT;
    const rebuilt = buildRealCatalogFactsV2DraftAuthoringAssessment();
    expect(canonicalStringify(rebuilt)).toBe(canonicalStringify(assessment));
    expect(assessment).toMatchObject({
      selectedProfileId: "real.onsemi.ncp1599mntwg",
      selectedScore: {
        draftAuthoringBlockerCount: 15,
        sourceBoundClaimCount: 15,
        sourceBoundMandatoryEvidenceCount: 3,
        candidateValueCount: 17,
      },
      authorableProfileCount: 0,
      authorableProfileIds: [],
      decision: "partial_non_admitted_draft",
      independentReviewState: "pending",
      admissionState: "isolated_not_admitted",
      draft: expect.objectContaining({
        factsSchemaVersion: "2.0.0",
        part: { manufacturerId: "onsemi", manufacturerPartNumber: "NCP1599MNTWG" },
      }),
    });
    expect(assessment.evaluatedProfileIds).toEqual([
      "real.analog-devices.lt8640siv-pbf",
      "real.analog-devices.ltc3891efe-pbf",
      "real.analog-devices.ltc3895efe-pbf",
      "real.onsemi.ncp1599mntwg",
      "real.texas-instruments.lm5145rgyr",
      "real.texas-instruments.lm70880rrxr",
      "real.texas-instruments.tps54302ddcr",
    ]);
    expect(assessment.selectedProfileBlockers.filter((blocker) => blocker.code === "needs_condition_authoring_and_independent_review")).toHaveLength(3);
    expect(assessment.selectedProfileBlockers.filter((blocker) => blocker.code === "blocked_unrepresentable_condition")).toHaveLength(5);
    expect(assessment.selectedProfileBlockers.filter((blocker) => blocker.code === "blocked_missing_source_fact")).toHaveLength(4);
    expect(assessment.selectedProfileBlockers.filter((blocker) => blocker.code === "blocked_semantic_mismatch")).toHaveLength(2);
    expect(assessment.selectedProfileBlockers.filter((blocker) => blocker.code === "blocked_missing_profile_evidence")).toHaveLength(1);
    expect(assessment.selectedProfileBlockers.find((blocker) => blocker.targetPath === "/facts/controlEvidenceBasis")).toMatchObject({
      source: "mandatory_evidence",
      code: "blocked_missing_profile_evidence",
      exactByteEvidence: expect.arrayContaining([expect.objectContaining({
        sourceId: "onsemi-ncp1599-datasheet",
        contentHash: "sha256:40e0c29696d6adb4b35e8f331fc404d5c4efab35a15f8b449223c97931fc5650",
      })]),
    });
    expect(assessment.selectedProfileBlockers.some((blocker) => blocker.targetPath === "/facts/minimumOnTimeMaximum")).toBe(false);
    expect(assessment.selectedProfileBlockers.some((blocker) => blocker.targetPath === "/facts/maximumJunctionTemperature")).toBe(false);
    expect(assessment.selectedProfileBlockers.some((blocker) => blocker.targetPath.startsWith("/facts/currentLimit"))).toBe(false);
    expect(assessment.selectedProfileBlockers.some((blocker) => blocker.targetPath === "/facts/outputCurrentCapabilityMinimum")).toBe(true);
    for (const blocker of assessment.selectedProfileBlockers.filter((entry) => entry.targetPath.startsWith("/facts/feedbackReference"))) {
      expect(blocker).toMatchObject({
        groupPath: "/facts/feedbackReference",
        groupMemberPaths: [
          "/facts/feedbackReferenceMaximum",
          "/facts/feedbackReferenceMinimum",
          "/facts/feedbackReferenceTypical",
        ],
        code: "blocked_unrepresentable_condition",
      });
    }
    expectDeeplyFrozen(assessment);
    expect(REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT.factsV2DraftCount).toBe(1);
    expect(REAL_PRIMARY_PART_ADMISSION_GAP_REPORT.admissionEligibleProfileCount).toBe(1);

    const silentlyAuthorable = structuredClone(REAL_PRIMARY_PART_FACTS_V2_CANDIDATE_PROFILE_PLANS);
    const firstPlan = silentlyAuthorable[0];
    if (firstPlan === undefined) throw new Error("Expected an authoring plan");
    (firstPlan as unknown as { draftAuthoringBlockerCount: number }).draftAuthoringBlockerCount = 0;
    (firstPlan as unknown as { draftAuthoringBlockers: unknown[] }).draftAuthoringBlockers = [];
    expect(() => buildRealCatalogFactsV2DraftAuthoringAssessment(silentlyAuthorable))
      .toThrow(/Facts-V2 draft is authorable and must not remain null/);

    const tamperedDraftPlans = structuredClone(REAL_PRIMARY_PART_FACTS_V2_CANDIDATE_PROFILE_PLANS);
    const tamperedNcp = tamperedDraftPlans.find((plan) => plan.sourceProfileId === "real.onsemi.ncp1599mntwg");
    if (tamperedNcp?.draft === null || tamperedNcp?.draft === undefined) throw new Error("Expected partial draft");
    const currentLimitMaximum = object(object(object(tamperedNcp.draft).facts).currentLimitMaximum);
    object(currentLimitMaximum.value).value = 4.55;
    expect(() => buildRealCatalogFactsV2DraftAuthoringAssessment(tamperedDraftPlans))
      .toThrow(/partial draft content hash mismatch/);

    const tamperedUnknownMembership = structuredClone(REAL_PRIMARY_PART_FACTS_V2_CANDIDATE_PROFILE_PLANS);
    const membershipNcp = tamperedUnknownMembership.find((plan) => plan.sourceProfileId === "real.onsemi.ncp1599mntwg");
    if (membershipNcp === undefined) throw new Error("Expected NCP plan");
    (membershipNcp.draftUnknownPaths as string[]).pop();
    expect(() => buildRealCatalogFactsV2DraftAuthoringAssessment(tamperedUnknownMembership))
      .toThrow(/plan unknown path membership mismatch/);

    const tamperedReadiness = structuredClone(REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT) as unknown as JsonObject;
    const readinessNcp = array(tamperedReadiness.profileGaps).find((gap) => object(gap).profileId === "real.onsemi.ncp1599mntwg");
    const readinessCurrentMaximum = array(object(readinessNcp).claimCandidates).find((candidate) => object(candidate).targetPath === "/facts/currentLimitMaximum");
    object(object(readinessCurrentMaximum).sourceCandidate).value = 4.55;
    expect(() => buildRealCatalogFactsV2CandidateProfilePlans(
      REAL_PRIMARY_PART_CATALOG,
      tamperedReadiness as unknown as typeof REAL_PRIMARY_PART_FACTS_V2_READINESS_REPORT,
    )).toThrow(/Candidate readiness mismatch/);
  });

  it("fails closed when candidate evidence identity or exact-byte hashes are tampered", () => {
    const wrongIdentity = structuredClone(REAL_PRIMARY_PART_CATALOG) as unknown as JsonObject;
    const ncpProfile = array(wrongIdentity.profiles).find((profile) => object(profile).profileId === "real.onsemi.ncp1599mntwg");
    object(object(object(ncpProfile).identity).part).manufacturerPartNumber = "NCP1599MNTWG-TAMPERED";
    expect(() => buildRealCatalogFactsV2CandidateProfilePlans(wrongIdentity as unknown as typeof REAL_PRIMARY_PART_CATALOG))
      .toThrow(/Candidate evidence identity mismatch/);

    const wrongHash = structuredClone(REAL_PRIMARY_PART_CATALOG) as unknown as JsonObject;
    const lmProfile = array(wrongHash.profiles).find((profile) => object(profile).profileId === "real.texas-instruments.lm5145rgyr");
    const lmSource = array(object(lmProfile).sources).find((source) => object(source).sourceId === "ti-lm5145-datasheet");
    object(object(lmSource).contentHash).value = `sha256:${"0".repeat(64)}`;
    expect(() => buildRealCatalogFactsV2CandidateProfilePlans(wrongHash as unknown as typeof REAL_PRIMARY_PART_CATALOG))
      .toThrow(/Exact-byte source hash mismatch/);

    const adiCases = [
      ["real.analog-devices.lt8640siv-pbf", "adi-lt8640s-datasheet"],
      ["real.analog-devices.ltc3891efe-pbf", "adi-ltc3891-datasheet"],
      ["real.analog-devices.ltc3895efe-pbf", "adi-ltc3895-datasheet"],
    ] as const;
    for (const [profileId, sourceId] of adiCases) {
      const changedIdentity = structuredClone(REAL_PRIMARY_PART_CATALOG) as unknown as JsonObject;
      const identityProfile = array(changedIdentity.profiles).find((profile) => object(profile).profileId === profileId);
      object(object(object(identityProfile).identity).part).manufacturerPartNumber = "TAMPERED#PBF";
      expect(() => buildRealCatalogFactsV2CandidateProfilePlans(changedIdentity as unknown as typeof REAL_PRIMARY_PART_CATALOG))
        .toThrow(/Candidate evidence identity mismatch/);

      const changedHash = structuredClone(REAL_PRIMARY_PART_CATALOG) as unknown as JsonObject;
      const hashProfile = array(changedHash.profiles).find((profile) => object(profile).profileId === profileId);
      const hashSource = array(object(hashProfile).sources).find((source) => object(source).sourceId === sourceId);
      object(object(hashSource).contentHash).value = `sha256:${"0".repeat(64)}`;
      expect(() => buildRealCatalogFactsV2CandidateProfilePlans(changedHash as unknown as typeof REAL_PRIMARY_PART_CATALOG))
        .toThrow(/Exact-byte source hash mismatch/);
    }

    const changedUrl = structuredClone(REAL_PRIMARY_PART_CATALOG) as unknown as JsonObject;
    const ltc3895Profile = array(changedUrl.profiles).find((profile) => object(profile).profileId === "real.analog-devices.ltc3895efe-pbf");
    const ltc3895Source = array(object(ltc3895Profile).sources).find((source) => object(source).sourceId === "adi-ltc3895-datasheet");
    object(ltc3895Source).url = "https://www.analog.com/media/en/technical-documentation/data-sheets/different.pdf";
    expect(() => buildRealCatalogFactsV2CandidateProfilePlans(changedUrl as unknown as typeof REAL_PRIMARY_PART_CATALOG))
      .toThrow(/Exact-byte source identity mismatch/);
  });
});
