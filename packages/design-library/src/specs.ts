import type { ProfileFact, ProfileQuantity, ProfileUnit } from "./types";
import { deepFreeze } from "./canonical";

export type FactSpec =
  | { kind: "quantity"; unit: ProfileUnit; requiredForAdmission: boolean; requiredRangeParameters?: readonly string[]; domain: NumericDomain }
  | { kind: "text"; values?: readonly string[]; requiredForAdmission: boolean; requiredRangeParameters?: readonly string[] }
  | { kind: "boolean"; requiredForAdmission: boolean; requiredRangeParameters?: readonly string[] };

export interface NumericDomain {
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
}

export interface OperatingRangeSpec {
  unit: ProfileUnit;
  domain: NumericDomain;
}

export interface PartClassSpec {
  facts: Readonly<Record<string, FactSpec>>;
  operatingRanges: Readonly<Record<string, OperatingRangeSpec>>;
}

const POSITIVE = { exclusiveMinimum: 0 } as const;
const NON_NEGATIVE = { minimum: 0 } as const;
const RATIO = { minimum: 0, maximum: 1 } as const;
const SIGNED = {} as const;

function Q<Unit extends ProfileUnit>(unit: Unit, requiredForAdmission = true, requiredRangeParameters?: readonly string[], domain: NumericDomain = POSITIVE): { kind: "quantity"; unit: Unit; requiredForAdmission: boolean; requiredRangeParameters?: readonly string[]; domain: NumericDomain } {
  return { kind: "quantity", unit, requiredForAdmission, domain, ...(requiredRangeParameters === undefined ? {} : { requiredRangeParameters }) };
}

function QR(requiredForAdmission = true, requiredRangeParameters?: readonly string[]) {
  return Q("1", requiredForAdmission, requiredRangeParameters, RATIO);
}

function QS(unit: "1/K", requiredForAdmission = true) {
  return Q(unit, requiredForAdmission, undefined, SIGNED);
}

function R<Unit extends ProfileUnit>(unit: Unit, domain: NumericDomain = NON_NEGATIVE): { unit: Unit; domain: NumericDomain } {
  return { unit, domain };
}

function T<const Values extends readonly string[]>(values: Values, requiredForAdmission?: boolean): { kind: "text"; values: Values; requiredForAdmission: boolean };
function T(values?: undefined, requiredForAdmission?: boolean): { kind: "text"; requiredForAdmission: boolean };
function T(values?: readonly string[], requiredForAdmission = true): FactSpec {
  return { kind: "text", ...(values === undefined ? {} : { values }), requiredForAdmission };
}

function B(requiredForAdmission = true): { kind: "boolean"; requiredForAdmission: boolean } {
  return { kind: "boolean", requiredForAdmission };
}

const semiconductorRanges = {
  ambientTemperature: R("K"),
  junctionTemperature: R("K"),
  supplyVoltage: R("V"),
  testCurrent: R("A"),
  testVoltage: R("V"),
  switchingFrequency: R("Hz"),
  pulseDuration: R("s"),
  dutyCycle: R("1", RATIO),
  boardCopperArea: R("m2"),
} as const;

const passiveRanges = {
  ambientTemperature: R("K"),
  testCurrent: R("A"),
  testVoltage: R("V"),
  switchingFrequency: R("Hz"),
  pulseDuration: R("s"),
  dutyCycle: R("1", RATIO),
} as const;

const PART_CLASS_SPEC_DEFINITIONS = {
  "motor.integrated-h-bridge": {
    operatingRanges: semiconductorRanges,
    facts: {
      bridgeTopology: T(["full_bridge"]), powerStage: T(["integrated_fet"]),
      supplyMinimum: Q("V"), supplyMaximum: Q("V"), absoluteMaximum: Q("V"),
      continuousCurrent: Q("A"), peakCurrent: Q("A"), currentLimitMinimum: Q("A"), currentLimitMaximum: Q("A"),
      logicHighThresholdMaximum: Q("V"), pwmMaximum: Q("Hz"), minimumPulseWidth: Q("s"),
      pathResistance: Q("ohm"), switchingTransitionTime: Q("s"), quiescentCurrent: Q("A"),
      junctionToAmbientThermalResistance: Q("K/W"), maximumJunctionTemperature: Q("K"),
      highSideSupply: T(["charge_pump", "bootstrap_with_charge_pump", "bootstrap_with_top_off_charge_pump"]),
      maximumHighSideDutyCycle: QR(), localDecouplingMinimum: Q("F"), bulkCapacitanceMinimum: Q("F"),
    },
  },
  "motor.full-bridge-gate-driver": {
    operatingRanges: semiconductorRanges,
    facts: {
      bridgeTopology: T(["full_bridge"]), powerStage: T(["external_n_channel_mosfet"]),
      supplyMinimum: Q("V"), supplyMaximum: Q("V"), absoluteMaximum: Q("V"),
      driverBiasMinimum: Q("V"), driverBiasMaximum: Q("V"), logicHighThresholdMaximum: Q("V"),
      pwmMaximum: Q("Hz"), minimumPulseWidth: Q("s"), sourceCurrent: Q("A"), sinkCurrent: Q("A"), gateVoltage: Q("V"), deadTime: Q("s"),
      highSideSupply: T(["bootstrap", "charge_pump", "bootstrap_with_charge_pump", "bootstrap_with_top_off_charge_pump"]),
      bootstrapMaximumDutyCycle: QR(), bootstrapAllowedRipple: Q("V"), bootstrapOverheadCharge: Q("C"),
      quiescentCurrent: Q("A"), junctionToAmbientThermalResistance: Q("K/W"), maximumJunctionTemperature: Q("K"),
      senseMaximumVoltage: Q("V"), localDecouplingMinimum: Q("F"),
    },
  },
  "power.integrated-synchronous-buck-regulator": {
    operatingRanges: semiconductorRanges,
    facts: {
      inputVoltageMinimum: Q("V"), inputVoltageMaximum: Q("V"), outputVoltageMinimum: Q("V"), outputVoltageMaximum: Q("V"),
      outputCurrentMaximum: Q("A"), currentLimit: Q("A"), switchingFrequencyMinimum: Q("Hz"), switchingFrequencyRecommended: Q("Hz"), switchingFrequencyMaximum: Q("Hz"),
      minimumOnTime: Q("s"), minimumOffTime: Q("s"), feedbackReference: Q("V"), quiescentCurrent: Q("A"),
      junctionToAmbientThermalResistance: Q("K/W"), maximumJunctionTemperature: Q("K"), controlEvidenceBasis: T(undefined, false),
      highSideOnResistance: Q("ohm"), lowSideOnResistance: Q("ohm"), riseTime: Q("s", false), fallTime: Q("s", false),
    },
  },
  "power.external-fet-synchronous-buck-controller": {
    operatingRanges: semiconductorRanges,
    facts: {
      inputVoltageMinimum: Q("V"), inputVoltageMaximum: Q("V"), outputVoltageMinimum: Q("V"), outputVoltageMaximum: Q("V"),
      currentSenseThresholdMinimum: Q("V", false), currentSenseThresholdTypical: Q("V", false), currentSenseThresholdMaximum: Q("V", false), switchingFrequencyMinimum: Q("Hz"), switchingFrequencyRecommended: Q("Hz"), switchingFrequencyMaximum: Q("Hz"),
      minimumOnTime: Q("s"), minimumOffTime: Q("s"), feedbackReference: Q("V"), quiescentCurrent: Q("A"),
      junctionToAmbientThermalResistance: Q("K/W"), maximumJunctionTemperature: Q("K"), controlEvidenceBasis: T(undefined, false),
      gateDriveVoltage: Q("V"), gateSourceCurrent: Q("A", false), gateSinkCurrent: Q("A", false), gatePullupResistance: Q("ohm", false), gatePulldownResistance: Q("ohm", false), deadTime: Q("s", true, undefined, NON_NEGATIVE), controllerLoss: Q("W", false),
    },
  },
  "shared.n-channel-power-mosfet": {
    operatingRanges: { ...semiconductorRanges, gateVoltage: R("V"), drainCurrent: R("A") },
    facts: {
      drainSourceVoltage: Q("V"), continuousDrainCurrent: Q("A", true, ["ambientTemperature"]), pulsedDrainCurrent: Q("A", true, ["pulseDuration", "dutyCycle"]),
      onResistance: Q("ohm", true, ["gateVoltage", "junctionTemperature", "drainCurrent"]), totalGateCharge: Q("C", true, ["gateVoltage", "testVoltage", "testCurrent"]),
      riseTime: Q("s", false, ["gateVoltage", "testVoltage", "testCurrent"]), fallTime: Q("s", false, ["gateVoltage", "testVoltage", "testCurrent"]), reverseRecoveryCharge: Q("C", false, ["testVoltage", "testCurrent"]),
      maximumJunctionTemperature: Q("K"), junctionToAmbientThermalResistance: Q("K/W"),
      thermalBoardAssumption: T(), packageBodyArea: Q("m2"),
    },
  },
  "shared.current-sense-resistor": {
    operatingRanges: passiveRanges,
    facts: {
      resistance: Q("ohm", true, ["ambientTemperature"]), tolerance: QR(), temperatureCoefficient: QS("1/K"), continuousPower: Q("W", true, ["ambientTemperature"]),
      pulsePower: Q("W", true, ["pulseDuration"]), pulseDuration: Q("s"), thermalLimit: Q("K"), kelvinTerminals: B(),
    },
  },
  "shared.general-purpose-resistor": {
    operatingRanges: passiveRanges,
    facts: {
      resistance: Q("ohm"), tolerance: QR(), temperatureCoefficient: QS("1/K"), continuousPower: Q("W"),
      pulsePower: Q("W", false), workingVoltage: Q("V"),
    },
  },
  "shared.switching-diode": {
    operatingRanges: passiveRanges,
    facts: {
      reverseVoltage: Q("V"), continuousForwardCurrent: Q("A"), forwardVoltage: Q("V"), reverseRecoveryTime: Q("s", false), reverseRecoveryCharge: Q("C", false),
    },
  },
  "shared.mlcc-capacitor": {
    operatingRanges: { ...passiveRanges, dcBias: R("V") },
    facts: {
      nominalCapacitance: Q("F"), effectiveCapacitance: Q("F", false, ["dcBias", "ambientTemperature"]), ratedVoltage: Q("V"),
      temperatureCharacteristic: T(), biasDeratingRatio: QR(false, ["dcBias", "ambientTemperature"]), equivalentSeriesResistance: Q("ohm", false, ["switchingFrequency"]), rippleCurrent: Q("A", false, ["switchingFrequency", "ambientTemperature"]),
    },
  },
  "shared.bulk-capacitor": {
    operatingRanges: { ...passiveRanges, dcBias: R("V") },
    facts: {
      nominalCapacitance: Q("F"), effectiveCapacitance: Q("F", false, ["dcBias", "ambientTemperature"]), biasDeratingRatio: QR(false, ["dcBias", "ambientTemperature"]), ratedVoltage: Q("V"), equivalentSeriesResistance: Q("ohm", true, ["switchingFrequency"]),
      rippleCurrent: Q("A", true, ["switchingFrequency", "ambientTemperature"]), lifetime: Q("s", true, ["ambientTemperature"]), ratedTemperature: Q("K"), transientEnergyAssumption: Q("J", false, ["pulseDuration"]),
    },
  },
  "motor.supply-tvs-diode": {
    operatingRanges: passiveRanges,
    facts: {
      standOffVoltage: Q("V"), breakdownVoltageMinimum: Q("V"), breakdownVoltageMaximum: Q("V"), clampingVoltage: Q("V", true, ["testCurrent", "pulseDuration"]),
      pulseCurrent: Q("A", true, ["pulseDuration"]), pulseWaveform: T(), pulseEnergy: Q("J", true, ["pulseDuration"]),
    },
  },
  "power.power-inductor": {
    operatingRanges: passiveRanges,
    facts: {
      inductance: Q("H", true, ["testCurrent", "switchingFrequency"]), saturationCurrent: Q("A", true, ["ambientTemperature"]), rmsCurrent: Q("A", true, ["ambientTemperature"]), dcResistance: Q("ohm", true, ["ambientTemperature"]),
      coreLoss: Q("W", false, ["switchingFrequency", "testCurrent"]), coreLossTestFrequency: Q("Hz", false), maximumOperatingTemperature: Q("K"),
    },
  },
} as const satisfies Readonly<Record<string, PartClassSpec>>;

export const PART_CLASS_SPECS = deepFreeze(PART_CLASS_SPEC_DEFINITIONS);

type FactValue<Spec extends FactSpec> = Spec extends { kind: "quantity"; unit: infer Unit extends ProfileUnit }
  ? ProfileQuantity<Unit>
  : Spec extends { kind: "boolean" }
    ? boolean
    : Spec extends { kind: "text"; values: readonly (infer Value extends string)[] }
      ? Value
      : string;

export type FactsFor<ClassId extends keyof typeof PART_CLASS_SPECS> = {
  [Key in keyof typeof PART_CLASS_SPECS[ClassId]["facts"]]: ProfileFact<FactValue<Extract<typeof PART_CLASS_SPECS[ClassId]["facts"][Key], FactSpec>>>;
};
