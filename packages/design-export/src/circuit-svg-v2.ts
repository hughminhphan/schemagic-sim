import {
  componentPinPointsV2,
  type CircuitComponentV2,
  type CircuitGraphV2,
  type DesignBlockDefinition,
  type Point,
  type SimulationScenarioV2,
} from "@opencircuit/circuit-schema";
import {
  canonicalDesignV2Payload,
  parseDesignResultV2,
  type CandidateIdV2,
  type DesignCandidateV2,
  type DesignResultV2,
  type DesignValidationIssue,
  type SimulationCoverageV2,
} from "@opencircuit/design-schema";
import {
  validateDesignResultEngineeringContextV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-export-runtime";

export type CandidateCircuitSvgExportErrorCodeV2 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "candidate_not_found"
  | "circuit_not_found"
  | "render_failed"
  | "invalid_svg"
  | "artifact_unverified";

export class CandidateCircuitSvgExportErrorV2 extends Error {
  readonly code: CandidateCircuitSvgExportErrorCodeV2;
  readonly issues: readonly DesignValidationIssue[];

  constructor(
    code: CandidateCircuitSvgExportErrorCodeV2,
    issues: readonly DesignValidationIssue[] = [],
  ) {
    super("scheMAGIC structural SVG export was rejected");
    this.name = "CandidateCircuitSvgExportErrorV2";
    this.code = code;
    this.issues = Object.freeze([...issues]);
  }
}

export interface CandidateCircuitSvgScenarioV2 {
  scenario: SimulationScenarioV2;
  coverage: SimulationCoverageV2;
}

export interface CandidateCircuitSvgMetadataV2 {
  format: "schemagic-circuit-svg-metadata";
  schemaVersion: 2;
  artifactKind: "structural_schematic";
  simulationDataState: "not_included";
  designResultRef: {
    contentHash: DesignResultV2["contentHash"];
    requestHash: DesignResultV2["requestHash"];
    libraryVersion: string;
    libraryContentHash: DesignResultV2["libraryContentHash"];
  };
  candidateRef: {
    id: CandidateIdV2;
    recipeId: string;
  };
  circuit: CircuitGraphV2;
  designBlocks: DesignBlockDefinition[];
  scenarios: CandidateCircuitSvgScenarioV2[];
  candidateWarnings: string[];
}

const SVG_METADATA_OPEN = '<metadata id="schemagic-circuit-metadata-v2">';
const SVG_METADATA_CLOSE = "</metadata>";
const CUSTOMIZED_TARGET_METADATA_ID = "schemagic-primary-part-customized-artifact-metadata-v1";
const PRODUCTION_CONSTRAINT_OBSERVATION_METADATA_ID = "schemagic-production-constraint-observation-artifact-metadata-v1";
const MAX_SVG_BYTES = 16 * 1024 * 1024;
const GRID = 24;
const PADDING = 5;
const MAX_RENDER_SPAN = 1_000_000;
const HEADER_SIDE_PADDING = 32;
const HEADER_MINIMUM_WIDTH = 760;
const WORLD_TEXT_CHARACTERS = 28;
const WORLD_TEXT_CHARACTER_WIDTH = .5;
const WORLD_TEXT_WIDTH = WORLD_TEXT_CHARACTERS * WORLD_TEXT_CHARACTER_WIDTH;
const WORLD_TEXT_LINE_HEIGHT = .72;
const WORLD_TEXT_COLLISION_GAP = .5;
const WORLD_TEXT_PLACEMENT_STEP = .5;

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError("SVG coordinates must be finite");
  return JSON.stringify(Object.is(value, -0) ? 0 : value);
}

function xmlText(value: string): string {
  return value.replace(/[&<>]/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  })[character]!);
}

function xmlAttribute(value: string): string {
  return xmlText(value).replace(/["']/gu, (character) => character === '"' ? "&quot;" : "&apos;");
}

function displayString(value: string): string {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError("SVG text must be serializable");
  return json.slice(1, -1);
}

function displayText(value: string): string {
  return xmlText(displayString(value));
}

function wrapCharacters(value: string, maximumCharacters: number): string[] {
  if (!Number.isSafeInteger(maximumCharacters) || maximumCharacters <= 0) {
    throw new TypeError("SVG wrap width must be a positive integer");
  }
  const characters = Array.from(value);
  if (characters.length === 0) return [""];
  const lines: string[] = [];
  for (let index = 0; index < characters.length; index += maximumCharacters) {
    lines.push(characters.slice(index, index + maximumCharacters).join(""));
  }
  return lines;
}

function wrappedDisplay(value: string, maximumCharacters: number): string[] {
  return wrapCharacters(displayString(value), maximumCharacters);
}

function fittedText(
  className: string,
  attributes: string,
  x: number,
  y: number,
  line: string,
  maximumWidth: number,
  characterWidth: number,
): string {
  if (line.length === 0) {
    return `<text class="${className}"${attributes} x="${numberText(x)}" y="${numberText(y)}"></text>`;
  }
  const renderedWidth = Math.min(
    maximumWidth,
    Math.max(characterWidth, Array.from(line).length * characterWidth),
  );
  return `<text class="${className}"${attributes} x="${numberText(x)}" y="${numberText(y)}" textLength="${numberText(renderedWidth)}" lengthAdjust="spacingAndGlyphs">${xmlText(line)}</text>`;
}

function decodeXmlText(value: string): string {
  if (/&(?!amp;|lt;|gt;|quot;|apos;)/u.test(value)) throw new TypeError("SVG metadata has an unsupported entity");
  return value.replace(/&(amp|lt|gt|quot|apos);/gu, (_match, entity: string) => ({
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  })[entity]!);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function referencedBlocks(
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV2>,
): DesignBlockDefinition[] {
  const refs = new Set(circuit.components.flatMap((component) => component.type === "design_block"
    ? [`${component.block.id}\u0000${component.block.version}\u0000${component.block.contentHash}`]
    : []));
  return candidate.circuit.designBlocks
    .filter((block) => refs.has(`${block.id}\u0000${block.version}\u0000${block.contentHash}`))
    .map((block) => structuredClone(block));
}

function scenariosForCircuit(
  candidate: Readonly<DesignCandidateV2>,
  circuitId: string,
): CandidateCircuitSvgScenarioV2[] {
  const coverageById = new Map(candidate.simulationCoverage.map((coverage) => [coverage.scenarioId, coverage]));
  return candidate.circuit.scenarios
    .filter((scenario) => scenario.circuitId === circuitId)
    .map((scenario) => {
      const coverage = coverageById.get(scenario.id);
      if (coverage === undefined) throw new TypeError("Persisted circuit scenario has no coverage record");
      return { scenario: structuredClone(scenario), coverage: structuredClone(coverage) };
    })
    .sort((left, right) => compareText(left.scenario.id, right.scenario.id));
}

function metadataFor(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV2>,
): CandidateCircuitSvgMetadataV2 {
  return {
    format: "schemagic-circuit-svg-metadata",
    schemaVersion: 2,
    artifactKind: "structural_schematic",
    simulationDataState: "not_included",
    designResultRef: {
      contentHash: result.contentHash,
      requestHash: result.requestHash,
      libraryVersion: result.libraryVersion,
      libraryContentHash: result.libraryContentHash,
    },
    candidateRef: { id: candidate.id, recipeId: candidate.recipeId },
    circuit: structuredClone(circuit),
    designBlocks: referencedBlocks(candidate, circuit),
    scenarios: scenariosForCircuit(candidate, circuit.id),
    candidateWarnings: [...candidate.warnings],
  };
}

function valueLabel(component: CircuitComponentV2): string | undefined {
  if ("value" in component && component.value !== undefined) return String(component.value);
  return component.mpn;
}

function symbol(component: CircuitComponentV2, blocks: readonly DesignBlockDefinition[]): string {
  switch (component.type) {
    case "resistor": return '<path d="M-2 0h.45l.35-.7.7 1.4.7-1.4.7 1.4.65-.7H2"/>';
    case "capacitor": return '<path d="M-2 0h1.55m0-1.2v2.4m.9-2.4v2.4M.45 0H2"/>';
    case "inductor": return '<path d="M-2 0h.35c0-1 1-1 1 0s1 1 1 0 1-1 1 0 1 1 1 0H2"/>';
    case "vsource":
    case "vsource_pulse":
    case "vsource_sine": return '<circle cx="0" cy="0" r="1.25"/><path d="M0-2v.75M0 1.25V2M-.45-.45h.9M0-.9v.9M-.45.55h.9"/>';
    case "isource":
    case "isource_pulse": return '<circle cx="0" cy="0" r="1.25"/><path d="M0-2v.75M0 1.25V2M0 .75V-.65m-.45.45L0-.7l.45.5"/>';
    case "ground": return '<path d="M0 0v.55M-1 .55H1M-.65 1h1.3M-.3 1.45h.6"/>';
    case "switch_spst": return `<path d="M-2 0h.7m2.6 0H2M-1.3 0L1.1 ${component.params.closed ? 0 : -1.1}"/><circle cx="-1.3" cy="0" r=".12"/><circle cx="1.3" cy="0" r=".12"/>`;
    case "potentiometer": return '<path d="M0-6v3.2l-.7.35 1.4.7-1.4.7 1.4.7-.7.35V6M4 0H.8"/>';
    case "diode":
    case "led": return `<path d="M0-2v.75M0 1.25V2M-1.15-1.25h2.3L0 1.25Zm-1.15 2.5h2.3${component.type === "led" ? "M.8-1.2l1-.8m-.45 1.35 1-.8" : ""}"/>`;
    case "bjt_npn":
    case "bjt_pnp": return `<path d="M-2 0h.8m0-1.6v3.2m0-1.05L2-4m-3.2 3.45L2 4M1.1 2.7l.9 1.3-1.5-.35${component.type === "bjt_pnp" ? "M1.55-3.65L.3-3.1l.85.85" : ""}"/>`;
    case "nmos":
    case "pmos": return `<path d="M-2 0h.8m.3-1.8v3.6m.5-3.2v3.2M-.4-1.25H2V-4M-.4 1.25H2V4${component.type === "pmos" ? "M-1.2 0a.35.35 0 1 0 .01 0" : ""}"/>`;
    case "opamp_ideal": return '<path d="M-4-2h1M-4 2h1M4 0H3M-3-3L3 0-3 3Zm.7.7v.6m-.3-.3h.6m0 3h.6"/>';
    case "design_block": {
      const definition = blocks.find((block) => block.id === component.block.id
        && block.version === component.block.version
        && block.contentHash === component.block.contentHash);
      if (definition === undefined) throw new TypeError("SVG design block reference is unresolved");
      const xs = definition.pins.map((pin) => Math.abs(pin.offset[0]));
      const ys = definition.pins.map((pin) => Math.abs(pin.offset[1]));
      const halfWidth = Math.max(2, ...xs) + 1;
      const halfHeight = Math.max(1.5, ...ys) + 1;
      return `<rect x="${numberText(-halfWidth)}" y="${numberText(-halfHeight)}" width="${numberText(halfWidth * 2)}" height="${numberText(halfHeight * 2)}" rx=".25"/>${fittedText("block-title", "", 0, .2, displayString(definition.title), halfWidth * 2 - .5, .5)}`;
    }
  }
}

function componentLabelPoint(component: Readonly<CircuitComponentV2>): Point {
  return component.label === undefined
    ? [component.pos[0], component.pos[1] - 3]
    : [
        component.pos[0] + component.label.offset[0],
        component.pos[1] + component.label.offset[1],
      ];
}

type ComponentTextLine = {
  kind: "label" | "value";
  className: "component-label" | "component-value";
  text: string;
};

function componentTextLines(component: Readonly<CircuitComponentV2>): ComponentTextLine[] {
  const label = component.label?.text ?? component.id;
  const lines: ComponentTextLine[] = wrappedDisplay(label, WORLD_TEXT_CHARACTERS)
    .map((text) => ({ kind: "label" as const, className: "component-label" as const, text }));
  const value = valueLabel(component);
  if (value !== undefined) {
    lines.push(...wrappedDisplay(value, WORLD_TEXT_CHARACTERS)
      .map((text) => ({ kind: "value" as const, className: "component-value" as const, text })));
  }
  return lines;
}

type ComponentTextLayout = {
  point: Point;
  lines: ComponentTextLine[];
  bounds: { left: number; right: number; top: number; bottom: number };
};

function componentTextBounds(point: Point, lines: readonly ComponentTextLine[]): ComponentTextLayout["bounds"] {
  const width = Math.max(...lines.map((line) => Math.min(
    WORLD_TEXT_WIDTH,
    Math.max(WORLD_TEXT_CHARACTER_WIDTH, Array.from(line.text).length * WORLD_TEXT_CHARACTER_WIDTH),
  )));
  return {
    left: point[0] - width / 2,
    right: point[0] + width / 2,
    top: point[1] - (lines[0]?.className === "component-value" ? .48 : .62),
    bottom: point[1] + (lines.length - 1) * WORLD_TEXT_LINE_HEIGHT + .12,
  };
}

function boundsOverlap(
  left: ComponentTextLayout["bounds"],
  right: ComponentTextLayout["bounds"],
  gap = 0,
): boolean {
  return left.left < right.right + gap
    && left.right > right.left - gap
    && left.top < right.bottom + gap
    && left.bottom > right.top - gap;
}

function segmentIntersectsBounds(start: Point, end: Point, source: ComponentTextLayout["bounds"]): boolean {
  const margin = .1;
  const bounds = {
    left: source.left - margin,
    right: source.right + margin,
    top: source.top - margin,
    bottom: source.bottom + margin,
  };
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  let minimum = 0;
  let maximum = 1;
  for (const [direction, distance] of [
    [-deltaX, start[0] - bounds.left],
    [deltaX, bounds.right - start[0]],
    [-deltaY, start[1] - bounds.top],
    [deltaY, bounds.bottom - start[1]],
  ] as const) {
    if (direction === 0) {
      if (distance < 0) return false;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) minimum = Math.max(minimum, ratio);
    else maximum = Math.min(maximum, ratio);
    if (minimum > maximum) return false;
  }
  return true;
}

function componentRenderBounds(
  component: Readonly<CircuitComponentV2>,
  blocks: readonly DesignBlockDefinition[],
): ComponentTextLayout["bounds"] {
  const points = [component.pos, ...componentPinPointsV2(component, blocks)];
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const symbolMargin = 1.5;
  return {
    left: Math.min(...xs) - symbolMargin,
    right: Math.max(...xs) + symbolMargin,
    top: Math.min(...ys) - symbolMargin,
    bottom: Math.max(...ys) + symbolMargin,
  };
}

function componentTextLayouts(metadata: Readonly<CandidateCircuitSvgMetadataV2>): Map<string, ComponentTextLayout> {
  const layouts = new Map<string, ComponentTextLayout>();
  const placed: ComponentTextLayout["bounds"][] = [];
  const components = [...metadata.circuit.components].sort((left, right) => (
    left.pos[0] - right.pos[0]
    || left.pos[1] - right.pos[1]
    || compareText(left.id, right.id)
  ));
  const componentBounds = components.map((component) => componentRenderBounds(component, metadata.designBlocks));
  const wireSegments = metadata.circuit.wires.flatMap((wire) => wire.points.slice(1).map((point, index) => (
    [wire.points[index]!, point] as const
  )));
  const placementIsClear = (bounds: ComponentTextLayout["bounds"]) => (
    placed.every((other) => !boundsOverlap(bounds, other, WORLD_TEXT_COLLISION_GAP))
    && componentBounds.every((other) => !boundsOverlap(bounds, other, .15))
    && wireSegments.every(([start, end]) => !segmentIntersectsBounds(start, end, bounds))
  );
  for (const [componentIndex, component] of components.entries()) {
    const lines = componentTextLines(component);
    let point = componentLabelPoint(component);
    let bounds = componentTextBounds(point, lines);
    const intersectsWire = wireSegments.some(([start, end]) => segmentIntersectsBounds(start, end, bounds));
    const intersectsPlacedText = placed.some((other) => boundsOverlap(bounds, other, WORLD_TEXT_COLLISION_GAP));
    if (component.label === undefined && (intersectsWire || intersectsPlacedText)) {
      const width = bounds.right - bounds.left;
      const geometry = componentBounds[componentIndex]!;
      const sideOrder = componentIndex % 2 === 0 ? [-1, 1] : [1, -1];
      let resolved = false;
      for (let level = 0; level < 64 && !resolved; level += 1) {
        for (const side of sideOrder) {
          const candidatePoint: Point = [
            side < 0
              ? geometry.left - WORLD_TEXT_COLLISION_GAP - width / 2
              : geometry.right + WORLD_TEXT_COLLISION_GAP + width / 2,
            point[1] - level * WORLD_TEXT_PLACEMENT_STEP,
          ];
          const candidateBounds = componentTextBounds(candidatePoint, lines);
          if (!placementIsClear(candidateBounds)) continue;
          point = candidatePoint;
          bounds = candidateBounds;
          resolved = true;
          break;
        }
      }
    }
    const layout = { point, lines, bounds };
    layouts.set(component.id, layout);
    placed.push(bounds);
  }
  return layouts;
}

function allGeometryPoints(metadata: Readonly<CandidateCircuitSvgMetadataV2>): Point[] {
  const points: Point[] = [
    ...metadata.circuit.components.map((component) => component.pos),
    ...metadata.circuit.wires.flatMap((wire) => wire.points),
  ];
  const textLayouts = componentTextLayouts(metadata);
  for (const component of metadata.circuit.components) {
    points.push(...componentPinPointsV2(component, metadata.designBlocks));
    const layout = textLayouts.get(component.id);
    if (layout === undefined) throw new TypeError("SVG component text layout is unresolved");
    points.push(
      [layout.bounds.left, layout.bounds.top],
      [layout.bounds.right, layout.bounds.bottom],
    );
  }
  return points.length > 0 ? points : [[0, 0]];
}

function boundsFor(metadata: Readonly<CandidateCircuitSvgMetadataV2>): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const points = allGeometryPoints(metadata);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs) - PADDING;
  const maxX = Math.max(...xs) + PADDING;
  const minY = Math.min(...ys) - PADDING;
  const maxY = Math.max(...ys) + PADDING;
  const width = maxX - minX;
  const height = maxY - minY;
  if (![minX, minY, width, height].every(Number.isFinite)
    || width <= 0 || height <= 0 || width > MAX_RENDER_SPAN || height > MAX_RENDER_SPAN) {
    throw new TypeError("SVG circuit geometry exceeds the deterministic render envelope");
  }
  return { minX, minY, width, height };
}

function coverageLines(metadata: Readonly<CandidateCircuitSvgMetadataV2>): string[] {
  if (metadata.scenarios.length === 0) {
    return ["Simulation: no authored scenario for this circuit; no simulation results are included."];
  }
  const lines: string[] = [];
  for (const { scenario, coverage } of metadata.scenarios) {
    lines.push(`Scenario ${scenario.id}: ${scenario.config.mode}; coverage ${coverage.modelTier}; no simulation results included.`);
    for (const limitation of coverage.limitations) lines.push(`Limitation: ${limitation}`);
  }
  return lines;
}

function probeLines(metadata: Readonly<CandidateCircuitSvgMetadataV2>): string[] {
  return [...metadata.circuit.probes]
    .sort((left, right) => compareText(left.id, right.id))
    .map((probe) => {
      const point = probePoint(metadata, probe.target);
      const presentation = point !== undefined
        ? "visual marker included"
        : probe.target.node !== undefined
          ? "text only; node target has no persisted coordinate"
          : "text only; target coordinate is unresolved";
      return `Probe ${probe.id}: ${probe.kind}; target ${canonicalDesignV2Payload(probe.target)}; ${presentation}.`;
    });
}

function wireMarkup(circuit: Readonly<CircuitGraphV2>): string {
  return [...circuit.wires]
    .sort((left, right) => compareText(left.id, right.id))
    .map((wire) => `<polyline class="wire" data-wire-id="${xmlAttribute(wire.id)}" points="${wire.points.map((point) => `${numberText(point[0])},${numberText(point[1])}`).join(" ")}"/>`)
    .join("");
}

function componentMarkup(metadata: Readonly<CandidateCircuitSvgMetadataV2>): string {
  const textLayouts = componentTextLayouts(metadata);
  return [...metadata.circuit.components]
    .sort((left, right) => compareText(left.id, right.id))
    .map((component) => {
      const transform = `translate(${numberText(component.pos[0])} ${numberText(component.pos[1])}) rotate(${component.rot}) scale(${component.mirror ? -1 : 1} 1)`;
      const layout = textLayouts.get(component.id);
      if (layout === undefined) throw new TypeError("SVG component text layout is unresolved");
      const text = layout.lines
        .map((line, index) => fittedText(
          line.className,
          ` data-component-text="${line.kind}" data-line-index="${index}" data-component-id="${xmlAttribute(component.id)}"`,
          layout.point[0],
          layout.point[1] + index * WORLD_TEXT_LINE_HEIGHT,
          line.text,
          WORLD_TEXT_WIDTH,
          WORLD_TEXT_CHARACTER_WIDTH,
        ))
        .join("");
      const pins = componentPinPointsV2(component, metadata.designBlocks)
        .map((point, index) => `<circle class="pin" data-pin-index="${index}" cx="${numberText(point[0])}" cy="${numberText(point[1])}" r=".13"/>`)
        .join("");
      return `<g data-component-id="${xmlAttribute(component.id)}" data-component-type="${xmlAttribute(component.type)}"><g class="symbol" transform="${transform}">${symbol(component, metadata.designBlocks)}</g>${pins}${text}</g>`;
    })
    .join("");
}

function pointAtPolylineMiddle(points: readonly Point[]): Point | undefined {
  if (points.length === 0) return undefined;
  const lengths = points.slice(1).map((point, index) => Math.hypot(
    point[0] - points[index]![0],
    point[1] - points[index]![1],
  ));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (const [index, length] of lengths.entries()) {
    if (remaining <= length) {
      const start = points[index]!;
      const end = points[index + 1]!;
      const ratio = length === 0 ? 0 : remaining / length;
      return [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
    }
    remaining -= length;
  }
  return points.at(-1);
}

function probePoint(
  metadata: Readonly<CandidateCircuitSvgMetadataV2>,
  target: Readonly<CircuitGraphV2["probes"][number]["target"]>,
): Point | undefined {
  if (target.wire !== undefined) {
    const wire = metadata.circuit.wires.find((entry) => entry.id === target.wire);
    return wire === undefined ? undefined : pointAtPolylineMiddle(wire.points);
  }
  if (target.componentPin === undefined) return undefined;
  const [componentId, pin] = target.componentPin;
  const component = metadata.circuit.components.find((entry) => entry.id === componentId);
  if (component === undefined) return undefined;
  const points = componentPinPointsV2(component, metadata.designBlocks);
  if (typeof pin === "number") return points[pin];
  if (component.type !== "design_block") return undefined;
  const definition = metadata.designBlocks.find((block) => block.id === component.block.id
    && block.version === component.block.version
    && block.contentHash === component.block.contentHash);
  const index = definition?.pins.findIndex((entry) => entry.id === pin) ?? -1;
  return index < 0 ? undefined : points[index];
}

function probeMarkup(metadata: Readonly<CandidateCircuitSvgMetadataV2>): string {
  return [...metadata.circuit.probes]
    .sort((left, right) => compareText(left.id, right.id))
    .map((probe, index) => {
      const point = probePoint(metadata, probe.target);
      if (point === undefined) return "";
      return `<g class="probe" data-probe-id="${xmlAttribute(probe.id)}" data-probe-kind="${probe.kind}"><circle cx="${numberText(point[0])}" cy="${numberText(point[1])}" r=".35"/><text x="${numberText(point[0] + .48)}" y="${numberText(point[1] - .48)}">P${index + 1}</text></g>`;
    })
    .join("");
}

interface HeaderLineInput {
  kind: "title" | "boundary" | "provenance" | "notice";
  className: "title" | "subtitle" | "notice";
  text: string;
  characterWidth: number;
  lineHeight: number;
}

/** @internal Closed render-only extension for higher-level inspection artifacts. */
export interface CandidateCircuitSvgRenderExtensionV2 {
  readonly metadataId:
    | typeof CUSTOMIZED_TARGET_METADATA_ID
    | typeof PRODUCTION_CONSTRAINT_OBSERVATION_METADATA_ID;
  readonly canonicalMetadata: string;
  readonly headerLines: readonly string[];
  readonly description: string;
}

function parsedRenderExtension(
  extension: Readonly<CandidateCircuitSvgRenderExtensionV2> | undefined,
): CandidateCircuitSvgRenderExtensionV2 | undefined {
  if (extension === undefined) return undefined;
  if ((extension.metadataId !== CUSTOMIZED_TARGET_METADATA_ID
      && extension.metadataId !== PRODUCTION_CONSTRAINT_OBSERVATION_METADATA_ID)
    || extension.headerLines.length === 0
    || extension.headerLines.length > 8
    || extension.headerLines.some((line) => line.length === 0 || new TextEncoder().encode(line).byteLength > 4096)
    || extension.description.length === 0
    || new TextEncoder().encode(extension.description).byteLength > 4096) {
    throw new TypeError("SVG render extension is outside the closed render envelope");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(extension.canonicalMetadata) as unknown; }
  catch { throw new TypeError("SVG render extension metadata is not JSON"); }
  if (canonicalDesignV2Payload(parsed) !== extension.canonicalMetadata) {
    throw new TypeError("SVG render extension metadata is not canonical");
  }
  return {
    metadataId: extension.metadataId,
    canonicalMetadata: extension.canonicalMetadata,
    headerLines: [...extension.headerLines],
    description: extension.description,
  };
}

function headerLayout(
  metadata: Readonly<CandidateCircuitSvgMetadataV2>,
  width: number,
  extension?: Readonly<CandidateCircuitSvgRenderExtensionV2>,
): { height: number; markup: string } {
  const notices = [
    ...coverageLines(metadata),
    ...probeLines(metadata),
    ...metadata.candidateWarnings.map((warning) => `Candidate warning: ${warning}`),
  ];
  const ordinaryHeader: HeaderLineInput[] = [
    { kind: "title", className: "title", text: metadata.circuit.title, characterWidth: 13, lineHeight: 27 },
    { kind: "boundary", className: "subtitle", text: "Structural schematic · exact persisted V2 graph · no simulation results", characterWidth: 8, lineHeight: 19 },
    { kind: "provenance", className: "subtitle", text: `Candidate ${metadata.candidateRef.id} · result ${metadata.designResultRef.contentHash}`, characterWidth: 8, lineHeight: 19 },
  ];
  const customizedTargetHeader: HeaderLineInput[] = [
    { kind: "title", className: "title", text: metadata.circuit.title, characterWidth: 13, lineHeight: 27 },
    ...(extension?.headerLines ?? []).map((text): HeaderLineInput => ({
      kind: "boundary",
      className: "notice",
      text,
      characterWidth: 7.5,
      lineHeight: 18,
    })),
  ];
  const inputs: HeaderLineInput[] = [
    ...(extension === undefined ? ordinaryHeader : customizedTargetHeader),
    ...notices.map((text): HeaderLineInput => ({
      kind: "notice",
      className: "notice",
      text,
      characterWidth: 7.5,
      lineHeight: 18,
    })),
  ];
  const availableWidth = width - HEADER_SIDE_PADDING * 2;
  let y = 32;
  let physicalLineIndex = 0;
  const markup: string[] = [];
  for (const input of inputs) {
    const maximumCharacters = Math.max(1, Math.floor(availableWidth / input.characterWidth));
    const lines = wrappedDisplay(input.text, maximumCharacters);
    for (const [lineIndex, line] of lines.entries()) {
      markup.push(fittedText(
        input.className,
        ` data-header-kind="${input.kind}" data-line-index="${lineIndex}" data-physical-line-index="${physicalLineIndex}"`,
        HEADER_SIDE_PADDING,
        y,
        line,
        availableWidth,
        input.characterWidth,
      ));
      y += input.lineHeight;
      physicalLineIndex += 1;
    }
  }
  return { height: y + 12, markup: markup.join("") };
}

function render(
  metadata: Readonly<CandidateCircuitSvgMetadataV2>,
  extensionInput?: Readonly<CandidateCircuitSvgRenderExtensionV2>,
): string {
  const extension = parsedRenderExtension(extensionInput);
  const canonicalMetadata = canonicalDesignV2Payload(metadata);
  const bounds = boundsFor(metadata);
  const width = Math.max(HEADER_MINIMUM_WIDTH, Math.ceil(bounds.width * GRID));
  const header = headerLayout(metadata, width, extension);
  const headerHeight = header.height;
  const height = headerHeight + Math.max(320, Math.ceil(bounds.height * GRID));
  const worldTransform = `translate(${numberText(-bounds.minX * GRID)} ${numberText(headerHeight - bounds.minY * GRID)}) scale(${GRID})`;
  const metadataMarkup = extension === undefined
    ? `${SVG_METADATA_OPEN}${xmlText(canonicalMetadata)}${SVG_METADATA_CLOSE}`
    : `<metadata id="${extension.metadataId}">${xmlText(extension.canonicalMetadata)}${SVG_METADATA_CLOSE}`;
  const description = extension?.description ?? "Verified structural schematic. Simulation data is not included.";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="schemagic-title schemagic-description">${metadataMarkup}<title id="schemagic-title">${displayText(metadata.circuit.title)}</title><desc id="schemagic-description">${displayText(description)}</desc><style>svg{background:#fff;color:#17211d;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.header-rule{stroke:#bec9c3;stroke-width:1}.title{fill:#17211d;font-size:22px;font-weight:700}.subtitle{fill:#365047;font-size:13px}.notice{fill:#7a3d16;font-size:12px}.world{fill:none;stroke:#17211d;stroke-linecap:round;stroke-linejoin:round;stroke-width:.09}.wire{fill:none;stroke:#236b55;stroke-width:.13}.pin{fill:#fff;stroke:#17211d;stroke-width:.08}.component-label{fill:#17211d;stroke:none;font-size:.62px;font-weight:700;text-anchor:middle}.component-value{fill:#365047;stroke:none;font-size:.48px;text-anchor:middle}.block-title{fill:#17211d;stroke:none;font-size:.5px;text-anchor:middle}.probe circle{fill:#fff1d2;stroke:#a65816;stroke-width:.1}.probe text{fill:#7a3d16;stroke:none;font-size:.48px;font-weight:700}.symbol text{vector-effect:non-scaling-stroke}</style><rect width="${width}" height="${height}" fill="#fff"/>${header.markup}<path class="header-rule" d="M0 ${headerHeight - 12}H${width}"/><g class="world" transform="${worldTransform}">${wireMarkup(metadata.circuit)}${componentMarkup(metadata)}${probeMarkup(metadata)}</g></svg>\n`;
  if (new TextEncoder().encode(svg).byteLength > MAX_SVG_BYTES) {
    throw new TypeError("SVG exceeds the deterministic artifact byte limit");
  }
  return svg;
}

/** @internal Rendering seam used only for deterministic format tests. */
export function _renderCandidateCircuitSvgV2ForTest(metadata: Readonly<CandidateCircuitSvgMetadataV2>): string {
  return render(metadata);
}

/**
 * @internal Render-only seam for a result projection authorized by a distinct,
 * closed artifact contract. It deliberately does not establish ordinary V2
 * engineering-context authority.
 */
export function _renderCandidateCircuitSvgV2FromProjection(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV2>,
  extension?: Readonly<CandidateCircuitSvgRenderExtensionV2>,
): string {
  return render(metadataFor(result, candidate, circuit), extension);
}

function parsedResultAndContext(
  resultInput: Readonly<DesignResultV2>,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): DesignResultV2 {
  let result: DesignResultV2;
  try {
    result = parseDesignResultV2(resultInput);
  } catch {
    throw new CandidateCircuitSvgExportErrorV2("invalid_result");
  }
  const issues = validateDesignResultEngineeringContextV2(result, engineeringContext);
  if (issues.length > 0) throw new CandidateCircuitSvgExportErrorV2("engineering_context_unverified", issues);
  return result;
}

/**
 * Render one exact persisted V2 graph as a structural SVG.
 *
 * This export contains no simulation samples and makes no reviewed-model or
 * execution claim. The source result must regenerate byte-for-byte under the
 * supplied engineering context before any SVG bytes are returned.
 */
export function exportDesignResultCircuitSvgV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  circuitId: string,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): string {
  const result = parsedResultAndContext(resultInput, engineeringContext);
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new CandidateCircuitSvgExportErrorV2("candidate_not_found");
  const circuit = candidate.circuit.circuits.find((entry) => entry.id === circuitId);
  if (circuit === undefined) throw new CandidateCircuitSvgExportErrorV2("circuit_not_found");
  try {
    return render(metadataFor(result, candidate, circuit));
  } catch {
    throw new CandidateCircuitSvgExportErrorV2("render_failed");
  }
}

function extractMetadata(svg: string): CandidateCircuitSvgMetadataV2 {
  if (new TextEncoder().encode(svg).byteLength > MAX_SVG_BYTES) {
    throw new CandidateCircuitSvgExportErrorV2("invalid_svg");
  }
  const start = svg.indexOf(SVG_METADATA_OPEN);
  if (start < 0 || svg.indexOf(SVG_METADATA_OPEN, start + SVG_METADATA_OPEN.length) >= 0) {
    throw new CandidateCircuitSvgExportErrorV2("invalid_svg");
  }
  const contentStart = start + SVG_METADATA_OPEN.length;
  const end = svg.indexOf(SVG_METADATA_CLOSE, contentStart);
  if (end < 0 || svg.indexOf(SVG_METADATA_CLOSE, end + SVG_METADATA_CLOSE.length) >= 0) {
    throw new CandidateCircuitSvgExportErrorV2("invalid_svg");
  }
  try {
    const decoded = decodeXmlText(svg.slice(contentStart, end));
    const parsed = JSON.parse(decoded) as unknown;
    if (canonicalDesignV2Payload(parsed) !== decoded || parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("SVG metadata is not canonical");
    }
    const value = parsed as Record<string, unknown>;
    if (value.format !== "schemagic-circuit-svg-metadata"
      || value.schemaVersion !== 2
      || value.artifactKind !== "structural_schematic"
      || value.simulationDataState !== "not_included") {
      throw new TypeError("SVG metadata contract is unsupported");
    }
    return parsed as CandidateCircuitSvgMetadataV2;
  } catch (error) {
    if (error instanceof CandidateCircuitSvgExportErrorV2) throw error;
    throw new CandidateCircuitSvgExportErrorV2("invalid_svg");
  }
}

/**
 * Parse and semantically verify a structural SVG against its exact V2 result
 * and engineering context. Any metadata or visible-byte change fails closed.
 */
export function parseDesignResultCircuitSvgV2(
  svg: string,
  resultInput: Readonly<DesignResultV2>,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): Readonly<CandidateCircuitSvgMetadataV2> {
  const parsed = extractMetadata(svg);
  const result = parsedResultAndContext(resultInput, engineeringContext);
  const candidateId = parsed.candidateRef?.id;
  const circuitId = parsed.circuit?.id;
  const candidate = typeof candidateId === "string"
    ? result.candidates.find((entry) => entry.id === candidateId)
    : undefined;
  const circuit = candidate !== undefined && typeof circuitId === "string"
    ? candidate.circuit.circuits.find((entry) => entry.id === circuitId)
    : undefined;
  if (candidate === undefined || circuit === undefined) {
    throw new CandidateCircuitSvgExportErrorV2("artifact_unverified");
  }
  try {
    const expected = metadataFor(result, candidate, circuit);
    if (canonicalDesignV2Payload(parsed) !== canonicalDesignV2Payload(expected) || svg !== render(expected)) {
      throw new CandidateCircuitSvgExportErrorV2("artifact_unverified");
    }
    return deepFreeze(structuredClone(expected));
  } catch (error) {
    if (error instanceof CandidateCircuitSvgExportErrorV2) throw error;
    throw new CandidateCircuitSvgExportErrorV2("artifact_unverified");
  }
}
