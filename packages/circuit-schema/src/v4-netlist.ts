import { emitNamespacedLibrary, parseSpiceLibrary, sanitize } from "@opencircuit/model-import";
import { fnv1a64 } from "./canonical";
import { interimModels } from "./netlist";
import { componentPinPointsV4 } from "./parts";
import { engineeringValueNumber, hasUnpairedSurrogate } from "./spice-token";
import {
  canonicalCircuitNumber,
  canonicalizeV4SimulationProjection,
  circuitV4SerializationHash,
  compareCircuitV4Tokens,
  detachedCircuitV4Snapshot,
  sha256Hex,
} from "./v4-canonical";
import { assertValidCircuitV4 } from "./v4-validation";
import type {
  CircuitComponentV4,
  CircuitContractFailureCode,
  CircuitContractIssue,
  CircuitDocumentV4,
  CircuitGraphV4,
  CircuitProbeV4,
  DesignBlockDefinition,
  EngineeringValue,
  GeneratedScenarioNetlist,
  NetlistLine,
  NetlistOmission,
  Point,
  ScenarioNetlistOptions,
  SimulationScenarioV4,
  TrustedSubcircuitRef,
} from "./types";
import { CircuitNetlistError } from "./types";

export const DESIGN_BLOCK_MODEL_VERIFICATION = {
  maxInputBytes: 1_048_576,
  maxIncludeDepth: 0,
  maxSubcktDepth: 32,
  preserveComments: false,
} as const;

const MAX_NETLIST_BYTES = 1_048_576;

interface VerifiedAsset {
  ref: TrustedSubcircuitRef;
  canonicalText: string;
  emittedText: string;
  emittedEntrypoint: string;
  derivedEntrypoint: string;
  pinCount: number;
  introducedNames: string[];
}

type RegistryResolver = (ref: TrustedSubcircuitRef) => unknown;

function fail(code: CircuitContractFailureCode, path: string, message: string, context: Partial<CircuitContractIssue> = {}): never {
  throw new CircuitNetlistError({ code, path, message, ...context });
}

function refKey(ref: TrustedSubcircuitRef): string {
  return `${ref.assetId}\0${ref.contentHash}\0${ref.entrypoint}`;
}

function exactRef(left: TrustedSubcircuitRef, right: TrustedSubcircuitRef): boolean {
  return left.assetId === right.assetId && left.contentHash === right.contentHash && left.entrypoint === right.entrypoint;
}

function frozenRefSnapshot(ref: TrustedSubcircuitRef): TrustedSubcircuitRef {
  const snapshot = Object.create(null) as TrustedSubcircuitRef;
  Object.defineProperties(snapshot, {
    assetId: { value: ref.assetId, enumerable: true },
    contentHash: { value: ref.contentHash, enumerable: true },
    entrypoint: { value: ref.entrypoint, enumerable: true },
  });
  Object.freeze(snapshot);
  return new Proxy(snapshot, {
    set() { throw new TypeError("Trusted model request refs are immutable snapshots"); },
    defineProperty() { throw new TypeError("Trusted model request refs are immutable snapshots"); },
    deleteProperty() { throw new TypeError("Trusted model request refs are immutable snapshots"); },
    setPrototypeOf() { throw new TypeError("Trusted model request refs are immutable snapshots"); },
  });
}

function captureResolver(options: ScenarioNetlistOptions, context: Partial<CircuitContractIssue>): RegistryResolver | undefined {
  try {
    const registry = options.registry;
    if (registry === undefined) return undefined;
    const resolve = registry.resolve;
    if (typeof resolve !== "function") fail("TRUSTED_MODEL_RESOLUTION_FAILED", "registry.resolve", "Trusted model registry resolve must be a function", context);
    return (ref) => Reflect.apply(resolve, registry, [ref]) as unknown;
  } catch {
    fail("TRUSTED_MODEL_RESOLUTION_FAILED", "registry.resolve", "Trusted model registry resolver could not be captured", context);
  }
}

function resolveAssetSnapshot(
  resolver: RegistryResolver | undefined,
  ref: TrustedSubcircuitRef,
  context: Partial<CircuitContractIssue>,
): { ref: TrustedSubcircuitRef; canonicalText: unknown } | undefined {
  if (!resolver) return undefined;
  const request = frozenRefSnapshot(ref);
  let returned: unknown;
  try {
    returned = resolver(request);
  } catch {
    fail("TRUSTED_MODEL_RESOLUTION_FAILED", "registry.resolve", "Trusted model registry resolution failed", context);
  }
  if (returned === undefined) return undefined;
  try {
    if (returned === null || typeof returned !== "object") fail("TRUSTED_MODEL_RESOLUTION_FAILED", "registry", "Trusted model registry returned a non-object asset", context);
    const owned = returned as Record<string, unknown>;
    const returnedRef = owned.ref;
    if (returnedRef === null || typeof returnedRef !== "object") fail("TRUSTED_MODEL_RESOLUTION_FAILED", "registry.ref", "Trusted model registry returned a non-object ref", context);
    const refRecord = returnedRef as Record<string, unknown>;
    const assetId = refRecord.assetId;
    const contentHash = refRecord.contentHash;
    const entrypoint = refRecord.entrypoint;
    const canonicalText = owned.canonicalText;
    const refSnapshot = Object.create(null) as TrustedSubcircuitRef;
    Object.defineProperties(refSnapshot, {
      assetId: { value: assetId, enumerable: true },
      contentHash: { value: contentHash, enumerable: true },
      entrypoint: { value: entrypoint, enumerable: true },
    });
    return { ref: Object.freeze(refSnapshot), canonicalText };
  } catch (error) {
    if (error instanceof CircuitNetlistError) throw error;
    fail("TRUSTED_MODEL_RESOLUTION_FAILED", "registry", "Trusted model registry asset could not be snapshotted", context);
  }
}

function verifyAsset(
  ref: TrustedSubcircuitRef,
  expectedPinCount: number,
  resolver: RegistryResolver | undefined,
  context: Partial<CircuitContractIssue>,
): VerifiedAsset {
  const returned = resolveAssetSnapshot(resolver, ref, context);
  if (!returned) fail("TRUSTED_MODEL_NOT_FOUND", "registry", `Trusted model asset ${ref.assetId} was not found`, context);
  if (typeof returned.ref.assetId !== "string" || typeof returned.ref.contentHash !== "string" || typeof returned.ref.entrypoint !== "string" || !exactRef(returned.ref, ref)) {
    fail("TRUSTED_MODEL_REF_MISMATCH", "registry.ref", "Registry returned metadata that differs from the exact requested ref", context);
  }
  const text = returned.canonicalText;
  if (typeof text !== "string" || text.startsWith("\ufeff") || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(text) || text.includes("\r") || hasUnpairedSurrogate(text) || !text.endsWith("\n") || text.endsWith("\n\n")) {
    fail("TRUSTED_MODEL_NOT_CANONICAL", "registry.canonicalText", "Trusted model must be scalar UTF-8 text with LF endings and exactly one final LF", context);
  }
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > DESIGN_BLOCK_MODEL_VERIFICATION.maxInputBytes) fail("EXECUTION_LIMIT", "registry.canonicalText", "Trusted model exceeds the 1 MiB input limit", context);

  let parsed: ReturnType<typeof parseSpiceLibrary>;
  try {
    parsed = parseSpiceLibrary(text, {
      filename: "trusted-model.lib",
      maxInputBytes: DESIGN_BLOCK_MODEL_VERIFICATION.maxInputBytes,
      maxIncludeDepth: DESIGN_BLOCK_MODEL_VERIFICATION.maxIncludeDepth,
      maxSubcktDepth: DESIGN_BLOCK_MODEL_VERIFICATION.maxSubcktDepth,
    });
  } catch (error) {
    fail("TRUSTED_MODEL_UNSAFE", "registry.canonicalText", error instanceof Error ? error.message : String(error), context);
  }
  if (parsed.warnings.length > 0) fail("TRUSTED_MODEL_UNSAFE", "registry.canonicalText", parsed.warnings[0]!.message, context);
  if (parsed.statements.some((statement) => statement.kind === "lib-section-start" || statement.kind === "lib-section-end")) {
    fail("TRUSTED_MODEL_UNSAFE", "registry.canonicalText", ".lib sections are not executable in generated scenario netlists", context);
  }
  const sanitized = sanitize(parsed, { preserveComments: DESIGN_BLOCK_MODEL_VERIFICATION.preserveComments });
  if (sanitized.blockedReasons.length > 0 || sanitized.removed.length > 0) {
    fail("TRUSTED_MODEL_UNSAFE", "registry.canonicalText", sanitized.blockedReasons[0]?.message ?? sanitized.removed[0]?.reason ?? "Trusted model contains blocked content", context);
  }
  if (sanitized.cleanText !== text) fail("TRUSTED_MODEL_NOT_CANONICAL", "registry.canonicalText", "Trusted model bytes do not equal the fixed-option sanitizer output", context);

  const topLevel = parsed.subckts.filter((subckt) => subckt.parentSubckt === undefined && subckt.librarySection === undefined);
  if (topLevel.length !== 1 || topLevel[0]!.name !== ref.entrypoint) fail("TRUSTED_MODEL_ENTRYPOINT_INVALID", "registry.ref.entrypoint", "Trusted model must contain exactly one matching top-level subcircuit", context);
  const pinCount = topLevel[0]!.pins.length;
  if (pinCount !== expectedPinCount) fail("TRUSTED_MODEL_PIN_MISMATCH", "registry.canonicalText", `Derived pin count ${pinCount} does not match block pin order ${expectedPinCount}`, context);
  if (`sha256:${sha256Hex(text)}` !== ref.contentHash) fail("TRUSTED_MODEL_HASH_MISMATCH", "registry.ref.contentHash", "Trusted model bytes do not match the pinned SHA-256", context);

  const namespace = `ocblk_${ref.contentHash.slice("sha256:".length)}`;
  const emitted = emitNamespacedLibrary(parsed, namespace);
  if (emitted.blockedReasons.length > 0 || emitted.removed.length > 0) fail("TRUSTED_MODEL_UNSAFE", "registry.canonicalText", "Namespaced model emission was not lossless", context);
  const emittedEntrypoint = emitted.subcktNames[ref.entrypoint.toLowerCase()];
  if (!emittedEntrypoint) fail("TRUSTED_MODEL_ENTRYPOINT_INVALID", "registry.ref.entrypoint", "Namespaced entrypoint could not be derived", context);
  const introducedNames = [
    ...Object.values(emitted.modelNames),
    ...Object.values(emitted.subcktNames),
  ];
  return {
    ref,
    canonicalText: text,
    emittedText: emitted.text,
    emittedEntrypoint,
    derivedEntrypoint: topLevel[0]!.name,
    pinCount,
    introducedNames,
  };
}

export function assertNoVerifiedAssetCollision(existing: Pick<VerifiedAsset, "canonicalText" | "derivedEntrypoint">, incoming: Pick<VerifiedAsset, "canonicalText" | "derivedEntrypoint">): void {
  if (existing.canonicalText !== incoming.canonicalText || existing.derivedEntrypoint !== incoming.derivedEntrypoint) {
    fail("TRUSTED_MODEL_HASH_COLLISION", "registry.ref.contentHash", "Equal trusted-model hashes resolved to different verified bytes or entrypoints");
  }
}

function definitionKey(definition: Pick<DesignBlockDefinition, "id" | "version" | "contentHash">): string {
  return `${definition.id}\0${definition.version}\0${definition.contentHash}`;
}

function componentHexId(id: string): string {
  return [...new TextEncoder().encode(id)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function elementPrefix(type: CircuitComponentV4["type"]): string | undefined {
  if (type === "ground") return undefined;
  if (["resistor", "switch_spst", "potentiometer"].includes(type)) return "R";
  if (type === "capacitor") return "C";
  if (type === "inductor") return "L";
  if (["vsource", "vsource_pulse", "vsource_sine"].includes(type)) return "V";
  if (["isource", "isource_pulse"].includes(type)) return "I";
  if (["diode", "led"].includes(type)) return "D";
  if (["bjt_npn", "bjt_pnp"].includes(type)) return "Q";
  if (["nmos", "pmos"].includes(type)) return "M";
  return "X";
}

function baseElementName(component: CircuitComponentV4): string | undefined {
  const prefix = elementPrefix(component.type);
  return prefix ? `${prefix}oc_${componentHexId(component.id)}` : undefined;
}

function spice(value: EngineeringValue | number): string {
  return typeof value === "number" ? canonicalCircuitNumber(value).toString() : value;
}

class UnionFind {
  private readonly parents = new Map<string, string>();
  add(key: string): void { if (!this.parents.has(key)) this.parents.set(key, key); }
  find(key: string): string {
    this.add(key);
    const parent = this.parents.get(key)!;
    if (parent === key) return key;
    const root = this.find(parent);
    this.parents.set(key, root);
    return root;
  }
  union(left: string, right: string): void {
    const a = this.find(left);
    const b = this.find(right);
    if (a !== b) this.parents.set(b, a);
  }
}

const pointKey = ([x, y]: Point): string => `${x},${y}`;

function add(lines: string[], lineMap: NetlistLine[], text: string, entry: Omit<NetlistLine, "line">): void {
  for (const part of text.split("\n")) {
    lines.push(entry.componentId ? `${part} $ component:${entry.componentId}` : part);
    lineMap.push({ line: lines.length, ...entry });
  }
}

function probeNode(probe: CircuitProbeV4, componentNodes: Record<string, string[]>, componentPinNodes: Record<string, Record<string, string>>, wireNodes: Record<string, string>): string | undefined {
  if ("wire" in probe.target) return wireNodes[probe.target.wire];
  if ("componentPin" in probe.target) {
    const [componentId, pin] = probe.target.componentPin;
    return componentPinNodes[componentId]?.[String(pin)] ?? (typeof pin === "number" ? componentNodes[componentId]?.[pin] : undefined);
  }
  return probe.target.node;
}

function simulationComponent(component: CircuitComponentV4): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: component.id,
    type: component.type,
    pos: component.pos,
    rot: component.rot,
    mirror: component.mirror,
  };
  if (component.mpn !== undefined) result.mpn = component.mpn;
  if ("value" in component) result.value = component.value;
  if ("params" in component && component.params !== undefined) result.params = component.params;
  if (component.type === "design_block") result.block = component.block;
  return result;
}

function scenarioProjection(
  scenario: SimulationScenarioV4,
  graph: CircuitGraphV4,
  definitions: DesignBlockDefinition[],
  assets: VerifiedAsset[],
): string {
  const referenced = new Set(graph.components.filter((component) => component.type === "design_block").map((component) => definitionKey(component.block)));
  const projection = {
    scenario: { id: scenario.id, config: scenario.config },
    graph: {
      id: graph.id,
      components: graph.components.map(simulationComponent),
      wires: graph.wires,
      probes: graph.probes.map((probe) => ({ id: probe.id, kind: probe.kind, target: probe.target })),
    },
    designBlocks: definitions.filter((definition) => referenced.has(definitionKey(definition))).map((definition) => ({
      id: definition.id,
      version: definition.version,
      contentHash: definition.contentHash,
      pins: definition.pins,
      netlist: definition.netlist,
    })),
    trustedAssets: assets.map((asset) => ({
      contentHash: asset.ref.contentHash,
      entrypoint: asset.derivedEntrypoint,
      pinCount: asset.pinCount,
    })),
  };
  return canonicalizeV4SimulationProjection(projection);
}

function builtInModels(components: CircuitComponentV4[]): string[] {
  const used = new Set<string>();
  for (const component of components) {
    if (component.type === "diode") used.add("diode");
    if (component.type === "led") used.add("led");
    if (component.type === "bjt_npn") used.add(component.mpn === "2N3904" ? "2n3904" : "npn");
    if (component.type === "bjt_pnp") used.add("pnp");
    if (component.type === "nmos") used.add("nmos");
    if (component.type === "pmos") used.add("pmos");
    if (component.type === "opamp_ideal") used.add("opamp");
  }
  return [...used].sort(compareCircuitV4Tokens).map((name) => name === "2n3904" ? interimModels.OC_2N3904 : interimModels[name as keyof typeof interimModels]);
}

export function generateScenarioNetlist(
  inputDocument: CircuitDocumentV4,
  scenarioId: string,
  options: ScenarioNetlistOptions = {},
): GeneratedScenarioNetlist {
  let document: CircuitDocumentV4;
  try {
    document = detachedCircuitV4Snapshot(inputDocument);
  } catch {
    fail("UNKNOWN_FIELD", "", "Circuit document could not be detached into canonical JSON");
  }
  assertValidCircuitV4(document);
  const scenario = document.scenarios.find((entry) => entry.id === scenarioId);
  if (!scenario) fail("SCENARIO_NOT_FOUND", "scenarioId", `Scenario ${scenarioId} was not found`, { scenarioId });
  const graph = document.circuits.find((entry) => entry.id === scenario.circuitId)!;
  const resolver = captureResolver(options, { scenarioId, circuitId: graph.id });
  const definitions = new Map(document.designBlocks.map((definition) => [definitionKey(definition), definition]));
  const sortedComponents = [...graph.components].sort((a, b) => compareCircuitV4Tokens(a.id, b.id));
  const sortedWires = [...graph.wires].sort((a, b) => compareCircuitV4Tokens(a.id, b.id));

  const verifiedByRef = new Map<string, VerifiedAsset>();
  const verifiedByHash = new Map<string, VerifiedAsset>();
  let verifiedAssetBytes = 0;
  for (const component of sortedComponents) {
    if (component.type !== "design_block") continue;
    const definition = definitions.get(definitionKey(component.block))!;
    if (definition.netlist.kind !== "spice_subcircuit") continue;
    const key = refKey(definition.netlist.asset);
    const cached = verifiedByRef.get(key);
    if (cached) {
      if (cached.pinCount !== definition.netlist.pinOrder.length) {
        fail(
          "TRUSTED_MODEL_PIN_MISMATCH",
          "registry.canonicalText",
          `Derived pin count ${cached.pinCount} does not match block pin order ${definition.netlist.pinOrder.length}`,
          { scenarioId, circuitId: graph.id, componentId: component.id, blockId: definition.id },
        );
      }
      continue;
    }
    const verified = verifyAsset(definition.netlist.asset, definition.netlist.pinOrder.length, resolver, {
      scenarioId,
      circuitId: graph.id,
      componentId: component.id,
      blockId: definition.id,
    });
    const existing = verifiedByHash.get(verified.ref.contentHash);
    if (existing) assertNoVerifiedAssetCollision(existing, verified);
    else {
      verifiedAssetBytes += new TextEncoder().encode(verified.emittedText).byteLength;
      if (verifiedAssetBytes > MAX_NETLIST_BYTES) fail("EXECUTION_LIMIT", "netlist", "Verified model assets exceed the aggregate 1 MiB netlist limit", { scenarioId, circuitId: graph.id });
      verifiedByHash.set(verified.ref.contentHash, verified);
    }
    verifiedByRef.set(key, existing ?? verified);
  }
  const verifiedAssets = [...verifiedByHash.values()].sort((a, b) => compareCircuitV4Tokens(a.ref.contentHash, b.ref.contentHash));

  const reservedNames = new Set<string>();
  for (const asset of verifiedAssets) for (const name of asset.introducedNames) reservedNames.add(name.toLowerCase());
  for (const component of sortedComponents) {
    const base = baseElementName(component);
    const names = component.type === "potentiometer" && base ? [`${base}_t`, `${base}_b`] : base ? [base] : [];
    for (const name of names) {
      const normalized = name.toLowerCase();
      if (reservedNames.has(normalized)) fail("EMITTED_NAME_COLLISION", `circuits.${graph.id}.components.${component.id}`, `SPICE identifier ${name} collides before emission`, { scenarioId, circuitId: graph.id, componentId: component.id });
      reservedNames.add(normalized);
    }
  }

  const uf = new UnionFind();
  const pinPoints = new Map<string, Point[]>();
  for (const wire of sortedWires) {
    const first = pointKey(wire.points[0]!);
    uf.add(first);
    for (const wirePoint of wire.points.slice(1)) uf.union(first, pointKey(wirePoint));
  }
  for (const component of sortedComponents) {
    const points = componentPinPointsV4(component, document.designBlocks);
    pinPoints.set(component.id, points);
    for (const pinPoint of points) uf.add(pointKey(pinPoint));
  }
  const grounds = sortedComponents.filter((component) => component.type === "ground");
  const groundKey = pointKey(pinPoints.get(grounds[0]!.id)![0]!);
  for (const ground of grounds.slice(1)) uf.union(groundKey, pointKey(pinPoints.get(ground.id)![0]!));
  const groundRoot = uf.find(groundKey);
  const rootNames = new Map<string, string>([[groundRoot, "0"]]);
  let nextNode = 1;
  for (const component of sortedComponents) for (const pinPoint of pinPoints.get(component.id) ?? []) {
    const root = uf.find(pointKey(pinPoint));
    if (!rootNames.has(root)) rootNames.set(root, `n${nextNode++}`);
  }
  const nodeAt = (pinPoint: Point): string => {
    const root = uf.find(pointKey(pinPoint));
    if (root === groundRoot) return "0";
    let name = rootNames.get(root);
    if (!name) { name = `n${nextNode++}`; rootNames.set(root, name); }
    return name;
  };
  const componentNodes: Record<string, string[]> = {};
  const componentPinNodes: Record<string, Record<string, string>> = {};
  for (const component of sortedComponents) {
    const nodes = (pinPoints.get(component.id) ?? []).map(nodeAt);
    componentNodes[component.id] = nodes;
    if (component.type === "design_block") {
      const definition = definitions.get(definitionKey(component.block))!;
      componentPinNodes[component.id] = Object.fromEntries(definition.pins.map((pin, index) => [pin.id, nodes[index]!]));
    } else componentPinNodes[component.id] = Object.fromEntries(nodes.map((node, index) => [String(index), node]));
  }
  const wireNodes = Object.fromEntries(sortedWires.map((wire) => [wire.id, nodeAt(wire.points[0]!) ]));

  const scenarioHash = fnv1a64(scenarioProjection(scenario, graph, document.designBlocks, verifiedAssets));
  const serializationHash = circuitV4SerializationHash(document);
  const lines: string[] = [];
  const lineMap: NetlistLine[] = [];
  const componentCurrents: Record<string, string> = {};
  const omissions: NetlistOmission[] = [];
  add(lines, lineMap, `scheMAGIC Simulator scenario ${scenarioHash}`, { stage: "header" });
  add(lines, lineMap, `* scenario-hash ${scenarioHash}`, { stage: "header" });
  for (const asset of verifiedAssets) add(lines, lineMap, asset.emittedText.slice(0, -1), { stage: "model" });
  for (const model of builtInModels(sortedComponents)) add(lines, lineMap, model, { stage: "model" });

  const noiseInputId = scenario.config.mode === "noise" ? scenario.config.noise.inputSourceId : undefined;
  for (const component of sortedComponents) {
    if (component.type === "ground") continue;
    const nodes = componentNodes[component.id] ?? [];
    const name = baseElementName(component)!;
    const lowerName = name.toLowerCase();
    const noiseReference = component.id === noiseInputId ? " AC 1" : "";
    let line: string | undefined;
    let current: string | undefined;
    switch (component.type) {
      case "resistor": line = `${name} ${nodes[0]} ${nodes[1]} ${spice(component.value)}`; current = `@${lowerName}[i]`; break;
      case "capacitor": line = `${name} ${nodes[0]} ${nodes[1]} ${spice(component.value)}`; current = `@${lowerName}[i]`; break;
      case "inductor": line = `${name} ${nodes[0]} ${nodes[1]} ${spice(component.value)}`; current = `@${lowerName}[i]`; break;
      case "vsource": line = `${name} ${nodes[0]} ${nodes[1]} DC ${spice(component.value)}${scenario.config.mode === "ac" ? ` AC ${spice(component.params?.ac ?? 1)}` : noiseReference}`; current = `${lowerName}#branch`; break;
      case "vsource_pulse": line = `${name} ${nodes[0]} ${nodes[1]} PULSE(${spice(component.params.v1)} ${spice(component.params.v2)} ${spice(component.params.delay)} ${spice(component.params.rise)} ${spice(component.params.fall)} ${spice(component.params.width)} ${spice(component.params.period)})${noiseReference}`; current = `${lowerName}#branch`; break;
      case "vsource_sine": line = `${name} ${nodes[0]} ${nodes[1]} SIN(${spice(component.params.offset)} ${spice(component.value)} ${spice(component.params.frequency)})${scenario.config.mode === "ac" ? ` AC ${spice(component.params.ac ?? 1)}` : noiseReference}`; current = `${lowerName}#branch`; break;
      case "isource": line = `${name} ${nodes[0]} ${nodes[1]} DC ${spice(component.value)}${noiseReference}`; current = `@${lowerName}[i]`; break;
      case "isource_pulse": line = `${name} ${nodes[0]} ${nodes[1]} PULSE(${spice(component.params.i1)} ${spice(component.params.i2)} ${spice(component.params.delay)} ${spice(component.params.rise)} ${spice(component.params.fall)} ${spice(component.params.width)} ${spice(component.params.period)})`; current = `@${lowerName}[i]`; break;
      case "switch_spst": line = `${name} ${nodes[0]} ${nodes[1]} ${component.params.closed ? "1m" : "1G"}`; current = `@${lowerName}[i]`; break;
      case "potentiometer": {
        const total = engineeringValueNumber(component.value);
        const position = canonicalCircuitNumber(component.params.t);
        const top = canonicalCircuitNumber(Math.max(0.001, total * (1 - position)));
        const bottom = canonicalCircuitNumber(Math.max(0.001, total * position));
        add(lines, lineMap, `${name}_t ${nodes[0]} ${nodes[1]} ${spice(top)}\n${name}_b ${nodes[1]} ${nodes[2]} ${spice(bottom)}`, { stage: "component", componentId: component.id });
        componentCurrents[component.id] = `@${lowerName}_t[i]`;
        continue;
      }
      case "diode": line = `${name} ${nodes[0]} ${nodes[1]} OC_GENERIC_D`; current = `@${lowerName}[id]`; break;
      case "led": line = `${name} ${nodes[0]} ${nodes[1]} OC_LED_RED`; current = `@${lowerName}[id]`; break;
      case "bjt_npn": line = `${name} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${component.mpn === "2N3904" ? "OC_2N3904" : "OC_GENERIC_NPN"}`; current = `@${lowerName}[ic]`; break;
      case "bjt_pnp": line = `${name} ${nodes[0]} ${nodes[1]} ${nodes[2]} OC_GENERIC_PNP`; current = `@${lowerName}[ic]`; break;
      case "nmos": line = `${name} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${nodes[2]} OC_GENERIC_NMOS`; current = `@${lowerName}[id]`; break;
      case "pmos": line = `${name} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${nodes[2]} OC_GENERIC_PMOS`; current = `@${lowerName}[id]`; break;
      case "opamp_ideal": line = `${name} ${nodes[0]} ${nodes[1]} ${nodes[2]} OC_IDEAL_OPAMP`; break;
      case "design_block": {
        const definition = definitions.get(definitionKey(component.block))!;
        if (definition.netlist.kind === "schematic_only") {
          omissions.push({ code: "SCHEMATIC_ONLY_BLOCK_OMITTED", scenarioId, circuitId: graph.id, componentId: component.id, blockId: definition.id, reason: definition.netlist.reason });
          continue;
        }
        const asset = verifiedByRef.get(refKey(definition.netlist.asset))!;
        const orderedNodes = definition.netlist.pinOrder.map((pinId) => componentPinNodes[component.id]![pinId]!);
        line = `${name} ${orderedNodes.join(" ")} ${asset.emittedEntrypoint}`;
        break;
      }
    }
    if (line) add(lines, lineMap, line, { stage: "component", componentId: component.id });
    if (current) componentCurrents[component.id] = current;
  }
  const currents = [...new Set(Object.values(componentCurrents))];
  add(lines, lineMap, currents.length > 0 ? `.save all ${currents.join(" ")}` : ".save all", { stage: "analysis" });
  if (scenario.config.mode === "tran") {
    add(lines, lineMap, `.tran ${spice(scenario.config.tran.tstep)} ${spice(scenario.config.tran.tstop)} 0 ${spice(scenario.config.tran.maxstep)}`, { stage: "analysis" });
  } else if (scenario.config.mode === "ac") {
    add(lines, lineMap, `.ac dec ${spice(scenario.config.ac.pointsPerDecade)} ${spice(scenario.config.ac.fstart)} ${spice(scenario.config.ac.fstop)}`, { stage: "analysis" });
  } else if (scenario.config.mode === "dc-sweep") {
    const config = scenario.config.dcSweep;
    const primary = sortedComponents.find((component) => component.id === config.sourceId)!;
    let command = `.dc ${baseElementName(primary)} ${spice(config.start)} ${spice(config.stop)} ${spice(config.step)}`;
    if (config.secondary) {
      const secondary = sortedComponents.find((component) => component.id === config.secondary!.sourceId)!;
      command += ` ${baseElementName(secondary)} ${spice(config.secondary.start)} ${spice(config.secondary.stop)} ${spice(config.secondary.step)}`;
    }
    add(lines, lineMap, command, { stage: "analysis" });
  } else if (scenario.config.mode === "noise") {
    const config = scenario.config.noise;
    const probe = graph.probes.find((entry) => entry.id === config.outputProbeId)!;
    const outputNode = probeNode(probe, componentNodes, componentPinNodes, wireNodes);
    if (!outputNode || outputNode === "0") fail("INVALID_REFERENCE", "scenario.config.noise.outputProbeId", "Noise output probe must resolve to a non-ground node", { scenarioId, circuitId: graph.id });
    const input = sortedComponents.find((component) => component.id === config.inputSourceId)!;
    add(lines, lineMap, `.temp ${spice(config.temperatureC)}`, { stage: "analysis" });
    add(lines, lineMap, `.noise V(${outputNode}) ${baseElementName(input)} dec ${spice(config.pointsPerDecade)} ${spice(config.fstart)} ${spice(config.fstop)}`, { stage: "analysis" });
  } else add(lines, lineMap, ".op", { stage: "analysis" });
  add(lines, lineMap, ".end", { stage: "analysis" });
  const netlist = `${lines.join("\n")}\n`;
  if (new TextEncoder().encode(netlist).byteLength > MAX_NETLIST_BYTES) fail("EXECUTION_LIMIT", "netlist", "Generated scenario netlist exceeds 1 MiB", { scenarioId, circuitId: graph.id });
  return {
    netlist,
    lineMap,
    componentNodes,
    componentPinNodes,
    wireNodes,
    documentHash: scenarioHash,
    scenarioHash,
    serializationHash,
    scenarioId,
    circuitId: graph.id,
    componentCurrents,
    omissions,
  };
}
