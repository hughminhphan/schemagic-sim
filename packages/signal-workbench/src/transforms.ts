import { evaluateSignalExpression } from "./evaluator";
import type {
  ComparisonCompatibility,
  ComparisonResult,
  EvaluatedSignal,
  FFTDefinition,
  FFTResult,
  MeasurementStatus,
  MeasurementWindow,
  SignalDiagnostic,
  SignalEvaluationContext,
  SignalSeries,
  TransformResult,
  TriggerConfig,
  TriggerResult,
  XYDefinition,
  XYResult,
} from "./types";

export const MAX_FFT_SAMPLES = 65_536;
export const MAX_RESAMPLE_GAP_FACTOR = 8;

class TransformFailure extends Error {
  constructor(readonly status: Exclude<MeasurementStatus, "OK">, readonly diagnostic: SignalDiagnostic) { super(diagnostic.message); }
}

function fail(code: string, message: string, status: Exclude<MeasurementStatus, "OK"> = "INVALID"): never {
  throw new TransformFailure(status, { code, message });
}

function wrap<T>(operation: () => T): TransformResult<T> {
  try { return { ok: true, value: operation() }; }
  catch (caught) {
    if (caught instanceof TransformFailure) return { ok: false, status: caught.status, diagnostics: [caught.diagnostic] };
    return { ok: false, status: "INVALID", diagnostics: [{ code: "TRANSFORM", message: caught instanceof Error ? caught.message : String(caught) }] };
  }
}

function evaluatedReal(expression: FFTDefinition["expression"], context: SignalEvaluationContext): EvaluatedSignal {
  const result = evaluateSignalExpression(expression, context.resolver);
  if (!result.ok) throw new TransformFailure(result.status, result.diagnostics[0] ?? { code: "EVALUATION", message: "Signal evaluation failed" });
  if (result.signal.kind !== "real") fail("COMPLEX", "Transform requires a real signal; apply real(), mag(), or phase() explicitly");
  return result.signal;
}

function validAxis(context: SignalEvaluationContext): Float64Array {
  const axis = context.axis.values;
  if (axis.length < 2) fail("AXIS", "Transform requires at least two axis points");
  for (let index = 0; index < axis.length; index += 1) {
    if (!Number.isFinite(axis[index]!)) fail("NONFINITE_AXIS", "Axis contains a non-finite value");
    if (index > 0 && axis[index]! <= axis[index - 1]!) fail("NONMONOTONIC_AXIS", "Axis must be strictly increasing");
  }
  return axis;
}

function interpolate(xs: Float64Array, ys: Float64Array, target: number): number {
  if (target < xs[0]! || target > xs.at(-1)!) fail("RANGE", "Interpolation target is outside the source axis");
  let low = 0; let high = xs.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1; const value = xs[middle]!;
    if (value === target) return ys[middle]!;
    if (value < target) low = middle + 1; else high = middle - 1;
  }
  const right = low; const left = right - 1;
  return ys[left]! + (target - xs[left]!) * (ys[right]! - ys[left]!) / (xs[right]! - xs[left]!);
}

function validateWindow(window: MeasurementWindow, axis: Float64Array): number {
  if (![window.start, window.stop].every(Number.isFinite) || !(window.stop > window.start)) fail("WINDOW", "Transform window must have finite bounds with stop > start");
  if (window.start < axis[0]! || window.stop > axis.at(-1)!) fail("WINDOW_RANGE", "Transform window lies outside the source axis");
  return window.stop - window.start;
}

function fftInPlace(real: Float64Array, imaginary: Float64Array): void {
  const length = real.length;
  for (let index = 1, reversed = 0; index < length; index += 1) {
    let bit = length >>> 1;
    for (; reversed & bit; bit >>>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      const realValue = real[index]!; real[index] = real[reversed]!; real[reversed] = realValue;
      const imaginaryValue = imaginary[index]!; imaginary[index] = imaginary[reversed]!; imaginary[reversed] = imaginaryValue;
    }
  }
  for (let size = 2; size <= length; size *= 2) {
    const angle = -2 * Math.PI / size;
    const stepReal = Math.cos(angle); const stepImaginary = Math.sin(angle);
    for (let start = 0; start < length; start += size) {
      let twiddleReal = 1; let twiddleImaginary = 0;
      for (let offset = 0; offset < size / 2; offset += 1) {
        const even = start + offset; const odd = even + size / 2;
        const oddReal = real[odd]! * twiddleReal - imaginary[odd]! * twiddleImaginary;
        const oddImaginary = real[odd]! * twiddleImaginary + imaginary[odd]! * twiddleReal;
        const evenReal = real[even]!; const evenImaginary = imaginary[even]!;
        real[even] = evenReal + oddReal; imaginary[even] = evenImaginary + oddImaginary;
        real[odd] = evenReal - oddReal; imaginary[odd] = evenImaginary - oddImaginary;
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
}

export function computeFFT(definition: FFTDefinition, context: SignalEvaluationContext): TransformResult<FFTResult> {
  return wrap(() => {
    if (context.axis.quantity !== "time" || context.axis.unit !== "s") fail("ANALYSIS", "FFT requires a time axis in seconds");
    if (!Number.isInteger(definition.samples) || definition.samples < 2 || definition.samples > MAX_FFT_SAMPLES || (definition.samples & (definition.samples - 1)) !== 0) {
      fail("FFT_SIZE", `FFT sample count must be a power of two from 2 through ${MAX_FFT_SAMPLES}`);
    }
    const signal = evaluatedReal(definition.expression, context); const axis = validAxis(context);
    if (signal.length !== axis.length) fail("LENGTH_MISMATCH", "FFT signal length must match its time axis");
    const duration = validateWindow(definition.window, axis);
    const sampleRate = definition.samples / duration; const interval = 1 / sampleRate;
    let maximumGap = 0;
    for (let index = 1; index < axis.length; index += 1) {
      if (axis[index]! <= definition.window.start || axis[index - 1]! >= definition.window.stop) continue;
      maximumGap = Math.max(maximumGap, axis[index]! - axis[index - 1]!);
    }
    if (maximumGap > interval * MAX_RESAMPLE_GAP_FACTOR) fail("RESAMPLE_GAP", `Source gap ${maximumGap} s exceeds ${MAX_RESAMPLE_GAP_FACTOR} FFT sample intervals`);
    const real = new Float64Array(definition.samples); const imaginary = new Float64Array(definition.samples);
    for (let index = 0; index < definition.samples; index += 1) real[index] = interpolate(axis, signal.values, definition.window.start + index * interval);
    if ((definition.detrend ?? "mean") === "mean") {
      let mean = 0; for (const value of real) mean += value; mean /= real.length;
      for (let index = 0; index < real.length; index += 1) real[index] = real[index]! - mean;
    }
    let windowSum = 0; let windowSquareSum = 0;
    for (let index = 0; index < real.length; index += 1) {
      const weight = definition.windowFunction === "hann" ? 0.5 * (1 - Math.cos(2 * Math.PI * index / (real.length - 1))) : 1;
      real[index] = real[index]! * weight; windowSum += weight; windowSquareSum += weight * weight;
    }
    const coherentGain = windowSum / real.length;
    if (!(coherentGain > 0)) fail("WINDOW_GAIN", "FFT window has zero coherent gain");
    fftInPlace(real, imaginary);
    const bins = definition.samples / 2 + 1;
    const frequencies = new Float64Array(bins); const outputReal = new Float64Array(bins); const outputImaginary = new Float64Array(bins); const spectrum = new Float64Array(bins);
    const scale = definition.spectrumScale ?? "linear";
    for (let index = 0; index < bins; index += 1) {
      frequencies[index] = index * sampleRate / definition.samples;
      const oneSided = index === 0 || index === definition.samples / 2 ? 1 : 2;
      outputReal[index] = real[index]! * oneSided / (definition.samples * coherentGain);
      outputImaginary[index] = imaginary[index]! * oneSided / (definition.samples * coherentGain);
      const linear = definition.normalization === "one-sided-amplitude"
        ? Math.hypot(outputReal[index]!, outputImaginary[index]!)
        : oneSided * (real[index]! ** 2 + imaginary[index]! ** 2) / (sampleRate * windowSquareSum);
      spectrum[index] = scale === "db" ? (definition.normalization === "one-sided-amplitude" ? 20 : 10) * Math.log10(linear) : linear;
      if (!Number.isFinite(spectrum[index]!)) fail("LOG_ZERO", "Log spectrum is undefined for a zero-valued bin; use linear scale or a nonzero signal");
    }
    return {
      frequencies,
      real: outputReal,
      imaginary: outputImaginary,
      spectrum,
      sourceUnit: signal.unit,
      spectrumUnit: scale === "db" ? "dB" : definition.normalization === "one-sided-amplitude" ? signal.unit : `${signal.unit}^2/Hz`,
      sampleRate,
      effectiveSampleRate: sampleRate,
      sampleCount: definition.samples,
      binWidth: sampleRate / definition.samples,
      coherentGain,
      windowFunction: definition.windowFunction,
      window: definition.window,
      normalization: definition.normalization,
      spectrumScale: scale,
    };
  });
}

export function toLogSpectrum(result: FFTResult, reference = 1): TransformResult<Float64Array> {
  return wrap(() => {
    if (!(reference > 0) || !Number.isFinite(reference)) fail("REFERENCE", "Log-spectrum reference must be positive and finite");
    if (result.spectrumScale === "db") return result.spectrum.slice();
    const factor = result.normalization === "one-sided-amplitude" ? 20 : 10;
    return Float64Array.from(result.spectrum, (value) => {
      if (!(value > 0) || !Number.isFinite(value)) fail("LOG_ZERO", "Log spectrum requires positive finite values");
      return factor * Math.log10(value / reference);
    });
  });
}

function slicedXY(xSignal: EvaluatedSignal, ySignal: EvaluatedSignal, context: SignalEvaluationContext, window?: MeasurementWindow): XYResult {
  const axis = validAxis(context);
  if ((xSignal.length !== 1 && xSignal.length !== axis.length) || (ySignal.length !== 1 && ySignal.length !== axis.length)) fail("LENGTH_MISMATCH", "XY signals must share the run axis");
  const start = window?.start ?? axis[0]!; const stop = window?.stop ?? axis.at(-1)!;
  if (stop < start || start < axis[0]! || stop > axis.at(-1)!) fail("WINDOW", "XY window is invalid or outside the source axis");
  const indices: number[] = [];
  for (let index = 0; index < axis.length; index += 1) if (axis[index]! >= start && axis[index]! <= stop) indices.push(index);
  if (indices.length === 0) fail("EMPTY_WINDOW", "XY window contains no source samples");
  const x = new Float64Array(indices.length); const y = new Float64Array(indices.length);
  indices.forEach((sourceIndex, outputIndex) => {
    x[outputIndex] = xSignal.values[xSignal.length === 1 ? 0 : sourceIndex]!;
    y[outputIndex] = ySignal.values[ySignal.length === 1 ? 0 : sourceIndex]!;
  });
  return { x, y, xUnit: xSignal.unit, yUnit: ySignal.unit, sourceOrderPreserved: true };
}

export function buildXYSeries(definition: XYDefinition, context: SignalEvaluationContext): TransformResult<XYResult> {
  return wrap(() => slicedXY(evaluatedReal(definition.x, context), evaluatedReal(definition.y, context), context, definition.window));
}

function crossingTimes(signal: EvaluatedSignal, axis: Float64Array, config: TriggerConfig): Array<{ time: number; index: number }> {
  const crossings: Array<{ time: number; index: number }> = [];
  let last = -Infinity;
  for (let index = 1; index < axis.length; index += 1) {
    const before = signal.values[index - 1]!; const after = signal.values[index]!;
    const crossed = config.edge === "rising" ? before < config.level && after >= config.level : before > config.level && after <= config.level;
    if (!crossed || before === after) continue;
    const time = axis[index - 1]! + (config.level - before) * (axis[index]! - axis[index - 1]!) / (after - before);
    if (time - last < config.holdoff) continue;
    crossings.push({ time, index }); last = time;
  }
  return crossings;
}

export function evaluateTrigger(config: TriggerConfig, context: SignalEvaluationContext): TriggerResult {
  try {
    if (!Number.isFinite(config.level) || !Number.isFinite(config.holdoff) || config.holdoff < 0) fail("TRIGGER_CONFIG", "Trigger level must be finite and holdoff must be finite and non-negative");
    if (!Number.isFinite(config.pretrigger) || config.pretrigger < 0 || config.pretrigger > 1) fail("TRIGGER_CONFIG", "Pretrigger must be a fraction from 0 through 1");
    const signal = evaluatedReal(config.expression, context); const axis = validAxis(context);
    if (signal.length !== axis.length) fail("LENGTH_MISMATCH", "Trigger signal must match the acquisition axis");
    const fullWindow = { start: axis[0]!, stop: axis.at(-1)! };
    const fullDuration = fullWindow.stop - fullWindow.start;
    const duration = config.windowDuration ?? fullDuration;
    if (!Number.isFinite(duration) || duration <= 0 || duration > fullDuration) {
      fail("TRIGGER_WINDOW", "Trigger window duration must be finite, greater than zero, and no longer than the sampled axis span");
    }
    const crossing = crossingTimes(signal, axis, config)[0];
    if (!crossing) {
      if (config.mode === "auto") return { state: "complete", window: { start: fullWindow.stop - duration, stop: fullWindow.stop }, diagnostics: [{ code: "AUTO_FALLBACK", message: "No threshold crossing; auto trigger returned the latest available acquisition window" }] };
      return { state: "waiting", diagnostics: [{ code: "NO_CROSSING", message: "Trigger is armed and waiting for the requested crossing" }] };
    }
    const desiredStart = crossing.time - config.pretrigger * duration;
    const start = Math.max(fullWindow.start, Math.min(desiredStart, fullWindow.stop - duration));
    return { state: config.mode === "single" ? "complete" : "triggered", triggerTime: crossing.time, triggerIndex: crossing.index, window: { start, stop: start + duration }, diagnostics: [] };
  } catch (caught) {
    const diagnostic = caught instanceof TransformFailure ? caught.diagnostic : { code: "TRIGGER", message: caught instanceof Error ? caught.message : String(caught) };
    return { state: "armed", diagnostics: [diagnostic] };
  }
}

export function compareSeriesCompatibility(left: SignalSeries, right: SignalSeries): ComparisonCompatibility {
  const sameQuantity = left.definition.quantity === right.definition.quantity;
  const sameUnit = left.signal.unit === right.signal.unit;
  const sameAxisQuantity = left.axis.quantity === right.axis.quantity && left.axis.unit === right.axis.unit;
  const reasons: string[] = [];
  if (!sameQuantity) reasons.push("Signal quantities differ");
  if (!sameUnit) reasons.push("Signal units differ");
  if (!sameAxisQuantity) reasons.push("Axis quantities or units differ");
  const start = Math.max(left.axis.values[0] ?? Infinity, right.axis.values[0] ?? Infinity);
  const stop = Math.min(left.axis.values.at(-1) ?? -Infinity, right.axis.values.at(-1) ?? -Infinity);
  const overlap = stop >= start ? { start, stop } : undefined;
  if (!overlap) reasons.push("Signal axes do not overlap");
  return { compatible: reasons.length === 0, reasons, sameQuantity, sameUnit, sameAxisQuantity, ...(overlap ? { overlappingWindow: overlap } : {}) };
}

export function compareSeries(left: SignalSeries, right: SignalSeries): ComparisonResult {
  const compatibility = compareSeriesCompatibility(left, right);
  const base = { compatibility, leftRunKey: left.runKey, rightRunKey: right.runKey };
  if (!compatibility.compatible || !compatibility.overlappingWindow) return { status: "INCOMPATIBLE", ...base, diagnostics: compatibility.reasons.map((message) => ({ code: "INCOMPATIBLE", message })) };
  if (left.signal.kind !== "real" || right.signal.kind !== "real" || left.signal.length !== left.axis.values.length || right.signal.length !== right.axis.values.length) {
    return { status: "INVALID", ...base, diagnostics: [{ code: "SHAPE", message: "Comparison requires real signals matching their axes" }] };
  }
  try {
    validAxis({ ...({} as SignalEvaluationContext), axis: left.axis }); validAxis({ ...({} as SignalEvaluationContext), axis: right.axis });
    const selected: number[] = [];
    for (const value of left.axis.values) if (value >= compatibility.overlappingWindow.start && value <= compatibility.overlappingWindow.stop) selected.push(value);
    const axis = Float64Array.from(selected); const difference = new Float64Array(axis.length);
    for (let index = 0; index < axis.length; index += 1) difference[index] = interpolate(left.axis.values, left.signal.values, axis[index]!) - interpolate(right.axis.values, right.signal.values, axis[index]!);
    return { status: "OK", ...base, axis, difference, diagnostics: [] };
  } catch (caught) {
    return { status: "INVALID", ...base, diagnostics: [{ code: "COMPARISON", message: caught instanceof Error ? caught.message : String(caught) }] };
  }
}
