import {
  canonicalDesignV2Payload,
  designSha256ContentHash,
  parseDesignResultV2,
  type CandidateIdV2,
  type DesignResultV2,
  type Sha256ContentHash,
} from "@opencircuit/design-schema";
import {
  planDesignResultScenarioExportsV2,
  type CandidateScenarioExportPlanV2,
} from "@opencircuit/design-export/scenario-plan-v2";

export type ScenarioGatePlanExportErrorCodeV2 =
  | "invalid_result"
  | "candidate_not_found"
  | "invalid_artifact"
  | "resource_limit";

export class ScenarioGatePlanExportErrorV2 extends Error {
  readonly code: ScenarioGatePlanExportErrorCodeV2;

  constructor(code: ScenarioGatePlanExportErrorCodeV2) {
    super(code === "invalid_result"
      ? "Scenario gate plan export requires a strictly valid V2 design result."
      : code === "candidate_not_found"
        ? "The selected candidate is absent from the exact V2 design result."
        : code === "resource_limit"
          ? "Scenario gate plan exceeds the supported export limit."
          : "Scenario gate plan failed exact byte verification.");
    this.name = "ScenarioGatePlanExportErrorV2";
    this.code = code;
  }
}

export interface ScenarioGatePlanArtifactV2 {
  readonly format: "schemagic-scenario-gate-plan";
  readonly schemaVersion: 2;
  readonly artifactKind: "structural_export_gate_plan";
  readonly contentHash: Sha256ContentHash;
  readonly boundaries: {
    readonly engineeringContext: "not_present";
    readonly executionContext: "not_present";
    readonly commercialData: "not_included";
    readonly spiceNetlist: "not_included";
    readonly simulationData: "not_included";
    readonly simulationAttestation: "none";
    readonly physicalImplementation: "not_verified";
    readonly candidateRankingUse: "prohibited";
  };
  readonly designResultRef: {
    readonly contentHash: DesignResultV2["contentHash"];
    readonly requestHash: DesignResultV2["requestHash"];
    readonly libraryVersion: string;
    readonly libraryContentHash: DesignResultV2["libraryContentHash"];
  };
  readonly plan: CandidateScenarioExportPlanV2;
}

export const SCENARIO_GATE_PLAN_MAX_BYTES = 16 * 1024 * 1024;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function exactResult(input: Readonly<DesignResultV2>): DesignResultV2 {
  try {
    return parseDesignResultV2(input);
  } catch {
    throw new ScenarioGatePlanExportErrorV2("invalid_result");
  }
}

function artifactFor(
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
): ScenarioGatePlanArtifactV2 {
  if (!result.candidates.some((candidate) => candidate.id === candidateId)) {
    throw new ScenarioGatePlanExportErrorV2("candidate_not_found");
  }
  const plan = planDesignResultScenarioExportsV2(result, candidateId);
  const payload: Omit<ScenarioGatePlanArtifactV2, "contentHash"> = {
    format: "schemagic-scenario-gate-plan",
    schemaVersion: 2,
    artifactKind: "structural_export_gate_plan",
    boundaries: {
      engineeringContext: "not_present",
      executionContext: "not_present",
      commercialData: "not_included",
      spiceNetlist: "not_included",
      simulationData: "not_included",
      simulationAttestation: "none",
      physicalImplementation: "not_verified",
      candidateRankingUse: "prohibited",
    },
    designResultRef: {
      contentHash: result.contentHash,
      requestHash: result.requestHash,
      libraryVersion: result.libraryVersion,
      libraryContentHash: result.libraryContentHash,
    },
    plan,
  };
  return {
    ...payload,
    contentHash: designSha256ContentHash(canonicalDesignV2Payload(payload)),
  };
}

/**
 * Export only the deterministic structural gate plan available from a strict V2
 * result. The artifact deliberately contains no circuit graph, netlist,
 * simulation, commercial, or engineering-context bytes.
 */
export function serializeScenarioGatePlanV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
): string {
  const source = canonicalDesignV2Payload(artifactFor(exactResult(resultInput), candidateId));
  if (new TextEncoder().encode(source).byteLength > SCENARIO_GATE_PLAN_MAX_BYTES) {
    throw new ScenarioGatePlanExportErrorV2("resource_limit");
  }
  return source;
}

/**
 * Verify an exported plan by regenerating its exact canonical bytes from the
 * authoritative V2 result. Parsed fields alone never establish authenticity.
 */
export function parseScenarioGatePlanV2(
  source: string,
  resultInput: Readonly<DesignResultV2>,
): ScenarioGatePlanArtifactV2 {
  if (new TextEncoder().encode(source).byteLength > SCENARIO_GATE_PLAN_MAX_BYTES) {
    throw new ScenarioGatePlanExportErrorV2("resource_limit");
  }
  const result = exactResult(resultInput);
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch {
    throw new ScenarioGatePlanExportErrorV2("invalid_artifact");
  }
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ScenarioGatePlanExportErrorV2("invalid_artifact");
  }
  const plan = (input as Record<string, unknown>).plan;
  if (plan === null || typeof plan !== "object" || Array.isArray(plan)) {
    throw new ScenarioGatePlanExportErrorV2("invalid_artifact");
  }
  const candidateId = (plan as Record<string, unknown>).candidateId;
  if (typeof candidateId !== "string") throw new ScenarioGatePlanExportErrorV2("invalid_artifact");

  let expected: string;
  try {
    expected = serializeScenarioGatePlanV2(result, candidateId as CandidateIdV2);
  } catch (error) {
    if (error instanceof ScenarioGatePlanExportErrorV2 && error.code === "resource_limit") throw error;
    throw new ScenarioGatePlanExportErrorV2("invalid_artifact");
  }
  if (source !== expected) throw new ScenarioGatePlanExportErrorV2("invalid_artifact");
  return deepFreeze(JSON.parse(expected) as ScenarioGatePlanArtifactV2);
}
