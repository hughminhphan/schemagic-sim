import { readFileSync } from "node:fs";
import { createRunProvenance, effectiveSimulationLimits, generateScenarioNetlist } from "@opencircuit/sim-engine";
import { _createSimulationExecutionReceiptV1 } from "@opencircuit/sim-engine/provenance-testing";
import {
  canonicalDesignResultV2ContentHash,
  designRequestHashV2,
  migrateDesignRequestV1ToV2,
  type DesignRequestV1,
  type DesignResultV2,
} from "@opencircuit/design-schema";
import { describe, expect, it, vi } from "vitest";

vi.mock("@opencircuit/design-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@opencircuit/design-engine")>();
  return {
    ...actual,
    validateDesignResultEngineeringContextV2: () => [],
    validateDesignResultExecutionContextV2: () => [],
  };
});

import {
  DesignScenarioSimulationCsvErrorV2,
  createDesignScenarioSimulationProvenanceV2,
  exportDesignResultScenarioSimulationCsvV2,
  parseDesignResultScenarioSimulationCsvV2,
} from "../src/simulation-csv-v2";
import type { SimulationResult } from "@opencircuit/sim-engine";

function scenarioResult(): DesignResultV2 {
  const legacy = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/p1-compact.design-request.json", import.meta.url),
    "utf8",
  )) as DesignRequestV1;
  const migration = migrateDesignRequestV1ToV2(legacy, "simulation-csv-test", "area");
  if (migration.status !== "migrated") throw new Error("Expected a migrated request");
  const requestHash = designRequestHashV2(migration.request);
  const candidate: DesignResultV2["candidates"][number] = {
    schemaVersion: 2,
    id: `candidate:v2:sha256:${"2".repeat(64)}`,
    requestHash,
    recipeId: "test.behavioral-simulation-csv",
    libraryVersion: migration.request.libraryVersion,
    components: [],
    derivedValues: [],
    constraints: [],
    metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
    simulationCoverage: [{
      scenarioId: "load-step",
      modelTier: "behavioral",
      limitations: ["Behavioral stage only; no selected-part silicon model."],
    }],
    circuit: {
      format: "opencircuit-circuit",
      version: 4,
      meta: { title: "Behavioral receipt fixture" },
      designBlocks: [],
      circuits: [{
        id: "main",
        title: "Main graph",
        components: [
          { id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false },
          { id: "vin", type: "vsource", value: 5, pos: [0, -4], rot: 0, mirror: false },
        ],
        wires: [],
        probes: [{ id: "output", kind: "voltage", target: { componentPin: ["vin", 1] } }],
      }],
      scenarios: [{
        id: "load-step",
        title: "Load step",
        circuitId: "main",
        config: { mode: "tran", tran: { tstop: 2e-6, tstep: 1e-6, maxstep: 1e-6 } },
      }],
      defaultCircuitId: "main",
      defaultScenarioId: "load-step",
    },
    circuitInstanceClassifications: [
      { circuitId: "main", componentId: "ground", kind: "non_bom", reason: "Reference node" },
      { circuitId: "main", componentId: "vin", kind: "non_bom", reason: "Behavioral stimulus" },
    ],
    circuitBomNonRepresentations: [],
    warnings: ["Do not use behavioral waveforms as ranking evidence."],
  };
  const withoutHash: Omit<DesignResultV2, "contentHash"> = {
    format: "schemagic-design-result",
    schemaVersion: 2,
    request: migration.request,
    requestHash,
    libraryVersion: migration.request.libraryVersion,
    libraryContentHash: `sha256:${"1".repeat(64)}`,
    candidates: [candidate],
    rejectedCandidates: [],
    diagnostics: [],
  };
  return { ...withoutHash, contentHash: canonicalDesignResultV2ContentHash(withoutHash) };
}

async function simulationResult(
  result: DesignResultV2,
  netlistOverride?: string,
): Promise<SimulationResult> {
  const candidate = result.candidates[0]!;
  const generated = generateScenarioNetlist(candidate.circuit, "load-step");
  const vectors: SimulationResult["vectors"] = [
    { name: "time", kind: "time", length: 3, complex: false, bufferIndex: 0 },
    { name: "v(out)", kind: "voltage", length: 3, complex: false, bufferIndex: 1 },
  ];
  const data = new Map<string, Float64Array>([
    ["time", Float64Array.from([0, 1e-6, 2e-6])],
    ["v(out)", Float64Array.from([-0, 1 / 3, 1])],
  ]);
  const receipt = await _createSimulationExecutionReceiptV1({
    requestType: "runTransient",
    netlist: netlistOverride ?? generated.netlist,
    vectors,
    data,
    rawfileBytes: 512,
  });
  const requestType = "runTransient" as const;
  const limits = effectiveSimulationLimits(requestType);
  const provenance = await createRunProvenance({
    type: requestType,
    netlist: netlistOverride ?? generated.netlist,
    limits,
  });
  return {
    provenance,
    vectors,
    data,
    elapsedMs: 8.25,
    engineMs: 6.5,
    parseMs: 1.25,
    queueMs: 0.5,
    rawfileBytes: 512,
    receipt,
  };
}

const contexts = {
  engineeringContext: {
    manifest: {
      version: "simulation-csv-test",
      contentHash: `sha256:${"3".repeat(64)}`,
    },
  } as never,
  executionContext: {},
} as const;

async function expectCsvError(
  callback: () => Promise<unknown>,
  code: DesignScenarioSimulationCsvErrorV2["code"],
): Promise<void> {
  try {
    await callback();
  } catch (error) {
    expect(error).toBeInstanceOf(DesignScenarioSimulationCsvErrorV2);
    expect((error as DesignScenarioSimulationCsvErrorV2).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

describe("Designer V2 behavioral simulation CSV", () => {
  it("round-trips exact result/scenario/netlist/engine/sample provenance and deterministic bytes", async () => {
    const result = scenarioResult();
    const samples = await simulationResult(result);
    const candidate = result.candidates[0]!;
    const provenance = await createDesignScenarioSimulationProvenanceV2(
      result,
      candidate.id,
      "load-step",
      samples,
      contexts,
    );
    const first = await exportDesignResultScenarioSimulationCsvV2(
      result,
      candidate.id,
      "load-step",
      samples,
      contexts,
    );
    const second = await exportDesignResultScenarioSimulationCsvV2(
      structuredClone(result),
      candidate.id,
      "load-step",
      samples,
      contexts,
    );
    const parsed = await parseDesignResultScenarioSimulationCsvV2(first, result, contexts);

    expect(second).toBe(first);
    expect(provenance).toMatchObject({
      fidelity: "behavioral_model",
      evidenceUse: "waveform_only_not_ranking",
      attestation: "none",
      engineeringContextRef: {
        manifestVersion: "simulation-csv-test",
        manifestContentHash: `sha256:${"3".repeat(64)}`,
      },
      scenarioRef: { id: "load-step", circuitId: "main", analysisMode: "tran" },
      coverage: { modelTier: "behavioral" },
      runProvenance: samples.provenance,
      timing: { elapsedMs: 8.25, engineMs: 6.5, parseMs: 1.25, queueMs: 0.5 },
    });
    expect(provenance.executionReceipt.engine.buildVersion).toBe("ngspice-46-opencircuit-wasm1");
    expect(parsed.provenance).toEqual(provenance);
    expect(parsed.provenance.runProvenance).toEqual(samples.provenance);
    expect(parsed.provenance.timing).toEqual({ elapsedMs: 8.25, engineMs: 6.5, parseMs: 1.25, queueMs: 0.5 });
    expect([...parsed.data.get("time")!]).toEqual([0, 1e-6, 2e-6]);
    expect(Object.is(parsed.data.get("v(out)")![0], -0)).toBe(true);
    expect([...parsed.data.get("v(out)")!.slice(1)]).toEqual([1 / 3, 1]);
    expect(first).toContain("record_type,metadata_json,sample_index,time [s],v(out) [V]\n");
    expect(first).toContain("sample,,0,0,-0\n");
  });

  it("rejects sample-byte drift and an execution receipt for any other netlist", async () => {
    const result = scenarioResult();
    const candidate = result.candidates[0]!;
    const samples = await simulationResult(result);
    const csv = await exportDesignResultScenarioSimulationCsvV2(result, candidate.id, "load-step", samples, contexts);

    await expectCsvError(
      () => parseDesignResultScenarioSimulationCsvV2(csv.replace("0.3333333333333333", "0.5"), result, contexts),
      "simulation_receipt_invalid",
    );
    const otherContext = {
      ...contexts,
      engineeringContext: {
        manifest: {
          version: "simulation-csv-test-other",
          contentHash: `sha256:${"4".repeat(64)}`,
        },
      } as never,
    };
    await expectCsvError(
      () => parseDesignResultScenarioSimulationCsvV2(csv, result, otherContext),
      "artifact_unverified",
    );
    const otherNetlist = await simulationResult(result, `${generateScenarioNetlist(candidate.circuit, "load-step").netlist}* changed\n`);
    await expectCsvError(
      () => exportDesignResultScenarioSimulationCsvV2(result, candidate.id, "load-step", otherNetlist, contexts),
      "netlist_mismatch",
    );

    const reorderedVectors: SimulationResult["vectors"] = [samples.vectors[1]!, { ...samples.vectors[0]!, bufferIndex: 1 }]
      .map((vector, bufferIndex) => ({ ...vector, bufferIndex }));
    const reorderedData = new Map(reorderedVectors.map((vector) => [vector.name, samples.data.get(vector.name)!]));
    const reorderedReceipt = await _createSimulationExecutionReceiptV1({
      requestType: "runTransient",
      netlist: generateScenarioNetlist(candidate.circuit, "load-step").netlist,
      vectors: reorderedVectors,
      data: reorderedData,
      rawfileBytes: samples.rawfileBytes,
    });
    await expectCsvError(
      () => exportDesignResultScenarioSimulationCsvV2(
        result,
        candidate.id,
        "load-step",
        { ...samples, vectors: reorderedVectors, data: reorderedData, receipt: reorderedReceipt },
        contexts,
      ),
      "analysis_mismatch",
    );
  });

  it("exports a point-in-time sample snapshot across asynchronous receipt verification", async () => {
    const result = scenarioResult();
    const candidate = result.candidates[0]!;
    const samples = await simulationResult(result);
    const pending = exportDesignResultScenarioSimulationCsvV2(
      result,
      candidate.id,
      "load-step",
      samples,
      contexts,
    );

    samples.data.get("v(out)")![1] = 0.5;

    const csv = await pending;
    expect(csv).toContain("sample,,1,0.000001,0.3333333333333333\n");
    await expect(parseDesignResultScenarioSimulationCsvV2(csv, result, contexts)).resolves.toBeDefined();
  });

  it("rejects impossible imported vector allocations before constructing sample arrays", async () => {
    const result = scenarioResult();
    const candidate = result.candidates[0]!;
    const samples = await simulationResult(result);
    const csv = await exportDesignResultScenarioSimulationCsvV2(result, candidate.id, "load-step", samples, contexts);
    const oversized = csv.replace('""length"":3', '""length"":1000000000');

    await expectCsvError(
      () => parseDesignResultScenarioSimulationCsvV2(oversized, result, contexts),
      "invalid_csv",
    );
  });

  it("maps malformed live result snapshots to the closed receipt error", async () => {
    const result = scenarioResult();
    const candidate = result.candidates[0]!;
    await expectCsvError(
      () => exportDesignResultScenarioSimulationCsvV2(
        result,
        candidate.id,
        "load-step",
        { data: undefined } as never,
        contexts,
      ),
      "simulation_receipt_invalid",
    );
  });

  it("keeps unavailable coverage out of simulation-data exports", async () => {
    const result = scenarioResult();
    const candidate = result.candidates[0]!;
    const unavailable = structuredClone(result);
    unavailable.candidates[0]!.simulationCoverage = [{
      scenarioId: "load-step",
      modelTier: "unavailable",
      limitations: ["No executable graph"],
    }];
    unavailable.candidates[0]!.circuit.scenarios = [];
    unavailable.candidates[0]!.circuit.defaultScenarioId = null;
    const { contentHash: _contentHash, ...payload } = unavailable;
    unavailable.contentHash = canonicalDesignResultV2ContentHash(payload);
    const samples = await simulationResult(result);
    await expectCsvError(
      () => exportDesignResultScenarioSimulationCsvV2(unavailable, candidate.id, "load-step", samples, contexts),
      "coverage_unavailable",
    );
  });
});
