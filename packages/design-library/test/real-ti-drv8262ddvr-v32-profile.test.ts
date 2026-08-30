import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import admissionJson from "../admission.json";
import profileJson from "../parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json";
import {
  calculateBoardAreaV2,
  designProfileContentHashV32,
  parseDesignProfileV32,
  validateDesignProfileV32,
  validateProfileAdmissionRulesV32,
  type DesignProfileV32,
  type ManufacturerRegistryV1,
  type OperatingRange,
  type ProfileEvidenceRef,
} from "../src";

const profilePath = new URL("../parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json", import.meta.url);
const profile = profileJson as unknown as DesignProfileV32<"motor.integrated-h-bridge">;
const sources = {
  "ti-drv8262-slvsfv5c": {
    contentHash: "sha256:f07b6126ffab94c7b13a46ce0b758c85e6fa58068bf407480f7a0b954ddc32a7",
    url: "https://www.ti.com/lit/ds/symlink/drv8262.pdf",
    revision: "SLVSFV5C, July 2023 - revised July 2025",
    retrievedAt: "2026-08-25T20:30:52Z",
    kind: "manufacturer_datasheet",
  },
  "ti-drv8262-webench-bxl": {
    contentHash: "sha256:932f211c9de4d7628b9483dfd8b5d8162cfbf2c7a0d6271cd2acda89e93827d3",
    url: "https://webench.ti.com/cad/TI_BXL/DRV8262_DDV_44.bxl",
    revision: "TI WEBENCH exact-part BXL, 47416 bytes; decoded footprint DDV0044E-IPC_A (Most/Density A)",
    retrievedAt: "2026-08-26T08:17:24+10:00",
    kind: "manufacturer_product_page",
  },
} as const;
const registry = {
  format: "schemagic-manufacturer-registry",
  schemaVersion: "1.0.0",
  manufacturers: [{
    manufacturerId: "texas-instruments",
    displayName: "Texas Instruments",
    primaryEvidenceHosts: ["ti.com", "webench.ti.com", "www.ti.com"],
  }],
} as ManufacturerRegistryV1;

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

function evidenceRefs(value: unknown): ProfileEvidenceRef[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (
    (record.kind === "manufacturer_datasheet" || record.kind === "manufacturer_product_page")
    && typeof record.sourceId === "string"
  ) {
    return [record as unknown as ProfileEvidenceRef];
  }
  return Object.values(record).flatMap(evidenceRefs);
}

function rawSha256(): string {
  return createHash("sha256").update(readFileSync(profilePath)).digest("hex");
}

function conditionBounds(ranges: readonly OperatingRange[]) {
  return ranges.map((range) => ({
    parameterId: range.parameterId,
    minimum: range.minimum === null ? null : { value: range.minimum.value, unit: range.minimum.unit },
    maximum: range.maximum === null ? null : { value: range.maximum.value, unit: range.maximum.unit },
  }));
}

const recommendedOperatingDomain = [
  {
    parameterId: "ambientTemperature",
    minimum: { value: 233.15, unit: "K" },
    maximum: { value: 398.15, unit: "K" },
  },
  {
    parameterId: "junctionTemperature",
    minimum: { value: 233.15, unit: "K" },
    maximum: { value: 423.15, unit: "K" },
  },
  {
    parameterId: "supplyVoltage",
    minimum: { value: 4.5, unit: "V" },
    maximum: { value: 60, unit: "V" },
  },
] as const;

describe("exact TI DRV8262DDVR facts 3.2.0 profile", () => {
  it("parses in runtime and AJV and satisfies candidate admission semantics", () => {
    expect(validateDesignProfileV32(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV32(profile)).toEqual([]);
    expect(parseDesignProfileV32(profile, registry)).toEqual(profile);

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(new URL("../schema/", import.meta.url).pathname)) {
      ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    }
    const validateSchema = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.facts-v3-2.schema.json");
    expect(validateSchema, "facts 3.2.0 profile schema must exist").toBeDefined();
    expect(validateSchema!(profile), JSON.stringify(validateSchema!.errors)).toBe(true);

    expect(profile.part).toEqual({
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: "DRV8262DDVR",
    });
    expect(profile.factsSchemaVersion).toBe("3.2.0");
  }, 20_000);

  it("keeps 20 A as the operating limit and 32 A as protection-only evidence", () => {
    expect(profile.facts.bridgeTopology.value).toBe("full_bridge");
    expect(profile.facts.powerStage.value).toBe("integrated_fet");
    expect(profile.facts.bridgeOutputArchitecture.value).toBe("dual_full_bridge_parallel_capable");
    expect(profile.facts.highSideDriveArchitecture.value).toBe("n_channel_charge_pump");
    expect(profile.facts.continuousHighSideOnSupported.value).toBe(true);

    expect(profile.facts.supplyVoltageOperatingMinimum.value).toMatchObject({ value: 4.5, unit: "V" });
    expect(profile.facts.supplyVoltageOperatingMaximum.value).toMatchObject({ value: 60, unit: "V" });
    expect(profile.facts.supplyVoltageAbsoluteMaximum.value).toMatchObject({ value: 70, unit: "V" });
    expect(profile.facts.supplyVoltageOperatingMaximum.explanation).toBe(
      "The machine operating maximum is 60 V from the recommended-operating table. The simplified schematic's 65 V label is not promoted over that table.",
    );
    expect(conditionBounds(profile.facts.logicHighThresholdMaximum.validFor)).toEqual(recommendedOperatingDomain);

    expect(profile.facts.continuousOutputCurrent.value).toMatchObject({ value: 20, unit: "A" });
    expect(profile.facts.continuousOutputCurrentRole.value).toBe("guaranteed_operating_limit");
    expect(profile.facts.continuousOutputCurrent.explanation).toContain("DDV package");
    expect(profile.facts.continuousOutputCurrent.explanation).toContain("not a proof");
    expect(conditionBounds(profile.facts.continuousOutputCurrent.validFor)).toEqual(recommendedOperatingDomain);
    expect(profile.facts.continuousOutputCurrentRole.validFor).toEqual(profile.facts.continuousOutputCurrent.validFor);

    expect(profile.facts.peakOutputCurrent.value).toMatchObject({ value: 32, unit: "A" });
    expect(profile.facts.peakOutputCurrentRole.value).toBe("protection_threshold");
    expect(profile.facts.peakOutputCurrent.explanation).toContain("no pulse duration");
    expect(profile.facts.peakOutputCurrent.explanation).toContain("not a normal peak or stall-current guarantee");
    expect(profile.facts.peakOutputCurrent.evidence[0]?.locator).toContain("physical PDF page 11");
    expect(profile.facts.peakOutputCurrent.evidence[0]?.locator).not.toContain("Features");
    expect(conditionBounds(profile.facts.peakOutputCurrent.validFor)).toEqual(recommendedOperatingDomain);
    expect(profile.facts.peakOutputCurrentRole.evidence).toEqual(profile.facts.peakOutputCurrent.evidence);
    expect(profile.facts.peakOutputCurrentRole.validFor).toEqual(profile.facts.peakOutputCurrent.validFor);

    expect(profile.facts.currentRegulationInterface.value).toBe("integrated_current_mirror_output");
    expect(profile.facts.currentRegulationInterface.explanation).toContain("does not derive a configured current limit");
    expect(profile.facts.pwmMaximum).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.pwmMaximumRole).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.pwmMaximum.explanation).toContain("page 40");
    expect(profile.facts.pwmMaximum.explanation).toContain("not a guaranteed electrical limit");
    expect(profile.facts.minimumInputPulseWidth).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.minimumInputPulseWidthRole).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
  });

  it("preserves hot-path, timing, supply-current, and thermal caveats", () => {
    expect(profile.facts.pathResistance.value).toMatchObject({ value: 0.104, unit: "ohm" });
    expect(profile.facts.pathResistanceRole.value).toBe("guaranteed_maximum");
    expect(conditionBounds(profile.facts.pathResistance.validFor)).toEqual([
      recommendedOperatingDomain[0],
      {
        parameterId: "junctionTemperature",
        minimum: { value: 423.15, unit: "K" },
        maximum: { value: 423.15, unit: "K" },
      },
      recommendedOperatingDomain[2],
      {
        parameterId: "testCurrent",
        minimum: { value: 5, unit: "A" },
        maximum: { value: 5, unit: "A" },
      },
    ]);
    expect(profile.facts.pathResistanceRole.evidence).toEqual(profile.facts.pathResistance.evidence);
    expect(profile.facts.pathResistanceRole.validFor).toEqual(profile.facts.pathResistance.validFor);

    expect(profile.facts.switchingTransitionTime.value).toMatchObject({ value: 1.1e-7, unit: "s" });
    expect(profile.facts.switchingTransitionTimeRole.value).toBe("typical_observation");
    expect(profile.facts.activeSupplyCurrent.value).toMatchObject({ value: 0.013, unit: "A" });
    expect(profile.facts.activeSupplyCurrentRole.value).toBe("guaranteed_maximum");
    expect(profile.facts.activeSupplyCurrent.explanation).toContain("no motor load");
    expect(profile.facts.activeSupplyCurrent.explanation).toContain("not representable in validFor");
    expect(conditionBounds(profile.facts.activeSupplyCurrent.validFor)).toEqual(recommendedOperatingDomain);
    expect(profile.facts.activeSupplyCurrentRole.validFor).toEqual(profile.facts.activeSupplyCurrent.validFor);
    expect(profile.facts.junctionToAmbientThermalResistance).toMatchObject({
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
    });
    expect(profile.facts.junctionToAmbientThermalResistance.explanation).toContain("assembly-applicable");
    expect(profile.facts.junctionToAmbientThermalResistance.explanation).toContain("cannot represent");
    expect(profile.facts.maximumJunctionTemperature.value).toMatchObject({ value: 423.15, unit: "K" });

    for (const [quantity, role] of [
      [profile.facts.continuousOutputCurrent, profile.facts.continuousOutputCurrentRole],
      [profile.facts.pwmMaximum, profile.facts.pwmMaximumRole],
      [profile.facts.switchingTransitionTime, profile.facts.switchingTransitionTimeRole],
      [profile.facts.activeSupplyCurrent, profile.facts.activeSupplyCurrentRole],
    ] as const) {
      expect(role.evidence).toEqual(quantity.evidence);
      expect(role.validFor).toEqual(quantity.validFor);
    }
  });

  it("makes the incomplete external-capacitor network and exact-part DDV Most geometry explicit", () => {
    expect(profile.facts.localSupplyDecouplingCapacitance.value).toMatchObject({ value: 1e-8, unit: "F" });
    expect(profile.facts.localSupplyDecouplingRequirement.value).toBe("recommended_value");
    expect(profile.facts.localSupplyDecouplingRequirement.evidence).toEqual(
      profile.facts.localSupplyDecouplingCapacitance.evidence,
    );
    expect(profile.facts.localSupplyDecouplingCapacitance.explanation).toContain("two distinct VM bypass positions");
    expect(profile.facts.localSupplyDecouplingCapacitance.explanation).toContain("one-local-capacitor materialization is therefore incomplete");
    expect(profile.facts.bulkCapacitance).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.bulkCapacitanceRequirement.value).toBe("application_dependent");

    expect(profile.commonFacts.packageName.value).toContain("HTSSOP (DDV)");
    const area = profile.facts.mountedGeometry.boardArea.value;
    expect(area).toMatchObject({
      area: { value: 0.000129123381013, unit: "m2" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        {
          axis: "x",
          dimensionId: "ddv0044e-ipc-a-top-copper-x-span",
          multiplier: 1,
          maximum: { value: 0.00940620166, unit: "m" },
        },
        {
          axis: "y",
          dimensionId: "ddv0044e-ipc-a-top-copper-y-span",
          multiplier: 1,
          maximum: { value: 0.01372747318, unit: "m" },
        },
      ],
    });
    expect(calculateBoardAreaV2(area!.sourceDimensions)).toBe(area!.area.value);
    const boardAreaText = JSON.stringify(profile.facts.mountedGeometry.boardArea);
    expect(boardAreaText).not.toContain("Example Board Layout");
    expect(boardAreaText).toContain("47416 bytes");
    expect(boardAreaText).toContain("DDV0044E-IPC_A");
    const boardAreaRefs = evidenceRefs(profile.facts.mountedGeometry.boardArea);
    expect(boardAreaRefs.every((ref) => ref.sourceId === "ti-drv8262-webench-bxl")).toBe(true);
    expect(boardAreaRefs.every((ref) => ref.publicationBasis === "public_facts")).toBe(true);
    expect(boardAreaRefs.every((ref) => ref.licenseNote.includes("not redistributed"))).toBe(true);
    expect(profile.facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.0012, unit: "m", displayUnit: "1.2 mm maximum" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });
  });

  it("binds every populated fact to pinned official TI sources", () => {
    const refs = evidenceRefs(profile);
    expect(refs.length).toBeGreaterThan(0);
    expect(new Set(refs.map((ref) => ref.sourceId))).toEqual(new Set(Object.keys(sources)));
    for (const ref of refs) {
      expect(ref).toMatchObject(sources[ref.sourceId as keyof typeof sources]);
      expect(ref.publicationBasis).toBe("public_facts");
    }
  });

  it("is admitted only after the exact independent review record passes", () => {
    const entry = admissionJson.entries.find((candidate) =>
      candidate.part.manufacturerId === "texas-instruments"
      && candidate.part.manufacturerPartNumber === "DRV8262DDVR");
    expect(entry).toMatchObject({
      profilePath: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json",
      ownerTrack: "motor",
      reviewerTrack: "integration-data-review",
      state: "reviewed",
      authoredBy: "codex-ti-drv8262ddvr-v32-profile-author",
      reviewedBy: "codex-ti-drv8262ddvr-v32-independent-reviewer",
      reviewedAt: "2026-08-27T05:52:13Z",
    });
    expect(entry?.checks.find((check) => check.checkId === "review.independent")?.status).toBe("pass");
  });

  it("locks authored bytes and canonical profile content", () => {
    expect(rawSha256()).toBe("60139a958b6289dd368c3b56afb6b60bfbe0d6b26ce8f4599bad4d09696e0510");
    expect(designProfileContentHashV32(profile)).toBe("sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a");
  });
});
