import { describe, expect, it } from "vitest";
import type { GeneratedNetlist } from "@opencircuit/circuit-schema";
import type { SerializedSignalExpression, SignalDefinition } from "@opencircuit/signal-workbench";
import {
  SIMULATION_AC_POWER_CONVENTION,
  SIMULATION_CURRENT_POLARITY,
  SIMULATION_POWER_POLARITY,
  SIMULATION_TERMINAL_INDEX_BASE,
  createSimulationSignalContext,
  createSimulationSignalSeries,
  evaluateSimulationSignalExpression,
  simulationCurrentVectorName,
  simulationRawVector,
} from "../src/signals";
import type { SimulationResult, VectorMeta } from "../src/types";
import { testExecutionReceipt } from "./execution-fixture";

const provenance = {
  runKey: "a".repeat(64),
  identityVersion: 1,
  engine: "ngspice-46-opencircuit-wasm1",
  requestType: "runTransient",
  limits: { timeoutMs: 10_000, maxRawfileBytes: 1024, maxSamples: 1024 },
} as const;

const generated: Pick<GeneratedNetlist, "wireNodes" | "componentNodes" | "componentCurrents"> = {
  wireNodes: { w1: "n1", w2: "n2" },
  componentNodes: { r1: ["n1", "0"], q2: ["n2", "n1", "0"] },
  componentCurrents: { r1: "@r1[i]", q2: "@q2[ic]" },
};

function result(vectors: Array<{ meta: Omit<VectorMeta, "bufferIndex">; values: number[] }>, requestType: SimulationResult["provenance"]["requestType"] = "runTransient"): SimulationResult {
  return {
    provenance: { ...provenance, requestType },
    vectors: vectors.map((entry, bufferIndex) => ({ ...entry.meta, bufferIndex })),
    data: new Map(vectors.map((entry) => [entry.meta.name, Float64Array.from(entry.values)])),
    elapsedMs: 1,
    engineMs: 0.5,
    parseMs: 0.1,
    queueMs: 0.2,
    rawfileBytes: 100,
    receipt: testExecutionReceipt(requestType, 100),
  };
}

const transient = result([
  { meta: { name: "time", kind: "time", length: 2, complex: false }, values: [0, 1] },
  { meta: { name: "v(n1)", kind: "voltage", length: 2, complex: false }, values: [5, 4] },
  { meta: { name: "v(n2)", kind: "voltage", length: 2, complex: false }, values: [1, 1] },
  { meta: { name: "i(@r1[i])", kind: "current", length: 2, complex: false }, values: [0.005, 0.004] },
  { meta: { name: "i(@q2[ic])", kind: "current", length: 2, complex: false }, values: [0.002, 0.003] },
  { meta: { name: "i(@q2[ib])", kind: "current", length: 2, complex: false }, values: [0.00002, 0.00003] },
]);

function evaluate(expression: SerializedSignalExpression, source = transient) {
  return evaluateSimulationSignalExpression(expression, generated, source);
}

describe("simulation signal adapter", () => {
  it("resolves stable wire and pin voltage references including differential voltage", () => {
    const wire = evaluate({ kind: "voltage", positive: { kind: "schematic-wire", wireId: "w1" }, negative: { kind: "runtime-node", name: "0" } });
    const differential = evaluate({ kind: "voltage", positive: { kind: "schematic-pin", componentId: "r1", pin: 0 }, negative: { kind: "schematic-wire", wireId: "w2" } });
    expect(wire.ok && [...wire.signal.values]).toEqual([5, 4]);
    expect(differential.ok && [...differential.signal.values]).toEqual([4, 3]);
  });

  it("normalizes actual ngspice current vector names and zero-based terminal signs", () => {
    expect(SIMULATION_TERMINAL_INDEX_BASE).toBe(0);
    expect(SIMULATION_CURRENT_POLARITY).toBe("positive-into-first-terminal");
    expect(simulationCurrentVectorName("@R1[i]")).toBe("i(@r1[i])");
    expect(simulationCurrentVectorName("V1#branch")).toBe("i(v1)");
    const device = evaluate({ kind: "current", component: { kind: "schematic-component", componentId: "r1" } });
    const terminal0 = evaluate({ kind: "current", component: { kind: "schematic-component", componentId: "r1" }, terminal: 0 });
    const terminal1 = evaluate({ kind: "current", component: { kind: "schematic-component", componentId: "r1" }, terminal: 1 });
    expect(device.ok && [...device.signal.values]).toEqual([0.005, 0.004]);
    expect(terminal0.ok && [...terminal0.signal.values]).toEqual([0.005, 0.004]);
    expect(terminal1.ok && [...terminal1.signal.values]).toEqual([-0.005, -0.004]);
  });

  it("exposes only genuine multi-terminal currents and supports explicit registry aliases", () => {
    const collector = evaluate({ kind: "current", component: { kind: "schematic-component", componentId: "q2" }, terminal: 0 });
    const unavailableBase = evaluate({ kind: "current", component: { kind: "schematic-component", componentId: "q2" }, terminal: 1 });
    const registeredBase = evaluateSimulationSignalExpression(
      { kind: "current", component: { kind: "schematic-component", componentId: "q2" }, terminal: "base" },
      generated,
      transient,
      { registry: { components: [{ componentId: "q2", terminalCurrents: [{ terminal: "base", vector: "i(@q2[ib])", sign: 1 }] }] } },
    );
    expect(collector.ok && [...collector.signal.values]).toEqual([0.002, 0.003]);
    expect(unavailableBase).toMatchObject({ ok: false, status: "UNSUPPORTED" });
    expect(registeredBase.ok && [...registeredBase.signal.values]).toEqual([0.00002, 0.00003]);
  });

  it("computes absorbed-positive two-terminal real power and rejects false multi-terminal power", () => {
    expect(SIMULATION_POWER_POLARITY).toBe("absorbed-positive");
    const resistor = evaluate({ kind: "power", component: { kind: "schematic-component", componentId: "r1" } });
    const transistor = evaluate({ kind: "power", component: { kind: "schematic-component", componentId: "q2" } });
    expect(resistor.ok && [...resistor.signal.values]).toEqual([0.025, 0.016]);
    expect(transistor).toMatchObject({ ok: false, status: "UNSUPPORTED" });
  });

  it("preserves AC currents and computes absorbed complex power using peak phasors", () => {
    const ac = result([
      { meta: { name: "frequency", kind: "frequency", length: 2, complex: true }, values: [10, 0, 100, 0] },
      { meta: { name: "v(n1)", kind: "voltage", length: 2, complex: true }, values: [1, 2, 3, 4] },
      { meta: { name: "i(@r1[i])", kind: "current", length: 2, complex: true }, values: [0.1, 0.2, 0.3, 0.4] },
    ], "runAC");
    const voltage = evaluate({ kind: "voltage", positive: { kind: "schematic-wire", wireId: "w1" }, negative: { kind: "runtime-node", name: "0" } }, ac);
    const power = evaluate({ kind: "power", component: { kind: "schematic-component", componentId: "r1" } }, ac);
    const raw = simulationRawVector(ac, "v(n1)");
    const context = createSimulationSignalContext(generated, ac);
    expect(voltage.ok && voltage.signal).toMatchObject({ kind: "complex", length: 2 });
    expect(voltage.ok && [...voltage.signal.values]).toEqual([1, 2, 3, 4]);
    expect(SIMULATION_AC_POWER_CONVENTION).toBe("peak-phasor-0.5-v-conjugate-i");
    expect(power.ok && power.signal).toMatchObject({ kind: "complex", unit: "W" });
    if (power.ok) {
      expect(power.signal.values[0]).toBeCloseTo(0.25, 14);
      expect(power.signal.values[1]).toBeCloseTo(0, 14);
      expect(power.signal.values[2]).toBeCloseTo(1.25, 14);
      expect(power.signal.values[3]).toBeCloseTo(0, 14);
    }
    expect(raw?.meta.complex).toBe(true);
    expect([...context.axis.values]).toEqual([10, 100]);
    expect(context.axis).toMatchObject({ quantity: "frequency", unit: "Hz" });
  });

  it("returns explicit unsupported diagnostics for noise current and power", () => {
    const noise = result([
      { meta: { name: "frequency", kind: "frequency", length: 2, complex: false }, values: [10, 100] },
      { meta: { name: "i(@r1[i])", kind: "current", length: 2, complex: false }, values: [1e-9, 2e-9] },
    ], "runNoise");
    expect(evaluate({ kind: "current", component: { kind: "schematic-component", componentId: "r1" } }, noise)).toMatchObject({ ok: false, status: "UNSUPPORTED", diagnostics: [{ message: expect.stringMatching(/spectral-density.*current/i) }] });
    expect(evaluate({ kind: "power", component: { kind: "schematic-component", componentId: "r1" } }, noise)).toMatchObject({ ok: false, status: "UNSUPPORTED", diagnostics: [{ message: expect.stringMatching(/complex device power/i) }] });
  });

  it("builds a provenance-bearing signal series from a genuine expression", () => {
    const definition: SignalDefinition = {
      id: "sig-r1-current",
      label: "R1 current",
      expression: { kind: "current", component: { kind: "schematic-component", componentId: "r1" } },
      quantity: "current",
      unit: "A",
      polarity: "signed",
    };
    const series = createSimulationSignalSeries(definition, generated, transient);
    expect(series.ok && series.value.runKey).toBe(provenance.runKey);
    expect(series.ok && [...series.value.signal.values]).toEqual([0.005, 0.004]);
    expect(series.ok && [...series.value.axis.values]).toEqual([0, 1]);
  });
});
