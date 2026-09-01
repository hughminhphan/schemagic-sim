import { describe, expect, it } from "vitest";
import {
  buildXYSeries,
  compareSeries,
  computeFFT,
  evaluateSignalExpression,
  evaluateTrigger,
  parseSignalExpression,
  type SignalDefinition,
  type SignalEvaluationContext,
  type SignalSeries,
} from "../src/index";
import { FixtureResolver, real } from "./helpers";

function expression(source: string) {
  const parsed = parseSignalExpression(source);
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);
  return parsed.expression;
}

function seriesContext(axis: number[], signals: Record<string, number[]>): SignalEvaluationContext {
  const resolver = new FixtureResolver();
  resolver.nodes.set("node:0", real(axis.map(() => 0)));
  for (const [name, values] of Object.entries(signals)) resolver.nodes.set(`node:${name}`, real(values));
  return { resolver, runKey: "run", axis: { id: "time", quantity: "time", unit: "s", values: Float64Array.from(axis) } };
}

describe("FFT, XY, trigger and comparison transforms", () => {
  it("resamples adaptive transient data and returns normalized FFT metadata", () => {
    const sourceSamples = 4097; const frequency = 50;
    const axis = Array.from({ length: sourceSamples }, (_, index) => index / (sourceSamples - 1));
    const values = axis.map((time) => Math.sin(2 * Math.PI * frequency * time));
    const result = computeFFT({ expression: expression("V(out)"), window: { start: 0, stop: 1 }, samples: 4096, windowFunction: "hann", normalization: "one-sided-amplitude", detrend: "mean" }, seriesContext(axis, { out: values }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    let peak = 1;
    for (let index = 2; index < result.value.spectrum.length; index += 1) if (result.value.spectrum[index]! > result.value.spectrum[peak]!) peak = index;
    expect(result.value.frequencies[peak]).toBeCloseTo(frequency, 10);
    expect(result.value.spectrum[peak]).toBeCloseTo(1, 2);
    expect(result.value).toMatchObject({ sampleRate: 4096, effectiveSampleRate: 4096, sampleCount: 4096, binWidth: 1, windowFunction: "hann", sourceUnit: "V" });
  });

  it("preserves source order in XY/VI series", () => {
    const result = buildXYSeries({ x: expression("V(x)"), y: expression("V(y)") }, seriesContext([0, 1, 2], { x: [0, 2, 1], y: [3, 4, 5] }));
    expect(result.ok && [...result.value.x]).toEqual([0, 2, 1]);
    expect(result.ok && result.value.sourceOrderPreserved).toBe(true);
  });

  it("crops a requested trigger window around the crossing and preserves legacy full-axis configs", () => {
    const context = seriesContext([0, 1, 2, 3, 4], { out: [0, 0, 1, 1, 1] });
    const cropped = evaluateTrigger({ expression: expression("V(out)"), mode: "normal", edge: "rising", level: 0.5, holdoff: 0, pretrigger: 0.5, windowDuration: 2 }, context);
    expect(cropped).toMatchObject({ state: "triggered", triggerTime: 1.5, triggerIndex: 2, window: { start: 0.5, stop: 2.5 } });
    const legacy = evaluateTrigger({ expression: expression("V(out)"), mode: "single", edge: "rising", level: 0.5, holdoff: 0, pretrigger: 0.5 }, context);
    expect(legacy).toMatchObject({ state: "complete", window: { start: 0, stop: 4 } });
  });

  it("distinguishes a live normal frame from a completed single capture", () => {
    const context = seriesContext([0, 1, 2, 3], { out: [0, 0, 1, 1] });
    const base = { expression: expression("V(out)"), edge: "rising" as const, level: 0.5, holdoff: 0, pretrigger: 0.5, windowDuration: 2 };
    expect(evaluateTrigger({ ...base, mode: "normal" }, context)).toMatchObject({ state: "triggered", triggerTime: 1.5 });
    expect(evaluateTrigger({ ...base, mode: "single" }, context)).toMatchObject({ state: "complete", triggerTime: 1.5 });
  });

  it("keeps no-crossing normal and single captures waiting while auto returns an explicit fallback", () => {
    const context = seriesContext([0, 1, 2], { out: [0, 0, 0] });
    const base = { expression: expression("V(out)"), edge: "rising" as const, level: 0.5, holdoff: 0, pretrigger: 0.25, windowDuration: 1 };
    expect(evaluateTrigger({ ...base, mode: "normal" }, context)).toMatchObject({ state: "waiting", diagnostics: [{ code: "NO_CROSSING" }] });
    expect(evaluateTrigger({ ...base, mode: "single" }, context)).toMatchObject({ state: "waiting", diagnostics: [{ code: "NO_CROSSING" }] });
    expect(evaluateTrigger({ ...base, mode: "auto" }, context)).toMatchObject({ state: "complete", window: { start: 1, stop: 2 }, diagnostics: [{ code: "AUTO_FALLBACK" }] });
  });

  it("validates pretrigger bounds and trigger duration against the sampled axis", () => {
    const context = seriesContext([0, 1, 2], { out: [0, 1, 1] });
    const base = { expression: expression("V(out)"), mode: "normal" as const, edge: "rising" as const, level: 0.5, holdoff: 0 };
    expect(evaluateTrigger({ ...base, pretrigger: -0.01 }, context)).toMatchObject({ state: "armed", diagnostics: [{ code: "TRIGGER_CONFIG" }] });
    expect(evaluateTrigger({ ...base, pretrigger: 1.01 }, context)).toMatchObject({ state: "armed", diagnostics: [{ code: "TRIGGER_CONFIG" }] });
    expect(evaluateTrigger({ ...base, pretrigger: 0.5, windowDuration: 0 }, context)).toMatchObject({ state: "armed", diagnostics: [{ code: "TRIGGER_WINDOW" }] });
    expect(evaluateTrigger({ ...base, pretrigger: 0.5, windowDuration: 2.01 }, context)).toMatchObject({ state: "armed", diagnostics: [{ code: "TRIGGER_WINDOW" }] });
  });

  it("compares compatible runs by axis interpolation", () => {
    const makeSeries = (runKey: string, axis: number[], values: number[]): SignalSeries => {
      const context = seriesContext(axis, { out: values });
      const signal = evaluateSignalExpression(expression("V(out)"), context.resolver);
      if (!signal.ok) throw new Error(signal.diagnostics[0]?.message);
      const definition: SignalDefinition = { id: "out", label: "out", expression: expression("V(out)"), quantity: "voltage", unit: "V", polarity: "signed" };
      return { definition, runKey, axis: context.axis, signal: signal.signal };
    };
    const result = compareSeries(makeSeries("a", [0, 1, 2], [0, 1, 2]), makeSeries("b", [0, 0.5, 1, 1.5, 2], [0, 1, 2, 3, 4]));
    expect(result.status).toBe("OK");
    expect(result.difference && [...result.difference]).toEqual([0, -1, -2]);
  });
});
