import { importedPartFromModel, importedPartFromSubckt, parseSpiceLibrary } from "@opencircuit/model-import";
import { canonicalizeCircuit, type CircuitDocument } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import {
  falstadImportDestination,
  generateNetlistWithImports,
  ImportedModelRuntimeError,
  importedPaletteMarkup,
  importedParts,
  setImportedModelRecords,
  setImportedParts,
} from "./model-import";

function circuit(type: "diode" | "bjt_npn"): CircuitDocument {
  return {
    format: "opencircuit-circuit",
    version: 3,
    meta: { title: "Imported model test" },
    components: [
      { id: "c1", type, pos: [10, 10], rot: 0, mirror: false },
      { id: "g1", type: "ground", pos: [0, 0], rot: 0, mirror: false },
    ],
    wires: [], probes: [], sim: { mode: "op" },
  };
}

describe("imported model netlists", () => {
  it("re-materializes a namespaced model deterministically from persisted source", () => {
    const document = circuit("diode");
    const sourceText = ".model SAFE_D D(Is=1e-14)";
    const model = parseSpiceLibrary(sourceText).models[0]!;
    const record = importedPartFromModel(model, { sourceName: "safe.lib", sourceText, baseType: "diode" });
    document.components[0]!.params = { importedPartId: record.id };
    setImportedModelRecords(document, [record]);

    const first = generateNetlistWithImports(document, "op").netlist;
    const second = generateNetlistWithImports(document, "op").netlist;
    expect(first).toBe(second);
    expect(first).toContain("* imported, unverified: SAFE_D");
    expect(first).toContain(`.model ocimp_${record.id.slice(4)}_SAFE_D D`);
    expect(first).toMatch(new RegExp(`D1 \\S+ \\S+ ocimp_${record.id.slice(4)}_SAFE_D \\$ component:c1`));
  });

  it("applies the persisted bijective symbol-to-subcircuit pin order", () => {
    const document = circuit("bjt_npn");
    const sourceText = ".subckt SAFE_Q E B C\nR1 E B 1k\n.ends SAFE_Q";
    const subckt = parseSpiceLibrary(sourceText).subckts[0]!;
    const record = importedPartFromSubckt(subckt, {
      sourceName: "safe.sub",
      sourceText,
      baseType: "bjt_npn",
      pinMapping: [
        { symbolPinIndex: 0, modelPinIndex: 2 },
        { symbolPinIndex: 1, modelPinIndex: 1 },
        { symbolPinIndex: 2, modelPinIndex: 0 },
      ],
    });
    document.components[0]!.params = { importedPartId: record.id };
    setImportedModelRecords(document, [record]);

    const generated = generateNetlistWithImports(document, "op");
    const nodes = generated.componentNodes.c1!;
    expect(generated.netlist).toContain(`X1 ${nodes[2]} ${nodes[1]} ${nodes[0]} ocimp_${record.id.slice(4)}_SAFE_Q $ component:c1`);
    expect(generated.componentCurrents.c1).toBeUndefined();
    expect(generated.netlist).not.toContain("@q1[ic]");
  });

  it("persists only typed raw records, never derived emitted SPICE", () => {
    const document = circuit("diode");
    const sourceText = ".model SAFE_D D";
    const record = importedPartFromModel(parseSpiceLibrary(sourceText).models[0]!, { sourceName: "safe.lib", sourceText, baseType: "diode" });
    setImportedModelRecords(document, [record]);
    const views = importedParts(document);
    setImportedParts(document, views);
    expect(importedPaletteMarkup(views)).toContain("Declared modes: operating-point · DC sweep · transient · AC · NOISE");

    const serialized = canonicalizeCircuit(document);
    expect(serialized).toContain("modelImports");
    expect(serialized).toContain("analysisValidity");
    expect(serialized).toContain("supportedModes");
    expect(serialized).not.toContain("emittedText");
    expect(serialized).not.toContain("namespace");
  });

  it("rejects an unsupported selected analysis with component attribution and an action", () => {
    const document = circuit("bjt_npn");
    const sourceText = ".subckt QUIET C B E\nE1 C E B E 1\n.ends QUIET";
    const subckt = parseSpiceLibrary(sourceText).subckts[0]!;
    const record = importedPartFromSubckt(subckt, {
      sourceName: "quiet.sub",
      sourceText,
      baseType: "bjt_npn",
    });
    document.components[0]!.params = { importedPartId: record.id };
    setImportedModelRecords(document, [record]);

    expect(() => generateNetlistWithImports(document, "noise")).toThrowError(
      expect.objectContaining<Partial<ImportedModelRuntimeError>>({
        issue: expect.objectContaining({
          code: "UNSUPPORTED_ANALYSIS",
          componentId: "c1",
          partId: record.id,
          analysisMode: "noise",
          message: expect.stringMatching(/Component c1.*noise.*noise-capable primitive\/model|Component c1.*noise.*another analysis/i),
        }),
      }),
    );
  });
});

describe("Falstad web import handoff", () => {
  it("builds a native share URL while preserving the structured unsupported report", () => {
    const source = [
      "$ 1 0.000005 10.2 50 5 50",
      "v 64 160 64 64 0 0 40 5 0 0 0.5",
      "r 64 64 128 64 0 1000",
      "T 128 64 192 64 0 4 1 0 0.999",
      "g 64 160 64 176 0",
    ].join("\n");
    const input = `https://www.falstad.com/circuit/circuitjs.html?cct=${encodeURIComponent(source)}`;
    const location = { href: "https://sim.example.test/?designer=0" } as Location;
    const destination = falstadImportDestination(input, location);

    expect(destination.url).toMatch(/^https:\/\/sim\.example\.test\/\?designer=0#c=/);
    expect(destination.result.document.components.map((component) => component.type)).toEqual(["vsource", "resistor", "ground"]);
    expect(destination.result.report.unsupported).toEqual([
      expect.objectContaining({ elementType: "T", mapping: "unsupported", reason: "Transformers are not present in the circuit schema" }),
    ]);
  });
});
