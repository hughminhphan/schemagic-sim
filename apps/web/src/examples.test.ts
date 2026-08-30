import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateNetlist, validateCircuit } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";

const goldenDirectory = fileURLToPath(new URL("../../../packages/circuit-schema/test/fixtures/v1-to-v2", import.meta.url));
const currentGoldenDirectory = fileURLToPath(new URL("./fixtures", import.meta.url));

describe("example circuits", () => {
  for (const example of EXAMPLES) {
    it(`${example.id} migrates to the valid v3 project contract with its reviewed netlist`, () => {
      const golden = readFileSync(example.id === "rc-filter-bode" || example.id === "mosfet-led-switch" || example.id === "opamp-noninverting"
        ? `${currentGoldenDirectory}/example-${example.id}.netlist`
        : `${goldenDirectory}/example-${example.id}.netlist`, "utf8");
      expect(example.document.version).toBe(3);
      expect(validateCircuit(example.document)).toEqual([]);
      expect(generateNetlist(example.document).netlist).toBe(golden);
    });
  }
});
