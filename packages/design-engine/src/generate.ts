import type {
  CandidateMetrics,
  ConstraintResult,
  DesignCandidate,
  DesignRequest,
  SelectedComponent,
} from "@opencircuit/design-schema";
import { designRequestHash } from "@opencircuit/design-schema";
import {
  emptyLifecycleCounts,
  parseCandidateSourcingMetrics,
  parseOfferSnapshot,
  type CandidateSourcingMetrics,
} from "@opencircuit/sourcing-schema";
import { canonicalStringify, contentHash } from "./canonical";
import { normalizeDesignRequest, toElectricalDesignRequest } from "./normalize";
import { candidateIdentity, dedupeCandidates, paretoPrune, rankCandidates } from "./ranking";
import {
  PIPELINE_STAGES,
  type CandidateEstimate,
  type CandidateForMaterialization,
  type DesignGeneration,
  type DesignLibrary,
  type GenerateContext,
  type GenerationCounts,
  type GenerationRejection,
  type RankedCandidateDraft,
  type RecipeEnvironment,
  type SourcingCandidate,
} from "./types";

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function normalizeLibrary(library: Readonly<DesignLibrary>): Readonly<DesignLibrary> {
  const normalized = JSON.parse(canonicalStringify(library)) as DesignLibrary;
  if (!normalized.version?.trim()) throw new Error("Design library version is required");
  if (!normalized.contentHash?.trim()) throw new Error("Design library contentHash is required");
  if (!Array.isArray(normalized.paretoCriteria) || !normalized.rankingProfiles || typeof normalized.rankingProfiles !== "object") {
    throw new Error("Design library ranking contracts are required");
  }
  return deepFreeze(normalized);
}

function sortedConstraints(values: readonly ConstraintResult[]): ConstraintResult[] {
  return [...values].sort((a, b) => a.ruleId.localeCompare(b.ruleId) || contentHash(a).localeCompare(contentHash(b)));
}

function sortedComponents(values: readonly SelectedComponent[]): SelectedComponent[] {
  return [...values].sort((a, b) => a.id.localeCompare(b.id) || contentHash(a).localeCompare(contentHash(b)));
}

function buildMetrics(estimate: CandidateEstimate, constraints: readonly ConstraintResult[]): CandidateMetrics {
  const values = [...estimate.metrics].sort((a, b) => a.id.localeCompare(b.id) || contentHash(a).localeCompare(contentHash(b)));
  return {
    values,
    warningCount: constraints.filter((entry) => entry.status === "warning").length,
    estimateCount: values.filter((entry) => entry.state === "estimated").length,
    unknownCount: constraints.filter((entry) => entry.status === "unknown").length + values.filter((entry) => entry.state === "unknown" || entry.value === null).length,
  };
}

function unavailableSourcingMetrics(request: Readonly<DesignRequest>, components: readonly SelectedComponent[], evaluatedAt: string): CandidateSourcingMetrics {
  if (!request.sourcing) throw new Error("Unavailable sourcing metrics require a sourcing policy");
  return {
    schemaVersion: 1,
    status: "unavailable",
    requestedBuildQuantity: request.sourcing.buildQuantity,
    evaluatedAt,
    snapshotIds: [],
    lines: components.map((component) => ({
      bomLineId: component.id,
      part: component.part,
      quantityPerAssembly: component.quantityPerAssembly,
      status: "unavailable" as const,
      warnings: ["No validated offer snapshot was available"],
    })),
    lifecycleCounts: emptyLifecycleCounts(),
    warnings: ["Sourcing is unavailable without a validated offer snapshot; electrical candidates were retained"],
  };
}

function candidateForSourcing(candidate: RankedCandidateDraft): SourcingCandidate {
  return deepFreeze({
    id: candidate.id,
    requestHash: candidate.requestHash,
    recipeId: candidate.recipeId,
    libraryVersion: candidate.libraryVersion,
    components: candidate.components,
    derivedValues: candidate.derivedValues,
    constraints: candidate.electricalConstraints,
    metrics: candidate.metrics,
  }) as SourcingCandidate;
}

function candidateForMaterialization(candidate: RankedCandidateDraft): CandidateForMaterialization {
  return {
    id: candidate.id,
    recipeId: candidate.recipeId,
    libraryVersion: candidate.libraryVersion,
    optionKey: candidate.optionKey,
    data: candidate.data,
    components: candidate.components,
    derivedValues: candidate.derivedValues,
    constraints: candidate.electricalConstraints,
    metrics: candidate.metrics,
    simulationCoverage: candidate.simulationCoverage,
    warnings: candidate.warnings,
  };
}

function constraintRejectionReason(constraints: readonly ConstraintResult[], request: Readonly<DesignRequest>): string | undefined {
  if (constraints.some((entry) => entry.status === "fail")) return "Hard electrical constraint failed";
  if (!request.constraints.allowUnknownHardConstraints && constraints.some((entry) => entry.status === "unknown")) return "Unknown constraint evidence is disallowed by the request";
  if (!request.constraints.allowUnknownWarnings && constraints.some((entry) => entry.status === "warning")) return "Constraint warnings are disallowed by the request";
  return undefined;
}

function rejection(
  stage: GenerationRejection["stage"],
  recipeId: string,
  optionKey: string,
  reason: string,
  constraints: readonly ConstraintResult[] = [],
  componentProfileIds: readonly string[] = [],
  candidateId?: string,
): GenerationRejection {
  return {
    stage,
    recipeId,
    optionKey,
    ...(candidateId === undefined ? {} : { candidateId }),
    componentProfileIds: stableUnique(componentProfileIds),
    constraints: sortedConstraints(constraints),
    reason,
  };
}

function timestamp(value: string): string {
  if (!value.includes("T") || !Number.isFinite(Date.parse(value))) throw new Error("GenerateContext.evaluatedAt must be an RFC 3339 timestamp");
  return new Date(value).toISOString();
}

export function generateDesign(request: DesignRequest, context: GenerateContext): DesignGeneration {
  const evaluatedAt = timestamp(context.evaluatedAt);
  const normalized = normalizeDesignRequest(request);
  const library = normalizeLibrary(context.library);
  if (normalized.libraryVersion !== library.version) throw new Error(`Request pins library ${normalized.libraryVersion}, but context provides ${library.version}`);
  const requestHash = designRequestHash(normalized as DesignRequest);
  const environment: RecipeEnvironment = { request: toElectricalDesignRequest(normalized), library };
  const offerSnapshots = (context.offerSnapshots ?? []).map((snapshot) => deepFreeze(parseOfferSnapshot(snapshot)));
  const rejections: GenerationRejection[] = [];
  const counts: GenerationCounts = {
    recipes: 0,
    enumerated: 0,
    solved: 0,
    matched: 0,
    checked: 0,
    estimated: 0,
    sourced: 0,
    deduped: 0,
    pareto: 0,
    materialized: 0,
    rejected: 0,
  };
  const checkedCandidates: RankedCandidateDraft[] = [];
  const recipes = [...context.recipes]
    .filter((recipe) => recipe.supports(environment.request))
    .sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version) || a.contentHash.localeCompare(b.contentHash));
  counts.recipes = recipes.length;

  for (const recipe of recipes) {
    const options = [...recipe.enumerate(environment)]
      .sort((a, b) => a.optionKey.localeCompare(b.optionKey) || contentHash(a.data).localeCompare(contentHash(b.data)));
    counts.enumerated += options.length;
    for (const option of options) {
      const solved = recipe.solve(option, environment);
      if (solved.status === "rejected") {
        rejections.push(rejection("solve", recipe.id, option.optionKey, solved.reason, solved.constraints, solved.componentProfileIds));
        continue;
      }
      counts.solved += 1;
      const matches = [...recipe.match(solved.value, environment)]
        .sort((a, b) => contentHash(a).localeCompare(contentHash(b)));
      for (const matched of matches) {
        if (matched.status === "rejected") {
          rejections.push(rejection("match", recipe.id, solved.value.optionKey, matched.reason, matched.constraints, matched.componentProfileIds));
          continue;
        }
        counts.matched += 1;
        const checked = sortedConstraints(recipe.check(matched.value, environment));
        counts.checked += 1;
        const rejectReason = constraintRejectionReason(checked, normalized);
        const profileIds = matched.value.components.map((component) => component.profileId);
        if (rejectReason) {
          rejections.push(rejection("check", recipe.id, matched.value.optionKey, rejectReason, checked, profileIds));
          continue;
        }
        const estimate = recipe.estimate(matched.value, checked, environment);
        counts.estimated += 1;
        const metrics = buildMetrics(estimate, checked);
        const identityInput = {
          recipeId: recipe.id,
          optionKey: matched.value.optionKey,
          data: matched.value.data,
          components: sortedComponents(matched.value.components),
          derivedValues: [...matched.value.derivedValues].sort((a, b) => a.id.localeCompare(b.id) || contentHash(a).localeCompare(contentHash(b))),
          constraints: checked,
          metrics,
          simulationCoverage: [...matched.value.simulationCoverage].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId) || contentHash(a).localeCompare(contentHash(b))),
          warnings: stableUnique([...matched.value.warnings, ...estimate.warnings]),
        };
        const id = candidateIdentity({
          recipe: { id: recipe.id, version: recipe.version, contentHash: recipe.contentHash },
          library: { version: library.version, contentHash: library.contentHash },
          data: identityInput.data,
          components: identityInput.components,
          derivedValues: identityInput.derivedValues,
        });
        const candidate: RankedCandidateDraft = {
          ...identityInput,
          id,
          requestHash,
          libraryVersion: normalized.libraryVersion,
          recipe,
          electricalConstraints: checked,
        };

        if (normalized.sourcing) {
          if (context.evaluateSourcing && offerSnapshots.length > 0) {
            const evaluation = context.evaluateSourcing(candidateForSourcing(candidate), offerSnapshots, normalized.sourcing, evaluatedAt);
            const sourcingMetrics = parseCandidateSourcingMetrics(evaluation.metrics);
            if (sourcingMetrics.evaluatedAt !== evaluatedAt) throw new Error("Sourcing evaluation timestamp must equal GenerateContext.evaluatedAt");
            if (sourcingMetrics.requestedBuildQuantity !== normalized.sourcing.buildQuantity) throw new Error("Sourcing evaluation build quantity must equal the request policy");
            const snapshotIds = new Set(offerSnapshots.map((snapshot) => snapshot.id));
            if (sourcingMetrics.snapshotIds.some((id) => !snapshotIds.has(id))) throw new Error("Sourcing evaluation references a snapshot outside GenerateContext.offerSnapshots");
            counts.sourced += 1;
            candidate.sourcing = sourcingMetrics;
            const sourcingConstraints = structuredClone(evaluation.constraints);
            candidate.constraints = sortedConstraints([...candidate.constraints, ...sourcingConstraints]);
            if (!evaluation.eligible || sourcingConstraints.some((entry) => entry.status === "fail")) {
              rejections.push(rejection("sourcing", recipe.id, candidate.optionKey, "Candidate rejected by the sourcing policy", sourcingConstraints, profileIds, candidate.id));
              continue;
            }
          } else {
            candidate.sourcing = unavailableSourcingMetrics(normalized, candidate.components, evaluatedAt);
          }
        }
        checkedCandidates.push(candidate);
      }
    }
  }

  const deduped = dedupeCandidates(checkedCandidates);
  counts.deduped = deduped.survivors.length;
  for (const entry of deduped.duplicates) {
    rejections.push(rejection("dedupe", entry.duplicate.recipeId, entry.duplicate.optionKey, `Duplicate of ${entry.kept.id}`, [], entry.duplicate.components.map((component) => component.profileId), entry.duplicate.id));
  }
  const pareto = paretoPrune(deduped.survivors, library.paretoCriteria);
  counts.pareto = pareto.survivors.length;
  for (const entry of pareto.dominated) {
    rejections.push(rejection("pareto", entry.candidate.recipeId, entry.candidate.optionKey, `Dominated by ${entry.dominator.id}`, [], entry.candidate.components.map((component) => component.profileId), entry.candidate.id));
  }
  const rankingCriteria = library.rankingProfiles[normalized.objective] ?? [];
  const ranked = rankCandidates(pareto.survivors, rankingCriteria);
  const candidates: DesignCandidate[] = ranked.map((candidate) => {
    const circuit = candidate.recipe.materialize(candidateForMaterialization(candidate), environment);
    counts.materialized += 1;
    return {
      schemaVersion: 1,
      id: candidate.id,
      requestHash: candidate.requestHash,
      recipeId: candidate.recipeId,
      libraryVersion: candidate.libraryVersion,
      components: candidate.components,
      derivedValues: candidate.derivedValues,
      constraints: candidate.constraints,
      metrics: candidate.metrics,
      ...(candidate.sourcing === undefined ? {} : { sourcing: candidate.sourcing }),
      simulationCoverage: candidate.simulationCoverage,
      circuit,
      warnings: candidate.warnings,
    };
  });
  counts.rejected = rejections.length;

  const orderedRejections = rejections.sort((a, b) => a.stage.localeCompare(b.stage)
    || a.recipeId.localeCompare(b.recipeId)
    || a.optionKey.localeCompare(b.optionKey)
    || (a.candidateId ?? "").localeCompare(b.candidateId ?? "")
    || contentHash(a).localeCompare(contentHash(b)));
  return {
    format: "schemagic-design-result",
    schemaVersion: 1,
    request: normalized as DesignRequest,
    requestHash,
    libraryVersion: library.version,
    libraryContentHash: library.contentHash,
    candidates,
    rejectedCandidates: orderedRejections.map((entry) => ({
      recipeId: entry.recipeId,
      componentProfileIds: entry.componentProfileIds,
      constraints: entry.constraints,
    })),
    diagnostics: [],
    rejections: orderedRejections,
    trace: { pipeline: PIPELINE_STAGES, counts },
  };
}
