import { snapshotFreshnessAt, type CandidateSourcingMetrics, type OfferSnapshot, type SourcingPolicy } from "@opencircuit/sourcing-schema";
import { escapeHtml, formatIdentifier, statusChip } from "./view";

const STATUS_COPY: Record<CandidateSourcingMetrics["status"], string> = {
  unavailable: "No validated offer snapshot was available. Electrical eligibility is unchanged.",
  complete: "Every BOM line has an evaluated sourcing observation under the active policy.",
  partial: "Some providers or BOM lines are missing. Commercial conclusions are incomplete.",
  stale: "The sourcing observation is older than the active freshness limit.",
  provider_error: "A provider failed. Electrical candidates remain available without invented commercial data.",
};

function snapshotList(metrics: CandidateSourcingMetrics, snapshots: readonly OfferSnapshot[], policy: SourcingPolicy | undefined): string {
  if (metrics.snapshotIds.length === 0) return "";
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return `<ul class="designer-snapshot-list">${metrics.snapshotIds.map((id) => {
    const snapshot = byId.get(id);
    if (!snapshot) return `<li><code>${escapeHtml(id)}</code><span>Reference retained; offer data not embedded</span></li>`;
    const freshness = snapshotFreshnessAt(snapshot, metrics.evaluatedAt, policy?.maximumSnapshotAgeSeconds);
    return `<li><code>${escapeHtml(id)}</code>${statusChip(freshness)}<span>${escapeHtml(snapshot.provider)} · retrieved <time datetime="${escapeHtml(snapshot.retrievedAt)}">${escapeHtml(snapshot.retrievedAt)}</time></span></li>`;
  }).join("")}</ul>`;
}

function formatLeadTime(days: number | undefined, kind: string | undefined): string {
  if (days === undefined) return "Unknown";
  return `${days} days · ${formatIdentifier(kind ?? "unknown")}`;
}

export function renderSourcingStatus(
  metrics: CandidateSourcingMetrics | undefined,
  snapshots: readonly OfferSnapshot[],
  policy: SourcingPolicy | undefined,
): string {
  if (!metrics) {
    return `<section class="designer-sourcing-panel" aria-labelledby="designer-sourcing-title"><header><h3 id="designer-sourcing-title">Robonyx Sourcing</h3>${statusChip("unavailable")}</header><p>${STATUS_COPY.unavailable}</p></section>`;
  }
  const cost = metrics.extendedBomCost
    ? `${metrics.extendedBomCost.currency} ${metrics.extendedBomCost.amount.toFixed(2)}`
    : "Unknown";
  const buildable = metrics.buildableQuantity === undefined ? "Unknown" : String(metrics.buildableQuantity);
  const leadTime = formatLeadTime(metrics.maximumLeadTimeDays, metrics.maximumLeadTimeKind);
  return `<section class="designer-sourcing-panel" aria-labelledby="designer-sourcing-title" data-status="${metrics.status}"><header><div><span class="designer-section-code">DATED OBSERVATION</span><h3 id="designer-sourcing-title">Robonyx Sourcing</h3></div>${statusChip(metrics.status)}</header><p>${STATUS_COPY[metrics.status]}</p><dl class="designer-stat-grid"><div><dt>Buildable quantity</dt><dd>${escapeHtml(buildable)}</dd></div><div><dt>Extended BOM cost</dt><dd>${escapeHtml(cost)}</dd></div><div><dt>Maximum lead time</dt><dd>${escapeHtml(leadTime)}</dd></div><div><dt>Distributor split</dt><dd>${metrics.distributorSplitCount ?? "Unknown"}</dd></div></dl><p class="designer-timestamp">Evaluated <time datetime="${escapeHtml(metrics.evaluatedAt)}">${escapeHtml(metrics.evaluatedAt)}</time>${metrics.snapshotAgeSeconds === undefined ? "" : ` · ${metrics.snapshotAgeSeconds}s old`}</p>${snapshotList(metrics, snapshots, policy)}${metrics.warnings.length > 0 ? `<ul class="designer-warning-list">${metrics.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}<div class="designer-table-wrap"><table class="designer-bom-table"><thead><tr><th scope="col">BOM line</th><th scope="col">Part</th><th scope="col">Status</th><th scope="col">Distributor</th><th scope="col">Stock</th><th scope="col">Lifecycle</th><th scope="col">Lead time</th></tr></thead><tbody>${metrics.lines.map((line) => `<tr><th scope="row">${escapeHtml(line.bomLineId)}</th><td><code>${escapeHtml(line.part.manufacturerId)} / ${escapeHtml(line.part.manufacturerPartNumber)}</code></td><td>${statusChip(line.status)}</td><td>${escapeHtml(line.selectedOffer?.distributor ?? "Unknown")}</td><td>${line.stockQuantity ?? "Unknown"}</td><td>${escapeHtml(line.lifecycle ? formatIdentifier(line.lifecycle) : "Unknown")}</td><td>${escapeHtml(formatLeadTime(line.leadTimeDays, line.leadTimeKind))}</td></tr>`).join("")}</tbody></table></div></section>`;
}
