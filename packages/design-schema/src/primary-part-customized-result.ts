import type { Sha256ContentHash } from "@opencircuit/circuit-schema";
import type { DesignApplication } from "./application";
import {
  parsePrimaryPartCustomizationSidecarV1Text,
  serializePrimaryPartCustomizationSidecarV1,
  type PrimaryPartCustomizationSidecarV1,
} from "./primary-part-customization";
import {
  boundedDetachedFrozenDesignV2Value,
  canonicalDesignV2Payload,
  canonicalElectricalDesignRequestV2Payload,
  containsUnsafeDesignDisplayCharactersV2,
  designSha256ContentHash,
  detachedFrozenDesignV2Value,
} from "./v2-canonical";
import { parseDesignResultV2 } from "./v2-result";
import type { CandidateIdV2, DesignResultV2 } from "./v2-types";
import { parseConstraintDecisionV3 } from "./v3-constraint";
import type { ConstraintDecisionV3 } from "./v3-constraint-types";

const FORMAT = "schemagic-designer-primary-part-customized-result";
const SCHEMA_VERSION = 1;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/u;

export const PRIMARY_PART_CUSTOMIZED_RESULT_MAX_BYTES = 3 * 1024 * 1024;

export type PrimaryPartCustomizedResultParseErrorCodeV1 = "invalid_customized_result" | "resource_limit";

export class PrimaryPartCustomizedResultParseErrorV1 extends Error {
  readonly code: PrimaryPartCustomizedResultParseErrorCodeV1;
  readonly path: string;

  constructor(code: PrimaryPartCustomizedResultParseErrorCodeV1, path = "") {
    super(code === "resource_limit"
      ? "Primary-part customized result exceeds the supported limits."
      : `Primary-part customized result is invalid at ${path || "/"}.`);
    this.name = "PrimaryPartCustomizedResultParseErrorV1";
    this.code = code;
    this.path = path;
  }
}

export interface PrimaryPartCustomizedResultSourceV1 {
  readonly resultContentHash: Sha256ContentHash;
  readonly executionReportContentHash: Sha256ContentHash;
  readonly candidateId: CandidateIdV2;
}

export interface PrimaryPartCustomizedResultClaimBoundaryV1 {
  readonly ordinaryGenerationMutation: "none";
  readonly targetConstraintPolicyEligibility: "evaluated";
  readonly ranking: "not_recomputed";
  readonly selectedPartModel: "not_added";
  readonly commercialAuthority: "not_added";
}

export interface PrimaryPartCustomizedResultDraftV1 {
  readonly format: typeof FORMAT;
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly application: DesignApplication;
  readonly instruction: Readonly<PrimaryPartCustomizationSidecarV1>;
  readonly source: Readonly<PrimaryPartCustomizedResultSourceV1>;
  readonly contextManifestContentHash: Sha256ContentHash;
  readonly targetResultProjection: Readonly<DesignResultV2>;
  readonly constraintDecision: Readonly<ConstraintDecisionV3>;
  readonly claimBoundary: Readonly<PrimaryPartCustomizedResultClaimBoundaryV1>;
}

export interface PrimaryPartCustomizedResultSidecarV1 extends PrimaryPartCustomizedResultDraftV1 {
  readonly contentHash: Sha256ContentHash;
}

function fail(path = ""): never {
  throw new PrimaryPartCustomizedResultParseErrorV1("invalid_customized_result", path);
}

function snapshot(input: unknown): unknown {
  try {
    return boundedDetachedFrozenDesignV2Value(
      input,
      "design_result",
      PRIMARY_PART_CUSTOMIZED_RESULT_MAX_BYTES,
    );
  } catch (error) {
    const resource = Boolean(
      error
      && typeof error === "object"
      && "detail" in error
      && (error as { detail?: { code?: unknown } }).detail?.code === "resource_limit",
    );
    throw new PrimaryPartCustomizedResultParseErrorV1(
      resource ? "resource_limit" : "invalid_customized_result",
    );
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) fail(path);
}

function exactHash(value: unknown, path: string): Sha256ContentHash {
  if (typeof value !== "string" || !HASH.test(value)) fail(path);
  return value as Sha256ContentHash;
}

function exactCandidateId(value: unknown, path: string): CandidateIdV2 {
  if (typeof value !== "string" || !CANDIDATE_ID.test(value)) fail(path);
  return value as CandidateIdV2;
}

function exactApplication(value: unknown): DesignApplication {
  if (value !== "motor.brushed-dc" && value !== "power.buck") fail("/application");
  return value;
}

function exactInstruction(value: unknown): PrimaryPartCustomizationSidecarV1 {
  try {
    return parsePrimaryPartCustomizationSidecarV1Text(
      serializePrimaryPartCustomizationSidecarV1(value as PrimaryPartCustomizationSidecarV1),
    ).sidecar;
  } catch {
    return fail("/instruction");
  }
}

function exactClaimBoundary(value: unknown): PrimaryPartCustomizedResultClaimBoundaryV1 {
  const boundary = record(value, "/claimBoundary");
  exactKeys(boundary, [
    "ordinaryGenerationMutation",
    "targetConstraintPolicyEligibility",
    "ranking",
    "selectedPartModel",
    "commercialAuthority",
  ], "/claimBoundary");
  if (
    boundary.ordinaryGenerationMutation !== "none"
    || boundary.targetConstraintPolicyEligibility !== "evaluated"
    || boundary.ranking !== "not_recomputed"
    || boundary.selectedPartModel !== "not_added"
    || boundary.commercialAuthority !== "not_added"
  ) fail("/claimBoundary");
  return {
    ordinaryGenerationMutation: "none",
    targetConstraintPolicyEligibility: "evaluated",
    ranking: "not_recomputed",
    selectedPartModel: "not_added",
    commercialAuthority: "not_added",
  };
}

function parseDraft(input: unknown): PrimaryPartCustomizedResultDraftV1 {
  const value = record(snapshot(input), "");
  const keys = [
    "format",
    "schemaVersion",
    "application",
    "instruction",
    "source",
    "contextManifestContentHash",
    "targetResultProjection",
    "constraintDecision",
    "claimBoundary",
  ];
  const hasContentHash = Object.prototype.hasOwnProperty.call(value, "contentHash");
  exactKeys(value, hasContentHash ? [...keys, "contentHash"] : keys, "");
  if (value.format !== FORMAT || value.schemaVersion !== SCHEMA_VERSION) fail("");

  const application = exactApplication(value.application);
  const instruction = exactInstruction(value.instruction);
  const sourceValue = record(value.source, "/source");
  exactKeys(sourceValue, ["resultContentHash", "executionReportContentHash", "candidateId"], "/source");
  const source: PrimaryPartCustomizedResultSourceV1 = {
    resultContentHash: exactHash(sourceValue.resultContentHash, "/source/resultContentHash"),
    executionReportContentHash: exactHash(sourceValue.executionReportContentHash, "/source/executionReportContentHash"),
    candidateId: exactCandidateId(sourceValue.candidateId, "/source/candidateId"),
  };
  const contextManifestContentHash = exactHash(value.contextManifestContentHash, "/contextManifestContentHash");

  let targetResultProjection: DesignResultV2;
  let constraintDecision: ConstraintDecisionV3;
  try { targetResultProjection = parseDesignResultV2(value.targetResultProjection); }
  catch { return fail("/targetResultProjection"); }
  try { constraintDecision = parseConstraintDecisionV3(value.constraintDecision); }
  catch { return fail("/constraintDecision"); }
  const claimBoundary = exactClaimBoundary(value.claimBoundary);

  if (
    instruction.application !== application
    || instruction.sourceResultContentHash !== source.resultContentHash
    || instruction.sourceCandidateId !== source.candidateId
    || instruction.context.contextManifestContentHash !== contextManifestContentHash
  ) fail("/source");
  if (
    targetResultProjection.request.application !== application
    || targetResultProjection.requestHash !== instruction.requestHash
    || designSha256ContentHash(canonicalElectricalDesignRequestV2Payload(targetResultProjection.request))
      !== instruction.requestByteContentHash
    || targetResultProjection.libraryVersion !== instruction.context.libraryVersion
    || targetResultProjection.libraryContentHash !== contextManifestContentHash
    || targetResultProjection.candidates.length !== 1
    || targetResultProjection.rejectedCandidates.length !== 0
    || targetResultProjection.diagnostics.length !== 0
  ) fail("/targetResultProjection");
  const target = targetResultProjection.candidates[0]!;
  const targetPrimaries = target.components.filter((component) => component.id === "primary");
  if (
    target.id === source.candidateId
    || target.recipeId !== instruction.context.recipe.id
    || targetPrimaries.length !== 1
    || targetPrimaries[0]!.profileId !== instruction.substitution.targetProfile.profileId
  ) fail("/targetResultProjection/candidates/0");
  const policyCandidate = constraintDecision.candidates[0];
  if (
    constraintDecision.source.resultContentHash !== targetResultProjection.contentHash
    || constraintDecision.source.candidateIds.length !== 1
    || constraintDecision.source.candidateIds[0] !== target.id
    || constraintDecision.policy.constraintPolicy !== instruction.context.constraintPolicy.id
    || constraintDecision.policy.contentHash !== instruction.context.constraintPolicy.contentHash
    || constraintDecision.candidates.length !== 1
    || policyCandidate?.candidateId !== target.id
    || policyCandidate.recipeId !== target.recipeId
    || policyCandidate.recipeContentHash !== instruction.context.recipe.contentHash
    || constraintDecision.eligibleCandidateIds.some((candidateId) => candidateId !== target.id)
  ) fail("/constraintDecision");

  return {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    application,
    instruction,
    source,
    contextManifestContentHash,
    targetResultProjection,
    constraintDecision,
    claimBoundary,
  };
}

export function canonicalPrimaryPartCustomizedResultPayload(
  sidecar: Readonly<PrimaryPartCustomizedResultDraftV1 | PrimaryPartCustomizedResultSidecarV1>,
): string {
  return canonicalDesignV2Payload(sidecar, true);
}

export function calculatePrimaryPartCustomizedResultContentHash(
  sidecar: Readonly<PrimaryPartCustomizedResultDraftV1 | PrimaryPartCustomizedResultSidecarV1>,
): Sha256ContentHash {
  return designSha256ContentHash(canonicalPrimaryPartCustomizedResultPayload(sidecar));
}

export function createPrimaryPartCustomizedResultSidecarV1(
  input: Readonly<PrimaryPartCustomizedResultDraftV1>,
): PrimaryPartCustomizedResultSidecarV1 {
  const draft = parseDraft(input);
  return parsePrimaryPartCustomizedResultSidecarV1({
    ...draft,
    contentHash: calculatePrimaryPartCustomizedResultContentHash(draft),
  });
}

export function parsePrimaryPartCustomizedResultSidecarV1(
  input: unknown,
): PrimaryPartCustomizedResultSidecarV1 {
  const value = record(snapshot(input), "");
  if (!Object.prototype.hasOwnProperty.call(value, "contentHash")) fail("/contentHash");
  const draft = parseDraft(value);
  const contentHash = exactHash(value.contentHash, "/contentHash");
  if (contentHash !== calculatePrimaryPartCustomizedResultContentHash(draft)) fail("/contentHash");
  return detachedFrozenDesignV2Value({ ...draft, contentHash });
}

export function serializePrimaryPartCustomizedResultSidecarV1(
  sidecar: Readonly<PrimaryPartCustomizedResultSidecarV1>,
): string {
  const parsed = parsePrimaryPartCustomizedResultSidecarV1(sidecar);
  const source = canonicalDesignV2Payload(parsed);
  if (source.length > PRIMARY_PART_CUSTOMIZED_RESULT_MAX_BYTES) {
    throw new PrimaryPartCustomizedResultParseErrorV1("resource_limit");
  }
  if (new TextEncoder().encode(source).byteLength > PRIMARY_PART_CUSTOMIZED_RESULT_MAX_BYTES) {
    throw new PrimaryPartCustomizedResultParseErrorV1("resource_limit");
  }
  if (containsUnsafeDesignDisplayCharactersV2(source)) fail("");
  return source;
}
