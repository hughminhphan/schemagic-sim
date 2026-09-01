import type { Sha256ContentHash } from "@opencircuit/circuit-schema";
import type {
  CandidateSourcingMetricsV2,
  CommercialRankingCriterionV1,
  OfferSnapshotV2Ref,
  ProviderAttributionV1,
  SnapshotAuthorizationRefV1,
  SourcingPolicy,
  SourcingPolicyConstraintV2,
  SourcingPolicyStatus,
} from "@opencircuit/sourcing-schema";
import type { CandidateIdV2 } from "./v2-types";

export const COMMERCIAL_OVERLAY_SCHEMA_VERSION = 1 as const;

export type CommercialCandidateStatus = "compliant" | "unproven" | "rejected";

export type CommercialParetoV1 =
  | { status: "frontier" }
  | { status: "dominated"; dominatedByCandidateId: CandidateIdV2 }
  | { status: "not_evaluated"; reason: "policy_not_pass" | "missing_requested_metric" };

export type CommercialRankV1 =
  | { status: "ranked"; rank: number }
  | {
      status: "unranked";
      reason: "policy_not_pass" | "missing_requested_metric" | "dominated" | "no_ranking_criteria";
    };

export interface CommercialCandidateOverlayV1 {
  candidateId: CandidateIdV2;
  status: CommercialCandidateStatus;
  policyStatus: SourcingPolicyStatus;
  metrics: CandidateSourcingMetricsV2;
  constraints: SourcingPolicyConstraintV2[];
  pareto: CommercialParetoV1;
  rank: CommercialRankV1;
  order: number;
}

export type CommercialOverlayV1Id = `commercial-overlay:v1:${Sha256ContentHash}`;

export interface CommercialOverlayV1 {
  format: "schemagic-commercial-overlay";
  schemaVersion: typeof COMMERCIAL_OVERLAY_SCHEMA_VERSION;
  id: CommercialOverlayV1Id;
  persistence: "user_local" | "exportable";
  designResultRef: {
    schemaVersion: 2;
    designResultContentHash: Sha256ContentHash;
    requestHash: Sha256ContentHash;
    libraryVersion: string;
    libraryContentHash: Sha256ContentHash;
    candidateSetHash: Sha256ContentHash;
  };
  policy: SourcingPolicy;
  evaluatedAt: string;
  snapshotRefs: OfferSnapshotV2Ref[];
  authorizationRefs: SnapshotAuthorizationRefV1[];
  authorizationNotAfter: string | null;
  attributions: ProviderAttributionV1[];
  paretoCriteria: CommercialRankingCriterionV1[];
  rankingCriteria: CommercialRankingCriterionV1[];
  candidates: CommercialCandidateOverlayV1[];
  contentHash: Sha256ContentHash;
}
