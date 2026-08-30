import {
  componentPinPointsV4,
  type CircuitComponentV4,
  type CircuitGraphV4,
  type DesignBlockDefinition,
  type NetlistOmission,
  type Point,
  type SimulationScenarioV4,
} from "@opencircuit/circuit-schema";
import {
  canonicalDesignV2Payload,
  designSha256ContentHash,
  parseDesignResultV2,
  type CandidateIdV2,
  type CircuitInstanceClassificationV2,
  type DesignCandidateV2,
  type DesignResultV2,
  type DesignValidationIssue,
  type SimulationCoverageV2,
} from "@opencircuit/design-schema";
import {
  validateDesignResultEngineeringContextV2,
  validateDesignResultExecutionContextV2,
  type DesignResultExecutionContextV2,
  type ElectricalDesignContextManifestV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-export-runtime";
import { generateScenarioNetlist } from "@opencircuit/circuit-schema/v4-netlist";

export type CandidateKicadSchematicExportErrorCodeV2 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "execution_context_unverified"
  | "candidate_not_found"
  | "circuit_not_found"
  | "render_failed"
  | "invalid_kicad_schematic"
  | "artifact_unverified";

export class CandidateKicadSchematicExportErrorV2 extends Error {
  readonly code: CandidateKicadSchematicExportErrorCodeV2;
  readonly issues: readonly DesignValidationIssue[];

  constructor(
    code: CandidateKicadSchematicExportErrorCodeV2,
    issues: readonly DesignValidationIssue[] = [],
  ) {
    super("scheMAGIC structural KiCad schematic export was rejected");
    this.name = "CandidateKicadSchematicExportErrorV2";
    this.code = code;
    this.issues = Object.freeze([...issues]);
  }
}

export interface CandidateKicadSchematicScenarioV2 {
  scenario: SimulationScenarioV4;
  coverage: SimulationCoverageV2;
  execution: {
    scenarioHash: string;
    serializationHash: string;
    netlistContentHash: `sha256:${string}`;
    omissions: NetlistOmission[];
  };
}

export interface CandidateKicadSchematicPinV2 {
  number: string;
  name: string;
  point: Point;
  netLabel: string;
}

export interface CandidateKicadSchematicComponentV2 {
  componentId: string;
  libraryId: string;
  reference: string;
  value: string;
  footprint: "";
  manufacturerId: string;
  manufacturerPartNumber: string;
  classification: CircuitInstanceClassificationV2;
  pins: CandidateKicadSchematicPinV2[];
}

export interface CandidateKicadSchematicWireV2 {
  wireId: string;
  points: Point[];
  netLabel: string;
}

export interface CandidateKicadSchematicMetadataV2 {
  format: "schemagic-kicad-schematic-metadata";
  schemaVersion: 2;
  artifactKind: "structural_kicad_schematic";
  kicadFormat: {
    extension: ".kicad_sch";
    syntaxVersion: 20231120;
    generator: "schemagic";
    symbols: "project_authored";
    externalOpenVerification: "unverified";
  };
  fidelity: {
    circuit: "exact_persisted_v2_structure";
    simulationData: "not_included";
    physicalModel: "not_claimed";
    footprintMapping: "unavailable";
  };
  connectivityEncoding: {
    electrical: "local_labels_from_exact_point_union";
    wireGeometry: "project_authored_graphical_polylines";
  };
  designResultRef: {
    contentHash: DesignResultV2["contentHash"];
    requestHash: DesignResultV2["requestHash"];
    libraryVersion: string;
    libraryContentHash: DesignResultV2["libraryContentHash"];
  };
  engineeringContextRef: {
    manifestVersion: GenerateElectricalContextV2["manifest"]["version"];
    manifestContentHash: GenerateElectricalContextV2["manifest"]["contentHash"];
  };
  executionContextState:
    | "verified_against_persisted_coverage"
    | "not_applicable_no_authored_scenarios";
  candidateRef: { id: CandidateIdV2; recipeId: string };
  circuit: CircuitGraphV4;
  designBlocks: DesignBlockDefinition[];
  scenarios: CandidateKicadSchematicScenarioV2[];
  components: CandidateKicadSchematicComponentV2[];
  wires: CandidateKicadSchematicWireV2[];
  visibleNotices: string[];
}

const KICAD_VERSION = 20231120 as const;
const GENERATOR = "schemagic" as const;
const GENERATOR_VERSION = "0.0.1";
const METADATA_PREFIX = "schemagic_metadata_v2:";
const METADATA_PROPERTY = "scheMAGIC Metadata V2";
const CUSTOMIZED_METADATA_PREFIX = "schemagic_primary_part_customized_artifact_v1:";
const CUSTOMIZED_METADATA_PROPERTY = "scheMAGIC Customized Target Artifact Metadata V1";
const MAX_KICAD_BYTES = 32 * 1024 * 1024;
const MAX_SEXPRESSION_DEPTH = 96;
const MAX_SEXPRESSION_NODES = 1_000_000;
const GRID_MM = 2.54;
const PAGE_MARGIN_MM = 25;
const NOTICE_TOP_MM = 15;
const NOTICE_LINE_MM = 4;
const NOTICE_CHARACTERS = 96;
const MAX_WORLD_SPAN = 1_000_000;
const HASH = /^sha256:[0-9a-f]{64}$/u;

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function normalizedNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function numberText(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000) {
    throw new TypeError("KiCad coordinate is outside the deterministic render envelope");
  }
  const rounded = Math.round(normalizedNumber(value) * 10_000) / 10_000;
  return rounded.toFixed(4).replace(/\.0+$/u, "").replace(/(\.[0-9]*?)0+$/u, "$1");
}

function kicadString(value: string): string {
  const rendered = JSON.stringify(value);
  if (rendered === undefined) throw new TypeError("KiCad text must be serializable");
  return rendered;
}

function stableUuid(seed: string): string {
  const digest = designSha256ContentHash(seed).slice("sha256:".length, "sha256:".length + 32).split("");
  digest[12] = "4";
  digest[16] = "8";
  const hex = digest.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function pointKey(point: Readonly<Point>): string {
  return `${numberText(point[0])},${numberText(point[1])}`;
}

class UnionFind {
  private readonly parents = new Map<string, string>();

  add(key: string): void {
    if (!this.parents.has(key)) this.parents.set(key, key);
  }

  find(key: string): string {
    this.add(key);
    const parent = this.parents.get(key)!;
    if (parent === key) return key;
    const root = this.find(parent);
    this.parents.set(key, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parents.set(rightRoot, leftRoot);
  }
}

interface ConnectivityProjection {
  pinLabels: ReadonlyMap<string, readonly string[]>;
  wireLabels: ReadonlyMap<string, string>;
}

function connectivityProjection(
  circuit: Readonly<CircuitGraphV4>,
  components: readonly Readonly<CircuitComponentV4>[],
  blocks: readonly Readonly<DesignBlockDefinition>[],
): ConnectivityProjection {
  const union = new UnionFind();
  const pins = new Map<string, Point[]>();
  for (const wire of circuit.wires) {
    const first = pointKey(wire.points[0]!);
    union.add(first);
    for (const point of wire.points.slice(1)) union.union(first, pointKey(point));
  }
  for (const component of components) {
    const points = componentPinPointsV4(component, blocks);
    pins.set(component.id, points);
    for (const point of points) union.add(pointKey(point));
  }
  const groundRoots = new Set<string>();
  for (const component of components) {
    if (component.type !== "ground") continue;
    const point = pins.get(component.id)?.[0];
    if (point !== undefined) groundRoots.add(union.find(pointKey(point)));
  }
  const roots = new Set<string>();
  for (const wire of circuit.wires) roots.add(union.find(pointKey(wire.points[0]!)));
  for (const points of pins.values()) for (const point of points) roots.add(union.find(pointKey(point)));
  const labels = new Map<string, string>();
  let index = 1;
  for (const root of [...roots].sort(compareText)) {
    labels.set(root, groundRoots.has(root) ? "GND" : `SM_NET_${String(index++).padStart(3, "0")}`);
  }
  return {
    pinLabels: new Map([...pins].map(([componentId, points]) => [
      componentId,
      points.map((point) => labels.get(union.find(pointKey(point)))!),
    ])),
    wireLabels: new Map(circuit.wires.map((wire) => [
      wire.id,
      labels.get(union.find(pointKey(wire.points[0]!)))!,
    ])),
  };
}

function referencedBlocks(
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV4>,
): DesignBlockDefinition[] {
  const refs = new Set(circuit.components.flatMap((component) => component.type === "design_block"
    ? [`${component.block.id}\u0000${component.block.version}\u0000${component.block.contentHash}`]
    : []));
  return candidate.circuit.designBlocks
    .filter((block) => refs.has(`${block.id}\u0000${block.version}\u0000${block.contentHash}`))
    .map((block) => structuredClone(block));
}

function referencePrefix(type: CircuitComponentV4["type"]): string {
  if (type === "resistor") return "R";
  if (type === "capacitor") return "C";
  if (type === "inductor") return "L";
  if (["vsource", "vsource_pulse", "vsource_sine"].includes(type)) return "V";
  if (["isource", "isource_pulse"].includes(type)) return "I";
  if (type === "ground") return "GND";
  if (type === "switch_spst") return "SW";
  if (type === "potentiometer") return "RV";
  if (["diode", "led"].includes(type)) return "D";
  if (["bjt_npn", "bjt_pnp", "nmos", "pmos"].includes(type)) return "Q";
  return "U";
}

function componentValue(component: Readonly<CircuitComponentV4>): string {
  if ("value" in component && component.value !== undefined) return String(component.value);
  if ("params" in component && component.params !== undefined) {
    return `${component.type} ${canonicalDesignV2Payload(component.params)}`;
  }
  if (component.mpn !== undefined) return component.mpn;
  if (component.type === "design_block") return component.block.id;
  return component.type;
}

function componentPinNames(
  component: Readonly<CircuitComponentV4>,
  blocks: readonly Readonly<DesignBlockDefinition>[],
  count: number,
): string[] {
  if (component.type !== "design_block") return Array.from({ length: count }, (_, index) => `P${index + 1}`);
  const definition = blocks.find((block) => block.id === component.block.id
    && block.version === component.block.version
    && block.contentHash === component.block.contentHash);
  if (definition === undefined) throw new TypeError("KiCad design-block symbol reference is unresolved");
  return definition.pins.map((pin) => pin.name);
}

function componentMetadata(
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV4>,
  blocks: readonly Readonly<DesignBlockDefinition>[],
): CandidateKicadSchematicComponentV2[] {
  const sorted = [...circuit.components].sort((left, right) => compareText(left.id, right.id));
  const counts = new Map<string, number>();
  const connectivity = connectivityProjection(circuit, sorted, blocks);
  return sorted.map((component, componentIndex) => {
    const prefix = referencePrefix(component.type);
    const next = (counts.get(prefix) ?? 0) + 1;
    counts.set(prefix, next);
    const classification = candidate.circuitInstanceClassifications.find((entry) => (
      entry.circuitId === circuit.id && entry.componentId === component.id
    ));
    if (classification === undefined) throw new TypeError("KiCad component has no circuit/BOM classification");
    const selected = classification.kind === "non_bom"
      ? undefined
      : candidate.components.find((entry) => entry.id === classification.selectedComponentId);
    if (classification.kind !== "non_bom" && selected === undefined) {
      throw new TypeError("KiCad component classification has no selected component");
    }
    const points = componentPinPointsV4(component, blocks);
    const names = componentPinNames(component, blocks, points.length);
    const netLabels = connectivity.pinLabels.get(component.id);
    if (netLabels === undefined || netLabels.length !== points.length) {
      throw new TypeError("KiCad pin connectivity projection is incomplete");
    }
    return {
      componentId: component.id,
      libraryId: `schemagic_generated:S${String(componentIndex + 1).padStart(3, "0")}`,
      reference: `${prefix}${next}`,
      value: componentValue(component),
      footprint: "",
      manufacturerId: selected?.part.manufacturerId ?? "",
      manufacturerPartNumber: component.mpn ?? selected?.part.manufacturerPartNumber ?? "",
      classification: structuredClone(classification),
      pins: points.map((point, index) => ({
        number: String(index + 1),
        name: names[index]!,
        point: [...point],
        netLabel: netLabels[index]!,
      })),
    };
  });
}

function scenarioMetadata(
  candidate: Readonly<DesignCandidateV2>,
  circuitId: string,
  executionContext: Readonly<DesignResultExecutionContextV2>,
): CandidateKicadSchematicScenarioV2[] {
  return candidate.circuit.scenarios
    .filter((scenario) => scenario.circuitId === circuitId)
    .sort((left, right) => compareText(left.id, right.id))
    .map((scenario) => {
      const coverage = candidate.simulationCoverage.find((entry) => entry.scenarioId === scenario.id);
      if (coverage === undefined) throw new TypeError("KiCad circuit scenario has no persisted coverage");
      const generated = generateScenarioNetlist(candidate.circuit, scenario.id, {
        ...(executionContext.trustedSubcircuitRegistry === undefined
          ? {}
          : { registry: executionContext.trustedSubcircuitRegistry }),
      });
      return {
        scenario: structuredClone(scenario),
        coverage: structuredClone(coverage),
        execution: {
          scenarioHash: generated.scenarioHash,
          serializationHash: generated.serializationHash,
          netlistContentHash: designSha256ContentHash(generated.netlist),
          omissions: structuredClone(generated.omissions),
        },
      };
    });
}

function visibleNotices(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV4>,
  manifest: Readonly<ElectricalDesignContextManifestV2>,
  scenarios: readonly Readonly<CandidateKicadSchematicScenarioV2>[],
): string[] {
  const notices = [
    "scheMAGIC structural-only schematic; no simulation data or physical-model fidelity is claimed.",
    `Connectivity: exact persisted point-union nets use local labels; wire ${circuit.id} paths are graphical polylines.`,
    "Footprint mapping unavailable: every Footprint field is intentionally empty; package names are not KiCad footprint identities.",
    "External KiCad open verification: UNVERIFIED; no kicad-cli result is attached to this artifact.",
    `Result ${result.contentHash}; request ${result.requestHash}.`,
    `Candidate ${candidate.id}; recipe ${candidate.recipeId}.`,
    `Engineering context ${manifest.version}; ${manifest.contentHash}.`,
  ];
  if (scenarios.length === 0) notices.push("Simulation boundary: no authored scenario targets this circuit.");
  for (const entry of scenarios) {
    notices.push(`Scenario ${entry.scenario.id}: ${entry.scenario.config.mode}; coverage ${entry.coverage.modelTier}; no simulation data included.`);
    for (const limitation of entry.coverage.limitations) notices.push(`Limitation: ${limitation}`);
    for (const omission of entry.execution.omissions) notices.push(`Execution omission ${omission.componentId}: ${omission.reason}`);
  }
  for (const component of circuit.components) {
    if (component.type !== "design_block") continue;
    const definition = candidate.circuit.designBlocks.find((block) => block.id === component.block.id
      && block.version === component.block.version
      && block.contentHash === component.block.contentHash);
    if (definition?.netlist.kind === "schematic_only") {
      notices.push(`Schematic-only block ${component.id}: ${definition.netlist.reason}`);
    }
  }
  for (const omission of candidate.circuitBomNonRepresentations.filter((entry) => entry.circuitId === circuit.id)) {
    notices.push(`BOM omission ${omission.selectedComponentId}: ${omission.reason}`);
  }
  for (const warning of candidate.warnings) notices.push(`Candidate warning: ${warning}`);
  return notices;
}

function metadataFor(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV4>,
  manifest: Readonly<ElectricalDesignContextManifestV2>,
  executionContext: Readonly<DesignResultExecutionContextV2>,
): CandidateKicadSchematicMetadataV2 {
  const blocks = referencedBlocks(candidate, circuit);
  const scenarios = scenarioMetadata(candidate, circuit.id, executionContext);
  const connectivity = connectivityProjection(circuit, circuit.components, blocks);
  return {
    format: "schemagic-kicad-schematic-metadata",
    schemaVersion: 2,
    artifactKind: "structural_kicad_schematic",
    kicadFormat: {
      extension: ".kicad_sch",
      syntaxVersion: KICAD_VERSION,
      generator: GENERATOR,
      symbols: "project_authored",
      externalOpenVerification: "unverified",
    },
    fidelity: {
      circuit: "exact_persisted_v2_structure",
      simulationData: "not_included",
      physicalModel: "not_claimed",
      footprintMapping: "unavailable",
    },
    connectivityEncoding: {
      electrical: "local_labels_from_exact_point_union",
      wireGeometry: "project_authored_graphical_polylines",
    },
    designResultRef: {
      contentHash: result.contentHash,
      requestHash: result.requestHash,
      libraryVersion: result.libraryVersion,
      libraryContentHash: result.libraryContentHash,
    },
    engineeringContextRef: {
      manifestVersion: manifest.version,
      manifestContentHash: manifest.contentHash,
    },
    executionContextState: candidate.circuit.scenarios.length === 0
      ? "not_applicable_no_authored_scenarios"
      : "verified_against_persisted_coverage",
    candidateRef: { id: candidate.id, recipeId: candidate.recipeId },
    circuit: structuredClone(circuit),
    designBlocks: blocks,
    scenarios,
    components: componentMetadata(candidate, circuit, blocks),
    wires: [...circuit.wires]
      .sort((left, right) => compareText(left.id, right.id))
      .map((wire) => ({
        wireId: wire.id,
        points: structuredClone(wire.points),
        netLabel: connectivity.wireLabels.get(wire.id)!,
      })),
    visibleNotices: visibleNotices(result, candidate, circuit, manifest, scenarios),
  };
}

interface Layout {
  paperWidth: number;
  paperHeight: number;
  headerHeight: number;
  mapPoint(point: Readonly<Point>): Point;
}

function wrappedNoticeLines(notices: readonly string[]): string[] {
  const lines: string[] = [];
  for (const notice of notices) {
    const characters = Array.from(notice);
    if (characters.length === 0) lines.push("");
    for (let index = 0; index < characters.length; index += NOTICE_CHARACTERS) {
      lines.push(characters.slice(index, index + NOTICE_CHARACTERS).join(""));
    }
  }
  return lines;
}

function layoutFor(metadata: Readonly<CandidateKicadSchematicMetadataV2>): Layout {
  const points = [
    ...metadata.circuit.components.map((component) => component.pos),
    ...metadata.components.flatMap((component) => component.pins.map((pin) => pin.point)),
    ...metadata.wires.flatMap((wire) => wire.points),
  ];
  if (points.length === 0) points.push([0, 0]);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (![minX, maxX, minY, maxY, spanX, spanY].every(Number.isFinite)
    || spanX > MAX_WORLD_SPAN || spanY > MAX_WORLD_SPAN) {
    throw new TypeError("KiCad circuit geometry exceeds the deterministic render envelope");
  }
  const headerHeight = NOTICE_TOP_MM + wrappedNoticeLines(metadata.visibleNotices).length * NOTICE_LINE_MM;
  return {
    paperWidth: Math.max(297, spanX * GRID_MM + PAGE_MARGIN_MM * 2),
    paperHeight: Math.max(210, spanY * GRID_MM + headerHeight + PAGE_MARGIN_MM * 2),
    headerHeight,
    mapPoint: ([x, y]) => [
      (x - minX) * GRID_MM + PAGE_MARGIN_MM,
      (y - minY) * GRID_MM + headerHeight + PAGE_MARGIN_MM,
    ],
  };
}

function effects(hidden = false, justification?: "left" | "right"): string {
  return `(effects (font (size 1.27 1.27))${justification === undefined ? "" : ` (justify ${justification})`}${hidden ? " (hide yes)" : ""})`;
}

function property(
  name: string,
  value: string,
  x: number,
  y: number,
  hidden = false,
): string {
  return `(property ${kicadString(name)} ${kicadString(value)} (at ${numberText(x)} ${numberText(y)} 0) ${effects(hidden)})`;
}

function componentById(
  metadata: Readonly<CandidateKicadSchematicMetadataV2>,
  id: string,
): CircuitComponentV4 {
  const component = metadata.circuit.components.find((entry) => entry.id === id);
  if (component === undefined) throw new TypeError("KiCad component metadata is unresolved");
  return component;
}

function componentBodyBounds(
  exported: Readonly<CandidateKicadSchematicComponentV2>,
  component: Readonly<CircuitComponentV4>,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const offsets = exported.pins.map((pin) => [
    (pin.point[0] - component.pos[0]) * GRID_MM,
    (pin.point[1] - component.pos[1]) * GRID_MM,
  ] as Point);
  const xs = offsets.map((point) => point[0]);
  const ys = offsets.map((point) => point[1]);
  return {
    minX: Math.min(-2.54, ...xs) - 1.27,
    minY: Math.min(-2.54, ...ys) - 1.27,
    maxX: Math.max(2.54, ...xs) + 1.27,
    maxY: Math.max(2.54, ...ys) + 1.27,
  };
}

function librarySymbolMarkup(
  metadata: Readonly<CandidateKicadSchematicMetadataV2>,
  exported: Readonly<CandidateKicadSchematicComponentV2>,
): string {
  const component = componentById(metadata, exported.componentId);
  const bounds = componentBodyBounds(exported, component);
  const entryName = exported.libraryId.slice(exported.libraryId.indexOf(":") + 1);
  const inBom = exported.classification.kind === "physical" ? "yes" : "no";
  const onBoard = exported.classification.kind === "physical" ? "yes" : "no";
  const pins = exported.pins.map((pin) => {
    const x = (pin.point[0] - component.pos[0]) * GRID_MM;
    const y = (pin.point[1] - component.pos[1]) * GRID_MM;
    return `        (pin passive line (at ${numberText(x)} ${numberText(y)} 0) (length 0) (name ${kicadString(pin.name)} ${effects()}) (number ${kicadString(pin.number)} ${effects()}))`;
  }).join("\n");
  return `    (symbol ${kicadString(exported.libraryId)}
      (pin_names (offset 0) hide)
      (exclude_from_sim yes)
      (in_bom ${inBom})
      (on_board ${onBoard})
      ${property("Reference", referencePrefix(component.type), 0, bounds.minY - 2.54)}
      ${property("Value", component.type, 0, bounds.maxY + 2.54)}
      ${property("Footprint", "", 0, 0, true)}
      ${property("Datasheet", "", 0, 0, true)}
      (symbol ${kicadString(`${entryName}_0_1`)}
        (rectangle (start ${numberText(bounds.minX)} ${numberText(bounds.minY)}) (end ${numberText(bounds.maxX)} ${numberText(bounds.maxY)}) (stroke (width 0) (type default)) (fill (type background)))
        (text ${kicadString(component.type)} (at 0 0 0) ${effects()})
      )
      (symbol ${kicadString(`${entryName}_1_1`)}
${pins}
      )
    )`;
}

function instancePropertyLines(
  metadata: Readonly<CandidateKicadSchematicMetadataV2>,
  exported: Readonly<CandidateKicadSchematicComponentV2>,
  point: Readonly<Point>,
  customized?: Readonly<{ canonicalMetadata: string }>,
): string[] {
  const component = componentById(metadata, exported.componentId);
  const bounds = componentBodyBounds(exported, component);
  const properties = [
    property("Reference", exported.reference, point[0], point[1] + bounds.minY - 2.54),
    property("Value", exported.value, point[0], point[1] + bounds.maxY + 2.54),
    property("Footprint", exported.footprint, point[0], point[1], true),
    property("Datasheet", "", point[0], point[1], true),
    property("Manufacturer", exported.manufacturerId, point[0], point[1], true),
    property("MPN", exported.manufacturerPartNumber, point[0], point[1], true),
    property("scheMAGIC Component ID", exported.componentId, point[0], point[1], true),
    property("scheMAGIC Classification", exported.classification.kind, point[0], point[1], true),
    property("scheMAGIC Footprint Boundary", "unavailable; intentionally empty", point[0], point[1], true),
  ];
  if (exported.componentId === metadata.components[0]?.componentId) {
    properties.push(property(
      customized === undefined ? METADATA_PROPERTY : CUSTOMIZED_METADATA_PROPERTY,
      customized === undefined
        ? `${METADATA_PREFIX}${canonicalDesignV2Payload(metadata)}`
        : `${CUSTOMIZED_METADATA_PREFIX}${customized.canonicalMetadata}`,
      point[0],
      point[1],
      true,
    ));
  }
  return properties;
}

function symbolInstanceMarkup(
  metadata: Readonly<CandidateKicadSchematicMetadataV2>,
  exported: Readonly<CandidateKicadSchematicComponentV2>,
  layout: Readonly<Layout>,
  rootUuid: string,
  customized?: Readonly<{ canonicalMetadata: string }>,
): string {
  const component = componentById(metadata, exported.componentId);
  const point = layout.mapPoint(component.pos);
  const inBom = exported.classification.kind === "physical" ? "yes" : "no";
  const onBoard = exported.classification.kind === "physical" ? "yes" : "no";
  const properties = instancePropertyLines(metadata, exported, point, customized).map((line) => `    ${line}`).join("\n");
  const pins = exported.pins.map((pin) => `    (pin ${kicadString(pin.number)} (uuid ${kicadString(stableUuid(`${metadata.designResultRef.contentHash}\nsymbol:${exported.componentId}\npin:${pin.number}`))}))`).join("\n");
  return `  (symbol
    (lib_id ${kicadString(exported.libraryId)})
    (at ${numberText(point[0])} ${numberText(point[1])} 0)
    (unit 1)
    (exclude_from_sim yes)
    (in_bom ${inBom})
    (on_board ${onBoard})
    (dnp no)
    (uuid ${kicadString(stableUuid(`${metadata.designResultRef.contentHash}\nsymbol:${exported.componentId}`))})
${properties}
${pins}
    (instances (project ${kicadString("schemagic_export")} (path ${kicadString(`/${rootUuid}`)} (reference ${kicadString(exported.reference)}) (unit 1))))
  )`;
}

function graphicalWireMarkup(
  metadata: Readonly<CandidateKicadSchematicMetadataV2>,
  wire: Readonly<CandidateKicadSchematicWireV2>,
  layout: Readonly<Layout>,
): string {
  const points = wire.points.map((point) => {
    const mapped = layout.mapPoint(point);
    return `(xy ${numberText(mapped[0])} ${numberText(mapped[1])})`;
  }).join(" ");
  return `  (polyline (pts ${points}) (stroke (width 0.254) (type solid)) (uuid ${kicadString(stableUuid(`${metadata.designResultRef.contentHash}\nwire:${wire.wireId}`))}))`;
}

function connectivityLabelsMarkup(
  metadata: Readonly<CandidateKicadSchematicMetadataV2>,
  layout: Readonly<Layout>,
): string[] {
  const labels = new Map<string, { point: Point; netLabel: string; justification: "left" | "right" }>();
  for (const component of metadata.components) {
    const circuitComponent = componentById(metadata, component.componentId);
    for (const pin of component.pins) {
      labels.set(`${pointKey(pin.point)}\u0000${pin.netLabel}`, {
        point: pin.point,
        netLabel: pin.netLabel,
        justification: pin.point[0] > circuitComponent.pos[0] ? "left" : "right",
      });
    }
  }
  return [...labels.values()]
    .sort((left, right) => compareText(`${left.netLabel}\n${pointKey(left.point)}`, `${right.netLabel}\n${pointKey(right.point)}`))
    .map(({ point, netLabel, justification }) => {
      const mapped = layout.mapPoint(point);
      return `  (label ${kicadString(netLabel)} (at ${numberText(mapped[0])} ${numberText(mapped[1])} 0) ${effects(false, justification)} (uuid ${kicadString(stableUuid(`${metadata.designResultRef.contentHash}\nlabel:${netLabel}:${pointKey(point)}`))}))`;
    });
}

function render(
  metadata: Readonly<CandidateKicadSchematicMetadataV2>,
  customized?: Readonly<{ canonicalMetadata: string }>,
): string {
  const layout = layoutFor(metadata);
  const rootUuid = stableUuid(`${metadata.designResultRef.contentHash}\n${metadata.candidateRef.id}\n${metadata.circuit.id}\nroot`);
  const noticeLines = wrappedNoticeLines(metadata.visibleNotices);
  const libraries = metadata.components.map((component) => librarySymbolMarkup(metadata, component)).join("\n");
  const notices = noticeLines.map((line, index) => `  (text ${kicadString(line)} (at ${numberText(PAGE_MARGIN_MM)} ${numberText(NOTICE_TOP_MM + index * NOTICE_LINE_MM)} 0) ${effects(false, "left")} (uuid ${kicadString(stableUuid(`${metadata.designResultRef.contentHash}\nnotice:${index}:${line}`))}))`).join("\n");
  const graphicalWires = metadata.wires.map((wire) => graphicalWireMarkup(metadata, wire, layout)).join("\n");
  const labels = connectivityLabelsMarkup(metadata, layout).join("\n");
  const symbols = metadata.components.map((component) => symbolInstanceMarkup(
    metadata,
    component,
    layout,
    rootUuid,
    customized,
  )).join("\n");
  const file = `(kicad_sch
  (version ${KICAD_VERSION})
  (generator ${kicadString(GENERATOR)})
  (generator_version ${kicadString(GENERATOR_VERSION)})
  (uuid ${kicadString(rootUuid)})
  (paper ${kicadString("User")} ${numberText(layout.paperWidth)} ${numberText(layout.paperHeight)})
  (title_block (title ${kicadString(metadata.circuit.title)}) (rev ${kicadString(customized === undefined ? "structural-v2" : "customized-target-inspection-v1")}) (company ${kicadString("scheMAGIC")}) (comment 1 ${kicadString("External KiCad open verification: UNVERIFIED")}) (comment 2 ${kicadString("Footprints intentionally unavailable")}) (comment 3 ${kicadString(`Result ${metadata.designResultRef.contentHash}`)}))
  (lib_symbols
${libraries}
  )
${notices}
${graphicalWires}
${labels}
${symbols}
  (sheet_instances (path ${kicadString("/")} (page ${kicadString("1")})))
  (embedded_fonts no)
)
`;
  if (new TextEncoder().encode(file).byteLength > MAX_KICAD_BYTES) {
    throw new TypeError("KiCad schematic exceeds the deterministic artifact byte limit");
  }
  return file;
}

/** @internal Rendering seam used only for deterministic format tests. */
export function _renderCandidateKicadSchematicV2ForTest(
  metadata: Readonly<CandidateKicadSchematicMetadataV2>,
): string {
  return render(metadata);
}

/** @internal Unlabelled projection payload used to hash customized-target content. */
export function _renderCandidateKicadSchematicV2PayloadFromProjection(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV4>,
  manifest: Readonly<ElectricalDesignContextManifestV2>,
  executionContext: Readonly<DesignResultExecutionContextV2>,
): string {
  return render(metadataFor(result, candidate, circuit, manifest, executionContext));
}

/** @internal Installed-context renderer; intentionally absent from public package facades. */
export function _renderCandidateKicadSchematicV2FromProjection(
  result: Readonly<DesignResultV2>,
  candidate: Readonly<DesignCandidateV2>,
  circuit: Readonly<CircuitGraphV4>,
  manifest: Readonly<ElectricalDesignContextManifestV2>,
  executionContext: Readonly<DesignResultExecutionContextV2>,
  extension: Readonly<{
    kind: "customized_target_inspection";
    canonicalMetadata: string;
  }>,
): string {
  if (extension.kind !== "customized_target_inspection") {
    throw new TypeError("Unsupported KiCad projection extension");
  }
  const metadata = metadataFor(result, candidate, circuit, manifest, executionContext);
  const customizedMetadata: CandidateKicadSchematicMetadataV2 = {
    ...metadata,
    visibleNotices: [
      "CUSTOMIZED TARGET - INSPECTION ONLY; not ordinary-result, eligibility, ranking, commercial, or release evidence.",
      "No selected-part model or simulation samples; physical implementation is unverified; attestation is none.",
      "Footprints intentionally empty; external KiCad open verification UNVERIFIED; no KiCad attestation.",
      ...metadata.visibleNotices,
    ],
  };
  return render(customizedMetadata, { canonicalMetadata: extension.canonicalMetadata });
}

function parsedResultAndContexts(
  resultInput: Readonly<DesignResultV2>,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
  executionContext: Readonly<DesignResultExecutionContextV2>,
): DesignResultV2 {
  let result: DesignResultV2;
  try {
    result = parseDesignResultV2(resultInput);
  } catch {
    throw new CandidateKicadSchematicExportErrorV2("invalid_result");
  }
  const engineeringIssues = validateDesignResultEngineeringContextV2(result, engineeringContext);
  if (engineeringIssues.length > 0) {
    throw new CandidateKicadSchematicExportErrorV2("engineering_context_unverified", engineeringIssues);
  }
  const executionIssues = validateDesignResultExecutionContextV2(result, executionContext);
  if (executionIssues.length > 0) {
    throw new CandidateKicadSchematicExportErrorV2("execution_context_unverified", executionIssues);
  }
  return result;
}

/**
 * Export one exact selected-candidate V2 circuit as deterministic KiCad text.
 *
 * Symbols and geometry are authored by this project. Footprints and simulation
 * data are intentionally absent. Successful parsing proves internal bytes and
 * semantics, not that an external KiCad build opened the file.
 */
export function exportDesignResultKicadSchematicV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  circuitId: string,
  options: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    executionContext: DesignResultExecutionContextV2;
  }>,
): string {
  const result = parsedResultAndContexts(resultInput, options.engineeringContext, options.executionContext);
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new CandidateKicadSchematicExportErrorV2("candidate_not_found");
  const circuit = candidate.circuit.circuits.find((entry) => entry.id === circuitId);
  if (circuit === undefined) throw new CandidateKicadSchematicExportErrorV2("circuit_not_found");
  try {
    return render(metadataFor(
      result,
      candidate,
      circuit,
      options.engineeringContext.manifest,
      options.executionContext,
    ));
  } catch {
    throw new CandidateKicadSchematicExportErrorV2("render_failed");
  }
}

type SExpression =
  | { kind: "atom" | "string"; value: string }
  | { kind: "list"; items: SExpression[] };

function parseSExpression(source: string): SExpression {
  if (new TextEncoder().encode(source).byteLength > MAX_KICAD_BYTES) {
    throw new CandidateKicadSchematicExportErrorV2("invalid_kicad_schematic");
  }
  let index = 0;
  let nodes = 0;
  const whitespace = (character: string | undefined): boolean => character !== undefined && /\s/u.test(character);
  const skip = (): void => { while (whitespace(source[index])) index += 1; };
  const value = (depth: number): SExpression => {
    nodes += 1;
    if (nodes > MAX_SEXPRESSION_NODES || depth > MAX_SEXPRESSION_DEPTH) throw new TypeError("KiCad S-expression resource limit");
    skip();
    if (source[index] === "(") {
      index += 1;
      const items: SExpression[] = [];
      while (true) {
        skip();
        if (source[index] === ")") { index += 1; return { kind: "list", items }; }
        if (source[index] === undefined) throw new TypeError("Unclosed KiCad S-expression");
        items.push(value(depth + 1));
      }
    }
    if (source[index] === '"') {
      const start = index;
      index += 1;
      let escaped = false;
      while (index < source.length) {
        const character = source[index++]!;
        if (escaped) { escaped = false; continue; }
        if (character === "\\") { escaped = true; continue; }
        if (character === '"') {
          const decoded = JSON.parse(source.slice(start, index)) as unknown;
          if (typeof decoded !== "string") throw new TypeError("Invalid KiCad string");
          return { kind: "string", value: decoded };
        }
        if (character.charCodeAt(0) < 0x20) throw new TypeError("Control character in KiCad string");
      }
      throw new TypeError("Unclosed KiCad string");
    }
    const start = index;
    while (source[index] !== undefined && !whitespace(source[index]) && source[index] !== "(" && source[index] !== ")") index += 1;
    if (start === index) throw new TypeError("Invalid KiCad atom");
    return { kind: "atom", value: source.slice(start, index) };
  };
  try {
    skip();
    const root = value(0);
    skip();
    if (index !== source.length) throw new TypeError("Trailing KiCad data");
    return root;
  } catch (error) {
    if (error instanceof CandidateKicadSchematicExportErrorV2) throw error;
    throw new CandidateKicadSchematicExportErrorV2("invalid_kicad_schematic");
  }
}

function listHead(value: SExpression): string | undefined {
  if (value.kind !== "list") return undefined;
  const head = value.items[0];
  return head?.kind === "atom" ? head.value : undefined;
}

function directLists(root: SExpression, head: string): Extract<SExpression, { kind: "list" }>[] {
  if (root.kind !== "list") return [];
  return root.items.filter((entry): entry is Extract<SExpression, { kind: "list" }> => listHead(entry) === head);
}

function scalarValue(value: SExpression | undefined): string | undefined {
  return value?.kind === "atom" || value?.kind === "string" ? value.value : undefined;
}

function basicMetadata(value: unknown): value is CandidateKicadSchematicMetadataV2 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Partial<CandidateKicadSchematicMetadataV2>;
  return metadata.format === "schemagic-kicad-schematic-metadata"
    && metadata.schemaVersion === 2
    && metadata.artifactKind === "structural_kicad_schematic"
    && metadata.kicadFormat?.extension === ".kicad_sch"
    && metadata.kicadFormat.syntaxVersion === KICAD_VERSION
    && metadata.kicadFormat.generator === GENERATOR
    && metadata.kicadFormat.symbols === "project_authored"
    && metadata.kicadFormat.externalOpenVerification === "unverified"
    && metadata.fidelity?.circuit === "exact_persisted_v2_structure"
    && metadata.fidelity.simulationData === "not_included"
    && metadata.fidelity.physicalModel === "not_claimed"
    && metadata.fidelity.footprintMapping === "unavailable"
    && metadata.connectivityEncoding?.electrical === "local_labels_from_exact_point_union"
    && metadata.connectivityEncoding.wireGeometry === "project_authored_graphical_polylines"
    && typeof metadata.designResultRef?.contentHash === "string" && HASH.test(metadata.designResultRef.contentHash)
    && typeof metadata.engineeringContextRef?.manifestContentHash === "string" && HASH.test(metadata.engineeringContextRef.manifestContentHash)
    && (metadata.executionContextState === "verified_against_persisted_coverage"
      || metadata.executionContextState === "not_applicable_no_authored_scenarios")
    && typeof metadata.candidateRef?.id === "string"
    && typeof metadata.circuit?.id === "string"
    && Array.isArray(metadata.components)
    && Array.isArray(metadata.wires)
    && Array.isArray(metadata.scenarios)
    && Array.isArray(metadata.visibleNotices);
}

function extractMetadata(file: string): CandidateKicadSchematicMetadataV2 {
  const root = parseSExpression(file);
  if (listHead(root) !== "kicad_sch") throw new CandidateKicadSchematicExportErrorV2("invalid_kicad_schematic");
  const version = directLists(root, "version");
  const generator = directLists(root, "generator");
  const generatorVersion = directLists(root, "generator_version");
  if (version.length !== 1 || scalarValue(version[0]!.items[1]) !== String(KICAD_VERSION)
    || generator.length !== 1 || scalarValue(generator[0]!.items[1]) !== GENERATOR
    || generatorVersion.length !== 1 || scalarValue(generatorVersion[0]!.items[1]) !== GENERATOR_VERSION
    || directLists(root, "lib_symbols").length !== 1
    || directLists(root, "sheet_instances").length !== 1) {
    throw new CandidateKicadSchematicExportErrorV2("invalid_kicad_schematic");
  }
  const metadataTexts = directLists(root, "symbol")
    .flatMap((symbol) => directLists(symbol, "property"))
    .filter((entry) => scalarValue(entry.items[1]) === METADATA_PROPERTY)
    .map((entry) => scalarValue(entry.items[2]))
    .filter((value): value is string => value?.startsWith(METADATA_PREFIX) === true);
  if (metadataTexts.length !== 1) throw new CandidateKicadSchematicExportErrorV2("invalid_kicad_schematic");
  try {
    const raw = metadataTexts[0]!.slice(METADATA_PREFIX.length);
    const parsed = JSON.parse(raw) as unknown;
    if (!basicMetadata(parsed) || canonicalDesignV2Payload(parsed) !== raw) throw new TypeError("Non-canonical KiCad metadata");
    return parsed;
  } catch {
    throw new CandidateKicadSchematicExportErrorV2("invalid_kicad_schematic");
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

/**
 * Parse and semantically verify a KiCad schematic against the exact V2 result
 * and contexts. Any metadata, property, symbol, connectivity, or byte drift is
 * rejected. This does not claim verification by an external KiCad build.
 */
export function parseDesignResultKicadSchematicV2(
  file: string,
  resultInput: Readonly<DesignResultV2>,
  options: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    executionContext: DesignResultExecutionContextV2;
  }>,
): Readonly<CandidateKicadSchematicMetadataV2> {
  const result = parsedResultAndContexts(resultInput, options.engineeringContext, options.executionContext);
  const parsed = extractMetadata(file);
  const candidate = result.candidates.find((entry) => entry.id === parsed.candidateRef?.id);
  const circuit = candidate?.circuit.circuits.find((entry) => entry.id === parsed.circuit?.id);
  if (candidate === undefined || circuit === undefined) {
    throw new CandidateKicadSchematicExportErrorV2("artifact_unverified");
  }
  try {
    const expected = metadataFor(
      result,
      candidate,
      circuit,
      options.engineeringContext.manifest,
      options.executionContext,
    );
    if (canonicalDesignV2Payload(parsed) !== canonicalDesignV2Payload(expected) || file !== render(expected)) {
      throw new CandidateKicadSchematicExportErrorV2("artifact_unverified");
    }
    return deepFreeze(structuredClone(expected));
  } catch (error) {
    if (error instanceof CandidateKicadSchematicExportErrorV2) throw error;
    throw new CandidateKicadSchematicExportErrorV2("artifact_unverified");
  }
}
