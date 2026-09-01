import {
  boundedDetachedFrozenDesignV2Value,
  canonicalDesignV2Payload,
  canonicalDesignV2Value,
  compareDesignV2Tokens,
  containsUnsafeDesignDisplayCharactersV2,
  designSha256ContentHash,
  detachedFrozenDesignV2Value,
} from "./v2-canonical";
import {
  ConstraintParseErrorV3,
  PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  type CandidateConstraintDecisionV3,
  type ConstraintCriticalityV3,
  type ConstraintDecisionV3,
  type ConstraintDispositionV3,
  type ConstraintParseArtifactV3,
  type ConstraintPolicyCatalogV3,
  type ConstraintTruthSourceStatusV3,
  type ConstraintTruthV3,
} from "./v3-constraint-types";

const HASH = /^sha256:[0-9a-f]{64}$/u;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/u;
const ELECTRICAL_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const RESERVED = ["sourcing.", "commercial.", "offer.", "provider.", "distributor."] as const;
const MAX_CANONICAL_BYTES = 1_048_576;
const MAX_RECIPES = 256;
const MAX_RULES = 4_096;
const MAX_CANDIDATES = 4_096;
const MAX_RATIONALE_BYTES = 4_096;

function fail(artifact: ConstraintParseArtifactV3, path: string, code: "invalid_document" | "invalid_hash" | "invalid_order" | "resource_limit" = "invalid_document"): never {
  throw new ConstraintParseErrorV3(code, artifact, path);
}

function snapshot(input: unknown, artifact: ConstraintParseArtifactV3): unknown {
  try {
    return boundedDetachedFrozenDesignV2Value(input, artifact === "electrical_request" ? "electrical_request" : "design_result", MAX_CANONICAL_BYTES);
  } catch (error) {
    const resource = Boolean(error && typeof error === "object" && "detail" in error && (error as { detail?: { code?: unknown } }).detail?.code === "resource_limit");
    return fail(artifact, "", resource ? "resource_limit" : "invalid_document");
  }
}

function object(value: unknown, artifact: ConstraintParseArtifactV3, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(artifact, path);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: readonly string[], artifact: ConstraintParseArtifactV3, path: string): void {
  const expected = new Set(allowed);
  for (const key of Object.keys(value)) if (!expected.has(key)) fail(artifact, `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(value, key)) fail(artifact, `${path}/${key}`);
}

function safeString(value: unknown, artifact: ConstraintParseArtifactV3, path: string): string {
  if (typeof value !== "string" || value.length === 0 || containsUnsafeDesignDisplayCharactersV2(value)) return fail(artifact, path);
  return value;
}

function rationale(value: unknown, artifact: ConstraintParseArtifactV3, path: string): string {
  const parsed = safeString(value, artifact, path);
  if (new TextEncoder().encode(parsed).byteLength > MAX_RATIONALE_BYTES) fail(artifact, path, "resource_limit");
  return parsed;
}

function electricalId(value: unknown, artifact: ConstraintParseArtifactV3, path: string): string {
  const id = safeString(value, artifact, path);
  if (!ELECTRICAL_ID.test(id) || RESERVED.some((prefix) => id.startsWith(prefix))) fail(artifact, path);
  return id;
}

function sortedUnique(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) if (compareDesignV2Tokens(values[index - 1]!, values[index]!) >= 0) return false;
  return true;
}

function contentPayload(value: unknown): string {
  return canonicalDesignV2Payload(value, true);
}

export function canonicalConstraintPolicyCatalogV3Payload(policy: Omit<ConstraintPolicyCatalogV3, "contentHash"> | ConstraintPolicyCatalogV3): string {
  return contentPayload(policy);
}

export function calculateConstraintPolicyCatalogV3ContentHash(policy: Omit<ConstraintPolicyCatalogV3, "contentHash"> | ConstraintPolicyCatalogV3): `sha256:${string}` {
  return designSha256ContentHash(canonicalConstraintPolicyCatalogV3Payload(policy));
}

export function parseConstraintPolicyCatalogV3(input: unknown): ConstraintPolicyCatalogV3 {
  const artifact = "constraint_policy_catalog" as const;
  const policy = object(canonicalDesignV2Value(snapshot(input, artifact)), artifact, "");
  keys(policy, ["format", "schemaVersion", "constraintPolicy", "application", "recipePolicies", "contentHash"], artifact, "");
  if (policy.format !== "schemagic-constraint-policy-catalog" || policy.schemaVersion !== 3 || policy.constraintPolicy !== PRODUCTION_STRICT_CONSTRAINT_POLICY_V3) fail(artifact, "");
  if (policy.application !== "motor.brushed-dc" && policy.application !== "power.buck") fail(artifact, "/application");
  if (!Array.isArray(policy.recipePolicies)) fail(artifact, "/recipePolicies");
  if (policy.recipePolicies.length === 0) fail(artifact, "/recipePolicies");
  if (policy.recipePolicies.length > MAX_RECIPES) fail(artifact, "/recipePolicies", "resource_limit");
  const recipeIds: string[] = [];
  let totalRules = 0;
  policy.recipePolicies.forEach((raw, recipeIndex) => {
    const path = `/recipePolicies/${recipeIndex}`;
    const recipe = object(raw, artifact, path);
    keys(recipe, ["recipeId", "recipeContentHash", "rules"], artifact, path);
    const recipeId = electricalId(recipe.recipeId, artifact, `${path}/recipeId`);
    recipeIds.push(recipeId);
    if (typeof recipe.recipeContentHash !== "string" || !HASH.test(recipe.recipeContentHash)) fail(artifact, `${path}/recipeContentHash`);
    if (!Array.isArray(recipe.rules)) fail(artifact, `${path}/rules`);
    if (recipe.rules.length === 0) fail(artifact, `${path}/rules`);
    totalRules += recipe.rules.length;
    if (totalRules > MAX_RULES) fail(artifact, `${path}/rules`, "resource_limit");
    const ruleIds: string[] = [];
    recipe.rules.forEach((rawRule, ruleIndex) => {
      const rulePath = `${path}/rules/${ruleIndex}`;
      const rule = object(rawRule, artifact, rulePath);
      keys(rule, ["ruleId", "criticality", "presence", "rationale"], artifact, rulePath);
      ruleIds.push(electricalId(rule.ruleId, artifact, `${rulePath}/ruleId`));
      if (rule.criticality !== "safety" && rule.criticality !== "requirement" && rule.criticality !== "engineering_gap") fail(artifact, `${rulePath}/criticality`);
      if (rule.presence !== "required" && rule.presence !== "conditional") fail(artifact, `${rulePath}/presence`);
      rationale(rule.rationale, artifact, `${rulePath}/rationale`);
    });
    if (!sortedUnique(ruleIds)) fail(artifact, `${path}/rules`, "invalid_order");
  });
  if (!sortedUnique(recipeIds)) fail(artifact, "/recipePolicies", "invalid_order");
  if (typeof policy.contentHash !== "string" || !HASH.test(policy.contentHash) || policy.contentHash !== calculateConstraintPolicyCatalogV3ContentHash(policy as unknown as ConstraintPolicyCatalogV3)) fail(artifact, "/contentHash", "invalid_hash");
  return detachedFrozenDesignV2Value(policy as unknown as ConstraintPolicyCatalogV3);
}

export function canonicalConstraintDecisionV3Payload(decision: Omit<ConstraintDecisionV3, "contentHash"> | ConstraintDecisionV3): string {
  return contentPayload(decision);
}

export function calculateConstraintDecisionV3ContentHash(decision: Omit<ConstraintDecisionV3, "contentHash"> | ConstraintDecisionV3): `sha256:${string}` {
  return designSha256ContentHash(canonicalConstraintDecisionV3Payload(decision));
}

export function constraintTruthV3(sourceStatus: ConstraintTruthSourceStatusV3): ConstraintTruthV3 {
  if (sourceStatus === "pass") return "pass";
  if (sourceStatus === "fail") return "fail";
  return "unknown";
}

export function constraintDispositionV3(sourceStatus: ConstraintTruthSourceStatusV3, criticality: ConstraintCriticalityV3): ConstraintDispositionV3 {
  if (sourceStatus === "pass") return "satisfied";
  if (sourceStatus === "fail") return "blocked_failure";
  return criticality === "engineering_gap" ? "inspectable_unknown" : "blocked_unknown";
}

function validateCandidateDecision(raw: unknown, index: number): CandidateConstraintDecisionV3 {
  const artifact = "constraint_decision" as const;
  const path = `/candidates/${index}`;
  const candidate = object(raw, artifact, path);
  keys(candidate, ["candidateId", "recipeId", "recipeContentHash", "sourceWarnings", "rules", "eligible"], artifact, path);
  if (typeof candidate.candidateId !== "string" || !CANDIDATE_ID.test(candidate.candidateId)) fail(artifact, `${path}/candidateId`);
  electricalId(candidate.recipeId, artifact, `${path}/recipeId`);
  if (typeof candidate.recipeContentHash !== "string" || !HASH.test(candidate.recipeContentHash)) fail(artifact, `${path}/recipeContentHash`);
  if (!Array.isArray(candidate.sourceWarnings)) fail(artifact, `${path}/sourceWarnings`);
  const warnings = candidate.sourceWarnings.map((warning, warningIndex) => safeString(warning, artifact, `${path}/sourceWarnings/${warningIndex}`));
  if (!sortedUnique(warnings)) fail(artifact, `${path}/sourceWarnings`, "invalid_order");
  if (!Array.isArray(candidate.rules)) fail(artifact, `${path}/rules`);
  if (candidate.rules.length > MAX_RULES) fail(artifact, `${path}/rules`, "resource_limit");
  const ruleIds: string[] = [];
  let blocking = warnings.length > 0;
  candidate.rules.forEach((rawRule, ruleIndex) => {
    const rulePath = `${path}/rules/${ruleIndex}`;
    const rule = object(rawRule, artifact, rulePath);
    keys(rule, ["ruleId", "sourceStatus", "truth", "criticality", "disposition", "policyRationale"], artifact, rulePath);
    ruleIds.push(electricalId(rule.ruleId, artifact, `${rulePath}/ruleId`));
    if (rule.sourceStatus !== "pass" && rule.sourceStatus !== "fail" && rule.sourceStatus !== "unknown") fail(artifact, `${rulePath}/sourceStatus`);
    if (rule.criticality !== "safety" && rule.criticality !== "requirement" && rule.criticality !== "engineering_gap") fail(artifact, `${rulePath}/criticality`);
    const truth = constraintTruthV3(rule.sourceStatus);
    const disposition = constraintDispositionV3(rule.sourceStatus, rule.criticality as ConstraintCriticalityV3);
    if (rule.truth !== truth) fail(artifact, `${rulePath}/truth`);
    if (rule.disposition !== disposition) fail(artifact, `${rulePath}/disposition`);
    rationale(rule.policyRationale, artifact, `${rulePath}/policyRationale`);
    if (disposition === "blocked_failure" || disposition === "blocked_unknown") blocking = true;
  });
  if (!sortedUnique(ruleIds)) fail(artifact, `${path}/rules`, "invalid_order");
  if (typeof candidate.eligible !== "boolean" || candidate.eligible === blocking) fail(artifact, `${path}/eligible`);
  return candidate as unknown as CandidateConstraintDecisionV3;
}

export function parseConstraintDecisionV3(input: unknown): ConstraintDecisionV3 {
  const artifact = "constraint_decision" as const;
  const decision = object(canonicalDesignV2Value(snapshot(input, artifact)), artifact, "");
  keys(decision, ["format", "schemaVersion", "source", "policy", "candidates", "eligibleCandidateIds", "contentHash"], artifact, "");
  if (decision.format !== "schemagic-constraint-decision" || decision.schemaVersion !== 3) fail(artifact, "");
  const source = object(decision.source, artifact, "/source");
  keys(source, ["schemaVersion", "resultContentHash", "candidateIds"], artifact, "/source");
  if (source.schemaVersion !== 2 || typeof source.resultContentHash !== "string" || !HASH.test(source.resultContentHash)) fail(artifact, "/source");
  if (!Array.isArray(source.candidateIds)) fail(artifact, "/source/candidateIds");
  if (source.candidateIds.length > MAX_CANDIDATES) fail(artifact, "/source/candidateIds", "resource_limit");
  const sourceCandidateIds = source.candidateIds.map((id, index) => typeof id === "string" && CANDIDATE_ID.test(id) ? id : fail(artifact, `/source/candidateIds/${index}`));
  if (!sortedUnique(sourceCandidateIds)) fail(artifact, "/source/candidateIds", "invalid_order");
  const policy = object(decision.policy, artifact, "/policy");
  keys(policy, ["constraintPolicy", "contentHash"], artifact, "/policy");
  if (policy.constraintPolicy !== PRODUCTION_STRICT_CONSTRAINT_POLICY_V3 || typeof policy.contentHash !== "string" || !HASH.test(policy.contentHash)) fail(artifact, "/policy");
  if (!Array.isArray(decision.candidates)) fail(artifact, "/candidates");
  if (decision.candidates.length > MAX_CANDIDATES) fail(artifact, "/candidates", "resource_limit");
  const candidates = decision.candidates.map(validateCandidateDecision);
  const candidateIds = candidates.map((candidate) => candidate.candidateId);
  if (!sortedUnique(candidateIds) || canonicalDesignV2Payload(candidateIds) !== canonicalDesignV2Payload(sourceCandidateIds)) fail(artifact, "/candidates", "invalid_order");
  if (!Array.isArray(decision.eligibleCandidateIds)) fail(artifact, "/eligibleCandidateIds");
  const eligible = decision.eligibleCandidateIds.map((id, index) => typeof id === "string" && CANDIDATE_ID.test(id) ? id : fail(artifact, `/eligibleCandidateIds/${index}`));
  const computedEligible = candidates.filter((candidate) => candidate.eligible).map((candidate) => candidate.candidateId);
  if (!sortedUnique(eligible) || canonicalDesignV2Payload(eligible) !== canonicalDesignV2Payload(computedEligible)) fail(artifact, "/eligibleCandidateIds", "invalid_order");
  if (typeof decision.contentHash !== "string" || !HASH.test(decision.contentHash) || decision.contentHash !== calculateConstraintDecisionV3ContentHash(decision as unknown as ConstraintDecisionV3)) fail(artifact, "/contentHash", "invalid_hash");
  return detachedFrozenDesignV2Value(decision as unknown as ConstraintDecisionV3);
}
