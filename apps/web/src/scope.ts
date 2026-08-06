import { mount, type TraceDefinition, type WaveformViewer } from "@opencircuit/waveform-viewer";
import type { AnalysisMode, SimulationResult } from "@opencircuit/sim-engine";

export const TRACE_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"] as const;

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
  private viewer: WaveformViewer | undefined;
  private probes: ScopeProbe[] = [];
  private mode: AnalysisMode = "op";
  private result: SimulationResult | undefined;

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
    this.manualButton.textContent = "Manual range";
    this.manualButton.className = "scope-scale-button";
    this.manualButton.setAttribute("aria-pressed", "false");
    controls.append(this.autoButton, this.manualButton);
    this.viewerHost = document.createElement("div");
    this.viewerHost.className = "scope-viewer-host";
    this.host.replaceChildren(controls, this.viewerHost);
    this.autoButton.addEventListener("click", () => {
      this.viewer?.autoscale();
      this.setScaleState(true);
    });
    this.manualButton.addEventListener("click", () => this.promptManualRange());
    this.remount();
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
