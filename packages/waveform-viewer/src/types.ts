export type AnalysisKind = "tran" | "ac" | "dc-sweep" | "op-sweep";

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
  dash?: readonly number[];
  axisGroup?: string;
  visible?: boolean;
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
  dashes?: ReadonlyArray<readonly number[]>;
  xScale?: "linear" | "log";
  xVector?: string;
  xUnit?: string;
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
  addAnnotation(annotation: WaveformAnnotation): void;
  removeAnnotation(id: string): void;
  clearAnnotations(): void;
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
