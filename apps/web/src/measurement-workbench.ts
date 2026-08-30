import {
  POWER_DIMENSION,
  VOLTAGE_DIMENSION,
  CURRENT_DIMENSION,
  buildXYSeries,
  canonicalNumber,
  compareSeriesCompatibility,
  computeFFT,
  evaluateMeasurement,
  evaluateSignalExpression,
  evaluateTrigger,
  parseSignalExpression,
  parseEngineeringLiteral,
  sameDimension,
  serializeSignalExpression,
  type FFTResult,
  type MeasurementResult,
  type MeasurementStatus,
  type QuantityDimension,
  type SerializedMeasurementDefinition,
  type SerializedNodeReference,
  type SerializedSignalExpression,
  type SerializedSignalProbe,
  type SignalDefinition,
  type SignalDiagnostic,
  type SignalEvaluationContext,
  type SignalQuantity,
  type SignalSeries,
  type TriggerResult,
  type XYResult,
} from "@opencircuit/signal-workbench";
import type { AnalysisMode, CircuitDocument, GeneratedNetlist } from "@opencircuit/circuit-schema";
import type { EditorMeasurementTarget } from "@opencircuit/schematic-editor";
import {
  createSimulationSignalContext,
  createSimulationSignalSeries,
  type SimulationResult,
} from "@opencircuit/sim-engine";
import {
  formatValue,
  type CursorPosition,
  type PlotLayoutMode,
  type TraceDefinition,
  type WaveformData,
} from "@opencircuit/waveform-viewer";
import {
  captureSignal,
  listCaptureMetadata,
  loadCapture,
  saveCapture,
  type CaptureMetadata,
  type CaptureModelIdentity,
  type SavedCapture,
} from "./persistence";
import {
  activeInstrumentProfile,
  createInstrumentAnalysisSnapshot,
  createInitialMeasurementWorkbenchState,
  instrumentStateSignature,
  normalizeMeasurementWorkbenchState,
  type InstrumentProfile,
  type InstrumentAnalysisSnapshot,
  type InstrumentTraceDefinition,
  type MeasurementWorkbenchState,
  type StagedMeasurementTarget,
} from "./measurement-state";
import "./instrument-workbench.css";

const TRACE_COLORS = ["#3FD983", "#E8A244", "#5FB0E8", "#F1EEE8", "#B579D2", "#F26D6D"] as const;
const ONE = { voltage: 0, current: 0, time: 0 } satisfies QuantityDimension;
export const WORKBENCH_MEASUREMENT_KINDS = [
  "minimum", "maximum", "peak-to-peak", "average", "rms", "integral", "x-at-level", "frequency", "period",
  "rise-time", "fall-time", "duty", "delay", "overshoot", "settling-time", "phase",
] as const satisfies readonly SerializedMeasurementDefinition["kind"][];
const MEASUREMENT_KIND_LABELS: Record<SerializedMeasurementDefinition["kind"], string> = {
  minimum: "Minimum",
  maximum: "Maximum",
  "peak-to-peak": "Peak-to-peak",
  average: "Average",
  rms: "RMS",
  integral: "Integral",
  "x-at-level": "Axis crossing / −3 dB corner",
  frequency: "Frequency",
  period: "Period",
  "rise-time": "Rise time",
  "fall-time": "Fall time",
  duty: "Duty cycle",
  delay: "Delay",
  overshoot: "Overshoot",
  "settling-time": "Settling time",
  phase: "Phase",
};

export interface WorkbenchRunProvenance {
  workspaceId?: string;
  circuitHash: string;
  engine: string;
  runKey: string;
  modelIdentities: readonly CaptureModelIdentity[];
  analysisSettings: unknown;
}

export interface WorkbenchResolvedResult {
  series?: readonly SignalSeries[];
  baselineSeries?: readonly SignalSeries[];
  measurements?: readonly MeasurementResult[];
  fft?: FFTResult;
  xy?: XYResult;
  trigger?: TriggerResult;
}

export interface ResolvedMeasurementTarget {
  definition?: SignalDefinition;
  probe?: SerializedSignalProbe;
  series?: SignalSeries;
  expressionSource?: string;
  signText?: string;
  positiveTerminalLabel?: string;
}

export interface WorkbenchPlotDataset {
  kind: WaveformData["kind"];
  vectors: ReadonlyMap<string, Float64Array>;
  traces: readonly TraceDefinition[];
  layout: PlotLayoutMode;
  yScales: Readonly<Record<string, "linear" | "log">>;
  trigger: TriggerResult | null;
  measurements: readonly MeasurementResult[];
  cursors?: { a: CursorPosition | null; b: CursorPosition | null };
  onCursorsChange?: (cursors: { a: CursorPosition | null; b: CursorPosition | null }) => void;
  onTraceVisibilityChange?: (traceId: string, visible: boolean) => void;
}

export interface MeasurementWorkbenchOptions {
  initialState?: MeasurementWorkbenchState;
  onStateChange?: (state: MeasurementWorkbenchState) => void;
  onMeasureModeChange?: (active: boolean) => void;
  onRunRequested?: () => void;
  onPlotChange?: (dataset: WorkbenchPlotDataset | undefined) => void;
  onTraceRemoved?: (definition: SignalDefinition) => void;
  onProfileAnalysisRestore?: (snapshot: InstrumentAnalysisSnapshot) => void;
}

/**
 * Index resolved runtime series by their stable profile definition without
 * discarding stepped-DC segments. Explicit target resolutions retain their
 * existing override behavior for the matching definition.
 */
export function groupResolvedSeriesByDefinition(
  series: readonly SignalSeries[],
  overrides: ReadonlyMap<string, SignalSeries> = new Map(),
): ReadonlyMap<string, readonly SignalSeries[]> {
  const grouped = new Map<string, SignalSeries[]>();
  for (const item of series) {
    const matches = grouped.get(item.definition.id);
    if (matches) matches.push(item);
    else grouped.set(item.definition.id, [item]);
  }
  for (const matches of grouped.values()) {
    if (matches.length > 1 && matches.every((item) => item.segment !== undefined)) {
      matches.sort((left, right) => left.segment! - right.segment!);
    }
  }
  for (const [id, item] of overrides) grouped.set(id, [item]);
  return grouped;
}

export interface MeasurementWorkbenchController {
  setCircuit(document: CircuitDocument | undefined): void;
  setNetlist(netlist: GeneratedNetlist | undefined): void;
  setResult(mode: AnalysisMode, result?: SimulationResult, resolved?: WorkbenchResolvedResult): void;
  setTarget(target?: EditorMeasurementTarget, resolution?: ResolvedMeasurementTarget): void;
  setRunProvenance(provenance: WorkbenchRunProvenance | undefined): void;
  restoreState(state: MeasurementWorkbenchState): void;
  serializeState(): string;
  getState(): MeasurementWorkbenchState;
  getPlotDataset(): WorkbenchPlotDataset | undefined;
  destroy(): void;
}

interface TraceEvaluationFailure {
  status: Exclude<MeasurementStatus, "OK">;
  diagnostics: readonly SignalDiagnostic[];
}

function targetIdentity(target: EditorMeasurementTarget): string {
  if (target.kind === "wire") return target.wireId;
  if (target.kind === "component") return target.componentId;
  return `${target.componentId}:${target.pinIndex}`;
}

function nodeReferenceIdentity(reference: SerializedNodeReference): string {
  if (reference.kind === "schematic-wire") return `wire:${reference.wireId}`;
  if (reference.kind === "schematic-pin") return `pin:${reference.componentId}:${reference.pin}`;
  return `node:${reference.name}`;
}

function targetSignalId(target: EditorMeasurementTarget): string {
  return `target:${target.kind}:${targetIdentity(target)}`;
}

function presentationNodeLabel(reference: SerializedNodeReference, circuit: Pick<CircuitDocument, "wires"> | undefined): string | undefined {
  if (reference.kind === "runtime-node") return reference.name;
  if (reference.kind !== "schematic-wire") return undefined;
  const label = circuit?.wires.find((wire) => wire.id === reference.wireId)?.netLabel?.trim();
  return label || undefined;
}

/** Human-facing label only; the serialized expression and stable trace identity remain untouched. */
export function workbenchSignalDisplayLabel(definition: SignalDefinition, circuit: Pick<CircuitDocument, "wires"> | undefined): string {
  const expression = definition.expression;
  if (expression.kind !== "voltage") return definition.label;
  const positive = presentationNodeLabel(expression.positive, circuit);
  const negative = presentationNodeLabel(expression.negative, circuit);
  if (!positive || !negative) return definition.label;
  return negative === "0" ? `V(${positive})` : `V(${positive}, ${negative})`;
}

function defaultTargetDefinition(target: EditorMeasurementTarget): SignalDefinition {
  if (target.kind === "wire") {
    return {
      id: targetSignalId(target),
      label: `V(${target.wireId})`,
      expression: {
        kind: "voltage",
        positive: { kind: "schematic-wire", wireId: target.wireId },
        negative: { kind: "runtime-node", name: "0" },
      },
      quantity: "voltage",
      unit: "V",
      polarity: "signed",
    };
  }
  if (target.kind === "pin") {
    return {
      id: targetSignalId(target),
      label: `V(${target.componentId}.${target.pinIndex + 1})`,
      expression: {
        kind: "voltage",
        positive: { kind: "schematic-pin", componentId: target.componentId, pin: target.pinIndex },
        negative: { kind: "runtime-node", name: "0" },
      },
      quantity: "voltage",
      unit: "V",
      polarity: "signed",
    };
  }
  return {
    id: targetSignalId(target),
    label: `I(${target.componentId})`,
    expression: { kind: "current", component: { kind: "schematic-component", componentId: target.componentId } },
    quantity: "current",
    unit: "A",
    polarity: "signed",
  };
}

function definitionFromProbe(probe: SerializedSignalProbe): SignalDefinition {
  const expression = probe.expression;
  const quantity: SignalQuantity = expression.kind === "voltage"
    ? "voltage"
    : expression.kind === "current"
      ? "current"
      : expression.kind === "power"
        ? "power"
        : "derived";
  const unit = quantity === "voltage" ? "V" : quantity === "current" ? "A" : quantity === "power" ? "W" : "1";
  return {
    id: probe.id,
    label: probe.label?.trim() || serializeSignalExpression(expression),
    expression: structuredClone(expression),
    quantity,
    unit,
    polarity: quantity === "power" ? "absorbed-positive" : "signed",
  };
}

function defaultSignText(target: EditorMeasurementTarget, terminalLabel?: string): string {
  if (target.kind === "wire") return `Voltage sign: + on wire ${target.wireId}; − at ground (node 0).`;
  if (target.kind === "pin") return `Voltage sign: + at ${target.componentId} pin ${target.pinIndex + 1}; − at ground (node 0).`;
  const terminal = terminalLabel ?? `${target.componentId} pin 1 (the model reference terminal)`;
  return `Current sign: positive current enters ${terminal}. Power sign: positive means the component absorbs power; negative means it delivers power.`;
}

function targetStage(target: EditorMeasurementTarget, resolution?: ResolvedMeasurementTarget): StagedMeasurementTarget {
  const definition = resolution?.definition ?? (resolution?.probe ? definitionFromProbe(resolution.probe) : defaultTargetDefinition(target));
  return {
    target: structuredClone(target),
    definition: structuredClone(definition),
    expressionSource: resolution?.expressionSource ?? serializeSignalExpression(definition.expression),
    signText: resolution?.signText ?? defaultSignText(target, resolution?.positiveTerminalLabel),
    ...(resolution?.positiveTerminalLabel === undefined ? {} : { positiveTerminalLabel: resolution.positiveTerminalLabel }),
  };
}

export interface WorkbenchEdgeParameters {
  threshold?: number;
  direction?: "rising" | "falling";
  ordinal?: number;
}

export interface WorkbenchMeasurementParameters extends WorkbenchEdgeParameters {
  lowThreshold?: number;
  highThreshold?: number;
  edge?: WorkbenchEdgeParameters;
  lastOrdinal?: number;
  highWhen?: "above" | "below";
  reference?: SerializedSignalExpression;
  referenceEdge?: WorkbenchEdgeParameters;
  targetEdge?: WorkbenchEdgeParameters;
  initial?: number;
  final?: number;
  toleranceKind?: "absolute" | "step-percent";
  toleranceValue?: number;
  frequency?: number;
  unwrap?: boolean;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value! : fallback;
}

function edgeParameters(
  parameters: WorkbenchEdgeParameters | undefined,
  defaults: { threshold: number; direction: "rising" | "falling"; ordinal: number },
): { threshold: number; direction: "rising" | "falling"; ordinal: number } {
  return {
    threshold: finiteOr(parameters?.threshold, defaults.threshold),
    direction: parameters?.direction === "falling" ? "falling" : parameters?.direction === "rising" ? "rising" : defaults.direction,
    ordinal: finiteOr(parameters?.ordinal, defaults.ordinal),
  };
}

export function createWorkbenchMeasurementDefinition(
  id: string,
  name: string,
  kind: SerializedMeasurementDefinition["kind"],
  expression: SerializedSignalExpression,
  parameters: WorkbenchMeasurementParameters = {},
): SerializedMeasurementDefinition {
  const base = { id, name, expression: structuredClone(expression) };
  if (kind === "x-at-level") return {
    ...base,
    kind,
    threshold: Number.isFinite(parameters.threshold) ? parameters.threshold! : -3,
    direction: parameters.direction === "rising" ? "rising" : "falling",
    ordinal: Number.isFinite(parameters.ordinal) ? parameters.ordinal! : 1,
  };
  if (kind === "frequency" || kind === "period") {
    const edge = edgeParameters(parameters.edge, { threshold: 0, direction: "rising", ordinal: 1 });
    return { ...base, kind, edge, ...(Number.isFinite(parameters.lastOrdinal) ? { lastOrdinal: parameters.lastOrdinal } : {}) };
  }
  if (kind === "duty") return {
    ...base,
    kind,
    threshold: finiteOr(parameters.threshold, 0),
    highWhen: parameters.highWhen === "below" ? "below" : "above",
  };
  if (kind === "rise-time" || kind === "fall-time") return {
    ...base,
    kind,
    lowThreshold: finiteOr(parameters.lowThreshold, 0.1),
    highThreshold: finiteOr(parameters.highThreshold, 0.9),
    ordinal: finiteOr(parameters.ordinal, 1),
  };
  if (kind === "overshoot") return {
    ...base,
    kind,
    initial: finiteOr(parameters.initial, 0),
    final: finiteOr(parameters.final, 1),
  };
  if (kind === "settling-time") return {
    ...base,
    kind,
    initial: finiteOr(parameters.initial, 0),
    final: finiteOr(parameters.final, 1),
    tolerance: {
      kind: parameters.toleranceKind === "absolute" ? "absolute" : "step-percent",
      value: finiteOr(parameters.toleranceValue, 2),
    },
  };
  if (kind === "phase") return {
    ...base,
    kind,
    reference: structuredClone(parameters.reference ?? expression),
    frequency: finiteOr(parameters.frequency, 1_000),
    ...(parameters.unwrap ? { unwrap: true } : {}),
  };
  if (kind === "delay") {
    return {
      ...base,
      kind,
      reference: structuredClone(parameters.reference ?? expression),
      referenceEdge: edgeParameters(parameters.referenceEdge, { direction: "rising", ordinal: 1, threshold: 0 }),
      targetEdge: edgeParameters(parameters.targetEdge, { direction: "rising", ordinal: 1, threshold: 0 }),
    };
  }
  return { ...base, kind };
}

export function workbenchMeasurementParameterSummary(definition: SerializedMeasurementDefinition): string {
  if (definition.kind === "x-at-level") return `${definition.direction} @ ${definition.threshold}; crossing ${definition.ordinal}`;
  if (definition.kind === "frequency" || definition.kind === "period") {
    return `${definition.edge.direction} @ ${definition.edge.threshold}; crossings ${definition.edge.ordinal}→${definition.lastOrdinal ?? "all"}`;
  }
  if (definition.kind === "duty") return `${definition.highWhen ?? "above"} ${definition.threshold}`;
  if (definition.kind === "rise-time" || definition.kind === "fall-time") {
    return `${definition.lowThreshold}→${definition.highThreshold}; transition ${definition.ordinal}`;
  }
  if (definition.kind === "delay") {
    return `ref ${serializeSignalExpression(definition.reference)} ${definition.referenceEdge.direction} @ ${definition.referenceEdge.threshold} #${definition.referenceEdge.ordinal}; target ${definition.targetEdge.direction} @ ${definition.targetEdge.threshold} #${definition.targetEdge.ordinal}`;
  }
  if (definition.kind === "overshoot") return `${definition.initial}→${definition.final}`;
  if (definition.kind === "settling-time") {
    const tolerance = definition.tolerance.kind === "step-percent" ? `${definition.tolerance.value}% step` : `${definition.tolerance.value} absolute`;
    return `${definition.initial}→${definition.final}; ±${tolerance}`;
  }
  if (definition.kind === "phase") {
    return `vs ${serializeSignalExpression(definition.reference)} @ ${definition.frequency} Hz${definition.unwrap ? "; unwrapped" : ""}`;
  }
  return "Full window";
}

/**
 * A VI curve is truthful only when both axes prove the same device and current
 * enters the voltage expression's positive terminal. Generic runtime nodes or
 * devices cannot establish that identity, so they fail closed as ordinary XY.
 */
export function validateWorkbenchVI(
  profile: Pick<InstrumentProfile, "traces" | "transforms">,
): { valid: boolean; message: string } {
  const xy = profile.transforms.xy;
  if (!xy) return { valid: false, message: "Choose a voltage for X and a current for Y to plot a device characteristic." };
  const canonicalX = serializeSignalExpression(xy.x);
  const canonicalY = serializeSignalExpression(xy.y);
  const xTrace = profile.traces.find((trace) => serializeSignalExpression(trace.definition.expression) === canonicalX);
  const yTrace = profile.traces.find((trace) => serializeSignalExpression(trace.definition.expression) === canonicalY);
  if (!xTrace || !yTrace) return { valid: false, message: "The selected VI signals are no longer in this instrument profile." };
  if (xTrace.definition.quantity !== "voltage" || yTrace.definition.quantity !== "current") {
    return { valid: false, message: "VI requires a voltage trace on X and a current trace on Y. Choose a device voltage and its entering current." };
  }
  const x = xTrace.definition.expression;
  const y = yTrace.definition.expression;
  if (
    x.kind !== "voltage"
    || x.positive.kind !== "schematic-pin"
    || x.negative.kind !== "schematic-pin"
    || x.positive.componentId !== x.negative.componentId
    || y.kind !== "current"
    || y.component.kind !== "schematic-component"
    || typeof y.terminal !== "number"
  ) {
    return {
      valid: false,
      message: "VI needs a same-device pin-to-pin voltage and that device’s terminal current. Runtime-node or unresolved identities can only be plotted as XY.",
    };
  }
  if (y.component.componentId !== x.positive.componentId) {
    return { valid: false, message: "The VI voltage and current identify different devices. Choose both signals from the same component." };
  }
  if (y.terminal !== x.positive.pin) {
    return { valid: false, message: "For absorbed-positive VI, choose the current entering the voltage trace’s positive terminal." };
  }
  return { valid: true, message: `Device characteristic: ${y.component.componentId} terminal ${y.terminal + 1}; source sample order is preserved.` };
}

class MountedMeasurementWorkbench implements MeasurementWorkbenchController {
  private readonly root: HTMLElement;
  private readonly options: MeasurementWorkbenchOptions;
  private state: MeasurementWorkbenchState;
  private circuit: CircuitDocument | undefined;
  private netlist: GeneratedNetlist | undefined;
  private mode: AnalysisMode = "op";
  private result: SimulationResult | undefined;
  private resolved: WorkbenchResolvedResult = {};
  private provenance: WorkbenchRunProvenance | undefined;
  private targetSeries = new Map<string, SignalSeries>();
  private currentSeries: SignalSeries[] = [];
  private traceEvaluationFailures = new Map<string, TraceEvaluationFailure>();
  private baselineSeries: SignalSeries[] = [];
  private comparisonCurrentSeries: SignalSeries[] | undefined;
  private comparisonMessage: string | undefined;
  private measurementResults: MeasurementResult[] = [];
  private captureMetadata: CaptureMetadata[] = [];
  private plotDataset: WorkbenchPlotDataset | undefined;
  private comparisonLoadGeneration = 0;
  private destroyed = false;
  private idCounter = 0;

  constructor(host: HTMLElement, options: MeasurementWorkbenchOptions) {
    this.options = options;
    this.state = normalizeMeasurementWorkbenchState(options.initialState ?? createInitialMeasurementWorkbenchState());
    this.root = document.createElement("section");
    this.root.id = "measurement-workbench";
    this.root.className = "instrument-workbench";
    this.root.dataset.testid = "measurement-workbench";
    this.root.setAttribute("aria-label", "Measurement workbench");
    this.root.innerHTML = `
      <header class="instrument-workbench__header">
        <div><p class="instrument-workbench__eyebrow">INSTRUMENT WORKBENCH</p><h2>Measure & compare</h2></div>
        <div class="instrument-workbench__header-actions">
          <button type="button" data-testid="measure-mode-toggle" aria-pressed="false">Select on schematic</button>
          <button type="button" data-testid="workbench-run">Run</button>
        </div>
      </header>
      <div class="instrument-workbench__target" data-testid="measurement-target" role="status" aria-live="polite"></div>
      <p class="instrument-workbench__sign" data-testid="measurement-sign"></p>
      <div class="instrument-workbench__expression">
        <label for="measurement-expression">Signal expression</label>
        <div><input id="measurement-expression" data-testid="measurement-expression" autocomplete="off" spellcheck="false" placeholder="V(out) or I(R1)"><button type="button" data-testid="add-trace">Add trace</button></div>
        <p data-testid="measurement-expression-diagnostic" role="status" aria-live="polite"></p>
      </div>
      <div class="instrument-workbench__columns">
        <section aria-labelledby="trace-list-heading">
          <div class="instrument-workbench__section-heading"><h3 id="trace-list-heading">Traces</h3><button type="button" data-testid="add-target-trace">Add selected target</button></div>
          <ul class="instrument-workbench__trace-list" data-testid="trace-list"></ul>
        </section>
        <section aria-labelledby="display-heading">
          <h3 id="display-heading">Display</h3>
          <div class="instrument-workbench__fields">
            <label>Plot <select data-testid="plot-mode"><option value="time">Time / analysis</option><option value="spectrum">FFT spectrum</option><option value="xy">XY</option><option value="vi">VI characteristic</option></select></label>
            <label>Layout <select data-testid="plot-layout"><option value="split">Split by unit</option><option value="overlay">Overlay</option><option value="stack">Stack traces</option></select></label>
          </div>
          <fieldset data-testid="fft-controls"><legend>FFT</legend>
            <label>Samples <input data-testid="fft-samples" type="number" min="2" max="65536" step="2" value="1024"></label>
            <label>Window <select data-testid="fft-window"><option value="hann">Hann</option><option value="rectangular">Rectangular</option></select></label>
            <label><input data-testid="fft-db" type="checkbox"> dB spectrum</label>
            <label><input data-testid="fft-log-y" type="checkbox"> logarithmic Y</label>
          </fieldset>
          <fieldset data-testid="xy-controls"><legend>XY / VI</legend>
            <label>X signal <select data-testid="xy-x"></select></label>
            <label>Y signal <select data-testid="xy-y"></select></label>
            <p data-testid="xy-order-status" role="status" aria-live="polite">Source sample order is preserved.</p>
          </fieldset>
        </section>
        <section aria-labelledby="trigger-heading">
          <h3 id="trigger-heading">Trigger</h3>
          <div class="instrument-workbench__fields">
            <label><input data-testid="trigger-enabled" type="checkbox"> Enabled</label>
            <label>Source <select data-testid="trigger-source" aria-label="Trigger source"></select></label>
            <label>Mode <select data-testid="trigger-mode"><option value="auto">Auto</option><option value="normal">Normal</option><option value="single">Single</option></select></label>
            <label>Edge <select data-testid="trigger-edge"><option value="rising">Rising</option><option value="falling">Falling</option></select></label>
            <label>Level <input data-testid="trigger-level" inputmode="decimal" value="0"></label>
            <label>Holdoff <input data-testid="trigger-holdoff" inputmode="decimal" value="0" aria-describedby="trigger-axis-unit"></label>
            <label>Pretrigger (%) <input data-testid="trigger-pretrigger" inputmode="decimal" value="50"></label>
            <label>Window duration <input data-testid="trigger-window-duration" inputmode="decimal" placeholder="Full axis" aria-describedby="trigger-axis-unit"></label>
          </div>
          <p id="trigger-axis-unit">Holdoff and window duration use the current analysis axis unit; engineering suffixes are accepted.</p>
          <p data-testid="trigger-config-diagnostic" role="status" aria-live="polite"></p>
          <p data-testid="trigger-status" role="status" aria-live="polite">Trigger off</p>
        </section>
        <section aria-labelledby="measurements-heading">
          <h3 id="measurements-heading">Named measurements</h3>
          <div class="instrument-workbench__inline-form">
            <input data-testid="measurement-name" aria-label="Measurement name" placeholder="Output RMS">
            <select data-testid="measurement-kind" aria-label="Measurement kind">${WORKBENCH_MEASUREMENT_KINDS.map((kind) => `<option value="${kind}">${MEASUREMENT_KIND_LABELS[kind]}</option>`).join("")}</select>
            <button type="button" data-testid="add-measurement">Add</button>
          </div>
          <fieldset class="instrument-workbench__fields" data-testid="x-at-level-controls" hidden><legend>Axis crossing</legend>
            <label>Threshold <input data-testid="measurement-threshold" type="number" step="any" value="-3" required></label>
            <label>Direction <select data-testid="measurement-direction"><option value="falling">Falling</option><option value="rising">Rising</option></select></label>
            <label>Crossing number <input data-testid="measurement-ordinal" type="number" min="1" step="1" value="1" required></label>
          </fieldset>
          <fieldset class="instrument-workbench__fields" data-testid="rise-fall-controls" hidden><legend>Rise / fall thresholds</legend>
            <label>Low <input data-testid="measurement-low-threshold" type="number" step="any" value="0.1" required></label>
            <label>High <input data-testid="measurement-high-threshold" type="number" step="any" value="0.9" required></label>
            <label>Transition number <input data-testid="measurement-transition-ordinal" type="number" min="1" step="1" value="1" required></label>
          </fieldset>
          <fieldset class="instrument-workbench__fields" data-testid="periodic-controls" hidden><legend>Cycle detection</legend>
            <label>Threshold <input data-testid="measurement-edge-threshold" type="number" step="any" value="0" required></label>
            <label data-periodic-edge>Direction <select data-testid="measurement-edge-direction"><option value="rising">Rising</option><option value="falling">Falling</option></select></label>
            <label data-periodic-edge>First crossing <input data-testid="measurement-edge-ordinal" type="number" min="1" step="1" value="1" required></label>
            <label data-periodic-edge>Last crossing <input data-testid="measurement-edge-last-ordinal" type="number" min="2" step="1" placeholder="all"></label>
            <label data-duty-polarity>High state <select data-testid="measurement-duty-high-when"><option value="above">Above threshold</option><option value="below">Below threshold</option></select></label>
          </fieldset>
          <fieldset class="instrument-workbench__fields" data-testid="delay-controls" hidden><legend>Delay edges</legend>
            <label>Reference signal <input data-testid="measurement-reference-expression" autocomplete="off" spellcheck="false" placeholder="V(in)" required></label>
            <label>Reference threshold <input data-testid="measurement-reference-threshold" type="number" step="any" value="0" required></label>
            <label>Reference direction <select data-testid="measurement-reference-direction"><option value="rising">Rising</option><option value="falling">Falling</option></select></label>
            <label>Reference crossing <input data-testid="measurement-reference-ordinal" type="number" min="1" step="1" value="1" required></label>
            <label>Target threshold <input data-testid="measurement-target-threshold" type="number" step="any" value="0" required></label>
            <label>Target direction <select data-testid="measurement-target-direction"><option value="rising">Rising</option><option value="falling">Falling</option></select></label>
            <label>Target crossing <input data-testid="measurement-target-ordinal" type="number" min="1" step="1" value="1" required></label>
          </fieldset>
          <fieldset class="instrument-workbench__fields" data-testid="step-response-controls" hidden><legend>Step response</legend>
            <label>Initial level <input data-testid="measurement-initial" type="number" step="any" value="0" required></label>
            <label>Final level <input data-testid="measurement-final" type="number" step="any" value="1" required></label>
            <label data-settling-tolerance>Tolerance <select data-testid="measurement-tolerance-kind"><option value="step-percent">% of step</option><option value="absolute">Absolute</option></select></label>
            <label data-settling-tolerance>Tolerance value <input data-testid="measurement-tolerance" type="number" min="0" step="any" value="2" required></label>
          </fieldset>
          <fieldset class="instrument-workbench__fields" data-testid="phase-controls" hidden><legend>Relative phase</legend>
            <label>Reference signal <input data-testid="measurement-phase-reference" autocomplete="off" spellcheck="false" placeholder="V(in)" required></label>
            <label>Frequency (Hz) <input data-testid="measurement-phase-frequency" type="number" min="0" step="any" value="1000" required></label>
            <label><input data-testid="measurement-phase-unwrap" type="checkbox"> Unwrap phase</label>
          </fieldset>
          <p data-testid="measurement-parameter-diagnostic" role="status" aria-live="polite"></p>
          <table data-testid="measurement-results"><caption>Named measurement results</caption><thead><tr><th>Name</th><th>Parameters</th><th>Result</th><th>Status</th><th></th></tr></thead><tbody></tbody></table>
        </section>
        <section aria-labelledby="profiles-heading">
          <h3 id="profiles-heading">Profiles</h3>
          <div class="instrument-workbench__inline-form"><select data-testid="profile-select" aria-label="Instrument profile"></select><input data-testid="profile-name" aria-label="New profile name" placeholder="Bench setup"><button type="button" data-testid="save-profile">Save as</button><button type="button" data-testid="delete-profile">Delete</button></div>
        </section>
        <section aria-labelledby="captures-heading">
          <h3 id="captures-heading">Saved captures & comparison</h3>
          <div class="instrument-workbench__inline-form"><input data-testid="capture-name" aria-label="Capture name" placeholder="Before"><button type="button" data-testid="save-capture">Save selected vectors</button></div>
          <div class="instrument-workbench__fields"><label>Before <select data-testid="comparison-baseline"><option value="">None</option></select></label><label>After <select data-testid="comparison-current"><option value="">Live result</option></select></label></div>
          <p data-testid="comparison-status" role="status" aria-live="polite"></p>
          <ul data-testid="capture-list" class="instrument-workbench__capture-list"></ul>
        </section>
      </div>`;
    host.replaceChildren(this.root);
    this.bind();
    this.render();
    this.rebuildComputed();
  }

  setCircuit(document: CircuitDocument | undefined): void {
    this.circuit = document ? structuredClone(document) : undefined;
    this.renderTarget();
  }

  setNetlist(netlist: GeneratedNetlist | undefined): void {
    this.netlist = netlist ? structuredClone(netlist) : undefined;
    this.rebuildComputed();
  }

  setResult(mode: AnalysisMode, result?: SimulationResult, resolved: WorkbenchResolvedResult = {}): void {
    this.mode = mode;
    this.result = result;
    this.resolved = resolved;
    this.targetSeries.clear();
    this.comparisonLoadGeneration += 1;
    this.baselineSeries = [...(resolved.baselineSeries ?? [])];
    this.comparisonCurrentSeries = undefined;
    this.comparisonMessage = undefined;
    this.rebuildComputed();
    if (this.state.comparison.baselineCaptureId || this.state.comparison.currentCaptureId) void this.loadComparison();
  }

  setTarget(target?: EditorMeasurementTarget, resolution?: ResolvedMeasurementTarget): void {
    const staged = target ? targetStage(target, resolution) : undefined;
    if (!staged) this.targetSeries.clear();
    else if (
      resolution?.series
      && serializeSignalExpression(resolution.series.definition.expression) === serializeSignalExpression(staged.definition!.expression)
    ) this.targetSeries.set(staged.definition!.id, resolution.series);
    else this.targetSeries.delete(staged.definition!.id);
    this.commit((state) => {
      if (!staged) {
        delete state.stagedTarget;
        return;
      }
      state.stagedTarget = structuredClone(staged);
      state.expressionSource = staged.expressionSource ?? "";
      state.expressionDiagnostics = [];
      const profile = activeInstrumentProfile(state);
      if (staged.definition && profile.traces.some((trace) => trace.definition.id === staged.definition!.id)) state.selectedTraceId = staged.definition.id;
    });
  }

  setRunProvenance(provenance: WorkbenchRunProvenance | undefined): void {
    this.provenance = provenance ? structuredClone(provenance) : undefined;
    void this.refreshCaptureMetadata();
    this.renderCaptureControls();
  }

  restoreState(state: MeasurementWorkbenchState): void {
    const next = normalizeMeasurementWorkbenchState(state);
    if (instrumentStateSignature(next) === instrumentStateSignature(this.state)) return;
    const modeChanged = next.measureMode !== this.state.measureMode;
    const comparisonChanged = JSON.stringify(next.comparison) !== JSON.stringify(this.state.comparison);
    this.state = next;
    if (comparisonChanged) {
      this.comparisonLoadGeneration += 1;
      this.baselineSeries = [...(this.resolved.baselineSeries ?? [])];
      this.comparisonCurrentSeries = undefined;
      this.comparisonMessage = undefined;
    }
    this.render();
    this.rebuildComputed();
    if (comparisonChanged && (next.comparison.baselineCaptureId || next.comparison.currentCaptureId)) void this.loadComparison();
    if (modeChanged) this.options.onMeasureModeChange?.(this.state.measureMode);
    this.options.onStateChange?.(this.getState());
  }

  serializeState(): string {
    return instrumentStateSignature(this.state);
  }

  getState(): MeasurementWorkbenchState {
    return structuredClone(this.state);
  }

  getPlotDataset(): WorkbenchPlotDataset | undefined {
    return this.plotDataset ? {
      ...this.plotDataset,
      vectors: new Map([...this.plotDataset.vectors].map(([key, values]) => [key, values.slice()])),
      traces: structuredClone(this.plotDataset.traces),
      yScales: { ...this.plotDataset.yScales },
      measurements: structuredClone(this.plotDataset.measurements),
    } : undefined;
  }

  destroy(): void {
    this.destroyed = true;
    this.comparisonLoadGeneration += 1;
    this.options.onPlotChange?.(undefined);
    this.root.remove();
  }

  private byTestId<T extends HTMLElement>(testId: string): T {
    const element = this.root.querySelector<T>(`[data-testid="${testId}"]`);
    if (!element) throw new Error(`Measurement workbench is missing ${testId}`);
    return element;
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.idCounter.toString(36)}`;
  }

  private commit(change: (state: MeasurementWorkbenchState) => void): void {
    const before = instrumentStateSignature(this.state);
    const next = structuredClone(this.state);
    change(next);
    if (instrumentStateSignature(next) === before) return;
    const modeChanged = next.measureMode !== this.state.measureMode;
    this.state = next;
    this.render();
    this.rebuildComputed();
    if (modeChanged) this.options.onMeasureModeChange?.(this.state.measureMode);
    this.options.onStateChange?.(this.getState());
  }

  private bind(): void {
    this.byTestId<HTMLButtonElement>("measure-mode-toggle").addEventListener("click", () => this.commit((state) => { state.measureMode = !state.measureMode; }));
    this.byTestId<HTMLButtonElement>("workbench-run").addEventListener("click", () => this.options.onRunRequested?.());
    this.byTestId<HTMLInputElement>("measurement-expression").addEventListener("input", (event) => {
      const source = (event.currentTarget as HTMLInputElement).value;
      const parsed = parseSignalExpression(source);
      this.commit((state) => {
        state.expressionSource = source;
        state.expressionDiagnostics = parsed.ok ? [] : parsed.diagnostics;
      });
    });
    this.byTestId<HTMLButtonElement>("add-trace").addEventListener("click", () => this.addExpressionTrace());
    this.byTestId<HTMLButtonElement>("add-target-trace").addEventListener("click", () => this.addStagedTarget());
    this.byTestId<HTMLElement>("trace-list").addEventListener("click", (event) => this.handleTraceClick(event));
    this.byTestId<HTMLElement>("trace-list").addEventListener("change", (event) => this.handleTraceChange(event));
    this.byTestId<HTMLSelectElement>("plot-mode").addEventListener("change", (event) => {
      const plotMode = (event.currentTarget as HTMLSelectElement).value as InstrumentProfile["viewer"]["plotMode"];
      this.commit((state) => {
        const profile = activeInstrumentProfile(state);
        profile.viewer.plotMode = plotMode;
        if (plotMode === "spectrum") this.ensureFFT(profile);
        if (plotMode === "xy" || plotMode === "vi") this.ensureXY(profile);
      });
    });
    this.byTestId<HTMLSelectElement>("plot-layout").addEventListener("change", (event) => {
      const layout = (event.currentTarget as HTMLSelectElement).value as PlotLayoutMode;
      this.commit((state) => { activeInstrumentProfile(state).viewer.layout = layout; });
    });
    for (const testId of ["fft-samples", "fft-window", "fft-db"] as const) {
      this.byTestId<HTMLElement>(testId).addEventListener("change", () => this.commit((state) => this.updateFFT(activeInstrumentProfile(state))));
    }
    this.byTestId<HTMLInputElement>("fft-log-y").addEventListener("change", (event) => {
      const scale = (event.currentTarget as HTMLInputElement).checked ? "log" : "linear";
      this.commit((state) => {
        const profile = activeInstrumentProfile(state);
        const trace = profile.traces.find((candidate) => candidate.definition.id === state.selectedTraceId) ?? profile.traces[0];
        if (trace) trace.yScale = scale;
      });
    });
    for (const testId of ["xy-x", "xy-y"] as const) {
      this.byTestId<HTMLSelectElement>(testId).addEventListener("change", () => this.commit((state) => this.updateXY(activeInstrumentProfile(state))));
    }
    this.byTestId<HTMLInputElement>("trigger-enabled").addEventListener("change", (event) => {
      const enabled = (event.currentTarget as HTMLInputElement).checked;
      this.commit((state) => {
        const profile = activeInstrumentProfile(state);
        if (!enabled) delete profile.transforms.trigger;
        else this.ensureTrigger(profile);
      });
    });
    for (const testId of ["trigger-source", "trigger-mode", "trigger-edge", "trigger-level", "trigger-holdoff", "trigger-pretrigger", "trigger-window-duration"] as const) {
      this.byTestId<HTMLElement>(testId).addEventListener("change", () => this.commit((state) => this.updateTrigger(activeInstrumentProfile(state))));
    }
    this.byTestId<HTMLSelectElement>("measurement-kind").addEventListener("change", () => {
      this.resetMeasurementDraft();
      this.renderMeasurementControls();
    });
    this.byTestId<HTMLButtonElement>("add-measurement").addEventListener("click", () => this.addMeasurement());
    this.byTestId<HTMLElement>("measurement-results").addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-remove-measurement]");
      if (!button) return;
      this.commit((state) => {
        const profile = activeInstrumentProfile(state);
        profile.measurements = profile.measurements.filter((measurement) => measurement.id !== button.dataset.removeMeasurement);
      });
    });
    this.byTestId<HTMLSelectElement>("profile-select").addEventListener("change", (event) => {
      const id = (event.currentTarget as HTMLSelectElement).value;
      this.commit((state) => { if (state.profiles.some((profile) => profile.id === id)) state.activeProfileId = id; });
      this.restoreActiveProfileAnalysis();
    });
    this.byTestId<HTMLButtonElement>("save-profile").addEventListener("click", () => this.saveProfile());
    this.byTestId<HTMLButtonElement>("delete-profile").addEventListener("click", () => this.deleteProfile());
    this.byTestId<HTMLButtonElement>("save-capture").addEventListener("click", () => { void this.saveCurrentCapture(); });
    this.byTestId<HTMLSelectElement>("comparison-baseline").addEventListener("change", (event) => {
      const id = (event.currentTarget as HTMLSelectElement).value;
      this.commit((state) => {
        if (id) state.comparison.baselineCaptureId = id;
        else delete state.comparison.baselineCaptureId;
      });
      void this.loadComparison();
    });
    this.byTestId<HTMLSelectElement>("comparison-current").addEventListener("change", (event) => {
      const id = (event.currentTarget as HTMLSelectElement).value;
      this.commit((state) => {
        if (id) state.comparison.currentCaptureId = id;
        else delete state.comparison.currentCaptureId;
      });
      void this.loadComparison();
    });
  }

  private activeProfile(): InstrumentProfile {
    return activeInstrumentProfile(this.state);
  }

  private selectedTrace(profile = this.activeProfile()): InstrumentTraceDefinition | undefined {
    return profile.traces.find((trace) => trace.definition.id === this.state.selectedTraceId) ?? profile.traces[0];
  }

  private traceDisplayLabel(definition: SignalDefinition): string {
    return workbenchSignalDisplayLabel(definition, this.circuit);
  }

  private addExpressionTrace(): void {
    const parsed = parseSignalExpression(this.state.expressionSource);
    if (!parsed.ok) {
      this.commit((state) => { state.expressionDiagnostics = parsed.diagnostics; });
      return;
    }
    const definition = this.definitionForExpression(parsed.expression, parsed.canonical);
    this.commit((state) => {
      const profile = activeInstrumentProfile(state);
      profile.traces.push(this.instrumentTrace(definition, profile.traces.length));
      state.selectedTraceId = definition.id;
      state.expressionDiagnostics = [];
    });
  }

  private addStagedTarget(): void {
    const definition = this.state.stagedTarget?.definition;
    if (!definition) return;
    this.commit((state) => {
      const profile = activeInstrumentProfile(state);
      if (!profile.traces.some((trace) => trace.definition.id === definition.id)) profile.traces.push(this.instrumentTrace(definition, profile.traces.length));
      state.selectedTraceId = definition.id;
    });
  }

  private instrumentTrace(definition: SignalDefinition, index: number): InstrumentTraceDefinition {
    return {
      definition: structuredClone(definition),
      visible: true,
      color: TRACE_COLORS[index % TRACE_COLORS.length] ?? TRACE_COLORS[0],
      axisGroup: definition.quantity,
      yScale: "linear",
      comparisonRole: "current",
    };
  }

  private definitionForExpression(expression: SerializedSignalExpression, canonical: string): SignalDefinition {
    const evaluated = this.context() ? evaluateSignalExpression(expression, this.context()!.resolver) : undefined;
    const quantity = evaluated?.ok ? this.quantityForDimension(evaluated.signal.dimension) : this.quantityForExpression(expression);
    return {
      id: this.nextId("trace"),
      label: canonical,
      expression: structuredClone(expression),
      quantity,
      unit: evaluated?.ok ? evaluated.signal.unit : quantity === "voltage" ? "V" : quantity === "current" ? "A" : quantity === "power" ? "W" : "1",
      polarity: quantity === "power" ? "absorbed-positive" : "signed",
    };
  }

  private quantityForExpression(expression: SerializedSignalExpression): SignalQuantity {
    if (expression.kind === "voltage") return "voltage";
    if (expression.kind === "current") return "current";
    if (expression.kind === "power") return "power";
    return "derived";
  }

  private quantityForDimension(dimension: QuantityDimension): SignalQuantity {
    if (sameDimension(dimension, VOLTAGE_DIMENSION)) return "voltage";
    if (sameDimension(dimension, CURRENT_DIMENSION)) return "current";
    if (sameDimension(dimension, POWER_DIMENSION)) return "power";
    if (sameDimension(dimension, ONE)) return "dimensionless";
    return "derived";
  }

  private handleTraceClick(event: Event): void {
    const action = (event.target as Element).closest<HTMLElement>("[data-trace-action]");
    const row = (event.target as Element).closest<HTMLElement>("[data-trace-id]");
    const id = row?.dataset.traceId;
    if (!id || !action) return;
    if (action.dataset.traceAction === "select") this.commit((state) => { state.selectedTraceId = id; });
    if (action.dataset.traceAction === "remove") {
      const removed = this.activeProfile().traces.find((trace) => trace.definition.id === id)?.definition;
      this.commit((state) => {
        const profile = activeInstrumentProfile(state);
        profile.traces = profile.traces.filter((trace) => trace.definition.id !== id);
        if (state.selectedTraceId === id) {
          const next = profile.traces[0]?.definition.id;
          if (next) state.selectedTraceId = next;
          else delete state.selectedTraceId;
        }
      });
      if (removed) this.options.onTraceRemoved?.(structuredClone(removed));
    }
  }

  private handleTraceChange(event: Event): void {
    const input = (event.target as Element).closest<HTMLInputElement>("input[data-trace-visible]");
    const row = input?.closest<HTMLElement>("[data-trace-id]");
    if (!input || !row?.dataset.traceId) return;
    const id = row.dataset.traceId;
    this.commit((state) => {
      const trace = activeInstrumentProfile(state).traces.find((candidate) => candidate.definition.id === id);
      if (trace) trace.visible = input.checked;
    });
  }

  private ensureFFT(profile: InstrumentProfile): void {
    if (profile.transforms.fft) return;
    const selected = this.selectedTrace(profile);
    if (!selected) return;
    const axis = this.context()?.axis.values;
    profile.transforms.fft = {
      expression: structuredClone(selected.definition.expression),
      window: { start: axis?.[0] ?? 0, stop: axis?.at(-1) ?? 1 },
      samples: 1024,
      windowFunction: "hann",
      normalization: "one-sided-amplitude",
      detrend: "mean",
      spectrumScale: "linear",
    };
  }

  private updateFFT(profile: InstrumentProfile): void {
    this.ensureFFT(profile);
    const fft = profile.transforms.fft;
    if (!fft) return;
    const samples = Math.max(2, Math.min(65_536, Math.round(Number(this.byTestId<HTMLInputElement>("fft-samples").value) || 1024)));
    fft.samples = samples;
    fft.windowFunction = this.byTestId<HTMLSelectElement>("fft-window").value === "rectangular" ? "rectangular" : "hann";
    fft.spectrumScale = this.byTestId<HTMLInputElement>("fft-db").checked ? "db" : "linear";
  }

  private ensureXY(profile: InstrumentProfile): void {
    if (profile.transforms.xy || profile.traces.length === 0) return;
    profile.transforms.xy = {
      x: structuredClone(profile.traces[0]!.definition.expression),
      y: structuredClone((profile.traces[1] ?? profile.traces[0])!.definition.expression),
      alignment: "same-axis",
    };
  }

  private updateXY(profile: InstrumentProfile): void {
    const xId = this.byTestId<HTMLSelectElement>("xy-x").value;
    const yId = this.byTestId<HTMLSelectElement>("xy-y").value;
    const x = profile.traces.find((trace) => trace.definition.id === xId);
    const y = profile.traces.find((trace) => trace.definition.id === yId);
    if (!x || !y) return;
    profile.transforms.xy = { x: structuredClone(x.definition.expression), y: structuredClone(y.definition.expression), alignment: "same-axis" };
  }

  private ensureTrigger(profile: InstrumentProfile): void {
    if (profile.transforms.trigger) return;
    const selected = this.selectedTrace(profile);
    if (!selected) return;
    profile.transforms.trigger = {
      expression: structuredClone(selected.definition.expression),
      mode: "auto",
      edge: "rising",
      level: 0,
      holdoff: 0,
      pretrigger: 0.5,
    };
  }

  private triggerEngineeringParameter(testId: string, label: string, allowBlank = false): number | null | undefined {
    const input = this.byTestId<HTMLInputElement>(testId);
    const source = input.value.trim();
    input.removeAttribute("aria-invalid");
    if (allowBlank && source === "") return undefined;
    const parsed = parseEngineeringLiteral(source);
    const axisUnit = this.context()?.axis.unit;
    if (!parsed || (parsed.unit !== "1" && axisUnit !== undefined && parsed.unit !== axisUnit)) {
      input.setAttribute("aria-invalid", "true");
      this.byTestId<HTMLElement>("trigger-config-diagnostic").textContent = `${label} must be a finite engineering value${axisUnit ? ` in ${axisUnit}` : ""}.`;
      return null;
    }
    return Number(parsed.value.toPrecision(15));
  }

  private updateTrigger(profile: InstrumentProfile): void {
    this.ensureTrigger(profile);
    const trigger = profile.transforms.trigger;
    if (!trigger) return;
    const levelInput = this.byTestId<HTMLInputElement>("trigger-level");
    const level = Number(levelInput.value);
    if (!Number.isFinite(level)) {
      levelInput.setAttribute("aria-invalid", "true");
      this.byTestId<HTMLElement>("trigger-config-diagnostic").textContent = "Trigger level must be finite.";
      return;
    }
    levelInput.removeAttribute("aria-invalid");
    const holdoff = this.triggerEngineeringParameter("trigger-holdoff", "Trigger holdoff");
    if (holdoff === null || holdoff === undefined) return;
    if (holdoff < 0) {
      const input = this.byTestId<HTMLInputElement>("trigger-holdoff");
      input.setAttribute("aria-invalid", "true");
      this.byTestId<HTMLElement>("trigger-config-diagnostic").textContent = "Trigger holdoff must be zero or greater.";
      return;
    }
    const pretriggerInput = this.byTestId<HTMLInputElement>("trigger-pretrigger");
    const pretriggerPercent = Number(pretriggerInput.value.trim().replace(/%$/, ""));
    if (!Number.isFinite(pretriggerPercent) || pretriggerPercent < 0 || pretriggerPercent > 100) {
      pretriggerInput.setAttribute("aria-invalid", "true");
      this.byTestId<HTMLElement>("trigger-config-diagnostic").textContent = "Pretrigger must be between 0% and 100%.";
      return;
    }
    pretriggerInput.removeAttribute("aria-invalid");
    const windowDuration = this.triggerEngineeringParameter("trigger-window-duration", "Trigger window duration", true);
    if (windowDuration === null) return;
    if (windowDuration !== undefined && !(windowDuration > 0)) {
      const input = this.byTestId<HTMLInputElement>("trigger-window-duration");
      input.setAttribute("aria-invalid", "true");
      this.byTestId<HTMLElement>("trigger-config-diagnostic").textContent = "Trigger window duration must be greater than zero or blank for the full axis.";
      return;
    }
    this.byTestId<HTMLElement>("trigger-config-diagnostic").textContent = "";
    const sourceId = this.byTestId<HTMLSelectElement>("trigger-source").value;
    const source = profile.traces.find((trace) => trace.definition.id === sourceId);
    if (!source) {
      this.byTestId<HTMLSelectElement>("trigger-source").setAttribute("aria-invalid", "true");
      this.byTestId<HTMLElement>("trigger-config-diagnostic").textContent = "Choose a trace as the trigger source.";
      return;
    }
    this.byTestId<HTMLSelectElement>("trigger-source").removeAttribute("aria-invalid");
    trigger.expression = structuredClone(source.definition.expression);
    const mode = this.byTestId<HTMLSelectElement>("trigger-mode").value;
    trigger.mode = mode === "normal" || mode === "single" ? mode : "auto";
    trigger.edge = this.byTestId<HTMLSelectElement>("trigger-edge").value === "falling" ? "falling" : "rising";
    trigger.level = level;
    trigger.holdoff = holdoff;
    trigger.pretrigger = pretriggerPercent / 100;
    if (windowDuration === undefined) delete trigger.windowDuration;
    else trigger.windowDuration = windowDuration;
  }

  private resetMeasurementDraft(): void {
    const value = (testId: string, next: string): void => { this.byTestId<HTMLInputElement>(testId).value = next; };
    value("measurement-threshold", "-3");
    this.byTestId<HTMLSelectElement>("measurement-direction").value = "falling";
    value("measurement-ordinal", "1");
    value("measurement-low-threshold", "0.1");
    value("measurement-high-threshold", "0.9");
    value("measurement-transition-ordinal", "1");
    value("measurement-edge-threshold", "0");
    this.byTestId<HTMLSelectElement>("measurement-edge-direction").value = "rising";
    value("measurement-edge-ordinal", "1");
    value("measurement-edge-last-ordinal", "");
    this.byTestId<HTMLSelectElement>("measurement-duty-high-when").value = "above";
    const selectedExpression = this.selectedTrace() ? serializeSignalExpression(this.selectedTrace()!.definition.expression) : "";
    value("measurement-reference-expression", selectedExpression);
    value("measurement-reference-threshold", "0");
    this.byTestId<HTMLSelectElement>("measurement-reference-direction").value = "rising";
    value("measurement-reference-ordinal", "1");
    value("measurement-target-threshold", "0");
    this.byTestId<HTMLSelectElement>("measurement-target-direction").value = "rising";
    value("measurement-target-ordinal", "1");
    value("measurement-initial", "0");
    value("measurement-final", "1");
    this.byTestId<HTMLSelectElement>("measurement-tolerance-kind").value = "step-percent";
    value("measurement-tolerance", "2");
    value("measurement-phase-reference", selectedExpression);
    value("measurement-phase-frequency", "1000");
    this.byTestId<HTMLInputElement>("measurement-phase-unwrap").checked = false;
    this.root.querySelectorAll<HTMLElement>("[data-testid^='measurement-'][aria-invalid]").forEach((element) => element.removeAttribute("aria-invalid"));
    this.byTestId<HTMLElement>("measurement-parameter-diagnostic").textContent = "";
  }

  private parameterFailure(message: string, input?: HTMLInputElement): never {
    input?.setAttribute("aria-invalid", "true");
    throw new Error(message);
  }

  private numberParameter(
    testId: string,
    label: string,
    options: { optional?: boolean; integer?: boolean; positive?: boolean } = {},
  ): number | undefined {
    const input = this.byTestId<HTMLInputElement>(testId);
    input.removeAttribute("aria-invalid");
    if (options.optional && input.value.trim() === "") return undefined;
    const value = input.valueAsNumber;
    if (!Number.isFinite(value)) return this.parameterFailure(`${label} must be a finite number.`, input);
    if (options.integer && (!Number.isInteger(value) || value < 1)) return this.parameterFailure(`${label} must be a positive integer.`, input);
    if (options.positive && !(value > 0)) return this.parameterFailure(`${label} must be greater than zero.`, input);
    return value;
  }

  private expressionParameter(testId: string, label: string): SerializedSignalExpression {
    const input = this.byTestId<HTMLInputElement>(testId);
    const parsed = parseSignalExpression(input.value.trim());
    if (!parsed.ok) return this.parameterFailure(`${label}: ${parsed.diagnostics[0]?.message ?? "Enter a valid signal expression."}`, input);
    input.removeAttribute("aria-invalid");
    return parsed.expression;
  }

  private edgeParameter(prefix: "edge" | "reference" | "target"): WorkbenchEdgeParameters {
    return {
      threshold: this.numberParameter(`measurement-${prefix}-threshold`, `${prefix} threshold`)!,
      direction: this.byTestId<HTMLSelectElement>(`measurement-${prefix}-direction`).value === "falling" ? "falling" : "rising",
      ordinal: this.numberParameter(`measurement-${prefix}-ordinal`, `${prefix} crossing`, { integer: true })!,
    };
  }

  private readMeasurementParameters(kind: SerializedMeasurementDefinition["kind"]): WorkbenchMeasurementParameters {
    if (kind === "x-at-level") return {
      threshold: this.numberParameter("measurement-threshold", "Axis threshold")!,
      direction: this.byTestId<HTMLSelectElement>("measurement-direction").value === "rising" ? "rising" : "falling",
      ordinal: this.numberParameter("measurement-ordinal", "Axis crossing", { integer: true })!,
    };
    if (kind === "rise-time" || kind === "fall-time") {
      const lowThreshold = this.numberParameter("measurement-low-threshold", "Low threshold")!;
      const highThreshold = this.numberParameter("measurement-high-threshold", "High threshold")!;
      if (!(highThreshold > lowThreshold)) this.parameterFailure("High threshold must be greater than the low threshold.", this.byTestId<HTMLInputElement>("measurement-high-threshold"));
      return {
        lowThreshold,
        highThreshold,
        ordinal: this.numberParameter("measurement-transition-ordinal", "Transition number", { integer: true })!,
      };
    }
    if (kind === "frequency" || kind === "period") {
      const edge = this.edgeParameter("edge");
      const lastOrdinal = this.numberParameter("measurement-edge-last-ordinal", "Last crossing", { optional: true, integer: true });
      if (lastOrdinal !== undefined && lastOrdinal <= edge.ordinal!) {
        this.parameterFailure("Last crossing must be greater than the first crossing.", this.byTestId<HTMLInputElement>("measurement-edge-last-ordinal"));
      }
      return { edge, ...(lastOrdinal === undefined ? {} : { lastOrdinal }) };
    }
    if (kind === "duty") return {
      threshold: this.numberParameter("measurement-edge-threshold", "Duty threshold")!,
      highWhen: this.byTestId<HTMLSelectElement>("measurement-duty-high-when").value === "below" ? "below" : "above",
    };
    if (kind === "delay") return {
      reference: this.expressionParameter("measurement-reference-expression", "Reference signal"),
      referenceEdge: this.edgeParameter("reference"),
      targetEdge: this.edgeParameter("target"),
    };
    if (kind === "overshoot" || kind === "settling-time") {
      const initial = this.numberParameter("measurement-initial", "Initial level")!;
      const final = this.numberParameter("measurement-final", "Final level")!;
      if (initial === final) this.parameterFailure("Initial and final levels must be different.", this.byTestId<HTMLInputElement>("measurement-final"));
      if (kind === "overshoot") return { initial, final };
      return {
        initial,
        final,
        toleranceKind: this.byTestId<HTMLSelectElement>("measurement-tolerance-kind").value === "absolute" ? "absolute" : "step-percent",
        toleranceValue: this.numberParameter("measurement-tolerance", "Settling tolerance", { positive: true })!,
      };
    }
    if (kind === "phase") return {
      reference: this.expressionParameter("measurement-phase-reference", "Phase reference"),
      frequency: this.numberParameter("measurement-phase-frequency", "Phase frequency", { positive: true })!,
      unwrap: this.byTestId<HTMLInputElement>("measurement-phase-unwrap").checked,
    };
    return {};
  }

  private addMeasurement(): void {
    const trace = this.selectedTrace();
    if (!trace) return;
    const input = this.byTestId<HTMLInputElement>("measurement-name");
    const kind = this.byTestId<HTMLSelectElement>("measurement-kind").value as SerializedMeasurementDefinition["kind"];
    const name = input.value.trim() || `${this.traceDisplayLabel(trace.definition)} ${kind}`;
    let parameters: WorkbenchMeasurementParameters;
    try {
      parameters = this.readMeasurementParameters(kind);
      this.byTestId<HTMLElement>("measurement-parameter-diagnostic").textContent = "";
    } catch (error) {
      this.byTestId<HTMLElement>("measurement-parameter-diagnostic").textContent = error instanceof Error ? error.message : String(error);
      return;
    }
    const definition = createWorkbenchMeasurementDefinition(this.nextId("measurement"), name, kind, trace.definition.expression, parameters);
    this.commit((state) => { activeInstrumentProfile(state).measurements.push(definition); });
    input.value = "";
  }

  private saveProfile(): void {
    const input = this.byTestId<HTMLInputElement>("profile-name");
    this.commit((state) => {
      const source = activeInstrumentProfile(state);
      const profile = structuredClone(source);
      profile.id = this.nextId("profile");
      profile.name = input.value.trim() || `Instrument profile ${state.profiles.length + 1}`;
      if (this.circuit) profile.analysis = createInstrumentAnalysisSnapshot(this.circuit.sim);
      state.profiles.push(profile);
      state.activeProfileId = profile.id;
    });
    input.value = "";
  }

  private restoreActiveProfileAnalysis(): void {
    const snapshot = this.activeProfile().analysis;
    if (snapshot) this.options.onProfileAnalysisRestore?.(structuredClone(snapshot));
  }

  private deleteProfile(): void {
    if (this.state.profiles.length <= 1) return;
    this.commit((state) => {
      state.profiles = state.profiles.filter((profile) => profile.id !== state.activeProfileId);
      state.activeProfileId = state.profiles[0]!.id;
      const first = state.profiles[0]!.traces[0]?.definition.id;
      if (first) state.selectedTraceId = first;
      else delete state.selectedTraceId;
    });
    this.restoreActiveProfileAnalysis();
  }

  private context(): SignalEvaluationContext | undefined {
    if (!this.result || !this.netlist) return undefined;
    try {
      return createSimulationSignalContext(this.netlist, this.result, this.result.sweep?.segments.length ? { segment: 0 } : {});
    } catch {
      return undefined;
    }
  }

  private evaluateCurrentSeries(): SignalSeries[] {
    const profile = this.activeProfile();
    const resolved = groupResolvedSeriesByDefinition(this.resolved.series ?? [], this.targetSeries);
    const failures = new Map<string, TraceEvaluationFailure>();
    const context = this.context();
    const series = profile.traces.flatMap((trace) => {
      const provided = resolved.get(trace.definition.id);
      if (provided) return provided.map((item) => ({ ...item, definition: structuredClone(trace.definition) }));
      if (!context || !this.netlist || !this.result) return [];
      const evaluated = createSimulationSignalSeries(trace.definition, this.netlist, this.result, this.result.sweep?.segments.length ? { segment: 0 } : {});
      if (evaluated.ok) return [evaluated.value];
      failures.set(trace.definition.id, { status: evaluated.status, diagnostics: evaluated.diagnostics });
      return [];
    });
    this.traceEvaluationFailures = failures;
    return series;
  }

  private rebuildComputed(): void {
    if (this.destroyed) return;
    this.currentSeries = this.evaluateCurrentSeries();
    this.renderTraces();
    const context = this.context();
    this.measurementResults = this.resolved.measurements ? [...this.resolved.measurements] : context
      ? this.activeProfile().measurements.map((definition) => evaluateMeasurement(definition, context))
      : [];
    this.plotDataset = this.buildPlotDataset(context);
    this.renderRuntimeResults();
    this.options.onPlotChange?.(this.getPlotDataset());
  }

  private buildPlotDataset(context: SignalEvaluationContext | undefined): WorkbenchPlotDataset | undefined {
    const profile = this.activeProfile();
    if (profile.viewer.plotMode === "spectrum") return this.spectrumDataset(profile, context);
    if (profile.viewer.plotMode === "xy" || profile.viewer.plotMode === "vi") return this.xyDataset(profile, context);
    const current = this.comparisonCurrentSeries ?? this.currentSeries;
    const baseline = this.baselineSeries;
    if (current.length === 0 && baseline.length === 0) return undefined;
    const vectors = new Map<string, Float64Array>();
    const traces: TraceDefinition[] = [];
    const traceStateIds = new Map<string, string>();
    const profileTrace = new Map(profile.traces.map((trace) => [trace.definition.id, trace]));
    const add = (series: SignalSeries, role: "current" | "baseline", index: number): void => {
      const traceState = profileTrace.get(series.definition.id);
      if (role === "current" && traceState?.visible === false) return;
      const sweep = this.mode === "dc-sweep" ? this.result?.sweep : undefined;
      const segment = series.segment === undefined ? undefined : sweep?.segments[series.segment];
      const familyLabel = sweep?.secondary && segment?.secondaryValue !== undefined
        ? ` · ${sweep.secondary.name}=${formatValue(segment.secondaryValue, { unit: sweep.secondary.unit, reserveSign: false })}`
        : "";
      const suffix = `${role}:${series.definition.id}:${series.segment ?? index}`;
      const xSource = `axis:${suffix}`;
      const source = `signal:${suffix}`;
      vectors.set(xSource, series.axis.values);
      vectors.set(source, series.signal.values);
      const traceId = `${role}:${series.definition.id}:${series.segment ?? index}`;
      traces.push({
        id: traceId,
        source,
        xSource,
        label: `${this.traceDisplayLabel(series.definition)}${familyLabel}${role === "baseline" ? " (before)" : ""}`,
        unit: series.signal.unit,
        xUnit: series.axis.unit,
        axisGroup: traceState?.axisGroup ?? series.definition.quantity,
        yScale: traceState?.yScale ?? "linear",
        comparisonRole: role,
        valueKind: series.signal.kind,
        color: traceState?.color ?? TRACE_COLORS[index % TRACE_COLORS.length] ?? TRACE_COLORS[0],
      });
      if (role === "current" && traceState) traceStateIds.set(traceId, traceState.definition.id);
    };
    current.forEach((series, index) => add(series, "current", index));
    baseline.forEach((series, index) => add(series, "baseline", index));
    const trigger = this.triggerResult(profile, context);
    return {
      kind: this.mode === "tran" || this.mode === "ac" || this.mode === "noise" || this.mode === "dc-sweep" ? this.mode : "op-sweep",
      vectors,
      traces,
      layout: profile.viewer.layout,
      yScales: Object.fromEntries(profile.traces.map((trace) => [trace.axisGroup, trace.yScale])),
      trigger,
      measurements: this.measurementResults,
      ...this.plotInteractionBindings(profile, traceStateIds),
    };
  }

  private spectrumDataset(profile: InstrumentProfile, context: SignalEvaluationContext | undefined): WorkbenchPlotDataset | undefined {
    const fft = this.resolved.fft ?? (profile.transforms.fft && context ? computeFFT(profile.transforms.fft, context) : undefined);
    const result = fft && "ok" in fft ? (fft.ok ? fft.value : undefined) : fft;
    if (!result) return undefined;
    const selected = this.selectedTrace(profile);
    const vectors = new Map<string, Float64Array>([["frequency", result.frequencies], ["spectrum", result.spectrum]]);
    const db = result.spectrumScale === "db";
    return {
      kind: "spectrum",
      vectors,
      traces: [{
        id: `fft:${selected?.definition.id ?? "signal"}`,
        source: "spectrum",
        xSource: "frequency",
        label: `${selected ? this.traceDisplayLabel(selected.definition) : "Signal"} spectrum`,
        unit: result.spectrumUnit,
        xUnit: "Hz",
        axisGroup: "spectrum",
        yScale: db ? "linear" : selected?.yScale ?? "linear",
        color: selected?.color ?? TRACE_COLORS[0],
      }],
      layout: profile.viewer.layout,
      yScales: { spectrum: db ? "linear" : selected?.yScale ?? "linear" },
      trigger: null,
      measurements: this.measurementResults,
      ...this.plotInteractionBindings(profile),
    };
  }

  private viCompatibility(profile: InstrumentProfile): { valid: boolean; message: string } {
    return validateWorkbenchVI(profile);
  }

  private xyDataset(profile: InstrumentProfile, context: SignalEvaluationContext | undefined): WorkbenchPlotDataset | undefined {
    if (profile.viewer.plotMode === "vi" && !this.viCompatibility(profile).valid) return undefined;
    const xy = this.resolved.xy ?? (profile.transforms.xy && context ? buildXYSeries(profile.transforms.xy, context) : undefined);
    const result = xy && "ok" in xy ? (xy.ok ? xy.value : undefined) : xy;
    if (!result) return undefined;
    const vectors = new Map<string, Float64Array>([["xy-x", result.x], ["xy-y", result.y]]);
    return {
      kind: profile.viewer.plotMode === "vi" ? "vi" : "xy",
      vectors,
      traces: [{ id: "xy:series", source: "xy-y", xSource: "xy-x", label: profile.viewer.plotMode === "vi" ? "Device characteristic" : "XY", unit: result.yUnit, xUnit: result.xUnit, axisGroup: "xy", color: TRACE_COLORS[0] }],
      layout: profile.viewer.layout,
      yScales: { xy: "linear" },
      trigger: null,
      measurements: this.measurementResults,
      ...this.plotInteractionBindings(profile),
    };
  }

  private plotInteractionBindings(
    profile: InstrumentProfile,
    traceStateIds = new Map<string, string>(),
  ): Pick<WorkbenchPlotDataset, "cursors" | "onCursorsChange" | "onTraceVisibilityChange"> {
    const profileId = profile.id;
    return {
      cursors: structuredClone(profile.viewer.cursors),
      onCursorsChange: (cursors) => this.persistPlotCursors(profileId, cursors),
      onTraceVisibilityChange: (traceId, visible) => {
        const definitionId = traceStateIds.get(traceId);
        if (!definitionId || this.activeProfile().id !== profileId) return;
        this.commit((state) => {
          const trace = activeInstrumentProfile(state).traces.find((candidate) => candidate.definition.id === definitionId);
          if (trace) trace.visible = visible;
        });
      },
    };
  }

  private persistPlotCursors(
    profileId: string,
    cursors: { a: CursorPosition | null; b: CursorPosition | null },
  ): void {
    if (this.activeProfile().id !== profileId) return;
    const next = structuredClone(this.state);
    activeInstrumentProfile(next).viewer.cursors = structuredClone(cursors);
    if (instrumentStateSignature(next) === instrumentStateSignature(this.state)) return;
    this.state = next;
    if (this.plotDataset) this.plotDataset = { ...this.plotDataset, cursors: structuredClone(cursors) };
    this.options.onStateChange?.(this.getState());
  }

  private triggerResult(profile: InstrumentProfile, context: SignalEvaluationContext | undefined): TriggerResult | null {
    if (this.resolved.trigger) return this.resolved.trigger;
    if (!profile.transforms.trigger || !context) return null;
    return evaluateTrigger(profile.transforms.trigger, context);
  }

  private render(): void {
    const profile = this.activeProfile();
    const measureButton = this.byTestId<HTMLButtonElement>("measure-mode-toggle");
    measureButton.setAttribute("aria-pressed", String(this.state.measureMode));
    measureButton.classList.toggle("active", this.state.measureMode);
    this.byTestId<HTMLInputElement>("measurement-expression").value = this.state.expressionSource;
    this.byTestId<HTMLElement>("measurement-expression-diagnostic").textContent = this.state.expressionDiagnostics.map((diagnostic) => diagnostic.message).join(" ");
    this.byTestId<HTMLSelectElement>("plot-mode").value = profile.viewer.plotMode;
    this.byTestId<HTMLSelectElement>("plot-layout").value = profile.viewer.layout;
    this.renderTarget();
    this.renderTraces();
    this.renderTransforms();
    this.renderMeasurementControls();
    this.renderProfiles();
    this.renderCaptureControls();
    this.renderRuntimeResults();
  }

  private renderTarget(): void {
    const output = this.byTestId<HTMLElement>("measurement-target");
    const sign = this.byTestId<HTMLElement>("measurement-sign");
    const staged = this.state.stagedTarget;
    if (!staged) {
      output.textContent = "No schematic target staged.";
      sign.textContent = "Select a wire, pin, or component to establish an explicit sign convention.";
      delete output.dataset.measureTargetKind;
      delete output.dataset.measureTargetId;
      return;
    }
    const target = staged.target;
    const component = target.kind === "wire" ? undefined : this.circuit?.components.find((candidate) => candidate.id === target.componentId);
    const componentName = component?.label?.text || component?.id;
    output.textContent = target.kind === "wire"
      ? `Staged wire ${target.wireId}`
      : target.kind === "pin"
        ? `Staged ${componentName ?? target.componentId} pin ${target.pinIndex + 1}`
        : `Staged component ${componentName ?? target.componentId}`;
    output.dataset.measureTargetKind = target.kind;
    output.dataset.measureTargetId = targetIdentity(target);
    sign.textContent = staged.signText;
  }

  private renderTraces(): void {
    const list = this.byTestId<HTMLUListElement>("trace-list");
    list.replaceChildren();
    for (const trace of this.activeProfile().traces) {
      const displayLabel = this.traceDisplayLabel(trace.definition);
      const item = document.createElement("li");
      item.dataset.traceId = trace.definition.id;
      const expression = trace.definition.expression;
      item.dataset.expressionKind = expression.kind;
      if (expression.kind === "voltage") {
        item.dataset.expressionPositive = nodeReferenceIdentity(expression.positive);
        item.dataset.expressionNegative = nodeReferenceIdentity(expression.negative);
      }
      if ((expression.kind === "current" || expression.kind === "power") && expression.component.kind === "schematic-component") {
        item.dataset.expressionComponent = expression.component.componentId;
      }
      if (expression.kind === "current" && expression.terminal !== undefined) item.dataset.expressionTerminal = String(expression.terminal);
      item.classList.toggle("selected", trace.definition.id === this.state.selectedTraceId);
      const visible = document.createElement("input");
      visible.type = "checkbox";
      visible.checked = trace.visible;
      visible.dataset.traceVisible = "true";
      visible.setAttribute("aria-label", `Show ${displayLabel}`);
      const select = document.createElement("button");
      select.type = "button";
      select.dataset.traceAction = "select";
      select.textContent = `${displayLabel} · ${trace.definition.unit}`;
      select.setAttribute("aria-pressed", String(trace.definition.id === this.state.selectedTraceId));
      const sign = document.createElement("span");
      sign.textContent = trace.definition.polarity === "absorbed-positive" ? "+ absorbed" : "signed";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.traceAction = "remove";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${displayLabel}`);
      item.append(visible, select, sign, remove);
      const failure = this.traceEvaluationFailures.get(trace.definition.id);
      if (failure) {
        const feedback = document.createElement("span");
        feedback.className = "instrument-workbench__trace-feedback";
        feedback.dataset.traceEvaluation = failure.status;
        feedback.setAttribute("role", "status");
        feedback.textContent = `${failure.status}: ${failure.diagnostics[0]?.message ?? "This signal is unavailable for the current analysis."}`;
        item.append(feedback);
      }
      list.append(item);
    }
    this.byTestId<HTMLButtonElement>("add-target-trace").disabled = !this.state.stagedTarget?.definition;
  }

  private renderTransforms(): void {
    const profile = this.activeProfile();
    const fft = profile.transforms.fft;
    this.byTestId<HTMLElement>("fft-controls").hidden = profile.viewer.plotMode !== "spectrum";
    this.byTestId<HTMLElement>("xy-controls").hidden = profile.viewer.plotMode !== "xy" && profile.viewer.plotMode !== "vi";
    if (fft) {
      this.byTestId<HTMLInputElement>("fft-samples").value = String(fft.samples);
      this.byTestId<HTMLSelectElement>("fft-window").value = fft.windowFunction;
      this.byTestId<HTMLInputElement>("fft-db").checked = fft.spectrumScale === "db";
    }
    this.byTestId<HTMLInputElement>("fft-log-y").checked = this.selectedTrace(profile)?.yScale === "log";
    for (const testId of ["xy-x", "xy-y"] as const) {
      const select = this.byTestId<HTMLSelectElement>(testId);
      select.replaceChildren(...profile.traces.map((trace) => {
        const option = document.createElement("option");
        option.value = trace.definition.id;
        option.textContent = this.traceDisplayLabel(trace.definition);
        return option;
      }));
    }
    const xy = profile.transforms.xy;
    if (xy) {
      const canonicalX = serializeSignalExpression(xy.x);
      const canonicalY = serializeSignalExpression(xy.y);
      this.byTestId<HTMLSelectElement>("xy-x").value = profile.traces.find((trace) => serializeSignalExpression(trace.definition.expression) === canonicalX)?.definition.id ?? "";
      this.byTestId<HTMLSelectElement>("xy-y").value = profile.traces.find((trace) => serializeSignalExpression(trace.definition.expression) === canonicalY)?.definition.id ?? "";
    }
    const xyStatus = this.byTestId<HTMLElement>("xy-order-status");
    if (profile.viewer.plotMode === "vi") {
      const compatibility = this.viCompatibility(profile);
      xyStatus.textContent = compatibility.message;
      xyStatus.dataset.xyStatus = compatibility.valid ? "valid" : "invalid";
    } else {
      xyStatus.textContent = "Source sample order is preserved.";
      xyStatus.dataset.xyStatus = "valid";
    }
    const trigger = profile.transforms.trigger;
    this.byTestId<HTMLInputElement>("trigger-enabled").checked = Boolean(trigger);
    const triggerSource = this.byTestId<HTMLSelectElement>("trigger-source");
    triggerSource.replaceChildren(...profile.traces.map((trace) => {
      const option = document.createElement("option");
      option.value = trace.definition.id;
      option.textContent = this.traceDisplayLabel(trace.definition);
      return option;
    }));
    triggerSource.disabled = profile.traces.length === 0;
    if (trigger) {
      const canonicalTrigger = serializeSignalExpression(trigger.expression);
      const triggerTrace = profile.traces.find((trace) => serializeSignalExpression(trace.definition.expression) === canonicalTrigger);
      if (triggerTrace) triggerSource.value = triggerTrace.definition.id;
      else {
        const unavailable = document.createElement("option");
        unavailable.value = "";
        unavailable.textContent = "Unavailable saved source";
        triggerSource.prepend(unavailable);
        triggerSource.value = "";
      }
      this.byTestId<HTMLSelectElement>("trigger-mode").value = trigger.mode;
      this.byTestId<HTMLSelectElement>("trigger-edge").value = trigger.edge;
      this.byTestId<HTMLInputElement>("trigger-level").value = String(trigger.level);
      this.byTestId<HTMLInputElement>("trigger-holdoff").value = canonicalNumber(trigger.holdoff);
      this.byTestId<HTMLInputElement>("trigger-pretrigger").value = canonicalNumber(trigger.pretrigger * 100);
      this.byTestId<HTMLInputElement>("trigger-window-duration").value = trigger.windowDuration === undefined ? "" : canonicalNumber(trigger.windowDuration);
    }
    const axisUnit = this.context()?.axis.unit ?? this.currentSeries[0]?.axis.unit;
    this.root.querySelector<HTMLElement>("#trigger-axis-unit")!.textContent = `Holdoff and window duration use the current analysis axis unit${axisUnit ? ` (${axisUnit})` : ""}; engineering suffixes are accepted.`;
  }

  private renderMeasurementControls(): void {
    const kind = this.byTestId<HTMLSelectElement>("measurement-kind").value as SerializedMeasurementDefinition["kind"];
    this.byTestId<HTMLElement>("x-at-level-controls").hidden = kind !== "x-at-level";
    this.byTestId<HTMLElement>("rise-fall-controls").hidden = kind !== "rise-time" && kind !== "fall-time";
    this.byTestId<HTMLElement>("periodic-controls").hidden = kind !== "frequency" && kind !== "period" && kind !== "duty";
    this.byTestId<HTMLElement>("delay-controls").hidden = kind !== "delay";
    this.byTestId<HTMLElement>("step-response-controls").hidden = kind !== "overshoot" && kind !== "settling-time";
    this.byTestId<HTMLElement>("phase-controls").hidden = kind !== "phase";
    this.root.querySelectorAll<HTMLElement>("[data-periodic-edge]").forEach((element) => { element.hidden = kind === "duty"; });
    this.root.querySelectorAll<HTMLElement>("[data-duty-polarity]").forEach((element) => { element.hidden = kind !== "duty"; });
    this.root.querySelectorAll<HTMLElement>("[data-settling-tolerance]").forEach((element) => { element.hidden = kind !== "settling-time"; });
  }

  private renderProfiles(): void {
    const select = this.byTestId<HTMLSelectElement>("profile-select");
    select.replaceChildren(...this.state.profiles.map((profile) => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      return option;
    }));
    select.value = this.state.activeProfileId;
    this.byTestId<HTMLButtonElement>("delete-profile").disabled = this.state.profiles.length <= 1;
  }

  private renderRuntimeResults(): void {
    const body = this.byTestId<HTMLTableElement>("measurement-results").tBodies[0]!;
    body.replaceChildren();
    const byId = new Map(this.measurementResults.map((result) => [result.id, result]));
    for (const definition of this.activeProfile().measurements) {
      const result = byId.get(definition.id);
      const row = document.createElement("tr");
      row.dataset.measurementId = definition.id;
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = definition.name;
      const parameters = document.createElement("td");
      parameters.className = "instrument-workbench__measurement-parameters";
      parameters.textContent = workbenchMeasurementParameterSummary(definition);
      const value = document.createElement("td");
      value.textContent = result?.value === undefined ? "—" : formatValue(result.value, { unit: result.unit ?? "" });
      const status = document.createElement("td");
      status.textContent = result?.status ?? "Not run";
      if (result?.diagnostics[0]) status.title = result.diagnostics[0].message;
      const action = document.createElement("td");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.removeMeasurement = definition.id;
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove measurement ${definition.name}`);
      action.append(remove);
      row.append(name, parameters, value, status, action);
      body.append(row);
    }
    const trigger = this.triggerResult(this.activeProfile(), this.context());
    const triggerStatus = this.byTestId<HTMLElement>("trigger-status");
    const triggerAxisUnit = this.context()?.axis.unit ?? this.currentSeries[0]?.axis.unit ?? "1";
    triggerStatus.dataset.axisUnit = triggerAxisUnit;
    triggerStatus.textContent = trigger
      ? `Trigger ${trigger.state}${trigger.triggerTime === undefined ? "" : ` at ${formatValue(trigger.triggerTime, { unit: triggerAxisUnit })}`}${trigger.diagnostics[0] ? ` — ${trigger.diagnostics[0].message}` : ""}`
      : "Trigger off";
  }

  private renderCaptureControls(): void {
    this.byTestId<HTMLButtonElement>("save-capture").disabled = !this.provenance?.workspaceId || this.currentSeries.length === 0;
    const list = this.byTestId<HTMLUListElement>("capture-list");
    list.replaceChildren(...this.captureMetadata.map((capture) => {
      const item = document.createElement("li");
      item.dataset.captureId = capture.id;
      item.textContent = `${capture.name} · ${capture.signalCount} signal${capture.signalCount === 1 ? "" : "s"} · ${Math.ceil(capture.sizeBytes / 1024)} KiB`;
      return item;
    }));
    for (const testId of ["comparison-baseline", "comparison-current"] as const) {
      const select = this.byTestId<HTMLSelectElement>(testId);
      const firstLabel = testId === "comparison-baseline" ? "None" : "Live result";
      const first = document.createElement("option");
      first.value = "";
      first.textContent = firstLabel;
      select.replaceChildren(first, ...this.captureMetadata.map((capture) => {
        const option = document.createElement("option");
        option.value = capture.id;
        option.textContent = capture.name;
        return option;
      }));
    }
    this.byTestId<HTMLSelectElement>("comparison-baseline").value = this.state.comparison.baselineCaptureId ?? "";
    this.byTestId<HTMLSelectElement>("comparison-current").value = this.state.comparison.currentCaptureId ?? "";
    const status = this.byTestId<HTMLElement>("comparison-status");
    status.textContent = this.comparisonMessage ?? (this.baselineSeries.length
      ? `Before/after overlay active: ${this.baselineSeries.length} baseline signal${this.baselineSeries.length === 1 ? "" : "s"}. Dashed traces are the baseline.`
      : "Choose a saved capture as Before to compare it with the live result or another capture.");
  }

  private async refreshCaptureMetadata(): Promise<void> {
    const workspaceId = this.provenance?.workspaceId;
    this.captureMetadata = workspaceId ? await listCaptureMetadata(workspaceId) : [];
    if (!this.destroyed) this.renderCaptureControls();
  }

  private async saveCurrentCapture(): Promise<void> {
    const provenance = this.provenance;
    if (!provenance?.workspaceId || this.currentSeries.length === 0) return;
    const nameInput = this.byTestId<HTMLInputElement>("capture-name");
    const capture = await saveCapture({
      id: this.nextId("capture"),
      workspaceId: provenance.workspaceId,
      name: nameInput.value.trim() || `Capture ${new Date().toLocaleTimeString()}`,
      createdAt: Date.now(),
      identity: {
        circuitHash: provenance.circuitHash,
        engine: provenance.engine,
        runKey: provenance.runKey,
        modelIdentities: provenance.modelIdentities.map((identity) => structuredClone(identity)),
        analysisSettings: structuredClone(provenance.analysisSettings),
      },
      signals: this.currentSeries.map(captureSignal),
      measurements: structuredClone(this.measurementResults),
    });
    nameInput.value = "";
    this.commit((state) => {
      if (!state.savedCaptureIds.includes(capture.id)) state.savedCaptureIds.push(capture.id);
    });
    await this.refreshCaptureMetadata();
  }

  private seriesFromCapture(capture: SavedCapture): SignalSeries[] {
    return capture.signals.map((item) => ({
      definition: structuredClone(item.definition),
      runKey: item.runKey,
      axis: {
        id: item.axis.id,
        quantity: item.axis.quantity,
        unit: item.axis.unit,
        values: item.axis.values,
      },
      signal: {
        kind: item.signal.kind,
        unit: item.signal.unit,
        dimension: item.signal.dimension,
        length: item.signal.length,
        canonicalExpression: item.signal.canonicalExpression,
        values: item.signal.values,
      },
      ...(item.segment === undefined ? {} : { segment: item.segment }),
    }));
  }

  private compatibleBaselineSeries(baseline: SignalSeries[], current: SignalSeries[]): { series: SignalSeries[]; reasons: string[] } {
    const compatible: SignalSeries[] = [];
    const reasons: string[] = [];
    for (const before of baseline) {
      const after = current.find((candidate) => candidate.definition.id === before.definition.id && candidate.segment === before.segment)
        ?? current.find((candidate) => candidate.signal.canonicalExpression === before.signal.canonicalExpression && candidate.segment === before.segment);
      if (!after) {
        reasons.push(`${before.definition.label}: no matching current signal`);
        continue;
      }
      const compatibility = compareSeriesCompatibility(before, after);
      if (compatibility.compatible) compatible.push(before);
      else reasons.push(`${before.definition.label}: ${compatibility.reasons.join(", ")}`);
    }
    return { series: compatible, reasons };
  }

  private async loadComparison(): Promise<void> {
    const generation = ++this.comparisonLoadGeneration;
    const baselineId = this.state.comparison.baselineCaptureId;
    const currentId = this.state.comparison.currentCaptureId;
    const [baseline, current] = await Promise.all([
      baselineId ? loadCapture(baselineId) : Promise.resolve(undefined),
      currentId ? loadCapture(currentId) : Promise.resolve(undefined),
    ]);
    if (this.destroyed || generation !== this.comparisonLoadGeneration) return;
    const baselineSeries = baseline ? this.seriesFromCapture(baseline) : [...(this.resolved.baselineSeries ?? [])];
    this.comparisonCurrentSeries = current ? this.seriesFromCapture(current) : undefined;
    const comparisonSeries = this.comparisonCurrentSeries ?? this.currentSeries;
    const compatibility = this.compatibleBaselineSeries(baselineSeries, comparisonSeries);
    this.baselineSeries = compatibility.series;
    if (baselineId && !baseline) this.comparisonMessage = "The selected Before capture is no longer available.";
    else if (baselineId && compatibility.series.length === 0) this.comparisonMessage = compatibility.reasons.length
      ? `Comparison unavailable: ${compatibility.reasons.join("; ")}.`
      : "Comparison unavailable because no compatible baseline signals were found.";
    else if (baselineId) this.comparisonMessage = `Before/after overlay active: ${compatibility.series.length} compatible baseline signal${compatibility.series.length === 1 ? "" : "s"}. Dashed traces are the baseline.${compatibility.reasons.length ? ` Ignored: ${compatibility.reasons.join("; ")}.` : ""}`;
    else this.comparisonMessage = undefined;
    this.rebuildComputed();
    this.renderCaptureControls();
  }
}

export function mountMeasurementWorkbench(
  host: HTMLElement,
  options: MeasurementWorkbenchOptions = {},
): MeasurementWorkbenchController {
  return new MountedMeasurementWorkbench(host, options);
}
