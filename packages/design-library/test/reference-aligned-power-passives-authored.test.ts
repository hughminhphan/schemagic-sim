import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import admissionJson from "../admission.json";
import manufacturersJson from "../manufacturers.json";
import belProfileJson from "../parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json";
import murataProfileJson from "../parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json";
import {
  calculateBoardAreaV2,
  designProfileContentHashV34,
  designProfileEnvelopeContentHash,
  getBundledDesignLibraryDocuments,
  loadReviewedDesignLibraryEnvelope,
  parseDesignCatalogRelease,
  validateDesignLibraryEnvelope,
  validateDesignProfileEnvelope,
  validateDesignProfileV34,
  validateProfileAdmissionRulesV2,
  validateProfileAdmissionRulesV34,
  type BoardAreaDimensionTermV2,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileV34,
  type DesignProfileWithFactsV2,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";
import { getBundledReviewedReleaseDocuments } from "../src/bundled-reviewed-release";

const BEL_PATH = "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json";
const MURATA_PATH = "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json";
const BEL_PROFILE_HASH = "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b";
const MURATA_PROFILE_HASH = "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da";
const BEL_SOURCE_HASH = "sha256:c3523b58c262a6d39716711a5a05a5b6e5a60081eb15818bf35ba4b93e7a828f";
const MURATA_SOURCE_HASH = "sha256:31eff98e0e2198e8199f7fb5e6ef8a6e731fc6b62dd7540693cd30ed2a92f873";
const MURATA_SOURCE_URL = "https://pim.murata.com/asset/pim4/ceramicCapacitorSMD/GRM32ER71E226KE15-04CA-EN_PDF_CERAMICCAPACITORSMD?lastModifiedDatetime=20260730173647";

const belProfile = belProfileJson as unknown as DesignProfileV34<"power.power-inductor">;
const murataProfile = murataProfileJson as unknown as DesignProfileWithFactsV2<"shared.mlcc-capacitor", object>;
const registry = manufacturersJson as ManufacturerRegistryV1;
const admission = admissionJson as DesignProfileAdmissionLedgerV1;

function evidenceRefs(value: unknown): ProfileEvidenceRef[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.sourceId === "string" && typeof record.locator === "string") {
    return [record as unknown as ProfileEvidenceRef];
  }
  return Object.values(record).flatMap(evidenceRefs);
}

describe("reference-aligned Power passive profiles", () => {
  it("encodes the guaranteed Bel F1F2-0804-100M row without promoting nominal or typical observations", () => {
    expect(validateDesignProfileV34(belProfile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV34(belProfile)).toEqual([]);
    expect(designProfileContentHashV34(belProfile)).toBe(BEL_PROFILE_HASH);
    expect(belProfile.part).toEqual({
      manufacturerId: "bel-fuse",
      manufacturerPartNumber: "F1F2-0804-100M",
    });

    const facts = belProfile.facts;
    expect(facts.inductance).toMatchObject({
      state: "reviewed",
      value: { value: 10e-6, unit: "H" },
      validFor: [
        {
          parameterId: "switchingFrequency",
          minimum: { value: 100_000, unit: "Hz" },
          maximum: { value: 100_000, unit: "Hz" },
        },
        {
          parameterId: "testVoltage",
          minimum: { value: 0.25, unit: "V" },
          maximum: { value: 0.25, unit: "V" },
        },
      ],
    });
    expect(facts.inductance.explanation).toContain("typical nominal");
    expect(facts.inductance.explanation).toContain("not a minimum inductance bound");
    expect(facts.saturationCurrent).toMatchObject({ state: "reviewed", value: { value: 6, unit: "A" } });
    expect(facts.saturationCurrent.explanation).toContain("7.0 A typical value is not used");
    expect(facts.rmsCurrent).toMatchObject({ state: "reviewed", value: { value: 5, unit: "A" } });
    expect(facts.rmsCurrent.explanation).toContain("5.4 A typical value is not used");
    expect(facts.dcResistance).toMatchObject({ state: "reviewed", value: { value: 0.0518, unit: "ohm" } });
    for (const fact of [facts.saturationCurrent, facts.rmsCurrent, facts.dcResistance]) {
      expect(fact.validFor).toMatchObject([{
        parameterId: "ambientTemperature",
        minimum: { value: 298.15, unit: "K" },
        maximum: { value: 298.15, unit: "K" },
      }]);
    }
    expect(facts.maximumOperatingTemperature.value).toMatchObject({ value: 428.15, unit: "K" });
    expect(facts.maximumOperatingTemperature.explanation).toContain("including self-temperature rise");
    expect(facts.coreLoss).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.coreLossTestFrequency).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(calculateBoardAreaV2(
      facts.mountedGeometry.boardArea.value!.sourceDimensions as readonly BoardAreaDimensionTermV2[],
    )).toBe(0.00004028);
    expect(facts.mountedGeometry.maximumHeight.value).toMatchObject({ height: { value: 0.004, unit: "m" } });

    const refs = evidenceRefs(belProfile);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatchObject({
        sourceId: "bel-f1f2-0804-rev-a-datasheet",
        kind: "manufacturer_datasheet",
        revision: "Revision A, dated 07/17/2026",
        contentHash: BEL_SOURCE_HASH,
        publicationBasis: "public_facts",
      });
    }
  });

  it("encodes the Murata GRM32 exact identity and keeps operating capacitance, ESR, and ripple unknown", () => {
    expect(validateDesignProfileEnvelope(murataProfile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(murataProfile)).toEqual([]);
    expect(designProfileEnvelopeContentHash(murataProfile)).toBe(MURATA_PROFILE_HASH);
    expect(murataProfile.part).toEqual({
      manufacturerId: "murata-manufacturing",
      manufacturerPartNumber: "GRM32ER71E226KE15L",
    });

    const facts = murataProfile.facts as Record<string, any>;
    expect(facts.nominalCapacitance).toMatchObject({
      state: "reviewed",
      value: { value: 22e-6, unit: "F" },
      validFor: [
        {
          parameterId: "switchingFrequency",
          minimum: { value: 96, unit: "Hz" },
          maximum: { value: 144, unit: "Hz" },
        },
        {
          parameterId: "testVoltage",
          minimum: { value: 0.4, unit: "V" },
          maximum: { value: 0.6, unit: "V" },
        },
      ],
    });
    expect(facts.nominalCapacitance.explanation).toContain("±10 % tolerance");
    expect(facts.ratedVoltage.value).toEqual({ value: 25, unit: "V", displayUnit: "25 VDC" });
    expect(facts.temperatureCharacteristic.value).toBe("X7R (-15 to +15 %)");
    for (const key of ["effectiveCapacitance", "biasDeratingRatio", "equivalentSeriesResistance", "rippleCurrent"] as const) {
      expect(facts[key]).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    }
    expect(facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.00001104, unit: "m2", displayUnit: "11.04 mm²" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", dimensionId: "reflow-inner-pad-gap-a", multiplier: 1, maximum: { value: 0.0024, unit: "m" } },
        { axis: "x", dimensionId: "reflow-pad-length-b", multiplier: 2, maximum: { value: 0.0012, unit: "m" } },
        { axis: "y", dimensionId: "reflow-pad-height-c", multiplier: 1, maximum: { value: 0.0023, unit: "m" } },
      ],
    });
    expect(facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.0027, unit: "m", displayUnit: "2.70 mm" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });

    const refs = evidenceRefs(murataProfile);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatchObject({
        sourceId: "murata-grm32er71e226ke15l-reference-sheet",
        kind: "manufacturer_datasheet",
        url: MURATA_SOURCE_URL,
        revision: "GRM32ER71E226KE15-04CA; product specifications as of 2026-06-26",
        contentHash: MURATA_SOURCE_HASH,
        publicationBasis: "public_facts",
      });
    }
  });

  it("admits both independently reviewed profiles on every reviewed release surface", () => {
    const belEntry = admission.entries.find((entry) => entry.profilePath === BEL_PATH);
    const murataEntry = admission.entries.find((entry) => entry.profilePath === MURATA_PATH);
    expect(belEntry).toMatchObject({
      ownerTrack: "integration-data-review",
      reviewerTrack: "power",
      state: "reviewed",
      reviewedBy: "codex-bel-f1f2-0804-100m-independent-reviewer",
      reviewedAt: "2026-08-27T01:22:00Z",
      profileContentHash: BEL_PROFILE_HASH,
    });
    expect(murataEntry).toMatchObject({
      ownerTrack: "integration-data-review",
      reviewerTrack: "power",
      state: "reviewed",
      reviewedBy: "codex-murata-grm32er71e226ke15l-independent-reviewer",
      reviewedAt: "2026-08-27T01:22:30Z",
      profileContentHash: MURATA_PROFILE_HASH,
    });
    expect(belEntry?.checks.every((check) => check.status === "pass")).toBe(true);
    expect(murataEntry?.checks.every((check) => check.status === "pass")).toBe(true);

    const fullDocuments = getBundledDesignLibraryDocuments();
    expect(validateDesignLibraryEnvelope(fullDocuments)).toEqual([]);
    expect(fullDocuments.profiles[BEL_PATH]).toEqual(belProfileJson);
    expect(fullDocuments.profiles[MURATA_PATH]).toEqual(murataProfileJson);

    const reviewedDocuments = getBundledReviewedReleaseDocuments();
    expect(reviewedDocuments.profiles).toHaveProperty(BEL_PATH);
    expect(reviewedDocuments.profiles).toHaveProperty(MURATA_PATH);
    const releasePaths = parseDesignCatalogRelease(reviewedDocuments.catalogRelease)
      .profiles.map((entry) => entry.profilePath);
    expect(releasePaths).toContain(BEL_PATH);
    expect(releasePaths).toContain(MURATA_PATH);

    const reviewed = loadReviewedDesignLibraryEnvelope(fullDocuments);
    const reviewedMpns = reviewed.profiles.map((profile) => profile.part.manufacturerPartNumber);
    expect(reviewedMpns).toContain("F1F2-0804-100M");
    expect(reviewedMpns).toContain("GRM32ER71E226KE15L");
  });

  it("mirrors the two exact passive ownership reservations into the data manifest", () => {
    const manifest = JSON.parse(readFileSync(
      new URL("../../../docs/designer-v1-data-manifest.json", import.meta.url),
      "utf8",
    )) as {
      exact_mpn_ownership: Array<{
        part: { manufacturerId: string; manufacturerPartNumber: string };
        part_class_id: string;
        profile_path: string;
        owning_track: string;
        review_track: string;
        review_state: string;
      }>;
      summary: { reviewed_profile_count: number };
    };
    expect(manifest.exact_mpn_ownership.filter((entry) => [BEL_PATH, MURATA_PATH].includes(entry.profile_path)))
      .toEqual([
        {
          part: { manufacturerId: "bel-fuse", manufacturerPartNumber: "F1F2-0804-100M" },
          part_class_id: "power.power-inductor",
          profile_path: BEL_PATH,
          owning_track: "integration-data-review",
          review_track: "power",
          review_state: "reviewed",
        },
        {
          part: { manufacturerId: "murata-manufacturing", manufacturerPartNumber: "GRM32ER71E226KE15L" },
          part_class_id: "shared.mlcc-capacitor",
          profile_path: MURATA_PATH,
          owning_track: "integration-data-review",
          review_track: "power",
          review_state: "reviewed",
        },
      ]);
    expect(manifest.summary.reviewed_profile_count).toBe(24);
  });
});
