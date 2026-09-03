import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  DESIGN_PROFILE_FACTS_CODECS_V35,
  FACTS_SCHEMA_VERSION_V35,
  FACTS_V35_MIGRATION_POLICY,
  V35_BOUND_TYPED_FACT_IDS,
  V35_PART_CLASS_IDS,
  V35_PART_CLASS_SPECS,
  V35_THERMAL_RESISTANCE_BOARD_VALUES,
  designProfileContentHashV35,
  getBundledDesignLibraryDocuments,
  getDesignProfileCodecForVersion,
  parseDesignProfileForV35,
  parseDesignProfileV35,
  validateDesignProfile,
  validateDesignProfileEnvelope,
  validateDesignProfileV34,
  validateDesignProfileV35,
  validateProfileAdmissionRulesV35,
  type DesignProfileV35,
  type V35PartClassId,
  type PartClassSpec,
} from "../src";
import { SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedProfileV35 } from "../src/fixtures";

const schemaRoot = new URL("../schema/", import.meta.url);
const v35ProfileSchemaId = "https://schemas.schemagic.design/design-library/v1/profile.facts-v3-5.schema.json";

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
  for (const path of schemaFiles(fileURLToPath(schemaRoot))) instance.addSchema(JSON.parse(readFileSync(path, "utf8")));
  ajvInstance = instance;
  return instance;
}

function facts(profile: DesignProfileV35): Record<string, any> {
  return profile.facts as unknown as Record<string, any>;
}

function classSpec(partClass: V35PartClassId): PartClassSpec {
  return V35_PART_CLASS_SPECS[partClass] as PartClassSpec;
}

describe("facts 3.5.0 bound-typed contract", () => {
  it("declares the additive bound-typed surface and its migration policy", () => {
    expect([...V35_PART_CLASS_IDS]).toEqual([
      "power.integrated-synchronous-buck-regulator",
      "power.power-inductor",
      "shared.mlcc-capacitor",
    ]);
    expect(FACTS_SCHEMA_VERSION_V35).toBe("3.5.0");
    expect(V35_BOUND_TYPED_FACT_IDS["power.power-inductor"]).toEqual(["inductanceMinimum", "coreLossMaximum"]);
    expect(V35_BOUND_TYPED_FACT_IDS["shared.mlcc-capacitor"]).toEqual(["effectiveCapacitanceMinimum", "esrMaximum"]);
    expect(V35_BOUND_TYPED_FACT_IDS["power.integrated-synchronous-buck-regulator"])
      .toEqual(["minimumOnTimeMaximum", "minimumOffTimeMaximum", "thermalResistanceJunctionAmbient"]);
    expect([...V35_THERMAL_RESISTANCE_BOARD_VALUES]).toEqual(["jedec_2s2p", "declared"]);
    expect(FACTS_V35_MIGRATION_POLICY).toEqual({
      contract: "additive_optional_fields_only",
      automaticMigration: "none",
      predecessorVersionsStillAccepted: ["2.0.0", "3.0.0", "3.1.0", "3.2.0", "3.3.0", "3.4.0"],
      unknownKeys: "rejected",
      boundAdmission: "explicit_published_guaranteed_limit_with_recorded_conditions_only",
    });
    for (const partClass of V35_PART_CLASS_IDS) {
      for (const factId of V35_BOUND_TYPED_FACT_IDS[partClass]) {
        // Bound-typed fields never become admission requirements: adopting 3.5.0
        // must not retroactively invalidate a predecessor profile's evidence.
        expect(classSpec(partClass).facts[factId]!.requiredForAdmission, `${partClass}.${factId}`).toBe(false);
      }
    }
  });

  it("accepts a reviewed bound-typed profile for every 3.5.0 class in runtime and AJV", () => {
    const validateSchema = ajv().getSchema(v35ProfileSchemaId)!;
    for (const partClass of V35_PART_CLASS_IDS) {
      const profile = createSyntheticReviewedProfileV35(partClass);
      expect(validateDesignProfileV35(profile, SYNTHETIC_MANUFACTURER_REGISTRY), partClass).toEqual([]);
      expect(validateDesignProfileEnvelope(profile, SYNTHETIC_MANUFACTURER_REGISTRY), partClass).toEqual([]);
      expect(validateProfileAdmissionRulesV35(profile), partClass).toEqual([]);
      expect(validateSchema(profile), `${partClass}: ${JSON.stringify(validateSchema.errors)}`).toBe(true);
      expect(designProfileContentHashV35(profile)).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(parseDesignProfileV35(profile, SYNTHETIC_MANUFACTURER_REGISTRY).factsSchemaVersion).toBe(FACTS_SCHEMA_VERSION_V35);
    }
  });

  it("keeps the closed contract: unknown keys, wrong versions, and foreign classes are rejected", () => {
    const validateSchema = ajv().getSchema(v35ProfileSchemaId)!;
    const base = createSyntheticReviewedProfileV35("power.power-inductor");

    const unknownFact = structuredClone(base) as any;
    unknownFact.facts.inductanceCeiling = structuredClone(unknownFact.facts.inductanceMinimum);
    const unknownRoot = { ...structuredClone(base), extraKey: 1 } as any;
    const wrongVersion = { ...structuredClone(base), factsSchemaVersion: "3.4.0" } as any;
    const foreignClass = { ...structuredClone(base), partClass: "shared.bulk-capacitor" } as any;

    for (const [label, changed] of [
      ["unknown fact key", unknownFact],
      ["unknown root key", unknownRoot],
      ["wrong facts version", wrongVersion],
      ["class outside 3.5.0", foreignClass],
    ] as const) {
      expect(validateDesignProfileV35(changed, SYNTHETIC_MANUFACTURER_REGISTRY).length, label).toBeGreaterThan(0);
      expect(validateSchema(changed), label).toBe(false);
    }

    // The 3.4.0 validator keeps rejecting 3.5.0 bytes, so there is no silent upgrade.
    expect(validateDesignProfileV34(base as any, SYNTHETIC_MANUFACTURER_REGISTRY).length).toBeGreaterThan(0);
  });

  it("requires the declared conditions on every reviewed bound-typed fact", () => {
    const validateSchema = ajv().getSchema(v35ProfileSchemaId)!;
    for (const partClass of V35_PART_CLASS_IDS) {
      for (const factId of V35_BOUND_TYPED_FACT_IDS[partClass]) {
        const required = classSpec(partClass).facts[factId]!.requiredRangeParameters ?? [];
        if (required.length === 0) continue;
        const stripped = createSyntheticReviewedProfileV35(partClass);
        facts(stripped)[factId].validFor = [];
        expect(validateDesignProfileV35(stripped, SYNTHETIC_MANUFACTURER_REGISTRY).length, `${partClass}.${factId}`).toBeGreaterThan(0);
        expect(validateSchema(stripped), `${partClass}.${factId}`).toBe(false);
      }
    }
  });

  it("keeps a bound-typed fact either reviewed or unknown, never estimated", () => {
    for (const partClass of V35_PART_CLASS_IDS) {
      for (const factId of V35_BOUND_TYPED_FACT_IDS[partClass]) {
        const estimated = createSyntheticReviewedProfileV35(partClass);
        facts(estimated)[factId].state = "estimated";
        const codes = validateDesignProfileV35(estimated, SYNTHETIC_MANUFACTURER_REGISTRY).map((entry) => entry.code);
        expect(codes, `${partClass}.${factId}`).toContain("bound_requires_reviewed_state");
      }
    }
  });

  it("omits every bound-typed fact without breaking the profile", () => {
    const validateSchema = ajv().getSchema(v35ProfileSchemaId)!;
    for (const partClass of V35_PART_CLASS_IDS) {
      const withoutBounds = createSyntheticReviewedProfileV35(partClass);
      for (const factId of V35_BOUND_TYPED_FACT_IDS[partClass]) {
        facts(withoutBounds)[factId] = {
          value: null,
          state: "unknown",
          evidence: [],
          validFor: [],
          explanation: "No published guaranteed limit is available for this exact part.",
        };
      }
      if (partClass === "power.integrated-synchronous-buck-regulator") {
        facts(withoutBounds).thermalResistanceJunctionAmbientBoard = {
          value: null,
          state: "unknown",
          evidence: [],
          validFor: [],
          explanation: "No board qualifier applies without a reviewed thermal resistance.",
        };
      }
      expect(validateDesignProfileV35(withoutBounds, SYNTHETIC_MANUFACTURER_REGISTRY), partClass).toEqual([]);
      expect(validateProfileAdmissionRulesV35(withoutBounds), partClass).toEqual([]);
      expect(validateSchema(withoutBounds), `${partClass}: ${JSON.stringify(validateSchema.errors)}`).toBe(true);
    }
  });

  it("binds the junction-to-ambient thermal resistance to a reviewed board qualifier", () => {
    const validateSchema = ajv().getSchema(v35ProfileSchemaId)!;
    const missingQualifier = createSyntheticReviewedProfileV35("power.integrated-synchronous-buck-regulator");
    facts(missingQualifier).thermalResistanceJunctionAmbientBoard = {
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
      explanation: "Board not declared.",
    };
    expect(validateDesignProfileV35(missingQualifier, SYNTHETIC_MANUFACTURER_REGISTRY).map((entry) => entry.code))
      .toContain("missing_board_qualifier");
    expect(validateSchema(missingQualifier)).toBe(false);

    const orphanQualifier = createSyntheticReviewedProfileV35("power.integrated-synchronous-buck-regulator");
    facts(orphanQualifier).thermalResistanceJunctionAmbient = {
      value: null,
      state: "unknown",
      evidence: [],
      validFor: [],
      explanation: "No thermal resistance published.",
    };
    expect(validateDesignProfileV35(orphanQualifier, SYNTHETIC_MANUFACTURER_REGISTRY).map((entry) => entry.code))
      .toContain("orphan_board_qualifier");
  });

  it("refuses a bound that contradicts the observation it bounds", () => {
    const cases: Array<[V35PartClassId, string, number]> = [
      ["power.power-inductor", "inductanceMinimum", 1e6],
      ["power.power-inductor", "coreLossMaximum", 1e-9],
      ["shared.mlcc-capacitor", "effectiveCapacitanceMinimum", 1e6],
      ["shared.mlcc-capacitor", "esrMaximum", 1e-9],
      ["power.integrated-synchronous-buck-regulator", "minimumOnTimeMaximum", 1e-12],
      ["power.integrated-synchronous-buck-regulator", "minimumOffTimeMaximum", 1e-12],
    ];
    for (const [partClass, factId, value] of cases) {
      const contradicting = createSyntheticReviewedProfileV35(partClass);
      facts(contradicting)[factId].value = { ...facts(contradicting)[factId].value, value };
      expect(validateDesignProfileV35(contradicting, SYNTHETIC_MANUFACTURER_REGISTRY).map((entry) => entry.code), `${partClass}.${factId}`)
        .toContain("bound_contradicts_observation");
    }
  });

  it("dispatches the closed 3.5.0 codec registry without widening other versions", () => {
    for (const partClass of V35_PART_CLASS_IDS) {
      const codec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V35);
      expect(codec).toBe(DESIGN_PROFILE_FACTS_CODECS_V35[partClass]);
      const profile = createSyntheticReviewedProfileV35(partClass);
      expect(codec.validateFacts(profile.facts, SYNTHETIC_MANUFACTURER_REGISTRY.manufacturers[0])).toEqual([]);
      expect(parseDesignProfileForV35(codec, profile, SYNTHETIC_MANUFACTURER_REGISTRY).partClass).toBe(partClass);
    }
    expect(Object.keys(DESIGN_PROFILE_FACTS_CODECS_V35).sort()).toEqual([...V35_PART_CLASS_IDS].sort());
  });

  it("leaves all 24 bundled reviewed profiles on their own predecessor contracts", () => {
    const documents = getBundledDesignLibraryDocuments();
    const release = documents.catalogRelease as { profiles: { profileId: string }[] };
    const profiles = release.profiles.map((entry) => (documents.profiles as Record<string, unknown>)[entry.profileId]) as any[];
    expect(profiles).toHaveLength(24);
    for (const profile of profiles) {
      expect(profile.factsSchemaVersion, profile.part.manufacturerPartNumber).not.toBe(FACTS_SCHEMA_VERSION_V35);
      expect(
        validateDesignProfileEnvelope(profile, undefined).filter((entry) => entry.code !== "unknown_manufacturer"),
        profile.part.manufacturerPartNumber,
      ).toEqual([]);
    }
    // The pre-3.5 root profile schema still rejects a 3.5.0 profile outright.
    expect(validateDesignProfile(createSyntheticReviewedProfileV35("shared.mlcc-capacitor") as any).length).toBeGreaterThan(0);
  });
});
