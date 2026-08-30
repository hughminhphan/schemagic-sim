import { deepFreeze } from "./canonical";
import { PART_CLASS_SPECS, type FactSpec, type PartClassSpec } from "./specs";
import type { ProfileFact, ProfileQuantity, ProfileUnit } from "./types";

export const V31_PART_CLASS_IDS = deepFreeze([
  "motor.full-bridge-gate-driver",
] as const);

export type V31PartClassId = typeof V31_PART_CLASS_IDS[number];

const GATE_DRIVER_V31_SPEC = {
  operatingRanges: {
    ...PART_CLASS_SPECS["motor.full-bridge-gate-driver"].operatingRanges,
    bridgeVoltage: { unit: "V", domain: {} },
    driverBiasVoltage: { unit: "V", domain: { minimum: 0 } },
  },
  facts: {
    bridgeTopology: PART_CLASS_SPECS["motor.full-bridge-gate-driver"].facts.bridgeTopology,
    powerStage: PART_CLASS_SPECS["motor.full-bridge-gate-driver"].facts.powerStage,
    bridgeVoltageInterface: {
      kind: "text",
      values: ["motor_bus_supply_pin", "switch_node_only"],
      requiredForAdmission: true,
    },
    bridgeVoltageOperatingMinimum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: {} },
    bridgeVoltageOperatingMaximum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    bridgeVoltageAbsoluteMaximum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    driverBiasSource: {
      kind: "text",
      values: ["external_supply", "internal_regulator"],
      requiredForAdmission: true,
    },
    driverBiasInputMinimum: { kind: "quantity", unit: "V", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    driverBiasInputMaximum: { kind: "quantity", unit: "V", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    driverBiasOutputMinimum: { kind: "quantity", unit: "V", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    driverBiasOutputMaximum: { kind: "quantity", unit: "V", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    logicHighThresholdMaximum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    pwmMaximum: { kind: "quantity", unit: "Hz", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    pwmMaximumRole: {
      kind: "text",
      values: ["guaranteed_bound", "typical_observation"],
      requiredForAdmission: false,
    },
    minimumPulseWidth: { kind: "quantity", unit: "s", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    minimumPulseWidthRole: {
      kind: "text",
      values: ["guaranteed_bound", "typical_observation"],
      requiredForAdmission: false,
    },
    sourceCurrent: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    sinkCurrent: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    gatePullupResistance: { kind: "quantity", unit: "ohm", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    gatePulldownResistance: { kind: "quantity", unit: "ohm", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    deadTimeControl: {
      kind: "text",
      values: ["fixed", "adaptive", "programmable", "external"],
      requiredForAdmission: true,
    },
    deadTime: { kind: "quantity", unit: "s", requiredForAdmission: false, domain: { minimum: 0 } },
    highSideSupply: PART_CLASS_SPECS["motor.full-bridge-gate-driver"].facts.highSideSupply,
    continuousHighSideOnSupported: { kind: "boolean", requiredForAdmission: true },
    bootstrapMaximumDutyCycle: { kind: "quantity", unit: "1", requiredForAdmission: false, domain: { minimum: 0, maximum: 1 } },
    highSideBiasCurrentMaximum: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    quiescentCurrent: PART_CLASS_SPECS["motor.full-bridge-gate-driver"].facts.quiescentCurrent,
    junctionToAmbientThermalResistance: PART_CLASS_SPECS["motor.full-bridge-gate-driver"].facts.junctionToAmbientThermalResistance,
    maximumJunctionTemperature: PART_CLASS_SPECS["motor.full-bridge-gate-driver"].facts.maximumJunctionTemperature,
    currentSenseInterface: {
      kind: "text",
      values: ["none", "amplifier", "comparator"],
      requiredForAdmission: true,
    },
    senseMaximumVoltage: { kind: "quantity", unit: "V", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    localDecouplingMinimum: { kind: "quantity", unit: "F", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
  },
} as const satisfies PartClassSpec;

export const V31_PART_CLASS_SPECS = deepFreeze({
  "motor.full-bridge-gate-driver": GATE_DRIVER_V31_SPEC,
} as const satisfies Readonly<Record<V31PartClassId, PartClassSpec>>);

type FactValue<Spec extends FactSpec> = Spec extends { kind: "quantity"; unit: infer Unit extends ProfileUnit }
  ? ProfileQuantity<Unit>
  : Spec extends { kind: "boolean" }
    ? boolean
    : Spec extends { kind: "text"; values: readonly (infer Value extends string)[] }
      ? Value
      : string;

export type FactsV31AgainstSpec<Spec extends PartClassSpec> = {
  -readonly [Key in keyof Spec["facts"]]: ProfileFact<FactValue<Extract<Spec["facts"][Key], FactSpec>>>;
};

export type CoreFactsV31For<ClassId extends V31PartClassId> = FactsV31AgainstSpec<typeof V31_PART_CLASS_SPECS[ClassId]>;
