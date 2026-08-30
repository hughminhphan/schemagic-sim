import type { GeneratedNetlist } from "@opencircuit/circuit-schema";
import {
  CURRENT_DIMENSION,
  POWER_DIMENSION,
  VOLTAGE_DIMENSION,
  evaluateSignalExpression,
  type EvaluateSignalResult,
  type SerializedComponentReference,
  type SerializedNodeReference,
  type SerializedSignalExpression,
  type SerializedTerminalReference,
  type SignalDefinition,
  type SignalEvaluationContext,
  type SignalResolution,
  type SignalResolver,
  type SignalSeries,
  type SignalVector,
  type TransformResult,
} from "@opencircuit/signal-workbench";
import type { DCSweepSegment, SimulationResult, VectorMeta } from "./types";

export const SIMULATION_CURRENT_POLARITY = "positive-into-first-terminal" as const;
export const SIMULATION_POWER_POLARITY = "absorbed-positive" as const;
/** ngspice AC amplitudes are peak phasors, so absorbed complex power is S = 0.5 * V * conjugate(I). */
export const SIMULATION_AC_POWER_CONVENTION = "peak-phasor-0.5-v-conjugate-i" as const;
export const SIMULATION_TERMINAL_INDEX_BASE = 0 as const;

export interface RegisteredNodeSignal {
  runtimeNode: string;
  vector: string;
  wireIds?: readonly string[];
  pins?: readonly { componentId: string; pin: number }[];
}

export interface RegisteredTerminalCurrentSignal {
  terminal: SerializedTerminalReference;
  vector: string;
  /** Multiply the raw vector by this sign to normalize current as entering the named terminal. */
  sign: 1 | -1;
}

export interface RegisteredComponentSignal {
  componentId: string;
  runtimeDevice?: string;
  /** Default device current, normalized positive into the component's first netlist terminal. */
  current?: { vector: string; sign: 1 | -1 };
  terminalCurrents?: readonly RegisteredTerminalCurrentSignal[];
  power?:
    | { kind: "vector"; vector: string; sign: 1 | -1; convention: "instantaneous-absorbed" | "complex-absorbed" }
    | { kind: "two-terminal"; positive: SerializedNodeReference; negative: SerializedNodeReference; currentVector: string; currentSign: 1 | -1 };
}

/** Optional exact signal metadata generated alongside a netlist. Missing metadata is never guessed for terminal currents. */
export interface SimulationSignalRegistry {
  nodes?: readonly RegisteredNodeSignal[];
  components?: readonly RegisteredComponentSignal[];
}

export interface SimulationSignalOptions {
  registry?: SimulationSignalRegistry;
  axisVector?: string;
  /** Required to evaluate a stepped DC result as one curve. Zero based. */
  segment?: number;
}

type GeneratedSignalNetlist = Pick<GeneratedNetlist, "wireNodes" | "componentNodes" | "componentCurrents">;

function failure(code: "NOT_FOUND" | "AMBIGUOUS" | "UNSUPPORTED", message: string): SignalResolution {
  return { ok: false, error: { code, message } };
}

function selection(result: SimulationResult, segment: number | undefined): DCSweepSegment | undefined {
  if (segment === undefined) return undefined;
  const selected = result.sweep?.segments[segment];
  if (!selected) throw new Error(`DC sweep segment ${segment} does not exist`);
  return selected;
}

function vectorMeta(result: SimulationResult, name: string): VectorMeta | undefined {
  const normalized = name.toLowerCase();
  return result.vectors.find((candidate) => candidate.name.toLowerCase() === normalized);
}

function sliceValues(values: Float64Array, complex: boolean, selected: DCSweepSegment | undefined): Float64Array {
  if (!selected) return values;
  const stride = complex ? 2 : 1;
  return values.slice(selected.startIndex * stride, (selected.startIndex + selected.length) * stride);
}

export function simulationRawVector(
  result: SimulationResult,
  name: string,
  segment?: number,
): { meta: VectorMeta; values: Float64Array } | undefined {
  const meta = vectorMeta(result, name);
  const values = meta ? result.data.get(meta.name.toLowerCase()) : undefined;
  if (!meta || !values) return undefined;
  const expected = meta.length * (meta.complex ? 2 : 1);
  if (values.length !== expected) throw new Error(`Vector ${meta.name} has ${values.length} stored values, expected ${expected}`);
  const selected = selection(result, segment);
  return {
    meta: { ...meta, length: selected?.length ?? meta.length },
    values: sliceValues(values, meta.complex, selected),
  };
}

function signalFromRaw(
  result: SimulationResult,
  name: string,
  unit: "V" | "A" | "W",
  dimension: typeof VOLTAGE_DIMENSION,
  sign: 1 | -1,
  segment: number | undefined,
): SignalResolution {
  const raw = simulationRawVector(result, name, segment);
  if (!raw) return failure("NOT_FOUND", `Simulation result does not contain vector ${name}`);
  const values = sign === 1 ? raw.values : Float64Array.from(raw.values, (value) => -value);
  return { ok: true, signal: { kind: raw.meta.complex ? "complex" : "real", unit, dimension, length: raw.meta.length, values } };
}

function nodeName(netlist: GeneratedSignalNetlist, reference: SerializedNodeReference): string | undefined {
  if (reference.kind === "runtime-node") return reference.name.trim() || undefined;
  if (reference.kind === "schematic-wire") return netlist.wireNodes[reference.wireId];
  return netlist.componentNodes[reference.componentId]?.[reference.pin];
}

function registeredNode(registry: SimulationSignalRegistry | undefined, reference: SerializedNodeReference): RegisteredNodeSignal | undefined {
  const nodes = registry?.nodes ?? [];
  if (reference.kind === "runtime-node") return nodes.find((entry) => entry.runtimeNode === reference.name);
  if (reference.kind === "schematic-wire") return nodes.find((entry) => entry.wireIds?.includes(reference.wireId));
  return nodes.find((entry) => entry.pins?.some((pin) => pin.componentId === reference.componentId && pin.pin === reference.pin));
}

function registeredComponent(registry: SimulationSignalRegistry | undefined, reference: SerializedComponentReference): RegisteredComponentSignal | undefined {
  const components = registry?.components ?? [];
  return reference.kind === "schematic-component"
    ? components.find((entry) => entry.componentId === reference.componentId)
    : components.find((entry) => entry.runtimeDevice === reference.name);
}

function componentId(reference: SerializedComponentReference): string | undefined {
  return reference.kind === "schematic-component" ? reference.componentId : undefined;
}

function rawDeviceCurrent(result: SimulationResult, runtimeDevice: string): string | undefined {
  const normalized = runtimeDevice.trim().toLowerCase();
  if (!normalized) return undefined;
  const candidates = [`${normalized}#branch`, `@${normalized}[i]`, `i(${normalized})`].filter((name) => vectorMeta(result, name));
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** Convert a .save device-current alias to ngspice's canonical raw-vector name. */
export function simulationCurrentVectorName(alias: string): string {
  const normalized = alias.trim().toLowerCase();
  if (normalized.startsWith("i(") && normalized.endsWith(")")) return normalized;
  if (normalized.startsWith("@")) return `i(${normalized})`;
  if (normalized.endsWith("#branch")) return `i(${normalized.slice(0, -7)})`;
  return normalized;
}

function generatedCurrentVector(result: SimulationResult, alias: string | undefined): string | undefined {
  if (!alias) return undefined;
  const canonical = simulationCurrentVectorName(alias);
  if (vectorMeta(result, canonical)) return canonical;
  return vectorMeta(result, alias) ? alias : canonical;
}

function sample(signal: SignalVector, index: number): readonly [number, number] {
  const selected = signal.length === 1 ? 0 : index;
  return signal.kind === "complex"
    ? [signal.values[selected * 2]!, signal.values[selected * 2 + 1]!]
    : [signal.values[selected]!, 0];
}

function compatibleLength(left: SignalVector, right: SignalVector, label: string): number | undefined {
  if (left.length === right.length) return left.length;
  if (left.length === 1) return right.length;
  if (right.length === 1) return left.length;
  void label;
  return undefined;
}

function voltageDifference(positive: SignalVector, negative: SignalVector): SignalResolution {
  const length = compatibleLength(positive, negative, "Device terminal voltage");
  if (length === undefined) return failure("AMBIGUOUS", "Device terminal voltage vector lengths do not match");
  const kind = positive.kind === "complex" || negative.kind === "complex" ? "complex" : "real";
  const values = new Float64Array(length * (kind === "complex" ? 2 : 1));
  for (let index = 0; index < length; index += 1) {
    const [positiveReal, positiveImaginary] = sample(positive, index);
    const [negativeReal, negativeImaginary] = sample(negative, index);
    if (kind === "complex") {
      values[index * 2] = positiveReal - negativeReal;
      values[index * 2 + 1] = positiveImaginary - negativeImaginary;
    } else values[index] = positiveReal - negativeReal;
  }
  return { ok: true, signal: { kind, unit: "V", dimension: VOLTAGE_DIMENSION, length, values } };
}

function absorbedPower(voltage: SignalVector, current: SignalVector): SignalResolution {
  const length = compatibleLength(voltage, current, "Device voltage and current");
  if (length === undefined) return failure("AMBIGUOUS", "Device voltage and current vector lengths do not match");
  const complex = voltage.kind === "complex" || current.kind === "complex";
  const values = new Float64Array(length * (complex ? 2 : 1));
  for (let index = 0; index < length; index += 1) {
    const [voltageReal, voltageImaginary] = sample(voltage, index);
    const [currentReal, currentImaginary] = sample(current, index);
    if (complex) {
      values[index * 2] = 0.5 * (voltageReal * currentReal + voltageImaginary * currentImaginary);
      values[index * 2 + 1] = 0.5 * (voltageImaginary * currentReal - voltageReal * currentImaginary);
    } else values[index] = voltageReal * currentReal;
  }
  return { ok: true, signal: { kind: complex ? "complex" : "real", unit: "W", dimension: POWER_DIMENSION, length, values } };
}

/** Resolve canonical expressions against exact GeneratedNetlist mappings and raw simulation vectors. */
export function createSimulationSignalResolver(
  netlist: GeneratedSignalNetlist,
  result: SimulationResult,
  options: SimulationSignalOptions = {},
): SignalResolver {
  const voltage = (reference: SerializedNodeReference): SignalResolution => {
    const registered = registeredNode(options.registry, reference);
    const runtime = registered?.runtimeNode ?? nodeName(netlist, reference);
    if (runtime === "0") {
      return { ok: true, signal: { kind: "real", unit: "V", dimension: VOLTAGE_DIMENSION, length: 1, values: Float64Array.of(0) } };
    }
    if (!runtime) return failure("NOT_FOUND", `Node reference ${JSON.stringify(reference)} is not present in the generated netlist`);
    return signalFromRaw(result, registered?.vector ?? `v(${runtime})`, "V", VOLTAGE_DIMENSION, 1, options.segment);
  };

  const current = (reference: SerializedComponentReference, terminal?: SerializedTerminalReference): SignalResolution => {
    if (result.provenance.requestType === "runNoise") {
      return failure("UNSUPPORTED", "Noise spectral-density results do not define signed device or terminal current phasors");
    }
    const registered = registeredComponent(options.registry, reference);
    if (terminal !== undefined) {
      const terminalSignal = registered?.terminalCurrents?.find((entry) => String(entry.terminal) === String(terminal));
      if (terminalSignal) return signalFromRaw(result, terminalSignal.vector, "A", CURRENT_DIMENSION, terminalSignal.sign, options.segment);
      const id = componentId(reference);
      const generatedVector = generatedCurrentVector(result, id ? netlist.componentCurrents[id] : undefined);
      const terminals = id ? netlist.componentNodes[id] : undefined;
      const numericTerminal = typeof terminal === "number" ? terminal : /^\d+$/.test(terminal) ? Number(terminal) : Number.NaN;
      if (generatedVector && terminals && numericTerminal === 0) {
        return signalFromRaw(result, generatedVector, "A", CURRENT_DIMENSION, 1, options.segment);
      }
      if (generatedVector && terminals?.length === 2 && numericTerminal === 1) {
        return signalFromRaw(result, generatedVector, "A", CURRENT_DIMENSION, -1, options.segment);
      }
      return failure("UNSUPPORTED", `${result.provenance.requestType === "runAC" ? "AC " : ""}terminal current ${String(terminal)} is not available; use an instrumented built-in terminal or provide an explicit registry vector`);
    }
    if (registered?.current) return signalFromRaw(result, registered.current.vector, "A", CURRENT_DIMENSION, registered.current.sign, options.segment);
    const id = componentId(reference);
    const generatedVector = id
      ? generatedCurrentVector(result, netlist.componentCurrents[id])
      : rawDeviceCurrent(result, reference.kind === "runtime-device" ? reference.name : "");
    if (!generatedVector) return failure("UNSUPPORTED", result.provenance.requestType === "runAC"
      ? "AC device current is unavailable for this component; imported, subcircuit, and non-instrumented multi-terminal devices require an explicit trustworthy registry vector"
      : "A default device current vector is not available");
    return signalFromRaw(result, generatedVector, "A", CURRENT_DIMENSION, 1, options.segment);
  };

  const power = (reference: SerializedComponentReference): SignalResolution => {
    if (result.provenance.requestType === "runNoise") {
      return failure("UNSUPPORTED", "Noise spectral-density results do not define signed complex device power");
    }
    const registered = registeredComponent(options.registry, reference);
    if (registered?.power?.kind === "vector") {
      return signalFromRaw(result, registered.power.vector, "W", POWER_DIMENSION, registered.power.sign, options.segment);
    }
    if (registered?.power?.kind === "two-terminal") {
      const positive = voltage(registered.power.positive);
      const negative = voltage(registered.power.negative);
      if (!positive.ok) return positive;
      if (!negative.ok) return negative;
      const difference = voltageDifference(positive.signal, negative.signal);
      if (!difference.ok) return difference;
      const currentSignal = signalFromRaw(result, registered.power.currentVector, "A", CURRENT_DIMENSION, registered.power.currentSign, options.segment);
      if (!currentSignal.ok) return currentSignal;
      return absorbedPower(difference.signal, currentSignal.signal);
    }
    const id = componentId(reference);
    const nodes = id ? netlist.componentNodes[id] : undefined;
    if (!id || !nodes || nodes.length !== 2) return failure("UNSUPPORTED", "P(device) requires complete terminal voltage and current metadata; imported, subcircuit, runtime, and multi-terminal devices are not inferred");
    const defaultCurrent = current(reference);
    if (!defaultCurrent.ok) return defaultCurrent;
    const positive = voltage({ kind: "runtime-node", name: nodes[0]! });
    const negative = voltage({ kind: "runtime-node", name: nodes[1]! });
    if (!positive.ok) return positive;
    if (!negative.ok) return negative;
    const difference = voltageDifference(positive.signal, negative.signal);
    if (!difference.ok) return difference;
    return absorbedPower(difference.signal, defaultCurrent.signal);
  };

  return { voltage, current, power };
}

function axisValues(result: SimulationResult, name: string, segment: number | undefined): { values: Float64Array; quantity: "time" | "frequency" | "dimensionless"; unit: "s" | "Hz" | "1" } {
  const raw = simulationRawVector(result, name, segment);
  if (!raw) throw new Error(`Simulation result does not contain axis vector ${name}`);
  const values = raw.meta.complex
    ? Float64Array.from({ length: raw.meta.length }, (_, index) => raw.values[index * 2]!)
    : raw.values;
  if (raw.meta.kind === "time") return { values, quantity: "time", unit: "s" };
  if (raw.meta.kind === "frequency") return { values, quantity: "frequency", unit: "Hz" };
  return { values, quantity: "dimensionless", unit: "1" };
}

export function createSimulationSignalContext(
  netlist: GeneratedSignalNetlist,
  result: SimulationResult,
  options: SimulationSignalOptions = {},
): SignalEvaluationContext {
  if (result.sweep && result.sweep.segments.length > 1 && options.segment === undefined) {
    throw new Error("A stepped DC result requires an explicit segment selection");
  }
  const axisMeta = options.axisVector
    ? vectorMeta(result, options.axisVector)
    : result.vectors.find((candidate) => candidate.kind === "time" || candidate.kind === "frequency" || candidate.kind === "sweep");
  const axis = axisMeta
    ? axisValues(result, axisMeta.name, options.segment)
    : {
        values: Float64Array.from({ length: options.segment === undefined ? (result.vectors[0]?.length ?? 1) : selection(result, options.segment)!.length }, (_, index) => index),
        quantity: "dimensionless" as const,
        unit: "1" as const,
      };
  return {
    resolver: createSimulationSignalResolver(netlist, result, options),
    axis: { id: axisMeta?.name ?? "sample", ...axis },
    runKey: result.provenance.runKey,
    ...(options.segment === undefined ? {} : { segment: options.segment }),
    ...(result.sweep ? { segmentCount: result.sweep.segments.length } : {}),
  };
}

export function evaluateSimulationSignalExpression(
  expression: SerializedSignalExpression,
  netlist: GeneratedSignalNetlist,
  result: SimulationResult,
  options: SimulationSignalOptions = {},
): EvaluateSignalResult {
  return evaluateSignalExpression(expression, createSimulationSignalResolver(netlist, result, options));
}

export function createSimulationSignalSeries(
  definition: SignalDefinition,
  netlist: GeneratedSignalNetlist,
  result: SimulationResult,
  options: SimulationSignalOptions = {},
): TransformResult<SignalSeries> {
  try {
    const context = createSimulationSignalContext(netlist, result, options);
    const evaluated = evaluateSignalExpression(definition.expression, context.resolver);
    if (!evaluated.ok) return evaluated;
    if (evaluated.signal.length !== context.axis.values.length && evaluated.signal.length !== 1) {
      return { ok: false, status: "INVALID", diagnostics: [{ code: "LENGTH_MISMATCH", message: "Signal and simulation axis lengths do not match" }] };
    }
    return {
      ok: true,
      value: {
        definition,
        runKey: context.runKey,
        axis: context.axis,
        signal: evaluated.signal,
        ...(context.segment === undefined ? {} : { segment: context.segment }),
      },
    };
  } catch (caught) {
    return { ok: false, status: "INVALID", diagnostics: [{ code: "SIMULATION_SIGNAL", message: caught instanceof Error ? caught.message : String(caught) }] };
  }
}
