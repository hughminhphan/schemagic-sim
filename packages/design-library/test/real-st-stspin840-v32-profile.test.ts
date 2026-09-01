import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import profileJson from "../parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json";
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

const profilePath = new URL("../parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json", import.meta.url);
const profile = profileJson as unknown as DesignProfileV32<"motor.integrated-h-bridge">;
const source = {
  sourceId: "st-stspin840-docid031835-rev1",
  contentHash: "sha256:d2e0f820b7faf997987de18df0fe89bf83b7dc8c35a6a18856a961f8682e06ef",
  url: "https://st.com/resource/en/datasheet/stspin840.pdf",
  revision: "DocID031835 Rev 1, May 2018",
  retrievedAt: "2026-08-24T02:35:30.683Z",
} as const;
const registry = {
  format: "schemagic-manufacturer-registry",
  schemaVersion: "1.0.0",
  manufacturers: [{
    manufacturerId: "stmicroelectronics",
    displayName: "STMicroelectronics",
    primaryEvidenceHosts: ["st.com"],
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
  if (record.kind === "manufacturer_datasheet" && typeof record.sourceId === "string") {
    return [record as unknown as ProfileEvidenceRef];
  }
  return Object.values(record).flatMap(evidenceRefs);
}

function rawSha256(): string {
  return createHash("sha256").update(readFileSync(profilePath)).digest("hex");
}

describe("exact STMicroelectronics STSPIN840 facts 3.2.0 author profile", () => {
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
      manufacturerId: "stmicroelectronics",
      manufacturerPartNumber: "STSPIN840",
    });
    expect(profile.factsSchemaVersion).toBe("3.2.0");
  }, 20_000);

  it("preserves conservative architecture, rating, and timing boundaries", () => {
    expect(profile.facts.bridgeTopology.value).toBe("full_bridge");
    expect(profile.facts.powerStage.value).toBe("integrated_fet");
    expect(profile.facts.bridgeOutputArchitecture.value).toBe("dual_full_bridge_parallel_capable");
    expect(profile.facts.highSideDriveArchitecture.value).toBe("p_channel_direct");
    expect(profile.facts.continuousHighSideOnSupported).toMatchObject({
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
    });

    expect(profile.facts.supplyVoltageOperatingMinimum.value).toMatchObject({ value: 7, unit: "V" });
    expect(profile.facts.supplyVoltageOperatingMaximum.value).toMatchObject({ value: 45, unit: "V" });
    expect(profile.facts.supplyVoltageAbsoluteMaximum.value).toMatchObject({ value: 48, unit: "V" });
    expect(profile.facts.logicHighThresholdMaximum.value).toMatchObject({ value: 2, unit: "V" });

    expect(profile.facts.continuousOutputCurrent.value).toMatchObject({ value: 1.5, unit: "A" });
    expect(profile.facts.continuousOutputCurrentRole.value).toBe("absolute_rating");
    expect(profile.facts.continuousOutputCurrent.explanation).toContain("not a guaranteed operating");
    expect(profile.facts.continuousOutputCurrent.explanation).toContain("3 Arms");
    expect(profile.facts.peakOutputCurrent).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.peakOutputCurrentRole).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });

    expect(profile.facts.currentRegulationInterface.value).toBe("external_reference_and_sense");
    expect(profile.facts.pwmMaximum).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.minimumInputPulseWidth).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.switchingTransitionTime).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.pathResistance.value).toMatchObject({ value: 1.6, unit: "ohm" });
    expect(profile.facts.pathResistanceRole.value).toBe("guaranteed_maximum");
    expect(profile.facts.pathResistance.explanation).toContain("not the 500-milliohm typical");
    expect(profile.facts.pathResistance.validFor.map((condition) => condition.parameterId)).toEqual([
      "junctionTemperature",
      "supplyVoltage",
      "testCurrent",
    ]);

    expect(profile.facts.activeSupplyCurrent.value).toMatchObject({ value: 0.003, unit: "A" });
    expect(profile.facts.activeSupplyCurrentRole.value).toBe("guaranteed_maximum");
    expect(profile.facts.activeSupplyCurrent.explanation).toContain("no-commutations");
    expect(profile.facts.junctionToAmbientThermalResistance.value).toMatchObject({ value: 36.5, unit: "K/W" });
    expect(profile.facts.junctionToAmbientThermalResistance.explanation).toContain("not an application thermal prediction");
    expect(profile.facts.maximumJunctionTemperature.value).toMatchObject({ value: 423.15, unit: "K" });

    for (const [quantity, role] of [
      [profile.facts.continuousOutputCurrent, profile.facts.continuousOutputCurrentRole],
      [profile.facts.pathResistance, profile.facts.pathResistanceRole],
      [profile.facts.activeSupplyCurrent, profile.facts.activeSupplyCurrentRole],
    ] as const) {
      expect(role.evidence).toEqual(quantity.evidence);
      expect(role.validFor).toEqual(quantity.validFor);
    }
  });

  it("keeps capacitor values typical and binds the exact package geometry", () => {
    expect(profile.facts.localSupplyDecouplingCapacitance.value).toMatchObject({ value: 3.3e-7, unit: "F" });
    expect(profile.facts.localSupplyDecouplingRequirement.value).toBe("typical_observation");
    expect(profile.facts.bulkCapacitance.value).toMatchObject({ value: 3.3e-5, unit: "F" });
    expect(profile.facts.bulkCapacitanceRequirement.value).toBe("typical_observation");
    expect(profile.facts.localSupplyDecouplingRequirement.evidence).toEqual(
      profile.facts.localSupplyDecouplingCapacitance.evidence,
    );
    expect(profile.facts.bulkCapacitanceRequirement.evidence).toEqual(profile.facts.bulkCapacitance.evidence);
    expect(profile.facts.bulkCapacitance.explanation).toContain("does not establish a universal requirement");

    expect(profile.commonFacts.packageName.value).toBe("TFQFPN 4 x 4 x 1.05 - 24 L");
    const area = profile.facts.mountedGeometry.boardArea.value;
    expect(area).toMatchObject({
      area: { value: 0.0000216225, unit: "m2" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        { axis: "x", maximum: { value: 0.00465, unit: "m" } },
        { axis: "y", maximum: { value: 0.00465, unit: "m" } },
      ],
    });
    expect(area && calculateBoardAreaV2(area.sourceDimensions)).toBe(area?.area.value);
    expect(profile.facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.0011, unit: "m", displayUnit: "1.10 mm maximum" },
      basis: "manufacturer_package_maximum_in_surface_mount_orientation",
    });

    const refs = evidenceRefs(profile);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ref).toMatchObject(source);
    expect(refs.every((ref) => ref.kind === "manufacturer_datasheet")).toBe(true);
  });

  it("locks authored bytes and canonical profile content", () => {
    expect(rawSha256()).toBe("2f43af580582f3d5bd7af0cf200ebe1ee12bea18653fce2bf6f3d42f372f417f");
    expect(designProfileContentHashV32(profile)).toBe("sha256:ff26581027998c75964057ab16342ad331c1c001d177a95a4e99aae7509387c2");
  });
});
