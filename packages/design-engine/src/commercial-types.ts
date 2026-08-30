import type {
  CandidateIdV2,
  CommercialCandidateOverlayV1,
  Sha256ContentHash,
} from "@opencircuit/design-schema";
import type {
  CandidateSourcingEvaluationV2,
  CommercialRankingCriterionV1,
  ManufacturerPartIdentity,
  OfferSnapshotV2,
  OfferSnapshotV2Ref,
  ProviderAttributionV1,
  SnapshotAuthorizationRefV1,
  SnapshotAuthorizationV1,
  SnapshotAuthorizationVerifierV1,
  SourcingPolicy,
  ValidationIssue,
  VerifiedCommercialAuthorizationOperationV1,
} from "@opencircuit/sourcing-schema";
import type { GenerateElectricalContextV2 } from "./v2-types";

export interface CommercialSourcingCandidateV2 {
  id: CandidateIdV2;
  components: readonly {
    id: string;
    part: ManufacturerPartIdentity;
    quantityPerAssembly: number;
  }[];
}

export type EvaluateSourcingV2 = (
  candidate: Readonly<CommercialSourcingCandidateV2>,
  snapshots: readonly OfferSnapshotV2[],
  policy: Readonly<SourcingPolicy>,
  evaluatedAt: string,
) => CandidateSourcingEvaluationV2;

export interface EvaluateCommercialViewContextV2 {
  engineeringContext: Readonly<GenerateElectricalContextV2>;
  policy: Readonly<SourcingPolicy>;
  snapshots: readonly OfferSnapshotV2[];
  authorizations: readonly SnapshotAuthorizationV1[];
  authorizationVerifier: SnapshotAuthorizationVerifierV1;
  authorizationOperation: VerifiedCommercialAuthorizationOperationV1;
  paretoCriteria: readonly CommercialRankingCriterionV1[];
  rankingCriteria: readonly CommercialRankingCriterionV1[];
  evaluateSourcing?: EvaluateSourcingV2;
}

export interface GenerateCommercialOverlayContextV1 extends EvaluateCommercialViewContextV2 {
  persistenceTarget: "user_local" | "exportable";
}

export type CommercialOverlayGenerationErrorCodeV1 =
  | "invalid_design_result"
  | "invalid_context"
  | "evaluator_threw"
  | "evaluator_contract_invalid";

export class CommercialOverlayGenerationErrorV1 extends Error {
  readonly code: CommercialOverlayGenerationErrorCodeV1;
  readonly issues: readonly ValidationIssue[];
  constructor(code: CommercialOverlayGenerationErrorCodeV1, issues: readonly ValidationIssue[]) {
    super("scheMAGIC commercial evaluation failed");
    this.name = "CommercialOverlayGenerationErrorV1";
    this.code = code;
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ path: issue.path, message: issue.message })));
  }
}

export const EPHEMERAL_COMMERCIAL_VIEW_V2: unique symbol = Symbol("EPHEMERAL_COMMERCIAL_VIEW_V2");
export interface CommercialEvaluationViewV2 {
  readonly [EPHEMERAL_COMMERCIAL_VIEW_V2]: true;
  designResultContentHash: Sha256ContentHash;
  policy: SourcingPolicy;
  evaluatedAt: string;
  snapshotRefs: OfferSnapshotV2Ref[];
  authorizationRefs: SnapshotAuthorizationRefV1[];
  authorizationNotAfter: string | null;
  attributions: ProviderAttributionV1[];
  paretoCriteria: CommercialRankingCriterionV1[];
  rankingCriteria: CommercialRankingCriterionV1[];
  candidates: CommercialCandidateOverlayV1[];
}
