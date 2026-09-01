import type { EvidenceRef } from "@opencircuit/design-schema";
import type { ManufacturerPartIdentity } from "@opencircuit/sourcing-schema";

export type SyntheticProfileState = "synthetic_test_fixture";

interface ProfileBase {
  id: string;
  part: ManufacturerPartIdentity;
  packageName: string;
  boardAreaM2: number;
  state: SyntheticProfileState;
  evidence: EvidenceRef[];
}

export interface IntegratedBridgeProfile extends ProfileBase {
  kind: "integrated_bridge";
  supplyMinimumV: number;
  supplyMaximumV: number;
  absoluteMaximumV: number;
  continuousCurrentA: number;
  peakCurrentA: number;
  currentLimitMinimumA: number;
  currentLimitMaximumA: number;
  logicHighMaximumV: number;
  pwmMaximumHz: number;
  minimumPulseWidthS: number;
  pathResistanceOhm: number;
  switchingTransitionTimeS: number;
  quiescentCurrentA: number;
  thetaJaKPerW: number;
  maximumJunctionTemperatureK: number;
  highSideSupply: "charge_pump";
  maximumHighSideDutyCycle: number;
  localDecouplingMinimumF: number;
  bulkCapacitanceMinimumF: number;
}

export interface GateDriverProfile extends ProfileBase {
  kind: "gate_driver";
  supplyMinimumV: number;
  supplyMaximumV: number;
  absoluteMaximumV: number;
  logicHighMaximumV: number | null;
  pwmMaximumHz: number;
  minimumPulseWidthS: number;
  sourceCurrentA: number;
  sinkCurrentA: number;
  gateVoltageV: number;
  deadTimeS: number;
  bootstrapMaximumDutyCycle: number;
  bootstrapAllowedRippleV: number | null;
  bootstrapOverheadChargeC: number;
  quiescentCurrentA: number;
  thetaJaKPerW: number;
  maximumJunctionTemperatureK: number;
  senseMaximumVoltageV: number;
  localDecouplingMinimumF: number;
}

export interface MosfetProfile extends ProfileBase {
  kind: "mosfet";
  drainSourceMaximumV: number;
  continuousCurrentA: number;
  pulsedCurrentA: number;
  rdsOnOhm: number;
  rdsOnGateVoltageV: number;
  totalGateChargeC: number;
  thetaJaKPerW: number;
  maximumJunctionTemperatureK: number;
}

export interface CapacitorProfile extends ProfileBase {
  kind: "capacitor";
  role: "bootstrap" | "bulk" | "decoupling";
  nominalCapacitanceF: number;
  effectiveCapacitanceF: number;
  ratedVoltageV: number;
}

export interface ResistorProfile extends ProfileBase {
  kind: "resistor";
  role: "gate" | "gate_pulldown";
  resistanceOhm: number;
  ratedPowerW: number;
}

export interface ShuntProfile extends ProfileBase {
  kind: "shunt";
  resistanceOhm: number;
  continuousPowerW: number;
  pulsePowerW: number;
}

export type MotorComponentProfile =
  | CapacitorProfile
  | GateDriverProfile
  | IntegratedBridgeProfile
  | MosfetProfile
  | ResistorProfile
  | ShuntProfile;

export interface MotorFixtureCatalog {
  version: string;
  integratedBridges: readonly IntegratedBridgeProfile[];
  gateDrivers: readonly GateDriverProfile[];
  mosfets: readonly MosfetProfile[];
  capacitors: readonly CapacitorProfile[];
  resistors: readonly ResistorProfile[];
  shunts: readonly ShuntProfile[];
}
