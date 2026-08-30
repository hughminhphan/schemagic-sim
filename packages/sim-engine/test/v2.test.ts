import { describe, expect, it } from "vitest";
import {
  calculateDesignBlockContentHash,
  generateScenarioNetlist,
  parseEngineDiagnostics,
  type CircuitDocumentV2,
  type DesignBlockDefinition,
} from "../src";

describe("v2 scenario re-export", () => {
  it("generates scenario netlists through sim-engine", () => {
    const payload: Omit<DesignBlockDefinition, "contentHash"> = {
      id: "display-block",
      version: "1",
      title: "Display block",
      pins: [{ id: "gnd", name: "GND", offset: [0, 0] }],
      netlist: { kind: "schematic_only", reason: "Display only" },
    };
    const block: DesignBlockDefinition = { ...payload, contentHash: calculateDesignBlockContentHash(payload) };
    const document: CircuitDocumentV2 = {
      format: "opencircuit-circuit",
      version: 2,
      meta: { title: "Sim engine v2" },
      designBlocks: [block],
      circuits: [{
        id: "main",
        title: "Main",
        components: [
          { id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false },
          { id: "u.display:1", type: "design_block", block: { id: block.id, version: block.version, contentHash: block.contentHash }, pos: [4, 0], rot: 0, mirror: false },
        ],
        wires: [],
        probes: [],
      }],
      scenarios: [{ id: "op", title: "OP", circuitId: "main", config: { mode: "op" } }],
      defaultCircuitId: "main",
      defaultScenarioId: "op",
    };
    expect(generateScenarioNetlist(document, "op").omissions[0]?.componentId).toBe("u.display:1");
  });

  it("maps diagnostics back to the full v2 component-ID alphabet", () => {
    const netlist = "title\nRoc_00 1 0 1k $ component:r.part:1\n.end\n";
    expect(parseEngineDiagnostics(netlist, "fatal error in netlist at line 2")).toEqual([
      expect.objectContaining({ componentId: "r.part:1", netLine: 2, message: "fatal error in netlist at line 2" }),
    ]);
  });

  it("maps legacy-safe punctuation and Unicode comment IDs exactly", () => {
    const netlist = "title\nRsource 1 0 1k $ component:source $ Ω !\n.end\n";
    const diagnostics = parseEngineDiagnostics(netlist, "Fatal error in netlist at line 2 $ component:source $ Ω !");
    expect(diagnostics).toEqual([expect.objectContaining({
      componentId: "source $ Ω !",
      netLine: 2,
      message: "Fatal error in netlist at line 2",
    })]);
  });
});
