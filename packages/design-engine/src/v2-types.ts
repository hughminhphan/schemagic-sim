import type { CircuitDocumentV2, Sha256ContentHash, TrustedSubcircuitRegistry } from "@opencircuit/circuit-schema";
import type {
  DesignLibraryDocuments, DesignProfileCodec, DesignProfileEnvelope, DesignProfileFor,
  DesignProfileForCodec, PartClassId, VersionedDesignProfileCodec,
} from "@opencircuit/design-library/v2-runtime";
import type {
  CandidateIdV2, CandidateMetricV2, CandidateMetricsV2, CircuitBomNonRepresentationV2,
  CircuitInstanceClassificationV2, ConstraintResult, DerivedValue, DesignApplication,
  DesignCandidateV2, DesignResultV2, DesignValidationIssue, ElectricalDesignObjectiveV2,
  ElectricalDesignRequestV2, Quantity, RejectedCandidateV2, SelectedComponent, SimulationCoverageV2,
} from "@opencircuit/design-schema";
import type { SIUnit } from "@opencircuit/design-schema";
import type { DesignRecipe, JsonObject } from "./types";

export interface ElectricalMetricDeclarationV2 { id: string; unit: SIUnit }
export interface ElectricalRankingCriterionV2 { source: "metric"; metricId: string; direction: "maximize" | "minimize" }
export interface ElectricalRankingPolicyV2 {
  format: "schemagic-electrical-ranking-policy"; schemaVersion: 2; version: string; application: DesignApplication;
  paretoCriteria: readonly ElectricalRankingCriterionV2[];
  rankingProfiles: Record<ElectricalDesignObjectiveV2, ElectricalRankingCriterionV2[]>;
  contentHash: Sha256ContentHash;
}
export interface DesignRecipeRefV2 {
  id: string; version: string; contentHash: Sha256ContentHash;
  applications: DesignApplication[]; metricDeclarations: ElectricalMetricDeclarationV2[];
}
export interface CompilerImplementationRefV2 { id: "@opencircuit/design-engine"; version: string; contentHash: Sha256ContentHash }
export interface ReviewedProfileCatalogV2 {
  format: "schemagic-reviewed-profile-catalog"; schemaVersion: 2; version: string;
  sourceRelease: { version: string; contentHash: Sha256ContentHash };
  profiles: DesignProfileEnvelope[]; contentHash: Sha256ContentHash;
}
export interface ElectricalDesignContextManifestV2 {
  format: "schemagic-electrical-design-context"; schemaVersion: 2; version: string; application: DesignApplication;
  compiler: CompilerImplementationRefV2;
  catalog: { version: string; contentHash: Sha256ContentHash; sourceReleaseContentHash: Sha256ContentHash };
  rankingPolicy: { version: string; contentHash: Sha256ContentHash };
  recipes: DesignRecipeRefV2[]; contentHash: Sha256ContentHash;
}

const ENGINE_CAPABILITY_TOKEN_V2 = Object.freeze({});
export class InstalledRecipeRegistryCapabilityV2 {
  readonly #engineBrand = ENGINE_CAPABILITY_TOKEN_V2;
  readonly compiler: Readonly<CompilerImplementationRefV2>;
  readonly manifestContentHash: Sha256ContentHash;
  constructor(token: object, compiler: Readonly<CompilerImplementationRefV2>, manifestContentHash: Sha256ContentHash) {
    if (token !== ENGINE_CAPABILITY_TOKEN_V2) throw new TypeError("Installed recipe capabilities are engine-owned");
    if (this.#engineBrand !== ENGINE_CAPABILITY_TOKEN_V2) throw new TypeError("Invalid engine brand");
    this.compiler = compiler; this.manifestContentHash = manifestContentHash;
  }
}

/** @internal Not re-exported by the package root. */
export function _mintInstalledRecipeRegistryCapabilityV2(compiler: Readonly<CompilerImplementationRefV2>, hash: Sha256ContentHash): InstalledRecipeRegistryCapabilityV2 {
  return new InstalledRecipeRegistryCapabilityV2(ENGINE_CAPABILITY_TOKEN_V2, compiler, hash);
}

export interface GenerateElectricalContextV2 {
  manifest: Readonly<ElectricalDesignContextManifestV2>;
  catalogDocuments: Readonly<DesignLibraryDocuments>;
  rankingPolicy: Readonly<ElectricalRankingPolicyV2>;
  installedRecipeRegistry: InstalledRecipeRegistryCapabilityV2;
}

export type RecipeHookStageV2 = "supports" | "enumerate" | "solve" | "match" | "check" | "estimate" | "materialize";
export type DesignEngineResourceStageV2 = "enumerate" | "solve" | "match" | "check" | "estimate" | "dedupe" | "pareto" | "rank" | "result" | "report";
export type DesignGenerationErrorDetailV2 =
  | { code: "invalid_request"; stage: "request"; recipeId?: never }
  | { code: "invalid_context"; stage: "context"; recipeId?: never }
  | { code: "recipe_hook_threw"; stage: RecipeHookStageV2; recipeId: string }
  | { code: "recipe_contract_invalid"; stage: RecipeHookStageV2 | "coverage"; recipeId: string }
  | { code: "resource_limit"; stage: DesignEngineResourceStageV2; recipeId?: never };
export type DesignGenerationErrorCodeV2 = DesignGenerationErrorDetailV2["code"];
export type DesignGenerationErrorStageV2 = DesignGenerationErrorDetailV2["stage"];

export class DesignGenerationErrorV2 extends Error {
  readonly detail: DesignGenerationErrorDetailV2; readonly issues: readonly DesignValidationIssue[];
  constructor(detail: DesignGenerationErrorDetailV2, issues: readonly DesignValidationIssue[]) {
    super("scheMAGIC Designer V2 generation failed"); this.name = "DesignGenerationErrorV2";
    this.detail = Object.freeze({ ...detail }); this.issues = Object.freeze([...issues]);
  }
}

export interface EnumeratedOptionV2 { optionKey: string; data: JsonObject }
export interface SolvedOptionV2 { data: JsonObject; derivedValues: DerivedValue[] }
export interface MatchedOptionV2 extends SolvedOptionV2 { components: SelectedComponent[]; simulationCoverage: SimulationCoverageV2[]; warnings: string[] }
export type StageOutcomeV2<T> =
  | { status: "ok"; value: T }
  | { status: "rejected"; reason: string; constraints?: ConstraintResult[]; componentProfileIds?: string[] };
export type ElectricalDesignRequestForEngineeringV2 = ElectricalDesignRequestV2;
export interface RecipeEnvironmentV2 {
  request: Readonly<ElectricalDesignRequestForEngineeringV2>;
  catalog: Readonly<ReviewedProfileCatalogV2>;
  manifest: Readonly<ElectricalDesignContextManifestV2>;
}
export interface CandidateForMaterializationV2 {
  id: CandidateIdV2; recipeId: string; libraryVersion: string; data: JsonObject;
  components: SelectedComponent[]; derivedValues: DerivedValue[]; constraints: ConstraintResult[];
  metrics: CandidateMetricsV2; simulationCoverage: SimulationCoverageV2[]; warnings: string[];
}
export interface CandidateEstimateV2 { metrics: CandidateMetricV2[]; warnings: string[] }
export interface CandidateMaterializationV2 {
  circuit: CircuitDocumentV2;
  circuitInstanceClassifications: CircuitInstanceClassificationV2[];
  circuitBomNonRepresentations: CircuitBomNonRepresentationV2[];
}
export interface DesignRecipeV2 extends DesignRecipeRefV2 {
  supports(request: Readonly<ElectricalDesignRequestForEngineeringV2>): boolean;
  enumerate(environment: RecipeEnvironmentV2): readonly EnumeratedOptionV2[];
  solve(option: Readonly<Omit<EnumeratedOptionV2, "optionKey">>, environment: RecipeEnvironmentV2): StageOutcomeV2<SolvedOptionV2>;
  match(option: Readonly<SolvedOptionV2>, environment: RecipeEnvironmentV2): readonly StageOutcomeV2<MatchedOptionV2>[];
  check(option: Readonly<MatchedOptionV2>, environment: RecipeEnvironmentV2): readonly ConstraintResult[];
  estimate(option: Readonly<MatchedOptionV2>, constraints: readonly ConstraintResult[], environment: RecipeEnvironmentV2): CandidateEstimateV2;
  materialize(candidate: Readonly<CandidateForMaterializationV2>, environment: RecipeEnvironmentV2): CandidateMaterializationV2;
}

export type CandidateIdentitySelectedComponentV2 = Omit<SelectedComponent, "value"> & { value?: Omit<Quantity, "displayUnit"> };
export type CandidateIdentityDerivedValueV2 = Omit<DerivedValue, "value"> & { value: Omit<Quantity, "displayUnit"> };
export interface CandidateIdentityInputV2 {
  recipe: Pick<DesignRecipeRefV2, "id" | "version" | "contentHash">;
  context: { version: string; contentHash: Sha256ContentHash }; requestHash: Sha256ContentHash; data: JsonObject;
  components: CandidateIdentitySelectedComponentV2[]; derivedValues: CandidateIdentityDerivedValueV2[];
}

export type GenerationStageV2 = "solve" | "match" | "check" | "estimate" | "dedupe" | "pareto";
export type GenerationRejectionReasonV2 = "recipe_rejected" | "hard_constraint_failed" | "unknown_constraint_disallowed" | "warning_disallowed" | "estimated_values_disallowed" | "duplicate_candidate" | "pareto_dominated";
export interface GenerationRejectionBaseV2 { recipeId: string; optionKey: string; componentProfileIds: string[]; constraints: ConstraintResult[]; message: string }
export type GenerationRejectionV2 = GenerationRejectionBaseV2 & (
  | { stage: "solve" | "match"; reasonCode: "recipe_rejected"; candidateId?: never; recipeReason: string }
  | { stage: "check"; reasonCode: "hard_constraint_failed" | "unknown_constraint_disallowed" | "warning_disallowed"; candidateId: CandidateIdV2 }
  | { stage: "estimate"; reasonCode: "estimated_values_disallowed"; candidateId: CandidateIdV2 }
  | { stage: "dedupe"; reasonCode: "duplicate_candidate"; candidateId: CandidateIdV2; kept: { candidateId: CandidateIdV2; recipeId: string; optionKey: string } }
  | { stage: "pareto"; reasonCode: "pareto_dominated"; candidateId: CandidateIdV2; dominatedByCandidateId: CandidateIdV2 }
);
type WithoutMessage<T> = T extends { message: string } ? Omit<T, "message"> : never;
export type GenerationRejectionMessageInputV2 = WithoutMessage<GenerationRejectionV2>;
export interface GenerationCountsV2 {
  recipes: number; supportedRecipes: number; enumerated: number; solved: number; matchOutcomes: number; matched: number;
  checked: number; estimated: number; deduped: number; pareto: number; materialized: number; coverageValidated: number; rejected: number;
}
export const PIPELINE_STAGES_V2 = ["normalize", "enumerate", "solve", "match", "check", "estimate", "materialize", "coverage", "dedupe", "pareto", "rank"] as const;
export interface DesignExecutionReportV2 { pipeline: typeof PIPELINE_STAGES_V2; counts: GenerationCountsV2; rejections: GenerationRejectionV2[] }
export interface DesignGenerationV2 { result: DesignResultV2; execution: DesignExecutionReportV2 }
export interface DesignResultExecutionContextV2 { trustedSubcircuitRegistry?: TrustedSubcircuitRegistry }

export type PrimaryPartCustomizationEvaluationErrorCodeV1 =
  | "invalid_instruction"
  | "invalid_source"
  | "context_mismatch"
  | "policy_mismatch"
  | "profile_mismatch"
  | "recipe_role_mismatch"
  | "target_not_unique"
  | "customized_result_mismatch";

export class PrimaryPartCustomizationEvaluationErrorV1 extends Error {
  readonly code: PrimaryPartCustomizationEvaluationErrorCodeV1;
  readonly path: string;
  constructor(code: PrimaryPartCustomizationEvaluationErrorCodeV1, path = "") {
    super(`scheMAGIC primary-part customization evaluation failed (${code}) at ${path || "/"}`);
    this.name = "PrimaryPartCustomizationEvaluationErrorV1";
    this.code = code;
    this.path = path;
  }
}

export interface PrimaryPartCustomizationObservationV1 {
  readonly kind: "primary_part_customization_observation";
  readonly application: DesignApplication;
  readonly instructionContentHash: Sha256ContentHash;
  readonly baseGeneration: Readonly<DesignGenerationV2>;
  readonly sourceCandidate: Readonly<DesignCandidateV2>;
  readonly targetCandidate: Readonly<DesignCandidateV2>;
  readonly claimBoundary: Readonly<{
    constraintPolicyEligibility: "not_evaluated";
    selectedPartModel: "not_added";
  }>;
}

export type DesignResultV1Regeneration =
  | { status: "generated"; generation: DesignGenerationV2 }
  | import("@opencircuit/design-schema").DesignRequestV2MigrationBlock;

export type {
  DesignLibraryDocuments, DesignProfileCodec, DesignProfileEnvelope, DesignProfileFor,
  DesignProfileForCodec, PartClassId, VersionedDesignProfileCodec,
  DesignRecipe, DesignCandidateV2, DesignResultV2, RejectedCandidateV2,
};
