import {
  parseDesignResultV2,
  type CandidateIdV2,
  type DesignResultV2,
} from "@opencircuit/design-schema";

export type CandidateScenarioExportPlanErrorCodeV2 = "invalid_result" | "candidate_not_found";

export class CandidateScenarioExportPlanErrorV2 extends Error {
  readonly code: CandidateScenarioExportPlanErrorCodeV2;

  constructor(code: CandidateScenarioExportPlanErrorCodeV2) {
    super("scheMAGIC scenario export planning was rejected");
    this.name = "CandidateScenarioExportPlanErrorV2";
    this.code = code;
  }
}

export type ScenarioSpiceExportGateV2 =
  | "export_requires_verified_context"
  | "incomplete_export_requires_verified_context_and_opt_in"
  | "no_scenario";

export interface ScenarioExportPlanEntryV2 {
  scenarioId: string;
  title: string | null;
  circuitId: string | null;
  circuitTitle: string | null;
  analysisMode: "op" | "tran" | "ac" | "dc-sweep" | "noise" | null;
  coverageTier: "behavioral" | "unavailable";
  limitations: readonly string[];
  isDefaultScenario: boolean;
  isDefaultCircuit: boolean;
  componentCount: number | null;
  probeCount: number | null;
  schematicOnlyInstanceCount: number | null;
  spiceExportGate: ScenarioSpiceExportGateV2;
}

export interface CandidateScenarioExportPlanV2 {
  candidateId: CandidateIdV2;
  entries: readonly ScenarioExportPlanEntryV2[];
}

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function designBlockKey(ref: Readonly<{ id: string; version: string; contentHash: string }>): string {
  return `${ref.id}\u0000${ref.version}\u0000${ref.contentHash}`;
}

/**
 * Inspect the structural preconditions for per-scenario SPICE export.
 *
 * This deliberately does not accept or validate engineering/execution context,
 * generate a netlist, or promote a coverage tier. It gives UI consumers a
 * deterministic explanation of which exact gate remains for each persisted
 * coverage record.
 */
export function planDesignResultScenarioExportsV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
): CandidateScenarioExportPlanV2 {
  let result: DesignResultV2;
  try {
    result = parseDesignResultV2(resultInput);
  } catch {
    throw new CandidateScenarioExportPlanErrorV2("invalid_result");
  }
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new CandidateScenarioExportPlanErrorV2("candidate_not_found");

  const definitions = new Map(candidate.circuit.designBlocks.map((definition) => [designBlockKey(definition), definition]));
  const entries = [...candidate.simulationCoverage]
    .sort((left, right) => compareText(left.scenarioId, right.scenarioId))
    .map((coverage): ScenarioExportPlanEntryV2 => {
      const scenario = candidate.circuit.scenarios.find((entry) => entry.id === coverage.scenarioId);
      const graph = scenario === undefined
        ? undefined
        : candidate.circuit.circuits.find((entry) => entry.id === scenario.circuitId);
      const schematicOnlyInstanceCount = graph === undefined
        ? null
        : graph.components.filter((component) => component.type === "design_block"
          && definitions.get(designBlockKey(component.block))?.netlist.kind === "schematic_only").length;
      const spiceExportGate: ScenarioSpiceExportGateV2 = scenario === undefined
        ? "no_scenario"
        : coverage.modelTier === "unavailable"
          ? "incomplete_export_requires_verified_context_and_opt_in"
          : "export_requires_verified_context";
      return Object.freeze({
        scenarioId: coverage.scenarioId,
        title: scenario?.title ?? null,
        circuitId: scenario?.circuitId ?? null,
        circuitTitle: graph?.title ?? null,
        analysisMode: scenario?.config.mode ?? null,
        coverageTier: coverage.modelTier,
        limitations: Object.freeze([...coverage.limitations]),
        isDefaultScenario: scenario !== undefined && candidate.circuit.defaultScenarioId === scenario.id,
        isDefaultCircuit: graph !== undefined && candidate.circuit.defaultCircuitId === graph.id,
        componentCount: graph?.components.length ?? null,
        probeCount: graph?.probes.length ?? null,
        schematicOnlyInstanceCount,
        spiceExportGate,
      });
    });

  return Object.freeze({
    candidateId: candidate.id,
    entries: Object.freeze(entries),
  });
}
