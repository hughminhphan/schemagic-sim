import { existsSync } from "node:fs";
import { componentPinPoints, generateNetlist, generateScenarioNetlist, isCatalogOnlyType, upgradeCircuitV1ToV4, validateCircuit, type CircuitDocument, type CircuitDocumentV1, type Point } from "@opencircuit/circuit-schema";
import { beforeAll, describe, expect, it } from "vitest";
import { CATALOG_PARTS, preloadCatalogPart, type CatalogPart } from "./catalog";
import { catalogBenchDocument, ne555AstableDocument, type CatalogBenchPart } from "./catalog-bench";
import { generateNetlistWithCatalog } from "./catalog-netlist";
import { exampleById } from "./examples";
// The native reference harness already owns process spawning, timeouts and
// rawfile parsing for ngspice, so the smoke bench reuses it instead of shelling
// out again with different semantics.
// @ts-expect-error -- plain ESM harness outside the TypeScript workspaces
import { DEFAULT_NGSPICE_PATH, runNative } from "../../../tools/native-ngspice-reference/lib/run-native.mjs";

const NGSPICE = String(DEFAULT_NGSPICE_PATH);
const HAS_NGSPICE = existsSync(NGSPICE);

/** Block-symbol families that only became placeable with positional catalog symbols.
 * Zeners were already placeable on the legacy diode symbol and have their own
 * representative reviewed-model solve below, so they do not multiply this suite.
 */
const NEWLY_PLACEABLE = CATALOG_PARTS.filter((part) => part.baseType && part.baseType !== "zener" && isCatalogOnlyType(part.baseType));
/** Narrows a catalog part to the bench slice without losing the live, mutated object identity. */
const bench = (part: CatalogPart): CatalogBenchPart => ({ id: part.id, baseType: part.baseType!, manifest: part.manifest });

describe.skipIf(!HAS_NGSPICE)("newly placeable catalog parts solve an operating point in native ngspice", () => {
  beforeAll(async () => {
    await Promise.all(NEWLY_PLACEABLE.map((part) => preloadCatalogPart(part.id).catch(() => undefined)));
  }, 120_000);

  it("covers every newly placeable package", () => {
    expect(NEWLY_PLACEABLE.length).toBe(43);
  });

  for (const part of NEWLY_PLACEABLE) {
    it(`runs .op for ${part.id}`, async () => {
      if (!part.placeable) return;
      const generated = generateNetlistWithCatalog(catalogBenchDocument(bench(part)), "op", [part]);
      expect(generated.netlist).toMatch(/^\.op$/m);
      const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
      expect(run.stderr, `${part.id} ngspice stderr:\n${run.stderr}`).not.toMatch(/error|singular|aborted/i);
      expect(Object.keys(run.vectors ?? {}).length).toBeGreaterThan(0);
    }, 90_000);
  }
});

describe.skipIf(!HAS_NGSPICE)("the catalog-backed zener regulator example", () => {
  const part = CATALOG_PARTS.find((candidate) => candidate.id === "onsemi/1N4733A")!;
  beforeAll(async () => { await preloadCatalogPart(part.id); }, 60_000);

  it("solves its DC sweep with the reviewed avalanche model", async () => {
    const document = exampleById("zener-regulator")!.document;
    const generated = generateNetlistWithCatalog(document, "dc-sweep", [part]);
    expect(generated.netlist).toMatch(/^D3 0 vout OC_ONSEMI_1N4733A \$ component:c3$/m);
    expect(generated.netlist).not.toContain("awaiting its catalog package model");
    const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
    expect(run.stderr, run.stderr).not.toMatch(/error|singular|aborted/i);
    expect(Object.keys(run.vectors ?? {}).length).toBeGreaterThan(0);
    const output = (run.vectors as Array<{ name: string; values: number[] }>).find((vector) => vector.name.toLowerCase() === "v(vout)");
    expect(output?.values).toHaveLength(241);
    const endpoint = output!.values.at(-1)!;
    expect(endpoint).toBeGreaterThan(5.0);
    expect(endpoint).toBeLessThan(5.2);
    expect(Math.max(...output!.values)).toBeCloseTo(endpoint, 6);
  }, 90_000);
});

describe.skipIf(!HAS_NGSPICE)("the V3 pulsed current source", () => {
  it("solves with a measurable sensed current and no invalid save warning", async () => {
    const document = exampleById("current-pulse-load")!.document;
    const generated = generateNetlist(document);
    expect(generated.componentCurrents.c1).toBe("vocs_c1#branch");
    expect(generated.netlist).not.toContain("@i1[i]");
    const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
    expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/unrecognized variable|warning:.*@i1\[i\]/i);
    const sensed = (run.vectors as Array<{ name: string; values: number[] }>).find((vector) => /vocs_c1/i.test(vector.name));
    expect(sensed?.values.length).toBeGreaterThan(100);
    expect(Math.max(...sensed!.values.map(Math.abs))).toBeGreaterThan(0.0049);
    expect(Math.max(...sensed!.values.map(Math.abs))).toBeLessThan(0.0051);
  }, 90_000);
});

type NativeACValue = number | { real: number; img: number };
const acMagnitude = (value: NativeACValue): number => typeof value === "number" ? Math.abs(value) : Math.hypot(value.real, value.img);
const nativeVector = (run: Awaited<ReturnType<typeof runNative>>, name: string) => {
  const expected = name.toLowerCase();
  const branch = /^(.*)#branch$/.exec(expected)?.[1];
  return (run.vectors as Array<{ name: string; values: NativeACValue[] }>).find((vector) => {
    const actual = vector.name.toLowerCase();
    return actual === expected || (branch !== undefined && actual === `i(${branch})`);
  });
};

describe.skipIf(!HAS_NGSPICE)("the upgraded V4 pulsed current source", () => {
  it("retains a measurable current without an invalid @i save vector", async () => {
    const legacy: CircuitDocumentV1 = {
      format: "opencircuit-circuit", version: 1, meta: { title: "Upgraded pulse current" },
      components: [
        { id: "load.step:1", type: "isource_pulse", params: { i1: 0, i2: "5m", delay: "1m", rise: "10u", fall: "10u", width: "4m", period: "10m" }, pos: [0, 2], rot: 0, mirror: false },
        { id: "load", type: "resistor", value: "1k", pos: [4, 0], rot: 0, mirror: false },
        { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
        { id: "g2", type: "ground", pos: [6, 0], rot: 0, mirror: false },
      ],
      wires: [{ id: "w1", points: [[0, 0], [2, 0]] }], probes: [],
      sim: { mode: "tran", tran: { tstop: 0.02, tstep: 0.00002, maxstep: 0.00005 } },
    };
    const generated = generateScenarioNetlist(upgradeCircuitV1ToV4(legacy), "default");
    const currentName = generated.componentCurrents["load.step:1"]!;
    expect(currentName).toMatch(/^vocs_ip_[a-f0-9]+#branch$/);
    expect(generated.netlist).not.toMatch(/@ioc_[a-f0-9]+\[i\]/i);
    const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
    expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/unrecognized variable|warning:.*@ioc_/i);
    const current = nativeVector(run, currentName);
    expect(current?.values.length).toBeGreaterThan(100);
    expect(Math.max(...current!.values.map(acMagnitude))).toBeGreaterThan(0.0049);
    expect(Math.max(...current!.values.map(acMagnitude))).toBeLessThan(0.0051);
  }, 90_000);
});

describe.skipIf(!HAS_NGSPICE)("the crystal resonance example", () => {
  it("resolves the intended local series-resonance peak", async () => {
    const generated = generateNetlist(exampleById("crystal-resonator")!.document);
    expect(generated.netlist).toMatch(/^\.ac dec 100000 11200000 11270000$/m);
    const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
    expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/error|singular|aborted/i);
    const frequencies = nativeVector(run, "frequency")!.values.map((value) => typeof value === "number" ? value : value.real);
    const output = nativeVector(run, "v(vout)")!.values.map(acMagnitude);
    expect(frequencies).toHaveLength(314);
    expect(output[0]).toBeGreaterThan(0.33);
    expect(output[0]).toBeLessThan(0.34);
    expect(output.at(-1)).toBeGreaterThan(0.07);
    expect(output.at(-1)).toBeLessThan(0.09);
    const peakIndex = output.reduce((best, value, index) => value > output[best]! ? index : best, 0);
    expect(frequencies[peakIndex]).toBeGreaterThan(11_250_000);
    expect(frequencies[peakIndex]).toBeLessThan(11_260_000);
    expect(output[peakIndex]).toBeGreaterThan(0.9);
    expect(output[peakIndex]).toBeGreaterThan(Math.max(output[0]!, output.at(-1)!) * 2.5);
  }, 90_000);
});

function switchACBench(type: "switch_spdt" | "switch_dpdt"): CircuitDocument {
  const source = { id: "v1", type: "vsource" as const, value: 0, pos: [0, 2] as Point, rot: 0 as const, mirror: false };
  if (type === "switch_spdt") return {
    format: "opencircuit-circuit", version: 3, meta: { title: "SPDT AC current bench" },
    components: [
      source,
      { id: "s1", type, pos: [6, 0], rot: 0, mirror: false, params: { throw: "a" } },
      { id: "r1", type: "resistor", value: "1k", pos: [12, -1], rot: 0, mirror: false },
      { id: "r2", type: "resistor", value: "1k", pos: [12, 1], rot: 0, mirror: false },
      { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
      { id: "g2", type: "ground", pos: [14, -1], rot: 0, mirror: false },
      { id: "g3", type: "ground", pos: [14, 1], rot: 0, mirror: false },
    ],
    wires: [
      { id: "win", netLabel: "vin", points: [[0, 0], [4, 0]] },
      { id: "wa", points: [[8, -1], [10, -1]] },
      { id: "wb", points: [[8, 1], [10, 1]] },
    ], probes: [],
    sim: { mode: "ac", ac: { fstart: 100, fstop: 1_000, pointsPerDecade: 10, sweep: "dec", stimulus: { sourceId: "v1", magnitude: 1, phaseDeg: 0 } } },
  };
  return {
    format: "opencircuit-circuit", version: 3, meta: { title: "DPDT AC current bench" },
    components: [
      source,
      { id: "s1", type, pos: [8, 2], rot: 0, mirror: false, params: { throw: "a" } },
      { id: "r1", type: "resistor", value: "1k", pos: [15, -1], rot: 0, mirror: false },
      { id: "r2", type: "resistor", value: "1k", pos: [15, 1], rot: 0, mirror: false },
      { id: "r3", type: "resistor", value: "1k", pos: [15, 3], rot: 0, mirror: false },
      { id: "r4", type: "resistor", value: "1k", pos: [15, 5], rot: 0, mirror: false },
      { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
      { id: "g2", type: "ground", pos: [17, -1], rot: 0, mirror: false },
      { id: "g3", type: "ground", pos: [17, 1], rot: 0, mirror: false },
      { id: "g4", type: "ground", pos: [5, 4], rot: 0, mirror: false },
      { id: "g5", type: "ground", pos: [17, 3], rot: 0, mirror: false },
      { id: "g6", type: "ground", pos: [17, 5], rot: 0, mirror: false },
    ],
    wires: [
      { id: "win", netLabel: "vin", points: [[0, 0], [5, 0]] },
      { id: "wa1", points: [[11, -1], [13, -1]] },
      { id: "wb1", points: [[11, 1], [13, 1]] },
      { id: "wa2", points: [[11, 3], [13, 3]] },
      { id: "wb2", points: [[11, 5], [13, 5]] },
    ], probes: [],
    sim: { mode: "ac", ac: { fstart: 100, fstop: 1_000, pointsPerDecade: 10, sweep: "dec", stimulus: { sourceId: "v1", magnitude: 1, phaseDeg: 0 } } },
  };
}

function behavioralACBench(output: "current" | "voltage"): CircuitDocument {
  return {
    format: "opencircuit-circuit", version: 3, meta: { title: "Behavioural AC current bench" },
    components: [
      { id: "v1", type: "vsource", value: 0, pos: [0, 2], rot: 0, mirror: false },
      { id: "rin", type: "resistor", value: "1k", pos: [6, 0], rot: 0, mirror: false },
      { id: "b1", type: "behavioral_source", pos: [4, 6], rot: 0, mirror: false, params: {
        output,
        expression: {
          kind: "binary", operator: "*",
          left: { kind: "constant", value: output === "current" ? "1m" : 2 },
          right: { kind: "voltage", positive: { kind: "wire", wireId: "win" }, negative: { kind: "ground" } },
        },
      } },
      { id: "rout", type: "resistor", value: "1k", pos: [8, 4], rot: 0, mirror: false },
      { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
      { id: "g2", type: "ground", pos: [8, 0], rot: 0, mirror: false },
      { id: "g3", type: "ground", pos: [4, 8], rot: 0, mirror: false },
      { id: "g4", type: "ground", pos: [10, 4], rot: 0, mirror: false },
    ],
    wires: [
      { id: "win", netLabel: "vin", points: [[0, 0], [4, 0]] },
      { id: "wout", netLabel: "vout", points: [[4, 4], [6, 4]] },
    ], probes: [],
    sim: { mode: "ac", ac: { fstart: 100, fstop: 1_000, pointsPerDecade: 10, sweep: "dec", stimulus: { sourceId: "v1", magnitude: 1, phaseDeg: 0 } } },
  };
}

function dependentVoltageACBench(type: "vcvs" | "ccvs"): CircuitDocument {
  return {
    ...dependentCurrentACBench(type === "vcvs" ? "vccs" : "cccs"),
    meta: { title: `${type} AC voltage bench` },
    components: dependentCurrentACBench(type === "vcvs" ? "vccs" : "cccs").components.map((component) => component.id === "d1"
      ? { ...component, type, params: { gain: type === "vcvs" ? 2 : 1_000 } }
      : component),
  };
}

function dependentCurrentACBench(type: "vccs" | "cccs"): CircuitDocument {
  return {
    format: "opencircuit-circuit", version: 3, meta: { title: `${type} AC current bench` },
    components: [
      { id: "v1", type: "vsource", value: 0, pos: [0, 2], rot: 0, mirror: false },
      { id: "rin", type: "resistor", value: "1k", pos: [4, 0], rot: 0, mirror: false },
      { id: "d1", type, pos: [9, 1], rot: 0, mirror: false, params: { gain: type === "vccs" ? "1m" : 2 } },
      { id: "rout", type: "resistor", value: "1k", pos: [13, -2], rot: 0, mirror: false },
      { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
      { id: "g2", type: "ground", pos: [6, 2], rot: 0, mirror: false },
      { id: "g3", type: "ground", pos: [9, 4], rot: 0, mirror: false },
      { id: "g4", type: "ground", pos: [15, -2], rot: 0, mirror: false },
    ],
    wires: [
      { id: "win", netLabel: "vin", points: [[0, 0], [2, 0]] },
      { id: "wout", netLabel: "vout", points: [[9, -2], [11, -2]] },
    ], probes: [],
    sim: { mode: "ac", ac: { fstart: 100, fstop: 1_000, pointsPerDecade: 10, sweep: "dec", stimulus: { sourceId: "v1", magnitude: 1, phaseDeg: 0 } } },
  };
}

function voltageControlledSwitchBench(): CircuitDocument {
  return {
    format: "opencircuit-circuit", version: 3, meta: { title: "Voltage-controlled switch current bench" },
    components: [
      { id: "v1", type: "vsource", value: 5, pos: [0, 2], rot: 0, mirror: false },
      { id: "s1", type: "switch_vcontrolled", pos: [8, 2], rot: 0, mirror: false, params: { ron: "1m", roff: "1G", threshold: 2.5, hysteresis: 0 } },
      { id: "vctrl", type: "vsource", value: 5, pos: [7, 7], rot: 0, mirror: false },
      { id: "r1", type: "resistor", value: "1k", pos: [15, 1], rot: 0, mirror: false },
      { id: "g1", type: "ground", pos: [0, 4], rot: 0, mirror: false },
      { id: "g2", type: "ground", pos: [17, 1], rot: 0, mirror: false },
      { id: "g3", type: "ground", pos: [9, 5], rot: 0, mirror: false },
      { id: "g4", type: "ground", pos: [7, 9], rot: 0, mirror: false },
    ],
    wires: [
      { id: "win", netLabel: "vin", points: [[0, 0], [0, 1], [5, 1]] },
      { id: "wout", netLabel: "vout", points: [[11, 1], [13, 1]] },
    ], probes: [], sim: { mode: "op" },
  };
}

describe.skipIf(!HAS_NGSPICE)("V3 AC current aliases", () => {
  for (const type of ["switch_spdt", "switch_dpdt"] as const) {
    it(`measures ${type} through a real zero-volt branch`, async () => {
      const generated = generateNetlist(switchACBench(type));
      expect(generated.componentCurrents.s1).toBe("vocs_s1#branch");
      expect(generated.netlist).not.toMatch(/@rs1/i);
      const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
      expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/unrecognized variable|warning:.*@rs1/i);
      const current = nativeVector(run, "vocs_s1#branch");
      expect(current?.values).toHaveLength(11);
      expect(Math.max(...current!.values.map(acMagnitude))).toBeGreaterThan(0.00099);
    }, 90_000);
  }

  it("measures a current-output behavioural source without fabricating an @b current", async () => {
    const generated = generateNetlist(behavioralACBench("current"));
    expect(generated.componentCurrents.b1).toBe("vocs_b1#branch");
    expect(generated.netlist).not.toMatch(/@b1\[i\]/i);
    const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
    expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/unrecognized variable|warning:.*@b1/i);
    const current = nativeVector(run, "vocs_b1#branch");
    expect(current?.values).toHaveLength(11);
    expect(Math.max(...current!.values.map(acMagnitude))).toBeGreaterThan(0.00099);
  }, 90_000);

  for (const type of ["vccs", "cccs"] as const) {
    it(`measures the generated ${type.toUpperCase()} output branch`, async () => {
      const generated = generateNetlist(dependentCurrentACBench(type));
      expect(generated.componentCurrents.d1).toBe("vocs_d1#branch");
      const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
      expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/unrecognized variable|warning:.*@(?:g|f)1/i);
      const current = nativeVector(run, "vocs_d1#branch");
      expect(current?.values).toHaveLength(11);
      expect(Math.max(...current!.values.map(acMagnitude))).toBeGreaterThan(type === "vccs" ? 0.00099 : 0.00199);
    }, 90_000);
  }

  for (const type of ["vcvs", "ccvs"] as const) {
    it(`measures the generated ${type.toUpperCase()} native branch`, async () => {
      const generated = generateNetlist(dependentVoltageACBench(type));
      const branch = `${type === "vcvs" ? "e" : "h"}1#branch`;
      expect(generated.componentCurrents.d1).toBe(branch);
      const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
      expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/unrecognized variable|warning:.*(?:e|h)1#branch/i);
      const current = nativeVector(run, branch);
      expect(current?.values).toHaveLength(11);
      expect(Math.max(...current!.values.map(acMagnitude))).toBeGreaterThan(0.00099);
    }, 90_000);
  }

  it("measures the generated voltage-output behavioural native branch", async () => {
    const generated = generateNetlist(behavioralACBench("voltage"));
    expect(generated.componentCurrents.b1).toBe("b1#branch");
    const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
    expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/unrecognized variable|warning:.*b1#branch/i);
    const current = nativeVector(run, "b1#branch");
    expect(current?.values).toHaveLength(11);
    expect(Math.max(...current!.values.map(acMagnitude))).toBeGreaterThan(0.00199);
  }, 90_000);
});

describe.skipIf(!HAS_NGSPICE)("V3 voltage-controlled switch current", () => {
  it("measures the closed switch through its real zero-volt branch", async () => {
    const generated = generateNetlist(voltageControlledSwitchBench());
    expect(generated.componentCurrents.s1).toBe("vocs_s1#branch");
    expect(generated.netlist).not.toMatch(/@s1\[i\]/i);
    const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
    expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/unrecognized variable|warning:.*@s1/i);
    const current = nativeVector(run, "vocs_s1#branch");
    expect(current?.values).toHaveLength(1);
    expect(acMagnitude(current!.values[0]!)).toBeGreaterThan(0.00499);
    expect(acMagnitude(current!.values[0]!)).toBeLessThan(0.00501);
  }, 90_000);
});

/** No wire may run over a pin that is not one of its own vertices, or the schematic reads as a short. */
function pinsCoveredByForeignWires(document: CircuitDocument): string[] {
  const pins = document.components.flatMap((component) => componentPinPoints(component).map((point) => ({ component: component.id, point })));
  const covered: string[] = [];
  for (const wire of document.wires) {
    const vertices = new Set(wire.points.map(([x, y]) => `${x},${y}`));
    for (let index = 1; index < wire.points.length; index += 1) {
      const [ax, ay] = wire.points[index - 1] as Point;
      const [bx, by] = wire.points[index] as Point;
      for (const pin of pins) {
        const [px, py] = pin.point;
        if (vertices.has(`${px},${py}`)) continue;
        const onSegment = ax === bx
          ? px === ax && py > Math.min(ay, by) && py < Math.max(ay, by)
          : py === ay && px > Math.min(ax, bx) && px < Math.max(ax, bx);
        if (onSegment) covered.push(`${wire.id} runs over ${pin.component} pin at ${px},${py}`);
      }
    }
  }
  return covered;
}

describe.skipIf(!HAS_NGSPICE)("the NE555 astable capture bench", () => {
  const part = CATALOG_PARTS.find((candidate) => candidate.manifest.canonical_mpn === "NE555")!;
  beforeAll(async () => { await preloadCatalogPart(part.id); }, 60_000);

  it("is a valid schematic with no wire crossing a foreign pin", () => {
    const document = ne555AstableDocument(bench(part));
    expect(validateCircuit(document)).toEqual([]);
    expect(pinsCoveredByForeignWires(document)).toEqual([]);
  });

  it("oscillates in native ngspice", async () => {
    const generated = generateNetlistWithCatalog(ne555AstableDocument(bench(part)), "tran", [part]);
    const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 90_000 });
    expect(run.stderr, run.stderr).not.toMatch(/error|singular|aborted/i);
    const swings = Object.values(run.vectors as Record<string, unknown>)
      .map((vector) => (Array.isArray(vector) ? vector : (vector as { values?: number[] }).values) ?? [])
      .filter((values) => values.length > 10 && Math.max(...values) - Math.min(...values) > 1);
    expect(swings.length, "no node swings by more than a volt, so the timer never ran").toBeGreaterThan(0);
  }, 120_000);
});
