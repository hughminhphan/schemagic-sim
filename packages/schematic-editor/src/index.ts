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

export { PARTS } from "@opencircuit/circuit-schema";

const NS = "http://www.w3.org/2000/svg";
const GRID = 8;
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

function symbol(component: CircuitComponent): string {
  const type = component.type;
  switch (type) {
    case "resistor": return `<path d="M-2 0h.45l.35-.7.7 1.4.7-1.4.7 1.4.65-.7H2"/>`;
    case "capacitor": return `<path d="M-2 0h1.55m0-1.2v2.4m.9-2.4v2.4M.45 0H2"/>`;
    case "inductor": return `<path d="M-2 0h.35c0-1 1-1 1 0s1 1 1 0 1-1 1 0 1 1 1 0H2"/>`;
    case "vsource":
    case "vsource_pulse":
    case "vsource_sine": return `<circle cx="0" cy="0" r="1.25"/><path d="M0-2v.75M0 1.25V2M-.45-.45h.9M0-.9v.9M-.45.55h.9"/>`;
    case "isource": return `<circle cx="0" cy="0" r="1.25"/><path d="M0-2v.75M0 1.25V2M0 .75V-.65m-.45.45L0-.7l.45.5"/>`;
    case "ground": return `<path d="M0 0v.55M-1 .55H1M-.65 1h1.3M-.3 1.45h.6"/>`;
    case "switch_spst": return `<path d="M-2 0h.7m2.6 0H2M-1.3 0L1.1 ${component.params?.closed ? 0 : -1.1}"/><circle cx="-1.3" cy="0" r=".12"/><circle cx="1.3" cy="0" r=".12"/>`;
    case "potentiometer": {
      const t = clamp(Number(component.params?.t ?? 0.5), 0.005, 0.995);
      const y = 6 - 12 * t;
      return `<path d="M0-6v3.2l-.7.35 1.4.7-1.4.7 1.4.7-.7.35V6"/><path class="pot-wiper" d="M4 ${y}H.8"/><rect class="pot-knob" x="3.4" y="${y - 0.6}" width="1.2" height="1.2"/><path class="pot-hit" data-pot-hit="${esc(component.id)}" data-testid="pot-wiper" d="M4-6V6"/>`;
    }
    case "diode":
    case "led": return `<path d="M0-2v.75M0 1.25V2M-1.15-1.25h2.3L0 1.25Zm-1.15 2.5h2.3${type === "led" ? "M.8-1.2l1-.8m-.45 1.35 1-.8" : ""}"/>`;
    case "bjt_npn":
    case "bjt_pnp": return `<path d="M-2 0h.8m0-1.6v3.2m0-1.05L2-4m-3.2 3.45L2 4M1.1 2.7l.9 1.3-1.5-.35${type === "bjt_pnp" ? "M1.55-3.65L.3-3.1l.85.85" : ""}"/>`;
    case "nmos":
    case "pmos": return `<path d="M-2 0h.8m.3-1.8v3.6m.5-3.2v3.2M-.4-1.25H2V-4M-.4 1.25H2V4${type === "pmos" ? "M-1.2 0a.35.35 0 1 0 .01 0" : ""}"/>`;
    case "opamp_ideal": return `<path d="M-4-2h1M-4 2h1M4 0H3M-3-3L3 0-3 3Zm.7.7v.6m-.3-.3h.6m0 3h.6"/>`;
  }
}

export function partSymbolMarkup(type: ComponentType): string {
  const component = { id: "x", type, pos: [0, 0], rot: 0, mirror: false } as CircuitComponent;
  return `<svg viewBox="-5 -7 10 14" aria-hidden="true">${symbol(component)}</svg>`;
}

function transform(component: CircuitComponent): string {
  return `translate(${component.pos[0]} ${component.pos[1]}) rotate(${component.rot}) scale(${component.mirror ? -1 : 1} 1)`;
}

function compactWire(points: Point[]): Point[] {
  return points
    .filter((point, index) => index === 0 || point[0] !== points[index - 1]![0] || point[1] !== points[index - 1]![1])
    .filter((point, index, array) => index === 0 || index === array.length - 1 || !(
      (array[index - 1]![0] === point[0] && point[0] === array[index + 1]![0])
      || (array[index - 1]![1] === point[1] && point[1] === array[index + 1]![1])
    ));
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

type Drag =
  | { kind: "component"; start: Point; origin: Point; id: string }
  | { kind: "pot"; id: string }
  | { kind: "box"; start: Point }
  | { kind: "pan"; start: Point; origin: Point };

export class SchematicEditor {
  readonly element: SVGSVGElement;
  private doc: CircuitDocument;
  private tool: Tool = "select";
  private selectedComponents = new Set<string>();
  private selectedWires = new Set<string>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private gestureSnapshot = "";
  private wireStart: Point | undefined;
  private wirePreview: Point | undefined;
  private pan: Point;
  private zoom: number;
  private space = false;
  private drag: Drag | undefined;
  private hoveredWire: string | undefined;
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
    this.doc = structuredClone(document);
    this.pan = this.doc.view?.pan ?? [0, 0];
    this.zoom = this.doc.view?.zoom ?? 1;
    if (resetHistory) { this.undoStack = []; this.redoStack = []; }
    this.wireStyles.clear();
    this.wireCurrents.clear();
    this.clearSelection();
    this.render();
  }
  setTool(tool: Tool): void { this.tool = tool; this.wireStart = undefined; this.wirePreview = undefined; this.options.onMidWire?.(false); this.render(); }
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
  rotate(): void { this.change(() => { for (const id of this.selectedComponents) { const component = this.doc.components.find((item) => item.id === id); if (component) component.rot = ((component.rot + 90) % 360) as CircuitComponent["rot"]; } }); }
  mirror(): void { this.change(() => { for (const id of this.selectedComponents) { const component = this.doc.components.find((item) => item.id === id); if (component) component.mirror = !component.mirror; } }); }
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
    clone.querySelectorAll(".editor-hit,.editor-component-hit,.editor-selection,.selection-box,.wire-preview,.pot-hit").forEach((element) => element.remove());
    clone.setAttribute("xmlns", NS);
    clone.setAttribute("viewBox", `0 0 ${this.host.clientWidth} ${this.host.clientHeight}`);
    clone.setAttribute("width", String(this.host.clientWidth));
    clone.setAttribute("height", String(this.host.clientHeight));
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
    this.element.addEventListener("pointerleave", () => {
      if (!this.drag && this.hoveredWire !== undefined) {
        this.hoveredWire = undefined;
        this.options.onHoverWire?.(undefined);
      }
    });
    this.element.addEventListener("keydown", (event) => {
      if ((event.target as Element).tagName === "INPUT") return;
      if (event.key === " ") { this.space = true; event.preventDefault(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") { event.preventDefault(); this.redo(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") { event.preventDefault(); this.copyToClipboard(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") { event.preventDefault(); this.paste(); }
      else if (event.key.toLowerCase() === "r") this.rotate();
      else if (event.key.toLowerCase() === "x") this.mirror();
      else if (event.key.toLowerCase() === "f") this.fit();
      else if (event.key === "Delete" || event.key === "Backspace") this.deleteSelected();
      else if (event.key === "Escape") this.setTool("select");
    });
    this.element.addEventListener("keyup", (event) => { if (event.key === " ") this.space = false; });
  }

  private pointerDown(event: PointerEvent): void {
    this.element.focus();
    const target = event.target as SVGElement;
    const world = this.snap(this.toWorld(event.clientX, event.clientY));
    if (this.space || event.button === 1) {
      this.drag = { kind: "pan", start: [event.clientX, event.clientY], origin: [...this.pan] };
      this.element.setPointerCapture(event.pointerId);
      return;
    }
    if (this.tool === "wire") {
      if (!this.wireStart) { this.wireStart = world; this.wirePreview = world; this.options.onMidWire?.(true); }
      else {
        this.change(() => {
          const points = compactWire([this.wireStart!, [world[0], this.wireStart![1]], world]);
          if (points.length >= 2) this.doc.wires.push({ id: `w${idMax(this.doc.wires, "w") + 1}`, points });
        });
        this.wireStart = undefined;
        this.wirePreview = undefined;
        this.options.onMidWire?.(false);
      }
      this.render();
      return;
    }
    if (this.tool !== "select") {
      this.change(() => {
        const part = partByType(this.tool as ComponentType);
        const id = `c${idMax(this.doc.components, "c") + 1}`;
        const component: CircuitComponent = {
          id,
          type: part.type,
          pos: world,
          rot: 0,
          mirror: false,
          label: { text: `${part.prefix}${id.slice(1)}`, offset: [0, -3] },
          ...(part.defaultValue !== undefined ? { value: part.defaultValue } : {}),
          ...(part.type === "potentiometer" ? { params: { t: 0.5 } } : {}),
        };
        this.doc.components.push(component);
        this.clearSelection();
        this.selectedComponents.add(id);
      });
      this.tool = "select";
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
    const componentId = target.closest<SVGGElement>("[data-component-id]")?.dataset.componentId;
    const wireId = target.closest<SVGElement>("[data-wire-id]")?.dataset.wireId;
    if (componentId) {
      if (!event.shiftKey && !this.selectedComponents.has(componentId)) this.clearSelection();
      this.selectedComponents.add(componentId);
      const component = this.doc.components.find((item) => item.id === componentId)!;
      this.beginGesture();
      this.drag = { kind: "component", start: world, origin: [...component.pos], id: componentId };
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
      this.drag = { kind: "box", start: world };
      this.element.setPointerCapture(event.pointerId);
      this.emitSelection();
      this.render();
    }
  }

  private pointerMove(event: PointerEvent): void {
    if (!this.drag && !this.wireStart) {
      const id = (event.target as Element).closest<SVGElement>("[data-wire-id]")?.dataset.wireId;
      if (id !== this.hoveredWire) {
        this.hoveredWire = id;
        this.options.onHoverWire?.(id);
      }
    }
    const world = this.snap(this.toWorld(event.clientX, event.clientY));
    if (this.wireStart) { this.wirePreview = world; this.render(); return; }
    if (!this.drag) return;
    if (this.drag.kind === "pot") { this.updatePotFromPointer(this.drag.id, event.clientX, event.clientY); return; }
    if (this.drag.kind === "pan") { this.pan = [this.drag.origin[0] + event.clientX - this.drag.start[0], this.drag.origin[1] + event.clientY - this.drag.start[1]]; this.render(); return; }
    if (this.drag.kind === "component") {
      const drag = this.drag;
      const component = this.doc.components.find((item) => item.id === drag.id);
      if (component) component.pos = [drag.origin[0] + world[0] - drag.start[0], drag.origin[1] + world[1] - drag.start[1]];
      this.render();
      return;
    }
    this.wirePreview = world;
    this.render();
  }

  private pointerUp(event: PointerEvent): void {
    if (!this.drag) return;
    if (this.drag.kind === "component") {
      if (this.gestureSnapshot && this.gestureSnapshot !== canonicalizeCircuit(this.doc)) this.emit("edit");
      this.endGesture();
    } else if (this.drag.kind === "pot") {
      const id = this.drag.id;
      this.endGesture();
      this.options.onLiveGesture?.(false, id);
    } else if (this.drag.kind === "box" && this.wirePreview) {
      const a = this.drag.start;
      const b = this.wirePreview;
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
    this.wirePreview = undefined;
    if (this.element.hasPointerCapture(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
    this.render();
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

  private toWorld(x: number, y: number): Point {
    const rect = this.element.getBoundingClientRect();
    return [(x - rect.left - this.pan[0]) / GRID / this.zoom, (y - rect.top - this.pan[1]) / GRID / this.zoom];
  }
  private snap([x, y]: Point): Point { return [Math.round(x), Math.round(y)]; }
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
      wirePath.style.strokeWidth = String([0.9, 1.4, 2, 2.8][Math.min(3, Math.floor(flow.u * 4))]);
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
    const nodes = new Map<string, number>();
    for (const wire of this.doc.wires) for (const point of wire.points) nodes.set(point.join(","), (nodes.get(point.join(",")) ?? 0) + 1);
    for (const component of this.doc.components) for (const point of componentPinPoints(component)) nodes.set(point.join(","), (nodes.get(point.join(",")) ?? 0) + 1);
    const preview = this.wireStart && this.wirePreview ? compactWire([this.wireStart, [this.wirePreview[0], this.wireStart[1]], this.wirePreview]) : [];
    let selection = "";
    if (this.drag?.kind === "box" && this.wirePreview) {
      const a = this.drag.start;
      const b = this.wirePreview;
      selection = `<rect class="selection-box" x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(a[0] - b[0])}" height="${Math.abs(a[1] - b[1])}"/>`;
    }
    const labelSize = (11 / (GRID * this.zoom)).toFixed(4);
    const labelKnockout = (3 / (GRID * this.zoom)).toFixed(4);
    const junctionRadius = (3.5 / (GRID * this.zoom)).toFixed(4);
    this.element.innerHTML = `<defs><pattern id="editor-grid" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx=".08" cy=".08" r=".035" class="grid-dot"/></pattern><radialGradient id="editor-led"><stop offset="0" stop-color="#BE7318" stop-opacity=".62"/><stop offset="1" stop-color="#BE7318" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" class="editor-bg"/><g class="editor-world" transform="translate(${this.pan[0]} ${this.pan[1]}) scale(${GRID * this.zoom})"><rect x="${-this.pan[0] / GRID / this.zoom}" y="${-this.pan[1] / GRID / this.zoom}" width="${this.host.clientWidth / GRID / this.zoom}" height="${this.host.clientHeight / GRID / this.zoom}" fill="url(#editor-grid)"/>${this.doc.wires.map((wire) => `<g data-wire-id="${wire.id}" class="editor-wire-group${this.selectedWires.has(wire.id) ? " selected" : ""}"><path data-wire-id="${wire.id}" class="editor-wire" d="${path(wire.points)}"/><path data-wire-id="${wire.id}" class="editor-hit" d="${path(wire.points)}"/></g>`).join("")}<g id="chevron-layer" class="chevron-layer"></g>${preview.length ? `<path class="wire-preview" d="${path(preview)}"/>` : ""}${this.doc.components.map((component) => `<g data-component-id="${component.id}" class="editor-component${this.selectedComponents.has(component.id) ? " selected" : ""}" transform="${transform(component)}"><rect class="editor-component-hit" x="-3" y="-3" width="6" height="6"/>${component.type === "led" ? `<circle data-led-halo="${component.id}" class="editor-led-halo" cx="0" cy="0" r="3" fill="url(#editor-led)" opacity="0"/>` : ""}<g class="editor-symbol">${symbol(component)}</g><rect class="editor-selection" x="-3" y="-3" width="6" height="6"/>${component.type === "ground" || !component.label?.text ? "" : `<text class="editor-label" style="font-size:${labelSize}px;stroke-width:${labelKnockout}px" x="${component.label.offset[0]}" y="${component.label.offset[1]}" transform="scale(${component.mirror ? -1 : 1} 1) rotate(${-component.rot})">${esc(component.label.text)}</text>`}</g>`).join("")}${[...nodes].filter(([, count]) => count > 2).map(([key]) => { const [x, y] = key.split(","); return `<circle class="connection-node junction" cx="${x}" cy="${y}" r="${junctionRadius}"/>`; }).join("")}${selection}</g>`;
    for (const [id, style] of this.wireStyles) this.applyWireStyle(id, style);
    this.applyStaticEncoding();
  }
}
