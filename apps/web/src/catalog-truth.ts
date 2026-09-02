import { CATALOG_ONLY_TYPES, partByType, type ComponentType } from "@opencircuit/circuit-schema";

/**
 * One place decides which symbol a reviewed package may be placed on. The
 * catalog uses it to count placeable packages, and the netlist writer uses it
 * to reject a package driving the wrong symbol, so the two can never drift.
 */
export interface CatalogSymbolPinRecord { name?: string; number: string; role: string }
export interface CatalogSpicePinRecord { symbol_pin_number: string; subckt_node: string; order: number }
export interface CatalogTruthManifest {
  canonical_mpn: string;
  manufacturer: string;
  electrical_family: string;
  model_type: string;
  symbol_pins?: CatalogSymbolPinRecord[];
  spice_pin_mapping?: CatalogSpicePinRecord[];
}

/** The seven families that shipped with a hand-drawn KiCad symbol. */
const LEGACY_TYPE_BY_FAMILY: Readonly<Partial<Record<string, ComponentType>>> = Object.freeze({
  diode: "diode", led: "led", bjt_npn: "bjt_npn", bjt_pnp: "bjt_pnp",
  nmos: "nmos", pmos: "pmos", opamp: "opamp_ideal",
});

const IC_BLOCK_PIN_COUNTS: readonly number[] = [2, 3, 4, 5, 6, 8, 9, 14, 16];

const TIMER_555_NODES = ["gnd", "trig", "out", "reset", "cont", "thres", "disch", "vcc"];
const COMPARATOR_NODES = ["inp", "inn", "out", "vcc", "gnd"];
const JFET_NODES = ["drain", "gate", "source"];
const OPTOCOUPLER_NODES = ["anode", "cathode"];

const same = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * The subcircuit node order the package declares, lowest mapping order first.
 * Returns undefined when the mapping is not a contiguous one-based bijection of
 * the declared symbol pins, which is exactly the shape the netlist writer needs.
 */
export function declaredNodeOrder(manifest: CatalogTruthManifest): string[] | undefined {
  const symbolPins = manifest.symbol_pins;
  const mapping = manifest.spice_pin_mapping;
  if (!Array.isArray(symbolPins) || symbolPins.length === 0) return undefined;
  if (!Array.isArray(mapping) || mapping.length !== symbolPins.length) return undefined;
  const numbers = new Set(symbolPins.map((pin) => pin.number));
  if (numbers.size !== symbolPins.length) return undefined;
  const ordered = [...mapping].sort((left, right) => left.order - right.order);
  const seen = new Set<string>();
  const nodes: string[] = [];
  for (const [index, entry] of ordered.entries()) {
    if (entry.order !== index + 1) return undefined;
    if (!numbers.has(entry.symbol_pin_number) || seen.has(entry.symbol_pin_number)) return undefined;
    if (typeof entry.subckt_node !== "string" || !entry.subckt_node.trim()) return undefined;
    seen.add(entry.symbol_pin_number);
    nodes.push(entry.subckt_node.trim().toLowerCase());
  }
  return nodes;
}

/** The symbol pin names in the package's declared subcircuit order. */
export function declaredPinNames(manifest: CatalogTruthManifest): string[] {
  const symbolPins = manifest.symbol_pins ?? [];
  const byNumber = new Map(symbolPins.map((pin) => [pin.number, pin]));
  return [...(manifest.spice_pin_mapping ?? [])]
    .sort((left, right) => left.order - right.order)
    .map((entry) => {
      const pin = byNumber.get(entry.symbol_pin_number);
      return pin?.name?.trim() || entry.subckt_node.toUpperCase();
    });
}

export function baseTypeForManifest(manifest: CatalogTruthManifest): ComponentType | undefined {
  const legacy = LEGACY_TYPE_BY_FAMILY[manifest.electrical_family];
  if (legacy) return legacy;
  const nodes = declaredNodeOrder(manifest);
  if (!nodes) return undefined;
  const family = manifest.electrical_family;
  if (family === "timer" && same(nodes, TIMER_555_NODES)) return "timer_555";
  if (family === "comparator" && same(nodes, COMPARATOR_NODES)) return "comparator";
  if (family === "jfet_n" && manifest.model_type === "dot_model" && same(nodes, JFET_NODES)) return "jfet_n";
  if (family === "vreg_linear" && nodes.length === 3 && nodes[0] === "in" && nodes[1] === "out" && (nodes[2] === "gnd" || nodes[2] === "adj")) return "vreg_linear_3";
  if (manifest.model_type === "dot_model" && same(nodes, OPTOCOUPLER_NODES)) return "optocoupler_led";
  // Everything else that is still a plain subcircuit gets a labelled block whose
  // pins are the subcircuit nodes in order. A primitive .model with an
  // unrecognised terminal set stays reference-only: no block can name its pins.
  if (manifest.model_type !== "subckt") return undefined;
  const blockType = `ic_block_${nodes.length}` as ComponentType;
  return IC_BLOCK_PIN_COUNTS.includes(nodes.length) && CATALOG_ONLY_TYPES.has(blockType) ? blockType : undefined;
}

/**
 * A catalog-only symbol addresses its package positionally: schematic pin i is
 * subcircuit node i. Legacy symbols keep their role-matched mapping.
 */
export function isPositionalCatalogType(type: ComponentType | undefined): boolean {
  return type !== undefined && CATALOG_ONLY_TYPES.has(type);
}

export function symbolPinCountFor(type: ComponentType): number {
  return partByType(type).pins.length;
}

export type CatalogAnalysis = "operating_point" | "dc_sweep" | "transient" | "ac_small_signal" | "noise";
export const CATALOG_ANALYSIS_ORDER: readonly CatalogAnalysis[] = ["operating_point", "dc_sweep", "transient", "ac_small_signal", "noise"];
export const CATALOG_ANALYSIS_LABELS: Readonly<Record<CatalogAnalysis, string>> = Object.freeze({
  operating_point: "op", dc_sweep: "DC sweep", transient: "transient", ac_small_signal: "AC", noise: "noise",
});

export interface CatalogSearchable {
  manifest: {
    canonical_mpn: string;
    manufacturer: string;
    electrical_family: string;
    description: string;
    fidelity_tier: string;
    supported_analyses?: string[];
    ordering_code_aliases?: string[];
  };
  placeable: boolean;
}

export interface CatalogFilters {
  placeableOnly: boolean;
  tiers: readonly string[];
  analyses: readonly string[];
}

export const EMPTY_CATALOG_FILTERS: CatalogFilters = Object.freeze({ placeableOnly: false, tiers: [], analyses: [] });

/** Lower is better. undefined means the part does not match the query at all. */
export interface CatalogMatch { rank: number; offset: number }

export function catalogMatch(part: CatalogSearchable, query: string): CatalogMatch | undefined {
  const needle = query.trim().toLowerCase();
  if (!needle) return { rank: 0, offset: 0 };
  const mpn = part.manifest.canonical_mpn.toLowerCase();
  const aliases = (part.manifest.ordering_code_aliases ?? []).map((alias) => alias.toLowerCase());
  if (mpn === needle) return { rank: 0, offset: 0 };
  if (aliases.includes(needle)) return { rank: 1, offset: 0 };
  if (mpn.startsWith(needle)) return { rank: 2, offset: 0 };
  const aliasPrefix = aliases.find((alias) => alias.startsWith(needle));
  if (aliasPrefix !== undefined) return { rank: 3, offset: 0 };
  const mpnIndex = mpn.indexOf(needle);
  if (mpnIndex >= 0) return { rank: 4, offset: mpnIndex };
  const aliasIndex = aliases.map((alias) => alias.indexOf(needle)).filter((index) => index >= 0).sort((left, right) => left - right)[0];
  if (aliasIndex !== undefined) return { rank: 5, offset: aliasIndex };
  const haystacks = [part.manifest.manufacturer, part.manifest.electrical_family, part.manifest.description];
  const offsets = haystacks.map((value) => value.toLowerCase().indexOf(needle)).filter((index) => index >= 0);
  if (offsets.length) return { rank: 6, offset: Math.min(...offsets) };
  return undefined;
}

export function matchesCatalogFilters(part: CatalogSearchable, filters: CatalogFilters): boolean {
  if (filters.placeableOnly && !part.placeable) return false;
  if (filters.tiers.length && !filters.tiers.some((tier) => part.manifest.fidelity_tier.startsWith(tier))) return false;
  if (filters.analyses.length) {
    const supported = part.manifest.supported_analyses ?? [];
    if (!filters.analyses.every((analysis) => supported.includes(analysis))) return false;
  }
  return true;
}

export function rankCatalogParts<T extends CatalogSearchable>(parts: readonly T[], query: string, filters: CatalogFilters = EMPTY_CATALOG_FILTERS): T[] {
  const scored: { part: T; match: CatalogMatch }[] = [];
  for (const part of parts) {
    if (!matchesCatalogFilters(part, filters)) continue;
    const match = catalogMatch(part, query);
    if (match) scored.push({ part, match });
  }
  return scored
    .sort((left, right) => left.match.rank - right.match.rank
      || left.match.offset - right.match.offset
      || left.part.manifest.canonical_mpn.length - right.part.manifest.canonical_mpn.length
      || left.part.manifest.canonical_mpn.localeCompare(right.part.manifest.canonical_mpn, undefined, { numeric: true }))
    .map((entry) => entry.part);
}

export interface ModelDefinitionSelection { name: string; ports: readonly string[] }

/**
 * Picks the entry point of a model file. Multi-stage logic packages define
 * helper subcircuits alongside the part, so taking the first .subckt would
 * instantiate an output buffer instead of the device. The entry point is the
 * definition nothing else instantiates.
 */
export function selectModelDefinition(source: string, modelType: string): ModelDefinitionSelection | undefined {
  const folded = source.replace(/\r/g, "").replace(/\n\s*\+\s*/g, " ");
  if (modelType !== "subckt") {
    const name = folded.match(/^\s*\.model\s+(\S+)/im)?.[1];
    return name ? { name, ports: [] } : undefined;
  }
  const definitions = new Map<string, string[]>();
  for (const match of folded.matchAll(/^[ \t]*\.subckt[ \t]+(\S+)([^\n]*)$/gim)) {
    const ports: string[] = [];
    for (const token of match[2]!.trim().split(/\s+/)) {
      if (!token || /^params:/i.test(token) || token.includes("=")) break;
      ports.push(token);
    }
    definitions.set(match[1]!, ports);
  }
  if (definitions.size === 0) return undefined;
  if (definitions.size === 1) {
    const [name, ports] = [...definitions][0]!;
    return { name, ports };
  }
  const instantiated = new Set<string>();
  for (const line of folded.split("\n")) {
    if (!/^[ \t]*x/i.test(line)) continue;
    for (const token of line.trim().split(/\s+/).slice(1)) {
      for (const name of definitions.keys()) if (token.toLowerCase() === name.toLowerCase()) instantiated.add(name);
    }
  }
  const roots = [...definitions.keys()].filter((name) => !instantiated.has(name));
  const chosen = roots.length === 1 ? roots[0]! : undefined;
  return chosen ? { name: chosen, ports: definitions.get(chosen)! } : undefined;
}
