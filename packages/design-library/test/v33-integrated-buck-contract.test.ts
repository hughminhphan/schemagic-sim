import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { contentHash } from "../src/canonical";
import { createSyntheticReviewedProfile, SYNTHETIC_MANUFACTURER_REGISTRY } from "../src/fixtures";
import type { FactSpec } from "../src/specs";
import type { ProfileEvidenceRef, ProfileFact, ProfileQuantity, ProfileUnit } from "../src/types";
import type { MountedGeometryFactsV2 } from "../src/v2-types";
import { V33_PART_CLASS_SPECS } from "../src/v33-specs";
import { FACTS_SCHEMA_VERSION_V33, type DesignProfileV33 } from "../src/v33-types";
import {
  designProfileContentHashV33,
  parseDesignProfileV33,
  validateDesignProfileV33,
  validateProfileAdmissionRulesV33,
} from "../src/v33-validation";

const schemaRoot = new URL("../schema/", import.meta.url);
const profileSchemaId = "https://schemas.schemagic.design/design-library/v1/profile.facts-v3-3.schema.json";

function quantity<Unit extends ProfileUnit>(value: number, unit: Unit): ProfileQuantity<Unit> {
  return { value, unit, displayUnit: unit };
}

function unknown(explanation: string): ProfileFact<never> {
  return { value: null, state: "unknown", evidence: [], validFor: [], explanation };
}

function evidence(locator = "Synthetic integrated buck facts 3.3.0 fixture, table 1"): ProfileEvidenceRef[] {
  const sourceId = "synthetic:integrated-buck:3.3.0";
  return [{
    kind: "manufacturer_datasheet",
    sourceId,
    locator,
    licenseNote: "Synthetic fixture carrying no real component claim.",
    retrievedAt: "2026-08-24T00:00:00Z",
    contentHash: contentHash({ sourceId, locator }),
    url: "https://synthetic-components.example.invalid/integrated-buck-v3-3.pdf",
    revision: "fixture-v3-3",
    publicationBasis: "public_facts",
  }];
}

function numericValue(factId: string): number {
  const values: Readonly<Record<string, number>> = {
    inputVoltageOperatingMinimum: 4.5,
    inputVoltageOperatingMaximum: 28,
    inputVoltageAbsoluteMaximum: 30,
    outputVoltageOperatingMinimum: 0.6,
    outputVoltageOperatingMaximum: 26,
    outputCurrent: 3,
    switchingFrequencyMinimum: 290_000,
    switchingFrequencyNominal: 400_000,
    switchingFrequencyMaximum: 510_000,
    feedbackReferenceMinimum: 0.581,
    feedbackReferenceTypical: 0.596,
    feedbackReferenceMaximum: 0.611,
    currentLimitMinimum: 4,
    currentLimitTypical: 5,
    currentLimitMaximum: 6,
    minimumOnTime: 110e-9,
    minimumOffTime: 200e-9,
    highSideOnResistance: 0.085,
    lowSideOnResistance: 0.04,
    nonSwitchingSupplyCurrent: 45e-6,
    junctionToAmbientThermalResistance: 118.9,
    maximumJunctionTemperature: 423.15,
    bootstrapCapacitance: 100e-9,
  };
  return values[factId] ?? 1;
}

function reviewedFact(factId: string, spec: FactSpec, refs: ProfileEvidenceRef[]): ProfileFact<unknown> {
  const value = spec.kind === "quantity"
    ? quantity(numericValue(factId), spec.unit)
    : spec.kind === "boolean"
      ? true
      : spec.values?.[0] ?? "synthetic-reviewed-value";
  return {
    value,
    state: "reviewed",
    evidence: structuredClone(refs),
    validFor: [],
    explanation: `Synthetic reviewed ${factId} used only to exercise the closed contract.`,
  };
}

function mountedGeometry(refs: ProfileEvidenceRef[]): MountedGeometryFactsV2["mountedGeometry"] {
  return {
    boardArea: {
      value: {
        area: quantity(9.5e-6, "m2"),
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          { axis: "x", dimensionId: "land-length", multiplier: 1, maximum: quantity(3.8e-3, "m"), evidence: structuredClone(refs) },
          { axis: "y", dimensionId: "land-width", multiplier: 1, maximum: quantity(2.5e-3, "m"), evidence: structuredClone(refs) },
        ],
      },
      state: "calculated",
      evidence: structuredClone(refs),
      validFor: [],
      explanation: "Canonical synthetic land-pattern bounding rectangle.",
    },
    maximumHeight: {
      value: { height: quantity(1.1e-3, "m"), basis: "manufacturer_package_maximum_in_surface_mount_orientation" },
      state: "reviewed",
      evidence: structuredClone(refs),
      validFor: [],
      explanation: "Synthetic reviewed maximum mounted height.",
    },
  };
}

function profile(): DesignProfileV33 {
  const v1 = createSyntheticReviewedProfile("power.integrated-synchronous-buck-regulator");
  const refs = evidence();
  const facts = Object.fromEntries(Object.entries(V33_PART_CLASS_SPECS["power.integrated-synchronous-buck-regulator"].facts)
    .map(([factId, spec]) => [factId, reviewedFact(factId, spec, refs)])) as Record<string, ProfileFact<unknown>>;

  facts.outputCurrentRole!.value = "continuous_capability_statement";
  facts.switchingFrequencyRole!.value = "production_spread";
  facts.feedbackReferenceRole!.value = "production_spread";
  facts.currentLimitRole!.value = "protection_threshold";
  facts.minimumOnTimeRole!.value = "typical_observation";
  facts.minimumOffTime = unknown("The synthetic source does not publish a minimum off-time bound.");
  facts.minimumOffTimeRole = unknown("No minimum off-time quantity means there is no associated evidence role.");
  facts.highSideOnResistanceRole!.value = "typical_observation";
  facts.lowSideOnResistanceRole!.value = "typical_observation";
  facts.nonSwitchingSupplyCurrentRole!.value = "typical_observation";
  facts.junctionToAmbientThermalResistanceRole!.value = "test_characteristic";
  facts.bootstrapCapacitanceRequirement!.value = "recommended_value";

  return {
    ...structuredClone(v1),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V33,
    commonFacts: {
      packageName: structuredClone(v1.commonFacts.packageName),
      boardArea: unknown("Board area is represented by facts.mountedGeometry.") as typeof v1.commonFacts.boardArea,
      maximumHeight: unknown("Maximum height is represented by facts.mountedGeometry.") as typeof v1.commonFacts.maximumHeight,
    },
    facts: { ...facts, mountedGeometry: mountedGeometry(refs) },
  } as DesignProfileV33;
}

function schemaFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? schemaFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

function schemaValidator(): (input: unknown) => boolean {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const path of schemaFiles(fileURLToPath(schemaRoot))) ajv.addSchema(JSON.parse(readFileSync(path, "utf8")));
  const validate = ajv.getSchema(profileSchemaId);
  if (!validate) throw new Error(`Missing AJV schema ${profileSchemaId}`);
  return (input: unknown) => Boolean(validate(input));
}

describe("Power integrated synchronous buck facts 3.3.0 contract", () => {
  it("preserves every earlier profile-root and integrated-buck schema byte lock", () => {
    const expected = {
      "profile-envelope.v1.schema.json": "ce18238edde40da40091c741b7a3ec2caab95c8931fa4f6906c7689f3db55421",
      "profile.v1.schema.json": "9647814a956b565339c5cb20c0b97dc220f7b8cb5e08430940bf1e9edaa552f5",
      "profile-envelope.facts-v2.schema.json": "d5d577bc81da5fe9904a7454845889a6dbc6902dcb2df0d51f8f8d26e058eaa4",
      "profile.facts-v2.schema.json": "374f075a13dc5ad4f3fef0a8191706779fb11d6b01c06a4c720151612c3d604e",
      "profile-envelope.facts-v3.schema.json": "357ca04198194c1bc8435a9f1e51ed404486df2a7d2a88e7aff9f451cc39b830",
      "profile.facts-v3.schema.json": "e98cc6577456d8bbf815446e4a9b5c8be2a530c37962e7c9eecdfb78fff9e9e3",
      "profile-envelope.facts-v3-1.schema.json": "e21c86e4d00d4ce7f8ec5b4a69e1e8216287187c8f72150ec9639ef2851612b9",
      "profile.facts-v3-1.schema.json": "549483c8822c624cafc32720c899a4f6b1d700b7a41843731582140b668a146e",
      "profile-envelope.facts-v3-2.schema.json": "1fc7864a7c4e9a12d1266c481ffd9b061ed8b60fc3e3feddbac6d31f6d3916ed",
      "profile.facts-v3-2.schema.json": "7e74aa1940fa76860860f8a7703545fc19ec45a6ce901d9cfc61d3bbaa36b7bf",
      "facts/power.integrated-synchronous-buck-regulator.v1.schema.json": "334ae0360176a28cb989c88defdde80dd33fc0d9ca50b7a56223caedf74e76d1",
      "facts/power.integrated-synchronous-buck-regulator.v2.schema.json": "d36edd5fd4fc6df931d5c7a069ac56f5ccc94800b964889153e3a2fcca07e279",
      "facts/motor.integrated-h-bridge.v3-2.schema.json": "9f0a6f3b6a92d177257b8c3e3afc4826b90259aec8503aaacb20f7e4ed8cc592",
    } as const;
    for (const [relative, hash] of Object.entries(expected)) {
      const bytes = readFileSync(new URL(`../schema/${relative}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex"), relative).toBe(hash);
    }
  });

  it("validates, admits, parses, freezes, and hashes the isolated exact class/version", () => {
    const input = profile();
    expect(validateDesignProfileV33(input, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(validateProfileAdmissionRulesV33(input)).toEqual([]);
    expect(schemaValidator()(input)).toBe(true);
    const parsed = parseDesignProfileV33(input, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(parsed.partClass).toBe("power.integrated-synchronous-buck-regulator");
    expect(parsed.factsSchemaVersion).toBe("3.3.0");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(designProfileContentHashV33(parsed)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("retains a continuous-capability statement without promoting it to a guaranteed limit", () => {
    const input = profile();
    expect(input.facts.outputCurrent.value?.value).toBe(3);
    expect(input.facts.outputCurrentRole.value).toBe("continuous_capability_statement");
    expect(validateDesignProfileV33(input, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(validateProfileAdmissionRulesV33(input)).toEqual([]);

    const mismatched = structuredClone(input);
    mismatched.facts.outputCurrentRole.evidence = evidence("Synthetic integrated buck facts 3.3.0 fixture, table 2");
    expect(validateDesignProfileV33(mismatched, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({
      path: "facts.outputCurrentRole.evidence",
      code: "paired_evidence_mismatch",
    }));
  });

  it("couples exact unknown pairs and complete production-spread groups in runtime and JSON Schema", () => {
    const validate = schemaValidator();
    const missingUnknownRole = profile();
    missingUnknownRole.facts.minimumOffTimeRole = structuredClone(missingUnknownRole.facts.minimumOnTimeRole);
    expect(validateDesignProfileV33(missingUnknownRole, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({
      path: "facts.minimumOffTimeRole",
      code: "paired_unknown_mismatch",
    }));
    expect(validate(missingUnknownRole)).toBe(false);

    const incompleteSpread = profile();
    incompleteSpread.facts.switchingFrequencyMaximum = unknown("A production spread cannot omit its maximum endpoint.");
    expect(validateDesignProfileV33(incompleteSpread, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({
      path: "facts.switchingFrequencyMaximum.state",
      code: "incomplete_evidence_role_group",
    }));
    expect(validate(incompleteSpread)).toBe(false);
  });

  it("enforces operating ordering and bootstrap requirement semantics", () => {
    const inverted = profile();
    inverted.facts.inputVoltageOperatingMinimum.value!.value = 28;
    expect(validateDesignProfileV33(inverted, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({
      code: "inconsistent_fact_order",
    }));

    const invented = profile();
    invented.facts.bootstrapCapacitanceRequirement.value = "application_dependent";
    expect(validateDesignProfileV33(invented, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({
      path: "facts.bootstrapCapacitance",
      code: "paired_unknown_mismatch",
    }));
    expect(schemaValidator()(invented)).toBe(false);
  });

  it("rejects unsupported class/version tuples in runtime and JSON Schema", () => {
    const validate = schemaValidator();
    const input = profile();
    const wrongVersion = { ...input, factsSchemaVersion: "3.2.0" };
    expect(validateDesignProfileV33(wrongVersion, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "invalid_facts_version" }));
    expect(validate(wrongVersion)).toBe(false);
    const wrongClass = { ...input, partClass: "power.external-fet-synchronous-buck-controller" };
    expect(validateDesignProfileV33(wrongClass, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "invalid_part_class" }));
    expect(validate(wrongClass)).toBe(false);
  });
});
