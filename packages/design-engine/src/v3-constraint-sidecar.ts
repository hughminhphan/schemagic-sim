import {
  calculateConstraintDecisionV3ContentHash,
  canonicalConstraintDecisionV3Payload,
  compareDesignV2Tokens,
  constraintDispositionV3,
  constraintTruthV3,
  detachedFrozenDesignV2Value,
  parseConstraintDecisionV3,
  parseConstraintPolicyCatalogV3,
  parseDesignResultV2,
  type ConstraintDecisionV3,
  type ConstraintPolicyCatalogV3,
  type DesignResultV2,
} from "@opencircuit/design-schema";
import { parseElectricalDesignContextManifestV2 } from "./v2-context";
import type { ElectricalDesignContextManifestV2 } from "./v2-types";

export type ConstraintDecisionEvaluationErrorCodeV3 =
  | "invalid_source"
  | "invalid_context"
  | "invalid_policy"
  | "policy_scope_mismatch"
  | "policy_coverage_mismatch"
  | "unmappable_source_warning"
  | "decision_context_mismatch";

export class ConstraintDecisionEvaluationErrorV3 extends Error {
  readonly code: ConstraintDecisionEvaluationErrorCodeV3;
  readonly path: string;

  constructor(code: ConstraintDecisionEvaluationErrorCodeV3, path: string) {
    super(`scheMAGIC Designer V3 constraint decision failed (${code}) at ${path || "/"}`);
    this.name = "ConstraintDecisionEvaluationErrorV3";
    this.code = code;
    this.path = path;
  }
}

function fail(code: ConstraintDecisionEvaluationErrorCodeV3, path: string): never {
  throw new ConstraintDecisionEvaluationErrorV3(code, path);
}

function exactSource(input: unknown): DesignResultV2 {
  try { return parseDesignResultV2(input); }
  catch { return fail("invalid_source", ""); }
}

function exactManifest(input: unknown): ElectricalDesignContextManifestV2 {
  try { return parseElectricalDesignContextManifestV2(input); }
  catch { return fail("invalid_context", ""); }
}

function exactPolicy(input: unknown): ConstraintPolicyCatalogV3 {
  try { return parseConstraintPolicyCatalogV3(input); }
  catch { return fail("invalid_policy", ""); }
}

/**
 * Engine-internal policy mechanism. A self-hashed catalog is not authorization;
 * public production runtimes must bind this primitive to an installed catalog.
 * This sidecar does not project a V3 request or run generation. Rejection-only
 * fallback rules from solve/match are outside its retained-candidate scope.
 */
export function evaluateConstraintDecisionV3(
  sourceInput: Readonly<DesignResultV2>,
  contextInput: Readonly<ElectricalDesignContextManifestV2>,
  policyInput: Readonly<ConstraintPolicyCatalogV3>,
): ConstraintDecisionV3 {
  const source = exactSource(sourceInput);
  const context = exactManifest(contextInput);
  const policy = exactPolicy(policyInput);
  if (source.libraryContentHash !== context.contentHash || source.libraryVersion !== context.version || source.request.application !== context.application) {
    fail("invalid_context", "");
  }
  if (policy.application !== context.application) fail("policy_scope_mismatch", "/application");

  const contextRecipes = new Map(context.recipes.map((recipe) => [recipe.id, recipe]));
  const policyRecipes = new Map(policy.recipePolicies.map((recipe) => [recipe.recipeId, recipe]));
  for (const [index, recipePolicy] of policy.recipePolicies.entries()) {
    const installed = contextRecipes.get(recipePolicy.recipeId);
    if (!installed || installed.contentHash !== recipePolicy.recipeContentHash) fail("policy_scope_mismatch", `/recipePolicies/${index}/recipeContentHash`);
  }

  const candidates = [...source.candidates]
    .sort((left, right) => compareDesignV2Tokens(left.id, right.id))
    .map((candidate) => {
      const installedRecipe = contextRecipes.get(candidate.recipeId);
      if (!installedRecipe) fail("invalid_context", `/candidates/${candidate.id}/recipeId`);
      const recipePolicy = policyRecipes.get(candidate.recipeId);
      if (!recipePolicy || recipePolicy.recipeContentHash !== installedRecipe.contentHash) fail("policy_scope_mismatch", `/candidates/${candidate.id}/recipeId`);
      const declared = new Map(recipePolicy.rules.map((rule) => [rule.ruleId, rule]));
      const emitted = new Set(candidate.constraints.map((constraint) => constraint.ruleId));
      for (const constraint of candidate.constraints) if (!declared.has(constraint.ruleId)) fail("policy_coverage_mismatch", `/candidates/${candidate.id}/constraints/${constraint.ruleId}`);
      for (const rule of recipePolicy.rules) if (rule.presence === "required" && !emitted.has(rule.ruleId)) fail("policy_coverage_mismatch", `/candidates/${candidate.id}/constraints/${rule.ruleId}`);
      const warningIndex = candidate.constraints.findIndex((constraint) => constraint.status === "warning");
      if (warningIndex >= 0) fail("unmappable_source_warning", `/candidates/${candidate.id}/constraints/${warningIndex}/status`);

      const rules = candidate.constraints.map((constraint) => {
        const policyRule = declared.get(constraint.ruleId)!;
        if (constraint.status === "warning") fail("unmappable_source_warning", `/candidates/${candidate.id}/constraints/${constraint.ruleId}`);
        return {
          ruleId: constraint.ruleId,
          sourceStatus: constraint.status,
          truth: constraintTruthV3(constraint.status),
          criticality: policyRule.criticality,
          disposition: constraintDispositionV3(constraint.status, policyRule.criticality),
          policyRationale: policyRule.rationale,
        };
      });
      const eligible = candidate.warnings.length === 0 && rules.every((rule) => rule.disposition === "satisfied" || rule.disposition === "inspectable_unknown");
      return {
        candidateId: candidate.id,
        recipeId: candidate.recipeId,
        recipeContentHash: installedRecipe.contentHash,
        sourceWarnings: [...candidate.warnings],
        rules,
        eligible,
      };
    });

  const payload: Omit<ConstraintDecisionV3, "contentHash"> = {
    format: "schemagic-constraint-decision",
    schemaVersion: 3,
    source: {
      schemaVersion: 2,
      resultContentHash: source.contentHash,
      candidateIds: candidates.map((candidate) => candidate.candidateId),
    },
    policy: {
      constraintPolicy: policy.constraintPolicy,
      contentHash: policy.contentHash,
    },
    candidates,
    eligibleCandidateIds: candidates.filter((candidate) => candidate.eligible).map((candidate) => candidate.candidateId),
  };
  return parseConstraintDecisionV3({ ...payload, contentHash: calculateConstraintDecisionV3ContentHash(payload) });
}

/** Rejects a re-hashed but source-, context-, or policy-divergent decision. */
export function assertConstraintDecisionContextV3(
  decisionInput: Readonly<ConstraintDecisionV3>,
  sourceInput: Readonly<DesignResultV2>,
  contextInput: Readonly<ElectricalDesignContextManifestV2>,
  policyInput: Readonly<ConstraintPolicyCatalogV3>,
): ConstraintDecisionV3 {
  let decision: ConstraintDecisionV3;
  try { decision = parseConstraintDecisionV3(decisionInput); }
  catch { return fail("decision_context_mismatch", ""); }
  const expected = evaluateConstraintDecisionV3(sourceInput, contextInput, policyInput);
  if (canonicalConstraintDecisionV3Payload(decision) !== canonicalConstraintDecisionV3Payload(expected)) fail("decision_context_mismatch", "");
  return detachedFrozenDesignV2Value(decision);
}
