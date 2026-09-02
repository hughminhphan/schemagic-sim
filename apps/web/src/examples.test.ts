import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateNetlist, validateCircuit } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";

// Examples authored in this repository keep their reviewed golden beside the
// app or in the example-local golden directory. The circuit-schema fixtures stay
// pinned to their v1 migration inputs and are only a legacy fallback.
const migrationGoldenDirectory = fileURLToPath(new URL("../../../packages/circuit-schema/test/fixtures/v1-to-v2", import.meta.url));
const appGoldenDirectory = fileURLToPath(new URL("./fixtures", import.meta.url));
const repositoryGoldenDirectory = fileURLToPath(new URL("../../../examples/golden", import.meta.url));

const TEACHING_EXAMPLES = [
  "rc-filter-bode",
  "resistive-divider",
  "555-astable",
  "h-bridge",
  "common-emitter-amp",
  "inverting-opamp",
  "opamp-noninverting",
  "halfwave-rectifier",
  "bridge-rectifier",
  "zener-regulator",
  "led-current-limit",
  "rlc-resonance",
] as const;

const PLACEABLE_ONLY = new Set([
  "resistive-divider", "led-current-limit", "rlc-resonance",
  "halfwave-rectifier", "bridge-rectifier",
]);

const CATALOG_BINDINGS: Readonly<Record<string, readonly string[]>> = {
  "555-astable": ["ti/NE555"],
  "h-bridge": ["infineon/IRLZ44N", "infineon/IRLZ44N", "infineon/IRLZ44N", "infineon/IRLZ44N"],
  "inverting-opamp": ["ti/TL072"],
  "zener-regulator": ["onsemi/1N4733A"],
};

describe("example circuits", () => {
  for (const example of EXAMPLES) {
    it(`${example.id} migrates to the valid v3 project contract with its reviewed netlist`, () => {
      const repositoryGolden = `${repositoryGoldenDirectory}/example-${example.id}.netlist`;
      const appGolden = `${appGoldenDirectory}/example-${example.id}.netlist`;
      const golden = readFileSync(
        existsSync(repositoryGolden)
          ? repositoryGolden
          : existsSync(appGolden)
            ? appGolden
            : `${migrationGoldenDirectory}/example-${example.id}.netlist`,
        "utf8",
      );
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

  it("ships the approved classic teaching set", () => {
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

  it("binds each catalog-backed addition to its reviewed package", () => {
    for (const [id, expected] of Object.entries(CATALOG_BINDINGS)) {
      const example = EXAMPLES.find((candidate) => candidate.id === id)!;
      const actual = example.document.components.flatMap((component) => {
        const catalogPartId = component.params?.catalogPartId;
        return typeof catalogPartId === "string" ? [catalogPartId] : [];
      });
      expect(actual).toEqual(expected);
    }
  });

  it("gives every teaching circuit an analysis that exposes its lesson", () => {
    const mode = (id: string) => EXAMPLES.find((example) => example.id === id)?.document.sim.mode;
    expect(mode("rc-filter-bode")).toBe("ac");
    expect(mode("rlc-resonance")).toBe("ac");
    expect(mode("halfwave-rectifier")).toBe("tran");
    expect(mode("bridge-rectifier")).toBe("tran");
    expect(mode("555-astable")).toBe("tran");
    expect(mode("h-bridge")).toBe("tran");
    expect(mode("inverting-opamp")).toBe("tran");
    expect(mode("opamp-noninverting")).toBe("tran");
    expect(mode("resistive-divider")).toBe("dc-sweep");
    expect(mode("zener-regulator")).toBe("dc-sweep");
    expect(mode("led-current-limit")).toBe("dc-sweep");
  });

  it("keeps the four addition values on their approved teaching points", () => {
    const document = (id: string) => EXAMPLES.find((example) => example.id === id)!.document;
    const value = (id: string, componentId: string) => document(id).components.find((component) => component.id === componentId)?.value;
    expect([value("555-astable", "c4"), value("555-astable", "c5"), value("555-astable", "c6")]).toEqual(["10k", "330k", "1u"]);
    expect(document("555-astable").components.some((component) => component.type === "led")).toBe(true);
    expect(document("h-bridge").components.filter((component) => component.type === "nmos")).toHaveLength(4);
    expect([value("h-bridge", "c8"), value("h-bridge", "c9")]).toEqual([20, "10m"]);
    expect([value("inverting-opamp", "c2"), value("inverting-opamp", "c3")]).toEqual(["10k", "100k"]);
    expect(document("inverting-opamp").components.find((component) => component.id === "c1")?.params?.frequency).toBe("1k");
    expect([value("zener-regulator", "c2"), value("zener-regulator", "c4")]).toEqual([220, "1k"]);
  });

  it("makes the teaching-relevant trace the default for the four additions", () => {
    const firstProbe = (id: string) => EXAMPLES.find((example) => example.id === id)?.document.probes[0];
    expect(firstProbe("555-astable")).toMatchObject({
      expression: { kind: "voltage", positive: { kind: "schematic-wire", wireId: "w18" } },
    });
    expect(firstProbe("h-bridge")).toMatchObject({
      expression: { kind: "current", component: { kind: "schematic-component", componentId: "c8" }, terminal: 0 },
    });
    expect(firstProbe("inverting-opamp")).toMatchObject({
      expression: { kind: "voltage", positive: { kind: "schematic-wire", wireId: "w4" } },
    });
    expect(firstProbe("zener-regulator")).toMatchObject({
      expression: { kind: "voltage", positive: { kind: "schematic-wire", wireId: "w2" } },
    });
  });
});
