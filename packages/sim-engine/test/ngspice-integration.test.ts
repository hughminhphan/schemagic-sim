import { describe, expect, it } from "vitest";
import { generateNetlist, type CircuitDocument } from "@opencircuit/circuit-schema";
import { createNgspiceEngine } from "../../../tools/ngspice-wasm-build/dist-loader/index.mjs";
import { parseBinaryRawfile, type ParsedRawfile } from "../src/rawfile";
import { evaluateSimulationSignalExpression } from "../src/signals";
import type { SimulationResult } from "../src/types";

const rcFilter: CircuitDocument = {
  format: "opencircuit-circuit",
  version: 3,
  meta: { title: "AC current and power integration" },
  components: [
    { id: "c1", type: "vsource_sine", value: 1, params: { offset: 0, frequency: "1k", ac: 1 }, pos: [8, 20], rot: 0, mirror: false },
    { id: "c2", type: "resistor", value: "1k", pos: [18, 18], rot: 0, mirror: false },
    { id: "c3", type: "capacitor", value: "100n", pos: [26, 20], rot: 90, mirror: false },
    { id: "c4", type: "ground", pos: [8, 22], rot: 0, mirror: false },
    { id: "c5", type: "ground", pos: [26, 22], rot: 0, mirror: false },
  ],
  wires: [
    { id: "w1", points: [[8, 18], [16, 18]] },
    { id: "w2", points: [[20, 18], [26, 18]] },
    { id: "w3", points: [[8, 22], [8, 22]] },
    { id: "w4", points: [[26, 22], [26, 22]] },
  ],
  probes: [],
  sim: {
    mode: "ac",
    ac: { fstart: 10, fstop: 10_000, pointsPerDecade: 4, sweep: "dec", stimulus: { sourceId: "c1", magnitude: 1, phaseDeg: 0 } },
  },
};

function simulationResult(parsed: ParsedRawfile): SimulationResult {
  return {
    provenance: {
      runKey: "f".repeat(64), identityVersion: 1, engine: "ngspice-46-opencircuit-wasm1", requestType: "runAC",
      limits: { timeoutMs: 10_000, maxRawfileBytes: 1024 * 1024, maxSamples: 100_000 },
    },
    vectors: parsed.vectors,
    data: new Map(parsed.vectors.map((vector) => [vector.name, new Float64Array(parsed.buffers[vector.bufferIndex]!) ])),
    elapsedMs: 1,
    engineMs: 1,
    parseMs: 0,
    queueMs: 0,
    rawfileBytes: parsed.bytes,
  };
}

function componentExpression(kind: "current" | "power", componentId: string, terminal?: number) {
  return kind === "current"
    ? { kind, component: { kind: "schematic-component" as const, componentId }, ...(terminal === undefined ? {} : { terminal }) } as const
    : { kind, component: { kind: "schematic-component" as const, componentId } } as const;
}

function expectNear(actual: number, expected: number, scale = 1): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-10 * Math.max(scale, Math.abs(actual), Math.abs(expected)));
}

describe("bundled ngspice raw protocol", () => {
  it("returns genuine RC/source AC currents and absorbed complex power", async () => {
    const generated = generateNetlist(rcFilter, "ac");
    expect(generated.componentCurrents).toEqual({ c1: "v1#branch", c2: "vocsc2#branch", c3: "vocsc3#branch" });
    expect(generated.netlist).toMatch(/^VOCSc2 .* 0 \$ component:c2$/m);
    expect(generated.netlist).toMatch(/^VOCSc3 .* 0 \$ component:c3$/m);

    const engine = await createNgspiceEngine();
    const parsed = parseBinaryRawfile((await engine.runNetlist(generated.netlist)).rawfile);
    const rawNames = parsed.vectors.map((vector) => vector.name);
    expect(rawNames).toEqual(expect.arrayContaining(["i(v1)", "i(vocsc2)", "i(vocsc3)", "frequency"]));
    const result = simulationResult(parsed);

    const sourceCurrent = evaluateSimulationSignalExpression(componentExpression("current", "c1"), generated, result);
    const resistorCurrent = evaluateSimulationSignalExpression(componentExpression("current", "c2"), generated, result);
    const resistorTerminal1 = evaluateSimulationSignalExpression(componentExpression("current", "c2", 1), generated, result);
    const capacitorCurrent = evaluateSimulationSignalExpression(componentExpression("current", "c3"), generated, result);
    const sourcePower = evaluateSimulationSignalExpression(componentExpression("power", "c1"), generated, result);
    const resistorPower = evaluateSimulationSignalExpression(componentExpression("power", "c2"), generated, result);
    const capacitorPower = evaluateSimulationSignalExpression(componentExpression("power", "c3"), generated, result);
    for (const evaluated of [sourceCurrent, resistorCurrent, resistorTerminal1, capacitorCurrent, sourcePower, resistorPower, capacitorPower]) {
      expect(evaluated.ok).toBe(true);
      if (evaluated.ok) expect(evaluated.signal.kind).toBe("complex");
    }
    if (!sourceCurrent.ok || !resistorCurrent.ok || !resistorTerminal1.ok || !capacitorCurrent.ok || !sourcePower.ok || !resistorPower.ok || !capacitorPower.ok) return;

    const point = Math.floor(resistorCurrent.signal.length / 2);
    const pair = (values: Float64Array) => [values[point * 2]!, values[point * 2 + 1]!] as const;
    const [sourceCurrentReal, sourceCurrentImaginary] = pair(sourceCurrent.signal.values);
    const [resistorCurrentReal, resistorCurrentImaginary] = pair(resistorCurrent.signal.values);
    const [resistorReturnReal, resistorReturnImaginary] = pair(resistorTerminal1.signal.values);
    const [capacitorCurrentReal, capacitorCurrentImaginary] = pair(capacitorCurrent.signal.values);
    expectNear(resistorCurrentReal, capacitorCurrentReal, 1e-3);
    expectNear(resistorCurrentImaginary, capacitorCurrentImaginary, 1e-3);
    expectNear(sourceCurrentReal, -resistorCurrentReal, 1e-3);
    expectNear(sourceCurrentImaginary, -resistorCurrentImaginary, 1e-3);
    expectNear(resistorReturnReal, -resistorCurrentReal, 1e-3);
    expectNear(resistorReturnImaginary, -resistorCurrentImaginary, 1e-3);

    const [sourcePowerReal, sourcePowerImaginary] = pair(sourcePower.signal.values);
    const [resistorPowerReal, resistorPowerImaginary] = pair(resistorPower.signal.values);
    const [capacitorPowerReal, capacitorPowerImaginary] = pair(capacitorPower.signal.values);
    expect(resistorPowerReal).toBeGreaterThan(0);
    expectNear(resistorPowerImaginary, 0, 1e-3);
    expectNear(capacitorPowerReal, 0, 1e-3);
    expect(capacitorPowerImaginary).toBeLessThan(0);
    expect(sourcePowerReal).toBeLessThan(0);
    expectNear(sourcePowerReal + resistorPowerReal + capacitorPowerReal, 0, 1e-3);
    expectNear(sourcePowerImaginary + resistorPowerImaginary + capacitorPowerImaginary, 0, 1e-3);
  }, 10_000);
});
