import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateNetlist, validateCircuit } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";

// Examples authored in this repository keep their reviewed golden beside the
// app. The circuit-schema fixtures stay pinned to their v1 migration inputs, so
// they are only consulted for examples that have no app-owned golden.
const migrationGoldenDirectory = fileURLToPath(new URL("../../../packages/circuit-schema/test/fixtures/v1-to-v2", import.meta.url));
const appGoldenDirectory = fileURLToPath(new URL("./fixtures", import.meta.url));

const TEACHING_EXAMPLES = [
  "resistive-divider",
  "led-current-limit",
  "rc-filter-bode",
  "rlc-resonance",
  "halfwave-rectifier",
  "bridge-rectifier",
  "inverting-opamp",
  "opamp-noninverting",
  "common-emitter-amp",
] as const;

const PLACEABLE_ONLY = new Set([
  "resistive-divider", "led-current-limit", "rlc-resonance",
  "halfwave-rectifier", "bridge-rectifier", "inverting-opamp",
]);

describe("example circuits", () => {
  for (const example of EXAMPLES) {
    it(`${example.id} migrates to the valid v3 project contract with its reviewed netlist`, () => {
      const appGolden = `${appGoldenDirectory}/example-${example.id}.netlist`;
      const golden = readFileSync(existsSync(appGolden) ? appGolden : `${migrationGoldenDirectory}/example-${example.id}.netlist`, "utf8");
      expect(example.document.version).toBe(3);
      expect(validateCircuit(example.document)).toEqual([]);
      expect(generateNetlist(example.document).netlist).toBe(golden);
    });

    it(`${example.id} carries a one-sentence description and an analysis mode`, () => {
      expect(example.description.trim().length).toBeGreaterThan(20);
      expect(example.description.trim().endsWith(".")).toBe(true);
      expect(["live", "op", "dc-sweep", "tran", "ac", "noise"]).toContain(example.document.sim.mode);
      expect(example.document.probes.length).toBeGreaterThan(0);
    });
  }

  it("ships the classic teaching set the gallery advertises", () => {
    const ids = new Set(EXAMPLES.map((example) => example.id));
    for (const id of TEACHING_EXAMPLES) expect(ids.has(id), `${id} should ship as an example`).toBe(true);
  });

  it("keeps the placeable-only teaching circuits free of catalog and imported parts", () => {
    for (const example of EXAMPLES.filter((candidate) => PLACEABLE_ONLY.has(candidate.id))) {
      for (const component of example.document.components) {
        expect(component.mpn, `${example.id}:${component.id}`).toBeUndefined();
        expect(component.params?.catalogPartId, `${example.id}:${component.id}`).toBeUndefined();
        expect(component.params?.importedPartId, `${example.id}:${component.id}`).toBeUndefined();
      }
      expect(example.document.modelImports).toBeUndefined();
    }
  });

  it("gives every filter an AC default, every rectifier a transient default and the divider a DC sweep", () => {
    const mode = (id: string) => EXAMPLES.find((example) => example.id === id)?.document.sim.mode;
    expect(mode("rc-filter-bode")).toBe("ac");
    expect(mode("rlc-resonance")).toBe("ac");
    expect(mode("halfwave-rectifier")).toBe("tran");
    expect(mode("bridge-rectifier")).toBe("tran");
    expect(mode("inverting-opamp")).toBe("tran");
    expect(mode("resistive-divider")).toBe("dc-sweep");
    expect(mode("led-current-limit")).toBe("dc-sweep");
  });
});
