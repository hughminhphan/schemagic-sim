import type {
  BrushedDcMotorDesignRequest,
  CandidateMetric,
  ConstraintResult,
  EvidenceRef,
  Quantity,
  SIUnit,
} from "@opencircuit/design-schema";
import { AUTHORED_MOTOR_RULE_EVIDENCE, combinedEvidence, requestEvidence } from "./evidence";
import type { GateDriverProfile, IntegratedBridgeProfile, MosfetProfile, ShuntProfile } from "./profile";

export const MOTOR_RULE_TOLERANCE = 1e-12;

export const MOTOR_EQUATION_IDS = {
  outputPower: "motor.operating-point.output-power.v1",
  integratedConductionLoss: "motor.integrated.conduction-loss.v1",
  integratedSwitchingLoss: "motor.integrated.switching-loss.v1",
  driverQuiescentLoss: "motor.driver.quiescent-loss.v1",
  externalConductionLoss: "motor.external.fet-conduction-loss.v1",
  externalSwitchingLoss: "motor.external.fet-switching-loss.v1",
  externalGateDriveLoss: "motor.external.gate-drive-loss.v1",
  shuntLoss: "motor.current-sense.shunt-loss.v1",
  bootstrapCapacitance: "motor.external.bootstrap-capacitance.v1",
  junctionTemperature: "motor.thermal.junction-rise.v1",
  bulkCapacitance: "motor.supply.bulk-capacitance.v1",
  efficiency: "motor.operating-point.efficiency.v1",
} as const;

export function quantity<Unit extends SIUnit>(value: number, unit: Unit, displayUnit: string): Quantity<Unit> {
  return { value, unit, displayUnit };
}

function constraint(
  ruleId: string,
  status: ConstraintResult["status"],
  explanation: string,
  evidence: EvidenceRef[],
  values: Pick<ConstraintResult, "actual" | "limit" | "margin"> = {},
): ConstraintResult {
  return { ruleId, status, explanation, evidence, ...values };
}

export function maximumConstraint<Unit extends SIUnit>(input: {
  ruleId: string;
  actual: number;
  limit: number;
  unit: Unit;
  displayUnit: string;
  explanation: string;
  evidence: EvidenceRef[];
}): ConstraintResult {
  const margin = input.limit - input.actual;
  return constraint(
    input.ruleId,
    margin >= -MOTOR_RULE_TOLERANCE ? "pass" : "fail",
    input.explanation,
    input.evidence,
    {
      actual: quantity(input.actual, input.unit, input.displayUnit),
      limit: quantity(input.limit, input.unit, input.displayUnit),
      margin: quantity(margin, input.unit, input.displayUnit),
    },
  );
}

export function minimumConstraint<Unit extends SIUnit>(input: {
  ruleId: string;
  actual: number;
  limit: number;
  unit: Unit;
  displayUnit: string;
  explanation: string;
  evidence: EvidenceRef[];
}): ConstraintResult {
  const margin = input.actual - input.limit;
  return constraint(
    input.ruleId,
    margin >= -MOTOR_RULE_TOLERANCE ? "pass" : "fail",
    input.explanation,
    input.evidence,
    {
      actual: quantity(input.actual, input.unit, input.displayUnit),
      limit: quantity(input.limit, input.unit, input.displayUnit),
      margin: quantity(margin, input.unit, input.displayUnit),
    },
  );
}

export function authoredConstraint(
  ruleId: string,
  status: ConstraintResult["status"],
  explanation: string,
  evidence: EvidenceRef[] = [AUTHORED_MOTOR_RULE_EVIDENCE],
): ConstraintResult {
  return constraint(ruleId, status, explanation, evidence);
}

export interface MotorLosses {
  outputPowerW: number;
  conductionW: number;
  switchingW: number;
  driverW: number;
  gateDriveW: number;
  shuntW: number;
  passiveW: number;
  totalW: number;
  efficiency: number;
  hottestJunctionK: number;
  driverJunctionK: number;
  fetJunctionK: number | null;
}

function operatingPoint(request: Readonly<BrushedDcMotorDesignRequest>) {
  return {
    voltageV: request.requirements.supplyVoltage.nominal.value,
    currentA: request.requirements.operatingPoint.loadCurrent.value,
    dutyCycle: request.requirements.operatingPoint.dutyCycle.value,
    frequencyHz: request.requirements.pwmFrequency.value,
    ambientK: request.requirements.ambientTemperature.value,
  };
}

export function integratedLosses(
  request: Readonly<BrushedDcMotorDesignRequest>,
  profile: Readonly<IntegratedBridgeProfile>,
): MotorLosses {
  const point = operatingPoint(request);
  const outputPowerW = point.voltageV * point.dutyCycle * point.currentA;
  const conductionW = point.currentA ** 2 * profile.pathResistanceOhm;
  const switchingW = point.voltageV * point.currentA * profile.switchingTransitionTimeS * point.frequencyHz * 2;
  const driverW = point.voltageV * profile.quiescentCurrentA;
  const gateDriveW = 0;
  const shuntW = 0;
  const passiveW = 0;
  const totalW = conductionW + switchingW + driverW + gateDriveW + shuntW + passiveW;
  const driverJunctionK = point.ambientK + totalW * profile.thetaJaKPerW;
  return {
    outputPowerW,
    conductionW,
    switchingW,
    driverW,
    gateDriveW,
    shuntW,
    passiveW,
    totalW,
    efficiency: outputPowerW / (outputPowerW + totalW),
    hottestJunctionK: driverJunctionK,
    driverJunctionK,
    fetJunctionK: null,
  };
}

export function gateTransitionTimeS(driver: Readonly<GateDriverProfile>, mosfet: Readonly<MosfetProfile>): number {
  return mosfet.totalGateChargeC / driver.sourceCurrentA + mosfet.totalGateChargeC / driver.sinkCurrentA;
}

export function requiredBootstrapCapacitanceF(
  driver: Readonly<GateDriverProfile>,
  mosfet: Readonly<MosfetProfile>,
): number | null {
  if (driver.bootstrapAllowedRippleV === null) return null;
  return (mosfet.totalGateChargeC + driver.bootstrapOverheadChargeC) / driver.bootstrapAllowedRippleV;
}

export function requiredBulkCapacitanceF(stallCurrentA: number): number {
  const boundedTransientS = 100e-6;
  const allowedDroopV = 2;
  return stallCurrentA * boundedTransientS / allowedDroopV;
}

export function externalLosses(
  request: Readonly<BrushedDcMotorDesignRequest>,
  driver: Readonly<GateDriverProfile>,
  mosfet: Readonly<MosfetProfile>,
  shunt: Readonly<ShuntProfile>,
): MotorLosses {
  const point = operatingPoint(request);
  const outputPowerW = point.voltageV * point.dutyCycle * point.currentA;
  const transitionTimeS = gateTransitionTimeS(driver, mosfet);
  const conductionW = 2 * point.currentA ** 2 * mosfet.rdsOnOhm;
  const switchingW = point.voltageV * point.currentA * transitionTimeS * point.frequencyHz;
  const gateDriveW = 4 * mosfet.totalGateChargeC * driver.gateVoltageV * point.frequencyHz;
  const driverW = point.voltageV * driver.quiescentCurrentA;
  const shuntW = point.currentA ** 2 * shunt.resistanceOhm;
  const passiveW = 0;
  const totalW = conductionW + switchingW + driverW + gateDriveW + shuntW + passiveW;
  const hottestFetPowerW = point.currentA ** 2 * mosfet.rdsOnOhm + switchingW / 2 + gateDriveW / 4;
  const fetJunctionK = point.ambientK + hottestFetPowerW * mosfet.thetaJaKPerW;
  const driverJunctionK = point.ambientK + driverW * driver.thetaJaKPerW;
  return {
    outputPowerW,
    conductionW,
    switchingW,
    driverW,
    gateDriveW,
    shuntW,
    passiveW,
    totalW,
    efficiency: outputPowerW / (outputPowerW + totalW),
    hottestJunctionK: Math.max(fetJunctionK, driverJunctionK),
    driverJunctionK,
    fetJunctionK,
  };
}

export function lossMetrics(
  losses: MotorLosses,
  evidence: EvidenceRef[],
  topology: "external" | "integrated",
): CandidateMetric[] {
  const calculatedEvidence = combinedEvidence([AUTHORED_MOTOR_RULE_EVIDENCE], evidence, requestEvidence("requirements.operatingPoint"));
  const powerMetric = (id: string, value: number, equationId: string): CandidateMetric => ({
    id,
    value: quantity(value, "W", "W"),
    state: "calculated",
    explanation: `Calculated by ${equationId}`,
    evidence: calculatedEvidence,
  });
  return [
    powerMetric(
      "motor.loss.conduction",
      losses.conductionW,
      topology === "integrated" ? MOTOR_EQUATION_IDS.integratedConductionLoss : MOTOR_EQUATION_IDS.externalConductionLoss,
    ),
    powerMetric(
      "motor.loss.switching",
      losses.switchingW,
      topology === "integrated" ? MOTOR_EQUATION_IDS.integratedSwitchingLoss : MOTOR_EQUATION_IDS.externalSwitchingLoss,
    ),
    powerMetric("motor.loss.driver", losses.driverW, MOTOR_EQUATION_IDS.driverQuiescentLoss),
    powerMetric("motor.loss.gate-drive", losses.gateDriveW, MOTOR_EQUATION_IDS.externalGateDriveLoss),
    powerMetric("motor.loss.shunt", losses.shuntW, MOTOR_EQUATION_IDS.shuntLoss),
    powerMetric("motor.loss.passive", losses.passiveW, "motor.passive.loss-bound.v1"),
    powerMetric("motor.loss.total", losses.totalW, "motor.loss.sum.v1"),
    {
      id: "motor.efficiency",
      value: quantity(losses.efficiency, "1", "%"),
      state: "calculated",
      explanation: `Calculated at the declared operating point by ${MOTOR_EQUATION_IDS.efficiency}`,
      evidence: calculatedEvidence,
    },
    {
      id: "motor.temperature.hottest-junction",
      value: quantity(losses.hottestJunctionK, "K", "°C"),
      state: "estimated",
      explanation: `Estimated with the synthetic fixture theta-JA value and ${MOTOR_EQUATION_IDS.junctionTemperature}`,
      evidence: calculatedEvidence,
    },
    {
      id: "motor.model.dynamic-evidence",
      value: null,
      state: "unknown",
      explanation: "M1/M2 omit winding inductance and back-EMF data, so dynamic simulation evidence remains unavailable",
      evidence: [],
    },
  ];
}
