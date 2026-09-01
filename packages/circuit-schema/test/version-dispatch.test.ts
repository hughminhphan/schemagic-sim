import { describe, expect, it } from "vitest";
import {
  deserializeAnyCircuit,
  deserializeCircuit,
  deserializeCircuitV4,
  componentPinPoints,
  componentPinPointsV4,
  migrateCircuit,
  type CircuitDocument,
  type CircuitDocumentV1,
  type CircuitDocumentV2,
  type CircuitDocumentV4,
} from "../src";

const ground = { id: "g1", type: "ground" as const, pos: [0, 0] as [number, number], rot: 0 as const, mirror: false };

const simulatorV1: CircuitDocumentV1 = {
  format: "opencircuit-circuit",
  version: 1,
  meta: { title: "Simulator V1" },
  components: [ground],
  wires: [],
  probes: [],
  sim: { mode: "op" },
};

const simulatorV2: CircuitDocumentV2 = {
  ...structuredClone(simulatorV1),
  version: 2,
  meta: { title: "Simulator V2" },
};

const simulatorV3: CircuitDocument = {
  ...structuredClone(simulatorV1),
  version: 3,
  meta: { title: "Simulator V3" },
  probes: [],
};

const designerV4: CircuitDocumentV4 = {
  format: "opencircuit-circuit",
  version: 4,
  meta: { title: "Designer V4" },
  designBlocks: [],
  circuits: [{ id: "main", title: "Main", components: [ground], wires: [], probes: [] }],
  scenarios: [{ id: "op", title: "Operating point", circuitId: "main", config: { mode: "op" } }],
  defaultCircuitId: "main",
  defaultScenarioId: "op",
};

describe("circuit document version dispatch", () => {
  it.each([
    ["V1", simulatorV1],
    ["V2", simulatorV2],
    ["V3", simulatorV3],
  ] as const)("loads flat Simulator %s documents through the V3 migration path", (_label, input) => {
    const document = deserializeAnyCircuit(JSON.stringify(input));
    expect(document.version).toBe(3);
    expect("components" in document).toBe(true);
    expect("circuits" in document).toBe(false);
  });

  it("loads multi-circuit Designer documents only as V4", () => {
    const document = deserializeAnyCircuit(JSON.stringify(designerV4));
    expect(document.version).toBe(4);
    expect("circuits" in document).toBe(true);
    expect("components" in document).toBe(false);
    expect(deserializeCircuitV4(JSON.stringify(designerV4))).toEqual(document);
  });

  it("does not reinterpret a Designer-shaped payload carrying legacy version 2", () => {
    const colliding = { ...designerV4, version: 2 };
    expect(() => deserializeAnyCircuit(JSON.stringify(colliding))).toThrow();
  });

  it("does not reinterpret a flat Simulator payload carrying version 4", () => {
    const colliding = { ...simulatorV3, version: 4 };
    expect(() => deserializeAnyCircuit(JSON.stringify(colliding))).toThrow();
    expect(() => deserializeCircuitV4(JSON.stringify(colliding))).toThrow();
  });

  it("keeps the Simulator migrator V1/V2/V3-only", () => {
    expect(migrateCircuit(simulatorV1).version).toBe(3);
    expect(migrateCircuit(simulatorV2).version).toBe(3);
    expect(migrateCircuit(simulatorV3).version).toBe(3);
    expect(() => migrateCircuit(designerV4)).toThrow(/Unsupported circuit document version 4/);
    expect(deserializeCircuit(JSON.stringify(simulatorV3)).version).toBe(3);
  });

  it("keeps Designer V4 topology independent from Simulator V3 symbol geometry", () => {
    const component = { id: "m1", type: "nmos" as const, pos: [10, 10] as [number, number], rot: 0 as const, mirror: false };
    expect(componentPinPoints(component)).toEqual([[12, 7], [8, 10], [12, 13]]);
    expect(componentPinPointsV4(component, [])).toEqual([[12, 6], [8, 10], [12, 14]]);
  });
});
