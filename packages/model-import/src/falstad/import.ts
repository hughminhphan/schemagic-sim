import {
  componentPinPoints,
  type CircuitComponent,
  type CircuitDocument,
  type CircuitProbe,
  type CircuitWire,
  type ComponentType,
  type Point,
  type Rotation,
} from "@opencircuit/circuit-schema";
import { decompressFromEncodedURIComponent } from "./lz-string";
import type {
  FalstadImportIssue,
  FalstadImportOptions,
  FalstadImportResult,
  FalstadSourceKind,
} from "./types";

const ELEMENT_TYPES_WITH_COORDINATES = new Set([
  "r", "c", "l", "w", "g", "v", "R", "d", "t", "f", "a", "s", "S", "p", "x", "i", "T", "174", "403",
]);
const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
const DEFAULT_GRID_PIXELS = 4;

interface SourcePoint { x: number; y: number }
interface ParsedLine {
  lineNumber: number;
  text: string;
  tokens: string[];
  type: string;
  ordinal?: number;
}
interface ElementReference {
  componentId?: string;
  posts: SourcePoint[];
  imported: boolean;
}
type ProbeNodeReference =
  | { kind: "schematic-wire"; wireId: string }
  | { kind: "schematic-pin"; componentId: string; pin: number };

class IdAllocator {
  private readonly counts = new Map<string, number>();
  next(prefix: string): string {
    const count = (this.counts.get(prefix) ?? 0) + 1;
    this.counts.set(prefix, count);
    return `${prefix}${count}`;
  }
}

class FalstadBuilder {
  readonly components: CircuitComponent[] = [];
  readonly wires: CircuitWire[] = [];
  readonly probes: CircuitProbe[] = [];
  readonly issues: FalstadImportIssue[] = [];
  readonly references = new Map<number, ElementReference>();
  readonly attachments = new Map<string, ProbeNodeReference>();
  importedElements = 0;
  hasSineSource = false;
  minimumSineFrequency = Number.POSITIVE_INFINITY;
  timeStep: number | undefined;
  private readonly ids = new IdAllocator();
  private readonly sourcePoints = new Map<string, SourcePoint>();
  private railGroundCount = 0;

  constructor(
    private readonly minX: number,
    private readonly minY: number,
    private readonly gridPixels: number,
  ) {}

  map(point: SourcePoint): Point {
    return [Math.round((point.x - this.minX) / this.gridPixels) + 8, Math.round((point.y - this.minY) / this.gridPixels) + 8];
  }

  issue(line: ParsedLine, reason: string, mapping: "unsupported" | "partial" = "unsupported"): void {
    this.issues.push({ lineNumber: line.lineNumber, elementLine: line.text, elementType: line.type, reason, mapping });
  }

  addWire(points: readonly Point[], attachmentPoints: readonly SourcePoint[] = []): CircuitWire | undefined {
    const compact = points.filter((point, index) => index === 0 || point[0] !== points[index - 1]![0] || point[1] !== points[index - 1]![1]);
    if (compact.length < 2) return undefined;
    const wire: CircuitWire = { id: this.ids.next("wire"), points: orthogonalize(compact) };
    this.wires.push(wire);
    for (const sourcePoint of attachmentPoints) this.attach(sourcePoint, { kind: "schematic-wire", wireId: wire.id });
    return wire;
  }

  addSourceWire(first: SourcePoint, second: SourcePoint): CircuitWire | undefined {
    return this.addWire([this.map(first), this.map(second)], [first, second]);
  }

  attach(point: SourcePoint, reference: ProbeNodeReference): void {
    const key = sourceKey(point);
    this.sourcePoints.set(key, point);
    if (!this.attachments.has(key)) this.attachments.set(key, reference);
  }

  placeComponent(
    type: ComponentType,
    desiredPosts: readonly SourcePoint[],
    options: { value?: number | string; params?: Record<string, unknown>; mpn?: string } = {},
  ): CircuitComponent {
    const targets = desiredPosts.map((point) => this.map(point));
    let best: { component: CircuitComponent; score: number } | undefined;
    for (const rot of ROTATIONS) {
      for (const mirror of [false, true]) {
        const sample: CircuitComponent = { id: "sample", type, pos: [0, 0], rot, mirror };
        const offsets = componentPinPoints(sample);
        if (offsets.length !== targets.length) continue;
        const position: Point = [
          Math.round(targets.reduce((sum, target, index) => sum + target[0] - offsets[index]![0], 0) / targets.length),
          Math.round(targets.reduce((sum, target, index) => sum + target[1] - offsets[index]![1], 0) / targets.length),
        ];
        const component: CircuitComponent = {
          id: "sample", type, pos: position, rot, mirror,
          ...(options.value !== undefined ? { value: options.value } : {}),
          ...(options.params ? { params: options.params } : {}),
          ...(options.mpn ? { mpn: options.mpn } : {}),
        };
        const pins = componentPinPoints(component);
        const score = pins.reduce((sum, pin, index) => sum + manhattan(pin, targets[index]!), 0) + (mirror ? 0.01 : 0);
        if (!best || score < best.score) best = { component, score };
      }
    }
    if (!best) throw new Error(`Cannot place ${type} with ${targets.length} Falstad posts`);
    const component = { ...best.component, id: this.ids.next(componentPrefix(type)) };
    this.components.push(component);
    const pins = componentPinPoints(component);
    pins.forEach((pin, index) => {
      const desired = desiredPosts[index]!;
      const target = targets[index]!;
      if (pin[0] === target[0] && pin[1] === target[1]) this.attach(desired, { kind: "schematic-pin", componentId: component.id, pin: index });
      else {
        const wire = this.addWire([pin, target], [desired]);
        if (!wire) this.attach(desired, { kind: "schematic-pin", componentId: component.id, pin: index });
      }
    });
    return component;
  }

  railGroundPoint(): SourcePoint {
    this.railGroundCount += 1;
    return { x: this.minX - 64 - this.railGroundCount * 16, y: this.minY - 64 };
  }

  addGround(point: SourcePoint): CircuitComponent {
    const component: CircuitComponent = { id: this.ids.next("g"), type: "ground", pos: this.map(point), rot: 0, mirror: false };
    this.components.push(component);
    this.attach(point, { kind: "schematic-pin", componentId: component.id, pin: 0 });
    return component;
  }

  addProbe(positive: SourcePoint, negative: SourcePoint, label?: string): void {
    const positiveReference = this.nodeReference(positive);
    const negativeReference = this.nodeReference(negative);
    this.probes.push({
      id: this.ids.next("probe"),
      expressionVersion: 1,
      expression: { kind: "voltage", positive: positiveReference, negative: negativeReference },
      ...(label ? { label } : {}),
    });
  }

  addCurrentProbe(componentId: string, label?: string): void {
    this.probes.push({
      id: this.ids.next("probe"),
      expressionVersion: 1,
      expression: { kind: "current", component: { kind: "schematic-component", componentId } },
      ...(label ? { label } : {}),
    });
  }

  private nodeReference(point: SourcePoint): ProbeNodeReference {
    const existing = this.attachments.get(sourceKey(point));
    if (existing) return existing;
    const mapped = this.map(point);
    const anchor: Point = [mapped[0] + 1, mapped[1]];
    const wire = this.addWire([mapped, anchor], [point]);
    if (!wire) throw new Error("Unable to create a Falstad probe anchor");
    return { kind: "schematic-wire", wireId: wire.id };
  }

}

function orthogonalize(points: readonly Point[]): Point[] {
  const result: Point[] = [points[0]!];
  for (const target of points.slice(1)) {
    const prior = result.at(-1)!;
    if (prior[0] !== target[0] && prior[1] !== target[1]) result.push([target[0], prior[1]]);
    if (target[0] !== result.at(-1)![0] || target[1] !== result.at(-1)![1]) result.push(target);
  }
  return result;
}

function manhattan(left: Point, right: Point): number {
  return Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]);
}

function componentPrefix(type: ComponentType): string {
  switch (type) {
    case "resistor": return "r";
    case "capacitor": return "c";
    case "inductor": return "l";
    case "vsource": case "vsource_sine": case "vsource_pulse": return "v";
    case "isource": return "i";
    case "diode": case "led": return "d";
    case "bjt_npn": case "bjt_pnp": return "q";
    case "nmos": case "pmos": return "m";
    case "opamp_ideal": return "u";
    case "switch_spst": return "s";
    case "potentiometer": return "pot";
    case "ground": return "g";
    default: return "part";
  }
}

function sourceKey(point: SourcePoint): string {
  return `${Math.round(point.x * 1_000) / 1_000},${Math.round(point.y * 1_000) / 1_000}`;
}

function point(tokens: readonly string[], xIndex: number, yIndex: number): SourcePoint {
  const x = Number(tokens[xIndex]);
  const y = Number(tokens[yIndex]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("element coordinates are malformed");
  return { x, y };
}

function finiteToken(tokens: readonly string[], index: number, fallback: number): number {
  const value = Number(tokens[index]);
  return Number.isFinite(value) ? value : fallback;
}

function offsetPairAt(origin: SourcePoint, start: SourcePoint, end: SourcePoint, amount: number): [SourcePoint, SourcePoint] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const perpendicularX = dy / length;
  const perpendicularY = -dx / length;
  return [
    { x: Math.round(origin.x + perpendicularX * amount), y: Math.round(origin.y + perpendicularY * amount) },
    { x: Math.round(origin.x - perpendicularX * amount), y: Math.round(origin.y - perpendicularY * amount) },
  ];
}

function offsetPair(start: SourcePoint, end: SourcePoint, amount: number): [SourcePoint, SourcePoint] {
  return offsetPairAt(end, start, end, amount);
}

function potentiometerPosts(first: SourcePoint, dragged: SourcePoint): [SourcePoint, SourcePoint] {
  const dx = dragged.x - first.x;
  const dy = dragged.y - first.y;
  const gridSize = 16;
  let end: SourcePoint;
  let offset: number;
  if (Math.abs(dx) > Math.abs(dy)) {
    const length = 2 * gridSize * Math.sign(dx || 1) * Math.ceil(Math.abs(dx) / (2 * gridSize));
    end = { x: first.x + length, y: first.y };
    offset = dx < 0 ? dy : -dy;
  } else {
    const length = 2 * gridSize * Math.sign(dy || 1) * Math.ceil(Math.abs(dy) / (2 * gridSize));
    end = { x: first.x, y: first.y + length };
    offset = dy > 0 ? dx : -dx;
  }
  if (offset === 0) offset = gridSize;
  const [wiper] = offsetPairAt({ x: (first.x + end.x) / 2, y: (first.y + end.y) / 2 }, first, end, offset);
  return [end, wiper];
}

function parseLines(sourceText: string): ParsedLine[] {
  let ordinal = 0;
  return sourceText.replace(/\r\n?/g, "\n").split("\n").map((text, index) => {
    const trimmed = text.trim();
    const tokens = trimmed ? trimmed.split(/\s+/) : [];
    const type = tokens[0] ?? "";
    const isElement = type !== "" && !["$", "o", "h", "!", "%", "?", "B", "32", "34", "38", "."].includes(type);
    return { lineNumber: index + 1, text: trimmed, tokens, type, ...(isElement ? { ordinal: ordinal++ } : {}) };
  });
}

function decodeSource(input: string): { sourceText: string; sourceKind: FalstadSourceKind } {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a Falstad or CircuitJS share URL first");
  if (trimmed.includes("\n") || trimmed.startsWith("$ ")) return { sourceText: trimmed, sourceKind: "text" };
  let url: URL;
  try { url = new URL(trimmed); }
  catch { throw new Error("Falstad import expects a share URL containing cct or ctz"); }
  const compressed = url.searchParams.get("ctz");
  if (compressed !== null) return { sourceText: decompressFromEncodedURIComponent(compressed), sourceKind: "ctz" };
  const plain = url.searchParams.get("cct");
  if (plain !== null) return { sourceText: plain, sourceKind: "cct" };
  throw new Error("Falstad share URL does not contain a cct or ctz circuit payload");
}

export function isFalstadShareInput(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("\n")) return false;
  try {
    const url = new URL(trimmed);
    return url.searchParams.has("cct") || url.searchParams.has("ctz");
  } catch {
    return false;
  }
}

export function decodeFalstadShare(input: string): { sourceText: string; sourceKind: FalstadSourceKind } {
  return decodeSource(input);
}

export function importFalstadCircuit(input: string, options: FalstadImportOptions = {}): FalstadImportResult {
  const { sourceText, sourceKind } = decodeSource(input);
  if (sourceText.length > 2_000_000) throw new Error("Falstad circuit text is too large");
  const lines = parseLines(sourceText);
  const coordinateLines = lines.filter((line) => ELEMENT_TYPES_WITH_COORDINATES.has(line.type) && line.tokens.length >= 6);
  const xs = coordinateLines.flatMap((line) => [Number(line.tokens[1]), Number(line.tokens[3])]).filter(Number.isFinite);
  const ys = coordinateLines.flatMap((line) => [Number(line.tokens[2]), Number(line.tokens[4])]).filter(Number.isFinite);
  const gridPixels = options.gridPixels ?? DEFAULT_GRID_PIXELS;
  if (!Number.isFinite(gridPixels) || gridPixels <= 0) throw new Error("Falstad grid scale must be a positive number");
  const minX = xs.reduce((minimum, value) => Math.min(minimum, value), 0);
  const minY = ys.reduce((minimum, value) => Math.min(minimum, value), 0);
  const builder = new FalstadBuilder(minX, minY, gridPixels);
  const deferredProbes: Array<{ line: ParsedLine; positive: SourcePoint; negative: SourcePoint }> = [];
  const deferredScopes: ParsedLine[] = [];

  for (const line of lines) {
    if (!line.type) continue;
    if (line.type === "$") {
      const step = finiteToken(line.tokens, 2, Number.NaN);
      if (Number.isFinite(step) && step > 0) builder.timeStep = step;
      continue;
    }
    if (line.type === "o") { deferredScopes.push(line); continue; }
    if (["h", "%", "?", "B"].includes(line.type)) continue;
    if (["!", ".", "32", "34"].includes(line.type)) {
      builder.issue(line, "Custom CircuitJS model definitions cannot be represented by the built-in circuit schema");
      continue;
    }
    if (line.type === "38") {
      builder.issue(line, "Interactive CircuitJS slider metadata is not represented; the referenced element keeps its imported static value", "partial");
      continue;
    }
    if (!ELEMENT_TYPES_WITH_COORDINATES.has(line.type) && !/^\d+$/.test(line.type)) {
      builder.issue(line, "Unknown Falstad element type");
      continue;
    }
    if (line.tokens.length < 6) {
      builder.issue(line, "Element record does not contain coordinates and flags");
      continue;
    }

    let first: SourcePoint;
    let second: SourcePoint;
    try { first = point(line.tokens, 1, 2); second = point(line.tokens, 3, 4); }
    catch (error) { builder.issue(line, error instanceof Error ? error.message : String(error)); continue; }
    const flags = finiteToken(line.tokens, 5, 0);
    let reference: ElementReference = { posts: [first, second], imported: false };
    try {
      switch (line.type) {
        case "w": {
          builder.addSourceWire(first, second);
          builder.importedElements += 1;
          reference = { posts: [first, second], imported: true };
          break;
        }
        case "r": {
          const component = builder.placeComponent("resistor", [first, second], { value: finiteToken(line.tokens, 6, 1000) });
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first, second], imported: true };
          break;
        }
        case "c": {
          const component = builder.placeComponent("capacitor", [first, second], { value: finiteToken(line.tokens, 6, 1e-5) });
          const initial = finiteToken(line.tokens, 8, 0);
          if (Math.abs(initial) > 1e-15) builder.issue(line, "Initial capacitor voltage is not represented", "partial");
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first, second], imported: true };
          break;
        }
        case "l": {
          const component = builder.placeComponent("inductor", [first, second], { value: finiteToken(line.tokens, 6, 1e-3) });
          const initial = finiteToken(line.tokens, 7, 0);
          if (Math.abs(initial) > 1e-15) builder.issue(line, "Initial inductor current is not represented", "partial");
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first, second], imported: true };
          break;
        }
        case "g": {
          const component = builder.addGround(first);
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first], imported: true };
          break;
        }
        case "v":
        case "R": {
          const waveform = Math.trunc(finiteToken(line.tokens, 6, 0));
          const frequency = finiteToken(line.tokens, 7, 40);
          const amplitude = finiteToken(line.tokens, 8, 5);
          const bias = finiteToken(line.tokens, 9, 0);
          const phase = (flags & 2) !== 0 ? Math.PI / 2 : finiteToken(line.tokens, 10, 0);
          let type: "vsource" | "vsource_sine";
          let componentOptions: { value: number; params?: Record<string, unknown> };
          if (waveform === 0) {
            type = "vsource";
            componentOptions = { value: amplitude + bias };
          } else if (waveform === 1) {
            type = "vsource_sine";
            componentOptions = { value: amplitude, params: { offset: bias, frequency } };
            builder.hasSineSource = true;
            if (frequency > 0) builder.minimumSineFrequency = Math.min(builder.minimumSineFrequency, frequency);
            if (Math.abs(phase) > 1e-15) builder.issue(line, "Sine-source phase is not represented", "partial");
          } else {
            builder.issue(line, `Voltage waveform ${waveform} is not supported; only DC and sine sources can be imported`);
            break;
          }
          if (line.type === "R") {
            const groundPoint = builder.railGroundPoint();
            const component = builder.placeComponent(type, [first, groundPoint], componentOptions);
            builder.addGround(groundPoint);
            builder.importedElements += 1;
            reference = { componentId: component.id, posts: [first, groundPoint], imported: true };
          } else {
            const component = builder.placeComponent(type, [second, first], componentOptions);
            builder.importedElements += 1;
            reference = { componentId: component.id, posts: [first, second], imported: true };
          }
          break;
        }
        case "i": {
          const component = builder.placeComponent("isource", [first, second], { value: finiteToken(line.tokens, 6, 0.01) });
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first, second], imported: true };
          break;
        }
        case "d": {
          const component = builder.placeComponent("diode", [first, second]);
          if ((flags & 2) !== 0 && (line.tokens[6] ?? "default") !== "default") builder.issue(line, `Diode model ${line.tokens[6]} is replaced by the app's generic diode model`, "partial");
          else if ((flags & 1) !== 0) builder.issue(line, "Custom diode forward-drop parameters are replaced by the app's generic diode model", "partial");
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first, second], imported: true };
          break;
        }
        case "t": {
          const polarity = finiteToken(line.tokens, 6, 1);
          let geometricSign = (second.y === first.y ? Math.sign(second.x - first.x) : Math.sign(second.y - first.y)) || 1;
          if ((flags & 1) !== 0) geometricSign *= -1;
          const [collector, emitter] = offsetPair(first, second, 16 * geometricSign * polarity);
          const type = polarity < 0 ? "bjt_pnp" : "bjt_npn";
          const component = builder.placeComponent(type, [collector, first, emitter]);
          const beta = finiteToken(line.tokens, 9, 100);
          const model = line.tokens[10];
          if (Math.abs(beta - 100) > 1e-12 || (model && model !== "default")) builder.issue(line, "BJT beta or custom model is replaced by the app's generic transistor model", "partial");
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first, collector, emitter], imported: true };
          break;
        }
        case "f": {
          let geometricSign = (second.y === first.y ? Math.sign(second.x - first.x) : Math.sign(second.y - first.y)) || 1;
          if ((flags & 8) !== 0) geometricSign *= -1;
          const [source, drain] = offsetPair(first, second, -16 * geometricSign);
          const pChannel = (flags & 1) !== 0;
          if ((flags & 64) !== 0) {
            builder.issue(line, "Four-terminal MOSFET body connections are not supported");
            break;
          }
          const desired = [drain, first, source];
          const component = builder.placeComponent(pChannel ? "pmos" : "nmos", desired);
          const threshold = finiteToken(line.tokens, 6, 1.5);
          const beta = finiteToken(line.tokens, 7, 0.02);
          if (line.tokens.length > 6 && (Math.abs(Math.abs(threshold) - 1.5) > 1e-12 || Math.abs(beta - 0.02) > 1e-12)) builder.issue(line, "MOSFET threshold or beta is replaced by the app's generic MOSFET model", "partial");
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first, source, drain], imported: true };
          break;
        }
        case "a": {
          let geometricSign = (second.y === first.y ? Math.sign(second.x - first.x) : Math.sign(second.y - first.y)) || 1;
          if ((flags & 1) !== 0) geometricSign *= -1;
          const height = (flags & 2) !== 0 ? 8 : 16;
          const [axisNegative, axisPositive] = offsetPairAt(first, first, second, height * geometricSign);
          const component = builder.placeComponent("opamp_ideal", [axisPositive, axisNegative, second]);
          if (line.tokens.length > 6) builder.issue(line, "Op-amp output limits, gain-bandwidth and gain are replaced by the app's ideal op-amp model", "partial");
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [axisNegative, axisPositive, second], imported: true };
          break;
        }
        case "s": {
          const positionToken = line.tokens[6] ?? "0";
          const position = positionToken === "true" ? 1 : positionToken === "false" ? 0 : Math.trunc(Number(positionToken) || 0);
          const component = builder.placeComponent("switch_spst", [first, second], { params: { closed: position === 0 } });
          if ((line.tokens[7] ?? "false") === "true") builder.issue(line, "Momentary switch behaviour is imported as a static switch position", "partial");
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first, second], imported: true };
          break;
        }
        case "174": {
          const resistance = finiteToken(line.tokens, 6, 1000);
          const position = Math.min(0.995, Math.max(0.005, finiteToken(line.tokens, 7, 0.5)));
          const [end, wiper] = potentiometerPosts(first, second);
          const component = builder.placeComponent("potentiometer", [end, wiper, first], { value: resistance, params: { t: position } });
          builder.importedElements += 1;
          reference = { componentId: component.id, posts: [first, end, wiper], imported: true };
          break;
        }
        case "p": {
          deferredProbes.push({ line, positive: first, negative: second });
          reference = { posts: [first, second], imported: true };
          break;
        }
        case "S": builder.issue(line, "SPDT switches are not present in the circuit schema"); break;
        case "x": builder.issue(line, "Falstad text annotations are not present in the circuit schema"); break;
        case "T": builder.issue(line, "Transformers are not present in the circuit schema"); break;
        case "403": builder.issue(line, "Embedded CircuitJS scope widgets are not supported; use a probe or legacy scope trace"); break;
        default: builder.issue(line, `Numeric or unknown element type ${line.type} is not present in the circuit schema`); break;
      }
    } catch (error) {
      builder.issue(line, `Element could not be mapped: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (line.ordinal !== undefined) builder.references.set(line.ordinal, reference);
  }


  for (const deferred of deferredProbes) {
    const meter = Math.trunc(finiteToken(deferred.line.tokens, 6, 0));
    if (meter !== 0) builder.issue(deferred.line, `Probe meter mode ${meter} is imported as an instantaneous differential-voltage trace`, "partial");
    builder.addProbe(deferred.positive, deferred.negative, "Falstad probe");
    builder.importedElements += 1;
  }

  for (const line of deferredScopes) {
    const elementIndex = Math.trunc(finiteToken(line.tokens, 1, -1));
    const value = Math.trunc(finiteToken(line.tokens, 3, 0));
    const flags = Number.parseInt(line.tokens[4] ?? "0", 0) || 0;
    const reference = builder.references.get(elementIndex);
    if (!reference?.imported) {
      builder.issue(line, `Scope trace references unmapped Falstad element index ${elementIndex}`);
      continue;
    }
    let mapped = false;
    if ((flags & 1) !== 0 && reference.componentId) {
      builder.addCurrentProbe(reference.componentId, "Falstad scope current");
      mapped = true;
    }
    if ((flags & 2) !== 0 || !mapped) {
      if (reference.posts.length >= 2) { builder.addProbe(reference.posts[0]!, reference.posts[1]!, "Falstad scope voltage"); mapped = true; }
      else if (reference.posts.length === 1) { builder.addProbe(reference.posts[0]!, builder.railGroundPoint(), "Falstad scope voltage"); mapped = true; }
    }
    if (!mapped) { builder.issue(line, "Scope trace target has no importable electrical posts"); continue; }
    if (value !== 0 || (flags & ~3) !== 0) builder.issue(line, "Special scope measurement, scaling or display flags are reduced to a voltage/current trace", "partial");
    builder.importedElements += 1;
  }

  const warnings = [];
  if (!builder.components.some((component) => component.type === "ground")) warnings.push({ message: "Imported circuit has no ground reference and cannot be simulated until one is added" });
  const title = options.title?.trim() || "Imported Falstad circuit";
  const sim: CircuitDocument["sim"] = builder.hasSineSource
    ? (() => {
        const tstop = Number.isFinite(builder.minimumSineFrequency) ? Math.max(0.01, 5 / builder.minimumSineFrequency) : 0.01;
        const tstep = builder.timeStep && builder.timeStep > 0 ? Math.min(builder.timeStep, tstop / 100) : tstop / 500;
        return { mode: "tran", tran: { tstop, tstep, maxstep: Math.max(tstep, tstop / 200) } };
      })()
    : { mode: "op" };
  const document: CircuitDocument = {
    format: "opencircuit-circuit",
    version: 3,
    meta: { title },
    components: builder.components,
    wires: builder.wires,
    probes: builder.probes,
    sim,
  };
  return {
    document,
    sourceText,
    report: { sourceKind, importedElements: builder.importedElements, unsupported: builder.issues, warnings },
  };
}
