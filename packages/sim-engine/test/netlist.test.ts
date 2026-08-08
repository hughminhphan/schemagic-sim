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

  it("generates a one-source linear DC sweep", () => {
    const swept: CircuitDocument = {
      ...structuredClone(document),
      sim: { mode: "dc-sweep", dcSweep: { sourceId: "c1", start: 0, stop: 5, step: 0.1 } },
    };
    expect(generateNetlist(swept).netlist).toContain(".dc V1 0 5 0.1");
  });

  it("generates noise analysis with an explicit output, input reference and temperature", () => {
    const noise: CircuitDocument = {
      ...structuredClone(document),
      probes: [{ id: "p1", kind: "voltage", target: { wire: "w1" } }],
      sim: {
        mode: "noise",
        noise: {
          outputProbeId: "p1",
          inputSourceId: "c1",
          fstart: 10,
          fstop: 100_000,
          pointsPerDecade: 20,
          sweep: "dec",
          temperatureC: 27,
        },
      },
    };
    const netlist = generateNetlist(noise).netlist;
    expect(netlist).toContain("V1 n1 0 DC 5 AC 1");
    expect(netlist).toContain(".temp 27");
    expect(netlist).toContain(".noise V(n1) V1 dec 20 10 100000");
  });

  it("generates a two-source stepped DC sweep", () => {
    const swept: CircuitDocument = {
      ...structuredClone(document),
      components: [
        ...document.components,
        { id: "c5", type: "isource", value: "1m", pos: [10, 4], rot: 0, mirror: false },
      ],
      sim: {
        mode: "dc-sweep",
        dcSweep: {
          sourceId: "c1", start: 0, stop: 5, step: 0.25,
          secondary: { sourceId: "c5", start: 0, stop: 0.001, step: 0.00025 },
        },
      },
    };
    expect(generateNetlist(swept).netlist).toContain(".dc V1 0 5 0.25 I5 0 0.001 0.00025");
  });
});
