import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Schema = Record<string, unknown>;
interface NumericDomain {
  readonly minimum?: number;
  readonly exclusiveMinimum?: number;
  readonly maximum?: number;
}

type Unit = "1" | "A" | "C" | "Hz" | "J" | "K" | "K/W" | "V" | "m" | "m2" | "ohm" | "s";

interface RangeSpec {
  readonly unit: Unit;
  readonly domain: NumericDomain;
}

interface FactSpec {
  readonly kind: "quantity" | "text" | "boolean";
  readonly unit?: Unit;
  readonly values?: readonly string[];
  readonly domain?: NumericDomain;
  readonly requiredConditions?: readonly string[];
  readonly exactlyOneConditionGroup?: readonly string[];
  readonly states?: readonly string[];
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://schemas.schemagic.design/design-library/v1/";
const v1EnvelopeRef = `${base}profile-envelope.v1.schema.json`;
const factsV3EnvelopeId = `${base}profile-envelope.facts-v3.schema.json`;
const nonBlank = ".*\\S.*";
const token = "^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$";
const positive = Object.freeze({ exclusiveMinimum: 0 });
const nonNegative = Object.freeze({ minimum: 0 });
const ratio = Object.freeze({ minimum: 0, maximum: 1 });

const selectedPartClasses = Object.freeze([
  "shared.n-channel-power-mosfet",
  "motor.supply-tvs-diode",
] as const);

const selectedV31PartClasses = Object.freeze([
  "motor.full-bridge-gate-driver",
] as const);
const factsV31EnvelopeId = `${base}profile-envelope.facts-v3-1.schema.json`;

const mosfetRanges: Readonly<Record<string, RangeSpec>> = Object.freeze({
  ambientTemperature: { unit: "K", domain: nonNegative },
  caseTemperature: { unit: "K", domain: nonNegative },
  junctionTemperature: { unit: "K", domain: nonNegative },
  supplyVoltage: { unit: "V", domain: nonNegative },
  testCurrent: { unit: "A", domain: nonNegative },
  testVoltage: { unit: "V", domain: nonNegative },
  switchingFrequency: { unit: "Hz", domain: nonNegative },
  pulseDuration: { unit: "s", domain: nonNegative },
  dutyCycle: { unit: "1", domain: ratio },
  boardCopperArea: { unit: "m2", domain: nonNegative },
  gateVoltage: { unit: "V", domain: nonNegative },
  drainCurrent: { unit: "A", domain: nonNegative },
});

const tvsRanges: Readonly<Record<string, RangeSpec>> = Object.freeze({
  ambientTemperature: { unit: "K", domain: nonNegative },
  testCurrent: { unit: "A", domain: nonNegative },
  testVoltage: { unit: "V", domain: nonNegative },
  switchingFrequency: { unit: "Hz", domain: nonNegative },
  pulseDuration: { unit: "s", domain: nonNegative },
  dutyCycle: { unit: "1", domain: ratio },
});

const mosfetFacts: Readonly<Record<string, FactSpec>> = Object.freeze({
  drainSourceVoltage: { kind: "quantity", unit: "V", domain: positive },
  continuousDrainCurrent: { kind: "quantity", unit: "A", domain: positive, requiredConditions: ["ambientTemperature"] },
  pulsedDrainCurrent: { kind: "quantity", unit: "A", domain: positive, requiredConditions: ["pulseDuration", "dutyCycle"] },
  onResistance: {
    kind: "quantity",
    unit: "ohm",
    domain: positive,
    requiredConditions: ["gateVoltage", "drainCurrent"],
    exactlyOneConditionGroup: ["ambientTemperature", "caseTemperature", "junctionTemperature"],
  },
  totalGateCharge: { kind: "quantity", unit: "C", domain: positive, requiredConditions: ["gateVoltage", "testVoltage", "testCurrent"] },
  riseTime: { kind: "quantity", unit: "s", domain: positive, requiredConditions: ["gateVoltage", "testVoltage", "testCurrent"] },
  fallTime: { kind: "quantity", unit: "s", domain: positive, requiredConditions: ["gateVoltage", "testVoltage", "testCurrent"] },
  reverseRecoveryCharge: { kind: "quantity", unit: "C", domain: positive, requiredConditions: ["testVoltage", "testCurrent"] },
  maximumJunctionTemperature: { kind: "quantity", unit: "K", domain: positive },
  junctionToAmbientThermalResistance: { kind: "quantity", unit: "K/W", domain: positive },
  thermalBoardAssumption: { kind: "text" },
  packageBodyArea: { kind: "quantity", unit: "m2", domain: positive },
});

const tvsFacts: Readonly<Record<string, FactSpec>> = Object.freeze({
  standOffVoltage: { kind: "quantity", unit: "V", domain: positive },
  breakdownVoltageMinimum: { kind: "quantity", unit: "V", domain: positive },
  breakdownVoltageMaximum: { kind: "quantity", unit: "V", domain: positive },
  clampingBehavior: { kind: "text", values: ["avalanche", "snapback"] },
  clampingVoltage: {
    kind: "quantity",
    unit: "V",
    domain: positive,
    requiredConditions: ["testCurrent", "pulseDuration", "ambientTemperature"],
  },
  pulseCurrent: {
    kind: "quantity",
    unit: "A",
    domain: positive,
    requiredConditions: ["testCurrent", "pulseDuration", "ambientTemperature"],
  },
  pulseWaveform: { kind: "text" },
  pulseEnergy: {
    kind: "quantity",
    unit: "J",
    domain: positive,
    requiredConditions: ["pulseDuration"],
    states: ["reviewed", "unknown"],
  },
});

function write(relative: string, schema: Schema): void {
  const path = resolve(root, "schema", relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
}

function quantity(unit: Unit, domain: NumericDomain = {}): Schema {
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

function evidenceArray(minItems = 0): Schema {
  return {
    type: "array",
    minItems,
    items: { $ref: `${v1EnvelopeRef}#/$defs/evidence` },
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

function profileFact(value: Schema, state?: string): Schema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "state", "evidence", "validFor", "explanation"],
    properties: {
      value,
      state: state === undefined
        ? { enum: ["reviewed", "calculated", "estimated", "unknown"] }
        : { const: state },
      evidence: evidenceArray(),
      validFor: { type: "array" },
      explanation: { type: "string", minLength: 1, pattern: nonBlank },
    },
  };
}

const dimensionTerm: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["axis", "dimensionId", "multiplier", "maximum", "evidence"],
  properties: {
    axis: { enum: ["x", "y"] },
    dimensionId: { type: "string", pattern: token },
    multiplier: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    maximum: quantity("m", positive),
    evidence: evidenceArray(1),
  },
};

const mountedGeometry: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["boardArea", "maximumHeight"],
  properties: {
    boardArea: {
      ...profileFact({ type: "object" }, "calculated"),
      properties: {
        ...(profileFact({ type: "object" }, "calculated").properties as Record<string, unknown>),
        value: {
          type: "object",
          additionalProperties: false,
          required: ["area", "basis", "calculation", "sourceDimensions"],
          properties: {
            area: quantity("m2", positive),
            basis: {
              enum: [
                "manufacturer_recommended_land_pattern_bounding_box",
                "reviewed_assembly_footprint_bounding_box",
              ],
            },
            calculation: { const: "maximum_x_span_times_maximum_y_span" },
            sourceDimensions: { type: "array", minItems: 2, items: dimensionTerm },
          },
        },
        evidence: evidenceArray(1),
        validFor: { type: "array", maxItems: 0 },
      },
    },
    maximumHeight: {
      ...profileFact({ type: "object" }, "reviewed"),
      properties: {
        ...(profileFact({ type: "object" }, "reviewed").properties as Record<string, unknown>),
        value: {
          type: "object",
          additionalProperties: false,
          required: ["height", "basis"],
          properties: {
            height: quantity("m", positive),
            basis: {
              enum: [
                "manufacturer_package_maximum_in_surface_mount_orientation",
                "reviewed_assembly_envelope_maximum",
              ],
            },
          },
        },
        evidence: evidenceArray(1),
        validFor: { type: "array", maxItems: 0 },
      },
    },
  },
};

write("profile-envelope.facts-v3.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: factsV3EnvelopeId,
  title: "scheMAGIC design profile envelope with facts schema V3",
  type: "object",
  additionalProperties: false,
  required: ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"],
  properties: {
    format: { const: "schemagic-design-profile" },
    schemaVersion: { const: "1.0.0" },
    partClass: { enum: selectedPartClasses },
    part: { $ref: `${v1EnvelopeRef}#/$defs/part` },
    factsSchemaVersion: { const: "3.0.0" },
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

function operatingRangeSchema(ranges: Readonly<Record<string, RangeSpec>>): Schema {
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

function exactCondition(parameterId: string): Schema {
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
        minContains: 1,
        maxContains: 1,
      },
    },
  };
}

function reviewedRequires(constraints: readonly Schema[]): Schema {
  return {
    if: {
      type: "object",
      required: ["state"],
      properties: { state: { const: "reviewed" } },
    },
    then: { type: "object", allOf: constraints },
  };
}

function factSchema(spec: FactSpec): Schema {
  const value = spec.kind === "quantity"
    ? quantity(spec.unit!, spec.domain)
    : spec.kind === "boolean"
      ? { type: "boolean" }
    : spec.values === undefined
      ? { type: "string", minLength: 1, pattern: nonBlank }
      : { enum: spec.values };
  const constraints = (spec.requiredConditions ?? []).map(exactCondition);
  if (spec.exactlyOneConditionGroup !== undefined) {
    constraints.push({ oneOf: spec.exactlyOneConditionGroup.map(exactCondition) });
  }
  return {
    allOf: [
      { $ref: `${v1EnvelopeRef}#/$defs/profileFact` },
      {
        type: "object",
        properties: {
          value: { anyOf: [value, { type: "null" }] },
          state: spec.states === undefined ? {} : { enum: spec.states },
          validFor: { type: "array", items: { $ref: "#/$defs/operatingRange" } },
        },
      },
      ...(constraints.length === 0 ? [] : [reviewedRequires(constraints)]),
    ],
  };
}

function classSchema(
  partClass: typeof selectedPartClasses[number],
  facts: Readonly<Record<string, FactSpec>>,
  ranges: Readonly<Record<string, RangeSpec>>,
): Schema {
  const properties = Object.fromEntries(Object.entries(facts).map(([factId, spec]) => [factId, factSchema(spec)]));
  properties.mountedGeometry = { $ref: `${factsV3EnvelopeId}#/$defs/mountedGeometry` };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${base}facts/${partClass}.v3.schema.json`,
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
    $defs: { operatingRange: operatingRangeSchema(ranges) },
  };
}

write(
  "facts/shared.n-channel-power-mosfet.v3.schema.json",
  classSchema("shared.n-channel-power-mosfet", mosfetFacts, mosfetRanges),
);
write(
  "facts/motor.supply-tvs-diode.v3.schema.json",
  classSchema("motor.supply-tvs-diode", tvsFacts, tvsRanges),
);

write("profile.facts-v3.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${base}profile.facts-v3.schema.json`,
  title: "scheMAGIC closed design profile with facts schema V3",
  allOf: [
    { $ref: "profile-envelope.facts-v3.schema.json" },
    {
      oneOf: selectedPartClasses.map((partClass) => ({
        type: "object",
        required: ["partClass", "facts"],
        properties: {
          partClass: { const: partClass },
          facts: { $ref: `facts/${partClass}.v3.schema.json` },
        },
      })),
    },
  ],
});

const gateDriverRanges: Readonly<Record<string, RangeSpec>> = Object.freeze({
  ambientTemperature: { unit: "K", domain: nonNegative },
  junctionTemperature: { unit: "K", domain: nonNegative },
  supplyVoltage: { unit: "V", domain: nonNegative },
  testCurrent: { unit: "A", domain: nonNegative },
  testVoltage: { unit: "V", domain: nonNegative },
  switchingFrequency: { unit: "Hz", domain: nonNegative },
  pulseDuration: { unit: "s", domain: nonNegative },
  dutyCycle: { unit: "1", domain: ratio },
  boardCopperArea: { unit: "m2", domain: nonNegative },
  bridgeVoltage: { unit: "V", domain: {} },
  driverBiasVoltage: { unit: "V", domain: nonNegative },
});

const gateDriverFacts: Readonly<Record<string, FactSpec>> = Object.freeze({
  bridgeTopology: { kind: "text", values: ["full_bridge"] },
  powerStage: { kind: "text", values: ["external_n_channel_mosfet"] },
  bridgeVoltageInterface: { kind: "text", values: ["motor_bus_supply_pin", "switch_node_only"] },
  bridgeVoltageOperatingMinimum: { kind: "quantity", unit: "V", domain: {} },
  bridgeVoltageOperatingMaximum: { kind: "quantity", unit: "V", domain: positive },
  bridgeVoltageAbsoluteMaximum: { kind: "quantity", unit: "V", domain: positive },
  driverBiasSource: { kind: "text", values: ["external_supply", "internal_regulator"] },
  driverBiasInputMinimum: { kind: "quantity", unit: "V", domain: positive },
  driverBiasInputMaximum: { kind: "quantity", unit: "V", domain: positive },
  driverBiasOutputMinimum: { kind: "quantity", unit: "V", domain: positive },
  driverBiasOutputMaximum: { kind: "quantity", unit: "V", domain: positive },
  logicHighThresholdMaximum: { kind: "quantity", unit: "V", domain: positive },
  pwmMaximum: { kind: "quantity", unit: "Hz", domain: positive },
  pwmMaximumRole: { kind: "text", values: ["guaranteed_bound", "typical_observation"] },
  minimumPulseWidth: { kind: "quantity", unit: "s", domain: positive },
  minimumPulseWidthRole: { kind: "text", values: ["guaranteed_bound", "typical_observation"] },
  sourceCurrent: { kind: "quantity", unit: "A", domain: positive },
  sinkCurrent: { kind: "quantity", unit: "A", domain: positive },
  gatePullupResistance: { kind: "quantity", unit: "ohm", domain: positive },
  gatePulldownResistance: { kind: "quantity", unit: "ohm", domain: positive },
  deadTimeControl: { kind: "text", values: ["fixed", "adaptive", "programmable", "external"] },
  deadTime: { kind: "quantity", unit: "s", domain: nonNegative },
  highSideSupply: { kind: "text", values: ["bootstrap", "charge_pump", "bootstrap_with_charge_pump", "bootstrap_with_top_off_charge_pump"] },
  continuousHighSideOnSupported: { kind: "boolean" },
  bootstrapMaximumDutyCycle: { kind: "quantity", unit: "1", domain: ratio },
  highSideBiasCurrentMaximum: { kind: "quantity", unit: "A", domain: positive },
  quiescentCurrent: { kind: "quantity", unit: "A", domain: positive },
  junctionToAmbientThermalResistance: { kind: "quantity", unit: "K/W", domain: positive },
  maximumJunctionTemperature: { kind: "quantity", unit: "K", domain: positive },
  currentSenseInterface: { kind: "text", values: ["none", "amplifier", "comparator"] },
  senseMaximumVoltage: { kind: "quantity", unit: "V", domain: positive },
  localDecouplingMinimum: { kind: "quantity", unit: "F", domain: positive },
});

write("profile-envelope.facts-v3-1.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: factsV31EnvelopeId,
  title: "scheMAGIC design profile envelope with facts schema 3.1.0",
  type: "object",
  additionalProperties: false,
  required: ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"],
  properties: {
    format: { const: "schemagic-design-profile" },
    schemaVersion: { const: "1.0.0" },
    partClass: { enum: selectedV31PartClasses },
    part: { $ref: `${v1EnvelopeRef}#/$defs/part` },
    factsSchemaVersion: { const: "3.1.0" },
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

function factValueIs(field: string, value: string): Schema {
  return {
    required: [field],
    properties: {
      [field]: {
        type: "object",
        required: ["value"],
        properties: { value: { const: value } },
      },
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

function reviewedFact(): Schema {
  return { type: "object", required: ["state"], properties: { state: { const: "reviewed" } } };
}

function gateDriverV31Schema(): Schema {
  const properties = Object.fromEntries(Object.entries(gateDriverFacts).map(([factId, spec]) => [factId, factSchema(spec)]));
  properties.mountedGeometry = { $ref: `${factsV31EnvelopeId}#/$defs/mountedGeometry` };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${base}facts/motor.full-bridge-gate-driver.v3-1.schema.json`,
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
    allOf: [
      {
        if: factValueIs("driverBiasSource", "external_supply"),
        then: { properties: { driverBiasOutputMinimum: exactUnknownFact(), driverBiasOutputMaximum: exactUnknownFact() } },
      },
      {
        if: factValueIs("driverBiasSource", "internal_regulator"),
        then: { properties: { driverBiasInputMinimum: exactUnknownFact(), driverBiasInputMaximum: exactUnknownFact() } },
      },
      {
        if: factValueIs("currentSenseInterface", "none"),
        then: { properties: { senseMaximumVoltage: exactUnknownFact() } },
      },
      {
        if: factStateIs("pwmMaximum", "unknown"),
        then: { properties: { pwmMaximumRole: exactUnknownFact() } },
      },
      {
        if: factStateIs("pwmMaximum", "reviewed"),
        then: { properties: { pwmMaximumRole: reviewedFact() } },
      },
      {
        if: factStateIs("minimumPulseWidth", "unknown"),
        then: { properties: { minimumPulseWidthRole: exactUnknownFact() } },
      },
      {
        if: factStateIs("minimumPulseWidth", "reviewed"),
        then: { properties: { minimumPulseWidthRole: reviewedFact() } },
      },
    ],
    $defs: { operatingRange: operatingRangeSchema(gateDriverRanges) },
  };
}

write("facts/motor.full-bridge-gate-driver.v3-1.schema.json", gateDriverV31Schema());

write("profile.facts-v3-1.schema.json", {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${base}profile.facts-v3-1.schema.json`,
  title: "scheMAGIC closed design profile with facts schema 3.1.0",
  allOf: [
    { $ref: "profile-envelope.facts-v3-1.schema.json" },
    {
      oneOf: selectedV31PartClasses.map((partClass) => ({
        type: "object",
        required: ["partClass", "facts"],
        properties: {
          partClass: { const: partClass },
          facts: { $ref: `facts/${partClass}.v3-1.schema.json` },
        },
      })),
    },
  ],
});
