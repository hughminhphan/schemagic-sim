import type { AnalysisMode, GeneratedNetlist, SimulationResult } from "@opencircuit/sim-engine";
import { formatEngineering } from "./format";

interface ScopePoint {
  x: number;
  y: number;
}

export interface HoldPoint {
  t: number;
  collector: number;
}

export class ScopePlot {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly cursor: HTMLElement;
  private points: ScopePoint[] = [];
  private xUnit = "s";
  private yUnit = "V";
  private xLabel = "Time";
  private yLabel = "Collector";

  constructor(canvas: HTMLCanvasElement, cursor: HTMLElement) {
    this.canvas = canvas;
    this.cursor = cursor;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Scope canvas is unavailable");
    this.context = context;
    this.canvas.addEventListener("pointermove", (event) => this.onPointer(event));
    this.canvas.addEventListener("pointerleave", () => this.draw());
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  setData(mode: AnalysisMode, result: SimulationResult | undefined, generated: GeneratedNetlist, hold: HoldPoint[] = [], componentId = "c4"): void {
    const collectorNode = generated.componentNodes[componentId]?.[0] ?? Object.values(generated.componentNodes).flat().find((node) => node !== "0");
    if ((mode === "live" || mode === "op") && hold.length > 1) {
      this.points = hold.map((point) => ({ x: point.t, y: point.collector }));
      this.xUnit = "";
      this.yUnit = "V";
      this.xLabel = "Wiper";
      this.yLabel = "Collector";
    } else if (mode === "tran" && result && collectorNode) {
      const times = result.data.get("time");
      const values = result.data.get(`v(${collectorNode})`);
      this.points = times && values ? Array.from({ length: Math.min(times.length, values.length) }, (_, index) => ({ x: times[index] ?? 0, y: values[index] ?? 0 })) : [];
      this.xUnit = "s";
      this.yUnit = "V";
      this.xLabel = "Time";
      this.yLabel = "Collector";
    } else if (mode === "ac" && result && collectorNode) {
      const frequencies = result.data.get("frequency");
      const values = result.data.get(`v(${collectorNode})`);
      const count = Math.min((frequencies?.length ?? 0) / 2, (values?.length ?? 0) / 2);
      this.points = Array.from({ length: count }, (_, index) => {
        const frequency = frequencies?.[index * 2] ?? 1;
        const real = values?.[index * 2] ?? 0;
        const imaginary = values?.[index * 2 + 1] ?? 0;
        return { x: Math.log10(Math.max(frequency, 1e-12)), y: 20 * Math.log10(Math.max(Math.hypot(real, imaginary), 1e-15)) };
      });
      this.xUnit = "Hz";
      this.yUnit = "dB";
      this.xLabel = "Frequency";
      this.yLabel = "Collector gain";
    } else {
      this.points = [];
    }
    this.draw();
  }

  private bounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    if (this.points.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 5 };
    const xs = this.points.map((point) => point.x);
    const ys = this.points.map((point) => point.y);
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    if (minX === maxX) maxX = minX + 1;
    if (minY === maxY) { minY -= 1; maxY += 1; }
    const yPad = (maxY - minY) * 0.08;
    return { minX, maxX, minY: minY - yPad, maxY: maxY + yPad };
  }

  private prepare(): { width: number; height: number; dpr: number } {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, dpr };
  }

  private draw(cursorX?: number): void {
    const { width, height } = this.prepare();
    const context = this.context;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#15181B";
    context.fillRect(0, 0, width, height);
    const left = 42;
    const right = width - 12;
    const top = 12;
    const bottom = height - 24;
    context.strokeStyle = "#2A2F34";
    context.lineWidth = 1;
    for (let index = 0; index <= 5; index += 1) {
      const x = left + (right - left) * index / 5;
      const y = top + (bottom - top) * index / 5;
      context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom); context.stroke();
      context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
    }
    const bounds = this.bounds();
    const sx = (x: number) => left + (x - bounds.minX) / (bounds.maxX - bounds.minX) * (right - left);
    const sy = (y: number) => bottom - (y - bounds.minY) / (bounds.maxY - bounds.minY) * (bottom - top);
    if (this.points.length > 1) {
      context.strokeStyle = "#3FD983";
      context.lineWidth = 2;
      context.beginPath();
      this.points.forEach((point, index) => {
        const x = sx(point.x); const y = sy(point.y);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    }
    context.fillStyle = "#A9AEB3";
    context.font = '10px "IBM Plex Mono"';
    context.textAlign = "left";
    context.fillText(this.yLabel, 5, 11);
    context.fillText(this.xLabel, Math.max(left, right - context.measureText(this.xLabel).width), height - 6);
    const minY = formatEngineering(bounds.minY, this.yUnit);
    const maxY = formatEngineering(bounds.maxY, this.yUnit);
    context.fillText(`${maxY.value}${maxY.unit}`, 5, top + 10);
    context.fillText(`${minY.value}${minY.unit}`, 5, bottom);
    if (cursorX !== undefined && this.points.length > 0) {
      context.strokeStyle = "#D9D6CF";
      context.beginPath(); context.moveTo(cursorX, top); context.lineTo(cursorX, bottom); context.stroke();
    }
  }

  private onPointer(event: PointerEvent): void {
    if (this.points.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const plotX = Math.max(42, Math.min(rect.width - 12, localX));
    const normalized = (plotX - 42) / Math.max(1, rect.width - 54);
    const index = Math.max(0, Math.min(this.points.length - 1, Math.round(normalized * (this.points.length - 1))));
    const point = this.points[index]!;
    const displayX = this.xLabel === "Frequency" ? 10 ** point.x : point.x;
    const x = formatEngineering(displayX, this.xUnit);
    const y = formatEngineering(point.y, this.yUnit);
    this.cursor.textContent = `Cursor A  ${x.value} ${x.unit}   ${y.value} ${y.unit}`;
    this.draw(plotX);
  }
}
