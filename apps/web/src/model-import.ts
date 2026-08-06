import {
  derivePinMappingSpec,
  emitNamespacedLibrary,
  parseSpiceLibrary,
  sanitize,
  validatePinMapping,
  type ImportedLibrary,
  type ImportedModel,
  type ImportedSubckt,
  type PinMappingSpec,
  type SuggestedSymbol,
} from "@opencircuit/model-import";
import { generateNetlist, partByType, type AnalysisMode, type CircuitComponent, type CircuitDocument, type ComponentType, type GeneratedNetlist, type NetlistLine } from "@opencircuit/circuit-schema";

export interface ImportedPartDefinition {
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

export interface CircuitWithImports extends CircuitDocument {
  importedParts?: ImportedPartDefinition[];
}

const esc = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const safeId = (value: string) => value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "model";

export function importedParts(document: CircuitDocument): ImportedPartDefinition[] {
  return ((document as CircuitWithImports).importedParts ?? []).map((part) => structuredClone(part));
}

export function setImportedParts(document: CircuitDocument, parts: ImportedPartDefinition[]): void {
  (document as CircuitWithImports).importedParts = parts.map((part) => structuredClone(part));
}

function modelSymbol(model: ImportedModel): SuggestedSymbol {
  const type = model.type.toLowerCase();
  if (type === "d") return "diode";
  if (type.includes("npn") || type.includes("pnp")) return "bjt";
  if (type.includes("mos")) return "mosfet";
  return "generic";
}

function baseType(symbol: SuggestedSymbol, source?: ImportedModel): ComponentType {
  if (symbol === "diode" || symbol === "two-terminal") return "diode";
  if (symbol === "bjt") return source?.type.toLowerCase().includes("pnp") ? "bjt_pnp" : "bjt_npn";
  if (symbol === "mosfet") return source?.type.toLowerCase().includes("pmos") ? "pmos" : "nmos";
  if (symbol === "opamp") return "opamp_ideal";
  if (symbol === "regulator" || symbol === "three-terminal") return "bjt_npn";
  return "resistor";
}

function symbolPreview(symbol: SuggestedSymbol): string {
  const label = symbol === "opamp" ? "OP" : symbol === "mosfet" ? "MOS" : symbol === "bjt" ? "BJT" : symbol === "diode" ? "D" : symbol === "regulator" ? "REG" : "SUB";
  return `<svg class="import-symbol-preview" viewBox="0 0 80 48" role="img" aria-label="Suggested ${esc(symbol)} symbol"><rect x="8" y="8" width="64" height="32"/><path d="M0 24h8m64 0h8"/><text x="40" y="28" text-anchor="middle">${label}</text></svg>`;
}

function supportsPlacement(symbol: SuggestedSymbol, pinCount: number): boolean {
  return partByType(baseType(symbol)).pins.length === pinCount;
}

function resolveEmittedName(values: Record<string, string>, original: string): string {
  const exact = Object.entries(values).find(([key]) => key.split(":").at(-1)?.split("/").at(-1)?.toLowerCase() === original.toLowerCase());
  return exact?.[1] ?? Object.values(values)[0] ?? original;
}

function definitionFromModel(library: ImportedLibrary, model: ImportedModel, sourceName: string, sourceText: string, ordinal: number): ImportedPartDefinition {
  const namespace = `ocimp_${safeId(model.name)}_${ordinal}`;
  const emitted = emitNamespacedLibrary(library, namespace);
  const suggestedSymbol = modelSymbol(model);
  return {
    id: crypto.randomUUID(),
    name: model.name,
    sourceName,
    sourceText,
    namespace,
    emittedText: emitted.text,
    emittedName: resolveEmittedName(emitted.modelNames, model.name),
    definitionKind: "model",
    suggestedSymbol,
    baseType: baseType(suggestedSymbol, model),
    modelPins: [],
    userMapping: {},
    warnings: library.warnings.map((warning) => `${warning.file}:${warning.line} ${warning.message}`),
    blockedItems: emitted.blockedReasons.map((reason) => `${reason.file}:${reason.line} ${reason.message}`),
  };
}

function definitionFromSubckt(library: ImportedLibrary, subckt: ImportedSubckt, spec: PinMappingSpec, sourceName: string, sourceText: string, ordinal: number): ImportedPartDefinition {
  const namespace = `ocimp_${safeId(subckt.name)}_${ordinal}`;
  const emitted = emitNamespacedLibrary(library, namespace);
  return {
    id: crypto.randomUUID(),
    name: subckt.name,
    sourceName,
    sourceText,
    namespace,
    emittedText: emitted.text,
    emittedName: resolveEmittedName(emitted.subcktNames, subckt.name),
    definitionKind: "subckt",
    suggestedSymbol: spec.suggestedSymbol,
    baseType: baseType(spec.suggestedSymbol),
    modelPins: [...spec.modelPins],
    userMapping: { ...spec.userMapping },
    warnings: library.warnings.map((warning) => `${warning.file}:${warning.line} ${warning.message}`),
    blockedItems: emitted.blockedReasons.map((reason) => `${reason.file}:${reason.line} ${reason.message}`),
  };
}

export function importedPaletteMarkup(parts: ImportedPartDefinition[]): string {
  if (parts.length === 0) return "";
  return `<div class="imported-rail-heading">IMPORTED</div>${parts.map((part) => `<button class="symbol-tool imported-symbol-tool" data-imported-part="${esc(part.id)}" aria-label="Place imported ${esc(part.name)}"><span class="part-abbr">IMP</span><span class="rail-flyout"><strong>${esc(part.name)}</strong>${esc(part.suggestedSymbol)} symbol<br><span class="unverified-tag">imported, unverified</span></span></button>`).join("")}`;
}

function importedLine(component: CircuitComponent, definition: ImportedPartDefinition, generated: GeneratedNetlist): string | undefined {
  const nodes = generated.componentNodes[component.id] ?? [];
  const suffix = component.id.replace(/\D/g, "") || safeId(component.id);
  if (definition.definitionKind === "subckt") {
    const symbolPins = Object.keys(definition.userMapping);
    const ordered = Array.from({ length: definition.modelPins.length }, () => "0");
    symbolPins.forEach((symbolPin, symbolIndex) => {
      const modelIndex = definition.userMapping[symbolPin];
      if (modelIndex !== undefined) ordered[modelIndex] = nodes[symbolIndex] ?? "0";
    });
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

export function generateNetlistWithImports(document: CircuitDocument, mode?: AnalysisMode): GeneratedNetlist {
  const generated = generateNetlist(document, mode);
  const definitions = importedParts(document);
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
    if (replacement) lines[index] = replacement;
  }
  const usedIds = new Set(document.components.map((component) => component.params?.importedPartId).filter((value): value is string => typeof value === "string"));
  const libraryLines = definitions.filter((definition) => usedIds.has(definition.id)).flatMap((definition) => [
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
  private readonly results: HTMLDivElement;
  private library: ImportedLibrary | undefined;
  private sourceName = "pasted-model.lib";

  constructor(private readonly options: DialogOptions) {
    this.overlay = document.createElement("div");
    this.overlay.className = "overlay";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `<section class="import-sheet" role="dialog" aria-modal="true" aria-label="Import models"><header><strong>IMPORT MODELS</strong><button data-close-import>Close</button></header><div class="import-source"><label class="field-label" for="model-files">Model files</label><input id="model-files" type="file" multiple accept=".model,.subckt,.lib,.cir,text/plain"/><label class="field-label" for="model-text">Or paste SPICE model text</label><textarea id="model-text" placeholder=".subckt ... or .model ..."></textarea><button class="primary-button" data-parse-models>Parse and review</button></div><div class="import-results" data-import-results><p>Choose files or paste model text. Imported content stays in this browser workspace.</p></div></section>`;
    document.body.append(this.overlay);
    this.source = this.overlay.querySelector<HTMLTextAreaElement>("#model-text")!;
    this.fileInput = this.overlay.querySelector<HTMLInputElement>("#model-files")!;
    this.results = this.overlay.querySelector<HTMLDivElement>("[data-import-results]")!;
    this.overlay.querySelector("[data-close-import]")?.addEventListener("click", () => this.close());
    this.overlay.querySelector("[data-parse-models]")?.addEventListener("click", () => void this.parse());
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
    if (files.length === 0) return;
    this.sourceName = files.map((file) => file.name).join(", ");
    this.source.value = (await Promise.all(files.map(async (file) => `* source: ${file.name}\n${await file.text()}`))).join("\n\n");
  }

  private async parse(): Promise<void> {
    const text = this.source.value.trim();
    if (!text) {
      this.results.innerHTML = `<p class="import-error">Paste model text or choose a file first.</p>`;
      return;
    }
    try {
      this.library = parseSpiceLibrary(text, { filename: this.sourceName });
      const sanitized = sanitize(this.library);
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

  private modelCard(model: ImportedModel, index: number): string {
    const suggested = modelSymbol(model);
    const supported = suggested !== "generic";
    const status = supported ? "No subcircuit pin mapping is required." : "This model type has no compatible schematic symbol yet.";
    return `<article class="import-definition" data-model-index="${index}">${symbolPreview(suggested)}<div><strong>${esc(model.name)}</strong><span>.model ${esc(model.type)}</span><p>${status}</p></div><button class="primary-button" data-import-model="${index}" ${supported ? "" : "disabled"}>Add imported part</button></article>`;
  }

  private subcktCard(subckt: ImportedSubckt, index: number): string {
    const spec = derivePinMappingSpec(subckt);
    const supported = supportsPlacement(spec.suggestedSymbol, subckt.pins.length);
    const selects = Object.entries(spec.userMapping).map(([symbolPin, selected]) => `<label>${esc(symbolPin)}<select data-map-pin="${esc(symbolPin)}">${subckt.pins.map((pin, nodeIndex) => `<option value="${nodeIndex}" ${nodeIndex === selected ? "selected" : ""}>${esc(pin)}</option>`).join("")}</select></label>`).join("");
    const status = supported ? "Mapping is complete and bijective." : `No placeable ${subckt.pins.length}-pin symbol is available yet.`;
    return `<article class="import-definition subckt-definition" data-subckt-index="${index}">${symbolPreview(spec.suggestedSymbol)}<div><strong>${esc(subckt.name)}</strong><span>${esc(spec.suggestedSymbol)} suggestion</span><div class="pin-map-grid">${selects}</div><p class="mapping-status${supported ? "" : " invalid"}" data-mapping-status>${status}</p></div><button class="primary-button" data-import-subckt="${index}" ${supported ? "" : "disabled"}>Add imported part</button></article>`;
  }

  private bindDefinitionActions(sourceText: string): void {
    this.results.querySelectorAll<HTMLButtonElement>("[data-import-model]").forEach((button) => button.addEventListener("click", () => {
      const model = this.library?.models[Number(button.dataset.importModel)];
      if (!this.library || !model) return;
      const parts = this.options.getParts();
      parts.push(definitionFromModel(this.library, model, this.sourceName, sourceText, parts.length + 1));
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
        const valid = validation.valid && supported;
        const status = card.querySelector<HTMLElement>("[data-mapping-status]")!;
        status.textContent = !supported ? `No placeable ${subckt.pins.length}-pin symbol is available yet.` : validation.valid ? "Mapping is complete and bijective." : validation.errors.join(" ");
        status.classList.toggle("invalid", !valid);
        const button = card.querySelector<HTMLButtonElement>("[data-import-subckt]")!;
        button.disabled = !valid;
        return valid;
      };
      card.querySelectorAll("select").forEach((select) => select.addEventListener("change", validate));
      card.querySelector<HTMLButtonElement>("[data-import-subckt]")?.addEventListener("click", (event) => {
        if (!validate()) return;
        const parts = this.options.getParts();
        parts.push(definitionFromSubckt(this.library!, subckt, spec, this.sourceName, sourceText, parts.length + 1));
        this.options.onPartsChange(parts);
        const button = event.currentTarget as HTMLButtonElement;
        button.textContent = "Added";
        button.disabled = true;
      });
    });
  }
}
