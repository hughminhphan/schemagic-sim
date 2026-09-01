import type { EvidenceRef } from "@opencircuit/design-schema";
import type { ManufacturerPartIdentity } from "@opencircuit/sourcing-schema";

export type BuckTopology = "integrated" | "external-controller";
export type SyntheticProfileKind = "synthetic_test_fixture";
export type ControlEvidence = "missing" | "synthetic_bounded_model";

export interface SyntheticProfileBase {
  profileId: string;
  profileKind: SyntheticProfileKind;
  displayName: string;
  part: ManufacturerPartIdentity;
  evidence: EvidenceRef[];
  areaM2: number;
}

export interface BuckPrimaryProfile extends SyntheticProfileBase {
  topology: BuckTopology;
  inputVoltageMinV: number;
  inputVoltageMaxV: number;
  outputVoltageMinV: number;
  outputVoltageMaxV: number;
  outputCurrentMaxA: number;
  currentLimitA: number;
  switchingFrequencyMinHz: number;
  switchingFrequencyRecommendedHz: number;
  switchingFrequencyMaxHz: number;
  minimumOnTimeS: number;
  minimumOffTimeS: number;
  feedbackReferenceV: number;
  quiescentCurrentA: number;
  thermalResistanceKPerW: number;
  maximumJunctionTemperatureK: number;
  controlEvidence: ControlEvidence;
}

export interface IntegratedRegulatorProfile extends BuckPrimaryProfile {
  topology: "integrated";
  highSideResistanceOhm: number;
  lowSideResistanceOhm: number;
  riseTimeS: number;
  fallTimeS: number;
}

export interface ExternalControllerProfile extends BuckPrimaryProfile {
  topology: "external-controller";
  gateDriveVoltageV: number;
  gateSourceCurrentA: number;
  gateSinkCurrentA: number;
  controllerLossW: number;
}

export interface PowerMosfetProfile extends SyntheticProfileBase {
  drainSourceVoltageV: number;
  continuousCurrentA: number;
  resistanceOhm: number;
  resistanceGateVoltageV: number;
  totalGateChargeC: number;
  riseTimeS: number;
  fallTimeS: number;
  thermalResistanceKPerW: number;
  maximumJunctionTemperatureK: number;
}

export interface InductorProfile extends SyntheticProfileBase {
  inductanceH: number;
  saturationCurrentA: number;
  rmsCurrentA: number;
  dcResistanceOhm: number;
  coreLossWAtFixturePoint: number | null;
}

export interface CapacitorProfile extends SyntheticProfileBase {
  role: "input" | "output";
  nominalCapacitanceF: number;
  effectiveCapacitanceF: number | null;
  estimatedBiasDeratingRatio: number | null;
  voltageRatingV: number;
  esrOhm: number;
  rippleCurrentA: number;
}

export interface ResistorProfile extends SyntheticProfileBase {
  resistanceOhm: number;
  toleranceRatio: number;
  voltageRatingV: number;
  powerRatingW: number;
}

export interface SyntheticBuckCatalog {
  catalogKind: SyntheticProfileKind;
  version: string;
  integratedRegulators: readonly IntegratedRegulatorProfile[];
  externalControllers: readonly ExternalControllerProfile[];
  mosfets: readonly PowerMosfetProfile[];
  inductors: readonly InductorProfile[];
  capacitors: readonly CapacitorProfile[];
  resistors: readonly ResistorProfile[];
}
