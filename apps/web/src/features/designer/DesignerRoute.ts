import {
  PRIMARY_PART_CUSTOMIZATION_MAX_BYTES,
  parseConstraintDecisionV3,
  serializeDesignResultV1,
  serializeDesignResultV2,
  type DesignCandidate,
  type DesignResult,
  type PrimaryPartCustomizationSidecarV1,
  type PrimaryPartCustomizedResultSidecarV1,
} from "@opencircuit/design-schema";
import type { ProductionDesignArtifactKindV2 } from "@opencircuit/design-export/production-artifact-v2";
import { planDesignResultScenarioExportsV2 } from "@opencircuit/design-export/scenario-plan-v2";
import type {
  SourcingRequestPacketInputV1,
  SourcingRequestPolicyV1,
} from "@opencircuit/sourcing-schema";
import { renderCandidateComparison } from "./CandidateComparison";
import { renderCandidateDetail } from "./CandidateDetail";
import type {
  DesignerApplicationAdapter,
  DesignerPrimaryPartCustomizationTargetV1,
  DesignerProductionGenerationV2,
  DesignerParameterField,
  DesignerRequest,
  DesignerRouteOptions,
} from "./contracts";
import {
  loadDesignerDemonstration,
  renderDesignerDemonstrationGallery,
  type DesignerDemonstrationId,
} from "./ExampleGallery";
import {
  renderImportedResult,
  type DesignerSimulationViewState,
  type DesignerSolutionFilter,
  type ImportedDemonstrationContext,
  type ProductionSchematicPreview,
} from "./ImportedResultView";
import { circuitOnlyStructuralSvgPreview } from "./SchematicPreview";
import type {
  DesignerSimulationExecution,
  DesignerSimulationRunner,
} from "./DesignerSimulationRuntime";
import {
  DESIGN_RESULT_IMPORT_MAX_BYTES,
  LEGACY_INLINE_SOURCING_EXPORT_REASON,
  designResultHasLegacyInlineSourcing,
  parseImportedDesignResultText,
  serializeImportedDesignResult,
  type ImportedDesignResult,
} from "./ResultImport";
import { serializeScenarioGatePlanV2 } from "./ResultExport";
import {
  DESIGN_REQUEST_IMPORT_MAX_BYTES,
  clearElectricalDesignRequestShareFromUrl,
  electricalDesignRequestShareUrl,
  parseElectricalDesignRequestV2Bytes,
  serializeElectricalDesignRequestV2,
} from "./RequestTransfer";
import {
  clearImportedDesignResultShareFromUrl,
  importedDesignResultShareUrl,
} from "./ResultShare";
import { parseDesignerShareState } from "./DesignerShareState";
import {
  assertPrimaryPartCustomizationRequestBinding,
  clearPrimaryPartCustomizationShareFromUrl,
  parsePrimaryPartCustomizationFileV1Bytes,
  primaryPartCustomizationShareUrl,
  serializePrimaryPartCustomizationFileV1,
} from "./PrimaryPartCustomizationTransfer";
import { renderPrimaryPartCustomization } from "./PrimaryPartCustomizationView";
import { renderPowerReferenceEvidence } from "./PowerReferenceEvidenceView";
import { renderRequirementsForm } from "./RequirementsForm";
import {
  renderSourcingRequestTransferV1,
  verifyExactSourcingRequestPacketArtifactV1,
} from "./SourcingRequestTransfer";
import { escapeHtml } from "./view";
import "./style.css";

type DesignerStage = "applications" | "requirements" | "results" | "imported";
type DesignerWorkspaceTab = "schematic" | "results" | "bom" | "optimize" | "export";
type DesignerSimulationRuntimeModule = typeof import("./DesignerSimulationRuntime");
type CustomizedTargetArtifactKind =
  | "customized_target_electrical_bom_csv"
  | "customized_target_structural_svg"
  | "customized_target_engineering_report_html"
  | "customized_target_structural_kicad"
  | "customized_target_behavioral_scenario_spice"
  | "customized_target_inspection_receipt";

type CustomizedTargetExportArtifactKind = Exclude<
  CustomizedTargetArtifactKind,
  "customized_target_inspection_receipt"
>;

function customizedTargetExportArtifactKind(value: unknown): value is CustomizedTargetExportArtifactKind {
  return value === "customized_target_electrical_bom_csv"
    || value === "customized_target_structural_svg"
    || value === "customized_target_engineering_report_html"
    || value === "customized_target_structural_kicad"
    || value === "customized_target_behavioral_scenario_spice";
}

function safeCustomizedTargetFilenameToken(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
}

const DEFAULT_SOURCING_REQUEST_POLICY_V1 = Object.freeze({
  schemaVersion: 1,
  region: "US",
  currency: "USD",
  allowedLifecycle: Object.freeze(["active"]),
  allowBackorder: false,
  allowMarketplace: false,
  maximumSnapshotAgeSeconds: 3_600,
} as const satisfies SourcingRequestPolicyV1);


function clearDesignerSharesFromUrl(location: Pick<Location, "href"> = window.location): string {
  return clearPrimaryPartCustomizationShareFromUrl({
    href: clearElectricalDesignRequestShareFromUrl({ href: clearImportedDesignResultShareFromUrl(location) }),
  });
}

export function verifiedProductionGeneration(
  value: unknown,
  adapter: Readonly<DesignerApplicationAdapter>,
): DesignerProductionGenerationV2 {
  if (
    !value
    || typeof value !== "object"
    || (
      (value as { kind?: unknown }).kind !== "production_context_verified"
      && (value as { kind?: unknown }).kind !== "production_constraint_observation"
    )
  ) {
    throw new Error("Application adapter did not return a verified production generation");
  }
  const generation = value as DesignerProductionGenerationV2;
  if (
    generation.application !== adapter.application
    || generation.result.schemaVersion !== 2
    || generation.result.request.application !== adapter.application
    || generation.contextManifestContentHash !== generation.result.libraryContentHash
  ) {
    throw new Error("Application adapter returned a context-mismatched production generation");
  }
  if (generation.kind === "production_constraint_observation") {
    const expectedPolicy = adapter.productionStatus?.constraintPolicy;
    const decision = parseConstraintDecisionV3(generation.constraintDecision);
    const resultCandidateIds = [...generation.result.candidates.map((candidate) => candidate.id)].sort();
    if (
      expectedPolicy === undefined
      || decision.policy.constraintPolicy !== expectedPolicy.id
      || decision.policy.contentHash !== expectedPolicy.contentHash
      || decision.source.resultContentHash !== generation.result.contentHash
      || JSON.stringify(decision.source.candidateIds) !== JSON.stringify(resultCandidateIds)
      || decision.candidates.some((candidate) => (
        generation.result.candidates.find((entry) => entry.id === candidate.candidateId)?.recipeId !== candidate.recipeId
      ))
    ) {
      throw new Error("Application adapter returned a policy-mismatched production observation");
    }
  }
  if (adapter.authorizesProductionGeneration?.(value) !== true) {
    throw new Error("Application adapter did not authorize this exact production generation");
  }
  return generation;
}

export function isAuthorizedStrictPowerInspectionSource(
  generation: Readonly<DesignerProductionGenerationV2> | undefined,
  adapter: Readonly<DesignerApplicationAdapter> | undefined,
): generation is Readonly<DesignerProductionGenerationV2> {
  if (
    generation === undefined
    || adapter === undefined
    || adapter.application !== "power.buck"
    || adapter.status !== "ready"
    || adapter.authorizesProductionGeneration?.(generation) !== true
  ) return false;
  const result = generation.result;
  const execution = generation.execution;
  if (
    generation.application !== "power.buck"
    || result.request.application !== "power.buck"
    || result.candidates.length !== 0
    || result.rejectedCandidates.length !== 1
    || execution.counts.checked !== 1
    || execution.counts.rejected !== 1
    || execution.rejections.length !== 1
  ) return false;
  const rejection = execution.rejections[0]!;
  const requestConstraints = result.request.constraints;
  const gateMatchesRejection = rejection.reasonCode === "unknown_constraint_disallowed"
    ? !requestConstraints.allowUnknownHardConstraints
    : rejection.reasonCode === "warning_disallowed"
      ? !requestConstraints.allowUnknownWarnings
      : rejection.reasonCode === "estimated_values_disallowed"
        ? !requestConstraints.allowEstimatedValues
        : false;
  return gateMatchesRejection
    && rejection.constraints.some((constraint) => constraint.status === "unknown")
    && rejection.constraints.every((constraint) => constraint.status !== "fail")
    && result.rejectedCandidates.every((rejectedCandidate) => (
      rejectedCandidate.constraints.some((constraint) => constraint.status === "unknown")
      && rejectedCandidate.constraints.every((constraint) => constraint.status !== "fail")
    ));
}

function clonePowerEvidenceInspectionRequest(
  source: Readonly<DesignerProductionGenerationV2["result"]["request"]>,
) {
  if (
    source.application !== "power.buck"
    || (
      source.constraints.allowEstimatedValues
      && source.constraints.allowUnknownWarnings
      && source.constraints.allowUnknownHardConstraints
    )
  ) throw new Error("Evidence-limited inspection requires an exact evidence-gated Power request");
  const cloned = structuredClone(source);
  return {
    ...cloned,
    constraints: {
      ...cloned.constraints,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: true,
    },
  };
}

function referenceInspectionQuickStart(request: Readonly<DesignerRequest>): DesignerRequest {
  const cloned = structuredClone(request);
  if (cloned.schemaVersion === 2) {
    cloned.constraints.allowEstimatedValues = true;
    cloned.constraints.allowUnknownWarnings = true;
    cloned.constraints.allowUnknownHardConstraints = true;
  }
  return cloned;
}

function importedProductionGeneration(
  generation: Readonly<DesignerProductionGenerationV2>,
): ImportedDesignResult {
  return generation.kind === "production_constraint_observation"
    ? {
        result: generation.result,
        trust: "production_constraint_observation",
        execution: generation.execution,
        contextManifestContentHash: generation.contextManifestContentHash,
        constraintDecision: generation.constraintDecision,
      }
    : {
        result: generation.result,
        trust: "production_context_verified",
        execution: generation.execution,
        contextManifestContentHash: generation.contextManifestContentHash,
      };
}

function importedHasVerifiedProductionContext(
  imported: Readonly<ImportedDesignResult> | undefined,
): imported is Extract<ImportedDesignResult, { trust: "production_constraint_observation" | "production_context_verified" }> {
  return imported?.trust === "production_context_verified"
    || imported?.trust === "production_constraint_observation";
}

function applicationChooser(
  applications: readonly DesignerApplicationAdapter[],
  message?: string,
  loadingDemonstrationId?: DesignerDemonstrationId,
): string {
  const importedTools = `<details class="designer-entry-tools"><summary><span>Open or inspect existing design files</span><small>Examples · request JSON · result JSON</small></summary><div>${renderDesignerDemonstrationGallery({ loadingId: loadingDemonstrationId })}<section class="designer-import-panel" aria-labelledby="designer-request-import-title"><div><span class="designer-section-code">REQUEST JSON</span><h2 id="designer-request-import-title">Continue from requirements</h2><p>Open canonical V2 electrical requirements in the matching form. The file remains untrusted input until you explicitly generate.</p></div><div><button data-designer-request-import>Choose requirements file</button><input data-designer-request-file type="file" accept="application/json,.json" hidden><small>Maximum ${Math.floor(DESIGN_REQUEST_IMPORT_MAX_BYTES / 1_048_576)} MiB · processed locally</small></div></section><section class="designer-import-panel" aria-labelledby="designer-import-title"><div><span class="designer-section-code">RESULT JSON</span><h2 id="designer-import-title">Inspect a persisted result</h2><p>V1 remains legacy audit-only; V2 receives structural validation only. Import never installs production trust.</p></div><div><button data-designer-import>Choose result file</button><input data-designer-result-file type="file" accept="application/json,.json" hidden><small>Maximum ${Math.floor(DESIGN_RESULT_IMPORT_MAX_BYTES / 1_048_576)} MiB · processed locally</small></div></section></div></details>`;
  return `<section class="designer-entry" aria-labelledby="designer-entry-title"><header class="designer-cockpit-header"><div><span class="designer-step-eyebrow">Engineering design cockpit</span><h1 id="designer-entry-title">Start a new design</h1><p>Choose the supported Power or Motor workflow. Each quick start loads a real electrical requirement set ready to inspect.</p></div><aside aria-label="First-time direction"><strong>First run</strong><span>Choose an application</span><span>Review the loaded requirements</span><span>Generate and select a solution</span></aside></header>${message ? `<div class="designer-entry-message designer-error-banner" role="alert"><div><strong>Designer could not open that item</strong><span>${escapeHtml(message)}</span></div><button type="button" data-designer-retry data-testid="designer-retry">Try again</button></div>` : ""}<section class="designer-application-section" aria-labelledby="designer-applications-title"><header><div><span class="designer-section-code">SUPPORTED APPLICATIONS</span><h2 id="designer-applications-title">Select an application</h2></div><p>Both workflows use installed, hash-bound generation contexts. Choose the selection policy after reviewing the electrical inputs.</p></header><div class="designer-application-grid">${applications.map((application, index) => {
    const blocked = application.status === "blocked";
    const statusLabel = application.status === "ready"
      ? "Ready"
      : blocked
        ? "Production V2 blocked"
        : "Adapter unavailable";
    const actionLabel = application.status === "ready"
      ? `Start ${application.application === "power.buck" ? "Power" : "Motor"} design`
      : blocked
        ? "Await reviewed release"
        : "Not connected";
    const applicationLabel = application.application === "power.buck" ? "Power" : "Motor";
    const facts = application.application === "power.buck"
      ? ["12 V input", "5 V / 200 mA output", "Integrated synchronous buck"]
      : ["12 V motor", "1.5 A run / 3 A stall", "Integrated H-bridge"];
    const applicationCopy = application.application === "power.buck"
      ? "Size the supported low-current integrated synchronous-buck design."
      : "Size the supported compact brushed-DC integrated H-bridge design.";
    const preset = application.presets[0];
    const readiness = application.productionStatus
      ? `<dl class="designer-readiness"><div><dt>Reviewed profiles</dt><dd>${application.productionStatus.reviewedProfileCount}</dd></div><div><dt>Native recipe set</dt><dd>${application.productionStatus.installedRecipeSet ? "installed" : "not installed"}</dd></div></dl>`
      : "";
    const readinessTechnical = application.productionStatus
      ? `<dl class="designer-readiness-technical"><div><dt>V3 production policy</dt><dd>${application.productionStatus.constraintPolicy ? `installed · ${application.productionStatus.constraintPolicy.productionEngineeringGapRuleCount} engineering-gap rules` : "not installed"}</dd></div></dl><code class="designer-readiness-reason">${escapeHtml(application.productionStatus.reason ?? "generation_context_contract_satisfied")}</code>${application.productionStatus.constraintPolicy ? `<code class="designer-readiness-reason">${escapeHtml(application.productionStatus.constraintPolicy.contentHash)}</code>` : ""}`
      : "";
    return `<article data-application="${escapeHtml(application.application)}"><header><span class="designer-card-index">0${index + 1}</span><div><span>${escapeHtml(applicationLabel)}</span><h3>${escapeHtml(application.shortName)}</h3></div><span class="designer-chip" data-status="${application.status}">${statusLabel}</span></header><p>${applicationCopy}</p><ul class="designer-quick-facts">${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>${preset ? `<div class="designer-preset-preview"><span>${application.presets.length} starting point${application.presets.length === 1 ? "" : "s"}</span><strong>${escapeHtml(preset.name)}</strong><small>${escapeHtml(preset.description)}</small></div>` : ""}${readiness}<footer><button data-designer-application="${escapeHtml(application.application)}" data-testid="designer-app-${application.application === "power.buck" ? "power" : "motor"}" aria-label="${escapeHtml(actionLabel)}"${application.status === "ready" ? "" : " disabled"}>${actionLabel}<span aria-hidden="true">→</span><span class="designer-sr-only">Set requirements →</span></button></footer>${application.statusMessage ? `<details class="designer-card-caveat"><summary>Capability details</summary>${readinessTechnical}<p>${escapeHtml(application.statusMessage)}</p></details>` : ""}</article>`;
  }).join("")}</div></section>${importedTools}<footer class="designer-entry-footer"><span>Local-first</span><span>Hash-bound generation</span><span>Unknown stays unknown</span><span>Context-gated export</span></footer></section>`;
}

function resultsMarkup(
  result: Readonly<DesignResult>,
  selected: DesignCandidate | undefined,
  pinned: ReadonlySet<string>,
  snapshots: DesignerRouteOptions["offerSnapshots"],
  simulatorPath: string,
  message?: string,
): string {
  return `<section class="designer-results" aria-labelledby="designer-results-title"><header class="designer-results-header"><div><button class="designer-text-action" data-designer-edit>← Edit requirements</button><span class="designer-kicker">${escapeHtml(result.request.application)}</span><h1 id="designer-results-title">Deterministic candidates</h1><p>Library ${escapeHtml(result.libraryVersion)} · request <code>${escapeHtml(result.requestHash)}</code></p></div><div><span>${result.candidates.length} viable</span><span>${result.rejectedCandidates.length} rejected</span></div></header>${message ? `<div class="designer-error-banner" role="status">${escapeHtml(message)}</div>` : ""}${renderCandidateComparison(result.candidates, selected?.id, pinned)}${selected ? renderCandidateDetail(selected, result.request, snapshots ?? [], simulatorPath, !designResultHasLegacyInlineSourcing(result)) : `<section class="designer-rejection-summary"><h2>Rejected combinations</h2>${result.rejectedCandidates.length > 0 ? `<ul>${result.rejectedCandidates.map((rejection) => `<li><strong>${escapeHtml(rejection.recipeId)}</strong><span>${rejection.constraints.length} inspectable constraints</span></li>`).join("")}</ul>` : `<p>No rejected candidates were reported.</p>`}</section>`}</section>`;
}

function download(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export class DesignerRoute {
  readonly #root: HTMLElement;
  readonly #options: DesignerRouteOptions;
  #stage: DesignerStage = "applications";
  #adapter: DesignerApplicationAdapter | undefined;
  #request: DesignerRequest | undefined;
  #selectedPresetId: string | undefined;
  #result: DesignResult | undefined;
  #imported: ImportedDesignResult | undefined;
  #importedDemonstration: ImportedDemonstrationContext | undefined;
  #loadingDemonstrationId: DesignerDemonstrationId | undefined;
  #selectedImportedCandidateId: string | undefined;
  #selectedImportedScenarioId: string | undefined;
  #selectedCandidateId: string | undefined;
  #workspaceTab: DesignerWorkspaceTab = "schematic";
  #solutionFilter: DesignerSolutionFilter = "all";
  #solutionObjective = "";
  #pinnedCandidateIds = new Set<string>();
  #pinnedImportedCandidateIds = new Set<string>();
  #busy = false;
  #message: string | undefined;
  #operationEpoch = 0;
  #schematicPreviewEpoch = 0;
  #productionSchematicPreview: (ProductionSchematicPreview & { readonly key: string }) | undefined;
  #designerSimulationEpoch = 0;
  #designerSimulationState: (DesignerSimulationViewState & { readonly key: string }) | undefined;
  #designerSimulationExecution: DesignerSimulationExecution | undefined;
  #designerSimulationRunner: DesignerSimulationRunner | undefined;
  #designerSimulationRuntime: DesignerSimulationRuntimeModule | undefined;
  #designerSimulationViewerDisposer: (() => void) | undefined;
  #productionGeneration: DesignerProductionGenerationV2 | undefined;
  #deferredCustomizationTargetDiscovery: Readonly<{
    source: DesignerProductionGenerationV2;
    adapter: DesignerApplicationAdapter;
    candidateId: string;
    customizationEpoch: number;
    previewKey: string;
    focusAfter?: "candidate" | "customization";
  }> | undefined;
  #customizationTargets: readonly DesignerPrimaryPartCustomizationTargetV1[] = [];
  #customizationInstruction: PrimaryPartCustomizationSidecarV1 | undefined;
  #customizedResult: PrimaryPartCustomizedResultSidecarV1 | undefined;
  #customizationPhase: "idle" | "loading_targets" | "targets_unavailable" | "evaluating" | "importing" | "verifying_receipt" = "idle";
  #customizationExportKind: CustomizedTargetArtifactKind | undefined;
  #customizationEpoch = 0;
  #sourcingRequestBuildQuantity = 1;
  #sourcingRequestRegion: string = DEFAULT_SOURCING_REQUEST_POLICY_V1.region;
  #sourcingRequestCurrency: string = DEFAULT_SOURCING_REQUEST_POLICY_V1.currency;
  #sourcingRequestBusy = false;
  #sourcingRequestEpoch = 0;

  constructor(root: HTMLElement, options: DesignerRouteOptions) {
    this.#root = root;
    this.#options = options;
  }

  mount(): void {
    try {
      const restored = parseDesignerShareState(window.location.hash);
      if (restored.kind === "request") {
        const restoredRequest = restored.request;
        const adapter = this.#options.applications.find((entry) => (
          entry.application === restoredRequest.request.application && entry.status === "ready"
        ));
        if (!adapter) throw new Error("Shared electrical requirements do not have a matching ready application context.");
        this.#adapter = adapter;
        this.#request = restoredRequest.request;
        this.#customizationInstruction = restored.customization;
        this.#selectedPresetId = undefined;
        this.#stage = "requirements";
        this.#message = restored.customization === undefined
          ? "Restored exact canonical V2 requirements as untrusted input. Review them and press Generate design to use the installed production context."
          : "Restored exact requirements plus an inert customization instruction. Review them and explicitly regenerate the source before target policy evaluation.";
      } else if (restored.kind === "result") {
        this.#imported = restored.result.imported;
        this.#selectedImportedCandidateId = restored.result.selectedCandidateId
          ?? restored.result.imported.result.candidates[0]?.id;
        this.#selectedImportedScenarioId = restored.result.selectedScenarioId;
        this.#stage = "imported";
        this.#message = restored.result.imported.result.schemaVersion === 2
          ? "Restored a strictly validated electrical result share. It remains structural-only until you explicitly regenerate it with the installed production context."
          : "Restored a strictly validated electrical result share. It remains audit-only.";
      } else {
        this.#render();
        return;
      }
    } catch (error) {
      this.#message = error instanceof Error ? error.message : "Shared design result failed strict validation.";
    }
    this.#render();
    if (this.#stage === "requirements" && this.#selectedPresetId === undefined) {
      this.#root.querySelector<HTMLElement>("#designer-requirements-title")?.focus();
    }
  }

  async #regenerateImportedProductionResult(): Promise<void> {
    const imported = this.#imported;
    if (
      imported === undefined
      || imported.result.schemaVersion !== 2
      || importedHasVerifiedProductionContext(imported)
      || this.#importedDemonstration !== undefined
      || this.#busy
    ) return;
    const adapter = this.#options.applications.find((entry) => (
      entry.application === imported.result.request.application && entry.status === "ready"
    ));
    if (!adapter) return;
    const operationEpoch = ++this.#operationEpoch;
    this.#busy = true;
    this.#message = "Explicitly regenerating the persisted electrical result with the installed production context…";
    this.#render();
    let regeneratedSuccessfully = false;
    try {
      const generated = await adapter.generate(structuredClone(imported.result.request));
      if (operationEpoch !== this.#operationEpoch || this.#imported !== imported || this.#stage !== "imported") return;
      const generation = verifiedProductionGeneration(generated, adapter);
      const regenerated = generation.result;
      if (serializeDesignResultV2(regenerated) !== serializeDesignResultV2(imported.result)) {
        this.#message = "The persisted result is structurally valid, but it does not exactly match the installed production context.";
        this.#render();
        return;
      }
      this.#adapter = adapter;
      this.#request = regenerated.request;
      this.#selectedPresetId = undefined;
      this.#imported = importedProductionGeneration(generation);
      this.#productionGeneration = generation;
      this.#message = generation.kind === "production_constraint_observation"
        ? `Persisted structural observations explicitly regenerated; the installed production policy marks ${generation.constraintDecision.eligibleCandidateIds.length} eligible.`
        : "Persisted result explicitly regenerated from the installed bundled production context. Unknown evidence remains unknown.";
      regeneratedSuccessfully = true;
    } catch (error) {
      if (operationEpoch !== this.#operationEpoch || this.#imported !== imported || this.#stage !== "imported") return;
      this.#message = error instanceof Error
        ? `The persisted result remains structural-only. ${error.message}`
        : "The persisted result remains structural-only because exact production regeneration was unavailable.";
    } finally {
      if (operationEpoch === this.#operationEpoch) {
        this.#busy = false;
        this.#render();
        if (regeneratedSuccessfully) void this.#prepareCustomizationTargets("customization");
        else this.#root.querySelector<HTMLButtonElement>("[data-imported-regenerate-production]")?.focus();
      }
    }
  }

  async #inspectEvidenceLimitedPowerDesign(): Promise<void> {
    const source = this.#productionGeneration;
    const imported = this.#imported;
    const adapter = this.#adapter;
    const requestSource = this.#request;
    if (
      this.#stage !== "imported"
      || this.#busy
      || this.#importedDemonstration !== undefined
      || source === undefined
      || adapter === undefined
      || imported === undefined
      || !importedHasVerifiedProductionContext(imported)
      || imported.result !== source.result
      || requestSource === undefined
      || requestSource.schemaVersion !== 2
      || serializeElectricalDesignRequestV2(requestSource) !== serializeElectricalDesignRequestV2(source.result.request)
      || !isAuthorizedStrictPowerInspectionSource(source, adapter)
    ) return;

    const sourceRequestBytes = serializeElectricalDesignRequestV2(source.result.request);
    const expectedRecipeId = source.result.rejectedCandidates[0]!.recipeId;
    const inspectionRequest = clonePowerEvidenceInspectionRequest(source.result.request);
    const expandedInspectionGates = [
      ...(source.result.request.constraints.allowUnknownHardConstraints ? [] : ["allowUnknownHardConstraints"]),
      ...(source.result.request.constraints.allowEstimatedValues ? [] : ["allowEstimatedValues"]),
      ...(source.result.request.constraints.allowUnknownWarnings ? [] : ["allowUnknownWarnings"]),
    ];
    const inspectionRequestBytes = serializeElectricalDesignRequestV2(inspectionRequest);
    const operationEpoch = ++this.#operationEpoch;
    this.#busy = true;
    this.#message = "Regenerating the exact Power request for evidence-limited inspection. Unknown remains unknown.";
    this.#render();
    let inspectedSuccessfully = false;
    try {
      const generated = await adapter.generate(inspectionRequest);
      if (
        operationEpoch !== this.#operationEpoch
        || this.#stage !== "imported"
        || this.#productionGeneration !== source
        || this.#imported !== imported
        || this.#adapter !== adapter
        || this.#request !== requestSource
        || this.#importedDemonstration !== undefined
      ) return;
      if (!("kind" in generated)) {
        throw new Error("Installed Power inspection did not return an authorized production observation");
      }
      const generation = verifiedProductionGeneration(generated, adapter);
      const candidate = generation.result.candidates[0];
      const policyCandidate = generation.kind === "production_constraint_observation"
        ? generation.constraintDecision.candidates[0]
        : undefined;
      if (
        serializeElectricalDesignRequestV2(source.result.request) !== sourceRequestBytes
        || serializeElectricalDesignRequestV2(generation.result.request) !== inspectionRequestBytes
        || generation.kind !== "production_constraint_observation"
        || generation.result.candidates.length !== 1
        || generation.result.rejectedCandidates.length !== 0
        || candidate === undefined
        || candidate.recipeId !== expectedRecipeId
        || candidate.constraints.some((constraint) => constraint.status === "fail")
        || !candidate.constraints.some((constraint) => constraint.status === "unknown")
        || generation.constraintDecision.eligibleCandidateIds.length !== 0
        || generation.constraintDecision.candidates.length !== 1
        || policyCandidate?.candidateId !== candidate.id
        || policyCandidate.eligible
      ) throw new Error("Installed Power inspection did not preserve the exact unknown-only evidence boundary");

      this.#clearProductionSchematicPreview();
      this.#invalidateProductionSource();
      this.#productionGeneration = generation;
      this.#request = generation.result.request;
      this.#imported = importedProductionGeneration(generation);
      this.#selectedImportedCandidateId = candidate.id;
      this.#selectedImportedScenarioId = undefined;
      this.#pinnedImportedCandidateIds.clear();
      this.#message = expandedInspectionGates.length === 1 && expandedInspectionGates[0] === "allowUnknownHardConstraints"
        ? "Inspected one exact evidence-limited Power design after changing only allowUnknownHardConstraints to true. The installed policy marks 0 eligible; unknown ≠ pass."
        : `Inspected one exact evidence-limited Power design after enabling ${expandedInspectionGates.join(" and ")}. The installed policy marks 0 eligible; estimates remain estimated and unknown ≠ pass.`;
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      this.#deferCustomizationTargetDiscovery(generation, adapter, candidate.id, "customization");
      inspectedSuccessfully = true;
    } catch (error) {
      if (
        operationEpoch !== this.#operationEpoch
        || this.#stage !== "imported"
        || this.#productionGeneration !== source
        || this.#imported !== imported
        || this.#adapter !== adapter
        || this.#request !== requestSource
      ) return;
      this.#message = error instanceof Error
        ? error.message
        : "Evidence-limited Power inspection was unavailable.";
    } finally {
      if (operationEpoch === this.#operationEpoch) {
        this.#busy = false;
        this.#render();
        this.#root.querySelector<HTMLElement>(
          inspectedSuccessfully ? "#designer-results-title" : "#designer-empty-title",
        )?.focus();
      }
    }
  }

  #render(): void {
    this.#designerSimulationViewerDisposer?.();
    this.#designerSimulationViewerDisposer = undefined;
    const simulatorPath = this.#options.simulatorPath ?? "/";
    const previewTarget = this.#productionSchematicPreviewTarget();
    const schematicPreview: Readonly<ProductionSchematicPreview> | undefined = previewTarget === undefined
      ? undefined
      : this.#productionSchematicPreview?.key === previewTarget.key
        ? this.#productionSchematicPreview
        : { status: "loading" };
    const simulationTarget = this.#designerSimulationTarget();
    const simulationState = simulationTarget !== undefined
      && this.#designerSimulationState?.key === simulationTarget.key
        ? this.#designerSimulationState
        : undefined;
    const selectedProductionCandidate = this.#productionGeneration?.result.candidates.find((candidate) => (
      candidate.id === this.#selectedImportedCandidateId
    ));
    const productionRegenerationAvailable = this.#stage === "imported"
      && this.#imported !== undefined
      && this.#imported.result.schemaVersion === 2
      && !importedHasVerifiedProductionContext(this.#imported)
      && this.#importedDemonstration === undefined
      && this.#options.applications.some((entry) => (
        entry.application === this.#imported?.result.request.application && entry.status === "ready"
      ));
    const customizationMarkup = this.#adapter?.primaryPartCustomization !== undefined
      && this.#productionGeneration !== undefined
      && selectedProductionCandidate !== undefined
      && this.#importedDemonstration === undefined
        ? renderPrimaryPartCustomization({
            sourceCandidate: selectedProductionCandidate,
            targets: this.#customizationTargets,
            ...(this.#customizationInstruction === undefined
              ? {}
              : { instruction: this.#customizationInstruction }),
            ...(this.#customizedResult === undefined ? {} : { customizedResult: this.#customizedResult }),
            phase: this.#customizationPhase,
            ...(this.#customizationExportKind === undefined
              ? {}
              : { exportingArtifact: this.#customizationExportKind }),
          })
        : "";
    const sourcingRequestMarkup = this.#adapter?.sourcingRequestPacket !== undefined
      && this.#productionGeneration !== undefined
      && selectedProductionCandidate !== undefined
      && this.#importedDemonstration === undefined
        ? renderSourcingRequestTransferV1({
            candidateId: selectedProductionCandidate.id,
            buildQuantity: this.#sourcingRequestBuildQuantity,
            region: this.#sourcingRequestRegion,
            currency: this.#sourcingRequestCurrency,
            busy: this.#sourcingRequestBusy,
          })
        : "";
    const referenceDesignEvidenceMarkup = this.#productionGeneration !== undefined
      && this.#adapter?.application === "power.buck"
      && this.#imported?.result === this.#productionGeneration.result
      && this.#adapter.authorizesProductionGeneration?.(this.#productionGeneration) === true
      ? renderPowerReferenceEvidence(this.#productionGeneration.referenceDesignEvidence)
      : "";
    const evidenceLimitedPowerInspectionAvailable = this.#stage === "imported"
      && this.#importedDemonstration === undefined
      && importedHasVerifiedProductionContext(this.#imported)
      && this.#imported.result === this.#productionGeneration?.result
      && isAuthorizedStrictPowerInspectionSource(this.#productionGeneration, this.#adapter);
    const powerPhysicalHandoffConnected = this.#adapter?.application === "power.buck"
      && this.#adapter.exportProductionArtifact !== undefined
      && this.#adapter.productionArtifactKinds?.includes("physical_handoff_json") === true;
    const content = this.#stage === "applications"
      ? applicationChooser(this.#options.applications, this.#message, this.#loadingDemonstrationId)
      : this.#stage === "requirements" && this.#adapter && this.#request
        ? renderRequirementsForm(this.#adapter, this.#request, this.#adapter.parameterForm.validate(this.#request), this.#busy, this.#selectedPresetId, this.#message, this.#customizationInstruction)
        : this.#stage === "imported" && this.#imported
          ? renderImportedResult(
            this.#imported,
            this.#selectedImportedCandidateId,
            this.#message,
            this.#selectedImportedScenarioId,
            this.#importedDemonstration,
            this.#adapter?.application === this.#imported.result.request.application
              && this.#adapter.exportProductionArtifact !== undefined,
            schematicPreview,
            this.#pinnedImportedCandidateIds,
            customizationMarkup,
            productionRegenerationAvailable,
            productionRegenerationAvailable && this.#busy,
            sourcingRequestMarkup,
            referenceDesignEvidenceMarkup,
            evidenceLimitedPowerInspectionAvailable,
            evidenceLimitedPowerInspectionAvailable && this.#busy,
            powerPhysicalHandoffConnected,
            this.#workspaceTab,
            this.#solutionFilter,
            this.#solutionObjective,
            simulationState,
          )
        : this.#result
          ? resultsMarkup(
            this.#result,
            this.#result.candidates.find((candidate) => candidate.id === this.#selectedCandidateId),
            this.#pinnedCandidateIds,
            this.#options.offerSnapshots,
            simulatorPath,
            this.#message,
          )
          : applicationChooser(this.#options.applications, this.#message, this.#loadingDemonstrationId);
    const activeStep = this.#stage === "applications" || this.#stage === "requirements"
      ? 1
      : this.#stage === "imported" && this.#selectedImportedCandidateId !== undefined
        ? 3
        : 2;
    const stepItem = (number: number, label: string) => `<li${activeStep === number ? " aria-current=\"step\"" : ""}${activeStep > number ? " data-complete=\"true\"" : ""}><span>${String(number).padStart(2, "0")}</span><strong>${label}</strong></li>`;
    this.#root.innerHTML = `<main class="designer-shell"><header class="designer-chrome"><a class="designer-wordmark" href="/designer">scheMAGIC <span>Designer</span></a><nav aria-label="Product"><a aria-current="page" href="/designer">Designer</a><a href="${escapeHtml(simulatorPath)}">Simulator</a></nav><span class="designer-local-state"><i></i>RELEASE CANDIDATE</span></header><div class="designer-frame"><nav class="designer-flow-rail" aria-label="Design progress"><ol>${stepItem(1, "Requirements")}${stepItem(2, "Solutions")}${stepItem(3, "Design")}</ol></nav><div class="designer-route">${content}</div></div></main>`;
    this.#bind();
    this.#mountDesignerSimulation();
    void this.#ensureProductionSchematicPreview();
  }

  #announceSolutionVisibility(): void {
    const rows = [...this.#root.querySelectorAll<HTMLTableRowElement>("[data-designer-solution-row]")];
    const announcer = this.#root.querySelector<HTMLElement>("[data-designer-solution-announcement]");
    if (!announcer || rows.length === 0) return;
    const visibleCount = rows.filter((row) => !row.hidden).length;
    const filterLabel = this.#solutionFilter === "eligible"
      ? "Eligible filter"
      : this.#solutionFilter === "pinned"
        ? "Pinned filter"
        : "All solutions filter";
    const announcement = `${visibleCount} of ${rows.length} solutions shown. ${filterLabel}.`;
    announcer.textContent = "";
    queueMicrotask(() => {
      if (this.#root.contains(announcer)) announcer.textContent = announcement;
    });
  }

  #renderPreservingFocusedResultHeading(): void {
    const activeElement = document.activeElement;
    const focusedHeadingId = activeElement instanceof HTMLElement
      && this.#root.contains(activeElement)
      && (activeElement.id === "designer-results-title" || activeElement.id === "designer-customization-title")
        ? activeElement.id
        : undefined;
    this.#render();
    if (focusedHeadingId !== undefined) {
      this.#root.querySelector<HTMLElement>(`#${focusedHeadingId}`)?.focus();
    }
  }

  #productionSchematicPreviewTarget() {
    const imported = this.#imported;
    const adapter = this.#adapter;
    if (
      this.#stage !== "imported"
      || !importedHasVerifiedProductionContext(imported)
      || adapter?.application !== imported.result.request.application
      || adapter.exportProductionArtifact === undefined
      || !this.#selectedImportedCandidateId
    ) return undefined;
    const candidate = imported.result.candidates.find((entry) => entry.id === this.#selectedImportedCandidateId);
    if (!candidate) return undefined;
    const constraintDecision = imported.trust === "production_constraint_observation"
      ? this.#authorizedDisplayedObservationDecision(imported, adapter)
      : undefined;
    if (imported.trust === "production_constraint_observation" && constraintDecision === undefined) return undefined;
    return {
      key: `${imported.result.contentHash}:${candidate.id}:${constraintDecision?.contentHash ?? "ordinary-v2"}`,
      imported,
      adapter,
      candidate,
      constraintDecision,
    } as const;
  }

  #designerSimulationTarget() {
    const target = this.#productionSchematicPreviewTarget();
    const source = this.#productionGeneration;
    if (
      target === undefined
      || target.imported.result.schemaVersion !== 2
      || target.candidate.schemaVersion !== 2
      || source === undefined
      || source.result !== target.imported.result
      || source.application !== target.adapter.application
      || target.adapter.authorizesProductionGeneration?.(source) !== true
      || target.adapter.exportProductionArtifact === undefined
      || target.adapter.productionArtifactKinds?.includes("scenario_spice") !== true
    ) return undefined;
    const plan = planDesignResultScenarioExportsV2(target.imported.result, target.candidate.id);
    const entry = plan.entries.find((candidate) => candidate.scenarioId === this.#selectedImportedScenarioId)
      ?? plan.entries.find((candidate) => candidate.isDefaultScenario)
      ?? plan.entries[0];
    if (
      entry === undefined
      || entry.coverageTier !== "behavioral"
      || entry.spiceExportGate !== "export_requires_verified_context"
      || (entry.analysisMode !== "op" && entry.analysisMode !== "tran" && entry.analysisMode !== "ac")
    ) return undefined;
    const scenario = target.candidate.circuit.scenarios.find((candidate) => candidate.id === entry.scenarioId);
    if (scenario === undefined || scenario.config.mode !== entry.analysisMode) return undefined;
    return {
      ...target,
      source,
      scenario,
      analysisMode: entry.analysisMode,
      key: `${target.key}:${entry.scenarioId}`,
    } as const;
  }

  #clearDesignerSimulation(disposeRunner = false): void {
    this.#designerSimulationEpoch += 1;
    this.#designerSimulationViewerDisposer?.();
    this.#designerSimulationViewerDisposer = undefined;
    if (this.#designerSimulationState?.status === "running") this.#designerSimulationRunner?.cancel();
    if (disposeRunner) {
      this.#designerSimulationRunner?.dispose();
      this.#designerSimulationRunner = undefined;
    }
    this.#designerSimulationState = undefined;
    this.#designerSimulationExecution = undefined;
  }

  #mountDesignerSimulation(): void {
    this.#designerSimulationViewerDisposer?.();
    this.#designerSimulationViewerDisposer = undefined;
    const target = this.#designerSimulationTarget();
    const host = this.#root.querySelector<HTMLElement>("[data-designer-simulation-host]");
    if (
      target === undefined
      || host === null
      || this.#designerSimulationState?.key !== target.key
      || this.#designerSimulationState.status !== "ready"
      || this.#designerSimulationExecution?.key !== target.key
      || this.#designerSimulationRuntime === undefined
    ) return;
    this.#designerSimulationViewerDisposer = this.#designerSimulationRuntime.mountDesignerSimulation(
      host,
      this.#designerSimulationExecution,
    );
  }

  async #runDesignerSimulation(button: HTMLButtonElement): Promise<void> {
    const target = this.#designerSimulationTarget();
    if (target === undefined || button.dataset.designerSimulationScenario !== target.scenario.id) return;
    const simulationEpoch = ++this.#designerSimulationEpoch;
    this.#designerSimulationViewerDisposer?.();
    this.#designerSimulationViewerDisposer = undefined;
    this.#designerSimulationExecution = undefined;
    this.#designerSimulationState = {
      key: target.key,
      status: "running",
      message: `Starting ${target.analysisMode.toUpperCase()} analysis`,
    };
    this.#render();
    try {
      const artifact = await target.adapter.exportProductionArtifact!({
        result: target.imported.result,
        candidateId: target.candidate.id,
        kind: "scenario_spice",
        scenarioId: target.scenario.id,
      });
      const exportedTarget = this.#designerSimulationTarget();
      if (
        simulationEpoch !== this.#designerSimulationEpoch
        || exportedTarget?.key !== target.key
        || exportedTarget.imported !== target.imported
        || exportedTarget.adapter !== target.adapter
      ) return;
      if (
        artifact.kind !== "scenario_spice"
        || artifact.mimeType !== "text/x-spice;charset=utf-8"
        || !artifact.filename.endsWith("-behavioral.cir")
        || !artifact.content.includes(target.imported.result.contentHash)
        || !artifact.content.includes(target.candidate.id)
        || !artifact.content.includes(`scenario-id ${target.scenario.id}`)
      ) throw new Error("Application adapter returned a context-mismatched behavioral scenario deck");
      const runtime = this.#designerSimulationRuntime ?? await import("./DesignerSimulationRuntime");
      if (simulationEpoch !== this.#designerSimulationEpoch || this.#designerSimulationTarget()?.key !== target.key) return;
      this.#designerSimulationRuntime = runtime;
      const runner = this.#designerSimulationRunner ?? new runtime.DesignerSimulationRunner();
      this.#designerSimulationRunner = runner;
      const execution = await runner.run({
        key: target.key,
        netlist: artifact.content,
        circuit: target.candidate.circuit,
        scenarioId: target.scenario.id,
      });
      if (simulationEpoch !== this.#designerSimulationEpoch || this.#designerSimulationTarget()?.key !== target.key) return;
      this.#designerSimulationExecution = execution;
      this.#designerSimulationState = {
        key: target.key,
        status: "ready",
        analysisMode: target.analysisMode,
        engine: execution.ready.engine,
        elapsedMs: execution.result.elapsedMs,
        vectorCount: execution.result.receipt.vectorCount,
        scalarSampleCount: execution.result.receipt.scalarSampleCount,
        receiptContentHash: execution.result.receipt.contentHash,
      };
    } catch (error) {
      if (simulationEpoch !== this.#designerSimulationEpoch || this.#designerSimulationTarget()?.key !== target.key) return;
      this.#designerSimulationExecution = undefined;
      this.#designerSimulationState = {
        key: target.key,
        status: "error",
        message: error instanceof Error ? error.message : "The local behavioral simulation failed.",
      };
    }
    if (simulationEpoch === this.#designerSimulationEpoch) {
      this.#render();
      this.#root.querySelector<HTMLButtonElement>("[data-designer-run-simulation]")?.focus();
    }
  }

  #cancelDesignerSimulation(): void {
    const target = this.#designerSimulationTarget();
    if (target === undefined || this.#designerSimulationState?.status !== "running") return;
    this.#designerSimulationEpoch += 1;
    this.#designerSimulationRunner?.cancel();
    this.#designerSimulationExecution = undefined;
    this.#designerSimulationState = { key: target.key, status: "idle" };
    this.#render();
    this.#root.querySelector<HTMLButtonElement>("[data-designer-run-simulation]")?.focus();
  }

  #authorizedDisplayedObservationDecision(
    imported: Extract<ImportedDesignResult, { trust: "production_constraint_observation" }>,
    adapter: Readonly<DesignerApplicationAdapter>,
  ) {
    const source = this.#productionGeneration;
    if (source?.kind !== "production_constraint_observation"
      || source.result !== imported.result
      || source.constraintDecision !== imported.constraintDecision
      || source.application !== adapter.application
      || adapter.authorizesProductionGeneration?.(source) !== true) return undefined;
    return imported.constraintDecision;
  }

  #clearProductionSchematicPreview(): void {
    this.#schematicPreviewEpoch += 1;
    if (this.#productionSchematicPreview?.status === "ready") {
      URL.revokeObjectURL(this.#productionSchematicPreview.url);
    }
    this.#productionSchematicPreview = undefined;
  }

  async #ensureProductionSchematicPreview(): Promise<void> {
    const target = this.#productionSchematicPreviewTarget();
    if (target === undefined) {
      if (this.#productionSchematicPreview !== undefined) this.#clearProductionSchematicPreview();
      return;
    }
    if (this.#productionSchematicPreview?.key === target.key) return;
    this.#clearProductionSchematicPreview();
    const previewEpoch = ++this.#schematicPreviewEpoch;
    this.#productionSchematicPreview = { key: target.key, status: "loading" };
    let preparedUrl: string | undefined;
    try {
      const artifact = await target.adapter.exportProductionArtifact!({
        result: target.imported.result,
        candidateId: target.candidate.id,
        kind: "structural_svg",
        ...(target.constraintDecision === undefined
          ? {}
          : { constraintDecision: target.constraintDecision }),
      });
      const currentTarget = this.#productionSchematicPreviewTarget();
      if (
        previewEpoch !== this.#schematicPreviewEpoch
        || currentTarget?.key !== target.key
        || currentTarget.imported !== target.imported
        || currentTarget.adapter !== target.adapter
      ) return;
      if (
        artifact.kind !== "structural_svg"
        || !artifact.mimeType.startsWith("image/svg+xml")
        || !artifact.filename.endsWith(".svg")
        || typeof artifact.content !== "string"
      ) throw new Error("Application adapter returned a context-mismatched schematic preview");
      if (target.constraintDecision !== undefined) {
        const policyCandidate = target.constraintDecision.candidates.find(
          (entry) => entry.candidateId === target.candidate.id,
        );
        const blockedRuleIds = policyCandidate?.rules
          .filter((rule) => rule.disposition === "blocked_failure" || rule.disposition === "blocked_unknown")
          .map((rule) => rule.ruleId) ?? [];
        if (policyCandidate === undefined || [
          target.imported.result.contentHash,
          target.candidate.id,
          target.constraintDecision.contentHash,
          target.constraintDecision.policy.contentHash,
          ...blockedRuleIds,
        ].some((identity) => !artifact.content.includes(identity))) {
          throw new Error("Application adapter returned a policy-detached observation preview");
        }
      }
      const previewContent = circuitOnlyStructuralSvgPreview(artifact.content);
      preparedUrl = URL.createObjectURL(new Blob([previewContent], { type: artifact.mimeType }));
      const decodedPreview = new Image();
      try {
        if (typeof decodedPreview.decode === "function") {
          decodedPreview.src = preparedUrl;
          await decodedPreview.decode();
        }
        else await new Promise<void>((resolve, reject) => {
          decodedPreview.addEventListener("load", () => resolve(), { once: true });
          decodedPreview.addEventListener("error", () => reject(new Error("decode failed")), { once: true });
          decodedPreview.src = preparedUrl!;
        });
        if (decodedPreview.naturalWidth <= 0) throw new Error("decode produced no pixels");
      } catch {
        throw new Error("Exact structural preview could not be decoded.");
      }
      const decodedTarget = this.#productionSchematicPreviewTarget();
      if (
        previewEpoch !== this.#schematicPreviewEpoch
        || decodedTarget?.key !== target.key
        || decodedTarget.imported !== target.imported
        || decodedTarget.adapter !== target.adapter
      ) {
        URL.revokeObjectURL(preparedUrl);
        preparedUrl = undefined;
        return;
      }
      const url = preparedUrl;
      preparedUrl = undefined;
      this.#productionSchematicPreview = {
        key: target.key,
        status: "ready",
        url,
        filename: artifact.filename,
      };
      this.#renderPreservingFocusedResultHeading();
      void this.#releaseDeferredCustomizationTargetDiscovery(target.key, true);
    } catch (error) {
      if (preparedUrl !== undefined) URL.revokeObjectURL(preparedUrl);
      if (previewEpoch !== this.#schematicPreviewEpoch) return;
      this.#productionSchematicPreview = {
        key: target.key,
        status: "error",
        message: error instanceof Error ? error.message : "Exact structural preview could not be generated.",
      };
      this.#renderPreservingFocusedResultHeading();
      void this.#releaseDeferredCustomizationTargetDiscovery(target.key, false);
    }
  }

  #deferCustomizationTargetDiscovery(
    source: DesignerProductionGenerationV2,
    adapter: DesignerApplicationAdapter,
    candidateId: string,
    focusAfter?: "candidate" | "customization",
  ): void {
    const target = this.#productionSchematicPreviewTarget();
    if (
      target === undefined
      || target.imported.result !== source.result
      || target.adapter !== adapter
      || target.candidate.id !== candidateId
    ) return;
    this.#customizationPhase = "loading_targets";
    this.#deferredCustomizationTargetDiscovery = {
      source,
      adapter,
      candidateId,
      customizationEpoch: this.#customizationEpoch,
      previewKey: target.key,
      ...(focusAfter === undefined ? {} : { focusAfter }),
    };
  }

  async #releaseDeferredCustomizationTargetDiscovery(previewKey: string, previewReady: boolean): Promise<void> {
    const discovery = this.#deferredCustomizationTargetDiscovery;
    if (discovery === undefined || discovery.previewKey !== previewKey) return;
    if (!previewReady) {
      this.#deferredCustomizationTargetDiscovery = undefined;
      this.#customizationPhase = "targets_unavailable";
      this.#customizationTargets = [];
      this.#renderPreservingFocusedResultHeading();
      return;
    }
    if (this.#deferredCustomizationTargetDiscovery !== discovery) return;
    if (
      discovery.customizationEpoch !== this.#customizationEpoch
      || this.#productionGeneration !== discovery.source
      || this.#adapter !== discovery.adapter
      || this.#selectedImportedCandidateId !== discovery.candidateId
      || this.#productionSchematicPreviewTarget()?.key !== discovery.previewKey
    ) {
      this.#deferredCustomizationTargetDiscovery = undefined;
      return;
    }
    this.#deferredCustomizationTargetDiscovery = undefined;
    await this.#prepareCustomizationTargets(discovery.focusAfter, true);
  }

  #invalidateProductionSource(clearInstruction = true): void {
    this.#clearDesignerSimulation(true);
    this.#sourcingRequestEpoch += 1;
    this.#sourcingRequestBusy = false;
    this.#customizationEpoch += 1;
    this.#customizationPhase = "idle";
    this.#customizationExportKind = undefined;
    this.#deferredCustomizationTargetDiscovery = undefined;
    this.#productionGeneration = undefined;
    this.#customizationTargets = [];
    this.#customizedResult = undefined;
    if (clearInstruction) this.#customizationInstruction = undefined;
  }

  #resetCustomization(): void {
    this.#operationEpoch += 1;
    this.#busy = false;
    this.#customizationEpoch += 1;
    this.#customizationPhase = "idle";
    this.#customizationExportKind = undefined;
    this.#customizationInstruction = undefined;
    this.#customizedResult = undefined;
    window.history.replaceState(null, "", clearPrimaryPartCustomizationShareFromUrl());
  }

  async #prepareCustomizationTargets(
    focusAfter?: "candidate" | "customization",
    loadingStateAlreadyRendered = false,
  ): Promise<void> {
    const source = this.#productionGeneration;
    const adapter = this.#adapter;
    const candidateId = this.#selectedImportedCandidateId;
    const customization = adapter?.primaryPartCustomization;
    const candidate = source?.result.candidates.find((entry) => entry.id === candidateId);
    if (
      source === undefined
      || customization === undefined
      || candidateId === undefined
      || candidate === undefined
    ) {
      this.#customizationTargets = [];
      return;
    }
    const previewTarget = this.#productionSchematicPreviewTarget();
    if (
      previewTarget !== undefined
      && previewTarget.imported.result === source.result
      && previewTarget.adapter === adapter
      && previewTarget.candidate.id === candidateId
    ) {
      const preview = this.#productionSchematicPreview;
      if (preview?.key !== previewTarget.key || preview.status === "loading") {
        this.#deferCustomizationTargetDiscovery(source, adapter, candidateId, focusAfter);
        this.#render();
        return;
      }
      if (preview.status === "error") {
        this.#deferredCustomizationTargetDiscovery = undefined;
        this.#customizationTargets = [];
        this.#customizationPhase = "targets_unavailable";
        this.#render();
        return;
      }
    }
    const restoreFocus = (): void => {
      if (focusAfter === "candidate") {
        [...this.#root.querySelectorAll<HTMLButtonElement>("[data-imported-candidate]")]
          .find((button) => button.dataset.importedCandidate === candidateId)
          ?.focus();
      } else if (focusAfter === "customization") {
        this.#root.querySelector<HTMLElement>("#designer-customization-title")?.focus();
      }
    };
    const epoch = ++this.#customizationEpoch;
    this.#customizationExportKind = undefined;
    this.#customizationPhase = "loading_targets";
    if (!loadingStateAlreadyRendered) this.#render();
    restoreFocus();
    try {
      const targets = await customization.listTargets(source, candidate.id);
      if (
        epoch !== this.#customizationEpoch
        || this.#productionGeneration !== source
        || this.#adapter !== adapter
        || this.#selectedImportedCandidateId !== candidateId
      ) return;
      this.#customizationTargets = targets;
      if (
        this.#customizationInstruction !== undefined
        && (
          this.#customizationInstruction.sourceCandidateId !== candidateId
          || targets.every((target) => target.instruction.contentHash !== this.#customizationInstruction?.contentHash)
        )
      ) {
        this.#customizationInstruction = undefined;
        this.#customizedResult = undefined;
        window.history.replaceState(null, "", clearPrimaryPartCustomizationShareFromUrl());
        this.#message = "The pending customization is not an exact compatible target for this generated candidate.";
      }
    } catch (error) {
      if (epoch !== this.#customizationEpoch) return;
      this.#customizationTargets = [];
      this.#message = error instanceof Error ? error.message : "Compatible primary-part targets could not be prepared.";
    } finally {
      if (epoch === this.#customizationEpoch) {
        this.#customizationPhase = "idle";
        this.#render();
        restoreFocus();
      }
    }
  }

  async #applyCustomization(): Promise<void> {
    const source = this.#productionGeneration;
    const adapter = this.#adapter;
    const customization = adapter?.primaryPartCustomization;
    const instruction = this.#customizationInstruction;
    if (
      source === undefined
      || adapter === undefined
      || customization === undefined
      || instruction === undefined
      || this.#customizationPhase !== "idle"
      || instruction.sourceCandidateId !== this.#selectedImportedCandidateId
    ) return;
    const ordinaryBytes = serializeDesignResultV2(source.result);
    const epoch = ++this.#customizationEpoch;
    this.#customizationExportKind = undefined;
    this.#customizationPhase = "evaluating";
    this.#message = undefined;
    this.#render();
    try {
      const customized = await customization.generate(source, instruction);
      if (
        epoch !== this.#customizationEpoch
        || this.#productionGeneration !== source
        || this.#adapter !== adapter
        || this.#customizationInstruction !== instruction
      ) return;
      if (
        customization.authorizesCustomizedResult(customized, source) !== true
        || customized.instruction.contentHash !== instruction.contentHash
        || customized.source.resultContentHash !== source.result.contentHash
        || customized.source.candidateId !== instruction.sourceCandidateId
        || customized.targetResultProjection.request.application !== adapter.application
        || serializeDesignResultV2(source.result) !== ordinaryBytes
      ) throw new Error("Application adapter returned a context-mismatched customized result");
      this.#customizedResult = customized;
      const policyCandidate = customized.constraintDecision.candidates[0];
      this.#message = policyCandidate?.eligible
        ? "Exact target regenerated and evaluated as eligible under the installed V3 policy. Ordinary ranking and ordinary-result exports remain unchanged."
        : "Exact target regenerated and evaluated as ineligible under the installed V3 policy. Ordinary ranking and ordinary-result exports remain unchanged.";
    } catch (error) {
      if (epoch !== this.#customizationEpoch) return;
      this.#customizedResult = undefined;
      this.#message = error instanceof Error ? error.message : "Primary-part customization was rejected.";
    } finally {
      if (epoch === this.#customizationEpoch) {
        this.#customizationPhase = "idle";
        this.#render();
        this.#root.querySelector<HTMLElement>(
          this.#customizedResult === undefined
            ? "#designer-customization-title"
            : "#designer-customization-result-title",
        )?.focus();
      }
    }
  }

  async #importCustomizationFile(file: File): Promise<void> {
    const request = this.#request;
    if (request?.schemaVersion !== 2) return;
    this.#operationEpoch += 1;
    this.#busy = false;
    if (file.size > PRIMARY_PART_CUSTOMIZATION_MAX_BYTES) {
      this.#message = "Primary-part customization exceeds the supported transfer limits.";
      this.#render();
      this.#root.querySelector<HTMLElement>(
        this.#stage === "requirements" ? "#designer-requirements-title" : "#designer-customization-title",
      )?.focus();
      return;
    }
    const epoch = ++this.#customizationEpoch;
    this.#customizationExportKind = undefined;
    this.#customizationPhase = "importing";
    this.#render();
    let refreshTargets = false;
    try {
      const transferred = parsePrimaryPartCustomizationFileV1Bytes(
        new Uint8Array(await file.arrayBuffer()),
      );
      if (epoch !== this.#customizationEpoch || this.#request !== request) return;
      assertPrimaryPartCustomizationRequestBinding(transferred.sidecar, request);
      if (
        this.#productionGeneration !== undefined
        && (
          transferred.sidecar.sourceResultContentHash !== this.#productionGeneration.result.contentHash
          || this.#productionGeneration.result.candidates.every((candidate) => (
            candidate.id !== transferred.sidecar.sourceCandidateId
          ))
        )
      ) throw new Error("Customization instruction does not bind to this exact generated source result.");
      this.#customizationInstruction = transferred.sidecar;
      this.#customizedResult = undefined;
      if (this.#productionGeneration !== undefined) {
        const candidateChanged = this.#selectedImportedCandidateId !== transferred.sidecar.sourceCandidateId;
        this.#selectedImportedCandidateId = transferred.sidecar.sourceCandidateId;
        this.#customizationTargets = [];
        if (candidateChanged) this.#selectedImportedScenarioId = undefined;
        refreshTargets = true;
      }
      window.history.replaceState(null, "", clearPrimaryPartCustomizationShareFromUrl());
      this.#message = this.#productionGeneration === undefined
        ? "Loaded an inert customization instruction. Explicitly regenerate the source to evaluate its target."
        : "Loaded an exact customization instruction. Evaluate substitution to regenerate and evaluate its target.";
    } catch (error) {
      if (epoch !== this.#customizationEpoch) return;
      this.#message = error instanceof Error ? error.message : "Customization instruction failed strict validation.";
    } finally {
      if (epoch === this.#customizationEpoch) {
        this.#customizationPhase = "idle";
        this.#render();
        if (refreshTargets) void this.#prepareCustomizationTargets("customization");
        else this.#root.querySelector<HTMLElement>(
          this.#stage === "requirements" ? "#designer-requirements-title" : "#designer-customization-title",
        )?.focus();
      }
    }
  }

  async #importCustomizedTargetInspectionReceipt(file: File): Promise<void> {
    const source = this.#productionGeneration;
    const adapter = this.#adapter;
    const customization = adapter?.primaryPartCustomization;
    const request = this.#request;
    const candidateId = this.#selectedImportedCandidateId;
    const candidate = source?.result.candidates.find((entry) => entry.id === candidateId);
    if (
      source === undefined
      || adapter === undefined
      || customization === undefined
      || request === undefined
      || candidateId === undefined
      || candidate === undefined
      || this.#stage !== "imported"
      || this.#customizationPhase !== "idle"
      || this.#customizationExportKind !== undefined
    ) return;
    if (file.size > customization.inspectionReceiptMaxBytes) {
      this.#message = "Customized-target inspection receipt exceeds the supported transfer limits.";
      this.#render();
      this.#root.querySelector<HTMLElement>("#designer-customization-title")?.focus();
      return;
    }

    const ordinaryBytes = serializeDesignResultV2(source.result);
    const targets = this.#customizationTargets;
    const selectedInstruction = this.#customizationInstruction;
    const epoch = ++this.#customizationEpoch;
    this.#customizationPhase = "verifying_receipt";
    this.#message = undefined;
    this.#render();
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (
        epoch !== this.#customizationEpoch
        || this.#stage !== "imported"
        || this.#productionGeneration !== source
        || this.#adapter !== adapter
        || adapter.primaryPartCustomization !== customization
        || this.#request !== request
        || this.#selectedImportedCandidateId !== candidateId
        || this.#customizationTargets !== targets
        || this.#customizationInstruction !== selectedInstruction
      ) return;
      const restored = await customization.restoreInspectionReceipt(source, candidate.id, bytes);
      if (
        epoch !== this.#customizationEpoch
        || this.#stage !== "imported"
        || this.#productionGeneration !== source
        || this.#adapter !== adapter
        || adapter.primaryPartCustomization !== customization
        || this.#request !== request
        || this.#selectedImportedCandidateId !== candidateId
        || this.#customizationTargets !== targets
        || this.#customizationInstruction !== selectedInstruction
      ) return;
      const admittedTarget = targets.find((target) => (
        target.instruction.contentHash === restored.instruction.contentHash
      ));
      if (
        admittedTarget === undefined
        || (selectedInstruction !== undefined
          && selectedInstruction.contentHash !== restored.instruction.contentHash)
        || customization.authorizesCustomizedResult(restored, source) !== true
        || restored.source.resultContentHash !== source.result.contentHash
        || restored.source.candidateId !== candidate.id
        || restored.instruction.sourceCandidateId !== candidate.id
        || restored.instruction.contentHash !== admittedTarget.instruction.contentHash
        || restored.targetResultProjection.request.application !== adapter.application
        || serializeDesignResultV2(source.result) !== ordinaryBytes
      ) throw new Error("Inspection receipt did not reproduce an exact currently admitted target for this source");

      this.#customizationInstruction = restored.instruction;
      this.#customizedResult = restored;
      window.history.replaceState(null, "", clearPrimaryPartCustomizationShareFromUrl());
      const policyCandidate = restored.constraintDecision.candidates[0];
      this.#message = policyCandidate?.eligible
        ? "Inspection receipt replayed exactly and the target was re-evaluated as eligible under the installed V3 policy. The ordinary result remains unchanged."
        : "Inspection receipt replayed exactly and the target was re-evaluated as ineligible under the installed V3 policy. The ordinary result remains unchanged.";
    } catch (error) {
      if (epoch !== this.#customizationEpoch) return;
      this.#message = error instanceof Error
        ? error.message
        : "Customized-target inspection receipt failed exact installed-context replay.";
    } finally {
      if (epoch === this.#customizationEpoch) {
        this.#customizationPhase = "idle";
        this.#render();
        this.#root.querySelector<HTMLElement>(
          this.#customizedResult === undefined
            ? "#designer-customization-title"
            : "#designer-customization-result-title",
        )?.focus();
      }
    }
  }

  #bind(): void {
    const caveatDialog = this.#root.querySelector<HTMLDialogElement>("[data-designer-caveat-dialog]");
    let caveatDialogInvoker: HTMLButtonElement | undefined;
    const restoreCaveatDialogFocus = () => {
      const invoker = caveatDialogInvoker;
      caveatDialogInvoker = undefined;
      if (invoker?.isConnected && this.#root.contains(invoker)) invoker.focus();
    };
    const closeCaveatDialog = () => {
      if (!caveatDialog) return;
      if (typeof caveatDialog.close === "function") caveatDialog.close();
      else {
        caveatDialog.removeAttribute("open");
        restoreCaveatDialogFocus();
      }
    };
    this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-caveats]").forEach((button) => button.addEventListener("click", () => {
      if (!caveatDialog) return;
      caveatDialogInvoker = button;
      if (typeof caveatDialog.showModal === "function") caveatDialog.showModal();
      else caveatDialog.setAttribute("open", "");
    }));
    caveatDialog?.addEventListener("close", restoreCaveatDialogFocus);
    caveatDialog?.querySelector<HTMLButtonElement>("[data-designer-caveat-close]")?.addEventListener("click", closeCaveatDialog);
    caveatDialog?.addEventListener("click", (event) => {
      if (event.target === caveatDialog) closeCaveatDialog();
    });

    const workspaceTabs = [...this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-workspace-tab]")];
    const activateWorkspaceTab = (button: HTMLButtonElement, moveFocus: boolean) => {
      const tab = button.dataset.designerWorkspaceTab as DesignerWorkspaceTab | undefined;
      if (!tab) return;
      this.#workspaceTab = tab;
      workspaceTabs.forEach((entry) => {
        const selected = entry === button;
        entry.setAttribute("aria-selected", String(selected));
        entry.tabIndex = selected ? 0 : -1;
      });
      this.#root.querySelectorAll<HTMLElement>("[data-designer-workspace-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.designerWorkspacePanel !== tab;
      });
      if (moveFocus) button.focus();
    };
    workspaceTabs.forEach((button, index) => {
      button.addEventListener("click", () => activateWorkspaceTab(button, false));
      button.addEventListener("keydown", (event) => {
        const offset = event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : 0;
        if (offset === 0) return;
        event.preventDefault();
        const next = workspaceTabs[(index + offset + workspaceTabs.length) % workspaceTabs.length];
        if (next) activateWorkspaceTab(next, true);
      });
    });

    const schematicViewport = this.#root.querySelector<HTMLElement>("[data-schematic-scale]");
    this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-schematic-scale]").forEach((button) => {
      button.addEventListener("click", () => {
        const scale = button.dataset.designerSchematicScale;
        if (schematicViewport === null || (scale !== "fit" && scale !== "actual")) return;
        schematicViewport.dataset.schematicScale = scale;
        this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-schematic-scale]").forEach((entry) => {
          entry.setAttribute("aria-pressed", String(entry === button));
        });
        if (scale === "fit") schematicViewport.scrollTo({ left: 0, top: 0 });
      });
    });

    this.#root.querySelector<HTMLButtonElement>("[data-designer-run-simulation]")?.addEventListener("click", (event) => {
      void this.#runDesignerSimulation(event.currentTarget as HTMLButtonElement);
    });
    this.#root.querySelector<HTMLButtonElement>("[data-designer-cancel-simulation]")?.addEventListener("click", () => {
      this.#cancelDesignerSimulation();
    });

    this.#root.querySelectorAll<HTMLDetailsElement>(".designer-solution-tools").forEach((details) => {
      details.open = details.open || !window.matchMedia("(max-width: 600px)").matches;
    });

    this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-sort]").forEach((button) => button.addEventListener("click", () => {
      const table = button.closest("table");
      const heading = button.closest("th");
      const body = table?.tBodies[0];
      if (!table || !heading || !body) return;
      const column = [...heading.parentElement!.children].indexOf(heading);
      const direction = heading.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      table.querySelectorAll<HTMLTableCellElement>("thead th[aria-sort]").forEach((cell) => cell.setAttribute("aria-sort", "none"));
      heading.setAttribute("aria-sort", direction);
      const rows = [...body.rows];
      rows.sort((left, right) => {
        const leftValue = left.cells[column]?.dataset.sortValue ?? left.cells[column]?.textContent?.trim() ?? "";
        const rightValue = right.cells[column]?.dataset.sortValue ?? right.cells[column]?.textContent?.trim() ?? "";
        const leftNumber = Number(leftValue);
        const rightNumber = Number(rightValue);
        const comparison = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
          ? leftNumber - rightNumber
          : leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
        return direction === "ascending" ? comparison : -comparison;
      });
      rows.forEach((row) => body.append(row));
    }));

    this.#root.querySelectorAll<HTMLSelectElement>("[data-designer-solution-filter]").forEach((select) => {
      const comparison = select.closest<HTMLElement>(".designer-comparison");
      const applyFilter = (persist: boolean) => {
        if (persist && (select.value === "all" || select.value === "eligible" || select.value === "pinned")) {
          this.#solutionFilter = select.value;
        }
        const rows = [...(comparison?.querySelectorAll<HTMLTableRowElement>("[data-designer-solution-row]") ?? [])];
        rows.forEach((row) => {
          row.hidden = select.value === "eligible"
            ? row.dataset.policyEligible !== "true"
            : select.value === "pinned"
              ? row.dataset.pinned !== "true"
              : false;
        });
        const visibleCount = rows.filter((row) => !row.hidden).length;
        comparison?.querySelectorAll<HTMLElement>("[data-designer-solution-visible-count]")
          .forEach((count) => { count.textContent = `${visibleCount} shown`; });
        if (persist) this.#announceSolutionVisibility();
      };
      select.addEventListener("change", () => applyFilter(true));
      applyFilter(false);
    });

    this.#root.querySelectorAll<HTMLSelectElement>("[data-designer-solution-objective]").forEach((select) => {
      const applyObjective = (persist: boolean) => {
        const comparison = select.closest<HTMLElement>(".designer-comparison");
        if (persist) this.#solutionObjective = select.value;
        if (select.value === "") {
          const body = comparison?.querySelector<HTMLTableSectionElement>("tbody");
          const rows = [...(body?.querySelectorAll<HTMLTableRowElement>("[data-designer-solution-row]") ?? [])];
          rows.sort((left, right) => Number(left.dataset.designerSolutionOrder) - Number(right.dataset.designerSolutionOrder));
          rows.forEach((row) => body?.append(row));
          comparison?.querySelectorAll<HTMLTableCellElement>("thead th[aria-sort]").forEach((cell) => cell.setAttribute("aria-sort", "none"));
          return;
        }
        const sortButton = [...(comparison?.querySelectorAll<HTMLButtonElement>("[data-designer-sort-key]") ?? [])]
          .find((button) => button.dataset.designerSortKey === select.value);
        sortButton?.click();
      };
      select.addEventListener("change", () => applyObjective(true));
      if (select.value !== "") applyObjective(false);
    });

    const requestFileInput = this.#root.querySelector<HTMLInputElement>("[data-designer-request-file]");
    this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-request-import]").forEach((button) => button.addEventListener("click", () => requestFileInput?.click()));
    requestFileInput?.addEventListener("change", () => {
      const file = requestFileInput.files?.[0];
      if (!file) return;
      void this.#importRequestFile(file);
    });
    const customizationFileInput = this.#root.querySelector<HTMLInputElement>("[data-primary-customization-file]");
    this.#root.querySelectorAll<HTMLButtonElement>("[data-primary-customization-import]").forEach((button) => (
      button.addEventListener("click", () => customizationFileInput?.click())
    ));
    customizationFileInput?.addEventListener("change", () => {
      const file = customizationFileInput.files?.[0];
      if (file) void this.#importCustomizationFile(file);
    });
    const receiptFileInput = this.#root.querySelector<HTMLInputElement>("[data-customized-target-receipt-file]");
    this.#root.querySelector<HTMLButtonElement>("[data-customized-target-receipt-import]")?.addEventListener("click", () => (
      receiptFileInput?.click()
    ));
    receiptFileInput?.addEventListener("change", () => {
      const file = receiptFileInput.files?.[0];
      if (!file) return;
      void this.#importCustomizedTargetInspectionReceipt(file).finally(() => {
        receiptFileInput.value = "";
      });
    });
    this.#root.querySelector<HTMLSelectElement>("[data-primary-customization-target]")?.addEventListener("change", (event) => {
      if (this.#customizationPhase !== "idle") return;
      const contentHash = (event.currentTarget as HTMLSelectElement).value;
      const target = this.#customizationTargets.find((entry) => entry.instruction.contentHash === contentHash);
      this.#customizationEpoch += 1;
      this.#customizationPhase = "idle";
      this.#customizationExportKind = undefined;
      this.#customizationInstruction = target?.instruction;
      this.#customizedResult = undefined;
      window.history.replaceState(null, "", clearPrimaryPartCustomizationShareFromUrl());
      this.#message = target === undefined
        ? undefined
        : "Substitution instruction prepared. Evaluate it to regenerate the exact target and evaluate installed-policy eligibility.";
      this.#render();
      this.#root.querySelector<HTMLElement>("#designer-customization-title")?.focus();
    });
    this.#root.querySelector<HTMLButtonElement>("[data-primary-customization-apply]")?.addEventListener("click", () => {
      void this.#applyCustomization();
    });
    this.#root.querySelectorAll<HTMLButtonElement>("[data-customized-target-export]").forEach((button) => (
      button.addEventListener("click", () => {
        void this.#exportCustomizedTargetArtifact(button);
      })
    ));
    this.#root.querySelector<HTMLButtonElement>("[data-customized-target-receipt-export]")?.addEventListener("click", () => {
      void this.#exportCustomizedTargetInspectionReceipt();
    });
    this.#root.querySelector<HTMLButtonElement>("[data-primary-customization-download]")?.addEventListener("click", () => {
      if (this.#customizationInstruction === undefined) return;
      try {
        download(
          "schemagic-primary-customization-v1.json",
          serializePrimaryPartCustomizationFileV1(this.#customizationInstruction),
          "application/json",
        );
        this.#message = undefined;
      } catch (error) {
        this.#message = error instanceof Error ? error.message : "Customization instruction export failed.";
        this.#render();
      }
    });
    this.#root.querySelector<HTMLButtonElement>("[data-primary-customization-share]")?.addEventListener("click", () => {
      if (this.#request?.schemaVersion !== 2 || this.#customizationInstruction === undefined) return;
      try {
        window.history.replaceState(null, "", primaryPartCustomizationShareUrl(
          this.#request,
          this.#customizationInstruction,
        ));
        this.#message = "Request + customization URL created. It carries exact inputs and an inert instruction, never a trusted target result.";
      } catch (error) {
        this.#message = error instanceof Error ? error.message : "Customization share URL could not be created.";
      }
      this.#render();
      this.#root.querySelector<HTMLButtonElement>("[data-primary-customization-share]")?.focus();
    });
    this.#root.querySelectorAll<HTMLButtonElement>("[data-primary-customization-reset]").forEach((button) => button.addEventListener("click", () => {
      this.#resetCustomization();
      this.#message = this.#stage === "requirements"
        ? "Removed the inert customization instruction. The electrical requirements are unchanged."
        : "Reset to the ordinary generated primary part. The generated result, ranking, pins, and scenario selection are unchanged.";
      this.#render();
      this.#root.querySelector<HTMLElement>(
        this.#stage === "requirements" ? "#designer-requirements-title" : "#designer-customization-title",
      )?.focus();
    }));
    const sourcingRequestForm = this.#root.querySelector<HTMLFormElement>("[data-sourcing-request-form]");
    const sourcingBuildQuantity = sourcingRequestForm?.querySelector<HTMLInputElement>("[data-sourcing-request-build-quantity]");
    const sourcingRegion = sourcingRequestForm?.querySelector<HTMLInputElement>("[data-sourcing-request-region]");
    const sourcingCurrency = sourcingRequestForm?.querySelector<HTMLInputElement>("[data-sourcing-request-currency]");
    sourcingBuildQuantity?.addEventListener("input", () => {
      this.#sourcingRequestBuildQuantity = Number(sourcingBuildQuantity.value);
    });
    sourcingRegion?.addEventListener("input", () => {
      this.#sourcingRequestRegion = sourcingRegion.value;
    });
    sourcingCurrency?.addEventListener("input", () => {
      const normalized = sourcingCurrency.value.toUpperCase();
      if (sourcingCurrency.value !== normalized) sourcingCurrency.value = normalized;
      this.#sourcingRequestCurrency = normalized;
    });
    sourcingRequestForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (
        this.#sourcingRequestBusy
        || sourcingBuildQuantity === undefined
        || sourcingBuildQuantity === null
        || sourcingRegion === undefined
        || sourcingRegion === null
        || sourcingCurrency === undefined
        || sourcingCurrency === null
        || !sourcingRequestForm.reportValidity()
      ) return;
      this.#sourcingRequestBuildQuantity = Number(sourcingBuildQuantity.value);
      this.#sourcingRequestRegion = sourcingRegion.value.trim();
      this.#sourcingRequestCurrency = sourcingCurrency.value.toUpperCase();
      if (sourcingRequestForm.querySelector<HTMLButtonElement>("[data-sourcing-request-download]") !== null) {
        void this.#exportSourcingRequestPacket();
      }
    });
    const resultFileInput = this.#root.querySelector<HTMLInputElement>("[data-designer-result-file]");
    this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-import]").forEach((button) => button.addEventListener("click", () => resultFileInput?.click()));
    resultFileInput?.addEventListener("change", () => {
      const file = resultFileInput.files?.[0];
      if (!file) return;
      void this.#importResultFile(file);
    });
    this.#root.querySelector<HTMLButtonElement>("[data-imported-regenerate-production]")?.addEventListener("click", () => {
      void this.#regenerateImportedProductionResult();
    });
    this.#root.querySelector<HTMLButtonElement>("[data-power-evidence-inspection]")?.addEventListener("click", () => {
      void this.#inspectEvidenceLimitedPowerDesign();
    });
    this.#root.querySelector<HTMLButtonElement>("[data-designer-reference-fallback]")?.addEventListener("click", () => {
      const imported = this.#imported;
      const adapter = this.#adapter;
      if (
        this.#busy
        || imported?.trust !== "production_context_verified"
        || imported.result.schemaVersion !== 2
        || imported.result.request.constraints.allowUnknownHardConstraints
        || adapter?.application !== imported.result.request.application
      ) return;
      this.#operationEpoch += 1;
      this.#busy = false;
      this.#invalidateProductionSource();
      this.#request = referenceInspectionQuickStart(imported.result.request);
      this.#imported = undefined;
      this.#selectedImportedCandidateId = undefined;
      this.#selectedImportedScenarioId = undefined;
      this.#pinnedImportedCandidateIds.clear();
      this.#workspaceTab = "schematic";
      this.#stage = "requirements";
      this.#message = "Including unresolved evidence for reference inspection. Unknown remains unknown and policy eligibility is evaluated separately.";
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      this.#render();
      void this.#generate();
    });
    this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-example]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.designerExample;
      if (!id || !["m1-compact", "m2-power", "p1-compact", "p2-high-voltage"].includes(id)) return;
      void this.#openDemonstration(id as DesignerDemonstrationId);
    }));
    this.#root.querySelector<HTMLButtonElement>("[data-imported-close]")?.addEventListener("click", () => {
      this.#operationEpoch += 1;
      this.#busy = false;
      this.#invalidateProductionSource();
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      const returnToRequirements = importedHasVerifiedProductionContext(this.#imported)
        && this.#adapter !== undefined
        && this.#request !== undefined;
      this.#stage = returnToRequirements ? "requirements" : "applications";
      this.#imported = undefined;
      this.#importedDemonstration = undefined;
      this.#selectedImportedCandidateId = undefined;
      this.#selectedImportedScenarioId = undefined;
      this.#pinnedImportedCandidateIds.clear();
      this.#workspaceTab = "schematic";
      this.#solutionFilter = "all";
      this.#solutionObjective = "";
      this.#message = undefined;
      this.#render();
    });
    this.#root.querySelectorAll<HTMLButtonElement>("[data-imported-candidate]").forEach((button) => button.addEventListener("click", () => {
      this.#clearDesignerSimulation();
      this.#operationEpoch += 1;
      this.#busy = false;
      this.#sourcingRequestEpoch += 1;
      this.#sourcingRequestBusy = false;
      const candidateId = button.dataset.importedCandidate;
      if (this.#customizationInstruction?.sourceCandidateId !== candidateId) {
        this.#customizationInstruction = undefined;
        this.#customizedResult = undefined;
        window.history.replaceState(null, "", clearPrimaryPartCustomizationShareFromUrl());
      }
      this.#customizationTargets = [];
      this.#customizationEpoch += 1;
      this.#customizationPhase = "idle";
      this.#customizationExportKind = undefined;
      this.#selectedImportedCandidateId = candidateId;
      this.#selectedImportedScenarioId = undefined;
      this.#workspaceTab = "schematic";
      this.#message = undefined;
      this.#render();
      void this.#prepareCustomizationTargets("candidate");
    }));
    this.#root.querySelectorAll<HTMLInputElement>("[data-imported-pin]").forEach((input) => input.addEventListener("change", () => {
      if (!importedHasVerifiedProductionContext(this.#imported)) return;
      const candidateId = input.dataset.importedPin;
      if (!candidateId || !this.#imported.result.candidates.some((entry) => entry.id === candidateId)) return;
      const removedFromPinnedFilter = this.#solutionFilter === "pinned" && !input.checked;
      if (!input.checked) this.#pinnedImportedCandidateIds.delete(candidateId);
      else if (this.#pinnedImportedCandidateIds.size < 3) this.#pinnedImportedCandidateIds.add(candidateId);
      else {
        input.checked = false;
        this.#message = "You can pin up to three production candidates or structural observations.";
      }
      this.#render();
      if (removedFromPinnedFilter) {
        this.#root.querySelector<HTMLSelectElement>("[data-designer-solution-filter]")?.focus();
      } else {
        [...this.#root.querySelectorAll<HTMLInputElement>("[data-imported-pin]")]
          .find((pin) => pin.dataset.importedPin === candidateId)
          ?.focus();
      }
      if (this.#solutionFilter === "pinned") this.#announceSolutionVisibility();
    }));
    this.#root.querySelectorAll<HTMLButtonElement>("[data-imported-scenario]").forEach((button) => button.addEventListener("click", () => {
      this.#clearDesignerSimulation();
      this.#operationEpoch += 1;
      this.#busy = false;
      const scenarioId = button.dataset.importedScenario;
      this.#selectedImportedScenarioId = scenarioId;
      this.#workspaceTab = "results";
      this.#message = undefined;
      this.#render();
      [...this.#root.querySelectorAll<HTMLButtonElement>("[data-imported-scenario]")]
        .find((scenarioButton) => scenarioButton.dataset.importedScenario === scenarioId)
        ?.focus();
    }));
    this.#root.querySelector<HTMLButtonElement>('[data-imported-export="json"]')?.addEventListener("click", () => {
      if (!this.#imported) return;
      try {
        const version = this.#imported.result.schemaVersion;
        download(`schemagic-design-v${version}.json`, serializeImportedDesignResult(this.#imported), "application/json");
      } catch (error) {
        this.#message = error instanceof Error ? error.message : "Electrical design JSON export failed.";
        this.#render();
      }
    });
    this.#root.querySelector<HTMLButtonElement>('[data-imported-export="scenario-gate-plan"]')?.addEventListener("click", () => {
      if (!this.#imported || this.#imported.result.schemaVersion !== 2 || !this.#selectedImportedCandidateId) return;
      const candidate = this.#imported.result.candidates.find((entry) => entry.id === this.#selectedImportedCandidateId);
      if (!candidate) return;
      try {
        const source = serializeScenarioGatePlanV2(
          this.#imported.result,
          candidate.id,
        );
        download("schemagic-scenario-gates-v2.json", source, "application/json");
      } catch (error) {
        this.#message = error instanceof Error ? error.message : "Scenario gate plan export failed.";
        this.#render();
      }
    });
    this.#root.querySelectorAll<HTMLButtonElement>("[data-production-export]").forEach((button) => button.addEventListener("click", () => {
      void this.#exportProductionArtifact(button);
    }));
    this.#root.querySelector<HTMLButtonElement>("[data-imported-share]")?.addEventListener("click", () => {
      if (!this.#imported) return;
      try {
        const url = importedDesignResultShareUrl(
          this.#imported,
          this.#selectedImportedCandidateId,
          this.#selectedImportedScenarioId,
        );
        window.history.replaceState(null, "", url);
        this.#message = "Share URL created in the address bar. It preserves this electrical artifact and selection without promoting its trust.";
      } catch (error) {
        this.#message = error instanceof Error ? error.message : "Share URL could not be created.";
      }
      this.#render();
      this.#root.querySelector<HTMLButtonElement>("[data-imported-share]")?.focus();
    });
    this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-application]").forEach((button) => button.addEventListener("click", () => {
      const adapter = this.#options.applications.find((entry) => entry.application === button.dataset.designerApplication);
      const preset = adapter?.presets[0];
      if (!adapter || adapter.status !== "ready" || !preset) return;
      this.#operationEpoch += 1;
      this.#busy = false;
      this.#invalidateProductionSource();
      this.#adapter = adapter;
      this.#selectedPresetId = preset.id;
      this.#request = referenceInspectionQuickStart(preset.createRequest());
      this.#result = undefined;
      this.#workspaceTab = "schematic";
      this.#message = undefined;
      this.#stage = "requirements";
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      this.#render();
      this.#root.querySelector<HTMLElement>("#designer-requirements-title")?.focus();
    }));
    this.#root.querySelector<HTMLButtonElement>("[data-designer-back]")?.addEventListener("click", () => {
      if (this.#busy) return;
      this.#operationEpoch += 1;
      this.#busy = false;
      this.#invalidateProductionSource();
      this.#stage = "applications";
      this.#message = undefined;
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      this.#render();
    });
    this.#root.querySelector<HTMLButtonElement>("[data-designer-request-download]")?.addEventListener("click", () => {
      if (this.#busy || !this.#request || this.#request.schemaVersion !== 2) return;
      try {
        download(
          "schemagic-electrical-request-v2.json",
          serializeElectricalDesignRequestV2(this.#request),
          "application/json",
        );
        this.#message = undefined;
      } catch (error) {
        this.#message = error instanceof Error ? error.message : "Electrical requirements export failed.";
        this.#render();
      }
    });
    this.#root.querySelector<HTMLButtonElement>("[data-designer-request-share]")?.addEventListener("click", () => {
      if (this.#busy || !this.#request || this.#request.schemaVersion !== 2) return;
      try {
        window.history.replaceState(null, "", electricalDesignRequestShareUrl(this.#request));
        this.#message = "Requirements share URL created in the address bar. It preserves exact V2 inputs only and carries no result or production trust.";
      } catch (error) {
        this.#message = error instanceof Error ? error.message : "Requirements share URL could not be created.";
      }
      this.#render();
      this.#root.querySelector<HTMLButtonElement>("[data-designer-request-share]")?.focus();
    });
    this.#root.querySelector<HTMLButtonElement>("[data-designer-edit]")?.addEventListener("click", () => {
      this.#operationEpoch += 1;
      this.#busy = false;
      this.#invalidateProductionSource();
      this.#stage = "requirements";
      this.#message = undefined;
      this.#render();
    });
    this.#root.querySelector<HTMLSelectElement>("[data-designer-preset]")?.addEventListener("change", (event) => {
      if (this.#busy) return;
      const selected = this.#adapter?.presets.find((preset) => preset.id === (event.currentTarget as HTMLSelectElement).value);
      if (!selected) return;
      this.#operationEpoch += 1;
      this.#busy = false;
      this.#invalidateProductionSource();
      this.#selectedPresetId = selected.id;
      this.#request = referenceInspectionQuickStart(selected.createRequest());
      this.#message = undefined;
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      this.#render();
    });
    this.#bindFields();
    this.#root.querySelector<HTMLFormElement>("[data-designer-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.#generate();
    });
    this.#root.querySelector<HTMLButtonElement>("[data-designer-retry]")?.addEventListener("click", () => {
      if (this.#stage === "requirements") {
        this.#message = undefined;
        void this.#generate();
        return;
      }
      this.#message = undefined;
      this.#render();
    });
    this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-candidate]").forEach((button) => button.addEventListener("click", () => {
      this.#selectedCandidateId = button.dataset.designerCandidate;
      this.#message = undefined;
      this.#render();
    }));
    this.#root.querySelectorAll<HTMLInputElement>("[data-designer-pin]").forEach((input) => input.addEventListener("change", () => {
      const id = input.dataset.designerPin;
      if (!id) return;
      if (!input.checked) this.#pinnedCandidateIds.delete(id);
      else if (this.#pinnedCandidateIds.size < 3) this.#pinnedCandidateIds.add(id);
      else this.#message = "You can pin up to three candidates.";
      this.#render();
    }));
    this.#root.querySelectorAll<HTMLButtonElement>("[data-designer-export]").forEach((button) => button.addEventListener("click", () => {
      const candidate = this.#result?.candidates.find((entry) => entry.id === this.#selectedCandidateId);
      if (!this.#result || !candidate) return;
      if (designResultHasLegacyInlineSourcing(this.#result)) {
        this.#message = LEGACY_INLINE_SOURCING_EXPORT_REASON;
        this.#render();
        return;
      }
      try {
        if (button.dataset.designerExport === "json") download("schemagic-design.json", serializeDesignResultV1(this.#result), "application/json");
      } catch (error) {
        this.#message = error instanceof Error ? error.message : String(error);
        this.#render();
      }
    }));
  }

  async #importRequestFile(file: File): Promise<void> {
    const operationEpoch = ++this.#operationEpoch;
    this.#busy = false;
    this.#invalidateProductionSource();
    if (file.size > DESIGN_REQUEST_IMPORT_MAX_BYTES) {
      this.#message = "Electrical requirements exceed the supported transfer limits.";
      this.#render();
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      if (operationEpoch !== this.#operationEpoch) return;
    } catch {
      if (operationEpoch !== this.#operationEpoch) return;
      this.#message = "Electrical requirements could not be read.";
      this.#render();
      return;
    }
    try {
      const transferred = parseElectricalDesignRequestV2Bytes(bytes);
      const adapter = this.#options.applications.find((entry) => (
        entry.application === transferred.request.application && entry.status === "ready"
      ));
      if (!adapter) throw new Error("Electrical requirements do not have a matching ready application context.");
      this.#clearProductionSchematicPreview();
      this.#adapter = adapter;
      this.#request = transferred.request;
      this.#selectedPresetId = undefined;
      this.#result = undefined;
      this.#imported = undefined;
      this.#importedDemonstration = undefined;
      this.#selectedCandidateId = undefined;
      this.#selectedImportedCandidateId = undefined;
      this.#selectedImportedScenarioId = undefined;
      this.#pinnedCandidateIds.clear();
      this.#pinnedImportedCandidateIds.clear();
      this.#message = "Loaded exact canonical V2 requirements as untrusted input. Review them and press Generate design to use the installed production context.";
      this.#stage = "requirements";
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
    } catch (error) {
      this.#message = error instanceof Error ? error.message : "Electrical requirements failed strict V2 validation.";
    }
    this.#render();
    if (this.#stage === "requirements") {
      this.#root.querySelector<HTMLElement>("#designer-requirements-title")?.focus();
    }
  }

  async #importResultFile(file: File): Promise<void> {
    const operationEpoch = ++this.#operationEpoch;
    this.#busy = false;
    this.#invalidateProductionSource();
    if (file.size > DESIGN_RESULT_IMPORT_MAX_BYTES) {
      this.#message = "Design result exceeds the supported import limits.";
      this.#render();
      return;
    }
    let source: string;
    try {
      source = await file.text();
      if (operationEpoch !== this.#operationEpoch) return;
    } catch {
      if (operationEpoch !== this.#operationEpoch) return;
      this.#message = "Design result could not be read.";
      this.#render();
      return;
    }
    try {
      this.#imported = parseImportedDesignResultText(source);
      this.#importedDemonstration = undefined;
      this.#pinnedImportedCandidateIds.clear();
      this.#selectedImportedCandidateId = this.#imported.result.candidates[0]?.id;
      this.#selectedImportedScenarioId = undefined;
      this.#result = undefined;
      this.#message = undefined;
      this.#stage = "imported";
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
    } catch (error) {
      this.#message = error instanceof Error ? error.message : "Design result failed strict structural validation.";
    }
    this.#render();
  }

  async #exportCustomizedTargetArtifact(button: HTMLButtonElement): Promise<void> {
    const source = this.#productionGeneration;
    const customized = this.#customizedResult;
    const adapter = this.#adapter;
    const customization = adapter?.primaryPartCustomization;
    const instruction = this.#customizationInstruction;
    const request = this.#request;
    const candidateId = this.#selectedImportedCandidateId;
    const kind = button.dataset.customizedTargetExport;
    if (
      source === undefined
      || customized === undefined
      || adapter === undefined
      || customization === undefined
      || instruction === undefined
      || request === undefined
      || candidateId === undefined
      || this.#stage !== "imported"
      || this.#customizationPhase !== "idle"
      || this.#customizationExportKind !== undefined
      || !customizedTargetExportArtifactKind(kind)
      || customized.source.candidateId !== candidateId
      || customization.authorizesCustomizedResult(customized, source) !== true
    ) return;
    const artifactKind: CustomizedTargetExportArtifactKind = kind;
    const targetCandidate = customized.targetResultProjection.candidates[0];
    if (targetCandidate === undefined) return;

    const epoch = ++this.#customizationEpoch;
    this.#customizationExportKind = artifactKind;
    this.#message = undefined;
    this.#render();
    this.#root.querySelector<HTMLElement>("#designer-customization-result-title")?.focus();
    try {
      const artifact = await customization.exportArtifact(source, customized, artifactKind);
      if (
        epoch !== this.#customizationEpoch
        || this.#stage !== "imported"
        || this.#productionGeneration !== source
        || this.#customizedResult !== customized
        || this.#adapter !== adapter
        || adapter.primaryPartCustomization !== customization
        || this.#customizationInstruction !== instruction
        || this.#request !== request
        || this.#selectedImportedCandidateId !== candidateId
      ) return;
      const defaultScenarioId = targetCandidate.circuit.defaultScenarioId;
      const artifactContract = artifactKind === "customized_target_electrical_bom_csv"
        ? {
            mimeType: "text/csv;charset=utf-8",
            suffix: "electrical-bom.csv",
            message: "Customized-target electrical BOM inspection CSV downloaded. The ordinary result and installed V3 decision are unchanged.",
          }
        : artifactKind === "customized_target_structural_svg"
          ? {
              mimeType: "image/svg+xml;charset=utf-8",
              suffix: "structural-schematic.svg",
              message: "Customized-target structural schematic inspection SVG downloaded. The ordinary result and installed V3 decision are unchanged.",
            }
          : artifactKind === "customized_target_engineering_report_html"
            ? {
                mimeType: "text/html;charset=utf-8",
                suffix: "engineering-report.html",
                message: "Customized-target engineering report HTML downloaded. It remains target-only inspection output with no release authority.",
              }
            : artifactKind === "customized_target_structural_kicad"
              ? {
                  mimeType: "application/x-kicad-schematic;charset=utf-8",
                  suffix: "structural.kicad_sch",
                  message: "Customized-target structural KiCad schematic downloaded. Footprints and external-open attestation remain unavailable.",
                }
              : {
                  mimeType: "text/x-spice;charset=utf-8",
                  suffix: `${safeCustomizedTargetFilenameToken(defaultScenarioId ?? "scenario")}-behavioral.cir`,
                  message: "Customized-target behavioral Scenario SPICE downloaded. It is zero-omission scenario input, not selected-part simulation evidence.",
                };
      const expectedFilename = `schemagic-${source.application.replaceAll(".", "-")}-${targetCandidate.id.slice(-12)}-customized-target-${artifactContract.suffix}`;
      const requiredProvenance = [
        source.result.contentHash,
        customized.source.executionReportContentHash,
        customized.source.candidateId,
        customized.contentHash,
        customized.instruction.contentHash,
        customized.instruction.requestHash,
        customized.instruction.requestByteContentHash,
        customized.targetResultProjection.contentHash,
        customized.constraintDecision.contentHash,
        customized.contextManifestContentHash,
        customized.instruction.context.catalog.contentHash,
        customized.instruction.context.catalog.sourceReleaseContentHash,
        customized.instruction.context.recipe.id,
        customized.instruction.context.recipe.contentHash,
        customized.instruction.context.constraintPolicy.contentHash,
        customized.instruction.substitution.targetProfile.profileId,
        customized.instruction.substitution.targetProfile.contentHash,
        targetCandidate.id,
        targetCandidate.circuit.defaultCircuitId,
        String(customized.constraintDecision.candidates[0]?.eligible === true),
        ...(artifactKind === "customized_target_behavioral_scenario_spice"
          ? [
              defaultScenarioId,
              targetCandidate.circuit.scenarios.find((scenario) => scenario.id === defaultScenarioId)?.circuitId,
            ].filter((identity): identity is string => identity !== null && identity !== undefined)
          : []),
      ];
      if (
        artifact.kind !== artifactKind
        || typeof artifact.filename !== "string"
        || artifact.filename !== expectedFilename
        || !/^[A-Za-z0-9._-]+$/u.test(artifact.filename)
        || artifact.mimeType !== artifactContract.mimeType
        || typeof artifact.content !== "string"
        || new TextEncoder().encode(artifact.content).byteLength > 16 * 1024 * 1024
        || requiredProvenance.some((identity) => !artifact.content.includes(identity))
      ) throw new Error("Application adapter returned a context-mismatched customized-target artifact");
      download(artifact.filename, artifact.content, artifact.mimeType);
      this.#message = artifactContract.message;
    } catch (error) {
      if (epoch !== this.#customizationEpoch) return;
      this.#message = error instanceof Error
        ? error.message
        : "Customized-target inspection export failed.";
    } finally {
      if (epoch === this.#customizationEpoch) {
        this.#customizationExportKind = undefined;
        this.#render();
        this.#root.querySelector<HTMLButtonElement>(
          `[data-customized-target-export="${artifactKind}"]`,
        )?.focus();
      }
    }
  }

  async #exportCustomizedTargetInspectionReceipt(): Promise<void> {
    const source = this.#productionGeneration;
    const customized = this.#customizedResult;
    const adapter = this.#adapter;
    const customization = adapter?.primaryPartCustomization;
    const instruction = this.#customizationInstruction;
    const request = this.#request;
    const candidateId = this.#selectedImportedCandidateId;
    if (
      source === undefined
      || customized === undefined
      || adapter === undefined
      || customization === undefined
      || instruction === undefined
      || request === undefined
      || candidateId === undefined
      || this.#stage !== "imported"
      || this.#customizationPhase !== "idle"
      || this.#customizationExportKind !== undefined
      || customized.source.candidateId !== candidateId
      || customization.authorizesCustomizedResult(customized, source) !== true
    ) return;
    const targetCandidate = customized.targetResultProjection.candidates[0];
    if (targetCandidate === undefined) return;

    const epoch = ++this.#customizationEpoch;
    this.#customizationExportKind = "customized_target_inspection_receipt";
    this.#message = undefined;
    this.#render();
    this.#root.querySelector<HTMLElement>("#designer-customization-result-title")?.focus();
    try {
      const artifact = await customization.exportInspectionReceipt(source, customized);
      if (
        epoch !== this.#customizationEpoch
        || this.#stage !== "imported"
        || this.#productionGeneration !== source
        || this.#customizedResult !== customized
        || this.#adapter !== adapter
        || adapter.primaryPartCustomization !== customization
        || this.#customizationInstruction !== instruction
        || this.#request !== request
        || this.#selectedImportedCandidateId !== candidateId
      ) return;
      const requiredProvenance = [
        source.result.contentHash,
        customized.source.executionReportContentHash,
        customized.contentHash,
        customized.instruction.contentHash,
        customized.targetResultProjection.contentHash,
        customized.constraintDecision.contentHash,
        customized.instruction.substitution.targetProfile.contentHash,
        targetCandidate.id,
      ];
      let receipt: Record<string, unknown>;
      try {
        receipt = JSON.parse(artifact.content) as Record<string, unknown>;
      } catch {
        throw new Error("Application adapter returned a non-JSON customized-target inspection receipt");
      }
      const claimBoundary = receipt.claimBoundary as Record<string, unknown> | undefined;
      const descriptors = receipt.artifacts;
      if (
        artifact.kind !== "customized_target_inspection_receipt"
        || typeof artifact.filename !== "string"
        || !artifact.filename.startsWith("schemagic-")
        || !artifact.filename.endsWith("-customized-target-inspection-receipt-v1.json")
        || artifact.mimeType !== "application/json;charset=utf-8"
        || typeof artifact.content !== "string"
        || new TextEncoder().encode(artifact.content).byteLength > customization.inspectionReceiptMaxBytes
        || receipt.format !== "schemagic-customized-target-inspection-receipt"
        || receipt.schemaVersion !== 1
        || claimBoundary?.purpose !== "inspection_only"
        || claimBoundary.parseAndSelfHash !== "integrity_only"
        || claimBoundary.installedContextAuthority !== "not_conferred"
        || claimBoundary.attestation !== "none"
        || !Array.isArray(descriptors)
        || descriptors.length !== 2
        || (descriptors[0] as { kind?: unknown } | undefined)?.kind
          !== "customized_target_electrical_bom_csv"
        || (descriptors[1] as { kind?: unknown } | undefined)?.kind
          !== "customized_target_structural_svg"
        || requiredProvenance.some((identity) => !artifact.content.includes(identity))
      ) throw new Error("Application adapter returned a context-mismatched customized-target inspection receipt");
      download(artifact.filename, artifact.content, artifact.mimeType);
      this.#message = "Customized-target inspection receipt downloaded. It binds the exact BOM/SVG payloads by descriptor; the payloads are not included, and it confers no installed-context or production authority.";
    } catch (error) {
      if (epoch !== this.#customizationEpoch) return;
      this.#message = error instanceof Error
        ? error.message
        : "Customized-target inspection receipt export failed.";
    } finally {
      if (epoch === this.#customizationEpoch) {
        this.#customizationExportKind = undefined;
        this.#render();
        this.#root.querySelector<HTMLButtonElement>("[data-customized-target-receipt-export]")?.focus();
      }
    }
  }

  async #exportSourcingRequestPacket(): Promise<void> {
    const source = this.#productionGeneration;
    const adapter = this.#adapter;
    const contract = adapter?.sourcingRequestPacket;
    const selectedCandidateId = this.#selectedImportedCandidateId;
    const candidate = source?.result.candidates.find((candidate) => (
      candidate.id === selectedCandidateId
    ));
    const candidateId = candidate?.id;
    const buildQuantity = this.#sourcingRequestBuildQuantity;
    const region = this.#sourcingRequestRegion;
    const currency = this.#sourcingRequestCurrency;
    if (
      source === undefined
      || adapter === undefined
      || contract === undefined
      || candidate === undefined
      || candidateId === undefined
      || this.#stage !== "imported"
      || this.#importedDemonstration !== undefined
      || this.#sourcingRequestBusy
      || !Number.isSafeInteger(buildQuantity)
      || buildQuantity < 1
      || buildQuantity > 1_000_000
      || region.length === 0
      || region !== region.trim()
      || new TextEncoder().encode(region).byteLength > 128
      || !/^[A-Z]{3}$/u.test(currency)
    ) return;
    const policy: SourcingRequestPolicyV1 = {
      ...DEFAULT_SOURCING_REQUEST_POLICY_V1,
      region,
      currency,
    };
    const exactInput: SourcingRequestPacketInputV1 = {
      designResultRef: {
        schemaVersion: 2,
        designResultContentHash: source.result.contentHash,
        requestHash: source.result.requestHash,
        libraryVersion: source.result.libraryVersion,
        libraryContentHash: source.result.libraryContentHash,
      },
      candidateRef: { id: candidate.id, recipeId: candidate.recipeId },
      bomLines: candidate.components.map((component) => ({
        lineId: component.id,
        manufacturerId: component.part.manufacturerId,
        manufacturerPartNumber: component.part.manufacturerPartNumber,
        quantityPerAssembly: component.quantityPerAssembly,
      })),
      buildQuantity,
      policy,
    };
    const epoch = ++this.#sourcingRequestEpoch;
    this.#sourcingRequestBusy = true;
    this.#message = undefined;
    this.#render();
    this.#root.querySelector<HTMLElement>("#designer-sourcing-request-title")?.focus();
    try {
      const artifact = await contract.exportPacket(source, candidateId, buildQuantity, policy);
      if (
        epoch !== this.#sourcingRequestEpoch
        || this.#stage !== "imported"
        || this.#productionGeneration !== source
        || this.#adapter !== adapter
        || adapter.sourcingRequestPacket !== contract
        || this.#selectedImportedCandidateId !== candidateId
        || this.#sourcingRequestBuildQuantity !== buildQuantity
        || this.#sourcingRequestRegion !== region
        || this.#sourcingRequestCurrency !== currency
      ) return;
      const packet = await verifyExactSourcingRequestPacketArtifactV1(artifact, exactInput);
      if (
        epoch !== this.#sourcingRequestEpoch
        || this.#stage !== "imported"
        || this.#productionGeneration !== source
        || this.#adapter !== adapter
        || adapter.sourcingRequestPacket !== contract
        || this.#selectedImportedCandidateId !== candidateId
        || this.#sourcingRequestBuildQuantity !== buildQuantity
        || this.#sourcingRequestRegion !== region
        || this.#sourcingRequestCurrency !== currency
        || adapter.authorizesProductionGeneration?.(source) !== true
      ) return;
      if (
        artifact.kind !== "provider_neutral_sourcing_request_packet"
        || artifact.mimeType !== "application/json;charset=utf-8"
        || !artifact.filename.endsWith("-sourcing-request-v1.json")
        || packet.designResultRef.designResultContentHash !== source.result.contentHash
        || packet.designResultRef.requestHash !== source.result.requestHash
        || packet.designResultRef.libraryContentHash !== source.result.libraryContentHash
        || packet.candidateRef.id !== candidateId
        || packet.buildQuantity !== buildQuantity
        || JSON.stringify(packet.policy) !== JSON.stringify(policy)
        || packet.boundaries.purpose !== "provider_neutral_sourcing_request"
        || packet.boundaries.offers !== "not_included"
        || packet.boundaries.providerUrls !== "not_included"
        || packet.boundaries.providerSelection !== "not_included"
        || packet.boundaries.credentials !== "not_included"
        || packet.boundaries.commercialObservations !== "not_included"
        || packet.boundaries.providerAccess !== "not_authorized"
        || !artifact.content.includes(packet.contentHash)
        || /https?:\/\//u.test(artifact.content)
      ) throw new Error("Application adapter returned a context-mismatched sourcing request packet");
      download(artifact.filename, artifact.content, artifact.mimeType);
      this.#message = "Provider-neutral sourcing request downloaded. The packet authorizes no provider access or selection; electrical ranking and eligibility are unchanged.";
    } catch (error) {
      if (epoch !== this.#sourcingRequestEpoch) return;
      this.#message = error instanceof Error
        ? error.message
        : "Sourcing request packet export failed.";
    } finally {
      if (epoch === this.#sourcingRequestEpoch) {
        this.#sourcingRequestBusy = false;
        this.#render();
        this.#root.querySelector<HTMLButtonElement>("[data-sourcing-request-download]")?.focus();
      }
    }
  }

  async #exportProductionArtifact(button: HTMLButtonElement): Promise<void> {
    if (
      this.#busy
      || !importedHasVerifiedProductionContext(this.#imported)
      || this.#imported.result.schemaVersion !== 2
      || !this.#selectedImportedCandidateId
      || !this.#adapter?.exportProductionArtifact
      || this.#adapter.application !== this.#imported.result.request.application
    ) return;
    const imported = this.#imported;
    const adapter = this.#adapter;
    const candidate = imported.result.candidates.find((entry) => entry.id === this.#selectedImportedCandidateId);
    const kind = button.dataset.productionExport;
    if (!candidate || !kind || ![
      "electrical_bom_csv",
      "scenario_spice",
      "structural_svg",
      "engineering_report_html",
      "structural_kicad",
      "physical_handoff_json",
    ].includes(kind)) return;
    const artifactKind = kind as ProductionDesignArtifactKindV2;
    if (adapter.productionArtifactKinds?.includes(artifactKind) !== true) return;
    const constraintDecision = imported.trust === "production_constraint_observation"
      && (artifactKind === "electrical_bom_csv" || artifactKind === "structural_svg")
        ? this.#authorizedDisplayedObservationDecision(imported, adapter)
        : undefined;
    if (imported.trust === "production_constraint_observation"
      && (artifactKind === "electrical_bom_csv" || artifactKind === "structural_svg")
      && constraintDecision === undefined) return;
    const scenarioId = artifactKind === "scenario_spice" ? button.dataset.productionScenario : undefined;
    if (artifactKind === "scenario_spice") {
      const coverage = candidate.simulationCoverage.find((entry) => entry.scenarioId === scenarioId);
      const scenario = candidate.circuit.scenarios.find((entry) => entry.id === scenarioId);
      if (scenarioId === undefined || coverage?.modelTier !== "behavioral" || scenario === undefined) return;
    }
    const operationEpoch = ++this.#operationEpoch;
    this.#busy = true;
    button.disabled = true;
    try {
      const artifact = await adapter.exportProductionArtifact!({
        result: imported.result,
        candidateId: candidate.id,
        kind: artifactKind,
        ...(scenarioId === undefined ? {} : { scenarioId }),
        ...(constraintDecision === undefined ? {} : { constraintDecision }),
      });
      if (
        operationEpoch !== this.#operationEpoch
        || this.#stage !== "imported"
        || this.#imported !== imported
        || this.#adapter !== adapter
        || this.#selectedImportedCandidateId !== candidate.id
      ) return;
      if (
        artifact.kind !== artifactKind
        || typeof artifact.filename !== "string" || artifact.filename.length === 0
        || typeof artifact.mimeType !== "string" || artifact.mimeType.length === 0
        || typeof artifact.content !== "string"
      ) throw new Error("Application adapter returned a context-mismatched production artifact");
      if (
        artifactKind === "scenario_spice"
        && (
          artifact.mimeType !== "text/x-spice;charset=utf-8"
          || !artifact.filename.endsWith("-behavioral.cir")
          || !artifact.content.includes(imported.result.contentHash)
          || !artifact.content.includes(candidate.id)
          || !artifact.content.includes(`scenario-id ${scenarioId}`)
        )
      ) throw new Error("Application adapter returned a context-mismatched behavioral scenario deck");
      if (artifactKind === "physical_handoff_json") {
        const { parsePowerPhysicalImplementationHandoffV2 } = await import(
          "@opencircuit/design-export/power-physical-implementation-handoff-v2"
        );
        if (
          operationEpoch !== this.#operationEpoch
          || this.#stage !== "imported"
          || this.#imported !== imported
          || this.#adapter !== adapter
          || this.#selectedImportedCandidateId !== candidate.id
        ) return;
        const handoff = parsePowerPhysicalImplementationHandoffV2(artifact.content);
        if (
          artifact.mimeType !== "application/json;charset=utf-8"
          || !artifact.filename.endsWith("-physical-implementation-handoff-v2.json")
          || imported.result.request.application !== "power.buck"
          || handoff.provenance.designResult.contentHash !== imported.result.contentHash
          || handoff.provenance.designResult.requestHash !== imported.result.requestHash
          || handoff.provenance.designResult.libraryContentHash !== imported.result.libraryContentHash
          || handoff.provenance.engineeringContext.contentHash !== imported.contextManifestContentHash
          || handoff.provenance.candidate.id !== candidate.id
          || handoff.provenance.candidate.recipeId !== candidate.recipeId
          || handoff.provenance.circuit.id !== candidate.circuit.defaultCircuitId
        ) throw new Error("Application adapter returned a context-mismatched physical implementation handoff");
      }
      if (constraintDecision !== undefined) {
        const policyCandidate = constraintDecision.candidates.find((entry) => entry.candidateId === candidate.id);
        const blockedRuleIds = policyCandidate?.rules
          .filter((rule) => rule.disposition === "blocked_failure" || rule.disposition === "blocked_unknown")
          .map((rule) => rule.ruleId) ?? [];
        if (policyCandidate === undefined || [
          imported.result.contentHash,
          candidate.id,
          constraintDecision.contentHash,
          constraintDecision.policy.contentHash,
          ...blockedRuleIds,
        ].some((identity) => !artifact.content.includes(identity))) {
          throw new Error("Application adapter returned a policy-detached observation artifact");
        }
      }
      download(artifact.filename, artifact.content, artifact.mimeType);
      this.#message = undefined;
    } catch (error) {
      if (operationEpoch !== this.#operationEpoch) return;
      this.#message = error instanceof Error ? error.message : "Production export failed.";
      this.#render();
    } finally {
      if (operationEpoch === this.#operationEpoch) {
        this.#busy = false;
        button.disabled = false;
      }
    }
  }

  async #openDemonstration(id: DesignerDemonstrationId): Promise<void> {
    if (this.#loadingDemonstrationId) return;
    const operationEpoch = ++this.#operationEpoch;
    this.#busy = false;
    this.#invalidateProductionSource();
    this.#loadingDemonstrationId = id;
    this.#message = undefined;
    this.#render();
    try {
      const loaded = await loadDesignerDemonstration(id);
      if (operationEpoch !== this.#operationEpoch) return;
      this.#imported = loaded.imported;
      this.#pinnedImportedCandidateIds.clear();
      this.#importedDemonstration = {
        code: loaded.example.code,
        title: loaded.example.title,
        topology: loaded.example.topology,
        artifactContentHash: loaded.artifactContentHash,
      };
      this.#selectedImportedCandidateId = loaded.imported.result.candidates[0]?.id;
      this.#selectedImportedScenarioId = undefined;
      this.#result = undefined;
      this.#stage = "imported";
      this.#message = `${loaded.example.code} demonstration opened after exact manifest, byte-length, and content-hash verification.`;
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
    } catch (error) {
      if (operationEpoch !== this.#operationEpoch) return;
      this.#message = error instanceof Error ? error.message : "Demonstration data could not be opened.";
    } finally {
      if (this.#loadingDemonstrationId === id) this.#loadingDemonstrationId = undefined;
      if (operationEpoch === this.#operationEpoch) {
        this.#render();
        if (this.#stage === "imported") this.#root.querySelector<HTMLElement>("#designer-results-title")?.focus();
        else this.#root.querySelector<HTMLButtonElement>(`[data-designer-example="${id}"]`)?.focus();
      }
    }
  }

  #bindFields(): void {
    if (!this.#adapter || !this.#request) return;
    const fields = this.#adapter.parameterForm.fields(this.#request);
    const generationModeField = fields.find((field) => (
      field.id === "constraints.allowUnknownHardConstraints" && field.control === "checkbox"
    ));
    this.#root.querySelectorAll<HTMLInputElement>("[data-designer-generation-mode]").forEach((input) => input.addEventListener("change", () => {
      if (!input.checked || generationModeField?.control !== "checkbox" || !this.#request) return;
      this.#operationEpoch += 1;
      this.#busy = false;
      const referenceMode = input.value === "reference";
      this.#request = generationModeField.write(this.#request, referenceMode);
      if (referenceMode && this.#request.schemaVersion === 2) {
        this.#request.constraints.allowEstimatedValues = true;
        this.#request.constraints.allowUnknownWarnings = true;
      }
      this.#invalidateProductionSource();
      this.#message = undefined;
      window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      this.#render();
      this.#root.querySelector<HTMLInputElement>(`[data-designer-generation-mode][value="${input.value}"]`)?.focus();
    }));
    this.#root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-designer-field]").forEach((input) => input.addEventListener("change", () => {
      const index = Number(input.dataset.designerField);
      const field = fields[index];
      if (!field || !this.#request) return;
      this.#operationEpoch += 1;
      this.#busy = false;
      try {
        this.#request = this.#updateField(field, input, index);
        this.#invalidateProductionSource();
        this.#message = undefined;
        window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      } catch (error) {
        this.#message = error instanceof Error ? error.message : String(error);
      }
      this.#render();
    }));
    this.#root.querySelectorAll<HTMLSelectElement>("[data-designer-unit]").forEach((select) => select.addEventListener("change", () => {
      const index = Number(select.dataset.designerUnit);
      const field = fields[index];
      if (!field || field.control !== "number" || !this.#request) return;
      this.#operationEpoch += 1;
      this.#busy = false;
      try {
        const reading = field.read(this.#request);
        const previousUnit = field.unitOptions.find((option) => option.value === reading.unit);
        const nextUnit = field.unitOptions.find((option) => option.value === select.value);
        if (!previousUnit || !nextUnit) throw new Error(`Unsupported display unit ${select.value}`);
        const canonicalValue = previousUnit.toCanonical(reading.value);
        this.#request = field.write(this.#request, nextUnit.fromCanonical(canonicalValue), nextUnit.value);
        this.#invalidateProductionSource();
        this.#message = undefined;
        window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      } catch (error) {
        this.#message = error instanceof Error ? error.message : String(error);
      }
      this.#render();
    }));
  }

  #updateField(field: DesignerParameterField, input: HTMLInputElement | HTMLSelectElement, index: number): DesignerRequest {
    if (!this.#request) throw new Error("No active design request");
    if (field.control === "checkbox") return field.write(this.#request, (input as HTMLInputElement).checked);
    if (field.control === "select") return field.write(this.#request, input.value);
    const value = Number(input.value);
    if (!Number.isFinite(value)) throw new Error(`${field.label} must be a finite number`);
    const unit = this.#root.querySelector<HTMLSelectElement>(`[data-designer-unit="${index}"]`)?.value ?? field.read(this.#request).unit;
    return field.write(this.#request, value, unit);
  }

  async #generate(): Promise<void> {
    if (!this.#adapter || !this.#request || this.#busy) return;
    const issues = this.#adapter.parameterForm.validate(this.#request);
    if (issues.length > 0) {
      this.#message = issues[0]!.message;
      this.#render();
      return;
    }
    const adapter = this.#adapter;
    const requestSource = this.#request;
    const request = structuredClone(this.#request);
    const pendingInstruction = this.#customizationInstruction;
    const operationEpoch = ++this.#operationEpoch;
    this.#workspaceTab = "schematic";
    this.#solutionFilter = "all";
    this.#solutionObjective = "";
    this.#busy = true;
    this.#message = undefined;
    this.#render();
    try {
      const generated = await adapter.generate(request);
      if (
        operationEpoch !== this.#operationEpoch
        || this.#adapter !== adapter
        || this.#request !== requestSource
        || this.#customizationInstruction !== pendingInstruction
        || this.#stage !== "requirements"
      ) return;
      if ("kind" in generated) {
        const generation = verifiedProductionGeneration(generated, adapter);
        const result = generation.result;
        this.#productionGeneration = generation;
        this.#imported = importedProductionGeneration(generation);
        this.#importedDemonstration = undefined;
        this.#pinnedImportedCandidateIds.clear();
        this.#selectedImportedCandidateId = pendingInstruction !== undefined
          && result.candidates.some((candidate) => candidate.id === pendingInstruction.sourceCandidateId)
            ? pendingInstruction.sourceCandidateId
            : result.candidates[0]?.id;
        this.#selectedImportedScenarioId = undefined;
        this.#result = undefined;
        const externalMotorStrictUnknownRejection = result.request.application === "motor.brushed-dc"
          && result.request.constraints.allowedTopologyFamilies.length === 1
          && result.request.constraints.allowedTopologyFamilies[0] === "motor.hbridge.external-nmos"
          && generation.execution.counts.supportedRecipes > 0
          && result.candidates.length === 0
          && generation.execution.counts.checked > 0
          && generation.execution.rejections.length === generation.execution.counts.checked
          && generation.execution.rejections.every((rejection) => rejection.reasonCode === "unknown_constraint_disallowed");
        this.#message = externalMotorStrictUnknownRejection
          ? `Installed external-NMOS assessment enumerated and checked ${generation.execution.counts.checked} exact MIC4606-2 direct-gate structures with separate bootstrap and VDD-local capacitor roles; strict generation excluded all because unresolved required safety and requirement evidence remains. Microchip Rev H supports only the direct connection and nominal capacitor floors: the 100 nF C1608 is excluded from both roles, application adequacy remains unknown, and no series-gate resistor was selected. Three interface-specific xHS rules pass only the nominal 0 V-to-requested-bus excursion; recirculation undershoot, wiring overshoot, parasitics, and TVS coordination remain unproved. No VDD driver-bias rail is implemented, so an actual source inside the reviewed VDD range remains required and unknown.`
          : generation.kind === "production_constraint_observation"
            ? `Generated ${result.candidates.length} structural observation${result.candidates.length === 1 ? "" : "s"}; the installed production policy marks ${generation.constraintDecision.eligibleCandidateIds.length} eligible.`
          : result.candidates.length > 0
            ? "Generated deterministically from the exact bundled production context. Unknown evidence remains unknown."
            : "Generation completed from the exact bundled production context, but no candidate passed the current evidence policy.";
        this.#customizationTargets = [];
        this.#customizedResult = undefined;
        const selectedCandidateId = this.#selectedImportedCandidateId;
        const selectedCandidate = result.candidates.find((candidate) => candidate.id === selectedCandidateId);
        const customization = adapter.primaryPartCustomization;
        if (
          pendingInstruction !== undefined
          && customization !== undefined
          && selectedCandidate !== undefined
        ) {
          try {
            this.#customizationTargets = await customization.listTargets(generation, selectedCandidate.id);
            if (
              operationEpoch !== this.#operationEpoch
              || this.#adapter !== adapter
              || this.#request !== requestSource
              || this.#customizationInstruction !== pendingInstruction
              || this.#stage !== "requirements"
            ) return;
            if (pendingInstruction !== undefined) {
              if (
                pendingInstruction.sourceResultContentHash !== result.contentHash
                || pendingInstruction.sourceCandidateId !== selectedCandidateId
                || this.#customizationTargets.every((target) => (
                  target.instruction.contentHash !== pendingInstruction.contentHash
                ))
              ) throw new Error("Transferred customization does not bind to an exact compatible target in this regenerated source.");
              const ordinaryBytes = serializeDesignResultV2(result);
              const customized = await customization.generate(generation, pendingInstruction);
              if (
                operationEpoch !== this.#operationEpoch
                || this.#adapter !== adapter
                || this.#request !== requestSource
                || this.#customizationInstruction !== pendingInstruction
                || this.#stage !== "requirements"
              ) return;
              if (
                customization.authorizesCustomizedResult(customized, generation) !== true
                || customized.instruction.contentHash !== pendingInstruction.contentHash
                || customized.source.resultContentHash !== result.contentHash
                || customized.source.candidateId !== pendingInstruction.sourceCandidateId
                || customized.targetResultProjection.request.application !== adapter.application
                || serializeDesignResultV2(result) !== ordinaryBytes
              ) throw new Error("Application adapter returned a context-mismatched customized result");
              this.#customizedResult = customized;
              this.#message = customized.constraintDecision.candidates[0]?.eligible
                ? "Exact source and target regenerated; the target is eligible under the installed V3 policy. Ordinary ranking and ordinary-result exports remain unchanged."
                : "Exact source and target regenerated; the target is ineligible under the installed V3 policy. Ordinary ranking and ordinary-result exports remain unchanged.";
            }
          } catch (error) {
            if (
              operationEpoch !== this.#operationEpoch
              || this.#adapter !== adapter
              || this.#request !== requestSource
              || this.#customizationInstruction !== pendingInstruction
              || this.#stage !== "requirements"
            ) return;
            this.#customizedResult = undefined;
            this.#message = `Source generation succeeded. ${error instanceof Error ? error.message : "Customization evaluation was rejected."}`;
          }
        }
        if (pendingInstruction === undefined) {
          window.history.replaceState(null, "", clearDesignerSharesFromUrl());
        }
        this.#stage = "imported";
        if (
          pendingInstruction === undefined
          && customization !== undefined
          && selectedCandidate !== undefined
        ) {
          this.#deferCustomizationTargetDiscovery(generation, adapter, selectedCandidate.id);
        }
      } else {
        this.#invalidateProductionSource();
        const result = generated;
        if (result.format !== "schemagic-design-result") throw new Error("Application adapter returned an unsupported design result");
        if (result.request.application !== adapter.application) throw new Error("Application adapter returned a result for the wrong application");
        if (result.schemaVersion === 2) {
          throw new Error("Application adapter returned an unverified production V2 result");
        }
        this.#result = result;
        this.#request = result.request;
        this.#selectedCandidateId = result.candidates[0]?.id;
        this.#pinnedCandidateIds.clear();
        this.#stage = "results";
        window.history.replaceState(null, "", clearDesignerSharesFromUrl());
      }
    } catch (error) {
      if (operationEpoch !== this.#operationEpoch) return;
      this.#message = error instanceof Error ? error.message : String(error);
    } finally {
      if (operationEpoch === this.#operationEpoch) {
        this.#busy = false;
        this.#render();
      }
    }
  }
}

export function mountDesignerRoute(root: HTMLElement, options: DesignerRouteOptions): DesignerRoute {
  const route = new DesignerRoute(root, options);
  route.mount();
  return route;
}

export { applicationChooser, resultsMarkup };
