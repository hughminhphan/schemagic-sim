import type { PrimaryPartCustomizationSidecarV1 } from "@opencircuit/design-schema";
import type {
  DesignerApplicationAdapter,
  DesignerParameterField,
  DesignerRequest,
  DesignerValidationIssue,
} from "./contracts";
import { escapeHtml, formatIdentifier, statusChip } from "./view";

function matchingIssue(field: DesignerParameterField, issues: readonly DesignerValidationIssue[]): DesignerValidationIssue | undefined {
  return issues.find((issue) => issue.path === field.id || issue.path.startsWith(`${field.id}.`));
}

function fieldMarkup(
  field: DesignerParameterField,
  index: number,
  request: Readonly<DesignerRequest>,
  issues: readonly DesignerValidationIssue[],
  busy: boolean,
): string {
  const inputId = `designer-field-${index}`;
  const issue = matchingIssue(field, issues);
  const description = field.description?.trim() || undefined;
  const descriptionId = description === undefined ? undefined : `${inputId}-description`;
  const errorId = issue === undefined ? undefined : `${inputId}-error`;
  const describedBy = [descriptionId, errorId].filter((id): id is string => id !== undefined);
  const describedByAttribute = describedBy.length === 0
    ? ""
    : ` aria-describedby="${describedBy.join(" ")}"`;
  const disabled = busy ? " disabled" : "";
  let control = "";
  if (field.control === "number") {
    const reading = field.read(request);
    control = `<div class="designer-value-control"><input id="${inputId}" data-designer-field="${index}" type="number" inputmode="decimal" value="${escapeHtml(String(reading.value))}"${field.minimum === undefined ? "" : ` min="${field.minimum}"`}${field.maximum === undefined ? "" : ` max="${field.maximum}"`}${field.step === undefined ? " step=\"any\"" : ` step="${field.step}"`}${describedByAttribute}${issue ? " aria-invalid=\"true\"" : ""}${disabled}><select data-designer-unit="${index}" aria-label="Unit for ${escapeHtml(field.label)}"${disabled}>${field.unitOptions.map((unit) => `<option value="${escapeHtml(unit.value)}"${unit.value === reading.unit ? " selected" : ""}>${escapeHtml(unit.label)}</option>`).join("")}</select></div>`;
  } else if (field.control === "select") {
    const selected = field.read(request);
    control = `<select id="${inputId}" data-designer-field="${index}"${describedByAttribute}${issue ? " aria-invalid=\"true\"" : ""}${disabled}>${field.options.map((option) => `<option value="${escapeHtml(option.value)}"${option.value === selected ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select>`;
  } else {
    control = `<input id="${inputId}" data-designer-field="${index}" type="checkbox"${field.read(request) ? " checked" : ""}${describedByAttribute}${issue ? " aria-invalid=\"true\"" : ""}${disabled}>`;
  }
  const label = field.control === "checkbox"
    ? `<label class="designer-checkbox-label" for="${inputId}">${control}<span>${escapeHtml(field.label)}</span></label>`
    : `<label for="${inputId}">${escapeHtml(field.label)}</label>${control}`;
  return `<div class="designer-form-field" data-control="${field.control}">${label}${description === undefined ? "" : `<small id="${descriptionId}">${escapeHtml(description)}</small>`}${issue ? `<p class="designer-field-error" id="${errorId}">${escapeHtml(issue.message)}</p>` : ""}</div>`;
}

function assumptionsMarkup(request: Readonly<DesignerRequest>): string {
  return `<details class="designer-assumptions designer-disclosure"><summary><span>${statusChip("declared input")}<strong>Assumptions &amp; boundaries</strong></span><small>${request.assumptions.length} declared</small></summary><div id="designer-assumptions-title"><ul>${request.assumptions.map((assumption) => `<li><div>${statusChip(assumption.source)}<strong>${escapeHtml(assumption.description)}</strong></div><small>Affects ${escapeHtml(assumption.affects.join(", "))}</small></li>`).join("")}</ul></div></details>`;
}

function generationModeMarkup(
  field: DesignerParameterField | undefined,
  request: Readonly<DesignerRequest>,
  busy: boolean,
): string {
  if (field?.control !== "checkbox") return "";
  const referenceMode = field.read(request);
  const disabled = busy ? " disabled" : "";
  return `<fieldset class="designer-generation-mode" data-testid="designer-generation-mode"><legend>Selection mode</legend><label data-mode="reference"><input type="radio" name="designer-generation-mode" value="reference" data-designer-generation-mode aria-label="Reference design"${referenceMode ? " checked" : ""}${disabled}><span><strong>Reference design</strong><small>Include unresolved hard constraints, warning observations, and estimated candidate outputs for inspection. Every estimate and unknown remains labeled.</small></span><em>Recommended first run</em></label><label data-mode="strict"><input type="radio" name="designer-generation-mode" value="strict" data-designer-generation-mode aria-label="Strict evidence gate"${referenceMode ? "" : " checked"}${disabled}><span><strong>Strict evidence gate</strong><small>Exclude unresolved hard constraints. Estimate and warning controls below remain independent; a valid run may return zero solutions.</small></span><em>Fail closed</em></label></fieldset>`;
}

function sourcingMarkup(request: Readonly<DesignerRequest>): string {
  if (!("sourcing" in request) || !request.sourcing) {
    return "";
  }
  const mode = request.sourcing.mode === "single_distributor" ? "One distributor for the complete BOM" : "Any selected distributor";
  return `<section class="designer-sourcing-notice"><div>${statusChip("snapshot observation")}<strong>${escapeHtml(mode)}</strong></div><p>${request.sourcing.buildQuantity} assemblies · ${escapeHtml(request.sourcing.region)} · ${escapeHtml(request.sourcing.currency)} · ${escapeHtml(request.sourcing.distributors.join(", "))}</p><small>Stock, lead time, and price are dated observations, not guarantees.</small></section>`;
}

export function renderRequirementsForm(
  adapter: DesignerApplicationAdapter,
  request: Readonly<DesignerRequest>,
  issues: readonly DesignerValidationIssue[],
  busy: boolean,
  selectedPresetId: string | undefined,
  statusMessage?: string,
  pendingCustomization?: Readonly<PrimaryPartCustomizationSidecarV1>,
): string {
  const fields = adapter.parameterForm.fields(request);
  const generationModeField = fields.find((field) => field.id === "constraints.allowUnknownHardConstraints");
  const basic = fields.filter((field) => (
    field.section === "basic" && field.id !== "constraints.allowUnknownHardConstraints"
  ));
  const advanced = fields.filter((field) => field.section === "advanced");
  const disabled = busy ? " disabled" : "";
  const transferActions = request.schemaVersion === 2
    ? `<div class="designer-detail-actions" aria-label="Requirements transfer actions"><button type="button" data-designer-request-download${disabled}>Download requirements JSON</button><button type="button" data-designer-request-share${disabled}>Create requirements share URL</button><button type="button" data-primary-customization-import${disabled}>${pendingCustomization === undefined ? "Load customization JSON" : "Replace customization JSON"}</button><input data-primary-customization-file type="file" accept="application/json,.json" hidden${disabled}></div>${pendingCustomization === undefined ? "" : `<div class="designer-customization-pending" role="status"><strong>Customization instruction loaded</strong><span>Source candidate <code>${escapeHtml(pendingCustomization.sourceCandidateId)}</code></span><span>Target <code>${escapeHtml(pendingCustomization.substitution.targetProfile.profileId)}</code></span><button type="button" data-primary-customization-reset${disabled}>Remove instruction</button></div>`}`
    : "";
  const transferredPreset = selectedPresetId === undefined
    ? `<option value="" selected disabled>Transferred requirements</option>`
    : "";
  const generateLabel = pendingCustomization === undefined
    ? "Generate design"
    : "Regenerate source + evaluate substitution";
  const busyLabel = pendingCustomization === undefined
    ? "Generating deterministic candidates…"
    : "Regenerating source and evaluating substitution…";
  return `<section class="designer-workflow" aria-labelledby="designer-requirements-title" aria-busy="${busy}"><header class="designer-workflow-header"><div><button class="designer-text-action" data-designer-back${disabled}>← Applications</button><span class="designer-step-eyebrow">01 · Requirements</span><span class="designer-kicker">${escapeHtml(adapter.name)}</span><h1 id="designer-requirements-title" tabindex="-1">Define the operating point</h1><p>Start from the supported example, check the electrical envelope, then choose whether unresolved evidence may be inspected.</p></div><div class="designer-requirements-transfer-actions"><label class="designer-preset-select">Supported starting point<select data-designer-preset data-testid="designer-preset" aria-label="Starting point"${disabled}>${transferredPreset}${adapter.presets.map((entry) => `<option value="${escapeHtml(entry.id)}"${entry.id === selectedPresetId ? " selected" : ""}>${escapeHtml(entry.name)}</option>`).join("")}</select></label>${transferActions}</div></header><div class="designer-requirements-grid"><form class="designer-parameter-form" data-designer-form novalidate><section class="designer-form-section" aria-labelledby="designer-basic-title"><header><span class="designer-section-code">ELECTRICAL REQUIREMENTS</span><h2 id="designer-basic-title">Operating point</h2></header><div class="designer-field-grid">${basic.map((field) => fieldMarkup(field, fields.indexOf(field), request, issues, busy)).join("")}</div></section>${generationModeMarkup(generationModeField, request, busy)}${advanced.length > 0 ? `<details class="designer-advanced"><summary>Advanced constraints <span>${advanced.length} controls</span></summary><div class="designer-field-grid">${advanced.map((field) => fieldMarkup(field, fields.indexOf(field), request, issues, busy)).join("")}</div></details>` : ""}${sourcingMarkup(request)}${statusMessage ? `<div class="designer-error-banner" role="status"><div><strong>Requirements status</strong><span>${escapeHtml(statusMessage)}</span></div><button type="button" data-designer-retry data-testid="designer-retry"${busy || issues.length > 0 ? " disabled" : ""}>Retry generation</button></div>` : ""}<footer class="designer-generate-bar"><div aria-live="polite">${issues.length === 0 ? `<span class="designer-valid">Ready · request contract valid</span>` : `<span class="designer-invalid">${issues.length} request ${issues.length === 1 ? "issue" : "issues"}</span>`}<small>${generationModeField?.control === "checkbox" && generationModeField.read(request) ? "Reference output is inspection-only until policy-eligible." : "Strict selection may return zero; no unknown is promoted to pass."}</small></div><button class="designer-primary-action" data-testid="designer-generate" aria-label="${escapeHtml(generateLabel)}" type="submit"${busy || issues.length > 0 ? " disabled" : ""}>${busy ? busyLabel : generateLabel}</button></footer></form>${assumptionsMarkup(request)}</div></section>`;
}

export function issuesSummary(issues: readonly DesignerValidationIssue[]): string {
  return issues.map((issue) => `${formatIdentifier(issue.path)}: ${issue.message}`).join("; ");
}
