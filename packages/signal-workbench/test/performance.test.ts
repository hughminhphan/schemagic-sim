import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { computeFFT, evaluateMeasurement, parseSignalExpression, type SignalEvaluationContext } from "../src/index";
import { FixtureResolver, real } from "./helpers";

function expression(source: string) {
  const parsed = parseSignalExpression(source);
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message);
  return parsed.expression;
}

describe("large-vector performance budgets", () => {
  it("keeps linear measurements and a maximum-size FFT within bounded budgets", () => {
    const count = 100_000; const axis = new Float64Array(count); const values = new Float64Array(count);
    for (let index = 0; index < count; index += 1) { axis[index] = index / count; values[index] = Math.sin(2 * Math.PI * 100 * axis[index]!); }
    const resolver = new FixtureResolver(); resolver.nodes.set("node:0", real(new Float64Array(count))); resolver.nodes.set("node:out", real(values));
    const context: SignalEvaluationContext = { resolver, runKey: "benchmark", axis: { id: "time", quantity: "time", unit: "s", values: axis } };
    const measurementStarted = performance.now();
    const measurement = evaluateMeasurement({ id: "rms", name: "RMS", kind: "rms", expression: expression("V(out)") }, context);
    const measurementMs = performance.now() - measurementStarted;
    const fftStarted = performance.now();
    const fft = computeFFT({ expression: expression("V(out)"), window: { start: 0, stop: axis.at(-1)! }, samples: 65_536, windowFunction: "hann", normalization: "one-sided-amplitude", detrend: "mean" }, context);
    const fftMs = performance.now() - fftStarted;
    console.info(`signal-workbench benchmark: 100k RMS ${measurementMs.toFixed(2)} ms; 65536 FFT ${fftMs.toFixed(2)} ms`);
    expect(measurement.status).toBe("OK"); expect(measurementMs).toBeLessThan(1_000);
    expect(fft.ok).toBe(true); expect(fftMs).toBeLessThan(2_000);
  });
});
