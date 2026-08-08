import { describe, expect, it } from "vitest";
import { DC_SWEEP_MAX_POINTS, PARTS, canonicalizeCircuit, deserializeCircuit, generateNetlist, inspectDCSweepConfig, migrateCircuit, type CircuitComponent, type CircuitDocument } from "../src";

const base: CircuitDocument = {
  format: "opencircuit-circuit",
  version: 1,
  meta: { title: "test" },
  components: [
    { id: "c1", type: "vsource", value: 5, pos: [0, 2], rot: 0, mirror: false },
    { id: "c2", type: "ground", pos: [0, 4], rot: 0, mirror: false },
  ],
  wires: [],
  probes: [],
  sim: { mode: "op" },
};

describe("circuit schema", () => {
  it("round trips canonical undo snapshots deterministically", () => {
    const snapshot = canonicalizeCircuit({ ...base, components: [...base.components].reverse() });
    expect(canonicalizeCircuit(deserializeCircuit(snapshot))).toBe(snapshot);
    expect(snapshot).toBe(canonicalizeCircuit(deserializeCircuit(snapshot)));
  });

  it("excludes view from hash netlist equality", () => {
    expect(generateNetlist({ ...base, view: { pan: [2, 3], zoom: 2 } }).netlist)
      .toBe(generateNetlist({ ...base, view: { pan: [99, 1], zoom: 0.5 } }).netlist);
  });

  it("validates DC sweep direction and total point limits", () => {
    expect(inspectDCSweepConfig(base, { sourceId: "c1", start: 0, stop: 5, step: -0.1 }).issues[0]?.message)
      .toMatch(/step sign/i);
    const tooLarge = inspectDCSweepConfig(base, {
      sourceId: "c1",
      start: 0,
      stop: 5,
      step: 5 / DC_SWEEP_MAX_POINTS,
    });
    expect(tooLarge.issues[0]?.message).toContain(DC_SWEEP_MAX_POINTS.toLocaleString());
  });

  it("defaults missing settings when loading a DC sweep workspace", () => {
    const migrated = migrateCircuit({ ...structuredClone(base), sim: { mode: "dc-sweep" } });
    expect(migrated.sim.dcSweep).toEqual({ sourceId: "c1", start: 0, stop: 5, step: 0.1 });
  });

  for (const part of PARTS.filter((entry) => entry.type !== "ground")) {
    it(`emits ${part.type}`, () => {
      const first = part.pins[0] ?? [0, 0];
      const device: CircuitComponent = {
        id: "c1",
        type: part.type,
        pos: [10, 10],
        rot: 0,
        mirror: false,
        ...(part.defaultValue !== undefined ? { value: part.defaultValue } : {}),
        ...(part.type === "switch_spst" ? { params: { closed: true } } : {}),
      };
      const ground: CircuitComponent = { id: "c2", type: "ground", pos: [10 + first[0], 10 + first[1]], rot: 0, mirror: false };
      const document: CircuitDocument = { ...base, components: [device, ground], wires: [] };
      expect(() => generateNetlist(document)).not.toThrow();
      expect(generateNetlist(document).netlist).toContain(".end\n");
    });
  }
});
