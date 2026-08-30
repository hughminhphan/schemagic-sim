import { describe, expect, it } from "vitest";
import { evaluateMeasurement, parseSignalExpression, type SerializedMeasurementDefinition, type SignalEvaluationContext } from "../src/index";
import { FixtureResolver, complex, real } from "./helpers";

function expression(source: string) {
  const parsed = parseSignalExpression(source);
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);
  return parsed.expression;
}

function context(axis: number[], values: number[], resolver = new FixtureResolver()): SignalEvaluationContext {
  resolver.nodes.set("node:0", real(axis.map(() => 0)));
  resolver.nodes.set("node:out", real(values));
  return { resolver, runKey: "run-1", axis: { id: "time", quantity: "time", unit: "s", values: Float64Array.from(axis) } };
}

function definition(kind: SerializedMeasurementDefinition["kind"], extra: Record<string, unknown> = {}): SerializedMeasurementDefinition {
  return { id: kind, name: kind, kind, expression: expression("V(out)"), ...extra } as SerializedMeasurementDefinition;
}

describe("named measurements", () => {
  it("uses piecewise-linear windows and time-weighted integration", () => {
    const ctx = context([0, 1, 3, 4], [0, 2, 2, 0]);
    expect(evaluateMeasurement(definition("minimum"), ctx)).toMatchObject({ status: "OK", value: 0, unit: "V" });
    expect(evaluateMeasurement(definition("maximum"), ctx)).toMatchObject({ status: "OK", value: 2 });
    expect(evaluateMeasurement(definition("peak-to-peak"), ctx)).toMatchObject({ status: "OK", value: 2 });
    expect(evaluateMeasurement(definition("integral"), ctx)).toMatchObject({ status: "OK", value: 6, unit: "V*s" });
    expect(evaluateMeasurement(definition("average"), ctx)).toMatchObject({ status: "OK", value: 1.5 });
    expect(evaluateMeasurement(definition("rms"), ctx).value).toBeCloseTo(Math.sqrt(3), 12);
    expect(evaluateMeasurement(definition("average", { window: { start: 0.5, stop: 3.5 } }), ctx)).toMatchObject({ status: "OK", value: 11 / 6 });
  });

  it("measures explicit edges, frequency, period, duty, rise/fall and delay", () => {
    const axis = Array.from({ length: 9 }, (_, index) => index);
    const waveform = [0, 0, 1, 1, 0, 0, 1, 1, 0];
    const ctx = context(axis, waveform);
    expect(evaluateMeasurement(definition("frequency", { edge: { direction: "rising", ordinal: 1, threshold: 0.5 } }), ctx)).toMatchObject({ status: "OK", value: 0.25, unit: "Hz" });
    expect(evaluateMeasurement(definition("period", { edge: { direction: "rising", ordinal: 1, threshold: 0.5 } }), ctx)).toMatchObject({ status: "OK", value: 4, unit: "s" });
    expect(evaluateMeasurement(definition("duty", { threshold: 0.5 }), ctx)).toMatchObject({ status: "OK", value: 0.5, unit: "1" });
    expect(evaluateMeasurement(definition("rise-time", { lowThreshold: 0.1, highThreshold: 0.9, ordinal: 1 }), ctx).value).toBeCloseTo(0.8, 12);
    expect(evaluateMeasurement(definition("fall-time", { lowThreshold: 0.1, highThreshold: 0.9, ordinal: 1 }), ctx).value).toBeCloseTo(0.8, 12);
    expect(evaluateMeasurement(definition("delay", { reference: expression("V(out)"), referenceEdge: { direction: "rising", ordinal: 1, threshold: 0.5 }, targetEdge: { direction: "rising", ordinal: 2, threshold: 0.5 } }), ctx)).toMatchObject({ status: "OK", value: 4 });
  });

  it("measures overshoot and settling with explicit levels and tolerance", () => {
    const ctx = context([0, 1, 2, 3, 4, 5], [0, 0.8, 1.2, 0.96, 1.01, 1]);
    expect(evaluateMeasurement(definition("overshoot", { initial: 0, final: 1 }), ctx).value).toBeCloseTo(0.2, 12);
    expect(evaluateMeasurement(definition("settling-time", { initial: 0, final: 1, tolerance: { kind: "absolute", value: 0.05 } }), ctx).value).toBeCloseTo(2.625, 12);
  });

  it("measures AC phase as target/reference and rejects invalid cases", () => {
    const resolver = new FixtureResolver();
    resolver.nodes.set("node:0", complex([0, 0, 0, 0, 0, 0]));
    resolver.nodes.set("node:out", complex([0, 1, 0, 1, 0, 1]));
    resolver.nodes.set("node:in", complex([1, 0, 1, 0, 1, 0]));
    const ctx: SignalEvaluationContext = { resolver, runKey: "ac", axis: { id: "frequency", quantity: "frequency", unit: "Hz", values: Float64Array.of(10, 100, 1000) } };
    expect(evaluateMeasurement(definition("phase", { reference: expression("V(in)"), frequency: 100 }), ctx)).toMatchObject({ status: "OK", value: 90, unit: "deg" });
    expect(evaluateMeasurement(definition("frequency", { edge: { direction: "rising", ordinal: 1, threshold: 9 } }), context([0, 1], [0, 1]))).toMatchObject({ status: "INVALID", diagnostics: [{ code: "EDGE_ORDINAL" }] });
    expect(evaluateMeasurement(definition("average"), { ...context([0, 1], [0, 1]), segmentCount: 2 })).toMatchObject({ status: "INVALID", diagnostics: [{ code: "SEGMENT_REQUIRED" }] });
  });

  it("finds a named level crossing on a log-spaced frequency axis", () => {
    const resolver = new FixtureResolver();
    const levelsDb = [-0.1, -1, -5, -12];
    resolver.nodes.set("node:0", complex(levelsDb.flatMap(() => [0, 0])));
    resolver.nodes.set("node:in", complex(levelsDb.flatMap(() => [1, 0])));
    resolver.nodes.set("node:out", complex(levelsDb.flatMap((level) => [10 ** (level / 20), 0])));
    const ctx: SignalEvaluationContext = {
      resolver,
      runKey: "ac-corner",
      axis: { id: "frequency", quantity: "frequency", unit: "Hz", values: Float64Array.of(10, 100, 1000, 10_000) },
    };
    const result = evaluateMeasurement({
      id: "corner",
      name: "-3 dB corner",
      kind: "x-at-level",
      expression: expression("db20(mag(V(out)/V(in)))"),
      threshold: -3,
      direction: "falling",
      ordinal: 1,
    }, ctx);
    expect(result).toMatchObject({ status: "OK", unit: "Hz", provenance: { runKey: "ac-corner" } });
    expect(result.value).toBeCloseTo(Math.sqrt(100 * 1000), 10);
  });

  it("validates x-at-level ordinal, crossing and monotonic axis", () => {
    expect(evaluateMeasurement(definition("x-at-level", { threshold: 0.5, direction: "rising", ordinal: 0 }), context([0, 1], [0, 1]))).toMatchObject({ status: "INVALID", diagnostics: [{ code: "EDGE_ORDINAL" }] });
    expect(evaluateMeasurement(definition("x-at-level", { threshold: 2, direction: "rising", ordinal: 1 }), context([0, 1], [0, 1]))).toMatchObject({ status: "INVALID", diagnostics: [{ code: "NO_CROSSING" }] });
    expect(evaluateMeasurement(definition("x-at-level", { threshold: 0.5, direction: "rising", ordinal: 1 }), context([0, 0], [0, 1]))).toMatchObject({ status: "INVALID", diagnostics: [{ code: "NONMONOTONIC_AXIS" }] });
  });
});
