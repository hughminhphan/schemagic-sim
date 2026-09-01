import {
  calculateDesignBlockContentHash,
  type CircuitComponentV4,
  type CircuitDocumentV4,
  type CircuitWire,
  type DesignBlockDefinition,
} from "@opencircuit/circuit-schema";
import {
  compareDesignV2Tokens,
  type Quantity,
  type SelectedComponent,
} from "@opencircuit/design-schema";
import { createPowerNativeExternalFactsV3Recipe } from "./power-v2";
import type { NativeCandidateV2, NativeMaterializationV2, NativeRecipeV2 } from "./types";

const PRIMARY_CLASS = "power.external-fet-synchronous-buck-controller";
const TOPOLOGY = "power.buck.controller-external-nmos";

const RELEASE = {
  id: "power.native.external-fet-synchronous-buck.facts-v3",
  version: "3.0.0",
  primaryScope: {
    partClass: PRIMARY_CLASS,
    factsSchemaVersion: "2.0.0",
    topologyFamily: TOPOLOGY,
  },
  profileFactsSchemaVersions: {
    controller: "2.0.0",
    mosfet: "3.0.0",
    passives: "2.0.0",
  },
  equations: [
    "power.connected-external-fet-structural-bom-binding.v1",
    "power.configured-production-spread.v2",
    "power.feedback-divider.v2",
    "power.mounted-geometry-ranking-proxy.v2",
  ],
} as const;

const EXPECTED_COMPONENT_IDS = [
  "current-sense-resistor",
  "feedback-lower",
  "feedback-upper",
  "high-side-mosfet",
  "input-capacitor",
  "low-side-mosfet",
  "output-capacitor",
  "power-inductor",
  "primary",
] as const;

function isExternalData(data: Readonly<Record<string, null | boolean | number | string>>): boolean {
  return data.primaryPartClass === PRIMARY_CLASS;
}

function exactComponent(candidate: Readonly<NativeCandidateV2>, id: string): SelectedComponent {
  const component = candidate.components.find((entry) => entry.id === id);
  if (component === undefined) {
    throw new TypeError(`External-FET facts-V3 structural materialization requires BOM line ${id}`);
  }
  if (component.quantityPerAssembly !== 1) {
    throw new TypeError(`External-FET facts-V3 structural materialization requires exactly one ${id}`);
  }
  return component;
}

function exactPassive(
  candidate: Readonly<NativeCandidateV2>,
  id: string,
  type: "capacitor" | "inductor" | "resistor",
  pos: [number, number],
  rot: 0 | 90,
): CircuitComponentV4 {
  const component = exactComponent(candidate, id);
  if (component.value === undefined) {
    throw new TypeError(`External-FET facts-V3 structural materialization requires an exact value for ${id}`);
  }
  return {
    id,
    type,
    value: (component.value as Quantity).value,
    mpn: component.part.manufacturerPartNumber,
    pos,
    rot,
    mirror: false,
  };
}

function definition(payload: Omit<DesignBlockDefinition, "contentHash">): DesignBlockDefinition {
  return { ...payload, contentHash: calculateDesignBlockContentHash(payload) };
}

function materializeExternalStructuralBom(candidate: Readonly<NativeCandidateV2>): NativeMaterializationV2 {
  if (candidate.recipeId !== RELEASE.id || !isExternalData(candidate.data)) {
    throw new TypeError("External-FET facts-V3 structural materialization requires its exact dedicated recipe candidate");
  }
  const componentIds = candidate.components.map((component) => component.id).sort(compareDesignV2Tokens);
  if (
    componentIds.length !== EXPECTED_COMPONENT_IDS.length
    || new Set(componentIds).size !== componentIds.length
    || componentIds.some((id, index) => id !== EXPECTED_COMPONENT_IDS[index])
  ) {
    throw new TypeError("External-FET facts-V3 structural materialization requires the exact nine-line selected BOM");
  }

  const primary = exactComponent(candidate, "primary");
  const highSide = exactComponent(candidate, "high-side-mosfet");
  const lowSide = exactComponent(candidate, "low-side-mosfet");
  const controllerBlock = definition({
    id: "power.external-fet-synchronous-buck-controller.exact-part",
    version: "structural-v1",
    title: "Exact selected external-FET synchronous-buck controller",
    pins: [
      { id: "input-supply", name: "INPUT SUPPLY", offset: [-12, -8] },
      { id: "ground", name: "GROUND", offset: [-12, 8] },
      { id: "high-side-gate", name: "HIGH-SIDE GATE", offset: [12, -8] },
      { id: "low-side-gate", name: "LOW-SIDE GATE", offset: [12, 0] },
      { id: "feedback", name: "FEEDBACK", offset: [12, 8] },
      { id: "current-sense", name: "CURRENT SENSE", offset: [0, 12] },
    ],
    netlist: {
      kind: "schematic_only",
      reason: "No reviewed executable model or package-pin mapping is bundled for the exact selected controller; these are generic functional structural ports only.",
    },
  });
  const mosfetBlock = definition({
    id: "shared.n-channel-power-mosfet.exact-part",
    version: "structural-v1",
    title: "Exact selected N-channel power MOSFET",
    pins: [
      { id: "drain", name: "DRAIN", offset: [0, -8] },
      { id: "source", name: "SOURCE", offset: [0, 8] },
      { id: "gate", name: "GATE", offset: [-8, 0] },
    ],
    netlist: {
      kind: "schematic_only",
      reason: "No reviewed executable model or package-pin mapping is bundled for the exact selected MOSFET; these are generic functional structural ports only.",
    },
  });
  const blockRef = (block: DesignBlockDefinition) => ({
    id: block.id,
    version: block.version,
    contentHash: block.contentHash,
  });
  const components: CircuitComponentV4[] = [
    exactPassive(candidate, "current-sense-resistor", "resistor", [36, 32], 90),
    exactPassive(candidate, "feedback-lower", "resistor", [72, 24], 90),
    exactPassive(candidate, "feedback-upper", "resistor", [72, 16], 90),
    { id: "ground", type: "ground", pos: [0, 40], rot: 0, mirror: false },
    {
      id: "high-side-mosfet",
      type: "design_block",
      block: blockRef(mosfetBlock),
      mpn: highSide.part.manufacturerPartNumber,
      pos: [36, -4],
      rot: 0,
      mirror: false,
    },
    exactPassive(candidate, "input-capacitor", "capacitor", [-24, 0], 90),
    {
      id: "low-side-mosfet",
      type: "design_block",
      block: blockRef(mosfetBlock),
      mpn: lowSide.part.manufacturerPartNumber,
      pos: [36, 20],
      rot: 0,
      mirror: false,
    },
    exactPassive(candidate, "output-capacitor", "capacitor", [64, 20], 90),
    exactPassive(candidate, "power-inductor", "inductor", [48, 8], 0),
    {
      id: "primary",
      type: "design_block",
      block: blockRef(controllerBlock),
      mpn: primary.part.manufacturerPartNumber,
      pos: [0, 0],
      rot: 0,
      mirror: false,
    },
  ];
  const wires: CircuitWire[] = [
    { id: "net-controller-ground", points: [[-12, 8], [-12, 40]] },
    { id: "net-current-sense-low-side", points: [[36, 28], [36, 30]] },
    { id: "net-current-sense-return", points: [[36, 34], [36, 40]] },
    { id: "net-current-sense-signal", points: [[0, 12], [4, 12], [4, 30], [36, 30]] },
    { id: "net-feedback-divider", points: [[12, 8], [20, 8], [20, 20], [72, 20]] },
    { id: "net-feedback-lower", points: [[72, 22], [72, 20]] },
    { id: "net-feedback-return", points: [[72, 26], [72, 40]] },
    { id: "net-feedback-upper", points: [[72, 18], [72, 20]] },
    { id: "net-ground-bus", points: [[-24, 40], [0, 40], [36, 40], [64, 40], [72, 40]] },
    { id: "net-high-side-gate", points: [[12, -8], [20, -8], [20, -4], [28, -4]] },
    { id: "net-input-capacitor-return", points: [[-24, 2], [-24, 40]] },
    { id: "net-input-capacitor-supply", points: [[-24, -12], [-24, -2]] },
    { id: "net-input-supply", points: [[-32, -12], [-24, -12], [-12, -12], [36, -12]] },
    { id: "net-input-supply-controller", points: [[-12, -12], [-12, -8]] },
    { id: "net-low-side-gate", points: [[12, 0], [24, 0], [24, 20], [28, 20]] },
    { id: "net-output", points: [[50, 8], [64, 8], [72, 8], [80, 8]] },
    { id: "net-output-capacitor", points: [[64, 8], [64, 18]] },
    { id: "net-output-capacitor-return", points: [[64, 22], [64, 40]] },
    { id: "net-output-feedback", points: [[72, 8], [72, 14]] },
    { id: "net-switch-high-side", points: [[36, 4], [36, 8], [46, 8]] },
    { id: "net-switch-low-side", points: [[36, 12], [36, 8]] },
  ];
  const circuit: CircuitDocumentV4 = {
    format: "opencircuit-circuit",
    version: 4,
    meta: {
      title: "Catalog-native mixed facts-V2/V3 external-FET synchronous buck structural schematic",
      description: "Connected exact-BOM structure only; it provides no regulation, simulation, performance, package-pin, or selected-part fidelity claim.",
    },
    designBlocks: [controllerBlock, mosfetBlock].sort((left, right) => compareDesignV2Tokens(left.id, right.id)),
    circuits: [{
      id: "assembly",
      title: "External-FET synchronous-buck structural assembly",
      components,
      wires: wires.sort((left, right) => compareDesignV2Tokens(left.id, right.id)),
      probes: [],
    }],
    scenarios: [],
    defaultCircuitId: "assembly",
    defaultScenarioId: null,
  };
  return {
    circuit,
    circuitInstanceClassifications: [
      ...candidate.components.map((component) => ({
        circuitId: "assembly",
        componentId: component.id,
        kind: "physical" as const,
        selectedComponentId: component.id,
        representedQuantityPerAssembly: component.quantityPerAssembly,
      })),
      { circuitId: "assembly", componentId: "ground", kind: "non_bom" as const, reason: "Ground is a schematic reference, not a BOM line." },
    ].sort((left, right) => compareDesignV2Tokens(left.componentId, right.componentId)),
    circuitBomNonRepresentations: [],
  };
}

/** Dedicated mixed-schema external-FET leaf; every callback is class-restricted before catalog parsing. */
export const POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3: NativeRecipeV2 =
  createPowerNativeExternalFactsV3Recipe(RELEASE, materializeExternalStructuralBom);
