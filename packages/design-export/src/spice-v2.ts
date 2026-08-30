import {
  canonicalDesignV2Payload,
  designSha256ContentHash,
  parseDesignResultV2,
  type CandidateIdV2,
  type DesignResultV2,
  type DesignValidationIssue,
} from "@opencircuit/design-schema";
import {
  validateDesignResultEngineeringContextV2,
  validateDesignResultExecutionContextV2,
  type DesignResultExecutionContextV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-export-runtime";
import { generateScenarioNetlist } from "@opencircuit/circuit-schema/v4-netlist";

export type CandidateScenarioSpiceExportErrorCodeV2 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "candidate_not_found"
  | "scenario_not_found"
  | "coverage_unavailable"
  | "execution_context_invalid"
  | "generation_failed";

export class CandidateScenarioSpiceExportErrorV2 extends Error {
  readonly code: CandidateScenarioSpiceExportErrorCodeV2;
  readonly issues: readonly DesignValidationIssue[];

  constructor(
    code: CandidateScenarioSpiceExportErrorCodeV2,
    issues: readonly DesignValidationIssue[] = [],
  ) {
    super("scheMAGIC scenario SPICE export was rejected");
    this.name = "CandidateScenarioSpiceExportErrorV2";
    this.code = code;
    this.issues = Object.freeze([...issues]);
  }
}

const SAFE_COMMENT_LABEL = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const COMMENT_LINE_BREAKS = /\r\n|\r|\n|\u0085|\u2028|\u2029/gu;

function escapeCommentControls(value: string): string {
  let escaped = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      throw new TypeError("SPICE comment text must contain Unicode scalar values");
    }
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      escaped += `\\u{${codePoint.toString(16).toUpperCase()}}`;
    } else {
      escaped += character;
    }
  }
  return escaped;
}

/** Encode arbitrary text as injection-safe physical SPICE comment lines. */
export function encodeSpiceCommentLinesV2(label: string, value: string): string[] {
  if (!SAFE_COMMENT_LABEL.test(label)) throw new TypeError("SPICE comment label must be a closed ASCII token");
  return value.split(COMMENT_LINE_BREAKS).map((line) => `* ${label} ${escapeCommentControls(line)}`);
}

function commentsForScenario(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignResultV2["candidates"][number]>,
  scenarioId: string,
  tier: "behavioral" | "unavailable",
  limitations: readonly string[],
  omissions: readonly {
    code: string;
    scenarioId: string;
    circuitId: string;
    componentId: string;
    blockId: string;
    reason: string;
  }[],
): string[] {
  const comments = [
    ...encodeSpiceCommentLinesV2("schemagic", "Designer V2 scenario export"),
    ...encodeSpiceCommentLinesV2("result-hash", result.contentHash),
    ...encodeSpiceCommentLinesV2("candidate-id", candidate.id),
    ...encodeSpiceCommentLinesV2("recipe-id", candidate.recipeId),
    ...encodeSpiceCommentLinesV2("scenario-id", scenarioId),
    ...encodeSpiceCommentLinesV2("coverage-tier", tier),
    ...encodeSpiceCommentLinesV2(
      "model-boundary",
      "Circuit behavior follows the declared scenario coverage; selected BOM identity does not imply a physical SPICE model.",
    ),
  ];
  if (tier === "unavailable") {
    comments.push(...encodeSpiceCommentLinesV2(
      "INCOMPLETE-MODE",
      "UNAVAILABLE COVERAGE: schematic-only blocks were explicitly omitted; do not treat this deck as complete, validated, or ranking evidence.",
    ));
  }
  for (const warning of candidate.warnings) comments.push(...encodeSpiceCommentLinesV2("candidate-warning", warning));
  for (const limitation of limitations) comments.push(...encodeSpiceCommentLinesV2("limitation", limitation));
  for (const omission of [...omissions].sort((left, right) => {
    const leftKey = canonicalDesignV2Payload(left);
    const rightKey = canonicalDesignV2Payload(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  })) {
    comments.push(...encodeSpiceCommentLinesV2("omission", canonicalDesignV2Payload(omission)));
  }
  return comments;
}

export interface BehavioralScenarioSpiceProjectionV2 {
  readonly payload: string;
  readonly scenario: Readonly<{
    scenarioId: string;
    circuitId: string;
    analysisMode: "op" | "tran" | "ac" | "dc-sweep" | "noise";
    scenarioHash: string;
    serializationHash: string;
    netlistContentHash: `sha256:${string}`;
    coverageTier: "behavioral";
    limitations: readonly string[];
    omissionCount: 0;
  }>;
}

/** @internal Closed gate shared by the installed projection and focused tests. */
export function _assertBehavioralScenarioSpiceGateV2(
  candidate: Readonly<DesignResultV2["candidates"][number]>,
  scenarioId: string,
): void {
  if (candidate.circuit.defaultScenarioId === null
    || scenarioId !== candidate.circuit.defaultScenarioId) {
    throw new CandidateScenarioSpiceExportErrorV2("scenario_not_found");
  }
  const coverage = candidate.simulationCoverage.filter((entry) => entry.scenarioId === scenarioId);
  if (coverage.length !== 1) throw new CandidateScenarioSpiceExportErrorV2("scenario_not_found");
  if (coverage[0]!.modelTier !== "behavioral") {
    throw new CandidateScenarioSpiceExportErrorV2("coverage_unavailable");
  }
  const scenarios = candidate.circuit.scenarios.filter((entry) => entry.id === scenarioId);
  if (scenarios.length !== 1) throw new CandidateScenarioSpiceExportErrorV2("scenario_not_found");
  if (!candidate.circuit.circuits.some((entry) => entry.id === scenarios[0]!.circuitId)) {
    throw new CandidateScenarioSpiceExportErrorV2("scenario_not_found");
  }
}

/**
 * @internal Render the exact persisted default behavioral scenario without an
 * engineering-context bypass or an incomplete-mode option. Installed callers
 * must separately reassert the customized result and exact manifest.
 */
export function _renderBehavioralScenarioSpiceV2FromProjection(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  scenarioId: string,
  executionContext: Readonly<DesignResultExecutionContextV2>,
): Readonly<BehavioralScenarioSpiceProjectionV2> {
  let result: DesignResultV2;
  try {
    result = parseDesignResultV2(resultInput);
  } catch {
    throw new CandidateScenarioSpiceExportErrorV2("invalid_result");
  }
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new CandidateScenarioSpiceExportErrorV2("candidate_not_found");
  _assertBehavioralScenarioSpiceGateV2(candidate, scenarioId);
  const coverage = candidate.simulationCoverage.filter((entry) => entry.scenarioId === scenarioId);
  const scenario = candidate.circuit.scenarios.find((entry) => entry.id === scenarioId)!;
  const executionIssues = validateDesignResultExecutionContextV2(result, executionContext);
  if (executionIssues.length > 0) {
    throw new CandidateScenarioSpiceExportErrorV2("execution_context_invalid", executionIssues);
  }

  try {
    const generated = generateScenarioNetlist(candidate.circuit, scenarioId, {
      ...(executionContext.trustedSubcircuitRegistry === undefined
        ? {}
        : { registry: executionContext.trustedSubcircuitRegistry }),
    });
    if (generated.omissions.length !== 0) {
      throw new CandidateScenarioSpiceExportErrorV2("execution_context_invalid");
    }
    const firstLineEnd = generated.netlist.indexOf("\n");
    if (firstLineEnd < 0) throw new Error("Generated deck has no title line");
    const comments = commentsForScenario(
      result,
      candidate,
      scenarioId,
      "behavioral",
      coverage[0]!.limitations,
      generated.omissions,
    );
    const payload = `${generated.netlist.slice(0, firstLineEnd + 1)}${comments.join("\n")}\n${generated.netlist.slice(firstLineEnd + 1)}`;
    return Object.freeze({
      payload,
      scenario: Object.freeze({
        scenarioId,
        circuitId: scenario.circuitId,
        analysisMode: scenario.config.mode,
        scenarioHash: generated.scenarioHash,
        serializationHash: generated.serializationHash,
        netlistContentHash: designSha256ContentHash(generated.netlist),
        coverageTier: "behavioral" as const,
        limitations: Object.freeze([...coverage[0]!.limitations]),
        omissionCount: 0 as const,
      }),
    });
  } catch (error) {
    if (error instanceof CandidateScenarioSpiceExportErrorV2) throw error;
    throw new CandidateScenarioSpiceExportErrorV2("generation_failed");
  }
}

/**
 * Export one explicitly selected V2 scenario. Both engineering provenance and
 * execution coverage must validate before any generated deck is returned.
 */
export function exportDesignResultScenarioSpiceV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  scenarioId: string,
  options: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    executionContext: DesignResultExecutionContextV2;
    allowIncomplete?: boolean;
  }>,
): string {
  let result: DesignResultV2;
  try {
    result = parseDesignResultV2(resultInput);
  } catch {
    throw new CandidateScenarioSpiceExportErrorV2("invalid_result");
  }
  const engineeringIssues = validateDesignResultEngineeringContextV2(result, options.engineeringContext);
  if (engineeringIssues.length > 0) {
    throw new CandidateScenarioSpiceExportErrorV2("engineering_context_unverified", engineeringIssues);
  }
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new CandidateScenarioSpiceExportErrorV2("candidate_not_found");
  const coverage = candidate.simulationCoverage.find((entry) => entry.scenarioId === scenarioId);
  if (coverage === undefined) throw new CandidateScenarioSpiceExportErrorV2("scenario_not_found");
  const scenario = candidate.circuit.scenarios.find((entry) => entry.id === scenarioId);
  if (coverage.modelTier === "unavailable" && (scenario === undefined || options.allowIncomplete !== true)) {
    throw new CandidateScenarioSpiceExportErrorV2("coverage_unavailable");
  }
  if (scenario === undefined) throw new CandidateScenarioSpiceExportErrorV2("scenario_not_found");
  const executionIssues = validateDesignResultExecutionContextV2(result, options.executionContext);
  if (executionIssues.length > 0) {
    throw new CandidateScenarioSpiceExportErrorV2("execution_context_invalid", executionIssues);
  }

  try {
    const generated = generateScenarioNetlist(candidate.circuit, scenarioId, {
      ...(options.executionContext.trustedSubcircuitRegistry === undefined
        ? {}
        : { registry: options.executionContext.trustedSubcircuitRegistry }),
    });
    if (coverage.modelTier === "behavioral" && generated.omissions.length !== 0) {
      throw new CandidateScenarioSpiceExportErrorV2("execution_context_invalid");
    }
    if (coverage.modelTier === "unavailable" && generated.omissions.length === 0) {
      throw new CandidateScenarioSpiceExportErrorV2("execution_context_invalid");
    }
    const firstLineEnd = generated.netlist.indexOf("\n");
    if (firstLineEnd < 0) throw new Error("Generated deck has no title line");
    const comments = commentsForScenario(
      result,
      candidate,
      scenarioId,
      coverage.modelTier,
      coverage.limitations,
      generated.omissions,
    );
    return `${generated.netlist.slice(0, firstLineEnd + 1)}${comments.join("\n")}\n${generated.netlist.slice(firstLineEnd + 1)}`;
  } catch (error) {
    if (error instanceof CandidateScenarioSpiceExportErrorV2) throw error;
    throw new CandidateScenarioSpiceExportErrorV2("generation_failed");
  }
}
