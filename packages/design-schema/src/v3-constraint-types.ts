import type { Sha256ContentHash } from "@opencircuit/circuit-schema";
import type { ConstraintStatus } from "./constraint";

export const PRODUCTION_STRICT_CONSTRAINT_POLICY_V3 = "production_strict_v1" as const;

export type ConstraintPolicyIdV3 = typeof PRODUCTION_STRICT_CONSTRAINT_POLICY_V3;
export type ConstraintTruthV3 = "pass" | "fail" | "unknown";
export type ConstraintTruthSourceStatusV3 = Exclude<ConstraintStatus, "warning">;
export type ConstraintCriticalityV3 = "safety" | "requirement" | "engineering_gap";
export type ConstraintDispositionV3 = "satisfied" | "blocked_failure" | "blocked_unknown" | "inspectable_unknown";

export interface ConstraintPolicyRuleV3 {
  ruleId: string;
  criticality: ConstraintCriticalityV3;
  presence: "required" | "conditional";
  rationale: string;
}

export interface ConstraintRecipePolicyV3 {
  recipeId: string;
  recipeContentHash: Sha256ContentHash;
  rules: ConstraintPolicyRuleV3[];
}

/**
 * A content-addressed, recipe-scoped catalog. Candidates never select their own
 * scope. Its self-hash proves document integrity, not production authorization;
 * production callers must use an installed-policy runtime.
 */
export interface ConstraintPolicyCatalogV3 {
  format: "schemagic-constraint-policy-catalog";
  schemaVersion: 3;
  constraintPolicy: ConstraintPolicyIdV3;
  application: "motor.brushed-dc" | "power.buck";
  recipePolicies: ConstraintRecipePolicyV3[];
  contentHash: Sha256ContentHash;
}

export interface ConstraintRuleDecisionV3 {
  ruleId: string;
  sourceStatus: ConstraintTruthSourceStatusV3;
  truth: ConstraintTruthV3;
  criticality: ConstraintCriticalityV3;
  disposition: ConstraintDispositionV3;
  policyRationale: string;
}

export interface CandidateConstraintDecisionV3 {
  candidateId: string;
  recipeId: string;
  recipeContentHash: Sha256ContentHash;
  sourceWarnings: string[];
  rules: ConstraintRuleDecisionV3[];
  eligible: boolean;
}

export interface ConstraintDecisionSourceV3 {
  schemaVersion: 2;
  resultContentHash: Sha256ContentHash;
  candidateIds: string[];
}

export interface ConstraintDecisionPolicyRefV3 {
  constraintPolicy: ConstraintPolicyIdV3;
  contentHash: Sha256ContentHash;
}

/** A self-consistent sidecar; installed-policy context assertion establishes production trust. */
export interface ConstraintDecisionV3 {
  format: "schemagic-constraint-decision";
  schemaVersion: 3;
  source: ConstraintDecisionSourceV3;
  policy: ConstraintDecisionPolicyRefV3;
  candidates: CandidateConstraintDecisionV3[];
  eligibleCandidateIds: string[];
  contentHash: Sha256ContentHash;
}

export type ConstraintParseArtifactV3 = "constraint_policy_catalog" | "constraint_decision" | "electrical_request";
export type ConstraintParseErrorCodeV3 = "invalid_document" | "invalid_hash" | "invalid_order" | "resource_limit";

export class ConstraintParseErrorV3 extends Error {
  readonly code: ConstraintParseErrorCodeV3;
  readonly artifact: ConstraintParseArtifactV3;
  readonly path: string;

  constructor(code: ConstraintParseErrorCodeV3, artifact: ConstraintParseArtifactV3, path: string) {
    super(`Invalid scheMAGIC Designer V3 ${artifact} at ${path || "/"}`);
    this.name = "ConstraintParseErrorV3";
    this.code = code;
    this.artifact = artifact;
    this.path = path;
  }
}
