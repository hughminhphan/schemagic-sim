import { componentPinPoints, type CircuitDocument, type GeneratedNetlist, type SimulationResult } from "@opencircuit/sim-engine";
import { formatEngineering } from "./format";

export const VIEW_WIDTH = 760;
export const VIEW_HEIGHT = 370;
const GRID = 8;
const OFFSET_X = 120;
const OFFSET_Y = 20;

export interface WireShape {
  id: string;
  points: [number, number][];
  voltage: number;
  currentVector?: string;
}

const currentVectorByWire: Record<string, string> = {
  w1: "i(v1)",
  w2: "i(@r2t[i])",
  w3: "i(v1)",
  w4: "i(@r2b[i])",
  w5: "i(@r3[i])",
  w6: "i(@r3[i])",
  w7: "i(@q4[ic])",
  w8: "i(@r5[i])",
  w9: "i(@d6[id])",
};

export function canvasPoint([x, y]: [number, number]): [number, number] {
  return [OFFSET_X + x * GRID, OFFSET_Y + y * GRID];
}

function pathData(points: [number, number][]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${canvasPoint(point).join(" ")}`).join(" ");
}

function componentMarkup(document: CircuitDocument): string {
  return document.components.map((component) => {
    const [x, y] = canvasPoint(component.pos);
    const selected = component.id === "c6" ? " selected" : "";
    const pins = componentPinPoints(component).map((point, index) => {
      const [pinX, pinY] = canvasPoint(point);
      return `<circle class="pin-node" data-component-pin="${component.id}:${index}" cx="${pinX}" cy="${pinY}" r="3.2"/>`;
    }).join("");
    let symbol = "";
    switch (component.type) {
      case "vsource":
        symbol = `<circle class="package-fill" cx="${x}" cy="${y}" r="16"/><path class="symbol-stroke" d="M${x-5} ${y-6}h10M${x} ${y-11}v10M${x-5} ${y+7}h10"/><rect class="selection-outline" x="${x-21}" y="${y-21}" width="42" height="42"/>`;
        break;
      case "potentiometer":
        symbol = `<path class="symbol-stroke" d="M${x} ${y-48}v12l-7 6 14 7-14 7 14 7-14 7 7 6v12"/><path id="pot-wiper" class="pot-wiper" d="M${x+32} ${y}L${x+7} ${y}"/><rect id="pot-knob" class="pot-knob" x="${x+28}" y="${y-5}" width="9" height="10"/><path id="pot-hit" class="pot-hit" data-testid="pot-wiper" d="M${x+32} ${y-46}V${y+46}"/><rect class="selection-outline" x="${x-13}" y="${y-54}" width="54" height="108"/>`;
        break;
      case "resistor": {
        const vertical = component.rot === 90 || component.rot === 270;
        symbol = vertical
          ? `<path class="symbol-stroke" d="M${x} ${y-16}v4l-6 4 12 6-12 6 12 6-6 4v2"/><rect class="selection-outline" x="${x-12}" y="${y-22}" width="24" height="44"/>`
          : `<path class="symbol-stroke" d="M${x-16} ${y}h4l4-6 6 12 6-12 6 12 4-6h2"/><rect class="selection-outline" x="${x-22}" y="${y-12}" width="44" height="24"/>`;
        break;
      }
      case "bjt_npn":
        symbol = `<circle class="package-fill" cx="${x}" cy="${y}" r="27"/><path class="symbol-stroke" d="M${x-16} ${y-15}v30M${x-16} ${y}H${x-8}M${x-8} ${y-12}L${x+16} ${y-32}M${x-8} ${y+12}L${x+16} ${y+32}M${x+7} ${y+20}l9 12-14-4"/><rect class="selection-outline" x="${x-32}" y="${y-38}" width="64" height="76"/>`;
        break;
      case "led":
        symbol = `<circle id="led-halo" class="led-halo" cx="${x}" cy="${y}" r="44" fill="url(#led-falloff)" opacity="0"/><path class="led-body" d="M${x-13} ${y-8}h26L${x} ${y+8}Z"/><path class="symbol-stroke" d="M${x-14} ${y+8}h28M${x} ${y-16}v8M${x} ${y+8}v8"/><path class="led-ray" d="M${x+12} ${y-10}l10-9m-5 14 10-9m-6-9 2 4-4-1m7 2 2 4-4-1"/><rect class="selection-outline" x="${x-24}" y="${y-25}" width="54" height="50"/>`;
        break;
      case "ground":
        symbol = `<path class="symbol-stroke" d="M${x} ${y}v5m-12 0h24m-8 5H${x+8}m-5 5h10"/><rect class="selection-outline" x="${x-16}" y="${y-5}" width="32" height="25"/>`;
        break;
    }
    const labelText = component.label?.text;
    const label = labelText ? `<text class="component-label" x="${x + (component.label?.offset[0] ?? 0) * GRID}" y="${y + (component.label?.offset[1] ?? 0) * GRID - 8}">${labelText}</text>` : "";
    return `<g class="component${selected}" data-component-id="${component.id}" tabindex="0" role="button" aria-label="Select ${labelText ?? component.type}">${symbol}${pins}${label}</g>`;
  }).join("");
}

export function schematicMarkup(document: CircuitDocument): string {
  const wires = document.wires.map((wire) => {
    const d = pathData(wire.points);
    return `<path class="wire" id="wire-${wire.id}" data-wire-id="${wire.id}" d="${d}"/><path class="wire-hit" data-wire-hit="${wire.id}" d="${d}"/>`;
  }).join("");
  return `<svg id="schematic" class="schematic" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" preserveAspectRatio="none" aria-label="Running NPN LED driver schematic">
    <defs>
      <pattern id="dot-grid" width="8" height="8" patternUnits="userSpaceOnUse"><circle class="grid-dot" cx="1" cy="1" r=".7"/></pattern>
      <radialGradient id="led-falloff"><stop offset="0" stop-color="#BE7318" stop-opacity=".62"/><stop offset=".38" stop-color="#BE7318" stop-opacity=".28"/><stop offset="1" stop-color="#BE7318" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${VIEW_WIDTH}" height="${VIEW_HEIGHT}" fill="#F1EEE8"/><rect width="${VIEW_WIDTH}" height="${VIEW_HEIGHT}" fill="url(#dot-grid)"/>
    <g id="wire-layer">${wires}</g><g id="chevron-layer" class="chevron-layer"></g><g id="component-layer">${componentMarkup(document)}</g>
    <text class="component-label" x="${canvasPoint([8,11])[0]-35}" y="${canvasPoint([8,11])[1]-8}">+5 V rail</text>
    <text class="net-label" id="collector-annotation" x="${canvasPoint([49,18])[0]}" y="${canvasPoint([49,18])[1]-8}"> -- V</text>
  </svg><canvas id="pulse-layer" class="pulse-layer" aria-hidden="true"></canvas>`;
}

export function voltageColor(voltage: number, vref: number, chromaScale = 1): string {
  if (Math.abs(voltage) < 0.05) return "#6E7378";
  const t = Math.max(-1, Math.min(1, voltage / Math.max(vref, 1e-12)));
  const chroma = (t < 0 ? 0.121 : 0.117) * Math.abs(t) ** 1.6 * chromaScale;
  return `oklch(62% ${chroma.toFixed(5)} ${t < 0 ? 245 : 62})`;
}

function pulseColor(voltage: number, vref: number): string {
  if (Math.abs(voltage) < 0.05) return "#A9AEB3";
  const t = Math.max(-1, Math.min(1, voltage / Math.max(vref, 1e-12)));
  const chroma = (t < 0 ? 0.121 : 0.117) * Math.abs(t) ** 1.6;
  return `oklch(80% ${chroma.toFixed(5)} ${t < 0 ? 245 : 62})`;
}

export function snapReference(values: number[]): number {
  const maximum = Math.max(1e-12, ...values.map(Math.abs));
  const exponent = Math.floor(Math.log10(maximum));
  const scaled = maximum / 10 ** exponent;
  const snapped = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return snapped * 10 ** exponent;
}

export function scalar(result: SimulationResult | undefined, name: string, index = 0): number | undefined {
  const values = result?.data.get(name.toLowerCase());
  return values?.[index];
}

export function updateSchematicVisuals(
  circuit: CircuitDocument,
  generated: GeneratedNetlist,
  result: SimulationResult | undefined,
  hoveredNode?: string,
): { vref: number; wires: WireShape[]; branchCurrents: number[] } {
  const nodeVoltages = new Map<string, number>();
  for (const node of new Set(Object.values(generated.wireNodes))) {
    nodeVoltages.set(node, node === "0" ? 0 : (scalar(result, `v(${node})`) ?? 0));
  }
  const vref = snapReference([...nodeVoltages.values()]);
  for (const wire of circuit.wires) {
    const node = generated.wireNodes[wire.id] ?? "0";
    const voltage = nodeVoltages.get(node) ?? 0;
    const element = globalThis.document.querySelector<SVGPathElement>(`#wire-${wire.id}`);
    if (!element) continue;
    const chroma = hoveredNode && hoveredNode !== node ? 0.35 : 1;
    element.style.stroke = voltageColor(voltage, vref, chroma);
    element.style.strokeDasharray = voltage < -0.05 ? "8 4" : "none";
    element.style.strokeWidth = Math.abs(voltage) <= 0.05 ? "0.9" : "1.8";
  }
  const collectorNode = generated.componentNodes.c4?.[0];
  const collector = collectorNode ? scalar(result, `v(${collectorNode})`) : undefined;
  const collectorLabel = globalThis.document.querySelector<SVGTextElement>("#collector-annotation");
  if (collectorLabel) {
    const reading = formatEngineering(collector, "V");
    collectorLabel.textContent = `${reading.value} ${reading.unit}`;
  }
  const ledCurrent = Math.abs(scalar(result, "i(@d6[id])") ?? 0);
  const visible = Math.max(0, Math.min(1, (ledCurrent - 200e-6) / (20e-3 - 200e-6)));
  const flux = visible ** 0.65;
  const halo = globalThis.document.querySelector<SVGCircleElement>("#led-halo");
  if (halo) {
    halo.setAttribute("opacity", String(flux * 0.78));
    halo.setAttribute("r", String(24 + flux * 40));
  }
  const wires: WireShape[] = circuit.wires.map((wire) => {
    const node = generated.wireNodes[wire.id] ?? "0";
    return {
      id: wire.id,
      points: wire.points.map(canvasPoint),
      voltage: nodeVoltages.get(node) ?? 0,
      ...(currentVectorByWire[wire.id] ? { currentVector: currentVectorByWire[wire.id] } : {}),
    };
  });
  const branchCurrents = [...new Set(Object.values(currentVectorByWire))].map((name) => Math.abs(scalar(result, name) ?? 0));
  return { vref, wires, branchCurrents };
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

function pointOnPolyline(points: [number, number][], distance: number): { point: [number, number]; angle: number } {
  let remaining = distance;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    remaining -= length;
  }
  const last = points.at(-1) ?? [0, 0];
  return { point: last, angle: 0 };
}

function polylineLength(points: [number, number][]): number {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index]![0], point[1] - points[index]![1]), 0);
}

export class PulseRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private wires: WireShape[] = [];
  private result: SimulationResult | undefined;
  private vref = 5;
  private iref = 0.01;
  private animationFrame = 0;
  private startedAt = performance.now();
  private readonly reduced = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Pulse canvas is unavailable");
    this.context = context;
    this.reduced.addEventListener("change", () => this.renderStaticChevrons());
    this.animate = this.animate.bind(this);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  update(wires: WireShape[], result: SimulationResult | undefined, vref: number, branchCurrents: number[]): void {
    this.wires = wires;
    this.result = result;
    this.vref = vref;
    this.iref = snap125(percentile90(branchCurrents));
    this.renderStaticChevrons();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
  }

  exportStaticSvg(svg: SVGSVGElement): string {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.querySelectorAll(".wire-hit,.pot-hit,.pin-node,.selection-outline").forEach((element) => element.remove());
    const layer = clone.querySelector<SVGGElement>("#chevron-layer");
    if (layer) layer.innerHTML = this.staticEncoding(clone);
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `.component-label,.net-label{fill:#2A2F34;font-family:IBM Plex Sans,sans-serif;font-size:11px;font-weight:500;paint-order:stroke fill;stroke:#F1EEE8;stroke-width:3px}.net-label{font-family:IBM Plex Mono,monospace;font-size:12px}.symbol-stroke,.package-fill,.led-body,.led-ray,.pot-wiper,.ground-glyph{stroke:#15181B;fill:none;stroke-linecap:square;stroke-linejoin:miter}.package-fill,.led-body{fill:#F1EEE8}.grid-dot{fill:#6E7378;opacity:.22}.static-chevron{fill:none;stroke:#15181B;stroke-width:1;stroke-linecap:square;stroke-linejoin:miter}`;
    clone.prepend(style);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }

  private flow(current: number): { u: number; speed: number; spacing: number; alpha: number } | undefined {
    const magnitude = Math.abs(current);
    if (magnitude < 1e-6) return undefined;
    const denominator = Math.log10(Math.max(this.iref, 1.0001e-6) / 1e-6);
    const u = Math.max(0, Math.min(1, Math.log10(magnitude / 1e-6) / denominator));
    return { u, speed: 12 + 96 * u, spacing: 34 - 16 * u, alpha: 0.25 + 0.45 * u };
  }

  private prepareCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.context.setTransform(dpr * rect.width / VIEW_WIDTH, 0, 0, dpr * rect.height / VIEW_HEIGHT, 0, 0);
    this.context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }

  private animate(timestamp: number): void {
    this.prepareCanvas();
    if (!this.reduced.matches && document.visibilityState === "visible") {
      const elapsed = (timestamp - this.startedAt) / 1000;
      for (const wire of this.wires.slice(0, 240)) {
        if (!wire.currentVector) continue;
        const current = scalar(this.result, wire.currentVector) ?? 0;
        const flow = this.flow(current);
        if (!flow) continue;
        const color = pulseColor(wire.voltage, this.vref);
        const length = polylineLength(wire.points);
        const direction = current < 0 ? -1 : 1;
        const phase = ((elapsed * flow.speed * direction) % flow.spacing + flow.spacing) % flow.spacing;
        for (let distance = phase; distance < length; distance += flow.spacing) {
          const location = pointOnPolyline(wire.points, distance);
          this.context.save();
          this.context.translate(location.point[0], location.point[1]);
          this.context.rotate(location.angle);
          this.context.strokeStyle = color === "#6E7378" ? "#A9AEB3" : color;
          this.context.lineWidth = 2.2;
          this.context.globalAlpha = flow.alpha * 0.35;
          this.context.beginPath();this.context.moveTo(-6,0);this.context.lineTo(-3,0);this.context.stroke();
          this.context.globalAlpha = flow.alpha;
          this.context.beginPath();this.context.moveTo(-3,0);this.context.lineTo(3,0);this.context.stroke();
          this.context.globalAlpha = flow.alpha * 0.35;
          this.context.beginPath();this.context.moveTo(3,0);this.context.lineTo(6,0);this.context.stroke();
          this.context.restore();
        }
      }
    }
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  private staticEncoding(root: ParentNode): string {
    const fragments: string[] = [];
    for (const wire of this.wires) {
      if (!wire.currentVector) continue;
      const current = scalar(this.result, wire.currentVector) ?? 0;
      const flow = this.flow(current);
      const path = root.querySelector<SVGPathElement>(`#wire-${wire.id}`);
      if (!flow || !path) continue;
      path.style.strokeWidth = String([0.9, 1.4, 2, 2.8][Math.min(3, Math.floor(flow.u * 4))]);
      const length = polylineLength(wire.points);
      for (let distance = flow.spacing / 2; distance < length; distance += flow.spacing) {
        const { point, angle } = pointOnPolyline(wire.points, distance);
        const degrees = angle * 180 / Math.PI + (current < 0 ? 180 : 0);
        fragments.push(`<path class="static-chevron" transform="translate(${point[0]} ${point[1]}) rotate(${degrees})" d="M-3 -3L1 0L-3 3"/>`);
      }
    }
    return fragments.join("");
  }

  private renderStaticChevrons(): void {
    const layer = document.querySelector<SVGGElement>("#chevron-layer");
    if (!layer) return;
    if (!this.reduced.matches) {
      layer.replaceChildren();
      return;
    }
    layer.innerHTML = this.staticEncoding(document);
  }
}
