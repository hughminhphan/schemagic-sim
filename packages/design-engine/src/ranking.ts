import type { CandidateMetric } from "@opencircuit/design-schema";
import type { CandidateSourcingMetrics } from "@opencircuit/sourcing-schema";
import { canonicalStringify, contentHash } from "./canonical";
import type { JsonObject, RankedCandidateDraft, RankingCriterion } from "./types";

function metric(candidate: RankedCandidateDraft, id: string): CandidateMetric | undefined {
  return candidate.metrics.values.find((entry) => entry.id === id);
}

interface ComparableValue { value: number; unit: string }

function sourcingValue(sourcing: CandidateSourcingMetrics | undefined, field: Extract<RankingCriterion, { source: "sourcing" }>["field"]): ComparableValue | undefined {
  if (!sourcing) return undefined;
  if (field === "buildableQuantity") return sourcing.buildableQuantity === undefined ? undefined : { value: sourcing.buildableQuantity, unit: "count" };
  if (field === "maximumLeadTimeDays") return sourcing.maximumLeadTimeDays === undefined ? undefined : { value: sourcing.maximumLeadTimeDays, unit: "day" };
  return sourcing.extendedBomCost === undefined ? undefined : { value: sourcing.extendedBomCost.amount, unit: sourcing.extendedBomCost.currency };
}

function criterionValue(candidate: RankedCandidateDraft, criterion: RankingCriterion): ComparableValue | undefined {
  if (criterion.source === "sourcing") return sourcingValue(candidate.sourcing, criterion.field);
  const value = metric(candidate, criterion.metricId)?.value;
  return value === null || value === undefined ? undefined : { value: value.value, unit: value.unit };
}

function compareCriterion(a: RankedCandidateDraft, b: RankedCandidateDraft, criterion: RankingCriterion): number {
  const left = criterionValue(a, criterion);
  const right = criterionValue(b, criterion);
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (left.unit !== right.unit) return 0;
  const delta = left.value - right.value;
  return criterion.direction === "minimize" ? delta : -delta;
}

export interface CandidateIdentityInput {
  recipe: { id: string; version: string; contentHash: string };
  library: { version: string; contentHash: string };
  data: JsonObject;
  components: RankedCandidateDraft["components"];
  derivedValues: RankedCandidateDraft["derivedValues"];
}

export function candidateIdentity(candidate: CandidateIdentityInput): string {
  return contentHash({
    recipe: candidate.recipe,
    library: candidate.library,
    components: candidate.components,
    derivedValues: candidate.derivedValues,
    data: candidate.data,
  });
}

export function candidateDedupeKey(candidate: RankedCandidateDraft): string {
  return contentHash({ components: candidate.components, derivedValues: candidate.derivedValues });
}

export function dedupeCandidates(candidates: readonly RankedCandidateDraft[]): {
  survivors: RankedCandidateDraft[];
  duplicates: Array<{ duplicate: RankedCandidateDraft; kept: RankedCandidateDraft }>;
} {
  const survivors: RankedCandidateDraft[] = [];
  const duplicates: Array<{ duplicate: RankedCandidateDraft; kept: RankedCandidateDraft }> = [];
  const byKey = new Map<string, RankedCandidateDraft>();
  for (const candidate of [...candidates].sort((a, b) => a.id.localeCompare(b.id) || a.optionKey.localeCompare(b.optionKey))) {
    const key = candidateDedupeKey(candidate);
    const kept = byKey.get(key);
    if (kept) duplicates.push({ duplicate: candidate, kept });
    else {
      byKey.set(key, candidate);
      survivors.push(candidate);
    }
  }
  return { survivors, duplicates };
}

function dominates(a: RankedCandidateDraft, b: RankedCandidateDraft, criteria: readonly RankingCriterion[]): boolean {
  if (criteria.length === 0) return false;
  let strictlyBetter = false;
  for (const criterion of criteria) {
    const left = criterionValue(a, criterion);
    const right = criterionValue(b, criterion);
    if (!left || !right || left.unit !== right.unit) return false;
    const comparison = compareCriterion(a, b, criterion);
    if (comparison > 0) return false;
    if (comparison < 0) strictlyBetter = true;
  }
  return strictlyBetter;
}

export function paretoPrune(candidates: readonly RankedCandidateDraft[], criteria: readonly RankingCriterion[]): {
  survivors: RankedCandidateDraft[];
  dominated: Array<{ candidate: RankedCandidateDraft; dominator: RankedCandidateDraft }>;
} {
  const ordered = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  const dominated: Array<{ candidate: RankedCandidateDraft; dominator: RankedCandidateDraft }> = [];
  const survivors = ordered.filter((candidate) => {
    const dominator = ordered.find((other) => other.id !== candidate.id && dominates(other, candidate, criteria));
    if (!dominator) return true;
    dominated.push({ candidate, dominator });
    return false;
  });
  return { survivors, dominated };
}

export function rankCandidates(candidates: readonly RankedCandidateDraft[], criteria: readonly RankingCriterion[]): RankedCandidateDraft[] {
  return [...candidates].sort((a, b) => {
    for (const criterion of criteria) {
      const comparison = compareCriterion(a, b, criterion);
      if (comparison !== 0) return comparison;
    }
    return a.id.localeCompare(b.id);
  });
}

export function stableCandidateBytes(candidate: RankedCandidateDraft): string {
  const { recipe: _recipe, sourcing: _sourcing, electricalConstraints: _electricalConstraints, ...serializable } = candidate;
  return canonicalStringify(serializable);
}
