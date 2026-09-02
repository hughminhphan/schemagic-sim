import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  DESIGN_PROFILE_FACTS_CODECS_V34,
  FACTS_SCHEMA_VERSION_V34,
  POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34,
  admissionContentHash,
  canonicalDesignProfileEnvelope,
  contentHash,
  designProfileEnvelopeContentHash,
  designProfileContentHashV34,
  getDesignProfileCodecForVersion,
  loadReviewedDesignLibraryEnvelope,
  parseDesignProfileForV34,
  parseDesignProfileV34,
  reviewedAdmissionProjection,
  validateDesignLibraryEnvelope,
  validateDesignProfile,
  validateDesignProfileEnvelope,
  validateDesignProfileV34,
  validateProfileAdmissionRulesV34,
  type DesignLibraryDocuments,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileV34,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
} from "../src";
import { SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedLibraryFixture, createSyntheticReviewedProfile } from "../src/fixtures";

const schemaRoot = new URL("../schema/", import.meta.url);
const v34ProfileSchemaId = "https://schemas.schemagic.design/design-library/v1/profile.facts-v3-4.schema.json";

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

/**
 * Compiling every checked-in schema is the dominant cost in this suite, so the
 * instance is built once per test file instead of once per test.
 */
let ajvInstance: Ajv2020 | undefined;
function ajv() {
  if (ajvInstance) return ajvInstance;
  const instance = new Ajv2020({ allErrors: true, strict: true });
  addFormats(instance);
  for (const path of schemaFiles(schemaRoot.pathname)) instance.addSchema(JSON.parse(readFileSync(path, "utf8")));
  ajvInstance = instance;
  return instance;
}

function unknown(explanation: string) {
  return { value: null, state: "unknown" as const, evidence: [], validFor: [], explanation };
}

function mountedGeometry(evidence: ProfileEvidenceRef[]) {
  return {
    boardArea: {
      value: {
        area: { value: 2e-6, unit: "m2" as const, displayUnit: "2 mm²" },
        basis: "manufacturer_recommended_land_pattern_bounding_box" as const,
        calculation: "maximum_x_span_times_maximum_y_span" as const,
        sourceDimensions: [
          { axis: "x" as const, dimensionId: "land-x", multiplier: 1, maximum: { value: 1e-3, unit: "m" as const, displayUnit: "1 mm" }, evidence: structuredClone(evidence) },
          { axis: "y" as const, dimensionId: "land-y", multiplier: 1, maximum: { value: 2e-3, unit: "m" as const, displayUnit: "2 mm" }, evidence: structuredClone(evidence) },
        ],
      },
      state: "calculated" as const,
      evidence: structuredClone(evidence),
      validFor: [],
      explanation: "Synthetic manufacturer land-pattern rectangle.",
    },
    maximumHeight: {
      value: {
        height: { value: 1e-3, unit: "m" as const, displayUnit: "1 mm" },
        basis: "manufacturer_package_maximum_in_surface_mount_orientation" as const,
      },
      state: "reviewed" as const,
      evidence: structuredClone(evidence),
      validFor: [],
      explanation: "Synthetic reviewed maximum mounted height.",
    },
  };
}

type Excitation = "current" | "voltage" | "both" | "none";

function v34Profile(excitation: Excitation = "current"): DesignProfileV34 {
  const v1 = structuredClone(createSyntheticReviewedProfile("power.power-inductor"));
  const inductance = v1.facts.inductance;
  const current = inductance.validFor.find((range) => range.parameterId === "testCurrent")!;
  const voltage = {
    ...structuredClone(current),
    parameterId: "testVoltage",
    minimum: { value: 0.5, unit: "V" as const, displayUnit: "0.5 V" },
    maximum: { value: 0.5, unit: "V" as const, displayUnit: "0.5 V" },
  };
  inductance.validFor = inductance.validFor.filter((range) => range.parameterId !== "testCurrent");
  if (excitation === "current" || excitation === "both") inductance.validFor.push(current);
  if (excitation === "voltage" || excitation === "both") inductance.validFor.push(voltage);
  const geometryEvidence = structuredClone(v1.commonFacts.packageName.evidence);
  return {
    ...v1,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    commonFacts: {
      packageName: v1.commonFacts.packageName,
      boardArea: unknown("Facts 3.4.0 carries mounted board area inside class facts."),
      maximumHeight: unknown("Facts 3.4.0 carries mounted maximum height inside class facts."),
    },
    facts: {
      ...v1.facts,
      mountedGeometry: mountedGeometry(geometryEvidence),
    },
  } as unknown as DesignProfileV34;
}

function duplicateCondition(profile: DesignProfileV34, parameterId: string): DesignProfileV34 {
  const changed = structuredClone(profile);
  const condition = changed.facts.inductance.validFor.find((range) => range.parameterId === parameterId);
  if (!condition) throw new Error(`Fixture lacks ${parameterId}`);
  changed.facts.inductance.validFor.push(structuredClone(condition));
  return changed;
}

describe("power.power-inductor facts 3.4.0 contract", () => {
  it("keeps one code-owned inclusive excitation policy and exact selected-class tuple", () => {
    expect(POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34).toEqual({
      factId: "inductance",
      requiredExactlyOnce: ["switchingFrequency"],
      requiredAtLeastOneOf: ["testCurrent", "testVoltage"],
      uniqueWhenPresent: ["testCurrent", "testVoltage"],
    });
    expect(Object.isFrozen(POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34)).toBe(true);
    const validateSchema = ajv().getSchema(v34ProfileSchemaId)!;
    const valid = v34Profile("voltage");
    expect(validateDesignProfileV34(valid, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(validateSchema(valid), JSON.stringify(validateSchema.errors)).toBe(true);

    const wrongClass = { ...valid, partClass: "shared.mlcc-capacitor" };
    const wrongVersion = { ...valid, factsSchemaVersion: "3.3.0" };
    for (const changed of [wrongClass, wrongVersion]) {
      expect(validateDesignProfileV34(changed, SYNTHETIC_MANUFACTURER_REGISTRY).length).toBeGreaterThan(0);
      expect(validateSchema(changed)).toBe(false);
    }
  });

  it("matches runtime and AJV for current-only, voltage-only, both, missing, duplicate, unit, and unknown-state cases", () => {
    const validateSchema = ajv().getSchema(v34ProfileSchemaId)!;
    const missingFrequency = v34Profile("voltage");
    missingFrequency.facts.inductance.validFor = missingFrequency.facts.inductance.validFor.filter((range) => range.parameterId !== "switchingFrequency");
    const duplicateFrequency = duplicateCondition(v34Profile("voltage"), "switchingFrequency");
    const duplicateCurrent = duplicateCondition(v34Profile("current"), "testCurrent");
    const duplicateVoltage = duplicateCondition(v34Profile("voltage"), "testVoltage");
    const wrongVoltageUnit = v34Profile("voltage");
    const voltage = wrongVoltageUnit.facts.inductance.validFor.find((range) => range.parameterId === "testVoltage")!;
    voltage.minimum = { value: 0.5, unit: "A", displayUnit: "wrong" };
    voltage.maximum = { value: 0.5, unit: "A", displayUnit: "wrong" };
    const unknownWithClaims = v34Profile("voltage");
    unknownWithClaims.facts.inductance.state = "unknown";
    const unknownParameter = v34Profile("voltage");
    unknownParameter.facts.inductance.validFor.push({
      parameterId: "unreviewedExcitation",
      minimum: { value: 1, unit: "V", displayUnit: "1 V" },
      maximum: { value: 1, unit: "V", displayUnit: "1 V" },
      evidence: structuredClone(unknownParameter.facts.inductance.evidence),
    });
    const emptyRange = v34Profile("voltage");
    const emptyVoltage = emptyRange.facts.inductance.validFor.find((range) => range.parameterId === "testVoltage")!;
    emptyVoltage.minimum = null;
    emptyVoltage.maximum = null;
    const conditionedPackageName = v34Profile("voltage");
    conditionedPackageName.commonFacts.packageName.validFor = [
      structuredClone(conditionedPackageName.facts.inductance.validFor[0]!),
    ];

    const cases: Array<{ label: string; profile: DesignProfileV34; valid: boolean }> = [
      { label: "current-only", profile: v34Profile("current"), valid: true },
      { label: "voltage-only", profile: v34Profile("voltage"), valid: true },
      { label: "both", profile: v34Profile("both"), valid: true },
      { label: "missing excitation", profile: v34Profile("none"), valid: false },
      { label: "missing frequency", profile: missingFrequency, valid: false },
      { label: "duplicate frequency", profile: duplicateFrequency, valid: false },
      { label: "duplicate current", profile: duplicateCurrent, valid: false },
      { label: "duplicate voltage", profile: duplicateVoltage, valid: false },
      { label: "wrong voltage unit", profile: wrongVoltageUnit, valid: false },
      { label: "unknown with value/evidence/conditions", profile: unknownWithClaims, valid: false },
      { label: "unknown condition parameter", profile: unknownParameter, valid: false },
      { label: "empty condition range", profile: emptyRange, valid: false },
      { label: "conditioned package name", profile: conditionedPackageName, valid: false },
    ];

    for (const testCase of cases) {
      const runtimeValid = validateDesignProfileV34(testCase.profile, SYNTHETIC_MANUFACTURER_REGISTRY).length === 0;
      const schemaValid = validateSchema(testCase.profile) as boolean;
      expect(runtimeValid, `${testCase.label}: runtime`).toBe(testCase.valid);
      expect(schemaValid, `${testCase.label}: ${JSON.stringify(validateSchema.errors)}`).toBe(testCase.valid);
      expect(runtimeValid, `${testCase.label}: bidirectional parity`).toBe(schemaValid);
    }
  });

  it("dispatches, parses, hashes, and admits exact 3.4.0 facts without widening other classes", () => {
    const input = v34Profile("both");
    expect(validateDesignProfileEnvelope(input, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(validateProfileAdmissionRulesV34(input)).toEqual([]);
    const parsed = parseDesignProfileV34(input, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(designProfileContentHashV34(parsed)).toBe(designProfileEnvelopeContentHash(parsed));

    expect(Object.keys(DESIGN_PROFILE_FACTS_CODECS_V34)).toEqual(["power.power-inductor"]);
    const codec = getDesignProfileCodecForVersion("power.power-inductor", "3.4.0");
    expect(codec).toBe(DESIGN_PROFILE_FACTS_CODECS_V34["power.power-inductor"]);
    const manufacturer = SYNTHETIC_MANUFACTURER_REGISTRY.manufacturers[0];
    expect(codec.validateFacts(input.facts, manufacturer)).toEqual([]);
    expect(codec.parseFacts(input.facts, manufacturer)).toEqual(input.facts);
    expect(parseDesignProfileForV34(codec, input, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual(input);
    expect(() => (getDesignProfileCodecForVersion as (partClass: string, version: string) => unknown)(
      "shared.general-purpose-resistor",
      "3.4.0",
    )).toThrow(/unknown_codec_version/);
  });

  it("preserves facts-V2 admission states for optional inductor evidence", () => {
    const calculated = v34Profile("current");
    calculated.facts.coreLoss.state = "calculated";
    const estimated = v34Profile("current");
    estimated.facts.coreLossTestFrequency.state = "estimated";
    for (const profile of [calculated, estimated]) {
      expect(validateDesignProfileV34(profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
      expect(validateProfileAdmissionRulesV34(profile)).toEqual([]);
    }
  });

  it("routes a reviewed 3.4.0 profile through the mixed-version library boundary", () => {
    const documents = structuredClone(createSyntheticReviewedLibraryFixture(["power.power-inductor"])) as DesignLibraryDocuments;
    const input = v34Profile("voltage");
    const admission = documents.admission as DesignProfileAdmissionLedgerV1;
    const registry = documents.manufacturerRegistry as ManufacturerRegistryV1;
    const release = documents.catalogRelease as any;
    const path = admission.entries[0]!.profilePath;
    const profileHash = designProfileEnvelopeContentHash(input);
    documents.profiles = { [path]: input };
    admission.entries[0]!.profileContentHash = profileHash;
    release.admissionContentHash = admissionContentHash(admission);
    release.profiles[0].profileContentHash = profileHash;
    release.contentHash = contentHash({
      manufacturerRegistry: registry,
      admission: reviewedAdmissionProjection(admission),
      profiles: [canonicalDesignProfileEnvelope(input)],
    });
    expect(validateDesignLibraryEnvelope(documents)).toEqual([]);
    expect(loadReviewedDesignLibraryEnvelope(documents).profiles[0]!.factsSchemaVersion).toBe("3.4.0");
  });

  it("keeps V1 and V2 voltage-only inductance invalid", () => {
    const schemas = ajv();
    const v1 = structuredClone(createSyntheticReviewedProfile("power.power-inductor"));
    const current = v1.facts.inductance.validFor.find((range) => range.parameterId === "testCurrent")!;
    v1.facts.inductance.validFor = v1.facts.inductance.validFor
      .filter((range) => range.parameterId !== "testCurrent")
      .concat({
        ...current,
        parameterId: "testVoltage",
        minimum: { value: 0.5, unit: "V", displayUnit: "0.5 V" },
        maximum: { value: 0.5, unit: "V", displayUnit: "0.5 V" },
      } as never);
    expect(validateDesignProfile(v1, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "missing_required_range" }));
    expect(schemas.getSchema("https://schemas.schemagic.design/design-library/v1/profile.v1.schema.json")!(v1)).toBe(false);

    const v2 = { ...v34Profile("voltage"), factsSchemaVersion: "2.0.0" };
    expect(validateDesignProfileEnvelope(v2, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "missing_required_range" }));
    expect(schemas.getSchema("https://schemas.schemagic.design/design-library/v1/profile.facts-v2.schema.json")!(v2)).toBe(false);
  });
});
