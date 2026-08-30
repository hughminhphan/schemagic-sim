import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { V32_PART_CLASS_SPECS } from "../src/v32-specs";

type Schema = Record<string, unknown>;
interface NumericDomain {
  readonly minimum?: number;
  readonly exclusiveMinimum?: number;
  readonly maximum?: number;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://schemas.schemagic.design/design-library/v1/";
const v1EnvelopeRef = `${base}profile-envelope.v1.schema.json`;
const factsV32EnvelopeId = `${base}profile-envelope.facts-v3-2.schema.json`;
const partClass = "motor.integrated-h-bridge" as const;
const nonBlank = ".*\\S.*";

function write(relative: string, schema: Schema): void {
  const path = resolve(root, "schema", relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
}

function quantity(unit: string, domain: NumericDomain = {}): Schema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "unit", "displayUnit"],
    properties: {
      value: { type: "number", ...domain },
      unit: { const: unit },
      displayUnit: { type: "string", minLength: 1, pattern: nonBlank },
    },
  };
}

function unknownLegacyGeometry(): Schema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "state", "evidence", "validFor", "explanation"],
    properties: {
      value: { type: "null" },
      state: { const: "unknown" },
      evidence: { type: "array", maxItems: 0 },
      validFor: { type: "array", maxItems: 0 },
      explanation: { type: "string", minLength: 1, pattern: nonBlank },
    },
  };
}

function exactUnknownFact(): Schema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "state", "evidence", "validFor", "explanation"],
    properties: {
      value: { type: "null" },
      state: { const: "unknown" },
      evidence: { type: "array", maxItems: 0 },
      validFor: { type: "array", maxItems: 0 },
      explanation: { type: "string", minLength: 1, pattern: nonBlank },
    },
  };
}

function factStateIs(field: string, state: string): Schema {
  return {
    required: [field],
    properties: {
      [field]: {
        type: "object",
        required: ["state"],
        properties: { state: { const: state } },
      },
    },
  };
}

function factValueIs(field: string, values: readonly string[]): Schema {
  return {
    required: [field],
    properties: {
      [field]: {
        type: "object",
        required: ["value"],
        properties: { value: { enum: values } },
      },
    },
  };
}

function reviewedFact(): Schema {
  return {
    type: "object",
    required: ["state"],
    properties: { state: { const: "reviewed" } },
  };
}

function operatingRangeSchema(): Schema {
  const ranges = V32_PART_CLASS_SPECS[partClass].operatingRanges;
  return {
    oneOf: Object.entries(ranges).map(([parameterId, range]) => ({
      allOf: [
        { $ref: `${v1EnvelopeRef}#/$defs/operatingRange` },
        {
          type: "object",
          properties: {
            parameterId: { const: parameterId },
            minimum: { anyOf: [quantity(range.unit, range.domain), { type: "null" }] },
            maximum: { anyOf: [quantity(range.unit, range.domain), { type: "null" }] },
          },
        },
      ],
    })),
  };
}

function factSchema(spec: typeof V32_PART_CLASS_SPECS[typeof partClass]["facts"][keyof typeof V32_PART_CLASS_SPECS[typeof partClass]["facts"]]): Schema {
  const value = spec.kind === "quantity"
    ? quantity(spec.unit, spec.domain)
    : spec.kind === "boolean"
      ? { type: "boolean" }
      : "values" in spec
        ? { enum: spec.values }
        : { type: "string", minLength: 1, pattern: nonBlank };
  return {
    allOf: [
      { $ref: `${v1EnvelopeRef}#/$defs/profileFact` },
      {
        type: "object",
        properties: {
          value: { anyOf: [value, { type: "null" }] },
          validFor: { type: "array", items: { $ref: "#/$defs/operatingRange" } },
        },
      },
    ],
  };
}

function quantityRoleCoupling(quantityId: string, roleId: string): Schema[] {
  return [
    {
      if: factStateIs(quantityId, "unknown"),
      then: { properties: { [roleId]: exactUnknownFact() } },
    },
    {
      if: factStateIs(quantityId, "reviewed"),
      then: { properties: { [roleId]: reviewedFact() } },
      $comment: "Runtime validation additionally requires identical canonical validFor arrays and evidence sets.",
    },
  ];
}

function capacitanceCoupling(quantityId: string, requirementId: string): Schema[] {
  return [
    {
      if: factStateIs(requirementId, "unknown"),
      then: { properties: { [quantityId]: exactUnknownFact() } },
    },
    {
      if: factValueIs(requirementId, ["application_dependent", "not_specified"]),
      then: { properties: { [quantityId]: exactUnknownFact() } },
    },
    {
      if: factValueIs(requirementId, ["required_minimum", "recommended_value", "typical_observation"]),
      then: { properties: { [quantityId]: reviewedFact() } },
      $comment: "Runtime validation additionally requires identical canonical validFor arrays and evidence sets.",
    },
  ];
}

const priorEnvelope = JSON.parse(readFileSync(resolve(root, "schema", "profile-envelope.facts-v3-1.schema.json"), "utf8")) as {
  $defs: { mountedGeometry: Schema };
};
const mountedGeometry = priorEnvelope.$defs.mountedGeometry;

write("profile-envelope.facts-v3-2.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: factsV32EnvelopeId,
  title: "scheMAGIC design profile envelope with facts schema 3.2.0",
  type: "object",
  additionalProperties: false,
  required: ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"],
  properties: {
    format: { const: "schemagic-design-profile" },
    schemaVersion: { const: "1.0.0" },
    partClass: { const: partClass },
    part: { $ref: `${v1EnvelopeRef}#/$defs/part` },
    factsSchemaVersion: { const: "3.2.0" },
    commonFacts: {
      type: "object",
      additionalProperties: false,
      required: ["packageName", "boardArea", "maximumHeight"],
      properties: {
        packageName: { $ref: `${v1EnvelopeRef}#/$defs/factText` },
        boardArea: unknownLegacyGeometry(),
        maximumHeight: unknownLegacyGeometry(),
      },
    },
    facts: { type: "object" },
  },
  $defs: { mountedGeometry },
});

const facts = V32_PART_CLASS_SPECS[partClass].facts;
const properties = Object.fromEntries(Object.entries(facts).map(([factId, spec]) => [factId, factSchema(spec)]));
properties.mountedGeometry = { $ref: `${factsV32EnvelopeId}#/$defs/mountedGeometry` };

write("facts/motor.integrated-h-bridge.v3-2.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${base}facts/motor.integrated-h-bridge.v3-2.schema.json`,
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
  allOf: [
    ...quantityRoleCoupling("continuousOutputCurrent", "continuousOutputCurrentRole"),
    ...quantityRoleCoupling("peakOutputCurrent", "peakOutputCurrentRole"),
    ...quantityRoleCoupling("pwmMaximum", "pwmMaximumRole"),
    ...quantityRoleCoupling("minimumInputPulseWidth", "minimumInputPulseWidthRole"),
    ...quantityRoleCoupling("pathResistance", "pathResistanceRole"),
    ...quantityRoleCoupling("switchingTransitionTime", "switchingTransitionTimeRole"),
    ...quantityRoleCoupling("activeSupplyCurrent", "activeSupplyCurrentRole"),
    ...capacitanceCoupling("localSupplyDecouplingCapacitance", "localSupplyDecouplingRequirement"),
    ...capacitanceCoupling("bulkCapacitance", "bulkCapacitanceRequirement"),
  ],
  $comment: "Supply ordering and cross-fact canonical evidence/condition equality are enforced by runtime validation.",
  $defs: { operatingRange: operatingRangeSchema() },
});

write("profile.facts-v3-2.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${base}profile.facts-v3-2.schema.json`,
  title: "scheMAGIC closed design profile with facts schema 3.2.0",
  allOf: [
    { $ref: "profile-envelope.facts-v3-2.schema.json" },
    {
      type: "object",
      required: ["partClass", "facts"],
      properties: {
        partClass: { const: partClass },
        facts: { $ref: "facts/motor.integrated-h-bridge.v3-2.schema.json" },
      },
    },
  ],
});
