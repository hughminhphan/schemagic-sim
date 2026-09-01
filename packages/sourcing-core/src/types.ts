import type {
  CandidateSourcingMetrics,
  ManufacturerPartIdentity,
  OfferSnapshot,
  SourcingPolicy,
} from "@opencircuit/sourcing-schema";

export interface SourcingBomLine {
  bomLineId: string;
  part: ManufacturerPartIdentity;
  quantityPerAssembly: number;
}

export interface CandidateSourcingBomLine {
  id: string;
  part: ManufacturerPartIdentity;
  quantityPerAssembly: number;
}

export type SourcingPolicyDecisionStatus = "pass" | "fail" | "unknown";

export type SourcingPolicyDecisionCode =
  | "data_status"
  | "offer_available"
  | "lifecycle"
  | "stock"
  | "lead_time"
  | "packaging"
  | "marketplace"
  | "region"
  | "currency"
  | "single_distributor";

export interface SourcingPolicyDecision {
  ruleId: string;
  code: SourcingPolicyDecisionCode;
  status: SourcingPolicyDecisionStatus;
  explanation: string;
  bomLineId?: string;
}

export interface EvaluateBomSourcingInput {
  lines: readonly SourcingBomLine[];
  snapshots: readonly OfferSnapshot[];
  policy: Readonly<SourcingPolicy>;
  evaluatedAt: string;
}

export interface BomSourcingEvaluation {
  metrics: CandidateSourcingMetrics;
  policyStatus: SourcingPolicyDecisionStatus;
  decisions: SourcingPolicyDecision[];
}

/**
 * Structural subset of the design-engine candidate. Keeping the boundary here
 * prevents sourcing-core from importing application or electrical contracts.
 */
export interface CandidateWithSourcingBom {
  components: readonly CandidateSourcingBomLine[];
}

/** Structurally compatible with design-schema ConstraintResult. */
export interface SourcingConstraint {
  ruleId: string;
  status: SourcingPolicyDecisionStatus;
  explanation: string;
  evidence: [];
}

/** Structurally compatible with design-engine SourcingEvaluation. */
export interface CandidateSourcingEvaluation {
  metrics: CandidateSourcingMetrics;
  eligible: boolean;
  constraints: SourcingConstraint[];
}
