import { readFileSync } from "node:fs";
import {
  calculateDesignBlockContentHash,
  validateCircuitV4,
  type DesignBlockDefinition,
} from "@opencircuit/circuit-schema";
import {
  canonicalDesignResultV2ContentHash,
  canonicalDesignV2Payload,
  designRequestHashV2,
  migrateDesignRequestV1ToV2,
  parseDesignResultV2,
  type DesignRequestV1,
  type DesignResultV2,
} from "@opencircuit/design-schema";
import { describe, expect, it, vi } from "vitest";

vi.mock("@opencircuit/design-engine/v2-export-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@opencircuit/design-engine/v2-export-runtime")>();
  return {
    ...actual,
    validateDesignResultEngineeringContextV2: () => [],
  };
});

import {
  CandidateKicadSchematicExportErrorV2,
  exportDesignResultKicadSchematicV2,
  parseDesignResultKicadSchematicV2,
} from "../src/kicad-schematic-v2";

const MANIFEST_HASH = `sha256:${"3".repeat(64)}` as const;
const exactOptions = {
  engineeringContext: {
    manifest: { version: "kicad-omission-fixture", contentHash: MANIFEST_HASH },
  } as never,
  executionContext: {},
} as const;

function omissionResult(): DesignResultV2 {
  const source = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/p1-compact.design-request.json", import.meta.url),
    "utf8",
  )) as DesignRequestV1;
  const migration = migrateDesignRequestV1ToV2(source, "kicad-omission-fixture", "area");
  if (migration.status !== "migrated") throw new Error("Expected migrated request");
  const requestHash = designRequestHashV2(migration.request);
  const blockPayload: Omit<DesignBlockDefinition, "contentHash"> = {
    id: "behavioral-stage",
    version: "1",
    title: "Behavioral stage",
    pins: [
      { id: "in", name: "IN", offset: [-2, 0] },
      { id: "out", name: "OUT", offset: [2, 0] },
    ],
    netlist: { kind: "schematic_only", reason: "No executable reviewed model is installed." },
  };
  const block: DesignBlockDefinition = {
    ...blockPayload,
    contentHash: calculateDesignBlockContentHash(blockPayload),
  };
  const omission = {
    code: "SCHEMATIC_ONLY_BLOCK_OMITTED",
    scenarioId: "op",
    circuitId: "main",
    componentId: "stage",
    blockId: block.id,
    reason: block.netlist.kind === "schematic_only" ? block.netlist.reason : "",
  } as const;
  const candidate: DesignResultV2["candidates"][number] = {
    schemaVersion: 2,
    id: `candidate:v2:sha256:${"2".repeat(64)}`,
    requestHash,
    recipeId: "test.kicad-omission",
    libraryVersion: migration.request.libraryVersion,
    components: [],
    derivedValues: [],
    constraints: [],
    metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
    simulationCoverage: [{
      scenarioId: "op",
      modelTier: "unavailable",
      limitations: [canonicalDesignV2Payload(omission)],
    }],
    circuit: {
      format: "opencircuit-circuit",
      version: 4,
      meta: { title: "Schematic-only omission fixture" },
      designBlocks: [block],
      circuits: [{
        id: "main",
        title: "Main graph",
        components: [
          { id: "ground", type: "ground", pos: [0, 4], rot: 0, mirror: false },
          {
            id: "stage",
            type: "design_block",
            pos: [0, 0],
            rot: 0,
            mirror: false,
            block: { id: block.id, version: block.version, contentHash: block.contentHash },
          },
        ],
        wires: [],
        probes: [],
      }],
      scenarios: [{ id: "op", title: "Operating point", circuitId: "main", config: { mode: "op" } }],
      defaultCircuitId: "main",
      defaultScenarioId: "op",
    },
    circuitInstanceClassifications: [
      { circuitId: "main", componentId: "ground", kind: "non_bom", reason: "Reference node" },
      {
        circuitId: "main",
        componentId: "stage",
        kind: "non_bom",
        reason: "Schematic-only behavioral block",
      },
    ],
    circuitBomNonRepresentations: [],
    warnings: ["No executable reviewed model is installed."],
  };
  const payload: Omit<DesignResultV2, "contentHash"> = {
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
  return { ...payload, contentHash: canonicalDesignResultV2ContentHash(payload) };
}

function assertValidFixture(result: DesignResultV2): void {
  const circuitIssues = validateCircuitV4(result.candidates[0]!.circuit);
  if (circuitIssues.length > 0) throw new Error(JSON.stringify(circuitIssues));
  try {
    parseDesignResultV2(result);
  } catch (error) {
    throw new Error(JSON.stringify((error as { issues?: unknown }).issues ?? error));
  }
}

describe("KiCad schematic execution and omission boundary", () => {
  it("binds the scenario projection and keeps every unavailable-model omission visible", () => {
    const result = omissionResult();
    assertValidFixture(result);
    const candidate = result.candidates[0]!;
    const file = exportDesignResultKicadSchematicV2(result, candidate.id, "main", exactOptions);
    const parsed = parseDesignResultKicadSchematicV2(file, result, exactOptions);
    const scenario = parsed.scenarios[0]!;

    expect(parsed.executionContextState).toBe("verified_against_persisted_coverage");
    expect(scenario.coverage.modelTier).toBe("unavailable");
    expect(scenario.execution.omissions).toHaveLength(1);
    expect(scenario.execution.netlistContentHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(scenario.execution.scenarioHash).toBeTruthy();
    expect(scenario.execution.serializationHash).toBeTruthy();
    expect(parsed.visibleNotices).toContain(
      "Execution omission stage: No executable reviewed model is installed.",
    );
    expect(file).toContain(JSON.stringify("Execution omission stage: No executable reviewed model is installed."));
    expect(file).toContain(JSON.stringify("Schematic-only block stage: No executable reviewed model is installed."));
  });

  it("uses the real execution validator and rejects unresolved trusted-model coverage", () => {
    const exactResult = omissionResult();
    const tampered = structuredClone(exactResult);
    const block = tampered.candidates[0]!.circuit.designBlocks[0]!;
    const blockPayload: Omit<DesignBlockDefinition, "contentHash"> = {
      id: block.id,
      version: block.version,
      title: block.title,
      pins: block.pins,
      netlist: {
        kind: "spice_subcircuit",
        asset: {
          assetId: "fixture.unresolved-stage",
          contentHash: `sha256:${"4".repeat(64)}`,
          entrypoint: "UNRESOLVED_STAGE",
        },
        pinOrder: ["in", "out"],
      },
    };
    const executableBlock = { ...blockPayload, contentHash: calculateDesignBlockContentHash(blockPayload) };
    tampered.candidates[0]!.circuit.designBlocks[0] = executableBlock;
    const blockComponent = tampered.candidates[0]!.circuit.circuits[0]!.components.find((entry) => entry.id === "stage");
    if (blockComponent?.type !== "design_block") throw new Error("Expected design block component");
    blockComponent.block = {
      id: executableBlock.id,
      version: executableBlock.version,
      contentHash: executableBlock.contentHash,
    };
    tampered.candidates[0]!.simulationCoverage[0] = {
      scenarioId: "op",
      modelTier: "behavioral",
      limitations: ["Trusted model resolution remains execution-context dependent."],
    };
    const { contentHash: _contentHash, ...payload } = tampered;
    tampered.contentHash = canonicalDesignResultV2ContentHash(payload);
    assertValidFixture(tampered);
    const candidate = tampered.candidates[0]!;
    expect(() => exportDesignResultKicadSchematicV2(tampered, candidate.id, "main", exactOptions)).toThrowError(expect.objectContaining({
      name: "CandidateKicadSchematicExportErrorV2",
      code: "execution_context_unverified",
    }));
    expect(new CandidateKicadSchematicExportErrorV2("execution_context_unverified").code)
      .toBe("execution_context_unverified");
  });
});
