import type { SimulationScenarioV2 } from "@opencircuit/circuit-schema";
import {
  canonicalDesignV2Payload,
  parseDesignResultV2,
  type CandidateIdV2,
  type CircuitBomNonRepresentationV2,
  type CircuitInstanceClassificationV2,
  type ConstraintResult,
  type DerivedValue,
  type DesignCandidateV2,
  type DesignResultV2,
  type DesignValidationIssue,
  type ElectricalDesignRequestV2,
  type SelectedComponent,
  type SimulationCoverageV2,
} from "@opencircuit/design-schema";
import {
  validateDesignResultEngineeringContextV2,
  type DesignRecipeRefV2,
  type ElectricalDesignContextManifestV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-export-runtime";

export type CandidatePrintableReportExportErrorCodeV2 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "candidate_not_found"
  | "render_failed"
  | "resource_limit"
  | "invalid_report"
  | "artifact_unverified";

export class CandidatePrintableReportExportErrorV2 extends Error {
  readonly code: CandidatePrintableReportExportErrorCodeV2;
  readonly issues: readonly DesignValidationIssue[];

  constructor(
    code: CandidatePrintableReportExportErrorCodeV2,
    issues: readonly DesignValidationIssue[] = [],
  ) {
    super("scheMAGIC printable engineering report export was rejected");
    this.name = "CandidatePrintableReportExportErrorV2";
    this.code = code;
    this.issues = Object.freeze([...issues]);
  }
}

export interface CandidatePrintableReportScenarioV2 {
  scenarioId: string;
  scenario: SimulationScenarioV2 | null;
  circuitTitle: string | null;
  coverage: SimulationCoverageV2 | null;
}

export interface CandidatePrintableReportConstraintV2 extends ConstraintResult {
  evidenceReferenceState: "references_present" | "no_references";
}

export interface CandidatePrintableReportMetadataV2 {
  format: "schemagic-printable-report-metadata";
  schemaVersion: 2;
  artifactKind: "engineering_candidate_report";
  medium: "self_contained_print_html";
  boundaries: {
    commercialData: "not_included";
    simulationData: "not_included";
    simulationAttestation: "none";
    circuitFidelity: "structural_only";
    physicalImplementation: "not_verified";
    independentReviewPromotion: "not_claimed_by_report";
  };
  provenance: {
    request: ElectricalDesignRequestV2;
    requestHash: DesignResultV2["requestHash"];
    result: {
      format: DesignResultV2["format"];
      schemaVersion: DesignResultV2["schemaVersion"];
      contentHash: DesignResultV2["contentHash"];
    };
    library: {
      version: string;
      contentHash: DesignResultV2["libraryContentHash"];
    };
    engineeringContextManifest: ElectricalDesignContextManifestV2;
    candidate: {
      schemaVersion: 2;
      id: CandidateIdV2;
      requestHash: DesignResultV2["requestHash"];
      recipe: DesignRecipeRefV2;
      libraryVersion: string;
    };
  };
  electricalBom: SelectedComponent[];
  derivedValues: DerivedValue[];
  representation: {
    circuitInstances: CircuitInstanceClassificationV2[];
    bomNonRepresentations: CircuitBomNonRepresentationV2[];
  };
  constraints: CandidatePrintableReportConstraintV2[];
  metrics: DesignCandidateV2["metrics"];
  warnings: string[];
  scenarioCoverage: CandidatePrintableReportScenarioV2[];
}

const METADATA_OPEN = '<pre id="schemagic-printable-report-metadata-v2" hidden>';
const METADATA_CLOSE = "</pre><!-- /schemagic-printable-report-metadata-v2 -->";
const CUSTOMIZED_METADATA_OPEN = '<pre id="schemagic-primary-part-customized-engineering-report-metadata-v1" hidden>';
const CUSTOMIZED_METADATA_CLOSE = "</pre><!-- /schemagic-primary-part-customized-engineering-report-metadata-v1 -->";
const MAX_REPORT_BYTES = 32 * 1024 * 1024;

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function htmlText(value: string): string {
  return value.replace(/[&<>]/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  })[character]!);
}

function decodeHtmlText(value: string): string {
  if (/&(?!amp;|lt;|gt;)/u.test(value)) throw new TypeError("Unsupported HTML metadata entity");
  return value.replace(/&(amp|lt|gt);/gu, (_match, entity: string) => ({
    amp: "&",
    lt: "<",
    gt: ">",
  })[entity]!);
}

function display(value: unknown): string {
  return htmlText(canonicalDesignV2Payload(value));
}

function textOrEmpty(value: string | null | undefined): string {
  return value === null || value === undefined ? "—" : htmlText(value);
}

function quantity(value: ConstraintResult["actual"]): string {
  return value === undefined ? "—" : display(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function detachedCanonical<T>(value: T): T {
  return deepFreeze(JSON.parse(canonicalDesignV2Payload(value)) as T);
}

function scenariosFor(candidate: Readonly<DesignCandidateV2>): CandidatePrintableReportScenarioV2[] {
  const scenarios = new Map(candidate.circuit.scenarios.map((scenario) => [scenario.id, scenario]));
  const coverage = new Map(candidate.simulationCoverage.map((entry) => [entry.scenarioId, entry]));
  const ids = [...new Set([...scenarios.keys(), ...coverage.keys()])].sort(compareText);
  return ids.map((scenarioId) => {
    const scenario = scenarios.get(scenarioId);
    const graph = scenario === undefined
      ? undefined
      : candidate.circuit.circuits.find((entry) => entry.id === scenario.circuitId);
    return {
      scenarioId,
      scenario: scenario === undefined ? null : structuredClone(scenario),
      circuitTitle: graph?.title ?? null,
      coverage: structuredClone(coverage.get(scenarioId) ?? null),
    };
  });
}

function metadataFor(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignCandidateV2>,
  manifest: Readonly<ElectricalDesignContextManifestV2>,
): CandidatePrintableReportMetadataV2 {
  const recipe = manifest.recipes.find((entry) => entry.id === candidate.recipeId);
  if (recipe === undefined) throw new TypeError("Candidate recipe is absent from the exact manifest");
  return detachedCanonical({
    format: "schemagic-printable-report-metadata",
    schemaVersion: 2,
    artifactKind: "engineering_candidate_report",
    medium: "self_contained_print_html",
    boundaries: {
      commercialData: "not_included",
      simulationData: "not_included",
      simulationAttestation: "none",
      circuitFidelity: "structural_only",
      physicalImplementation: "not_verified",
      independentReviewPromotion: "not_claimed_by_report",
    },
    provenance: {
      request: structuredClone(result.request),
      requestHash: result.requestHash,
      result: {
        format: result.format,
        schemaVersion: result.schemaVersion,
        contentHash: result.contentHash,
      },
      library: {
        version: result.libraryVersion,
        contentHash: result.libraryContentHash,
      },
      engineeringContextManifest: structuredClone(manifest),
      candidate: {
        schemaVersion: candidate.schemaVersion,
        id: candidate.id,
        requestHash: candidate.requestHash,
        recipe: structuredClone(recipe),
        libraryVersion: candidate.libraryVersion,
      },
    },
    electricalBom: structuredClone(candidate.components),
    derivedValues: structuredClone(candidate.derivedValues),
    representation: {
      circuitInstances: structuredClone(candidate.circuitInstanceClassifications),
      bomNonRepresentations: structuredClone(candidate.circuitBomNonRepresentations),
    },
    constraints: candidate.constraints.map((constraint) => ({
      ...structuredClone(constraint),
      evidenceReferenceState: constraint.evidence.length > 0
        ? "references_present" as const
        : "no_references" as const,
    })),
    metrics: structuredClone(candidate.metrics),
    warnings: [...candidate.warnings],
    scenarioCoverage: scenariosFor(candidate),
  });
}

function table(headers: readonly string[], rows: readonly (readonly string[])[], empty: string): string {
  const head = headers.map((header) => `<th scope="col">${htmlText(header)}</th>`).join("");
  const body = rows.length === 0
    ? `<tr><td colspan="${headers.length}" class="empty">${htmlText(empty)}</td></tr>`
    : rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function provenanceMarkup(metadata: Readonly<CandidatePrintableReportMetadataV2>): string {
  const { provenance } = metadata;
  return table(
    ["Authority", "Exact reference"],
    [
      ["Request hash", htmlText(provenance.requestHash)],
      ["Result content hash", htmlText(provenance.result.contentHash)],
      ["Library", `${htmlText(provenance.library.version)}<br><span class="mono">${htmlText(provenance.library.contentHash)}</span>`],
      ["Engineering manifest", `${htmlText(provenance.engineeringContextManifest.version)}<br><span class="mono">${htmlText(provenance.engineeringContextManifest.contentHash)}</span>`],
      ["Compiler", `${htmlText(provenance.engineeringContextManifest.compiler.id)} ${htmlText(provenance.engineeringContextManifest.compiler.version)}<br><span class="mono">${htmlText(provenance.engineeringContextManifest.compiler.contentHash)}</span>`],
      ["Candidate", `${htmlText(provenance.candidate.id)}<br>Recipe: ${htmlText(provenance.candidate.recipe.id)} ${htmlText(provenance.candidate.recipe.version)}<br><span class="mono">${htmlText(provenance.candidate.recipe.contentHash)}</span>`],
    ],
    "No provenance is available.",
  );
}

function bomMarkup(metadata: Readonly<CandidatePrintableReportMetadataV2>): string {
  return table(
    ["Line", "Role", "Manufacturer part", "Profile", "Qty", "Value", "Evidence references"],
    metadata.electricalBom.map((component) => [
      htmlText(component.id),
      htmlText(component.role),
      `${htmlText(component.part.manufacturerId)}<br>${htmlText(component.part.manufacturerPartNumber)}`,
      htmlText(component.profileId),
      String(component.quantityPerAssembly),
      component.value === undefined ? "—" : display(component.value),
      component.evidence.length === 0 ? "No references" : display(component.evidence),
    ]),
    "The selected candidate has no electrical BOM lines.",
  );
}

function derivedMarkup(metadata: Readonly<CandidatePrintableReportMetadataV2>): string {
  return table(
    ["Derived value", "Value", "Equation", "State", "Evidence references"],
    metadata.derivedValues.map((entry) => [
      htmlText(entry.id),
      display(entry.value),
      htmlText(entry.equationId),
      htmlText(entry.state),
      entry.evidence.length === 0 ? "No references" : display(entry.evidence),
    ]),
    "No derived values are persisted for this candidate.",
  );
}

function representationMarkup(metadata: Readonly<CandidatePrintableReportMetadataV2>): string {
  const instanceTable = table(
    ["Circuit", "Instance", "Boundary kind", "BOM line", "Represented qty", "Reason"],
    metadata.representation.circuitInstances.map((entry) => [
      htmlText(entry.circuitId),
      htmlText(entry.componentId),
      htmlText(entry.kind),
      textOrEmpty(entry.selectedComponentId),
      entry.representedQuantityPerAssembly === undefined ? "—" : String(entry.representedQuantityPerAssembly),
      textOrEmpty(entry.reason),
    ]),
    "No circuit instances are persisted.",
  );
  const nonRepresentationTable = table(
    ["Circuit", "Electrical BOM line not represented", "Reason"],
    metadata.representation.bomNonRepresentations.map((entry) => [
      htmlText(entry.circuitId),
      htmlText(entry.selectedComponentId),
      htmlText(entry.reason),
    ]),
    "Every electrical BOM line has a persisted representation or the candidate has no BOM lines.",
  );
  return `${instanceTable}<h3>Electrical BOM non-representations</h3>${nonRepresentationTable}`;
}

function constraintMarkup(metadata: Readonly<CandidatePrintableReportMetadataV2>): string {
  return table(
    ["Rule", "Status", "Actual", "Limit", "Margin", "Evidence state and references", "Explanation"],
    metadata.constraints.map((constraint) => [
      htmlText(constraint.ruleId),
      `<span class="status status-${constraint.status}">${htmlText(constraint.status)}</span>`,
      quantity(constraint.actual),
      quantity(constraint.limit),
      quantity(constraint.margin),
      `${htmlText(constraint.evidenceReferenceState)}${constraint.evidence.length === 0 ? "" : `<br>${display(constraint.evidence)}`}`,
      htmlText(constraint.explanation),
    ]),
    "No constraint results are persisted for this candidate.",
  );
}

function metricMarkup(metadata: Readonly<CandidatePrintableReportMetadataV2>): string {
  return table(
    ["Metric", "Value", "Evidence state", "Evidence references", "Explanation"],
    metadata.metrics.values.map((metric) => [
      htmlText(metric.id),
      metric.value === null ? "—" : display(metric.value),
      htmlText(metric.state),
      metric.evidence.length === 0 ? "No references" : display(metric.evidence),
      htmlText(metric.explanation),
    ]),
    "No metrics are persisted for this candidate.",
  );
}

function warningsMarkup(metadata: Readonly<CandidatePrintableReportMetadataV2>): string {
  if (metadata.warnings.length === 0) return '<p class="empty">No candidate warnings are persisted.</p>';
  return `<ol>${metadata.warnings.map((warning) => `<li>${htmlText(warning)}</li>`).join("")}</ol>`;
}

function scenarioMarkup(metadata: Readonly<CandidatePrintableReportMetadataV2>): string {
  return table(
    ["Scenario", "Authored scenario", "Circuit", "Analysis", "Coverage", "Coverage limitations / omissions"],
    metadata.scenarioCoverage.map((entry) => [
      htmlText(entry.scenarioId),
      entry.scenario === null ? "Not authored" : htmlText(entry.scenario.title),
      entry.scenario === null ? "—" : `${htmlText(entry.scenario.circuitId)}<br>${textOrEmpty(entry.circuitTitle)}`,
      entry.scenario === null ? "—" : display(entry.scenario.config),
      entry.coverage === null ? "No persisted coverage record" : htmlText(entry.coverage.modelTier),
      entry.coverage === null || entry.coverage.limitations.length === 0
        ? "No persisted limitations"
        : `<ul>${entry.coverage.limitations.map((limitation) => `<li>${htmlText(limitation)}</li>`).join("")}</ul>`,
    ]),
    "No scenarios or coverage records are persisted for this candidate.",
  );
}

function render(
  metadata: Readonly<CandidatePrintableReportMetadataV2>,
  customized?: Readonly<{ canonicalMetadata: string }>,
): string {
  const canonicalMetadata = canonicalDesignV2Payload(metadata);
  const manifest = canonicalDesignV2Payload(metadata.provenance.engineeringContextManifest);
  const request = canonicalDesignV2Payload(metadata.provenance.request);
  const metadataMarkup = customized === undefined
    ? `${METADATA_OPEN}${htmlText(canonicalMetadata)}${METADATA_CLOSE}`
    : `${CUSTOMIZED_METADATA_OPEN}${htmlText(customized.canonicalMetadata)}${CUSTOMIZED_METADATA_CLOSE}`;
  const heading = customized === undefined
    ? '<header><h1>scheMAGIC candidate engineering report</h1><p class="subtitle">Exact engine-verified V2 candidate · deterministic self-contained print HTML</p></header>'
    : '<header><h1>scheMAGIC customized-target engineering report</h1><p class="subtitle">TARGET ONLY · INSPECTION ONLY · installed-context projection</p></header>';
  const boundary = customized === undefined
    ? 'No commercial, distributor, pricing, stock, or availability data is included. No simulation samples are included and simulation attestation is <span class="mono">none</span>. Circuit materialization is structural only; PCB layout, footprints, thermal performance, and physical implementation are not verified. This report does not promote independent-review status.'
    : 'This customized-target report is not ordinary-result, eligibility, ranking, commercial, KiCad, or release evidence. Ranking was not recomputed. No selected-part model or simulation samples were added; simulation was not executed and attestation is <span class="mono">none</span>. Footprints, PCB layout, thermal performance, and physical implementation are not verified.';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>scheMAGIC engineering report · ${htmlText(metadata.provenance.candidate.id)}</title>
<style>
:root{color-scheme:light;font-family:Arial,Helvetica,sans-serif;color:#17202a;background:#fff}*{box-sizing:border-box}[hidden]{display:none!important}body{max-width:1200px;margin:0 auto;padding:24px;font-size:12px;line-height:1.45}header{border-bottom:3px solid #17202a;margin-bottom:22px;padding-bottom:14px}h1{font-size:25px;margin:0 0 5px}h2{font-size:17px;margin:24px 0 8px;border-bottom:1px solid #9aa4ad;padding-bottom:4px;break-after:avoid}h3{font-size:14px;margin:16px 0 6px;break-after:avoid}.subtitle{color:#44515c;margin:0}.boundary{border:2px solid #8a4b08;background:#fff8e8;padding:12px;margin:14px 0;break-inside:avoid}.boundary strong{display:block;margin-bottom:4px}.mono,pre,td{overflow-wrap:anywhere;word-break:break-word}.mono,pre{font-family:"Courier New",monospace}pre{white-space:pre-wrap;border:1px solid #ccd2d8;background:#f6f8fa;padding:10px;max-height:none}.table-wrap{overflow:visible}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:6px 0 14px}th,td{border:1px solid #aeb7bf;padding:6px;text-align:left;vertical-align:top}th{background:#e8edf1}.empty{color:#58636d;font-style:italic}.status{font-weight:bold}.status-pass{color:#146c2e}.status-warning,.status-unknown{color:#8a4b08}.status-fail{color:#a51d1d}ol,ul{margin:4px 0;padding-left:20px}footer{border-top:1px solid #9aa4ad;margin-top:24px;padding-top:10px;color:#44515c}@page{size:auto;margin:12mm}@media print{body{max-width:none;padding:0;font-size:9pt}header{break-after:avoid}table{font-size:7.5pt}thead{display:table-header-group}tr,td,th,.boundary{break-inside:avoid}h2{break-before:auto}a{color:inherit;text-decoration:none}}
</style>
</head>
<body>
${metadataMarkup}
${heading}
<aside class="boundary"><strong>${customized === undefined ? "Engineering boundary" : "Customized-target authority boundary"}</strong>${boundary}</aside>
<main>
<section><h2>Provenance</h2>${provenanceMarkup(metadata)}</section>
<section><h2>Exact electrical request</h2><pre>${htmlText(request)}</pre></section>
<section><h2>Exact engineering context manifest</h2><pre>${htmlText(manifest)}</pre></section>
<section><h2>Complete electrical BOM</h2>${bomMarkup(metadata)}</section>
<section><h2>Derived engineering values</h2>${derivedMarkup(metadata)}</section>
<section><h2>Physical, behavioral, and non-BOM representation boundary</h2>${representationMarkup(metadata)}</section>
<section><h2>Constraint results</h2>${constraintMarkup(metadata)}</section>
<section><h2>Candidate metrics</h2><p>Warnings: ${metadata.metrics.warningCount}; estimated metrics: ${metadata.metrics.estimateCount}; unknown metrics: ${metadata.metrics.unknownCount}.</p>${metricMarkup(metadata)}</section>
<section><h2>Candidate warnings</h2>${warningsMarkup(metadata)}</section>
<section><h2>Scenario coverage and omission limitations</h2><p>No waveform or simulation-result data appears in this report. Coverage labels and limitations are persisted engineering metadata, not execution attestation.</p>${scenarioMarkup(metadata)}</section>
</main>
<footer>Result <span class="mono">${htmlText(metadata.provenance.result.contentHash)}</span> · Candidate <span class="mono">${htmlText(metadata.provenance.candidate.id)}</span></footer>
</body>
</html>
`;
  if (html.length > MAX_REPORT_BYTES || new TextEncoder().encode(html).byteLength > MAX_REPORT_BYTES) {
    throw new CandidatePrintableReportExportErrorV2("resource_limit");
  }
  return html;
}

/** @internal Unlabelled projection payload used to hash customized-target content. */
export function _renderCandidatePrintableReportV2PayloadFromProjection(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignCandidateV2>,
  manifest: Readonly<ElectricalDesignContextManifestV2>,
): string {
  return render(metadataFor(result, candidate, manifest));
}

/** @internal Installed-context renderer; intentionally absent from public package facades. */
export function _renderCandidatePrintableReportV2FromProjection(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignCandidateV2>,
  manifest: Readonly<ElectricalDesignContextManifestV2>,
  extension: Readonly<{
    kind: "customized_target_inspection";
    canonicalMetadata: string;
  }>,
): string {
  if (extension.kind !== "customized_target_inspection") {
    throw new TypeError("Unsupported printable-report projection extension");
  }
  return render(metadataFor(result, candidate, manifest), {
    canonicalMetadata: extension.canonicalMetadata,
  });
}

function parseResultAndContext(
  resultInput: Readonly<DesignResultV2>,
  context: Readonly<GenerateElectricalContextV2>,
): DesignResultV2 {
  let result: DesignResultV2;
  try {
    result = parseDesignResultV2(resultInput);
  } catch {
    throw new CandidatePrintableReportExportErrorV2("invalid_result");
  }
  let issues: DesignValidationIssue[];
  try {
    issues = validateDesignResultEngineeringContextV2(result, context);
  } catch {
    throw new CandidatePrintableReportExportErrorV2("engineering_context_unverified");
  }
  if (issues.length > 0) {
    throw new CandidatePrintableReportExportErrorV2("engineering_context_unverified", issues);
  }
  return result;
}

/** Export one exact engine-regenerated V2 candidate as deterministic, offline print HTML. */
export function exportDesignResultPrintableReportV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): string {
  const result = parseResultAndContext(resultInput, engineeringContext);
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new CandidatePrintableReportExportErrorV2("candidate_not_found");
  try {
    return render(metadataFor(result, candidate, engineeringContext.manifest));
  } catch (error) {
    if (error instanceof CandidatePrintableReportExportErrorV2) throw error;
    throw new CandidatePrintableReportExportErrorV2("render_failed");
  }
}

function basicMetadata(value: unknown): value is CandidatePrintableReportMetadataV2 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  return metadata.format === "schemagic-printable-report-metadata"
    && metadata.schemaVersion === 2
    && metadata.artifactKind === "engineering_candidate_report"
    && metadata.medium === "self_contained_print_html";
}

function extractMetadata(report: string): CandidatePrintableReportMetadataV2 {
  if (typeof report !== "string"
    || report.length > MAX_REPORT_BYTES
    || new TextEncoder().encode(report).byteLength > MAX_REPORT_BYTES) {
    throw new CandidatePrintableReportExportErrorV2("resource_limit");
  }
  if (!report.startsWith("<!doctype html>\n<html lang=\"en\">\n")
    || !report.endsWith("</html>\n")
    || report.includes("\r")) {
    throw new CandidatePrintableReportExportErrorV2("invalid_report");
  }
  const start = report.indexOf(METADATA_OPEN);
  if (start < 0 || report.indexOf(METADATA_OPEN, start + METADATA_OPEN.length) >= 0) {
    throw new CandidatePrintableReportExportErrorV2("invalid_report");
  }
  const contentStart = start + METADATA_OPEN.length;
  const end = report.indexOf(METADATA_CLOSE, contentStart);
  if (end < 0 || report.indexOf(METADATA_CLOSE, end + METADATA_CLOSE.length) >= 0) {
    throw new CandidatePrintableReportExportErrorV2("invalid_report");
  }
  try {
    const decoded = decodeHtmlText(report.slice(contentStart, end));
    const parsed = JSON.parse(decoded) as unknown;
    if (!basicMetadata(parsed) || canonicalDesignV2Payload(parsed) !== decoded) {
      throw new TypeError("Printable report metadata is not canonical");
    }
    return parsed;
  } catch (error) {
    if (error instanceof CandidatePrintableReportExportErrorV2) throw error;
    throw new CandidatePrintableReportExportErrorV2("invalid_report");
  }
}

/**
 * Parse and verify a report against its exact result and engineering context.
 * Metadata is canonical-parsed, all semantics are regenerated, and every HTML
 * byte must match; visible or hidden drift therefore fails closed.
 */
export function parseDesignResultPrintableReportV2(
  report: string,
  resultInput: Readonly<DesignResultV2>,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): Readonly<CandidatePrintableReportMetadataV2> {
  const parsed = extractMetadata(report);
  const result = parseResultAndContext(resultInput, engineeringContext);
  const candidateId = parsed.provenance?.candidate?.id;
  const candidate = typeof candidateId === "string"
    ? result.candidates.find((entry) => entry.id === candidateId)
    : undefined;
  if (candidate === undefined) throw new CandidatePrintableReportExportErrorV2("artifact_unverified");
  try {
    const expected = metadataFor(result, candidate, engineeringContext.manifest);
    if (canonicalDesignV2Payload(parsed) !== canonicalDesignV2Payload(expected)
      || report !== render(expected)) {
      throw new CandidatePrintableReportExportErrorV2("artifact_unverified");
    }
    return expected;
  } catch (error) {
    if (error instanceof CandidatePrintableReportExportErrorV2) throw error;
    throw new CandidatePrintableReportExportErrorV2("artifact_unverified");
  }
}
