import type {
  AngularVelocity,
  BackEmfConstant,
  Current,
  Frequency,
  Inductance,
  Resistance,
  Ratio,
  Temperature,
  Time,
  Voltage,
} from "./quantity";

export type DesignApplication = "motor.brushed-dc" | "power.buck";
export type DesignObjective =
  | "area"
  | "availability"
  | "balanced"
  | "bom_cost"
  | "efficiency"
  | "lead_time"
  | "temperature";

export type V1TopologyFamily =
  | "motor.hbridge.external-nmos"
  | "motor.hbridge.integrated"
  | "power.buck.controller-external-nmos"
  | "power.buck.integrated-synchronous";

export interface MotorModelRequirements {
  windingResistance: Resistance;
  windingResistanceSource: "estimated_from_nominal_voltage_and_stall_current" | "provided";
  windingInductance: Inductance | null;
  backEmfConstant: BackEmfConstant | null;
  targetSpeed: AngularVelocity | null;
}

export interface MotorOperatingPoint {
  dutyCycle: Ratio;
  loadCurrent: Current;
  loadCurrentBasis: "continuous_rating" | "user_provided";
  loadProfile: "steady_state";
}

export interface BrushedDcMotorRequirements {
  supplyVoltage: {
    minimum: Voltage;
    nominal: Voltage;
    maximum: Voltage;
  };
  motorNominalVoltage: Voltage;
  continuousCurrent: Current;
  stallCurrent: Current;
  pwmFrequency: Frequency;
  logicVoltage: Voltage;
  ambientTemperature: Temperature;
  operatingModes: Array<"brake" | "coast" | "forward" | "reverse">;
  currentLimitTarget: Current | null;
  operatingPoint: MotorOperatingPoint;
  motorModel: MotorModelRequirements;
}

export interface BuckLoadTransientTarget {
  currentStep: Current;
  maximumOutputDeviation: Voltage;
  maximumSettlingTime: Time;
}

/**
 * Optional absolute DC output-voltage envelope for regulation proofs. Older
 * requests may omit it; omission means that no DC regulation pass can be
 * claimed from a calculated divider point alone.
 */
export interface BuckDcOutputVoltageRegulationEnvelope {
  minimum: Voltage;
  maximum: Voltage;
}

export interface BuckRequirements {
  inputVoltage: {
    minimum: Voltage;
    nominal: Voltage;
    maximum: Voltage;
  };
  outputVoltage: Voltage;
  dcOutputVoltageRegulation?: BuckDcOutputVoltageRegulationEnvelope;
  maximumOutputCurrent: Current;
  ambientTemperature: Temperature;
  switchingFrequency: {
    selection: "automatic" | "fixed";
    minimum: Frequency;
    preferred: Frequency | null;
    maximum: Frequency;
  };
  maximumOutputRipple: Voltage;
  loadTransientTarget: BuckLoadTransientTarget | null;
}

export interface DesignAssumption {
  id: string;
  description: string;
  source: "derived" | "fixture" | "unavailable" | "user";
  affects: string[];
}
