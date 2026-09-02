import { readFileSync } from "node:fs";
import { generateNetlist, validateCircuit } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { demoCircuit } from "./demo";

describe("demo circuit", () => {
  it("uses the validated v3 project contract without changing the reviewed golden netlist", () => {
    // App-owned golden: the circuit-schema fixture stays pinned to the v1
    // migration input, which still carries the pre-coach-mark default probe.
    const golden = readFileSync(new URL("./fixtures/demo.netlist", import.meta.url), "utf8");
    expect(demoCircuit.version).toBe(3);
    expect(validateCircuit(demoCircuit)).toEqual([]);
    expect(generateNetlist(demoCircuit).netlist).toBe(golden);
  });
});
