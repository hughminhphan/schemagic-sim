import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import admissionJson from "../admission.json";
import manufacturersJson from "../manufacturers.json";
import profileJson from "../parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json";
import {
  calculateBoardAreaV2,
  designProfileContentHashV32,
  requiredAdmissionCheckIds,
  validateDesignProfileAdmission,
  validateDesignProfileV32,
  validateManufacturerRegistry,
  validateProfileAdmissionRulesV32,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileV32,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";

const profilePath = new URL("../parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json", import.meta.url);
const profile = profileJson as unknown as DesignProfileV32<"motor.integrated-h-bridge">;
const registry = manufacturersJson as ManufacturerRegistryV1;
const admission = admissionJson as DesignProfileAdmissionLedgerV1;
const sources = {
  "ti-drv8876-slvsds7b": {
    sourceId: "ti-drv8876-slvsds7b",
    contentHash: "sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032",
    url: "https://www.ti.com/lit/ds/symlink/drv8876.pdf",
    revision: "SLVSDS7B, August 2019 – revised November 2019",
    retrievedAt: "2026-08-24T10:44:40Z",
    kind: "manufacturer_datasheet",
    publicationBasis: "public_facts",
  },
  "ti-drv8876-webench-bxl": {
    sourceId: "ti-drv8876-webench-bxl",
    contentHash: "sha256:d70487e2803882279c0fc0a967275b77d381c1d557403f65d5b905dd5f9279a3",
    url: "https://webench.ti.com/cad/TI_BXL/DRV8876_PWP_16.bxl",
    revision: "TI WEBENCH exact-part BXL, 135116 bytes; decoded footprint PWP0016J_M (Most)",
    retrievedAt: "2026-08-26T08:15:07+10:00",
    kind: "manufacturer_product_page",
    publicationBasis: "public_facts",
  },
} as const;

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

describe("independent TI DRV8876PWPR facts 3.2.0 review", () => {
  it("pins exact authored bytes, canonical identity, runtime validity, and the closed AJV schema", () => {
    expect(createHash("sha256").update(readFileSync(profilePath)).digest("hex"))
      .toBe("b4ba3c7a65e77a2f3f794e298a83fc661eb1aea67aefc8ab2c4c609055f418af");
    expect(designProfileContentHashV32(profile))
      .toBe("sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b");
    expect(validateManufacturerRegistry(registry)).toEqual([]);
    expect(validateDesignProfileV32(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV32(profile)).toEqual([]);

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(new URL("../schema/", import.meta.url).pathname)) {
      ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    }
    const validateSchema = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.facts-v3-2.schema.json");
    expect(validateSchema).toBeTypeOf("function");
    expect(validateSchema!(profile), JSON.stringify(validateSchema!.errors)).toBe(true);

    expect(profile).toMatchObject({
      partClass: "motor.integrated-h-bridge",
      part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "DRV8876PWPR" },
      factsSchemaVersion: "3.2.0",
    });
    expect(profile.commonFacts.packageName.value).toContain("HTSSOP (PWP), 16-pin PowerPAD");
  }, 20_000);

  it("keeps guaranteed, typical, unknown, and application-dependent claims distinct", () => {
    const facts = profile.facts;
    expect(facts.bridgeTopology.value).toBe("full_bridge");
    expect(facts.powerStage.value).toBe("integrated_fet");
    expect(facts.bridgeOutputArchitecture.value).toBe("single_full_bridge");
    expect(facts.highSideDriveArchitecture.value).toBe("n_channel_charge_pump");
    expect(facts.continuousHighSideOnSupported.value).toBe(true);
    expect(facts.supplyVoltageOperatingMinimum.value?.value).toBe(4.5);
    expect(facts.supplyVoltageOperatingMaximum.value?.value).toBe(37);
    expect(facts.supplyVoltageAbsoluteMaximum.value?.value).toBe(40);
    expect(facts.logicHighThresholdMaximum.value?.value).toBe(1.5);
    expect(facts.logicHighThresholdMaximum.validFor.map((condition) => condition.parameterId)).toEqual([
      "junctionTemperature",
      "supplyVoltage",
    ]);

    expect(facts.continuousOutputCurrent).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.continuousOutputCurrentRole).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.peakOutputCurrent.value?.value).toBe(3.5);
    expect(facts.peakOutputCurrentRole.value).toBe("guaranteed_operating_limit");
    expect(facts.peakOutputCurrent.validFor.map((condition) => condition.parameterId)).toEqual([
      "ambientTemperature",
      "junctionTemperature",
    ]);
    expect(facts.peakOutputCurrent.explanation).toContain("not a continuous-current or stall-current proof");
    expect(facts.currentRegulationInterface.value).toBe("integrated_current_mirror_output");
    expect(facts.currentRegulationInterface.explanation).toContain("does not calculate or assert");

    expect(facts.pwmMaximum.value?.value).toBe(100_000);
    expect(facts.pwmMaximumRole.value).toBe("guaranteed_bound");
    expect(facts.pwmMaximum.validFor.map((condition) => condition.parameterId)).toEqual([
      "ambientTemperature",
      "junctionTemperature",
    ]);
    expect(facts.minimumInputPulseWidth).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.minimumInputPulseWidthRole).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.pathResistance.value?.value).toBe(0.84);
    expect(facts.pathResistanceRole.value).toBe("guaranteed_maximum");
    expect(facts.pathResistance.validFor.map((condition) => condition.parameterId)).toEqual([
      "junctionTemperature",
      "supplyVoltage",
      "testCurrent",
    ]);
    expect(facts.switchingTransitionTimeRole.value).toBe("typical_observation");
    expect(facts.switchingTransitionTime.value?.value).toBe(150e-9);
    expect(facts.switchingTransitionTime.validFor.map((condition) => condition.parameterId)).toEqual([
      "junctionTemperature",
      "supplyVoltage",
    ]);
    expect(facts.activeSupplyCurrentRole.value).toBe("guaranteed_maximum");
    expect(facts.activeSupplyCurrent.value?.value).toBe(0.007);
    expect(facts.activeSupplyCurrent.validFor.map((condition) => condition.parameterId)).toEqual([
      "junctionTemperature",
      "supplyVoltage",
    ]);
    expect(facts.activeSupplyCurrent.explanation).toContain("nSLEEP = 5 V and EN/IN1 = PH/IN2 = 0 V");

    expect(facts.junctionToAmbientThermalResistance.value?.value).toBe(44.3);
    expect(facts.junctionToAmbientThermalResistance.explanation).toContain("board and layout dependent");
    expect(facts.maximumJunctionTemperature.value?.value).toBe(423.15);

    expect(facts.localSupplyDecouplingCapacitance.value?.value).toBe(1e-7);
    expect(facts.localSupplyDecouplingRequirement.value).toBe("recommended_value");
    expect(facts.bulkCapacitance).toMatchObject({ state: "unknown", value: null, evidence: [], validFor: [] });
    expect(facts.bulkCapacitanceRequirement.value).toBe("application_dependent");

    for (const [quantity, role] of [
      [facts.peakOutputCurrent, facts.peakOutputCurrentRole],
      [facts.pwmMaximum, facts.pwmMaximumRole],
      [facts.pathResistance, facts.pathResistanceRole],
      [facts.switchingTransitionTime, facts.switchingTransitionTimeRole],
      [facts.activeSupplyCurrent, facts.activeSupplyCurrentRole],
      [facts.localSupplyDecouplingCapacitance, facts.localSupplyDecouplingRequirement],
    ] as const) {
      expect(role.evidence).toEqual(quantity.evidence);
      expect(role.validFor).toEqual(quantity.validFor);
    }
  });

  it("recomputes exact-part TI Most copper geometry and rejects the old reference-only example", () => {
    const areaFact = profile.facts.mountedGeometry.boardArea;
    const area = areaFact.value;
    expect(area?.sourceDimensions.map((dimension) => [dimension.axis, dimension.maximum.value])).toEqual([
      ["x", 0.00769999984],
      ["y", 0.00500000143],
    ]);
    expect(area?.sourceDimensions.map((dimension) => dimension.dimensionId)).toEqual([
      "pwp0016j-m-top-copper-x-span",
      "pwp0016j-m-top-copper-y-span",
    ]);
    expect(area?.area.value).toBe(0.000038500010211);
    expect(area && calculateBoardAreaV2(area.sourceDimensions)).toBe(area?.area.value);
    expect(area?.area.value).not.toBe(0.000029);
    expect(area?.sourceDimensions[0]?.maximum.value).not.toBe(0.0058);

    const areaText = JSON.stringify(areaFact);
    expect(areaText).toContain("Component DRV8876PWPR");
    expect(areaText).toContain("PWP0016J_M");
    expect(areaText).toContain("135116 bytes");
    expect(areaText).not.toContain("Example Board Layout");
    expect(areaText).not.toContain("physical PDF page 42");
    expect(areaFact.explanation).toContain("does not assert PWP0016A/PWP0016J equivalence");
    expect(areaFact.explanation).toContain("outer signal pads dominate");
    expect(areaFact.explanation).toContain("not a placement, thermal-pad, or routing proof");

    const areaRefs = evidenceRefs(areaFact);
    expect(areaRefs.length).toBe(4);
    for (const ref of areaRefs) {
      expect(ref).toMatchObject(sources["ti-drv8876-webench-bxl"]);
      expect(ref.licenseNote).toContain("not redistributed");
      expect(new URL(ref.url!).hostname).toBe("webench.ti.com");
    }

    const ti = registry.manufacturers.find((manufacturer) => manufacturer.manufacturerId === "texas-instruments");
    expect(ti?.primaryEvidenceHosts).toEqual(["ti.com", "webench.ti.com", "www.ti.com"]);
    expect(profile.facts.mountedGeometry.maximumHeight.value?.height.value).toBe(0.0012);
    expect(profile.facts.mountedGeometry.maximumHeight.value?.basis)
      .toBe("manufacturer_package_maximum_in_surface_mount_orientation");
    expect(profile.facts.mountedGeometry.maximumHeight.evidence).toHaveLength(1);
    expect(profile.facts.mountedGeometry.maximumHeight.evidence[0]).toMatchObject(sources["ti-drv8876-slvsds7b"]);
    expect(profile.facts.mountedGeometry.maximumHeight.evidence[0]?.locator).toContain("1.2 mm max height");

    const refs = evidenceRefs(profile);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatchObject(sources[ref.sourceId as keyof typeof sources]);
      expect(ref.publicationBasis).toBe("public_facts");
    }
  });

  it("binds the approved independent reviewer and all deterministic admission checks", () => {
    expect(validateDesignProfileAdmission(admission)).toEqual([]);
    const entry = admission.entries.find((candidate) => candidate.profilePath.endsWith("/DRV8876PWPR.json"));
    expect(entry).toMatchObject({
      ownerTrack: "motor",
      reviewerTrack: "integration-data-review",
      state: "reviewed",
      authoredBy: "codex-ti-drv8876pwpr-v32-profile-author",
      authoredAt: "2026-08-25T22:36:31Z",
      reviewedBy: "codex-ti-drv8876-bxl-independent-reviewer",
      reviewedAt: "2026-08-25T22:40:26Z",
      profileContentHash: "sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b",
    });
    expect(entry!.reviewedBy).not.toBe(entry!.authoredBy);
    expect(entry!.checks.map((check) => check.checkId)).toEqual(requiredAdmissionCheckIds("motor.integrated-h-bridge"));
    expect(entry!.checks.every((check) => check.status === "pass")).toBe(true);
  });
});
