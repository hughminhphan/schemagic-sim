import { mount, type TraceDefinition, type WaveformViewer } from "@opencircuit/waveform-viewer";
import type { AnalysisMode, SimulationResult } from "@opencircuit/sim-engine";

export const TRACE_COLORS = ["#3FD983", "#E8A244", "#5FB0E8", "#F1EEE8", "#3FD983", "#E8A244"] as const;
export const TRACE_DASHES = [[], [], [], [], [6, 3], [2, 3]] as const;

export interface ScopeProbe {
  node: string;
  label: string;
  color: string;
}

function realFrequency(values: Float64Array): Float64Array {
  if (values.length < 2) return values;
  const output = new Float64Array(Math.ceil(values.length / 2));
  for (let index = 0; index < output.length; index += 1) output[index] = values[index * 2] ?? 0;
  return output;
}

export class ScopePlot {
  private readonly host: HTMLElement;
  private readonly viewerHost: HTMLDivElement;
  private readonly autoButton: HTMLButtonElement;
  private readonly manualButton: HTMLButtonElement;
  private readonly locusSvg: SVGSVGElement;
  private readonly keepLocusButton: HTMLButtonElement;
  private viewer: WaveformViewer | undefined;
  private probes: ScopeProbe[] = [];
  private mode: AnalysisMode = "op";
  private result: SimulationResult | undefined;
  private locus: [number, number][] = [];
  private locusActive = false;

  constructor(host: HTMLElement) {
    this.host = host;
    const controls = document.createElement("div");
    controls.className = "scope-scale-controls";
    this.autoButton = document.createElement("button");
    this.autoButton.type = "button";
    this.autoButton.textContent = "Autoscale";
    this.autoButton.className = "scope-scale-button active";
    this.autoButton.setAttribute("aria-pressed", "true");
    this.manualButton = document.createElement("button");
    this.manualButton.type = "button";
    this.manualButton.textContent = "Range";
    this.manualButton.className = "scope-scale-button";
    this.manualButton.setAttribute("aria-pressed", "false");
    controls.append(this.autoButton, this.manualButton);
    this.viewerHost = document.createElement("div");
    this.viewerHost.className = "scope-viewer-host";
    this.locusSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.locusSvg.classList.add("scope-locus");
    this.locusSvg.setAttribute("aria-label", "Potentiometer sweep locus");
    this.keepLocusButton = document.createElement("button");
    this.keepLocusButton.type = "button";
    this.keepLocusButton.className = "keep-locus";
    this.keepLocusButton.textContent = "Keep locus";
    this.keepLocusButton.hidden = true;
    this.host.replaceChildren(controls, this.viewerHost, this.locusSvg, this.keepLocusButton);
    this.autoButton.addEventListener("click", () => {
      this.viewer?.autoscale();
      this.setScaleState(true);
    });
    this.manualButton.addEventListener("click", () => this.promptManualRange());
    this.keepLocusButton.addEventListener("click", () => {
      this.keepLocusButton.hidden = true;
      this.locusSvg.dataset.kept = "true";
    });
    new ResizeObserver(() => this.renderLocus()).observe(this.host);
    this.remount();
  }

  beginLocus(): void {
    this.locus = [];
    this.locusActive = true;
    this.locusSvg.dataset.kept = "false";
    this.keepLocusButton.hidden = true;
    this.renderLocus();
  }

  addLocusPoint(wiper: number, voltage: number): void {
    if (!this.locusActive || !Number.isFinite(wiper) || !Number.isFinite(voltage)) return;
    this.locus.push([wiper, voltage]);
    if (this.locus.length > 400) this.locus.splice(0, this.locus.length - 400);
    this.renderLocus();
  }

  endLocus(): void {
    this.locusActive = false;
    if (this.locus.length > 200) this.locus = this.locus.filter((_, index) => index % Math.ceil(this.locus.length / 200) === 0);
    this.keepLocusButton.hidden = this.locus.length < 2;
    this.renderLocus();
  }

  setProbes(probes: ScopeProbe[]): void {
    const changed = JSON.stringify(probes) !== JSON.stringify(this.probes);
    this.probes = probes.slice(0, TRACE_COLORS.length);
    if (changed) this.remount();
    this.renderData();
  }

  setData(mode: AnalysisMode, result: SimulationResult | undefined): void {
    const modeChanged = this.mode !== mode;
    this.mode = mode;
    this.result = result;
    if (modeChanged) this.remount();
    this.renderData();
  }

  downloadCSV(filename: string): void {
    this.viewer?.downloadCSV(filename);
  }

  downloadPNG(filename: string): void {
    this.viewer?.downloadPNG(filename);
  }

  private traceDefinitions(): TraceDefinition[] {
    return this.probes.map((probe) => ({
      source: `v(${probe.node})`.toLowerCase(),
      label: probe.label,
      unit: "V",
      axisGroup: "voltage",
      color: probe.color,
    }));
  }

  private remount(): void {
    this.viewer?.destroy();
    this.viewer = mount(this.viewerHost, {
      traces: this.traceDefinitions(),
      colors: [...TRACE_COLORS],
      xScale: this.mode === "ac" ? "log" : "linear",
      showControls: true,
      className: "schemagic-waveform-viewer",
    });
  }

  private renderData(): void {
    if (!this.viewer || !this.result || (this.mode !== "tran" && this.mode !== "ac")) return;
    const vectors = new Map<string, Float64Array>();
    const xName = this.mode === "ac" ? "frequency" : "time";
    const xValues = this.result.data.get(xName);
    if (!xValues) return;
    vectors.set(xName, this.mode === "ac" ? realFrequency(xValues) : xValues);
    for (const trace of this.traceDefinitions()) {
      const values = this.result.data.get(trace.source.toLowerCase());
      if (values) vectors.set(trace.source, values);
    }
    this.viewer.setData({ kind: this.mode, vectors });
  }

  private renderLocus(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.locusSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    if (this.locus.length < 2) {
      this.locusSvg.replaceChildren();
      return;
    }
    const values = this.locus.map((point) => point[1]);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = Math.max(1e-9, maximum - minimum);
    const left = 52;
    const right = 14;
    const top = 26;
    const bottom = 24;
    const points = this.locus.map(([wiper, voltage]) => {
      const x = left + Math.max(0, Math.min(1, wiper)) * Math.max(1, width - left - right);
      const y = top + (1 - (voltage - minimum) / span) * Math.max(1, height - top - bottom);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.classList.add("scope-locus-line");
    polyline.setAttribute("points", points);
    this.locusSvg.replaceChildren(polyline);
  }

  private setScaleState(auto: boolean): void {
    this.autoButton.classList.toggle("active", auto);
    this.manualButton.classList.toggle("active", !auto);
    this.autoButton.setAttribute("aria-pressed", String(auto));
    this.manualButton.setAttribute("aria-pressed", String(!auto));
  }

  private promptManualRange(): void {
    if (!this.viewer) return;
    const min = Number(prompt("Minimum voltage", "0"));
    if (!Number.isFinite(min)) return;
    const max = Number(prompt("Maximum voltage", "5"));
    if (!Number.isFinite(max) || max <= min) return;
    if (this.mode === "ac") {
      this.viewer.setYRange("magnitude", { min, max });
      const phaseMin = Number(prompt("Minimum phase in degrees", "-180"));
      const phaseMax = Number(prompt("Maximum phase in degrees", "180"));
      if (Number.isFinite(phaseMin) && Number.isFinite(phaseMax) && phaseMax > phaseMin) {
        this.viewer.setYRange("phase", { min: phaseMin, max: phaseMax });
      }
    } else {
      this.viewer.setYRange("voltage", { min, max });
    }
    this.setScaleState(false);
  }
}
