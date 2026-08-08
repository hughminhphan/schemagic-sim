import { complexToBode, type BodeData } from "./ac";
import { columnsToCSV, type CSVColumn } from "./csv";
import { snapCursorIndex } from "./cursor";
import { decimateMinMax } from "./decimate";
import { formatValue } from "./format";
import type {
  AnnotationPoint,
  AnnotationStyle,
  AxisRange,
  CursorSnapshot,
  CursorState,
  TraceDefinition,
  VectorCollection,
  ViewerOptions,
  WaveformAnnotation,
  WaveformData,
  WaveformViewer,
} from "./types";

const DEFAULT_COLORS = ["#3FD983", "#E8A244", "#5FB0E8", "#F1EEE8", "#3FD983", "#E8A244"];
const DEFAULT_DASHES: ReadonlyArray<readonly number[]> = [[], [], [], [], [6, 3], [2, 3]];
const LEFT = 66;
const RIGHT = 18;
const TOP = 20;
const BOTTOM = 26;
const PANEL_GAP = 28;

interface InternalTrace extends Required<Pick<TraceDefinition, "source" | "label" | "unit" | "axisGroup" | "visible">> {
  color: string;
  dash: number[];
}

interface InternalAnnotation {
  id: string;
  label: string;
  points: Array<AnnotationPoint | null>;
  style: Required<AnnotationStyle>;
}

interface PlotSeries {
  key: string;
  trace: InternalTrace;
  values: Float64Array;
  group: string;
  panel: number;
  unit: string;
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
  private readonly resizeObserver: ResizeObserver;
  private readonly cursorListeners = new Set<(state: CursorState) => void>();
  private readonly visibilityListeners = new Set<(source: string, visible: boolean) => void>();
  private readonly options: ViewerOptions;
  private vectors = new Map<string, Float64Array>();
  private traces: InternalTrace[] = [];
  private readonly annotations = new Map<string, InternalAnnotation>();
  private data: WaveformData | null = null;
  private xValues: Float64Array = new Float64Array();
  private xName = "x";
  private xUnit = "";
  private xScale: "linear" | "log";
  private xRange: AxisRange = { min: 0, max: 1 };
  private readonly yRanges = new Map<string, AxisRange>();
  private readonly manualYRanges = new Set<string>();
  private readonly bodeCache = new Map<string, BodeData>();
  private cursorA = -1;
  private cursorB = -1;
  private renderPending = false;
  private drag: { x: number; y: number; moved: boolean } | null = null;

  constructor(element: HTMLElement, options: ViewerOptions = {}) {
    this.options = options;
    this.xScale = options.xScale ?? "linear";
    this.root = document.createElement("div");
    this.root.className = `oc-waveform-viewer${options.className ? ` ${options.className}` : ""}`;

    const toolbar = document.createElement("div");
    toolbar.className = "oc-waveform-viewer__toolbar";
    this.legend = document.createElement("div");
    this.legend.className = "oc-waveform-viewer__legend";
    toolbar.append(this.legend);

    const csvButton = this.makeAction("CSV", () => this.downloadCSV());
    const pngButton = this.makeAction("PNG", () => this.downloadPNG());
    toolbar.append(csvButton, pngButton);

    this.canvasWrap = document.createElement("div");
    this.canvasWrap.className = "oc-waveform-viewer__canvas-wrap";
    this.canvasWrap.tabIndex = 0;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "oc-waveform-viewer__canvas";
    this.canvas.setAttribute("aria-label", "Waveform plot. Click for Cursor A, Shift-click for Cursor B.");
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    this.context = context;
    this.canvasWrap.append(this.canvas);

    this.readout = document.createElement("div");
    this.readout.className = "oc-waveform-viewer__readout";
    this.root.append(toolbar, this.canvasWrap, this.readout);
    if (options.showControls === false) toolbar.hidden = true;
    element.replaceChildren(this.root);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvasWrap);
    this.bindInteractions();
    this.renderLegend();
    this.updateReadout();
    this.resize();
  }

  setData(data: WaveformData, setOptions: { preserveView?: boolean } = {}): void {
    this.data = data;
    this.vectors = toMap(data.vectors);
    this.xName = this.findXName(data.kind);
    this.xValues = this.vectors.get(this.xName) ?? new Float64Array();
    this.xUnit = this.options.xUnit ?? (data.kind === "tran" ? "s" : data.kind === "ac" || data.kind === "noise" ? "Hz" : inferUnit(this.xName, data.kind));
    if (data.kind === "ac" || data.kind === "noise") this.xScale = "log";
    this.validateVectorLengths();
    this.buildTraces();
    if (!setOptions.preserveView) {
      this.resetXRange();
      this.autoscale();
      for (const [group, range] of Object.entries(this.options.yRanges ?? {})) {
        this.manualYRanges.add(group);
        this.yRanges.set(group, { ...range });
      }
      this.cursorA = -1;
      this.cursorB = -1;
    }
    this.renderLegend();
    this.updateReadout();
    this.scheduleRender();
  }

  setTraceVisible(source: string, visible: boolean): void {
    const trace = this.traces.find((candidate) => candidate.source === source);
    if (!trace || trace.visible === visible) return;
    trace.visible = visible;
    this.renderLegend();
    this.computeAutoscale(true);
    for (const listener of this.visibilityListeners) listener(source, visible);
  }

  addAnnotation(annotation: WaveformAnnotation): void {
    this.annotations.set(annotation.id, normalizedAnnotation(annotation));
    if (this.xValues.length === 0) {
      this.cursorA = -1;
      this.cursorB = -1;
      this.resetXRange();
    }
    this.renderLegend();
    this.computeAutoscale(true);
    this.updateReadout();
  }

  removeAnnotation(id: string): void {
    if (!this.annotations.delete(id)) return;
    if (this.xValues.length === 0) {
      this.cursorA = -1;
      this.cursorB = -1;
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
      this.cursorA = -1;
      this.cursorB = -1;
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

  setXScale(scale: "linear" | "log"): void {
    if ((this.data?.kind === "ac" || this.data?.kind === "noise") && scale !== "log") throw new Error("Frequency plots require logarithmic frequency");
    if (scale === "log" && this.xValues.some((value) => value <= 0)) throw new Error("Logarithmic X requires positive values");
    this.xScale = scale;
    this.resetXRange();
    this.scheduleRender();
  }

  autoscale(): void {
    this.manualYRanges.clear();
    this.computeAutoscale(false);
  }

  private computeAutoscale(preserveManual: boolean): void {
    const next = new Map<string, AxisRange>();
    for (const series of this.getSeries()) next.set(series.group, unionRange(next.get(series.group), paddedRange(series.values)));
    for (const annotation of this.annotations.values()) {
      const values = finiteAnnotationValues(annotation.points, 1);
      if (values.length === 0) continue;
      const group = this.annotationGroup(annotation);
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

  onCursorChange(listener: (state: CursorState) => void): () => void {
    this.cursorListeners.add(listener);
    return () => this.cursorListeners.delete(listener);
  }

  onTraceVisibilityChange(listener: (source: string, visible: boolean) => void): () => void {
    this.visibilityListeners.add(listener);
    return () => this.visibilityListeners.delete(listener);
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.cursorListeners.clear();
    this.visibilityListeners.clear();
    this.annotations.clear();
    this.root.remove();
  }

  private makeAction(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "oc-waveform-viewer__action";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  }

  private findXName(kind: WaveformData["kind"]): string {
    if (this.options.xVector && this.vectors.has(this.options.xVector)) return this.options.xVector;
    const candidates = kind === "tran" ? ["time"] : kind === "ac" || kind === "noise" ? ["frequency", "freq"] : ["sweep", "x"];
    for (const candidate of candidates) if (this.vectors.has(candidate)) return candidate;
    return this.vectors.keys().next().value ?? "x";
  }

  private validateVectorLengths(): void {
    for (const [name, values] of this.vectors) {
      if (name === this.xName) continue;
      const expected = this.data?.kind === "ac" ? this.xValues.length * 2 : this.xValues.length;
      if (values.length !== expected) {
        throw new Error(`${name} has ${values.length} values, expected ${expected}`);
      }
    }
  }

  private buildTraces(): void {
    const configured = this.options.traces;
    const sources = (configured?.map((trace) => trace.source)
      ?? [...this.vectors.keys()].filter((name) => name !== this.xName))
      .filter((source) => this.vectors.has(source));
    const colors = this.options.colors?.length ? this.options.colors : DEFAULT_COLORS;
    const uncoloredCount = sources.filter((source) => !configured?.find((trace) => trace.source === source)?.color).length;
    if (uncoloredCount > colors.length) throw new Error(`Trace token list needs at least ${uncoloredCount} colours`);
    this.bodeCache.clear();
    let colorIndex = 0;
    this.traces = sources.map((source, sourceIndex) => {
      const definition = configured?.find((trace) => trace.source === source);
      const unit = definition?.unit ?? inferUnit(source, this.data?.kind ?? "tran");
      const color = definition?.color ?? colors[colorIndex++] ?? "#3FD983";
      return {
        source,
        label: definition?.label ?? source,
        unit,
        color,
        dash: resolveTraceDash(sourceIndex, definition?.dash, this.options.dashes),
        axisGroup: definition?.axisGroup ?? (unit || "value"),
        visible: definition?.visible ?? true,
      };
    }).filter((trace) => this.vectors.has(trace.source));
    if (this.data?.kind === "ac") {
      for (const trace of this.traces) {
        const values = this.vectors.get(trace.source);
        if (values) this.bodeCache.set(trace.source, complexToBode(values, this.options.unwrapPhase ?? false));
      }
    }
  }

  private getSeries(): PlotSeries[] {
    if (!this.data) return [];
    const series: PlotSeries[] = [];
    const groups = [...new Set(this.traces.filter((trace) => trace.visible).map((trace) => trace.axisGroup))];
    for (const trace of this.traces) {
      if (!trace.visible) continue;
      const values = this.vectors.get(trace.source);
      if (!values) continue;
      if (this.data.kind === "ac") {
        const bode = this.bodeCache.get(trace.source);
        if (!bode) continue;
        series.push(
          { key: `${trace.label} magnitude`, trace, values: bode.magnitudeDb, group: "magnitude", panel: 0, unit: "dB" },
          { key: `${trace.label} phase`, trace, values: bode.phaseDeg, group: "phase", panel: 1, unit: "°" },
        );
      } else {
        series.push({ key: trace.label, trace, values, group: trace.axisGroup, panel: groups.indexOf(trace.axisGroup), unit: trace.unit });
      }
    }
    return series;
  }

  private annotationGroup(annotation: InternalAnnotation): string {
    return annotation.style.axisGroup || this.getSeries()[0]?.group || "amplitude";
  }

  private panelGroups(): string[] {
    const groups = this.data?.kind === "ac"
      ? ["magnitude", "phase"]
      : [...new Set(this.getSeries().map((series) => series.group))];
    for (const annotation of this.annotations.values()) {
      const group = this.annotationGroup(annotation);
      if (!groups.includes(group)) groups.push(group);
    }
    return groups.length > 0 ? groups : ["amplitude"];
  }

  private resetXRange(): void {
    let min = Infinity;
    let max = -Infinity;
    for (const value of this.xValues) {
      if (!Number.isFinite(value) || (this.xScale === "log" && value <= 0)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
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

  private renderLegend(): void {
    this.legend.replaceChildren();
    for (const trace of this.traces) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "oc-waveform-viewer__trace";
      button.setAttribute("aria-pressed", String(trace.visible));
      button.addEventListener("click", () => this.setTraceVisible(trace.source, !trace.visible));
      button.append(this.makeSwatch(trace.color, trace.dash), this.makeLegendLabel(trace.label));
      this.legend.append(button);
    }
    for (const annotation of this.annotations.values()) {
      const item = document.createElement("span");
      item.className = "oc-waveform-viewer__trace oc-waveform-viewer__annotation";
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
      this.drawPanel(panel, groups[panel]!, top, panelHeight, width, panel === panels - 1);
    }
    this.drawCursors(width, height);
  }

  private drawPanel(panel: number, group: string, top: number, height: number, width: number, isLastPanel: boolean): void {
    const context = this.context;
    const plotWidth = Math.max(1, width - LEFT - RIGHT);
    const series = this.getSeries().filter((candidate) => candidate.group === group || candidate.panel === panel && this.data?.kind === "ac");
    const annotations = [...this.annotations.values()].filter((annotation) => this.annotationGroup(annotation) === group);
    const primaryRange = this.yRanges.get(group) ?? { min: -1, max: 1 };
    const unit = this.data?.kind === "ac" && group === "magnitude"
      ? "dB"
      : this.data?.kind === "ac" && group === "phase"
        ? "°"
        : series[0]?.unit ?? annotations[0]?.style.unit ?? "";

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
        context.fillText(formatValue(value, { unit: this.xUnit, reserveSign: false }), x, top + height + 16);
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
        const value = primaryRange.max - ratio * (primaryRange.max - primaryRange.min);
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
    context.fillText(group.toUpperCase(), LEFT + 7, top + 10);

    context.beginPath();
    context.rect(LEFT, top, plotWidth, height);
    context.clip();
    for (const annotation of annotations) this.drawAnnotation(annotation, primaryRange, top, height, plotWidth);
    for (const item of series) {
      const range = this.yRanges.get(item.group) ?? paddedRange(item.values);
      const points = decimateMinMax(this.xValues, item.values, this.xRange.min, this.xRange.max, Math.ceil(plotWidth), this.xScale === "log");
      context.beginPath();
      let started = false;
      for (const point of points) {
        const x = this.xToPixel(point.x, plotWidth);
        const y = this.yToPixel(point.y, range, top, height);
        if (!started) { context.moveTo(x, y); started = true; }
        else context.lineTo(x, y);
      }
      context.strokeStyle = item.trace.color;
      context.lineWidth = 1.5;
      context.globalAlpha = 0.95;
      context.setLineDash(item.trace.dash);
      context.stroke();
    }
    context.setLineDash([]);
    context.globalAlpha = 1;
    context.restore();
  }

  private drawAnnotation(annotation: InternalAnnotation, range: AxisRange, top: number, height: number, plotWidth: number): void {
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
      const y = this.yToPixel(point[1], range, top, height);
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
    const cursorData: Array<[number, string, string]> = [
      [this.cursorA, "A", "#F1EEE8"],
      [this.cursorB, "B", "#E8A244"],
    ];
    context.save();
    context.font = '600 10px "IBM Plex Mono", monospace';
    context.textAlign = "center";
    context.textBaseline = "top";
    const domain = this.cursorDomainValues();
    for (const [index, label, color] of cursorData) {
      if (index < 0 || index >= domain.length) continue;
      const x = this.xToPixel(domain[index] ?? 0, plotWidth);
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.setLineDash(label === "B" ? [4, 3] : []);
      context.beginPath();
      context.moveTo(Math.round(x) + 0.5, TOP);
      context.lineTo(Math.round(x) + 0.5, height - BOTTOM);
      context.stroke();
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

  private yToPixel(value: number, range: AxisRange, top: number, height: number): number {
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

  private cursorSnapshot(index: number): CursorSnapshot | null {
    const domain = this.cursorDomainValues();
    if (index < 0 || index >= domain.length) return null;
    const x = domain[index] ?? Number.NaN;
    const values: Record<string, number> = {};
    if (this.xValues.length > 0) {
      for (const series of this.getSeries()) values[series.key] = series.values[index] ?? Number.NaN;
    }
    for (const annotation of this.annotations.values()) values[annotation.label] = this.annotationValueAt(annotation, x);
    return { index, x, values };
  }

  private setCursor(which: "a" | "b", pixelX: number): void {
    const domain = this.cursorDomainValues();
    const index = snapCursorIndex(domain, this.pixelToX(pixelX), this.xScale === "log");
    if (which === "a") this.cursorA = index;
    else this.cursorB = index;
    this.updateReadout();
    this.scheduleRender();
    const state = this.getCursorState();
    for (const listener of this.cursorListeners) listener(state);
  }

  private updateReadout(): void {
    const state = this.getCursorState();
    this.readout.replaceChildren();
    const add = (label: string, value: string): void => {
      const span = document.createElement("span");
      span.className = "oc-waveform-viewer__measure";
      span.textContent = `${label} ${value}`;
      this.readout.append(span);
    };
    add("Cursor A", state.a ? formatValue(state.a.x, { unit: this.xUnit }) : "off");
    add("Cursor B", state.b ? formatValue(state.b.x, { unit: this.xUnit }) : "off");
    add("Δ", state.deltaX === null ? "off" : formatValue(state.deltaX, { unit: this.xUnit }));
    if (state.reciprocalDeltaX !== null && this.xUnit === "s") add("1/Δ", formatValue(state.reciprocalDeltaX, { unit: "Hz" }));
    const measurements = [
      ...this.getSeries().map((series) => ({ key: series.key, unit: series.unit })),
      ...[...this.annotations.values()].map((annotation) => ({ key: annotation.label, unit: annotation.style.unit })),
    ];
    for (const cursor of [["A", state.a], ["B", state.b]] as const) {
      if (!cursor[1]) continue;
      for (const item of measurements) {
        add(`${cursor[0]}:${item.key}`, formatValue(cursor[1].values[item.key] ?? Number.NaN, { unit: item.unit }));
      }
    }
    const hint = document.createElement("span");
    hint.className = "oc-waveform-viewer__hint";
    hint.textContent = "Click A  Shift-click B  Wheel zoom  Drag pan";
    this.readout.append(hint);
  }

  private bindInteractions(): void {
    this.canvas.addEventListener("pointerdown", (event) => {
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
      if (drag && !drag.moved) this.setCursor(event.shiftKey ? "b" : "a", event.offsetX);
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
      if (event.key === "ArrowLeft") this.panX(-0.05);
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
      const delta = (range.max - range.min) * fraction;
      this.yRanges.set(group, { min: range.min + delta, max: range.max + delta });
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
      const middle = (range.min + range.max) / 2;
      const half = (range.max - range.min) * factor / 2;
      this.yRanges.set(group, { min: middle - half, max: middle + half });
    }
    this.scheduleRender();
  }
}

export function mount(element: HTMLElement, options: ViewerOptions = {}): WaveformViewer {
  return new CanvasWaveformViewer(element, options);
}
