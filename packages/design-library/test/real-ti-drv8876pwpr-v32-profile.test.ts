import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import profileJson from "../parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json";
import {
  calculateBoardAreaV2,
  designProfileContentHashV32,
  parseDesignProfileV32,
  validateDesignProfileV32,
  validateProfileAdmissionRulesV32,
  type DesignProfileV32,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";

const profilePath = new URL("../parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json", import.meta.url);
const profile = profileJson as unknown as DesignProfileV32<"motor.integrated-h-bridge">;
const sources = {
  "ti-drv8876-slvsds7b": {
    contentHash: "sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032",
    url: "https://www.ti.com/lit/ds/symlink/drv8876.pdf",
    revision: "SLVSDS7B, August 2019 – revised November 2019",
    retrievedAt: "2026-08-24T10:44:40Z",
    kind: "manufacturer_datasheet",
  },
  "ti-drv8876-webench-bxl": {
    contentHash: "sha256:d70487e2803882279c0fc0a967275b77d381c1d557403f65d5b905dd5f9279a3",
    url: "https://webench.ti.com/cad/TI_BXL/DRV8876_PWP_16.bxl",
    revision: "TI WEBENCH exact-part BXL, 135116 bytes; decoded footprint PWP0016J_M (Most)",
    retrievedAt: "2026-08-26T08:15:07+10:00",
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

describe("exact TI DRV8876PWPR facts 3.2.0 author profile", () => {
  it("parses in runtime and AJV and satisfies the reviewed admission rules", () => {
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
      manufacturerPartNumber: "DRV8876PWPR",
    });
    expect(profile.factsSchemaVersion).toBe("3.2.0");
  });

  it("preserves the conservative electrical and evidence-role boundaries", () => {
    expect(profile.facts.bridgeTopology.value).toBe("full_bridge");
    expect(profile.facts.powerStage.value).toBe("integrated_fet");
    expect(profile.facts.bridgeOutputArchitecture.value).toBe("single_full_bridge");
    expect(profile.facts.highSideDriveArchitecture.value).toBe("n_channel_charge_pump");
    expect(profile.facts.continuousHighSideOnSupported.value).toBe(true);
    expect(profile.facts.supplyVoltageOperatingMinimum.value).toMatchObject({ value: 4.5, unit: "V" });
    expect(profile.facts.supplyVoltageOperatingMaximum.value).toMatchObject({ value: 37, unit: "V" });
    expect(profile.facts.supplyVoltageAbsoluteMaximum.value).toMatchObject({ value: 40, unit: "V" });
    expect(profile.facts.logicHighThresholdMaximum.value).toMatchObject({ value: 1.5, unit: "V" });

    expect(profile.facts.continuousOutputCurrent).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.continuousOutputCurrentRole).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.peakOutputCurrent.value).toMatchObject({ value: 3.5, unit: "A" });
    expect(profile.facts.peakOutputCurrentRole.value).toBe("guaranteed_operating_limit");
    expect(profile.facts.peakOutputCurrent.explanation).toContain("not a continuous-current or stall-current proof");
    expect(profile.facts.currentRegulationInterface.value).toBe("integrated_current_mirror_output");
    expect(profile.facts.currentRegulationInterface.explanation).toContain("does not calculate or assert");

    expect(profile.facts.pwmMaximum.value).toMatchObject({ value: 100000, unit: "Hz" });
    expect(profile.facts.pwmMaximumRole.value).toBe("guaranteed_bound");
    expect(profile.facts.minimumInputPulseWidth).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.minimumInputPulseWidthRole).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.pathResistance.value).toMatchObject({ value: 0.84, unit: "ohm" });
    expect(profile.facts.pathResistanceRole.value).toBe("guaranteed_maximum");
    expect(profile.facts.pathResistance.explanation).toContain("0.42 + 0.42 = 0.84 ohm");
    expect(profile.facts.switchingTransitionTime.value).toMatchObject({ value: 1.5e-7, unit: "s" });
    expect(profile.facts.switchingTransitionTimeRole.value).toBe("typical_observation");
    expect(profile.facts.activeSupplyCurrent.value).toMatchObject({ value: 0.007, unit: "A" });
    expect(profile.facts.activeSupplyCurrentRole.value).toBe("guaranteed_maximum");
    expect(profile.facts.activeSupplyCurrent.explanation).toContain("cannot identify those individual pins");

    expect(profile.facts.junctionToAmbientThermalResistance.value).toMatchObject({ value: 44.3, unit: "K/W" });
    expect(profile.facts.junctionToAmbientThermalResistance.explanation).toContain("board and layout dependent");
    expect(profile.facts.maximumJunctionTemperature.value).toMatchObject({ value: 423.15, unit: "K" });
    expect(profile.facts.localSupplyDecouplingCapacitance.value).toMatchObject({ value: 1e-7, unit: "F" });
    expect(profile.facts.localSupplyDecouplingRequirement.value).toBe("recommended_value");
    expect(profile.facts.bulkCapacitance).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.bulkCapacitanceRequirement.value).toBe("application_dependent");

    for (const [quantity, role] of [
      [profile.facts.peakOutputCurrent, profile.facts.peakOutputCurrentRole],
      [profile.facts.pwmMaximum, profile.facts.pwmMaximumRole],
      [profile.facts.pathResistance, profile.facts.pathResistanceRole],
      [profile.facts.switchingTransitionTime, profile.facts.switchingTransitionTimeRole],
      [profile.facts.activeSupplyCurrent, profile.facts.activeSupplyCurrentRole],
      [profile.facts.localSupplyDecouplingCapacitance, profile.facts.localSupplyDecouplingRequirement],
    ] as const) {
      expect(role.evidence).toEqual(quantity.evidence);
      expect(role.validFor).toEqual(quantity.validFor);
    }
  });

  it("binds exact-part PWP Most-copper geometry without relying on the reference-only board-layout example", () => {
    expect(profile.commonFacts.packageName.value).toContain("HTSSOP (PWP)");
    expect(profile.facts.mountedGeometry.boardArea.value).toMatchObject({
      area: { value: 0.000038500010211, unit: "m2" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        {
          axis: "x",
          dimensionId: "pwp0016j-m-top-copper-x-span",
          multiplier: 1,
          maximum: { value: 0.00769999984, unit: "m" },
        },
        {
          axis: "y",
          dimensionId: "pwp0016j-m-top-copper-y-span",
          multiplier: 1,
          maximum: { value: 0.00500000143, unit: "m" },
        },
      ],
    });
    const dimensions = profile.facts.mountedGeometry.boardArea.value!.sourceDimensions;
    expect(calculateBoardAreaV2(dimensions)).toBe(profile.facts.mountedGeometry.boardArea.value!.area.value);
    const boardAreaText = JSON.stringify(profile.facts.mountedGeometry.boardArea);
    expect(boardAreaText).not.toContain("Example Board Layout");
    expect(boardAreaText).toContain("135116 bytes");
    expect(boardAreaText).toContain("PWP0016J_M");
    expect(profile.facts.mountedGeometry.boardArea.explanation).toContain("does not assert PWP0016A/PWP0016J equivalence");
    expect(profile.facts.mountedGeometry.boardArea.explanation).toContain("outer signal pads dominate");
    const boardAreaRefs = evidenceRefs(profile.facts.mountedGeometry.boardArea);
    expect(boardAreaRefs.every((ref) => ref.sourceId === "ti-drv8876-webench-bxl")).toBe(true);
    expect(boardAreaRefs.every((ref) => ref.publicationBasis === "public_facts")).toBe(true);
    expect(boardAreaRefs.every((ref) => ref.licenseNote.includes("not redistributed"))).toBe(true);
    expect(profile.facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.0012, unit: "m", displayUnit: "1.2 mm maximum" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });

    const refs = evidenceRefs(profile);
    expect(refs.length).toBeGreaterThan(0);
    expect(new Set(refs.map((ref) => ref.sourceId))).toEqual(new Set(Object.keys(sources)));
    for (const ref of refs) {
      expect(ref).toMatchObject(sources[ref.sourceId as keyof typeof sources]);
      expect(ref.publicationBasis).toBe("public_facts");
    }
  });

  it("locks authored bytes and canonical profile content", () => {
    expect(rawSha256()).toBe("b4ba3c7a65e77a2f3f794e298a83fc661eb1aea67aefc8ab2c4c609055f418af");
    expect(designProfileContentHashV32(profile)).toBe("sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b");
  });
});
