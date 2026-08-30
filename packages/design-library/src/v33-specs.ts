import { deepFreeze } from "./canonical";
import { PART_CLASS_SPECS, type FactSpec, type PartClassSpec } from "./specs";
import type { ProfileFact, ProfileQuantity, ProfileUnit } from "./types";

export const V33_PART_CLASS_IDS = deepFreeze([
  "power.integrated-synchronous-buck-regulator",
] as const);

export type V33PartClassId = typeof V33_PART_CLASS_IDS[number];

const INTEGRATED_SYNCHRONOUS_BUCK_V33_SPEC = {
  operatingRanges: PART_CLASS_SPECS["power.integrated-synchronous-buck-regulator"].operatingRanges,
  facts: {
    converterTopology: {
      kind: "text",
      values: ["synchronous_buck"],
      requiredForAdmission: true,
    },
    powerStage: {
      kind: "text",
      values: ["integrated_fet"],
      requiredForAdmission: true,
    },
    compensationArchitecture: {
      kind: "text",
      values: ["internal", "external", "application_dependent"],
      requiredForAdmission: true,
    },
    inputVoltageOperatingMinimum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    inputVoltageOperatingMaximum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    inputVoltageAbsoluteMaximum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    outputVoltageOperatingMinimum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    outputVoltageOperatingMaximum: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    outputCurrent: { kind: "quantity", unit: "A", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    outputCurrentRole: {
      kind: "text",
      values: [
        "guaranteed_operating_limit",
        "continuous_capability_statement",
        "typical_observation",
        "board_specific_observation",
        "absolute_rating",
        "protection_threshold",
      ],
      requiredForAdmission: true,
    },
    switchingFrequencyArchitecture: {
      kind: "text",
      values: ["fixed_oscillator", "resistor_programmed", "externally_synchronized", "fixed_or_synchronized"],
      requiredForAdmission: true,
    },
    switchingFrequencyMinimum: { kind: "quantity", unit: "Hz", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    switchingFrequencyNominal: { kind: "quantity", unit: "Hz", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    switchingFrequencyMaximum: { kind: "quantity", unit: "Hz", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    switchingFrequencyRole: {
      kind: "text",
      values: ["production_spread", "guaranteed_adjustment_range", "recommended_setting", "typical_observation"],
      requiredForAdmission: true,
    },
    feedbackReferenceMinimum: { kind: "quantity", unit: "V", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    feedbackReferenceTypical: { kind: "quantity", unit: "V", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    feedbackReferenceMaximum: { kind: "quantity", unit: "V", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    feedbackReferenceRole: {
      kind: "text",
      values: ["production_spread", "typical_observation"],
      requiredForAdmission: true,
    },
    currentLimitMinimum: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    currentLimitTypical: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    currentLimitMaximum: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    currentLimitRole: {
      kind: "text",
      values: ["protection_threshold", "guaranteed_operating_limit", "typical_observation"],
      requiredForAdmission: false,
    },
    minimumOnTime: { kind: "quantity", unit: "s", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    minimumOnTimeRole: {
      kind: "text",
      values: ["guaranteed_bound", "typical_observation"],
      requiredForAdmission: false,
    },
    minimumOffTime: { kind: "quantity", unit: "s", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    minimumOffTimeRole: {
      kind: "text",
      values: ["guaranteed_bound", "typical_observation"],
      requiredForAdmission: false,
    },
    highSideOnResistance: { kind: "quantity", unit: "ohm", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    highSideOnResistanceRole: {
      kind: "text",
      values: ["guaranteed_maximum", "typical_observation"],
      requiredForAdmission: false,
    },
    lowSideOnResistance: { kind: "quantity", unit: "ohm", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    lowSideOnResistanceRole: {
      kind: "text",
      values: ["guaranteed_maximum", "typical_observation"],
      requiredForAdmission: false,
    },
    nonSwitchingSupplyCurrent: { kind: "quantity", unit: "A", requiredForAdmission: false, domain: { minimum: 0 } },
    nonSwitchingSupplyCurrentRole: {
      kind: "text",
      values: ["guaranteed_maximum", "typical_observation"],
      requiredForAdmission: false,
    },
    junctionToAmbientThermalResistance: { kind: "quantity", unit: "K/W", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    junctionToAmbientThermalResistanceRole: {
      kind: "text",
      values: ["guaranteed_maximum", "test_characteristic", "board_specific_observation", "typical_observation"],
      requiredForAdmission: false,
    },
    maximumJunctionTemperature: { kind: "quantity", unit: "K", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } },
    bootstrapCapacitance: { kind: "quantity", unit: "F", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    bootstrapCapacitanceRequirement: {
      kind: "text",
      values: ["required_nominal_value", "recommended_value", "typical_observation", "application_dependent", "not_specified"],
      requiredForAdmission: true,
    },
  },
} as const satisfies PartClassSpec;

export const V33_PART_CLASS_SPECS = deepFreeze({
  "power.integrated-synchronous-buck-regulator": INTEGRATED_SYNCHRONOUS_BUCK_V33_SPEC,
} as const satisfies Readonly<Record<V33PartClassId, PartClassSpec>>);

type FactValue<Spec extends FactSpec> = Spec extends { kind: "quantity"; unit: infer Unit extends ProfileUnit }
  ? ProfileQuantity<Unit>
  : Spec extends { kind: "boolean" }
    ? boolean
    : Spec extends { kind: "text"; values: readonly (infer Value extends string)[] }
      ? Value
      : string;

export type FactsV33AgainstSpec<Spec extends PartClassSpec> = {
  -readonly [Key in keyof Spec["facts"]]: ProfileFact<FactValue<Extract<Spec["facts"][Key], FactSpec>>>;
};

export type CoreFactsV33For<ClassId extends V33PartClassId> = FactsV33AgainstSpec<typeof V33_PART_CLASS_SPECS[ClassId]>;
