import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PART_CLASS_SPECS, type FactSpec, type NumericDomain, type PartClassSpec } from "../src/specs";
import {
  POWER_CONDITION_PARAMETER_SPECS_V2,
  POWER_EXTERNAL_CLAIM_SPECS_V2,
  POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2,
  POWER_EXTERNAL_REQUIRED_CONDITIONS_V2,
  POWER_INTEGRATED_CLAIM_SPECS_V2,
  POWER_INTEGRATED_REQUIRED_CONDITIONS_V2,
  type QuantityClaimSpecV2,
} from "../src/v2-claims";
import { CANONICAL_EVIDENCE_URL_PATTERN_SOURCE } from "../src/evidence-url";
import { PART_CLASS_IDS, type PartClassId, type ProfileUnit } from "../src/types";
import { requiredAdmissionCheckIds } from "../src/validation";

type Schema = Record<string, unknown>;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://schemas.schemagic.design/design-library/v1/";
const hash = "^sha256:[0-9a-f]{64}$";
const timestamp = "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,9})?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$";
const nonBlank = ".*\\S.*";
const hostnameLabel = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const hostname = `(?:${hostnameLabel})(?:\\.(?:${hostnameLabel}))*`;
const units = ["1", "A", "F", "H", "Hz", "K", "V", "V_s_per_rad", "W", "count", "m", "m2", "ohm", "rad_per_s", "s", "C", "J", "K/W", "1/K"];
const owners: Readonly<Record<PartClassId, string>> = {
  "motor.integrated-h-bridge": "motor", "motor.full-bridge-gate-driver": "motor",
  "power.integrated-synchronous-buck-regulator": "power", "power.external-fet-synchronous-buck-controller": "power",
  "shared.n-channel-power-mosfet": "integration-data-review", "shared.current-sense-resistor": "integration-data-review",
  "shared.general-purpose-resistor": "integration-data-review", "shared.switching-diode": "integration-data-review",
  "shared.mlcc-capacitor": "integration-data-review", "shared.bulk-capacitor": "integration-data-review",
  "motor.supply-tvs-diode": "integration-data-review", "power.power-inductor": "integration-data-review",
};

function write(relative: string, schema: Schema): void {
  const path = resolve(root, "schema", relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
}

function numeric(domain: NumericDomain): Schema {
  return { type: "number", ...domain };
}

function quantity(unit?: ProfileUnit, domain: NumericDomain = {}): Schema {
  return {
    type: "object", additionalProperties: false, required: ["value", "unit", "displayUnit"],
    properties: {
      value: numeric(domain),
      unit: unit === undefined ? { $ref: `${base}profile-envelope.v1.schema.json#/$defs/profileUnit` } : { const: unit },
      displayUnit: { type: "string", minLength: 1, pattern: nonBlank },
    },
  };
}

function evidenceSchema(): Schema {
  const properties = {
    sourceId: { type: "string", minLength: 1, pattern: nonBlank }, locator: { type: "string", minLength: 1, pattern: nonBlank },
    licenseNote: { type: "string", minLength: 1, pattern: nonBlank },
  };
  return {
    oneOf: [
      {
        type: "object", additionalProperties: false,
        required: ["sourceId", "locator", "retrievedAt", "contentHash", "licenseNote", "kind", "url", "revision", "publicationBasis"],
        properties: {
          ...properties, retrievedAt: { type: "string", format: "date-time", pattern: timestamp }, contentHash: { type: "string", pattern: hash },
          kind: { enum: ["manufacturer_datasheet", "manufacturer_product_page", "independent_measurement", "authored_derivation"] },
          url: { type: "string", pattern: CANONICAL_EVIDENCE_URL_PATTERN_SOURCE }, revision: { type: "string", minLength: 1, pattern: nonBlank },
          publicationBasis: { enum: ["public_facts", "licensed_redistribution", "original_measurement"] },
        },
        oneOf: [
          { type: "object", properties: { kind: { const: "manufacturer_datasheet" }, publicationBasis: { enum: ["public_facts", "licensed_redistribution"] } } },
          { type: "object", properties: { kind: { const: "manufacturer_product_page" }, publicationBasis: { enum: ["public_facts", "licensed_redistribution"] } } },
          { type: "object", properties: { kind: { const: "independent_measurement" }, publicationBasis: { const: "original_measurement" } } },
          { type: "object", properties: { kind: { const: "authored_derivation" }, publicationBasis: { enum: ["public_facts", "licensed_redistribution"] } } },
        ],
      },
      {
        type: "object", additionalProperties: false,
        required: ["sourceId", "locator", "retrievedAt", "contentHash", "licenseNote", "kind", "url", "revision", "publicationBasis"],
        properties: {
          ...properties, retrievedAt: { anyOf: [{ type: "string", format: "date-time", pattern: timestamp }, { type: "null" }] },
          contentHash: { anyOf: [{ type: "string", pattern: hash }, { type: "null" }] }, kind: { const: "synthetic_fixture" },
          url: { type: "null" }, revision: { type: "null" }, publicationBasis: { type: "null" },
        },
      },
    ],
  };
}

const envelope: Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: `${base}profile-envelope.v1.schema.json`, title: "scheMAGIC design profile envelope V1",
  type: "object", additionalProperties: false,
  required: ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"],
  properties: {
    format: { const: "schemagic-design-profile" }, schemaVersion: { const: "1.0.0" }, partClass: { enum: PART_CLASS_IDS },
    part: { $ref: "#/$defs/part" }, factsSchemaVersion: { const: "1.0.0" },
    commonFacts: {
      type: "object", additionalProperties: false, required: ["packageName", "boardArea", "maximumHeight"],
      properties: {
        packageName: { $ref: "#/$defs/factText" },
        boardArea: { allOf: [{ $ref: "#/$defs/profileFact" }, { type: "object", properties: { value: { anyOf: [quantity("m2", { exclusiveMinimum: 0 }), { type: "null" }] } } }] },
        maximumHeight: { allOf: [{ $ref: "#/$defs/profileFact" }, { type: "object", properties: { value: { anyOf: [quantity("m", { exclusiveMinimum: 0 }), { type: "null" }] } } }] },
      },
    },
    facts: { type: "object" },
  },
  $defs: {
    part: {
      type: "object", additionalProperties: false, required: ["manufacturerId", "manufacturerPartNumber"],
      properties: {
        manufacturerId: { type: "string", pattern: "^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$" },
        manufacturerPartNumber: { type: "string", minLength: 1, pattern: "^(?:\\S|\\S.*\\S)$" },
      },
    },
    profileUnit: { enum: units }, quantity: quantity(), evidence: evidenceSchema(),
    operatingRange: {
      type: "object", additionalProperties: false, required: ["parameterId", "minimum", "maximum", "evidence"],
      properties: {
        parameterId: { type: "string", minLength: 1, pattern: nonBlank },
        minimum: { anyOf: [quantity(), { type: "null" }] }, maximum: { anyOf: [quantity(), { type: "null" }] },
        evidence: { type: "array", minItems: 1, items: { $ref: "#/$defs/evidence" } },
      },
      anyOf: [{ properties: { minimum: { not: { type: "null" } } } }, { properties: { maximum: { not: { type: "null" } } } }],
    },
    profileFact: {
      type: "object", additionalProperties: false, required: ["value", "state", "evidence", "validFor", "explanation"],
      properties: {
        value: {}, state: { enum: ["reviewed", "calculated", "estimated", "unknown"] },
        evidence: { type: "array", items: { $ref: "#/$defs/evidence" } }, validFor: { type: "array", items: { $ref: "#/$defs/operatingRange" } },
        explanation: { type: "string", minLength: 1, pattern: nonBlank },
      },
      allOf: [{
        if: { type: "object", properties: { state: { const: "unknown" } }, required: ["state"] },
        then: { type: "object", properties: { value: { type: "null" }, evidence: { type: "array", maxItems: 0 }, validFor: { type: "array", maxItems: 0 } } },
        else: { type: "object", properties: { value: { not: { type: "null" } }, evidence: { type: "array", minItems: 1 } } },
      }],
    },
    factText: { allOf: [{ $ref: "#/$defs/profileFact" }, { type: "object", properties: { value: { type: ["string", "null"] } } }] },
    factBoolean: { allOf: [{ $ref: "#/$defs/profileFact" }, { type: "object", properties: { value: { type: ["boolean", "null"] } } }] },
  },
};
write("profile-envelope.v1.schema.json", envelope);

function rangeSchema(spec: PartClassSpec): Schema {
  return {
    oneOf: Object.entries(spec.operatingRanges).map(([parameterId, range]) => ({
      allOf: [
        { $ref: `${base}profile-envelope.v1.schema.json#/$defs/operatingRange` },
        { type: "object", properties: {
          parameterId: { const: parameterId }, minimum: { anyOf: [quantity(range.unit, range.domain), { type: "null" }] },
          maximum: { anyOf: [quantity(range.unit, range.domain), { type: "null" }] },
        } },
      ],
    })),
  };
}

function factSchema(fact: FactSpec): Schema {
  const value = fact.kind === "quantity" ? quantity(fact.unit, fact.domain)
    : fact.kind === "boolean" ? { type: "boolean" }
      : fact.values === undefined ? { type: "string", minLength: 1, pattern: nonBlank } : { enum: fact.values };
  const requiredRanges = (fact.requiredRangeParameters ?? []).map((parameterId) => ({
    if: { type: "object", required: ["state"], properties: { state: { const: "reviewed" } } },
    then: { type: "object", properties: { validFor: { type: "array", contains: { type: "object", required: ["parameterId"], properties: { parameterId: { const: parameterId } } } } } },
  }));
  return {
    allOf: [
      { $ref: `${base}profile-envelope.v1.schema.json#/$defs/profileFact` },
      { type: "object", properties: { value: { anyOf: [value, { type: "null" }] }, validFor: { type: "array", items: { $ref: "#/$defs/operatingRange" } } } },
      ...requiredRanges,
    ],
  };
}

for (const partClass of PART_CLASS_IDS) {
  const spec = PART_CLASS_SPECS[partClass];
  const properties = Object.fromEntries(Object.entries(spec.facts).map(([factId, fact]) => [factId, factSchema(fact)]));
  write(`facts/${partClass}.v1.schema.json`, {
    $schema: "https://json-schema.org/draft/2020-12/schema", $id: `${base}facts/${partClass}.v1.schema.json`,
    type: "object", additionalProperties: false, required: Object.keys(spec.facts), properties, $defs: { operatingRange: rangeSchema(spec) },
  });
}

write("profile.v1.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: `${base}profile.v1.schema.json`, title: "scheMAGIC closed design profile V1",
  allOf: [
    { $ref: "profile-envelope.v1.schema.json" },
    { oneOf: PART_CLASS_IDS.map((partClass) => ({ type: "object", required: ["partClass", "facts"], properties: { partClass: { const: partClass }, facts: { $ref: `facts/${partClass}.v1.schema.json` } } })) },
  ],
});

const v1EnvelopeRef = `${base}profile-envelope.v1.schema.json`;
const factsV2EnvelopeId = `${base}profile-envelope.facts-v2.schema.json`;
const token = "^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$";

function evidenceArray(minItems = 0): Schema {
  return { type: "array", minItems, items: { $ref: `${v1EnvelopeRef}#/$defs/evidence` } };
}

function unknownLegacyGeometry(): Schema {
  return {
    type: "object", additionalProperties: false,
    required: ["value", "state", "evidence", "validFor", "explanation"],
    properties: {
      value: { type: "null" }, state: { const: "unknown" }, evidence: { type: "array", maxItems: 0 },
      validFor: { type: "array", maxItems: 0 }, explanation: { type: "string", minLength: 1, pattern: nonBlank },
    },
  };
}

function profileFactV2(value: Schema, state?: string): Schema {
  return {
    type: "object", additionalProperties: false,
    required: ["value", "state", "evidence", "validFor", "explanation"],
    properties: {
      value, state: state === undefined ? { enum: ["reviewed", "calculated", "estimated", "unknown"] } : { const: state },
      evidence: evidenceArray(), validFor: { type: "array" }, explanation: { type: "string", minLength: 1, pattern: nonBlank },
    },
  };
}

const dimensionTermV2: Schema = {
  type: "object", additionalProperties: false,
  required: ["axis", "dimensionId", "multiplier", "maximum", "evidence"],
  properties: {
    axis: { enum: ["x", "y"] }, dimensionId: { type: "string", pattern: token },
    multiplier: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    maximum: quantity("m", { exclusiveMinimum: 0 }), evidence: evidenceArray(1),
  },
};

const mountedGeometryV2: Schema = {
  type: "object", additionalProperties: false, required: ["boardArea", "maximumHeight"],
  properties: {
    boardArea: {
      ...profileFactV2({ type: "object" }, "calculated"),
      properties: {
        ...profileFactV2({ type: "object" }, "calculated").properties as Record<string, unknown>,
        value: {
          type: "object", additionalProperties: false,
          required: ["area", "basis", "calculation", "sourceDimensions"],
          properties: {
            area: quantity("m2", { exclusiveMinimum: 0 }),
            basis: { enum: ["manufacturer_recommended_land_pattern_bounding_box", "reviewed_assembly_footprint_bounding_box"] },
            calculation: { const: "maximum_x_span_times_maximum_y_span" },
            sourceDimensions: { type: "array", minItems: 2, items: dimensionTermV2 },
          },
        },
        evidence: evidenceArray(1), validFor: { type: "array", maxItems: 0 },
      },
    },
    maximumHeight: {
      ...profileFactV2({ type: "object" }, "reviewed"),
      properties: {
        ...profileFactV2({ type: "object" }, "reviewed").properties as Record<string, unknown>,
        value: {
          type: "object", additionalProperties: false, required: ["height", "basis"],
          properties: {
            height: quantity("m", { exclusiveMinimum: 0 }),
            basis: { enum: ["manufacturer_package_maximum_in_surface_mount_orientation", "reviewed_assembly_envelope_maximum"] },
          },
        },
        evidence: evidenceArray(1), validFor: { type: "array", maxItems: 0 },
      },
    },
  },
};

const envelopeV2: Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: factsV2EnvelopeId,
  title: "scheMAGIC design profile envelope with facts schema V2",
  type: "object", additionalProperties: false,
  required: ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"],
  properties: {
    format: { const: "schemagic-design-profile" }, schemaVersion: { const: "1.0.0" }, partClass: { enum: PART_CLASS_IDS },
    part: { $ref: `${v1EnvelopeRef}#/$defs/part` }, factsSchemaVersion: { const: "2.0.0" },
    commonFacts: {
      type: "object", additionalProperties: false, required: ["packageName", "boardArea", "maximumHeight"],
      properties: {
        packageName: { $ref: `${v1EnvelopeRef}#/$defs/factText` },
        boardArea: unknownLegacyGeometry(), maximumHeight: unknownLegacyGeometry(),
      },
    },
    facts: { type: "object" },
  },
  $defs: { mountedGeometry: mountedGeometryV2 },
};
write("profile-envelope.facts-v2.schema.json", envelopeV2);

function conditionV2(): Schema {
  return {
    oneOf: Object.entries(POWER_CONDITION_PARAMETER_SPECS_V2).map(([parameterId, spec]) => spec.kind === "token_equals" ? {
      type: "object", additionalProperties: false, required: ["parameterId", "kind", "value", "evidence"],
      properties: { parameterId: { const: parameterId }, kind: { const: "token_equals" }, value: { type: "string", pattern: token }, evidence: evidenceArray(1) },
    } : {
      type: "object", additionalProperties: false, required: ["parameterId", "kind", "minimum", "maximum", "evidence"],
      properties: {
        parameterId: { const: parameterId }, kind: { const: "quantity_range" },
        minimum: { anyOf: [quantity(spec.unit, spec.domain === "positive" ? { exclusiveMinimum: 0 } : { minimum: 0 }), { type: "null" }] },
        maximum: { anyOf: [quantity(spec.unit, spec.domain === "positive" ? { exclusiveMinimum: 0 } : { minimum: 0 }), { type: "null" }] },
        evidence: evidenceArray(1),
      },
      anyOf: [{ properties: { minimum: { not: { type: "null" } } } }, { properties: { maximum: { not: { type: "null" } } } }],
    }),
  };
}

function quantityClaimV2(spec: QuantityClaimSpecV2, requiredConditions: readonly string[]): Schema {
  const domain = spec.domain === "positive" ? { exclusiveMinimum: 0 } : { minimum: 0 };
  return {
    type: "object", additionalProperties: false,
    required: ["claimKind", "basis", "value", "state", "evidence", "validFor", "explanation"],
    properties: {
      claimKind: { const: spec.claimKind }, basis: { const: spec.basis },
      value: { anyOf: [quantity(spec.unit, domain), { type: "null" }] },
      state: { enum: ["reviewed", "calculated", "estimated", "unknown"] }, evidence: evidenceArray(),
      validFor: { type: "array", items: conditionV2() }, explanation: { type: "string", minLength: 1, pattern: nonBlank },
    },
    allOf: [
      {
        if: { properties: { state: { const: "unknown" } }, required: ["state"] },
        then: { properties: { value: { type: "null" }, evidence: { type: "array", maxItems: 0 }, validFor: { type: "array", maxItems: 0 } } },
        else: { properties: { value: { not: { type: "null" } }, evidence: evidenceArray(1) } },
      },
      ...requiredConditions.map((parameterId) => ({
        if: { properties: { state: { not: { const: "unknown" } } }, required: ["state"] },
        then: { properties: { validFor: { type: "array", contains: { type: "object", properties: { parameterId: { const: parameterId } }, required: ["parameterId"] }, minContains: 1, maxContains: 1 } } },
      })),
      ...Object.keys(POWER_CONDITION_PARAMETER_SPECS_V2).map((parameterId) => ({
        properties: { validFor: { type: "array", contains: { type: "object", properties: { parameterId: { const: parameterId } }, required: ["parameterId"] }, minContains: 0, maxContains: 1 } },
      })),
    ],
  };
}

function configuredSpreadV2(requiredConditions: readonly string[]): Schema {
  const spread = (claimKind: "guaranteed_minimum" | "typical" | "guaranteed_maximum") => quantityClaimV2({ unit: "V", claimKind, basis: "production_spread", domain: "positive" }, requiredConditions);
  return {
    type: "array", minItems: 1, items: {
      type: "object", additionalProperties: false, required: ["settingId", "setting", "minimum", "typical", "maximum"],
      properties: {
        settingId: { type: "string", pattern: token },
        setting: {
          type: "object", additionalProperties: false, required: ["value", "state", "evidence", "validFor", "explanation"],
          properties: {
            value: { type: "string", pattern: token }, state: { const: "reviewed" }, evidence: evidenceArray(1),
            validFor: { type: "array", maxItems: 0 }, explanation: { type: "string", minLength: 1, pattern: nonBlank },
          },
        },
        minimum: spread("guaranteed_minimum"), typical: spread("typical"), maximum: spread("guaranteed_maximum"),
      },
    },
  };
}

for (const partClass of PART_CLASS_IDS) {
  const powerIntegrated = partClass === "power.integrated-synchronous-buck-regulator";
  const powerExternal = partClass === "power.external-fet-synchronous-buck-controller";
  let properties: Record<string, Schema>;
  if (powerIntegrated || powerExternal) {
    const claimSpecs = powerIntegrated ? POWER_INTEGRATED_CLAIM_SPECS_V2 : POWER_EXTERNAL_CLAIM_SPECS_V2;
    const requiredConditions = powerIntegrated ? POWER_INTEGRATED_REQUIRED_CONDITIONS_V2 : POWER_EXTERNAL_REQUIRED_CONDITIONS_V2;
    properties = Object.fromEntries(Object.entries(claimSpecs).map(([field, spec]) => [field, quantityClaimV2(spec, (requiredConditions as Readonly<Record<string, readonly string[]>>)[field] ?? [])]));
    properties.mountedGeometry = { $ref: `${factsV2EnvelopeId}#/$defs/mountedGeometry` };
    properties.controlEvidenceBasis = { allOf: [{ $ref: `${v1EnvelopeRef}#/$defs/factText` }, { type: "object", properties: { validFor: { type: "array", maxItems: 0 } } }] };
    if (powerExternal) {
      properties.currentSenseThresholdOptions = configuredSpreadV2(POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.currentSenseThresholdOptions);
      properties.gateDriveVoltageOptions = configuredSpreadV2(POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.gateDriveVoltageOptions);
    }
  } else {
    const spec = PART_CLASS_SPECS[partClass];
    properties = Object.fromEntries(Object.entries(spec.facts).map(([factId, fact]) => [factId, factSchema(fact)]));
    properties.mountedGeometry = { $ref: `${factsV2EnvelopeId}#/$defs/mountedGeometry` };
  }
  write(`facts/${partClass}.v2.schema.json`, {
    $schema: "https://json-schema.org/draft/2020-12/schema", $id: `${base}facts/${partClass}.v2.schema.json`,
    type: "object", additionalProperties: false, required: Object.keys(properties), properties,
    ...(powerIntegrated || powerExternal ? {} : { $defs: { operatingRange: rangeSchema(PART_CLASS_SPECS[partClass]) } }),
  });
}

write("profile.facts-v2.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: `${base}profile.facts-v2.schema.json`,
  title: "scheMAGIC closed design profile with facts schema V2",
  allOf: [
    { $ref: "profile-envelope.facts-v2.schema.json" },
    { oneOf: PART_CLASS_IDS.map((partClass) => ({ type: "object", required: ["partClass", "facts"], properties: { partClass: { const: partClass }, facts: { $ref: `facts/${partClass}.v2.schema.json` } } })) },
  ],
});

write("manufacturer-registry.v1.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: `${base}manufacturer-registry.v1.schema.json`, type: "object", additionalProperties: false,
  required: ["format", "schemaVersion", "manufacturers"], properties: {
    format: { const: "schemagic-manufacturer-registry" }, schemaVersion: { const: "1.0.0" }, manufacturers: {
      type: "array", items: { type: "object", additionalProperties: false, required: ["manufacturerId", "displayName", "primaryEvidenceHosts"], properties: {
        manufacturerId: { type: "string", pattern: "^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$" }, displayName: { type: "string", minLength: 1, pattern: nonBlank },
        primaryEvidenceHosts: { type: "array", minItems: 1, items: { type: "string", format: "hostname", maxLength: 253, pattern: `^${hostname}$` }, uniqueItems: true },
      } },
    },
  },
});

const check = (checkId: string, status?: "pass"): Schema => ({ type: "object", additionalProperties: false, required: ["checkId", "status"], properties: { checkId: { const: checkId }, status: status === undefined ? { enum: ["pass", "fail", "not_run"] } : { const: status } } });
const checks = (partClass: PartClassId, status?: "pass"): Schema => ({
  type: "array", minItems: requiredAdmissionCheckIds(partClass).length, maxItems: requiredAdmissionCheckIds(partClass).length,
  prefixItems: requiredAdmissionCheckIds(partClass).map((checkId) => check(checkId, status)), items: false,
});
const entryProperties: Schema = {
  partClass: { enum: PART_CLASS_IDS }, part: { $ref: "profile-envelope.v1.schema.json#/$defs/part" }, profilePath: { type: "string", pattern: "^packages/design-library/parts/" },
  ownerTrack: { enum: ["motor", "power", "integration-data-review"] }, reviewerTrack: { enum: ["motor", "power", "integration-data-review"] },
  state: { enum: ["planned", "researching", "authored", "in_independent_review", "reviewed", "blocked"] },
  authoredBy: { type: ["string", "null"] }, authoredAt: { anyOf: [{ type: "string", format: "date-time", pattern: timestamp }, { type: "null" }] },
  reviewedBy: { type: ["string", "null"] }, reviewedAt: { anyOf: [{ type: "string", format: "date-time", pattern: timestamp }, { type: "null" }] },
  profileContentHash: { anyOf: [{ type: "string", pattern: hash }, { type: "null" }] }, checks: { type: "array" },
};
write("admission.v1.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: `${base}admission.v1.schema.json`, type: "object", additionalProperties: false,
  required: ["format", "schemaVersion", "entries"], properties: {
    format: { const: "schemagic-design-profile-admission" }, schemaVersion: { const: "1.0.0" }, entries: { type: "array", items: {
      oneOf: PART_CLASS_IDS.map((partClass) => ({
        type: "object", additionalProperties: false,
        required: ["partClass", "part", "profilePath", "ownerTrack", "reviewerTrack", "state", "authoredBy", "authoredAt", "reviewedBy", "reviewedAt", "profileContentHash", "checks"],
        properties: { ...entryProperties, partClass: { const: partClass }, ownerTrack: { const: owners[partClass] }, reviewerTrack: { enum: ["motor", "power", "integration-data-review"], not: { const: owners[partClass] } }, checks: checks(partClass) },
        allOf: [{
          if: { type: "object", required: ["state"], properties: { state: { const: "reviewed" } } },
          then: { type: "object", properties: {
            authoredBy: { type: "string", minLength: 1, pattern: nonBlank }, authoredAt: { type: "string", format: "date-time", pattern: timestamp },
            reviewedBy: { type: "string", minLength: 1, pattern: nonBlank }, reviewedAt: { type: "string", format: "date-time", pattern: timestamp },
            profileContentHash: { type: "string", pattern: hash }, checks: checks(partClass, "pass"),
          } },
          else: { type: "object", properties: { reviewedBy: { type: "null" }, reviewedAt: { type: "null" } } },
        }],
      })),
    } },
  },
});

const releaseProfile = { type: "object", additionalProperties: false, required: ["profileId", "profilePath", "partClass", "part", "profileContentHash"], properties: {
  profileId: { type: "string", minLength: 1 }, profilePath: { type: "string", pattern: "^packages/design-library/parts/" }, partClass: { enum: PART_CLASS_IDS },
  part: { $ref: "profile-envelope.v1.schema.json#/$defs/part" }, profileContentHash: { type: "string", pattern: hash },
} };
write("catalog-release.v1.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: `${base}catalog-release.v1.schema.json`, type: "object", additionalProperties: false,
  required: ["format", "schemaVersion", "version", "releasedAt", "manufacturerRegistryContentHash", "admissionContentHash", "profiles", "contentHash"],
  properties: {
    format: { const: "schemagic-design-catalog-release" }, schemaVersion: { const: "1.0.0" }, version: { type: "string", minLength: 1, pattern: nonBlank }, releasedAt: { type: "string", format: "date-time", pattern: timestamp },
    manufacturerRegistryContentHash: { type: "string", pattern: hash }, admissionContentHash: { type: "string", pattern: hash }, profiles: { type: "array", items: releaseProfile }, contentHash: { type: "string", pattern: hash },
  },
});
