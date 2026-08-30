import { MAX_EXPRESSION_DEPTH, MAX_EXPRESSION_TOKENS, serializeSignalExpression } from "./parser";
import type {
  EvaluateSignalResult,
  EvaluatedSignal,
  MeasurementStatus,
  QuantityDimension,
  SerializedSignalExpression,
  SignalDiagnostic,
  SignalResolver,
  SignalVector,
  UnitSymbol,
} from "./types";
import {
  DIMENSIONLESS,
  canonicalUnit,
  divideDimensions,
  multiplyDimensions,
  powerDimension,
  sameDimension,
  unitDescriptor,
} from "./units";

class EvaluationFailure extends Error {
  constructor(readonly status: Exclude<MeasurementStatus, "OK">, readonly diagnostic: SignalDiagnostic) {
    super(diagnostic.message);
  }
}

function fail(code: string, message: string, status: Exclude<MeasurementStatus, "OK"> = "INVALID"): never {
  throw new EvaluationFailure(status, { code, message });
}

function validVector(signal: SignalVector): SignalVector {
  if (!Number.isSafeInteger(signal.length) || signal.length < 1) fail("SHAPE", "Signal length must be a positive safe integer");
  const expected = signal.length * (signal.kind === "complex" ? 2 : 1);
  if (signal.values.length !== expected) fail("SHAPE", `Signal has ${signal.values.length} stored values, expected ${expected}`);
  for (const value of signal.values) if (!Number.isFinite(value)) fail("NONFINITE", "Signal contains a non-finite value");
  return signal;
}

function resolve(result: ReturnType<SignalResolver["voltage"]>): SignalVector {
  if (result.ok) return validVector(result.signal);
  const status = result.error.code === "UNSUPPORTED" ? "UNSUPPORTED" : result.error.code === "NOT_FOUND" ? "NOT_FOUND" : "INVALID";
  return fail(result.error.code, result.error.message, status);
}

function component(signal: SignalVector, index: number): readonly [number, number] {
  if (signal.kind === "real") return [signal.values[index]!, 0];
  return [signal.values[index * 2]!, signal.values[index * 2 + 1]!];
}

function output(kind: SignalVector["kind"], length: number, dimension: QuantityDimension, unit?: UnitSymbol): SignalVector {
  return { kind, length, dimension, unit: canonicalUnit(dimension, unit), values: new Float64Array(length * (kind === "complex" ? 2 : 1)) };
}

function set(signal: SignalVector, index: number, real: number, imaginary = 0): void {
  if (!Number.isFinite(real) || !Number.isFinite(imaginary)) fail("DOMAIN", "Expression produced a non-finite value");
  if (signal.kind === "real") signal.values[index] = real;
  else { signal.values[index * 2] = real; signal.values[index * 2 + 1] = imaginary; }
}

function compatibleLengths(left: SignalVector, right: SignalVector): number {
  if (left.length === right.length) return left.length;
  if (left.length === 1) return right.length;
  if (right.length === 1) return left.length;
  return fail("LENGTH_MISMATCH", `Signal lengths ${left.length} and ${right.length} do not match`);
}

function at(signal: SignalVector, index: number): readonly [number, number] {
  return component(signal, signal.length === 1 ? 0 : index);
}

function requireAdditiveUnits(left: SignalVector, right: SignalVector): void {
  if (!sameDimension(left.dimension, right.dimension)) fail("DIMENSION", `Cannot combine ${left.unit} and ${right.unit}`);
  if (sameDimension(left.dimension, DIMENSIONLESS) && left.unit !== right.unit && left.unit !== "1" && right.unit !== "1") {
    fail("UNIT", `Cannot combine dimensionless units ${left.unit} and ${right.unit}`);
  }
}

function subtract(left: SignalVector, right: SignalVector): SignalVector {
  requireAdditiveUnits(left, right);
  const length = compatibleLengths(left, right);
  const kind = left.kind === "complex" || right.kind === "complex" ? "complex" : "real";
  const result = output(kind, length, left.dimension, left.unit === "1" ? right.unit : left.unit);
  for (let index = 0; index < length; index += 1) {
    const [lr, li] = at(left, index); const [rr, ri] = at(right, index);
    set(result, index, lr - rr, li - ri);
  }
  return result;
}

function binary(expression: Extract<SerializedSignalExpression, { kind: "binary" }>, left: SignalVector, right: SignalVector): SignalVector {
  const length = compatibleLengths(left, right);
  if (expression.operator === "+" || expression.operator === "-") {
    requireAdditiveUnits(left, right);
    const kind = left.kind === "complex" || right.kind === "complex" ? "complex" : "real";
    const result = output(kind, length, left.dimension, left.unit === "1" ? right.unit : left.unit);
    for (let index = 0; index < length; index += 1) {
      const [lr, li] = at(left, index); const [rr, ri] = at(right, index);
      set(result, index, expression.operator === "+" ? lr + rr : lr - rr, expression.operator === "+" ? li + ri : li - ri);
    }
    return result;
  }
  if (expression.operator === "^") {
    if (!sameDimension(right.dimension, DIMENSIONLESS) || right.kind !== "real") fail("DIMENSION", "Exponent must be a real dimensionless value");
    const exponent = right.values[0]!;
    if (![...right.values].every((value) => value === exponent)) fail("EXPONENT", "Exponent must be constant across the signal");
    if (!sameDimension(left.dimension, DIMENSIONLESS) && (!Number.isInteger(exponent) || Math.abs(exponent) > 8)) {
      fail("EXPONENT", "Dimensional signals require an integer exponent from -8 through 8");
    }
    const dimension = powerDimension(left.dimension, exponent);
    const result = output(left.kind, length, dimension);
    for (let index = 0; index < length; index += 1) {
      const [real, imaginary] = at(left, index);
      if (imaginary === 0) set(result, index, real ** exponent);
      else {
        const radius = Math.hypot(real, imaginary) ** exponent;
        const angle = Math.atan2(imaginary, real) * exponent;
        set(result, index, radius * Math.cos(angle), radius * Math.sin(angle));
      }
    }
    return result;
  }
  const dimension = expression.operator === "*" ? multiplyDimensions(left.dimension, right.dimension) : divideDimensions(left.dimension, right.dimension);
  const kind = left.kind === "complex" || right.kind === "complex" ? "complex" : "real";
  const result = output(kind, length, dimension);
  for (let index = 0; index < length; index += 1) {
    const [a, b] = at(left, index); const [c, d] = at(right, index);
    if (expression.operator === "*") set(result, index, a * c - b * d, a * d + b * c);
    else {
      const denominator = c * c + d * d;
      if (denominator === 0) fail("DIVIDE_BY_ZERO", "Division by zero");
      set(result, index, (a * c + b * d) / denominator, (b * c - a * d) / denominator);
    }
  }
  return result;
}

function scalarTransform(input: SignalVector, name: string, transform: (real: number, imaginary: number) => number, unit?: UnitSymbol): SignalVector {
  const result = output("real", input.length, name === "phase" ? DIMENSIONLESS : input.dimension, unit ?? input.unit);
  for (let index = 0; index < input.length; index += 1) { const [real, imaginary] = component(input, index); set(result, index, transform(real, imaginary)); }
  return result;
}

function call(expression: Extract<SerializedSignalExpression, { kind: "call" }>, args: SignalVector[]): SignalVector {
  const first = args[0] ?? fail("ARITY", `${expression.function} requires an argument`);
  if (expression.function === "min" || expression.function === "max") {
    for (const arg of args) { if (arg.kind !== "real") fail("COMPLEX", `${expression.function} requires real signals`); requireAdditiveUnits(first, arg); }
    const length = args.reduce((current, arg) => compatibleLengths({ ...first, length: current }, arg), first.length);
    const result = output("real", length, first.dimension, first.unit);
    for (let index = 0; index < length; index += 1) set(result, index, Math[expression.function](...args.map((arg) => at(arg, index)[0])));
    return result;
  }
  if (expression.function === "real") return scalarTransform(first, "real", (real) => real);
  if (expression.function === "imag") return scalarTransform(first, "imag", (_real, imaginary) => imaginary);
  if (expression.function === "mag" || expression.function === "abs") return scalarTransform(first, expression.function, Math.hypot);
  if (expression.function === "phase") {
    if (first.kind !== "complex") fail("COMPLEX_REQUIRED", "phase requires a complex signal");
    return scalarTransform(first, "phase", (real, imaginary) => Math.atan2(imaginary, real) * 180 / Math.PI, "deg");
  }
  if (expression.function === "sqrt") {
    const halves = powerDimension(first.dimension, 0.5);
    if (![halves.voltage, halves.current, halves.time].every(Number.isInteger)) fail("DIMENSION", "sqrt requires even unit exponents");
    const result = output(first.kind, first.length, halves);
    for (let index = 0; index < first.length; index += 1) {
      const [real, imaginary] = component(first, index);
      if (imaginary === 0 && real >= 0) set(result, index, Math.sqrt(real));
      else {
        const radius = Math.hypot(real, imaginary);
        const resultReal = Math.sqrt((radius + real) / 2);
        const resultImaginary = Math.sign(imaginary || 1) * Math.sqrt((radius - real) / 2);
        set(result, index, resultReal, resultImaginary);
      }
    }
    return result;
  }
  if (!sameDimension(first.dimension, DIMENSIONLESS)) fail("DIMENSION", `${expression.function} requires a dimensionless signal`);
  if (expression.function === "exp") return scalarTransform(first, "exp", (real, imaginary) => {
    if (imaginary !== 0) fail("COMPLEX", "exp currently requires a real signal");
    return Math.exp(real);
  }, "1");
  if (expression.function === "db20") return scalarTransform(first, "db20", (real, imaginary) => 20 * Math.log10(Math.hypot(real, imaginary)), "dB");
  return scalarTransform(first, expression.function, (real, imaginary) => {
    if (imaginary !== 0) fail("COMPLEX", `${expression.function} currently requires a real signal`);
    return expression.function === "log" ? Math.log10(real) : Math.log(real);
  }, "1");
}

function evaluate(expression: SerializedSignalExpression, resolver: SignalResolver, state: { nodes: number; depth: number }): SignalVector {
  state.nodes += 1;
  state.depth += 1;
  if (state.nodes > MAX_EXPRESSION_TOKENS || state.depth > MAX_EXPRESSION_DEPTH) fail("AST_LIMIT", "Serialized signal expression exceeds safety bounds");
  let result: SignalVector;
  switch (expression.kind) {
    case "constant": {
      if (!Number.isFinite(expression.value)) fail("NONFINITE", "Constant must be finite");
      const descriptor = unitDescriptor(expression.unit);
      const unit = expression.unit === "deg" ? "rad" : expression.unit;
      result = { kind: "real", unit, dimension: descriptor.dimension, length: 1, values: Float64Array.of(expression.value * descriptor.scale) };
      break;
    }
    case "voltage": result = subtract(resolve(resolver.voltage(expression.positive)), resolve(resolver.voltage(expression.negative))); break;
    case "current": result = resolve(resolver.current(expression.component, expression.terminal)); break;
    case "power": result = resolve(resolver.power(expression.component)); break;
    case "unary": {
      const operand = evaluate(expression.operand, resolver, state);
      if (expression.operator === "+") result = operand;
      else { result = { ...operand, values: Float64Array.from(operand.values, (value) => -value) }; }
      break;
    }
    case "binary": result = binary(expression, evaluate(expression.left, resolver, state), evaluate(expression.right, resolver, state)); break;
    case "call": result = call(expression, expression.arguments.map((argument) => evaluate(argument, resolver, state))); break;
  }
  state.depth -= 1;
  return validVector(result);
}

export function evaluateSignalExpression(expression: SerializedSignalExpression, resolver: SignalResolver): EvaluateSignalResult {
  try {
    const result = evaluate(expression, resolver, { nodes: 0, depth: 0 });
    const signal: EvaluatedSignal = { ...result, canonicalExpression: serializeSignalExpression(expression) };
    return { ok: true, signal };
  } catch (caught) {
    if (caught instanceof EvaluationFailure) return { ok: false, status: caught.status, diagnostics: [caught.diagnostic] };
    return { ok: false, status: "INVALID", diagnostics: [{ code: "EVALUATION", message: caught instanceof Error ? caught.message : String(caught) }] };
  }
}
