import {
  canonicalDesignV2Payload, compareDesignV2Tokens, designSha256ContentHash,
  type CandidateIdV2, type DerivedValue, type SelectedComponent,
} from "@opencircuit/design-schema";
import type {
  CandidateIdentityDerivedValueV2, CandidateIdentityInputV2,
  CandidateIdentitySelectedComponentV2, ElectricalRankingCriterionV2,
} from "./v2-types";

export function projectCandidateIdentitySelectedComponentsV2(components: readonly SelectedComponent[]): CandidateIdentitySelectedComponentV2[] {
  return components.map((component) => ({ ...component, ...(component.value ? { value: { value: component.value.value, unit: component.value.unit } } : {}) }));
}
export function projectCandidateIdentityDerivedValuesV2(values: readonly DerivedValue[]): CandidateIdentityDerivedValueV2[] {
  return values.map((entry) => ({ ...entry, value: { value: entry.value.value, unit: entry.value.unit } }));
}
export function canonicalCandidateIdentityV2(input: Readonly<CandidateIdentityInputV2>): CandidateIdV2 {
  const hash = designSha256ContentHash(canonicalDesignV2Payload({
    recipe: input.recipe, context: input.context, requestHash: input.requestHash, data: input.data,
    components: input.components, derivedValues: input.derivedValues,
  }));
  return `candidate:v2:${hash}`;
}
export function candidateDedupeKeyV2(input: Readonly<CandidateIdentityInputV2>): string { return canonicalCandidateIdentityV2(input); }

interface Rankable { id: CandidateIdV2; metrics: { values: Array<{ id: string; value: { value: number; unit: string } | null }> } }
function metric(candidate: Rankable, criterion: ElectricalRankingCriterionV2): number | undefined {
  const value = candidate.metrics.values.find((entry) => entry.id === criterion.metricId)?.value?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
export function compareCandidatesByCriteriaV2(left: Rankable, right: Rankable, criteria: readonly ElectricalRankingCriterionV2[]): number {
  for (const criterion of criteria) {
    const a = metric(left, criterion); const b = metric(right, criterion);
    if (a === undefined || b === undefined || a === b) continue;
    return criterion.direction === "minimize" ? a - b : b - a;
  }
  return compareDesignV2Tokens(left.id, right.id);
}
export function candidateCompleteForCriteriaV2(candidate: Rankable, criteria: readonly ElectricalRankingCriterionV2[]): boolean {
  return criteria.every((criterion) => metric(candidate, criterion) !== undefined);
}
export function dominatesCandidateV2(left: Rankable, right: Rankable, criteria: readonly ElectricalRankingCriterionV2[]): boolean {
  let better = false;
  for (const criterion of criteria) {
    const a = metric(left, criterion)!; const b = metric(right, criterion)!;
    if (criterion.direction === "minimize" ? a > b : a < b) return false;
    if (a !== b) better = true;
  }
  return better;
}
