import type { ComponentType } from "@opencircuit/circuit-schema";
import type { CatalogRuntimePart } from "./catalog-netlist";

interface SourceRecord { kind?: string; url?: string; revision?: string; accessed_date?: string }
interface ValidationResults {
  native_wasm_all_pass?: boolean;
  expectations_all_pass?: boolean;
  expectation_pass_count?: number;
  expectation_fail_count?: number;
  benches?: Array<{ test_netlist?: string; analysis?: string; native_wasm_pass?: boolean }>;
}
export interface CatalogManifest {
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
  datasheet?: { url?: string; revision?: string };
  test_results?: { status?: string; pass_count?: number; fail_count?: number; total_count?: number };
}
export interface CatalogPart extends CatalogRuntimePart {
  manifest: CatalogManifest;
  manufacturerSlug: string;
  mpnSlug: string;
  modelCard: string;
  sources: SourceRecord[];
  validation: ValidationResults;
  baseType: ComponentType | undefined;
  githubUrl: string;
}

const componentFiles = import.meta.glob("../../../packages/model-library/models/**/component.json", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const modelFiles = import.meta.glob("../../../packages/model-library/models/**/model.cir", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const cardFiles = import.meta.glob("../../../packages/model-library/models/**/MODEL_CARD.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const sourceFiles = import.meta.glob("../../../packages/model-library/models/**/sources.json", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const validationFiles = import.meta.glob("../../../packages/model-library/models/**/validation-results.json", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

const parse = <T>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const sibling = (componentPath: string, name: string) => componentPath.replace(/component\.json$/, name);
const baseTypeForFamily = (family: string): ComponentType | undefined => ({
  diode: "diode", led: "led", bjt_npn: "bjt_npn", bjt_pnp: "bjt_pnp",
  nmos: "nmos", pmos: "pmos", opamp: "opamp_ideal",
} as Partial<Record<string, ComponentType>>)[family];
const modelName = (source: string): string => source.match(/^\s*\.model\s+(\S+)/im)?.[1]
  ?? source.match(/^\s*\.subckt\s+(\S+)/im)?.[1]
  ?? "";

export const CATALOG_PARTS: readonly CatalogPart[] = Object.entries(componentFiles).flatMap(([path, raw]) => {
  const manifest = parse<CatalogManifest | undefined>(raw, undefined);
  if (!manifest?.canonical_mpn) return [];
  const match = path.match(/\/models\/([^/]+)\/([^/]+)\/component\.json$/);
  if (!match) return [];
  const manufacturerSlug = match[1]!;
  const mpnSlug = match[2]!;
  const modelSource = modelFiles[sibling(path, "model.cir")] ?? "";
  return [{
    id: `${manufacturerSlug}/${mpnSlug}`,
    manufacturerSlug,
    mpnSlug,
    manifest,
    modelSource,
    modelName: modelName(modelSource),
    modelCard: cardFiles[sibling(path, "MODEL_CARD.md")] ?? "# Model card unavailable",
    sources: parse<SourceRecord[]>(sourceFiles[sibling(path, "sources.json")], []),
    validation: parse<ValidationResults>(validationFiles[sibling(path, "validation-results.json")], {}),
    baseType: baseTypeForFamily(manifest.electrical_family),
    githubUrl: `https://github.com/hughminhphan/schemagic-sim/tree/main/packages/model-library/models/${manufacturerSlug}/${mpnSlug}`,
  }];
}).sort((a, b) => a.manifest.canonical_mpn.localeCompare(b.manifest.canonical_mpn, undefined, { numeric: true }));

export function catalogPart(idOrMpn: string | undefined): CatalogPart | undefined {
  if (!idOrMpn) return undefined;
  return CATALOG_PARTS.find((part) => part.id === idOrMpn || part.manifest.canonical_mpn === idOrMpn);
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

export class CatalogDialog {
  private readonly overlay: HTMLDivElement;
  private readonly list: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly search: HTMLInputElement;

  constructor(private readonly onPlace: (part: CatalogPart) => void) {
    this.overlay = document.createElement("div");
    this.overlay.className = "overlay catalog-overlay";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `<section class="catalog-sheet" role="dialog" aria-modal="true" aria-label="Component catalog"><header><div><strong>COMPONENT CATALOG</strong><span>${CATALOG_PARTS.length} reviewed models, bundled at build time</span></div><button data-close-catalog>Close</button></header><div class="catalog-layout"><aside class="catalog-index"><label for="catalog-search">Search MPN, maker or family</label><input id="catalog-search" type="search" placeholder="2N3904"/><div class="catalog-list"></div></aside><article class="catalog-detail"></article></div></section>`;
    document.body.append(this.overlay);
    this.list = this.overlay.querySelector<HTMLElement>(".catalog-list")!;
    this.detail = this.overlay.querySelector<HTMLElement>(".catalog-detail")!;
    this.search = this.overlay.querySelector<HTMLInputElement>("#catalog-search")!;
    this.overlay.querySelector("[data-close-catalog]")?.addEventListener("click", () => this.close());
    this.search.addEventListener("input", () => this.renderList());
    this.renderList();
    if (CATALOG_PARTS[0]) this.show(CATALOG_PARTS[0].id);
  }

  open(partId?: string): void {
    this.overlay.hidden = false;
    if (partId) this.show(partId);
    this.search.focus();
  }

  close(): void { this.overlay.hidden = true; }

  show(partId: string): void {
    const part = catalogPart(partId);
    if (!part) return;
    this.detail.innerHTML = `<div class="catalog-hero"><div><span class="catalog-maker">${esc(part.manifest.manufacturer)}</span><h2>${esc(part.manifest.canonical_mpn)}</h2><p>${esc(part.manifest.description)}</p></div><span class="fidelity fidelity-large">${esc(part.manifest.fidelity_tier)}</span></div><div class="coverage-grid" aria-label="Domain coverage">${coverageMarkup(part)}</div><div class="catalog-actions"><button class="primary-button" data-place-catalog="${esc(part.id)}" ${part.baseType && part.modelSource && part.modelName ? "" : "disabled"}>Place ${esc(part.manifest.canonical_mpn)}</button><a href="${part.githubUrl}" target="_blank" rel="noreferrer">View model source and tests on GitHub</a></div><section class="catalog-facts"><h3>Provenance</h3>${part.manifest.datasheet?.url ? `<a href="${esc(part.manifest.datasheet.url)}" target="_blank" rel="noreferrer">Datasheet${part.manifest.datasheet.revision ? `, ${esc(part.manifest.datasheet.revision)}` : ""}</a>` : "<p>No datasheet URL recorded.</p>"}${part.sources.filter((source) => source.url && source.url !== part.manifest.datasheet?.url).map((source) => `<a href="${esc(source.url!)}" target="_blank" rel="noreferrer">${esc(source.kind ?? "Source")}</a>`).join("")}<h3>Known omissions</h3><ul>${(part.manifest.known_omissions ?? ["None recorded."]).map((item) => `<li>${esc(item)}</li>`).join("")}</ul><h3>Test summary</h3><p>${part.manifest.test_results?.pass_count ?? part.validation.expectation_pass_count ?? 0} passed, ${part.manifest.test_results?.fail_count ?? part.validation.expectation_fail_count ?? 0} failed. Native and WASM agreement: ${part.validation.native_wasm_all_pass ? "pass" : "not recorded"}.</p></section><section class="model-card-rendered" data-testid="model-card">${renderMarkdown(part.modelCard)}</section>`;
    this.detail.querySelector<HTMLButtonElement>("[data-place-catalog]")?.addEventListener("click", () => { this.onPlace(part); this.close(); });
    this.list.querySelectorAll("[data-catalog-part]").forEach((row) => row.classList.toggle("selected", (row as HTMLElement).dataset.catalogPart === part.id));
    this.detail.scrollTop = 0;
  }

  private renderList(): void {
    const query = this.search.value.trim().toLowerCase();
    const visible = CATALOG_PARTS.filter((part) => !query || [part.manifest.canonical_mpn, part.manifest.manufacturer, part.manifest.electrical_family, part.manifest.description].some((value) => value.toLowerCase().includes(query)));
    this.list.innerHTML = visible.map((part) => `<button class="catalog-row" data-catalog-part="${esc(part.id)}"><span><strong>${esc(part.manifest.canonical_mpn)}</strong><small>${esc(part.manifest.manufacturer)} · ${esc(part.manifest.electrical_family)}</small></span><span class="fidelity">${esc(part.manifest.fidelity_tier)}</span><span class="catalog-row-coverage">${Object.entries(part.manifest.domain_coverage).filter(([, value]) => value !== "none").map(([domain]) => esc(domain)).join(" · ")}</span></button>`).join("") || `<p class="catalog-empty">No matching models.</p>`;
    this.list.querySelectorAll<HTMLButtonElement>("[data-catalog-part]").forEach((button) => button.addEventListener("click", () => this.show(button.dataset.catalogPart!)));
  }
}
