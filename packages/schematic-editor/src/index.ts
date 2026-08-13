import {
  canonicalizeCircuit,
  componentPinPoints,
  deserializeCircuit,
  partByType,
  type CircuitComponent,
  type CircuitDocument,
  type ComponentType,
  type Point,
} from "@opencircuit/circuit-schema";
import { EDITOR_SYMBOLS } from "./symbols.generated";

export { PARTS } from "@opencircuit/circuit-schema";

const NS = "http://www.w3.org/2000/svg";
const GRID = 8;
const SNAP_RADIUS_PX = 10;
const SWITCH_CLOSED_ANGLE = Math.atan2(0.7, 1.4) * 180 / Math.PI;
type Tool = "select" | "wire" | ComponentType;

export interface EditorChange {
  document: CircuitDocument;
  reason: "edit" | "undo" | "redo" | "view";
}

export interface SchematicEditorOptions {
  document: CircuitDocument;
  onChange?: (change: EditorChange) => void;
  onSelection?: (components: string[], wires: string[]) => void;
  onWireActivate?: (wireId: string) => void;
  onHoverWire?: (wireId: string | undefined) => void;
  onMidWire?: (active: boolean) => void;
  onLiveGesture?: (active: boolean, componentId?: string) => void;
}

interface WireStyle {
  stroke: string;
  dash?: string;
  width?: number;
  opacity?: number;
}

interface SymbolLayers {
  background: string[];
  strokes: string[];
  solid: string[];
}

interface PinReference {
  componentId: string;
  pinIndex: number;
}

interface WireAttachment {
  start?: PinReference;
  end?: PinReference;
}

interface SnapCandidate {
  point: Point;
  kind: "pin" | "vertex" | "segment";
  distance: number;
  componentId?: string;
  pinIndex?: number;
  wireId?: string;
}

type Drag =
  | {
    kind: "component";
    id: string;
    origins: Map<string, Point>;
    originalWires: Map<string, Point[]>;
    attachments: Map<string, WireAttachment>;
    moved: boolean;
  }
  | { kind: "pot"; id: string }
  | { kind: "box"; start: Point; end: Point }
  | { kind: "pan"; start: Point; origin: Point };

const esc = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]!);
const idMax = (items: { id: string }[], prefix: string) => Math.max(0, ...items.map((item) => item.id.startsWith(prefix) ? Number(item.id.slice(prefix.length)) || 0 : 0));
const path = (points: Point[]) => points.map((point, index) => `${index ? "L" : "M"}${point[0]} ${point[1]}`).join(" ");
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const samePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const pointKey = (point: Point) => `${point[0]},${point[1]}`;
const clonePoint = (point: Point): Point => [point[0], point[1]];

function splitSymbolMarkup(markup: string): SymbolLayers {
  const layers: SymbolLayers = { background: [], strokes: [], solid: [] };
  for (const tag of markup.match(/<(?:path|circle|rect|ellipse|line|polyline|polygon)\b[^>]*\/>/g) ?? []) {
    if (/class="[^"]*sym-bg/.test(tag)) layers.background.push(tag);
    else if (/class="[^"]*sym-solid/.test(tag)) layers.solid.push(tag);
    else layers.strokes.push(tag);
  }
  return layers;
}

function wrappedLayer(markup: string[], transformValue: string, className = ""): string {
  if (!markup.length) return "";
  return `<g${className ? ` class="${className}"` : ""} transform="${transformValue}">${markup.join("")}</g>`;
}

function renderedSymbol(component: CircuitComponent, interactive = true): string {
  const definition = EDITOR_SYMBOLS[component.type];
  const base = splitSymbolMarkup(definition.markup);
  const background = [...base.background];
  const strokes = [...base.strokes];
  const solid = [...base.solid];

  if (component.type === "potentiometer" && definition.wiper) {
    const t = clamp(Number(component.params?.t ?? 0.5), 0.005, 0.995);
    const y = 6 - 12 * t;
    const wiper = splitSymbolMarkup(definition.wiper);
    const translation = `translate(0 ${y})`;
    background.push(wrappedLayer(wiper.background, translation, "pot-wiper"));
    strokes.push(wrappedLayer(wiper.strokes, translation, "pot-wiper"));
    solid.push(wrappedLayer(wiper.solid, translation, "pot-wiper"));
  }

  if (component.type === "switch_spst" && definition.lever && definition.leverPivot) {
    const lever = splitSymbolMarkup(definition.lever);
    const [pivotX, pivotY] = definition.leverPivot;
    const rotation = component.params?.closed ? `rotate(${SWITCH_CLOSED_ANGLE} ${pivotX} ${pivotY})` : "rotate(0)";
    background.push(wrappedLayer(lever.background, rotation));
    strokes.push(wrappedLayer(lever.strokes, rotation));
    solid.push(wrappedLayer(lever.solid, rotation));
  }

  return `${background.join("")}${strokes.join("")}${solid.join("")}${interactive && component.type === "potentiometer" ? `<path class="pot-hit" data-pot-hit="${esc(component.id)}" data-testid="pot-wiper" d="M4-6V6"/>` : ""}`;
}

function rotateAround(point: Point, pivot: Point, degrees: number): Point {
  const radians = degrees * Math.PI / 180;
  const x = point[0] - pivot[0];
  const y = point[1] - pivot[1];
  return [pivot[0] + x * Math.cos(radians) - y * Math.sin(radians), pivot[1] + x * Math.sin(radians) + y * Math.cos(radians)];
}

function componentBbox(component: CircuitComponent): [number, number, number, number] {
  if (component.type !== "switch_spst") return [...EDITOR_SYMBOLS[component.type].bbox];
  const definition = EDITOR_SYMBOLS.switch_spst;
  const pivot = definition.leverPivot ?? [-0.8, 0];
  const angle = component.params?.closed ? SWITCH_CLOSED_ANGLE : 0;
  const leverPoints = [rotateAround([-0.6, -0.1], pivot, angle), rotateAround([0.6, -0.7], pivot, angle)];
  return [
    Math.min(-2, ...leverPoints.map((point) => point[0])),
    Math.min(-0.2, ...leverPoints.map((point) => point[1])),
    Math.max(2, ...leverPoints.map((point) => point[0])),
    Math.max(0.2, ...leverPoints.map((point) => point[1])),
  ];
}

export function partSymbolMarkup(type: ComponentType): string {
  const component = { id: "x", type, pos: [0, 0], rot: 0, mirror: false } as CircuitComponent;
  const [minX, minY, maxX, maxY] = componentBbox(component);
  const margin = 0.65;
  return `<svg class="editor-symbol part-symbol" viewBox="${minX - margin} ${minY - margin} ${maxX - minX + margin * 2} ${maxY - minY + margin * 2}" aria-hidden="true">${renderedSymbol(component, false)}</svg>`;
}

function transform(component: CircuitComponent): string {
  return `translate(${component.pos[0]} ${component.pos[1]}) rotate(${component.rot}) scale(${component.mirror ? -1 : 1} 1)`;
}

function compactWire(points: Point[]): Point[] {
  const compacted: Point[] = [];
  for (const source of points) {
    const point = clonePoint(source);
    if (compacted.length && samePoint(compacted.at(-1)!, point)) continue;
    compacted.push(point);
    while (compacted.length >= 3) {
      const a = compacted.at(-3)!;
      const b = compacted.at(-2)!;
      const c = compacted.at(-1)!;
      if (!((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]))) break;
      compacted.splice(compacted.length - 2, 1);
    }
  }
  return compacted;
}

function orthogonalLeg(start: Point, end: Point, horizontalFirst: boolean): Point[] {
  if (samePoint(start, end)) return [];
  if (start[0] === end[0] || start[1] === end[1]) return [clonePoint(end)];
  return horizontalFirst
    ? [[end[0], start[1]], clonePoint(end)]
    : [[start[0], end[1]], clonePoint(end)];
}

function pointInSegmentInterior(point: Point, a: Point, b: Point): boolean {
  if (a[0] === b[0] && point[0] === a[0]) return point[1] > Math.min(a[1], b[1]) && point[1] < Math.max(a[1], b[1]);
  if (a[1] === b[1] && point[1] === a[1]) return point[0] > Math.min(a[0], b[0]) && point[0] < Math.max(a[0], b[0]);
  return false;
}

function normalizeJunctions(document: CircuitDocument): void {
  for (const wire of document.wires) wire.points = wire.points.filter((point, index, points) => index === 0 || !samePoint(point, points[index - 1]!)).map(clonePoint);
  const candidates = new Map<string, { point: Point; wireIds: Set<string>; pin: boolean }>();
  for (const wire of document.wires) {
    for (const endpoint of [wire.points[0], wire.points.at(-1)]) {
      if (!endpoint) continue;
      const key = pointKey(endpoint);
      const candidate = candidates.get(key) ?? { point: clonePoint(endpoint), wireIds: new Set<string>(), pin: false };
      candidate.wireIds.add(wire.id);
      candidates.set(key, candidate);
    }
  }
  for (const component of document.components) {
    for (const pin of componentPinPoints(component)) {
      const key = pointKey(pin);
      const candidate = candidates.get(key) ?? { point: clonePoint(pin), wireIds: new Set<string>(), pin: false };
      candidate.pin = true;
      candidates.set(key, candidate);
    }
  }

  for (const wire of document.wires) {
    const normalized: Point[] = [];
    for (let index = 1; index < wire.points.length; index += 1) {
      const a = wire.points[index - 1]!;
      const b = wire.points[index]!;
      if (index === 1) normalized.push(clonePoint(a));
      const insertions = [...candidates.values()]
        .filter((candidate) => (candidate.pin || [...candidate.wireIds].some((id) => id !== wire.id)) && pointInSegmentInterior(candidate.point, a, b))
        .sort((left, right) => {
          const leftDistance = Math.hypot(left.point[0] - a[0], left.point[1] - a[1]);
          const rightDistance = Math.hypot(right.point[0] - a[0], right.point[1] - a[1]);
          return leftDistance - rightDistance;
        });
      for (const insertion of insertions) normalized.push(clonePoint(insertion.point));
      normalized.push(clonePoint(b));
    }
    wire.points = normalized.filter((point, index, points) => index === 0 || !samePoint(point, points[index - 1]!));
  }
}

function rubberBandWire(original: Point[], start: Point | undefined, end: Point | undefined): Point[] {
  if (original.length < 2) return original.map(clonePoint);
  let points = original.map(clonePoint);
  if (start) {
    const oldStart = original[0]!;
    const neighbor = original[1]!;
    points[0] = clonePoint(start);
    if (start[0] !== neighbor[0] && start[1] !== neighbor[1]) {
      const bend: Point = oldStart[1] === neighbor[1] ? [neighbor[0], start[1]] : [start[0], neighbor[1]];
      points.splice(1, 0, bend);
    }
  }
  if (end) {
    const oldEnd = original.at(-1)!;
    const neighbor = original.at(-2)!;
    points[points.length - 1] = clonePoint(end);
    if (end[0] !== neighbor[0] && end[1] !== neighbor[1]) {
      const bend: Point = oldEnd[1] === neighbor[1] ? [neighbor[0], end[1]] : [end[0], neighbor[1]];
      points.splice(points.length - 1, 0, bend);
    }
  }
  return compactWire(points);
}

function flowForCurrent(current: number): { u: number; spacing: number } | undefined {
  const magnitude = Math.abs(current);
  if (magnitude < 1e-6) return undefined;
  const u = clamp(Math.log10(magnitude / 1e-6) / 4, 0, 1);
  return { u, spacing: 34 - 16 * u };
}

function pointOnPolyline(points: Point[], distance: number): { point: Point; angle: number } {
  let remaining = distance;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    remaining -= length;
  }
  return { point: points.at(-1) ?? [0, 0], angle: 0 };
}

function polylineLength(points: Point[]): number {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index]![0], point[1] - points[index]![1]), 0);
}

function formatEngineeringValue(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  const prefixes: [number, string][] = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "u"], [1e-9, "n"], [1e-12, "p"]];
  const absolute = Math.abs(value);
  const [factor, suffix] = prefixes.find(([candidate]) => absolute >= candidate) ?? prefixes.at(-1)!;
  const scaled = value / factor;
  const precision = Math.max(0, 4 - Math.floor(Math.log10(Math.abs(scaled))) - 1);
  return `${Number(scaled.toFixed(precision))}${suffix}`;
}

function valueLabelPosition(component: CircuitComponent): { point: Point; anchor: "start" | "middle" | "end" } {
  const [minX, minY, maxX, maxY] = componentBbox(component);
  const offset = component.label?.offset ?? [0, minY - 1.5];
  if (Math.abs(offset[0]) >= Math.abs(offset[1]) && offset[0] !== 0) {
    return offset[0] < 0
      ? { point: [maxX + 1.2, offset[1]], anchor: "start" }
      : { point: [minX - 1.2, offset[1]], anchor: "end" };
  }
  return offset[1] <= 0
    ? { point: [offset[0], maxY + 1.5], anchor: "middle" }
    : { point: [offset[0], minY - 1.2], anchor: "middle" };
}

export class SchematicEditor {
  readonly element: SVGSVGElement;
  private doc: CircuitDocument;
  private tool: Tool = "select";
  private selectedComponents = new Set<string>();
  private selectedWires = new Set<string>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private gestureSnapshot = "";
  private wirePoints: Point[] | undefined;
  private wirePreview: Point | undefined;
  private wireSnap: SnapCandidate | undefined;
  private wireHorizontalFirst = true;
  private pan: Point;
  private zoom: number;
  private space = false;
  private drag: Drag | undefined;
  private hoveredWire: string | undefined;
  private ghostPoint: Point | undefined;
  private pendingRotation: CircuitComponent["rot"] = 0;
  private pendingMirror = false;
  private readonly wireStyles = new Map<string, WireStyle>();
  private readonly wireCurrents = new Map<string, number>();
  private forcedStatic = false;
  private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(private readonly host: HTMLElement, private readonly options: SchematicEditorOptions) {
    this.doc = structuredClone(options.document);
    this.pan = this.doc.view?.pan ?? [0, 0];
    this.zoom = this.doc.view?.zoom ?? 1;
    this.element = document.createElementNS(NS, "svg");
    this.element.classList.add("schematic-editor");
    this.element.tabIndex = 0;
    this.element.setAttribute("aria-label", "Circuit schematic editor");
    host.replaceChildren(this.element);
    this.bindRoot();
    this.reducedMotion.addEventListener("change", () => this.applyStaticEncoding());
    document.addEventListener("visibilitychange", () => this.applyStaticEncoding());
    this.render();
  }

  getDocument(): CircuitDocument { return structuredClone(this.doc); }
  getView(): { pan: Point; zoom: number } { return { pan: [...this.pan], zoom: this.zoom }; }
  edit(mutator: (document: CircuitDocument) => void): void { this.change(() => mutator(this.doc)); }
  beginGesture(): void { if (!this.gestureSnapshot) this.gestureSnapshot = canonicalizeCircuit(this.doc); }
  editLive(mutator: (document: CircuitDocument) => void): void {
    mutator(this.doc);
    this.render();
    this.emit("edit");
  }
  endGesture(): void {
    if (this.gestureSnapshot && this.gestureSnapshot !== canonicalizeCircuit(this.doc)) {
      this.undoStack.push(this.gestureSnapshot);
      this.redoStack = [];
    }
    this.gestureSnapshot = "";
  }
  setDocument(document: CircuitDocument, resetHistory = true): void {
    this.cancelWire();
    this.doc = structuredClone(document);
    this.pan = this.doc.view?.pan ?? [0, 0];
    this.zoom = this.doc.view?.zoom ?? 1;
    if (resetHistory) { this.undoStack = []; this.redoStack = []; }
    this.wireStyles.clear();
    this.wireCurrents.clear();
    this.clearSelection();
    this.render();
  }
  setTool(tool: Tool): void {
    this.cancelWire();
    this.tool = tool;
    this.pendingRotation = 0;
    this.pendingMirror = false;
    this.ghostPoint = this.isComponentTool(tool) ? this.canvasCenter() : undefined;
    this.render();
  }
  getTool(): Tool { return this.tool; }
  selected(): { components: string[]; wires: string[] } { return { components: [...this.selectedComponents], wires: [...this.selectedWires] }; }
  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
  undo(): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return;
    this.redoStack.push(canonicalizeCircuit(this.doc));
    this.doc = deserializeCircuit(snapshot);
    this.clearSelection();
    this.render();
    this.emit("undo");
  }
  redo(): void {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return;
    this.undoStack.push(canonicalizeCircuit(this.doc));
    this.doc = deserializeCircuit(snapshot);
    this.clearSelection();
    this.render();
    this.emit("redo");
  }
  rotate(): void {
    if (this.isComponentTool(this.tool)) {
      this.pendingRotation = ((this.pendingRotation + 90) % 360) as CircuitComponent["rot"];
      this.render();
      return;
    }
    this.change(() => {
      for (const id of this.selectedComponents) {
        const component = this.doc.components.find((item) => item.id === id);
        if (component) component.rot = ((component.rot + 90) % 360) as CircuitComponent["rot"];
      }
    });
  }
  mirror(): void {
    if (this.isComponentTool(this.tool)) {
      this.pendingMirror = !this.pendingMirror;
      this.render();
      return;
    }
    this.change(() => {
      for (const id of this.selectedComponents) {
        const component = this.doc.components.find((item) => item.id === id);
        if (component) component.mirror = !component.mirror;
      }
    });
  }
  deleteSelected(): void { this.change(() => { this.doc.components = this.doc.components.filter((component) => !this.selectedComponents.has(component.id)); this.doc.wires = this.doc.wires.filter((wire) => !this.selectedWires.has(wire.id)); this.clearSelection(); }); }
  copy(): string { return JSON.stringify({ components: this.doc.components.filter((component) => this.selectedComponents.has(component.id)), wires: this.doc.wires.filter((wire) => this.selectedWires.has(wire.id)) }); }
  paste(source?: string): void {
    const raw = source ?? sessionStorage.getItem("schemagic.clipboard") ?? "";
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { components: CircuitComponent[]; wires: CircuitDocument["wires"] };
      this.change(() => {
        this.clearSelection();
        let componentIndex = idMax(this.doc.components, "c");
        let wireIndex = idMax(this.doc.wires, "w");
        for (const original of data.components ?? []) {
          const component = structuredClone(original);
          component.id = `c${++componentIndex}`;
          component.pos = [component.pos[0] + 2, component.pos[1] + 2];
          this.doc.components.push(component);
          this.selectedComponents.add(component.id);
        }
        for (const original of data.wires ?? []) {
          const wire = structuredClone(original);
          wire.id = `w${++wireIndex}`;
          wire.points = wire.points.map(([x, y]) => [x + 2, y + 2]);
          this.doc.wires.push(wire);
          this.selectedWires.add(wire.id);
        }
      });
    } catch {}
  }
  copyToClipboard(): void {
    const value = this.copy();
    sessionStorage.setItem("schemagic.clipboard", value);
    void navigator.clipboard?.writeText(value).catch(() => undefined);
  }
  fit(): void {
    const points = [...this.doc.components.map((component) => component.pos), ...this.doc.wires.flatMap((wire) => wire.points)];
    if (!points.length) { this.pan = [0, 0]; this.zoom = 1; }
    else {
      const rect = this.host.getBoundingClientRect();
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      const minX = Math.min(...xs) - 6;
      const maxX = Math.max(...xs) + 6;
      const minY = Math.min(...ys) - 6;
      const maxY = Math.max(...ys) + 6;
      this.zoom = clamp(Math.min(rect.width / GRID / (maxX - minX), rect.height / GRID / (maxY - minY)), 0.25, 4);
      this.pan = [rect.width / 2 - (minX + maxX) / 2 * GRID * this.zoom, rect.height / 2 - (minY + maxY) / 2 * GRID * this.zoom];
    }
    this.saveView();
    this.render();
  }
  setWireStyle(id: string, style: WireStyle): void {
    this.wireStyles.set(id, style);
    this.applyWireStyle(id, style);
    this.applyStaticEncoding();
  }
  setWireCurrent(id: string, current: number): void {
    this.wireCurrents.set(id, current);
    this.applyStaticEncoding();
  }
  setStaticCurrentEncoding(active: boolean): void {
    this.forcedStatic = active;
    this.applyStaticEncoding();
  }
  setLedBrightness(id: string, brightness: number): void {
    const element = this.element.querySelector<SVGCircleElement>(`[data-led-halo="${id}"]`);
    if (element) {
      element.style.opacity = String(clamp(brightness, 0, 1) * 0.78);
      element.setAttribute("r", String(3 + clamp(brightness, 0, 1) * 5));
    }
  }
  exportSvg(): string {
    const clone = this.element.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll(".editor-hit,.editor-component-hit,.editor-selection,.selection-box,.wire-preview,.pot-hit,.snap-indicator,.placement-ghost,.pin-open").forEach((element) => element.remove());
    clone.setAttribute("xmlns", NS);
    clone.setAttribute("viewBox", `0 0 ${this.host.clientWidth} ${this.host.clientHeight}`);
    clone.setAttribute("width", String(this.host.clientWidth));
    clone.setAttribute("height", String(this.host.clientHeight));
    clone.removeAttribute("tabindex");
    const computed = getComputedStyle(this.element);
    const color = (name: string, fallback: string) => computed.getPropertyValue(name).trim() || fallback;
    const vellum = color("--vellum", "#F1EEE8");
    const graphite900 = color("--graphite-900", "#15181B");
    const graphite700 = color("--graphite-700", "#2A2F34");
    const graphite500 = color("--graphite-500", "#6E7378");
    const style = document.createElementNS(NS, "style");
    style.textContent = `.editor-bg{fill:${vellum}}.grid-dot{fill:${graphite500};opacity:.22}.editor-symbol,.editor-symbol *{fill:none;stroke:${graphite900};stroke-width:1.5;stroke-linecap:square;stroke-linejoin:miter;vector-effect:non-scaling-stroke}.editor-symbol .sym-bg{fill:${vellum}}.editor-symbol .sym-solid{fill:${graphite900};stroke:${graphite900};stroke-width:1}.editor-symbol .sym-bold{stroke-width:2.2}.editor-symbol .pin-lead{stroke-width:1.4}.editor-label{fill:${graphite700};stroke:${vellum};paint-order:stroke fill;font-family:sans-serif;font-weight:500;pointer-events:none}.editor-value{fill:${graphite700}}.editor-wire{fill:none;stroke:${graphite500};stroke-width:1.8;stroke-linecap:square;stroke-linejoin:miter;vector-effect:non-scaling-stroke}.connection-node{fill:${graphite700};stroke:${graphite700};stroke-width:1;vector-effect:non-scaling-stroke}.static-chevron{fill:none;stroke:${graphite900};stroke-width:1;stroke-linecap:square;stroke-linejoin:miter;vector-effect:non-scaling-stroke}.editor-led-halo{pointer-events:none}`;
    (clone.querySelector("defs") ?? clone).append(style);
    this.applyStaticEncoding(clone, true);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }

  private bindRoot(): void {
    this.element.addEventListener("wheel", (event) => {
      event.preventDefault();
      const before = this.toWorld(event.clientX, event.clientY);
      this.zoom = clamp(this.zoom * Math.exp(-event.deltaY * 0.0015), 0.2, 6);
      const rect = this.element.getBoundingClientRect();
      this.pan = [event.clientX - rect.left - before[0] * GRID * this.zoom, event.clientY - rect.top - before[1] * GRID * this.zoom];
      this.saveView();
      this.render();
    }, { passive: false });
    this.element.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.element.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.element.addEventListener("pointerup", (event) => this.pointerUp(event));
    this.element.addEventListener("pointercancel", (event) => this.pointerUp(event));
    this.element.addEventListener("dblclick", (event) => {
      if (!this.wirePoints) return;
      event.preventDefault();
      this.finishWire(false);
    });
    this.element.addEventListener("contextmenu", (event) => {
      if (!this.wirePoints) return;
      event.preventDefault();
      this.cancelWire();
      this.render();
    });
    this.element.addEventListener("pointerleave", () => {
      if (!this.drag && this.hoveredWire !== undefined) {
        this.hoveredWire = undefined;
        this.options.onHoverWire?.(undefined);
      }
    });
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as Element).tagName === "INPUT") return;
      if (event.key === " ") { this.space = true; event.preventDefault(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") { event.preventDefault(); this.redo(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") { event.preventDefault(); this.copyToClipboard(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") { event.preventDefault(); this.paste(); }
      else if (event.key === "Enter" && this.wirePoints) { event.preventDefault(); event.stopPropagation(); this.finishWire(true); }
      else if (event.key === "/" && this.wirePoints) { event.preventDefault(); this.wireHorizontalFirst = !this.wireHorizontalFirst; this.render(); }
      else if (event.key.toLowerCase() === "r") this.rotate();
      else if (event.key.toLowerCase() === "x") this.mirror();
      else if (event.key.toLowerCase() === "f") this.fit();
      else if (event.key === "Delete" || event.key === "Backspace") this.deleteSelected();
      else if (event.key === "Escape") {
        if (this.wirePoints) { this.cancelWire(); this.render(); }
        else this.setTool("select");
      }
    };
    this.element.addEventListener("keydown", keydown);
    window.addEventListener("keydown", (event) => { if (document.activeElement !== this.element && this.wirePoints) keydown(event); });
    this.element.addEventListener("keyup", (event) => { if (event.key === " ") this.space = false; });
  }

  private pointerDown(event: PointerEvent): void {
    this.element.focus();
    const target = event.target as SVGElement;
    const raw = this.toWorld(event.clientX, event.clientY);
    const world = this.snap(raw);
    if (event.button === 2) {
      if (this.wirePoints) { this.cancelWire(); this.render(); }
      return;
    }
    if (this.space || event.button === 1) {
      this.drag = { kind: "pan", start: [event.clientX, event.clientY], origin: [...this.pan] };
      this.element.setPointerCapture(event.pointerId);
      return;
    }
    if (this.wirePoints || this.tool === "wire") {
      const candidate = this.findWireSnap(raw);
      this.commitWireClick(candidate?.point ?? world, candidate);
      return;
    }
    if (this.isComponentTool(this.tool)) {
      const point = this.ghostPoint ?? world;
      this.change(() => {
        const part = partByType(this.tool as ComponentType);
        const id = `c${idMax(this.doc.components, "c") + 1}`;
        const component: CircuitComponent = {
          id,
          type: part.type,
          pos: clonePoint(point),
          rot: this.pendingRotation,
          mirror: this.pendingMirror,
          label: { text: `${part.prefix}${id.slice(1)}`, offset: [0, -3] },
          ...(part.defaultValue !== undefined ? { value: part.defaultValue } : {}),
          ...(part.type === "potentiometer" ? { params: { t: 0.5 } } : {}),
        };
        this.doc.components.push(component);
        normalizeJunctions(this.doc);
        this.clearSelection();
        this.selectedComponents.add(id);
      });
      this.tool = "select";
      this.ghostPoint = undefined;
      this.pendingRotation = 0;
      this.pendingMirror = false;
      this.render();
      return;
    }

    const potId = target.closest<SVGElement>("[data-pot-hit]")?.dataset.potHit;
    if (potId) {
      this.clearSelection();
      this.selectedComponents.add(potId);
      this.emitSelection();
      this.beginGesture();
      this.drag = { kind: "pot", id: potId };
      this.options.onLiveGesture?.(true, potId);
      this.element.setPointerCapture(event.pointerId);
      this.updatePotFromPointer(potId, event.clientX, event.clientY);
      return;
    }

    const pin = this.findNearestPin(raw);
    if (pin) {
      this.beginWire(pin.point);
      this.wireSnap = pin;
      this.render();
      return;
    }

    const componentId = target.closest<SVGGElement>("[data-component-id]")?.dataset.componentId;
    const wireId = target.closest<SVGElement>("[data-wire-id]")?.dataset.wireId;
    if (componentId) {
      if (!event.shiftKey && !this.selectedComponents.has(componentId)) this.clearSelection();
      this.selectedComponents.add(componentId);
      this.beginGesture();
      this.drag = this.makeComponentDrag(componentId);
      this.emitSelection();
      this.element.setPointerCapture(event.pointerId);
      this.render();
    } else if (wireId) {
      if (!event.shiftKey) this.clearSelection();
      this.selectedWires.add(wireId);
      this.emitSelection();
      this.options.onWireActivate?.(wireId);
      this.render();
    } else {
      if (!event.shiftKey) this.clearSelection();
      this.drag = { kind: "box", start: world, end: world };
      this.element.setPointerCapture(event.pointerId);
      this.emitSelection();
      this.render();
    }
  }

  private pointerMove(event: PointerEvent): void {
    const raw = this.toWorld(event.clientX, event.clientY);
    const world = this.snap(raw);
    if (this.isComponentTool(this.tool) && !this.drag) this.ghostPoint = world;
    if (!this.drag && !this.wirePoints) {
      const id = (event.target as Element).closest<SVGElement>("[data-wire-id]")?.dataset.wireId;
      if (id !== this.hoveredWire) {
        this.hoveredWire = id;
        this.options.onHoverWire?.(id);
      }
    }
    if (this.wirePoints) {
      const candidate = this.findWireSnap(raw);
      this.wireSnap = candidate;
      this.wirePreview = candidate?.point ?? world;
      this.render();
      return;
    }
    if (!this.drag) {
      if (this.isComponentTool(this.tool)) this.render();
      return;
    }
    if (this.drag.kind === "pot") { this.updatePotFromPointer(this.drag.id, event.clientX, event.clientY); return; }
    if (this.drag.kind === "pan") { this.pan = [this.drag.origin[0] + event.clientX - this.drag.start[0], this.drag.origin[1] + event.clientY - this.drag.start[1]]; this.render(); return; }
    if (this.drag.kind === "component") {
      this.updateComponentDrag(this.drag, world);
      this.render();
      return;
    }
    this.drag.end = world;
    this.render();
  }

  private pointerUp(event: PointerEvent): void {
    if (!this.drag) return;
    if (this.drag.kind === "component") {
      if (this.drag.moved) {
        for (const wire of this.doc.wires) wire.points = compactWire(wire.points);
        normalizeJunctions(this.doc);
      }
      const changed = Boolean(this.gestureSnapshot && this.gestureSnapshot !== canonicalizeCircuit(this.doc));
      this.endGesture();
      if (changed) this.emit("edit");
    } else if (this.drag.kind === "pot") {
      const id = this.drag.id;
      this.endGesture();
      this.options.onLiveGesture?.(false, id);
    } else if (this.drag.kind === "box") {
      const a = this.drag.start;
      const b = this.drag.end;
      const minX = Math.min(a[0], b[0]);
      const maxX = Math.max(a[0], b[0]);
      const minY = Math.min(a[1], b[1]);
      const maxY = Math.max(a[1], b[1]);
      for (const component of this.doc.components) if (component.pos[0] >= minX && component.pos[0] <= maxX && component.pos[1] >= minY && component.pos[1] <= maxY) this.selectedComponents.add(component.id);
      for (const wire of this.doc.wires) if (wire.points.some((point) => point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY)) this.selectedWires.add(wire.id);
      this.emitSelection();
    } else if (this.drag.kind === "pan") {
      this.saveView();
      this.emit("view");
    }
    this.drag = undefined;
    if (this.element.hasPointerCapture(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
    this.render();
  }

  private makeComponentDrag(id: string): Extract<Drag, { kind: "component" }> {
    const origins = new Map<string, Point>();
    for (const component of this.doc.components) if (this.selectedComponents.has(component.id)) origins.set(component.id, clonePoint(component.pos));
    const selectedPins = new Map<string, PinReference>();
    for (const component of this.doc.components) {
      if (!this.selectedComponents.has(component.id)) continue;
      componentPinPoints(component).forEach((pin, pinIndex) => selectedPins.set(pointKey(pin), { componentId: component.id, pinIndex }));
    }
    const originalWires = new Map<string, Point[]>();
    const attachments = new Map<string, WireAttachment>();
    for (const wire of this.doc.wires) {
      const start = wire.points[0] ? selectedPins.get(pointKey(wire.points[0])) : undefined;
      const end = wire.points.at(-1) ? selectedPins.get(pointKey(wire.points.at(-1)!)) : undefined;
      if (!start && !end) continue;
      originalWires.set(wire.id, wire.points.map(clonePoint));
      attachments.set(wire.id, { ...(start ? { start } : {}), ...(end ? { end } : {}) });
    }
    return { kind: "component", id, origins, originalWires, attachments, moved: false };
  }

  private updateComponentDrag(drag: Extract<Drag, { kind: "component" }>, anchor: Point): void {
    const primaryOrigin = drag.origins.get(drag.id);
    if (!primaryOrigin) return;
    const delta: Point = [anchor[0] - primaryOrigin[0], anchor[1] - primaryOrigin[1]];
    for (const [id, origin] of drag.origins) {
      const component = this.doc.components.find((item) => item.id === id);
      if (component) component.pos = [origin[0] + delta[0], origin[1] + delta[1]];
    }
    for (const [wireId, attachment] of drag.attachments) {
      const wire = this.doc.wires.find((item) => item.id === wireId);
      const original = drag.originalWires.get(wireId);
      if (!wire || !original) continue;
      const attachedPoint = (reference: PinReference | undefined): Point | undefined => {
        if (!reference) return undefined;
        const component = this.doc.components.find((item) => item.id === reference.componentId);
        return componentPinPoints(component!)[reference.pinIndex];
      };
      wire.points = rubberBandWire(original, attachedPoint(attachment.start), attachedPoint(attachment.end));
    }
    drag.moved = drag.moved || delta[0] !== 0 || delta[1] !== 0;
  }

  private updatePotFromPointer(id: string, clientX: number, clientY: number): void {
    const component = this.doc.components.find((item) => item.id === id && item.type === "potentiometer");
    if (!component) return;
    const world = this.toWorld(clientX, clientY);
    const dx = world[0] - component.pos[0];
    const dy = world[1] - component.pos[1];
    const radians = -component.rot * Math.PI / 180;
    const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
    const t = clamp((6 - localY) / 12, 0.005, 0.995);
    this.editLive((document) => {
      const pot = document.components.find((item) => item.id === id);
      if (pot) pot.params = { ...(pot.params ?? {}), t };
    });
  }

  private beginWire(point: Point): void {
    this.wirePoints = [clonePoint(point)];
    this.wirePreview = clonePoint(point);
    this.wireHorizontalFirst = true;
    this.options.onMidWire?.(true);
  }

  private commitWireClick(point: Point, candidate: SnapCandidate | undefined): void {
    if (!this.wirePoints) {
      this.beginWire(point);
      this.wireSnap = candidate;
      this.render();
      return;
    }
    const start = this.wirePoints.at(-1)!;
    this.wirePoints = compactWire([...this.wirePoints, ...orthogonalLeg(start, point, this.wireHorizontalFirst)]);
    this.wirePreview = clonePoint(point);
    this.wireSnap = candidate;
    if (candidate && this.wirePoints.length >= 2) this.finishWire(false);
    else this.render();
  }

  private finishWire(includePreview: boolean): void {
    if (!this.wirePoints) return;
    let points = this.wirePoints.map(clonePoint);
    if (includePreview && this.wirePreview) points = compactWire([...points, ...orthogonalLeg(points.at(-1)!, this.wirePreview, this.wireHorizontalFirst)]);
    points = compactWire(points);
    this.cancelWire();
    if (points.length < 2) { this.render(); return; }
    this.change(() => {
      this.doc.wires.push({ id: `w${idMax(this.doc.wires, "w") + 1}`, points });
      normalizeJunctions(this.doc);
    });
  }

  private cancelWire(): void {
    const active = Boolean(this.wirePoints);
    this.wirePoints = undefined;
    this.wirePreview = undefined;
    this.wireSnap = undefined;
    if (active) this.options.onMidWire?.(false);
  }

  private findNearestPin(raw: Point): SnapCandidate | undefined {
    let nearest: SnapCandidate | undefined;
    const radius = SNAP_RADIUS_PX / (GRID * this.zoom);
    for (const component of this.doc.components) {
      componentPinPoints(component).forEach((pin, pinIndex) => {
        const distance = Math.hypot(pin[0] - raw[0], pin[1] - raw[1]);
        if (distance <= radius && (!nearest || distance < nearest.distance)) nearest = { point: clonePoint(pin), kind: "pin", distance, componentId: component.id, pinIndex };
      });
    }
    return nearest;
  }

  private findWireSnap(raw: Point): SnapCandidate | undefined {
    const candidates: SnapCandidate[] = [];
    const pin = this.findNearestPin(raw);
    if (pin) candidates.push(pin);
    const radius = SNAP_RADIUS_PX / (GRID * this.zoom);
    for (const wire of this.doc.wires) {
      for (const vertex of wire.points) {
        const distance = Math.hypot(vertex[0] - raw[0], vertex[1] - raw[1]);
        if (distance <= radius) candidates.push({ point: clonePoint(vertex), kind: "vertex", distance, wireId: wire.id });
      }
      for (let index = 1; index < wire.points.length; index += 1) {
        const a = wire.points[index - 1]!;
        const b = wire.points[index]!;
        let candidate: Point | undefined;
        if (a[0] === b[0]) {
          const y = clamp(Math.round(raw[1]), Math.min(a[1], b[1]) + 1, Math.max(a[1], b[1]) - 1);
          if (y > Math.min(a[1], b[1]) && y < Math.max(a[1], b[1])) candidate = [a[0], y];
        } else if (a[1] === b[1]) {
          const x = clamp(Math.round(raw[0]), Math.min(a[0], b[0]) + 1, Math.max(a[0], b[0]) - 1);
          if (x > Math.min(a[0], b[0]) && x < Math.max(a[0], b[0])) candidate = [x, a[1]];
        }
        if (!candidate) continue;
        const distance = Math.hypot(candidate[0] - raw[0], candidate[1] - raw[1]);
        if (distance <= radius) candidates.push({ point: candidate, kind: "segment", distance, wireId: wire.id });
      }
    }
    const priority: Record<SnapCandidate["kind"], number> = { pin: 0, vertex: 1, segment: 2 };
    return candidates.sort((left, right) => left.distance - right.distance || priority[left.kind] - priority[right.kind])[0];
  }

  private toWorld(x: number, y: number): Point {
    const rect = this.element.getBoundingClientRect();
    return [(x - rect.left - this.pan[0]) / GRID / this.zoom, (y - rect.top - this.pan[1]) / GRID / this.zoom];
  }
  private snap([x, y]: Point): Point { return [Math.round(x), Math.round(y)]; }
  private canvasCenter(): Point {
    const rect = this.element.getBoundingClientRect();
    return this.snap(this.toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2));
  }
  private isComponentTool(tool: Tool): tool is ComponentType { return tool !== "select" && tool !== "wire"; }
  private saveView(): void { this.doc.view = { pan: [...this.pan], zoom: this.zoom }; }
  private change(fn: () => void): void {
    const before = canonicalizeCircuit(this.doc);
    fn();
    const after = canonicalizeCircuit(this.doc);
    if (before !== after) { this.undoStack.push(before); this.redoStack = []; this.emit("edit"); }
    this.emitSelection();
    this.render();
  }
  private clearSelection(): void { this.selectedComponents.clear(); this.selectedWires.clear(); this.emitSelection(); }
  private emit(reason: EditorChange["reason"]): void { this.options.onChange?.({ document: this.getDocument(), reason }); }
  private emitSelection(): void { this.options.onSelection?.([...this.selectedComponents], [...this.selectedWires]); }
  private applyWireStyle(id: string, style: WireStyle): void {
    const element = this.element.querySelector<SVGPathElement>(`path.editor-wire[data-wire-id="${id}"]`);
    if (!element) return;
    element.style.stroke = style.stroke;
    element.style.strokeDasharray = style.dash ?? "none";
    element.style.strokeWidth = String(style.width ?? 1.8);
    element.style.opacity = String(style.opacity ?? 1);
  }
  private shouldUseStaticEncoding(): boolean { return this.forcedStatic || this.reducedMotion.matches || document.hidden; }
  private applyStaticEncoding(root: SVGSVGElement = this.element, force = false): void {
    const layer = root.querySelector<SVGGElement>("#chevron-layer");
    if (!layer) return;
    layer.replaceChildren();
    const enabled = force || this.shouldUseStaticEncoding();
    for (const wire of this.doc.wires) {
      const style = this.wireStyles.get(wire.id);
      const wirePath = root.querySelector<SVGPathElement>(`path.editor-wire[data-wire-id="${wire.id}"]`);
      if (!wirePath) continue;
      if (!enabled) {
        if (style) wirePath.style.strokeWidth = String(style.width ?? 1.8);
        continue;
      }
      const current = this.wireCurrents.get(wire.id) ?? 0;
      const flow = flowForCurrent(current);
      if (!flow) {
        wirePath.style.strokeWidth = "0.9";
        continue;
      }
      const width = [0.9, 1.4, 2, 2.8][Math.min(3, Math.floor(flow.u * 4))]!;
      wirePath.style.strokeWidth = String(width);
      const scale = GRID * this.zoom;
      const spacing = flow.spacing / scale;
      const size = 3 / scale;
      const length = polylineLength(wire.points);
      for (let distance = spacing / 2; distance < length; distance += spacing) {
        const location = pointOnPolyline(wire.points, distance);
        const degrees = location.angle * 180 / Math.PI + (current < 0 ? 180 : 0);
        const chevron = document.createElementNS(NS, "path");
        chevron.classList.add("static-chevron");
        chevron.setAttribute("transform", `translate(${location.point[0]} ${location.point[1]}) rotate(${degrees})`);
        chevron.setAttribute("d", `M${-size} ${-size}L${size / 3} 0L${-size} ${size}`);
        layer.append(chevron);
      }
    }
  }

  private render(): void {
    const wirePointKeys = new Set(this.doc.wires.flatMap((wire) => wire.points.map(pointKey)));
    const pinCounts = new Map<string, number>();
    const pins = this.doc.components.flatMap((component) => componentPinPoints(component).map((point, pinIndex) => ({ component, point, pinIndex })));
    for (const pin of pins) pinCounts.set(pointKey(pin.point), (pinCounts.get(pointKey(pin.point)) ?? 0) + 1);

    const legDirections = new Map<string, Set<string>>();
    const addLeg = (point: Point, other: Point) => {
      const dx = Math.sign(other[0] - point[0]);
      const dy = Math.sign(other[1] - point[1]);
      const directions = legDirections.get(pointKey(point)) ?? new Set<string>();
      directions.add(`${dx},${dy}`);
      legDirections.set(pointKey(point), directions);
    };
    for (const wire of this.doc.wires) {
      for (let index = 1; index < wire.points.length; index += 1) {
        addLeg(wire.points[index - 1]!, wire.points[index]!);
        addLeg(wire.points[index]!, wire.points[index - 1]!);
      }
    }

    let preview: Point[] = [];
    if (this.wirePoints?.length) {
      preview = this.wirePoints.map(clonePoint);
      if (this.wirePreview) preview = compactWire([...preview, ...orthogonalLeg(preview.at(-1)!, this.wirePreview, this.wireHorizontalFirst)]);
    }
    const selection = this.drag?.kind === "box"
      ? `<rect class="selection-box" x="${Math.min(this.drag.start[0], this.drag.end[0])}" y="${Math.min(this.drag.start[1], this.drag.end[1])}" width="${Math.abs(this.drag.start[0] - this.drag.end[0])}" height="${Math.abs(this.drag.start[1] - this.drag.end[1])}"/>`
      : "";
    const labelSize = (11 / (GRID * this.zoom)).toFixed(4);
    const labelKnockout = (3 / (GRID * this.zoom)).toFixed(4);
    const junctionRadius = (3.5 / (GRID * this.zoom)).toFixed(4);
    const pinRadius = (3 / (GRID * this.zoom)).toFixed(4);
    const snapRadius = (5 / (GRID * this.zoom)).toFixed(4);

    const components = this.doc.components.map((component) => {
      const [minX, minY, maxX, maxY] = componentBbox(component);
      const hitX = minX - 0.5;
      const hitY = minY - 0.5;
      const hitWidth = maxX - minX + 1;
      const hitHeight = maxY - minY + 1;
      const textTransform = `scale(${component.mirror ? -1 : 1} 1) rotate(${-component.rot})`;
      const refdes = component.type === "ground" || !component.label?.text ? "" : `<text class="editor-label" style="font-size:${labelSize}px;stroke-width:${labelKnockout}px" x="${component.label.offset[0]}" y="${component.label.offset[1]}" transform="${textTransform}">${esc(component.label.text)}</text>`;
      let value = "";
      if (component.value !== undefined && component.type !== "ground" && component.type !== "switch_spst" && !(component.type === "opamp_ideal" && component.value === undefined)) {
        const position = valueLabelPosition(component);
        const display = typeof component.value === "number" ? formatEngineeringValue(component.value) : component.value;
        value = `<text class="editor-label editor-value" style="font-size:${labelSize}px;stroke-width:${labelKnockout}px" x="${position.point[0]}" y="${position.point[1]}" text-anchor="${position.anchor}" transform="${textTransform}">${esc(display)}</text>`;
      }
      return `<g data-component-id="${component.id}" data-anchor-x="${component.pos[0]}" data-anchor-y="${component.pos[1]}" class="editor-component${this.selectedComponents.has(component.id) ? " selected" : ""}" transform="${transform(component)}"><rect class="editor-component-hit" x="${hitX}" y="${hitY}" width="${hitWidth}" height="${hitHeight}"/>${component.type === "led" ? `<circle data-led-halo="${component.id}" class="editor-led-halo" cx="0" cy="0" r="3" fill="url(#editor-led)" opacity="0"/>` : ""}<g class="editor-symbol">${renderedSymbol(component)}</g><rect class="editor-selection" x="${hitX}" y="${hitY}" width="${hitWidth}" height="${hitHeight}"/>${refdes}${value}</g>`;
    }).join("");

    let ghost = "";
    if (this.isComponentTool(this.tool) && this.ghostPoint) {
      const component = { id: "ghost", type: this.tool, pos: this.ghostPoint, rot: this.pendingRotation, mirror: this.pendingMirror } as CircuitComponent;
      ghost = `<g class="placement-ghost" transform="${transform(component)}"><g class="editor-symbol">${renderedSymbol(component, false)}</g></g>`;
    }

    const openPins = pins
      .filter((pin) => !wirePointKeys.has(pointKey(pin.point)) && (pinCounts.get(pointKey(pin.point)) ?? 0) < 2)
      .map((pin) => `<circle class="pin-open" data-pin-component="${pin.component.id}" data-pin-index="${pin.pinIndex}" cx="${pin.point[0]}" cy="${pin.point[1]}" r="${pinRadius}"/>`)
      .join("");
    const junctions = [...legDirections]
      .filter(([, directions]) => directions.size >= 3)
      .map(([key]) => { const [x, y] = key.split(","); return `<circle class="connection-node junction" cx="${x}" cy="${y}" r="${junctionRadius}"/>`; })
      .join("");
    const snapIndicator = this.wireSnap ? `<circle class="snap-indicator" cx="${this.wireSnap.point[0]}" cy="${this.wireSnap.point[1]}" r="${snapRadius}"/>` : "";

    this.element.innerHTML = `<defs><pattern id="editor-grid" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx=".08" cy=".08" r=".035" class="grid-dot"/></pattern><radialGradient id="editor-led"><stop offset="0" stop-color="#BE7318" stop-opacity=".62"/><stop offset="1" stop-color="#BE7318" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" class="editor-bg"/><g class="editor-world" transform="translate(${this.pan[0]} ${this.pan[1]}) scale(${GRID * this.zoom})"><rect x="${-this.pan[0] / GRID / this.zoom}" y="${-this.pan[1] / GRID / this.zoom}" width="${this.host.clientWidth / GRID / this.zoom}" height="${this.host.clientHeight / GRID / this.zoom}" fill="url(#editor-grid)"/>${this.doc.wires.map((wire) => `<g data-wire-id="${wire.id}" class="editor-wire-group${this.selectedWires.has(wire.id) ? " selected" : ""}"><path data-wire-id="${wire.id}" class="editor-wire" d="${path(wire.points)}"/><path data-wire-id="${wire.id}" class="editor-hit" d="${path(wire.points)}"/></g>`).join("")}<g id="chevron-layer" class="chevron-layer"></g>${preview.length >= 2 ? `<path class="wire-preview" d="${path(preview)}"/>` : ""}${components}${openPins}${junctions}${ghost}${snapIndicator}${selection}</g>`;
    for (const [id, style] of this.wireStyles) this.applyWireStyle(id, style);
    this.applyStaticEncoding();
  }
}
