import { describe, expect, it } from "vitest";
import { demoCircuit } from "./demo";
import { generateNetlistWithImports, setImportedParts, type ImportedPartDefinition } from "./model-import";

function definition(overrides: Partial<ImportedPartDefinition> = {}): ImportedPartDefinition {
  return {
    id: "import-1",
    name: "SAFE_D",
    sourceName: "safe.lib",
    sourceText: ".model SAFE_D D(Is=1e-14)",
    namespace: "ocimp_safe_d_1",
    emittedText: ".model ocimp_safe_d_1_SAFE_D D(Is=1e-14)\n",
    emittedName: "ocimp_safe_d_1_SAFE_D",
    definitionKind: "model",
    suggestedSymbol: "diode",
    baseType: "diode",
    modelPins: [],
    userMapping: {},
    warnings: [],
    blockedItems: [],
    ...overrides,
  };
}

describe("imported model netlists", () => {
  it("emits a namespaced model and instance deterministically", () => {
    const circuit = structuredClone(demoCircuit);
    const led = circuit.components.find((component) => component.id === "c6")!;
    led.params = { ...(led.params ?? {}), importedPartId: "import-1" };
    setImportedParts(circuit, [definition()]);
    const first = generateNetlistWithImports(circuit, "op").netlist;
    const second = generateNetlistWithImports(circuit, "op").netlist;
    expect(first).toBe(second);
    expect(first).toContain("* imported, unverified: SAFE_D");
    expect(first).toContain(".model ocimp_safe_d_1_SAFE_D D(Is=1e-14)");
    expect(first).toMatch(/D6 \S+ \S+ ocimp_safe_d_1_SAFE_D \$ component:c6/);
  });

  it("applies a bijective subcircuit pin order", () => {
    const circuit = structuredClone(demoCircuit);
    const transistor = circuit.components.find((component) => component.id === "c4")!;
    transistor.params = { ...(transistor.params ?? {}), importedPartId: "import-1" };
    setImportedParts(circuit, [definition({
      definitionKind: "subckt",
      emittedText: ".subckt ocimp_safe_q_1_SAFE_Q E B C\nR1 E B 1k\n.ends ocimp_safe_q_1_SAFE_Q\n",
      emittedName: "ocimp_safe_q_1_SAFE_Q",
      modelPins: ["E", "B", "C"],
      userMapping: { C: 2, B: 1, E: 0 },
      suggestedSymbol: "bjt",
      baseType: "bjt_npn",
    })]);
    const generated = generateNetlistWithImports(circuit, "op");
    const nodes = generated.componentNodes.c4!;
    expect(generated.netlist).toContain(`X4 ${nodes[2]} ${nodes[1]} ${nodes[0]} ocimp_safe_q_1_SAFE_Q $ component:c4`);
  });
});
