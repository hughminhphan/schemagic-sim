export const SIGNAL_EXPRESSION_VERSION = 1 as const;
export const MEASUREMENT_ALGORITHM_VERSION = "signal-workbench-measurements-v1" as const;

export type EngineeringUnit = "1" | "V" | "A" | "W" | "s" | "Hz" | "Ohm" | "rad" | "deg" | "dB";
export type UnitSymbol = string;
export interface QuantityDimension { voltage: number; current: number; time: number }

export type SerializedNodeReference =
  | { kind: "runtime-node"; name: string }
  | { kind: "schematic-wire"; wireId: string }
  | { kind: "schematic-pin"; componentId: string; pin: number };

export type SerializedComponentReference =
  | { kind: "runtime-device"; name: string }
  | { kind: "schematic-component"; componentId: string };

export type SerializedTerminalReference = number | string;

export type SerializedSignalExpression =
  | { kind: "constant"; value: number; unit: EngineeringUnit }
  | { kind: "voltage"; positive: SerializedNodeReference; negative: SerializedNodeReference }
  | { kind: "current"; component: SerializedComponentReference; terminal?: SerializedTerminalReference }
  | { kind: "power"; component: SerializedComponentReference }
  | { kind: "unary"; operator: "+" | "-"; operand: SerializedSignalExpression }
  | { kind: "binary"; operator: "+" | "-" | "*" | "/" | "^"; left: SerializedSignalExpression; right: SerializedSignalExpression }
  | { kind: "call"; function: EngineeringFunction; arguments: SerializedSignalExpression[] };

export type EngineeringFunction =
  | "real" | "imag" | "mag" | "phase" | "abs" | "sqrt"
  | "log" | "ln" | "exp" | "db20" | "min" | "max";

export interface SerializedSignalProbe {
  id: string;
  expressionVersion: typeof SIGNAL_EXPRESSION_VERSION;
  expression: SerializedSignalExpression;
  label?: string;
  color?: string;
}

export type SignalValueKind = "real" | "complex";
export interface ComplexValue { real: number; imaginary: number }
export interface SignalVector {
  kind: SignalValueKind;
  unit: UnitSymbol;
  dimension: QuantityDimension;
  length: number;
  values: Float64Array;
}

export interface SignalResolutionError {
  code: "NOT_FOUND" | "AMBIGUOUS" | "UNSUPPORTED";
  message: string;
}

export type SignalResolution =
  | { ok: true; signal: SignalVector }
  | { ok: false; error: SignalResolutionError };

export interface SignalResolver {
  voltage(reference: SerializedNodeReference): SignalResolution;
  current(component: SerializedComponentReference, terminal?: SerializedTerminalReference): SignalResolution;
  power(component: SerializedComponentReference): SignalResolution;
}

export interface EvaluatedSignal extends SignalVector {
  canonicalExpression: string;
}

export interface SignalDiagnostic {
  code: string;
  message: string;
  start?: number;
  end?: number;
}

export type SignalQuantity = "dimensionless" | "voltage" | "current" | "power" | "time" | "frequency" | "phase" | "derived";
export type SignalPolarity = "signed" | "magnitude" | "absorbed-positive";
export interface SignalDefinition {
  id: string;
  label: string;
  expression: SerializedSignalExpression;
  quantity: SignalQuantity;
  unit: UnitSymbol;
  polarity: SignalPolarity;
}
export interface SignalAxis {
  id: string;
  quantity: "time" | "frequency" | "dimensionless";
  unit: "s" | "Hz" | "1";
  values: Float64Array;
}
export interface SignalSeries {
  definition: SignalDefinition;
  runKey: string;
  axis: SignalAxis;
  signal: EvaluatedSignal;
  segment?: number;
}
export interface SignalEvaluationContext {
  resolver: SignalResolver;
  axis: SignalAxis;
  runKey: string;
  segment?: number;
  segmentCount?: number;
}
export type ParseSignalResult =
  | { ok: true; expression: SerializedSignalExpression; canonical: string }
  | { ok: false; diagnostics: SignalDiagnostic[] };
export type EvaluateSignalResult =
  | { ok: true; signal: EvaluatedSignal }
  | { ok: false; status: Exclude<MeasurementStatus, "OK">; diagnostics: SignalDiagnostic[] };
export type TransformResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: Exclude<MeasurementStatus, "OK">; diagnostics: SignalDiagnostic[] };

export type MeasurementStatus = "OK" | "INVALID" | "UNSUPPORTED" | "NOT_FOUND";
export interface MeasurementWindow { start: number; stop: number }
export type EdgeDirection = "rising" | "falling";
export interface EdgeSelector { direction: EdgeDirection; ordinal: number; threshold: number }

interface MeasurementBase {
  id: string;
  name: string;
  expression: SerializedSignalExpression;
  window?: MeasurementWindow;
  segment?: number;
}

export type SerializedMeasurementDefinition =
  | (MeasurementBase & { kind: "minimum" | "maximum" | "peak-to-peak" | "average" | "rms" | "integral" })
  | (MeasurementBase & { kind: "x-at-level"; threshold: number; direction: EdgeDirection; ordinal: number })
  | (MeasurementBase & { kind: "frequency" | "period"; edge: EdgeSelector; lastOrdinal?: number })
  | (MeasurementBase & { kind: "duty"; threshold: number; highWhen?: "above" | "below" })
  | (MeasurementBase & { kind: "rise-time" | "fall-time"; lowThreshold: number; highThreshold: number; ordinal: number })
  | (MeasurementBase & { kind: "delay"; reference: SerializedSignalExpression; referenceEdge: EdgeSelector; targetEdge: EdgeSelector })
  | (MeasurementBase & { kind: "overshoot"; initial: number; final: number })
  | (MeasurementBase & { kind: "settling-time"; initial: number; final: number; tolerance: { kind: "absolute" | "step-percent"; value: number } })
  | (MeasurementBase & { kind: "phase"; reference: SerializedSignalExpression; frequency: number; unwrap?: boolean });

export interface MeasurementProvenance {
  runKey: string;
  algorithmVersion: typeof MEASUREMENT_ALGORITHM_VERSION;
  canonicalExpression: string;
  window?: MeasurementWindow;
  segment?: number;
}

export interface MeasurementResult {
  id: string;
  name: string;
  kind: SerializedMeasurementDefinition["kind"];
  status: MeasurementStatus;
  value?: number;
  unit?: UnitSymbol;
  diagnostics: SignalDiagnostic[];
  provenance: MeasurementProvenance;
}

export type FFTWindow = "rectangular" | "hann";
export type FFTNormalization = "one-sided-amplitude" | "power-spectral-density";
export interface FFTDefinition {
  expression: SerializedSignalExpression;
  window: MeasurementWindow;
  samples: number;
  windowFunction: FFTWindow;
  normalization: FFTNormalization;
  detrend?: "none" | "mean";
  spectrumScale?: "linear" | "db";
}
export interface FFTResult {
  frequencies: Float64Array;
  real: Float64Array;
  imaginary: Float64Array;
  spectrum: Float64Array;
  sourceUnit: UnitSymbol;
  spectrumUnit: UnitSymbol;
  sampleRate: number;
  effectiveSampleRate: number;
  sampleCount: number;
  binWidth: number;
  coherentGain: number;
  windowFunction: FFTWindow;
  window: MeasurementWindow;
  normalization: FFTNormalization;
  spectrumScale: "linear" | "db";
}

export interface XYDefinition {
  x: SerializedSignalExpression;
  y: SerializedSignalExpression;
  window?: MeasurementWindow;
  alignment?: "same-axis" | "linear-overlap";
}
export interface XYResult {
  x: Float64Array;
  y: Float64Array;
  xUnit: UnitSymbol;
  yUnit: UnitSymbol;
  sourceOrderPreserved: true;
}
export type XYSeries = XYResult;

export type TriggerMode = "auto" | "normal" | "single";
export type TriggerState = "armed" | "waiting" | "triggered" | "complete";
export interface TriggerConfig {
  expression: SerializedSignalExpression;
  mode: TriggerMode;
  edge: EdgeDirection;
  level: number;
  holdoff: number;
  pretrigger: number;
  /** Optional returned acquisition width in axis units. Omitted preserves the complete sampled axis. */
  windowDuration?: number;
}
export type TriggerDefinition = TriggerConfig;
export interface TriggerResult {
  state: TriggerState;
  triggerTime?: number;
  triggerIndex?: number;
  window?: MeasurementWindow;
  diagnostics: SignalDiagnostic[];
}

export interface ComparisonCompatibility {
  compatible: boolean;
  reasons: string[];
  sameQuantity: boolean;
  sameUnit: boolean;
  sameAxisQuantity: boolean;
  overlappingWindow?: MeasurementWindow;
}
export interface ComparisonResult {
  status: "OK" | "INCOMPATIBLE" | "INVALID";
  compatibility: ComparisonCompatibility;
  leftRunKey: string;
  rightRunKey: string;
  axis?: Float64Array;
  difference?: Float64Array;
  diagnostics: SignalDiagnostic[];
}
