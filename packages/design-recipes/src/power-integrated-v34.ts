import {
  canonicalDesignV2Number,
  canonicalDesignV2Payload,
  compareDesignV2Tokens,
  designSha256ContentHash,
} from "@opencircuit/design-schema";
import type { CircuitComponentV2, CircuitGraphV2 } from "@opencircuit/circuit-schema";
import { POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33 } from "./power-integrated-v33";
import type { NativeCandidateV2, NativeEnvironmentV2, NativeRecipeV2 } from "./types";

const RELEASE = {
  id: "power.native.integrated-synchronous-buck.facts-v3-4",
  version: "3.4.1",
  equations: [
    "power.connected-structural-bom-binding.v1",
    "power.feedback-divider-corners.v3-3",
    "power.fixed-oscillator-selection.v3-3",
    "power.ideal-pwm-output-stage-transient.v1",
    "power.mounted-geometry-ranking-proxy.v2",
    "power.inductor.raw-output-current-lower-bound-fail.v1",
  ],
} as const;

const BEHAVIORAL_SCENARIO_ID = "ideal_pwm_output_stage_transient";
const BEHAVIORAL_CIRCUIT_ID = "ideal_pwm_output_stage";
const BEHAVIORAL_LIMITATIONS = [
  "Behavior is an ideal fixed-duty PWM stimulus, not a TPS54302DDCR control, timing, current-limit, protection, package, or selected-part model.",
  "Feedback-loop response, regulation, stability, losses, efficiency, and thermal behavior are not modeled.",
  "The selected inductor and output capacitor use nominal catalog values only; tolerance, bias, ESR, DCR, parasitics, and temperature effects are not modeled.",
  "Transient waveforms are behavioral inspection artifacts only and must not be used as constraint, eligibility, ranking, or selected-part-fidelity evidence.",
].sort(compareDesignV2Tokens);

export interface PowerIntegratedBehavioralRecipeConfig {
  readonly release: Readonly<{
    id: string;
    version: string;
    equations: readonly string[];
    profileBindings?: readonly Readonly<Record<string, unknown>>[];
  }>;
  readonly optionKeyPrefix: string;
  readonly structuralRecipe: Readonly<NativeRecipeV2>;
}

function selected(candidate: Readonly<NativeCandidateV2>, id: string) {
  const component = candidate.components.find((entry) => entry.id === id);
  if (component === undefined) throw new TypeError(`Facts-V3.4 behavioral materialization is missing selected component ${id}`);
  return component;
}

function physicalInstanceIds(selectedComponentId: string, quantityPerAssembly: number): string[] {
  return quantityPerAssembly === 1
    ? [selectedComponentId]
    : Array.from({ length: quantityPerAssembly }, (_, index) => `${selectedComponentId}-${index + 1}`);
}

function exactPassiveInstances(
  candidate: Readonly<NativeCandidateV2>,
  id: "output-capacitor" | "power-inductor",
  type: "capacitor" | "inductor",
  positions: readonly [number, number][],
  rot: 0 | 90,
): CircuitComponentV2[] {
  const component = selected(candidate, id);
  if (component.quantityPerAssembly !== positions.length || component.value === undefined) {
    throw new TypeError(`Facts-V3.4 behavioral materialization requires ${positions.length} exact-valued ${id}`);
  }
  const value = component.value.value;
  return physicalInstanceIds(id, component.quantityPerAssembly).map((componentId, index) => ({
    id: componentId,
    type,
    value,
    mpn: component.part.manufacturerPartNumber,
    pos: positions[index]!,
    rot,
    mirror: false,
  }));
}

function solvedSwitchingFrequency(candidate: Readonly<NativeCandidateV2>): number {
  const frequency = candidate.data.selectedSwitchingFrequency;
  if (typeof frequency !== "number" || !Number.isFinite(frequency) || frequency <= 0) {
    throw new TypeError("Facts-V3.4 behavioral materialization requires the exact solved switching frequency");
  }
  return frequency;
}

function behavioralOutputStage(
  candidate: Readonly<NativeCandidateV2>,
  environment: Readonly<NativeEnvironmentV2>,
  frequency: number,
): CircuitGraphV2 {
  if (environment.request.application !== "power.buck") {
    throw new TypeError("Facts-V3.4 behavioral materialization requires a power.buck request");
  }
  const inputVoltage = environment.request.requirements.inputVoltage.nominal.value;
  const outputVoltage = environment.request.requirements.outputVoltage.value;
  const outputCurrent = environment.request.requirements.maximumOutputCurrent.value;
  const duty = outputVoltage / inputVoltage;
  if (![inputVoltage, outputVoltage, outputCurrent, duty].every((value) => Number.isFinite(value) && value > 0) || duty >= 1) {
    throw new TypeError("Facts-V3.4 behavioral materialization requires a positive step-down nominal operating point");
  }
  const period = canonicalDesignV2Number(1 / frequency);
  const edge = canonicalDesignV2Number(period / 1_000);
  const width = canonicalDesignV2Number(period * duty);
  const loadResistance = canonicalDesignV2Number(outputVoltage / outputCurrent);
  const outputCapacitorQuantity = selected(candidate, "output-capacitor").quantityPerAssembly;
  if (!Number.isSafeInteger(outputCapacitorQuantity) || outputCapacitorQuantity <= 0) {
    throw new TypeError("Facts-V3.4 behavioral materialization requires a positive output-capacitor quantity");
  }
  const outputCapacitorPositions = Array.from(
    { length: outputCapacitorQuantity },
    (_, index) => [24 + index * 4, 2] as [number, number],
  );
  const outputCapacitors = exactPassiveInstances(
    candidate,
    "output-capacitor",
    "capacitor",
    outputCapacitorPositions,
    90,
  );
  const powerInductor = exactPassiveInstances(candidate, "power-inductor", "inductor", [[12, 0]], 0);

  return {
    id: BEHAVIORAL_CIRCUIT_ID,
    title: "Ideal PWM nominal LC output-stage transient",
    components: [
      { id: "ground", type: "ground", pos: [16, 12], rot: 0, mirror: false },
      {
        id: "ideal-pwm-primary",
        type: "vsource_pulse",
        params: { v1: 0, v2: inputVoltage, delay: period, rise: edge, fall: edge, width, period },
        pos: [0, 2],
        rot: 0,
        mirror: false,
      },
      { id: "nominal-load", type: "resistor", value: loadResistance, pos: [32, 2], rot: 90, mirror: false },
      ...outputCapacitors,
      ...powerInductor,
    ],
    wires: [
      { id: "net-ground-bus", points: [[0, 4], [0, 12], [16, 12], ...outputCapacitorPositions.map(([x]) => [x, 12] as [number, number]), [32, 12]] },
      ...outputCapacitorPositions.map(([x], index) => ({ id: `net-ground-output-capacitor${outputCapacitorQuantity === 1 ? "" : `-${index + 1}`}`, points: [[x, 4], [x, 12]] as [number, number][] })),
      { id: "net-ground-output-load", points: [[32, 4], [32, 12]] },
      { id: "net-output", points: [[14, 0], ...outputCapacitorPositions.map(([x]) => [x, 0] as [number, number]), [32, 0]] },
      { id: "net-switch-stage", points: [[0, 0], [10, 0]] },
    ],
    probes: [{ id: "output-voltage", kind: "voltage", target: { wire: "net-output" } }],
  };
}

export function createPowerIntegratedSynchronousBuckBehavioralRecipe(
  config: PowerIntegratedBehavioralRecipeConfig,
): NativeRecipeV2 {
  const structuralRecipe = config.structuralRecipe;
  return {
  id: config.release.id,
  version: config.release.version,
  contentHash: designSha256ContentHash(canonicalDesignV2Payload(config.release)),
  applications: [...structuralRecipe.applications],
  metricDeclarations: structuralRecipe.metricDeclarations.map((entry) => ({ ...entry })),
  supports(request) {
    return structuralRecipe.supports(request);
  },
  enumerate(environment) {
    return structuralRecipe.enumerate(environment).map(({ data }) => ({
      optionKey: `${config.optionKeyPrefix}:${designSha256ContentHash(canonicalDesignV2Payload(data))}`,
      data,
    }));
  },
  solve(option, environment) {
    return structuralRecipe.solve(option, environment);
  },
  match(option, environment) {
    return structuralRecipe.match(option, environment).map((outcome) => outcome.status === "rejected"
      ? outcome
      : {
          status: "ok" as const,
          value: {
            ...outcome.value,
            simulationCoverage: [
              ...outcome.value.simulationCoverage,
              {
                scenarioId: BEHAVIORAL_SCENARIO_ID,
                modelTier: "behavioral" as const,
                limitations: [...BEHAVIORAL_LIMITATIONS],
              },
            ].sort((left, right) => compareDesignV2Tokens(left.scenarioId, right.scenarioId)),
          },
        });
  },
  check(option, environment) {
    return structuralRecipe.check(option, environment);
  },
  estimate(option, constraints, environment) {
    return structuralRecipe.estimate(option, constraints, environment);
  },
  materialize(candidate, environment) {
    const structural = structuralRecipe.materialize(candidate, environment);
    const frequency = solvedSwitchingFrequency(candidate);
    const outputCapacitor = selected(candidate, "output-capacitor");
    const outputCapacitorInstanceIds = physicalInstanceIds(
      "output-capacitor",
      outputCapacitor.quantityPerAssembly,
    );
    const circuit = {
      ...structural.circuit,
      circuits: [...structural.circuit.circuits, behavioralOutputStage(candidate, environment, frequency)],
      scenarios: [{
        id: BEHAVIORAL_SCENARIO_ID,
        title: "Ideal PWM nominal LC output-stage transient",
        circuitId: BEHAVIORAL_CIRCUIT_ID,
        config: {
          mode: "tran" as const,
          tran: {
            tstop: canonicalDesignV2Number(20 / frequency),
            tstep: canonicalDesignV2Number(1 / frequency / 100),
            maxstep: canonicalDesignV2Number(1 / frequency / 200),
          },
        },
      }],
      defaultCircuitId: "assembly",
      defaultScenarioId: BEHAVIORAL_SCENARIO_ID,
    };
    const circuitInstanceClassifications = [
      ...structural.circuitInstanceClassifications,
      { circuitId: BEHAVIORAL_CIRCUIT_ID, componentId: "ground", kind: "non_bom" as const, reason: "Ground is a simulation reference, not a BOM line." },
      {
        circuitId: BEHAVIORAL_CIRCUIT_ID,
        componentId: "ideal-pwm-primary",
        kind: "behavioral" as const,
        selectedComponentId: "primary",
        reason: "Generic ideal PWM switch-node stimulus only; it is not a TPS54302DDCR model and carries no selected-part or package fidelity.",
      },
      { circuitId: BEHAVIORAL_CIRCUIT_ID, componentId: "nominal-load", kind: "non_bom" as const, reason: "The request-derived nominal load is a behavioral analysis fixture, not a BOM line." },
      ...outputCapacitorInstanceIds.map((componentId) => ({
        circuitId: BEHAVIORAL_CIRCUIT_ID,
        componentId,
        kind: "physical" as const,
        selectedComponentId: "output-capacitor",
        representedQuantityPerAssembly: 1,
      })),
      { circuitId: BEHAVIORAL_CIRCUIT_ID, componentId: "power-inductor", kind: "physical" as const, selectedComponentId: "power-inductor", representedQuantityPerAssembly: 1 },
    ].sort((left, right) => compareDesignV2Tokens(`${left.circuitId}\u0000${left.componentId}`, `${right.circuitId}\u0000${right.componentId}`));
    const circuitBomNonRepresentations = [
      { circuitId: BEHAVIORAL_CIRCUIT_ID, selectedComponentId: "bootstrap-capacitor", reason: "The ideal switch-node stimulus does not model the selected bootstrap network." },
      { circuitId: BEHAVIORAL_CIRCUIT_ID, selectedComponentId: "feedback-lower", reason: "The fixed-duty behavioral projection does not model the selected feedback divider." },
      { circuitId: BEHAVIORAL_CIRCUIT_ID, selectedComponentId: "feedback-upper", reason: "The fixed-duty behavioral projection does not model the selected feedback divider." },
      { circuitId: BEHAVIORAL_CIRCUIT_ID, selectedComponentId: "input-capacitor", reason: "The ideal switch-node stimulus does not model the selected input capacitor or source impedance." },
    ].sort((left, right) => compareDesignV2Tokens(`${left.circuitId}\u0000${left.selectedComponentId}`, `${right.circuitId}\u0000${right.selectedComponentId}`));
    return { circuit, circuitInstanceClassifications, circuitBomNonRepresentations };
  },
  };
}

export const POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34: NativeRecipeV2 =
  createPowerIntegratedSynchronousBuckBehavioralRecipe({
    release: RELEASE,
    optionKeyPrefix: "power-v3-4",
    structuralRecipe: POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V33,
  });
