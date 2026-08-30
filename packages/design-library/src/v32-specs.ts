import { deepFreeze } from "./canonical";
import { PART_CLASS_SPECS, type FactSpec, type PartClassSpec } from "./specs";
import type { ProfileFact, ProfileQuantity, ProfileUnit } from "./types";

export const V32_PART_CLASS_IDS = deepFreeze([
  "motor.integrated-h-bridge",
] as const);

export type V32PartClassId = typeof V32_PART_CLASS_IDS[number];

const INTEGRATED_H_BRIDGE_V32_SPEC = {
  operatingRanges: PART_CLASS_SPECS["motor.integrated-h-bridge"].operatingRanges,
  facts: {
    bridgeTopology: { kind: "text", values: ["full_bridge"], requiredForAdmission: true },
    powerStage: { kind: "text", values: ["integrated_fet"], requiredForAdmission: true },
    bridgeOutputArchitecture: {
      kind: "text",
      values: ["single_full_bridge", "dual_full_bridge_parallel_capable"],
      requiredForAdmission: true,
    },
    highSideDriveArchitecture: {
      kind: "text",
      values: ["n_channel_charge_pump", "p_channel_direct"],
      requiredForAdmission: true,
    },
    continuousHighSideOnSupported: { kind: "boolean", requiredForAdmission: false },
    supplyVoltageOperatingMinimum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    supplyVoltageOperatingMaximum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    supplyVoltageAbsoluteMaximum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    logicHighThresholdMaximum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    continuousOutputCurrent: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    continuousOutputCurrentRole: {
      kind: "text",
      values: ["guaranteed_operating_limit", "typical_observation", "board_specific_observation", "absolute_rating", "protection_threshold"],
      requiredForAdmission: false,
    },
    peakOutputCurrent: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    peakOutputCurrentRole: {
      kind: "text",
      values: ["guaranteed_operating_limit", "typical_observation", "board_specific_observation", "absolute_rating", "protection_threshold"],
      requiredForAdmission: false,
    },
    currentRegulationInterface: {
      kind: "text",
      values: ["none", "external_reference_and_sense", "integrated_current_mirror_output", "protection_only"],
      requiredForAdmission: true,
    },
    pwmMaximum: { kind: "quantity", unit: "Hz", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    pwmMaximumRole: {
      kind: "text",
      values: ["guaranteed_bound", "typical_observation"],
      requiredForAdmission: false,
    },
    minimumInputPulseWidth: { kind: "quantity", unit: "s", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    minimumInputPulseWidthRole: {
      kind: "text",
      values: ["guaranteed_bound", "typical_observation"],
      requiredForAdmission: false,
    },
    pathResistance: { kind: "quantity", unit: "ohm", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    pathResistanceRole: {
      kind: "text",
      values: ["guaranteed_maximum", "typical_observation"],
      requiredForAdmission: true,
    },
    switchingTransitionTime: { kind: "quantity", unit: "s", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    switchingTransitionTimeRole: {
      kind: "text",
      values: ["guaranteed_maximum", "typical_observation"],
      requiredForAdmission: false,
    },
    activeSupplyCurrent: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    activeSupplyCurrentRole: {
      kind: "text",
      values: ["guaranteed_maximum", "typical_observation"],
      requiredForAdmission: false,
    },
    junctionToAmbientThermalResistance: { kind: "quantity", unit: "K/W", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    maximumJunctionTemperature: { kind: "quantity", unit: "K", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    localSupplyDecouplingCapacitance: { kind: "quantity", unit: "F", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    localSupplyDecouplingRequirement: {
      kind: "text",
      values: ["required_minimum", "recommended_value", "typical_observation", "application_dependent", "not_specified"],
      requiredForAdmission: true,
    },
    bulkCapacitance: { kind: "quantity", unit: "F", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    bulkCapacitanceRequirement: {
      kind: "text",
      values: ["required_minimum", "recommended_value", "typical_observation", "application_dependent", "not_specified"],
      requiredForAdmission: true,
    },
  },
} as const satisfies PartClassSpec;

export const V32_PART_CLASS_SPECS = deepFreeze({
  "motor.integrated-h-bridge": INTEGRATED_H_BRIDGE_V32_SPEC,
} as const satisfies Readonly<Record<V32PartClassId, PartClassSpec>>);

type FactValue<Spec extends FactSpec> = Spec extends { kind: "quantity"; unit: infer Unit extends ProfileUnit }
  ? ProfileQuantity<Unit>
  : Spec extends { kind: "boolean" }
    ? boolean
    : Spec extends { kind: "text"; values: readonly (infer Value extends string)[] }
      ? Value
      : string;

export type FactsV32AgainstSpec<Spec extends PartClassSpec> = {
  -readonly [Key in keyof Spec["facts"]]: ProfileFact<FactValue<Extract<Spec["facts"][Key], FactSpec>>>;
};

export type CoreFactsV32For<ClassId extends V32PartClassId> = FactsV32AgainstSpec<typeof V32_PART_CLASS_SPECS[ClassId]>;
