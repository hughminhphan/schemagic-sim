import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import admissionJson from "../admission.json";
import catalogReleaseJson from "../catalog-release.json";
import manufacturersJson from "../manufacturers.json";
import profileJson from "../parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json";
import reviewedAdmissionJson from "../reviewed-admission.json";
import {
  admissionContentHash,
  calculateBoardAreaV2,
  designProfileContentHashV32,
  requiredAdmissionCheckIds,
  reviewedAdmissionProjection,
  validateCommercialDataBoundary,
  validateDesignProfileAdmission,
  validateDesignProfileV32,
  validateManufacturerRegistry,
  validateProfileAdmissionRulesV32,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileV32,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";

const PROFILE_PATH = "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json";
const PROFILE_HASH = "sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a";
const RAW_PROFILE_SHA256 = "60139a958b6289dd368c3b56afb6b60bfbe0d6b26ce8f4599bad4d09696e0510";
const DATASHEET_HASH = "sha256:f07b6126ffab94c7b13a46ce0b758c85e6fa58068bf407480f7a0b954ddc32a7";
const BXL_HASH = "sha256:932f211c9de4d7628b9483dfd8b5d8162cfbf2c7a0d6271cd2acda89e93827d3";
const REVIEWED_BY = "codex-ti-drv8262ddvr-v32-independent-reviewer";
const REVIEWED_AT = "2026-08-27T05:52:13Z";

const profilePath = new URL("../parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json", import.meta.url);
const profile = profileJson as unknown as DesignProfileV32<"motor.integrated-h-bridge">;
const admission = admissionJson as DesignProfileAdmissionLedgerV1;
const registry = manufacturersJson as ManufacturerRegistryV1;

const sources = {
  "ti-drv8262-slvsfv5c": {
    sourceId: "ti-drv8262-slvsfv5c",
    contentHash: DATASHEET_HASH,
    url: "https://www.ti.com/lit/ds/symlink/drv8262.pdf",
    revision: "SLVSFV5C, July 2023 - revised July 2025",
    retrievedAt: "2026-08-25T20:30:52Z",
    kind: "manufacturer_datasheet",
    publicationBasis: "public_facts",
  },
  "ti-drv8262-webench-bxl": {
    sourceId: "ti-drv8262-webench-bxl",
    contentHash: BXL_HASH,
    url: "https://webench.ti.com/cad/TI_BXL/DRV8262_DDV_44.bxl",
    revision: "TI WEBENCH exact-part BXL, 47416 bytes; decoded footprint DDV0044E-IPC_A (Most/Density A)",
    retrievedAt: "2026-08-26T08:17:24+10:00",
    kind: "manufacturer_product_page",
    publicationBasis: "public_facts",
  },
} as const;

function evidenceRefs(value: unknown): ProfileEvidenceRef[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.sourceId === "string" && typeof record.locator === "string") {
    return [record as unknown as ProfileEvidenceRef];
  }
  return Object.values(record).flatMap(evidenceRefs);
}

describe("independent TI DRV8262DDVR facts 3.2.0 review", () => {
  it("pins immutable profile bytes, canonical identity, and all closed admission boundaries", () => {
    expect(createHash("sha256").update(readFileSync(profilePath)).digest("hex")).toBe(RAW_PROFILE_SHA256);
    expect(designProfileContentHashV32(profile)).toBe(PROFILE_HASH);
    expect(validateManufacturerRegistry(registry)).toEqual([]);
    expect(validateDesignProfileV32(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV32(profile)).toEqual([]);
    expect(validateCommercialDataBoundary(profile)).toEqual([]);

    expect(profile).toMatchObject({
      format: "schemagic-design-profile",
      schemaVersion: "1.0.0",
      factsSchemaVersion: "3.2.0",
      partClass: "motor.integrated-h-bridge",
      part: {
        manufacturerId: "texas-instruments",
        manufacturerPartNumber: "DRV8262DDVR",
      },
    });
  });

  it("binds every populated fact to the exact TI datasheet or exact-part WEBENCH BXL identity", () => {
    const refs = evidenceRefs(profile);
    expect(refs.length).toBeGreaterThan(0);
    expect(new Set(refs.map((ref) => ref.sourceId))).toEqual(new Set(Object.keys(sources)));

    for (const ref of refs) {
      expect(ref).toMatchObject(sources[ref.sourceId as keyof typeof sources]);
      expect(ref.licenseNote).toMatch(/not redistributed/i);
    }

    const bxlRefs = refs.filter((ref) => ref.sourceId === "ti-drv8262-webench-bxl");
    expect(bxlRefs).toHaveLength(4);
    expect(bxlRefs.every((ref) => ref.locator.includes("decoded exact-part Component DRV8262DDVR"))).toBe(true);
    expect(bxlRefs.every((ref) => ref.locator.includes("DDV0044E-IPC_A"))).toBe(true);
    expect(bxlRefs.every((ref) => ref.locator.includes("TOP-copper"))).toBe(true);
  });

  it("independently reconstructs the conservative DDV Most copper-envelope geometry", () => {
    const metresPerMil = 0.0000254;
    const xSpan = 2 * (146.6687 + 38.49275) * metresPerMil;
    const ySpan = 2 * (262.5 + 7.72585) * metresPerMil;
    const expectedArea = xSpan * ySpan;
    const geometry = profile.facts.mountedGeometry;

    expect(xSpan).toBeCloseTo(0.00940620166, 15);
    expect(ySpan).toBeCloseTo(0.01372747318, 15);
    expect(expectedArea).toBeCloseTo(0.000129123381013, 15);
    expect(geometry.boardArea.value).toMatchObject({
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", dimensionId: "ddv0044e-ipc-a-top-copper-x-span", maximum: { value: xSpan, unit: "m" } },
        { axis: "y", dimensionId: "ddv0044e-ipc-a-top-copper-y-span", maximum: { value: ySpan, unit: "m" } },
      ],
    });
    expect(geometry.boardArea.value?.area.value).toBeCloseTo(expectedArea, 15);
    expect(calculateBoardAreaV2(geometry.boardArea.value!.sourceDimensions)).toBe(geometry.boardArea.value!.area.value);
    expect(geometry.maximumHeight.value).toEqual({
      height: { value: 0.0012, unit: "m", displayUnit: "1.2 mm maximum" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });
    expect(JSON.stringify(geometry.boardArea)).not.toContain("Example Board Layout");
  });

  it("preserves operating, protection, PWM, thermal, capacitor-network, model, and eligibility boundaries", () => {
    const facts = profile.facts;
    expect(facts.continuousOutputCurrent).toMatchObject({ value: { value: 20, unit: "A" } });
    expect(facts.continuousOutputCurrentRole.value).toBe("guaranteed_operating_limit");
    expect(facts.continuousOutputCurrent.explanation).toContain("not a proof");
    expect(facts.peakOutputCurrent).toMatchObject({ value: { value: 32, unit: "A" } });
    expect(facts.peakOutputCurrentRole.value).toBe("protection_threshold");
    expect(facts.peakOutputCurrent.explanation).toContain("not a normal peak or stall-current guarantee");

    for (const fact of [
      facts.pwmMaximum,
      facts.pwmMaximumRole,
      facts.minimumInputPulseWidth,
      facts.minimumInputPulseWidthRole,
      facts.junctionToAmbientThermalResistance,
    ]) {
      expect(fact).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    }
    expect(facts.pwmMaximum.explanation).toContain("200 kHz");
    expect(facts.pwmMaximum.explanation).toContain("not a guaranteed electrical limit");
    expect(facts.junctionToAmbientThermalResistance.explanation).toContain("assembly-applicable");

    expect(facts.localSupplyDecouplingCapacitance.value).toEqual({ value: 1e-8, unit: "F", displayUnit: "10 nF per VM bypass position" });
    expect(facts.localSupplyDecouplingCapacitance.explanation).toContain("two distinct VM bypass positions");
    expect(facts.localSupplyDecouplingCapacitance.explanation).toContain("one-local-capacitor materialization is therefore incomplete");
    expect(facts.bulkCapacitance).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.bulkCapacitanceRequirement.value).toBe("application_dependent");

    const text = JSON.stringify(profile);
    expect(text).not.toContain("selected-semiconductor");
    expect(text).not.toContain("eligible");
    expect(text).not.toContain("simulation fidelity");
  });

  it("pins the independent reviewer and the successor reviewed release projection", () => {
    expect(validateDesignProfileAdmission(admission)).toEqual([]);
    const entry = admission.entries.find((candidate) => candidate.profilePath === PROFILE_PATH)!;
    expect(entry).toMatchObject({
      state: "reviewed",
      authoredBy: "codex-ti-drv8262ddvr-v32-profile-author",
      reviewerTrack: "integration-data-review",
      reviewedBy: REVIEWED_BY,
      reviewedAt: REVIEWED_AT,
      profileContentHash: PROFILE_HASH,
    });
    expect(entry.authoredBy).not.toBe(entry.reviewedBy);
    expect(entry.checks).toEqual(requiredAdmissionCheckIds("motor.integrated-h-bridge").map((checkId) => ({
      checkId,
      status: "pass",
    })));

    expect(reviewedAdmissionJson).toEqual(reviewedAdmissionProjection(admission));
    expect(admissionContentHash(admission)).toBe("sha256:58cae5e4625458bd06978575e48d4a3ace2b4bf3bfa2ef7849561a86f1bd1bf6");
    expect(catalogReleaseJson).toMatchObject({
      version: "2026-08-27.2",
      releasedAt: "2026-08-27T05:53:00Z",
      admissionContentHash: "sha256:58cae5e4625458bd06978575e48d4a3ace2b4bf3bfa2ef7849561a86f1bd1bf6",
      contentHash: "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e",
    });
    expect(catalogReleaseJson.profiles).toHaveLength(24);
    expect(catalogReleaseJson.profiles.find((candidate) => candidate.profilePath === PROFILE_PATH)).toEqual({
      profileId: PROFILE_PATH,
      profilePath: PROFILE_PATH,
      partClass: "motor.integrated-h-bridge",
      part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "DRV8262DDVR" },
      profileContentHash: PROFILE_HASH,
    });
  });
});
