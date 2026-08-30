import {
  componentCurrentProbe,
  wireVoltageProbe,
  type CircuitComponent,
  type CircuitDocument,
  type CircuitProbe,
  type CircuitWire,
} from "@opencircuit/circuit-schema";
import type {
  CandidateForMaterialization,
  RecipeEnvironment,
} from "@opencircuit/design-engine";
import type {
  BuckDesignRequest,
  SelectedComponent,
  SimulationCoverage,
} from "@opencircuit/design-schema";
import { SYNTHETIC_BUCK_TEST_CATALOG } from "./catalog";

export const BUCK_SIMULATION_SCENARIO_IDS = [
  "steady_state",
  "startup",
  "load_step",
  "line_step",
] as const;

export type BuckSimulationScenarioId = typeof BUCK_SIMULATION_SCENARIO_IDS[number];

const STEADY_STATE_LIMITATIONS = [
  "The selected regulator/controller is not modeled as a physical IC by this behavioral Simulator V3 circuit.",
  "Generic level-1 MOSFETs and authored complementary gate pulses approximate the switching power stage; analytic estimates remain authoritative.",
];

const STARTUP_LIMITATIONS = [
  "Startup covers delayed behavioral gate enable and passive output rise only; soft-start, UVLO, current-limit, and control-loop dynamics are unavailable.",
  "The selected regulator/controller is not modeled as a physical IC by this behavioral Simulator V3 circuit.",
];

const LOAD_STEP_LIMITATIONS = [
  "Unavailable: this Simulator V3 circuit has no pulsed current or load-step stimulus and no per-scenario document/config reference.",
];

const LINE_STEP_LIMITATIONS = [
  "Unavailable: this Simulator V3 circuit stores one SimConfig and cannot attach an alternate line-step source/config to this candidate.",
];

export function buckSimulationCoverage(): SimulationCoverage[] {
  return [
    { scenarioId: "steady_state", modelTier: "behavioral", limitations: [...STEADY_STATE_LIMITATIONS] },
    { scenarioId: "startup", modelTier: "behavioral", limitations: [...STARTUP_LIMITATIONS] },
    { scenarioId: "load_step", modelTier: "unavailable", limitations: [...LOAD_STEP_LIMITATIONS] },
    { scenarioId: "line_step", modelTier: "unavailable", limitations: [...LINE_STEP_LIMITATIONS] },
  ];
}

function buckRequest(environment: RecipeEnvironment): BuckDesignRequest {
  if (environment.request.application !== "power.buck") throw new Error("Buck circuit materializer received a non-buck request");
  return environment.request as BuckDesignRequest;
}

function dataText(candidate: Readonly<CandidateForMaterialization>, key: string): string {
  const value = candidate.data[key];
  if (typeof value !== "string") throw new Error(`Buck circuit data ${key} must be text`);
  return value;
}

function derived(candidate: Readonly<CandidateForMaterialization>, id: string): number {
  const value = candidate.derivedValues.find((entry) => entry.id === id)?.value.value;
  if (value === undefined) throw new Error(`Buck circuit candidate is missing ${id}`);
  return value;
}

function selected(candidate: Readonly<CandidateForMaterialization>, role: string): SelectedComponent {
  const component = candidate.components.find((entry) => entry.role === role);
  if (!component) throw new Error(`Buck circuit candidate is missing ${role}`);
  return component;
}

function selectedValue(component: SelectedComponent): number {
  if (!component.value) throw new Error(`Selected component ${component.id} is missing its physical value`);
  return component.value.value;
}

function label(text: string): NonNullable<CircuitComponent["label"]> {
  return { text, offset: [0, -3] };
}

function designParams(component: SelectedComponent): Record<string, unknown> {
  return {
    designerProfileId: component.profileId,
    designerBomLineId: component.id,
    designerEvidenceTier: "synthetic_test_fixture",
  };
}

function externalGateDriveVoltage(primaryProfileId: string): number {
  const profile = SYNTHETIC_BUCK_TEST_CATALOG.externalControllers.find((entry) => entry.profileId === primaryProfileId);
  if (!profile) throw new Error(`Unknown external controller profile ${primaryProfileId}`);
  return profile.gateDriveVoltageV;
}

function behavioralSwitch(
  id: string,
  position: CircuitComponent["pos"],
  selectedMosfet: SelectedComponent | undefined,
  primary: SelectedComponent,
  internalRole: "high-side" | "low-side",
): CircuitComponent {
  if (selectedMosfet) {
    return {
      id,
      type: "nmos",
      mpn: selectedMosfet.part.manufacturerPartNumber,
      pos: position,
      rot: 0,
      mirror: false,
      label: label(`${internalRole === "high-side" ? "HS" : "LS"} ${selectedMosfet.part.manufacturerPartNumber} · BEHAVIORAL`),
      params: {
        ...designParams(selectedMosfet),
        designerModelTier: "behavioral",
        designerPhysicalBomComponent: true,
      },
    };
  }
  return {
    id,
    type: "nmos",
    pos: position,
    rot: 0,
    mirror: false,
    label: label(`INTERNAL ${internalRole === "high-side" ? "HS" : "LS"} FET · BEHAVIORAL`),
    params: {
      designerPrimaryProfileId: primary.profileId,
      designerModelTier: "behavioral",
      designerPhysicalBomComponent: false,
      designerRole: `integrated-${internalRole}-switch-decomposition`,
    },
  };
}

function gateDriveSource(
  id: string,
  position: CircuitComponent["pos"],
  primary: SelectedComponent,
  gateVoltageV: number,
  delayS: number,
  widthS: number,
  periodS: number,
  role: "high-side" | "low-side",
): CircuitComponent {
  return {
    id,
    type: "vsource_pulse",
    value: gateVoltageV,
    pos: position,
    rot: 0,
    mirror: false,
    label: label(`${role === "high-side" ? "HIGH" : "LOW"} GATE DRIVE · BEHAVIORAL`),
    params: {
      v1: 0,
      v2: gateVoltageV,
      delay: delayS,
      rise: 10e-9,
      fall: 10e-9,
      width: widthS,
      period: periodS,
      designerPrimaryProfileId: primary.profileId,
      designerPrimaryPartNumber: primary.part.manufacturerPartNumber,
      designerBehavioralRole: `${role}-gate-drive`,
      designerModelTier: "behavioral",
      designerPhysicalBomComponent: false,
    },
  };
}

function wires(): CircuitWire[] {
  return [
    { id: "vin-rail", points: [[4, 14], [4, 8], [24, 8]] },
    { id: "high-side-drain-pin", points: [[24, 9], [24, 8]] },
    { id: "input-capacitor-positive", points: [[10, 14], [4, 14]] },
    { id: "input-source-ground", points: [[4, 18], [4, 24]] },
    { id: "input-capacitor-ground", points: [[10, 18], [10, 24]] },
    { id: "high-gate", points: [[16, 12], [20, 12]] },
    { id: "switch-node", points: [[16, 16], [24, 16], [30, 16]] },
    { id: "high-side-source-pin", points: [[24, 15], [24, 16]] },
    { id: "low-side-drain-pin", points: [[24, 17], [24, 16]] },
    { id: "low-gate", points: [[16, 20], [20, 20]] },
    { id: "output-rail", points: [[34, 16], [38, 16], [46, 16], [52, 16]] },
    { id: "output-capacitor-positive", points: [[38, 16], [38, 18]] },
    { id: "load-positive", points: [[46, 16], [46, 18]] },
    { id: "output-capacitor-ground", points: [[38, 22], [38, 24]] },
    { id: "load-ground", points: [[46, 22], [46, 24]] },
    { id: "feedback-node", points: [[52, 20], [56, 20]] },
    { id: "ground-rail", points: [[4, 24], [10, 24], [16, 24], [24, 24], [28, 24], [38, 24], [46, 24], [52, 24]] },
    { id: "low-side-source-pin", points: [[24, 23], [24, 24]] },
    { id: "ground-symbol", points: [[28, 24], [28, 28]] },
  ];
}

function probes(): CircuitProbe[] {
  return [
    wireVoltageProbe("vin-voltage", "vin-rail", { color: "#8b5cf6" }),
    componentCurrentProbe("input-current", "input-source", 0, { color: "#f59e0b" }),
    wireVoltageProbe("switch-node-voltage", "switch-node", { color: "#ef4444" }),
    componentCurrentProbe("inductor-current", "power-inductor", 0, { color: "#10b981" }),
    wireVoltageProbe("output-voltage", "output-rail", { color: "#3b82f6" }),
    wireVoltageProbe("feedback-voltage", "feedback-node", { color: "#ec4899" }),
  ];
}

export function materializeBuckCircuit(
  candidate: Readonly<CandidateForMaterialization>,
  environment: RecipeEnvironment,
): CircuitDocument {
  const request = buckRequest(environment);
  const primaryRole = dataText(candidate, "topology") === "integrated" ? "power.regulator" : "power.controller";
  const primary = selected(candidate, primaryRole);
  const inductor = selected(candidate, "power.inductor");
  const inputCapacitor = selected(candidate, "power.input-capacitor");
  const outputCapacitor = selected(candidate, "power.output-capacitor");
  const feedbackUpper = selected(candidate, "power.feedback-upper");
  const feedbackLower = selected(candidate, "power.feedback-lower");
  const highSideMosfet = candidate.components.find((entry) => entry.role === "power.high-side-mosfet");
  const lowSideMosfet = candidate.components.find((entry) => entry.role === "power.low-side-mosfet");
  if ((highSideMosfet === undefined) !== (lowSideMosfet === undefined)) throw new Error("External buck candidate must select both high-side and low-side MOSFETs");

  const switchingFrequencyHz = derived(candidate, "buck.switching-frequency");
  const dutyCycle = derived(candidate, "buck.duty-cycle.nominal");
  const periodS = 1 / switchingFrequencyHz;
  const deadTimeS = Math.min(50e-9, periodS * 0.02);
  const startupDelayS = periodS * 2;
  const highWidthS = Math.max(periodS * 0.02, dutyCycle * periodS - deadTimeS);
  const lowWidthS = Math.max(periodS * 0.02, (1 - dutyCycle) * periodS - deadTimeS);
  const gateVoltageV = primaryRole === "power.controller" ? externalGateDriveVoltage(primary.profileId) : 5;
  const loadResistanceOhm = request.requirements.outputVoltage.value / request.requirements.maximumOutputCurrent.value;
  const behavioralBoundary = primaryRole === "power.regulator"
    ? "The integrated regulator is decomposed into generic internal switches and authored gate pulses; it is not a physical IC simulation model."
    : "The selected controller is represented only by authored complementary gate pulses; the controller IC itself is not a physical simulation model.";

  const components: CircuitComponent[] = [
    {
      id: "input-source",
      type: "vsource",
      value: request.requirements.inputVoltage.nominal.value,
      pos: [4, 16],
      rot: 0,
      mirror: false,
      label: label(`VIN ${request.requirements.inputVoltage.nominal.value} V`),
      params: { designerRole: "input-source", designerModelTier: "behavioral" },
    },
    {
      id: "input-capacitor",
      type: "capacitor",
      mpn: inputCapacitor.part.manufacturerPartNumber,
      value: selectedValue(inputCapacitor),
      pos: [10, 16],
      rot: 90,
      mirror: false,
      label: label(`CIN ${inputCapacitor.part.manufacturerPartNumber}`),
      params: designParams(inputCapacitor),
    },
    behavioralSwitch("high-side-switch", [22, 12], highSideMosfet, primary, "high-side"),
    behavioralSwitch("low-side-switch", [22, 20], lowSideMosfet, primary, "low-side"),
    gateDriveSource("high-side-gate-drive", [16, 14], primary, gateVoltageV, startupDelayS, highWidthS, periodS, "high-side"),
    gateDriveSource("low-side-gate-drive", [16, 22], primary, gateVoltageV, startupDelayS + dutyCycle * periodS, lowWidthS, periodS, "low-side"),
    {
      id: "power-inductor",
      type: "inductor",
      mpn: inductor.part.manufacturerPartNumber,
      value: selectedValue(inductor),
      pos: [32, 16],
      rot: 0,
      mirror: false,
      label: label(`L ${inductor.part.manufacturerPartNumber}`),
      params: designParams(inductor),
    },
    {
      id: "output-capacitor",
      type: "capacitor",
      mpn: outputCapacitor.part.manufacturerPartNumber,
      value: selectedValue(outputCapacitor),
      pos: [38, 20],
      rot: 90,
      mirror: false,
      label: label(`COUT ${outputCapacitor.part.manufacturerPartNumber}`),
      params: designParams(outputCapacitor),
    },
    {
      id: "behavioral-load",
      type: "resistor",
      value: loadResistanceOhm,
      pos: [46, 20],
      rot: 90,
      mirror: false,
      label: label(`LOAD ${loadResistanceOhm.toPrecision(4)} Ω`),
      params: {
        designerRole: "maximum-output-current-load",
        designerModelTier: "behavioral",
        designerPhysicalBomComponent: false,
      },
    },
    {
      id: "feedback-upper",
      type: "resistor",
      mpn: feedbackUpper.part.manufacturerPartNumber,
      value: selectedValue(feedbackUpper),
      pos: [52, 18],
      rot: 90,
      mirror: false,
      label: label(`RFB TOP ${feedbackUpper.part.manufacturerPartNumber}`),
      params: designParams(feedbackUpper),
    },
    {
      id: "feedback-lower",
      type: "resistor",
      mpn: feedbackLower.part.manufacturerPartNumber,
      value: selectedValue(feedbackLower),
      pos: [52, 22],
      rot: 90,
      mirror: false,
      label: label(`RFB BOT ${feedbackLower.part.manufacturerPartNumber}`),
      params: designParams(feedbackLower),
    },
    { id: "ground", type: "ground", pos: [28, 28], rot: 0, mirror: false, label: label("GND") },
  ];

  return {
    format: "opencircuit-circuit",
    version: 3,
    meta: {
      title: `scheMAGIC Power Designer behavioral buck — ${primary.part.manufacturerPartNumber}`,
      description: `Connected editable Track B2 behavioral power stage using synthetic test-only profiles. ${behavioralBoundary} Load-step and line-step remain unavailable under the frozen circuit contract.`,
    },
    components,
    wires: wires(),
    probes: probes(),
    sim: {
      mode: "tran",
      tran: {
        tstop: startupDelayS + periodS * 12,
        tstep: periodS / 100,
        maxstep: periodS / 50,
      },
    },
    view: { pan: [0, 0], zoom: 1 },
  };
}
