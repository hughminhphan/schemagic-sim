import { complexToBode, type BodeData } from "./ac";
import { columnsToCSV, type CSVColumn } from "./csv";
import { snapCursorIndex } from "./cursor";
import { decimateMinMax } from "./decimate";
import { formatValue } from "./format";
import { orderedXYPoints } from "./xy";
import type {
  AnnotationPoint,
  AnnotationStyle,
  AxisRange,
  CursorName,
  CursorPosition,
  CursorSnapshot,
  CursorState,
  PlotLayoutMode,
  PlotScale,
  TraceDefinition,
  VectorCollection,
  ViewerDiagnostic,
  ViewerOptions,
  ViewerState,
  WaveformAnnotation,
  WaveformData,
  WaveformViewer,
} from "./types";
import type { TriggerResult } from "@opencircuit/signal-workbench";

const DEFAULT_COLORS = ["#3FD983", "#E8A244", "#5FB0E8", "#F1EEE8", "#3FD983", "#E8A244"];
const DEFAULT_DASHES: ReadonlyArray<readonly number[]> = [[], [], [], [], [6, 3], [2, 3]];
const LEFT = 66;
const RIGHT = 18;
const TOP = 20;
const BOTTOM = 26;
const PANEL_GAP = 28;

interface InternalTrace extends Required<Pick<TraceDefinition, "id" | "source" | "label" | "unit" | "axisGroup" | "visible" | "yScale" | "comparisonRole">> {
  xSource: string;
  xUnit: string;
  color: string;
  dash: number[];
  valueKind: "real" | "complex";
}

interface InternalAnnotation {
  id: string;
  label: string;
  points: Array<AnnotationPoint | null>;
  style: Required<AnnotationStyle>;
}

interface PlotSeries {
  id: string;
  key: string;
  trace: InternalTrace;
  xValues: Float64Array;
  values: Float64Array;
  group: string;
  panelKey: string;
  unit: string;
}

interface CursorAnchor {
  traceId?: string;
  index: number;
}

function toMap(vectors: VectorCollection): Map<string, Float64Array> {
  return vectors instanceof Map ? new Map(vectors) : new Map(Object.entries(vectors));
}

function inferUnit(name: string, kind: WaveformData["kind"]): string {
  const lower = name.toLowerCase();
  if (lower === "time") return "s";
  if (lower === "frequency") return "Hz";
  if (lower.startsWith("v(") || lower.includes("voltage")) return "V";
  if (lower.startsWith("i(") || lower.includes("current")) return "A";
  return kind === "op-sweep" || kind === "dc-sweep" ? "" : "V";
}

export function paddedRange(values: Iterable<number>): AxisRange {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: -1, max: 1 };
  const centre = (min + max) / 2;
  const span = max - min;
  if (span <= Math.max(Math.abs(centre) * 1e-3, 1e-12)) {
    const padding = Math.max(Math.abs(centre) * 0.05, 1e-9);
    return { min: centre - padding, max: centre + padding };
  }
  const padding = span * 0.06;
  return { min: min - padding, max: max + padding };
}

export function paddedLogRange(values: Iterable<number>): AxisRange {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value) || value <= 0) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 1e-12, max: 1 };
  if (max === min) return { min: min / 1.1, max: max * 1.1 };
  const padding = 10 ** ((Math.log10(max) - Math.log10(min)) * 0.06);
  return { min: min / padding, max: max * padding };
}

export function resolveTraceDash(index: number, traceDash?: readonly number[], optionDashes?: ReadonlyArray<readonly number[]>): number[] {
  return [...(traceDash ?? optionDashes?.[index] ?? DEFAULT_DASHES[index] ?? [])]
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function normalizedAnnotation(annotation: WaveformAnnotation): InternalAnnotation {
  if (!annotation.id.trim()) throw new Error("Annotation id must not be empty");
  if (!annotation.label.trim()) throw new Error("Annotation label must not be empty");
  const style = annotation.style ?? {};
  return {
    id: annotation.id,
    label: annotation.label,
    points: annotation.points.map(([x, y]) => Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null),
    style: {
      color: style.color ?? "#3FD983",
      dash: resolveTraceDash(0, style.dash, []),
      lineWidth: Math.max(0.5, style.lineWidth ?? 1.5),
      opacity: Math.max(0, Math.min(1, style.opacity ?? 0.4)),
      axisGroup: style.axisGroup ?? "",
      unit: style.unit ?? "",
      xMode: style.xMode ?? "data",
    },
  };
}

function finiteAnnotationValues(points: Array<AnnotationPoint | null>, coordinate: 0 | 1): number[] {
  return points.flatMap((point) => point ? [point[coordinate]] : []);
}

function unionRange(a: AxisRange | undefined, b: AxisRange): AxisRange {
  return a ? { min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) } : b;
}

function downloadUrl(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

class CanvasWaveformViewer implements WaveformViewer {
  private readonly root: HTMLDivElement;
  private readonly canvasWrap: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly legend: HTMLDivElement;
  private readonly readout: HTMLDivElement;
  private readonly cursorControls: HTMLDivElement;
  private readonly tableToggle: HTMLButtonElement;
  private readonly tablePanel: HTMLDivElement;
  private readonly resultTable: HTMLTableElement;
  private readonly accessibleStatus: HTMLDivElement;
  private readonly triggerStatus: HTMLDivElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly cursorListeners = new Set<(state: CursorState) => void>();
  private readonly visibilityListeners = new Set<(source: string, visible: boolean) => void>();
  private readonly diagnosticListeners = new Set<(diagnostics: readonly ViewerDiagnostic[]) => void>();
  private readonly options: ViewerOptions;
  private configuredTraces: readonly TraceDefinition[] | undefined;
  private vectors = new Map<string, Float64Array>();
  private traces: InternalTrace[] = [];
  private readonly annotations = new Map<string, InternalAnnotation>();
  private data: WaveformData | null = null;
  private xValues: Float64Array = new Float64Array();
  private xName = "x";
  private xUnit = "";
  private xScale: PlotScale;
  private xRange: AxisRange = { min: 0, max: 1 };
  private readonly yRanges = new Map<string, AxisRange>();
  private readonly yScales = new Map<string, PlotScale>();
  private readonly manualYRanges = new Set<string>();
  private readonly bodeCache = new Map<string, BodeData>();
  private cursorA: CursorAnchor | null = null;
  private cursorB: CursorAnchor | null = null;
  private activeCursor: CursorName = "a";
  private layout: PlotLayoutMode;
  private triggerResult: TriggerResult | null;
  private diagnostics: ViewerDiagnostic[] = [];
  private renderPending = false;
  private drag: { x: number; y: number; moved: boolean } | null = null;

  constructor(element: HTMLElement, options: ViewerOptions = {}) {
    this.options = options;
    this.configuredTraces = options.traces;
    this.xScale = options.xScale ?? "linear";
    this.layout = options.layout ?? "split";
    this.triggerResult = options.trigger ?? null;
    this.root = document.createElement("div");
    this.root.className = `oc-waveform-viewer${options.className ? ` ${options.className}` : ""}`;

    const toolbar = document.createElement("div");
    toolbar.className = "oc-waveform-viewer__toolbar";
    this.legend = document.createElement("div");
    this.legend.className = "oc-waveform-viewer__legend";
    toolbar.append(this.legend);

    this.cursorControls = document.createElement("div");
    this.cursorControls.className = "oc-waveform-viewer__cursor-controls";
    this.cursorControls.setAttribute("role", "group");
    this.cursorControls.setAttribute("aria-label", "Waveform cursors");
    for (const cursor of ["a", "b"] as const) {
      this.cursorControls.append(
        this.makeAction(`${cursor.toUpperCase()} ←`, () => this.moveCursor(cursor, -1), `Move Cursor ${cursor.toUpperCase()} left`),
        this.makeAction(`Set ${cursor.toUpperCase()}`, () => this.setCursorAtDefault(cursor), `Set Cursor ${cursor.toUpperCase()}`),
        this.makeAction(`${cursor.toUpperCase()} →`, () => this.moveCursor(cursor, 1), `Move Cursor ${cursor.toUpperCase()} right`),
        this.makeAction(`Clear ${cursor.toUpperCase()}`, () => this.clearCursor(cursor), `Clear Cursor ${cursor.toUpperCase()}`),
      );
    }
    toolbar.append(this.cursorControls);

    const csvButton = this.makeAction("CSV", () => this.downloadCSV());
    const pngButton = this.makeAction("PNG", () => this.downloadPNG());
    this.tableToggle = this.makeAction("Table", () => {
      this.tablePanel.hidden = !this.tablePanel.hidden;
      this.tableToggle.setAttribute("aria-expanded", String(!this.tablePanel.hidden));
    });
    this.tableToggle.setAttribute("aria-expanded", "false");
    toolbar.append(csvButton, pngButton, this.tableToggle);

    this.canvasWrap = document.createElement("div");
    this.canvasWrap.className = "oc-waveform-viewer__canvas-wrap";
    this.canvasWrap.tabIndex = 0;
    this.canvasWrap.setAttribute("role", "region");
    this.canvasWrap.setAttribute("aria-label", "Interactive waveform plot");
    this.canvas = document.createElement("canvas");
    this.canvas.className = "oc-waveform-viewer__canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    this.context = context;
    this.canvasWrap.append(this.canvas);

    this.readout = document.createElement("div");
    this.readout.className = "oc-waveform-viewer__readout";
    this.triggerStatus = document.createElement("div");
    this.triggerStatus.className = "oc-waveform-viewer__trigger-status";
    this.triggerStatus.dataset.triggerState = this.triggerResult?.state ?? "off";
    this.triggerStatus.setAttribute("aria-live", "polite");
    this.accessibleStatus = document.createElement("div");
    this.accessibleStatus.className = "oc-waveform-viewer__sr-status";
    this.accessibleStatus.setAttribute("aria-live", "polite");
    this.resultTable = document.createElement("table");
    this.resultTable.className = "oc-waveform-viewer__result-table";
    this.resultTable.setAttribute("aria-label", "Cursor measurement results");
    this.tablePanel = document.createElement("div");
    this.tablePanel.className = "oc-waveform-viewer__table-panel";
    this.tablePanel.hidden = true;
    this.tablePanel.append(this.resultTable);
    this.root.append(toolbar, this.canvasWrap, this.triggerStatus, this.readout, this.tablePanel, this.accessibleStatus);
    if (options.showControls === false) toolbar.hidden = true;
    element.replaceChildren(this.root);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvasWrap);
    this.bindInteractions();
    for (const [group, scale] of Object.entries(options.yScales ?? {})) this.yScales.set(group, scale);
    this.renderLegend();
    this.updateReadout();
    this.updateTriggerStatus();
    this.resize();
  }

  setData(data: WaveformData, setOptions: { preserveView?: boolean } = {}): void {
    const previousState = this.data ? this.getState() : null;
    const previousSignature = this.compatibilitySignature();
    const previousKind = this.data?.kind;
    this.data = data;
    this.vectors = toMap(data.vectors);
    this.xName = this.findXName(data.kind);
    this.xValues = this.vectors.get(this.xName) ?? new Float64Array();
    this.xUnit = this.options.xUnit ?? (data.kind === "tran" ? "s" : data.kind === "ac" || data.kind === "noise" || data.kind === "spectrum" ? "Hz" : inferUnit(this.xName, data.kind));
    if (data.kind === "ac" || data.kind === "noise") this.xScale = "log";
    else if (previousKind === "ac" || previousKind === "noise") this.xScale = this.options.xScale ?? "linear";
    this.validateVectorLengths();
    this.buildTraces();
    const compatible = previousState !== null && previousSignature === this.compatibilitySignature();
    const preserve = setOptions.preserveView ?? compatible;
    if (!preserve || !previousState) {
      this.resetXRange();
      this.autoscale();
      for (const [group, range] of Object.entries(this.options.yRanges ?? {})) {
        this.manualYRanges.add(group);
        this.yRanges.set(group, { ...range });
      }
      this.cursorA = null;
      this.cursorB = null;
    } else {
      this.restoreState(previousState);
    }
    this.refreshDiagnostics();
    this.renderLegend();
    this.updateReadout();
    this.scheduleRender();
  }

  setTraces(traces: readonly TraceDefinition[]): void {
    const state = this.getState();
    const previousSignature = this.compatibilitySignature();
    this.configuredTraces = traces;
    if (this.data) {
      this.validateVectorLengths();
      this.buildTraces();
      if (previousSignature === this.compatibilitySignature()) this.restoreState(state);
      else {
        this.manualYRanges.clear();
        this.yRanges.clear();
        this.cursorA = null;
        this.cursorB = null;
        this.resetXRange();
        this.computeAutoscale(false);
      }
    }
    this.refreshDiagnostics();
    this.renderLegend();
    this.updateReadout();
    this.scheduleRender();
  }

  setTraceVisible(source: string, visible: boolean): void {
    const trace = this.traces.find((candidate) => candidate.source === source || candidate.id === source);
    if (!trace || trace.visible === visible) return;
    trace.visible = visible;
    this.renderLegend();
    this.computeAutoscale(true);
    for (const listener of this.visibilityListeners) listener(source, visible);
  }

  addAnnotation(annotation: WaveformAnnotation): void {
    this.annotations.set(annotation.id, normalizedAnnotation(annotation));
    if (this.xValues.length === 0) {
      this.cursorA = null;
      this.cursorB = null;
      this.resetXRange();
    }
    this.renderLegend();
    this.computeAutoscale(true);
    this.updateReadout();
  }

  removeAnnotation(id: string): void {
    if (!this.annotations.delete(id)) return;
    if (this.xValues.length === 0) {
      this.cursorA = null;
      this.cursorB = null;
      this.resetXRange();
    }
    this.renderLegend();
    this.computeAutoscale(true);
    this.updateReadout();
  }

  clearAnnotations(): void {
    if (this.annotations.size === 0) return;
    this.annotations.clear();
    if (this.xValues.length === 0) {
      this.cursorA = null;
      this.cursorB = null;
      this.resetXRange();
    }
    this.renderLegend();
    this.computeAutoscale(true);
    this.updateReadout();
  }

  setYRange(axisGroup: string, range: AxisRange | null): void {
    if (range === null) {
      this.manualYRanges.delete(axisGroup);
      this.yRanges.delete(axisGroup);
      this.computeAutoscale(true);
      return;
    }
    if (!(range.max > range.min)) throw new Error("Y range max must be greater than min");
    this.manualYRanges.add(axisGroup);
    this.yRanges.set(axisGroup, { ...range });
    this.scheduleRender();
  }

  setXScale(scale: PlotScale): void {
    if ((this.data?.kind === "ac" || this.data?.kind === "noise") && scale !== "log") throw new Error("AC and noise plots require logarithmic frequency");
    if (scale === "log" && this.getSeries().some((series) => series.xValues.some((value) => value <= 0))) throw new Error("Logarithmic X requires positive values");
    this.xScale = scale;
    this.resetXRange();
    this.scheduleRender();
  }

  setYScale(axisGroup: string, scale: PlotScale): void {
    this.yScales.set(axisGroup, scale);
    this.computeAutoscale(true);
    this.refreshDiagnostics();
  }

  setLayout(layout: PlotLayoutMode): void {
    if (this.layout === layout) return;
    this.layout = layout;
    this.computeAutoscale(true);
    this.refreshDiagnostics();
    this.updateReadout();
  }

  setTriggerResult(result: TriggerResult | null): void {
    this.triggerResult = result;
    this.updateTriggerStatus();
    this.refreshDiagnostics();
    this.scheduleRender();
  }

  autoscale(): void {
    this.manualYRanges.clear();
    this.computeAutoscale(false);
  }

  private computeAutoscale(preserveManual: boolean): void {
    const next = new Map<string, AxisRange>();
    for (const series of this.getSeries()) {
      const range = this.scaleForPanel(series.panelKey) === "log" ? paddedLogRange(series.values) : paddedRange(series.values);
      next.set(series.panelKey, unionRange(next.get(series.panelKey), range));
    }
    for (const annotation of this.annotations.values()) {
      const values = finiteAnnotationValues(annotation.points, 1);
      if (values.length === 0) continue;
      const group = this.annotationPanelKey(annotation);
      next.set(group, unionRange(next.get(group), paddedRange(values)));
    }
    for (const group of [...this.yRanges.keys()]) {
      if (!next.has(group) && (!preserveManual || !this.manualYRanges.has(group))) this.yRanges.delete(group);
    }
    for (const [group, range] of next) {
      if (!preserveManual || !this.manualYRanges.has(group)) this.yRanges.set(group, range);
    }
    this.scheduleRender();
  }

  private scaleForPanel(panelKey: string): PlotScale {
    if (this.yScales.has(panelKey)) return this.yScales.get(panelKey)!;
    const series = this.getSeries().filter((candidate) => candidate.panelKey === panelKey);
    return series.find((candidate) => candidate.trace.yScale === "log") ? "log" : "linear";
  }

  exportCSV(): string {
    if (!this.data) return "";
    const columns: CSVColumn[] = [{ name: this.xName, unit: this.xUnit, values: this.xValues }];
    for (const series of this.getSeries()) columns.push({ name: series.key, unit: series.unit, values: series.values });
    return columnsToCSV(columns);
  }

  downloadCSV(filename = "waveforms.csv"): void {
    const url = URL.createObjectURL(new Blob([this.exportCSV()], { type: "text/csv;charset=utf-8" }));
    downloadUrl(url, filename);
    URL.revokeObjectURL(url);
  }

  exportPNG(): string {
    return this.canvas.toDataURL("image/png");
  }

  downloadPNG(filename = "waveforms.png"): void {
    downloadUrl(this.exportPNG(), filename);
  }

  getCursorState(): CursorState {
    const a = this.cursorSnapshot(this.cursorA);
    const b = this.cursorSnapshot(this.cursorB);
    const deltaX = a && b ? b.x - a.x : null;
    return {
      a,
      b,
      deltaX,
      reciprocalDeltaX: deltaX && deltaX !== 0 ? 1 / Math.abs(deltaX) : null,
    };
  }

  setCursor(which: CursorName, position: CursorPosition | null): void {
    const anchor = position ? this.anchorForPosition(position) : null;
    if (which === "a") this.cursorA = anchor;
    else this.cursorB = anchor;
    this.activeCursor = which;
    this.cursorChanged();
  }

  clearCursor(which?: CursorName): void {
    if (!which || which === "a") this.cursorA = null;
    if (!which || which === "b") this.cursorB = null;
    this.cursorChanged();
  }

  moveCursor(which: CursorName, samples: number): void {
    const current = which === "a" ? this.cursorA : this.cursorB;
    const series = current?.traceId ? this.getSeries().find((candidate) => candidate.trace.id === current.traceId) : this.getSeries()[0];
    const domain = series?.xValues ?? this.cursorDomainValues();
    if (domain.length === 0) return;
    const index = Math.max(0, Math.min(domain.length - 1, (current?.index ?? Math.floor(domain.length / 2)) + samples));
    const next: CursorAnchor = { index, ...(this.isXY() && series ? { traceId: series.trace.id } : {}) };
    if (which === "a") this.cursorA = next;
    else this.cursorB = next;
    this.activeCursor = which;
    this.cursorChanged();
  }

  getState(): ViewerState {
    const cursorPosition = (snapshot: CursorSnapshot | null): CursorPosition | null => snapshot ? {
      x: snapshot.x,
      ...(snapshot.y === undefined ? {} : { y: snapshot.y }),
      ...(snapshot.traceId === undefined ? {} : { traceId: snapshot.traceId }),
    } : null;
    return {
      layout: this.layout,
      xScale: this.xScale,
      xRange: { ...this.xRange },
      yRanges: Object.fromEntries([...this.yRanges].map(([group, range]) => [group, { ...range }])),
      yScales: Object.fromEntries(this.yScales),
      traceVisibility: Object.fromEntries(this.traces.map((trace) => [trace.id, trace.visible])),
      cursors: {
        a: cursorPosition(this.cursorSnapshot(this.cursorA)),
        b: cursorPosition(this.cursorSnapshot(this.cursorB)),
      },
    };
  }

  restoreState(state: ViewerState): void {
    this.layout = state.layout;
    this.xScale = state.xScale;
    if (state.xRange.max > state.xRange.min && (state.xScale !== "log" || state.xRange.min > 0)) this.xRange = { ...state.xRange };
    this.yRanges.clear();
    for (const [group, range] of Object.entries(state.yRanges)) if (range.max > range.min) this.yRanges.set(group, { ...range });
    this.yScales.clear();
    for (const [group, scale] of Object.entries(state.yScales)) this.yScales.set(group, scale);
    for (const trace of this.traces) {
      const visible = state.traceVisibility[trace.id];
      if (visible !== undefined) trace.visible = visible;
    }
    this.cursorA = state.cursors.a ? this.anchorForPosition(state.cursors.a) : null;
    this.cursorB = state.cursors.b ? this.anchorForPosition(state.cursors.b) : null;
    this.refreshDiagnostics();
    this.renderLegend();
    this.updateReadout();
    this.scheduleRender();
  }

  getDiagnostics(): readonly ViewerDiagnostic[] {
    return this.diagnostics.slice();
  }

  onCursorChange(listener: (state: CursorState) => void): () => void {
    this.cursorListeners.add(listener);
    return () => this.cursorListeners.delete(listener);
  }

  onTraceVisibilityChange(listener: (source: string, visible: boolean) => void): () => void {
    this.visibilityListeners.add(listener);
    return () => this.visibilityListeners.delete(listener);
  }

  onDiagnosticChange(listener: (diagnostics: readonly ViewerDiagnostic[]) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => this.diagnosticListeners.delete(listener);
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.cursorListeners.clear();
    this.visibilityListeners.clear();
    this.diagnosticListeners.clear();
    this.annotations.clear();
    this.root.remove();
  }

  private makeAction(label: string, action: () => void, accessibleLabel?: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "oc-waveform-viewer__action";
    button.textContent = label;
    if (accessibleLabel) button.setAttribute("aria-label", accessibleLabel);
    button.addEventListener("click", action);
    return button;
  }

  private findXName(kind: WaveformData["kind"]): string {
    if (this.options.xVector && this.vectors.has(this.options.xVector)) return this.options.xVector;
    const candidates = kind === "tran"
      ? ["time"]
      : kind === "ac" || kind === "noise" || kind === "spectrum"
        ? ["frequency", "freq"]
        : ["sweep", "x"];
    for (const candidate of candidates) if (this.vectors.has(candidate)) return candidate;
    return this.vectors.keys().next().value ?? "x";
  }

  private validateVectorLengths(): void {
    const definitions: readonly TraceDefinition[] = this.configuredTraces ?? [...this.vectors.keys()]
      .filter((name) => name !== this.xName)
      .map((source) => ({ source }));
    for (const definition of definitions) {
      const values = this.vectors.get(definition.source);
      if (!values) continue;
      const xSource = definition.xSource ?? this.xName;
      const xValues = this.vectors.get(xSource);
      if (!xValues) continue;
      const valueKind = definition.valueKind ?? (this.data?.kind === "ac" ? "complex" : "real");
      const expected = valueKind === "complex" ? xValues.length * 2 : xValues.length;
      if (values.length !== expected) throw new Error(`${definition.source} has ${values.length} values, expected ${expected}`);
    }
  }

  private buildTraces(): void {
    const configured = this.configuredTraces;
    const definitions: TraceDefinition[] = configured
      ? configured.filter((definition) => this.vectors.has(definition.source)).map((definition) => ({ ...definition }))
      : [...this.vectors.keys()].filter((name) => name !== this.xName).map((source) => ({ source }));
    const colors = this.options.colors?.length ? this.options.colors : DEFAULT_COLORS;
    const uncoloredCount = definitions.filter((definition) => !definition.color).length;
    if (uncoloredCount > colors.length) throw new Error(`Trace token list needs at least ${uncoloredCount} colours`);
    const previousVisibility = new Map(this.traces.map((trace) => [trace.id, trace.visible]));
    this.bodeCache.clear();
    let colorIndex = 0;
    this.traces = definitions.map((definition, sourceIndex) => {
      const source = definition.source;
      const id = definition.id?.trim() || source;
      const unit = definition.unit ?? inferUnit(source, this.data?.kind ?? "tran");
      const color = definition.color ?? colors[colorIndex++] ?? "#3FD983";
      const comparisonRole = definition.comparisonRole ?? "current";
      const dash = resolveTraceDash(sourceIndex, definition.dash ?? (comparisonRole === "baseline" ? [6, 3] : undefined), this.options.dashes);
      return {
        id,
        source,
        xSource: definition.xSource ?? this.xName,
        xUnit: definition.xUnit ?? this.xUnit,
        label: definition.label ?? source,
        unit,
        color,
        dash,
        axisGroup: definition.axisGroup ?? (unit || "value"),
        yScale: definition.yScale ?? this.options.yScales?.[definition.axisGroup ?? (unit || "value")] ?? "linear",
        comparisonRole,
        valueKind: definition.valueKind ?? (this.data?.kind === "ac" ? "complex" : "real"),
        visible: previousVisibility.get(id) ?? definition.visible ?? true,
      };
    }).filter((trace) => this.vectors.has(trace.source));
    const ids = new Set<string>();
    for (const trace of this.traces) {
      if (ids.has(trace.id)) throw new Error(`Trace id ${trace.id} is duplicated`);
      ids.add(trace.id);
    }
    if (this.data) {
      for (const trace of this.traces) {
        const values = this.vectors.get(trace.source);
        if (values && trace.valueKind === "complex") this.bodeCache.set(trace.source, complexToBode(values, this.options.unwrapPhase ?? false));
      }
    }
  }

  private getSeries(): PlotSeries[] {
    if (!this.data) return [];
    const series: PlotSeries[] = [];
    for (const trace of this.traces) {
      if (!trace.visible) continue;
      const values = this.vectors.get(trace.source);
      const xValues = this.vectors.get(trace.xSource);
      if (!values || !xValues) continue;
      if (trace.valueKind === "complex") {
        const bode = this.bodeCache.get(trace.source);
        if (!bode) continue;
        series.push(
          { id: `${trace.id}:magnitude`, key: `${trace.label} magnitude`, trace, xValues, values: bode.magnitudeDb, group: "magnitude", panelKey: this.seriesPanelKey(trace, "magnitude"), unit: "dB" },
          { id: `${trace.id}:phase`, key: `${trace.label} phase`, trace, xValues, values: bode.phaseDeg, group: "phase", panelKey: this.seriesPanelKey(trace, "phase"), unit: "°" },
        );
      } else {
        series.push({ id: trace.id, key: trace.label, trace, xValues, values, group: trace.axisGroup, panelKey: this.seriesPanelKey(trace, trace.axisGroup), unit: trace.unit });
      }
    }
    return series;
  }

  private seriesPanelKey(trace: InternalTrace, group: string): string {
    if (this.layout === "overlay") return "overlay";
    if (this.layout === "stack") return `${group}:${trace.id}`;
    return group;
  }

  private annotationGroup(annotation: InternalAnnotation): string {
    return annotation.style.axisGroup || this.getSeries()[0]?.group || "amplitude";
  }

  private annotationPanelKey(annotation: InternalAnnotation): string {
    return this.layout === "overlay" ? "overlay" : this.annotationGroup(annotation);
  }

  private panelGroups(): string[] {
    const groups = [...new Set(this.getSeries().map((series) => series.panelKey))];
    for (const annotation of this.annotations.values()) {
      const group = this.annotationPanelKey(annotation);
      if (!groups.includes(group)) groups.push(group);
    }
    return groups.length > 0 ? groups : ["amplitude"];
  }

  private resetXRange(): void {
    let min = Infinity;
    let max = -Infinity;
    const domains = this.getSeries().map((series) => series.xValues);
    if (domains.length === 0 && this.xValues.length > 0) domains.push(this.xValues);
    for (const domain of domains) {
      for (const value of domain) {
        if (!Number.isFinite(value) || (this.xScale === "log" && value <= 0)) continue;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      const normalized = [...this.annotations.values()].some((annotation) => annotation.style.xMode === "normalized");
      const annotationX = [...this.annotations.values()].flatMap((annotation) => finiteAnnotationValues(annotation.points, 0));
      if (normalized || annotationX.length === 0) {
        this.xRange = { min: this.xScale === "log" ? 1 : 0, max: this.xScale === "log" ? 10 : 1 };
      } else {
        this.xRange = paddedRange(annotationX);
      }
      return;
    }
    this.xRange = max > min ? { min, max } : { min, max: min + Math.max(Math.abs(min) * 0.1, 1) };
  }

  private compatibilitySignature(): string {
    return JSON.stringify({
      kind: this.data?.kind ?? null,
      traces: this.traces.map((trace) => [trace.id, trace.source, trace.xSource, trace.unit, trace.axisGroup]),
    });
  }

  private renderLegend(): void {
    this.legend.replaceChildren();
    for (const trace of this.traces) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "oc-waveform-viewer__trace";
      button.dataset.traceId = trace.id;
      button.dataset.comparisonRole = trace.comparisonRole;
      button.setAttribute("aria-pressed", String(trace.visible));
      button.addEventListener("click", () => this.setTraceVisible(trace.id, !trace.visible));
      button.append(this.makeSwatch(trace.color, trace.dash), this.makeLegendLabel(trace.label));
      this.legend.append(button);
    }
    for (const annotation of this.annotations.values()) {
      const item = document.createElement("span");
      item.className = "oc-waveform-viewer__trace oc-waveform-viewer__annotation";
      item.dataset.traceId = `annotation:${annotation.id}`;
      item.append(this.makeSwatch(annotation.style.color, annotation.style.dash), this.makeLegendLabel(annotation.label));
      this.legend.append(item);
    }
  }

  private makeSwatch(color: string, dash: readonly number[]): HTMLSpanElement {
    const swatch = document.createElement("span");
    swatch.className = "oc-waveform-viewer__swatch";
    swatch.style.setProperty("--trace-color", color);
    swatch.dataset.dashed = String(dash.length > 0);
    return swatch;
  }

  private makeLegendLabel(text: string): HTMLSpanElement {
    const label = document.createElement("span");
    label.textContent = text;
    return label;
  }

  private resize(): void {
    const width = Math.max(1, this.canvasWrap.clientWidth);
    const height = Math.max(1, this.canvasWrap.clientHeight);
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.renderPending) return;
    this.renderPending = true;
    requestAnimationFrame(() => {
      this.renderPending = false;
      this.render();
    });
  }

  private render(): void {
    const width = this.canvasWrap.clientWidth;
    const height = this.canvasWrap.clientHeight;
    const context = this.context;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#15181B";
    context.fillRect(0, 0, width, height);

    const groups = this.panelGroups();
    const panels = groups.length;
    const usableHeight = height - TOP - BOTTOM - (panels - 1) * PANEL_GAP;
    const panelHeight = Math.max(20, usableHeight / panels);
    for (let panel = 0; panel < panels; panel += 1) {
      const top = TOP + panel * (panelHeight + PANEL_GAP);
      this.drawPanel(groups[panel]!, top, panelHeight, width, panel === panels - 1);
    }
    this.drawCursors(width, height);
  }

  private drawPanel(panelKey: string, top: number, height: number, width: number, isLastPanel: boolean): void {
    const context = this.context;
    const plotWidth = Math.max(1, width - LEFT - RIGHT);
    const series = this.getSeries().filter((candidate) => candidate.panelKey === panelKey);
    const annotations = [...this.annotations.values()].filter((annotation) => this.annotationPanelKey(annotation) === panelKey);
    const primaryRange = this.yRanges.get(panelKey) ?? { min: -1, max: 1 };
    const yScale = this.scaleForPanel(panelKey);
    const unit = series[0]?.unit ?? annotations[0]?.style.unit ?? "";

    context.save();
    context.strokeStyle = "rgba(169,174,179,0.18)";
    context.fillStyle = "#A9AEB3";
    context.lineWidth = 1;
    context.setLineDash([]);
    context.font = '10px "IBM Plex Mono", monospace';
    context.textBaseline = "middle";

    for (let division = 0; division <= 10; division += 1) {
      const ratio = division / 10;
      const x = LEFT + ratio * plotWidth;
      context.beginPath();
      context.moveTo(Math.round(x) + 0.5, top);
      context.lineTo(Math.round(x) + 0.5, top + height);
      context.stroke();
      if (isLastPanel && division % 2 === 0) {
        const value = this.xScale === "log"
          ? 10 ** (Math.log10(this.xRange.min) + ratio * (Math.log10(this.xRange.max) - Math.log10(this.xRange.min)))
          : this.xRange.min + ratio * (this.xRange.max - this.xRange.min);
        context.textAlign = "center";
        context.fillText(formatValue(value, { unit: series[0]?.trace.xUnit ?? this.xUnit, reserveSign: false }), x, top + height + 16);
      }
    }

    for (let division = 0; division <= 8; division += 1) {
      const ratio = division / 8;
      const y = top + ratio * height;
      context.beginPath();
      context.moveTo(LEFT, Math.round(y) + 0.5);
      context.lineTo(width - RIGHT, Math.round(y) + 0.5);
      context.stroke();
      if (division % 2 === 0) {
        const value = yScale === "log"
          ? 10 ** (Math.log10(primaryRange.max) - ratio * (Math.log10(primaryRange.max) - Math.log10(primaryRange.min)))
          : primaryRange.max - ratio * (primaryRange.max - primaryRange.min);
        context.textAlign = "right";
        context.fillText(formatValue(value, { unit, reserveSign: false }), LEFT - 7, y);
      }
    }

    context.strokeStyle = "#6E7378";
    context.beginPath();
    context.moveTo(LEFT, Math.round(top + height / 2) + 0.5);
    context.lineTo(width - RIGHT, Math.round(top + height / 2) + 0.5);
    context.stroke();
    context.strokeRect(LEFT + 0.5, top + 0.5, plotWidth - 1, height - 1);
    context.fillStyle = "#F1EEE8";
    context.textAlign = "left";
    const title = this.layout === "overlay" ? "OVERLAY" : series[0]?.group ?? panelKey;
    context.fillText(title.toUpperCase(), LEFT + 7, top + 10);

    context.beginPath();
    context.rect(LEFT, top, plotWidth, height);
    context.clip();
    for (const annotation of annotations) this.drawAnnotation(annotation, primaryRange, yScale, top, height, plotWidth);
    for (const item of series) {
      const range = this.yRanges.get(item.panelKey) ?? (yScale === "log" ? paddedLogRange(item.values) : paddedRange(item.values));
      const points = this.isXY()
        ? orderedXYPoints(item.xValues, item.values, this.xRange.min, this.xRange.max)
        : decimateMinMax(item.xValues, item.values, this.xRange.min, this.xRange.max, Math.ceil(plotWidth), this.xScale === "log");
      context.beginPath();
      let started = false;
      for (const point of points) {
        const x = this.xToPixel(point.x, plotWidth);
        if (yScale === "log" && point.y <= 0) { started = false; continue; }
        const y = this.yToPixel(point.y, range, yScale, top, height);
        if (!started) { context.moveTo(x, y); started = true; }
        else context.lineTo(x, y);
      }
      context.strokeStyle = item.trace.color;
      context.lineWidth = 1.5;
      context.globalAlpha = item.trace.comparisonRole === "baseline" ? 0.68 : 0.95;
      context.setLineDash(item.trace.dash);
      context.stroke();
    }
    this.drawTrigger(top, height, plotWidth);
    context.setLineDash([]);
    context.globalAlpha = 1;
    context.restore();
  }

  private drawAnnotation(annotation: InternalAnnotation, range: AxisRange, scale: PlotScale, top: number, height: number, plotWidth: number): void {
    const context = this.context;
    context.beginPath();
    let started = false;
    let segments = 0;
    for (const point of annotation.points) {
      if (!point) {
        started = false;
        continue;
      }
      const x = annotation.style.xMode === "normalized"
        ? LEFT + point[0] * plotWidth
        : this.xToPixel(point[0], plotWidth);
      if (scale === "log" && point[1] <= 0) { started = false; continue; }
      const y = this.yToPixel(point[1], range, scale, top, height);
      if (!started) {
        context.moveTo(x, y);
        started = true;
      } else {
        context.lineTo(x, y);
        segments += 1;
      }
    }
    if (segments === 0) return;
    context.strokeStyle = annotation.style.color;
    context.lineWidth = annotation.style.lineWidth;
    context.globalAlpha = annotation.style.opacity;
    context.setLineDash([...annotation.style.dash]);
    context.stroke();
  }

  private drawCursors(width: number, height: number): void {
    const plotWidth = Math.max(1, width - LEFT - RIGHT);
    const context = this.context;
    const cursorData: Array<[CursorAnchor | null, string, string]> = [
      [this.cursorA, "A", "#F1EEE8"],
      [this.cursorB, "B", "#E8A244"],
    ];
    context.save();
    context.font = '600 10px "IBM Plex Mono", monospace';
    context.textAlign = "center";
    context.textBaseline = "top";
    for (const [anchor, label, color] of cursorData) {
      const snapshot = this.cursorSnapshot(anchor);
      if (!snapshot) continue;
      const x = this.xToPixel(snapshot.x, plotWidth);
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.setLineDash(label === "B" ? [4, 3] : []);
      if (this.isXY() && snapshot.traceId && snapshot.y !== undefined) {
        const series = this.getSeries().find((candidate) => candidate.trace.id === snapshot.traceId);
        const groups = this.panelGroups();
        const panel = series ? groups.indexOf(series.panelKey) : -1;
        if (series && panel >= 0) {
          const usableHeight = height - TOP - BOTTOM - (groups.length - 1) * PANEL_GAP;
          const panelHeight = Math.max(20, usableHeight / groups.length);
          const top = TOP + panel * (panelHeight + PANEL_GAP);
          const range = this.yRanges.get(series.panelKey) ?? paddedRange(series.values);
          const y = this.yToPixel(snapshot.y, range, this.scaleForPanel(series.panelKey), top, panelHeight);
          context.beginPath();
          context.moveTo(x - 6, y); context.lineTo(x + 6, y);
          context.moveTo(x, y - 6); context.lineTo(x, y + 6);
          context.stroke();
        }
      } else {
        context.beginPath();
        context.moveTo(Math.round(x) + 0.5, TOP);
        context.lineTo(Math.round(x) + 0.5, height - BOTTOM);
        context.stroke();
      }
      context.setLineDash([]);
      context.fillStyle = "#15181B";
      context.fillRect(x - 8, 2, 16, 14);
      context.strokeStyle = color;
      context.strokeRect(x - 7.5, 2.5, 15, 13);
      context.fillStyle = "#F1EEE8";
      context.fillText(label, x, 4);
    }
    context.restore();
  }

  private xToPixel(value: number, plotWidth: number): number {
    const transform = this.xScale === "log" ? (input: number) => Math.log10(input) : (input: number) => input;
    const min = transform(this.xRange.min);
    return LEFT + (transform(value) - min) / (transform(this.xRange.max) - min) * plotWidth;
  }

  private pixelToX(pixel: number): number {
    const plotWidth = Math.max(1, this.canvasWrap.clientWidth - LEFT - RIGHT);
    const ratio = Math.max(0, Math.min(1, (pixel - LEFT) / plotWidth));
    if (this.xScale === "log") {
      const min = Math.log10(this.xRange.min);
      return 10 ** (min + ratio * (Math.log10(this.xRange.max) - min));
    }
    return this.xRange.min + ratio * (this.xRange.max - this.xRange.min);
  }

  private yToPixel(value: number, range: AxisRange, scale: PlotScale, top: number, height: number): number {
    if (scale === "log") {
      const min = Math.log10(range.min);
      return top + (1 - (Math.log10(value) - min) / (Math.log10(range.max) - min)) * height;
    }
    return top + (1 - (value - range.min) / (range.max - range.min)) * height;
  }

  private cursorDomainValues(): Float64Array {
    if (this.xValues.length > 0) return this.xValues;
    const values = [...this.annotations.values()]
      .flatMap((annotation) => finiteAnnotationValues(annotation.points, 0))
      .sort((a, b) => a - b)
      .filter((value, index, all) => index === 0 || value !== all[index - 1]);
    return Float64Array.from(values);
  }

  private annotationValueAt(annotation: InternalAnnotation, cursorX: number): number {
    const target = annotation.style.xMode === "normalized"
      ? (cursorX - this.xRange.min) / (this.xRange.max - this.xRange.min)
      : cursorX;
    let nearest = Number.NaN;
    let distance = Infinity;
    for (const point of annotation.points) {
      if (!point) continue;
      const nextDistance = Math.abs(point[0] - target);
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = point[1];
      }
    }
    return nearest;
  }

  private cursorSnapshot(anchor: CursorAnchor | null): CursorSnapshot | null {
    if (!anchor) return null;
    const anchorSeries = anchor.traceId
      ? this.getSeries().find((series) => series.trace.id === anchor.traceId)
      : this.getSeries()[0];
    const domain = anchorSeries?.xValues ?? this.cursorDomainValues();
    if (anchor.index < 0 || anchor.index >= domain.length) return null;
    const x = domain[anchor.index] ?? Number.NaN;
    const values: Record<string, number> = {};
    for (const series of this.getSeries()) {
      if (this.isXY() && anchor.traceId && series.trace.id !== anchor.traceId) {
        values[series.id] = Number.NaN;
        continue;
      }
      const index = series === anchorSeries ? anchor.index : snapCursorIndex(series.xValues, x, this.xScale === "log");
      values[series.id] = series.values[index] ?? Number.NaN;
    }
    for (const annotation of this.annotations.values()) values[`annotation:${annotation.id}`] = this.annotationValueAt(annotation, x);
    const y = anchorSeries?.values[anchor.index];
    return {
      index: anchor.index,
      x,
      values,
      ...(anchor.traceId === undefined ? {} : { traceId: anchor.traceId }),
      ...(this.isXY() && y !== undefined ? { y } : {}),
    };
  }

  private anchorForPosition(position: CursorPosition): CursorAnchor | null {
    const series = position.traceId
      ? this.getSeries().find((candidate) => candidate.trace.id === position.traceId)
      : this.getSeries()[0];
    if (!series) {
      const domain = this.cursorDomainValues();
      return domain.length > 0 ? { index: snapCursorIndex(domain, position.x, this.xScale === "log") } : null;
    }
    if (series.xValues.length === 0) return null;
    if (this.isXY() && position.y !== undefined) {
      const xSpan = Math.max(Number.EPSILON, this.xRange.max - this.xRange.min);
      const yRange = this.yRanges.get(series.panelKey) ?? paddedRange(series.values);
      const ySpan = Math.max(Number.EPSILON, yRange.max - yRange.min);
      let nearest = 0;
      let distance = Infinity;
      for (let index = 0; index < series.xValues.length; index += 1) {
        const x = series.xValues[index] ?? Number.NaN;
        const y = series.values[index] ?? Number.NaN;
        const candidate = ((x - position.x) / xSpan) ** 2 + ((y - position.y) / ySpan) ** 2;
        if (candidate < distance) { distance = candidate; nearest = index; }
      }
      return { traceId: series.trace.id, index: nearest };
    }
    return { ...(this.isXY() ? { traceId: series.trace.id } : {}), index: snapCursorIndex(series.xValues, position.x, this.xScale === "log") };
  }

  private setCursorAtPixel(which: CursorName, pixelX: number, pixelY: number): void {
    let anchor: CursorAnchor | null = null;
    if (this.isXY()) {
      const plotWidth = Math.max(1, this.canvasWrap.clientWidth - LEFT - RIGHT);
      const groups = this.panelGroups();
      const usableHeight = this.canvasWrap.clientHeight - TOP - BOTTOM - (groups.length - 1) * PANEL_GAP;
      const panelHeight = Math.max(20, usableHeight / groups.length);
      let distance = Infinity;
      for (const series of this.getSeries()) {
        const panel = groups.indexOf(series.panelKey);
        if (panel < 0) continue;
        const top = TOP + panel * (panelHeight + PANEL_GAP);
        const range = this.yRanges.get(series.panelKey) ?? paddedRange(series.values);
        const scale = this.scaleForPanel(series.panelKey);
        for (let index = 0; index < series.xValues.length; index += 1) {
          const value = series.values[index] ?? Number.NaN;
          if (!Number.isFinite(value) || (scale === "log" && value <= 0)) continue;
          const dx = this.xToPixel(series.xValues[index] ?? 0, plotWidth) - pixelX;
          const dy = this.yToPixel(value, range, scale, top, panelHeight) - pixelY;
          const candidate = dx * dx + dy * dy;
          if (candidate < distance) { distance = candidate; anchor = { traceId: series.trace.id, index }; }
        }
      }
    } else {
      const series = this.getSeries()[0];
      const domain = series?.xValues ?? this.cursorDomainValues();
      const index = snapCursorIndex(domain, this.pixelToX(pixelX), this.xScale === "log");
      if (index >= 0) anchor = { index };
    }
    if (which === "a") this.cursorA = anchor;
    else this.cursorB = anchor;
    this.activeCursor = which;
    this.cursorChanged();
  }

  private setCursorAtDefault(which: CursorName): void {
    const existing = which === "a" ? this.cursorA : this.cursorB;
    if (existing) { this.activeCursor = which; this.cursorChanged(); return; }
    const series = this.getSeries()[0];
    const domain = series?.xValues ?? this.cursorDomainValues();
    if (domain.length === 0) return;
    const anchor: CursorAnchor = { index: Math.floor(domain.length / 2), ...(this.isXY() && series ? { traceId: series.trace.id } : {}) };
    if (which === "a") this.cursorA = anchor;
    else this.cursorB = anchor;
    this.activeCursor = which;
    this.cursorChanged();
  }

  private cursorChanged(): void {
    this.updateReadout();
    this.scheduleRender();
    const state = this.getCursorState();
    for (const listener of this.cursorListeners) listener(state);
    const active = this.activeCursor === "a" ? state.a : state.b;
    this.accessibleStatus.textContent = active
      ? `Cursor ${this.activeCursor.toUpperCase()} at ${formatValue(active.x, { unit: this.xUnit })}`
      : `Cursor ${this.activeCursor.toUpperCase()} cleared`;
  }

  private isXY(): boolean {
    return this.data?.kind === "xy" || this.data?.kind === "vi";
  }

  private drawTrigger(top: number, height: number, plotWidth: number): void {
    const time = this.triggerResult?.triggerTime;
    if (time === undefined || !Number.isFinite(time) || time < this.xRange.min || time > this.xRange.max || this.isXY()) return;
    const x = this.xToPixel(time, plotWidth);
    this.context.strokeStyle = "#E8A244";
    this.context.lineWidth = 1;
    this.context.globalAlpha = 0.9;
    this.context.setLineDash([2, 3]);
    this.context.beginPath();
    this.context.moveTo(x, top);
    this.context.lineTo(x, top + height);
    this.context.stroke();
  }

  private updateReadout(): void {
    const state = this.getCursorState();
    this.readout.replaceChildren();
    const add = (label: string, value: string, contract?: { cursor?: CursorName; traceId?: string; delta?: boolean }): void => {
      const span = document.createElement("span");
      span.className = "oc-waveform-viewer__measure";
      if (contract?.cursor) span.dataset.cursor = contract.cursor;
      if (contract?.traceId) span.dataset.traceId = contract.traceId;
      if (contract?.delta) span.dataset.cursorDelta = "true";
      span.textContent = `${label} ${value}`;
      this.readout.append(span);
    };
    add("Cursor A", state.a ? formatValue(state.a.x, { unit: this.xUnit }) : "off", { cursor: "a" });
    add("Cursor B", state.b ? formatValue(state.b.x, { unit: this.xUnit }) : "off", { cursor: "b" });
    add("Δ", state.deltaX === null ? "off" : formatValue(state.deltaX, { unit: this.xUnit }), { delta: true });
    if (state.reciprocalDeltaX !== null && this.xUnit === "s") add("1/Δ", formatValue(state.reciprocalDeltaX, { unit: "Hz" }), { delta: true });
    const measurements = [
      ...this.getSeries().map((series) => ({ id: series.id, label: series.key, unit: series.unit })),
      ...[...this.annotations.values()].map((annotation) => ({ id: `annotation:${annotation.id}`, label: annotation.label, unit: annotation.style.unit })),
    ];
    for (const cursor of [["A", state.a], ["B", state.b]] as const) {
      if (!cursor[1]) continue;
      for (const item of measurements) {
        add(`${cursor[0]}:${item.label}`, formatValue(cursor[1].values[item.id] ?? Number.NaN, { unit: item.unit }), {
          cursor: cursor[0].toLowerCase() as CursorName,
          traceId: item.id,
        });
      }
    }
    const hint = document.createElement("span");
    hint.className = "oc-waveform-viewer__hint";
    hint.textContent = "Click A  Shift-click B  A/B set  Shift+←/→ move  Delete clear";
    this.readout.append(hint);
    this.updateResultTable(state, measurements);
  }

  private updateResultTable(
    state: CursorState,
    measurements: readonly { id: string; label: string; unit: string }[],
  ): void {
    this.resultTable.replaceChildren();
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of ["Trace", "Unit", "Cursor A", "Cursor B", "B − A"]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const item of measurements) {
      const row = document.createElement("tr");
      row.dataset.traceId = item.id;
      const a = state.a?.values[item.id];
      const b = state.b?.values[item.id];
      const delta = a !== undefined && b !== undefined ? b - a : undefined;
      const values = [
        item.label,
        item.unit || "—",
        a === undefined ? "—" : formatValue(a, { unit: item.unit }),
        b === undefined ? "—" : formatValue(b, { unit: item.unit }),
        delta === undefined ? "—" : formatValue(delta, { unit: item.unit }),
      ];
      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
    this.resultTable.append(head, body);
  }

  private bindInteractions(): void {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.canvasWrap.focus();
      this.canvas.setPointerCapture(event.pointerId);
      this.drag = { x: event.offsetX, y: event.offsetY, moved: false };
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.drag) return;
      const dx = event.offsetX - this.drag.x;
      const dy = event.offsetY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
      if (this.drag.moved) {
        this.panX(-dx / Math.max(1, this.canvasWrap.clientWidth - LEFT - RIGHT));
        this.panY(dy / Math.max(1, this.canvasWrap.clientHeight - TOP - BOTTOM));
        this.drag.x = event.offsetX;
        this.drag.y = event.offsetY;
      }
    });
    this.canvas.addEventListener("pointerup", (event) => {
      const drag = this.drag;
      this.drag = null;
      if (drag && !drag.moved) this.setCursorAtPixel(event.shiftKey ? "b" : "a", event.offsetX, event.offsetY);
    });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      if (event.shiftKey) this.panX(event.deltaY * 0.001);
      else {
        const factor = Math.exp(event.deltaY * 0.001);
        if (!event.altKey) this.zoomX(factor, event.offsetX);
        if (!event.ctrlKey) this.zoomY(factor);
      }
    }, { passive: false });
    this.canvasWrap.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === "a" && !event.metaKey && !event.ctrlKey && !event.altKey) this.setCursorAtDefault("a");
      else if (key === "b" && !event.metaKey && !event.ctrlKey && !event.altKey) this.setCursorAtDefault("b");
      else if ((event.key === "Delete" || event.key === "Backspace" || event.key === "Escape") && !event.metaKey && !event.ctrlKey) this.clearCursor(this.activeCursor);
      else if (event.shiftKey && event.key === "ArrowLeft") this.moveCursor(this.activeCursor, event.metaKey || event.ctrlKey ? -10 : -1);
      else if (event.shiftKey && event.key === "ArrowRight") this.moveCursor(this.activeCursor, event.metaKey || event.ctrlKey ? 10 : 1);
      else if (event.key === "ArrowLeft") this.panX(-0.05);
      else if (event.key === "ArrowRight") this.panX(0.05);
      else if (event.key === "ArrowUp") this.panY(-0.05);
      else if (event.key === "ArrowDown") this.panY(0.05);
      else if (event.key === "+" || event.key === "=") { this.zoomX(0.8, this.canvasWrap.clientWidth / 2); this.zoomY(0.8); }
      else if (event.key === "-") { this.zoomX(1.25, this.canvasWrap.clientWidth / 2); this.zoomY(1.25); }
      else if (event.key === "0") { this.resetXRange(); this.autoscale(); }
      else return;
      event.preventDefault();
    });
  }

  private panX(fraction: number): void {
    if (this.xScale === "log") {
      const min = Math.log10(this.xRange.min);
      const max = Math.log10(this.xRange.max);
      const delta = (max - min) * fraction;
      this.xRange = { min: 10 ** (min + delta), max: 10 ** (max + delta) };
    } else {
      const delta = (this.xRange.max - this.xRange.min) * fraction;
      this.xRange = { min: this.xRange.min + delta, max: this.xRange.max + delta };
    }
    this.scheduleRender();
  }

  private panY(fraction: number): void {
    for (const [group, range] of this.yRanges) {
      if (this.scaleForPanel(group) === "log" && range.min > 0) {
        const min = Math.log10(range.min);
        const max = Math.log10(range.max);
        const delta = (max - min) * fraction;
        this.yRanges.set(group, { min: 10 ** (min + delta), max: 10 ** (max + delta) });
      } else {
        const delta = (range.max - range.min) * fraction;
        this.yRanges.set(group, { min: range.min + delta, max: range.max + delta });
      }
    }
    this.scheduleRender();
  }

  private zoomX(factor: number, pixelX: number): void {
    const anchor = this.pixelToX(pixelX);
    if (this.xScale === "log") {
      const a = Math.log10(anchor);
      const min = a + (Math.log10(this.xRange.min) - a) * factor;
      const max = a + (Math.log10(this.xRange.max) - a) * factor;
      this.xRange = { min: 10 ** min, max: 10 ** max };
    } else {
      this.xRange = {
        min: anchor + (this.xRange.min - anchor) * factor,
        max: anchor + (this.xRange.max - anchor) * factor,
      };
    }
    this.scheduleRender();
  }

  private zoomY(factor: number): void {
    for (const [group, range] of this.yRanges) {
      if (this.scaleForPanel(group) === "log" && range.min > 0) {
        const middle = (Math.log10(range.min) + Math.log10(range.max)) / 2;
        const half = (Math.log10(range.max) - Math.log10(range.min)) * factor / 2;
        this.yRanges.set(group, { min: 10 ** (middle - half), max: 10 ** (middle + half) });
      } else {
        const middle = (range.min + range.max) / 2;
        const half = (range.max - range.min) * factor / 2;
        this.yRanges.set(group, { min: middle - half, max: middle + half });
      }
    }
    this.scheduleRender();
  }

  private updateTriggerStatus(): void {
    if (!this.triggerResult) {
      this.triggerStatus.dataset.triggerState = "off";
      this.triggerStatus.textContent = "Trigger off";
      return;
    }
    this.triggerStatus.dataset.triggerState = this.triggerResult.state;
    const time = this.triggerResult.triggerTime;
    const detail = time === undefined ? "" : ` at ${formatValue(time, { unit: this.xUnit })}`;
    const diagnostic = this.triggerResult.diagnostics[0]?.message;
    this.triggerStatus.textContent = `Trigger ${this.triggerResult.state}${detail}${diagnostic ? ` — ${diagnostic}` : ""}`;
  }

  private refreshDiagnostics(): void {
    const next: ViewerDiagnostic[] = [];
    const visible = this.getSeries();
    if (this.layout === "overlay") {
      const contracts = new Set(visible.map((series) => `${series.unit}\u0000${series.trace.yScale}`));
      if (contracts.size > 1) {
        next.push({
          code: "INCOMPATIBLE_OVERLAY",
          message: "Overlay traces must use compatible units and axis scales. Use split or stack layout.",
          traceIds: [...new Set(visible.map((series) => series.trace.id))],
        });
      }
    }
    for (const trace of this.traces) {
      if (!this.vectors.has(trace.xSource)) {
        next.push({ code: "MISSING_TRACE_X", message: `Trace ${trace.label} is missing X vector ${trace.xSource}.`, traceIds: [trace.id] });
      }
    }
    for (const series of visible) {
      if (this.scaleForPanel(series.panelKey) === "log" && series.values.some((value) => Number.isFinite(value) && value <= 0)) {
        next.push({ code: "NON_POSITIVE_LOG_Y", message: `Trace ${series.key} contains non-positive samples that cannot be shown on a logarithmic Y axis.`, traceIds: [series.trace.id] });
      }
    }
    if (this.triggerResult?.diagnostics.length) {
      next.push({ code: "INVALID_TRIGGER", message: this.triggerResult.diagnostics.map((diagnostic) => diagnostic.message).join(" ") });
    }
    const changed = JSON.stringify(next) !== JSON.stringify(this.diagnostics);
    this.diagnostics = next;
    this.root.dataset.diagnosticCount = String(next.length);
    if (changed) for (const listener of this.diagnosticListeners) listener(this.diagnostics);
  }
}

export function mount(element: HTMLElement, options: ViewerOptions = {}): WaveformViewer {
  return new CanvasWaveformViewer(element, options);
}
