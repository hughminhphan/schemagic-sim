import type { CircuitDocumentV2, Sha256ContentHash } from "@opencircuit/circuit-schema";
import type { CommercialRankingCriterionV1 } from "@opencircuit/sourcing-schema";
import type { CandidateMetric, CandidateMetrics, DerivedValue, DesignResult, SelectedComponent } from "./candidate";
import type { ConstraintResult } from "./constraint";
import type { EvidenceState } from "./evidence";
import type { DesignRequestV1 } from "./request";

export type { Sha256ContentHash } from "@opencircuit/circuit-schema";

export type CandidateIdV2 = `candidate:v2:${Sha256ContentHash}`;

export interface CandidateMetricV2 extends Omit<CandidateMetric, "state"> {
  state: Extract<EvidenceState, "calculated" | "estimated" | "unknown">;
}

export interface CandidateMetricsV2 extends Omit<CandidateMetrics, "values"> {
  values: CandidateMetricV2[];
}

export type CircuitInstanceClassificationV2 =
  | {
      circuitId: string;
      componentId: string;
      kind: "physical";
      selectedComponentId: string;
      representedQuantityPerAssembly: number;
      reason?: never;
    }
  | {
      circuitId: string;
      componentId: string;
      kind: "behavioral";
      selectedComponentId: string;
      representedQuantityPerAssembly?: never;
      reason: string;
    }
  | {
      circuitId: string;
      componentId: string;
      kind: "non_bom";
      selectedComponentId?: never;
      representedQuantityPerAssembly?: never;
      reason: string;
    };

export interface CircuitBomNonRepresentationV2 {
  circuitId: string;
  selectedComponentId: string;
  reason: string;
}

export type DesignDiagnosticCodeV2 = "design.no_supported_recipe";

export interface SimulationCoverageV2 {
  scenarioId: string;
  modelTier: "behavioral" | "unavailable";
  limitations: string[];
}

export interface DesignCandidateV2 {
  schemaVersion: 2;
  id: CandidateIdV2;
  requestHash: Sha256ContentHash;
  recipeId: string;
  libraryVersion: string;
  components: SelectedComponent[];
  derivedValues: DerivedValue[];
  constraints: ConstraintResult[];
  metrics: CandidateMetricsV2;
  simulationCoverage: SimulationCoverageV2[];
  circuit: CircuitDocumentV2;
  circuitInstanceClassifications: CircuitInstanceClassificationV2[];
  circuitBomNonRepresentations: CircuitBomNonRepresentationV2[];
  warnings: string[];
}

export interface RejectedCandidateV2 {
  recipeId: string;
  componentProfileIds: string[];
  constraints: ConstraintResult[];
}

export type ElectricalDesignObjectiveV2 = "area" | "balanced" | "efficiency" | "temperature";

type ElectricalRequestV2<Request extends DesignRequestV1> =
  Request extends DesignRequestV1
    ? Omit<Request, "schemaVersion" | "sourcing" | "objective"> & {
        schemaVersion: 2;
        objective: ElectricalDesignObjectiveV2;
      }
    : never;

export type ElectricalDesignRequestV2 = ElectricalRequestV2<DesignRequestV1>;
export type BrushedDcMotorDesignRequestV2 = Extract<ElectricalDesignRequestV2, { application: "motor.brushed-dc" }>;
export type BuckDesignRequestV2 = Extract<ElectricalDesignRequestV2, { application: "power.buck" }>;

export type DesignRequestV2Migration =
  | {
      status: "migrated";
      request: ElectricalDesignRequestV2;
      suggestedCommercialRankingCriteria: CommercialRankingCriterionV1[];
    }
  | {
      status: "engineering_objective_required";
      sourceObjective: "availability" | "bom_cost" | "lead_time";
      suggestedCommercialRankingCriteria: CommercialRankingCriterionV1[];
    }
  | {
      status: "engineering_objective_conflict";
      sourceObjective: ElectricalDesignObjectiveV2;
      suppliedObjective: ElectricalDesignObjectiveV2;
    };

export type DesignRequestV2Migrated = Extract<DesignRequestV2Migration, { status: "migrated" }>;
export type DesignRequestV2MigrationBlock = Exclude<DesignRequestV2Migration, DesignRequestV2Migrated>;

export interface DesignResultV2 {
  format: "schemagic-design-result";
  schemaVersion: 2;
  request: ElectricalDesignRequestV2;
  requestHash: Sha256ContentHash;
  libraryVersion: string;
  libraryContentHash: Sha256ContentHash;
  candidates: DesignCandidateV2[];
  rejectedCandidates: RejectedCandidateV2[];
  diagnostics: DesignDiagnosticCodeV2[];
  contentHash: Sha256ContentHash;
}

export type DesignValidationIssueCode =
  | "invalid_type"
  | "unknown_key"
  | "invalid_value"
  | "invalid_hash"
  | "invalid_reference"
  | "invalid_order"
  | "resource_limit"
  | "context_mismatch"
  | "recipe_contract"
  | "coverage_contract"
  | "circuit_bom_binding";

export interface DesignValidationIssue {
  code: DesignValidationIssueCode;
  path: string;
  message: string;
}

export const DESIGN_VALIDATION_ISSUE_MESSAGE_PREFIX = {
  invalid_type: "Invalid type",
  unknown_key: "Unknown key",
  invalid_value: "Invalid value",
  invalid_hash: "Invalid content hash",
  invalid_reference: "Invalid reference",
  invalid_order: "Invalid canonical order",
  resource_limit: "Resource limit exceeded",
  context_mismatch: "Engineering context mismatch",
  recipe_contract: "Recipe contract violation",
  coverage_contract: "Coverage contract violation",
  circuit_bom_binding: "Circuit/BOM binding violation",
} as const satisfies Record<DesignValidationIssueCode, string>;

export type DesignParseArtifactV2 =
  | "electrical_request"
  | "electrical_ranking_policy"
  | "reviewed_profile_catalog"
  | "electrical_context_manifest"
  | "candidate_identity"
  | "design_result"
  | "persisted_design_result"
  | "execution_report";

export type DesignParseErrorDetailV2 =
  | { code: "invalid_document"; stage: "parse"; artifact: DesignParseArtifactV2 }
  | { code: "resource_limit"; stage: "parse"; artifact: DesignParseArtifactV2 };

export class DesignParseErrorV2 extends Error {
  readonly detail: DesignParseErrorDetailV2;
  readonly issues: readonly DesignValidationIssue[];

  constructor(detail: DesignParseErrorDetailV2, issues: readonly DesignValidationIssue[]) {
    super("Invalid scheMAGIC Designer V2 document");
    this.name = "DesignParseErrorV2";
    this.detail = Object.freeze({ ...detail });
    this.issues = Object.freeze([...issues]);
  }
}

export type GenerationStageV1 = "solve" | "match" | "check" | "sourcing" | "dedupe" | "pareto";
export interface GenerationRejectionV1 {
  stage: GenerationStageV1;
  recipeId: string;
  optionKey: string;
  candidateId?: string;
  componentProfileIds: string[];
  constraints: ConstraintResult[];
  reason: string;
}
export interface GenerationCountsV1 {
  recipes: number; enumerated: number; solved: number; matched: number; checked: number;
  estimated: number; sourced: number; deduped: number; pareto: number; materialized: number; rejected: number;
}
export interface GenerationTraceV1 {
  pipeline: readonly ["normalize", "enumerate", "solve", "match", "check", "estimate", "dedupe", "pareto", "rank", "materialize"];
  counts: GenerationCountsV1;
}
export interface LegacyDesignGenerationArtifactV1 extends DesignResult {
  rejections: GenerationRejectionV1[];
  trace: GenerationTraceV1;
}
export type PersistedDesignResultV1 = DesignResult | LegacyDesignGenerationArtifactV1;
export type ParsedPersistedDesignResult = PersistedDesignResultV1 | DesignResultV2;

export type DesignResultV1RegenerationPlan =
  | {
      status: "regeneration_required";
      reason: "v1_result_is_lossy";
      requestMigration: DesignRequestV2Migrated;
      diagnostics: readonly [
        "legacy_v1_rejections_are_lossy",
        "legacy_v1_sourcing_rejection_requires_regeneration",
        "legacy_v1_rank_requires_regeneration",
      ];
    }
  | DesignRequestV2MigrationBlock;
