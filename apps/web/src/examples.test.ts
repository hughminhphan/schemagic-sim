import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateNetlist, validateCircuit } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";

const goldenDirectory = fileURLToPath(new URL("../../../packages/circuit-schema/test/fixtures/v1-to-v2", import.meta.url));

describe("example circuits", () => {
  for (const example of EXAMPLES) {
    it(`${example.id} is valid v2 geometry with its v1 netlist`, () => {
      const golden = readFileSync(`${goldenDirectory}/example-${example.id}.netlist`, "utf8");
      expect(example.document.version).toBe(2);
      expect(validateCircuit(example.document)).toEqual([]);
      expect(generateNetlist(example.document).netlist).toBe(golden);
    });
  }
});
