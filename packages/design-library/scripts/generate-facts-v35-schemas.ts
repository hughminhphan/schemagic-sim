import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FactSpec, NumericDomain, PartClassSpec } from "../src/specs";
import {
  POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V35,
  V35_PART_CLASS_IDS,
  V35_PART_CLASS_SPECS,
  type V35PartClassId,
} from "../src/v35-specs";

type Schema = Record<string, unknown>;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://schemas.schemagic.design/design-library/v1/";
const v1EnvelopeRef = `${base}profile-envelope.v1.schema.json`;
const factsV35EnvelopeId = `${base}profile-envelope.facts-v3-5.schema.json`;
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

function factStateIs(state: string): Schema {
  return {
    type: "object",
    required: ["state"],
    properties: { state: { const: state } },
  };
}

function conditionOccurrences(parameterId: string, minimum: number, maximum: number): Schema {
  return {
    type: "object",
    properties: {
      validFor: {
        type: "array",
        contains: {
          type: "object",
          required: ["parameterId"],
          properties: { parameterId: { const: parameterId } },
        },
        minContains: minimum,
        maxContains: maximum,
      },
    },
  };
}

function conditionPresent(parameterId: string): Schema {
  return {
    type: "object",
    properties: {
      validFor: {
        type: "array",
        contains: {
          type: "object",
          required: ["parameterId"],
          properties: { parameterId: { const: parameterId } },
        },
      },
    },
  };
}

function operatingRangeSchema(spec: PartClassSpec): Schema {
  return {
    oneOf: Object.entries(spec.operatingRanges).map(([parameterId, range]) => ({
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

function factSchema(spec: FactSpec): Schema {
  const value = spec.kind === "quantity"
    ? quantity(spec.unit, spec.domain)
    : spec.kind === "boolean"
      ? { type: "boolean" }
      : spec.values === undefined
        ? { type: "string", minLength: 1, pattern: nonBlank }
        : { enum: spec.values };
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
      ...(spec.requiredRangeParameters ?? []).map((parameterId) => ({
        if: factStateIs("reviewed"),
        then: conditionPresent(parameterId),
      })),
    ],
  };
}

/** The 3.4.0 inclusive excitation policy, carried forward unchanged. */
function inductanceConditionPolicy(): Schema {
  const policy = POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V35;
  return {
    if: factStateIs("reviewed"),
    then: {
      allOf: [
        ...policy.requiredExactlyOnce.map((parameterId) => conditionOccurrences(parameterId, 1, 1)),
        ...policy.uniqueWhenPresent.map((parameterId) => conditionOccurrences(parameterId, 0, 1)),
        {
          anyOf: policy.requiredAtLeastOneOf.map((parameterId) => conditionOccurrences(parameterId, 1, 1)),
        },
      ],
    },
  };
}

/** A reviewed junction-to-ambient thermal resistance requires its reviewed board qualifier. */
function thermalBoardQualifierPolicy(): Schema {
  return {
    if: {
      type: "object",
      required: ["thermalResistanceJunctionAmbient"],
      properties: { thermalResistanceJunctionAmbient: factStateIs("reviewed") },
    },
    then: {
      type: "object",
      required: ["thermalResistanceJunctionAmbientBoard"],
      properties: { thermalResistanceJunctionAmbientBoard: factStateIs("reviewed") },
    },
  };
}

const priorEnvelope = JSON.parse(readFileSync(resolve(root, "schema", "profile-envelope.facts-v3-4.schema.json"), "utf8")) as {
  $defs: { mountedGeometry: Schema };
};
const mountedGeometry = priorEnvelope.$defs.mountedGeometry;

write("profile-envelope.facts-v3-5.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: factsV35EnvelopeId,
  title: "scheMAGIC design profile envelope with facts schema 3.5.0",
  type: "object",
  additionalProperties: false,
  required: ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"],
  properties: {
    format: { const: "schemagic-design-profile" },
    schemaVersion: { const: "1.0.0" },
    partClass: { enum: [...V35_PART_CLASS_IDS] },
    part: { $ref: `${v1EnvelopeRef}#/$defs/part` },
    factsSchemaVersion: { const: "3.5.0" },
    commonFacts: {
      type: "object",
      additionalProperties: false,
      required: ["packageName", "boardArea", "maximumHeight"],
      properties: {
        packageName: {
          allOf: [
            { $ref: `${v1EnvelopeRef}#/$defs/factText` },
            { type: "object", properties: { validFor: { type: "array", maxItems: 0 } } },
          ],
        },
        boardArea: exactUnknownFact(),
        maximumHeight: exactUnknownFact(),
      },
    },
    facts: { type: "object" },
  },
  $defs: { mountedGeometry },
});

function factsSchemaFileName(partClass: V35PartClassId): string {
  return `facts/${partClass}.v3-5.schema.json`;
}

for (const partClass of V35_PART_CLASS_IDS) {
  const spec = V35_PART_CLASS_SPECS[partClass];
  const properties = Object.fromEntries(Object.entries(spec.facts).map(([factId, fact]) => [factId, factSchema(fact)]));
  properties.mountedGeometry = { $ref: `${factsV35EnvelopeId}#/$defs/mountedGeometry` };
  if (partClass === "power.power-inductor") {
    const inductance = properties[POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V35.factId];
    if (!inductance || !Array.isArray(inductance.allOf)) throw new Error("Generated inductance schema is missing its allOf contract");
    inductance.allOf.push(inductanceConditionPolicy());
  }
  write(factsSchemaFileName(partClass), {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${base}${factsSchemaFileName(partClass)}`,
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
    ...(partClass === "power.integrated-synchronous-buck-regulator" ? { allOf: [thermalBoardQualifierPolicy()] } : {}),
    $defs: { operatingRange: operatingRangeSchema(spec) },
  });
}

write("profile.facts-v3-5.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${base}profile.facts-v3-5.schema.json`,
  title: "scheMAGIC closed design profile with facts schema 3.5.0",
  allOf: [
    { $ref: "profile-envelope.facts-v3-5.schema.json" },
    {
      oneOf: V35_PART_CLASS_IDS.map((partClass) => ({
        type: "object",
        required: ["partClass", "facts"],
        properties: {
          partClass: { const: partClass },
          facts: { $ref: factsSchemaFileName(partClass) },
        },
      })),
    },
  ],
});
