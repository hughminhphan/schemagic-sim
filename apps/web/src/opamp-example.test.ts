import { generateNetlist } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { applyCatalogModels } from "./catalog-netlist";
import { preloadCatalogPart } from "./catalog";
import { exampleById } from "./examples";

describe("TL072 non-inverting example", () => {
  it("connects the declared package pins to the closed-loop feedback network", async () => {
    const example = exampleById("opamp-noninverting");
    expect(example).toBeDefined();
    const document = structuredClone(example!.document);
    const part = await preloadCatalogPart("ti/TL072");
    const base = generateNetlist(document, "tran");
    const opampNodes = base.componentNodes.c4!;

    expect(base.componentNodes.c5).toEqual([opampNodes[1], opampNodes[2]]);
    expect(base.componentNodes.c6![0]).toBe(opampNodes[1]);

    const generated = applyCatalogModels(document, base, [part]);
    expect(generated.netlist).toContain(
      `X4 ${opampNodes[0]} ${opampNodes[1]} ${base.componentNodes.c1![0]} ${base.componentNodes.c2![0]} ${opampNodes[2]} ${part.modelName} $ component:c4`,
    );
    expect(generated.netlist).toContain(`R5 ${opampNodes[1]} ${opampNodes[2]} 100k $ component:c5`);
  });
});
