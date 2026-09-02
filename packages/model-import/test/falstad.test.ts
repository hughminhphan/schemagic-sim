import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertValidCircuit, generateNetlist, type GeneratedNetlist } from "@opencircuit/circuit-schema";
import { describe, expect, it } from "vitest";
import { decodeFalstadShare, importFalstadCircuit } from "../src/index";

const fixtures = fileURLToPath(new URL("fixtures/falstad/", import.meta.url));
const fixture = (name: string): string => readFileSync(`${fixtures}${name}`, "utf8").trim();

interface FixtureExpectation {
  name: string;
  counts: Record<string, number>;
  nets: string[][];
  cards: Record<string, number>;
  nodeCount: number;
}

const supported: FixtureExpectation[] = [
  {
    name: "rc-low-pass.txt",
    counts: { vsource_sine: 1, resistor: 1, capacitor: 1, ground: 1 },
    nets: [["v1.0", "r1.0"], ["r1.1", "c1.0"], ["v1.1", "c1.1", "g1.0"]],
    cards: { V: 1, R: 1, C: 1 }, nodeCount: 2,
  },
  {
    name: "voltage-divider.txt",
    counts: { vsource: 1, resistor: 2, ground: 1 },
    nets: [["v1.0", "r1.0"], ["r1.1", "r2.0"], ["v1.1", "r2.1", "g1.0"]],
    cards: { V: 1, R: 2 }, nodeCount: 2,
  },
  {
    name: "diode-half-wave.txt",
    counts: { vsource_sine: 1, diode: 1, resistor: 1, ground: 1 },
    nets: [["v1.0", "d1.0"], ["d1.1", "r1.0"], ["v1.1", "r1.1", "g1.0"]],
    cards: { V: 1, D: 1, R: 1 }, nodeCount: 2,
  },
  {
    name: "npn-common-emitter.txt",
    counts: { vsource: 1, resistor: 3, bjt_npn: 1, ground: 2 },
    nets: [["v1.0", "r1.0", "r2.0"], ["r1.1", "q1.0"], ["q1.1", "r2.1", "r3.0"], ["q1.2", "r3.1", "g2.0"], ["v1.1", "g1.0"]],
    cards: { V: 1, R: 3, Q: 1 }, nodeCount: 3,
  },
  {
    name: "potentiometer.txt",
    counts: { vsource: 1, potentiometer: 1, ground: 1 },
    nets: [["v1.0", "pot1.2"], ["v1.1", "pot1.0", "g1.0"]],
    cards: { V: 1, R: 2 }, nodeCount: 2,
  },
  {
    name: "opamp-inverting.txt",
    counts: { vsource: 1, resistor: 2, opamp_ideal: 1, ground: 1 },
    nets: [["v1.0", "r1.0"], ["r1.1", "u1.1", "r2.0"], ["u1.2", "r2.1"], ["v1.1", "u1.0", "g1.0"]],
    cards: { V: 1, R: 2, X: 1 }, nodeCount: 3,
  },
];

function countTypes(types: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const type of types) counts[type] = (counts[type] ?? 0) + 1;
  return counts;
}

function pinNode(generated: GeneratedNetlist, reference: string): string {
  const [componentId, pin] = reference.split(".");
  return generated.componentNodes[componentId!]![Number(pin)]!;
}

function cardCounts(netlist: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const line of netlist.split("\n")) {
    if (!/^[RCLVIDQMX][A-Za-z0-9_.:-]*\s/.test(line)) continue;
    counts[line[0]!] = (counts[line[0]!] ?? 0) + 1;
  }
  return counts;
}

function nonGroundNodeCount(generated: GeneratedNetlist): number {
  return new Set(Object.values(generated.componentNodes).flat().filter((node) => node !== "0")).size;
}

describe("Falstad and CircuitJS imports", () => {
  it("decodes legacy cct and LZString ctz share URLs", () => {
    expect(decodeFalstadShare(fixture("voltage-divider.url"))).toEqual({
      sourceKind: "cct",
      sourceText: `${fixture("voltage-divider.txt")}\n`,
    });
    expect(decodeFalstadShare(fixture("rc-low-pass.url"))).toEqual({
      sourceKind: "ctz",
      sourceText: `${fixture("rc-low-pass.txt")}\n`,
    });
  });

  for (const expectation of supported) {
    it(`imports ${expectation.name} with its expected elements and connectivity`, () => {
      const result = importFalstadCircuit(fixture(expectation.name));
      expect(result.report.unsupported).toEqual([]);
      expect(countTypes(result.document.components.map((component) => component.type))).toEqual(expectation.counts);
      expect(result.document.probes).toHaveLength(1);
      assertValidCircuit(result.document);
      const generated = generateNetlist(result.document);
      for (const net of expectation.nets) expect(new Set(net.map((reference) => pinNode(generated, reference))).size, net.join(" = ")).toBe(1);
      expect(cardCounts(generated.netlist)).toEqual(expectation.cards);
      expect(nonGroundNodeCount(generated)).toBe(expectation.nodeCount);
    });
  }

  it("does not connect an element post that only lies on a wire segment", () => {
    const source = [
      "$ 1 0.000005 10.2 50 5 50",
      "w 0 0 128 0 0",
      "v 0 0 0 64 0 0 40 5 0 0 0.5",
      "r 64 0 64 64 0 1000",
      "g 0 64 0 80 0",
      "g 64 64 64 80 0",
    ].join("\n");
    const generated = generateNetlist(importFalstadCircuit(source).document);
    expect(pinNode(generated, "v1.0")).not.toBe(pinNode(generated, "r1.0"));
  });

  it("keeps the potentiometer wiper floating and emits two non-degenerate resistor cards", () => {
    const generated = generateNetlist(importFalstadCircuit(fixture("potentiometer.txt")).document);
    expect(pinNode(generated, "pot1.1")).not.toBe("0");
    const cards = generated.netlist.split("\n").filter((line) => /^R1[TB]\s/.test(line));
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      const [, firstNode, secondNode] = card.split(/\s+/);
      expect(firstNode, card).not.toBe(secondNode);
    }
  });

  it("maps PMOS drain, gate, and source to the emitter's matching pin roles", () => {
    const result = importFalstadCircuit(fixture("pmos-connectivity.txt"));
    expect(result.report.unsupported).toEqual([]);
    assertValidCircuit(result.document);
    const generated = generateNetlist(result.document);
    expect(pinNode(generated, "m1.0")).toBe(pinNode(generated, "r1.0"));
    expect(pinNode(generated, "m1.1")).toBe(pinNode(generated, "r2.0"));
    expect(pinNode(generated, "m1.2")).toBe(pinNode(generated, "r3.0"));
    expect(new Set(generated.componentNodes.m1)).toHaveLength(3);
  });

  it("maps current sources, PNP and MOSFET devices, and legacy scope traces", () => {
    const source = [
      "$ 1 0.000005 10.2 50 5 50",
      "i 32 64 32 128 0 0.001",
      "t 96 64 128 64 0 -1 0 0 100",
      "f 96 128 128 128 32",
      "f 192 128 224 128 33",
      "g 32 128 32 144 0",
      "o 0 32 0 3 0.5 0.1",
    ].join("\n");
    const result = importFalstadCircuit(source);
    expect(result.report.unsupported).toEqual([]);
    expect(countTypes(result.document.components.map((component) => component.type))).toEqual({
      isource: 1, bjt_pnp: 1, nmos: 1, pmos: 1, ground: 1,
    });
    expect(result.document.probes).toHaveLength(2);
    expect(result.document.probes.map((probe) => probe.expression.kind).sort()).toEqual(["current", "voltage"]);
    assertValidCircuit(result.document);
  });

  it("reports every partial control and unsupported visual or numeric record", () => {
    const source = [
      "$ 1 0.000005 10.2 50 5 50",
      "c 32 32 64 32 0 0.000001 0 2",
      "x 32 16 64 16 0 unsupported\slabel",
      "150 96 32 128 32 0 2 5",
      "38 0 0 100 22000 Adjustable\sresistance",
      "g 32 64 32 80 0",
    ].join("\n");
    const result = importFalstadCircuit(source);
    expect(result.report.unsupported.map((issue) => [issue.lineNumber, issue.elementType, issue.mapping])).toEqual([
      [2, "c", "partial"],
      [3, "x", "unsupported"],
      [4, "150", "unsupported"],
      [5, "38", "partial"],
    ]);
    expect(result.document.components.map((component) => component.type)).toEqual(["capacitor", "ground"]);
  });

  it("imports the supported subset and reports an unsupported transformer line", () => {
    const result = importFalstadCircuit(fixture("unsupported-transformer.txt"));
    expect(countTypes(result.document.components.map((component) => component.type))).toEqual({ vsource: 1, resistor: 1, ground: 1 });
    expect(result.report.unsupported).toEqual([
      expect.objectContaining({
        lineNumber: 4,
        elementType: "T",
        elementLine: "T 128 64 192 64 0 4 1 0 0.999",
        mapping: "unsupported",
        reason: "Transformers are not present in the circuit schema",
      }),
    ]);
    assertValidCircuit(result.document);
  });

  it("produces a native-ngspice-solvable voltage divider netlist", () => {
    const result = importFalstadCircuit(fixture("voltage-divider.txt"));
    const netlist = generateNetlist(result.document).netlist;
    const configured = process.env.NGSPICE_BIN;
    const binary = configured || (["/opt/homebrew/bin/ngspice", "/usr/bin/ngspice"].find((candidate) => {
      try { execFileSync(candidate, ["--version"], { stdio: "ignore" }); return true; } catch { return false; }
    }) ?? "ngspice");
    const solved = spawnSync(binary, ["-b"], { input: netlist, encoding: "utf8" });
    expect(solved.status, solved.stderr || solved.stdout).toBe(0);
    expect(`${solved.stdout}\n${solved.stderr}`).toMatch(/No\. of Data Rows\s*:\s*1/i);
  });
});
