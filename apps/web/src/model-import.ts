import {
  derivePinMappingSpec,
  importedBaseType,
  importedPartFromModel,
  importedPartFromSubckt,
  importFalstadCircuit,
  isFalstadShareInput,
  materializeImportedModelLibrary,
  materializeImportedModelPart,
  parseSpiceLibrary,
  sanitize,
  validatePinMapping,
  type FalstadImportResult,
  type ImportedLibrary,
  type ImportedModel,
  type ImportedSubckt,
  type MaterializedImportedModelPart,
  type PinMappingSpec,
  type SuggestedSymbol,
} from "@opencircuit/model-import";
import {
  IMPORTED_MODEL_LIBRARY_FORMAT,
  IMPORTED_MODEL_LIBRARY_VERSION,
  generateNetlist,
  normalizedImportedModelLibrary,
  partByType,
  type AnalysisMode,
  type CircuitComponent,
  type CircuitDocument,
  type ComponentType,
  type GeneratedNetlist,
  type ImportedModelPart,
  type ImportedPinMapping,
  type NetlistLine,
} from "@opencircuit/circuit-schema";
import { shareUrl } from "./share";

export interface FalstadImportDestination {
  result: FalstadImportResult;
  url: string;
}

export function falstadImportDestination(input: string, location: Location = window.location): FalstadImportDestination {
  const result = importFalstadCircuit(input);
  return { result, url: shareUrl(result.document, location) };
}

export interface ImportedPartDefinition extends MaterializedImportedModelPart {
  id: string;
  name: string;
  sourceName: string;
  sourceText: string;
  namespace: string;
  emittedText: string;
  emittedName: string;
  definitionKind: "model" | "subckt";
  suggestedSymbol: SuggestedSymbol;
  baseType: ComponentType;
  modelPins: string[];
  userMapping: Record<string, number>;
  warnings: string[];
  blockedItems: string[];
}

export interface ImportedModelRuntimeIssue {
  code: "UNSUPPORTED_ANALYSIS";
  componentId: string;
  partId: string;
  analysisMode: AnalysisMode;
  message: string;
}

export class ImportedModelRuntimeError extends Error {
  constructor(readonly issue: ImportedModelRuntimeIssue) {
    super(issue.message);
    this.name = "ImportedModelRuntimeError";
  }
}

const esc = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const safeId = (value: string) => value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "model";

const semanticPinLabels: Partial<Record<ComponentType, readonly string[]>> = {
  diode: ["A", "K"], led: ["A", "K"], bjt_npn: ["C", "B", "E"], bjt_pnp: ["C", "B", "E"],
  nmos: ["D", "G", "S"], pmos: ["D", "G", "S"], opamp_ideal: ["IN+", "IN-", "OUT"],
};

function definitionView(materialized: MaterializedImportedModelPart): ImportedPartDefinition {
  const { record } = materialized;
  const labels = semanticPinLabels[record.baseType] ?? partByType(record.baseType).pins.map((_, index) => `PIN${index + 1}`);
  return {
    ...materialized,
    id: record.id,
    name: record.definition.name,
    sourceName: record.sourceName,
    sourceText: record.sourceText,
    definitionKind: record.definition.kind,
    baseType: record.baseType,
    userMapping: Object.fromEntries(record.pinMapping.map((mapping) => [labels[mapping.symbolPinIndex] ?? `PIN${mapping.symbolPinIndex + 1}`, mapping.modelPinIndex])),
    blockedItems: [],
  };
}

export function importedModelRecords(document: CircuitDocument): ImportedModelPart[] {
  return document.modelImports?.parts.map((part) => structuredClone(part)) ?? [];
}

export function importedParts(document: CircuitDocument): ImportedPartDefinition[] {
  return materializeImportedModelLibrary(document.modelImports).map(definitionView);
}

export function setImportedModelRecords(document: CircuitDocument, records: readonly ImportedModelPart[]): void {
  if (records.length === 0) {
    delete document.modelImports;
    return;
  }
  const library = normalizedImportedModelLibrary({
    format: IMPORTED_MODEL_LIBRARY_FORMAT,
    version: IMPORTED_MODEL_LIBRARY_VERSION,
    parts: records.map((record) => structuredClone(record)),
  });
  materializeImportedModelLibrary(library);
  document.modelImports = library;
}

/** Compatibility adapter for the current palette; only each definition's raw, typed record is persisted. */
export function setImportedParts(document: CircuitDocument, parts: readonly ImportedPartDefinition[]): void {
  setImportedModelRecords(document, parts.map((part) => part.record));
}

function modelSymbol(model: ImportedModel): SuggestedSymbol {
  const type = model.type.toLowerCase();
  if (type === "d") return "diode";
  if (type.includes("npn") || type.includes("pnp")) return "bjt";
  if (type.includes("mos")) return "mosfet";
  return "generic";
}

function symbolPreview(symbol: SuggestedSymbol): string {
  const label = symbol === "opamp" ? "OP" : symbol === "mosfet" ? "MOS" : symbol === "bjt" ? "BJT" : symbol === "diode" ? "D" : symbol === "regulator" ? "REG" : "SUB";
  return `<svg class="import-symbol-preview" viewBox="0 0 80 48" role="img" aria-label="Suggested ${esc(symbol)} symbol"><rect x="8" y="8" width="64" height="32"/><path d="M0 24h8m64 0h8"/><text x="40" y="28" text-anchor="middle">${label}</text></svg>`;
}

function supportsPlacement(symbol: SuggestedSymbol, pinCount: number): boolean {
  return partByType(importedBaseType(symbol)).pins.length === pinCount;
}

function definitionFromModel(model: ImportedModel, sourceName: string, sourceText: string): ImportedPartDefinition {
  const suggestedSymbol = modelSymbol(model);
  return definitionView(materializeImportedModelPart(importedPartFromModel(model, {
    sourceName,
    sourceText,
    baseType: importedBaseType(suggestedSymbol, model),
  })));
}

function definitionFromSubckt(subckt: ImportedSubckt, spec: PinMappingSpec, sourceName: string, sourceText: string): ImportedPartDefinition {
  const pinMapping: ImportedPinMapping[] = Object.values(spec.userMapping).map((modelPinIndex, symbolPinIndex) => ({
    symbolPinIndex,
    modelPinIndex,
  }));
  return definitionView(materializeImportedModelPart(importedPartFromSubckt(subckt, {
    sourceName,
    sourceText,
    baseType: importedBaseType(spec.suggestedSymbol),
    pinMapping,
  })));
}

export function importedPaletteMarkup(parts: ImportedPartDefinition[]): string {
  if (parts.length === 0) return "";
  return `<div class="imported-rail-heading">IMPORTED</div>${parts.map((part) => {
    const modes = part.record.analysisValidity.supportedModes.filter((mode) => mode !== "live").map(analysisModeLabel).join(" · ");
    return `<button class="symbol-tool imported-symbol-tool" data-imported-part="${esc(part.id)}" aria-label="Place imported ${esc(part.name)}"><span class="part-abbr">IMP</span><span class="rail-flyout"><strong>${esc(part.name)}</strong>${esc(part.suggestedSymbol)} symbol<br><span class="unverified-tag">imported, unverified</span><br><span>Declared modes: ${esc(modes)}</span></span></button>`;
  }).join("")}`;
}

function importedLine(component: CircuitComponent, definition: ImportedPartDefinition, generated: GeneratedNetlist): string | undefined {
  const nodes = generated.componentNodes[component.id] ?? [];
  const suffix = component.id.replace(/\D/g, "") || safeId(component.id);
  if (definition.definitionKind === "subckt") {
    const ordered = Array.from({ length: definition.modelPins.length }, () => "0");
    for (const mapping of definition.record.pinMapping) ordered[mapping.modelPinIndex] = nodes[mapping.symbolPinIndex] ?? "0";
    return `X${suffix} ${ordered.join(" ")} ${definition.emittedName} $ component:${component.id}`;
  }
  switch (component.type) {
    case "diode":
    case "led": return `D${suffix} ${nodes[0]} ${nodes[1]} ${definition.emittedName} $ component:${component.id}`;
    case "bjt_npn":
    case "bjt_pnp": return `Q${suffix} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${definition.emittedName} $ component:${component.id}`;
    case "nmos":
    case "pmos": return `M${suffix} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${nodes[2]} ${definition.emittedName} $ component:${component.id}`;
    default: return undefined;
  }
}

function analysisModeLabel(mode: AnalysisMode): string {
  return mode === "live" || mode === "op" ? "operating-point" : mode === "dc-sweep" ? "DC sweep" : mode === "tran" ? "transient" : mode.toUpperCase();
}

function assertImportedAnalysisSupport(
  document: CircuitDocument,
  mode: AnalysisMode,
  definitions: readonly ImportedPartDefinition[],
): void {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  for (const component of document.components) {
    const importedId = component.params?.importedPartId;
    const definition = typeof importedId === "string" ? byId.get(importedId) : undefined;
    if (!definition || definition.record.analysisValidity.supportedModes.includes(mode)) continue;
    const limitation = definition.record.analysisValidity.limitations?.find((candidate) => candidate.modes.includes(mode));
    const available = definition.record.analysisValidity.supportedModes
      .filter((candidate) => candidate !== "live")
      .map(analysisModeLabel)
      .join(", ");
    const nextStep = `Choose one of its declared modes (${available || "none"}) or import a model with declared ${analysisModeLabel(mode)} support.`;
    const action = limitation ? `${limitation.message} ${nextStep}` : nextStep;
    throw new ImportedModelRuntimeError({
      code: "UNSUPPORTED_ANALYSIS",
      componentId: component.id,
      partId: definition.id,
      analysisMode: mode,
      message: `Component ${component.id} (${definition.name}) does not declare ${analysisModeLabel(mode)} support. ${action}`,
    });
  }
}

export function generateNetlistWithImports(document: CircuitDocument, mode?: AnalysisMode): GeneratedNetlist {
  const definitions = importedParts(document);
  const selectedMode = mode ?? document.sim.mode;
  assertImportedAnalysisSupport(document, selectedMode, definitions);
  const baseGenerated = generateNetlist(document, mode);
  const generated = { ...baseGenerated, componentCurrents: { ...baseGenerated.componentCurrents } };
  if (definitions.length === 0) return generated;
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const components = new Map(document.components.map((component) => [component.id, component]));
  const lines = generated.netlist.trimEnd().split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const componentId = lines[index]?.match(/\$ component:([^\s]+)/)?.[1];
    const component = componentId ? components.get(componentId) : undefined;
    const importedId = component?.params?.importedPartId;
    const definition = typeof importedId === "string" ? byId.get(importedId) : undefined;
    const replacement = component && definition ? importedLine(component, definition, generated) : undefined;
    if (component && typeof importedId === "string" && !definition) throw new Error(`Component ${component.id} references missing imported model ${importedId}`);
    if (component && definition && !replacement) throw new Error(`Imported model ${definition.name} cannot be applied to component ${component.id}`);
    if (replacement) {
      lines[index] = replacement;
      if (definition?.definitionKind === "subckt") {
        const staleCurrent = generated.componentCurrents[component!.id];
        if (staleCurrent) {
          const saveIndex = lines.findIndex((line) => line.startsWith(".save "));
          if (saveIndex >= 0) lines[saveIndex] = lines[saveIndex]!.replace(` ${staleCurrent}`, "");
          delete generated.componentCurrents[component!.id];
        }
      }
    }
  }
  const usedIds = new Set(document.components.map((component) => component.params?.importedPartId).filter((value): value is string => typeof value === "string"));
  const libraryLines = definitions.filter((definition) => usedIds.has(definition.id)).sort((left, right) => left.id.localeCompare(right.id)).flatMap((definition) => [
    `* imported, unverified: ${definition.name}`,
    ...definition.emittedText.trimEnd().split("\n"),
  ]);
  if (libraryLines.length === 0) return { ...generated, netlist: `${lines.join("\n")}\n` };
  lines.splice(2, 0, ...libraryLines);
  const insertedMap: NetlistLine[] = libraryLines.map(() => ({ line: 0, stage: "model" }));
  const lineMap = [...generated.lineMap.slice(0, 2), ...insertedMap, ...generated.lineMap.slice(2)].map((entry, index) => ({ ...entry, line: index + 1 }));
  return { ...generated, netlist: `${lines.join("\n")}\n`, lineMap };
}

interface DialogOptions {
  getParts: () => ImportedPartDefinition[];
  onPartsChange: (parts: ImportedPartDefinition[]) => void;
}

export class ModelImportDialog {
  private readonly overlay: HTMLDivElement;
  private readonly source: HTMLTextAreaElement;
  private readonly fileInput: HTMLInputElement;
  private readonly fileTrigger: HTMLButtonElement;
  private readonly fileName: HTMLSpanElement;
  private readonly results: HTMLDivElement;
  private library: ImportedLibrary | undefined;
  private sourceName = "pasted-model.lib";
  private blocked = false;

  constructor(private readonly options: DialogOptions) {
    this.overlay = document.createElement("div");
    this.overlay.className = "overlay";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `<style>
      .import-sheet .import-source input.model-file-input { display: none }
      .import-sheet .file-picker { display: flex; align-items: center; min-width: 0; gap: 8px; margin-bottom: 12px }
      .import-sheet .file-trigger { flex: none; padding: 6px 9px; border: 1px solid var(--graphite-500); border-radius: 0; color: var(--graphite-900); background: var(--vellum); font: inherit }
      .import-sheet .file-trigger:focus-visible, .import-sheet textarea:focus-visible, .import-sheet select:focus-visible { outline: 2px solid var(--graphite-900); outline-offset: -2px }
      .import-sheet .file-name { min-width: 0; overflow: hidden; color: var(--graphite-500); font: 10px/1.3 "IBM Plex Mono", monospace; text-overflow: ellipsis; white-space: nowrap }
    </style><section class="import-sheet" role="dialog" aria-modal="true" aria-label="Import models"><header><strong>IMPORT MODELS</strong><button data-close-import>Close</button></header><div class="import-source"><label class="field-label" for="model-files">Model files</label><div class="file-picker"><input class="model-file-input" id="model-files" type="file" multiple accept=".model,.subckt,.lib,.cir,text/plain"/><button class="file-trigger" type="button" aria-controls="model-files">Choose files</button><span class="file-name" aria-live="polite">No files selected</span></div><label class="field-label" for="model-text">Or paste SPICE model text or a Falstad / CircuitJS share URL</label><textarea id="model-text" placeholder=".subckt ... or a Falstad / CircuitJS share URL"></textarea><button class="primary-button" data-parse-models>Parse and review</button></div><div class="import-results" data-import-results><p>Choose files or paste model text. Imported content stays in this browser workspace.</p></div></section>`;
    document.body.append(this.overlay);
    this.source = this.overlay.querySelector<HTMLTextAreaElement>("#model-text")!;
    this.fileInput = this.overlay.querySelector<HTMLInputElement>("#model-files")!;
    this.fileTrigger = this.overlay.querySelector<HTMLButtonElement>(".file-trigger")!;
    this.fileName = this.overlay.querySelector<HTMLSpanElement>(".file-name")!;
    this.results = this.overlay.querySelector<HTMLDivElement>("[data-import-results]")!;
    this.overlay.querySelector("[data-close-import]")?.addEventListener("click", () => this.close());
    this.overlay.querySelector("[data-parse-models]")?.addEventListener("click", () => void this.parse());
    this.fileTrigger.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", () => void this.loadFiles());
  }

  open(): void {
    this.overlay.hidden = false;
    this.source.focus();
  }

  close(): void {
    this.overlay.hidden = true;
  }

  private async loadFiles(): Promise<void> {
    const files = [...(this.fileInput.files ?? [])];
    if (files.length === 0) {
      this.fileName.textContent = "No files selected";
      return;
    }
    this.sourceName = files.map((file) => file.name).join(", ");
    this.fileName.textContent = this.sourceName;
    this.fileName.title = this.sourceName;
    this.source.value = (await Promise.all(files.map(async (file) => `* source: ${file.name}\n${await file.text()}`))).join("\n\n");
  }

  private async parse(): Promise<void> {
    const text = this.source.value.trim();
    if (!text) {
      this.results.innerHTML = `<p class="import-error">Paste model text or choose a file first.</p>`;
      return;
    }
    try {
      if (isFalstadShareInput(text)) {
        this.renderFalstadImport(text);
        return;
      }
      this.library = parseSpiceLibrary(text, { filename: this.sourceName });
      const sanitized = sanitize(this.library);
      this.blocked = sanitized.blockedReasons.length > 0;
      const warnings = [
        ...this.library.warnings.map((warning) => `<li>${esc(`${warning.file}:${warning.line} ${warning.message}`)}</li>`),
        ...sanitized.removed.map((item) => `<li>${esc(`${item.file}:${item.line} Removed: ${item.reason}`)}</li>`),
      ];
      const blocked = sanitized.blockedReasons.map((item) => `<li>${esc(`${item.file}:${item.line} Blocked: ${item.message}`)}</li>`);
      const definitions = [
        ...this.library.models.map((model, index) => this.modelCard(model, index)),
        ...this.library.subckts.map((subckt, index) => this.subcktCard(subckt, index)),
      ];
      this.results.innerHTML = `<section class="import-summary"><strong>Parse results</strong><span>${this.library.models.length} models, ${this.library.subckts.length} subcircuits</span></section><section class="sanitizer-report"><h3>Sanitizer warnings and removed items</h3>${warnings.length ? `<ul>${warnings.join("")}</ul>` : "<p>None.</p>"}<h3>Blocked items</h3>${blocked.length ? `<ul class="blocked-list">${blocked.join("")}</ul>` : "<p>None.</p>"}</section><section class="pin-mapping-step"><h3>Pin mapping</h3>${definitions.join("") || "<p>No importable .model or .subckt definitions were found.</p>"}</section>`;
      this.bindDefinitionActions(text);
    } catch (error) {
      this.results.innerHTML = `<p class="import-error">${esc(error instanceof Error ? error.message : String(error))}</p>`;
    }
  }

  private renderFalstadImport(input: string): void {
    const destination = falstadImportDestination(input);
    const { report, document } = destination.result;
    const issues = report.unsupported.map((issue) => `<li><strong>${esc(`${issue.mapping === "partial" ? "Partial" : "Unsupported"} line ${issue.lineNumber}`)}</strong><br><code>${esc(issue.elementLine)}</code><br><span>Reason: ${esc(issue.reason)}</span></li>`);
    const warnings = report.warnings.map((warning) => `<li>${esc(warning.message)}</li>`);
    const componentCount = document.components.length;
    const probeCount = document.probes.length;
    this.results.innerHTML = `<section class="import-summary"><strong>Falstad parse results</strong><span>${componentCount} components, ${probeCount} scope trace${probeCount === 1 ? "" : "s"}</span></section><section class="sanitizer-report"><h3>Unsupported and partial mappings</h3>${issues.length ? `<ul class="blocked-list">${issues.join("")}</ul>` : "<p>None.</p>"}<h3>Warnings</h3>${warnings.length ? `<ul>${warnings.join("")}</ul>` : "<p>None.</p>"}</section><button class="primary-button" data-load-falstad>Load imported circuit</button>`;
    this.results.querySelector<HTMLButtonElement>("[data-load-falstad]")?.addEventListener("click", () => window.location.assign(destination.url));
  }

  private modelCard(model: ImportedModel, index: number): string {
    const suggested = modelSymbol(model);
    const supported = suggested !== "generic";
    const status = supported ? "No subcircuit pin mapping is required." : "This model type has no compatible schematic symbol yet.";
    return `<article class="import-definition" data-model-index="${index}">${symbolPreview(suggested)}<div><strong>${esc(model.name)}</strong><span>.model ${esc(model.type)}</span><p>${this.blocked ? "Remove the blocked source statements before importing." : status}</p></div><button class="primary-button" data-import-model="${index}" ${supported && !this.blocked ? "" : "disabled"}>Add imported part</button></article>`;
  }

  private subcktCard(subckt: ImportedSubckt, index: number): string {
    const spec = derivePinMappingSpec(subckt);
    const supported = supportsPlacement(spec.suggestedSymbol, subckt.pins.length);
    const selects = Object.entries(spec.userMapping).map(([symbolPin, selected]) => `<label>${esc(symbolPin)}<select data-map-pin="${esc(symbolPin)}">${subckt.pins.map((pin, nodeIndex) => `<option value="${nodeIndex}" ${nodeIndex === selected ? "selected" : ""}>${esc(pin)}</option>`).join("")}</select></label>`).join("");
    const status = supported ? "Mapping is complete and bijective." : `No placeable ${subckt.pins.length}-pin symbol is available yet.`;
    return `<article class="import-definition subckt-definition" data-subckt-index="${index}">${symbolPreview(spec.suggestedSymbol)}<div><strong>${esc(subckt.name)}</strong><span>${esc(spec.suggestedSymbol)} suggestion</span><div class="pin-map-grid">${selects}</div><p class="mapping-status${supported && !this.blocked ? "" : " invalid"}" data-mapping-status>${this.blocked ? "Remove the blocked source statements before importing." : status}</p></div><button class="primary-button" data-import-subckt="${index}" ${supported && !this.blocked ? "" : "disabled"}>Add imported part</button></article>`;
  }

  private bindDefinitionActions(sourceText: string): void {
    this.results.querySelectorAll<HTMLButtonElement>("[data-import-model]").forEach((button) => button.addEventListener("click", () => {
      const model = this.library?.models[Number(button.dataset.importModel)];
      if (!this.library || !model || this.blocked) return;
      const parts = this.options.getParts();
      parts.push(definitionFromModel(model, this.sourceName, sourceText));
      this.options.onPartsChange(parts);
      button.textContent = "Added";
      button.disabled = true;
    }));
    this.results.querySelectorAll<HTMLElement>("[data-subckt-index]").forEach((card) => {
      const subckt = this.library?.subckts[Number(card.dataset.subcktIndex)];
      if (!subckt || !this.library) return;
      const spec = derivePinMappingSpec(subckt);
      const validate = () => {
        card.querySelectorAll<HTMLSelectElement>("[data-map-pin]").forEach((select) => { spec.userMapping[select.dataset.mapPin!] = Number(select.value); });
        const validation = validatePinMapping(spec);
        const supported = supportsPlacement(spec.suggestedSymbol, subckt.pins.length);
        const valid = validation.valid && supported && !this.blocked;
        const status = card.querySelector<HTMLElement>("[data-mapping-status]")!;
        status.textContent = this.blocked ? "Remove the blocked source statements before importing." : !supported ? `No placeable ${subckt.pins.length}-pin symbol is available yet.` : validation.valid ? "Mapping is complete and bijective." : validation.errors.join(" ");
        status.classList.toggle("invalid", !valid);
        const button = card.querySelector<HTMLButtonElement>("[data-import-subckt]")!;
        button.disabled = !valid;
        return valid;
      };
      card.querySelectorAll("select").forEach((select) => select.addEventListener("change", validate));
      card.querySelector<HTMLButtonElement>("[data-import-subckt]")?.addEventListener("click", (event) => {
        if (!validate()) return;
        const parts = this.options.getParts();
        parts.push(definitionFromSubckt(subckt, spec, this.sourceName, sourceText));
        this.options.onPartsChange(parts);
        const button = event.currentTarget as HTMLButtonElement;
        button.textContent = "Added";
        button.disabled = true;
      });
    });
  }
}
