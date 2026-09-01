import { evaluateSignalExpression } from "./evaluator";
import { serializeSignalExpression } from "./parser";
import type {
  EdgeDirection,
  EdgeSelector,
  EvaluatedSignal,
  MeasurementResult,
  MeasurementStatus,
  MeasurementWindow,
  SerializedMeasurementDefinition,
  SignalDiagnostic,
  SignalEvaluationContext,
  UnitSymbol,
} from "./types";
import { MEASUREMENT_ALGORITHM_VERSION } from "./types";
import { canonicalUnit, multiplyDimensions } from "./units";

interface WindowedSeries { x: Float64Array; y: Float64Array; window: MeasurementWindow }

class MeasurementFailure extends Error {
  constructor(readonly status: Exclude<MeasurementStatus, "OK">, readonly diagnostic: SignalDiagnostic) { super(diagnostic.message); }
}

function fail(code: string, message: string, status: Exclude<MeasurementStatus, "OK"> = "INVALID"): never {
  throw new MeasurementFailure(status, { code, message });
}

function realSignal(expression: SerializedMeasurementDefinition["expression"], context: SignalEvaluationContext): EvaluatedSignal {
  const evaluated = evaluateSignalExpression(expression, context.resolver);
  if (!evaluated.ok) throw new MeasurementFailure(evaluated.status, evaluated.diagnostics[0] ?? { code: "EVALUATION", message: "Signal evaluation failed" });
  if (evaluated.signal.kind !== "real") fail("COMPLEX", "Measurement requires a real signal; apply real(), mag(), or phase() explicitly");
  return evaluated.signal;
}

function validateAxis(context: SignalEvaluationContext): Float64Array {
  const axis = context.axis.values;
  if (axis.length < 1) fail("EMPTY_AXIS", "Measurement axis is empty");
  for (let index = 0; index < axis.length; index += 1) {
    const value = axis[index]!;
    if (!Number.isFinite(value)) fail("NONFINITE_AXIS", "Measurement axis contains a non-finite value");
    if (index > 0 && value <= axis[index - 1]!) fail("NONMONOTONIC_AXIS", "Measurement axis must be strictly increasing");
  }
  return axis;
}

function interpolate(xs: Float64Array, ys: Float64Array, target: number, logarithmicAxis = false): number {
  if (target < xs[0]! || target > xs.at(-1)!) fail("WINDOW_RANGE", "Measurement window lies outside the available axis");
  if (logarithmicAxis && (!(target > 0) || !(xs[0]! > 0))) fail("AXIS_DOMAIN", "Log-frequency interpolation requires a positive axis");
  let low = 0;
  let high = xs.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const value = xs[middle]!;
    if (value === target) return ys[middle]!;
    if (value < target) low = middle + 1;
    else high = middle - 1;
  }
  const right = low;
  const left = right - 1;
  const leftAxis = logarithmicAxis ? Math.log(xs[left]!) : xs[left]!;
  const rightAxis = logarithmicAxis ? Math.log(xs[right]!) : xs[right]!;
  const targetAxis = logarithmicAxis ? Math.log(target) : target;
  return ys[left]! + (targetAxis - leftAxis) * (ys[right]! - ys[left]!) / (rightAxis - leftAxis);
}

function windowed(signal: EvaluatedSignal, context: SignalEvaluationContext, requested?: MeasurementWindow, logarithmicAxis = false): WindowedSeries {
  const axis = validateAxis(context);
  if (logarithmicAxis && !(axis[0]! > 0)) fail("AXIS_DOMAIN", "Log-frequency interpolation requires a positive axis");
  if (signal.length !== 1 && signal.length !== axis.length) fail("LENGTH_MISMATCH", `Signal length ${signal.length} does not match axis length ${axis.length}`);
  const start = requested?.start ?? axis[0]!;
  const stop = requested?.stop ?? axis.at(-1)!;
  if (!Number.isFinite(start) || !Number.isFinite(stop) || stop < start) fail("WINDOW", "Measurement window must have finite bounds with stop >= start");
  if (start < axis[0]! || stop > axis.at(-1)!) fail("WINDOW_RANGE", "Measurement window lies outside the available axis");
  if (signal.length === 1) return { x: Float64Array.of(start, ...(stop > start ? [stop] : [])), y: Float64Array.of(signal.values[0]!, ...(stop > start ? [signal.values[0]!] : [])), window: { start, stop } };
  const x: number[] = [start];
  const y: number[] = [interpolate(axis, signal.values, start, logarithmicAxis)];
  for (let index = 0; index < axis.length; index += 1) {
    const value = axis[index]!;
    if (value > start && value < stop) { x.push(value); y.push(signal.values[index]!); }
  }
  if (stop > start) { x.push(stop); y.push(interpolate(axis, signal.values, stop, logarithmicAxis)); }
  return { x: Float64Array.from(x), y: Float64Array.from(y), window: { start, stop } };
}

function requireDuration(series: WindowedSeries): number {
  const duration = series.window.stop - series.window.start;
  if (!(duration > 0) || series.x.length < 2) fail("ZERO_DURATION", "Measurement requires a non-zero window duration");
  return duration;
}

function trapezoid(series: WindowedSeries, square = false): number {
  requireDuration(series);
  let sum = 0;
  for (let index = 1; index < series.x.length; index += 1) {
    const left = series.y[index - 1]!; const right = series.y[index]!;
    sum += (series.x[index]! - series.x[index - 1]!) * ((square ? left * left + right * right : left + right) / 2);
  }
  return sum;
}

function extrema(values: Float64Array): { minimum: number; maximum: number } {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of values) { if (value < minimum) minimum = value; if (value > maximum) maximum = value; }
  return { minimum, maximum };
}

function edgeTimes(series: WindowedSeries, threshold: number, direction: EdgeDirection, logarithmicAxis = false): number[] {
  if (!Number.isFinite(threshold)) fail("THRESHOLD", "Edge threshold must be finite");
  const crossings: number[] = [];
  for (let index = 1; index < series.y.length; index += 1) {
    const before = series.y[index - 1]!; const after = series.y[index]!;
    const crossed = direction === "rising" ? before < threshold && after >= threshold : before > threshold && after <= threshold;
    if (!crossed || after === before) continue;
    const fraction = (threshold - before) / (after - before);
    const left = series.x[index - 1]!;
    const right = series.x[index]!;
    if (logarithmicAxis) {
      if (!(left > 0) || !(right > 0)) fail("AXIS_DOMAIN", "Log-frequency interpolation requires a positive axis");
      crossings.push(Math.exp(Math.log(left) + fraction * (Math.log(right) - Math.log(left))));
    } else crossings.push(left + fraction * (right - left));
  }
  return crossings;
}

function selectedEdge(series: WindowedSeries, selector: EdgeSelector, logarithmicAxis = false): number {
  if (!Number.isInteger(selector.ordinal) || selector.ordinal < 1) fail("EDGE_ORDINAL", "Edge ordinal must be a positive integer");
  const crossing = edgeTimes(series, selector.threshold, selector.direction, logarithmicAxis)[selector.ordinal - 1];
  return crossing ?? fail("NO_CROSSING", `Requested ${selector.direction} crossing ${selector.ordinal} was not found`);
}

function duty(series: WindowedSeries, threshold: number, highWhen: "above" | "below"): number {
  const duration = requireDuration(series);
  let highDuration = 0;
  for (let index = 1; index < series.y.length; index += 1) {
    const x0 = series.x[index - 1]!; const x1 = series.x[index]!;
    const y0 = series.y[index - 1]!; const y1 = series.y[index]!;
    const high0 = highWhen === "above" ? y0 >= threshold : y0 <= threshold;
    const high1 = highWhen === "above" ? y1 >= threshold : y1 <= threshold;
    if (high0 && high1) highDuration += x1 - x0;
    else if (high0 !== high1 && y1 !== y0) {
      const crossing = x0 + (threshold - y0) * (x1 - x0) / (y1 - y0);
      highDuration += high0 ? crossing - x0 : x1 - crossing;
    }
  }
  return highDuration / duration;
}

function riseOrFall(series: WindowedSeries, kind: "rise-time" | "fall-time", low: number, high: number, ordinal: number): number {
  if (!(high > low) || ![low, high].every(Number.isFinite)) fail("THRESHOLD", "Rise/fall thresholds must be finite with high > low");
  if (!Number.isInteger(ordinal) || ordinal < 1) fail("EDGE_ORDINAL", "Rise/fall ordinal must be a positive integer");
  const direction: EdgeDirection = kind === "rise-time" ? "rising" : "falling";
  const startThreshold = direction === "rising" ? low : high;
  const stopThreshold = direction === "rising" ? high : low;
  const start = edgeTimes(series, startThreshold, direction)[ordinal - 1] ?? fail("NO_CROSSING", `Requested ${direction} start crossing was not found`);
  const stop = edgeTimes(series, stopThreshold, direction).find((value) => value > start) ?? fail("NO_CROSSING", `Requested ${direction} stop crossing was not found after the start`);
  return stop - start;
}

function measurementUnit(definition: SerializedMeasurementDefinition, signal: EvaluatedSignal, context: SignalEvaluationContext): UnitSymbol {
  if (definition.kind === "frequency") return "Hz";
  if (definition.kind === "x-at-level") return context.axis.unit;
  if (["period", "rise-time", "fall-time", "delay", "settling-time"].includes(definition.kind)) return context.axis.unit;
  if (definition.kind === "duty" || definition.kind === "overshoot") return "1";
  if (definition.kind === "phase") return "deg";
  if (definition.kind === "integral") return canonicalUnit(multiplyDimensions(signal.dimension, { voltage: 0, current: 0, time: context.axis.quantity === "frequency" ? -1 : context.axis.quantity === "time" ? 1 : 0 }));
  return signal.unit;
}

function phaseMeasurement(definition: Extract<SerializedMeasurementDefinition, { kind: "phase" }>, context: SignalEvaluationContext): number {
  if (context.axis.quantity !== "frequency") fail("ANALYSIS", "Phase measurement requires a frequency axis");
  const target = evaluateSignalExpression(definition.expression, context.resolver);
  const reference = evaluateSignalExpression(definition.reference, context.resolver);
  if (!target.ok) throw new MeasurementFailure(target.status, target.diagnostics[0]!);
  if (!reference.ok) throw new MeasurementFailure(reference.status, reference.diagnostics[0]!);
  if (target.signal.kind !== "complex" || reference.signal.kind !== "complex") fail("COMPLEX_REQUIRED", "Phase measurement requires complex target and reference signals");
  const axis = validateAxis(context);
  if (target.signal.length !== axis.length || reference.signal.length !== axis.length) fail("LENGTH_MISMATCH", "Phase signal lengths must match the frequency axis");
  const start = definition.window?.start ?? axis[0]!;
  const stop = definition.window?.stop ?? axis.at(-1)!;
  if (!(stop >= start) || start < axis[0]! || stop > axis.at(-1)!) fail("WINDOW", "Phase window is invalid or outside the frequency axis");
  if (!(definition.frequency > 0) || definition.frequency < start || definition.frequency > stop) fail("FREQUENCY_RANGE", "Phase frequency lies outside the selected frequency window");
  const phases = new Float64Array(axis.length);
  let offset = 0;
  for (let index = 0; index < axis.length; index += 1) {
    const tr = target.signal.values[index * 2]!; const ti = target.signal.values[index * 2 + 1]!;
    const rr = reference.signal.values[index * 2]!; const ri = reference.signal.values[index * 2 + 1]!;
    const denominator = rr * rr + ri * ri;
    if (denominator === 0 || Math.hypot(tr, ti) === 0) fail("ZERO_MAGNITUDE", "Phase is undefined at zero magnitude");
    const ratioReal = (tr * rr + ti * ri) / denominator;
    const ratioImaginary = (ti * rr - tr * ri) / denominator;
    let phase = Math.atan2(ratioImaginary, ratioReal) * 180 / Math.PI;
    if (definition.unwrap && index > 0) {
      const delta = phase + offset - phases[index - 1]!;
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
      phase += offset;
    }
    phases[index] = phase;
  }
  const logAxis = Float64Array.from(axis, Math.log);
  return interpolate(logAxis, phases, Math.log(definition.frequency));
}

function calculate(definition: SerializedMeasurementDefinition, context: SignalEvaluationContext): { value: number; unit: UnitSymbol; window: MeasurementWindow; canonical: string } {
  if (context.segmentCount && context.segmentCount > 1 && definition.segment === undefined) fail("SEGMENT_REQUIRED", "A DC curve-family measurement must select a segment");
  if (definition.segment !== undefined && context.segment !== definition.segment) fail("SEGMENT_MISMATCH", "Measurement segment does not match the supplied signal context");
  if (definition.kind === "phase") {
    const axis = validateAxis(context);
    const window = definition.window ?? { start: axis[0]!, stop: axis.at(-1)! };
    const value = phaseMeasurement(definition, context);
    return { value, unit: "deg", window, canonical: serializeSignalExpression(definition.expression) };
  }
  const signal = realSignal(definition.expression, context);
  const logarithmicAxis = definition.kind === "x-at-level" && context.axis.quantity === "frequency";
  const series = windowed(signal, context, definition.window, logarithmicAxis);
  let value: number;
  switch (definition.kind) {
    case "minimum": value = extrema(series.y).minimum; break;
    case "maximum": value = extrema(series.y).maximum; break;
    case "peak-to-peak": { const range = extrema(series.y); value = range.maximum - range.minimum; break; }
    case "average": value = trapezoid(series) / requireDuration(series); break;
    case "rms": value = Math.sqrt(trapezoid(series, true) / requireDuration(series)); break;
    case "integral": value = trapezoid(series); break;
    case "x-at-level": value = selectedEdge(series, { threshold: definition.threshold, direction: definition.direction, ordinal: definition.ordinal }, logarithmicAxis); break;
    case "frequency":
    case "period": {
      const crossings = edgeTimes(series, definition.edge.threshold, definition.edge.direction);
      const firstOrdinal = definition.edge.ordinal;
      const lastOrdinal = definition.lastOrdinal ?? crossings.length;
      if (!Number.isInteger(firstOrdinal) || !Number.isInteger(lastOrdinal) || firstOrdinal < 1 || lastOrdinal <= firstOrdinal) fail("EDGE_ORDINAL", "Frequency/period requires at least two ordered edge ordinals");
      const first = crossings[firstOrdinal - 1]; const last = crossings[lastOrdinal - 1];
      if (first === undefined || last === undefined || !(last > first)) fail("NO_CROSSING", "Requested frequency/period crossings were not found");
      const periods = lastOrdinal - firstOrdinal;
      value = definition.kind === "frequency" ? periods / (last - first) : (last - first) / periods;
      break;
    }
    case "duty": value = duty(series, definition.threshold, definition.highWhen ?? "above"); break;
    case "rise-time":
    case "fall-time": value = riseOrFall(series, definition.kind, definition.lowThreshold, definition.highThreshold, definition.ordinal); break;
    case "delay": {
      if (context.axis.quantity !== "time") fail("ANALYSIS", "Delay requires a time axis");
      const referenceSignal = realSignal(definition.reference, context);
      const referenceSeries = windowed(referenceSignal, context, definition.window);
      value = selectedEdge(series, definition.targetEdge) - selectedEdge(referenceSeries, definition.referenceEdge);
      break;
    }
    case "overshoot": {
      const step = definition.final - definition.initial;
      if (!Number.isFinite(step) || step === 0) fail("ZERO_STEP", "Overshoot requires distinct finite initial and final levels");
      const range = extrema(series.y);
      const peak = step > 0 ? range.maximum : range.minimum;
      value = Math.max(0, (peak - definition.final) * Math.sign(step) / Math.abs(step));
      break;
    }
    case "settling-time": {
      if (context.axis.quantity !== "time") fail("ANALYSIS", "Settling time requires a time axis");
      const step = definition.final - definition.initial;
      if (!Number.isFinite(step) || step === 0) fail("ZERO_STEP", "Settling time requires distinct finite initial and final levels");
      const tolerance = definition.tolerance.kind === "absolute" ? definition.tolerance.value : Math.abs(step) * definition.tolerance.value / 100;
      if (!(tolerance > 0) || !Number.isFinite(tolerance)) fail("TOLERANCE", "Settling tolerance must be positive and finite");
      const low = definition.final - tolerance; const high = definition.final + tolerance;
      let lastOutside = -1;
      for (let index = 0; index < series.y.length; index += 1) if (series.y[index]! < low || series.y[index]! > high) lastOutside = index;
      if (lastOutside === series.y.length - 1) fail("NEVER_SETTLED", "Signal does not settle within the measurement window");
      if (lastOutside < 0) value = 0;
      else {
        const y0 = series.y[lastOutside]!; const y1 = series.y[lastOutside + 1]!;
        const boundary = y0 < low ? low : high;
        const time = series.x[lastOutside]! + (boundary - y0) * (series.x[lastOutside + 1]! - series.x[lastOutside]!) / (y1 - y0);
        value = time - series.window.start;
      }
      break;
    }
  }
  if (!Number.isFinite(value)) fail("NONFINITE", "Measurement produced a non-finite result");
  return { value, unit: measurementUnit(definition, signal, context), window: series.window, canonical: signal.canonicalExpression };
}

export function evaluateMeasurement(definition: SerializedMeasurementDefinition, context: SignalEvaluationContext): MeasurementResult {
  const fallbackWindow = definition.window ?? (context.axis.values.length ? { start: context.axis.values[0]!, stop: context.axis.values.at(-1)! } : undefined);
  const provenance = {
    runKey: context.runKey,
    algorithmVersion: MEASUREMENT_ALGORITHM_VERSION,
    canonicalExpression: serializeSignalExpression(definition.expression),
    ...(fallbackWindow ? { window: fallbackWindow } : {}),
    ...(definition.segment !== undefined ? { segment: definition.segment } : {}),
  };
  try {
    const result = calculate(definition, context);
    return { id: definition.id, name: definition.name, kind: definition.kind, status: "OK", value: result.value, unit: result.unit, diagnostics: [], provenance: { ...provenance, canonicalExpression: result.canonical, window: result.window } };
  } catch (caught) {
    if (caught instanceof MeasurementFailure) return { id: definition.id, name: definition.name, kind: definition.kind, status: caught.status, diagnostics: [caught.diagnostic], provenance };
    return { id: definition.id, name: definition.name, kind: definition.kind, status: "INVALID", diagnostics: [{ code: "MEASUREMENT", message: caught instanceof Error ? caught.message : String(caught) }], provenance };
  }
}
