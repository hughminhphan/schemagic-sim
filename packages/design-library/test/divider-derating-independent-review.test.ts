import { describe, expect, it } from "vitest";
import admissionJson from "../admission.json";
import catalogReleaseJson from "../catalog-release.json";
import manufacturersJson from "../manufacturers.json";
import bournsProfileJson from "../parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json";
import vishayProfileJson from "../parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json";
import reviewedAdmissionJson from "../reviewed-admission.json";
import {
  admissionContentHash,
  designProfileEnvelopeContentHash,
  requiredAdmissionCheckIds,
  reviewedAdmissionProjection,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
  type DesignProfileAdmissionLedgerV1,
  type ManufacturerRegistryV1,
} from "../src";

const bournsPath = "packages/design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json";
const vishayPath = "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json";
const bournsHash = "sha256:d9fb252c5e2440b34f7b4fc844497b2c4fcc8f6f3573b531da4f602804a677f6";
const vishayHash = "sha256:30d45602549f1ab1c4f9434b419ccdfa95a5381ef70ff4297d7ceb6ae50259c4";
const admission = admissionJson as DesignProfileAdmissionLedgerV1;
const reviewedAdmission = reviewedAdmissionJson as DesignProfileAdmissionLedgerV1;
const registry = manufacturersJson as ManufacturerRegistryV1;

function evidenceReferences(value: unknown): Array<Record<string, unknown>> {
  const references: Array<Record<string, unknown>> = [];
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (typeof entry !== "object" || entry === null) return;
    const record = entry as Record<string, unknown>;
    if (typeof record.sourceId === "string" && typeof record.locator === "string") {
      references.push(record);
      return;
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return references;
}

describe("independent divider resistor derating review", () => {
  it("pins both settled facts-V2 profile hashes and conservative continuous-power intervals", () => {
    for (const [profile, hash] of [
      [bournsProfileJson, bournsHash],
      [vishayProfileJson, vishayHash],
    ] as const) {
      expect(validateDesignProfileEnvelope(profile, registry)).toEqual([]);
      expect(validateProfileAdmissionRulesV2(profile as any)).toEqual([]);
      expect(designProfileEnvelopeContentHash(profile as any)).toBe(hash);
      expect(profile.facts.continuousPower).toMatchObject({
        value: { value: 0.1, unit: "W", displayUnit: "100 mW" },
        validFor: [{
          parameterId: "ambientTemperature",
          minimum: { value: 298.15, unit: "K", displayUnit: "25 °C" },
          maximum: { value: 343.15, unit: "K", displayUnit: "70 °C" },
        }],
      });
      expect(profile.facts.pulsePower).toMatchObject({
        value: null,
        state: "unknown",
        evidence: [],
        validFor: [],
      });
    }

    expect(bournsProfileJson.facts.continuousPower.evidence[0]?.locator)
      .toContain("Power Rating @ 70 °C = 1/10 W");
    expect(bournsProfileJson.facts.continuousPower.evidence[0]?.locator)
      .toContain("100 % power-ratio plateau includes 25 °C through 70 °C ambient");
    expect(vishayProfileJson.facts.continuousPower.evidence[0]?.locator)
      .toContain("P70 = 0.10 W");
    expect(vishayProfileJson.facts.continuousPower.evidence[0]?.locator)
      .toContain("flat at 0.10 W from -55 °C through 70 °C ambient");
  });

  it("pins every claim to the independently reviewed exact official source bytes", () => {
    const bournsReferences = evidenceReferences(bournsProfileJson);
    expect(bournsReferences).toHaveLength(12);
    for (const reference of bournsReferences) {
      expect(reference).toMatchObject({
        sourceId: "bourns-cr-series-datasheet",
        url: "https://www.bourns.com/docs/product-datasheets/CRxxxxx.pdf",
        contentHash: "sha256:97eac911e95cfefa618eedfbd990c5f2cd0104a1528ddb27eb46fbc79ac919bb",
        retrievedAt: "2026-08-24T06:50:27Z",
        revision: "REV. 03/21",
        kind: "manufacturer_datasheet",
        publicationBasis: "public_facts",
      });
    }

    const vishayReferences = evidenceReferences(vishayProfileJson);
    expect(vishayReferences).toHaveLength(12);
    for (const reference of vishayReferences) {
      expect(reference).toMatchObject({
        sourceId: "vishay-dcrcwe3-datasheet-20035",
        url: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
        contentHash: "sha256:124bdade8ba3957ee1b925d51a2d95ce571075780645d3d75b4a8502fc6cf068",
        retrievedAt: "2026-08-26T03:00:43+10:00",
        revision: "Rev. 14-Apr-2026",
        kind: "manufacturer_datasheet",
        publicationBasis: "public_facts",
      });
    }
    expect(JSON.stringify(vishayProfileJson)).not.toContain(
      "sha256:1f5e20329c74727da629b92e2bfbdbdb3fa3be57229e3208e24058173f9cecf3",
    );
  });

  it("records the approved review decision as reviewed state plus an independent pass", () => {
    for (const [path, authoredBy, authoredAt, hash] of [
      [bournsPath, "codex-divider-derating-bourns-profile-author", "2026-08-25T17:07:35Z", bournsHash],
      [vishayPath, "codex-divider-derating-vishay-profile-author", "2026-08-25T17:07:36Z", vishayHash],
    ] as const) {
      const entry = admission.entries.find((candidate) => candidate.profilePath === path);
      expect(entry).toMatchObject({
        ownerTrack: "integration-data-review",
        reviewerTrack: "power",
        state: "reviewed",
        authoredBy,
        authoredAt,
        reviewedBy: "codex-divider-derating-independent-reviewer",
        reviewedAt: "2026-08-25T17:21:39Z",
        profileContentHash: hash,
      });
      expect(entry?.authoredBy).not.toBe(entry?.reviewedBy);
      expect(entry?.checks).toEqual(requiredAdmissionCheckIds("shared.general-purpose-resistor")
        .map((checkId) => ({ checkId, status: "pass" })));
    }

    expect(reviewedAdmission).toEqual(reviewedAdmissionProjection(admission));
    expect(admissionContentHash(admission)).toBe(
      "sha256:58cae5e4625458bd06978575e48d4a3ace2b4bf3bfa2ef7849561a86f1bd1bf6",
    );
  });

  it("keeps the successor release hash-pinned", () => {
    expect(catalogReleaseJson).toMatchObject({
      version: "2026-08-27.2",
      releasedAt: "2026-08-27T05:53:00Z",
      manufacturerRegistryContentHash: "sha256:bf74225d2500671e39cf0aff44fa8cd76d6795b25bc4302a3b117583bb611b47",
      admissionContentHash: "sha256:58cae5e4625458bd06978575e48d4a3ace2b4bf3bfa2ef7849561a86f1bd1bf6",
      contentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
    });
    expect(catalogReleaseJson.profiles).toHaveLength(24);
    expect(catalogReleaseJson.profiles.find((entry) => entry.profilePath === bournsPath)?.profileContentHash)
      .toBe(bournsHash);
    expect(catalogReleaseJson.profiles.find((entry) => entry.profilePath === vishayPath)?.profileContentHash)
      .toBe(vishayHash);
  });
});
