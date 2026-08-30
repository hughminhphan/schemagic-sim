import type {
  DesignCandidate,
  DesignCandidateV2,
  EvidenceRef,
  CandidateConstraintDecisionV3,
  ConstraintDecisionV3,
  ParsedPersistedDesignResult,
} from "@opencircuit/design-schema";
import {
  planDesignResultScenarioExportsV2,
  type ScenarioExportPlanEntryV2,
} from "@opencircuit/design-export/scenario-plan-v2";
import {
  LEGACY_INLINE_SOURCING_EXPORT_REASON,
  importedResultHasLegacyInlineSourcing,
  type ImportedDesignResult,
} from "./ResultImport";
import { renderOperatingPlots } from "./OperatingPlots";
import { escapeHtml, formatIdentifier, formatQuantity, statusChip } from "./view";

type ImportedCandidate = DesignCandidate | DesignCandidateV2;
type ImportedMetric = ImportedCandidate["metrics"]["values"][number];
type ValuedImportedMetric = ImportedMetric & { readonly value: NonNullable<ImportedMetric["value"]> };
type ImportedComponent = ImportedCandidate["components"][number];

export interface ImportedDemonstrationContext {
  code: string;
  title: string;
  topology: string;
  artifactContentHash: string;
}

export type ProductionSchematicPreview =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly url: string; readonly filename: string }
  | { readonly status: "error"; readonly message: string };

export type DesignerSolutionFilter = "all" | "eligible" | "pinned";

export type DesignerSimulationViewState =
  | { readonly status: "idle" }
  | { readonly status: "running"; readonly message: string }
  | {
      readonly status: "ready";
      readonly analysisMode: "op" | "tran" | "ac";
      readonly engine: string;
      readonly elapsedMs: number;
      readonly vectorCount: number;
      readonly scalarSampleCount: number;
      readonly receiptContentHash: string;
    }
  | { readonly status: "error"; readonly message: string };

export function lcscExactMpnSearchUrl(manufacturerPartNumber: string): string {
  return `https://www.lcsc.com/search?q=${encodeURIComponent(manufacturerPartNumber)}`;
}

function metricIds(candidates: readonly ImportedCandidate[]): string[] {
  return [...new Set(candidates.flatMap((candidate) => candidate.metrics.values.map((metric) => metric.id)))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 5);
}

function chartLabel(value: string, maximumLength = 34): string {
  const formatted = formatIdentifier(value);
  return formatted.length <= maximumLength ? formatted : `${formatted.slice(0, maximumLength - 1)}…`;
}

function constraintStatusChartMarkup(candidate: Readonly<ImportedCandidate>): string {
  const series = ([
    ["pass", "Pass"],
    ["warning", "Warning"],
    ["unknown", "Unknown"],
    ["fail", "Fail"],
  ] as const).map(([state, label]) => ({
    state,
    label,
    count: candidate.constraints.filter((constraint) => constraint.status === state).length,
  }));
  const maximum = Math.max(1, ...series.map((entry) => entry.count));
  const summary = `Constraint evidence status chart: ${series.map((entry) => `${entry.label} ${entry.count}`).join(", ")}.`;
  const rows = series.map((entry, index) => {
    const y = 24 + (index * 34);
    const width = Math.round((entry.count / maximum) * 330);
    return `<g data-chart-series="${entry.state}"><text class="designer-chart-label" x="10" y="${y + 15}">${entry.label}</text><rect class="designer-chart-track" x="116" y="${y}" width="330" height="18" rx="2"/><rect class="designer-chart-bar" data-chart-state="${entry.state}" x="116" y="${y}" width="${width}" height="18" rx="2"/><text class="designer-chart-value" x="462" y="${y + 15}">${entry.count}</text></g>`;
  }).join("");
  return `<figure class="designer-operating-chart" data-designer-operating-chart="constraint-status"><figcaption><strong>Constraint evidence status</strong><span>${candidate.constraints.length} exact rules</span></figcaption><svg viewBox="0 0 500 170" role="img" aria-label="${escapeHtml(summary)}" focusable="false"><title>${escapeHtml(summary)}</title>${rows}</svg></figure>`;
}

function comparableMetricChartsMarkup(candidate: Readonly<ImportedCandidate>): string {
  const groups = new Map<string, ValuedImportedMetric[]>();
  candidate.metrics.values.forEach((metric) => {
    if (metric.value === null || !Number.isFinite(metric.value.value)) return;
    const valuedMetric = metric as ValuedImportedMetric;
    groups.set(metric.value.unit, [...(groups.get(metric.value.unit) ?? []), valuedMetric]);
  });
  return [...groups.entries()]
    .filter(([, metrics]) => metrics.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 3)
    .map(([unit, metrics]) => {
      const maximum = Math.max(1e-12, ...metrics.map((metric) => Math.abs(metric.value.value)));
      const summary = `Comparable ${unit} operating-value chart. ${metrics.map((metric) => `${formatIdentifier(metric.id)} ${formatQuantity(metric.value)}, ${metric.state}`).join("; ")}.`;
      const rows = metrics.map((metric, index) => {
        const y = 24 + (index * 38);
        const width = Math.max(2, Math.round((Math.abs(metric.value.value) / maximum) * 260));
        const state = metric.state === "calculated" || metric.state === "estimated" ? metric.state : "unknown";
        return `<g data-chart-series="${escapeHtml(metric.id)}"><text class="designer-chart-label" x="10" y="${y + 15}">${escapeHtml(chartLabel(metric.id))}</text><rect class="designer-chart-track" x="214" y="${y}" width="260" height="18" rx="2"/><rect class="designer-chart-bar" data-chart-state="${state}" x="214" y="${y}" width="${width}" height="18" rx="2"/><text class="designer-chart-value" x="586" y="${y + 15}" text-anchor="end">${escapeHtml(formatQuantity(metric.value))}</text></g>`;
      }).join("");
      const displayUnit = metrics[0]?.value.displayUnit || unit;
      return `<figure class="designer-operating-chart" data-designer-operating-chart="metric-${escapeHtml(unit)}"><figcaption><strong>${escapeHtml(displayUnit)} operating values</strong><span>${metrics.length} comparable scalars</span></figcaption><svg viewBox="0 0 600 ${Math.max(100, 42 + (metrics.length * 38))}" role="img" aria-label="${escapeHtml(summary)}" focusable="false"><title>${escapeHtml(summary)}</title>${rows}</svg><p>Bar length is relative only within this canonical unit group.</p></figure>`;
    }).join("");
}

function motorOperatingEnvelopeChartMarkup(result: Readonly<ParsedPersistedDesignResult>): string {
  if (result.request.application !== "motor.brushed-dc") return "";
  const requirements = result.request.requirements;
  const series = [
    { id: "operating-load", label: "Operating load", value: requirements.operatingPoint.loadCurrent },
    { id: "continuous-rating", label: "Continuous rating", value: requirements.continuousCurrent },
    { id: "stall-current", label: "Stall current", value: requirements.stallCurrent },
    ...(requirements.currentLimitTarget === null
      ? []
      : [{ id: "current-limit-target", label: "Current-limit target", value: requirements.currentLimitTarget }]),
  ];
  const maximum = Math.max(1e-12, ...series.map((entry) => Math.abs(entry.value.value)));
  const summary = `Requested Motor current envelope chart. ${series.map((entry) => `${entry.label} ${formatQuantity(entry.value)}`).join("; ")}. These are input requirements, not measured or selected-part capability.`;
  const rows = series.map((entry, index) => {
    const y = 24 + (index * 38);
    const width = Math.max(2, Math.round((Math.abs(entry.value.value) / maximum) * 260));
    return `<g data-chart-series="${entry.id}"><text class="designer-chart-label" x="10" y="${y + 15}">${escapeHtml(entry.label)}</text><rect class="designer-chart-track" x="214" y="${y}" width="260" height="18" rx="2"/><rect class="designer-chart-bar" data-chart-state="input" x="214" y="${y}" width="${width}" height="18" rx="2"/><text class="designer-chart-value" x="586" y="${y + 15}" text-anchor="end">${escapeHtml(formatQuantity(entry.value))}</text></g>`;
  }).join("");
  return `<figure class="designer-operating-chart" data-designer-operating-chart="motor-current-envelope"><figcaption><strong>Requested motor current envelope</strong><span>input requirements</span></figcaption><svg viewBox="0 0 600 ${Math.max(156, 42 + (series.length * 38))}" role="img" aria-label="${escapeHtml(summary)}" focusable="false"><title>${escapeHtml(summary)}</title>${rows}</svg><p>Requirement envelope only · not measured output or selected-part current capability.</p></figure>`;
}

function operatingChartsMarkup(
  result: Readonly<ParsedPersistedDesignResult>,
  candidate: Readonly<ImportedCandidate>,
): string {
  return `<section class="designer-operating-charts" aria-labelledby="designer-operating-charts-title"><header><div><span class="designer-section-code">INPUT / CALCULATED / ESTIMATED · NOT WAVEFORMS</span><h3 id="designer-operating-charts-title">Operating charts</h3></div><p>Only persisted requirements, scalar observations, and exact rule counts are plotted. These charts are not measurements, simulation samples, efficiency curves, or selected-part verification.</p></header><div class="designer-operating-chart-grid">${motorOperatingEnvelopeChartMarkup(result)}${constraintStatusChartMarkup(candidate)}${comparableMetricChartsMarkup(candidate)}</div></section>`;
}

function requestedOperatingPointMarkup(
  request: Readonly<ParsedPersistedDesignResult["request"]>,
): string {
  if (request.application === "power.buck") {
    const requirements = request.requirements;
    return `<section class="designer-request-context" data-testid="designer-request-context" aria-label="Requested Power operating point"><span>REQUEST · POWER</span><dl><div><dt>Vin</dt><dd>${escapeHtml(formatQuantity(requirements.inputVoltage.nominal))}</dd></div><div><dt>Vout</dt><dd>${escapeHtml(formatQuantity(requirements.outputVoltage))}</dd></div><div><dt>Max output current</dt><dd>${escapeHtml(formatQuantity(requirements.maximumOutputCurrent))}</dd></div><div><dt>Ambient</dt><dd>${escapeHtml(formatQuantity(requirements.ambientTemperature))}</dd></div></dl></section>`;
  }
  const requirements = request.requirements;
  const pwm = `${formatQuantity(requirements.pwmFrequency)} · ${formatQuantity(requirements.operatingPoint.dutyCycle)} duty`;
  return `<section class="designer-request-context" data-testid="designer-request-context" aria-label="Requested Motor operating point"><span>REQUEST · MOTOR</span><dl><div><dt>Supply</dt><dd>${escapeHtml(formatQuantity(requirements.supplyVoltage.nominal))}</dd></div><div><dt>Operating current</dt><dd>${escapeHtml(formatQuantity(requirements.operatingPoint.loadCurrent))}</dd></div><div><dt>PWM</dt><dd>${escapeHtml(pwm)}</dd></div><div><dt>Ambient</dt><dd>${escapeHtml(formatQuantity(requirements.ambientTemperature))}</dd></div></dl></section>`;
}

function primaryComponentPriority(component: Readonly<ImportedComponent>): number {
  if (component.id === "primary") return 0;
  if (/(?:integrated[-_ ](?:regulator|h-bridge)|gate[-_ ]driver|power[-_ ]controller|regulator)/iu.test(`${component.id} ${component.role}`)) return 1;
  if (/(?:power[-_ ]mosfet|bridge[-_ ]n-channel[-_ ]power[-_ ]mosfet)/iu.test(`${component.id} ${component.role}`)) return 2;
  return 3;
}

function primaryPart(candidate: Readonly<ImportedCandidate>): string | undefined {
  const component = [...candidate.components].sort((left, right) => (
    primaryComponentPriority(left) - primaryComponentPriority(right)
      || left.id.localeCompare(right.id)
  ))[0];
  return component === undefined
    ? undefined
    : `${component.part.manufacturerId} / ${component.part.manufacturerPartNumber}`;
}

function candidateDisplayName(candidate: Readonly<ImportedCandidate>): string {
  if (candidate.recipeId.includes("external-nmos-h-bridge")) return "External-MOSF H-bridge";
  if (candidate.recipeId.includes("integrated-h-bridge")) return "Integrated H-bridge motor driver";
  if (candidate.recipeId.includes("integrated-synchronous-buck")) return "Integrated synchronous buck converter";
  if (candidate.recipeId.includes("external-fet-synchronous-buck")) return "External-FET synchronous buck converter";
  return formatIdentifier(candidate.recipeId);
}

function componentVariantSignature(component: Readonly<ImportedComponent> | undefined): string {
  if (component === undefined) return "absent";
  return [
    component.id,
    component.role,
    component.profileId,
    component.part.manufacturerId,
    component.part.manufacturerPartNumber,
    String(component.quantityPerAssembly),
    component.value === undefined ? "" : `${component.value.value}:${component.value.unit}`,
  ].join("|");
}

function varyingComponentIds(candidates: readonly ImportedCandidate[]): string[] {
  const ids = [...new Set(candidates.flatMap((candidate) => candidate.components.map((component) => component.id)))].sort();
  return ids.filter((id) => new Set(candidates.map((candidate) => (
    componentVariantSignature(candidate.components.find((component) => component.id === id))
  ))).size > 1);
}

function variantPartsMarkup(candidate: Readonly<ImportedCandidate>, componentIds: readonly string[]): string {
  const visibleIds = componentIds.slice(0, 3);
  const rows = visibleIds.map((id) => {
    const component = candidate.components.find((entry) => entry.id === id);
    return component === undefined
      ? `<span><strong>${escapeHtml(formatIdentifier(id))}</strong><em>Not populated</em></span>`
      : `<span><strong>${escapeHtml(formatIdentifier(component.id.replaceAll("-", " ")))}</strong><code>${escapeHtml(component.part.manufacturerId)} / ${escapeHtml(component.part.manufacturerPartNumber)}</code></span>`;
  }).join("");
  const remainder = componentIds.length > visibleIds.length
    ? `<small>+${componentIds.length - visibleIds.length} more BOM ${componentIds.length - visibleIds.length === 1 ? "difference" : "differences"}</small>`
    : "";
  return `${rows}${remainder}`;
}

function retainedCandidateButton(
  result: Readonly<ParsedPersistedDesignResult>,
  candidateId: string,
  label: string,
): string {
  const retainedIndex = result.candidates.findIndex((candidate) => candidate.id === candidateId);
  const reference = retainedIndex < 0
    ? `<code>${escapeHtml(candidateId)}</code>`
    : `<button data-imported-candidate="${escapeHtml(candidateId)}"><span>C${String(retainedIndex + 1).padStart(2, "0")}</span><code>${escapeHtml(candidateId)}</code></button>`;
  return `<span class="designer-execution-reference"><em>${escapeHtml(label)}</em>${reference}</span>`;
}

type ExecutionRejection = NonNullable<ImportedDesignResult["execution"]>["rejections"][number];

function canonicalConstraintQuantityText(quantity: Readonly<{ value: number; unit: string }>): string {
  return `${String(quantity.value)} ${quantity.unit}`;
}

function executionAwareEmptyResultCopy(
  result: Readonly<ParsedPersistedDesignResult>,
  execution: Readonly<NonNullable<ImportedDesignResult["execution"]>> | undefined,
): string | undefined {
  if (result.schemaVersion !== 2 || execution === undefined) return undefined;
  if (
    result.request.application === "motor.brushed-dc"
    && result.request.constraints.allowedTopologyFamilies.length === 1
    && result.request.constraints.allowedTopologyFamilies[0] === "motor.hbridge.external-nmos"
    && execution.counts.supportedRecipes > 0
    && result.candidates.length === 0
    && execution.counts.checked > 0
    && execution.rejections.length === execution.counts.checked
    && execution.rejections.every((rejection) => rejection.reasonCode === "unknown_constraint_disallowed")
  ) {
    return `Strict generation enumerated and checked ${execution.counts.checked} exact MIC4606-2 direct-gate options with separate bootstrap and VDD-local capacitor roles, then excluded all because unresolved required safety and requirement constraints are disallowed. No series-gate resistor is selected. Microchip Rev H supports the direct structural connection, preserves the xLO resistor caution, and supplies nominal capacitor floors that admit exactly three reviewed 10 µF MLCC profiles while excluding the 100 nF C1608 from both roles. Three interface-specific xHS rules pass only the nominal 0 V-to-requested-bus excursion; recirculation undershoot, wiring overshoot, parasitics, and TVS coordination remain unproved. No VDD driver-bias rail is implemented, so an actual source inside the reviewed VDD range remains required and unknown. Those nominal passes do not prove effective capacitance, bootstrap charge or refresh, local bias support, bulk adequacy, placement, motor.external.gate-network, or switching behavior. Explicit unresolved-evidence inspection can retain deterministic structural observations only as policy-ineligible.`;
  }
  if (
    result.request.application === "power.buck"
    && execution.rejections.length === 1
    && execution.rejections[0]?.reasonCode === "unknown_constraint_disallowed"
    && execution.rejections[0].recipeId === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified"
  ) {
    return "Strict generation excluded the one exact-BOM Power option because unresolved hard constraints are disallowed. Explicit unknown-evidence inspection can retain it only as a policy-ineligible structural observation; it grants no eligibility, selected-part simulation, provider, or sourcing authority.";
  }
  const hardFailures = execution.rejections.filter((rejection) => rejection.reasonCode === "hard_constraint_failed");
  if (hardFailures.length > 0) {
    const powerCurrentLimit = result.request.application === "power.buck"
      ? result.rejectedCandidates
          .flatMap((rejection) => rejection.constraints)
          .find((constraint) => constraint.ruleId === "power.regulator.current-limit" && constraint.status === "fail")
      : undefined;
    if (powerCurrentLimit?.actual !== undefined && powerCurrentLimit.limit !== undefined) {
      return `Hard electrical failure: the reviewed maximum protection threshold is ${canonicalConstraintQuantityText(powerCurrentLimit.actual)}, exceeding the selected inductor saturation rating of ${canonicalConstraintQuantityText(powerCurrentLimit.limit)}. The unresolved-evidence inspection opt-in cannot override this failed power.regulator.current-limit constraint.`;
    }
    const failedRuleIds = [...new Set(hardFailures.flatMap((rejection) => rejection.constraints
      .filter((constraint) => constraint.status === "fail")
      .map((constraint) => constraint.ruleId)))].sort();
    return `Hard electrical failure${failedRuleIds.length === 0 ? "" : `: ${failedRuleIds.join(", ")}`}. The unresolved-evidence inspection opt-in cannot override an explicit failed constraint.`;
  }
  if (execution.rejections.some((rejection) => rejection.reasonCode === "unknown_constraint_disallowed")) {
    return "The production recipes excluded candidates because unresolved hard-constraint evidence is disallowed. Edit the request or explicitly opt in to inspect those unresolved candidates; inspection does not make them eligible.";
  }
  if (execution.rejections.some((rejection) => rejection.reasonCode === "estimated_values_disallowed")) {
    return "Estimated candidate outputs were deliberately disallowed by this request, so candidates containing derived estimated values were not retained. Re-enable “Allow estimated candidate outputs” only to inspect them; this does not change installed policy eligibility or hide request-declared estimates.";
  }
  return undefined;
}

interface ExecutionGroup {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly copy: string;
  readonly includes: (rejection: Readonly<ExecutionRejection>) => boolean;
}

const EXECUTION_GROUPS: readonly ExecutionGroup[] = [
  {
    id: "recipe-feasibility",
    code: "SOLVE + MATCH",
    title: "Recipe feasibility",
    copy: "The recipe rejected an enumerated option before the electrical policy check.",
    includes: (rejection) => rejection.reasonCode === "recipe_rejected",
  },
  {
    id: "electrical-hard-failure",
    code: "CHECK · FAIL",
    title: "Electrical hard failure",
    copy: "A checked candidate failed at least one explicit electrical constraint.",
    includes: (rejection) => rejection.reasonCode === "hard_constraint_failed",
  },
  {
    id: "evidence-policy-exclusion",
    code: "CHECK / ESTIMATE · REQUEST POLICY",
    title: "Request-policy exclusion",
    copy: "The request policy excluded unknown or warning evidence, or visibly estimated values; no missing fact was inferred as a pass.",
    includes: (rejection) => rejection.reasonCode === "unknown_constraint_disallowed"
      || rejection.reasonCode === "warning_disallowed"
      || rejection.reasonCode === "estimated_values_disallowed",
  },
  {
    id: "duplicate",
    code: "DEDUPE · IDENTITY",
    title: "Duplicate",
    copy: "Equivalent candidate identity was retained once before objective comparison.",
    includes: (rejection) => rejection.reasonCode === "duplicate_candidate",
  },
  {
    id: "objective-relative-pareto",
    code: "PARETO · REQUEST CRITERIA",
    title: "Objective-relative Pareto",
    copy: "Dominance is relative to the request's configured electrical criteria, not universal superiority.",
    includes: (rejection) => rejection.reasonCode === "pareto_dominated",
  },
] as const;

function executionRejectionMarkup(
  result: Readonly<ParsedPersistedDesignResult>,
  rejection: Readonly<ExecutionRejection>,
): string {
  const candidateReference = rejection.reasonCode !== "recipe_rejected"
    ? retainedCandidateButton(result, rejection.candidateId, "Candidate")
    : "";
  const correlation = rejection.reasonCode === "duplicate_candidate"
    ? retainedCandidateButton(result, rejection.kept.candidateId, "Kept")
    : rejection.reasonCode === "pareto_dominated"
      ? retainedCandidateButton(result, rejection.dominatedByCandidateId, "Dominator")
      : "";
  const detail = rejection.reasonCode === "recipe_rejected"
    ? rejection.recipeReason
    : rejection.constraints.length === 0
      ? "No constraint record accompanies this identity decision."
      : `${rejection.constraints.length} constraint record${rejection.constraints.length === 1 ? "" : "s"}: ${rejection.constraints.map((constraint) => constraint.ruleId).join(", ")}`;
  return `<li><header><code>${escapeHtml(rejection.reasonCode)}</code><span>${escapeHtml(rejection.stage)}</span></header><strong>${escapeHtml(rejection.recipeId)}</strong><p>${escapeHtml(detail)}</p><div class="designer-execution-record-meta"><span><em>Option</em><code>${escapeHtml(rejection.optionKey)}</code></span>${candidateReference}${correlation}</div></li>`;
}

function executionLedgerMarkup(
  result: Readonly<ParsedPersistedDesignResult>,
  execution: NonNullable<ImportedDesignResult["execution"]>,
  structuralObservation = false,
): string {
  const groups = EXECUTION_GROUPS.map((group) => {
    const rejections = execution.rejections.filter(group.includes);
    return `<section data-execution-group="${group.id}"><header><div><span class="designer-section-code">${group.code}</span><h4>${group.title}</h4></div><strong>${rejections.length}</strong></header><p>${group.copy}</p>${rejections.length === 0 ? `<p class="designer-execution-empty">No recorded exclusion in this class.</p>` : `<ol>${rejections.map((rejection) => executionRejectionMarkup(result, rejection)).join("")}</ol>`}</section>`;
  }).join("");
  const code = structuralObservation
    ? "V2 OBSERVATION EXECUTION REPORT · EXACT REGENERATION"
    : "VERIFIED EXECUTION REPORT · EXACT REGENERATION";
  const title = structuralObservation ? "Exact V2 observation execution ledger" : "Exact execution ledger";
  return `<section class="designer-execution-ledger" data-production-execution-ledger aria-labelledby="designer-execution-ledger-title"><header><div><span class="designer-section-code">${code}</span><h3 id="designer-execution-ledger-title">${title}</h3><p>${execution.counts.supportedRecipes} supported recipes · ${execution.counts.checked} checked · ${execution.counts.pareto} Pareto survivors · ${execution.counts.rejected} exclusions</p></div><code>${execution.pipeline.join(" → ")}</code></header><details${result.candidates.length === 0 ? " open" : ""}><summary><span>Inspect all decision classes</span><em>5 classes · ${execution.rejections.length} exact records</em></summary><div class="designer-execution-groups" tabindex="0" aria-label="Scrollable execution decision classes">${groups}</div></details></section>`;
}

function pinnedComparisonMarkup(
  result: Readonly<ParsedPersistedDesignResult>,
  pinnedCandidateIds: ReadonlySet<string>,
  constraintDecision?: Readonly<ConstraintDecisionV3>,
): string {
  const candidates = result.candidates.filter((candidate) => pinnedCandidateIds.has(candidate.id)).slice(0, 3);
  if (candidates.length === 0) return "";
  const ids = metricIds(candidates);
  return `<section class="designer-pinned-comparison" data-pinned-comparison aria-labelledby="designer-pinned-comparison-title"><header><div><span class="designer-section-code">PINNED DECISION SET · ${candidates.length}/3</span><h3 id="designer-pinned-comparison-title">Pinned comparison</h3></div><p>${constraintDecision ? "Exact inspectable V2 observations only; pinning does not change eligibility." : "Exact retained candidates only."}</p></header><div class="designer-table-wrap"><table><thead><tr><th scope="col">Decision fact</th>${candidates.map((candidate) => {
    const index = result.candidates.findIndex((entry) => entry.id === candidate.id);
    return `<th scope="col"><button data-imported-candidate="${escapeHtml(candidate.id)}"><span>C${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(formatIdentifier(candidate.recipeId))}</strong></button></th>`;
  }).join("")}</tr></thead><tbody><tr><th scope="row">Primary manufacturer / MPN</th>${candidates.map((candidate) => `<td><code>${escapeHtml(primaryPart(candidate) ?? "No selected component")}</code></td>`).join("")}</tr>${ids.map((id) => `<tr><th scope="row">${escapeHtml(formatIdentifier(id))}</th>${candidates.map((candidate) => {
    const metric = candidate.metrics.values.find((entry) => entry.id === id);
    return `<td>${metric ? `<strong>${escapeHtml(formatQuantity(metric.value ?? undefined))}</strong>${statusChip(metric.state)}` : statusChip("unknown")}</td>`;
  }).join("")}</tr>`).join("")}<tr><th scope="row">Evidence state</th>${candidates.map((candidate) => `<td><span>${candidate.metrics.warningCount}W · ${candidate.metrics.estimateCount}E · ${candidate.metrics.unknownCount}U</span></td>`).join("")}</tr>${constraintDecision ? `<tr><th scope="row">Production policy</th>${candidates.map((candidate) => {
    const policyCandidate = constraintDecision.candidates.find((entry) => entry.candidateId === candidate.id);
    return `<td>${statusChip(policyCandidate?.eligible ? "eligible" : "ineligible")}</td>`;
  }).join("")}</tr>` : ""}</tbody></table></div></section>`;
}

function comparisonMarkup(
  result: Readonly<ParsedPersistedDesignResult>,
  selectedCandidateId: string | undefined,
  productionContextVerified: boolean,
  pinnedCandidateIds: ReadonlySet<string>,
  constraintDecision?: Readonly<ConstraintDecisionV3>,
  execution?: Readonly<NonNullable<ImportedDesignResult["execution"]>>,
  evidenceLimitedPowerInspectionAvailable = false,
  evidenceLimitedPowerInspectionBusy = false,
  solutionFilter: DesignerSolutionFilter = "all",
  solutionObjective = "",
): string {
  if (result.candidates.length === 0) {
    const noRecipe = result.schemaVersion === 2 && result.diagnostics.includes("design.no_supported_recipe");
    const title = productionContextVerified ? "No retained candidate" : "No persisted candidate";
    const copy = productionContextVerified
      ? executionAwareEmptyResultCopy(result, execution)
        ?? "The production recipes ran, but no candidate passed the current evidence policy. Inspect the exact execution ledger and adjust the request."
      : noRecipe
        ? "The V2 artifact explicitly reports that no supported production recipe produced a candidate."
        : "This artifact contains no candidate to inspect.";
    const referenceFallbackAvailable = productionContextVerified
      && result.schemaVersion === 2
      && !result.request.constraints.allowUnknownHardConstraints
      && execution !== undefined
      && execution.rejections.some((rejection) => rejection.reasonCode === "unknown_constraint_disallowed");
    const evidenceGateRejection = execution?.rejections[0];
    const evidenceGateMatchesRequest = evidenceGateRejection?.reasonCode === "unknown_constraint_disallowed"
      ? !result.request.constraints.allowUnknownHardConstraints
      : evidenceGateRejection?.reasonCode === "warning_disallowed"
        ? !result.request.constraints.allowUnknownWarnings
        : evidenceGateRejection?.reasonCode === "estimated_values_disallowed"
          ? !result.request.constraints.allowEstimatedValues
          : false;
    const exactPowerInspectionAction = evidenceLimitedPowerInspectionAvailable
      && productionContextVerified
      && result.schemaVersion === 2
      && result.request.application === "power.buck"
      && execution !== undefined
      && execution.rejections.length === 1
      && evidenceGateRejection !== undefined
      && evidenceGateMatchesRequest
      && evidenceGateRejection.constraints.some((constraint) => constraint.status === "unknown")
      && evidenceGateRejection.constraints.every((constraint) => constraint.status !== "fail")
        ? `<div class="designer-empty-action"><button class="designer-primary-action" data-power-evidence-inspection data-testid="designer-reference-fallback" aria-describedby="designer-power-inspection-boundary"${evidenceLimitedPowerInspectionBusy ? " disabled aria-busy=\"true\"" : ""}>Show reference solution</button><small id="designer-power-inspection-boundary">Inspect 1 evidence-limited design — unknown ≠ pass. Installed policy remains authoritative.</small></div>`
        : referenceFallbackAvailable
          ? `<div class="designer-empty-action"><button class="designer-primary-action" data-designer-reference-fallback data-testid="designer-reference-fallback">Show reference solutions</button><small>Regenerates with unresolved evidence visible. Reference solutions remain estimated / policy-ineligible unless the installed policy says otherwise.</small></div>`
          : "";
    return `<section class="designer-empty-results" aria-labelledby="designer-empty-title"><span class="designer-empty-glyph" aria-hidden="true">∅</span><span class="designer-step-eyebrow">02 · Solutions</span><h2 id="designer-empty-title" tabindex="-1">${title}</h2><p>${escapeHtml(copy)}</p>${exactPowerInspectionAction}</section>`;
  }
  const ids = metricIds(result.candidates);
  const variantComponentIds = varyingComponentIds(result.candidates);
  const contextCode = constraintDecision
    ? "STRUCTURAL OBSERVATION ORDER · INSTALLED V3 POLICY"
    : productionContextVerified ? "DETERMINISTIC PRODUCTION ORDER · CONTEXT VERIFIED" : "PERSISTED ORDER · UNVERIFIED";
  const contextCopy = constraintDecision
    ? "Values are permissive structural observations from the exact production context. Installed policy dispositions—not observation retention—determine eligibility."
    : productionContextVerified
      ? "Values were generated from the exact bundled catalog, ranking policy, compiler, and recipe context. Unknown evidence is preserved."
    : "Values are displayed from the strictly parsed artifact. Their engineering context has not been verified in this browser.";
  const sortableHeading = (label: string) => `<th scope="col" aria-sort="none"><button type="button" data-designer-sort aria-label="Sort solutions by ${escapeHtml(label)}">${escapeHtml(label)}<span aria-hidden="true">↕</span></button></th>`;
  const sortableMetricHeading = (id: string) => `<th scope="col" aria-sort="none"><button type="button" data-designer-sort data-designer-sort-key="${escapeHtml(id)}" aria-label="Sort solutions by ${escapeHtml(formatIdentifier(id))}">${escapeHtml(formatIdentifier(id))}<span aria-hidden="true">↕</span></button></th>`;
  const variantHeading = variantComponentIds.length > 0 ? sortableHeading("Variant / BOM delta") : "";
  const eligibleCount = constraintDecision?.eligibleCandidateIds.length ?? (productionContextVerified ? result.candidates.length : 0);
  const effectiveObjective = ids.includes(solutionObjective) ? solutionObjective : "";
  const candidateVisible = (candidate: Readonly<ImportedCandidate>) => solutionFilter === "pinned"
    ? pinnedCandidateIds.has(candidate.id)
    : solutionFilter === "eligible"
      ? constraintDecision?.eligibleCandidateIds.includes(candidate.id) ?? productionContextVerified
      : true;
  const visibleCount = result.candidates.filter(candidateVisible).length;
  const solutionToolsExpanded = solutionFilter !== "all" || effectiveObjective !== "";
  const solutionTools = `<details class="designer-solution-tools"${solutionToolsExpanded ? " open" : ""}><summary><span>Filter &amp; sort solutions</span><small data-designer-solution-visible-count>${visibleCount} shown</small></summary><div><label>Status<select data-designer-solution-filter aria-label="Filter solutions"><option value="all"${solutionFilter === "all" ? " selected" : ""}>All solutions (${result.candidates.length})</option><option value="eligible"${solutionFilter === "eligible" ? " selected" : ""}>Eligible (${eligibleCount})</option><option value="pinned"${solutionFilter === "pinned" ? " selected" : ""}>Pinned (${pinnedCandidateIds.size})</option></select></label>${ids.length > 0 ? `<label>Objective<select data-designer-solution-objective aria-label="Sort solutions by objective"><option value=""${effectiveObjective === "" ? " selected" : ""}>Recommended order</option>${ids.map((id) => `<option value="${escapeHtml(id)}"${effectiveObjective === id ? " selected" : ""}>${escapeHtml(formatIdentifier(id))}</option>`).join("")}</select></label>` : ""}</div></details><span class="designer-visually-hidden" data-designer-solution-announcement role="status" aria-live="polite" aria-atomic="true"></span>`;
  const pinnedDecisionSurface = productionContextVerified
    ? pinnedComparisonMarkup(result, pinnedCandidateIds, constraintDecision)
    : "";
  return `<section class="designer-comparison" aria-labelledby="designer-comparison-title"><header><div><span class="designer-step-eyebrow">02 · Solutions</span>${constraintDecision ? "" : `<span class="designer-section-code designer-technical-context">${contextCode}</span>`}<h2 id="designer-comparison-title">Candidate solutions</h2><p>Compare parts and calculated values, then open a design.</p><span class="designer-visually-hidden">${contextCopy}</span></div><span class="designer-result-count">${result.candidates.length} ${constraintDecision ? "reference" : productionContextVerified ? "generated" : "persisted"}</span></header>${solutionTools}${pinnedDecisionSurface}<div class="designer-table-wrap"><table class="designer-comparison-table" data-testid="designer-solutions-table"><thead><tr>${productionContextVerified ? `<th scope="col">Pin</th>` : ""}${sortableHeading("Solution")}${sortableHeading("Status")}${productionContextVerified ? sortableHeading("Primary part") : ""}${variantHeading}${ids.map((id) => sortableMetricHeading(id)).join("")}${sortableHeading("Evidence")}${constraintDecision ? sortableHeading("Policy") : ""}</tr></thead><tbody>${result.candidates.map((candidate, index) => {
    const policyCandidate = constraintDecision?.candidates.find((entry) => entry.candidateId === candidate.id);
    const statusLabel = constraintDecision
      ? "Reference / estimated"
      : productionContextVerified
        ? "Verified selection"
        : "Imported / unverified";
    const variantSortValue = variantComponentIds.map((id) => componentVariantSignature(
      candidate.components.find((component) => component.id === id),
    )).join("|");
    return `<tr data-testid="designer-candidate-row" data-designer-solution-row="${escapeHtml(candidate.id)}" data-designer-solution-order="${index}" data-policy-eligible="${constraintDecision ? policyCandidate?.eligible === true : productionContextVerified}" data-pinned="${pinnedCandidateIds.has(candidate.id)}"${candidateVisible(candidate) ? "" : " hidden"}${candidate.id === selectedCandidateId ? " aria-current=\"true\"" : ""}>${productionContextVerified ? `<td data-sort-value="${pinnedCandidateIds.has(candidate.id) ? "1" : "0"}"><input type="checkbox" data-imported-pin="${escapeHtml(candidate.id)}" aria-label="Pin ${constraintDecision ? "observation" : "candidate"} ${index + 1}, ${escapeHtml(candidateDisplayName(candidate))}"${pinnedCandidateIds.has(candidate.id) ? " checked" : ""}></td>` : ""}<th scope="row" data-sort-value="${escapeHtml(candidate.recipeId)}"><button data-imported-candidate="${escapeHtml(candidate.id)}" data-testid="designer-candidate-select" aria-label="Open solution ${index + 1}: ${escapeHtml(candidateDisplayName(candidate))}"><span>C${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(candidateDisplayName(candidate))}</strong><small class="designer-visually-hidden">${escapeHtml(candidate.id)}</small></button></th><td data-sort-value="${constraintDecision ? "0" : productionContextVerified ? "1" : "-1"}"><strong class="designer-solution-status" data-status="${constraintDecision ? "reference" : productionContextVerified ? "verified" : "unverified"}">${statusLabel}</strong>${constraintDecision ? `<small>${policyCandidate?.eligible ? "Policy eligible" : "Policy-ineligible"}</small>` : `<small>${productionContextVerified ? "Selected parts · simulation fidelity separate" : "Context not installed"}</small>`}</td>${productionContextVerified ? `<td class="designer-primary-part" data-sort-value="${escapeHtml(primaryPart(candidate) ?? "")}"><code>${escapeHtml(primaryPart(candidate) ?? "No selected component")}</code></td>` : ""}${variantComponentIds.length > 0 ? `<td class="designer-variant-parts" data-testid="designer-candidate-variant" data-sort-value="${escapeHtml(variantSortValue)}">${variantPartsMarkup(candidate, variantComponentIds)}</td>` : ""}${ids.map((id) => {
    const metric = candidate.metrics.values.find((entry) => entry.id === id);
    return `<td data-sort-value="${metric?.value?.value ?? ""}">${metric ? `<strong>${escapeHtml(formatQuantity(metric.value ?? undefined))}</strong>${statusChip(metric.state)}` : statusChip("unknown")}</td>`;
  }).join("")}<td data-sort-value="${candidate.metrics.warningCount + candidate.metrics.estimateCount + candidate.metrics.unknownCount}"><span>${candidate.metrics.warningCount}W</span><span>${candidate.metrics.estimateCount}E</span><span>${candidate.metrics.unknownCount}U</span></td>${constraintDecision ? `<td data-sort-value="${policyCandidate?.eligible ? "1" : "0"}">${statusChip(policyCandidate?.eligible ? "eligible" : "ineligible")}</td>` : ""}</tr>`;
  }).join("")}</tbody></table></div>${productionContextVerified ? `<p class="designer-pin-note">Select a row to open the design workspace. ${constraintDecision ? "Pin up to three inspectable V2 observations" : "Pin up to three retained candidates"} without changing policy eligibility.</p>` : ""}</section>`;
}

function constraintsMarkup(
  candidate: Readonly<ImportedCandidate>,
  policyCandidate?: Readonly<CandidateConstraintDecisionV3>,
): string {
  if (candidate.constraints.length === 0) return `<p class="designer-empty-copy">No persisted constraint results.</p>`;
  return `<div class="designer-constraint-list">${candidate.constraints.map((constraint) => {
    const policyRule = policyCandidate?.rules.find((rule) => rule.ruleId === constraint.ruleId);
    const policyAttributes = policyRule
      ? ` data-truth="${policyRule.truth}" data-criticality="${policyRule.criticality}" data-disposition="${policyRule.disposition}" data-policy-criticality="${policyRule.criticality}" data-policy-disposition="${policyRule.disposition}"`
      : "";
    const policyHeader = policyRule
      ? `<span class="designer-policy-chip" data-criticality="${policyRule.criticality}">${escapeHtml(formatIdentifier(policyRule.criticality))}</span><span class="designer-policy-chip" data-disposition="${policyRule.disposition}">${escapeHtml(formatIdentifier(policyRule.disposition))}</span>`
      : "";
    const policyDetails = policyRule
      ? `<div><dt>Truth</dt><dd>${escapeHtml(formatIdentifier(policyRule.truth))}</dd></div><div><dt>Criticality</dt><dd>${escapeHtml(formatIdentifier(policyRule.criticality))}</dd></div><div><dt>Disposition</dt><dd>${escapeHtml(formatIdentifier(policyRule.disposition))}</dd></div><div><dt>Policy basis</dt><dd>${escapeHtml(policyRule.policyRationale)}</dd></div>`
      : "";
    return `<article data-status="${escapeHtml(constraint.status)}"${policyAttributes}><header>${statusChip(policyRule?.truth ?? constraint.status)}<code>${escapeHtml(constraint.ruleId)}</code>${policyHeader}</header><p>${escapeHtml(constraint.explanation)}</p><dl><div><dt>Actual</dt><dd>${escapeHtml(formatQuantity(constraint.actual))}</dd></div><div><dt>Limit</dt><dd>${escapeHtml(formatQuantity(constraint.limit))}</dd></div><div><dt>Margin</dt><dd>${escapeHtml(formatQuantity(constraint.margin))}</dd></div><div><dt>Evidence</dt><dd>${constraint.evidence.length}</dd></div>${policyDetails}</dl></article>`;
  }).join("")}</div>`;
}

function blockedRuleDisclosureMarkup(decision: Readonly<ConstraintDecisionV3>): string {
  const aggregated = new Map<string, {
    ruleId: string;
    truth: string;
    criticality: string;
    disposition: string;
    rationale: string;
    candidateCount: number;
  }>();
  decision.candidates.forEach((candidate) => candidate.rules.forEach((rule) => {
    if (rule.disposition !== "blocked_failure" && rule.disposition !== "blocked_unknown") return;
    const key = `${rule.ruleId}|${rule.truth}|${rule.criticality}|${rule.disposition}|${rule.policyRationale}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.candidateCount += 1;
      return;
    }
    aggregated.set(key, {
      ruleId: rule.ruleId,
      truth: rule.truth,
      criticality: rule.criticality,
      disposition: rule.disposition,
      rationale: rule.policyRationale,
      candidateCount: 1,
    });
  }));
  const rows = [...aggregated.values()].sort((left, right) => (
    left.ruleId.localeCompare(right.ruleId)
      || left.disposition.localeCompare(right.disposition)
  ));
  if (rows.length === 0) return "";
  const exactDispositionCount = rows.reduce((sum, row) => sum + row.candidateCount, 0);
  return `<details class="designer-policy-rule-disclosure"><summary><span>Blocked rule detail</span><em>${exactDispositionCount} exact candidate ${exactDispositionCount === 1 ? "disposition" : "dispositions"} · ${rows.length} unique ${rows.length === 1 ? "rule" : "rules"}</em></summary><div class="designer-table-wrap"><table><thead><tr><th scope="col">Rule</th><th scope="col">Truth</th><th scope="col">Criticality</th><th scope="col">Disposition</th><th scope="col">Candidates</th><th scope="col">Policy basis</th></tr></thead><tbody>${rows.map((row) => `<tr data-disposition="${escapeHtml(row.disposition)}"><th scope="row"><code>${escapeHtml(row.ruleId)}</code></th><td>${escapeHtml(formatIdentifier(row.truth))}</td><td>${escapeHtml(formatIdentifier(row.criticality))}</td><td>${escapeHtml(formatIdentifier(row.disposition))}</td><td>${row.candidateCount}</td><td>${escapeHtml(row.rationale)}</td></tr>`).join("")}</tbody></table></div></details>`;
}

function constraintDecisionMarkup(decision: Readonly<ConstraintDecisionV3>): string {
  const rules = decision.candidates.flatMap((candidate) => candidate.rules);
  const blockedFailure = rules.filter((rule) => rule.disposition === "blocked_failure").length;
  const blockedUnknown = rules.filter((rule) => rule.disposition === "blocked_unknown").length;
  const inspectableUnknown = rules.filter((rule) => rule.disposition === "inspectable_unknown").length;
  const summary = decision.candidates.length === 0
    ? "Generation produced 0 structural observations and therefore 0 eligible candidates; this deterministic sidecar had no candidate to evaluate and made no candidate-local disposition."
    : `Permissive V2 generation produced ${decision.candidates.length} structural observation${decision.candidates.length === 1 ? "" : "s"}; the installed policy marks ${decision.eligibleCandidateIds.length} eligible. Truth is observed from the recipe, criticality is installed policy, and disposition determines eligibility.`;
  return `<section class="designer-policy-summary" data-production-constraint-policy data-production-constraint-decision="${escapeHtml(decision.contentHash)}" aria-labelledby="designer-policy-summary-title"><header><div><span class="designer-section-code">PRODUCTION STRICT V3 · INSTALLED POLICY</span><h2 id="designer-policy-summary-title">Constraint disposition</h2></div>${statusChip(decision.eligibleCandidateIds.length > 0 ? "eligible" : decision.candidates.length === 0 ? "no candidate" : "blocked")}</header><p>${summary}</p><dl class="designer-stat-grid"><div><dt>Blocked failures</dt><dd>${blockedFailure}</dd></div><div><dt>Blocked unknowns</dt><dd>${blockedUnknown}</dd></div><div><dt>Inspectable unknowns</dt><dd>${inspectableUnknown}</dd></div><div><dt>Policy hash</dt><dd><code>${escapeHtml(decision.policy.contentHash)}</code></dd></div></dl>${blockedRuleDisclosureMarkup(decision)}<small>The electrical JSON and share URL contain the V2 structural observation only. This V3 decision is regenerated from the installed policy and is not accepted from imports.</small></section>`;
}

function compareEvidenceText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareOptionalEvidenceText(left: string | undefined, right: string | undefined): number {
  if (left === undefined) return right === undefined ? 0 : -1;
  if (right === undefined) return 1;
  return compareEvidenceText(left, right);
}

function compareEvidenceRefs(left: Readonly<EvidenceRef>, right: Readonly<EvidenceRef>): number {
  return compareEvidenceText(left.sourceId, right.sourceId)
    || compareEvidenceText(left.locator, right.locator)
    || compareOptionalEvidenceText(left.contentHash, right.contentHash)
    || compareOptionalEvidenceText(left.retrievedAt, right.retrievedAt)
    || compareEvidenceText(left.licenseNote, right.licenseNote);
}

function sameEvidenceRef(left: Readonly<EvidenceRef>, right: Readonly<EvidenceRef>): boolean {
  return left.sourceId === right.sourceId
    && left.locator === right.locator
    && left.contentHash === right.contentHash
    && left.retrievedAt === right.retrievedAt
    && left.licenseNote === right.licenseNote;
}

function orderedUniqueEvidenceRefs(evidence: readonly EvidenceRef[]): readonly EvidenceRef[] {
  return [...evidence]
    .sort(compareEvidenceRefs)
    .filter((reference, index, ordered) => index === 0 || !sameEvidenceRef(reference, ordered[index - 1]!));
}

function productionEvidenceRefMarkup(reference: Readonly<EvidenceRef>): string {
  const contentHash = reference.contentHash === undefined
    ? `<span>Not supplied</span>`
    : `<code>${escapeHtml(reference.contentHash)}</code>`;
  const retrievedAt = reference.retrievedAt === undefined
    ? `<span>Not supplied</span>`
    : `<code>${escapeHtml(reference.retrievedAt)}</code>`;
  return `<dl data-production-evidence-ref><div><dt>sourceId</dt><dd><code>${escapeHtml(reference.sourceId)}</code></dd></div><div><dt>locator</dt><dd><code>${escapeHtml(reference.locator)}</code></dd></div><div><dt>contentHash</dt><dd>${contentHash}</dd></div><div><dt>retrievedAt</dt><dd>${retrievedAt}</dd></div><div><dt>licenseNote</dt><dd>${escapeHtml(reference.licenseNote)}</dd></div></dl>`;
}

function productionEvidenceDossierMarkup(candidate: Readonly<ImportedCandidate>): string {
  const lines = candidate.components.map((component) => {
    const references = orderedUniqueEvidenceRefs(component.evidence);
    const referenceMarkup = references.length === 0
      ? `<p class="designer-production-evidence-empty">No persisted selected-part evidence references for this BOM component.</p>`
      : `<div class="designer-production-evidence-refs" tabindex="0" aria-label="Scrollable evidence references for ${escapeHtml(component.part.manufacturerPartNumber)}">${references.map(productionEvidenceRefMarkup).join("")}</div>`;
    return `<article data-production-evidence-line="${escapeHtml(component.id)}"><header><span>${escapeHtml(component.id)}</span><code>${escapeHtml(component.part.manufacturerId)} / ${escapeHtml(component.part.manufacturerPartNumber)}</code><strong>${references.length} ref${references.length === 1 ? "" : "s"}</strong></header>${referenceMarkup}</article>`;
  }).join("");
  return `<section class="designer-production-evidence" data-production-evidence-dossier aria-labelledby="designer-production-evidence-title"><header><div><span class="designer-section-code">SELECTED-PART SOURCE FOLIO · PERSISTED REFERENCES</span><h3 id="designer-production-evidence-title">Selected-part evidence dossier</h3></div><p><strong>Traceability only.</strong> This dossier grants no new review, admission, model, commercial, or simulation authority.</p></header><div class="designer-production-evidence-lines">${lines}</div></section>`;
}

function coverageMarkup(candidate: Readonly<ImportedCandidate>): string {
  if (candidate.simulationCoverage.length === 0) return `<p class="designer-empty-copy">No persisted simulation coverage record.</p>`;
  return `<div>${candidate.simulationCoverage.map((coverage) => `<article>${statusChip(coverage.modelTier)}<strong>${escapeHtml(formatIdentifier(coverage.scenarioId))}</strong><small>Persisted claim · execution context not verified</small>${coverage.limitations.length > 0 ? `<ul>${coverage.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")}</ul>` : `<p>No declared limitations.</p>`}</article>`).join("")}</div>`;
}

function scenarioExportGateMarkup(
  entry: Readonly<ScenarioExportPlanEntryV2>,
  productionScenarioSpiceConnected: boolean,
): string {
  if (entry.spiceExportGate === "no_scenario") {
    return `<div class="designer-scenario-gate" data-gate="no_scenario"><strong>No simulation action</strong><p>No same-ID circuit scenario exists. This is a display-only coverage record and cannot produce SPICE or simulation-data bytes.</p><button disabled>No executable scenario</button></div>`;
  }
  if (entry.spiceExportGate === "incomplete_export_requires_verified_context_and_opt_in") {
    return `<div class="designer-scenario-gate" data-gate="incomplete"><strong>Unavailable coverage stays unavailable</strong><p>Incomplete SPICE export requires the exact engineering and execution contexts plus an explicit incomplete-model opt-in. Unavailable coverage cannot produce a simulation CSV or become ranking or validation evidence.</p><button disabled>Context + opt-in required</button></div>`;
  }
  if (productionScenarioSpiceConnected) {
    return `<div class="designer-scenario-gate" data-gate="behavioral_export_ready"><strong>Behavioral SPICE projection available</strong><p>The exact installed engineering and execution contexts can regenerate this zero-omission behavioral deck. It is a requirements/passive projection, not a selected-part model, V3 eligibility decision, simulation receipt, or ranking input.</p><span>Use Scenario SPICE in the context-gated action bar.</span></div>`;
  }
  return `<div class="designer-scenario-gate" data-gate="context_required"><strong>Behavioral claim, not execution proof</strong><p>SPICE export requires exact verified contexts and zero omissions. A simulation CSV additionally requires actual execution of that regenerated netlist by the pinned local engine and a matching receipt. The receipt proves byte integrity, not independent execution attestation.</p><button disabled>Verified contexts + receipt required</button></div>`;
}

function selectedScenarioPlanEntry(
  plan: Readonly<ReturnType<typeof planDesignResultScenarioExportsV2>>,
  selectedScenarioId: string | undefined,
): Readonly<ScenarioExportPlanEntryV2> | undefined {
  return plan.entries.find((entry) => entry.scenarioId === selectedScenarioId)
    ?? plan.entries.find((entry) => entry.isDefaultScenario)
    ?? plan.entries[0];
}

function scenarioWorkspaceMarkup(
  result: Readonly<Extract<ParsedPersistedDesignResult, { schemaVersion: 2 }>>,
  candidate: Readonly<DesignCandidateV2>,
  selectedScenarioId: string | undefined,
  productionScenarioSpiceConnected: boolean,
): string {
  const plan = planDesignResultScenarioExportsV2(result, candidate.id);
  if (plan.entries.length === 0) {
    return `<section class="designer-scenario-workspace" aria-labelledby="designer-scenarios-title"><header><span class="designer-section-code">COVERAGE → SCENARIO → GRAPH → ANALYSIS</span><h3 id="designer-scenarios-title">Scenario workspace</h3><p>No persisted coverage or executable scenario is present.</p></header></section>`;
  }
  const selected = selectedScenarioPlanEntry(plan, selectedScenarioId)!;
  const graphSize = selected.componentCount === null
    ? "Not authored"
    : `${selected.componentCount} components · ${selected.probeCount ?? 0} probes`;
  const scenarioTitle = selected.title ?? formatIdentifier(selected.scenarioId);
  const workspaceBoundary = productionScenarioSpiceConnected
    ? "Exact installed contexts are present. Selection never runs a model; an enabled deck remains a generic behavioral projection and carries no selected-part or eligibility authority."
    : "Strict structural inspection only. Selecting a row never runs a model or verifies engineering context.";
  return `<section class="designer-scenario-workspace" aria-labelledby="designer-scenarios-title"><header><span class="designer-section-code">COVERAGE → SCENARIO → GRAPH → ANALYSIS</span><h3 id="designer-scenarios-title">Scenario workspace</h3><p>${workspaceBoundary}</p></header><div class="designer-scenario-layout"><div class="designer-scenario-rail" aria-label="Persisted simulation coverage">${plan.entries.map((entry) => `<button data-imported-scenario="${escapeHtml(entry.scenarioId)}" aria-controls="designer-scenario-detail" aria-pressed="${entry.scenarioId === selected.scenarioId ? "true" : "false"}"><span>${statusChip(entry.coverageTier)}${entry.isDefaultScenario ? `<small>Default</small>` : ""}</span><strong>${escapeHtml(entry.title ?? formatIdentifier(entry.scenarioId))}</strong><code>${escapeHtml(entry.scenarioId)}</code><em>${escapeHtml(entry.analysisMode ?? "display only")}</em></button>`).join("")}</div><article class="designer-scenario-detail" id="designer-scenario-detail"><div class="designer-scenario-signal" aria-label="Selected scenario structural signal path"><span>${escapeHtml(selected.coverageTier)}</span><i aria-hidden="true">→</i><span>${escapeHtml(scenarioTitle)}</span><i aria-hidden="true">→</i><span>${escapeHtml(selected.circuitTitle ?? "No graph")}</span><i aria-hidden="true">→</i><span>${escapeHtml(selected.analysisMode ?? "No analysis")}</span></div><dl><div><dt>Scenario ID</dt><dd><code>${escapeHtml(selected.scenarioId)}</code></dd></div><div><dt>Circuit graph</dt><dd>${selected.circuitId === null ? "No same-ID scenario" : `<code>${escapeHtml(selected.circuitId)}</code>`}</dd></div><div><dt>Graph inventory</dt><dd>${escapeHtml(graphSize)}</dd></div><div><dt>Schematic-only instances</dt><dd>${selected.schematicOnlyInstanceCount ?? "Not inspectable"}</dd></div></dl>${selected.limitations.length > 0 ? `<section aria-labelledby="designer-scenario-limitations"><h4 id="designer-scenario-limitations">Persisted limitations</h4><ul>${selected.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")}</ul></section>` : `<p class="designer-empty-copy">No limitation text was persisted. That absence does not establish reviewed or physical-model fidelity.</p>`}${scenarioExportGateMarkup(selected, productionScenarioSpiceConnected && selected.spiceExportGate === "export_requires_verified_context")}</article></div></section>`;
}

function circuitBoundaryMarkup(candidate: Readonly<ImportedCandidate>): string {
  if (candidate.schemaVersion === 1) {
    return `<p class="designer-empty-copy">Legacy circuit v1 · ${candidate.circuit.components.length} components. Simulator handoff is intentionally disabled for imported audit artifacts.</p>`;
  }
  const physical = candidate.circuitInstanceClassifications.filter((entry) => entry.kind === "physical").length;
  const behavioral = candidate.circuitInstanceClassifications.filter((entry) => entry.kind === "behavioral").length;
  const nonBom = candidate.circuitInstanceClassifications.filter((entry) => entry.kind === "non_bom").length;
  return `<dl class="designer-stat-grid"><div><dt>Circuit graphs</dt><dd>${candidate.circuit.circuits.length}</dd></div><div><dt>Scenarios</dt><dd>${candidate.circuit.scenarios.length}</dd></div><div><dt>Physical instances</dt><dd>${physical}</dd></div><div><dt>Behavioral / non-BOM</dt><dd>${behavioral} / ${nonBom}</dd></div></dl>${candidate.circuitBomNonRepresentations.length > 0 ? `<ul class="designer-warning-list">${candidate.circuitBomNonRepresentations.map((entry) => `<li>${escapeHtml(entry.selectedComponentId)}: ${escapeHtml(entry.reason)}</li>`).join("")}</ul>` : ""}`;
}

function observationBoundaryMarkup(
  policyCandidate: Readonly<CandidateConstraintDecisionV3> | undefined,
  surface: "selected_detail" | "schematic_preview" | "electrical_bom",
): string {
  if (policyCandidate === undefined) return "";
  const blockedFailures = policyCandidate.rules.filter((rule) => rule.disposition === "blocked_failure");
  const blockedUnknowns = policyCandidate.rules.filter((rule) => rule.disposition === "blocked_unknown");
  const duplicateSurface = surface === "schematic_preview";
  return `<aside class="designer-observation-boundary${duplicateSurface ? " designer-visually-hidden" : ""}" data-production-observation-boundary="${surface}"${duplicateSurface ? " aria-hidden=\"true\"" : " role=\"status\""}><strong>Observation only · ${policyCandidate.eligible ? "Eligible" : "Ineligible"}</strong><span>${blockedFailures.length} blocked failures · ${blockedUnknowns.length} blocked unknowns · affected rules in Operating results</span></aside>`;
}

function productionSchematicPreviewMarkup(
  candidate: Readonly<ImportedCandidate>,
  preview: Readonly<ProductionSchematicPreview> | undefined,
  policyCandidate?: Readonly<CandidateConstraintDecisionV3>,
): string {
  if (preview === undefined) return "";
  const defaultCircuit = candidate.schemaVersion === 2
    ? candidate.circuit.circuits.find((entry) => entry.id === candidate.circuit.defaultCircuitId)
    : undefined;
  const motorTerminalBoundary = defaultCircuit?.wires.some((wire) => wire.id === "motor-output-a") === true
    && defaultCircuit.wires.some((wire) => wire.id === "motor-output-b");
  const connectionBoundary = motorTerminalBoundary
    ? `<p class="designer-schematic-connection-boundary"><strong>Connection boundary</strong><span>The open rails are exact external CONTROL A/B and MOTOR A/B terminals. The motor/load is a declared requirement, not an invented selected-BOM part; its separate request-derived model is shown under Operating results.</span></p>`
    : "";
  const body = preview.status === "ready"
    ? `<div class="designer-schematic-controls" role="group" aria-label="Schematic zoom"><button type="button" data-designer-schematic-scale="fit" aria-pressed="true">Fit circuit</button><button type="button" data-designer-schematic-scale="actual" aria-pressed="false">100%</button></div>${connectionBoundary}<div class="designer-schematic-viewport" data-schematic-scale="fit" tabindex="0" aria-label="Scrollable exact structural schematic — circuit-only view"><img src="${escapeHtml(preview.url)}" alt="Exact structural schematic for ${escapeHtml(candidate.recipeId)}" draggable="false"></div><footer><span>Circuit-only viewport · exact persisted coordinates · full audit header remains in the SVG export</span><code>${escapeHtml(preview.filename)}</code></footer>`
    : preview.status === "error"
      ? `<div class="designer-schematic-state" data-status="error" role="alert"><strong>Structural preview unavailable</strong><span>${escapeHtml(preview.message)}</span></div>`
      : `<div class="designer-schematic-state" data-status="loading" role="status"><strong>Regenerating exact SVG</strong><span>The production context is validating this candidate before display.</span></div>`;
  return `<section class="designer-schematic-preview" data-production-schematic-preview aria-labelledby="designer-schematic-preview-title"><header><div><span class="designer-section-code">EXACT STRUCTURAL PROJECTION · NO SIMULATION DATA</span><h3 id="designer-schematic-preview-title">Generated schematic</h3></div><code class="designer-visually-hidden">${escapeHtml(candidate.id)}</code></header>${observationBoundaryMarkup(policyCandidate, "schematic_preview")}${body}</section>`;
}

function designerSimulationMarkup(
  selectedPlanEntry: Readonly<ScenarioExportPlanEntryV2> | undefined,
  scenarioSpiceReady: boolean,
  state: Readonly<DesignerSimulationViewState> | undefined,
): string {
  const effectiveState = state ?? { status: "idle" as const };
  const executable = scenarioSpiceReady
    && selectedPlanEntry?.coverageTier === "behavioral"
    && (selectedPlanEntry.analysisMode === "op"
      || selectedPlanEntry.analysisMode === "tran"
      || selectedPlanEntry.analysisMode === "ac");
  const status = effectiveState.status === "ready"
    ? statusChip("completed")
    : effectiveState.status === "running"
      ? statusChip("running")
      : effectiveState.status === "error"
        ? statusChip("failed")
        : statusChip(executable ? "ready" : "unavailable");
  const action = executable
    ? effectiveState.status === "running"
      ? `<button type="button" data-designer-cancel-simulation>Cancel simulation</button>`
      : `<button type="button" class="designer-primary-action" data-designer-run-simulation data-designer-simulation-scenario="${escapeHtml(selectedPlanEntry.scenarioId)}">${effectiveState.status === "error" ? "Run again" : effectiveState.status === "ready" ? "Run again" : "Run ngspice simulation"}</button>`
    : `<button type="button" disabled>No executable behavioral scenario</button>`;
  const plot = effectiveState.status === "ready"
    ? `<div class="designer-simulation-plot" data-designer-simulation-host role="region" aria-label="Behavioral simulation graph"></div>`
    : effectiveState.status === "error"
      ? `<div class="designer-simulation-placeholder" role="alert"><strong>Simulation did not complete</strong><span>${escapeHtml(effectiveState.message)}</span></div>`
      : effectiveState.status === "running"
        ? `<div class="designer-simulation-placeholder is-running" role="status"><strong>${escapeHtml(effectiveState.message)}</strong><span>Worker-isolated ngspice is evaluating the exact exported behavioral deck.</span></div>`
        : `<div class="designer-simulation-placeholder" role="img" aria-label="Behavioral simulation graph has not been run"><svg viewBox="0 0 720 230" aria-hidden="true" focusable="false"><path class="designer-simulation-grid" d="M0 46H720M0 92H720M0 138H720M0 184H720M90 0V230M180 0V230M270 0V230M360 0V230M450 0V230M540 0V230M630 0V230"/><path class="designer-simulation-ghost-trace" d="M0 176C65 176 62 72 126 72S191 176 255 176 319 72 383 72 447 176 511 176 575 72 639 72 703 176 720 176"/></svg><strong>${executable ? "Ready to calculate real samples" : "No executable behavioral samples"}</strong><span>${executable ? "Run the authored scenario to replace this preview with interactive traces." : "Design-envelope graphs remain available below; no waveform is synthesized."}</span></div>`;
  const execution = effectiveState.status === "ready"
    ? `<dl class="designer-simulation-receipt" aria-label="Local simulation execution receipt"><div><dt>Engine</dt><dd>${escapeHtml(effectiveState.engine)}</dd></div><div><dt>Analysis</dt><dd>${escapeHtml(effectiveState.analysisMode.toUpperCase())}</dd></div><div><dt>Solve</dt><dd>${escapeHtml(effectiveState.elapsedMs.toFixed(1))} ms</dd></div><div><dt>Samples</dt><dd>${effectiveState.scalarSampleCount.toLocaleString()} · ${effectiveState.vectorCount} vectors</dd></div><div><dt>Receipt</dt><dd><code>${escapeHtml(effectiveState.receiptContentHash)}</code></dd></div></dl>`
    : "";
  const scenarioName = selectedPlanEntry?.title ?? selectedPlanEntry?.scenarioId ?? "No authored scenario";
  const mode = selectedPlanEntry?.analysisMode?.toUpperCase() ?? "DISPLAY ONLY";
  const localInterpretation = selectedPlanEntry?.scenarioId === "ideal_pwm_output_stage_transient"
    ? `<p class="designer-simulation-local-boundary"><strong>Interpretation</strong><span>Ideal fixed-duty LC startup · no feedback loop or requested-output regulation target. Overshoot and ringing are behavioral node voltage, not predicted regulation performance.</span></p>`
    : selectedPlanEntry?.scenarioId === "pwm_loaded_steady_state"
      ? `<p class="designer-simulation-local-boundary"><strong>Interpretation</strong><span>Averaged DC operating point · one request-derived solved point, not a PWM waveform, speed/torque curve, or selected-driver behavior.</span></p>`
      : "";
  return `<section class="designer-simulation-lab" data-designer-simulation-lab aria-labelledby="designer-simulation-title" aria-busy="${effectiveState.status === "running"}"><header><div><span class="designer-section-code">LOCAL ENGINE · BEHAVIORAL MODEL</span><h3 id="designer-simulation-title">Simulation</h3></div><div>${status}${action}</div></header><div class="designer-simulation-context"><strong>${escapeHtml(scenarioName)}</strong><span>${escapeHtml(mode)} · ${selectedPlanEntry?.coverageTier ?? "unavailable"} coverage</span></div>${localInterpretation}${plot}${execution}<footer><strong>Model boundary</strong><span>These are local ngspice samples from the authored behavioral circuit. They are not measurements, selected-part fidelity, eligibility evidence, or a production guarantee.</span></footer></section>`;
}

function candidateMarkup(
  result: Readonly<ParsedPersistedDesignResult>,
  candidate: Readonly<ImportedCandidate>,
  selectedScenarioId: string | undefined,
  productionContextVerified: boolean,
  productionExportsConnected: boolean,
  powerPhysicalHandoffConnected: boolean,
  productionSchematicPreview: Readonly<ProductionSchematicPreview> | undefined,
  productionSourcingSearchEnabled: boolean,
  policyCandidate?: Readonly<CandidateConstraintDecisionV3>,
  primaryPartCustomizationMarkup = "",
  sourcingRequestMarkup = "",
  activeWorkspaceTab: "schematic" | "results" | "bom" | "optimize" | "export" = "schematic",
  designerSimulationState?: Readonly<DesignerSimulationViewState>,
): string {
  const legacySourcing = candidate.schemaVersion === 1 && candidate.sourcing !== undefined;
  const scenarioPlanAction = candidate.schemaVersion === 2 && result.schemaVersion === 2
    ? `<button data-imported-export="scenario-gate-plan">Scenario gate plan JSON</button>`
    : `<button disabled>Scenario gate plan unavailable</button>`;
  const scenarioPlanBoundary = candidate.schemaVersion === 2
    ? "The enabled scenario gate plan is hash-bound structural metadata only: it contains no circuit graph, netlist, simulation samples, commercial data, engineering context, or execution context, and it is prohibited from candidate ranking."
    : "A scenario gate plan requires strict V2 circuit and scenario structure, which this legacy V1 audit artifact does not contain.";
  const simulation = candidate.schemaVersion === 2 && result.schemaVersion === 2
    ? scenarioWorkspaceMarkup(result, candidate, selectedScenarioId, productionContextVerified && productionExportsConnected)
    : `<section class="designer-coverage" aria-labelledby="designer-coverage-title"><header><span class="designer-section-code">MODEL BOUNDARY · NOT EXECUTION VERIFIED</span><h3 id="designer-coverage-title">Simulation coverage</h3></header>${coverageMarkup(candidate)}</section>`;
  const contextKicker = policyCandidate
    ? "Selected reference design"
    : productionContextVerified ? "Generated candidate · production context verified" : "Persisted candidate · unverified context";
  const selectedPlanEntry = candidate.schemaVersion === 2 && result.schemaVersion === 2
    ? selectedScenarioPlanEntry(planDesignResultScenarioExportsV2(result, candidate.id), selectedScenarioId)
    : undefined;
  const scenarioSpiceReady = productionContextVerified
    && productionExportsConnected
    && selectedPlanEntry?.coverageTier === "behavioral"
    && selectedPlanEntry.spiceExportGate === "export_requires_verified_context";
  const simulationLabMarkup = designerSimulationMarkup(
    selectedPlanEntry,
    scenarioSpiceReady,
    designerSimulationState,
  );
  const scenarioSpiceAction = scenarioSpiceReady
    ? `<button data-production-export="scenario_spice" data-production-scenario="${escapeHtml(selectedPlanEntry.scenarioId)}">Scenario SPICE</button>`
    : `<button disabled>Scenario SPICE</button>`;
  const powerPhysicalHandoffAvailable = productionContextVerified
    && productionExportsConnected
    && powerPhysicalHandoffConnected
    && result.request.application === "power.buck"
    && candidate.recipeId === "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified";
  const electricalActions = productionContextVerified && productionExportsConnected
    ? `<button data-production-export="electrical_bom_csv">Electrical BOM CSV</button><button data-production-export="engineering_report_html">Engineering report HTML</button>`
    : `<button disabled>Electrical BOM CSV</button><button disabled>Engineering report HTML</button>`;
  const physicalActions = productionContextVerified && productionExportsConnected
    ? `<button data-production-export="structural_svg">Structural SVG</button><button data-production-export="structural_kicad">Structural KiCad schematic</button>${powerPhysicalHandoffAvailable ? `<button data-production-export="physical_handoff_json">Physical handoff JSON</button>` : ""}`
    : `<button disabled>Structural SVG</button><button disabled>Structural KiCad schematic</button>`;
  const physicalReadinessCopy = powerPhysicalHandoffAvailable
    ? "The exact Power V2 implementation handoff and schematic projections remain structural only: no reviewed footprints, placement, routing, or fabrication authority; pin mappings and external attestation are unavailable."
    : productionContextVerified && productionExportsConnected
      ? "Schematic projections are structural only: no reviewed footprints, placement, routing, or fabrication authority."
      : "Exact installed engineering context is required before structural handoff artifacts are available.";
  const electricalReadinessStatus = productionContextVerified && productionExportsConnected
    ? policyCandidate === undefined ? "available" : "inspection only"
    : "unavailable";
  const electricalReadinessCopy = productionContextVerified && productionExportsConnected
    ? policyCandidate === undefined
      ? "Exact electrical BOM and engineering inspection report are available."
      : "Decision-bound electrical inspection artifacts are available. They preserve this policy-ineligible observation and grant no eligibility."
    : "Exact installed engineering context is required before electrical artifacts are available.";
  const completedSimulationCopy = designerSimulationState?.status === "ready"
    ? "This browser session has completed local samples; CSV and PNG are available from the interactive plot under Operating results. A portable signed Simulation CSV artifact and Simulator handoff are not implemented."
    : scenarioSpiceReady
      ? "The selected scenario has a bounded behavioral SPICE input. Run it under Operating results; it is not selected-part or regulation proof."
      : "Scenario metadata may be inspectable, but the selected scenario has no authorized behavioral SPICE input.";
  const artifactReadiness = `<section class="designer-artifact-readiness" aria-labelledby="designer-artifact-readiness-title"><header><span class="designer-section-code">TARGET ARTIFACT READINESS · CLAIM BOUNDARIES</span><h3 id="designer-artifact-readiness-title">What this design can hand off</h3></header><div><article data-artifact-readiness="electrical" data-readiness="${productionContextVerified && productionExportsConnected ? policyCandidate === undefined ? "available" : "inspection-only" : "context-required"}"><header><strong>Electrical</strong>${statusChip(electricalReadinessStatus)}</header><p>${electricalReadinessCopy}</p><div class="designer-detail-actions">${electricalActions}</div></article><article data-artifact-readiness="behavioral-simulation" data-readiness="${scenarioSpiceReady ? "bounded-input" : "metadata-only"}"><header><strong>Behavioral simulation input</strong>${statusChip(designerSimulationState?.status === "ready" ? "completed locally" : scenarioSpiceReady ? "behavioral" : "unavailable")}</header><p>${completedSimulationCopy}</p><div class="designer-detail-actions">${scenarioPlanAction}${scenarioSpiceAction}<button disabled>Portable Simulation CSV</button><button class="designer-primary-action" disabled>Open in Simulator</button></div></article><article data-artifact-readiness="physical" data-readiness="${productionContextVerified && productionExportsConnected ? "structural-only" : "context-required"}"><header><strong>Physical handoff</strong>${statusChip(productionContextVerified && productionExportsConnected ? "structural only" : "unavailable")}</header><p>${physicalReadinessCopy}</p><div class="designer-detail-actions">${physicalActions}</div></article><article data-artifact-readiness="manufacturing-provider" data-readiness="unavailable"><header><strong>Manufacturing / provider-backed</strong>${statusChip("unavailable")}</header><p>No routed board, fabrication package, authorized provider snapshot, or commercial export is available.</p><div class="designer-detail-actions"><button disabled>Commercial export</button></div></article></div></section>`;
  const powerPhysicalHandoffBoundary = powerPhysicalHandoffAvailable
    ? " The Power physical handoff JSON is the exact separately hashed V2 implementation inspection artifact. It records eight structural instances while keeping footprints, physical pin mappings, placement, routing, external attestation, manufacturing output, physical fidelity, simulation fidelity, and candidate-eligibility authority unavailable."
    : "";
  const exportBoundary = productionContextVerified && productionExportsConnected
    ? `${scenarioPlanBoundary} Exact regenerated engineering context enables the electrical BOM, structural SVG, engineering report, and structural KiCad file. Scenario SPICE is enabled only for an authored zero-omission behavioral projection and does not model the selected primary, prove regulation or switching performance, or attest V3 eligibility. The KiCad file contains no footprints or simulation samples and has not been externally opened or attested.${powerPhysicalHandoffBoundary} Simulation CSV requires actual pinned-engine samples and an exact receipt. Commercial export requires an authorized exportable snapshot context.`
    : productionContextVerified
      ? `${scenarioPlanBoundary} The exact engineering context was used for generation, but this application adapter does not expose context-bound browser exports. Simulation remains gated by unavailable coverage and pinned-engine execution requirements; commercial export remains gated by an authorized snapshot context.`
    : `${scenarioPlanBoundary} Electrical BOM, structural SVG, and engineering report HTML require the exact verified engineering context. SPICE additionally depends on its scenario gate; KiCad requires exact engineering and execution contexts. Simulation CSV also requires actual pinned-engine execution plus a receipt bound to the exact regenerated netlist and samples; that local receipt is byte-integrity evidence, not independent attestation. Commercial export requires an authorized exportable snapshot context. None of those contexts is present in this browser session.`;
  const policyExportBoundary = policyCandidate
    ? "The electrical BOM CSV and structural SVG embed this exact recorded V3 decision and policy boundary; no eligibility is inferred. Other enabled exports carry exact V2 structural data or an explicitly behavioral projection only and do not attest V3 eligibility. "
    : "";
  const sourcingSearchColumn = productionSourcingSearchEnabled ? `<th scope="col">External search</th>` : "";
  const sourcingSearchBoundary = productionSourcingSearchEnabled
    ? `<p id="designer-lcsc-search-boundary" class="designer-lcsc-boundary" data-lcsc-search-boundary><strong>External exact-MPN search only.</strong> scheMAGIC has not queried or verified stock, price, lifecycle, lead time, packaging, or orderability.</p>`
    : "";
  const productionValueLabel = policyCandidate ? "OBSERVED VALUES" : productionContextVerified ? "GENERATED VALUES" : "PERSISTED VALUES";
  const billOfMaterialsLabel = policyCandidate ? "Observed" : productionContextVerified ? "Generated" : "Persisted";
  const constraintLabel = policyCandidate ? "TRUTH · CRITICALITY · DISPOSITION" : productionContextVerified ? "GENERATED CHECKS" : "PERSISTED CHECKS";
  const schematicMarkup = productionSchematicPreviewMarkup(
    candidate,
    productionContextVerified ? productionSchematicPreview : undefined,
    policyCandidate,
  ) || `<section class="designer-schematic-preview designer-schematic-unavailable"><header><div><span class="designer-section-code">STRUCTURAL PREVIEW</span><h3>Schematic unavailable</h3></div>${statusChip("unavailable")}</header><p>This artifact has no authorized context-bound schematic projection. No circuit geometry has been invented.</p></section>`;
  const metricsMarkup = `${simulationLabMarkup}${renderOperatingPlots(result.request, candidate)}${operatingChartsMarkup(result, candidate)}<section class="designer-operating-metrics" aria-labelledby="designer-metrics-title"><header><span class="designer-section-code">${productionValueLabel}</span><h3 id="designer-metrics-title">Operating values</h3></header><div class="designer-metric-grid">${candidate.metrics.values.map((metric) => `<article><div>${statusChip(metric.state)}<span>${escapeHtml(formatIdentifier(metric.id))}</span></div><strong>${escapeHtml(formatQuantity(metric.value ?? undefined))}</strong><p>${escapeHtml(metric.explanation)}</p></article>`).join("")}</div></section>`;
  const bomMarkup = `<section aria-labelledby="designer-bom-title"><header><span class="designer-section-code">ELECTRICAL FACTS · ${productionContextVerified ? "PRODUCTION CONTEXT" : "UNVERIFIED CONTEXT"}</span><h3 id="designer-bom-title">${billOfMaterialsLabel} bill of materials</h3></header>${observationBoundaryMarkup(policyCandidate, "electrical_bom")}<div class="designer-table-wrap"><table class="designer-bom-table"><thead><tr><th scope="col">Line</th><th scope="col">Role</th><th scope="col">Manufacturer / MPN</th><th scope="col">Qty</th><th scope="col">Value</th>${sourcingSearchColumn}</tr></thead><tbody>${candidate.components.map((component) => {
    const manufacturerPartNumber = component.part.manufacturerPartNumber;
    const sourcingSearch = productionSourcingSearchEnabled
      ? `<td class="designer-lcsc-search"><a data-lcsc-search="${escapeHtml(manufacturerPartNumber)}" href="${escapeHtml(lcscExactMpnSearchUrl(manufacturerPartNumber))}" target="_blank" rel="noopener noreferrer" aria-describedby="designer-lcsc-search-boundary" aria-label="Search LCSC for ${escapeHtml(manufacturerPartNumber)} (opens in a new tab)">Search LCSC for ${escapeHtml(manufacturerPartNumber)}</a></td>`
      : "";
    return `<tr><th scope="row">${escapeHtml(component.id)}</th><td>${escapeHtml(component.role)}</td><td><code>${escapeHtml(component.part.manufacturerId)} / ${escapeHtml(manufacturerPartNumber)}</code></td><td>${component.quantityPerAssembly}</td><td>${escapeHtml(formatQuantity(component.value))}</td>${sourcingSearch}</tr>`;
  }).join("")}</tbody></table></div>${sourcingSearchBoundary}</section>${productionSourcingSearchEnabled ? productionEvidenceDossierMarkup(candidate) : ""}<section class="designer-sourcing-panel" aria-labelledby="designer-circuit-boundary-title"><header><h3 id="designer-circuit-boundary-title">Circuit/BOM boundary</h3>${statusChip(candidate.schemaVersion === 2 && candidate.circuit.scenarios.length > 0 ? "structural + behavioral" : "structural")}</header>${circuitBoundaryMarkup(candidate)}</section>`;
  const optimizeMarkup = primaryPartCustomizationMarkup || `<section class="designer-workspace-empty"><span class="designer-section-code">OPTIMIZATION</span><h3>No compatible substitution controls</h3><p>This candidate has no authorized primary-part customization target. Requirements can still be edited and regenerated.</p><button type="button" data-imported-close>Edit requirements</button></section>`;
  const exportMarkup = `${artifactReadiness}<details class="designer-export-boundary designer-disclosure"><summary><span>${statusChip("claim boundaries")}<strong>Export caveats</strong></span><small>Read before handoff</small></summary><p class="designer-export-gate">${escapeHtml(`${policyExportBoundary}${exportBoundary}`)}</p></details>${sourcingRequestMarkup}`;
  const warningsMarkup = `${legacySourcing ? `<section class="designer-warning-panel"><h3>Legacy inline sourcing not trusted</h3><p>This V1 artifact contains inline sourcing without an authorized V2 commercial context. It is not displayed or exported.</p></section>` : ""}${candidate.warnings.length > 0 ? `<section class="designer-warning-panel"><h3>Persisted warnings</h3><ul>${candidate.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></section>` : ""}`;
  const tabs = [
    { id: "schematic", label: "Schematic" },
    { id: "results", label: "Operating results" },
    { id: "bom", label: "BOM / parts" },
    { id: "optimize", label: "Optimize" },
    { id: "export", label: "Export" },
  ] as const;
  const panel = (id: typeof tabs[number]["id"], content: string) => `<section id="designer-workspace-panel-${id}" role="tabpanel" tabindex="0" aria-labelledby="designer-workspace-tab-${id}" data-designer-workspace-panel="${id}"${activeWorkspaceTab === id ? "" : " hidden"}>${content}</section>`;
  const candidateEligibility = policyCandidate
    ? policyCandidate.eligible ? "Policy eligible" : "Policy-ineligible"
    : productionContextVerified
      ? "Selected-part context"
      : "Unverified context";
  const candidateStatus = statusChip(candidateEligibility.toLowerCase());
  return `<section class="designer-candidate-detail designer-design-workspace" aria-labelledby="designer-candidate-title"><header class="designer-detail-header"><div><span class="designer-step-eyebrow">03 · Design workspace</span><span class="designer-kicker">${contextKicker}</span><h2 id="designer-candidate-title">${escapeHtml(candidateDisplayName(candidate))}</h2><code class="designer-visually-hidden">${escapeHtml(candidate.id)}</code></div><div class="designer-workspace-status"><span class="designer-workspace-selection-status" role="status" aria-live="polite" aria-atomic="true" aria-label="Selected design eligibility: ${escapeHtml(candidateEligibility)}"><span aria-hidden="true">${candidateStatus}</span></span><button type="button" data-designer-caveats data-testid="designer-caveats" aria-haspopup="dialog">Evidence &amp; caveats</button></div></header>${requestedOperatingPointMarkup(result.request)}${observationBoundaryMarkup(policyCandidate, "selected_detail")}<div class="designer-workspace-tabs" role="tablist" aria-label="Design workspace panels">${tabs.map((tab) => `<button type="button" role="tab" id="designer-workspace-tab-${tab.id}" aria-controls="designer-workspace-panel-${tab.id}" aria-selected="${activeWorkspaceTab === tab.id}" tabindex="${activeWorkspaceTab === tab.id ? "0" : "-1"}" data-designer-workspace-tab="${tab.id}" data-testid="designer-tab-${tab.id}">${tab.label}</button>`).join("")}</div><div class="designer-workspace-panels">${panel("schematic", `${warningsMarkup}${schematicMarkup}`)}${panel("results", `<h3 class="designer-visually-hidden">Operating results</h3>${metricsMarkup}<section class="designer-constraint-panel" aria-labelledby="designer-constraints-title"><header><span class="designer-section-code">${constraintLabel}</span><h3 id="designer-constraints-title">Constraints</h3></header>${constraintsMarkup(candidate, policyCandidate)}</section>${simulation}`)}${panel("bom", bomMarkup)}${panel("optimize", optimizeMarkup)}${panel("export", exportMarkup)}</div></section>`;
}

export function renderImportedResult(
  imported: Readonly<ImportedDesignResult>,
  selectedCandidateId: string | undefined,
  message?: string,
  selectedScenarioId?: string,
  demonstration?: Readonly<ImportedDemonstrationContext>,
  productionExportsConnected = false,
  productionSchematicPreview?: Readonly<ProductionSchematicPreview>,
  pinnedCandidateIds: ReadonlySet<string> = new Set<string>(),
  primaryPartCustomizationMarkup = "",
  productionRegenerationAvailable = false,
  productionRegenerationBusy = false,
  sourcingRequestMarkup = "",
  referenceDesignEvidenceMarkup = "",
  evidenceLimitedPowerInspectionAvailable = false,
  evidenceLimitedPowerInspectionBusy = false,
  powerPhysicalHandoffConnected = false,
  activeWorkspaceTab: "schematic" | "results" | "bom" | "optimize" | "export" = "schematic",
  solutionFilter: DesignerSolutionFilter = "all",
  solutionObjective = "",
  designerSimulationState?: Readonly<DesignerSimulationViewState>,
): string {
  const result = imported.result;
  const selected = result.candidates.find((candidate) => candidate.id === selectedCandidateId);
  const legacy = imported.trust === "legacy_v1_audit_only";
  const productionConstraintObservation = demonstration === undefined
    && imported.trust === "production_constraint_observation";
  const productionContextVerified = demonstration === undefined
    && (imported.trust === "production_context_verified" || productionConstraintObservation);
  const decisionExplorerVerified = productionContextVerified && demonstration === undefined;
  const exactPowerInspectionAvailable = evidenceLimitedPowerInspectionAvailable
    && productionContextVerified
    && demonstration === undefined
    && result.schemaVersion === 2
    && result.request.application === "power.buck";
  const constraintDecision = productionConstraintObservation
    && demonstration === undefined
    && imported.constraintDecision.source.resultContentHash === imported.result.contentHash
    && JSON.stringify(imported.constraintDecision.source.candidateIds) === JSON.stringify([...result.candidates.map((candidate) => candidate.id)].sort())
      ? imported.constraintDecision
      : undefined;
  const selectedPolicyCandidate = constraintDecision?.candidates.find((candidate) => candidate.candidateId === selected?.id);
  const legacyInlineSourcing = importedResultHasLegacyInlineSourcing(imported);
  const trustTitle = legacy
    ? "LEGACY V1 · AUDIT ONLY"
    : productionConstraintObservation
      ? "PRODUCTION V3 POLICY · V2 DESIGN OBSERVATION"
      : productionContextVerified
        ? "PRODUCTION V2 · EXACT ENGINEERING CONTEXT VERIFIED"
      : "STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED";
  const trustCopy = legacy
    ? legacyInlineSourcing
      ? "The V1 artifact is strictly parsed and contains inline sourcing without an authorized V2 commercial context. JSON re-export is disabled; rank, rejected candidates, sourcing, and coverage cannot be promoted to V2 trust."
      : "The V1 artifact is strictly parsed and contains no inline sourcing. Its rank, rejected candidates, and coverage still cannot be promoted to V2 trust; this imported artifact has not been regenerated or verified against an installed production V2 context."
    : productionConstraintObservation
      ? "This V2 design observation and execution report were exactly regenerated in this session from the hash-bound production context, then evaluated by the installed V3 policy. Any authored behavioral graph is a separate generic projection and cannot change eligibility. Unknown constraints remain unknown, and selected-part simulation fidelity and commercial availability are not claimed."
      : productionContextVerified
        ? "This result and execution report were exactly regenerated in this session from the hash-bound bundled compiler, reviewed catalog, ranking policy, and recipe release. Unknown constraints remain unknown; selected-part simulation fidelity and commercial availability are not claimed."
        : "The artifact shape and content hash are valid. This does not prove the claimed compiler, reviewed catalog, ranking policy, recipe release, or executable model context.";
  const jsonAction = legacyInlineSourcing
    ? `<button disabled>Legacy JSON export unavailable</button><small class="designer-import-export-reason">${escapeHtml(LEGACY_INLINE_SOURCING_EXPORT_REASON)}</small>`
    : `<button data-imported-export="json">${legacy ? "Canonical legacy design JSON" : "Electrical design JSON"}</button>`;
  const shareAction = legacyInlineSourcing
    ? `<button disabled>Share URL unavailable</button>`
    : `<button data-imported-share>Create share URL</button>`;
  const regenerationAction = !productionContextVerified
    && demonstration === undefined
    && result.schemaVersion === 2
    && productionRegenerationAvailable
      ? `<button class="designer-primary-action" data-imported-regenerate-production${productionRegenerationBusy ? " disabled" : ""}>${productionRegenerationBusy ? "Regenerating with installed context…" : "Regenerate with installed context"}</button>`
      : "";
  const demonstrationBoundary = demonstration
    ? `<aside class="designer-demonstration-banner" aria-labelledby="designer-demonstration-title"><div><span class="designer-section-code">${escapeHtml(demonstration.code)} · CONTENT-VERIFIED DEMONSTRATION</span><h2 id="designer-demonstration-title">Demonstration data — not production evidence</h2><p>${escapeHtml(demonstration.title)} · ${escapeHtml(demonstration.topology)}</p></div><div><strong>No production admission.</strong><span>No live provider or commercial data.</span><span>No selected-part or simulation-fidelity claim.</span><code>${escapeHtml(demonstration.artifactContentHash)}</code></div></aside>`
    : "";
  const effectivePinnedCandidateIds = new Set(
    result.candidates.filter((candidate) => pinnedCandidateIds.has(candidate.id)).slice(0, 3).map((candidate) => candidate.id),
  );
  const executionLedger = decisionExplorerVerified
    ? executionLedgerMarkup(result, imported.execution, constraintDecision !== undefined)
    : "";
  const resultTitle = productionConstraintObservation ? "Constraint observations" : productionContextVerified ? "Generated design result" : "Imported design result";
  const resultCount = productionConstraintObservation
    ? `${constraintDecision?.eligibleCandidateIds.length ?? 0} eligible · ${result.candidates.length} observed`
    : `${result.candidates.length} ${productionContextVerified ? "generated" : "persisted"}`;
  const trustStatus = productionConstraintObservation
    ? result.candidates.length === 0 ? "inspection run · no observation retained" : "reference / estimated"
    : legacy
      ? "audit only"
      : productionContextVerified
        ? result.candidates.length === 0
          ? "verified generation · no retained selection"
          : "verified selection"
        : "structurally valid";
  const effectiveTrust = demonstration === undefined ? imported.trust : "structurally_valid";
  const caveatDialog = `<dialog class="designer-caveat-dialog" data-designer-caveat-dialog aria-labelledby="designer-caveat-dialog-title"><header><div><span class="designer-section-code">EVIDENCE · POLICY · EXECUTION</span><h2 id="designer-caveat-dialog-title">Evidence &amp; caveats</h2></div><button type="button" data-designer-caveat-close data-testid="designer-caveat-close" aria-label="Close evidence and caveats">Close</button></header><div class="designer-caveat-dialog-body"><section><h3>${trustTitle}</h3><p>${trustCopy}</p>${result.schemaVersion === 2 ? `<dl class="designer-result-identity"><div><dt>Library</dt><dd>${escapeHtml(result.libraryVersion)}</dd></div><div><dt>Request</dt><dd><code>${escapeHtml(result.requestHash)}</code></dd></div><div><dt>Result</dt><dd><code>${escapeHtml(result.contentHash)}</code></dd></div>${selected ? `<div><dt>Candidate</dt><dd><code>${escapeHtml(selected.id)}</code></dd></div>` : ""}</dl>` : ""}</section>${referenceDesignEvidenceMarkup}${result.diagnostics.length > 0 ? `<section class="designer-warning-panel"><h2>${productionConstraintObservation ? "Observation" : productionContextVerified ? "Generation" : "Persisted"} diagnostics</h2><ul>${result.diagnostics.map((diagnostic) => `<li><code>${escapeHtml(diagnostic)}</code></li>`).join("")}</ul></section>` : ""}${constraintDecision ? constraintDecisionMarkup(constraintDecision) : ""}${executionLedger}</div></dialog>`;
  const comparison = comparisonMarkup(
    result,
    selectedCandidateId,
    decisionExplorerVerified,
    effectivePinnedCandidateIds,
    constraintDecision,
    imported.execution,
    exactPowerInspectionAvailable,
    evidenceLimitedPowerInspectionBusy,
    solutionFilter,
    solutionObjective,
  );
  const workspace = selected
    ? candidateMarkup(
        result,
        selected,
        selectedScenarioId,
        productionContextVerified,
        productionExportsConnected,
        powerPhysicalHandoffConnected,
        productionSchematicPreview,
        decisionExplorerVerified,
        selectedPolicyCandidate,
        primaryPartCustomizationMarkup,
        sourcingRequestMarkup,
        activeWorkspaceTab,
        designerSimulationState,
      )
    : "";
  const compactStatus = productionConstraintObservation && message
    ? `<span class="designer-compact-status" role="status">${escapeHtml(message)}</span>`
    : "";
  const standaloneMessage = message && !productionConstraintObservation
    ? `<div class="designer-error-banner" role="status"><div><strong>Generation status</strong><span>${escapeHtml(message)}</span></div></div>`
    : "";
  return `<section class="designer-results designer-imported-results" aria-labelledby="designer-results-title" aria-busy="${productionRegenerationBusy || evidenceLimitedPowerInspectionBusy}"><header class="designer-results-header"><div><button class="designer-text-action" data-imported-close>${productionContextVerified ? "← Edit requirements" : "← Production readiness"}</button><span class="designer-kicker">${escapeHtml(result.request.application)} · schema v${result.schemaVersion}</span><h1 id="designer-results-title" tabindex="-1">${resultTitle}</h1><p class="designer-visually-hidden">Library ${escapeHtml(result.libraryVersion)} · request <code>${escapeHtml(result.requestHash)}</code></p></div><div class="designer-result-summary"><span>${resultCount}</span><span>${result.rejectedCandidates.length} generation exclusions</span></div></header>${standaloneMessage}${demonstrationBoundary}<section class="designer-trust-banner" data-trust="${escapeHtml(effectiveTrust)}" role="status"><div>${statusChip(trustStatus)}${productionConstraintObservation ? "" : `<strong>${trustTitle}</strong>`}</div>${compactStatus}${result.schemaVersion === 2 ? `<code class="designer-visually-hidden">${escapeHtml(result.contentHash)}</code>` : ""}<button type="button" data-designer-caveats data-testid="designer-caveats" aria-haspopup="dialog">Evidence &amp; caveats</button></section><div class="designer-import-actions">${regenerationAction}${jsonAction}${shareAction}<button data-designer-import>Inspect another result</button><input data-designer-result-file type="file" accept="application/json,.json" hidden></div><div class="designer-solution-layout${selected ? " has-selection" : ""}"><div class="designer-solutions-pane">${comparison}</div>${selected ? `<div class="designer-workspace-pane">${workspace}</div>` : ""}</div>${caveatDialog}</section>`;
}
