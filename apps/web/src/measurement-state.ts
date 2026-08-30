import type { EditorMeasurementTarget } from "@opencircuit/schematic-editor";
import { isIndependentSource, type CircuitDocument, type SimConfig } from "@opencircuit/circuit-schema";
import {
  parseSignalExpression,
  serializeSignalExpression,
  type SerializedNodeReference,
  type SerializedSignalExpression,
  type FFTDefinition,
  type SerializedMeasurementDefinition,
  type SignalDefinition,
  type SignalDiagnostic,
  type TriggerConfig,
  type XYDefinition,
} from "@opencircuit/signal-workbench";
import type { CursorPosition, PlotLayoutMode, PlotScale } from "@opencircuit/waveform-viewer";

export const INSTRUMENT_STATE_VERSION = 1 as const;

export type InstrumentPlotMode = "time" | "spectrum" | "xy" | "vi";

export interface InstrumentTraceDefinition {
  /** Stable UI and persistence identity. The signal definition carries the exact serialized expression. */
  definition: SignalDefinition;
  visible: boolean;
  color: string;
  axisGroup: string;
  yScale: PlotScale;
  comparisonRole: "current" | "baseline";
}

export interface InstrumentViewerState {
  layout: PlotLayoutMode;
  plotMode: InstrumentPlotMode;
  cursors: { a: CursorPosition | null; b: CursorPosition | null };
}

export interface InstrumentTransformState {
  fft?: FFTDefinition;
  xy?: XYDefinition;
  trigger?: TriggerConfig;
}

/** Exact circuit analysis settings restored when this instrument profile is activated. */
export type InstrumentAnalysisSnapshot = SimConfig;

export interface InstrumentProfile {
  version: typeof INSTRUMENT_STATE_VERSION;
  id: string;
  name: string;
  traces: InstrumentTraceDefinition[];
  measurements: SerializedMeasurementDefinition[];
  viewer: InstrumentViewerState;
  transforms: InstrumentTransformState;
  analysis?: InstrumentAnalysisSnapshot;
}

export interface StagedMeasurementTarget {
  target: EditorMeasurementTarget;
  /** Present only after the target has been resolved to an exact signal expression. */
  definition?: SignalDefinition;
  expressionSource?: string;
  signText: string;
  positiveTerminalLabel?: string;
}

export interface CaptureComparisonSelection {
  baselineCaptureId?: string;
  currentCaptureId?: string;
}

export interface MeasurementWorkbenchState {
  version: typeof INSTRUMENT_STATE_VERSION;
  activeProfileId: string;
  profiles: InstrumentProfile[];
  measureMode: boolean;
  expressionSource: string;
  expressionDiagnostics: SignalDiagnostic[];
  selectedTraceId?: string;
  stagedTarget?: StagedMeasurementTarget;
  savedCaptureIds: string[];
  comparison: CaptureComparisonSelection;
}

export function createDefaultInstrumentProfile(): InstrumentProfile {
  return {
    version: INSTRUMENT_STATE_VERSION,
    id: "default",
    name: "Default instruments",
    traces: [],
    measurements: [],
    viewer: {
      layout: "split",
      plotMode: "time",
      cursors: { a: null, b: null },
    },
    transforms: {},
  };
}

export function createInitialMeasurementWorkbenchState(): MeasurementWorkbenchState {
  return {
    version: INSTRUMENT_STATE_VERSION,
    activeProfileId: "default",
    profiles: [createDefaultInstrumentProfile()],
    measureMode: false,
    expressionSource: "",
    expressionDiagnostics: [],
    savedCaptureIds: [],
    comparison: {},
  };
}

export function activeInstrumentProfile(state: MeasurementWorkbenchState): InstrumentProfile {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0] ?? createDefaultInstrumentProfile();
}

export function createInstrumentAnalysisSnapshot(sim: SimConfig): InstrumentAnalysisSnapshot {
  return structuredClone(sim);
}

export function normalizeMeasurementWorkbenchState(input: unknown): MeasurementWorkbenchState {
  if (!input || typeof input !== "object") return createInitialMeasurementWorkbenchState();
  const candidate = input as Partial<MeasurementWorkbenchState>;
  if (candidate.version !== INSTRUMENT_STATE_VERSION || !Array.isArray(candidate.profiles) || candidate.profiles.length === 0) {
    return createInitialMeasurementWorkbenchState();
  }
  const profiles = structuredClone(candidate.profiles).filter((profile): profile is InstrumentProfile => (
    profile?.version === INSTRUMENT_STATE_VERSION
    && typeof profile.id === "string"
    && typeof profile.name === "string"
    && Array.isArray(profile.traces)
    && Array.isArray(profile.measurements)
  ));
  if (profiles.length === 0) return createInitialMeasurementWorkbenchState();
  const activeProfileId = profiles.some((profile) => profile.id === candidate.activeProfileId)
    ? candidate.activeProfileId as string
    : profiles[0]!.id;
  return {
    version: INSTRUMENT_STATE_VERSION,
    activeProfileId,
    profiles,
    measureMode: candidate.measureMode === true,
    expressionSource: typeof candidate.expressionSource === "string" ? candidate.expressionSource : "",
    expressionDiagnostics: Array.isArray(candidate.expressionDiagnostics) ? structuredClone(candidate.expressionDiagnostics) : [],
    ...(typeof candidate.selectedTraceId === "string" ? { selectedTraceId: candidate.selectedTraceId } : {}),
    ...(candidate.stagedTarget ? { stagedTarget: structuredClone(candidate.stagedTarget) } : {}),
    savedCaptureIds: Array.isArray(candidate.savedCaptureIds)
      ? candidate.savedCaptureIds.filter((id): id is string => typeof id === "string")
      : [],
    comparison: candidate.comparison ? structuredClone(candidate.comparison) : {},
  };
}

export function instrumentStateSignature(state: MeasurementWorkbenchState): string {
  return JSON.stringify(state);
}

export interface CircuitProbeStateSync {
  document: Pick<CircuitDocument, "components" | "wires">;
  definitions: readonly SignalDefinition[];
  previousProbeIds: ReadonlySet<string>;
}

type ExpressionReplacement = SerializedSignalExpression | null;

function expressionReplacementMap(
  state: MeasurementWorkbenchState,
  definitions: ReadonlyMap<string, SignalDefinition>,
): ReadonlyMap<string, ExpressionReplacement> {
  const replacements = new Map<string, ExpressionReplacement>();
  const remember = (previous: SignalDefinition): void => {
    const next = definitions.get(previous.id);
    if (!next) return;
    const previousKey = serializeSignalExpression(previous.expression);
    const nextKey = serializeSignalExpression(next.expression);
    if (previousKey === nextKey) return;
    const existing = replacements.get(previousKey);
    if (existing === undefined) replacements.set(previousKey, structuredClone(next.expression));
    else if (existing && serializeSignalExpression(existing) !== nextKey) replacements.set(previousKey, null);
  };
  for (const profile of state.profiles) for (const trace of profile.traces) remember(trace.definition);
  if (state.stagedTarget?.definition) remember(state.stagedTarget.definition);
  return replacements;
}

function nodeReferenceIsCurrent(
  reference: SerializedNodeReference,
  wireIds: ReadonlySet<string>,
  componentIds: ReadonlySet<string>,
): boolean {
  if (reference.kind === "runtime-node") return true;
  if (reference.kind === "schematic-wire") return wireIds.has(reference.wireId);
  return componentIds.has(reference.componentId);
}

function expressionIsCurrent(
  expression: SerializedSignalExpression,
  wireIds: ReadonlySet<string>,
  componentIds: ReadonlySet<string>,
): boolean {
  if (expression.kind === "constant") return true;
  if (expression.kind === "voltage") {
    return nodeReferenceIsCurrent(expression.positive, wireIds, componentIds)
      && nodeReferenceIsCurrent(expression.negative, wireIds, componentIds);
  }
  if (expression.kind === "current" || expression.kind === "power") {
    return expression.component.kind === "runtime-device" || componentIds.has(expression.component.componentId);
  }
  if (expression.kind === "unary") return expressionIsCurrent(expression.operand, wireIds, componentIds);
  if (expression.kind === "binary") {
    return expressionIsCurrent(expression.left, wireIds, componentIds)
      && expressionIsCurrent(expression.right, wireIds, componentIds);
  }
  return expression.arguments.every((argument) => expressionIsCurrent(argument, wireIds, componentIds));
}

function reconcileExpression(
  expression: SerializedSignalExpression,
  replacements: ReadonlyMap<string, ExpressionReplacement>,
  wireIds: ReadonlySet<string>,
  componentIds: ReadonlySet<string>,
): SerializedSignalExpression | undefined {
  const replacement = replacements.get(serializeSignalExpression(expression));
  const candidate = replacement === undefined ? structuredClone(expression) : replacement ? structuredClone(replacement) : undefined;
  return candidate && expressionIsCurrent(candidate, wireIds, componentIds) ? candidate : undefined;
}

function reconcileMeasurement(
  measurement: SerializedMeasurementDefinition,
  replacements: ReadonlyMap<string, ExpressionReplacement>,
  wireIds: ReadonlySet<string>,
  componentIds: ReadonlySet<string>,
): SerializedMeasurementDefinition | undefined {
  const expression = reconcileExpression(measurement.expression, replacements, wireIds, componentIds);
  if (!expression) return undefined;
  const next = { ...structuredClone(measurement), expression } as SerializedMeasurementDefinition;
  if ("reference" in next) {
    const reference = reconcileExpression(next.reference, replacements, wireIds, componentIds);
    if (!reference) return undefined;
    next.reference = reference;
  }
  return next;
}

function traceCursorIsCurrent(traceId: string | undefined, definitionIds: ReadonlySet<string>): boolean {
  if (!traceId) return true;
  if (!traceId.startsWith("current:") && !traceId.startsWith("baseline:")) return true;
  return [...definitionIds].some((id) => traceId.startsWith(`current:${id}:`) || traceId.startsWith(`baseline:${id}:`));
}

function stagedTargetIsCurrent(
  target: EditorMeasurementTarget,
  wireIds: ReadonlySet<string>,
  componentIds: ReadonlySet<string>,
): boolean {
  return target.kind === "wire" ? wireIds.has(target.wireId) : componentIds.has(target.componentId);
}

function referenceTarget(reference: SerializedNodeReference): EditorMeasurementTarget | undefined {
  if (reference.kind === "schematic-wire") return { kind: "wire", wireId: reference.wireId };
  if (reference.kind === "schematic-pin") return { kind: "pin", componentId: reference.componentId, pinIndex: reference.pin };
  return undefined;
}

function stagedTargetForExpression(
  previous: StagedMeasurementTarget,
  expression: SerializedSignalExpression,
  wireIds: ReadonlySet<string>,
  componentIds: ReadonlySet<string>,
): EditorMeasurementTarget | undefined {
  if (stagedTargetIsCurrent(previous.target, wireIds, componentIds)) return structuredClone(previous.target);
  if (expression.kind !== "voltage") return undefined;
  const target = referenceTarget(expression.positive);
  return target && stagedTargetIsCurrent(target, wireIds, componentIds) ? target : undefined;
}

function signTextForExpression(expression: SerializedSignalExpression): string {
  const node = (reference: SerializedNodeReference): string => {
    if (reference.kind === "schematic-wire") return `wire ${reference.wireId}`;
    if (reference.kind === "schematic-pin") return `${reference.componentId} pin ${reference.pin + 1}`;
    return reference.name === "0" ? "ground (node 0)" : `node ${reference.name}`;
  };
  if (expression.kind === "voltage") return `Voltage sign: + on ${node(expression.positive)}; − at ${node(expression.negative)}.`;
  if (expression.kind === "current") return "Current sign follows the selected component terminal; positive current enters that terminal.";
  if (expression.kind === "power") return "Power sign: positive means the component absorbs power; negative means it delivers power.";
  return "Expression sign follows its serialized arithmetic.";
}

/**
 * Reconcile the live workbook with editor-owned object normalization.
 *
 * Same-id circuit probes are stable identities, so exact expression copies in
 * profiles can be retargeted safely. Any remaining expression that refers to a
 * deleted schematic object is invalidated instead of silently measuring a
 * different node. Saved capture payloads are deliberately outside this state.
 */
export function synchronizeMeasurementWorkbenchCircuit(
  input: MeasurementWorkbenchState,
  sync: CircuitProbeStateSync,
): MeasurementWorkbenchState {
  const state = normalizeMeasurementWorkbenchState(input);
  const definitions = new Map(sync.definitions.map((definition) => [definition.id, definition]));
  const replacements = expressionReplacementMap(state, definitions);
  const wireIds = new Set(sync.document.wires.map((wire) => wire.id));
  const componentIds = new Set(sync.document.components.map((component) => component.id));

  for (const profile of state.profiles) {
    profile.traces = profile.traces.flatMap((trace) => {
      const definition = definitions.get(trace.definition.id);
      if (definition) {
        return [{ ...trace, definition: structuredClone(definition) }];
      }
      if (sync.previousProbeIds.has(trace.definition.id)) return [];
      const expression = reconcileExpression(trace.definition.expression, replacements, wireIds, componentIds);
      if (!expression) return [];
      return [{ ...trace, definition: { ...trace.definition, expression } }];
    });
    profile.measurements = profile.measurements.flatMap((measurement) => {
      const reconciled = reconcileMeasurement(measurement, replacements, wireIds, componentIds);
      return reconciled ? [reconciled] : [];
    });

    const fft = profile.transforms.fft;
    if (fft) {
      const expression = reconcileExpression(fft.expression, replacements, wireIds, componentIds);
      if (expression) profile.transforms.fft = { ...fft, expression };
      else delete profile.transforms.fft;
    }
    const xy = profile.transforms.xy;
    if (xy) {
      const x = reconcileExpression(xy.x, replacements, wireIds, componentIds);
      const y = reconcileExpression(xy.y, replacements, wireIds, componentIds);
      if (x && y) profile.transforms.xy = { ...xy, x, y };
      else delete profile.transforms.xy;
    }
    const trigger = profile.transforms.trigger;
    if (trigger) {
      const expression = reconcileExpression(trigger.expression, replacements, wireIds, componentIds);
      if (expression) profile.transforms.trigger = { ...trigger, expression };
      else delete profile.transforms.trigger;
    }
    if (profile.viewer.plotMode === "spectrum" && !profile.transforms.fft) profile.viewer.plotMode = "time";
    if ((profile.viewer.plotMode === "xy" || profile.viewer.plotMode === "vi") && !profile.transforms.xy) profile.viewer.plotMode = "time";
    if (profile.analysis) {
      const sourceIsCurrent = (componentId: string): boolean => {
        const component = sync.document.components.find((candidate) => candidate.id === componentId);
        return Boolean(component && isIndependentSource(component));
      };
      if (profile.analysis.ac?.stimulus && !sourceIsCurrent(profile.analysis.ac.stimulus.sourceId)) {
        delete profile.analysis.ac.stimulus;
      }
      if (profile.analysis.dcSweep) {
        if (!sourceIsCurrent(profile.analysis.dcSweep.sourceId)) {
          delete profile.analysis.dcSweep;
          if (profile.analysis.mode === "dc-sweep") profile.analysis.mode = "op";
        } else if (profile.analysis.dcSweep.secondary && !sourceIsCurrent(profile.analysis.dcSweep.secondary.sourceId)) {
          delete profile.analysis.dcSweep.secondary;
        }
      }
      if (profile.analysis.noise) {
        const output = definitions.get(profile.analysis.noise.outputProbeId);
        if (output?.expression.kind !== "voltage" || !sourceIsCurrent(profile.analysis.noise.inputSourceId)) {
          delete profile.analysis.noise;
          if (profile.analysis.mode === "noise") profile.analysis.mode = "op";
        }
      } else if (profile.analysis.mode === "noise") profile.analysis.mode = "op";
    }
    const definitionIds = new Set(profile.traces.map((trace) => trace.definition.id));
    for (const cursor of [profile.viewer.cursors.a, profile.viewer.cursors.b]) {
      if (cursor?.traceId && !traceCursorIsCurrent(cursor.traceId, definitionIds)) delete cursor.traceId;
    }
  }

  if (state.stagedTarget?.definition) {
    const previousSource = serializeSignalExpression(state.stagedTarget.definition.expression);
    const expression = reconcileExpression(state.stagedTarget.definition.expression, replacements, wireIds, componentIds);
    const target = expression ? stagedTargetForExpression(state.stagedTarget, expression, wireIds, componentIds) : undefined;
    if (!expression || !target) {
      delete state.stagedTarget;
      if (state.expressionSource === previousSource) {
        state.expressionSource = "";
        state.expressionDiagnostics = [];
      }
    }
    else {
      const expressionSource = serializeSignalExpression(expression);
      state.stagedTarget = {
        ...state.stagedTarget,
        target,
        definition: { ...state.stagedTarget.definition, expression },
        expressionSource,
        signText: signTextForExpression(expression),
      };
      if (state.expressionSource === previousSource) {
        state.expressionSource = expressionSource;
        state.expressionDiagnostics = [];
      }
    }
  }

  if (state.expressionSource.trim()) {
    const parsed = parseSignalExpression(state.expressionSource);
    if (parsed.ok) {
      const replacement = replacements.get(parsed.canonical);
      const candidate = replacement === undefined ? parsed.expression : replacement ?? undefined;
      if (!candidate || !expressionIsCurrent(candidate, wireIds, componentIds)) {
        state.expressionSource = "";
        state.expressionDiagnostics = [{
          code: "STALE_REFERENCE",
          message: "The drafted signal referenced a schematic object removed by the last edit.",
        }];
      } else if (replacement !== undefined) {
        state.expressionSource = serializeSignalExpression(candidate);
        state.expressionDiagnostics = [];
      }
    }
  }

  const active = activeInstrumentProfile(state);
  if (state.selectedTraceId && !active.traces.some((trace) => trace.definition.id === state.selectedTraceId)) {
    const fallback = active.traces[0]?.definition.id;
    if (fallback) state.selectedTraceId = fallback;
    else delete state.selectedTraceId;
  }
  return state;
}
