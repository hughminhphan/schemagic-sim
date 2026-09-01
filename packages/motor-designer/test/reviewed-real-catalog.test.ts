import { readdirSync } from "node:fs";
import { getInstalledMotorRecipeRefsV2 } from "@opencircuit/design-engine/v2-motor-runtime";
import { getBundledReviewedReleaseDocuments } from "@opencircuit/design-library/bundled-reviewed-release";
import type { EvidenceRef } from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import { generateMotorDesign, MOTOR_DESIGN_LIBRARY } from "../src";
import { M1_COMPACT_REQUEST, M2_POWER_REQUEST } from "../src/fixtures";
import {
  GATE_DRIVER_FACT_IDS,
  INTEGRATED_BRIDGE_FACT_IDS,
  REVIEWED_REAL_LICENSE_NOTE,
  REVIEWED_REAL_MANUFACTURER_ALLOWLIST,
  REVIEWED_REAL_MOTOR_FACTS_V2_CANDIDATE_PROFILE_PLANS,
  REVIEWED_REAL_MOTOR_FACTS_V2_DRAFT_AUTHORING_ASSESSMENT,
  REVIEWED_REAL_MOTOR_CATALOG,
  REVIEWED_REAL_MOTOR_CATALOG_REPORT,
  assertValidReviewedRealMotorCatalog,
  buildReviewedRealCatalogReport,
  buildReviewedRealMotorFactsV2CandidateProfilePlans,
  buildReviewedRealMotorFactsV2DraftAuthoringAssessment,
  type ReviewedFact,
  type ReviewedRealMotorCatalog,
  type ReviewedRealMotorProfile,
} from "../src/reviewed-real";

function cloneCatalog(): ReviewedRealMotorCatalog {
  return structuredClone(REVIEWED_REAL_MOTOR_CATALOG);
}

const CURRENT_SHUNT_PROFILE_PATH = "packages/design-library/parts/shared.current-sense-resistor/bourns/CRA2512-FZ-R020ELF.json";
const EXTERNAL_NMOS_PROFILE_PATH = "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json";
const SUPPLY_TVS_PROFILE_PATH = "packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json";
const GENERAL_RESISTOR_PROFILE_PATHS = [
  "packages/design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json",
  "packages/design-library/parts/shared.general-purpose-resistor/panasonic-industry/ERJ3EKF1003V.json",
  "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603100KFKEA.json",
  "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json",
] as const;
const NOMINAL_10UF_MLCC_PROFILE_PATHS = [
  "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
  "packages/design-library/parts/shared.mlcc-capacitor/samsung-electro-mechanics/CL31A106KBHNNNE.json",
  "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C3216X7R1H106K160AC.json",
] as const;

function cloneReviewedDocuments(): any {
  return structuredClone(getBundledReviewedReleaseDocuments());
}

function mutableValueAtPath(value: any, path: string): any {
  return path.split("/").slice(1).reduce((cursor, token) => cursor[token], value);
}

function deleteValueAtPath(value: any, path: string): void {
  const tokens = path.split("/").slice(1);
  const leaf = tokens.pop()!;
  const parent = tokens.reduce((cursor, token) => cursor[token], value);
  delete parent[leaf];
}

function allProfiles(catalog = REVIEWED_REAL_MOTOR_CATALOG): ReviewedRealMotorProfile[] {
  return [...catalog.integratedBridges, ...catalog.gateDrivers];
}

function profileEvidence(profile: ReviewedRealMotorProfile): EvidenceRef[] {
  const factIds = profile.kind === "integrated_bridge" ? INTEGRATED_BRIDGE_FACT_IDS : GATE_DRIVER_FACT_IDS;
  const facts = profile.facts as Record<string, ReviewedFact>;
  return [
    ...profile.identityEvidence,
    ...profile.package.name.evidence,
    ...profile.package.bodyAreaM2.evidence,
    ...factIds.flatMap((id) => facts[id]!.evidence),
  ];
}

function addKey(value: object, key: string): void {
  (value as Record<string, unknown>)[key] = true;
}

describe("reviewed-real Motor A4 primary-source tranche", () => {
  it("validates seven exact real MPNs across five stable manufacturer identities", () => {
    expect(() => assertValidReviewedRealMotorCatalog(REVIEWED_REAL_MOTOR_CATALOG)).not.toThrow();
    expect(REVIEWED_REAL_MOTOR_CATALOG.integratedBridges).toHaveLength(4);
    expect(REVIEWED_REAL_MOTOR_CATALOG.gateDrivers).toHaveLength(3);
    expect(new Set(allProfiles().map((profile) => profile.part.manufacturerId))).toHaveLength(5);
    expect(REVIEWED_REAL_MOTOR_CATALOG.schemaVersion).toBe("motor-primary-source-tranche.v1alpha2");
    expect(REVIEWED_REAL_MOTOR_CATALOG.provenanceState).toBe("authored_from_primary_sources");
    expect(REVIEWED_REAL_MANUFACTURER_ALLOWLIST).toEqual([
      { id: "texas-instruments", displayName: "Texas Instruments", primarySourceHosts: ["ti.com", "www.ti.com"] },
      { id: "stmicroelectronics", displayName: "STMicroelectronics", primarySourceHosts: ["st.com"] },
      { id: "toshiba-semiconductor-storage", displayName: "Toshiba Electronic Devices & Storage", primarySourceHosts: ["toshiba.semicon-storage.com"] },
      { id: "allegro-microsystems", displayName: "Allegro MicroSystems", primarySourceHosts: ["allegromicro.com", "www.allegromicro.com"] },
      { id: "renesas-electronics", displayName: "Renesas Electronics", primarySourceHosts: ["renesas.com", "www.renesas.com"] },
    ]);
    expect(Object.isFrozen(REVIEWED_REAL_MANUFACTURER_ALLOWLIST)).toBe(true);
    expect(REVIEWED_REAL_MANUFACTURER_ALLOWLIST.every((entry) => Object.isFrozen(entry) && Object.isFrozen(entry.primarySourceHosts))).toBe(true);
    expect(allProfiles().map((profile) => profile.part.manufacturerPartNumber)).toEqual([
      "DRV8876PWPR",
      "STSPIN840",
      "TB67H450AFNG(O,EL)",
      "DRV8262DDVR",
      "DRV8701ERGER",
      "A3941KLPTR-T",
      "HIP4081AIBZ",
    ]);
    for (const profile of allProfiles()) {
      expect(profile.authorship).toEqual(expect.objectContaining({
        provenanceState: "authored_from_primary_sources",
        catalogAdmission: "pending_independent_review",
        ownerTrack: "motor",
        authoredAt: expect.any(String),
      }));
      expect(profile.id).not.toMatch(/synthetic/i);
      expect(profile.part.manufacturerPartNumber).not.toMatch(/synthetic/i);
    }
  });

  it("gives every populated field official URL, locator, retrieval, hash where captured, and non-redistribution provenance", () => {
    for (const profile of allProfiles()) {
      const manufacturer = REVIEWED_REAL_MOTOR_CATALOG.manufacturers.find((entry) => entry.id === profile.part.manufacturerId)!;
      const factIds = profile.kind === "integrated_bridge" ? INTEGRATED_BRIDGE_FACT_IDS : GATE_DRIVER_FACT_IDS;
      const facts = profile.facts as Record<string, ReviewedFact>;
      for (const id of factIds) {
        const fact = facts[id]!;
        if (fact.state === "reviewed") expect(fact.evidence.length, `${profile.id}.${id}`).toBeGreaterThan(0);
        else expect(fact).toEqual(expect.objectContaining({ value: null, state: "unknown", evidence: [] }));
      }
      for (const evidence of profileEvidence(profile)) {
        const url = new URL(evidence.sourceId);
        expect(url.protocol).toBe("https:");
        expect(manufacturer.primarySourceHosts).toContain(url.hostname);
        expect(evidence.locator).toMatch(/page\s+\d+|official product page/i);
        expect(evidence.retrievedAt).toMatch(/(?:Z|[+-]\d{2}:\d{2})$/);
        expect(evidence.licenseNote).toBe(REVIEWED_REAL_LICENSE_NOTE);
        if (evidence.contentHash !== undefined) expect(evidence.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      }
    }
    const authoredFiles = readdirSync(new URL("../src/reviewed-real", import.meta.url), { recursive: true })
      .map(String);
    expect(authoredFiles.some((path) => /\.(?:pdf|lib|cir|spice|ibs)$/i.test(path))).toBe(false);
  });

  it("pins exact product-page bytes and fresh retrieval times used by real-part evidence", () => {
    const cases = [
      {
        manufacturerPartNumber: "DRV8876PWPR",
        sourceId: "https://www.ti.com/product/DRV8876",
        contentHash: "sha256:091aa8369100e0d25bcdd257ae41aafa347bede408f3e7f682655b3384592385",
        retrievedAt: "2026-08-24T11:12:26+10:00",
        evidenceReferenceCount: 3,
      },
      {
        manufacturerPartNumber: "DRV8262DDVR",
        sourceId: "https://www.ti.com/product/DRV8262/part-details/DRV8262DDVR",
        contentHash: "sha256:a5f93a944c2f8f2537476863b1c5d62539146edc3b97e7c641fa8f79d3c8a460",
        retrievedAt: "2026-08-25T20:30:52Z",
        evidenceReferenceCount: 1,
      },
      {
        manufacturerPartNumber: "DRV8701ERGER",
        sourceId: "https://www.ti.com/product/DRV8701",
        contentHash: "sha256:bcdb32694a97221ce40ba1c157550e35efcd521ec04f10a150a3772c90912439",
        retrievedAt: "2026-08-24T11:12:52+10:00",
        evidenceReferenceCount: 3,
      },
      {
        manufacturerPartNumber: "TB67H450AFNG(O,EL)",
        sourceId: "https://toshiba.semicon-storage.com/us/semiconductor/product/motor-driver-ics/brushed-dc-motor-driver-ics/detail.TB67H450AFNG.html",
        contentHash: "sha256:d246dcf24e9718f480f2f19bdd381c8e5a49044b461ec23266901dc98fe0f5e3",
        retrievedAt: "2026-08-24T11:14:15+10:00",
        evidenceReferenceCount: 2,
      },
      {
        manufacturerPartNumber: "A3941KLPTR-T",
        sourceId: "https://www.allegromicro.com/en/products/motor-drivers/brush-dc-motor-drivers/a3941",
        contentHash: "sha256:95a90198d75e9082c6e5051a532ab653ebcc863ca4d1679fa6bd39c7ca547dfb",
        retrievedAt: "2026-08-24T11:14:47+10:00",
        evidenceReferenceCount: 1,
      },
      {
        manufacturerPartNumber: "HIP4081AIBZ",
        sourceId: "https://www.renesas.com/en/products/hip4081a/part-details/hip4081aibz",
        contentHash: "sha256:ee1bc323fdf9c25222d0434b04bef0e4780a256778aa5cc4a82755ef8b44924e",
        retrievedAt: "2026-08-24T11:15:09+10:00",
        evidenceReferenceCount: 2,
      },
    ] as const;

    for (const expected of cases) {
      const profile = allProfiles().find((entry) => entry.part.manufacturerPartNumber === expected.manufacturerPartNumber)!;
      const matchingEvidence = profileEvidence(profile).filter((entry) => entry.sourceId === expected.sourceId);
      expect(matchingEvidence).toHaveLength(expected.evidenceReferenceCount);
      for (const evidence of matchingEvidence) {
        expect(evidence).toEqual(expect.objectContaining({
          sourceId: expected.sourceId,
          contentHash: expected.contentHash,
          retrievedAt: expected.retrievedAt,
        }));
      }
    }
  });

  it("rejects unknown keys recursively at catalog, profile, fact, and evidence levels", () => {
    const catalogExtra = cloneCatalog();
    addKey(catalogExtra, "unexpected");
    expect(() => assertValidReviewedRealMotorCatalog(catalogExtra)).toThrow(/catalog\.unexpected: unknown key/);

    const profileExtra = cloneCatalog();
    addKey(profileExtra.integratedBridges[0]!, "unexpected");
    expect(() => assertValidReviewedRealMotorCatalog(profileExtra)).toThrow(/integratedBridges\[0\]\.unexpected: unknown key/);

    const factExtra = cloneCatalog();
    addKey(factExtra.integratedBridges[0]!.facts.supplyMaximumV, "unexpected");
    expect(() => assertValidReviewedRealMotorCatalog(factExtra)).toThrow(/supplyMaximumV\.unexpected: unknown key/);

    const evidenceExtra = cloneCatalog();
    addKey(evidenceExtra.gateDrivers[0]!.facts.sourceCurrentA.evidence[0]!, "unexpected");
    expect(() => assertValidReviewedRealMotorCatalog(evidenceExtra)).toThrow(/evidence\[0\]\.unexpected: unknown key/);
  });

  it("rejects code-owned registry drift, fake manufacturers, unstable identities, duplicates, bad ranges, and malformed unknown facts", () => {
    const changedHostAndUrl = cloneCatalog();
    const changedManufacturer = changedHostAndUrl.manufacturers[0] as { id: string; displayName: string; primarySourceHosts: string[] };
    changedManufacturer.primarySourceHosts[0] = "attacker.invalid";
    changedHostAndUrl.integratedBridges[0]!.identityEvidence[0]!.sourceId = "https://attacker.invalid/DRV8876PWPR";
    expect(() => assertValidReviewedRealMotorCatalog(changedHostAndUrl)).toThrow(/must exactly match code-owned host ti\.com/);

    const displayDrift = cloneCatalog();
    (displayDrift.manufacturers[0] as { displayName: string }).displayName = "Fake TI";
    expect(() => assertValidReviewedRealMotorCatalog(displayDrift)).toThrow(/must exactly match code-owned display name Texas Instruments/);

    const extraManufacturer = cloneCatalog();
    (extraManufacturer.manufacturers as Array<{ id: string; displayName: string; primarySourceHosts: string[] }>).push({
      id: "fake-manufacturer",
      displayName: "Fake Manufacturer",
      primarySourceHosts: ["fake.invalid"],
    });
    expect(() => assertValidReviewedRealMotorCatalog(extraManufacturer)).toThrow(/extra or missing manufacturers are forbidden/);

    const fakeEvidenceUrl = cloneCatalog();
    fakeEvidenceUrl.gateDrivers[0]!.identityEvidence[0]!.sourceId = "https://ti.com.attacker.invalid/DRV8701ERGER";
    expect(() => assertValidReviewedRealMotorCatalog(fakeEvidenceUrl)).toThrow(/host is not registered for manufacturer texas-instruments/);

    const unstableManufacturer = cloneCatalog();
    (unstableManufacturer.manufacturers[0] as { id: string }).id = "Texas Instruments";
    expect(() => assertValidReviewedRealMotorCatalog(unstableManufacturer)).toThrow(/stable lowercase registry key/);

    const duplicateId = cloneCatalog();
    duplicateId.gateDrivers[1]!.id = duplicateId.gateDrivers[0]!.id;
    expect(() => assertValidReviewedRealMotorCatalog(duplicateId)).toThrow(/duplicate profile ID/);

    const duplicatePart = cloneCatalog();
    const copy = structuredClone(duplicatePart.integratedBridges[0]!);
    copy.id = "motor.real.integrated.ti-drv8876pwpr-duplicate";
    duplicatePart.integratedBridges.push(copy);
    expect(() => assertValidReviewedRealMotorCatalog(duplicatePart)).toThrow(/duplicate manufacturer and MPN identity/);

    const badRange = cloneCatalog();
    badRange.integratedBridges[0]!.facts.supplyMinimumV.value = 38;
    expect(() => assertValidReviewedRealMotorCatalog(badRange)).toThrow(/supplyMinimumV must be less than supplyMaximumV/);

    const malformedUnknown = cloneCatalog();
    malformedUnknown.integratedBridges[0]!.facts.continuousCurrentA = {
      value: 2,
      state: "unknown",
      evidence: [],
      explanation: "Invalid optimistic unknown",
    } as unknown as ReviewedFact;
    expect(() => assertValidReviewedRealMotorCatalog(malformedUnknown)).toThrow(/unknown facts must be null/);
  });

  it("reports exact missing V1 facts and never lets missing data improve eligibility", () => {
    const report = buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG);
    expect(REVIEWED_REAL_MOTOR_CATALOG_REPORT).toEqual(report);
    expect(report.totals).toEqual(expect.objectContaining({
      profiles: 7,
      integratedBridges: 4,
      gateDrivers: 3,
      manufacturers: 5,
      missingSourceHashCount: 0,
      sourceHashCompleteProfiles: 7,
      reservedOwnershipProfiles: 7,
      catalogAdmittedProfiles: 3,
      generatorEligibleProfiles: 2,
    }));
    expect(report.provenanceState).toBe("authored_from_primary_sources");
    expect(report.targets.integratedBridges).toEqual({ authoredProfiles: 4, targetProfiles: 8, manufacturers: 3, targetManufacturers: 3, profilesRemaining: 4 });
    expect(report.targets.gateDrivers).toEqual({ authoredProfiles: 3, targetProfiles: 6, manufacturers: 3, targetManufacturers: 3, profilesRemaining: 3 });
    expect(report.coverageRequirementGaps.applicationEnvelope).toEqual([
      "The Motor application envelope remains unclosed for stall or peak requirements up to 30 A. The external-FET H-bridge topology is the intended high-current path, but stall duration, pulse duty, MOSFET safe-operating-area, protection response, and transient-thermal evidence are not jointly bound.",
    ]);
    expect(report.coverageRequirementGaps.integratedBridges).toEqual([
      "The tranche has incomplete 1 kHz to 100 kHz hard PWM evidence: DRV8262DDVR's 200 kHz statement is application guidance rather than a guaranteed bound, and STSPIN840 has no admitted PWM maximum.",
    ]);
    expect(report.coverageBoundaries.integratedBridges).toEqual({
      authoredNormalPeakCurrentMaximumA: 3.5,
      explanation: "The integrated-bridge tranche's authored normal peak-current ceiling is 3.5 A. DRV8262DDVR's 32 A figure is protection-threshold evidence, not a normal peak or stall-current guarantee.",
    });
    expect(report.coverageRequirementGaps.gateDrivers).toHaveLength(5);
    expect(
      report.coverageRequirementGaps.applicationEnvelope.length
      + report.coverageRequirementGaps.integratedBridges.length
      + report.coverageRequirementGaps.gateDrivers.length
      + report.sharedProfileGaps.length,
    ).toBe(8);
    expect(report.profiles.every((profile) => profile.authoredFromPrimarySources && profile.ownershipReserved && !profile.technicalFactComplete)).toBe(true);
    expect(report.profiles.filter((profile) => profile.catalogAdmitted).map((profile) => ({
      manufacturerPartNumber: profile.manufacturerPartNumber,
      admittedProfileId: profile.admittedProfileId,
      admittedFactsSchemaVersion: profile.admittedFactsSchemaVersion,
      admittedProfileContentHash: profile.admittedProfileContentHash,
      generatorEligible: profile.generatorEligible,
      generatorEnumerationRecipeIds: profile.generatorEnumerationRecipeIds,
      generatorEligibilityScope: profile.generatorEligibilityScope,
    }))).toEqual([
      {
        manufacturerPartNumber: "DRV8876PWPR",
        admittedProfileId: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json",
        admittedFactsSchemaVersion: "3.2.0",
        admittedProfileContentHash: "sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b",
        generatorEligible: true,
        generatorEnumerationRecipeIds: ["motor.native.integrated-h-bridge.facts-v3-2"],
        generatorEligibilityScope: "candidate_materialization_after_recipe_match",
      },
      {
        manufacturerPartNumber: "STSPIN840",
        admittedProfileId: "packages/design-library/parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json",
        admittedFactsSchemaVersion: "3.2.0",
        admittedProfileContentHash: "sha256:ff26581027998c75964057ab16342ad331c1c001d177a95a4e99aae7509387c2",
        generatorEligible: true,
        generatorEnumerationRecipeIds: ["motor.native.integrated-h-bridge.facts-v3-2"],
        generatorEligibilityScope: "candidate_materialization_after_recipe_match",
      },
      {
        manufacturerPartNumber: "DRV8262DDVR",
        admittedProfileId: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json",
        admittedFactsSchemaVersion: "3.2.0",
        admittedProfileContentHash: "sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a",
        generatorEligible: false,
        generatorEnumerationRecipeIds: [],
        generatorEligibilityScope: "candidate_materialization_after_recipe_match",
      },
    ]);
    const nonAdmitted = report.profiles.filter((profile) => !profile.catalogAdmitted);
    expect(nonAdmitted.map((profile) => profile.manufacturerPartNumber)).toEqual([
      "TB67H450AFNG(O,EL)",
      "DRV8701ERGER",
      "A3941KLPTR-T",
      "HIP4081AIBZ",
    ]);
    expect(nonAdmitted.every((profile) => (
      !profile.generatorEligible
      && profile.admittedProfileId === null
      && profile.admittedFactsSchemaVersion === null
      && profile.admittedProfileContentHash === null
      && profile.generatorEnumerationRecipeIds.length === 0
    ))).toBe(true);
    expect(report.profiles.some((profile) => profile.admittedFactsSchemaVersion === "2.0.0")).toBe(false);
    expect(report.profiles.find((profile) => profile.manufacturerPartNumber === "DRV8876PWPR")?.missingFields).toContain("continuousCurrentA");
    expect(report.profiles.find((profile) => profile.manufacturerPartNumber === "TB67H450AFNG(O,EL)")?.missingFields).toContain("continuousCurrentA");
    expect(report.profiles.find((profile) => profile.manufacturerPartNumber === "A3941KLPTR-T")?.missingFields).toContain("sourceCurrentA");
    expect(report.profiles.find((profile) => profile.manufacturerPartNumber === "HIP4081AIBZ")?.missingFields).toEqual(expect.arrayContaining(["supplyMinimumV", "supplyMaximumV"]));
    expect(REVIEWED_REAL_MOTOR_CATALOG.integratedBridges[2]!.facts.continuousCurrentA).toEqual(expect.objectContaining({ state: "unknown", value: null, evidence: [] }));
    const drv8262 = REVIEWED_REAL_MOTOR_CATALOG.integratedBridges[3]!;
    expect(drv8262.part.manufacturerPartNumber).toBe("DRV8262DDVR");
    expect(drv8262.facts.supplyMaximumV.value).toBe(60);
    expect(drv8262.facts.continuousCurrentA.value).toBe(20);
    expect(drv8262.facts.peakCurrentA).toEqual(expect.objectContaining({ state: "unknown", value: null, evidence: [] }));
    expect(drv8262.facts.peakCurrentA.explanation).toContain("non-promotable as a normal peak or stall-current fact");
    expect(drv8262.facts.pwmMaximumHz).toEqual(expect.objectContaining({ state: "unknown", value: null, evidence: [] }));
    expect(drv8262.facts.localDecouplingMinimumF.explanation).toContain("two separate 10 nF VM bypass capacitors");
    expect(drv8262.facts.bulkCapacitanceMinimumF.explanation).toContain("application-dependent");
    expect(REVIEWED_REAL_MOTOR_CATALOG.gateDrivers[2]!.facts.supplyMaximumV).toEqual(expect.objectContaining({ state: "unknown", value: null, evidence: [] }));
    expect(REVIEWED_REAL_MOTOR_CATALOG.gateDrivers[2]!.facts.absoluteMaximumV.value).toBe(80);

    const drv8876Coverage = report.profiles.find((profile) => profile.manufacturerPartNumber === "DRV8876PWPR")!;
    expect(drv8876Coverage.missingSourceHashes).toEqual([]);
    const drv8701Coverage = report.profiles.find((profile) => profile.manufacturerPartNumber === "DRV8701ERGER")!;
    expect(drv8701Coverage.missingSourceHashes).toEqual([]);
    const tb67h450Coverage = report.profiles.find((profile) => profile.manufacturerPartNumber === "TB67H450AFNG(O,EL)")!;
    expect(tb67h450Coverage.missingSourceHashes).toEqual([]);
    const stspin840Coverage = report.profiles.find((profile) => profile.manufacturerPartNumber === "STSPIN840")!;
    expect(stspin840Coverage.missingSourceHashes).toEqual([]);
    const drv8262Coverage = report.profiles.find((profile) => profile.manufacturerPartNumber === "DRV8262DDVR")!;
    expect(drv8262Coverage).toMatchObject({
      sourceHashComplete: true,
      ownershipReserved: true,
      ownershipLedger: {
        state: "reviewed",
        profileContentHash: "sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a",
        factsReviewedAndConditionedCheck: "pass",
        independentReviewCheck: "pass",
      },
      catalogAdmitted: true,
      generatorEligible: false,
      admittedProfileId: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json",
      admittedFactsSchemaVersion: "3.2.0",
      admittedProfileContentHash: "sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a",
      generatorEnumerationRecipeIds: [],
    });
    expect(drv8262Coverage.exclusionReasons).toContain(
      "The exact installed Motor recipe rejects this admitted DRV8262DDVR profile before component materialization because two distinct VM bypass positions plus separate charge-pump and regulator capacitor networks are unrepresentable by its one-local-capacitor structure",
    );
    expect(REVIEWED_REAL_MOTOR_CATALOG.integratedBridges[1]!.identityEvidence[0]).toEqual(expect.objectContaining({
      sourceId: "https://st.com/en/motor-drivers/stspin840.html",
      contentHash: "sha256:a5f3c0d2a4f85da62370b2b8aff698312e9d104f8bd09a0611d239542d5e91f7",
      retrievedAt: "2026-08-24T02:35:30.683Z",
    }));
    expect(REVIEWED_REAL_MOTOR_CATALOG.integratedBridges[1]!.facts.supplyMaximumV.evidence[0]).toEqual(expect.objectContaining({
      sourceId: "https://st.com/resource/en/datasheet/stspin840.pdf",
      contentHash: "sha256:d2e0f820b7faf997987de18df0fe89bf83b7dc8c35a6a18856a961f8682e06ef",
      retrievedAt: "2026-08-24T02:35:30.683Z",
    }));
    expect(report.profiles.filter((profile) => profile.sourceHashComplete)).toHaveLength(7);
    expect(report.profiles.filter((profile) => profile.sourceHashComplete).every((profile) =>
      !profile.exclusionReasons.some((reason) => reason.includes("ADR-0003 source content hashes missing")))).toBe(true);
    expect(report.profiles.filter((profile) => !profile.sourceHashComplete).every((profile) =>
      profile.exclusionReasons.some((reason) => reason.includes("ADR-0003 source content hashes missing")))).toBe(true);
    expect(nonAdmitted.every((profile) => profile.exclusionReasons.some((reason) => reason.includes("Independent evidence review")))).toBe(true);
    expect(report.profiles.filter((profile) => profile.catalogAdmitted).every((profile) =>
      !profile.exclusionReasons.some((reason) => reason.includes("Independent evidence review")))).toBe(true);

    expect(report.ownershipTargets.map((target) => target.profilePath)).toEqual([
      "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json",
      "packages/design-library/parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json",
      "packages/design-library/parts/motor.integrated-h-bridge/toshiba-semiconductor-storage/TB67H450AFNG%28O%2CEL%29.json",
      "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json",
      "packages/design-library/parts/motor.full-bridge-gate-driver/texas-instruments/DRV8701ERGER.json",
      "packages/design-library/parts/motor.full-bridge-gate-driver/allegro-microsystems/A3941KLPTR-T.json",
      "packages/design-library/parts/motor.full-bridge-gate-driver/renesas-electronics/HIP4081AIBZ.json",
    ]);

    const withOneMoreUnknown = cloneCatalog();
    withOneMoreUnknown.gateDrivers[0]!.facts.sourceCurrentA = {
      value: null,
      state: "unknown",
      evidence: [],
      explanation: "Deliberately removed to verify missing-data behavior.",
    };
    assertValidReviewedRealMotorCatalog(withOneMoreUnknown);
    const original = report.profiles.find((profile) => profile.manufacturerPartNumber === "DRV8701ERGER")!;
    const degraded = buildReviewedRealCatalogReport(withOneMoreUnknown).profiles
      .find((profile) => profile.manufacturerPartNumber === "DRV8701ERGER")!;
    expect(degraded.reviewedFactCount).toBe(original.reviewedFactCount - 1);
    expect(degraded.missingFields).toContain("sourceCurrentA");
    expect(degraded.technicalFactComplete).toBe(false);
    expect(degraded.generatorEligible).toBe(false);

    const duplicateAdmittedIdentity = cloneCatalog();
    const duplicate = structuredClone(duplicateAdmittedIdentity.integratedBridges[0]!);
    duplicate.id = "motor.real.integrated.ti-drv8876pwpr-report-boundary-duplicate";
    duplicateAdmittedIdentity.integratedBridges.push(duplicate);
    expect(() => buildReviewedRealCatalogReport(duplicateAdmittedIdentity))
      .toThrow(/duplicate manufacturer and MPN identity/);
  });

  it("binds exact nominal capacitor roles and retires exact TVS, N-MOSF, and current-shunt gaps without promoting application unknowns", () => {
    const report = REVIEWED_REAL_MOTOR_CATALOG_REPORT;
    const expectedRecipe = [{
      recipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      recipeVersion: "3.1.7",
      recipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
    }];

    for (const [coverage, basis] of [
      [report.sharedProfileCoverage.bootstrapCapacitors, "exact_recipe_bootstrap_capacitor_role"],
      [report.sharedProfileCoverage.localDecouplingCapacitors, "exact_recipe_driver_local_decoupling_capacitor_role"],
    ] as const) {
      expect(coverage).toMatchObject({
        partClass: "shared.mlcc-capacitor",
        factsSchemaVersion: "2.0.0",
        requiredRecipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
        requiredRecipeVersion: "3.1.7",
      requiredRecipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
        factCoverageSatisfied: true,
        roleAuthority: { status: "available", basis },
        satisfied: true,
      });
      expect(coverage.requiredFactPaths).toEqual([
        "/commonFacts/packageName",
        "/facts/nominalCapacitance",
      ]);
      expect(coverage.preservedUnknownFactPaths).toEqual([
        "/facts/effectiveCapacitance",
        "/facts/biasDeratingRatio",
        "/facts/equivalentSeriesResistance",
        "/facts/rippleCurrent",
      ]);
      expect(coverage.profiles.map((profile) => profile.profilePath)).toEqual(NOMINAL_10UF_MLCC_PROFILE_PATHS);
      expect(coverage.profiles.map((profile) => profile.profileContentHash)).toEqual([
        "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
        "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99",
        "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd",
      ]);
      expect(coverage.profiles.every((profile) => (
        profile.generatorEnumerationRecipes.length === 1
        && profile.generatorEnumerationRecipes[0]!.recipeContentHash === expectedRecipe[0]!.recipeContentHash
        && profile.requiredFacts.map((fact) => fact.path).join(",") === coverage.requiredFactPaths.join(",")
        && profile.preservedUnknownFacts.map((fact) => fact.path).join(",") === coverage.preservedUnknownFactPaths.join(",")
        && profile.requiredFacts.every((fact) => fact.evidenceContentHashes.length > 0)
        && profile.preservedUnknownFacts.every((fact) => fact.state === "unknown" && fact.explanation.length > 0)
      ))).toBe(true);
    }
    const reviewedDocuments = cloneReviewedDocuments();
    expect(NOMINAL_10UF_MLCC_PROFILE_PATHS.map((profilePath) => (
      reviewedDocuments.profiles[profilePath].facts.nominalCapacitance.value.value
    ))).toEqual([10e-6, 10e-6, 10e-6]);
    expect(report.sharedProfileCoverage.bootstrapCapacitors.profiles.some((profile) => (
      profile.manufacturerPartNumber === "C1608X7R1H104K080AA"
    ))).toBe(false);

    expect(report.sharedProfileCoverage.externalNmos).toMatchObject({
      partClass: "shared.n-channel-power-mosfet",
      factsSchemaVersion: "3.0.0",
      requiredRecipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      requiredRecipeVersion: "3.1.7",
      requiredRecipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
      factCoverageSatisfied: true,
      roleAuthority: {
        status: "available",
        basis: "exact_recipe_component_role",
      },
      satisfied: true,
    });
    expect(report.sharedProfileCoverage.externalNmos.requiredFactPaths).toEqual([
      "/commonFacts/packageName",
      "/facts/drainSourceVoltage",
      "/facts/continuousDrainCurrent",
      "/facts/pulsedDrainCurrent",
      "/facts/onResistance",
      "/facts/totalGateCharge",
      "/facts/maximumJunctionTemperature",
      "/facts/junctionToAmbientThermalResistance",
      "/facts/thermalBoardAssumption",
      "/facts/packageBodyArea",
      "/facts/mountedGeometry/boardArea",
      "/facts/mountedGeometry/maximumHeight",
    ]);
    expect(report.sharedProfileCoverage.externalNmos.preservedUnknownFactPaths).toEqual([
      "/facts/riseTime",
      "/facts/fallTime",
      "/facts/reverseRecoveryCharge",
    ]);
    expect(report.sharedProfileCoverage.externalNmos.profiles).toHaveLength(1);
    expect(report.sharedProfileCoverage.externalNmos.profiles[0]).toMatchObject({
      profileId: EXTERNAL_NMOS_PROFILE_PATH,
      profilePath: EXTERNAL_NMOS_PROFILE_PATH,
      partClass: "shared.n-channel-power-mosfet",
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: "CSD18540Q5B",
      factsSchemaVersion: "3.0.0",
      profileContentHash: "sha256:551796851f2c60f698c3ca054e338cdac0ec8fe034e4d7217ee6a758a7ab86e8",
      admissionState: "reviewed",
      generatorEnumerationRecipes: expectedRecipe,
    });
    expect(report.sharedProfileCoverage.externalNmos.profiles[0]!.preservedUnknownFacts).toEqual([
      expect.objectContaining({ path: "/facts/riseTime", state: "unknown" }),
      expect.objectContaining({ path: "/facts/fallTime", state: "unknown" }),
      expect.objectContaining({ path: "/facts/reverseRecoveryCharge", state: "unknown" }),
    ]);

    expect(report.sharedProfileCoverage.supplyTvs).toMatchObject({
      partClass: "motor.supply-tvs-diode",
      factsSchemaVersion: "3.0.0",
      requiredRecipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      requiredRecipeVersion: "3.1.7",
      requiredRecipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
      factCoverageSatisfied: true,
      roleAuthority: {
        status: "available",
        basis: "part_class_is_role_specific",
      },
      satisfied: true,
    });
    expect(report.sharedProfileCoverage.supplyTvs.requiredFactPaths).toEqual([
      "/commonFacts/packageName",
      "/facts/standOffVoltage",
      "/facts/breakdownVoltageMinimum",
      "/facts/breakdownVoltageMaximum",
      "/facts/clampingBehavior",
      "/facts/clampingVoltage",
      "/facts/pulseCurrent",
      "/facts/pulseWaveform",
      "/facts/mountedGeometry/boardArea",
      "/facts/mountedGeometry/maximumHeight",
    ]);
    expect(report.sharedProfileCoverage.supplyTvs.preservedUnknownFactPaths).toEqual([
      "/facts/pulseEnergy",
    ]);
    expect(report.sharedProfileCoverage.supplyTvs.profiles).toHaveLength(1);
    expect(report.sharedProfileCoverage.supplyTvs.profiles[0]).toMatchObject({
      profileId: SUPPLY_TVS_PROFILE_PATH,
      profilePath: SUPPLY_TVS_PROFILE_PATH,
      partClass: "motor.supply-tvs-diode",
      manufacturerId: "diodes-incorporated",
      manufacturerPartNumber: "3.0SMCJ33CAQ",
      factsSchemaVersion: "3.0.0",
      profileContentHash: "sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474",
      admissionState: "reviewed",
      generatorEnumerationRecipes: expectedRecipe,
    });
    expect(report.sharedProfileCoverage.supplyTvs.profiles[0]!.preservedUnknownFacts).toEqual([
      expect.objectContaining({ path: "/facts/pulseEnergy", state: "unknown" }),
    ]);

    expect(report.sharedProfileCoverage.currentShunts).toMatchObject({
      partClass: "shared.current-sense-resistor",
      factsSchemaVersion: "2.0.0",
      requiredRecipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      requiredRecipeVersion: "3.1.7",
      requiredRecipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
      factCoverageSatisfied: true,
      roleAuthority: {
        status: "available",
        basis: "part_class_is_role_specific",
      },
      satisfied: true,
    });
    expect(report.sharedProfileCoverage.currentShunts.requiredFactPaths).toEqual([
      "/commonFacts/packageName",
      "/facts/resistance",
      "/facts/tolerance",
      "/facts/temperatureCoefficient",
      "/facts/continuousPower",
      "/facts/pulsePower",
      "/facts/pulseDuration",
      "/facts/thermalLimit",
      "/facts/kelvinTerminals",
      "/facts/mountedGeometry/boardArea",
      "/facts/mountedGeometry/maximumHeight",
    ]);
    expect(report.sharedProfileCoverage.currentShunts.profiles).toHaveLength(1);
    expect(report.sharedProfileCoverage.currentShunts.profiles[0]).toMatchObject({
      profileId: CURRENT_SHUNT_PROFILE_PATH,
      profilePath: CURRENT_SHUNT_PROFILE_PATH,
      partClass: "shared.current-sense-resistor",
      manufacturerId: "bourns",
      manufacturerPartNumber: "CRA2512-FZ-R020ELF",
      factsSchemaVersion: "2.0.0",
      profileContentHash: "sha256:b00c25d940ca0c61e717b9d2b5cdb8b6fcd3382d29f5cf0ed98114e459e6cf6d",
      admissionState: "reviewed",
      generatorEnumerationRecipes: expectedRecipe,
    });
    expect(report.sharedProfileCoverage.currentShunts.profiles[0]!.requiredFacts.map((fact) => [
      fact.path,
      fact.state,
    ])).toEqual([
      ["/commonFacts/packageName", "reviewed"],
      ["/facts/resistance", "reviewed"],
      ["/facts/tolerance", "reviewed"],
      ["/facts/temperatureCoefficient", "reviewed"],
      ["/facts/continuousPower", "reviewed"],
      ["/facts/pulsePower", "reviewed"],
      ["/facts/pulseDuration", "reviewed"],
      ["/facts/thermalLimit", "reviewed"],
      ["/facts/kelvinTerminals", "reviewed"],
      ["/facts/mountedGeometry/boardArea", "calculated"],
      ["/facts/mountedGeometry/maximumHeight", "reviewed"],
    ]);

    expect(report.sharedProfileCoverage.seriesGateResistors).toMatchObject({
      partClass: "shared.general-purpose-resistor",
      factsSchemaVersion: "2.0.0",
      requiredRecipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      requiredRecipeVersion: "3.1.7",
      requiredRecipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
      factCoverageSatisfied: false,
      roleAuthority: {
        status: "not_required",
        basis: "exact_driver_guidance_omits_series_gate_resistors",
      },
      satisfied: true,
      profiles: [],
    });
    expect(report.sharedProfileCoverage.seriesGateResistors.requiredFactPaths).toEqual([]);
    expect(report.sharedProfileCoverage.seriesGateResistors.preservedUnknownFactPaths).toEqual([]);
    expect(report.sharedProfileCoverage.pulldownResistors).toMatchObject({
      partClass: "shared.general-purpose-resistor",
      factsSchemaVersion: "2.0.0",
      requiredRecipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      requiredRecipeVersion: "3.1.7",
      requiredRecipeContentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
      factCoverageSatisfied: true,
      roleAuthority: {
        status: "available",
        basis: "exact_recipe_component_role",
      },
      satisfied: true,
    });
    expect(report.sharedProfileCoverage.pulldownResistors.requiredFactPaths).toEqual([
      "/commonFacts/packageName",
      "/facts/resistance",
      "/facts/tolerance",
      "/facts/temperatureCoefficient",
      "/facts/continuousPower",
      "/facts/workingVoltage",
      "/facts/mountedGeometry/boardArea",
      "/facts/mountedGeometry/maximumHeight",
    ]);
    expect(report.sharedProfileCoverage.pulldownResistors.profiles.map((profile) => profile.profilePath))
      .toEqual(GENERAL_RESISTOR_PROFILE_PATHS.slice(0, 3));
    expect(report.sharedProfileCoverage.pulldownResistors.profiles.map((profile) => profile.profileContentHash))
      .toEqual([
        "sha256:d9fb252c5e2440b34f7b4fc844497b2c4fcc8f6f3573b531da4f602804a677f6",
        "sha256:56f2022018a349a1bd48bf60804aa6147967fc3173e5ffea78d001a0c162e0a1",
        "sha256:f0320c991d8cf882396657e8d0b23aa3c8253b7d7be16f3aff6a29a15a6b83a0",
      ]);
    expect(GENERAL_RESISTOR_PROFILE_PATHS.map((profilePath) => (
      reviewedDocuments.profiles[profilePath].facts.resistance.value.value
    ))).toEqual([100_000, 100_000, 100_000, 732_000]);
    for (const profile of [
      ...report.sharedProfileCoverage.externalNmos.profiles,
      ...report.sharedProfileCoverage.currentShunts.profiles,
      ...report.sharedProfileCoverage.pulldownResistors.profiles,
      ...report.sharedProfileCoverage.supplyTvs.profiles,
    ]) {
      const coverage = profile.partClass === "shared.general-purpose-resistor"
        ? report.sharedProfileCoverage.pulldownResistors
        : Object.values(report.sharedProfileCoverage)
          .find((entry) => entry.partClass === profile.partClass)!;
      expect(profile.generatorEnumerationRecipes).toEqual(expectedRecipe);
      expect(profile.requiredFacts.map((fact) => fact.path)).toEqual(coverage.requiredFactPaths);
      expect(profile.preservedUnknownFacts.map((fact) => fact.path)).toEqual(coverage.preservedUnknownFactPaths);
      expect(profile.preservedUnknownFacts.every((fact) => (
        fact.state === "unknown" && fact.explanation.length > 0
      ))).toBe(true);
      expect(profile.requiredFacts.every((fact) => (
        fact.evidenceContentHashes.length > 0
        && fact.evidenceContentHashes.every((hash) => /^sha256:[0-9a-f]{64}$/.test(hash))
      ))).toBe(true);
    }

    expect(report.sharedProfileGaps).toEqual([
      "Capacitor application evidence: effective capacitance over bias and temperature, ESR and ripple current, bootstrap QGATE and IHBS*tON charge/refresh/leakage adequacy, VDD-local voltage and placement/interconnect adequacy, and bulk transient-energy adequacy remain unknown.",
    ]);
  });

  it("fails closed on exact TVS and N-MOSF profile, release, admission, and hash duplication or omission", () => {
    for (const [label, profilePath] of [
      ["external N-MOSF", EXTERNAL_NMOS_PROFILE_PATH],
      ["supply TVS", SUPPLY_TVS_PROFILE_PATH],
    ] as const) {
      const tamperCases: Array<readonly [string, (documents: any) => void]> = [
        ["duplicate normalized profile", (documents) => {
          documents.profiles[`${profilePath}.duplicate`] = structuredClone(documents.profiles[profilePath]);
        }],
        ["omitted normalized profile", (documents) => {
          delete documents.profiles[profilePath];
        }],
        ["duplicate release ref", (documents) => {
          const releaseRef = documents.catalogRelease.profiles.find((entry: any) => entry.profilePath === profilePath)!;
          documents.catalogRelease.profiles.push(structuredClone(releaseRef));
        }],
        ["omitted release ref", (documents) => {
          documents.catalogRelease.profiles = documents.catalogRelease.profiles
            .filter((entry: any) => entry.profilePath !== profilePath);
        }],
        ["release hash drift", (documents) => {
          const releaseRef = documents.catalogRelease.profiles.find((entry: any) => entry.profilePath === profilePath)!;
          releaseRef.profileContentHash = `sha256:${"0".repeat(64)}`;
        }],
        ["duplicate admission", (documents) => {
          const entry = documents.admission.entries.find((candidate: any) => candidate.profilePath === profilePath)!;
          documents.admission.entries.push(structuredClone(entry));
        }],
        ["admission no longer reviewed", (documents) => {
          const entry = documents.admission.entries.find((candidate: any) => candidate.profilePath === profilePath)!;
          entry.state = "authored";
          entry.reviewedBy = null;
          entry.reviewedAt = null;
          entry.checks.find((check: any) => check.checkId === "review.independent")!.status = "not_run";
        }],
        ["exact MPN drift", (documents) => {
          documents.profiles[profilePath].part.manufacturerPartNumber += "-TAMPERED";
        }],
        ["facts-version drift", (documents) => {
          documents.profiles[profilePath].factsSchemaVersion = "2.0.0";
        }],
      ];
      for (const [tamperLabel, tamper] of tamperCases) {
        const documents = cloneReviewedDocuments();
        tamper(documents);
        expect(
          () => buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, { reviewedDocuments: documents }),
          `${label}:${tamperLabel}`,
        ).toThrow();
      }
    }
  }, 20_000);

  it("fails closed on shared-profile path, hash, MPN, schema, admission, recipe, and required-fact drift", () => {
    const documentTamperCases: Array<readonly [string, (documents: any) => void]> = [
      ["profile path", (documents) => {
        const releaseRef = documents.catalogRelease.profiles.find((entry: any) => entry.profilePath === CURRENT_SHUNT_PROFILE_PATH)!;
        releaseRef.profilePath = `${CURRENT_SHUNT_PROFILE_PATH}.tampered`;
      }],
      ["profile content hash", (documents) => {
        const releaseRef = documents.catalogRelease.profiles.find((entry: any) => entry.profilePath === CURRENT_SHUNT_PROFILE_PATH)!;
        releaseRef.profileContentHash = `sha256:${"0".repeat(64)}`;
      }],
      ["exact MPN", (documents) => {
        documents.profiles[CURRENT_SHUNT_PROFILE_PATH].part.manufacturerPartNumber = "CRA2512-FZ-R020ELF-TAMPERED";
      }],
      ["facts schema", (documents) => {
        documents.profiles[CURRENT_SHUNT_PROFILE_PATH].factsSchemaVersion = "1.0.0";
      }],
      ["reviewed admission", (documents) => {
        const entry = documents.admission.entries.find((candidate: any) => candidate.profilePath === CURRENT_SHUNT_PROFILE_PATH)!;
        entry.state = "authored";
        entry.reviewedBy = null;
        entry.reviewedAt = null;
        entry.checks.find((check: any) => check.checkId === "review.independent")!.status = "not_run";
      }],
    ];
    for (const [label, tamper] of documentTamperCases) {
      const documents = cloneReviewedDocuments();
      tamper(documents);
      expect(
        () => buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, { reviewedDocuments: documents }),
        label,
      ).toThrow();
    }

    const requirementsByProfile = [
      [NOMINAL_10UF_MLCC_PROFILE_PATHS[0], REVIEWED_REAL_MOTOR_CATALOG_REPORT.sharedProfileCoverage.bootstrapCapacitors.requiredFactPaths],
      [EXTERNAL_NMOS_PROFILE_PATH, REVIEWED_REAL_MOTOR_CATALOG_REPORT.sharedProfileCoverage.externalNmos.requiredFactPaths],
      [CURRENT_SHUNT_PROFILE_PATH, REVIEWED_REAL_MOTOR_CATALOG_REPORT.sharedProfileCoverage.currentShunts.requiredFactPaths],
      [GENERAL_RESISTOR_PROFILE_PATHS[0], REVIEWED_REAL_MOTOR_CATALOG_REPORT.sharedProfileCoverage.pulldownResistors.requiredFactPaths],
      [SUPPLY_TVS_PROFILE_PATH, REVIEWED_REAL_MOTOR_CATALOG_REPORT.sharedProfileCoverage.supplyTvs.requiredFactPaths],
    ] as const;
    for (const [profilePath, requiredPaths] of requirementsByProfile) {
      for (const requiredPath of requiredPaths) {
        const missing = cloneReviewedDocuments();
        deleteValueAtPath(missing.profiles[profilePath], requiredPath);
        expect(
          () => buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, { reviewedDocuments: missing }),
          `${profilePath}:${requiredPath}:missing`,
        ).toThrow();

        const nonReviewed = cloneReviewedDocuments();
        const fact = mutableValueAtPath(nonReviewed.profiles[profilePath], requiredPath);
        fact.state = "unknown";
        fact.value = null;
        fact.evidence = [];
        fact.validFor = [];
        expect(
          () => buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, { reviewedDocuments: nonReviewed }),
          `${profilePath}:${requiredPath}:non_reviewed`,
        ).toThrow();
      }
    }

    const preservedUnknownsByProfile = [
      [NOMINAL_10UF_MLCC_PROFILE_PATHS[0], REVIEWED_REAL_MOTOR_CATALOG_REPORT.sharedProfileCoverage.bootstrapCapacitors.preservedUnknownFactPaths],
      [EXTERNAL_NMOS_PROFILE_PATH, REVIEWED_REAL_MOTOR_CATALOG_REPORT.sharedProfileCoverage.externalNmos.preservedUnknownFactPaths],
      [SUPPLY_TVS_PROFILE_PATH, REVIEWED_REAL_MOTOR_CATALOG_REPORT.sharedProfileCoverage.supplyTvs.preservedUnknownFactPaths],
    ] as const;
    for (const [profilePath, preservedUnknownPaths] of preservedUnknownsByProfile) {
      for (const preservedUnknownPath of preservedUnknownPaths) {
        const omitted = cloneReviewedDocuments();
        deleteValueAtPath(omitted.profiles[profilePath], preservedUnknownPath);
        expect(
          () => buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, { reviewedDocuments: omitted }),
          `${profilePath}:${preservedUnknownPath}:omitted_preserved_unknown`,
        ).toThrow();

        const promoted = cloneReviewedDocuments();
        const fact = mutableValueAtPath(promoted.profiles[profilePath], preservedUnknownPath);
        fact.state = "reviewed";
        const promotedUnit = new Map([
          ["/facts/effectiveCapacitance", "F"],
          ["/facts/biasDeratingRatio", "1"],
          ["/facts/equivalentSeriesResistance", "ohm"],
          ["/facts/rippleCurrent", "A"],
          ["/facts/riseTime", "s"],
          ["/facts/fallTime", "s"],
          ["/facts/reverseRecoveryCharge", "C"],
          ["/facts/pulseEnergy", "J"],
        ]).get(preservedUnknownPath);
        if (promotedUnit === undefined) throw new Error(`Missing promoted-unit fixture for ${preservedUnknownPath}`);
        fact.value = { value: 1, unit: promotedUnit };
        fact.evidence = structuredClone(promoted.profiles[profilePath].commonFacts.packageName.evidence);
        expect(
          () => buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, { reviewedDocuments: promoted }),
          `${profilePath}:${preservedUnknownPath}:forged_promotion`,
        ).toThrow();
      }
    }

    for (const mutateRecipe of [
      (recipe: any) => { recipe.id = `${recipe.id}.tampered`; },
      (recipe: any) => { recipe.version = "3.1.0"; },
      (recipe: any) => { recipe.contentHash = `sha256:${"f".repeat(64)}`; },
    ]) {
      const recipes = structuredClone(getInstalledMotorRecipeRefsV2()) as any[];
      mutateRecipe(recipes.find((recipe) => recipe.id === "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified")!);
      const report = buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, { installedMotorRecipes: recipes });
      expect(report.sharedProfileCoverage.bootstrapCapacitors).toMatchObject({ satisfied: false, profiles: [] });
      expect(report.sharedProfileCoverage.localDecouplingCapacitors).toMatchObject({ satisfied: false, profiles: [] });
      expect(report.sharedProfileCoverage.externalNmos).toMatchObject({ satisfied: false, profiles: [] });
      expect(report.sharedProfileCoverage.currentShunts).toMatchObject({ satisfied: false, profiles: [] });
      expect(report.sharedProfileCoverage.seriesGateResistors).toMatchObject({ satisfied: false, profiles: [] });
      expect(report.sharedProfileCoverage.pulldownResistors).toMatchObject({ satisfied: false, profiles: [] });
      expect(report.sharedProfileCoverage.supplyTvs).toMatchObject({ satisfied: false, profiles: [] });
      expect(report.sharedProfileGaps).toContain(
        "External N-MOSF profiles: exact manufacturer/MPN, VDS maximum, continuous and pulsed current with conditions, RDS(on) at supported VGS and temperature, total gate charge, switching/reverse-recovery evidence, maximum junction temperature, package thermal assumptions, and body area.",
      );
      expect(report.sharedProfileGaps).toContain(
        "Current shunts: resistance, tolerance, TCR, continuous and pulse power with duration, thermal/package assumptions, and Kelvin-terminal evidence.",
      );
      expect(report.sharedProfileGaps).toContain(
        "Supply TVS: stand-off, breakdown, clamping voltage, and the pulse waveform/energy condition.",
      );
    }
  }, 45_000);

  it("requires one exact recipe/ref readiness join and a globally ready installed recipe set", () => {
    const installed = structuredClone(getInstalledMotorRecipeRefsV2()) as any[];
    const required = installed.find((recipe) => recipe.id === "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified")!;

    const omittedRequired = installed.filter((recipe) => recipe.id !== required.id);
    const omittedRequiredReport = buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, {
      installedMotorRecipes: omittedRequired,
    });
    expect(omittedRequiredReport.sharedProfileCoverage.externalNmos).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });
    expect(omittedRequiredReport.sharedProfileCoverage.supplyTvs).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });

    const duplicateExact = [...installed, structuredClone(required)];
    const duplicateExactReport = buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, {
      installedMotorRecipes: duplicateExact,
    });
    expect(duplicateExactReport.sharedProfileCoverage.currentShunts).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });
    expect(duplicateExactReport.sharedProfileCoverage.externalNmos).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });
    expect(duplicateExactReport.sharedProfileCoverage.supplyTvs).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });

    const duplicateBadHash = [...installed, {
      ...structuredClone(required),
      contentHash: `sha256:${"0".repeat(64)}`,
    }];
    const duplicateBadHashReport = buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, {
      installedMotorRecipes: duplicateBadHash,
    });
    expect(duplicateBadHashReport.sharedProfileCoverage.currentShunts).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });
    expect(duplicateBadHashReport.sharedProfileCoverage.externalNmos).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });
    expect(duplicateBadHashReport.sharedProfileCoverage.supplyTvs).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });

    const globallyBlocked = installed.filter((recipe) => (
      recipe.id !== "motor.native.integrated-h-bridge.facts-v3-2"
    ));
    const globallyBlockedReport = buildReviewedRealCatalogReport(REVIEWED_REAL_MOTOR_CATALOG, {
      installedMotorRecipes: globallyBlocked,
    });
    expect(globallyBlockedReport.sharedProfileCoverage.currentShunts).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });
    expect(globallyBlockedReport.sharedProfileCoverage.externalNmos).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });
    expect(globallyBlockedReport.sharedProfileCoverage.supplyTvs).toMatchObject({
      factCoverageSatisfied: false,
      satisfied: false,
      profiles: [],
    });
  });

  it("uses stable ASCII ordering for report evidence independent of locale collation", () => {
    const catalog = cloneCatalog();
    catalog.integratedBridges[0]!.identityEvidence[0]!.sourceId = "https://ti.com/Z";
    delete catalog.integratedBridges[0]!.identityEvidence[0]!.contentHash;
    catalog.gateDrivers[0]!.identityEvidence[0]!.sourceId = "https://ti.com/a";
    delete catalog.gateDrivers[0]!.identityEvidence[0]!.contentHash;

    const report = buildReviewedRealCatalogReport(catalog);
    expect(report.missingSourceHashes).toEqual([
      "https://ti.com/Z",
      "https://ti.com/a",
    ]);
  });

  it("binds the audited DRV8701 active current and conservative HIP4081A pulse width to the pinned datasheet bytes", () => {
    const drv8701 = REVIEWED_REAL_MOTOR_CATALOG.gateDrivers.find((profile) => profile.part.manufacturerPartNumber === "DRV8701ERGER")!;
    expect(drv8701.facts.quiescentCurrentA).toMatchObject({
      state: "reviewed",
      value: 0.0095,
      evidence: [expect.objectContaining({
        sourceId: "https://ti.com/lit/gpn/DRV8701",
        contentHash: "sha256:8f211bc6b6a0ae77fb7956a0a809644aa502a7095ab228425cc63fe4e5ffba3c",
        locator: expect.stringMatching(/IVM.*VM = 24 V.*nSLEEP high.*9\.5 mA maximum.*operating free-air temperature range/),
      })],
    });
    expect(profileEvidence(drv8701).filter((entry) => entry.sourceId === "https://ti.com/lit/gpn/DRV8701")).toHaveLength(20);

    const hip4081a = REVIEWED_REAL_MOTOR_CATALOG.gateDrivers.find((profile) => profile.part.manufacturerPartNumber === "HIP4081AIBZ")!;
    expect(hip4081a.facts.minimumPulseWidthS).toMatchObject({
      state: "reviewed",
      value: 50e-9,
      evidence: [expect.objectContaining({
        sourceId: "https://renesas.com/en/document/dst/hip4081a-datasheet",
        contentHash: "sha256:9712192314428f328145659674cafe4b8a58cbce7ca93da50d2ff27e74d685b5",
        locator: expect.stringMatching(/TPWIN-ON.*TPWIN-OFF.*RHDEL = RLDEL = 10 kOhm.*50 ns.*40 ns.*TJ = 25 C.*TJ = -40 C to 125 C/),
      })],
    });
    expect(profileEvidence(hip4081a).filter((entry) => entry.sourceId === "https://renesas.com/en/document/dst/hip4081a-datasheet")).toHaveLength(19);
  });

  it("stays isolated from the synthetic golden generator and preserves exact M1/M2 behavior", () => {
    const m1 = generateMotorDesign(structuredClone(M1_COMPACT_REQUEST));
    const m2 = generateMotorDesign(structuredClone(M2_POWER_REQUEST));
    expect([m1.candidates.length, m1.rejections.length]).toEqual([2, 1]);
    expect([m2.candidates.length, m2.rejections.length]).toEqual([4, 5]);
    for (const result of [m1, m2]) {
      expect(result.candidates.flatMap((candidate) => candidate.components).every((component) =>
        component.part.manufacturerPartNumber.startsWith("SYNTHETIC-"))).toBe(true);
    }
    const generatorLibrary = JSON.stringify(MOTOR_DESIGN_LIBRARY);
    for (const profile of allProfiles()) {
      expect(generatorLibrary).not.toContain(profile.id);
      expect(generatorLibrary).not.toContain(profile.part.manufacturerPartNumber);
    }
  });
});

describe("reviewed-real external-NMOS gate-driver facts-V2 candidate plans", () => {
  it("binds package identity and maximum height to exact datasheet bytes without emitting a draft", () => {
    const plans = REVIEWED_REAL_MOTOR_FACTS_V2_CANDIDATE_PROFILE_PLANS;
    expect(plans).toEqual(buildReviewedRealMotorFactsV2CandidateProfilePlans());
    expect(plans).toHaveLength(3);
    expect(plans.map((plan) => plan.sourceProfileId)).toEqual([
      "motor.real.gate-driver.allegro-a3941klptr-t",
      "motor.real.gate-driver.renesas-hip4081aibz",
      "motor.real.gate-driver.ti-drv8701erger",
    ]);

    const expected = new Map([
      ["motor.real.gate-driver.allegro-a3941klptr-t", {
        maximumHeightM: 1.2e-3,
        packageName: "28-pin TSSOP with exposed thermal pad (LP)",
        sourceId: "https://allegromicro.com/-/media/files/datasheets/a3941-datasheet.pdf",
        contentHash: "sha256:86adffc26c22cd8a2ecea15ea1ce65bc617327c5d3bac7c669be2168c535cbe6",
      }],
      ["motor.real.gate-driver.renesas-hip4081aibz", {
        maximumHeightM: 2.65e-3,
        packageName: "20-pin SOICW",
        sourceId: "https://renesas.com/en/document/dst/hip4081a-datasheet",
        contentHash: "sha256:9712192314428f328145659674cafe4b8a58cbce7ca93da50d2ff27e74d685b5",
      }],
      ["motor.real.gate-driver.ti-drv8701erger", {
        maximumHeightM: 1e-3,
        packageName: "VQFN-24 (RGE)",
        sourceId: "https://ti.com/lit/gpn/DRV8701",
        contentHash: "sha256:8f211bc6b6a0ae77fb7956a0a809644aa502a7095ab228425cc63fe4e5ffba3c",
      }],
    ]);

    for (const plan of plans) {
      const expectedPlan = expected.get(plan.sourceProfileId)!;
      expect(plan).toMatchObject({
        partClass: "motor.full-bridge-gate-driver",
        targetFactsSchemaVersion: "2.0.0",
        status: "needs_evidence",
        sourceHashComplete: true,
        sourceBoundMandatoryEvidenceCount: 2,
        independentReviewState: "pending",
        admissionState: "isolated_not_admitted",
        draft: null,
      });
      expect(plan.schemaDraftBlockingPaths).toEqual([
        "/commonFacts/packageName",
        "/facts/mountedGeometry/boardArea",
        "/facts/mountedGeometry/maximumHeight",
      ]);
      expect(plan.mandatoryEvidenceMap.map((entry) => entry.targetPath)).toEqual(plan.schemaDraftBlockingPaths);
      expect(plan.mandatoryEvidenceMap.every((entry) =>
        entry.exactByteEvidence.length === 1
        && entry.exactByteEvidence[0]!.sourceId === expectedPlan.sourceId
        && entry.exactByteEvidence[0]!.contentHash === expectedPlan.contentHash
        && /page\s+\d+/i.test(entry.exactByteEvidence[0]!.locator)
        && entry.blockingReason.length > 0
        && entry.requiredResolution.length > 0)).toBe(true);

      const packageName = plan.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/commonFacts/packageName");
      expect(packageName).toMatchObject({
        status: "source_bound_pending_independent_review",
        candidate: { kind: "text", value: expectedPlan.packageName },
      });
      const boardArea = plan.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/mountedGeometry/boardArea");
      expect(boardArea).toMatchObject({ status: "blocked_missing_bounded_geometry", candidate: null });
      const maximumHeight = plan.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/mountedGeometry/maximumHeight");
      expect(maximumHeight).toMatchObject({
        status: "source_bound_pending_independent_review",
        candidate: {
          kind: "maximum_height",
          height: { value: expectedPlan.maximumHeightM, unit: "m", displayUnit: "mm" },
          basis: "manufacturer_package_maximum_in_surface_mount_orientation",
        },
      });
      expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.mandatoryEvidenceMap)).toBe(true);
      expect(Object.isFrozen(maximumHeight?.candidate)).toBe(true);
    }

    expect(() => {
      const candidate = plans[0]!.mandatoryEvidenceMap.find((entry) => entry.targetPath === "/facts/mountedGeometry/maximumHeight")!.candidate;
      if (candidate?.kind === "maximum_height") (candidate.height as { value: number }).value = 99;
    }).toThrow();
    expect(REVIEWED_REAL_MOTOR_CATALOG_REPORT.totals).toEqual(expect.objectContaining({
      catalogAdmittedProfiles: 3,
      generatorEligibleProfiles: 2,
    }));
  });

  it("fails closed on exact identity, hash, URL, retrieval, and package-semantic tampering", () => {
    const wrongIdentity = cloneCatalog();
    wrongIdentity.gateDrivers[0]!.part.manufacturerPartNumber = "DRV8701ERGER-TAMPERED";
    expect(() => buildReviewedRealMotorFactsV2CandidateProfilePlans(wrongIdentity))
      .toThrow(/Candidate evidence identity mismatch/);

    const wrongHash = cloneCatalog();
    wrongHash.gateDrivers[0]!.facts.supplyMinimumV.evidence[0]!.contentHash = `sha256:${"0".repeat(64)}`;
    expect(() => buildReviewedRealMotorFactsV2CandidateProfilePlans(wrongHash))
      .toThrow(/Exact-byte source hash mismatch/);

    const wrongUrl = cloneCatalog();
    wrongUrl.gateDrivers[0]!.facts.supplyMinimumV.evidence[0]!.sourceId = "https://ti.com/lit/gpn/DRV8701?tampered=1";
    expect(() => buildReviewedRealMotorFactsV2CandidateProfilePlans(wrongUrl))
      .toThrow(/Exact-byte source reference count mismatch/);

    const wrongRetrieval = cloneCatalog();
    wrongRetrieval.gateDrivers[0]!.facts.supplyMinimumV.evidence[0]!.retrievedAt = "2026-08-24T00:00:00Z";
    expect(() => buildReviewedRealMotorFactsV2CandidateProfilePlans(wrongRetrieval))
      .toThrow(/Exact-byte source retrieval mismatch/);

    const wrongPackage = cloneCatalog();
    wrongPackage.gateDrivers[0]!.package.name.value = "VQFN-24 (RGE) TAMPERED";
    expect(() => buildReviewedRealMotorFactsV2CandidateProfilePlans(wrongPackage))
      .toThrow(/Candidate evidence identity mismatch/);
  });
});

describe("complete reviewed-real Motor facts-V2 draft-authoring assessment", () => {
  it("ranks all seven profiles honestly while keeping every draft and admission boundary closed", () => {
    const assessment = REVIEWED_REAL_MOTOR_FACTS_V2_DRAFT_AUTHORING_ASSESSMENT;
    expect(buildReviewedRealMotorFactsV2DraftAuthoringAssessment()).toEqual(assessment);
    expect(assessment).toMatchObject({
      selectedProfileId: "motor.real.gate-driver.ti-drv8701erger",
      selectedScore: {
        draftAuthoringBlockerCount: 6,
        missingSourceGapCount: 1,
        semanticMismatchGapCount: 4,
        geometryGapCount: 1,
        independentReviewGapCount: 20,
        sourceBoundFactCount: 20,
      },
      authorableProfileCount: 0,
      authorableProfileIds: [],
      decision: "no_honest_draft",
      independentReviewState: "pending",
      admissionState: "isolated_not_admitted",
      draft: null,
    });
    expect(assessment.evaluatedProfileIds).toEqual([
      "motor.real.gate-driver.allegro-a3941klptr-t",
      "motor.real.gate-driver.renesas-hip4081aibz",
      "motor.real.gate-driver.ti-drv8701erger",
      "motor.real.integrated.st-stspin840",
      "motor.real.integrated.ti-drv8262ddvr",
      "motor.real.integrated.ti-drv8876pwpr",
      "motor.real.integrated.toshiba-tb67h450afng",
    ]);
    expect(assessment.rankedProfileIds).toEqual([
      "motor.real.gate-driver.ti-drv8701erger",
      "motor.real.integrated.ti-drv8876pwpr",
      "motor.real.gate-driver.renesas-hip4081aibz",
      "motor.real.integrated.ti-drv8262ddvr",
      "motor.real.integrated.toshiba-tb67h450afng",
      "motor.real.gate-driver.allegro-a3941klptr-t",
      "motor.real.integrated.st-stspin840",
    ]);
    expect(assessment.profileAssessments.map((profile) => ({
      id: profile.sourceProfileId,
      counts: profile.gapCounts,
      blockers: profile.draftAuthoringBlockerCount,
    }))).toEqual([
      { id: "motor.real.gate-driver.allegro-a3941klptr-t", counts: { missing_source: 8, semantic_mismatch: 3, geometry: 1, independent_review: 14 }, blockers: 12 },
      { id: "motor.real.gate-driver.renesas-hip4081aibz", counts: { missing_source: 5, semantic_mismatch: 3, geometry: 1, independent_review: 17 }, blockers: 9 },
      { id: "motor.real.gate-driver.ti-drv8701erger", counts: { missing_source: 1, semantic_mismatch: 4, geometry: 1, independent_review: 20 }, blockers: 6 },
      { id: "motor.real.integrated.st-stspin840", counts: { missing_source: 4, semantic_mismatch: 6, geometry: 2, independent_review: 12 }, blockers: 12 },
      { id: "motor.real.integrated.ti-drv8262ddvr", counts: { missing_source: 1, semantic_mismatch: 6, geometry: 2, independent_review: 15 }, blockers: 9 },
      { id: "motor.real.integrated.ti-drv8876pwpr", counts: { missing_source: 2, semantic_mismatch: 3, geometry: 2, independent_review: 17 }, blockers: 7 },
      { id: "motor.real.integrated.toshiba-tb67h450afng", counts: { missing_source: 4, semantic_mismatch: 5, geometry: 2, independent_review: 13 }, blockers: 11 },
    ]);

    for (const profile of assessment.profileAssessments) {
      expect(profile.assessedTargetPaths).toHaveLength(profile.partClass === "motor.integrated-h-bridge" ? 24 : 26);
      expect(profile.assessedTargetPaths).toEqual([...profile.assessedTargetPaths].sort());
      expect(new Set(profile.assessedTargetPaths).size).toBe(profile.assessedTargetPaths.length);
      expect(profile.draftAuthorable).toBe(false);
      expect(profile.draft).toBeNull();
      expect(profile.independentReviewState).toBe("pending");
      expect(profile.admissionState).toBe("isolated_not_admitted");
      expect(profile.draftAuthoringBlockers.every((gap) => gap.blocksDraftAuthoring && gap.category !== "independent_review")).toBe(true);
      expect(profile.gaps.filter((gap) => gap.category === "independent_review").every((gap) =>
        !gap.blocksDraftAuthoring && gap.exactByteEvidence.length > 0)).toBe(true);
      expect(profile.gaps.every((gap) => gap.reason.length > 0 && gap.requiredResolution.length > 0)).toBe(true);
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.gaps)).toBe(true);
    }
    expect(assessment.selectedProfileBlockers.map((gap) => gap.category)).toEqual([
      "semantic_mismatch",
      "semantic_mismatch",
      "semantic_mismatch",
      "semantic_mismatch",
      "missing_source",
      "geometry",
    ]);
    expect(Object.isFrozen(assessment)).toBe(true);
    expect(Object.isFrozen(assessment.profileAssessments)).toBe(true);
    expect(REVIEWED_REAL_MOTOR_CATALOG_REPORT.totals).toEqual(expect.objectContaining({
      catalogAdmittedProfiles: 3,
      generatorEligibleProfiles: 2,
    }));
  });

  it("fails closed when the complete assessment lacks a gate-driver evidence plan", () => {
    expect(() => buildReviewedRealMotorFactsV2DraftAuthoringAssessment(
      REVIEWED_REAL_MOTOR_CATALOG,
      REVIEWED_REAL_MOTOR_FACTS_V2_CANDIDATE_PROFILE_PLANS.slice(1),
    )).toThrow(/one exact-byte candidate plan per gate driver/);
  });
});
