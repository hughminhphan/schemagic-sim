import {
  CATALOG_ONLY_PRIMITIVE_PREFIX,
  CATALOG_ONLY_TYPES,
  componentPinPoints,
  generateNetlist,
  type AnalysisMode,
  type CircuitComponent,
  type CircuitDocument,
  type GeneratedNetlist,
  type ComponentType,
  type NetlistLine,
  partByType,
} from "@opencircuit/circuit-schema";

export interface CatalogSymbolPin { name?: string; number: string; role: string }
export interface CatalogSpicePinMapping { symbol_pin_number: string; subckt_node: string; order: number }
export interface CatalogModelManifest {
  canonical_mpn: string;
  manufacturer: string;
  electrical_family: string;
  model_type: "dot_model" | "subckt" | string;
  symbol_pins?: CatalogSymbolPin[];
  spice_pin_mapping?: CatalogSpicePinMapping[];
  supported_analyses?: string[];
}

export interface CatalogRuntimePart {
  id: string;
  manifest: CatalogModelManifest;
  /** Symbol the catalog resolved for this package; a component must name the same type. */
  baseType: ComponentType | undefined;
  modelSource?: string;
  modelName?: string;
  manifestValid?: boolean;
  reviewed?: boolean;
  placeable?: boolean;
  blockReasons?: readonly string[];
  detailState?: "unloaded" | "loaded" | "failed";
}

export type CatalogRuntimeIssueCode =
  | "INVALID_ID" | "MISSING_PART" | "FAMILY_MISMATCH" | "NOT_PLACEABLE" | "DETAILS_NOT_LOADED"
  | "MISSING_MODEL" | "PIN_MAPPING" | "UNSUPPORTED_ANALYSIS" | "MODEL_TYPE";

export interface CatalogRuntimeIssue {
  code: CatalogRuntimeIssueCode;
  componentId: string;
  partId?: string;
  message: string;
}

export class CatalogRuntimeError extends Error {
  constructor(readonly issue: CatalogRuntimeIssue) {
    super(issue.message);
    this.name = "CatalogRuntimeError";
  }
}

/**
 * A catalog-only symbol addresses its package positionally: schematic pin i is
 * subcircuit node i. Legacy symbols keep their role-matched mapping.
 */
const isPositionalCatalogType = (type: ComponentType): boolean => CATALOG_ONLY_TYPES.has(type);
const symbolPinCountFor = (type: ComponentType): number => partByType(type).pins.length;

type CatalogSupplyRole = "vcc" | "vee";

export interface CatalogVirtualConnection {
  componentId: string;
  pinIndex: number;
  role: CatalogSupplyRole;
}

interface CatalogIndex {
  byId: ReadonlyMap<string, CatalogRuntimePart>;
  byMpn: ReadonlyMap<string, CatalogRuntimePart>;
  components: ReadonlyMap<string, CircuitComponent>;
}

interface ResolvedCatalogComponent {
  component: CircuitComponent;
  part: CatalogRuntimePart;
  supplyBindings: Partial<Record<CatalogSupplyRole, CatalogVirtualConnection>>;
}


export const CATALOG_ANALYSIS_BY_MODE: Readonly<Record<AnalysisMode, string>> = Object.freeze({
  live: "operating_point",
  op: "operating_point",
  "dc-sweep": "dc_sweep",
  tran: "transient",
  ac: "ac_small_signal",
  noise: "noise",
});

function catalogIndex(document: CircuitDocument, parts: readonly CatalogRuntimePart[]): CatalogIndex {
  return {
    byId: new Map(parts.map((part) => [part.id, part])),
    byMpn: new Map(parts.map((part) => [part.manifest.canonical_mpn, part])),
    components: new Map(document.components.map((component) => [component.id, component])),
  };
}

function supplyBinding(rawBindings: unknown, role: CatalogSupplyRole, components: ReadonlyMap<string, CircuitComponent>): CatalogVirtualConnection | undefined {
  if (!rawBindings || typeof rawBindings !== "object" || Array.isArray(rawBindings)) return undefined;
  const candidate = (rawBindings as Record<string, unknown>)[role];
  if (!Array.isArray(candidate) || candidate.length !== 2) return undefined;
  const [componentId, pinIndex] = candidate;
  if (typeof componentId !== "string" || typeof pinIndex !== "number" || !Number.isInteger(pinIndex) || pinIndex < 0) return undefined;
  const target = components.get(componentId);
  if (!target) return undefined;
  try { if (pinIndex >= componentPinPoints(target).length) return undefined; }
  catch { return undefined; }
  return { componentId, pinIndex, role };
}

function identity(component: CircuitComponent, index: CatalogIndex): { part?: CatalogRuntimePart; issue?: CatalogRuntimeIssue; tagged: boolean } {
  const hasCatalogId = component.params !== undefined && Object.prototype.hasOwnProperty.call(component.params, "catalogPartId");
  if (hasCatalogId) {
    const value = component.params?.catalogPartId;
    if (typeof value !== "string" || !value.trim()) return { tagged: true, issue: { code: "INVALID_ID", componentId: component.id, message: `Component ${component.id} has an invalid catalogPartId; choose a bundled catalog package again` } };
    const part = index.byId.get(value);
    return part
      ? { tagged: true, part }
      : { tagged: true, issue: { code: "MISSING_PART", componentId: component.id, partId: value, message: `Component ${component.id} references catalog package ${value}, which is not bundled in this build` } };
  }
  const part = typeof component.mpn === "string" ? index.byMpn.get(component.mpn) : undefined;
  return part ? { tagged: true, part } : { tagged: false };
}

function resolveCatalogComponent(component: CircuitComponent, index: CatalogIndex): ResolvedCatalogComponent | undefined {
  const found = identity(component, index);
  const part = found.part;
  if (!part || part.baseType !== component.type) return undefined;
  const rawBindings = component.type === "opamp_ideal" ? component.params?.catalogSupplyBindings : undefined;
  const vcc = supplyBinding(rawBindings, "vcc", index.components);
  const vee = supplyBinding(rawBindings, "vee", index.components);
  return { component, part, supplyBindings: { ...(vcc ? { vcc } : {}), ...(vee ? { vee } : {}) } };
}

function safeSuffix(id: string): string { return id.replace(/\D/g, "") || id.replace(/[^a-z0-9]/gi, ""); }
function bindingNode(binding: CatalogVirtualConnection | undefined, generated: GeneratedNetlist): string | undefined {
  return binding ? generated.componentNodes[binding.componentId]?.[binding.pinIndex] : undefined;
}

function canonicalRole(role: string): string | undefined {
  const normalized = role.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const aliases: Record<string, string> = {
    a: "anode", anode: "anode", k: "cathode", cathode: "cathode",
    c: "collector", collector: "collector", b: "base", base: "base", e: "emitter", emitter: "emitter",
    d: "drain", drain: "drain", g: "gate", gate: "gate", s: "source", source: "source",
    noninverting_input: "inp", non_inverting_input: "inp", inp: "inp",
    inverting_input: "inn", inn: "inn", output: "out", out: "out",
    positive_supply: "vcc", vcc: "vcc", negative_supply: "vee", vee: "vee",
  };
  return aliases[normalized];
}

function semanticNode(role: string, resolved: ResolvedCatalogComponent, generated: GeneratedNetlist, supportLines: string[]): string | undefined {
  const nodes = generated.componentNodes[resolved.component.id] ?? [];
  const suffix = safeSuffix(resolved.component.id);
  const indexes: Record<string, number> = {
    anode: 0, cathode: 1, collector: 0, base: 1, emitter: 2, drain: 0, gate: 1, source: 2,
    inp: 0, inn: 1, out: 2,
  };
  const normalized = canonicalRole(role);
  if (!normalized) return undefined;
  const pinIndex = indexes[normalized];
  if (pinIndex !== undefined) return nodes[pinIndex];
  if (normalized === "vcc" || normalized === "vee") {
    const bound = bindingNode(resolved.supplyBindings[normalized], generated);
    if (bound) return bound;
    const node = `oc_${suffix}_${normalized}`;
    const sourceName = normalized === "vcc" ? `VOC${suffix}P` : `VOC${suffix}N`;
    const voltage = normalized === "vcc" ? "15" : "-15";
    const line = `${sourceName} ${node} 0 ${voltage} $ component:${resolved.component.id}`;
    if (!supportLines.includes(line)) supportLines.push(line);
    return node;
  }
  return undefined;
}

function mappedNodes(resolved: ResolvedCatalogComponent, generated: GeneratedNetlist, supportLines: string[]): string[] | CatalogRuntimeIssue {
  const { component, part } = resolved;
  const symbolPins = part.manifest.symbol_pins;
  const mapping = part.manifest.spice_pin_mapping;
  const issue = (message: string): CatalogRuntimeIssue => ({ code: "PIN_MAPPING", componentId: component.id, partId: part.id, message: `Component ${component.id} (${part.manifest.canonical_mpn}) ${message}` });
  if (!Array.isArray(symbolPins) || symbolPins.length === 0) return issue("is missing declared symbol_pins");
  if (!Array.isArray(mapping) || mapping.length === 0) return issue("is missing declared spice_pin_mapping");
  if (mapping.length !== symbolPins.length) return issue("does not have a complete symbol-to-SPICE pin mapping");
  const byNumber = new Map(symbolPins.map((pin) => [pin.number, pin]));
  if (byNumber.size !== symbolPins.length) return issue("declares duplicate symbol pin numbers");
  const ordered = [...mapping].sort((left, right) => left.order - right.order);
  if (isPositionalCatalogType(component.type)) {
    const positional = positionalShapeIssue(component, part);
    if (positional) return positional;
    // Schematic pin i is subcircuit node i, so the emitted order is the
    // package's declared order with nothing to reinterpret.
    return (generated.componentNodes[component.id] ?? []).slice(0, ordered.length);
  }
  const seenPins = new Set<string>();
  const nodes: string[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index]!;
    if (entry.order !== index + 1) return issue("must use contiguous one-based mapping.order values");
    if (seenPins.has(entry.symbol_pin_number)) return issue(`maps symbol pin ${entry.symbol_pin_number} more than once`);
    seenPins.add(entry.symbol_pin_number);
    const pin = byNumber.get(entry.symbol_pin_number);
    const pinRole = pin ? canonicalRole(pin.role) : undefined;
    const spiceRole = canonicalRole(entry.subckt_node);
    if (!pin || !pinRole || !spiceRole || pinRole !== spiceRole) return issue(`cannot match symbol pin ${entry.symbol_pin_number} role to mapping order ${entry.order}`);
    const node = semanticNode(pinRole, resolved, generated, supportLines);
    if (!node) return issue(`cannot resolve mapping order ${entry.order} to a simulator semantic pin`);
    nodes.push(node);
  }
  return nodes;
}

function analysisMode(generated: GeneratedNetlist): AnalysisMode {
  if (/^\.noise\s/im.test(generated.netlist)) return "noise";
  if (/^\.ac\s/im.test(generated.netlist)) return "ac";
  if (/^\.tran\s/im.test(generated.netlist)) return "tran";
  if (/^\.dc\s/im.test(generated.netlist)) return "dc-sweep";
  return "op";
}

/**
 * A catalog-only symbol addresses its package positionally, so the only shape
 * that matters is a contiguous one-based bijection whose length is the symbol's
 * pin count. Getting that wrong would silently rewire the device.
 */
function positionalShapeIssue(component: CircuitComponent, part: CatalogRuntimePart): CatalogRuntimeIssue | undefined {
  const symbolPins = part.manifest.symbol_pins ?? [];
  const mapping = part.manifest.spice_pin_mapping ?? [];
  const issue = (message: string): CatalogRuntimeIssue => ({ code: "PIN_MAPPING", componentId: component.id, partId: part.id, message: `Component ${component.id} (${part.manifest.canonical_mpn}) ${message}` });
  const expected = symbolPinCountFor(component.type);
  if (mapping.length !== expected) return issue(`declares ${mapping.length} subcircuit nodes but the ${component.type} symbol has ${expected} pins`);
  const numbers = new Set(symbolPins.map((pin) => pin.number));
  const seen = new Set<string>();
  for (const [index, entry] of [...mapping].sort((left, right) => left.order - right.order).entries()) {
    if (entry.order !== index + 1) return issue("must use contiguous one-based mapping.order values");
    if (!numbers.has(entry.symbol_pin_number)) return issue(`SPICE mapping references missing symbol pin ${entry.symbol_pin_number}`);
    if (seen.has(entry.symbol_pin_number)) return issue(`maps symbol pin ${entry.symbol_pin_number} more than once`);
    seen.add(entry.symbol_pin_number);
  }
  return undefined;
}

function mappingShapeIssue(component: CircuitComponent, part: CatalogRuntimePart): CatalogRuntimeIssue | undefined {
  const symbolPins = part.manifest.symbol_pins;
  const mapping = part.manifest.spice_pin_mapping;
  const issue = (message: string): CatalogRuntimeIssue => ({ code: "PIN_MAPPING", componentId: component.id, partId: part.id, message: `Component ${component.id} (${part.manifest.canonical_mpn}) ${message}` });
  if (!Array.isArray(symbolPins) || symbolPins.length === 0) return issue("is missing declared symbol_pins");
  if (!Array.isArray(mapping) || mapping.length === 0) return issue("is missing declared spice_pin_mapping");
  if (mapping.length !== symbolPins.length) return issue("does not have a complete symbol-to-SPICE pin mapping");
  const byNumber = new Map(symbolPins.map((pin) => [pin.number, pin]));
  if (byNumber.size !== symbolPins.length) return issue("declares duplicate symbol pin numbers");
  if (isPositionalCatalogType(component.type)) return positionalShapeIssue(component, part);
  const seenPins = new Set<string>();
  for (const [index, entry] of [...mapping].sort((left, right) => left.order - right.order).entries()) {
    const pin = byNumber.get(entry.symbol_pin_number);
    if (entry.order !== index + 1) return issue("must use contiguous one-based mapping.order values");
    if (seenPins.has(entry.symbol_pin_number)) return issue(`maps symbol pin ${entry.symbol_pin_number} more than once`);
    seenPins.add(entry.symbol_pin_number);
    if (!pin || canonicalRole(pin.role) !== canonicalRole(entry.subckt_node) || !canonicalRole(pin.role)) return issue(`cannot match symbol pin ${entry.symbol_pin_number} role to mapping order ${entry.order}`);
  }
  return undefined;
}

export function inspectCatalogModels(document: CircuitDocument, mode: AnalysisMode, parts: readonly CatalogRuntimePart[]): CatalogRuntimeIssue[] {
  const index = catalogIndex(document, parts);
  const issues: CatalogRuntimeIssue[] = [];
  for (const component of document.components) {
    const found = identity(component, index);
    if (found.issue) { issues.push(found.issue); continue; }
    const part = found.part;
    if (!part) continue;
    const label = `Component ${component.id} (${part.manifest.canonical_mpn})`;
    if (part.baseType !== component.type) {
      issues.push({ code: "FAMILY_MISMATCH", componentId: component.id, partId: part.id, message: `${label} is a ${part.manifest.electrical_family} package and cannot drive a ${component.type} symbol` });
      continue;
    }
    if (part.manifestValid === false || part.reviewed === false || part.placeable === false) {
      const reason = part.blockReasons?.[0] ?? "the package is not valid and placeable";
      issues.push({ code: "NOT_PLACEABLE", componentId: component.id, partId: part.id, message: `${label} is blocked: ${reason}` });
      continue;
    }
    if (part.detailState && part.detailState !== "loaded") {
      issues.push({ code: "DETAILS_NOT_LOADED", componentId: component.id, partId: part.id, message: `${label} model details are not loaded; await preloadCatalogPartsForDocument(document) before simulation` });
      continue;
    }
    if (!part.modelSource?.trim() || !part.modelName?.trim()) {
      issues.push({ code: "MISSING_MODEL", componentId: component.id, partId: part.id, message: `${label} has no usable loaded model source or selected definition` });
      continue;
    }
    const requested = CATALOG_ANALYSIS_BY_MODE[mode];
    if (!Array.isArray(part.manifest.supported_analyses) || !part.manifest.supported_analyses.includes(requested)) {
      issues.push({ code: "UNSUPPORTED_ANALYSIS", componentId: component.id, partId: part.id, message: `${label} does not declare support for ${requested}; choose a supported analysis or another package` });
      continue;
    }
    if (part.manifest.model_type !== "dot_model" && part.manifest.model_type !== "subckt") {
      issues.push({ code: "MODEL_TYPE", componentId: component.id, partId: part.id, message: `${label} declares unsupported model type ${part.manifest.model_type}` });
      continue;
    }
    const mapIssue = mappingShapeIssue(component, part);
    if (mapIssue) issues.push(mapIssue);
  }
  return issues;
}

function catalogLine(resolved: ResolvedCatalogComponent, generated: GeneratedNetlist): { line: string; supportLines: string[] } | CatalogRuntimeIssue {
  const { component, part } = resolved;
  const supportLines: string[] = [];
  const nodes = mappedNodes(resolved, generated, supportLines);
  if (!Array.isArray(nodes)) return nodes;
  const suffix = safeSuffix(component.id);
  if (part.manifest.model_type === "subckt") return { line: `X${suffix} ${nodes.join(" ")} ${part.modelName} $ component:${component.id}`, supportLines };
  const catalogOnlyPrefix = CATALOG_ONLY_PRIMITIVE_PREFIX[component.type];
  if (catalogOnlyPrefix) return { line: `${catalogOnlyPrefix}${suffix} ${nodes.join(" ")} ${part.modelName} $ component:${component.id}`, supportLines };
  switch (component.type) {
    case "diode":
    case "led": return { line: `D${suffix} ${nodes.join(" ")} ${part.modelName} $ component:${component.id}`, supportLines };
    case "bjt_npn":
    case "bjt_pnp": return { line: `Q${suffix} ${nodes.join(" ")} ${part.modelName} $ component:${component.id}`, supportLines };
    case "nmos":
    case "pmos": {
      const source = semanticNode("source", resolved, generated, supportLines);
      return source
        ? { line: `M${suffix} ${nodes.join(" ")} ${source} ${part.modelName} $ component:${component.id}`, supportLines }
        : { code: "PIN_MAPPING", componentId: component.id, partId: part.id, message: `Component ${component.id} (${part.manifest.canonical_mpn}) cannot map the MOS bulk terminal to source` };
    }
    default: return { code: "MODEL_TYPE", componentId: component.id, partId: part.id, message: `Component ${component.id} (${part.manifest.canonical_mpn}) requires a subcircuit model` };
  }
}

export function catalogVirtualConnections(document: CircuitDocument, parts: readonly CatalogRuntimePart[]): readonly CatalogVirtualConnection[] {
  const index = catalogIndex(document, parts);
  const connections: CatalogVirtualConnection[] = [];
  for (const component of document.components) {
    const resolved = resolveCatalogComponent(component, index);
    if (!resolved || resolved.component.type !== "opamp_ideal") continue;
    for (const role of ["vcc", "vee"] as const) {
      const binding = resolved.supplyBindings[role];
      if (binding) connections.push(binding);
    }
  }
  return connections;
}

export function applyCatalogModels(document: CircuitDocument, generatedInput: GeneratedNetlist, parts: readonly CatalogRuntimePart[]): GeneratedNetlist {
  const issues = inspectCatalogModels(document, analysisMode(generatedInput), parts);
  if (issues[0]) throw new CatalogRuntimeError(issues[0]);
  const generated = { ...generatedInput, componentCurrents: { ...generatedInput.componentCurrents } };
  const catalog = catalogIndex(document, parts);
  const lines = generated.netlist.trimEnd().split("\n");
  const used = new Map<string, CatalogRuntimePart>();
  const supportLines: string[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const componentId = lines[lineIndex]?.match(/\$ component:([^\s]+)/)?.[1];
    const component = componentId ? catalog.components.get(componentId) : undefined;
    const resolved = component ? resolveCatalogComponent(component, catalog) : undefined;
    if (!resolved) continue;
    const replacement = catalogLine(resolved, generated);
    if (!("line" in replacement)) throw new CatalogRuntimeError(replacement);
    lines[lineIndex] = replacement.line;
    supportLines.push(...replacement.supportLines);
    used.set(resolved.part.id, resolved.part);
    if (resolved.part.manifest.model_type === "subckt") {
      const staleCurrent = generated.componentCurrents[resolved.component.id];
      if (staleCurrent) {
        const saveIndex = lines.findIndex((line) => line.startsWith(".save "));
        if (saveIndex >= 0) lines[saveIndex] = lines[saveIndex]!.replace(` ${staleCurrent}`, "");
        delete generated.componentCurrents[resolved.component.id];
      }
    }
  }
  if (used.size === 0) return generated;
  const libraryLines = [...used.values()].sort((left, right) => left.id.localeCompare(right.id)).flatMap((part) => [
    `* catalog model: ${part.manifest.manufacturer} ${part.manifest.canonical_mpn}`,
    ...part.modelSource!.trimEnd().split("\n"),
  ]);
  const inserted = [...libraryLines, ...supportLines];
  lines.splice(2, 0, ...inserted);
  const insertedMap: NetlistLine[] = inserted.map((_, index) => ({ line: index + 3, stage: "model" }));
  const lineMap = [...generated.lineMap.slice(0, 2), ...insertedMap, ...generated.lineMap.slice(2)].map((entry, index) => ({ ...entry, line: index + 1 }));
  return { ...generated, netlist: `${lines.join("\n")}\n`, lineMap };
}

export function generateNetlistWithCatalog(document: CircuitDocument, mode: AnalysisMode | undefined, parts: readonly CatalogRuntimePart[]): GeneratedNetlist {
  return applyCatalogModels(document, generateNetlist(document, mode), parts);
}
