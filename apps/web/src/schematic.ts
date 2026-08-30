import type { SchematicEditor } from "@opencircuit/schematic-editor";

export interface LiveWireFlow {
  id: string;
  voltage: number;
  current: number;
}

export const currentVector = (alias: string): string => alias.startsWith("@")
  ? `i(${alias})`
  : alias.endsWith("#branch")
    ? `i(${alias.slice(0, -7)})`
    : alias;

export function voltageColor(voltage: number, vref: number, chromaScale = 1): string {
  if (Math.abs(voltage) < 0.05) return "#6E7378";
  const t = Math.max(-1, Math.min(1, voltage / Math.max(vref, 1e-12)));
  const chroma = (t < 0 ? 0.152 : 0.140) * Math.abs(t) ** 1.25 * chromaScale;
  return `oklch(62% ${chroma.toFixed(5)} ${t < 0 ? 245 : 62})`;
}

export function pulseColor(voltage: number, vref: number, surface: "vellum" | "graphite" = "vellum"): string {
  const lightness = surface === "vellum" ? 0.44 : 0.80;
  if (Math.abs(voltage) < 0.05) return surface === "vellum" ? "#4A4E52" : "#A9AEB3";
  const t = Math.max(-1, Math.min(1, voltage / Math.max(vref, 1e-12)));
  const cap = surface === "vellum" ? (t < 0 ? 0.1109 : 0.1014) : (t < 0 ? 0.1083 : 0.1400);
  const chroma = Math.min(cap, (t < 0 ? 0.152 : 0.140) * Math.abs(t) ** 1.25);
  return `oklch(${lightness} ${chroma.toFixed(5)} ${t < 0 ? 245 : 62})`;
}

function percentile90(values: number[]): number {
  const active = values.filter((value) => value >= 1e-6).sort((a, b) => a - b);
  if (active.length === 0) return 0.01;
  return active[Math.min(active.length - 1, Math.floor(active.length * 0.9))] ?? 0.01;
}

function snap125(value: number): number {
  const exponent = Math.floor(Math.log10(value));
  const scaled = value / 10 ** exponent;
  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10) * 10 ** exponent;
}

function flow(current: number, iref: number): { speed: number; spacing: number; alpha: number } | undefined {
  const magnitude = Math.abs(current);
  if (magnitude < 1e-6) return undefined;
  const denominator = Math.log10(Math.max(iref, 1.0001e-6) / 1e-6);
  const u = Math.max(0, Math.min(1, Math.log10(magnitude / 1e-6) / denominator));
  return { speed: Math.min(110, 12 + 96 * u), spacing: 34 - 16 * u, alpha: 0.25 + 0.45 * u };
}

export class PulseRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private wires: LiveWireFlow[] = [];
  private vref = 5;
  private iref = 0.01;
  private animationFrame = 0;
  private startedAt = performance.now();
  private slowFrames = 0;
  private fallback = false;
  private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(private readonly editor: SchematicEditor, private readonly onFallback?: (reason: string | undefined) => void) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "pulse-layer";
    this.canvas.setAttribute("aria-hidden", "true");
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Pulse canvas is unavailable");
    this.context = context;
    editor.element.insertAdjacentElement("afterend", this.canvas);
    this.animate = this.animate.bind(this);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  update(wires: LiveWireFlow[], vref: number): void {
    this.wires = wires;
    this.vref = vref;
    this.iref = snap125(percentile90(wires.map((wire) => Math.abs(wire.current))));
    if (wires.filter((wire) => Math.abs(wire.current) >= 1e-6).length > 240) this.setFallback("Static current encoding · branch cap");
    else if (this.fallback && this.slowFrames < 30) this.setFallback(undefined);
  }

  clear(): void {
    this.wires = [];
    this.vref = 1;
    this.iref = 0.01;
    this.setFallback(undefined);
    this.prepareCanvas();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.canvas.remove();
  }

  private setFallback(reason: string | undefined): void {
    const next = Boolean(reason);
    if (next === this.fallback) return;
    this.fallback = next;
    this.onFallback?.(reason);
  }

  private prepareCanvas(): { rect: DOMRect; dpr: number } {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.context.clearRect(0, 0, rect.width, rect.height);
    return { rect, dpr };
  }

  private strokePacket(x: number, y: number, angle: number, color: string, alpha: number): void {
    this.context.save();
    this.context.translate(x, y);
    this.context.rotate(angle);
    this.context.strokeStyle = color;
    this.context.lineWidth = 2.2;
    this.context.lineCap = "square";
    this.context.globalAlpha = alpha * 0.35;
    this.context.beginPath();
    this.context.moveTo(-6, 0);
    this.context.lineTo(-3, 0);
    this.context.stroke();
    this.context.globalAlpha = alpha;
    this.context.beginPath();
    this.context.moveTo(-3, 0);
    this.context.lineTo(3, 0);
    this.context.stroke();
    this.context.globalAlpha = alpha * 0.35;
    this.context.beginPath();
    this.context.moveTo(3, 0);
    this.context.lineTo(6, 0);
    this.context.stroke();
    this.context.restore();
  }

  private animate(timestamp: number): void {
    const frameStarted = performance.now();
    const { rect } = this.prepareCanvas();
    const staticMode = this.reducedMotion.matches || document.hidden || this.fallback;
    if (!staticMode) {
      const elapsed = (timestamp - this.startedAt) / 1000;
      for (const wire of this.wires.slice(0, 240)) {
        const currentFlow = flow(wire.current, this.iref);
        if (!currentFlow) continue;
        const path = this.editor.element.querySelector<SVGPathElement>(`path.editor-wire[data-wire-id="${wire.id}"]`);
        const matrix = path?.getScreenCTM();
        if (!path || !matrix) continue;
        const screenScale = Math.max(1e-6, Math.hypot(matrix.a, matrix.b));
        const length = path.getTotalLength();
        const spacing = currentFlow.spacing / screenScale;
        const direction = wire.current < 0 ? -1 : 1;
        const phaseScreen = ((elapsed * currentFlow.speed * direction) % currentFlow.spacing + currentFlow.spacing) % currentFlow.spacing;
        for (let distance = phaseScreen / screenScale; distance < length; distance += spacing) {
          const point = path.getPointAtLength(distance);
          const nearby = path.getPointAtLength(Math.min(length, distance + 0.05));
          const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);
          const screenNearby = new DOMPoint(nearby.x, nearby.y).matrixTransform(matrix);
          const angle = Math.atan2(screenNearby.y - screenPoint.y, screenNearby.x - screenPoint.x) + (direction < 0 ? Math.PI : 0);
          this.strokePacket(screenPoint.x - rect.left, screenPoint.y - rect.top, angle, pulseColor(wire.voltage, this.vref, "vellum"), currentFlow.alpha);
        }
      }
    }
    const elapsedFrame = performance.now() - frameStarted;
    this.slowFrames = elapsedFrame > 12 ? this.slowFrames + 1 : 0;
    if (this.slowFrames >= 30) this.setFallback("Static current encoding · frame budget");
    this.animationFrame = requestAnimationFrame(this.animate);
  }
}
