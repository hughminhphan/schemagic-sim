import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  FACTS_SCHEMA_VERSION_V32,
  getDesignProfileCodecForVersion,
  parseDesignProfileForV32,
  type DesignProfileV32,
} from "../src";
import { contentHash } from "../src/canonical";
import { createSyntheticReviewedProfile, SYNTHETIC_MANUFACTURER_REGISTRY } from "../src/fixtures";
import type { FactSpec } from "../src/specs";
import type { OperatingRange, ProfileEvidenceRef, ProfileFact, ProfileQuantity, ProfileUnit } from "../src/types";
import type { MountedGeometryFactsV2 } from "../src/v2-types";
import { V32_PART_CLASS_SPECS } from "../src/v32-specs";
import {
  designProfileContentHashV32,
  parseDesignProfileV32,
  validateDesignProfileV32,
  validateProfileAdmissionRulesV32,
} from "../src/v32-validation";

const schemaRoot = new URL("../schema/", import.meta.url);
const profileSchemaId = "https://schemas.schemagic.design/design-library/v1/profile.facts-v3-2.schema.json";

function quantity<Unit extends ProfileUnit>(value: number, unit: Unit): ProfileQuantity<Unit> {
  return { value, unit, displayUnit: unit };
}

function unknown(explanation: string): ProfileFact<never> {
  return { value: null, state: "unknown", evidence: [], validFor: [], explanation };
}

function evidence(locator = "Synthetic integrated H-bridge facts 3.2.0 fixture, table 1"): ProfileEvidenceRef[] {
  const sourceId = "synthetic:integrated-h-bridge:3.2.0";
  return [{
    kind: "manufacturer_datasheet",
    sourceId,
    locator,
    licenseNote: "Synthetic fixture carrying no real component claim.",
    retrievedAt: "2026-08-24T00:00:00Z",
    contentHash: contentHash({ sourceId, locator }),
    url: "https://synthetic-components.example.invalid/integrated-h-bridge-v3-2.pdf",
    revision: "fixture-v3-2",
    publicationBasis: "public_facts",
  }];
}

function reviewedFact(factId: string, spec: FactSpec, refs: ProfileEvidenceRef[]): ProfileFact<unknown> {
  const value = spec.kind === "quantity"
    ? quantity(
        factId === "supplyVoltageOperatingMinimum" ? 2
          : factId === "supplyVoltageOperatingMaximum" ? 20
            : factId === "supplyVoltageAbsoluteMaximum" ? 40
              : 1,
        spec.unit,
      )
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
        area: quantity(4e-6, "m2"),
        basis: "manufacturer_recommended_land_pattern_bounding_box",
        calculation: "maximum_x_span_times_maximum_y_span",
        sourceDimensions: [
          { axis: "x", dimensionId: "land-length", multiplier: 1, maximum: quantity(2e-3, "m"), evidence: structuredClone(refs) },
          { axis: "y", dimensionId: "land-width", multiplier: 1, maximum: quantity(2e-3, "m"), evidence: structuredClone(refs) },
        ],
      },
      state: "calculated",
      evidence: structuredClone(refs),
      validFor: [],
      explanation: "Canonical synthetic land-pattern bounding rectangle.",
    },
    maximumHeight: {
      value: { height: quantity(1e-3, "m"), basis: "manufacturer_package_maximum_in_surface_mount_orientation" },
      state: "reviewed",
      evidence: structuredClone(refs),
      validFor: [],
      explanation: "Synthetic reviewed maximum mounted height.",
    },
  };
}

function profile(): DesignProfileV32 {
  const v1 = createSyntheticReviewedProfile("motor.integrated-h-bridge");
  const refs = evidence();
  const facts = Object.fromEntries(Object.entries(V32_PART_CLASS_SPECS["motor.integrated-h-bridge"].facts)
    .map(([factId, spec]) => [factId, reviewedFact(factId, spec, refs)])) as Record<string, ProfileFact<unknown>>;

  facts.continuousHighSideOnSupported = unknown("The synthetic source does not establish continuous high-side operation.");
  facts.continuousOutputCurrent = unknown("The synthetic source does not establish a continuous output-current bound.");
  facts.continuousOutputCurrentRole = unknown("No continuous-current quantity means there is no associated evidence role.");
  facts.pwmMaximum = unknown("The synthetic source does not publish an independent PWM ceiling.");
  facts.pwmMaximumRole = unknown("No PWM ceiling means there is no associated evidence role.");
  facts.junctionToAmbientThermalResistance = unknown("The synthetic source does not publish a board-independent junction-to-ambient value.");
  facts.bulkCapacitance = unknown("Bulk capacitance is application dependent in the synthetic source.");
  facts.bulkCapacitanceRequirement!.value = "application_dependent";

  return {
    ...structuredClone(v1),
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V32,
    commonFacts: {
      packageName: structuredClone(v1.commonFacts.packageName),
      boardArea: unknown("Board area is represented by facts.mountedGeometry.") as typeof v1.commonFacts.boardArea,
      maximumHeight: unknown("Maximum height is represented by facts.mountedGeometry.") as typeof v1.commonFacts.maximumHeight,
    },
    facts: { ...facts, mountedGeometry: mountedGeometry(refs) },
  } as DesignProfileV32;
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

function ambientRange(refs: ProfileEvidenceRef[], maximum = 350): OperatingRange<"K"> {
  return {
    parameterId: "ambientTemperature",
    minimum: quantity(250, "K"),
    maximum: quantity(maximum, "K"),
    evidence: structuredClone(refs),
  };
}

describe("Motor integrated H-bridge facts 3.2.0 contract", () => {
  it("preserves every published V1, V2, 3.0.0, and 3.1.0 schema lock", () => {
    const expected = {
      "profile-envelope.v1.schema.json": "ce18238edde40da40091c741b7a3ec2caab95c8931fa4f6906c7689f3db55421",
      "profile.v1.schema.json": "9647814a956b565339c5cb20c0b97dc220f7b8cb5e08430940bf1e9edaa552f5",
      "profile-envelope.facts-v2.schema.json": "d5d577bc81da5fe9904a7454845889a6dbc6902dcb2df0d51f8f8d26e058eaa4",
      "profile.facts-v2.schema.json": "374f075a13dc5ad4f3fef0a8191706779fb11d6b01c06a4c720151612c3d604e",
      "profile-envelope.facts-v3.schema.json": "357ca04198194c1bc8435a9f1e51ed404486df2a7d2a88e7aff9f451cc39b830",
      "profile.facts-v3.schema.json": "e98cc6577456d8bbf815446e4a9b5c8be2a530c37962e7c9eecdfb78fff9e9e3",
      "facts/shared.n-channel-power-mosfet.v3.schema.json": "7eb61930d6fa96be5533d8acdc0afd4e5c745ff44d2cae5416f1c34c028e078c",
      "facts/motor.supply-tvs-diode.v3.schema.json": "1c03f24682b2c599e63f030f90134f2b60491270c00e2cfe9296c534e800331d",
      "profile-envelope.facts-v3-1.schema.json": "e21c86e4d00d4ce7f8ec5b4a69e1e8216287187c8f72150ec9639ef2851612b9",
      "profile.facts-v3-1.schema.json": "549483c8822c624cafc32720c899a4f6b1d700b7a41843731582140b668a146e",
      "facts/motor.full-bridge-gate-driver.v3-1.schema.json": "7c7cb38e2892ed031427b08ed186668cffd330321345aa182c686037f7a75712",
    } as const;
    for (const [relative, hash] of Object.entries(expected)) {
      const bytes = readFileSync(new URL(`../schema/${relative}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex"), relative).toBe(hash);
    }
  });

  it("parses, admits, and resolves only the exact selected class/version codec", () => {
    const input = profile();
    expect(validateDesignProfileV32(input, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(validateProfileAdmissionRulesV32(input)).toEqual([]);
    expect(schemaValidator()(input)).toBe(true);
    const parsed = parseDesignProfileV32(input, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.factsSchemaVersion).toBe("3.2.0");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(designProfileContentHashV32(parsed)).toMatch(/^sha256:[0-9a-f]{64}$/);

    const codec = getDesignProfileCodecForVersion("motor.integrated-h-bridge", FACTS_SCHEMA_VERSION_V32);
    expect(codec.factsSchemaVersion).toBe("3.2.0");
    expect(parseDesignProfileForV32(codec, input, SYNTHETIC_MANUFACTURER_REGISTRY).partClass).toBe("motor.integrated-h-bridge");
    const forgedVersionCodec = { ...codec, factsSchemaVersion: "3.1.0" } as unknown as typeof codec;
    expect(() => parseDesignProfileForV32(forgedVersionCodec, input, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow(
      /factsSchemaVersion \[codec_mismatch\]: Expected 3\.2\.0/,
    );
    expect(() => getDesignProfileCodecForVersion("motor.full-bridge-gate-driver", FACTS_SCHEMA_VERSION_V32 as never)).toThrow(/unknown_codec_version/);
  });

  it("couples unknown and reviewed quantity roles in runtime and JSON Schema", () => {
    const validate = schemaValidator();
    const mismatched = profile();
    mismatched.facts.pwmMaximumRole = structuredClone(mismatched.facts.minimumInputPulseWidthRole);
    expect(validateDesignProfileV32(mismatched, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({
      path: "facts.pwmMaximumRole",
      code: "paired_unknown_mismatch",
    }));
    expect(validate(mismatched)).toBe(false);

    const missingRole = profile();
    missingRole.facts.minimumInputPulseWidthRole = unknown("A reviewed timing quantity cannot omit its evidence role.");
    expect(validateDesignProfileV32(missingRole, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "evidence_role_mismatch" }));
    expect(validate(missingRole)).toBe(false);
  });

  it("requires canonical condition arrays and evidence sets on reviewed pairs", () => {
    const matching = profile();
    const refs = evidence();
    matching.facts.minimumInputPulseWidth.validFor = [ambientRange(refs)];
    matching.facts.minimumInputPulseWidthRole.validFor = [ambientRange(refs)];
    expect(validateDesignProfileV32(matching, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(schemaValidator()(matching)).toBe(true);

    const conditions = structuredClone(matching);
    conditions.facts.minimumInputPulseWidthRole.validFor = [ambientRange(refs, 340)];
    expect(validateDesignProfileV32(conditions, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "paired_condition_mismatch" }));
    expect(schemaValidator()(conditions)).toBe(true);

    const sources = structuredClone(matching);
    sources.facts.minimumInputPulseWidthRole.evidence = evidence("Synthetic integrated H-bridge facts 3.2.0 fixture, table 2");
    expect(validateDesignProfileV32(sources, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "paired_evidence_mismatch" }));
    expect(schemaValidator()(sources)).toBe(true);
  });

  it("enforces explicit capacitance branches without inventing application-dependent values", () => {
    const validate = schemaValidator();
    const invented = profile();
    invented.facts.bulkCapacitance = structuredClone(invented.facts.localSupplyDecouplingCapacitance);
    expect(validateDesignProfileV32(invented, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "paired_unknown_mismatch" }));
    expect(validate(invented)).toBe(false);

    const omitted = profile();
    omitted.facts.localSupplyDecouplingCapacitance = unknown("A required minimum cannot omit the reviewed quantity.");
    expect(validateDesignProfileV32(omitted, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "capacitance_requirement_mismatch" }));
    expect(validate(omitted)).toBe(false);
  });

  it("enforces strict supply ordering and one reviewed output-current capability", () => {
    const inverted = profile();
    inverted.facts.supplyVoltageOperatingMinimum.value!.value = inverted.facts.supplyVoltageOperatingMaximum.value!.value;
    expect(validateDesignProfileV32(inverted, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "inconsistent_fact_order" }));

    const noCurrent = profile();
    noCurrent.facts.peakOutputCurrent = unknown("No peak-current capability is published.");
    noCurrent.facts.peakOutputCurrentRole = unknown("No peak-current quantity means there is no associated evidence role.");
    expect(validateProfileAdmissionRulesV32(noCurrent)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "facts.continuousOutputCurrent.state", code: "missing_capability_group" }),
      expect.objectContaining({ path: "facts.peakOutputCurrent.state", code: "missing_capability_group" }),
    ]));
  });

  it("rejects unsupported class/version tuples in runtime and JSON Schema", () => {
    const validate = schemaValidator();
    const input = profile();
    const wrongVersion = { ...input, factsSchemaVersion: "3.1.0" };
    expect(validateDesignProfileV32(wrongVersion, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "invalid_facts_version" }));
    expect(validate(wrongVersion)).toBe(false);
    const wrongClass = { ...input, partClass: "motor.full-bridge-gate-driver" };
    expect(validateDesignProfileV32(wrongClass, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "invalid_part_class" }));
    expect(validate(wrongClass)).toBe(false);
  });
});
