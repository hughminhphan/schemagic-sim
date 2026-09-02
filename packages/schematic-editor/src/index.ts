import {
  canonicalizeCircuit,
  componentPinPoints,
  componentPoint,
  deserializeCircuit,
  isMultiTerminalDevice,
  partByType,
  type CircuitComponent,
  type CircuitDocument,
  type CircuitProbe,
  type ComponentType,
  type Point,
} from "@opencircuit/circuit-schema";
import { EDITOR_SYMBOLS } from "./symbols.generated";

export { PARTS } from "@opencircuit/circuit-schema";

const NS = "http://www.w3.org/2000/svg";
const GRID = 8;
const CLIPBOARD_STORAGE_KEY = "schemagic.clipboard";
const SNAP_RADIUS_PX = 10;
const PIN_HIT_RADIUS_PX = 5;
const POT_HIT_RADIUS_PX = 6;
const RIGHT_DRAG_THRESHOLD_PX = 4;
const SWITCH_CLOSED_ANGLE = Math.atan2(0.7, 1.4) * 180 / Math.PI;
export type EditorTool = "select" | "wire" | "measure" | ComponentType;

export type EditorMeasurementTarget =
  | { kind: "wire"; wireId: string }
  | { kind: "pin"; componentId: string; pinIndex: number }
  | { kind: "component"; componentId: string };

export interface EditorMeasurementActivation {
  target: EditorMeasurementTarget;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

export interface EditorChange {
  document: CircuitDocument;
  reason: "edit" | "undo" | "redo" | "view";
}

type ProbeNodeReference = Extract<CircuitProbe["expression"], { kind: "voltage" }>["positive"];

function retargetProbeExpressionWires(
  expression: CircuitProbe["expression"],
  replacements: ReadonlyMap<string, ProbeNodeReference>,
): void {
  const replacement = (reference: ProbeNodeReference): ProbeNodeReference => (
    reference.kind === "schematic-wire" ? replacements.get(reference.wireId) ?? reference : reference
  );
  if (expression.kind === "voltage") {
    expression.positive = replacement(expression.positive);
    expression.negative = replacement(expression.negative);
  } else if (expression.kind === "unary") retargetProbeExpressionWires(expression.operand, replacements);
  else if (expression.kind === "binary") {
    retargetProbeExpressionWires(expression.left, replacements);
    retargetProbeExpressionWires(expression.right, replacements);
  } else if (expression.kind === "call") {
    for (const argument of expression.arguments) retargetProbeExpressionWires(argument, replacements);
  }
}

function expressionReferencesSelection(
  expression: CircuitProbe["expression"],
  componentIds: ReadonlySet<string>,
  wireIds: ReadonlySet<string>,
): boolean {
  const nodeReferenceMatches = (reference: Extract<CircuitProbe["expression"], { kind: "voltage" }>["positive"]): boolean => (
    reference.kind === "schematic-wire"
      ? wireIds.has(reference.wireId)
      : reference.kind === "schematic-pin" && componentIds.has(reference.componentId)
  );
  if (expression.kind === "voltage") return nodeReferenceMatches(expression.positive) || nodeReferenceMatches(expression.negative);
  if (expression.kind === "current" || expression.kind === "power") {
    return expression.component.kind === "schematic-component" && componentIds.has(expression.component.componentId);
  }
  if (expression.kind === "unary") return expressionReferencesSelection(expression.operand, componentIds, wireIds);
  if (expression.kind === "binary") {
    return expressionReferencesSelection(expression.left, componentIds, wireIds)
      || expressionReferencesSelection(expression.right, componentIds, wireIds);
  }
  if (expression.kind === "call") return expression.arguments.some((argument) => expressionReferencesSelection(argument, componentIds, wireIds));
  return false;
}

export function removeReferencesToDeletedSelection(
  document: CircuitDocument,
  componentIds: ReadonlySet<string>,
  wireIds: ReadonlySet<string>,
): void {
  const removedProbeIds = new Set(
    document.probes
      .filter((probe) => expressionReferencesSelection(probe.expression, componentIds, wireIds))
      .map((probe) => probe.id),
  );
  document.probes = document.probes.filter((probe) => !removedProbeIds.has(probe.id));
  if (document.sim.ac?.stimulus && componentIds.has(document.sim.ac.stimulus.sourceId)) delete document.sim.ac.stimulus;
  if (document.sim.dcSweep) {
    if (componentIds.has(document.sim.dcSweep.sourceId)) delete document.sim.dcSweep;
    else if (document.sim.dcSweep.secondary && componentIds.has(document.sim.dcSweep.secondary.sourceId)) delete document.sim.dcSweep.secondary;
  }
  if (document.sim.noise && (componentIds.has(document.sim.noise.inputSourceId) || removedProbeIds.has(document.sim.noise.outputProbeId))) {
    delete document.sim.noise;
  }
}

export interface SchematicEditorOptions {
  document: CircuitDocument;
  onChange?: (change: EditorChange) => void;
  onSelection?: (components: string[], wires: string[]) => void;
  onWireActivate?: (wireId: string) => void;
  onHoverWire?: (wireId: string | undefined) => void;
  onMeasureTarget?: (activation: EditorMeasurementActivation) => void;
  onHoverMeasureTarget?: (target: EditorMeasurementTarget | undefined) => void;
  onMidWire?: (active: boolean) => void;
  onLiveGesture?: (active: boolean, componentId?: string) => void;
  virtualConnections?: (document: Readonly<CircuitDocument>) => readonly { componentId: string; pinIndex: number; role: string }[];
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

export interface ImplicitPinBridgePlan {
  point: Point;
  reference: PinReference;
  existingWireId?: string;
}

export interface SchematicClipboard {
  format: "opencircuit-schematic-selection";
  version: 1;
  components: CircuitComponent[];
  wires: CircuitDocument["wires"];
  anchor: Point;
}

export interface PastedSchematicSelection {
  components: string[];
  wires: string[];
}

interface WireAttachment {
  pins: Array<{ index: number; reference: PinReference }>;
  hasFixedVertex: boolean;
}

type SelectionMode = "replace" | "add" | "toggle" | "remove";

interface ClickSelection {
  mode: SelectionMode;
  componentId?: string;
  wireId?: string;
  components: Set<string>;
  wires: Set<string>;
}

interface SnapCandidate {
  point: Point;
  kind: "pin" | "vertex" | "segment";
  distance: number;
  componentId?: string;
  pinIndex?: number;
  wireId?: string;
}

interface ContextTarget {
  componentId?: string;
  wireId?: string;
}

interface ContextMenuItem {
  action: string;
  label: string;
  shortcut: string;
  disabled?: boolean;
  run: () => void;
}

interface PointerPanGesture {
  start: Point;
  origin: Point;
  pointerId: number;
  panning: boolean;
  mode: "right" | "middle" | "space";
  contextTarget?: ContextTarget;
}

type Drag =
  | {
    kind: "component";
    id: string;
    origins: Map<string, Point>;
    originalWires: Map<string, Point[]>;
    attachments: Map<string, WireAttachment>;
    provisionalWireIds: Set<string>;
    selectedWireOrigins: Map<string, Point[]>;
    grabOffset: Point;
    moved: boolean;
    keyboard: boolean;
    preserveWires: boolean;
    pointerId?: number;
    clickSelection?: ClickSelection;
  }
  | {
    kind: "wire";
    id: string;
    original: Point[];
    originals: Map<string, Point[]>;
    pointerOrigin: Point;
    segmentIndex: number;
    block: boolean;
    moved: boolean;
    keyboard: boolean;
    pointerId?: number;
    clickSelection?: ClickSelection;
  }
  | { kind: "pot"; id: string; pointerId: number }
  | {
    kind: "box";
    start: Point;
    end: Point;
    mode: SelectionMode;
    components: Set<string>;
    wires: Set<string>;
    pointerId: number;
  };

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
const wireHasDistinctPoints = (points: readonly Point[]): boolean => {
  const first = points[0];
  return first !== undefined && points.length >= 2 && points.some((point) => !samePoint(point, first));
};
const movedPoint = (point: Point, delta: Point): Point => [point[0] + delta[0], point[1] + delta[1]];

export function componentAnchorFromPointer(pointer: Point, grabOffset: Point): Point {
  return [pointer[0] - grabOffset[0], pointer[1] - grabOffset[1]];
}

export function translateWirePoints(points: Point[], delta: Point): Point[] {
  return points.map((point) => movedPoint(point, delta));
}

/**
 * Plan the explicit bridges needed when a connected drag pulls one of two
 * coincident pins away from the other. Coincident pins are valid electrical
 * connectivity even when the document contains no drawable wire.
 */
export function implicitPinBridgePlans(
  document: CircuitDocument,
  selectedComponentIds: ReadonlySet<string>,
): ImplicitPinBridgePlan[] {
  const selectedPins = new Map<string, Array<{ point: Point; reference: PinReference }>>();
  const fixedPinKeys = new Set<string>();
  for (const component of document.components) {
    componentPinPoints(component).forEach((point, pinIndex) => {
      const key = pointKey(point);
      if (!selectedComponentIds.has(component.id)) {
        fixedPinKeys.add(key);
        return;
      }
      const pins = selectedPins.get(key) ?? [];
      pins.push({ point: clonePoint(point), reference: { componentId: component.id, pinIndex } });
      selectedPins.set(key, pins);
    });
  }

  const numericIdOrder = (left: string, right: string) => left.localeCompare(right, undefined, { numeric: true });
  return [...selectedPins]
    .filter(([key]) => fixedPinKeys.has(key))
    .map(([, pins]) => {
      const pin = pins.sort((left, right) => numericIdOrder(left.reference.componentId, right.reference.componentId) || left.reference.pinIndex - right.reference.pinIndex)[0]!;
      const existingWireId = document.wires
        .filter((wire) => wire.points.length >= 2 && wire.points.every((point) => samePoint(point, pin.point)))
        .map((wire) => wire.id)
        .sort(numericIdOrder)[0];
      return {
        point: pin.point,
        reference: pin.reference,
        ...(existingWireId ? { existingWireId } : {}),
      };
    })
    .sort((left, right) => left.point[0] - right.point[0] || left.point[1] - right.point[1] || numericIdOrder(left.reference.componentId, right.reference.componentId) || left.reference.pinIndex - right.reference.pinIndex);
}

export function wireBlockDelta(pointer: Point, origin: Point, offGrid = false): Point {
  const delta: Point = [pointer[0] - origin[0], pointer[1] - origin[1]];
  return offGrid
    ? [Number(delta[0].toFixed(4)), Number(delta[1].toFixed(4))]
    : [Math.round(delta[0]), Math.round(delta[1])];
}

export function translateWireSelection(originals: ReadonlyMap<string, Point[]>, delta: Point): Map<string, Point[]> {
  return new Map([...originals].map(([id, points]) => [id, translateWirePoints(points, delta)]));
}

export function isRightButtonDrag(start: Point, current: Point, threshold = RIGHT_DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(current[0] - start[0], current[1] - start[1]) >= threshold;
}

export function panFromPointerDrag(origin: Point, start: Point, current: Point): Point {
  return [origin[0] + current[0] - start[0], origin[1] + current[1] - start[1]];
}

export function rotationDeltaForShortcut(shiftKey: boolean): number {
  return shiftKey ? 90 : -90;
}

export function isFitShortcut(key: string): boolean {
  return key === "Home" || key.toLowerCase() === "f";
}

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

function renderedSymbol(component: CircuitComponent, _interactive = true): string {
  const definition = EDITOR_SYMBOLS[component.type];
  const base = splitSymbolMarkup(definition.markup);
  const background = [...base.background];
  const strokes = [...base.strokes];
  const solid = [...base.solid];

  if (component.type === "potentiometer" && definition.wiper) {
    const y = potentiometerWiperLocalPoint(component)[1];
    const wiper = splitSymbolMarkup(definition.wiper);
    const translation = `translate(0 ${y})`;
    background.push(wrappedLayer(wiper.background, translation, "pot-wiper"));
    strokes.push(wrappedLayer(wiper.strokes, translation, "pot-wiper"));
    solid.push(wrappedLayer(wiper.solid, translation, "pot-wiper"));
    if (definition.wiperAnchor && Math.abs(y) > 1e-6) {
      const [x, anchorY] = definition.wiperAnchor;
      strokes.push(`<path class="pot-wiper-link" d="M${x} ${anchorY}V${anchorY + y}"/>`);
    }
  }

  if (component.type === "switch_spst" && definition.lever && definition.leverPivot) {
    const lever = splitSymbolMarkup(definition.lever);
    const [pivotX, pivotY] = definition.leverPivot;
    const rotation = component.params?.closed ? `rotate(${SWITCH_CLOSED_ANGLE} ${pivotX} ${pivotY})` : "rotate(0)";
    background.push(wrappedLayer(lever.background, rotation));
    strokes.push(wrappedLayer(lever.strokes, rotation));
    solid.push(wrappedLayer(lever.solid, rotation));
  }

  return `${background.join("")}${strokes.join("")}${solid.join("")}`;
}

export function potentiometerWiperLocalPoint(component: CircuitComponent): Point {
  const definition = EDITOR_SYMBOLS.potentiometer;
  const t = clamp(Number(component.params?.t ?? 0.5), 0.005, 0.995);
  const [minimum, maximum] = definition.wiperTravel ?? [-2, 2];
  const y = maximum - (maximum - minimum) * t;
  // Stay on the movable arrow, deliberately clear of the fixed external pin at x=2.
  return [0.95, y];
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

interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

function componentBounds(component: CircuitComponent, bbox: readonly [number, number, number, number] = componentBbox(component)): Bounds {
  const [minX, minY, maxX, maxY] = bbox;
  const corners = [
    componentPoint(component, [minX, minY]),
    componentPoint(component, [maxX, minY]),
    componentPoint(component, [maxX, maxY]),
    componentPoint(component, [minX, maxY]),
  ];
  return {
    minX: Math.min(...corners.map((point) => point[0])),
    minY: Math.min(...corners.map((point) => point[1])),
    maxX: Math.max(...corners.map((point) => point[0])),
    maxY: Math.max(...corners.map((point) => point[1])),
  };
}

export type ComponentSelectionTransform =
  | { kind: "rotate"; delta: number }
  | { kind: "mirror"; axis: "x" | "y" };

export interface TransformedComponentState {
  pos: Point;
  rot: CircuitComponent["rot"];
  mirror: boolean;
}

function normalizedRotation(value: number): CircuitComponent["rot"] {
  return ((value % 360 + 360) % 360) as CircuitComponent["rot"];
}

function transformedSelectionPoint(point: Point, center: Point, operation: ComponentSelectionTransform): Point {
  if (operation.kind === "mirror") {
    return operation.axis === "x"
      ? [center[0] * 2 - point[0], point[1]]
      : [point[0], center[1] * 2 - point[1]];
  }
  const delta = normalizedRotation(operation.delta);
  const x = point[0] - center[0];
  const y = point[1] - center[1];
  if (delta === 0) return clonePoint(point);
  if (delta === 90) return [center[0] - y, center[1] + x];
  if (delta === 180) return [center[0] - x, center[1] - y];
  return [center[0] + y, center[1] - x];
}

/** Pure block transform used by R/Shift+R and X/Y selection shortcuts. */
export function transformComponentSelection(
  components: readonly CircuitComponent[],
  componentIds: Iterable<string>,
  operation: ComponentSelectionTransform,
): Map<string, TransformedComponentState> {
  const ids = new Set(componentIds);
  const selected = components.filter((component) => ids.has(component.id));
  if (!selected.length) return new Map();
  const block = selected.length > 1;
  const bounds = selected.map((component) => componentBounds(component)).reduce((combined, current) => ({
    minX: Math.min(combined.minX, current.minX),
    minY: Math.min(combined.minY, current.minY),
    maxX: Math.max(combined.maxX, current.maxX),
    maxY: Math.max(combined.maxY, current.maxY),
  }));
  const center: Point = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];

  return new Map(selected.map((component) => {
    let rot = component.rot;
    let mirror = component.mirror;
    if (operation.kind === "rotate") rot = normalizedRotation(rot + operation.delta);
    else {
      mirror = !mirror;
      // A block mirror is a world-axis matrix transform. Preserve the existing
      // item-local shortcut result for a single symbol.
      rot = block
        ? normalizedRotation((operation.axis === "x" ? 0 : 180) - rot)
        : normalizedRotation(rot + (operation.axis === "y" ? 180 : 0));
    }
    return [component.id, {
      pos: block ? transformedSelectionPoint(component.pos, center, operation) : clonePoint(component.pos),
      rot,
      mirror,
    }];
  }));
}

function boundsInside(inner: Bounds, outer: Bounds): boolean {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY;
}

function boundsIntersect(left: Bounds, right: Bounds): boolean {
  return left.maxX >= right.minX && left.minX <= right.maxX && left.maxY >= right.minY && left.minY <= right.maxY;
}

function pointInsideBounds(point: Point, bounds: Bounds): boolean {
  return point[0] >= bounds.minX && point[0] <= bounds.maxX && point[1] >= bounds.minY && point[1] <= bounds.maxY;
}

function wireCrossesBounds(points: Point[], bounds: Bounds): boolean {
  if (points.some((point) => pointInsideBounds(point, bounds))) return true;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    if (a[0] === b[0] && a[0] >= bounds.minX && a[0] <= bounds.maxX && Math.max(Math.min(a[1], b[1]), bounds.minY) <= Math.min(Math.max(a[1], b[1]), bounds.maxY)) return true;
    if (a[1] === b[1] && a[1] >= bounds.minY && a[1] <= bounds.maxY && Math.max(Math.min(a[0], b[0]), bounds.minX) <= Math.min(Math.max(a[0], b[0]), bounds.maxX)) return true;
  }
  return false;
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

export function junctionPoints(wires: CircuitDocument["wires"]): Point[] {
  const legDirections = new Map<string, { point: Point; directions: Set<string> }>();
  const addLeg = (point: Point, other: Point) => {
    if (samePoint(point, other)) return;
    const key = pointKey(point);
    const entry = legDirections.get(key) ?? { point: clonePoint(point), directions: new Set<string>() };
    entry.directions.add(`${Math.sign(other[0] - point[0])},${Math.sign(other[1] - point[1])}`);
    legDirections.set(key, entry);
  };

  for (const wire of wires) {
    for (let index = 1; index < wire.points.length; index += 1) {
      addLeg(wire.points[index - 1]!, wire.points[index]!);
      addLeg(wire.points[index]!, wire.points[index - 1]!);
    }
  }

  for (const source of wires) {
    for (const point of source.points) {
      for (const target of wires) {
        if (target.id === source.id) continue;
        for (let index = 1; index < target.points.length; index += 1) {
          const a = target.points[index - 1]!;
          const b = target.points[index]!;
          if (!pointInSegmentInterior(point, a, b)) continue;
          addLeg(point, a);
          addLeg(point, b);
        }
      }
    }
  }

  return [...legDirections.values()]
    .filter(({ directions }) => directions.size >= 3)
    .map(({ point }) => point);
}

function pointOnSegment(point: Point, a: Point, b: Point): boolean {
  if (a[0] === b[0] && point[0] === a[0]) return point[1] >= Math.min(a[1], b[1]) && point[1] <= Math.max(a[1], b[1]);
  if (a[1] === b[1] && point[1] === a[1]) return point[0] >= Math.min(a[0], b[0]) && point[0] <= Math.max(a[0], b[0]);
  return false;
}

/** Split every orthogonal participant at an implicit crossing. Returns undefined for a no-op. */
export function insertExplicitJunction(
  wires: CircuitDocument["wires"],
  point: Point,
): CircuitDocument["wires"] | undefined {
  const participants = new Set<string>();
  let horizontal = false;
  let vertical = false;
  for (const wire of wires) {
    for (let index = 1; index < wire.points.length; index += 1) {
      const a = wire.points[index - 1]!;
      const b = wire.points[index]!;
      if (samePoint(a, b) || !pointOnSegment(point, a, b)) continue;
      participants.add(wire.id);
      horizontal ||= a[1] === b[1];
      vertical ||= a[0] === b[0];
    }
  }
  if (participants.size < 2 || !horizontal || !vertical) return undefined;

  let changed = false;
  const result = wires.map((wire) => {
    if (!participants.has(wire.id)) return { ...wire, points: wire.points.map(clonePoint) };
    const points: Point[] = [];
    for (let index = 1; index < wire.points.length; index += 1) {
      const a = wire.points[index - 1]!;
      const b = wire.points[index]!;
      if (!points.length) points.push(clonePoint(a));
      if (pointInSegmentInterior(point, a, b)) {
        points.push(clonePoint(point));
        changed = true;
      }
      if (!samePoint(points.at(-1)!, b)) points.push(clonePoint(b));
    }
    return { ...wire, points };
  });
  return changed ? result : undefined;
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  if (a[0] === b[0]) return Math.hypot(point[0] - a[0], point[1] - clamp(point[1], Math.min(a[1], b[1]), Math.max(a[1], b[1])));
  if (a[1] === b[1]) return Math.hypot(point[0] - clamp(point[0], Math.min(a[0], b[0]), Math.max(a[0], b[0])), point[1] - a[1]);
  return Math.min(Math.hypot(point[0] - a[0], point[1] - a[1]), Math.hypot(point[0] - b[0], point[1] - b[1]));
}

function pointOnWire(point: Point, points: Point[]): boolean {
  return points.slice(1).some((current, index) => pointOnSegment(point, points[index]!, current));
}

function wireEndpoints(wire: CircuitDocument["wires"][number]): Point[] {
  return wire.points.length ? [wire.points[0]!, wire.points.at(-1)!] : [];
}

function wiresConnect(a: CircuitDocument["wires"][number], b: CircuitDocument["wires"][number]): boolean {
  return wireEndpoints(a).some((point) => pointOnWire(point, b.points))
    || wireEndpoints(b).some((point) => pointOnWire(point, a.points));
}

function closedWireIds(
  document: CircuitDocument,
  selectedComponentIds: Iterable<string>,
  selectedWireIds: Iterable<string> = [],
): Set<string> {
  const selected = new Set(selectedComponentIds);
  const requested = new Set(selectedWireIds);
  const pins = document.components.flatMap((component) => componentPinPoints(component).map((point) => ({ componentId: component.id, point })));
  const selectedPins = pins.filter((pin) => selected.has(pin.componentId)).map((pin) => pin.point);
  const eligible = document.wires.filter((wire) => !pins.some((pin) => !selected.has(pin.componentId) && pointOnWire(pin.point, wire.points)));
  const carried = new Set(eligible
    .filter((wire) => requested.has(wire.id) || selectedPins.some((point) => pointOnWire(point, wire.points)))
    .map((wire) => wire.id));

  let changed = true;
  while (changed) {
    changed = false;
    for (const wire of eligible) {
      if (carried.has(wire.id)) continue;
      if (eligible.some((other) => carried.has(other.id) && wiresConnect(wire, other))) {
        carried.add(wire.id);
        changed = true;
      }
    }
  }

  changed = true;
  while (changed) {
    changed = false;
    for (const wire of eligible) {
      if (!carried.has(wire.id)) continue;
      const closed = wireEndpoints(wire).every((point) => selectedPins.some((pin) => samePoint(pin, point))
        || eligible.some((other) => other.id !== wire.id && carried.has(other.id) && pointOnWire(point, other.points)));
      if (!closed) {
        carried.delete(wire.id);
        changed = true;
      }
    }
  }
  return carried;
}

/** Wires forming a closed network between selected symbols travel with the block. */
export function connectingWireIds(document: CircuitDocument, selectedComponentIds: Iterable<string>): Set<string> {
  return closedWireIds(document, selectedComponentIds);
}

function clipboardAnchor(components: readonly CircuitComponent[], wires: CircuitDocument["wires"]): Point {
  const points = [...components.map((component) => component.pos), ...wires.flatMap((wire) => wire.points)];
  if (!points.length) return [0, 0];
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)];
}

export function createSchematicClipboard(
  document: CircuitDocument,
  selectedComponentIds: Iterable<string>,
  selectedWireIds: Iterable<string>,
): SchematicClipboard {
  const componentIds = new Set(selectedComponentIds);
  const wireIds = closedWireIds(document, componentIds, selectedWireIds);
  const components = document.components.filter((component) => componentIds.has(component.id)).map((component) => structuredClone(component));
  const wires = document.wires.filter((wire) => wireIds.has(wire.id)).map((wire) => structuredClone(wire));
  return { format: "opencircuit-schematic-selection", version: 1, components, wires, anchor: clipboardAnchor(components, wires) };
}

function parseSchematicClipboard(raw: string): SchematicClipboard | undefined {
  try {
    const parsed = JSON.parse(raw) as Partial<SchematicClipboard>;
    if (!Array.isArray(parsed.components) || !Array.isArray(parsed.wires)) return undefined;
    const components = structuredClone(parsed.components) as CircuitComponent[];
    const wires = structuredClone(parsed.wires) as CircuitDocument["wires"];
    const anchor = Array.isArray(parsed.anchor) && parsed.anchor.length === 2 && parsed.anchor.every(Number.isFinite)
      ? [parsed.anchor[0], parsed.anchor[1]] as Point
      : clipboardAnchor(components, wires);
    return { format: "opencircuit-schematic-selection", version: 1, components, wires, anchor };
  } catch {
    return undefined;
  }
}

function readSessionClipboard(): SchematicClipboard | undefined {
  try {
    const value = globalThis.sessionStorage?.getItem(CLIPBOARD_STORAGE_KEY);
    return value ? parseSchematicClipboard(value) : undefined;
  } catch {
    return undefined;
  }
}

function writeSessionClipboard(clipboard: SchematicClipboard): string {
  const value = JSON.stringify(clipboard);
  try { globalThis.sessionStorage?.setItem(CLIPBOARD_STORAGE_KEY, value); } catch {}
  return value;
}

function nextReference(prefix: string, used: Map<string, Set<number>>): string {
  const numbers = used.get(prefix) ?? new Set<number>();
  let index = 1;
  while (numbers.has(index)) index += 1;
  numbers.add(index);
  used.set(prefix, numbers);
  return `${prefix}${index}`;
}

export function pasteSchematicClipboard(
  document: CircuitDocument,
  clipboard: SchematicClipboard,
  target: Point,
): PastedSchematicSelection {
  if (!clipboard.components.length && !clipboard.wires.length) return { components: [], wires: [] };
  const delta: Point = [target[0] - clipboard.anchor[0], target[1] - clipboard.anchor[1]];
  let componentIndex = idMax(document.components, "c");
  let wireIndex = idMax(document.wires, "w");
  const usedReferences = new Map<string, Set<number>>();
  for (const component of document.components) {
    const prefix = partByType(component.type).prefix;
    const match = component.label?.text.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`));
    if (!match) continue;
    const numbers = usedReferences.get(prefix) ?? new Set<number>();
    numbers.add(Number(match[1]));
    usedReferences.set(prefix, numbers);
  }
  const pasted: PastedSchematicSelection = { components: [], wires: [] };
  for (const original of clipboard.components) {
    const component = structuredClone(original);
    component.id = `c${++componentIndex}`;
    component.pos = movedPoint(component.pos, delta);
    const prefix = partByType(component.type).prefix;
    const referencePattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d+$`);
    const reference = nextReference(prefix, usedReferences);
    component.label = {
      text: component.label && !referencePattern.test(component.label.text) ? component.label.text : reference,
      offset: component.label?.offset ? clonePoint(component.label.offset) : transformedOffset(component, EDITOR_SYMBOLS[component.type].refdesAnchor),
    };
    document.components.push(component);
    pasted.components.push(component.id);
  }
  for (const original of clipboard.wires) {
    const wire = structuredClone(original);
    wire.id = `w${++wireIndex}`;
    wire.points = translateWirePoints(wire.points, delta);
    document.wires.push(wire);
    pasted.wires.push(wire.id);
  }
  trimOverlappingWires(document, pasted.components);
  normalizeJunctions(document);
  return pasted;
}

export type WireKeyboardMoveMode = "move" | "drag";

export interface WireKeyboardMovePlan {
  wireId: string;
  block: boolean;
}

/** M always translates the block; G reroutes the selected wire nearest the pointer. */
export function wireKeyboardMovePlan(
  mode: WireKeyboardMoveMode,
  wires: CircuitDocument["wires"],
  selectedIds: Iterable<string>,
  pointer: Point,
): WireKeyboardMovePlan | undefined {
  const selected = new Set(selectedIds);
  const candidates = wires.filter((wire) => selected.has(wire.id) && wire.points.length >= 2);
  if (!candidates.length) return undefined;
  if (mode === "move") return { wireId: candidates[0]!.id, block: true };
  const wire = candidates
    .map((candidate, order) => ({
      wire: candidate,
      order,
      distance: Math.min(...candidate.points.slice(1).map((point, index) => distanceToSegment(pointer, candidate.points[index]!, point))),
    }))
    .sort((left, right) => left.distance - right.distance || left.order - right.order)[0]!.wire;
  return { wireId: wire.id, block: false };
}

export function rerouteWireSegment(points: Point[], segmentIndex: number, coordinate: number): Point[] {
  if (segmentIndex < 1 || segmentIndex >= points.length) return points.map(clonePoint);
  const a = points[segmentIndex - 1]!;
  const b = points[segmentIndex]!;
  const horizontal = a[1] === b[1];
  const vertical = a[0] === b[0];
  if (!horizontal && !vertical) return points.map(clonePoint);
  if ((horizontal && coordinate === a[1]) || (vertical && coordinate === a[0])) return points.map(clonePoint);

  const result = points.slice(0, Math.max(0, segmentIndex - 1)).map(clonePoint);
  const aIsEndpoint = segmentIndex === 1;
  const bIsEndpoint = segmentIndex === points.length - 1;
  const previous = points[segmentIndex - 2];
  const next = points[segmentIndex + 1];
  const previousIsCollinear = previous !== undefined && (horizontal ? previous[1] === a[1] : previous[0] === a[0]);
  const nextIsCollinear = next !== undefined && (horizontal ? next[1] === b[1] : next[0] === b[0]);
  if (aIsEndpoint || previousIsCollinear) result.push(clonePoint(a));
  result.push(horizontal ? [a[0], coordinate] : [coordinate, a[1]]);
  result.push(horizontal ? [b[0], coordinate] : [coordinate, b[1]]);
  if (bIsEndpoint || nextIsCollinear) result.push(clonePoint(b));
  result.push(...points.slice(segmentIndex + 1).map(clonePoint));
  return compactWire(result);
}

/** Match KiCad's symbol-placement trim: remove a wire run covered by two connection points. */
export function trimOverlappingWires(document: CircuitDocument, componentIds: Iterable<string>): void {
  let wireIndex = idMax(document.wires, "w");
  const ids = new Set(componentIds);
  const components = document.components.filter((component) => ids.has(component.id));

  for (const component of components) {
    // Multi-input devices can legitimately place two pins on one bus. That is
    // connectivity, not a two-terminal body covering conductor.
    if (isMultiTerminalDevice(component.type)) continue;
    const pins = [...new Map(componentPinPoints(component).map((pin) => [pointKey(pin), pin] as const)).values()];
    for (let wirePosition = 0; wirePosition < document.wires.length; wirePosition += 1) {
      const wire = document.wires[wirePosition]!;
      let trimmed = false;
      for (let segmentIndex = 1; segmentIndex < wire.points.length; segmentIndex += 1) {
        const a = wire.points[segmentIndex - 1]!;
        const b = wire.points[segmentIndex]!;
        const intersections = pins
          .filter((pin) => pointOnSegment(pin, a, b))
          .sort((left, right) => Math.hypot(left[0] - a[0], left[1] - a[1]) - Math.hypot(right[0] - a[0], right[1] - a[1]));
        if (intersections.length !== 2 || samePoint(intersections[0]!, intersections[1]!)) continue;

        const before = compactWire([...wire.points.slice(0, segmentIndex), clonePoint(intersections[0]!)]);
        const after = compactWire([clonePoint(intersections[1]!), ...wire.points.slice(segmentIndex)]);
        const pieces = [before, after].filter((points) => points.length >= 2 && !samePoint(points[0]!, points.at(-1)!));
        if (!pieces.length) document.wires.splice(wirePosition, 1);
        else {
          wire.points = pieces[0]!;
          if (pieces[1]) document.wires.splice(wirePosition + 1, 0, { ...structuredClone(wire), id: `w${++wireIndex}`, points: pieces[1] });
        }
        trimmed = true;
        break;
      }
      if (trimmed && !document.wires.includes(wire)) wirePosition -= 1;
    }
  }
}

/** Remove obsolete collinear vertices without erasing live pin/branch junctions. */
export function compactDocumentWires(document: CircuitDocument): void {
  const protectedPoints = new Set<string>();
  for (const component of document.components) for (const pin of componentPinPoints(component)) protectedPoints.add(pointKey(pin));
  const vertexOwners = new Map<string, Set<string>>();
  for (const wire of document.wires) {
    for (const point of wire.points) {
      const key = pointKey(point);
      const owners = vertexOwners.get(key) ?? new Set<string>();
      owners.add(wire.id);
      vertexOwners.set(key, owners);
    }
    const first = wire.points[0];
    const last = wire.points.at(-1);
    if (first) protectedPoints.add(pointKey(first));
    if (last) protectedPoints.add(pointKey(last));
  }
  for (const [key, owners] of vertexOwners) if (owners.size > 1) protectedPoints.add(key);
  for (const wire of document.wires) {
    const compacted: Point[] = [];
    for (const source of wire.points) {
      const point = clonePoint(source);
      if (compacted.length && samePoint(compacted.at(-1)!, point)) continue;
      compacted.push(point);
      while (compacted.length >= 3) {
        const a = compacted.at(-3)!;
        const b = compacted.at(-2)!;
        const c = compacted.at(-1)!;
        const collinear = (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);
        if (!collinear || protectedPoints.has(pointKey(b))) break;
        compacted.splice(compacted.length - 2, 1);
      }
    }
    wire.points = compacted;
  }
  // Legacy demos used a duplicated point to represent a direct connection at
  // coincident pins (most commonly a source pin sitting on a ground pin).
  // Retarget probes before discarding that drawing primitive so normalization
  // cannot leave a stable schematic reference dangling.
  const survivors = document.wires.filter((wire) => wireHasDistinctPoints(wire.points));
  const replacements = new Map<string, ProbeNodeReference>();
  for (const removed of document.wires.filter((wire) => !wireHasDistinctPoints(wire.points))) {
    const point = removed.points[0];
    if (!point) continue;
    const wire = survivors
      .filter((candidate) => candidate.points.some((vertex) => samePoint(vertex, point)))
      .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }))[0];
    if (wire) {
      replacements.set(removed.id, { kind: "schematic-wire", wireId: wire.id });
      if (removed.netLabel && !wire.netLabel) wire.netLabel = removed.netLabel;
      continue;
    }
    const pin = document.components
      .flatMap((component) => componentPinPoints(component).map((candidate, pinIndex) => ({ componentId: component.id, pinIndex, point: candidate })))
      .filter((candidate) => samePoint(candidate.point, point))
      .sort((left, right) => left.componentId.localeCompare(right.componentId, undefined, { numeric: true }) || left.pinIndex - right.pinIndex)[0];
    if (pin) replacements.set(removed.id, { kind: "schematic-pin", componentId: pin.componentId, pin: pin.pinIndex });
  }
  if (replacements.size) for (const probe of document.probes) retargetProbeExpressionWires(probe.expression, replacements);

  // A remaining coincident wire has no real schematic node to retarget to.
  // Apply the same cleanup as an explicit deletion instead of fabricating
  // topology or preserving an invalid duplicate-point drawing primitive.
  const invalidWireIds = new Set(document.wires.filter((wire) => !wireHasDistinctPoints(wire.points)).map((wire) => wire.id));
  if (invalidWireIds.size) removeReferencesToDeletedSelection(document, new Set(), invalidWireIds);
  for (let index = document.wires.length - 1; index >= 0; index -= 1) {
    const wire = document.wires[index]!;
    if (wireHasDistinctPoints(wire.points)) continue;
    document.wires.splice(index, 1);
  }
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
    if (wire.points.length < 2) continue;
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
  compactDocumentWires(document);
}

export function rubberBandWire(original: Point[], movedVertices: Map<number, Point>, allowTranslate: boolean): Point[] {
  if (original.length < 2 || !movedVertices.size) return original.map(clonePoint);
  const first = movedVertices.get(0);
  const last = movedVertices.get(original.length - 1);
  if (allowTranslate && first && last) {
    const delta: Point = [first[0] - original[0]![0], first[1] - original[0]![1]];
    const sameDelta = [...movedVertices].every(([index, point]) => point[0] - original[index]![0] === delta[0] && point[1] - original[index]![1] === delta[1]);
    if (sameDelta) return original.map((point) => movedPoint(point, delta));
  }

  const result: Point[] = [clonePoint(movedVertices.get(0) ?? original[0]!)];
  for (let index = 1; index < original.length; index += 1) {
    const oldA = original[index - 1]!;
    const oldB = original[index]!;
    const nextA = movedVertices.get(index - 1) ?? oldA;
    const nextB = movedVertices.get(index) ?? oldB;
    const movedA = movedVertices.has(index - 1);
    const movedB = movedVertices.has(index);
    if (nextA[0] === nextB[0] || nextA[1] === nextB[1]) {
      result.push(clonePoint(nextB));
      continue;
    }
    if (oldA[1] === oldB[1]) {
      if (movedA && !movedB) result.push([nextB[0], nextA[1]]);
      else if (!movedA && movedB) result.push([nextA[0], nextB[1]]);
      else {
        const middleX = Math.round((nextA[0] + nextB[0]) / 2);
        result.push([middleX, nextA[1]], [middleX, nextB[1]]);
      }
    } else if (oldA[0] === oldB[0]) {
      if (movedA && !movedB) result.push([nextA[0], nextB[1]]);
      else if (!movedA && movedB) result.push([nextB[0], nextA[1]]);
      else {
        const middleY = Math.round((nextA[1] + nextB[1]) / 2);
        result.push([nextA[0], middleY], [nextB[0], middleY]);
      }
    } else {
      result.push(...orthogonalLeg(nextA, nextB, true));
      continue;
    }
    result.push(clonePoint(nextB));
  }
  return compactWire(result);
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

function transformedOffset(component: CircuitComponent, point: Point): Point {
  return componentPoint({ ...component, pos: [0, 0] }, point);
}

export function propertyLayout(component: CircuitComponent, screenScale: number): {
  refdes: { point: Point; anchor: "start" | "middle" | "end" };
  value: { point: Point; anchor: "start" | "middle" | "end" };
} {
  const definition = EDITOR_SYMBOLS[component.type];
  const bounds = componentBounds(component, component.type === "capacitor" ? definition.bodyBbox : componentBbox(component));
  // Persisted offsets predate generated KiCad anchors and were screen-oriented.
  // Keep them in the document for compatibility, but derive both property sides
  // from the same transformed symbol definition so rotate/mirror stay coherent.
  const refdesPreferred = transformedOffset(component, definition.refdesAnchor);
  const valuePreferred = transformedOffset(component, definition.valueAnchor);
  const gap = 3 / screenScale;
  // Keep two properties on the same side on distinct text rows. Archivo's
  // rendered 11 px glyph box is slightly taller than its nominal font size,
  // so a 12 px baseline gap still overlaps in Chromium.
  const line = 14 / screenScale;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  type Side = "left" | "right" | "above" | "below";
  const side = (preferred: Point): Side => Math.abs(preferred[0]) > Math.abs(preferred[1])
    ? preferred[0] < 0 ? "left" : "right"
    : preferred[1] <= 0 ? "above" : "below";
  const place = (target: Side, outwardLane: number): { point: Point; anchor: "start" | "middle" | "end" } => {
    if (target === "left" || target === "right") {
      const left = target === "left";
      return {
        point: [left ? bounds.minX - gap : bounds.maxX + gap, centerY + outwardLane * line],
        anchor: left ? "end" : "start",
      };
    }
    const above = target === "above";
    return {
      point: [centerX, above ? bounds.minY - gap - line / 2 - outwardLane * line : bounds.maxY + gap + line / 2 + outwardLane * line],
      anchor: "middle",
    };
  };
  if (component.type === "capacitor") {
    // Keep both properties on the transformed KiCad "above body" side, clear
    // of the pin axis. Preserve each generated anchor's minor-axis sign so the
    // reference and value occupy opposite, close body lanes at every transform.
    const outerSide = side(transformedOffset(component, [0, -1]));
    const capacitorLane = (preferred: Point): { point: Point; anchor: "start" | "end" } => {
      if (outerSide === "left" || outerSide === "right") {
        const left = outerSide === "left";
        const upper = preferred[1] < 0;
        return {
          point: [left ? bounds.minX - gap : bounds.maxX + gap, centerY + (upper ? -1 : 1) * (gap + line / 2)],
          anchor: left ? "end" : "start",
        };
      }
      const above = outerSide === "above";
      const left = preferred[0] < 0;
      return {
        point: [centerX + (left ? -gap : gap), above ? bounds.minY - gap - line / 2 : bounds.maxY + gap + line / 2],
        anchor: left ? "end" : "start",
      };
    };
    return { refdes: capacitorLane(refdesPreferred), value: capacitorLane(valuePreferred) };
  }
  const refdesSide = side(refdesPreferred);
  const valueSide = side(valuePreferred);
  return {
    refdes: place(refdesSide, 0),
    value: place(valueSide, refdesSide === valueSide ? 1 : 0),
  };
}

export class SchematicEditor {
  readonly element: SVGSVGElement;
  private doc: CircuitDocument;
  private tool: EditorTool = "select";
  private selectedComponents = new Set<string>();
  private selectedWires = new Set<string>();
  private clipboard: SchematicClipboard | undefined;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private gestureSnapshot = "";
  private wirePoints: Point[] | undefined;
  private wireCheckpoints: Point[][] = [];
  private wirePreview: Point | undefined;
  private wireSnap: SnapCandidate | undefined;
  private objectSnap: SnapCandidate | undefined;
  private wireHorizontalFirst = true;
  private pan: Point;
  private zoom: number;
  private space = false;
  private drag: Drag | undefined;
  private hoveredWire: string | undefined;
  private hoveredMeasurementTarget: EditorMeasurementTarget | undefined;
  private ghostPoint: Point | undefined;
  private pointerWorld: Point | undefined;
  private modifierShift = false;
  private modifierCommand = false;
  private suppressContextMenuUntil = 0;
  private panPointer: PointerPanGesture | undefined;
  private pendingRotation: CircuitComponent["rot"] = 0;
  private pendingMirror = false;
  private readonly wireStyles = new Map<string, WireStyle>();
  private readonly wireCurrents = new Map<string, number>();
  private forcedStatic = false;
  private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  private readonly contextMenuElement: HTMLDivElement;

  constructor(private readonly host: HTMLElement, private readonly options: SchematicEditorOptions) {
    this.doc = structuredClone(options.document);
    this.pan = this.doc.view?.pan ?? [0, 0];
    this.zoom = this.doc.view?.zoom ?? 1;
    this.element = document.createElementNS(NS, "svg");
    this.element.classList.add("schematic-editor");
    this.element.tabIndex = 0;
    this.element.setAttribute("aria-label", "Circuit schematic editor");
    this.contextMenuElement = document.createElement("div");
    this.contextMenuElement.className = "schematic-context-menu";
    this.contextMenuElement.hidden = true;
    this.contextMenuElement.setAttribute("role", "menu");
    this.contextMenuElement.setAttribute("aria-label", "Editor actions");
    host.replaceChildren(this.element, this.contextMenuElement);
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
    this.closeContextMenu();
    this.cancelWire();
    if (this.panPointer) this.releasePointer(this.panPointer.pointerId);
    this.panPointer = undefined;
    if (this.drag) this.releasePointer(this.drag.pointerId);
    this.drag = undefined;
    this.gestureSnapshot = "";
    this.objectSnap = undefined;
    this.updateHoveredMeasurementTarget(undefined);
    this.doc = structuredClone(document);
    this.pan = this.doc.view?.pan ?? [0, 0];
    this.zoom = this.doc.view?.zoom ?? 1;
    if (resetHistory) { this.undoStack = []; this.redoStack = []; }
    this.wireStyles.clear();
    this.wireCurrents.clear();
    this.clearSelection();
    this.render();
  }
  setTool(tool: EditorTool): void {
    this.closeContextMenu();
    this.cancelWire();
    this.tool = tool;
    if (tool !== "measure") this.updateHoveredMeasurementTarget(undefined);
    this.pendingRotation = 0;
    this.pendingMirror = false;
    this.ghostPoint = this.isComponentTool(tool) ? this.canvasCenter() : undefined;
    this.objectSnap = undefined;
    this.render();
  }
  getTool(): EditorTool { return this.tool; }
  selected(): { components: string[]; wires: string[] } { return { components: [...this.selectedComponents], wires: [...this.selectedWires] }; }
  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
  undo(): void {
    if (this.wirePoints) { this.undoWireCorner(); return; }
    if (this.drag) { this.cancelActiveOperation(); return; }
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
  rotate(delta = 90): void {
    if (this.isComponentTool(this.tool)) {
      this.pendingRotation = ((this.pendingRotation + delta + 360) % 360) as CircuitComponent["rot"];
      this.refreshPointerOperation();
      this.render();
      return;
    }
    const active = this.drag?.kind === "component" ? this.drag : undefined;
    const transformed = transformComponentSelection(this.doc.components, this.selectedComponents, { kind: "rotate", delta });
    const transformSelection = () => {
      for (const [id, state] of transformed) {
        const component = this.doc.components.find((item) => item.id === id);
        if (component) Object.assign(component, state);
      }
    };
    if (active) {
      transformSelection();
      if (transformed.size > 1) this.rebaseTransformedComponentDrag(active);
      else {
        this.refreshActiveComponentDrag(active);
        active.moved = true;
      }
      this.render();
      return;
    }
    const connectivity = this.selectedComponents.size
      ? this.makeComponentDrag(this.selectedComponents.values().next().value as string, { moveSelectedWires: false })
      : undefined;
    this.change(() => {
      transformSelection();
      if (connectivity?.preserveWires) this.updateAttachedWires(connectivity);
      trimOverlappingWires(this.doc, this.selectedComponents);
      normalizeJunctions(this.doc);
    });
  }
  mirror(axis: "x" | "y" = "x"): void {
    if (this.isComponentTool(this.tool)) {
      this.pendingMirror = !this.pendingMirror;
      if (axis === "y") this.pendingRotation = ((this.pendingRotation + 180) % 360) as CircuitComponent["rot"];
      this.refreshPointerOperation();
      this.render();
      return;
    }
    const active = this.drag?.kind === "component" ? this.drag : undefined;
    const transformed = transformComponentSelection(this.doc.components, this.selectedComponents, { kind: "mirror", axis });
    const transformSelection = () => {
      for (const [id, state] of transformed) {
        const component = this.doc.components.find((item) => item.id === id);
        if (component) Object.assign(component, state);
      }
    };
    if (active) {
      transformSelection();
      if (transformed.size > 1) this.rebaseTransformedComponentDrag(active);
      else {
        this.refreshActiveComponentDrag(active);
        active.moved = true;
      }
      this.render();
      return;
    }
    const connectivity = this.selectedComponents.size
      ? this.makeComponentDrag(this.selectedComponents.values().next().value as string, { moveSelectedWires: false })
      : undefined;
    this.change(() => {
      transformSelection();
      if (connectivity?.preserveWires) this.updateAttachedWires(connectivity);
      trimOverlappingWires(this.doc, this.selectedComponents);
      normalizeJunctions(this.doc);
    });
  }
  deleteSelected(): void { this.change(() => { removeReferencesToDeletedSelection(this.doc, this.selectedComponents, this.selectedWires); this.doc.components = this.doc.components.filter((component) => !this.selectedComponents.has(component.id)); this.doc.wires = this.doc.wires.filter((wire) => !this.selectedWires.has(wire.id)); normalizeJunctions(this.doc); this.clearSelection(); }); }
  copy(): string { return JSON.stringify(createSchematicClipboard(this.doc, this.selectedComponents, this.selectedWires)); }
  paste(source?: string): void {
    const clipboard = source === undefined ? this.clipboard ?? readSessionClipboard() : parseSchematicClipboard(source);
    if (!clipboard || (!clipboard.components.length && !clipboard.wires.length)) return;
    if (source === undefined) this.clipboard = clipboard;
    const target = this.pointerWorld ? this.pointerSnap(this.pointerWorld, { metaKey: false, ctrlKey: false }) : this.canvasCenter();
    this.change(() => {
      const pasted = pasteSchematicClipboard(this.doc, clipboard, target);
      this.selectedComponents = new Set(pasted.components);
      this.selectedWires = new Set(pasted.wires);
    });
  }
  duplicate(): void {
    const clipboard = createSchematicClipboard(this.doc, this.selectedComponents, this.selectedWires);
    if (!clipboard.components.length && !clipboard.wires.length) return;
    this.clipboard = clipboard;
    writeSessionClipboard(clipboard);
    const target: Point = [clipboard.anchor[0] + 1, clipboard.anchor[1] + 1];
    this.change(() => {
      const pasted = pasteSchematicClipboard(this.doc, clipboard, target);
      this.selectedComponents = new Set(pasted.components);
      this.selectedWires = new Set(pasted.wires);
    });
  }
  copyToClipboard(): void {
    const clipboard = createSchematicClipboard(this.doc, this.selectedComponents, this.selectedWires);
    if (!clipboard.components.length && !clipboard.wires.length) return;
    this.clipboard = clipboard;
    const value = writeSessionClipboard(clipboard);
    try { void navigator.clipboard?.writeText(value).catch(() => undefined); } catch {}
  }
  fit(): void {
    this.closeContextMenu();
    if (this.panPointer) return;
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
    this.saveViewPreservingGesture();
    this.render();
    this.emit("view");
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
    clone.querySelectorAll(".editor-hit,.editor-component-hit,.editor-pin-hit,.editor-selection,.selection-box,.wire-preview,.pot-hit,.snap-indicator,.placement-ghost,.pin-open").forEach((element) => element.remove());
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

  private contextTargetFromElement(target: EventTarget | null): ContextTarget {
    const element = target instanceof Element ? target : undefined;
    if (!element) return {};
    const pin = element.closest<SVGElement>("[data-pin-component]")?.dataset.pinComponent;
    const pot = element.closest<SVGElement>("[data-pot-hit]")?.dataset.potHit;
    const componentId = element.closest<SVGElement>("[data-component-id]")?.dataset.componentId ?? pin ?? pot;
    const wireId = element.closest<SVGElement>("[data-wire-id]")?.dataset.wireId;
    return {
      ...(componentId ? { componentId } : {}),
      ...(wireId ? { wireId } : {}),
    };
  }

  private measurementTargetFromElement(target: EventTarget | null): EditorMeasurementTarget | undefined {
    const element = target instanceof Element ? target : undefined;
    if (!element) return undefined;
    const pin = element.closest<SVGElement>("[data-pin-hit]");
    const componentId = pin?.dataset.pinComponent;
    const pinIndex = Number(pin?.dataset.pinIndex);
    if (componentId && Number.isInteger(pinIndex) && pinIndex >= 0) {
      return { kind: "pin", componentId, pinIndex };
    }
    const bodyId = element.closest<SVGElement>("[data-component-id]")?.dataset.componentId
      ?? element.closest<SVGElement>("[data-pot-hit]")?.dataset.potHit;
    if (bodyId) return { kind: "component", componentId: bodyId };
    const wireId = element.closest<SVGElement>("[data-wire-id]")?.dataset.wireId;
    return wireId ? { kind: "wire", wireId } : undefined;
  }

  private updateHoveredMeasurementTarget(target: EditorMeasurementTarget | undefined): void {
    const previous = this.hoveredMeasurementTarget;
    const same = previous?.kind === target?.kind
      && (previous?.kind !== "wire" || previous.wireId === (target as Extract<EditorMeasurementTarget, { kind: "wire" }> | undefined)?.wireId)
      && (previous?.kind !== "component" || previous.componentId === (target as Extract<EditorMeasurementTarget, { kind: "component" }> | undefined)?.componentId)
      && (previous?.kind !== "pin" || (
        previous.componentId === (target as Extract<EditorMeasurementTarget, { kind: "pin" }> | undefined)?.componentId
        && previous.pinIndex === (target as Extract<EditorMeasurementTarget, { kind: "pin" }> | undefined)?.pinIndex
      ));
    if (same) return;
    this.hoveredMeasurementTarget = target;
    this.options.onHoverMeasureTarget?.(target);
  }

  private selectContextTarget(target: ContextTarget): void {
    let changed = false;
    if (target.componentId && this.doc.components.some((component) => component.id === target.componentId)) {
      if (!this.selectedComponents.has(target.componentId)) {
        this.selectedComponents.clear();
        this.selectedWires.clear();
        this.selectedComponents.add(target.componentId);
        changed = true;
      }
    } else if (target.wireId && this.doc.wires.some((wire) => wire.id === target.wireId)) {
      if (!this.selectedWires.has(target.wireId)) {
        this.selectedComponents.clear();
        this.selectedWires.clear();
        this.selectedWires.add(target.wireId);
        changed = true;
      }
    }
    if (!changed) return;
    this.emitSelection();
    this.render();
  }

  private canFinishWire(): boolean {
    if (!this.wirePoints) return false;
    let points = this.wirePoints.map(clonePoint);
    if (this.wirePreview) points = compactWire([...points, ...orthogonalLeg(points.at(-1)!, this.wirePreview, this.wireHorizontalFirst)]);
    return compactWire(points).length >= 2;
  }

  private closeContextMenu(focusEditor = false): boolean {
    if (this.contextMenuElement.hidden) return false;
    this.contextMenuElement.hidden = true;
    this.contextMenuElement.replaceChildren();
    delete this.contextMenuElement.dataset.contextMode;
    if (focusEditor) this.element.focus({ preventScroll: true });
    return true;
  }

  private openContextMenu(clientX: number, clientY: number, target: ContextTarget): void {
    this.closeContextMenu();
    let mode: "wire" | "selection";
    let items: ContextMenuItem[];
    if (this.wirePoints) {
      mode = "wire";
      items = [
        { action: "undo-wire-segment", label: "Undo Last Segment", shortcut: "Backspace", disabled: this.wireCheckpoints.length <= 1, run: () => this.undoWireCorner() },
        { action: "switch-wire-posture", label: "Switch Segment Posture", shortcut: "/", run: () => this.toggleWireBend() },
        { action: "finish-wire", label: "Finish Wire", shortcut: "Enter", disabled: !this.canFinishWire(), run: () => this.finishWire(true) },
        { action: "cancel-wire", label: "Cancel Wire", shortcut: "Esc", run: () => { this.cancelWire(); this.render(); } },
      ];
    } else {
      if (this.drag) return;
      this.selectContextTarget(target);
      const hasComponents = this.selectedComponents.size > 0;
      const hasSelection = hasComponents || this.selectedWires.size > 0;
      if (!hasSelection) return;
      mode = "selection";
      items = [
        { action: "move", label: "Move", shortcut: "M", run: () => this.beginKeyboardMove("move") },
        { action: "drag", label: "Drag", shortcut: "G", run: () => this.beginKeyboardMove("drag") },
        ...(hasComponents ? [
          { action: "rotate-ccw", label: "Rotate Counterclockwise", shortcut: "R", run: () => this.rotate(rotationDeltaForShortcut(false)) },
          { action: "mirror-x", label: "Mirror Left/Right", shortcut: "X", run: () => this.mirror("x") },
          { action: "mirror-y", label: "Mirror Top/Bottom", shortcut: "Y", run: () => this.mirror("y") },
        ] satisfies ContextMenuItem[] : []),
        { action: "delete", label: "Delete", shortcut: "Del", run: () => this.deleteSelected() },
      ];
    }

    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.contextAction = item.action;
      button.setAttribute("role", "menuitem");
      button.disabled = item.disabled ?? false;
      const label = document.createElement("span");
      label.textContent = item.label;
      const shortcut = document.createElement("kbd");
      shortcut.textContent = item.shortcut;
      button.append(label, shortcut);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.closeContextMenu(true);
        item.run();
      });
      this.contextMenuElement.append(button);
    }

    this.contextMenuElement.dataset.contextMode = mode;
    this.contextMenuElement.style.left = "0px";
    this.contextMenuElement.style.top = "0px";
    this.contextMenuElement.hidden = false;
    const hostRect = this.host.getBoundingClientRect();
    const localX = clientX ? clientX - hostRect.left : hostRect.width / 2;
    const localY = clientY ? clientY - hostRect.top : hostRect.height / 2;
    const maximumLeft = Math.max(4, this.host.clientWidth - this.contextMenuElement.offsetWidth - 4);
    const maximumTop = Math.max(4, this.host.clientHeight - this.contextMenuElement.offsetHeight - 4);
    this.contextMenuElement.style.left = `${clamp(localX, 4, maximumLeft)}px`;
    this.contextMenuElement.style.top = `${clamp(localY, 4, maximumTop)}px`;
    this.contextMenuElement.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }

  private bindRoot(): void {
    this.contextMenuElement.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.contextMenuElement.addEventListener("contextmenu", (event) => event.preventDefault());
    this.contextMenuElement.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeContextMenu(true);
        return;
      }
      const buttons = [...this.contextMenuElement.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      let next: HTMLButtonElement | undefined;
      if (event.key === "ArrowDown") next = buttons[(index + 1 + buttons.length) % buttons.length];
      else if (event.key === "ArrowUp") next = buttons[(index - 1 + buttons.length) % buttons.length];
      else if (event.key === "Home") next = buttons[0];
      else if (event.key === "End") next = buttons.at(-1);
      if (!next) return;
      event.preventDefault();
      next.focus({ preventScroll: true });
    });
    document.addEventListener("pointerdown", (event) => {
      if (this.contextMenuElement.hidden || this.contextMenuElement.contains(event.target as Node)) return;
      this.closeContextMenu();
    }, true);
    this.element.addEventListener("wheel", (event) => {
      this.closeContextMenu();
      event.preventDefault();
      if (this.panPointer) return;
      const before = this.toWorld(event.clientX, event.clientY);
      this.zoom = clamp(this.zoom * Math.exp(-event.deltaY * 0.0015), 0.2, 6);
      const rect = this.element.getBoundingClientRect();
      this.pan = [event.clientX - rect.left - before[0] * GRID * this.zoom, event.clientY - rect.top - before[1] * GRID * this.zoom];
      this.saveViewPreservingGesture();
      this.render();
      this.emit("view");
    }, { passive: false });
    this.element.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.element.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.element.addEventListener("pointerup", (event) => this.pointerUp(event));
    this.element.addEventListener("pointercancel", () => {
      if (!this.cancelPointerPan()) this.cancelActiveOperation();
    });
    this.element.addEventListener("dblclick", (event) => {
      if (!this.wirePoints) return;
      event.preventDefault();
      this.finishWire(false);
    });
    this.element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (this.panPointer?.mode === "right" || performance.now() < this.suppressContextMenuUntil) return;
      this.openContextMenu(event.clientX, event.clientY, this.contextTargetFromElement(event.target));
    });
    this.element.addEventListener("pointerleave", () => {
      this.updateHoveredMeasurementTarget(undefined);
      if (!this.drag && this.hoveredWire !== undefined) {
        this.hoveredWire = undefined;
        this.options.onHoverWire?.(undefined);
      }
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && this.closeContextMenu(true)) { event.preventDefault(); return; }
      const target = event.target as HTMLElement;
      if (target.matches("input,textarea,select,[contenteditable=true]")) return;
      this.modifierShift = event.shiftKey;
      this.modifierCommand = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (event.key === "Shift" || event.key === "Control" || event.key === "Meta") { this.refreshPointerOperation(); this.render(); }
      else if (event.key === " " && event.shiftKey && this.wirePoints) { event.preventDefault(); this.toggleWireBend(); }
      else if (event.key === " ") { this.space = true; event.preventDefault(); this.updatePointerFeedback(); }
      else if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (this.wirePoints) this.undoWireCorner();
        else if (this.drag) this.cancelActiveOperation();
        else event.shiftKey ? this.redo() : this.undo();
      }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") { event.preventDefault(); if (!this.drag && !this.wirePoints) this.redo(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") { event.preventDefault(); this.copyToClipboard(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") { event.preventDefault(); this.paste(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); this.duplicate(); }
      else if (event.key === "Enter" && this.wirePoints) { event.preventDefault(); event.stopPropagation(); this.finishWire(true); }
      else if (event.key === "/" && this.wirePoints) { event.preventDefault(); this.toggleWireBend(); }
      else if (key === "w" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); this.beginWireFromPointer(event); }
      else if (key === "m" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); this.beginKeyboardMove("move"); }
      else if (key === "g" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); this.beginKeyboardMove("drag"); }
      else if (key === "j" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); this.placeExplicitJunction(); }
      else if (key === "r" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); this.rotate(rotationDeltaForShortcut(event.shiftKey)); }
      else if (key === "x" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); this.mirror("x"); }
      else if (key === "y" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); this.mirror("y"); }
      else if (isFitShortcut(event.key) && !event.metaKey && !event.ctrlKey) { event.preventDefault(); this.fit(); }
      else if (event.key === "Backspace" && this.wirePoints) { event.preventDefault(); this.undoWireCorner(); }
      else if (event.key === "Delete" || event.key === "Backspace") this.deleteSelected();
      else if (event.key === "Escape") {
        event.preventDefault();
        if (this.cancelPointerPan()) return;
        if (this.cancelActiveOperation()) return;
        if (this.tool !== "select") this.setTool("select");
        else if (this.selectedComponents.size || this.selectedWires.size) { this.clearSelection(); this.render(); }
      }
    };
    this.element.addEventListener("keydown", keydown);
    window.addEventListener("keydown", (event) => { if (document.activeElement !== this.element) keydown(event); });
    window.addEventListener("keyup", (event) => {
      if (event.key === " ") { this.space = false; this.updatePointerFeedback(); }
      if (event.key === "Shift" || event.key === "Control" || event.key === "Meta") {
        this.modifierShift = event.shiftKey;
        this.modifierCommand = event.metaKey || event.ctrlKey;
        this.refreshPointerOperation();
        this.render();
      }
    });
  }

  private selectionMode(event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">): SelectionMode {
    const command = event.metaKey || event.ctrlKey;
    if (command && event.shiftKey) return "remove";
    if (command) return "toggle";
    if (event.shiftKey) return "add";
    return "replace";
  }

  private updateSelection(matches: Set<string>, selected: Set<string>, mode: SelectionMode): void {
    if (mode === "replace") {
      selected.clear();
      for (const id of matches) selected.add(id);
    } else if (mode === "add") for (const id of matches) selected.add(id);
    else if (mode === "remove") for (const id of matches) selected.delete(id);
    else for (const id of matches) selected.has(id) ? selected.delete(id) : selected.add(id);
  }

  private currentModifiers(): Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey"> {
    return { metaKey: this.modifierCommand, ctrlKey: false, shiftKey: this.modifierShift };
  }

  private dragExcludedWires(drag: Extract<Drag, { kind: "component" }>): Set<string> {
    return new Set([...drag.attachments.keys(), ...drag.selectedWireOrigins.keys()]);
  }

  private snappedDragAnchor(
    drag: Extract<Drag, { kind: "component" }>,
    raw: Point,
    modifiers: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">,
  ): Point | undefined {
    const component = this.doc.components.find((item) => item.id === drag.id);
    if (!component) return undefined;
    const desired = componentAnchorFromPointer(raw, drag.grabOffset);
    return this.snappedComponentAnchor(desired, component, modifiers, {
      excludedComponents: new Set(drag.origins.keys()),
      excludedWires: this.dragExcludedWires(drag),
    });
  }

  private refreshActiveComponentDrag(drag: Extract<Drag, { kind: "component" }>): void {
    const component = this.doc.components.find((item) => item.id === drag.id);
    if (!component) return;
    const anchor = this.pointerWorld
      ? this.snappedDragAnchor(drag, this.pointerWorld, this.currentModifiers())
      : clonePoint(component.pos);
    if (anchor) this.updateComponentDrag(drag, anchor);
  }

  private rebaseTransformedComponentDrag(drag: Extract<Drag, { kind: "component" }>): void {
    if (drag.preserveWires) this.updateAttachedWires(drag);
    const component = this.doc.components.find((item) => item.id === drag.id);
    if (!component) return;
    const rebased = this.makeComponentDrag(drag.id, {
      keyboard: drag.keyboard,
      preserveWires: drag.preserveWires,
      moveSelectedWires: drag.selectedWireOrigins.size > 0,
      pointerPoint: this.pointerWorld ?? component.pos,
      ...(drag.pointerId === undefined ? {} : { pointerId: drag.pointerId }),
      ...(drag.clickSelection ? { clickSelection: drag.clickSelection } : {}),
    });
    rebased.moved = true;
    this.drag = rebased;
    this.refreshActiveComponentDrag(rebased);
  }

  private refreshPointerOperation(): void {
    const raw = this.pointerWorld;
    if (!raw) return;
    const modifiers = this.currentModifiers();
    if (this.isComponentTool(this.tool) && !this.drag) {
      const part = partByType(this.tool);
      const placement = { id: "ghost", type: part.type, pos: this.pointerSnap(raw, modifiers), rot: this.pendingRotation, mirror: this.pendingMirror } as CircuitComponent;
      this.ghostPoint = this.snappedComponentAnchor(raw, placement, modifiers);
    } else if (this.drag?.kind === "component") {
      const drag = this.drag;
      const anchor = this.snappedDragAnchor(drag, raw, modifiers);
      if (anchor) this.updateComponentDrag(drag, anchor);
    } else if (this.drag?.kind === "wire") {
      this.updateWireDrag(this.drag, raw, modifiers);
    } else if (this.wirePoints) {
      const candidate = modifiers.shiftKey ? undefined : this.findWireSnap(raw, { grid: !modifiers.metaKey });
      this.wireSnap = candidate;
      this.wirePreview = candidate?.point ?? this.pointerSnap(raw, modifiers);
    }
  }

  private applyClickSelection(click: ClickSelection): void {
    this.selectedComponents = new Set(click.components);
    this.selectedWires = new Set(click.wires);
    if (click.componentId) this.updateSelection(new Set([click.componentId]), this.selectedComponents, click.mode);
    if (click.wireId) this.updateSelection(new Set([click.wireId]), this.selectedWires, click.mode);
    this.emitSelection();
  }

  private releasePointer(pointerId: number | undefined): void {
    if (pointerId !== undefined && this.element.hasPointerCapture(pointerId)) this.element.releasePointerCapture(pointerId);
  }

  private cancelPointerPan(): boolean {
    const overlay = this.panPointer;
    if (!overlay) return false;
    if (overlay.panning) this.pan = clonePoint(overlay.origin);
    this.releasePointer(overlay.pointerId);
    this.panPointer = undefined;
    if (overlay.mode === "right") this.suppressContextMenuUntil = performance.now() + 500;
    this.render();
    return true;
  }

  private cancelActiveOperation(): boolean {
    if (this.wirePoints) {
      this.cancelWire();
      this.render();
      return true;
    }
    if (this.drag) {
      const drag = this.drag;
      const changed = Boolean(this.gestureSnapshot && this.gestureSnapshot !== canonicalizeCircuit(this.doc));
      if (drag.kind === "component" || drag.kind === "wire" || drag.kind === "pot") {
        if (this.gestureSnapshot) this.doc = deserializeCircuit(this.gestureSnapshot);
        this.gestureSnapshot = "";
        if (drag.kind === "pot") this.options.onLiveGesture?.(false, drag.id);
        if (changed) this.emit("edit");
      }
      this.releasePointer(drag.pointerId);
      this.drag = undefined;
      this.objectSnap = undefined;
      this.render();
      return true;
    }
    if (this.isComponentTool(this.tool)) {
      this.setTool("select");
      return true;
    }
    return false;
  }

  private beginWireFromPointer(event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey">): void {
    if (this.wirePoints) return;
    this.tool = "wire";
    const raw = this.pointerWorld ?? this.canvasCenter();
    const candidate = event.shiftKey ? undefined : this.findWireSnap(raw, { grid: !(event.metaKey || event.ctrlKey) });
    this.beginWire(candidate?.point ?? this.pointerSnap(raw, event));
    this.wireSnap = candidate;
    this.render();
  }

  private toggleWireBend(): void {
    this.wireHorizontalFirst = !this.wireHorizontalFirst;
    this.render();
  }

  private placeExplicitJunction(): void {
    if (this.tool !== "select" || this.drag || this.wirePoints || !this.pointerWorld) return;
    const wires = insertExplicitJunction(this.doc.wires, this.snap(this.pointerWorld));
    if (!wires) return;
    this.change(() => { this.doc.wires = wires; });
  }

  private undoWireCorner(): void {
    if (!this.wirePoints) return;
    if (this.wireCheckpoints.length <= 1) {
      this.cancelWire();
      this.render();
      return;
    }
    this.wireCheckpoints.pop();
    this.wirePoints = this.wireCheckpoints.at(-1)!.map(clonePoint);
    this.wireSnap = undefined;
    this.render();
  }

  private beginKeyboardMove(mode: WireKeyboardMoveMode): void {
    if (this.drag || this.wirePoints) return;
    if (this.tool !== "select") this.setTool("select");
    if (!this.selectedComponents.size) {
      const first = this.doc.wires.find((wire) => this.selectedWires.has(wire.id) && wire.points.length >= 2);
      if (!first) return;
      const midpoint: Point = [(first.points[0]![0] + first.points[1]![0]) / 2, (first.points[0]![1] + first.points[1]![1]) / 2];
      const raw = this.pointerWorld ?? midpoint;
      const plan = wireKeyboardMovePlan(mode, this.doc.wires, this.selectedWires, raw);
      if (!plan) return;
      this.beginGesture();
      this.drag = this.makeWireDrag(plan.wireId, raw, { keyboard: true, block: plan.block });
      this.render();
      return;
    }
    const id = this.selectedComponents.values().next().value as string | undefined;
    const component = this.doc.components.find((item) => item.id === id);
    if (!id || !component) return;
    this.beginGesture();
    const raw = this.pointerWorld ?? component.pos;
    this.drag = this.makeComponentDrag(id, { keyboard: true, preserveWires: mode === "drag", pointerPoint: raw });
    const anchor = this.snappedDragAnchor(this.drag, raw, { metaKey: false, ctrlKey: false, shiftKey: false });
    if (anchor) this.updateComponentDrag(this.drag, anchor);
    this.render();
  }

  private finishComponentDrag(drag: Extract<Drag, { kind: "component" }>): void {
    if (drag.moved) {
      compactDocumentWires(this.doc);
      trimOverlappingWires(this.doc, drag.origins.keys());
      normalizeJunctions(this.doc);
    }
    const changed = Boolean(this.gestureSnapshot && this.gestureSnapshot !== canonicalizeCircuit(this.doc));
    this.endGesture();
    if (changed) this.emit("edit");
    this.objectSnap = undefined;
  }

  private makeWireDrag(id: string, raw: Point, options: { keyboard?: boolean; pointerId?: number; clickSelection?: ClickSelection; block?: boolean } = {}): Extract<Drag, { kind: "wire" }> {
    compactDocumentWires(this.doc);
    const wire = this.doc.wires.find((item) => item.id === id);
    const segmentIndex = wire?.points.slice(1)
      .map((point, index) => ({ index: index + 1, distance: distanceToSegment(raw, wire.points[index]!, point) }))
      .sort((left, right) => left.distance - right.distance)[0]?.index ?? 1;
    const block = options.block ?? false;
    const originals = new Map<string, Point[]>();
    if (block) for (const selected of this.doc.wires) {
      if (this.selectedWires.has(selected.id)) originals.set(selected.id, selected.points.map(clonePoint));
    }
    return {
      kind: "wire",
      id,
      original: wire?.points.map(clonePoint) ?? [],
      originals,
      pointerOrigin: clonePoint(raw),
      segmentIndex,
      block,
      moved: false,
      keyboard: options.keyboard ?? false,
      ...(options.pointerId === undefined ? {} : { pointerId: options.pointerId }),
      ...(options.clickSelection ? { clickSelection: options.clickSelection } : {}),
    };
  }

  private updateWireDrag(drag: Extract<Drag, { kind: "wire" }>, raw: Point, event: Pick<MouseEvent, "metaKey" | "ctrlKey">): void {
    if (drag.block) {
      const delta = wireBlockDelta(raw, drag.pointerOrigin, event.metaKey || event.ctrlKey);
      for (const [id, points] of translateWireSelection(drag.originals, delta)) {
        const wire = this.doc.wires.find((item) => item.id === id);
        if (wire) wire.points = points;
      }
      drag.moved = drag.moved || delta[0] !== 0 || delta[1] !== 0;
      return;
    }
    const wire = this.doc.wires.find((item) => item.id === drag.id);
    const a = drag.original[drag.segmentIndex - 1];
    const b = drag.original[drag.segmentIndex];
    if (!wire || !a || !b) return;
    const target = this.pointerSnap(raw, event);
    const coordinate = a[1] === b[1] ? target[1] : target[0];
    wire.points = rerouteWireSegment(drag.original, drag.segmentIndex, coordinate);
    drag.moved = drag.moved || path(wire.points) !== path(drag.original);
  }

  private finishWireDrag(drag: Extract<Drag, { kind: "wire" }>): void {
    if (drag.moved) normalizeJunctions(this.doc);
    const changed = Boolean(this.gestureSnapshot && this.gestureSnapshot !== canonicalizeCircuit(this.doc));
    this.endGesture();
    if (changed) this.emit("edit");
  }

  private pointerDown(event: PointerEvent): void {
    this.element.focus();
    this.closeContextMenu();
    this.suppressContextMenuUntil = 0;
    this.modifierShift = event.shiftKey;
    this.modifierCommand = event.metaKey || event.ctrlKey;
    const target = event.target as SVGElement;
    const raw = this.toWorld(event.clientX, event.clientY);
    this.pointerWorld = raw;
    const world = this.pointerSnap(raw, event);
    if (event.button === 2) {
      this.panPointer = {
        start: [event.clientX, event.clientY],
        origin: clonePoint(this.pan),
        pointerId: event.pointerId,
        panning: false,
        mode: "right",
        contextTarget: this.contextTargetFromElement(target),
      };
      this.element.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (event.button === 1 || (this.space && event.button === 0)) {
      this.panPointer = {
        start: [event.clientX, event.clientY],
        origin: clonePoint(this.pan),
        pointerId: event.pointerId,
        panning: true,
        mode: event.button === 1 ? "middle" : "space",
      };
      this.element.setPointerCapture(event.pointerId);
      event.preventDefault();
      this.updatePointerFeedback();
      return;
    }
    const activeDrag = this.drag;
    if (activeDrag?.kind === "component" && activeDrag.keyboard && event.button === 0) {
      const anchor = this.snappedDragAnchor(activeDrag, raw, event);
      if (anchor) this.updateComponentDrag(activeDrag, anchor);
      const drag = activeDrag;
      this.finishComponentDrag(drag);
      this.drag = undefined;
      this.render();
      return;
    }
    if (activeDrag?.kind === "wire" && activeDrag.keyboard && event.button === 0) {
      this.updateWireDrag(activeDrag, raw, event);
      this.finishWireDrag(activeDrag);
      this.drag = undefined;
      this.render();
      return;
    }
    if (this.tool === "measure" && event.button === 0) {
      const measurementTarget = this.measurementTargetFromElement(target);
      this.updateHoveredMeasurementTarget(measurementTarget);
      if (measurementTarget) {
        event.preventDefault();
        this.options.onMeasureTarget?.({
          target: measurementTarget,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
        });
      }
      return;
    }
    if (this.wirePoints || this.tool === "wire") {
      const candidate = event.shiftKey ? undefined : this.findWireSnap(raw, { grid: !(event.metaKey || event.ctrlKey) });
      this.commitWireClick(candidate?.point ?? world, candidate);
      return;
    }
    if (this.isComponentTool(this.tool)) {
      const part = partByType(this.tool as ComponentType);
      const placement = { id: "ghost", type: part.type, pos: world, rot: this.pendingRotation, mirror: this.pendingMirror } as CircuitComponent;
      const point = this.snappedComponentAnchor(raw, placement, event);
      this.change(() => {
        const id = `c${idMax(this.doc.components, "c") + 1}`;
        const component: CircuitComponent = {
          id,
          type: part.type,
          pos: clonePoint(point),
          rot: this.pendingRotation,
          mirror: this.pendingMirror,
          ...(part.defaultValue !== undefined ? { value: part.defaultValue } : {}),
          ...(part.type === "potentiometer" ? { params: { t: 0.5 } } : {}),
        };
        component.label = { text: `${part.prefix}${id.slice(1)}`, offset: transformedOffset(component, EDITOR_SYMBOLS[part.type].refdesAnchor) };
        this.doc.components.push(component);
        trimOverlappingWires(this.doc, [id]);
        normalizeJunctions(this.doc);
        this.clearSelection();
        this.selectedComponents.add(id);
      });
      this.tool = "select";
      this.ghostPoint = undefined;
      this.pendingRotation = 0;
      this.pendingMirror = false;
      this.objectSnap = undefined;
      this.render();
      return;
    }

    const pinHit = target.closest<SVGElement>("[data-pin-hit]");
    const explicitPin = pinHit && !event.shiftKey
      ? (() => {
        const component = this.doc.components.find((item) => item.id === pinHit.dataset.pinComponent);
        const pinIndex = Number(pinHit.dataset.pinIndex);
        const point = component && Number.isInteger(pinIndex) ? componentPinPoints(component)[pinIndex] : undefined;
        return component && point
          ? { point: clonePoint(point), kind: "pin" as const, distance: Math.hypot(point[0] - raw[0], point[1] - raw[1]), componentId: component.id, pinIndex }
          : undefined;
      })()
      : undefined;
    if (explicitPin) {
      this.beginWire(explicitPin.point);
      this.wireSnap = explicitPin;
      this.render();
      return;
    }

    const potId = target.closest<SVGElement>("[data-pot-hit]")?.dataset.potHit;
    if (potId) {
      this.clearSelection();
      this.selectedComponents.add(potId);
      this.emitSelection();
      this.beginGesture();
      this.drag = { kind: "pot", id: potId, pointerId: event.pointerId };
      this.options.onLiveGesture?.(true, potId);
      this.element.setPointerCapture(event.pointerId);
      this.updatePotFromPointer(potId, event.clientX, event.clientY);
      return;
    }

    const componentId = target.closest<SVGGElement>("[data-component-id]")?.dataset.componentId ?? pinHit?.dataset.pinComponent;
    const clickedComponent = componentId ? this.doc.components.find((component) => component.id === componentId) : undefined;
    const autoWire = event.shiftKey ? undefined : this.findNearestPin(raw) ?? this.findWireEndpointSnap(raw);
    if (autoWire && clickedComponent?.type !== "ground") {
      this.beginWire(autoWire.point);
      this.wireSnap = autoWire;
      this.render();
      return;
    }

    const wireId = target.closest<SVGElement>("[data-wire-id]")?.dataset.wireId;
    if (componentId) {
      const mode = this.selectionMode(event);
      const alreadySelected = this.selectedComponents.has(componentId);
      const clickSelection: ClickSelection = { mode, componentId, components: new Set(this.selectedComponents), wires: new Set(this.selectedWires) };
      if (mode === "replace") {
        if (!alreadySelected) {
          this.selectedComponents.clear();
          this.selectedWires.clear();
          this.selectedComponents.add(componentId);
        }
      } else if (!(alreadySelected && (mode === "toggle" || mode === "remove"))) this.updateSelection(new Set([componentId]), this.selectedComponents, mode);
      if (this.selectedComponents.has(componentId)) {
        this.beginGesture();
        this.drag = this.makeComponentDrag(componentId, {
          pointerId: event.pointerId,
          preserveWires: true,
          pointerPoint: raw,
          ...(alreadySelected && (mode === "toggle" || mode === "remove") ? { clickSelection } : {}),
        });
        this.element.setPointerCapture(event.pointerId);
      }
      this.emitSelection();
      this.render();
    } else if (wireId) {
      const mode = this.selectionMode(event);
      const alreadySelected = this.selectedWires.has(wireId);
      const clickSelection: ClickSelection = { mode, wireId, components: new Set(this.selectedComponents), wires: new Set(this.selectedWires) };
      if (mode === "replace") {
        const preserveWireOnlyBlock = alreadySelected && !this.selectedComponents.size && this.selectedWires.size > 1;
        if (!preserveWireOnlyBlock) {
          this.selectedComponents.clear();
          this.selectedWires.clear();
          this.selectedWires.add(wireId);
        }
      } else if (!(alreadySelected && (mode === "toggle" || mode === "remove"))) this.updateSelection(new Set([wireId]), this.selectedWires, mode);
      this.emitSelection();
      if (this.selectedWires.has(wireId)) {
        this.beginGesture();
        this.drag = this.makeWireDrag(wireId, raw, {
          pointerId: event.pointerId,
          clickSelection,
          block: !this.selectedComponents.size && this.selectedWires.size > 1,
        });
        this.element.setPointerCapture(event.pointerId);
      }
      this.render();
    } else {
      this.drag = {
        kind: "box",
        start: raw,
        end: raw,
        mode: this.selectionMode(event),
        components: new Set(this.selectedComponents),
        wires: new Set(this.selectedWires),
        pointerId: event.pointerId,
      };
      this.element.setPointerCapture(event.pointerId);
      this.render();
    }
  }

  private pointerMove(event: PointerEvent): void {
    const overlay = this.panPointer;
    if (overlay && overlay.pointerId === event.pointerId) {
      const current: Point = [event.clientX, event.clientY];
      if (!overlay.panning && !isRightButtonDrag(overlay.start, current)) return;
      overlay.panning = true;
      this.pan = panFromPointerDrag(overlay.origin, overlay.start, current);
      event.preventDefault();
      this.render();
      return;
    }
    const raw = this.toWorld(event.clientX, event.clientY);
    this.modifierShift = event.shiftKey;
    this.modifierCommand = event.metaKey || event.ctrlKey;
    this.pointerWorld = raw;
    const world = this.pointerSnap(raw, event);
    if (this.isComponentTool(this.tool) && !this.drag) {
      const part = partByType(this.tool);
      const placement = { id: "ghost", type: part.type, pos: world, rot: this.pendingRotation, mirror: this.pendingMirror } as CircuitComponent;
      this.ghostPoint = this.snappedComponentAnchor(raw, placement, event);
    }
    if (!this.drag && !this.wirePoints) {
      if (this.tool === "measure") this.updateHoveredMeasurementTarget(this.measurementTargetFromElement(event.target));
      const id = (event.target as Element).closest<SVGElement>("[data-wire-id]")?.dataset.wireId;
      if (id !== this.hoveredWire) {
        this.hoveredWire = id;
        this.options.onHoverWire?.(id);
      }
    }
    if (this.wirePoints) {
      const candidate = event.shiftKey ? undefined : this.findWireSnap(raw, { grid: !(event.metaKey || event.ctrlKey) });
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
    if (this.drag.kind === "component") {
      const drag = this.drag;
      const anchor = this.snappedDragAnchor(drag, raw, event);
      if (anchor) this.updateComponentDrag(drag, anchor);
      this.render();
      return;
    }
    if (this.drag.kind === "wire") {
      this.updateWireDrag(this.drag, raw, event);
      this.render();
      return;
    }
    this.drag.end = raw;
    this.render();
  }

  private pointerUp(event: PointerEvent): void {
    const overlay = this.panPointer;
    if (overlay && overlay.pointerId === event.pointerId) {
      const current: Point = [event.clientX, event.clientY];
      const panning = overlay.panning || isRightButtonDrag(overlay.start, current);
      if (panning) this.pan = panFromPointerDrag(overlay.origin, overlay.start, current);
      this.releasePointer(overlay.pointerId);
      this.panPointer = undefined;
      if (panning) {
        if (!samePoint(this.pan, overlay.origin)) {
          this.saveViewPreservingGesture();
          this.emit("view");
        }
        if (overlay.mode === "right") this.suppressContextMenuUntil = performance.now() + 500;
        event.preventDefault();
        this.render();
      } else if (overlay.mode === "right") {
        this.suppressContextMenuUntil = performance.now() + 500;
        event.preventDefault();
        this.openContextMenu(overlay.start[0], overlay.start[1], overlay.contextTarget ?? {});
      }
      return;
    }
    if (!this.drag) return;
    if ((this.drag.kind === "component" || this.drag.kind === "wire") && this.drag.keyboard) return;
    const drag = this.drag;
    const pointerId = drag.pointerId ?? event.pointerId;
    if (drag.kind === "component") {
      this.finishComponentDrag(drag);
      if (!drag.moved && drag.clickSelection) this.applyClickSelection(drag.clickSelection);
    } else if (drag.kind === "wire") {
      this.finishWireDrag(drag);
      if (!drag.moved && drag.clickSelection) this.applyClickSelection(drag.clickSelection);
      if (!drag.moved && this.selectedWires.has(drag.id)) this.options.onWireActivate?.(drag.id);
    } else if (drag.kind === "pot") {
      const id = drag.id;
      this.endGesture();
      this.options.onLiveGesture?.(false, id);
    } else if (drag.kind === "box") {
      const a = drag.start;
      const b = drag.end;
      const minX = Math.min(a[0], b[0]);
      const maxX = Math.max(a[0], b[0]);
      const minY = Math.min(a[1], b[1]);
      const maxY = Math.max(a[1], b[1]);
      const bounds = { minX, minY, maxX, maxY };
      const crossing = b[0] < a[0];
      const components = new Set(this.doc.components.filter((component) => crossing ? boundsIntersect(componentBounds(component), bounds) : boundsInside(componentBounds(component), bounds)).map((component) => component.id));
      const wires = new Set(this.doc.wires.filter((wire) => crossing ? wireCrossesBounds(wire.points, bounds) : wire.points.every((point) => pointInsideBounds(point, bounds))).map((wire) => wire.id));
      this.selectedComponents = new Set(drag.components);
      this.selectedWires = new Set(drag.wires);
      this.updateSelection(components, this.selectedComponents, drag.mode);
      this.updateSelection(wires, this.selectedWires, drag.mode);
      this.emitSelection();
    }
    this.drag = undefined;
    this.releasePointer(pointerId);
    this.render();
  }

  private makeComponentDrag(id: string, options: {
    keyboard?: boolean;
    preserveWires?: boolean;
    moveSelectedWires?: boolean;
    pointerId?: number;
    pointerPoint?: Point;
    clickSelection?: ClickSelection;
  } = {}): Extract<Drag, { kind: "component" }> {
    const preserveWires = options.preserveWires ?? true;
    const origins = new Map<string, Point>();
    for (const component of this.doc.components) if (this.selectedComponents.has(component.id)) origins.set(component.id, clonePoint(component.pos));
    const primaryOrigin = origins.get(id);
    const grabOffset: Point = primaryOrigin && options.pointerPoint
      ? [options.pointerPoint[0] - primaryOrigin[0], options.pointerPoint[1] - primaryOrigin[1]]
      : [0, 0];
    const selectedWireOrigins = new Map<string, Point[]>();
    if (options.moveSelectedWires ?? true) {
      for (const wire of this.doc.wires) if (this.selectedWires.has(wire.id)) selectedWireOrigins.set(wire.id, wire.points.map(clonePoint));
    }
    const selectedPins = new Map<string, PinReference>();
    const fixedPins = new Set<string>();
    for (const component of this.doc.components) {
      componentPinPoints(component).forEach((pin, pinIndex) => {
        if (this.selectedComponents.has(component.id)) selectedPins.set(pointKey(pin), { componentId: component.id, pinIndex });
        else fixedPins.add(pointKey(pin));
      });
    }
    const endpoints = new Map<string, Set<string>>();
    for (const wire of this.doc.wires) for (const point of [wire.points[0], wire.points.at(-1)]) {
      if (!point) continue;
      const owners = endpoints.get(pointKey(point)) ?? new Set<string>();
      owners.add(wire.id);
      endpoints.set(pointKey(point), owners);
    }
    const originalWires = new Map<string, Point[]>();
    const attachments = new Map<string, WireAttachment>();
    const provisionalWireIds = new Set<string>();
    if (preserveWires) for (const wire of this.doc.wires) {
      const pins = wire.points.flatMap((point, index) => {
        const reference = selectedPins.get(pointKey(point));
        return reference ? [{ index, reference }] : [];
      });
      if (!pins.length) continue;
      const attachedIndexes = new Set(pins.map((pin) => pin.index));
      const hasFixedVertex = wire.points.some((point, index) => !attachedIndexes.has(index) && (fixedPins.has(pointKey(point)) || [...(endpoints.get(pointKey(point)) ?? [])].some((owner) => owner !== wire.id)));
      originalWires.set(wire.id, wire.points.map(clonePoint));
      attachments.set(wire.id, { pins, hasFixedVertex });
    }
    if (preserveWires) {
      let wireIndex = idMax(this.doc.wires, "w");
      for (const bridge of implicitPinBridgePlans(this.doc, this.selectedComponents)) {
        const wireId = bridge.existingWireId ?? `w${++wireIndex}`;
        const original = bridge.existingWireId
          ? this.doc.wires.find((wire) => wire.id === bridge.existingWireId)?.points.map(clonePoint)
          : [clonePoint(bridge.point), clonePoint(bridge.point)];
        if (!original?.length) continue;
        originalWires.set(wireId, original);
        attachments.set(wireId, {
          pins: [{ index: original.length - 1, reference: bridge.reference }],
          hasFixedVertex: true,
        });
        selectedWireOrigins.delete(wireId);
        if (!bridge.existingWireId) provisionalWireIds.add(wireId);
      }
    }
    return {
      kind: "component",
      id,
      origins,
      originalWires,
      attachments,
      provisionalWireIds,
      selectedWireOrigins,
      grabOffset,
      moved: false,
      keyboard: options.keyboard ?? false,
      preserveWires,
      ...(options.pointerId === undefined ? {} : { pointerId: options.pointerId }),
      ...(options.clickSelection ? { clickSelection: options.clickSelection } : {}),
    };
  }

  private updateComponentDrag(drag: Extract<Drag, { kind: "component" }>, anchor: Point): void {
    const primaryOrigin = drag.origins.get(drag.id);
    if (!primaryOrigin) return;
    const delta: Point = [anchor[0] - primaryOrigin[0], anchor[1] - primaryOrigin[1]];
    for (const [id, origin] of drag.origins) {
      const component = this.doc.components.find((item) => item.id === id);
      if (component) component.pos = [origin[0] + delta[0], origin[1] + delta[1]];
    }
    for (const [wireId, original] of drag.selectedWireOrigins) {
      const wire = this.doc.wires.find((item) => item.id === wireId);
      if (wire) wire.points = translateWirePoints(original, delta);
    }
    if (drag.preserveWires) this.updateAttachedWires(drag);
    drag.moved = drag.moved || delta[0] !== 0 || delta[1] !== 0;
  }

  private updateAttachedWires(drag: Extract<Drag, { kind: "component" }>): void {
    const primaryOrigin = drag.origins.get(drag.id);
    const primary = this.doc.components.find((component) => component.id === drag.id);
    const blockDelta: Point = primaryOrigin && primary
      ? [primary.pos[0] - primaryOrigin[0], primary.pos[1] - primaryOrigin[1]]
      : [0, 0];
    for (const [wireId, attachment] of drag.attachments) {
      const original = drag.originalWires.get(wireId);
      if (!original) continue;
      const baseline = drag.selectedWireOrigins.has(wireId) ? translateWirePoints(original, blockDelta) : original;
      const movedVertices = new Map<number, Point>();
      for (const attached of attachment.pins) {
        const reference = attached.reference;
        const component = this.doc.components.find((item) => item.id === reference.componentId);
        const point = component && componentPinPoints(component)[reference.pinIndex];
        if (point) movedVertices.set(attached.index, clonePoint(point));
      }
      let wire = this.doc.wires.find((item) => item.id === wireId);
      const changed = [...movedVertices].some(([index, point]) => baseline[index] && !samePoint(point, baseline[index]!));
      if (!changed) {
        if (wire) wire.points = baseline.map(clonePoint);
        continue;
      }
      if (!wire && drag.provisionalWireIds.has(wireId)) {
        wire = { id: wireId, points: original.map(clonePoint) };
        this.doc.wires.push(wire);
      }
      if (!wire) continue;
      wire.points = rubberBandWire(baseline, movedVertices, !attachment.hasFixedVertex);
    }
  }

  private updatePotFromPointer(id: string, clientX: number, clientY: number): void {
    const component = this.doc.components.find((item) => item.id === id && item.type === "potentiometer");
    if (!component) return;
    const world = this.toWorld(clientX, clientY);
    const dx = world[0] - component.pos[0];
    const dy = world[1] - component.pos[1];
    const radians = -component.rot * Math.PI / 180;
    const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
    const [minimum, maximum] = EDITOR_SYMBOLS.potentiometer.wiperTravel ?? [-2, 2];
    const t = clamp((maximum - localY) / (maximum - minimum), 0.005, 0.995);
    this.editLive((document) => {
      const pot = document.components.find((item) => item.id === id);
      if (pot) pot.params = { ...(pot.params ?? {}), t };
    });
  }

  private beginWire(point: Point): void {
    this.wirePoints = [clonePoint(point)];
    this.wireCheckpoints = [[clonePoint(point)]];
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
    const next = compactWire([...this.wirePoints, ...orthogonalLeg(start, point, this.wireHorizontalFirst)]);
    if (next.length === this.wirePoints.length && samePoint(next.at(-1)!, this.wirePoints.at(-1)!)) { this.render(); return; }
    this.wirePoints = next;
    this.wireCheckpoints.push(next.map(clonePoint));
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
    this.wireCheckpoints = [];
    this.wirePreview = undefined;
    this.wireSnap = undefined;
    if (active) this.options.onMidWire?.(false);
  }

  private findNearestPin(raw: Point, excludedComponents = new Set<string>()): SnapCandidate | undefined {
    let nearest: SnapCandidate | undefined;
    const radius = SNAP_RADIUS_PX / (GRID * this.zoom);
    for (const component of this.doc.components) {
      if (excludedComponents.has(component.id)) continue;
      componentPinPoints(component).forEach((pin, pinIndex) => {
        const distance = Math.hypot(pin[0] - raw[0], pin[1] - raw[1]);
        if (distance <= radius && (!nearest || distance < nearest.distance)) nearest = { point: clonePoint(pin), kind: "pin", distance, componentId: component.id, pinIndex };
      });
    }
    return nearest;
  }

  private findWireEndpointSnap(raw: Point): SnapCandidate | undefined {
    const radius = SNAP_RADIUS_PX / (GRID * this.zoom);
    const endpoints = this.doc.wires.flatMap((wire) => [wire.points[0], wire.points.at(-1)].flatMap((point) => point ? [{ wire, point }] : []));
    return endpoints
      .map(({ wire, point }) => ({ point: clonePoint(point), kind: "vertex" as const, distance: Math.hypot(point[0] - raw[0], point[1] - raw[1]), wireId: wire.id }))
      .filter((candidate) => candidate.distance <= radius)
      .sort((left, right) => left.distance - right.distance)[0];
  }

  private findWireSnap(raw: Point, options: { excludedComponents?: Set<string>; excludedWires?: Set<string>; includePins?: boolean; grid?: boolean } = {}): SnapCandidate | undefined {
    const candidates: SnapCandidate[] = [];
    const pin = options.includePins === false ? undefined : this.findNearestPin(raw, options.excludedComponents);
    if (pin) candidates.push(pin);
    const radius = SNAP_RADIUS_PX / (GRID * this.zoom);
    for (const wire of this.doc.wires) {
      if (options.excludedWires?.has(wire.id)) continue;
      for (const vertex of wire.points) {
        const distance = Math.hypot(vertex[0] - raw[0], vertex[1] - raw[1]);
        if (distance <= radius) candidates.push({ point: clonePoint(vertex), kind: "vertex", distance, wireId: wire.id });
      }
      for (let index = 1; index < wire.points.length; index += 1) {
        const a = wire.points[index - 1]!;
        const b = wire.points[index]!;
        let candidate: Point | undefined;
        if (a[0] === b[0]) {
          const y = clamp(options.grid === false ? raw[1] : Math.round(raw[1]), Math.min(a[1], b[1]), Math.max(a[1], b[1]));
          if (y > Math.min(a[1], b[1]) && y < Math.max(a[1], b[1])) candidate = [a[0], y];
        } else if (a[1] === b[1]) {
          const x = clamp(options.grid === false ? raw[0] : Math.round(raw[0]), Math.min(a[0], b[0]), Math.max(a[0], b[0]));
          if (x > Math.min(a[0], b[0]) && x < Math.max(a[0], b[0])) candidate = [x, a[1]];
        }
        if (!candidate) continue;
        const distance = Math.hypot(candidate[0] - raw[0], candidate[1] - raw[1]);
        if (distance <= radius) candidates.push({ point: candidate, kind: "segment", distance, wireId: wire.id });
      }
    }
    const priority: Record<SnapCandidate["kind"], number> = { pin: 0, vertex: 1, segment: 2 };
    return candidates.sort((left, right) => priority[left.kind] - priority[right.kind] || left.distance - right.distance)[0];
  }

  private toWorld(x: number, y: number): Point {
    const rect = this.element.getBoundingClientRect();
    return [(x - rect.left - this.pan[0]) / GRID / this.zoom, (y - rect.top - this.pan[1]) / GRID / this.zoom];
  }
  private snap([x, y]: Point): Point { return [Math.round(x), Math.round(y)]; }
  private pointerSnap([x, y]: Point, event: Pick<MouseEvent, "metaKey" | "ctrlKey">): Point {
    return event.metaKey || event.ctrlKey ? [Number(x.toFixed(4)), Number(y.toFixed(4))] : this.snap([x, y]);
  }
  private snappedComponentAnchor(
    raw: Point,
    component: CircuitComponent,
    event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">,
    options: { excludedComponents?: Set<string>; excludedWires?: Set<string> } = {},
  ): Point {
    const anchor = this.pointerSnap(raw, event);
    this.objectSnap = undefined;
    if (event.shiftKey) return anchor;
    const probe = { ...component, pos: raw };
    const candidates = componentPinPoints(probe).flatMap((pin) => {
      const candidate = this.findWireSnap(pin, {
        ...(options.excludedComponents ? { excludedComponents: options.excludedComponents } : {}),
        ...(options.excludedWires ? { excludedWires: options.excludedWires } : {}),
        grid: !(event.metaKey || event.ctrlKey),
      });
      return candidate ? [{ candidate, pin }] : [];
    });
    const priority: Record<SnapCandidate["kind"], number> = { pin: 0, vertex: 1, segment: 2 };
    const best = candidates.sort((left, right) => priority[left.candidate.kind] - priority[right.candidate.kind] || left.candidate.distance - right.candidate.distance)[0];
    if (!best) return anchor;
    this.objectSnap = best.candidate;
    return [
      Number((raw[0] + best.candidate.point[0] - best.pin[0]).toFixed(4)),
      Number((raw[1] + best.candidate.point[1] - best.pin[1]).toFixed(4)),
    ];
  }
  private canvasCenter(): Point {
    const rect = this.element.getBoundingClientRect();
    return this.snap(this.toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2));
  }
  private isComponentTool(tool: EditorTool): tool is ComponentType { return tool !== "select" && tool !== "wire" && tool !== "measure"; }
  private saveView(): void { this.doc.view = { pan: [...this.pan], zoom: this.zoom }; }
  private saveViewPreservingGesture(): void {
    this.saveView();
    if (!this.gestureSnapshot) return;
    const baseline = deserializeCircuit(this.gestureSnapshot);
    baseline.view = { pan: [...this.pan], zoom: this.zoom };
    this.gestureSnapshot = canonicalizeCircuit(baseline);
  }
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

  private updatePointerFeedback(): void {
    let interaction = "select";
    let cursor = "default";
    if (this.panPointer?.panning) { interaction = "panning"; cursor = "grabbing"; }
    else if (this.drag?.kind === "component") { interaction = this.drag.keyboard ? (this.drag.preserveWires ? "drag" : "move") : "drag"; cursor = "grabbing"; }
    else if (this.drag?.kind === "wire") {
      interaction = this.drag.block ? "wire-block-move" : "wire-reroute";
      cursor = this.drag.block ? "grabbing" : "move";
    }
    else if (this.drag?.kind === "box") { interaction = this.drag.end[0] < this.drag.start[0] ? "crossing-select" : "contain-select"; cursor = "crosshair"; }
    else if (this.drag?.kind === "pot") { interaction = "adjust"; cursor = "ns-resize"; }
    else if (this.wirePoints) { interaction = "wire-active"; cursor = "crosshair"; }
    else if (this.tool === "wire") { interaction = "wire-ready"; cursor = "crosshair"; }
    else if (this.tool === "measure") { interaction = "measure"; cursor = "crosshair"; }
    else if (this.isComponentTool(this.tool)) { interaction = "place"; cursor = "copy"; }
    if (this.space && !this.panPointer?.panning) cursor = "grab";
    this.element.dataset.interaction = interaction;
    this.element.dataset.bend = this.wireHorizontalFirst ? "horizontal-first" : "vertical-first";
    const snap = this.wireSnap ?? this.objectSnap;
    if (snap) this.element.dataset.snap = snap.kind;
    else delete this.element.dataset.snap;
    this.element.style.cursor = cursor;
  }

  private render(): void {
    const wirePointKeys = new Set(this.doc.wires.flatMap((wire) => wire.points.map(pointKey)));
    const pinCounts = new Map<string, number>();
    const pins = this.doc.components.flatMap((component) => componentPinPoints(component).map((point, pinIndex) => ({ component, point, pinIndex })));
    for (const pin of pins) pinCounts.set(pointKey(pin.point), (pinCounts.get(pointKey(pin.point)) ?? 0) + 1);
    const virtualBindings = new Map<string, string[]>();
    const validPinKeys = new Set(pins.map((pin) => `${pin.component.id}:${pin.pinIndex}`));
    for (const binding of this.options.virtualConnections?.(this.doc) ?? []) {
      const key = `${binding.componentId}:${binding.pinIndex}`;
      if (!validPinKeys.has(key) || !binding.role.trim()) continue;
      virtualBindings.set(key, [...(virtualBindings.get(key) ?? []), binding.role.toUpperCase()]);
    }

    let preview: Point[] = [];
    if (this.wirePoints?.length) {
      preview = this.wirePoints.map(clonePoint);
      if (this.wirePreview) preview = compactWire([...preview, ...orthogonalLeg(preview.at(-1)!, this.wirePreview, this.wireHorizontalFirst)]);
    }
    const selection = this.drag?.kind === "box"
      ? `<rect class="selection-box ${this.drag.end[0] < this.drag.start[0] ? "crossing" : "contain"}" data-selection-direction="${this.drag.end[0] < this.drag.start[0] ? "crossing" : "contain"}" x="${Math.min(this.drag.start[0], this.drag.end[0])}" y="${Math.min(this.drag.start[1], this.drag.end[1])}" width="${Math.abs(this.drag.start[0] - this.drag.end[0])}" height="${Math.abs(this.drag.start[1] - this.drag.end[1])}"/>`
      : "";
    const screenScale = GRID * this.zoom;
    const labelSize = (11 / screenScale).toFixed(4);
    const labelKnockout = (3 / screenScale).toFixed(4);
    const junctionRadius = (3.5 / (GRID * this.zoom)).toFixed(4);
    const pinRadius = (3 / (GRID * this.zoom)).toFixed(4);
    const pinHitRadius = (PIN_HIT_RADIUS_PX / screenScale).toFixed(4);
    const potHitRadius = (POT_HIT_RADIUS_PX / screenScale).toFixed(4);
    const snapRadius = (5 / (GRID * this.zoom)).toFixed(4);

    const renderedComponents = this.doc.components.map((component) => {
      const [minX, minY, maxX, maxY] = componentBbox(component);
      const hitX = minX - 0.5;
      const hitY = minY - 0.5;
      const hitWidth = maxX - minX + 1;
      const hitHeight = maxY - minY + 1;
      const layout = propertyLayout(component, screenScale);
      const refdes = component.type === "ground" || !component.label?.text ? "" : `<text data-label-component-id="${component.id}" data-property="reference" class="editor-label" style="font-size:${labelSize}px;stroke-width:${labelKnockout}px" x="${layout.refdes.point[0]}" y="${layout.refdes.point[1]}" text-anchor="${layout.refdes.anchor}" dominant-baseline="middle">${esc(component.label.text)}</text>`;
      let value = "";
      if (component.value !== undefined && component.type !== "ground" && component.type !== "switch_spst" && !(component.type === "opamp_ideal" && component.value === undefined)) {
        const display = typeof component.value === "number" ? formatEngineeringValue(component.value) : component.value;
        value = `<text data-label-component-id="${component.id}" data-property="value" class="editor-label editor-value" style="font-size:${labelSize}px;stroke-width:${labelKnockout}px" x="${layout.value.point[0]}" y="${layout.value.point[1]}" text-anchor="${layout.value.anchor}" dominant-baseline="middle">${esc(display)}</text>`;
      }
      return {
        symbol: `<g data-component-id="${component.id}" data-measure-target-kind="component" data-measure-target-id="${esc(component.id)}" data-anchor-x="${component.pos[0]}" data-anchor-y="${component.pos[1]}" data-rotation="${component.rot}" data-mirror="${component.mirror}" class="editor-component${this.selectedComponents.has(component.id) ? " selected" : ""}" transform="${transform(component)}"><rect class="editor-component-hit" x="${hitX}" y="${hitY}" width="${hitWidth}" height="${hitHeight}"/>${component.type === "led" ? `<circle data-led-halo="${component.id}" class="editor-led-halo" cx="0" cy="0" r="3" fill="url(#editor-led)" opacity="0"/>` : ""}<g class="editor-symbol">${renderedSymbol(component)}</g><rect class="editor-selection" x="${hitX}" y="${hitY}" width="${hitWidth}" height="${hitHeight}"/></g>`,
        properties: `${refdes}${value}`,
      };
    });
    const components = renderedComponents.map((component) => component.symbol).join("");
    const properties = renderedComponents.map((component) => component.properties).join("");
    const potHits = this.doc.components
      .filter((component) => component.type === "potentiometer")
      .map((component) => ({ component, point: componentPoint(component, potentiometerWiperLocalPoint(component)) }))
      .map(({ component, point }) => `<circle class="pot-hit" data-pot-hit="${esc(component.id)}" data-testid="pot-wiper" cx="${point[0]}" cy="${point[1]}" r="${potHitRadius}" style="fill:transparent;stroke:none!important;pointer-events:all"/>`)
      .join("");
    const pinHits = pins
      .map((pin) => `<circle class="editor-pin-hit" data-pin-hit="true" data-pin-component="${esc(pin.component.id)}" data-pin-index="${pin.pinIndex}" data-measure-target-kind="pin" data-measure-target-id="${esc(pin.component.id)}:${pin.pinIndex}" cx="${pin.point[0]}" cy="${pin.point[1]}" r="${pinHitRadius}" style="fill:transparent;stroke:none;pointer-events:all"/>`)
      .join("");

    let ghost = "";
    if (this.isComponentTool(this.tool) && this.ghostPoint) {
      const component = { id: "ghost", type: this.tool, pos: this.ghostPoint, rot: this.pendingRotation, mirror: this.pendingMirror } as CircuitComponent;
      ghost = `<g class="placement-ghost" data-anchor-x="${this.ghostPoint[0]}" data-anchor-y="${this.ghostPoint[1]}" data-rotation="${component.rot}" data-mirror="${component.mirror}" transform="${transform(component)}"><g class="editor-symbol">${renderedSymbol(component, false)}</g></g>`;
    }

    const openPins = pins
      .filter((pin) => !virtualBindings.has(`${pin.component.id}:${pin.pinIndex}`) && !wirePointKeys.has(pointKey(pin.point)) && (pinCounts.get(pointKey(pin.point)) ?? 0) < 2)
      .map((pin) => `<circle class="pin-open" data-pin-component="${pin.component.id}" data-pin-index="${pin.pinIndex}" cx="${pin.point[0]}" cy="${pin.point[1]}" r="${pinRadius}" pointer-events="none"/>`)
      .join("");
    const virtualCueSize = 4 / screenScale;
    const virtualCues = pins
      .flatMap((pin) => (virtualBindings.get(`${pin.component.id}:${pin.pinIndex}`) ?? []).map((role) => ({ pin, role })))
      .map(({ pin, role }) => `<g class="virtual-connection-cue" data-virtual-component="${pin.component.id}" data-virtual-pin="${pin.pinIndex}" data-virtual-role="${esc(role)}" pointer-events="none"><path d="M${pin.point[0]} ${pin.point[1] - virtualCueSize}L${pin.point[0] + virtualCueSize} ${pin.point[1]}L${pin.point[0]} ${pin.point[1] + virtualCueSize}L${pin.point[0] - virtualCueSize} ${pin.point[1]}Z" style="fill:var(--vellum);stroke:var(--rail-amber);stroke-width:1.2;vector-effect:non-scaling-stroke"/><text class="editor-label" x="${pin.point[0] + virtualCueSize * 1.8}" y="${pin.point[1]}" dominant-baseline="middle" style="font-size:${(8 / screenScale).toFixed(4)}px;stroke-width:${labelKnockout}px">${esc(role)}</text></g>`)
      .join("");
    const junctions = junctionPoints(this.doc.wires)
      .map(([x, y]) => `<circle class="connection-node junction" cx="${x}" cy="${y}" r="${junctionRadius}"/>`)
      .join("");
    const snap = this.wireSnap ?? this.objectSnap;
    const snapIndicator = snap ? `<circle class="snap-indicator snap-${snap.kind}" data-snap-kind="${snap.kind}" cx="${snap.point[0]}" cy="${snap.point[1]}" r="${snapRadius}"/>` : "";

    this.element.innerHTML = `<defs><pattern id="editor-grid" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx=".08" cy=".08" r=".035" class="grid-dot"/></pattern><radialGradient id="editor-led"><stop offset="0" stop-color="#BE7318" stop-opacity=".62"/><stop offset="1" stop-color="#BE7318" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" class="editor-bg"/><g class="editor-world" transform="translate(${this.pan[0]} ${this.pan[1]}) scale(${GRID * this.zoom})"><rect x="${-this.pan[0] / GRID / this.zoom}" y="${-this.pan[1] / GRID / this.zoom}" width="${this.host.clientWidth / GRID / this.zoom}" height="${this.host.clientHeight / GRID / this.zoom}" fill="url(#editor-grid)"/>${this.doc.wires.map((wire) => `<g data-wire-id="${wire.id}" data-measure-target-kind="wire" data-measure-target-id="${esc(wire.id)}" class="editor-wire-group${this.selectedWires.has(wire.id) ? " selected" : ""}"><path data-wire-id="${wire.id}" class="editor-wire" d="${path(wire.points)}"/><path data-wire-id="${wire.id}" class="editor-hit" d="${path(wire.points)}"/></g>`).join("")}<g id="chevron-layer" class="chevron-layer"></g>${preview.length >= 2 ? `<path class="wire-preview" data-bend="${this.wireHorizontalFirst ? "horizontal-first" : "vertical-first"}" data-checkpoints="${this.wireCheckpoints.length}" data-committed="${path(this.wirePoints ?? [])}" d="${path(preview)}"/>` : ""}${components}${properties}${potHits}${pinHits}${openPins}${virtualCues}${junctions}${ghost}${snapIndicator}${selection}</g>`;
    for (const [id, style] of this.wireStyles) this.applyWireStyle(id, style);
    this.applyStaticEncoding();
    this.updatePointerFeedback();
  }
}
