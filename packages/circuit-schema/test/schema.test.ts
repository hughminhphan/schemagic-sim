import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DC_SWEEP_MAX_POINTS, PARTS, canonicalizeCircuit, defaultComponentParamsV3, isCatalogOnlyType, deserializeCircuit, generateNetlist, inspectDCSweepConfig, inspectNoiseConfig, migrateCircuit, pinVoltageProbe, validateCircuit, type CircuitComponent, type CircuitDocument } from "../src";

const base: CircuitDocument = {
  format: "opencircuit-circuit",
  version: 3,
  meta: { title: "test" },
  components: [
    { id: "c1", type: "vsource", value: 5, pos: [0, 2], rot: 0, mirror: false },
    { id: "c2", type: "ground", pos: [0, 4], rot: 0, mirror: false },
  ],
  wires: [],
  probes: [],
  sim: { mode: "op" },
};

const migrationFixtureDirectory = fileURLToPath(new URL("./fixtures/v1-to-v2", import.meta.url));
const migrationFixtureNames = readdirSync(migrationFixtureDirectory)
  .filter((name) => name.endsWith(".v1.json"))
  .map((name) => name.replace(/\.v1\.json$/, ""))
  .sort();

describe("circuit schema", () => {
  it("round trips canonical undo snapshots deterministically", () => {
    const snapshot = canonicalizeCircuit({ ...base, components: [...base.components].reverse() });
    expect(canonicalizeCircuit(deserializeCircuit(snapshot))).toBe(snapshot);
    expect(snapshot).toBe(canonicalizeCircuit(deserializeCircuit(snapshot)));
  });

  it("excludes view from hash netlist equality", () => {
    expect(generateNetlist({ ...base, view: { pan: [2, 3], zoom: 2 } }).netlist)
      .toBe(generateNetlist({ ...base, view: { pan: [99, 1], zoom: 0.5 } }).netlist);
  });

  it("validates deterministic, unambiguous net labels", () => {
    const labeled = structuredClone(base);
    labeled.wires = [
      { id: "w1", netLabel: "in", points: [[0, 0], [2, 0]] },
      { id: "w2", netLabel: "out", points: [[4, 0], [6, 0]] },
    ];
    expect(validateCircuit(labeled)).toEqual([]);
    expect(canonicalizeCircuit(deserializeCircuit(canonicalizeCircuit(labeled)))).toContain('"netLabel":"in"');

    labeled.wires[1]!.netLabel = "IN";
    expect(validateCircuit(labeled).map((issue) => issue.message)).toContain("Net label IN is already used by wire w1");
    labeled.wires[1] = { id: "w2", netLabel: "out", points: [[2, 0], [4, 0]] };
    expect(validateCircuit(labeled).map((issue) => issue.message)).toContain("Connected net is already named in");
    labeled.wires[1] = { id: "w2", netLabel: "bad-name", points: [[4, 0], [6, 0]] };
    expect(validateCircuit(labeled).some((issue) => issue.path === "wires.w2.netLabel")).toBe(true);
  });

  it("validates DC sweep direction and total point limits", () => {
    expect(inspectDCSweepConfig(base, { sourceId: "c1", start: 0, stop: 5, step: -0.1 }).issues[0]?.message)
      .toMatch(/step sign/i);
    const tooLarge = inspectDCSweepConfig(base, {
      sourceId: "c1",
      start: 0,
      stop: 5,
      step: 5 / DC_SWEEP_MAX_POINTS,
    });
    expect(tooLarge.issues[0]?.message).toContain(DC_SWEEP_MAX_POINTS.toLocaleString());
  });

  it("defaults missing settings when loading a v1 DC sweep workspace", () => {
    const migrated = migrateCircuit({ ...structuredClone(base), version: 1, sim: { mode: "dc-sweep" } });
    expect(migrated.sim.dcSweep).toEqual({ sourceId: "c1", start: 0, stop: 5, step: 0.1 });
  });

  it("defaults and validates noise settings when loading a v1 noise workspace", () => {
    const withProbe = { ...structuredClone(base), version: 1 as const, probes: [{ id: "p1", kind: "voltage" as const, target: { componentPin: ["c1", 0] as [string, number] } }] };
    const migrated = migrateCircuit({ ...withProbe, sim: { mode: "noise" } });
    expect(migrated.sim.noise).toEqual({
      outputProbeId: "p1",
      inputSourceId: "c1",
      fstart: 10,
      fstop: 1_000_000,
      pointsPerDecade: 30,
      sweep: "dec",
      temperatureC: 27,
    });
    expect(inspectNoiseConfig(migrated, migrated.sim.noise).issues).toEqual([]);
    expect(inspectNoiseConfig(migrated, { ...migrated.sim.noise!, fstart: 0 }).issues[0]?.message).toMatch(/greater than zero/i);
  });

  for (const fixtureName of migrationFixtureNames) {
    it(`preserves the ${fixtureName} v1 netlist byte-for-byte`, () => {
      const source = readFileSync(`${migrationFixtureDirectory}/${fixtureName}.v1.json`, "utf8");
      const golden = readFileSync(`${migrationFixtureDirectory}/${fixtureName}.netlist`, "utf8");
      const migrated = migrateCircuit(JSON.parse(source));
      expect(migrated.version).toBe(3);
      expect(generateNetlist(migrated).netlist).toBe(golden);
    });
  }

  it("migrates legacy voltage probes to stable signal expressions", () => {
    const migrated = migrateCircuit({
      ...structuredClone(base),
      version: 2,
      probes: [{ id: "p1", kind: "voltage", target: { componentPin: ["c1", 0] }, label: "input" }],
    });
    expect(migrated.probes).toEqual([pinVoltageProbe("p1", "c1", 0, { label: "input" })]);
  });

  it("migrates only raw imported-model truth and discards legacy emitted fields", () => {
    const migrated = migrateCircuit({
      ...structuredClone(base),
      version: 2,
      components: [
        { ...base.components[0], type: "diode", params: { importedPartId: "legacy-1" } },
        base.components[1],
      ],
      importedParts: [{
        id: "legacy-1", name: "SAFE_D", sourceName: "safe.lib", sourceText: ".model SAFE_D D",
        definitionKind: "model", baseType: "diode", userMapping: {},
        emittedText: ".shell touch /tmp/never-trust-this", emittedName: "TAMPERED", namespace: "tampered",
      }],
    });
    expect(migrated.modelImports?.parts).toHaveLength(1);
    expect(migrated.components[0]?.params?.importedPartId).toBe(migrated.modelImports?.parts[0]?.id);
    expect(migrated.modelImports?.parts[0]?.analysisValidity).toEqual({
      version: 1,
      supportedModes: ["live", "op", "dc-sweep", "tran", "ac", "noise"],
    });
    expect(canonicalizeCircuit(migrated)).not.toContain("never-trust-this");
    expect(canonicalizeCircuit(migrated)).not.toContain("emittedName");

    const importedPart = migrated.modelImports!.parts[0]!;
    const { analysisValidity: _legacyMissingField, ...legacyPart } = importedPart;
    const normalized = migrateCircuit({
      ...migrated,
      modelImports: { ...migrated.modelImports!, parts: [legacyPart] },
    });
    expect(normalized.modelImports?.parts[0]?.analysisValidity).toEqual(importedPart.analysisValidity);
    expect(canonicalizeCircuit(normalized)).toContain('"analysisValidity":{"supportedModes":["live","op","dc-sweep","tran","ac","noise"],"version":1}');

    const malformed = structuredClone(normalized);
    (malformed.modelImports!.parts[0]!.analysisValidity as { version: number }).version = 2;
    expect(validateCircuit(malformed).find((issue) => issue.path.endsWith("analysisValidity.version"))?.message)
      .toMatch(/unsupported imported analysis-validity version/i);
  });

  it("does not overclaim dynamic support for a legacy imported subcircuit", () => {
    const migrated = migrateCircuit({
      ...structuredClone(base),
      version: 2,
      components: [
        { ...base.components[0], type: "bjt_npn", params: { importedPartId: "legacy-q" } },
        base.components[1],
      ],
      importedParts: [{
        id: "legacy-q", name: "SAFE_Q", sourceName: "safe.sub",
        sourceText: ".subckt SAFE_Q C B E\nQ1 C B E CORE\n.model CORE NPN\n.ends SAFE_Q",
        definitionKind: "subckt", baseType: "bjt_npn", userMapping: { C: 0, B: 1, E: 2 },
      }],
    });
    const validity = migrated.modelImports?.parts[0]?.analysisValidity;
    expect(validity?.supportedModes).toEqual(["live", "op", "dc-sweep"]);
    expect(validity?.limitations?.[0]?.modes).toEqual(["tran", "ac", "noise"]);
    expect(validity?.limitations?.[0]?.message).toMatch(/re-import.*derive transient, AC, and noise/i);
    expect(validateCircuit(migrated)).toEqual([]);
  });

  for (const part of PARTS.filter((entry) => entry.type !== "ground")) {
    it(`emits ${part.type}`, () => {
      const first = part.pins[0] ?? [0, 0];
      const defaultParams = defaultComponentParamsV3(part.type);
      const device: CircuitComponent = {
        id: "c1",
        type: part.type,
        pos: [10, 10],
        rot: 0,
        mirror: false,
        ...(part.defaultValue !== undefined ? { value: part.defaultValue } : {}),
        ...(defaultParams || part.type === "switch_spst" || isCatalogOnlyType(part.type)
          ? { params: { ...defaultParams, ...(part.type === "switch_spst" ? { closed: true } : {}), ...(isCatalogOnlyType(part.type) ? { catalogPartId: "ti/NE555" } : {}) } }
          : {}),
      };
      const ground: CircuitComponent = { id: "c2", type: "ground", pos: [10 + first[0], 10 + first[1]], rot: 0, mirror: false };
      const document: CircuitDocument = {
        ...base,
        components: [device, ground],
        wires: [],
        ...(part.type === "isource_pulse"
          ? { sim: { mode: "tran", tran: { tstop: 0.02, tstep: 0.00002, maxstep: 0.00005 } } as const }
          : {}),
      };
      expect(() => generateNetlist(document)).not.toThrow();
      expect(generateNetlist(document).netlist).toContain(".end\n");
    });
  }

  for (const part of PARTS.filter((entry) => isCatalogOnlyType(entry.type))) {
    it(`rejects ${part.type} without a catalog package`, () => {
      const first = part.pins[0] ?? [0, 0];
      const device: CircuitComponent = { id: "c1", type: part.type, pos: [10, 10], rot: 0, mirror: false };
      const ground: CircuitComponent = { id: "c2", type: "ground", pos: [10 + first[0], 10 + first[1]], rot: 0, mirror: false };
      const document: CircuitDocument = { ...base, components: [device, ground], wires: [] };
      expect(validateCircuit(document).map((issue) => issue.path)).toContain("components.c1.params.catalogPartId");
    });

    it(`rejects an editable value on ${part.type}`, () => {
      const first = part.pins[0] ?? [0, 0];
      const device: CircuitComponent = { id: "c1", type: part.type, pos: [10, 10], rot: 0, mirror: false, value: "1k", params: { catalogPartId: "ti/NE555" } };
      const ground: CircuitComponent = { id: "c2", type: "ground", pos: [10 + first[0], 10 + first[1]], rot: 0, mirror: false };
      const document: CircuitDocument = { ...base, components: [device, ground], wires: [] };
      expect(validateCircuit(document).map((issue) => issue.path)).toContain("components.c1.value");
    });
  }
});
