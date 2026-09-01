import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import admissionJson from "../admission.json";
import catalogReleaseJson from "../catalog-release.json";
import manufacturersJson from "../manufacturers.json";
import belProfileJson from "../parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json";
import murataProfileJson from "../parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json";
import reviewedAdmissionJson from "../reviewed-admission.json";
import {
  admissionContentHash,
  calculateBoardAreaV2,
  designProfileContentHashV34,
  designProfileEnvelopeContentHash,
  requiredAdmissionCheckIds,
  reviewedAdmissionProjection,
  validateCommercialDataBoundary,
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

const BEL_PATH = "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json";
const MURATA_PATH = "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json";
const BEL_SOURCE_HASH = "sha256:c3523b58c262a6d39716711a5a05a5b6e5a60081eb15818bf35ba4b93e7a828f";
const MURATA_SOURCE_HASH = "sha256:31eff98e0e2198e8199f7fb5e6ef8a6e731fc6b62dd7540693cd30ed2a92f873";
const BEL_PROFILE_HASH = "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b";
const MURATA_PROFILE_HASH = "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da";

const admission = admissionJson as DesignProfileAdmissionLedgerV1;
const registry = manufacturersJson as ManufacturerRegistryV1;
const bel = belProfileJson as unknown as DesignProfileV34<"power.power-inductor">;
const murata = murataProfileJson as unknown as DesignProfileWithFactsV2<"shared.mlcc-capacitor", object>;

function evidenceRefs(value: unknown): ProfileEvidenceRef[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.sourceId === "string" && typeof record.locator === "string") {
    return [record as unknown as ProfileEvidenceRef];
  }
  return Object.values(record).flatMap(evidenceRefs);
}

describe("independent review of the reference-aligned Power passive profiles", () => {
  it("pins the exact authored profile bytes and closed public-facts boundaries", () => {
    expect(createHash("sha256").update(readFileSync(new URL(`../${BEL_PATH.replace("packages/design-library/", "")}`, import.meta.url))).digest("hex"))
      .toBe("77d1f913cc3adf03c69c5c9d51224de38f26792c8681fe6757a4a7259887b495");
    expect(createHash("sha256").update(readFileSync(new URL(`../${MURATA_PATH.replace("packages/design-library/", "")}`, import.meta.url))).digest("hex"))
      .toBe("0ce7c8505027e683e57290d193c9f4443be99bb87885c4728498c22c276fea97");
    expect(designProfileContentHashV34(bel)).toBe(BEL_PROFILE_HASH);
    expect(designProfileEnvelopeContentHash(murata)).toBe(MURATA_PROFILE_HASH);
    expect(validateDesignProfileV34(bel, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV34(bel)).toEqual([]);
    expect(validateDesignProfileEnvelope(murata, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV2(murata)).toEqual([]);
    expect(validateCommercialDataBoundary(bel)).toEqual([]);
    expect(validateCommercialDataBoundary(murata)).toEqual([]);

    for (const [profile, sourceHash] of [[bel, BEL_SOURCE_HASH], [murata, MURATA_SOURCE_HASH]] as const) {
      for (const evidence of evidenceRefs(profile)) {
        expect(evidence).toMatchObject({
          kind: "manufacturer_datasheet",
          contentHash: sourceHash,
          publicationBasis: "public_facts",
        });
        expect(evidence.licenseNote).toMatch(/not redistributed/i);
      }
    }
  });

  it("preserves the reviewed Bel endpoints without upgrading the typical inductance observation", () => {
    expect(bel.facts.inductance).toMatchObject({
      value: { value: 10e-6, unit: "H" },
      validFor: [
        { parameterId: "switchingFrequency", minimum: { value: 100_000, unit: "Hz" }, maximum: { value: 100_000, unit: "Hz" } },
        { parameterId: "testVoltage", minimum: { value: 0.25, unit: "V" }, maximum: { value: 0.25, unit: "V" } },
      ],
    });
    expect(bel.facts.inductance.explanation).toContain("typical nominal");
    expect(bel.facts.inductance.explanation).toContain("not a minimum inductance bound");
    expect(bel.facts.dcResistance.value).toMatchObject({ value: 0.0518, unit: "ohm" });
    expect(bel.facts.saturationCurrent.value).toMatchObject({ value: 6, unit: "A" });
    expect(bel.facts.rmsCurrent.value).toMatchObject({ value: 5, unit: "A" });
    for (const fact of [bel.facts.dcResistance, bel.facts.saturationCurrent, bel.facts.rmsCurrent]) {
      expect(fact.validFor).toMatchObject([{ parameterId: "ambientTemperature", minimum: { value: 298.15, unit: "K" }, maximum: { value: 298.15, unit: "K" } }]);
    }
    expect(bel.facts.maximumOperatingTemperature.value).toMatchObject({ value: 428.15, unit: "K" });
    expect(bel.facts.maximumOperatingTemperature.explanation).toContain("including self-temperature rise");
    expect(bel.facts.coreLoss).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(bel.facts.coreLossTestFrequency).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(calculateBoardAreaV2(bel.facts.mountedGeometry.boardArea.value!.sourceDimensions as readonly BoardAreaDimensionTermV2[])).toBe(0.00004028);
    expect(bel.facts.mountedGeometry.maximumHeight.value).toMatchObject({ height: { value: 0.004, unit: "m" } });
  });

  it("preserves Murata nameplate facts, explicit unknowns, and conservative geometry", () => {
    const facts = murata.facts as Record<string, any>;
    expect(facts.nominalCapacitance).toMatchObject({ value: { value: 22e-6, unit: "F" } });
    expect(facts.nominalCapacitance.explanation).toContain("±10 % tolerance");
    expect(facts.ratedVoltage.value).toEqual({ value: 25, unit: "V", displayUnit: "25 VDC" });
    expect(facts.temperatureCharacteristic.value).toBe("X7R (-15 to +15 %)");
    for (const key of ["effectiveCapacitance", "biasDeratingRatio", "equivalentSeriesResistance", "rippleCurrent"]) {
      expect(facts[key]).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    }
    expect(calculateBoardAreaV2(facts.mountedGeometry.boardArea.value.sourceDimensions)).toBe(0.00001104);
    expect(facts.mountedGeometry.maximumHeight.value).toMatchObject({ height: { value: 0.0027, unit: "m" } });
  });

  it("binds distinct independent reviewers and the exact reviewed release projection", () => {
    for (const [path, reviewer, reviewedAt, partClass] of [
      [BEL_PATH, "codex-bel-f1f2-0804-100m-independent-reviewer", "2026-08-27T01:22:00Z", "power.power-inductor"],
      [MURATA_PATH, "codex-murata-grm32er71e226ke15l-independent-reviewer", "2026-08-27T01:22:30Z", "shared.mlcc-capacitor"],
    ] as const) {
      const entry = admission.entries.find((candidate) => candidate.profilePath === path)!;
      expect(entry).toMatchObject({ reviewerTrack: "power", state: "reviewed", reviewedBy: reviewer, reviewedAt });
      expect(entry.authoredBy).not.toBe(entry.reviewedBy);
      expect(entry.checks).toEqual(requiredAdmissionCheckIds(partClass).map((checkId) => ({ checkId, status: "pass" })));
    }
    expect(reviewedAdmissionJson).toEqual(reviewedAdmissionProjection(admission));
    expect(admissionContentHash(admission)).toBe("sha256:58cae5e4625458bd06978575e48d4a3ace2b4bf3bfa2ef7849561a86f1bd1bf6");
    expect(catalogReleaseJson).toMatchObject({
      version: "2026-08-27.2",
      releasedAt: "2026-08-27T05:53:00Z",
      admissionContentHash: "sha256:58cae5e4625458bd06978575e48d4a3ace2b4bf3bfa2ef7849561a86f1bd1bf6",
      contentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
    });
    expect(catalogReleaseJson.profiles).toHaveLength(24);
  });
});
