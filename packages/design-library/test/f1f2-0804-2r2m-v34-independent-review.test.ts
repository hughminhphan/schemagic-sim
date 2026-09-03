import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import admissionJson from "../admission.json";
import manufacturersJson from "../manufacturers.json";
import profileJson from "../parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json";
import {
  calculateBoardAreaV2,
  designProfileContentHashV34,
  requiredAdmissionCheckIds,
  validateCommercialDataBoundary,
  validateDesignProfileV34,
  validateProfileAdmissionRulesV34,
  type BoardAreaDimensionTermV2,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileV34,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";

const profilePath = new URL("../parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json", import.meta.url);
const schemaRoot = new URL("../schema/", import.meta.url);
const profile = profileJson as unknown as DesignProfileV34<"power.power-inductor">;
const registry = manufacturersJson as ManufacturerRegistryV1;
const admission = admissionJson as DesignProfileAdmissionLedgerV1;
const canonicalProfileHash = "sha256:6eb4c18bb984319a5fa56d615f571c03e4fa7670e2782ff4754dbba13dbc89b6";
const sourceHash = "sha256:c3523b58c262a6d39716711a5a05a5b6e5a60081eb15818bf35ba4b93e7a828f";
const sourceUrl = "https://www.belfuse.com/media/datasheets/products/chokes-coils-inductors/ds-ST-F1F2-0804-series.pdf";

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

function evidenceRefs(value: unknown): ProfileEvidenceRef[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.sourceId === "string" && typeof record.locator === "string") {
    return [record as unknown as ProfileEvidenceRef];
  }
  return Object.values(record).flatMap(evidenceRefs);
}

describe("independent Bel Fuse F1F2-0804-2R2M facts 3.4.0 review", () => {
  it("pins the exact staged bytes, canonical profile hash, and closed admission boundaries", () => {
    expect(createHash("sha256").update(readFileSync(profilePath)).digest("hex"))
      .toBe("2c47e19a41781ac9a53ce8b9a081fd853aab9cd1b1485c03b1b9321fc26d22f6");
    expect(designProfileContentHashV34(profile)).toBe(canonicalProfileHash);
    expect(validateDesignProfileV34(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV34(profile)).toEqual([]);
    expect(validateCommercialDataBoundary(profile)).toEqual([]);
    expect(profile).toMatchObject({
      partClass: "power.power-inductor",
      part: { manufacturerId: "bel-fuse", manufacturerPartNumber: "F1F2-0804-2R2M" },
      factsSchemaVersion: "3.4.0",
    });
  });

  it("passes the generated facts 3.4 JSON Schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(fileURLToPath(schemaRoot))) ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    const validate = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.facts-v3-4.schema.json");
    if (validate === undefined) throw new Error("Missing facts 3.4 profile schema");
    expect(validate(profileJson), JSON.stringify(validate.errors)).toBe(true);
  });

  it("binds every factual claim to the exact official Bel Fuse source bytes", () => {
    const refs = evidenceRefs(profile);
    expect(refs).toHaveLength(15);
    for (const ref of refs) {
      expect(ref).toMatchObject({
        sourceId: "bel-f1f2-0804-rev-a-datasheet",
        kind: "manufacturer_datasheet",
        url: sourceUrl,
        revision: "Revision A, dated 07/17/2026",
        retrievedAt: "2026-08-26T01:27:04+10:00",
        contentHash: sourceHash,
        publicationBasis: "public_facts",
      });
      expect(new URL(ref.url!).hostname).toBe("www.belfuse.com");
    }
  });

  it("preserves conservative current, DCR, excitation, geometry, and unknown semantics", () => {
    expect(profile.facts.inductance).toMatchObject({
      state: "reviewed",
      value: { value: 2.2e-6, unit: "H" },
      validFor: [
        { parameterId: "switchingFrequency", minimum: { value: 100_000, unit: "Hz" }, maximum: { value: 100_000, unit: "Hz" } },
        { parameterId: "testVoltage", minimum: { value: 0.25, unit: "V" }, maximum: { value: 0.25, unit: "V" } },
      ],
    });
    expect(profile.facts.inductance.explanation).toContain("typical nominal");
    expect(profile.facts.saturationCurrent).toMatchObject({ state: "reviewed", value: { value: 12, unit: "A" } });
    expect(profile.facts.rmsCurrent).toMatchObject({ state: "reviewed", value: { value: 10, unit: "A" } });
    expect(profile.facts.dcResistance).toMatchObject({ state: "reviewed", value: { value: 0.01, unit: "ohm" } });
    for (const fact of [profile.facts.saturationCurrent, profile.facts.rmsCurrent, profile.facts.dcResistance]) {
      expect(fact.validFor).toMatchObject([{
        parameterId: "ambientTemperature",
        minimum: { value: 298.15, unit: "K" },
        maximum: { value: 298.15, unit: "K" },
      }]);
    }
    expect(profile.facts.coreLoss).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.coreLossTestFrequency).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.maximumOperatingTemperature.value).toMatchObject({ value: 428.15, unit: "K" });

    const geometry = profile.facts.mountedGeometry;
    expect(calculateBoardAreaV2(
      geometry.boardArea.value!.sourceDimensions as readonly BoardAreaDimensionTermV2[],
    )).toBe(0.00004028);
    expect(geometry.boardArea.value).toMatchObject({
      area: { value: 0.00004028, unit: "m2" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
    });
    expect(geometry.maximumHeight.value).toMatchObject({ height: { value: 0.004, unit: "m" } });
  });

  it("pins the truthful independent-review admission metadata", () => {
    const entry = admission.entries.find((candidate) => candidate.profilePath
      === "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json");
    expect(entry).toMatchObject({
      ownerTrack: "integration-data-review",
      reviewerTrack: "power",
      state: "reviewed",
      authoredBy: "codex-bel-f1f2-0804-2r2m-profile-author",
      authoredAt: "2026-08-25T15:27:04Z",
      reviewedBy: "codex-bel-f1f2-0804-2r2m-independent-reviewer",
      reviewedAt: "2026-08-25T15:44:04Z",
      profileContentHash: canonicalProfileHash,
    });
    expect(entry?.authoredBy).not.toBe(entry?.reviewedBy);
    expect(entry?.checks).toEqual(requiredAdmissionCheckIds("power.power-inductor")
      .map((checkId) => ({ checkId, status: "pass" })));
  });
});
