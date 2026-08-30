import type {
  AngularVelocity,
  BackEmfConstant,
  BrushedDcMotorDesignRequest,
  EvidenceValue,
  Inductance,
  Resistance,
  Voltage,
} from "@opencircuit/design-schema";
import { AUTHORED_MOTOR_RULE_EVIDENCE, combinedEvidence, requestEvidence } from "./evidence";

export interface BehavioralMotorLoad {
  modelId: "motor.brushed-dc.r-l-back-emf.v1";
  windingResistance: EvidenceValue<Resistance>;
  windingInductance: EvidenceValue<Inductance>;
  backEmfConstant: EvidenceValue<BackEmfConstant>;
  targetSpeed: EvidenceValue<AngularVelocity>;
  targetBackEmf: EvidenceValue<Voltage>;
  operatingPointBackEmf: EvidenceValue<Voltage>;
  dynamicInputsComplete: boolean;
  scenarioEligibility: {
    pwmLoadedSteadyState: boolean;
    startup: boolean;
    stallOrCurrentLimit: boolean;
    fastDecayBrake: boolean;
  };
}

function unavailable<T>(field: string): EvidenceValue<T> {
  return {
    value: null,
    state: "unknown",
    evidence: [],
    explanation: `${field} is absent from the request and is not invented by the Motor Designer`,
  };
}

export function deriveBehavioralMotorLoad(
  request: Readonly<BrushedDcMotorDesignRequest>,
): BehavioralMotorLoad {
  const motor = request.requirements.motorModel;
  const resistanceEstimated = motor.windingResistanceSource === "estimated_from_nominal_voltage_and_stall_current";
  const windingInductance: EvidenceValue<Inductance> = motor.windingInductance === null
    ? unavailable("Winding inductance")
    : {
      value: motor.windingInductance,
      state: "calculated",
      evidence: requestEvidence("requirements.motorModel.windingInductance"),
      explanation: "Winding inductance is supplied by the request",
    };
  const backEmfConstant: EvidenceValue<BackEmfConstant> = motor.backEmfConstant === null
    ? unavailable("Back-EMF constant")
    : {
      value: motor.backEmfConstant,
      state: "calculated",
      evidence: requestEvidence("requirements.motorModel.backEmfConstant"),
      explanation: "Back-EMF constant is supplied by the request",
    };
  const targetSpeed: EvidenceValue<AngularVelocity> = motor.targetSpeed === null
    ? unavailable("Target speed")
    : {
      value: motor.targetSpeed,
      state: "calculated",
      evidence: requestEvidence("requirements.motorModel.targetSpeed"),
      explanation: "Target angular speed is supplied by the request",
    };
  const targetBackEmf: EvidenceValue<Voltage> = motor.backEmfConstant === null || motor.targetSpeed === null
    ? unavailable("Back-EMF at target speed")
    : {
      value: {
        value: motor.backEmfConstant.value * motor.targetSpeed.value,
        unit: "V",
        displayUnit: "V",
      },
      state: "calculated",
      evidence: combinedEvidence(
        requestEvidence("requirements.motorModel.backEmfConstant"),
        requestEvidence("requirements.motorModel.targetSpeed"),
        [AUTHORED_MOTOR_RULE_EVIDENCE],
      ),
      explanation: "Calculated by motor.model.target-back-emf.v1 (Ke × angular speed)",
    };
  const dynamicComplete = windingInductance.value !== null
    && backEmfConstant.value !== null
    && targetSpeed.value !== null;
  const averageBridgeVoltageV = request.requirements.supplyVoltage.nominal.value
    * request.requirements.operatingPoint.dutyCycle.value;
  const closureBackEmfV = averageBridgeVoltageV
    - request.requirements.operatingPoint.loadCurrent.value * motor.windingResistance.value;
  const operatingPointBackEmf: EvidenceValue<Voltage> = targetBackEmf.value === null
    ? {
      value: { value: closureBackEmfV, unit: "V", displayUnit: "V" },
      state: "estimated",
      evidence: combinedEvidence(
        requestEvidence("requirements.supplyVoltage.nominal"),
        requestEvidence("requirements.operatingPoint"),
        requestEvidence("requirements.motorModel.windingResistance"),
        [AUTHORED_MOTOR_RULE_EVIDENCE],
      ),
      explanation: "Algebraic steady-state closure Vbridge(avg) − Iload × Rwinding; this is not evidence for a physical motor constant",
    }
    : {
      ...targetBackEmf,
      explanation: "Uses the request-derived Ke × target speed back-EMF",
    };
  return {
    modelId: "motor.brushed-dc.r-l-back-emf.v1",
    windingResistance: {
      value: motor.windingResistance,
      state: resistanceEstimated ? "estimated" : "calculated",
      evidence: requestEvidence("requirements.motorModel.windingResistance"),
      explanation: resistanceEstimated
        ? "Estimated as nominal motor voltage divided by stall current, as declared by the request"
        : "Winding resistance is supplied by the request",
    },
    windingInductance,
    backEmfConstant,
    targetSpeed,
    targetBackEmf,
    operatingPointBackEmf,
    dynamicInputsComplete: dynamicComplete,
    scenarioEligibility: {
      pwmLoadedSteadyState: operatingPointBackEmf.value !== null && operatingPointBackEmf.value.value >= 0,
      startup: false,
      stallOrCurrentLimit: false,
      fastDecayBrake: false,
    },
  };
}
