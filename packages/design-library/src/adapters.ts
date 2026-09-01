import type { EvidenceRef } from "@opencircuit/design-schema";
import type { ManufacturerPartIdentity } from "@opencircuit/sourcing-schema";
import { PART_CLASS_SPECS } from "./specs";
import type { DesignProfileFor } from "./validation";
import {
  DESIGN_PROFILE_FORMAT,
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION,
  type PartClassId,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantity,
  type ProfileUnit,
} from "./types";

export interface StagedAdapterResult<ClassId extends PartClassId> {
  profile: DesignProfileFor<ClassId>;
  admissionState: "authored";
  sourceKind: "synthetic_test_fixture";
}

interface StagedBase {
  part: ManufacturerPartIdentity;
  evidence: readonly EvidenceRef[];
}

interface MotorStagedBase extends StagedBase {
  id: string;
  packageName: string;
  boardAreaM2: number;
  state: "synthetic_test_fixture";
}

interface PowerStagedBase extends StagedBase {
  profileId: string;
  profileKind: "synthetic_test_fixture";
  displayName: string;
  areaM2: number;
}

export interface MotorIntegratedBridgeStagedProfile extends MotorStagedBase {
  kind: "integrated_bridge";
  supplyMinimumV: number; supplyMaximumV: number; absoluteMaximumV: number;
  continuousCurrentA: number; peakCurrentA: number; currentLimitMinimumA: number; currentLimitMaximumA: number;
  logicHighMaximumV: number; pwmMaximumHz: number; minimumPulseWidthS: number; pathResistanceOhm: number;
  switchingTransitionTimeS: number; quiescentCurrentA: number; thetaJaKPerW: number; maximumJunctionTemperatureK: number;
  highSideSupply: "charge_pump"; maximumHighSideDutyCycle: number; localDecouplingMinimumF: number; bulkCapacitanceMinimumF: number;
}

export interface MotorGateDriverStagedProfile extends MotorStagedBase {
  kind: "gate_driver";
  supplyMinimumV: number; supplyMaximumV: number; absoluteMaximumV: number; logicHighMaximumV: number | null;
  pwmMaximumHz: number; minimumPulseWidthS: number; sourceCurrentA: number; sinkCurrentA: number; gateVoltageV: number;
  deadTimeS: number; bootstrapMaximumDutyCycle: number; bootstrapAllowedRippleV: number | null; bootstrapOverheadChargeC: number;
  quiescentCurrentA: number; thetaJaKPerW: number; maximumJunctionTemperatureK: number; senseMaximumVoltageV: number; localDecouplingMinimumF: number;
}

export interface MotorMosfetStagedProfile extends MotorStagedBase {
  kind: "mosfet";
  drainSourceMaximumV: number; continuousCurrentA: number; pulsedCurrentA: number; rdsOnOhm: number;
  rdsOnGateVoltageV: number; totalGateChargeC: number; thetaJaKPerW: number; maximumJunctionTemperatureK: number;
  rdsOnTestCurrentA?: number | null;
}

export interface MotorResistorStagedProfile extends MotorStagedBase {
  kind: "resistor";
  role: "gate" | "gate_pulldown";
  resistanceOhm: number;
  ratedPowerW: number;
}

export interface MotorShuntStagedProfile extends MotorStagedBase {
  kind: "shunt";
  resistanceOhm: number;
  continuousPowerW: number;
  pulsePowerW: number;
}

export interface MotorCapacitorStagedProfile extends MotorStagedBase {
  kind: "capacitor";
  role: "bootstrap" | "bulk" | "decoupling";
  nominalCapacitanceF: number;
  effectiveCapacitanceF: number;
  ratedVoltageV: number;
}

interface PowerPrimaryStagedProfile extends PowerStagedBase {
  inputVoltageMinV: number; inputVoltageMaxV: number; outputVoltageMinV: number; outputVoltageMaxV: number;
  switchingFrequencyMinHz: number; switchingFrequencyRecommendedHz: number; switchingFrequencyMaxHz: number;
  minimumOnTimeS: number; minimumOffTimeS: number; feedbackReferenceV: number; quiescentCurrentA: number;
  thermalResistanceKPerW: number; maximumJunctionTemperatureK: number; controlEvidence: "missing" | "synthetic_bounded_model";
}

export interface PowerIntegratedRegulatorStagedProfile extends PowerPrimaryStagedProfile {
  topology: "integrated";
  outputCurrentMaxA: number; currentLimitA: number;
  highSideResistanceOhm: number; lowSideResistanceOhm: number; riseTimeS: number; fallTimeS: number;
}

export interface PowerExternalControllerStagedProfile extends PowerPrimaryStagedProfile {
  topology: "external-controller";
  gateDriveVoltageV: number; gateSourceCurrentA: number; gateSinkCurrentA: number; controllerLossW: number;
  currentSenseThresholdMinV?: number | null; currentSenseThresholdTypicalV?: number | null; currentSenseThresholdMaxV?: number | null;
  gatePullupResistanceOhm?: number | null; gatePulldownResistanceOhm?: number | null;
}

export interface PowerMosfetStagedProfile extends PowerStagedBase {
  drainSourceVoltageV: number; continuousCurrentA: number; resistanceOhm: number; resistanceGateVoltageV: number;
  totalGateChargeC: number; riseTimeS: number; fallTimeS: number; thermalResistanceKPerW: number; maximumJunctionTemperatureK: number;
  resistanceTestCurrentA?: number | null;
}

export interface PowerInductorStagedProfile extends PowerStagedBase {
  inductanceH: number; saturationCurrentA: number; rmsCurrentA: number; dcResistanceOhm: number; coreLossWAtFixturePoint: number | null;
  inductanceTestCurrentA?: number | null; inductanceTestFrequencyHz?: number | null; dcResistanceTemperatureK?: number | null; currentRatingTemperatureK?: number | null;
}

export interface PowerResistorStagedProfile extends PowerStagedBase {
  resistanceOhm: number; toleranceRatio: number; voltageRatingV: number; powerRatingW: number;
}

export interface PowerCapacitorStagedProfile extends PowerStagedBase {
  role: "input" | "output";
  nominalCapacitanceF: number; effectiveCapacitanceF: number | null; estimatedBiasDeratingRatio: number | null;
  voltageRatingV: number; esrOhm: number; rippleCurrentA: number;
}

type CapacitorClass = "shared.mlcc-capacitor" | "shared.bulk-capacitor";
type AdapterValue = boolean | string | ProfileQuantity;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function quantity<Unit extends ProfileUnit>(value: number, unit: Unit): ProfileQuantity<Unit> {
  return { value, unit, displayUnit: unit };
}

function stagedEvidence(source: readonly EvidenceRef[]): ProfileEvidenceRef[] {
  if (source.length === 0) throw new Error("Staged profile evidence must not be empty");
  return source.map((entry) => {
    if (entry.retrievedAt !== undefined && (!RFC3339.test(entry.retrievedAt) || !Number.isFinite(Date.parse(entry.retrievedAt)))) throw new Error(`Invalid staged retrievedAt for ${entry.sourceId}`);
    if (entry.contentHash !== undefined && !/^sha256:[0-9a-f]{64}$/.test(entry.contentHash)) throw new Error(`Invalid staged contentHash for ${entry.sourceId}`);
    return {
    sourceId: entry.sourceId,
    locator: entry.locator,
    retrievedAt: entry.retrievedAt && RFC3339.test(entry.retrievedAt) && Number.isFinite(Date.parse(entry.retrievedAt)) ? entry.retrievedAt : null,
    contentHash: typeof entry.contentHash === "string" && /^sha256:[0-9a-f]{64}$/.test(entry.contentHash)
      ? entry.contentHash as `sha256:${string}`
      : null,
    licenseNote: entry.licenseNote,
    kind: "synthetic_fixture",
    url: null,
    revision: null,
    publicationBasis: null,
    };
  });
}

function estimated<Value>(value: Value, evidence: readonly ProfileEvidenceRef[]): ProfileFact<Value> {
  return { value, state: "estimated", evidence: [...evidence], validFor: [], explanation: "Mechanical conversion from an application-local synthetic fixture; not independently reviewed." };
}

function unknown<Value>(explanation: string): ProfileFact<Value> {
  return { value: null, state: "unknown", evidence: [], validFor: [], explanation };
}

function preserveExactCondition(
  fact: ProfileFact<unknown>,
  parameterId: string,
  value: ProfileQuantity,
): void {
  fact.validFor.push({ parameterId, minimum: value, maximum: value, evidence: [...fact.evidence] });
}

function adapterProfile<ClassId extends PartClassId>(
  partClass: ClassId,
  base: StagedBase,
  packageName: string | null,
  boardAreaM2: number,
  mapped: Readonly<Record<string, AdapterValue | null>>,
): StagedAdapterResult<ClassId> {
  const evidence = stagedEvidence(base.evidence);
  const facts: Record<string, ProfileFact<unknown>> = {};
  for (const factId of Object.keys(PART_CLASS_SPECS[partClass].facts)) {
    const value = mapped[factId];
    facts[factId] = value === undefined || value === null ? unknown("The staged source does not contain this required normalized fact.") : estimated(value, evidence);
  }
  for (const key of Object.keys(mapped)) if (!(key in PART_CLASS_SPECS[partClass].facts)) throw new Error(`Adapter mapped unknown ${partClass} fact ${key}`);
  const profile = {
    format: DESIGN_PROFILE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    partClass,
    part: { ...base.part },
    factsSchemaVersion: FACTS_SCHEMA_VERSION,
    commonFacts: {
      packageName: packageName === null ? unknown("The staged source does not declare a package name.") : estimated(packageName, evidence),
      boardArea: estimated(quantity(boardAreaM2, "m2"), evidence),
      maximumHeight: unknown("The staged source does not declare maximum mounted height."),
    },
    facts,
  } as unknown as DesignProfileFor<ClassId>;
  return { profile, admissionState: "authored", sourceKind: "synthetic_test_fixture" };
}

export function adaptMotorIntegratedBridge(input: MotorIntegratedBridgeStagedProfile): StagedAdapterResult<"motor.integrated-h-bridge"> {
  return adapterProfile("motor.integrated-h-bridge", input, input.packageName, input.boardAreaM2, {
    bridgeTopology: "full_bridge", powerStage: "integrated_fet", supplyMinimum: quantity(input.supplyMinimumV, "V"), supplyMaximum: quantity(input.supplyMaximumV, "V"), absoluteMaximum: quantity(input.absoluteMaximumV, "V"),
    continuousCurrent: quantity(input.continuousCurrentA, "A"), peakCurrent: quantity(input.peakCurrentA, "A"), currentLimitMinimum: quantity(input.currentLimitMinimumA, "A"), currentLimitMaximum: quantity(input.currentLimitMaximumA, "A"),
    logicHighThresholdMaximum: quantity(input.logicHighMaximumV, "V"), pwmMaximum: quantity(input.pwmMaximumHz, "Hz"), minimumPulseWidth: quantity(input.minimumPulseWidthS, "s"), pathResistance: quantity(input.pathResistanceOhm, "ohm"),
    switchingTransitionTime: quantity(input.switchingTransitionTimeS, "s"), quiescentCurrent: quantity(input.quiescentCurrentA, "A"), junctionToAmbientThermalResistance: quantity(input.thetaJaKPerW, "K/W"), maximumJunctionTemperature: quantity(input.maximumJunctionTemperatureK, "K"),
    highSideSupply: input.highSideSupply, maximumHighSideDutyCycle: quantity(input.maximumHighSideDutyCycle, "1"), localDecouplingMinimum: quantity(input.localDecouplingMinimumF, "F"), bulkCapacitanceMinimum: quantity(input.bulkCapacitanceMinimumF, "F"),
  });
}

export function adaptMotorGateDriver(input: MotorGateDriverStagedProfile): StagedAdapterResult<"motor.full-bridge-gate-driver"> {
  return adapterProfile("motor.full-bridge-gate-driver", input, input.packageName, input.boardAreaM2, {
    bridgeTopology: "full_bridge", powerStage: "external_n_channel_mosfet", supplyMinimum: quantity(input.supplyMinimumV, "V"), supplyMaximum: quantity(input.supplyMaximumV, "V"), absoluteMaximum: quantity(input.absoluteMaximumV, "V"),
    driverBiasMinimum: null, driverBiasMaximum: null, logicHighThresholdMaximum: input.logicHighMaximumV === null ? null : quantity(input.logicHighMaximumV, "V"),
    pwmMaximum: quantity(input.pwmMaximumHz, "Hz"), minimumPulseWidth: quantity(input.minimumPulseWidthS, "s"), sourceCurrent: quantity(input.sourceCurrentA, "A"), sinkCurrent: quantity(input.sinkCurrentA, "A"), gateVoltage: quantity(input.gateVoltageV, "V"), deadTime: quantity(input.deadTimeS, "s"),
    highSideSupply: "bootstrap", bootstrapMaximumDutyCycle: quantity(input.bootstrapMaximumDutyCycle, "1"), bootstrapAllowedRipple: input.bootstrapAllowedRippleV === null ? null : quantity(input.bootstrapAllowedRippleV, "V"), bootstrapOverheadCharge: quantity(input.bootstrapOverheadChargeC, "C"),
    quiescentCurrent: quantity(input.quiescentCurrentA, "A"), junctionToAmbientThermalResistance: quantity(input.thetaJaKPerW, "K/W"), maximumJunctionTemperature: quantity(input.maximumJunctionTemperatureK, "K"), senseMaximumVoltage: quantity(input.senseMaximumVoltageV, "V"), localDecouplingMinimum: quantity(input.localDecouplingMinimumF, "F"),
  });
}

export function adaptMotorMosfet(input: MotorMosfetStagedProfile): StagedAdapterResult<"shared.n-channel-power-mosfet"> {
  const result = adapterProfile("shared.n-channel-power-mosfet", input, input.packageName, input.boardAreaM2, {
    drainSourceVoltage: quantity(input.drainSourceMaximumV, "V"), continuousDrainCurrent: quantity(input.continuousCurrentA, "A"), pulsedDrainCurrent: quantity(input.pulsedCurrentA, "A"),
    onResistance: quantity(input.rdsOnOhm, "ohm"), totalGateCharge: quantity(input.totalGateChargeC, "C"), maximumJunctionTemperature: quantity(input.maximumJunctionTemperatureK, "K"),
    junctionToAmbientThermalResistance: quantity(input.thetaJaKPerW, "K/W"),
  });
  preserveExactCondition(result.profile.facts.onResistance, "gateVoltage", quantity(input.rdsOnGateVoltageV, "V"));
  if (input.rdsOnTestCurrentA !== undefined && input.rdsOnTestCurrentA !== null) preserveExactCondition(result.profile.facts.onResistance, "drainCurrent", quantity(input.rdsOnTestCurrentA, "A"));
  return result;
}

export function adaptMotorResistor(input: MotorResistorStagedProfile): StagedAdapterResult<"shared.general-purpose-resistor"> {
  return adapterProfile("shared.general-purpose-resistor", input, input.packageName, input.boardAreaM2, {
    resistance: quantity(input.resistanceOhm, "ohm"), continuousPower: quantity(input.ratedPowerW, "W"),
  });
}

export function adaptMotorShunt(input: MotorShuntStagedProfile): StagedAdapterResult<"shared.current-sense-resistor"> {
  return adapterProfile("shared.current-sense-resistor", input, input.packageName, input.boardAreaM2, {
    resistance: quantity(input.resistanceOhm, "ohm"), continuousPower: quantity(input.continuousPowerW, "W"), pulsePower: quantity(input.pulsePowerW, "W"),
  });
}

export function adaptMotorCapacitor(input: MotorCapacitorStagedProfile, partClass?: CapacitorClass): StagedAdapterResult<CapacitorClass> {
  if (partClass === undefined) throw new Error("Ambiguous staged capacitor requires an explicit shared.mlcc-capacitor or shared.bulk-capacitor physical class");
  return adapterProfile(partClass, input, input.packageName, input.boardAreaM2, partClass === "shared.mlcc-capacitor" ? {
    nominalCapacitance: quantity(input.nominalCapacitanceF, "F"), effectiveCapacitance: quantity(input.effectiveCapacitanceF, "F"), ratedVoltage: quantity(input.ratedVoltageV, "V"), temperatureCharacteristic: null,
  } : {
    nominalCapacitance: quantity(input.nominalCapacitanceF, "F"), effectiveCapacitance: quantity(input.effectiveCapacitanceF, "F"), ratedVoltage: quantity(input.ratedVoltageV, "V"),
  });
}

function powerPrimaryFacts(input: PowerPrimaryStagedProfile): Record<string, AdapterValue | null> {
  return {
    inputVoltageMinimum: quantity(input.inputVoltageMinV, "V"), inputVoltageMaximum: quantity(input.inputVoltageMaxV, "V"), outputVoltageMinimum: quantity(input.outputVoltageMinV, "V"), outputVoltageMaximum: quantity(input.outputVoltageMaxV, "V"),
    switchingFrequencyMinimum: quantity(input.switchingFrequencyMinHz, "Hz"), switchingFrequencyRecommended: quantity(input.switchingFrequencyRecommendedHz, "Hz"), switchingFrequencyMaximum: quantity(input.switchingFrequencyMaxHz, "Hz"),
    minimumOnTime: quantity(input.minimumOnTimeS, "s"), minimumOffTime: quantity(input.minimumOffTimeS, "s"), feedbackReference: quantity(input.feedbackReferenceV, "V"), quiescentCurrent: quantity(input.quiescentCurrentA, "A"),
    junctionToAmbientThermalResistance: quantity(input.thermalResistanceKPerW, "K/W"), maximumJunctionTemperature: quantity(input.maximumJunctionTemperatureK, "K"), controlEvidenceBasis: input.controlEvidence === "missing" ? null : "synthetic_bounded_model",
  };
}

export function adaptPowerIntegratedRegulator(input: PowerIntegratedRegulatorStagedProfile): StagedAdapterResult<"power.integrated-synchronous-buck-regulator"> {
  return adapterProfile("power.integrated-synchronous-buck-regulator", input, null, input.areaM2, {
    ...powerPrimaryFacts(input), outputCurrentMaximum: quantity(input.outputCurrentMaxA, "A"), currentLimit: quantity(input.currentLimitA, "A"), highSideOnResistance: quantity(input.highSideResistanceOhm, "ohm"), lowSideOnResistance: quantity(input.lowSideResistanceOhm, "ohm"), riseTime: quantity(input.riseTimeS, "s"), fallTime: quantity(input.fallTimeS, "s"),
  });
}

export function adaptPowerExternalController(input: PowerExternalControllerStagedProfile): StagedAdapterResult<"power.external-fet-synchronous-buck-controller"> {
  return adapterProfile("power.external-fet-synchronous-buck-controller", input, null, input.areaM2, {
    ...powerPrimaryFacts(input),
    currentSenseThresholdMinimum: input.currentSenseThresholdMinV == null ? null : quantity(input.currentSenseThresholdMinV, "V"),
    currentSenseThresholdTypical: input.currentSenseThresholdTypicalV == null ? null : quantity(input.currentSenseThresholdTypicalV, "V"),
    currentSenseThresholdMaximum: input.currentSenseThresholdMaxV == null ? null : quantity(input.currentSenseThresholdMaxV, "V"),
    gateDriveVoltage: quantity(input.gateDriveVoltageV, "V"), gateSourceCurrent: quantity(input.gateSourceCurrentA, "A"), gateSinkCurrent: quantity(input.gateSinkCurrentA, "A"),
    gatePullupResistance: input.gatePullupResistanceOhm == null ? null : quantity(input.gatePullupResistanceOhm, "ohm"),
    gatePulldownResistance: input.gatePulldownResistanceOhm == null ? null : quantity(input.gatePulldownResistanceOhm, "ohm"),
    controllerLoss: quantity(input.controllerLossW, "W"),
  });
}

export function adaptPowerMosfet(input: PowerMosfetStagedProfile): StagedAdapterResult<"shared.n-channel-power-mosfet"> {
  const result = adapterProfile("shared.n-channel-power-mosfet", input, null, input.areaM2, {
    drainSourceVoltage: quantity(input.drainSourceVoltageV, "V"), continuousDrainCurrent: quantity(input.continuousCurrentA, "A"), onResistance: quantity(input.resistanceOhm, "ohm"), totalGateCharge: quantity(input.totalGateChargeC, "C"),
    riseTime: quantity(input.riseTimeS, "s"), fallTime: quantity(input.fallTimeS, "s"), maximumJunctionTemperature: quantity(input.maximumJunctionTemperatureK, "K"), junctionToAmbientThermalResistance: quantity(input.thermalResistanceKPerW, "K/W"),
  });
  preserveExactCondition(result.profile.facts.onResistance, "gateVoltage", quantity(input.resistanceGateVoltageV, "V"));
  if (input.resistanceTestCurrentA !== undefined && input.resistanceTestCurrentA !== null) preserveExactCondition(result.profile.facts.onResistance, "drainCurrent", quantity(input.resistanceTestCurrentA, "A"));
  return result;
}

export function adaptPowerInductor(input: PowerInductorStagedProfile): StagedAdapterResult<"power.power-inductor"> {
  const result = adapterProfile("power.power-inductor", input, null, input.areaM2, {
    inductance: quantity(input.inductanceH, "H"), saturationCurrent: quantity(input.saturationCurrentA, "A"), rmsCurrent: quantity(input.rmsCurrentA, "A"), dcResistance: quantity(input.dcResistanceOhm, "ohm"),
    coreLoss: input.coreLossWAtFixturePoint === null ? null : quantity(input.coreLossWAtFixturePoint, "W"),
  });
  if (input.inductanceTestCurrentA != null) preserveExactCondition(result.profile.facts.inductance, "testCurrent", quantity(input.inductanceTestCurrentA, "A"));
  if (input.inductanceTestFrequencyHz != null) preserveExactCondition(result.profile.facts.inductance, "switchingFrequency", quantity(input.inductanceTestFrequencyHz, "Hz"));
  if (input.dcResistanceTemperatureK != null) preserveExactCondition(result.profile.facts.dcResistance, "ambientTemperature", quantity(input.dcResistanceTemperatureK, "K"));
  if (input.currentRatingTemperatureK != null) {
    preserveExactCondition(result.profile.facts.saturationCurrent, "ambientTemperature", quantity(input.currentRatingTemperatureK, "K"));
    preserveExactCondition(result.profile.facts.rmsCurrent, "ambientTemperature", quantity(input.currentRatingTemperatureK, "K"));
  }
  return result;
}

export function adaptPowerResistor(input: PowerResistorStagedProfile): StagedAdapterResult<"shared.general-purpose-resistor"> {
  return adapterProfile("shared.general-purpose-resistor", input, null, input.areaM2, {
    resistance: quantity(input.resistanceOhm, "ohm"), tolerance: quantity(input.toleranceRatio, "1"), continuousPower: quantity(input.powerRatingW, "W"), workingVoltage: quantity(input.voltageRatingV, "V"),
  });
}

export function adaptPowerCapacitor(input: PowerCapacitorStagedProfile, partClass?: CapacitorClass): StagedAdapterResult<CapacitorClass> {
  if (partClass === undefined) throw new Error("Ambiguous staged capacitor requires an explicit shared.mlcc-capacitor or shared.bulk-capacitor physical class");
  const common = {
    nominalCapacitance: quantity(input.nominalCapacitanceF, "F"), effectiveCapacitance: input.effectiveCapacitanceF === null ? null : quantity(input.effectiveCapacitanceF, "F"),
    biasDeratingRatio: input.estimatedBiasDeratingRatio === null ? null : quantity(input.estimatedBiasDeratingRatio, "1"), ratedVoltage: quantity(input.voltageRatingV, "V"), equivalentSeriesResistance: quantity(input.esrOhm, "ohm"), rippleCurrent: quantity(input.rippleCurrentA, "A"),
  };
  return adapterProfile(partClass, input, null, input.areaM2, partClass === "shared.mlcc-capacitor" ? { ...common, temperatureCharacteristic: null } : common);
}
