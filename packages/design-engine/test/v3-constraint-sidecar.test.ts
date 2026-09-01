import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getBundledDesignLibraryDocuments } from "@opencircuit/design-library";
import {
  PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  calculateConstraintDecisionV3ContentHash,
  calculateConstraintPolicyCatalogV3ContentHash,
  canonicalDesignResultV2ContentHash,
  migrateDesignRequestV1ToV2,
  type ConstraintPolicyCatalogV3,
  type DesignResultV2,
  type ElectricalDesignRequestV2,
} from "@opencircuit/design-schema";
import {
  buildReviewedProfileCatalogV2,
  calculateElectricalDesignContextManifestV2ContentHash,
  calculateElectricalRankingPolicyV2ContentHash,
  generateElectricalDesignV2,
  getInstalledCompilerImplementationRefV2,
  getInstalledRecipeRefsV2,
  resolveInstalledRecipeRegistryV2,
  type ElectricalDesignContextManifestV2,
  type ElectricalRankingPolicyV2,
  type GenerateElectricalContextV2,
} from "../src";
import {
  ConstraintDecisionEvaluationErrorV3,
  assertConstraintDecisionContextV3,
  evaluateConstraintDecisionV3,
} from "../src/v3-constraint-sidecar";

function fixtureRequest(version: string): ElectricalDesignRequestV2 {
  const source = JSON.parse(readFileSync(new URL("../../design-schema/test/fixtures/requests/m1-compact.design-request.json", import.meta.url), "utf8"));
  const migrated = migrateDesignRequestV1ToV2(source, version);
  if (migrated.status !== "migrated" || migrated.request.application !== "motor.brushed-dc") throw new Error("Expected Motor fixture");
  const request = structuredClone(migrated.request);
  request.constraints.allowUnknownHardConstraints = true;
  request.constraints.allowUnknownWarnings = true;
  request.constraints.allowedTopologyFamilies = ["motor.hbridge.integrated"];
  return request;
}

function generated(): { source: DesignResultV2; context: ElectricalDesignContextManifestV2 } {
  const documents = getBundledDesignLibraryDocuments();
  const catalog = buildReviewedProfileCatalogV2(documents);
  const rankingPayload: Omit<ElectricalRankingPolicyV2, "contentHash"> = {
    format: "schemagic-electrical-ranking-policy", schemaVersion: 2, version: "v3-sidecar-test.1", application: "motor.brushed-dc",
    paretoCriteria: [], rankingProfiles: { area: [], balanced: [], efficiency: [], temperature: [] },
  };
  const rankingPolicy = { ...rankingPayload, contentHash: calculateElectricalRankingPolicyV2ContentHash(rankingPayload) };
  const manifestPayload: Omit<ElectricalDesignContextManifestV2, "contentHash"> = {
    format: "schemagic-electrical-design-context", schemaVersion: 2, version: catalog.version, application: "motor.brushed-dc",
    compiler: getInstalledCompilerImplementationRefV2(),
    catalog: { version: catalog.version, contentHash: catalog.contentHash, sourceReleaseContentHash: catalog.sourceRelease.contentHash },
    rankingPolicy: { version: rankingPolicy.version, contentHash: rankingPolicy.contentHash },
    recipes: [...getInstalledRecipeRefsV2("motor.brushed-dc")],
  };
  const manifest = { ...manifestPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(manifestPayload) };
  const installedRecipeRegistry = resolveInstalledRecipeRegistryV2(manifest);
  if (!installedRecipeRegistry) throw new Error("Expected installed recipe registry");
  const context: GenerateElectricalContextV2 = { manifest, catalogDocuments: documents, rankingPolicy, installedRecipeRegistry };
  const generation = generateElectricalDesignV2(fixtureRequest(catalog.version), context);
  if (generation.result.candidates.length === 0) throw new Error("Expected retained candidates");
  return { source: generation.result, context: manifest };
}

function policyFor(source: DesignResultV2, context: ElectricalDesignContextManifestV2): ConstraintPolicyCatalogV3 {
  const recipeIds = [...new Set(source.candidates.map((candidate) => candidate.recipeId))].sort();
  const recipePolicies = recipeIds.map((recipeId) => {
    const candidates = source.candidates.filter((candidate) => candidate.recipeId === recipeId);
    const ruleIds = [...new Set(candidates.flatMap((candidate) => candidate.constraints.map((constraint) => constraint.ruleId)))].sort();
    const recipe = context.recipes.find((entry) => entry.id === recipeId)!;
    return {
      recipeId,
      recipeContentHash: recipe.contentHash,
      rules: ruleIds.map((ruleId) => ({
        ruleId,
        criticality: candidates.some((candidate) => candidate.constraints.some((constraint) => constraint.ruleId === ruleId && constraint.status === "unknown")) ? "engineering_gap" as const : "requirement" as const,
        presence: candidates.every((candidate) => candidate.constraints.some((constraint) => constraint.ruleId === ruleId)) ? "required" as const : "conditional" as const,
        rationale: `Production-strict classification for ${ruleId}.`,
      })),
    };
  });
  const payload: Omit<ConstraintPolicyCatalogV3, "contentHash"> = {
    format: "schemagic-constraint-policy-catalog", schemaVersion: 3,
    constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
    application: "motor.brushed-dc", recipePolicies,
  };
  return { ...payload, contentHash: calculateConstraintPolicyCatalogV3ContentHash(payload) };
}

function rehashPolicy(policy: ConstraintPolicyCatalogV3): ConstraintPolicyCatalogV3 {
  const { contentHash: _hash, ...payload } = policy;
  return { ...payload, contentHash: calculateConstraintPolicyCatalogV3ContentHash(payload) };
}

describe("Designer V3 constraint decision sidecar", () => {
  it("binds candidates to the exact V2 result, manifest recipe hash, and recipe-scoped policy", () => {
    const { source, context } = generated();
    const policy = policyFor(source, context);
    const decision = evaluateConstraintDecisionV3(source, context, policy);
    expect(decision.source.resultContentHash).toBe(source.contentHash);
    expect(decision.source.candidateIds).toEqual([...source.candidates.map((candidate) => candidate.id)].sort());
    for (const candidate of decision.candidates) {
      expect(candidate.recipeContentHash).toBe(context.recipes.find((recipe) => recipe.id === candidate.recipeId)!.contentHash);
      expect(candidate.rules.map((rule) => rule.ruleId)).toEqual(source.candidates.find((entry) => entry.id === candidate.candidateId)!.constraints.map((rule) => rule.ruleId));
    }
    expect(assertConstraintDecisionContextV3(decision, source, context, policy)).toEqual(decision);
  }, 30_000);

  it("rejects undeclared emitted rules, absent required rules, and a recipe-hash scope mismatch", () => {
    const { source, context } = generated();
    const policy = policyFor(source, context);
    const missingDeclaration = structuredClone(policy);
    missingDeclaration.recipePolicies[0]!.rules.shift();
    expect(() => evaluateConstraintDecisionV3(source, context, rehashPolicy(missingDeclaration))).toThrow(ConstraintDecisionEvaluationErrorV3);

    const absentRequired = structuredClone(policy);
    absentRequired.recipePolicies[0]!.rules.push({ ruleId: "motor.unemitted-required", criticality: "safety", presence: "required", rationale: "A required safety rule must be emitted." });
    absentRequired.recipePolicies[0]!.rules.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
    expect(() => evaluateConstraintDecisionV3(source, context, rehashPolicy(absentRequired))).toThrow(ConstraintDecisionEvaluationErrorV3);

    const wrongRecipeHash = structuredClone(policy);
    wrongRecipeHash.recipePolicies[0]!.recipeContentHash = (`sha256:${"0".repeat(64)}`) as `sha256:${string}`;
    expect(() => evaluateConstraintDecisionV3(source, context, rehashPolicy(wrongRecipeHash))).toThrow(ConstraintDecisionEvaluationErrorV3);
  }, 30_000);

  it("allows absent declared conditional rules and ignores required rules in an unused exact recipe scope", () => {
    const { source, context } = generated();
    const policy = policyFor(source, context);
    policy.recipePolicies[0]!.rules.push({ ruleId: "motor.optional-request-rule", criticality: "requirement", presence: "conditional", rationale: "Only emitted when the request supplies the target." });
    policy.recipePolicies[0]!.rules.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
    const unused = context.recipes.find((recipe) => !source.candidates.some((candidate) => candidate.recipeId === recipe.id));
    if (!unused) throw new Error("Expected an unused installed Motor recipe");
    policy.recipePolicies.push({ recipeId: unused.id, recipeContentHash: unused.contentHash, rules: [{ ruleId: "motor.other-scope-required", criticality: "safety", presence: "required", rationale: "Required only for candidates from the other recipe." }] });
    policy.recipePolicies.sort((left, right) => left.recipeId.localeCompare(right.recipeId));
    expect(evaluateConstraintDecisionV3(source, context, rehashPolicy(policy)).candidates).toHaveLength(source.candidates.length);
  }, 30_000);

  it("fails closed on V2 warning strings and rejects tampered source, policy, or rebound decision", () => {
    const { source, context } = generated();
    const policy = policyFor(source, context);
    const warned = structuredClone(source);
    warned.candidates[0]!.warnings = ["manual-review-required"];
    const { contentHash: _sourceHash, ...sourcePayload } = warned;
    warned.contentHash = canonicalDesignResultV2ContentHash(sourcePayload);
    const warningDecision = evaluateConstraintDecisionV3(warned, context, policy);
    expect(warningDecision.candidates.find((candidate) => candidate.candidateId === warned.candidates[0]!.id)!.eligible).toBe(false);

    const warningStatus = structuredClone(source);
    const unknownIndex = warningStatus.candidates[0]!.constraints.findIndex((constraint) => constraint.status === "unknown");
    if (unknownIndex < 0) throw new Error("Expected an unknown constraint");
    warningStatus.candidates[0]!.constraints[unknownIndex]!.status = "warning";
    warningStatus.candidates[0]!.metrics.warningCount += 1;
    warningStatus.candidates[0]!.metrics.unknownCount -= 1;
    const { contentHash: _warningHash, ...warningPayload } = warningStatus;
    warningStatus.contentHash = canonicalDesignResultV2ContentHash(warningPayload);
    expect(() => evaluateConstraintDecisionV3(warningStatus, context, policy)).toThrow(ConstraintDecisionEvaluationErrorV3);

    expect(() => evaluateConstraintDecisionV3({ ...source, diagnostics: ["design.no_supported_recipe"] }, context, policy)).toThrow(ConstraintDecisionEvaluationErrorV3);
    expect(() => evaluateConstraintDecisionV3(source, context, { ...policy, application: "power.buck" })).toThrow(ConstraintDecisionEvaluationErrorV3);

    const exact = evaluateConstraintDecisionV3(source, context, policy);
    const rebound = structuredClone(exact);
    rebound.candidates[0]!.sourceWarnings = ["not-in-source"];
    rebound.candidates[0]!.eligible = false;
    rebound.eligibleCandidateIds = rebound.candidates.filter((candidate) => candidate.eligible).map((candidate) => candidate.candidateId);
    rebound.contentHash = calculateConstraintDecisionV3ContentHash(rebound);
    expect(() => assertConstraintDecisionContextV3(rebound, source, context, policy)).toThrow(ConstraintDecisionEvaluationErrorV3);
  }, 30_000);
});
