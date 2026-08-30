import type {
  CircuitGraphV2,
  SimulationScenarioV2,
} from "@opencircuit/circuit-schema";
import {
  canonicalDesignV2Number,
  compareDesignV2Tokens,
  type BrushedDcMotorDesignRequestV2,
  type CircuitBomNonRepresentationV2,
  type CircuitInstanceClassificationV2,
  type SelectedComponent,
  type SimulationCoverageV2,
} from "@opencircuit/design-schema";

export const MOTOR_BEHAVIORAL_OPERATING_POINT_SCENARIO_ID = "pwm_loaded_steady_state" as const;
export const MOTOR_SELECTED_PART_MODEL_COVERAGE_ID = "selected_part_model" as const;

export interface MotorOperatingPointCompanionV2 {
  readonly graph: CircuitGraphV2;
  readonly scenario: SimulationScenarioV2;
  readonly coverage: SimulationCoverageV2;
  readonly circuitInstanceClassifications: CircuitInstanceClassificationV2[];
  readonly circuitBomNonRepresentations: CircuitBomNonRepresentationV2[];
}

function canonical(value: number): number {
  return canonicalDesignV2Number(value);
}

/**
 * Build a request-derived algebraic operating-point companion. This graph is
 * deliberately BOM-disjoint: it contains no selected-part instance, MPN, or
 * executable manufacturer model and must never be used for ranking.
 */
export function buildMotorOperatingPointCompanionV2(
  request: Readonly<BrushedDcMotorDesignRequestV2>,
  selectedComponents: readonly SelectedComponent[],
): MotorOperatingPointCompanionV2 {
  const nominalSupplyV = canonical(request.requirements.supplyVoltage.nominal.value);
  const dutyCycle = canonical(request.requirements.operatingPoint.dutyCycle.value);
  const loadCurrentA = canonical(request.requirements.operatingPoint.loadCurrent.value);
  const windingResistanceOhm = canonical(request.requirements.motorModel.windingResistance.value);
  const averageBridgeVoltageV = canonical(nominalSupplyV * dutyCycle);
  const windingDropV = canonical(loadCurrentA * windingResistanceOhm);
  const operatingPointBackEmfV = canonical(averageBridgeVoltageV - windingDropV);
  const nonBomReason = "Request-derived behavioral primitive; it does not represent any selected BOM line or manufacturer-part model.";
  const graph: CircuitGraphV2 = {
    id: "behavioral-operating-point",
    title: "Request-derived averaged PWM loaded operating point",
    components: [
      {
        id: "ground",
        type: "ground",
        pos: [8, 18],
        rot: 0,
        mirror: false,
        annotations: { behavioralRole: "reference-node", evidenceBoundary: "request_derived_no_selected_part_model" },
      },
      {
        id: "r-motor-winding",
        type: "resistor",
        value: windingResistanceOhm,
        pos: [20, 10],
        rot: 0,
        mirror: false,
        annotations: {
          behavioralRole: "request-winding-resistance",
          evidenceBoundary: "request_derived_no_selected_part_model",
          requestSource: "requirements.motorModel.windingResistance",
        },
      },
      {
        id: "v-bridge-average",
        type: "vsource",
        value: averageBridgeVoltageV,
        pos: [8, 12],
        rot: 0,
        mirror: false,
        annotations: {
          behavioralRole: "averaged-pwm-source",
          equationId: "motor.behavioral.average-bridge-voltage.v1",
          evidenceBoundary: "request_derived_no_selected_part_model",
          nominalSupplyV,
          dutyCycle,
        },
      },
      {
        id: "v-motor-back-emf",
        type: "vsource",
        value: operatingPointBackEmfV,
        pos: [32, 12],
        rot: 0,
        mirror: false,
        annotations: {
          behavioralRole: "algebraic-operating-point-back-emf",
          equationId: "motor.behavioral.operating-point-closure.v1",
          evidenceBoundary: "request_derived_no_selected_part_model",
          declaredLoadCurrentA: loadCurrentA,
          limitation: "Algebraic closure is not evidence for a physical motor constant or predicted operating point.",
        },
      },
    ],
    wires: [
      { id: "back-emf-return", points: [[32, 14], [32, 18], [8, 18]] },
      { id: "bridge-to-winding", points: [[8, 10], [18, 10]] },
      { id: "source-return", points: [[8, 14], [8, 18]] },
      { id: "winding-to-back-emf", points: [[22, 10], [32, 10]] },
    ],
    probes: [
      { id: "probe-average-bridge-voltage", kind: "voltage", target: { componentPin: ["v-bridge-average", 0] } },
      { id: "probe-motor-current", kind: "current", target: { componentPin: ["r-motor-winding", 0] } },
      { id: "probe-operating-back-emf", kind: "voltage", target: { componentPin: ["v-motor-back-emf", 0] } },
    ],
  };
  const scenario: SimulationScenarioV2 = {
    id: MOTOR_BEHAVIORAL_OPERATING_POINT_SCENARIO_ID,
    title: "Averaged PWM loaded steady state",
    circuitId: graph.id,
    config: { mode: "op" },
  };
  const coverage: SimulationCoverageV2 = {
    scenarioId: scenario.id,
    modelTier: "behavioral",
    limitations: [
      "Averaged DC operating-point closure only; PWM edges, dead time, switching loss, protection, thermal behavior, parasitics, speed, torque, and transients are not modeled.",
      "The back-EMF source is algebraically closed from nominal supply, duty cycle, declared load current, and request winding resistance; it is not evidence for a motor constant or a predicted operating point.",
      "The graph is request-derived and contains no selected manufacturer-part model; selected BOM identity does not imply simulation fidelity.",
      ...(request.requirements.motorModel.windingResistanceSource === "estimated_from_nominal_voltage_and_stall_current"
        ? ["Winding resistance is the request-declared nominal-voltage/stall-current estimate, not a reviewed motor measurement."]
        : []),
    ].sort(compareDesignV2Tokens),
  };
  const circuitInstanceClassifications: CircuitInstanceClassificationV2[] = graph.components
    .map((component) => ({
      circuitId: graph.id,
      componentId: component.id,
      kind: "non_bom" as const,
      reason: nonBomReason,
    }))
    .sort((left, right) => compareDesignV2Tokens(left.componentId, right.componentId));
  const circuitBomNonRepresentations: CircuitBomNonRepresentationV2[] = selectedComponents
    .map((component) => ({
      circuitId: graph.id,
      selectedComponentId: component.id,
      reason: "The exact selected BOM line is represented only in the structural assembly; this request-derived graph has no selected-part model.",
    }))
    .sort((left, right) => compareDesignV2Tokens(left.selectedComponentId, right.selectedComponentId));
  return {
    graph,
    scenario,
    coverage,
    circuitInstanceClassifications,
    circuitBomNonRepresentations,
  };
}

export function motorSelectedPartModelUnavailableCoverageV2(
  limitation: string,
): SimulationCoverageV2 {
  return {
    scenarioId: MOTOR_SELECTED_PART_MODEL_COVERAGE_ID,
    modelTier: "unavailable",
    limitations: [limitation],
  };
}
