export type AnalysisKind = "tran" | "ac" | "op-sweep";

export type VectorCollection =
  | ReadonlyMap<string, Float64Array>
  | Readonly<Record<string, Float64Array>>;

export interface WaveformData {
  kind: AnalysisKind;
  vectors: VectorCollection;
}

export interface TraceDefinition {
  source: string;
  label?: string;
  unit?: string;
  color?: string;
  axisGroup?: string;
  visible?: boolean;
}

export interface AxisRange {
  min: number;
  max: number;
}

export interface CursorSnapshot {
  index: number;
  x: number;
  values: Readonly<Record<string, number>>;
}

export interface CursorState {
  a: CursorSnapshot | null;
  b: CursorSnapshot | null;
  deltaX: number | null;
  reciprocalDeltaX: number | null;
}

export interface ViewerOptions {
  traces?: TraceDefinition[];
  colors?: string[];
  xScale?: "linear" | "log";
  xVector?: string;
  yRanges?: Readonly<Record<string, AxisRange>>;
  unwrapPhase?: boolean;
  showControls?: boolean;
  className?: string;
}

export interface SetDataOptions {
  preserveView?: boolean;
}

export interface WaveformViewer {
  setData(data: WaveformData, options?: SetDataOptions): void;
  setTraceVisible(source: string, visible: boolean): void;
  setYRange(axisGroup: string, range: AxisRange | null): void;
  setXScale(scale: "linear" | "log"): void;
  autoscale(): void;
  exportCSV(): string;
  downloadCSV(filename?: string): void;
  exportPNG(): string;
  downloadPNG(filename?: string): void;
  getCursorState(): CursorState;
  onCursorChange(listener: (state: CursorState) => void): () => void;
  onTraceVisibilityChange(listener: (source: string, visible: boolean) => void): () => void;
  destroy(): void;
}
