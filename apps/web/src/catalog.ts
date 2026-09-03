import type { CircuitDocument, ComponentType } from "@opencircuit/circuit-schema";
import type { CatalogRuntimePart } from "./catalog-netlist";
import {
  CATALOG_ANALYSIS_LABELS,
  CATALOG_ANALYSIS_ORDER,
  EMPTY_CATALOG_FILTERS,
  baseTypeForManifest,
  declaredPinNames,
  isPositionalCatalogType,
  rankCatalogParts,
  selectModelDefinition,
  symbolPinCountFor,
  type CatalogAnalysis,
  type CatalogFilters,
} from "./catalog-truth";

export interface SourceRecord { kind?: string; url?: string; revision?: string; accessed_date?: string }
export interface ValidationResults {
  native_wasm_all_pass?: boolean;
  expectations_all_pass?: boolean;
  expectation_pass_count?: number;
  expectation_fail_count?: number;
  benches?: Array<{ test_netlist?: string; analysis?: string; native_wasm_pass?: boolean }>;
}
export interface CatalogManifest {
  schema_version?: string;
  canonical_mpn: string;
  manufacturer: string;
  description: string;
  electrical_family: string;
  model_type: string;
  fidelity_tier: string;
  domain_coverage: Record<string, string>;
  supported_analyses?: string[];
  supported_operating_region?: { summary?: string };
  known_omissions?: string[];
  ordering_code_aliases?: string[];
  symbol_pins?: Array<{ name?: string; number: string; role: string }>;
  spice_pin_mapping?: Array<{ symbol_pin_number: string; subckt_node: string; order: number }>;
  datasheet?: { url?: string; revision?: string };
  test_results?: { status?: string; pass_count?: number; fail_count?: number; total_count?: number };
  reviewer?: { tool_or_agent?: string; date?: string };
  validation_date?: string;
}
export interface CatalogPart extends CatalogRuntimePart {
  manifest: CatalogManifest;
  manufacturerSlug: string;
  mpnSlug: string;
  modelSource?: string;
  modelName?: string;
  modelCard?: string;
  sources?: SourceRecord[];
  validation?: ValidationResults;
  manifestValid: boolean;
  reviewed: boolean;
  placeable: boolean;
  blockReasons: string[];
  detailState: "unloaded" | "loaded" | "failed";
  baseType: ComponentType | undefined;
  githubUrl: string;
}

const componentFiles = import.meta.glob("../../../packages/model-library/models/**/component.json", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const modelFiles = import.meta.glob("../../../packages/model-library/models/**/model.cir", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const cardFiles = import.meta.glob("../../../packages/model-library/models/**/MODEL_CARD.md", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const sourceFiles = import.meta.glob("../../../packages/model-library/models/**/sources.json", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const validationFiles = import.meta.glob("../../../packages/model-library/models/**/validation-results.json", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;

const parse = <T>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const sibling = (componentPath: string, name: string) => componentPath.replace(/component\.json$/, name);

/**
 * Packages whose own validation-results.json records a native/WASM disagreement.
 * That file is loaded lazily, so this eager gate is asserted against the library
 * on disk in catalog-bijection.test.ts and cannot drift from stored validation.
 */
export const CATALOG_NATIVE_WASM_DISAGREEMENT: readonly string[] = Object.freeze([]);

function manifestTruth(manifest: CatalogManifest, baseType: ComponentType | undefined, id: string): { valid: boolean; reviewed: boolean; placeable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (CATALOG_NATIVE_WASM_DISAGREEMENT.includes(id)) reasons.push("Recorded native and WASM results disagree for this package");
  if (!manifest.canonical_mpn.trim()) reasons.push("Canonical MPN is missing");
  if (!manifest.manufacturer.trim()) reasons.push("Manufacturer is missing");
  if (!manifest.electrical_family.trim()) reasons.push("Electrical family is missing");
  const reviewed = manifest.test_results?.status === "complete"
    && manifest.test_results.fail_count === 0
    && Boolean(manifest.reviewer?.tool_or_agent && manifest.reviewer.date && manifest.validation_date);
  if (!reviewed) reasons.push("Package review or zero-failure test record is incomplete");
  if (!baseType) reasons.push(`No placeable symbol exists for a ${manifest.spice_pin_mapping?.length ?? 0}-terminal ${manifest.model_type} package in the ${manifest.electrical_family} family`);
  const symbolPins = manifest.symbol_pins;
  const mapping = manifest.spice_pin_mapping;
  if (!Array.isArray(symbolPins) || symbolPins.length === 0) reasons.push("Declared symbol_pins are missing");
  if (!Array.isArray(mapping) || mapping.length === 0) reasons.push("Declared spice_pin_mapping is missing");
  if (symbolPins && mapping) {
    const numbers = new Set(symbolPins.map((pin) => pin.number));
    const mapped = new Set<string>();
    const orders = new Set<number>();
    for (const entry of mapping) {
      if (!numbers.has(entry.symbol_pin_number)) reasons.push(`SPICE mapping references missing symbol pin ${entry.symbol_pin_number}`);
      if (mapped.has(entry.symbol_pin_number)) reasons.push(`Symbol pin ${entry.symbol_pin_number} is mapped more than once`);
      if (!Number.isInteger(entry.order) || entry.order < 1 || orders.has(entry.order)) reasons.push(`SPICE mapping order ${entry.order} is invalid or duplicated`);
      mapped.add(entry.symbol_pin_number);
      orders.add(entry.order);
    }
    if (mapping.length !== symbolPins.length || mapped.size !== symbolPins.length) reasons.push("SPICE mapping must be a complete symbol-pin bijection");
    if (baseType && isPositionalCatalogType(baseType) && mapping.length !== symbolPinCountFor(baseType)) reasons.push(`Declared ${mapping.length} subcircuit nodes do not fill the ${symbolPinCountFor(baseType)} pins of the ${baseType} symbol`);
  }
  const valid = reasons.every((reason) => reason.startsWith("No placeable symbol exists") || reason.startsWith("Recorded native and WASM"));
  return { valid, reviewed, placeable: reviewed && Boolean(baseType) && valid && !CATALOG_NATIVE_WASM_DISAGREEMENT.includes(id), reasons };
}

export const CATALOG_PARTS: readonly CatalogPart[] = Object.entries(componentFiles).flatMap(([path, raw]) => {
  const manifest = parse<CatalogManifest | undefined>(raw, undefined);
  if (!manifest?.canonical_mpn) return [];
  const match = path.match(/\/models\/([^/]+)\/([^/]+)\/component\.json$/);
  if (!match) return [];
  const manufacturerSlug = match[1]!;
  const mpnSlug = match[2]!;
  const baseType = baseTypeForManifest(manifest);
  const truth = manifestTruth(manifest, baseType, `${manufacturerSlug}/${mpnSlug}`);
  return [{
    id: `${manufacturerSlug}/${mpnSlug}`,
    manufacturerSlug,
    mpnSlug,
    manifest,
    manifestValid: truth.valid,
    reviewed: truth.reviewed,
    placeable: truth.placeable,
    blockReasons: truth.reasons,
    detailState: "unloaded" as const,
    baseType,
    githubUrl: `https://github.com/hughminhphan/schemagic-sim/tree/main/packages/model-library/models/${manufacturerSlug}/${mpnSlug}`,
  }];
}).sort((a, b) => a.manifest.canonical_mpn.localeCompare(b.manifest.canonical_mpn, undefined, { numeric: true }));

export const CATALOG_REVIEWED_COUNT = CATALOG_PARTS.filter((part) => part.reviewed).length;
export const CATALOG_PLACEABLE_COUNT = CATALOG_PARTS.filter((part) => part.placeable).length;
export const CATALOG_REFERENCE_ONLY_COUNT = CATALOG_PARTS.filter((part) => part.reviewed && !part.placeable).length;
export const CATALOG_NONPLACEABLE_BREAKDOWN: Readonly<Record<string, number>> = Object.freeze(Object.fromEntries(
  [...new Set(CATALOG_PARTS.filter((part) => !part.placeable).map((part) => part.manifest.electrical_family))]
    .sort()
    .map((family) => [family, CATALOG_PARTS.filter((part) => !part.placeable && part.manifest.electrical_family === family).length]),
));

export const CATALOG_EAGER_PAYLOAD_CONTRACT = Object.freeze({
  manifestCount: Object.keys(componentFiles).length,
  eagerManifestBytes: Object.values(componentFiles).reduce((total, source) => total + new TextEncoder().encode(source).byteLength, 0),
  eagerDetailCount: 0,
  lazyModelCount: Object.keys(modelFiles).length,
  lazyModelCardCount: Object.keys(cardFiles).length,
  lazySourcesCount: Object.keys(sourceFiles).length,
  lazyValidationCount: Object.keys(validationFiles).length,
});

export function catalogPart(idOrMpn: string | undefined): CatalogPart | undefined {
  if (!idOrMpn) return undefined;
  return CATALOG_PARTS.find((part) => part.id === idOrMpn || part.manifest.canonical_mpn === idOrMpn);
}

const detailPromises = new Map<string, Promise<CatalogPart>>();

export function preloadCatalogPart(idOrMpn: string): Promise<CatalogPart> {
  const part = catalogPart(idOrMpn);
  if (!part) return Promise.reject(new Error(`Catalog package ${idOrMpn} is not bundled in this build`));
  if (part.detailState === "loaded") return Promise.resolve(part);
  const current = detailPromises.get(part.id);
  if (current) return current;
  const componentPath = Object.keys(componentFiles).find((path) => path.endsWith(`/models/${part.manufacturerSlug}/${part.mpnSlug}/component.json`));
  if (!componentPath) return Promise.reject(new Error(`Catalog package ${part.id} has no manifest resource`));
  const load = async (files: Record<string, () => Promise<string>>, name: string): Promise<string> => {
    const loader = files[sibling(componentPath, name)];
    if (!loader) throw new Error(`Catalog package ${part.id} is missing ${name}`);
    return loader();
  };
  const promise = Promise.all([
    load(modelFiles, "model.cir"),
    load(cardFiles, "MODEL_CARD.md"),
    load(sourceFiles, "sources.json"),
    load(validationFiles, "validation-results.json"),
  ]).then(([modelSource, modelCard, sourcesRaw, validationRaw]) => {
    const validation = parse<ValidationResults>(validationRaw, {});
    const runtimeReasons: string[] = [];
    const definition = selectModelDefinition(modelSource, part.manifest.model_type);
    const emittedName = definition?.name ?? "";
    if (!modelSource.trim() || !emittedName) runtimeReasons.push("Model source has no single unambiguous .model or .subckt entry point");
    const declaredNodes = part.manifest.spice_pin_mapping?.length ?? 0;
    if (definition && part.manifest.model_type === "subckt" && definition.ports.length !== declaredNodes) {
      runtimeReasons.push(`Subcircuit ${definition.name} takes ${definition.ports.length} nodes but the package declares ${declaredNodes}`);
    }
    if (validation.native_wasm_all_pass !== true || validation.expectations_all_pass !== true || validation.expectation_fail_count !== 0) runtimeReasons.push("Native/WASM or expectation validation is not all-pass");
    part.modelSource = modelSource;
    part.modelName = emittedName;
    part.modelCard = modelCard;
    part.sources = parse<SourceRecord[]>(sourcesRaw, []);
    part.validation = validation;
    part.detailState = "loaded";
    part.blockReasons = [...new Set([...part.blockReasons, ...runtimeReasons])];
    part.placeable = part.placeable && runtimeReasons.length === 0;
    return part;
  }).catch((error: unknown) => {
    part.detailState = "failed";
    part.placeable = false;
    part.blockReasons = [...new Set([...part.blockReasons, error instanceof Error ? error.message : String(error)])];
    throw error;
  });
  detailPromises.set(part.id, promise);
  return promise;
}

export async function preloadCatalogPartsForDocument(document: Pick<CircuitDocument, "components">): Promise<readonly CatalogPart[]> {
  const ids = new Set<string>();
  for (const component of document.components) {
    const hasExplicit = component.params && Object.prototype.hasOwnProperty.call(component.params, "catalogPartId");
    const explicit = hasExplicit ? component.params?.catalogPartId : undefined;
    if (typeof explicit === "string") ids.add(explicit);
    else if (!hasExplicit && typeof component.mpn === "string" && catalogPart(component.mpn)) ids.add(component.mpn);
  }
  return Promise.all([...ids].sort().map(preloadCatalogPart));
}

const esc = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const inlineMarkdown = (value: string) => esc(value)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r/g, "").split("\n");
  const html: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) { index += 1; continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { const level = Math.min(4, heading[1]!.length + 1); html.push(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`); index += 1; continue; }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while ((lines[index] ?? "").startsWith("|")) {
        rows.push((lines[index] ?? "").split("|").slice(1, -1).map((cell) => cell.trim())); index += 1;
      }
      const clean = rows.filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell)));
      if (clean.length) html.push(`<div class="model-table-wrap"><table><thead><tr>${clean[0]!.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${clean.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (/^-\s+/.test(lines[index] ?? "")) { items.push(`<li>${inlineMarkdown((lines[index] ?? "").replace(/^-\s+/, ""))}</li>`); index += 1; }
      html.push(`<ul>${items.join("")}</ul>`); continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && (lines[index] ?? "").trim() && !/^(#{1,4})\s+/.test(lines[index] ?? "") && !(lines[index] ?? "").startsWith("|") && !/^-\s+/.test(lines[index] ?? "")) {
      paragraph.push((lines[index] ?? "").trim()); index += 1;
    }
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
  }
  return html.join("");
}

function coverageMarkup(part: CatalogPart): string {
  return Object.entries(part.manifest.domain_coverage ?? {}).map(([domain, coverage]) => `<span class="coverage-chip coverage-${esc(coverage)}"><b>${esc(domain)}</b>${esc(coverage)}</span>`).join("");
}

function analysisSummary(part: CatalogPart): string {
  const declared = part.manifest.supported_analyses ?? [];
  const supported = CATALOG_ANALYSIS_ORDER.filter((analysis) => declared.includes(analysis));
  if (!supported.length) return "This package declares no supported analyses, so it cannot be simulated.";
  return `Supported analyses: ${supported.map((analysis) => CATALOG_ANALYSIS_LABELS[analysis]).join(", ")}.`;
}

function pinOrderMarkup(part: CatalogPart): string {
  const names = declaredPinNames(part.manifest);
  if (!names.length) return "";
  return `<p class="catalog-pin-order">Pin order: ${names.map((name, index) => `${index + 1}&nbsp;${esc(name)}`).join(" · ")}</p>`;
}

/** Chips are the only place the catalog narrows the list, so they carry the filter vocabulary. */
const FILTER_CHIPS: readonly { key: string; label: string; title: string }[] = [
  { key: "placeable", label: "Placeable", title: "Only packages that can be placed on a symbol" },
  { key: "tier:F1", label: "F1", title: "Fidelity tier F1" },
  { key: "tier:F2", label: "F2", title: "Fidelity tier F2" },
  ...CATALOG_ANALYSIS_ORDER.map((analysis) => ({
    key: `analysis:${analysis}`,
    label: CATALOG_ANALYSIS_LABELS[analysis],
    title: `Declares support for ${CATALOG_ANALYSIS_LABELS[analysis]}`,
  })),
];

const LIST_CHUNK = 60;

export class CatalogDialog {
  private readonly overlay: HTMLDivElement;
  private readonly list: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly summary: HTMLElement;
  private readonly active = new Set<string>();
  private visible: readonly CatalogPart[] = CATALOG_PARTS;
  private renderedRows = 0;
  private selectedId: string | undefined;
  private showRevision = 0;

  constructor(private readonly onPlace: (part: CatalogPart) => void) {
    this.overlay = document.createElement("div");
    this.overlay.className = "overlay catalog-overlay";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `<section class="catalog-sheet" role="dialog" aria-modal="true" aria-label="Component catalog"><header><div><strong>COMPONENT CATALOG</strong><span>${CATALOG_REVIEWED_COUNT} reviewed · ${CATALOG_PLACEABLE_COUNT} placeable · ${CATALOG_REFERENCE_ONLY_COUNT} reference-only</span></div><button data-close-catalog>Close</button></header><div class="catalog-layout"><aside class="catalog-index"><label for="catalog-search">Search MPN, maker or family</label><input id="catalog-search" type="search" placeholder="2N3904"/><div class="catalog-filters" role="group" aria-label="Catalog filters">${FILTER_CHIPS.map((chip) => `<button type="button" class="filter-chip" data-filter="${esc(chip.key)}" aria-pressed="false" title="${esc(chip.title)}">${esc(chip.label)}</button>`).join("")}<span class="catalog-summary" data-catalog-summary aria-live="polite"></span></div><div class="catalog-list" tabindex="-1"></div></aside><article class="catalog-detail"></article></div></section>`;
    document.body.append(this.overlay);
    this.list = this.overlay.querySelector<HTMLElement>(".catalog-list")!;
    this.detail = this.overlay.querySelector<HTMLElement>(".catalog-detail")!;
    this.search = this.overlay.querySelector<HTMLInputElement>("#catalog-search")!;
    this.summary = this.overlay.querySelector<HTMLElement>("[data-catalog-summary]")!;
    this.overlay.querySelector("[data-close-catalog]")?.addEventListener("click", () => this.close());
    this.search.addEventListener("input", () => this.renderList());
    // One delegated handler and one scroll handler keep 771 rows cheap: rows are
    // appended in chunks, so nothing per-row is bound or laid out up front.
    this.list.addEventListener("click", (event) => {
      const row = (event.target as Element | null)?.closest<HTMLElement>("[data-catalog-part]");
      if (row?.dataset.catalogPart) void this.show(row.dataset.catalogPart);
    });
    this.list.addEventListener("scroll", () => {
      if (this.list.scrollTop + this.list.clientHeight >= this.list.scrollHeight - 320) this.renderChunk();
    });
    for (const chip of this.overlay.querySelectorAll<HTMLButtonElement>("[data-filter]")) {
      chip.addEventListener("click", () => {
        const key = chip.dataset.filter!;
        if (this.active.has(key)) this.active.delete(key);
        else this.active.add(key);
        chip.setAttribute("aria-pressed", String(this.active.has(key)));
        this.renderList();
      });
    }
    this.renderList();
    if (this.visible[0]) void this.show(this.visible[0].id);
  }

  open(partId?: string): void {
    this.overlay.hidden = false;
    if (partId) void this.show(partId);
    this.search.focus();
  }

  close(): void { this.overlay.hidden = true; }

  private filters(): CatalogFilters {
    return {
      ...EMPTY_CATALOG_FILTERS,
      placeableOnly: this.active.has("placeable"),
      tiers: [...this.active].filter((key) => key.startsWith("tier:")).map((key) => key.slice(5)),
      analyses: [...this.active].filter((key) => key.startsWith("analysis:")).map((key) => key.slice(9) as CatalogAnalysis),
    };
  }

  async show(partId: string): Promise<void> {
    const part = catalogPart(partId);
    if (!part) return;
    const revision = ++this.showRevision;
    this.selectedId = part.id;
    this.detail.innerHTML = `<div class="catalog-hero"><div><span class="catalog-maker">${esc(part.manifest.manufacturer)}</span><h2>${esc(part.manifest.canonical_mpn)}</h2><p>${esc(part.manifest.description)}</p></div><span class="fidelity fidelity-large">${esc(part.manifest.fidelity_tier)}</span></div><p class="catalog-analyses">${esc(analysisSummary(part))}</p><div class="coverage-grid" aria-label="Domain coverage">${coverageMarkup(part)}</div><p>Loading package model card and validation…</p>`;
    this.markSelection();
    try { await preloadCatalogPart(part.id); } catch { /* The actionable block reason is rendered below. */ }
    if (revision !== this.showRevision) return;
    const reasons = part.blockReasons.length ? `<div class="honesty-note"><strong>Placement blocked</strong><ul>${part.blockReasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul></div>` : "";
    const sources = part.sources ?? [];
    const validation = part.validation ?? {};
    const omissions = part.manifest.known_omissions ?? [];
    this.detail.innerHTML = `<div class="catalog-hero"><div><span class="catalog-maker">${esc(part.manifest.manufacturer)}</span><h2>${esc(part.manifest.canonical_mpn)}</h2><p>${esc(part.manifest.description)}</p></div><span class="fidelity fidelity-large">${esc(part.manifest.fidelity_tier)}</span></div><p class="catalog-analyses" data-testid="supported-analyses">${esc(analysisSummary(part))}</p><div class="coverage-grid" aria-label="Domain coverage">${coverageMarkup(part)}</div>${reasons}<div class="catalog-actions"><button class="primary-button" data-place-catalog="${esc(part.id)}" ${part.placeable && part.baseType && part.modelSource && part.modelName ? "" : "disabled"}>Place ${esc(part.manifest.canonical_mpn)}</button><a href="${part.githubUrl}" target="_blank" rel="noreferrer">View model source and tests on GitHub</a></div><section class="catalog-facts"><h3>Provenance</h3>${part.manifest.datasheet?.url ? `<a href="${esc(part.manifest.datasheet.url)}" target="_blank" rel="noreferrer">Datasheet${part.manifest.datasheet.revision ? `, ${esc(part.manifest.datasheet.revision)}` : ""}</a>` : "<p>No datasheet URL recorded.</p>"}${sources.filter((source) => source.url && source.url !== part.manifest.datasheet?.url).map((source) => `<a href="${esc(source.url!)}" target="_blank" rel="noreferrer">${esc(source.kind ?? "Source")}</a>`).join("")}${pinOrderMarkup(part)}<h3>Test summary</h3><p>${part.manifest.test_results?.pass_count ?? validation.expectation_pass_count ?? 0} passed, ${part.manifest.test_results?.fail_count ?? validation.expectation_fail_count ?? 0} failed. Native and WASM agreement: ${validation.native_wasm_all_pass ? "pass" : "not recorded"}.</p><details class="catalog-omissions" data-testid="known-omissions"><summary>Known omissions (${omissions.length})</summary><ul>${(omissions.length ? omissions : ["None recorded."]).map((item) => `<li>${esc(item)}</li>`).join("")}</ul></details></section><section class="model-card-rendered" data-testid="model-card">${renderMarkdown(part.modelCard ?? "# Model card unavailable")}</section>`;
    this.detail.querySelector<HTMLButtonElement>("[data-place-catalog]")?.addEventListener("click", () => { this.onPlace(part); this.close(); });
    this.detail.scrollTop = 0;
  }

  private markSelection(): void {
    for (const row of this.list.querySelectorAll<HTMLElement>("[data-catalog-part]")) {
      row.classList.toggle("selected", row.dataset.catalogPart === this.selectedId);
    }
  }

  private rowMarkup(part: CatalogPart): string {
    const coverage = Object.entries(part.manifest.domain_coverage).filter(([, value]) => value !== "none").map(([domain]) => esc(domain)).join(" · ");
    const status = part.placeable ? "" : `<span class="catalog-row-status">reference-only</span>`;
    return `<button class="catalog-row${part.id === this.selectedId ? " selected" : ""}" data-catalog-part="${esc(part.id)}"><span><strong>${esc(part.manifest.canonical_mpn)}</strong><small>${esc(part.manifest.manufacturer)} · ${esc(part.manifest.electrical_family)}</small></span><span class="fidelity">${esc(part.manifest.fidelity_tier)}</span><span class="catalog-row-coverage">${coverage}${status}</span></button>`;
  }

  private renderChunk(): void {
    if (this.renderedRows >= this.visible.length) return;
    const next = this.visible.slice(this.renderedRows, this.renderedRows + LIST_CHUNK);
    this.renderedRows += next.length;
    this.list.insertAdjacentHTML("beforeend", next.map((part) => this.rowMarkup(part)).join(""));
  }

  private renderList(): void {
    this.visible = rankCatalogParts(CATALOG_PARTS, this.search.value, this.filters());
    this.renderedRows = 0;
    this.list.scrollTop = 0;
    this.list.innerHTML = this.visible.length ? "" : `<p class="catalog-empty">No matching models.</p>`;
    this.summary.textContent = `${this.visible.length} of ${CATALOG_PARTS.length} shown`;
    this.renderChunk();
  }
}
