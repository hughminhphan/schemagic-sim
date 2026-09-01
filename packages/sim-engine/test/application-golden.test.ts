import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  CircuitDocument,
  CircuitDocumentV1,
  CircuitDocumentV4,
  CircuitProbe,
  LegacyCircuitProbe,
} from "@opencircuit/circuit-schema";
import { generateMotorDesign } from "@opencircuit/motor-designer";
import { M1_COMPACT_REQUEST, M2_POWER_REQUEST } from "@opencircuit/motor-designer/fixtures";
import {
  createP1CompactRequest,
  createP2HighVoltageRequest,
  generateP1CompactFixture,
  generateP2HighVoltageFixture,
} from "@opencircuit/power-designer/fixtures";
import {
  calculateSimulationNetlistContentHashV1,
  generateScenarioNetlist,
  upgradeCircuitV1ToV4,
} from "../src";

interface GoldenCase {
  id: string;
  application: "motor.brushed-dc" | "power.buck";
  topology:
    | "motor.hbridge.integrated"
    | "motor.hbridge.external-nmos"
    | "power.buck.integrated-synchronous"
    | "power.buck.controller-external-nmos";
  candidateId: string;
  recipeId: string;
  scenarioId: string;
  scenarioHash: string;
  serializationHash: string;
  fixture: string;
  netlistContentHash: `sha256:${string}`;
  analyticTrendContract: MotorAnalyticTrendContract | PowerAnalyticTrendContract;
  unavailableScenarios: string[];
}

interface MotorAnalyticTrendContract {
  kind: "motor-authored-closure-with-represented-series-resistance";
  windingCurrentVector: string;
  averageBridgeVoltageV: number;
  operatingBackEmfV: number;
  windingResistanceOhm: number;
  representedClosedSwitchResistanceOhm: number;
  representedClosedSwitchCount: number;
  representedShuntResistanceOhm: number;
  authoredLoadCurrentA: number;
  maximumAuthoredClosureAbsoluteErrorV: number;
  maximumAnalyticCurrentRelativeDifference: number;
}

interface PowerAnalyticTrendContract {
  kind: "power-passive-connectivity-positive-slopes";
  outputVector: string;
  feedbackVector: string;
  loadCurrentVector: string;
  postEnableStartS: number;
  behavioralLoadResistanceOhm: number;
  feedbackUpperResistanceOhm: number;
  feedbackLowerResistanceOhm: number;
  minimumObservedOutputSpanV: number;
  maximumFeedbackRelationAbsoluteErrorV: number;
  maximumLoadRelationAbsoluteErrorA: number;
  maximumFeedbackSlopeAbsoluteError: number;
  maximumLoadSlopeAbsoluteErrorAperV: number;
  maximumCrossEngineOutputSpanRelativeDifference: number;
}

interface GoldenContract {
  format: string;
  schemaVersion: number;
  evidenceBoundary: {
    modelTier: string;
    attestation: string;
    productionProfilesUsed: boolean;
  };
  cases: GoldenCase[];
}

const CONTRACT_URL = new URL("../../../tools/native-ngspice-reference/application-golden/contract.json", import.meta.url);
const CONTRACT = JSON.parse(readFileSync(CONTRACT_URL, "utf8")) as GoldenContract;

function candidateFor(testCase: GoldenCase) {
  const candidate = testCase.topology === "motor.hbridge.integrated"
    ? generateMotorDesign(structuredClone(M1_COMPACT_REQUEST)).candidates[0]
    : testCase.topology === "motor.hbridge.external-nmos"
      ? generateMotorDesign(structuredClone(M2_POWER_REQUEST)).candidates[0]
      : testCase.topology === "power.buck.integrated-synchronous"
        ? generateP1CompactFixture().candidates[0]
        : generateP2HighVoltageFixture().candidates[0];
  if (!candidate) throw new Error(`Missing generated candidate for ${testCase.id}`);
  return candidate;
}

function componentNumber(testCase: GoldenCase, componentId: string): number {
  const component = candidateFor(testCase).circuit.components.find((entry) => entry.id === componentId);
  if (!component || typeof component.value !== "number") throw new Error(`${testCase.id} is missing numeric ${componentId}`);
  return component.value;
}

function componentParamNumber(testCase: GoldenCase, componentId: string, parameter: string): number {
  const component = candidateFor(testCase).circuit.components.find((entry) => entry.id === componentId);
  const value = component?.params?.[parameter];
  if (typeof value !== "number") throw new Error(`${testCase.id} is missing numeric ${componentId}.${parameter}`);
  return value;
}

function legacyProbe(probe: Readonly<CircuitProbe>): LegacyCircuitProbe {
  const presentation = {
    id: probe.id,
    ...(probe.label === undefined ? {} : { label: probe.label }),
    ...(probe.color === undefined ? {} : { color: probe.color }),
  };
  if (probe.expression.kind === "voltage") {
    if (probe.expression.negative.kind !== "runtime-node" || probe.expression.negative.name !== "0") {
      throw new Error(`Cannot adapt differential probe ${probe.id} to Designer V4`);
    }
    const positive = probe.expression.positive;
    const target = positive.kind === "schematic-wire"
      ? { wire: positive.wireId }
      : positive.kind === "schematic-pin"
        ? { componentPin: [positive.componentId, positive.pin] as [string, number] }
        : { node: positive.name };
    return { ...presentation, kind: "voltage", target };
  }
  if (probe.expression.kind === "current"
    && probe.expression.component.kind === "schematic-component"
    && (probe.expression.terminal === undefined || typeof probe.expression.terminal === "number")) {
    return {
      ...presentation,
      kind: "current",
      target: {
        componentPin: [probe.expression.component.componentId, probe.expression.terminal ?? 0],
      },
    };
  }
  throw new Error(`Cannot adapt probe ${probe.id} to Designer V4`);
}

function simulatorCircuitToDesignerV4(input: Readonly<CircuitDocument>): CircuitDocumentV4 {
  if (input.modelImports?.parts.length) throw new Error("Golden Simulator circuit cannot contain imported models");
  return upgradeCircuitV1ToV4({
    format: "opencircuit-circuit",
    version: 1,
    meta: structuredClone(input.meta),
    components: structuredClone(input.components),
    wires: structuredClone(input.wires),
    probes: input.probes.map(legacyProbe),
    sim: structuredClone(input.sim),
    ...(input.view === undefined ? {} : { view: structuredClone(input.view) }),
  });
}

function scenarioDocument(testCase: GoldenCase): CircuitDocumentV4 {
  const candidate = candidateFor(testCase);
  const circuit = candidate.circuit as unknown as CircuitDocumentV1 | CircuitDocument | CircuitDocumentV4;
  const document = circuit.version === 1
    ? upgradeCircuitV1ToV4(circuit)
    : circuit.version === 3
      ? simulatorCircuitToDesignerV4(circuit)
    : circuit.version === 4
      ? structuredClone(circuit)
      : (() => { throw new Error(`Expected V1, V3, or V4 circuit for ${testCase.id}`); })();
  const source = document.scenarios[0];
  if (!source) throw new Error(`Missing upgraded scenario for ${testCase.id}`);
  return {
    ...document,
    scenarios: [{ ...source, id: testCase.scenarioId, title: testCase.scenarioId }],
    defaultScenarioId: testCase.scenarioId,
  };
}

function reordered(document: CircuitDocumentV4): CircuitDocumentV4 {
  return {
    ...structuredClone(document),
    designBlocks: [...document.designBlocks].reverse(),
    circuits: [...document.circuits].reverse().map((graph) => ({
      ...structuredClone(graph),
      components: [...graph.components].reverse(),
      wires: [...graph.wires].reverse(),
      probes: [...graph.probes].reverse(),
    })),
    scenarios: [...document.scenarios].reverse(),
  };
}

describe("application-specific Motor + Power golden identity", () => {
  it("keeps the contract behavioral, unattested, synthetic, and bounded to one case per topology", () => {
    expect(CONTRACT).toEqual(expect.objectContaining({
      format: "opencircuit-application-golden-contract",
      schemaVersion: 1,
      evidenceBoundary: expect.objectContaining({
        modelTier: "behavioral",
        attestation: "none",
        productionProfilesUsed: false,
      }),
    }));
    expect(CONTRACT.cases.map((entry) => entry.topology)).toEqual([
      "motor.hbridge.integrated",
      "motor.hbridge.external-nmos",
      "power.buck.integrated-synchronous",
      "power.buck.controller-external-nmos",
    ]);
  });

  it("distinguishes integrated decomposition from external physical switch bindings without promoting either model", () => {
    for (const testCase of CONTRACT.cases) {
      const candidate = candidateFor(testCase);
      if (testCase.topology === "motor.hbridge.integrated") {
        expect(candidate.circuit.components.filter((entry) => entry.type === "switch_spst").every((entry) => entry.mpn === undefined)).toBe(true);
      } else if (testCase.topology === "motor.hbridge.external-nmos") {
        const selectedMosfet = candidate.components.find((entry) => entry.role === "bridge-nmos");
        if (!selectedMosfet) throw new Error("M2 is missing its selected bridge MOSFET");
        expect(candidate.circuit.components.filter((entry) => entry.type === "switch_spst").map((entry) => entry.mpn)).toEqual([
          selectedMosfet.part.manufacturerPartNumber,
          selectedMosfet.part.manufacturerPartNumber,
          selectedMosfet.part.manufacturerPartNumber,
          selectedMosfet.part.manufacturerPartNumber,
        ]);
        expect(candidate.circuit.components.find((entry) => entry.id === "r-current-shunt")?.mpn).toBe(
          candidate.components.find((entry) => entry.role === "current-sense-shunt")?.part.manufacturerPartNumber,
        );
      } else {
        const high = candidate.circuit.components.find((entry) => entry.id === "high-side-switch");
        const low = candidate.circuit.components.find((entry) => entry.id === "low-side-switch");
        if (testCase.topology === "power.buck.integrated-synchronous") {
          expect(high?.mpn).toBeUndefined();
          expect(low?.mpn).toBeUndefined();
        } else {
          expect(high?.mpn).toBe(candidate.components.find((entry) => entry.role === "power.high-side-mosfet")?.part.manufacturerPartNumber);
          expect(low?.mpn).toBe(candidate.components.find((entry) => entry.role === "power.low-side-mosfet")?.part.manufacturerPartNumber);
        }
      }
      expect(candidate.simulationCoverage.some((entry) => entry.modelTier === "reviewed")).toBe(false);
      expect(candidate.circuit.meta.description).toMatch(/behavioral|averaged operating-point model/i);
    }
  });

  it("binds non-vacuous analytic relations to the exact behavioral circuit inputs without promoting them to fidelity", () => {
    for (const testCase of CONTRACT.cases) {
      const fixtureUrl = new URL(`../../../tools/native-ngspice-reference/application-golden/${testCase.fixture}`, import.meta.url);
      const fixture = readFileSync(fixtureUrl, "utf8");
      if (testCase.application === "motor.brushed-dc") {
        const request = testCase.topology === "motor.hbridge.integrated"
          ? M1_COMPACT_REQUEST
          : M2_POWER_REQUEST;
        const trend = testCase.analyticTrendContract;
        expect(trend.kind).toBe("motor-authored-closure-with-represented-series-resistance");
        if (trend.kind !== "motor-authored-closure-with-represented-series-resistance") throw new Error(`${testCase.id} has the wrong analytic trend`);
        const averageBridgeVoltageV = request.requirements.supplyVoltage.nominal.value
          * request.requirements.operatingPoint.dutyCycle.value;
        const operatingBackEmfV = averageBridgeVoltageV
          - request.requirements.operatingPoint.loadCurrent.value * request.requirements.motorModel.windingResistance.value;
        expect(trend.averageBridgeVoltageV).toBeCloseTo(averageBridgeVoltageV, 14);
        expect(trend.operatingBackEmfV).toBeCloseTo(operatingBackEmfV, 14);
        expect(trend.windingResistanceOhm).toBe(request.requirements.motorModel.windingResistance.value);
        expect(trend.authoredLoadCurrentA).toBe(request.requirements.operatingPoint.loadCurrent.value);
        expect(trend.representedClosedSwitchResistanceOhm).toBe(0.001);
        expect(trend.representedClosedSwitchCount).toBe(2);
        expect(fixture.match(/^Roc_[^\n]+ 1m \$ component:s-(?:high|low)-/gmu)).toHaveLength(2);
        expect(trend.representedShuntResistanceOhm).toBe(
          testCase.topology === "motor.hbridge.external-nmos" ? componentNumber(testCase, "r-current-shunt") : 0,
        );
        const analyticallyExpectedCurrentA = (trend.averageBridgeVoltageV - trend.operatingBackEmfV) / (
          trend.windingResistanceOhm
            + trend.representedClosedSwitchCount * trend.representedClosedSwitchResistanceOhm
            + trend.representedShuntResistanceOhm
        );
        expect(analyticallyExpectedCurrentA).toBeGreaterThan(0);
        expect(analyticallyExpectedCurrentA).toBeLessThan(trend.authoredLoadCurrentA);
      } else {
        const request = testCase.topology === "power.buck.integrated-synchronous"
          ? createP1CompactRequest()
          : createP2HighVoltageRequest();
        const trend = testCase.analyticTrendContract;
        expect(trend.kind).toBe("power-passive-connectivity-positive-slopes");
        if (trend.kind !== "power-passive-connectivity-positive-slopes") throw new Error(`${testCase.id} has the wrong analytic trend`);
        expect(trend.behavioralLoadResistanceOhm).toBe(
          request.requirements.outputVoltage.value / request.requirements.maximumOutputCurrent.value,
        );
        expect(trend.behavioralLoadResistanceOhm).toBe(componentNumber(testCase, "behavioral-load"));
        expect(trend.feedbackUpperResistanceOhm).toBe(componentNumber(testCase, "feedback-upper"));
        expect(trend.feedbackLowerResistanceOhm).toBe(componentNumber(testCase, "feedback-lower"));
        expect(trend.postEnableStartS).toBe(componentParamNumber(testCase, "high-side-gate-drive", "delay"));
        expect(trend.minimumObservedOutputSpanV).toBeGreaterThan(0);
        expect(1 / trend.behavioralLoadResistanceOhm).toBeGreaterThan(0);
        expect(trend.feedbackLowerResistanceOhm / (trend.feedbackUpperResistanceOhm + trend.feedbackLowerResistanceOhm)).toBeGreaterThan(0);
      }
    }
  });

  it("binds installed synthetic Designer contexts to exact candidate, scenario, and netlist identities", async () => {
    for (const testCase of CONTRACT.cases) {
      const candidate = candidateFor(testCase);
      expect(candidate.id).toBe(testCase.candidateId);
      expect(candidate.recipeId).toBe(testCase.recipeId);
      expect(candidate.components.every((component) => component.profileId.startsWith("motor.fixture.") || component.profileId.startsWith("synthetic."))).toBe(true);

      const selectedCoverage = candidate.simulationCoverage.find((entry) => entry.scenarioId === testCase.scenarioId);
      expect(selectedCoverage?.modelTier).toBe("behavioral");
      expect(candidate.simulationCoverage.filter((entry) => entry.modelTier === "unavailable").map((entry) => entry.scenarioId)).toEqual(testCase.unavailableScenarios);
      expect(candidate.simulationCoverage.some((entry) => entry.modelTier === "reviewed")).toBe(false);

      const document = scenarioDocument(testCase);
      const generated = generateScenarioNetlist(document, testCase.scenarioId);
      const fixtureUrl = new URL(`../../../tools/native-ngspice-reference/application-golden/${testCase.fixture}`, import.meta.url);
      const fixture = readFileSync(fixtureUrl, "utf8");
      expect(generated.omissions).toEqual([]);
      expect(generated.scenarioId).toBe(testCase.scenarioId);
      expect.soft(
        generated.scenarioHash,
        `${testCase.id}: ${JSON.stringify(document.scenarios.find((entry) => entry.id === testCase.scenarioId)?.config)}`,
      ).toBe(testCase.scenarioHash);
      expect.soft(generated.documentHash, `${testCase.id} document hash`).toBe(testCase.scenarioHash);
      expect.soft(generated.serializationHash, `${testCase.id} serialization hash`).toBe(testCase.serializationHash);
      expect.soft(generated.netlist, `${testCase.id} netlist`).toBe(fixture);
      expect.soft(
        await calculateSimulationNetlistContentHashV1(generated.netlist),
        `${testCase.id} netlist content hash`,
      ).toBe(testCase.netlistContentHash);

      const shuffled = generateScenarioNetlist(reordered(document), testCase.scenarioId);
      expect(shuffled.netlist).toBe(generated.netlist);
      expect(shuffled.scenarioHash).toBe(generated.scenarioHash);
      expect(shuffled.serializationHash).toBe(generated.serializationHash);
    }
  });

  it("detects graph, scenario, and analysis drift instead of accepting a plausible application netlist", () => {
    for (const testCase of CONTRACT.cases) {
      const document = scenarioDocument(testCase);
      const graphDrift = structuredClone(document);
      const resistor = graphDrift.circuits[0]?.components.find((component) => component.type === "resistor");
      if (!resistor || !("value" in resistor)) throw new Error(`Missing resistor for ${testCase.id}`);
      resistor.value = typeof resistor.value === "number" ? resistor.value * 1.01 : "1.01k";
      expect(generateScenarioNetlist(graphDrift, testCase.scenarioId).scenarioHash).not.toBe(testCase.scenarioHash);

      const scenarioDrift = structuredClone(document);
      scenarioDrift.scenarios[0]!.id = `${testCase.scenarioId}-drift`;
      scenarioDrift.defaultScenarioId = scenarioDrift.scenarios[0]!.id;
      expect(generateScenarioNetlist(scenarioDrift, scenarioDrift.scenarios[0]!.id).scenarioHash).not.toBe(testCase.scenarioHash);

      const analysisDrift = structuredClone(document);
      analysisDrift.scenarios[0]!.config = analysisDrift.scenarios[0]!.config.mode === "op"
        ? { mode: "tran", tran: { tstop: 1e-3, tstep: 1e-6, maxstep: 1e-5 } }
        : { mode: "op" };
      expect(generateScenarioNetlist(analysisDrift, testCase.scenarioId).scenarioHash).not.toBe(testCase.scenarioHash);
    }
  });
});
