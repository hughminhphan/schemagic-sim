import type { TriggerResult } from "@opencircuit/signal-workbench";

export type AnalysisKind = "tran" | "ac" | "noise" | "dc-sweep" | "op-sweep" | "spectrum" | "xy" | "vi";
export type PlotLayoutMode = "overlay" | "split" | "stack";
export type PlotScale = "linear" | "log";
export type CursorName = "a" | "b";
export type ComparisonRole = "current" | "baseline";
export type TraceValueKind = "real" | "complex";

export type VectorCollection =
  | ReadonlyMap<string, Float64Array>
  | Readonly<Record<string, Float64Array>>;

export interface WaveformData {
  kind: AnalysisKind;
  vectors: VectorCollection;
}

export interface TraceDefinition {
  /** Stable identity. Display labels may change and are never used as data keys. */
  id?: string;
  source: string;
  /** Optional per-series X vector. Required for independent comparison or XY domains. */
  xSource?: string;
  label?: string;
  unit?: string;
  xUnit?: string;
  color?: string;
  dash?: readonly number[];
  axisGroup?: string;
  yScale?: PlotScale;
  comparisonRole?: ComparisonRole;
  visible?: boolean;
  /** AC datasets may mix raw complex signals with real derived expressions. */
  valueKind?: TraceValueKind;
}

export type AnnotationPoint = readonly [x: number, y: number];

export interface AnnotationStyle {
  color?: string;
  dash?: readonly number[];
  lineWidth?: number;
  opacity?: number;
  axisGroup?: string;
  unit?: string;
  xMode?: "data" | "normalized";
}

export interface WaveformAnnotation {
  id: string;
  label: string;
  points: readonly AnnotationPoint[];
  style?: AnnotationStyle;
}

export interface AxisRange {
  min: number;
  max: number;
}

export interface CursorSnapshot {
  index: number;
  x: number;
  y?: number;
  traceId?: string;
  /** Values keyed by stable trace/annotation id, never by display label. */
  values: Readonly<Record<string, number>>;
}

export interface CursorState {
  a: CursorSnapshot | null;
  b: CursorSnapshot | null;
  deltaX: number | null;
  reciprocalDeltaX: number | null;
}

export interface CursorPosition {
  x: number;
  y?: number;
  traceId?: string;
}

export interface ViewerDiagnostic {
  code: "INCOMPATIBLE_OVERLAY" | "NON_POSITIVE_LOG_Y" | "MISSING_TRACE_X" | "INVALID_TRIGGER";
  message: string;
  traceIds?: readonly string[];
}

export interface ViewerState {
  layout: PlotLayoutMode;
  xScale: PlotScale;
  xRange: AxisRange;
  yRanges: Readonly<Record<string, AxisRange>>;
  yScales: Readonly<Record<string, PlotScale>>;
  traceVisibility: Readonly<Record<string, boolean>>;
  cursors: {
    a: CursorPosition | null;
    b: CursorPosition | null;
  };
}

export interface ViewerOptions {
  traces?: TraceDefinition[];
  colors?: string[];
  dashes?: ReadonlyArray<readonly number[]>;
  xScale?: PlotScale;
  xVector?: string;
  xUnit?: string;
  yRanges?: Readonly<Record<string, AxisRange>>;
  yScales?: Readonly<Record<string, PlotScale>>;
  layout?: PlotLayoutMode;
  trigger?: TriggerResult;
  unwrapPhase?: boolean;
  showControls?: boolean;
  className?: string;
}

export interface SetDataOptions {
  preserveView?: boolean;
}

export interface WaveformViewer {
  setData(data: WaveformData, options?: SetDataOptions): void;
  setTraces(traces: readonly TraceDefinition[]): void;
  setTraceVisible(source: string, visible: boolean): void;
  addAnnotation(annotation: WaveformAnnotation): void;
  removeAnnotation(id: string): void;
  clearAnnotations(): void;
  setYRange(axisGroup: string, range: AxisRange | null): void;
  setXScale(scale: PlotScale): void;
  setYScale(axisGroup: string, scale: PlotScale): void;
  setLayout(layout: PlotLayoutMode): void;
  setTriggerResult(result: TriggerResult | null): void;
  autoscale(): void;
  exportCSV(): string;
  downloadCSV(filename?: string): void;
  exportPNG(): string;
  downloadPNG(filename?: string): void;
  getCursorState(): CursorState;
  setCursor(which: CursorName, position: CursorPosition | null): void;
  clearCursor(which?: CursorName): void;
  moveCursor(which: CursorName, samples: number): void;
  getState(): ViewerState;
  restoreState(state: ViewerState): void;
  getDiagnostics(): readonly ViewerDiagnostic[];
  onCursorChange(listener: (state: CursorState) => void): () => void;
  onTraceVisibilityChange(listener: (source: string, visible: boolean) => void): () => void;
  onDiagnosticChange(listener: (diagnostics: readonly ViewerDiagnostic[]) => void): () => void;
  destroy(): void;
}
