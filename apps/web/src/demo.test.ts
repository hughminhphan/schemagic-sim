import { readFileSync } from "node:fs";
import { generateNetlist, validateCircuit } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { demoCircuit } from "./demo";

describe("demo circuit", () => {
  it("uses valid v2 geometry without changing the v1 golden netlist", () => {
    const golden = readFileSync(new URL("../../../packages/circuit-schema/test/fixtures/v1-to-v2/demo.netlist", import.meta.url), "utf8");
    expect(demoCircuit.version).toBe(2);
    expect(validateCircuit(demoCircuit)).toEqual([]);
    expect(generateNetlist(demoCircuit).netlist).toBe(golden);
  });
});
