import type { CandidateMetric, DesignCandidate } from "@opencircuit/design-schema";
import { escapeHtml, formatIdentifier, formatQuantity, statusChip } from "./view";

function metricById(candidate: Readonly<DesignCandidate>, id: string): CandidateMetric | undefined {
  return candidate.metrics.values.find((metric) => metric.id === id);
}

function comparisonMetricIds(candidates: readonly DesignCandidate[]): string[] {
  return [...new Set(candidates.flatMap((candidate) => candidate.metrics.values.map((metric) => metric.id)))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 5);
}

export function renderCandidateComparison(
  candidates: readonly DesignCandidate[],
  selectedCandidateId: string | undefined,
  pinnedCandidateIds: ReadonlySet<string>,
): string {
  if (candidates.length === 0) {
    return `<section class="designer-empty-results" aria-labelledby="designer-empty-title"><span class="designer-empty-glyph" aria-hidden="true">∅</span><h2 id="designer-empty-title">No candidate passed</h2><p>Review the rejected constraints and adjust the request. No hard failure was hidden by ranking.</p></section>`;
  }
  const metricIds = comparisonMetricIds(candidates);
  return `<section class="designer-comparison" aria-labelledby="designer-comparison-title"><header><div><span class="designer-section-code">PARETO SET</span><h2 id="designer-comparison-title">Compare candidates</h2><p>Raw values remain visible; unknown evidence is never replaced with zero.</p></div><span class="designer-result-count">${candidates.length} viable</span></header><div class="designer-table-wrap"><table class="designer-comparison-table"><thead><tr><th scope="col">Pin</th><th scope="col">Candidate</th>${metricIds.map((id) => `<th scope="col">${escapeHtml(formatIdentifier(id))}</th>`).join("")}<th scope="col">Evidence state</th><th scope="col">Sourcing</th></tr></thead><tbody>${candidates.map((candidate, index) => `<tr${candidate.id === selectedCandidateId ? " aria-current=\"true\"" : ""}><td><input type="checkbox" data-designer-pin="${escapeHtml(candidate.id)}" aria-label="Pin candidate ${index + 1}"${pinnedCandidateIds.has(candidate.id) ? " checked" : ""}></td><th scope="row"><button data-designer-candidate="${escapeHtml(candidate.id)}"><span>C${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(formatIdentifier(candidate.recipeId))}</strong><small>${escapeHtml(candidate.id)}</small></button></th>${metricIds.map((id) => {
    const metric = metricById(candidate, id);
    return `<td>${metric ? `<strong>${escapeHtml(formatQuantity(metric.value ?? undefined))}</strong>${statusChip(metric.state)}` : statusChip("unknown")}</td>`;
  }).join("")}<td><span>${candidate.metrics.warningCount} warnings</span><span>${candidate.metrics.estimateCount} estimates</span><span>${candidate.metrics.unknownCount} unknown</span></td><td>${statusChip(candidate.sourcing?.status ?? "unavailable")}</td></tr>`).join("")}</tbody></table></div><p class="designer-pin-note">Pin up to three candidates. Pins preserve comparison context while you inspect details.</p></section>`;
}
