import { describe, expect, it } from "vitest";
import { generateNetlist } from "../src/netlist";
import type { CircuitDocument } from "../src/types";

const document: CircuitDocument = {
  format: "opencircuit-circuit",
  version: 1,
  meta: { title: "Determinism fixture" },
  components: [
    { id: "c1", type: "vsource", value: 5, pos: [0, 4], rot: 0, mirror: false },
    { id: "c2", type: "resistor", value: 1000, pos: [4, 2], rot: 0, mirror: false },
    { id: "c3", type: "ground", pos: [0, 6], rot: 0, mirror: false },
    { id: "c4", type: "ground", pos: [6, 2], rot: 0, mirror: false },
  ],
  wires: [
    { id: "w1", points: [[0, 2], [2, 2]] },
    { id: "w2", points: [[6, 2], [6, 2]] },
  ],
  probes: [],
  sim: { mode: "op" },
};

describe("generateNetlist", () => {
  it("emits byte-identical output for the same document", () => {
    const first = generateNetlist(structuredClone(document));
    const second = generateNetlist(structuredClone(document));
    expect(new TextEncoder().encode(first.netlist)).toEqual(new TextEncoder().encode(second.netlist));
    expect(first.documentHash).toBe(second.documentHash);
    expect(first.netlist).toContain("* document-hash");
    expect(first.netlist.endsWith(".end\n")).toBe(true);
  });

  it("is independent of component and wire array order", () => {
    const shuffled: CircuitDocument = {
      ...structuredClone(document),
      components: [...document.components].reverse(),
      wires: [...document.wires].reverse(),
    };
    expect(generateNetlist(shuffled).netlist).toBe(generateNetlist(document).netlist);
  });
});
