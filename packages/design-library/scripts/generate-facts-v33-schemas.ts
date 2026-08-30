import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { V33_PART_CLASS_SPECS } from "../src/v33-specs";

type Schema = Record<string, unknown>;
interface NumericDomain {
  readonly minimum?: number;
  readonly exclusiveMinimum?: number;
  readonly maximum?: number;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://schemas.schemagic.design/design-library/v1/";
const v1EnvelopeRef = `${base}profile-envelope.v1.schema.json`;
const factsV33EnvelopeId = `${base}profile-envelope.facts-v3-3.schema.json`;
const partClass = "power.integrated-synchronous-buck-regulator" as const;
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
  const ranges = V33_PART_CLASS_SPECS[partClass].operatingRanges;
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

function factSchema(spec: typeof V33_PART_CLASS_SPECS[typeof partClass]["facts"][keyof typeof V33_PART_CLASS_SPECS[typeof partClass]["facts"]]): Schema {
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

function roleGroupCoupling(quantityIds: readonly string[], roleId: string, requiredByRole: Readonly<Record<string, readonly string[]>>): Schema[] {
  return [
    {
      if: { allOf: quantityIds.map((quantityId) => factStateIs(quantityId, "unknown")) },
      then: { properties: { [roleId]: exactUnknownFact() } },
    },
    ...quantityIds.map((quantityId): Schema => ({
      if: factStateIs(quantityId, "reviewed"),
      then: { properties: { [roleId]: reviewedFact() } },
      $comment: "Runtime validation additionally requires identical canonical validFor arrays and evidence sets.",
    })),
    ...Object.entries(requiredByRole).map(([role, requiredIds]): Schema => ({
      if: factValueIs(roleId, [role]),
      then: {
        properties: Object.fromEntries(requiredIds.map((quantityId) => [quantityId, reviewedFact()])),
      },
    })),
  ];
}

function capacitanceCoupling(): Schema[] {
  return [
    {
      if: factStateIs("bootstrapCapacitanceRequirement", "unknown"),
      then: { properties: { bootstrapCapacitance: exactUnknownFact() } },
    },
    {
      if: factValueIs("bootstrapCapacitanceRequirement", ["application_dependent", "not_specified"]),
      then: { properties: { bootstrapCapacitance: exactUnknownFact() } },
    },
    {
      if: factValueIs("bootstrapCapacitanceRequirement", ["required_nominal_value", "recommended_value", "typical_observation"]),
      then: { properties: { bootstrapCapacitance: reviewedFact() } },
      $comment: "Runtime validation additionally requires identical canonical validFor arrays and evidence sets.",
    },
  ];
}

const priorEnvelope = JSON.parse(readFileSync(resolve(root, "schema", "profile-envelope.facts-v3-2.schema.json"), "utf8")) as {
  $defs: { mountedGeometry: Schema };
};
const mountedGeometry = priorEnvelope.$defs.mountedGeometry;

write("profile-envelope.facts-v3-3.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: factsV33EnvelopeId,
  title: "scheMAGIC design profile envelope with facts schema 3.3.0",
  type: "object",
  additionalProperties: false,
  required: ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"],
  properties: {
    format: { const: "schemagic-design-profile" },
    schemaVersion: { const: "1.0.0" },
    partClass: { const: partClass },
    part: { $ref: `${v1EnvelopeRef}#/$defs/part` },
    factsSchemaVersion: { const: "3.3.0" },
    commonFacts: {
      type: "object",
      additionalProperties: false,
      required: ["packageName", "boardArea", "maximumHeight"],
      properties: {
        packageName: { $ref: `${v1EnvelopeRef}#/$defs/factText` },
        boardArea: exactUnknownFact(),
        maximumHeight: exactUnknownFact(),
      },
    },
    facts: { type: "object" },
  },
  $defs: { mountedGeometry },
});

const facts = V33_PART_CLASS_SPECS[partClass].facts;
const properties = Object.fromEntries(Object.entries(facts).map(([factId, spec]) => [factId, factSchema(spec)]));
properties.mountedGeometry = { $ref: `${factsV33EnvelopeId}#/$defs/mountedGeometry` };

write("facts/power.integrated-synchronous-buck-regulator.v3-3.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${base}facts/power.integrated-synchronous-buck-regulator.v3-3.schema.json`,
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
  allOf: [
    ...quantityRoleCoupling("outputCurrent", "outputCurrentRole"),
    ...quantityRoleCoupling("minimumOnTime", "minimumOnTimeRole"),
    ...quantityRoleCoupling("minimumOffTime", "minimumOffTimeRole"),
    ...quantityRoleCoupling("highSideOnResistance", "highSideOnResistanceRole"),
    ...quantityRoleCoupling("lowSideOnResistance", "lowSideOnResistanceRole"),
    ...quantityRoleCoupling("nonSwitchingSupplyCurrent", "nonSwitchingSupplyCurrentRole"),
    ...quantityRoleCoupling("junctionToAmbientThermalResistance", "junctionToAmbientThermalResistanceRole"),
    ...roleGroupCoupling(
      ["switchingFrequencyMinimum", "switchingFrequencyNominal", "switchingFrequencyMaximum"],
      "switchingFrequencyRole",
      {
        production_spread: ["switchingFrequencyMinimum", "switchingFrequencyNominal", "switchingFrequencyMaximum"],
        guaranteed_adjustment_range: ["switchingFrequencyMinimum", "switchingFrequencyMaximum"],
        recommended_setting: ["switchingFrequencyNominal"],
        typical_observation: ["switchingFrequencyNominal"],
      },
    ),
    ...roleGroupCoupling(
      ["feedbackReferenceMinimum", "feedbackReferenceTypical", "feedbackReferenceMaximum"],
      "feedbackReferenceRole",
      {
        production_spread: ["feedbackReferenceMinimum", "feedbackReferenceTypical", "feedbackReferenceMaximum"],
        typical_observation: ["feedbackReferenceTypical"],
      },
    ),
    ...roleGroupCoupling(
      ["currentLimitMinimum", "currentLimitTypical", "currentLimitMaximum"],
      "currentLimitRole",
      { typical_observation: ["currentLimitTypical"] },
    ),
    ...capacitanceCoupling(),
  ],
  $comment: "Cross-value ordering and canonical evidence/condition equality are enforced by runtime validation.",
  $defs: { operatingRange: operatingRangeSchema() },
});

write("profile.facts-v3-3.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${base}profile.facts-v3-3.schema.json`,
  title: "scheMAGIC closed design profile with facts schema 3.3.0",
  allOf: [
    { $ref: "profile-envelope.facts-v3-3.schema.json" },
    {
      type: "object",
      required: ["partClass", "facts"],
      properties: {
        partClass: { const: partClass },
        facts: { $ref: "facts/power.integrated-synchronous-buck-regulator.v3-3.schema.json" },
      },
    },
  ],
});
