import type { CircuitDocument } from "@opencircuit/circuit-schema";
import type {
  CandidateMetric,
  CandidateMetrics,
  ConstraintResult,
  DerivedValue,
  DesignResult,
  DesignObjective,
  DesignRequest,
  SelectedComponent,
  SimulationCoverage,
} from "@opencircuit/design-schema";
import type { CandidateSourcingMetrics, OfferSnapshot, SourcingPolicy } from "@opencircuit/sourcing-schema";

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
type WithoutSourcing<Request> = Request extends DesignRequest ? Omit<Request, "sourcing"> : never;
export type ElectricalDesignRequest = WithoutSourcing<DesignRequest>;

export interface EnumeratedOption {
  optionKey: string;
  data: JsonObject;
}

export interface SolvedOption extends EnumeratedOption {
  derivedValues: DerivedValue[];
}

export interface MatchedOption extends SolvedOption {
  components: SelectedComponent[];
  simulationCoverage: SimulationCoverage[];
  warnings: string[];
}

export type StageOutcome<T> =
  | { status: "ok"; value: T }
  | {
    status: "rejected";
    reason: string;
    constraints?: ConstraintResult[];
    componentProfileIds?: string[];
  };

export interface CandidateEstimate {
  metrics: CandidateMetric[];
  warnings: string[];
}

export interface RecipeEnvironment {
  request: Readonly<ElectricalDesignRequest>;
  library: Readonly<DesignLibrary>;
}

export interface CandidateForMaterialization {
  id: string;
  recipeId: string;
  libraryVersion: string;
  optionKey: string;
  data: JsonObject;
  components: SelectedComponent[];
  derivedValues: DerivedValue[];
  constraints: ConstraintResult[];
  metrics: CandidateMetrics;
  simulationCoverage: SimulationCoverage[];
  warnings: string[];
}

export interface DesignRecipe {
  id: string;
  version: string;
  contentHash: string;
  supports(request: Readonly<ElectricalDesignRequest>): boolean;
  enumerate(environment: RecipeEnvironment): readonly EnumeratedOption[];
  solve(option: Readonly<EnumeratedOption>, environment: RecipeEnvironment): StageOutcome<SolvedOption>;
  match(option: Readonly<SolvedOption>, environment: RecipeEnvironment): readonly StageOutcome<MatchedOption>[];
  check(option: Readonly<MatchedOption>, environment: RecipeEnvironment): readonly ConstraintResult[];
  estimate(option: Readonly<MatchedOption>, constraints: readonly ConstraintResult[], environment: RecipeEnvironment): CandidateEstimate;
  materialize(candidate: Readonly<CandidateForMaterialization>, environment: RecipeEnvironment): CircuitDocument;
}

export type RankingCriterion =
  | { source: "metric"; metricId: string; direction: "maximize" | "minimize" }
  | {
    source: "sourcing";
    field: "buildableQuantity" | "extendedBomCost" | "maximumLeadTimeDays";
    direction: "maximize" | "minimize";
  };

export interface DesignLibrary {
  version: string;
  contentHash: string;
  paretoCriteria: readonly RankingCriterion[];
  rankingProfiles: Partial<Record<DesignObjective, readonly RankingCriterion[]>>;
}

export interface SourcingCandidate {
  id: string;
  requestHash: string;
  recipeId: string;
  libraryVersion: string;
  components: readonly SelectedComponent[];
  derivedValues: readonly DerivedValue[];
  constraints: readonly ConstraintResult[];
  metrics: CandidateMetrics;
}

export interface SourcingEvaluation {
  metrics: CandidateSourcingMetrics;
  eligible: boolean;
  constraints: ConstraintResult[];
}

export type EvaluateSourcing = (
  candidate: Readonly<SourcingCandidate>,
  snapshots: readonly OfferSnapshot[],
  policy: Readonly<SourcingPolicy>,
  evaluatedAt: string,
) => SourcingEvaluation;

export interface GenerateContext {
  library: Readonly<DesignLibrary>;
  recipes: readonly DesignRecipe[];
  evaluatedAt: string;
  offerSnapshots?: readonly OfferSnapshot[];
  evaluateSourcing?: EvaluateSourcing;
}

export type GenerationStage = "solve" | "match" | "check" | "sourcing" | "dedupe" | "pareto";

export interface GenerationRejection {
  stage: GenerationStage;
  recipeId: string;
  optionKey: string;
  candidateId?: string;
  componentProfileIds: string[];
  constraints: ConstraintResult[];
  reason: string;
}

export const PIPELINE_STAGES = [
  "normalize",
  "enumerate",
  "solve",
  "match",
  "check",
  "estimate",
  "dedupe",
  "pareto",
  "rank",
  "materialize",
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];

export interface GenerationCounts {
  recipes: number;
  enumerated: number;
  solved: number;
  matched: number;
  checked: number;
  estimated: number;
  sourced: number;
  deduped: number;
  pareto: number;
  materialized: number;
  rejected: number;
}

export interface GenerationTrace {
  pipeline: typeof PIPELINE_STAGES;
  counts: GenerationCounts;
}

export interface DesignGeneration extends DesignResult {
  rejections: GenerationRejection[];
  trace: GenerationTrace;
}

export interface RankedCandidateDraft extends CandidateForMaterialization {
  recipe: DesignRecipe;
  requestHash: string;
  electricalConstraints: ConstraintResult[];
  sourcing?: CandidateSourcingMetrics;
}
