import type { DesignCandidate, DesignRequest, EvidenceRef } from "@opencircuit/design-schema";
import type { OfferSnapshot } from "@opencircuit/sourcing-schema";
import { encodeCircuit } from "../../share";
import { LEGACY_INLINE_SOURCING_EXPORT_REASON } from "./ResultImport";
import { renderSourcingStatus } from "./SourcingStatus";
import { escapeHtml, formatIdentifier, formatQuantity, statusChip } from "./view";

function simulatorUrl(candidate: Readonly<DesignCandidate>, simulatorPath: string): string {
  const base = typeof window === "undefined" ? "http://localhost/" : window.location.href;
  const url = new URL(simulatorPath, base);
  url.hash = `c=${encodeCircuit(candidate.circuit)}`;
  return url.toString();
}

function evidenceKey(evidence: EvidenceRef): string {
  return `${evidence.sourceId}\u0000${evidence.locator}\u0000${evidence.contentHash ?? ""}`;
}

function candidateEvidence(candidate: Readonly<DesignCandidate>): EvidenceRef[] {
  const all = [
    ...candidate.components.flatMap((component) => component.evidence),
    ...candidate.derivedValues.flatMap((value) => value.evidence),
    ...candidate.metrics.values.flatMap((metric) => metric.evidence),
    ...candidate.constraints.flatMap((constraint) => constraint.evidence),
  ];
  return [...new Map(all.map((evidence) => [evidenceKey(evidence), evidence])).values()]
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.locator.localeCompare(right.locator));
}

function constraintMarkup(candidate: Readonly<DesignCandidate>): string {
  if (candidate.constraints.length === 0) return `<p class="designer-empty-copy">No constraint results were reported.</p>`;
  return `<div class="designer-constraint-list">${candidate.constraints.map((constraint) => `<article data-status="${constraint.status}"><header>${statusChip(constraint.status)}<code>${escapeHtml(constraint.ruleId)}</code></header><p>${escapeHtml(constraint.explanation)}</p><dl><div><dt>Actual</dt><dd>${escapeHtml(formatQuantity(constraint.actual))}</dd></div><div><dt>Limit</dt><dd>${escapeHtml(formatQuantity(constraint.limit))}</dd></div><div><dt>Margin</dt><dd>${escapeHtml(formatQuantity(constraint.margin))}</dd></div><div><dt>Evidence</dt><dd>${constraint.evidence.length}</dd></div></dl></article>`).join("")}</div>`;
}

export function renderCandidateDetail(
  candidate: Readonly<DesignCandidate>,
  request: Readonly<DesignRequest>,
  snapshots: readonly OfferSnapshot[],
  simulatorPath: string,
  jsonExportEnabled = true,
): string {
  const evidence = candidateEvidence(candidate);
  const openHref = simulatorUrl(candidate, simulatorPath);
  const jsonAction = jsonExportEnabled ? `<button data-designer-export="json">Design JSON</button>` : `<button disabled>Design JSON</button>`;
  const jsonGate = jsonExportEnabled ? "Legacy candidate JSON is electrical-only." : escapeHtml(LEGACY_INLINE_SOURCING_EXPORT_REASON);
  return `<section class="designer-candidate-detail" aria-labelledby="designer-candidate-title"><header class="designer-detail-header"><div><span class="designer-kicker">Candidate detail</span><h2 id="designer-candidate-title">${escapeHtml(formatIdentifier(candidate.recipeId))}</h2><code>${escapeHtml(candidate.id)}</code></div><div class="designer-detail-actions">${jsonAction}<button disabled>BOM CSV</button><button disabled>SPICE netlist</button><a class="designer-primary-action" href="${escapeHtml(openHref)}">Open in scheMAGIC Simulator →</a></div></header><p class="designer-export-gate">${jsonGate} BOM and SPICE export require the exact production V2 engineering and execution contexts, which are not installed for this V1 adapter result.</p>${candidate.warnings.length > 0 ? `<section class="designer-warning-panel" aria-labelledby="designer-warning-title"><h3 id="designer-warning-title">Warnings</h3><ul>${candidate.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></section>` : ""}<div class="designer-detail-grid"><section aria-labelledby="designer-metrics-title"><header><span class="designer-section-code">OPERATING VALUES</span><h3 id="designer-metrics-title">Metrics</h3></header><div class="designer-metric-grid">${candidate.metrics.values.map((metric) => `<article><div>${statusChip(metric.state)}<span>${escapeHtml(formatIdentifier(metric.id))}</span></div><strong>${escapeHtml(formatQuantity(metric.value ?? undefined))}</strong><p>${escapeHtml(metric.explanation)}</p></article>`).join("")}</div></section><section aria-labelledby="designer-bom-title"><header><span class="designer-section-code">SELECTED PARTS</span><h3 id="designer-bom-title">Bill of materials</h3></header><div class="designer-table-wrap"><table class="designer-bom-table"><thead><tr><th scope="col">Line</th><th scope="col">Role</th><th scope="col">Manufacturer / MPN</th><th scope="col">Qty</th><th scope="col">Value</th><th scope="col">Evidence</th></tr></thead><tbody>${candidate.components.map((component) => `<tr><th scope="row">${escapeHtml(component.id)}</th><td>${escapeHtml(component.role)}</td><td><code>${escapeHtml(component.part.manufacturerId)} / ${escapeHtml(component.part.manufacturerPartNumber)}</code></td><td>${component.quantityPerAssembly}</td><td>${escapeHtml(formatQuantity(component.value))}</td><td>${component.evidence.length}</td></tr>`).join("")}</tbody></table></div></section></div><section class="designer-constraint-panel" aria-labelledby="designer-constraints-title"><header><span class="designer-section-code">PASS · WARNING · UNKNOWN</span><h3 id="designer-constraints-title">Constraints and margins</h3></header>${constraintMarkup(candidate)}</section>${renderSourcingStatus(candidate.sourcing, snapshots, request.sourcing)}<section class="designer-coverage" aria-labelledby="designer-coverage-title"><header><span class="designer-section-code">MODEL BOUNDARY</span><h3 id="designer-coverage-title">Simulation coverage</h3></header>${candidate.simulationCoverage.length > 0 ? `<div>${candidate.simulationCoverage.map((coverage) => `<article>${statusChip(coverage.modelTier)}<strong>${escapeHtml(formatIdentifier(coverage.scenarioId))}</strong>${coverage.limitations.length > 0 ? `<ul>${coverage.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")}</ul>` : `<p>No declared limitations.</p>`}</article>`).join("")}</div>` : `<p class="designer-empty-copy">No named simulation scenario is available. Analytic results remain inspectable.</p>`}</section><section class="designer-evidence" aria-labelledby="designer-evidence-title"><header><span class="designer-section-code">TRACEABILITY</span><h3 id="designer-evidence-title">Evidence register</h3></header>${evidence.length > 0 ? `<ol>${evidence.map((entry) => `<li><code>${escapeHtml(entry.sourceId)}</code><strong>${escapeHtml(entry.locator)}</strong><span>${escapeHtml(entry.licenseNote)}</span>${entry.retrievedAt ? `<time datetime="${escapeHtml(entry.retrievedAt)}">${escapeHtml(entry.retrievedAt)}</time>` : ""}</li>`).join("")}</ol>` : `<p class="designer-empty-copy">No evidence references were attached. Related values must remain unknown or visibly estimated.</p>`}</section></section>`;
}
