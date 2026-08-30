import { generateNetlist, resolveVoltageProbeNodes, validateCircuit, type CircuitDocument } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { compactDocumentWires } from "./index";

function voltageExpression(wireId: string) {
  return {
    kind: "voltage" as const,
    positive: { kind: "schematic-wire" as const, wireId },
    negative: { kind: "runtime-node" as const, name: "0" },
  };
}

function voltageProbe(wireId: string) {
  return { id: "p2", expressionVersion: 1 as const, expression: voltageExpression(wireId) };
}

describe("probe-safe wire normalization", () => {
  it("retargets the MOSFET LED probe to its deterministic surviving connected wire", () => {
    const document: CircuitDocument = {
      format: "opencircuit-circuit",
      version: 3,
      meta: { title: "MOSFET LED probe normalization" },
      components: [
        { id: "c8", type: "led", pos: [52, 20], rot: 0, mirror: false },
        { id: "c9", type: "nmos", pos: [50, 26], rot: 0, mirror: false },
        { id: "c13", type: "ground", pos: [52, 30], rot: 0, mirror: false },
      ],
      wires: [
        { id: "w9", points: [[52, 22], [56, 22]] },
        { id: "migration-v1-v2-1", points: [[52, 23], [52, 22]] },
        { id: "w8", points: [[52, 22], [52, 22]] },
        { id: "source-ground", points: [[52, 29], [52, 30]] },
      ],
      probes: [
        voltageProbe("w8"),
        {
          id: "nested",
          expressionVersion: 1,
          expression: {
            kind: "call",
            function: "db20",
            arguments: [{
              kind: "call",
              function: "mag",
              arguments: [{ kind: "binary", operator: "/", left: voltageExpression("w8"), right: voltageExpression("w9") }],
            }],
          },
        },
      ],
      sim: { mode: "op" },
    };

    compactDocumentWires(document);

    expect(document.wires.some((wire) => wire.id === "w8")).toBe(false);
    expect(document.wires.every((wire) => wire.points.length >= 2 && wire.points.some((point) => point[0] !== wire.points[0]![0] || point[1] !== wire.points[0]![1]))).toBe(true);
    expect(document.probes[0]!.expression).toMatchObject({
      kind: "voltage",
      positive: { kind: "schematic-wire", wireId: "migration-v1-v2-1" },
    });
    expect(document.probes[1]!.expression).toMatchObject({
      kind: "call",
      arguments: [{
        kind: "call",
        arguments: [{
          kind: "binary",
          left: { kind: "voltage", positive: { kind: "schematic-wire", wireId: "migration-v1-v2-1" } },
          right: { kind: "voltage", positive: { kind: "schematic-wire", wireId: "w9" } },
        }],
      }],
    });
    expect(JSON.stringify(document.probes)).not.toContain('"wireId":"w8"');
    expect(validateCircuit(document)).toEqual([]);
    const generated = generateNetlist(document);
    expect(generated.wireNodes["migration-v1-v2-1"]).toBeDefined();
  });

  it("retargets an isolated coincident legacy wire probe to a stable component pin", () => {
    const document: CircuitDocument = {
      format: "opencircuit-circuit",
      version: 3,
      meta: { title: "Coincident pin probe normalization" },
      components: [
        { id: "r1", type: "resistor", value: "1k", pos: [5, 0], rot: 0, mirror: false },
        { id: "g1", type: "ground", pos: [7, 0], rot: 0, mirror: false },
      ],
      wires: [{ id: "w1", points: [[3, 0], [3, 0]] }],
      probes: [voltageProbe("w1")],
      sim: { mode: "op" },
    };

    compactDocumentWires(document);

    expect(document.wires).toEqual([]);
    expect(document.probes[0]!.expression).toMatchObject({
      kind: "voltage",
      positive: { kind: "schematic-pin", componentId: "r1", pin: 0 },
    });
    expect(validateCircuit(document)).toEqual([]);
    const generated = generateNetlist(document);
    const resolved = resolveVoltageProbeNodes(document.probes[0]!, generated.componentNodes, generated.wireNodes);
    expect(resolved).toEqual({ positiveNode: generated.componentNodes["r1"]![0], negativeNode: "0" });
    expect(resolved!.positiveNode).not.toBe(resolved!.negativeNode);
  });

  it("treats a collinear backtrack as degenerate and retargets its probe to a real wire", () => {
    const document: CircuitDocument = {
      format: "opencircuit-circuit",
      version: 3,
      meta: { title: "Backtracking probe normalization" },
      components: [{ id: "g1", type: "ground", pos: [2, 4], rot: 0, mirror: false }],
      wires: [
        { id: "backtrack", points: [[2, 2], [4, 2], [2, 2]] },
        { id: "survivor", points: [[2, 2], [2, 4]] },
      ],
      probes: [voltageProbe("backtrack")],
      sim: { mode: "op" },
    };

    compactDocumentWires(document);

    expect(document.wires).toEqual([{ id: "survivor", points: [[2, 2], [2, 4]] }]);
    expect(document.probes[0]!.expression).toMatchObject({
      kind: "voltage",
      positive: { kind: "schematic-wire", wireId: "survivor" },
    });
    expect(validateCircuit(document)).toEqual([]);
  });

  it("does not invent connectivity for a degenerate point inside an unsplit wire segment", () => {
    const document: CircuitDocument = {
      format: "opencircuit-circuit",
      version: 3,
      meta: { title: "Interior point probe normalization" },
      components: [{ id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false }],
      wires: [
        { id: "survivor", points: [[0, 0], [10, 0]] },
        { id: "orphan", points: [[5, 0], [5, 0]] },
      ],
      probes: [voltageProbe("orphan")],
      sim: { mode: "op" },
    };
    const before = generateNetlist(document);
    expect(before.wireNodes["orphan"]).not.toBe(before.wireNodes["survivor"]);

    compactDocumentWires(document);

    expect(document.wires).toEqual([{ id: "survivor", points: [[0, 0], [10, 0]] }]);
    expect(document.probes).toEqual([]);
    expect(validateCircuit(document)).toEqual([]);
  });

  it("removes an unresolvable probe and dependent analysis instead of emitting a duplicate-point wire", () => {
    const document: CircuitDocument = {
      format: "opencircuit-circuit",
      version: 3,
      meta: { title: "Unresolvable coincident probe normalization" },
      components: [
        { id: "v1", type: "vsource", value: 1, pos: [10, 10], rot: 0, mirror: false },
        { id: "g1", type: "ground", pos: [10, 14], rot: 0, mirror: false },
      ],
      wires: [{ id: "w1", points: [[2, 2], [2, 2]] }],
      probes: [
        voltageProbe("w1"),
        {
          id: "runtime",
          expressionVersion: 1,
          expression: {
            kind: "voltage",
            positive: { kind: "runtime-node", name: "out" },
            negative: { kind: "runtime-node", name: "0" },
          },
        },
      ],
      sim: {
        mode: "op",
        noise: {
          outputProbeId: "p2",
          inputSourceId: "v1",
          fstart: 10,
          fstop: 1_000_000,
          pointsPerDecade: 30,
          sweep: "dec",
          temperatureC: 27,
        },
      },
    };

    compactDocumentWires(document);

    expect(document.wires).toEqual([]);
    expect(document.probes.map((probe) => probe.id)).toEqual(["runtime"]);
    expect(document.sim.noise).toBeUndefined();
    expect(validateCircuit(document)).toEqual([]);

    const normalized = structuredClone(document);
    compactDocumentWires(document);
    expect(document).toEqual(normalized);
  });
});
