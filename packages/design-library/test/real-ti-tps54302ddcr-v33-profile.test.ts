import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import profileJson from "../parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json";
import {
  calculateBoardAreaV2,
  designProfileContentHashV33,
  parseDesignProfileV33,
  validateDesignProfileV33,
  validateProfileAdmissionRulesV33,
  type DesignProfileV33,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";

const profilePath = new URL("../parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json", import.meta.url);
const profile = profileJson as unknown as DesignProfileV33<"power.integrated-synchronous-buck-regulator">;
const sources = {
  "ti-tps54302-datasheet": {
    contentHash: "sha256:1632b388d1ba3a46c8e8f090ddfec2114c0f538cfb8364ddcda583fee3fdbdc5",
    url: "https://www.ti.com/lit/ds/symlink/tps54302.pdf",
    revision: "SLVSDG6C, May 2016 – revised March 2026",
    retrievedAt: "2026-08-24T02:16:17+10:00",
    kind: "manufacturer_datasheet",
  },
  "ti-tps54302-product": {
    contentHash: "sha256:ea48851586f05be8121ec68a1ad7f237f16ca3a230d9bec6d8290e02251838a0",
    url: "https://www.ti.com/product/TPS54302",
    revision: "retrieved product page, 2026-08-24",
    retrievedAt: "2026-08-24T11:13:12+10:00",
    kind: "manufacturer_product_page",
  },
  "ti-tps54302-webench-bxl": {
    contentHash: "sha256:d877128565f6d15699b3079795906ec814f5722ccc3a9a5515bd5ee2919d8f1c",
    url: "https://webench.ti.com/cad/TI_BXL/TPS54302_DDC_6.bxl",
    revision: "TI WEBENCH exact-part BXL, 48946 bytes; decoded footprint DDC0006A_M (Most)",
    retrievedAt: "2026-08-26T08:17:22+10:00",
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

describe("exact TI TPS54302DDCR facts 3.3.0 author profile", () => {
  it("parses in runtime and AJV and satisfies candidate admission semantics", () => {
    expect(validateDesignProfileV33(profile, registry)).toEqual([]);
    expect(validateProfileAdmissionRulesV33(profile)).toEqual([]);
    expect(parseDesignProfileV33(profile, registry)).toEqual(profile);

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const path of schemaFiles(new URL("../schema/", import.meta.url).pathname)) {
      ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
    }
    const validateSchema = ajv.getSchema("https://schemas.schemagic.design/design-library/v1/profile.facts-v3-3.schema.json");
    expect(validateSchema, "facts 3.3.0 profile schema must exist").toBeDefined();
    expect(validateSchema!(profile), JSON.stringify(validateSchema!.errors)).toBe(true);

    expect(profile.part).toEqual({
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: "TPS54302DDCR",
    });
    expect(profile.factsSchemaVersion).toBe("3.3.0");
  });

  it("retains architecture, operating-range, current, frequency, and feedback evidence roles", () => {
    expect(profile.facts.converterTopology.value).toBe("synchronous_buck");
    expect(profile.facts.powerStage.value).toBe("integrated_fet");
    expect(profile.facts.compensationArchitecture.value).toBe("internal");
    expect(profile.facts.compensationArchitecture.explanation).toContain("does not establish loop crossover");

    expect(profile.facts.inputVoltageOperatingMinimum.value).toMatchObject({ value: 4.5, unit: "V" });
    expect(profile.facts.inputVoltageOperatingMaximum.value).toMatchObject({ value: 28, unit: "V" });
    expect(profile.facts.inputVoltageAbsoluteMaximum.value).toMatchObject({ value: 30, unit: "V" });
    expect(profile.facts.outputVoltageOperatingMinimum.value).toMatchObject({ value: 0.6, unit: "V" });
    expect(profile.facts.outputVoltageOperatingMaximum.value).toMatchObject({ value: 26, unit: "V" });
    expect(profile.facts.outputVoltageOperatingMaximum.explanation).toContain("arbitrary selected design");

    expect(profile.facts.outputCurrent.value).toMatchObject({ value: 3, unit: "A" });
    expect(profile.facts.outputCurrentRole.value).toBe("continuous_capability_statement");
    expect(profile.facts.outputCurrent.explanation).toContain("does not prove");
    expect(profile.facts.outputCurrentRole.evidence).toEqual(profile.facts.outputCurrent.evidence);
    expect(profile.facts.outputCurrentRole.validFor).toEqual(profile.facts.outputCurrent.validFor);

    expect(profile.facts.switchingFrequencyArchitecture.value).toBe("fixed_oscillator");
    expect(profile.facts.switchingFrequencyMinimum.value).toMatchObject({ value: 290000, unit: "Hz" });
    expect(profile.facts.switchingFrequencyNominal.value).toMatchObject({ value: 400000, unit: "Hz" });
    expect(profile.facts.switchingFrequencyMaximum.value).toMatchObject({ value: 510000, unit: "Hz" });
    expect(profile.facts.switchingFrequencyRole.value).toBe("production_spread");
    expect(profile.facts.switchingFrequencyNominal.explanation).toContain("not a configurable recommendation");

    expect(profile.facts.feedbackReferenceMinimum.value).toMatchObject({ value: 0.581, unit: "V" });
    expect(profile.facts.feedbackReferenceTypical.value).toMatchObject({ value: 0.596, unit: "V" });
    expect(profile.facts.feedbackReferenceMaximum.value).toMatchObject({ value: 0.611, unit: "V" });
    expect(profile.facts.feedbackReferenceRole.value).toBe("production_spread");

    for (const fact of [
      profile.facts.switchingFrequencyMinimum,
      profile.facts.switchingFrequencyNominal,
      profile.facts.switchingFrequencyMaximum,
    ]) {
      expect(fact.evidence).toEqual(profile.facts.switchingFrequencyRole.evidence);
      expect(fact.validFor).toEqual(profile.facts.switchingFrequencyRole.validFor);
    }
    for (const fact of [
      profile.facts.feedbackReferenceMinimum,
      profile.facts.feedbackReferenceTypical,
      profile.facts.feedbackReferenceMaximum,
    ]) {
      expect(fact.evidence).toEqual(profile.facts.feedbackReferenceRole.evidence);
      expect(fact.validFor).toEqual(profile.facts.feedbackReferenceRole.validFor);
    }
  });

  it("does not promote protection, nominal timing, typical losses, or thermal characteristics", () => {
    expect(profile.facts.currentLimitMinimum.value).toMatchObject({ value: 4, unit: "A" });
    expect(profile.facts.currentLimitTypical.value).toMatchObject({ value: 5, unit: "A" });
    expect(profile.facts.currentLimitMaximum.value).toMatchObject({ value: 6, unit: "A" });
    expect(profile.facts.currentLimitRole.value).toBe("protection_threshold");
    expect(profile.facts.currentLimitRole.explanation).toContain("not normal output-current capability");

    expect(profile.facts.minimumOnTime.value).toMatchObject({ value: 1.1e-7, unit: "s" });
    expect(profile.facts.minimumOnTimeRole.value).toBe("typical_observation");
    expect(profile.facts.minimumOnTime.explanation).toContain("not production tested");
    expect(profile.facts.minimumOnTime.explanation).toContain("not a guaranteed duty-cycle bound");
    expect(profile.facts.minimumOffTime).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });
    expect(profile.facts.minimumOffTimeRole).toMatchObject({ value: null, state: "unknown", evidence: [], validFor: [] });

    expect(profile.facts.highSideOnResistance.value).toMatchObject({ value: 0.085, unit: "ohm" });
    expect(profile.facts.highSideOnResistanceRole.value).toBe("typical_observation");
    expect(profile.facts.lowSideOnResistance.value).toMatchObject({ value: 0.04, unit: "ohm" });
    expect(profile.facts.lowSideOnResistanceRole.value).toBe("typical_observation");
    expect(profile.facts.nonSwitchingSupplyCurrent.value).toMatchObject({ value: 0.000045, unit: "A" });
    expect(profile.facts.nonSwitchingSupplyCurrentRole.value).toBe("typical_observation");
    expect(profile.facts.nonSwitchingSupplyCurrent.explanation).toContain("not a switching or full-load loss model");
    expect(profile.facts.junctionToAmbientThermalResistance.value).toMatchObject({ value: 118.9, unit: "K/W" });
    expect(profile.facts.junctionToAmbientThermalResistanceRole.value).toBe("test_characteristic");
    expect(profile.facts.junctionToAmbientThermalResistance.explanation).toContain("does not predict junction temperature");
    expect(profile.facts.maximumJunctionTemperature.value).toMatchObject({ value: 423.15, unit: "K" });

    for (const [quantity, role] of [
      [profile.facts.minimumOnTime, profile.facts.minimumOnTimeRole],
      [profile.facts.highSideOnResistance, profile.facts.highSideOnResistanceRole],
      [profile.facts.lowSideOnResistance, profile.facts.lowSideOnResistanceRole],
      [profile.facts.nonSwitchingSupplyCurrent, profile.facts.nonSwitchingSupplyCurrentRole],
      [profile.facts.junctionToAmbientThermalResistance, profile.facts.junctionToAmbientThermalResistanceRole],
    ] as const) {
      expect(role.evidence).toEqual(quantity.evidence);
      expect(role.validFor).toEqual(quantity.validFor);
    }
  });

  it("binds required nominal bootstrap capacitance and exact-part Most-copper geometry", () => {
    expect(profile.facts.bootstrapCapacitance.value).toMatchObject({ value: 1e-7, unit: "F" });
    expect(profile.facts.bootstrapCapacitanceRequirement.value).toBe("required_nominal_value");
    expect(profile.facts.bootstrapCapacitanceRequirement.evidence).toEqual(profile.facts.bootstrapCapacitance.evidence);
    expect(profile.facts.bootstrapCapacitance.explanation).toContain("not a minimum effective-capacitance guarantee");
    const bootstrapEvidenceText = JSON.stringify(profile.facts.bootstrapCapacitance.evidence);
    expect(bootstrapEvidenceText).toContain("physical PDF page 12, section 6.3.10 Bootstrap Voltage");
    expect(bootstrapEvidenceText).not.toContain("physical PDF page 11, section 6.3.10 Bootstrap Voltage");

    expect(profile.commonFacts.packageName.value).toBe("SOT-23-THIN (DDC), 6-pin");
    const area = profile.facts.mountedGeometry.boardArea.value;
    expect(area).toMatchObject({
      area: { value: 0.000010582498183, unit: "m2" },
      basis: "manufacturer_recommended_land_pattern_bounding_box",
      calculation: "maximum_x_span_times_maximum_y_span",
      sourceDimensions: [
        {
          axis: "x",
          dimensionId: "ddc0006a-m-top-copper-x-span",
          multiplier: 1,
          maximum: { value: 0.00414999932, unit: "m" },
        },
        {
          axis: "y",
          dimensionId: "ddc0006a-m-top-copper-y-span",
          multiplier: 1,
          maximum: { value: 0.00254999998, unit: "m" },
        },
      ],
    });
    expect(area && calculateBoardAreaV2(area.sourceDimensions)).toBe(area?.area.value);
    const boardAreaText = JSON.stringify(profile.facts.mountedGeometry.boardArea);
    expect(boardAreaText).not.toContain("Example Board Layout");
    expect(boardAreaText).toContain("48946 bytes");
    expect(boardAreaText).toContain("DDC0006A_M");
    const boardAreaRefs = evidenceRefs(profile.facts.mountedGeometry.boardArea);
    expect(boardAreaRefs.every((ref) => ref.sourceId === "ti-tps54302-webench-bxl")).toBe(true);
    expect(boardAreaRefs.every((ref) => ref.publicationBasis === "public_facts")).toBe(true);
    expect(boardAreaRefs.every((ref) => ref.licenseNote.includes("not redistributed"))).toBe(true);
    expect(profile.facts.mountedGeometry.maximumHeight.value).toEqual({
      height: { value: 0.0011, unit: "m", displayUnit: "1.1 mm maximum" },
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
    expect(rawSha256()).toBe("95adfb2814ab3786b6329ae6ac68c1463a5e9acd886b245d9a34f96793aa866d");
    expect(designProfileContentHashV33(profile)).toBe("sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c");
  });
});
