import { formatValue, mount, type TraceDefinition, type WaveformViewer } from "@opencircuit/waveform-viewer";
import type { AnalysisMode, DCSweepSegment, SimulationResult } from "@opencircuit/sim-engine";

export const TRACE_COLORS = ["#3FD983", "#E8A244", "#5FB0E8", "#F1EEE8", "#3FD983", "#E8A244"] as const;
export const TRACE_DASHES = [[], [], [], [], [6, 3], [2, 3]] as const;
const FAMILY_DASHES = [[], [6, 3], [2, 3], [8, 3, 2, 3], [1, 3], [10, 3]] as const;
const LOCUS_ANNOTATION_ID = "pot-sweep";

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

function dcFamilySource(probeIndex: number, segmentIndex: number): string {
  return `dc-family-${probeIndex}-${segmentIndex}`;
}

export class ScopePlot {
  private readonly viewerHost: HTMLDivElement;
  private readonly autoButton: HTMLButtonElement;
  private readonly manualButton: HTMLButtonElement;
  private readonly keepLocusButton: HTMLButtonElement;
  private readonly noiseTotals: HTMLDivElement;
  private viewer: WaveformViewer | undefined;
  private probes: ScopeProbe[] = [];
  private mode: AnalysisMode = "op";
  private result: SimulationResult | undefined;
  private locus: [number, number][] = [];
  private locusActive = false;

  constructor(host: HTMLElement) {
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
    this.keepLocusButton = document.createElement("button");
    this.keepLocusButton.type = "button";
    this.keepLocusButton.className = "keep-locus";
    this.keepLocusButton.textContent = "Keep locus";
    this.keepLocusButton.hidden = true;
    this.noiseTotals = document.createElement("div");
    this.noiseTotals.className = "noise-totals";
    this.noiseTotals.dataset.testid = "noise-totals";
    this.noiseTotals.hidden = true;
    host.replaceChildren(controls, this.viewerHost, this.noiseTotals, this.keepLocusButton);
    this.autoButton.addEventListener("click", () => {
      this.viewer?.autoscale();
      this.setScaleState(true);
    });
    this.manualButton.addEventListener("click", () => this.promptManualRange());
    this.keepLocusButton.addEventListener("click", () => {
      this.keepLocusButton.hidden = true;
      this.renderLocus();
    });
    this.remount();
  }

  beginLocus(): void {
    this.locus = [];
    this.locusActive = true;
    this.keepLocusButton.hidden = true;
    this.renderLocus();
  }

  clearLocus(): void {
    this.locus = [];
    this.locusActive = false;
    this.keepLocusButton.hidden = true;
    this.viewer?.removeAnnotation(LOCUS_ANNOTATION_ID);
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
    const tracesBefore = this.viewerSignature();
    if (modeChanged) this.clearLocus();
    this.mode = mode;
    this.result = result;
    if (modeChanged || tracesBefore !== this.viewerSignature()) this.remount();
    this.renderData();
  }

  downloadCSV(filename: string): void {
    this.viewer?.downloadCSV(filename);
  }

  downloadPNG(filename: string): void {
    this.viewer?.downloadPNG(filename);
  }

  private viewerSignature(): string {
    return JSON.stringify({ traces: this.traceDefinitions(), xUnit: this.result?.sweep?.primary.unit, noise: this.result?.noise });
  }

  private dcSegments(): DCSweepSegment[] {
    return this.result?.sweep?.segments ?? [];
  }

  private traceDefinitions(): TraceDefinition[] {
    if (this.mode === "noise" && this.result?.noise) {
      const noise = this.result.noise;
      return [
        {
          source: noise.outputVector,
          label: `Output noise at V(${noise.output.positiveNode})`,
          unit: noise.output.densityUnit,
          axisGroup: "output noise",
          color: TRACE_COLORS[0],
        },
        {
          source: noise.inputVector,
          label: `Input-referred to ${noise.input.name}`,
          unit: noise.input.densityUnit,
          axisGroup: "input-referred noise",
          color: TRACE_COLORS[1],
        },
      ];
    }
    if (this.mode === "dc-sweep" && this.result?.sweep) {
      const secondary = this.result.sweep.secondary;
      return this.probes.flatMap((probe, probeIndex) => this.dcSegments().map((segment, segmentIndex) => ({
        source: dcFamilySource(probeIndex, segmentIndex),
        label: secondary && segment.secondaryValue !== undefined
          ? `${probe.label} · ${secondary.name}=${formatValue(segment.secondaryValue, { unit: secondary.unit, reserveSign: false })}`
          : probe.label,
        unit: "V",
        axisGroup: "voltage",
        color: TRACE_COLORS[(probeIndex + segmentIndex) % TRACE_COLORS.length] ?? probe.color,
        dash: FAMILY_DASHES[segmentIndex % FAMILY_DASHES.length] ?? [],
      })));
    }
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
      xScale: this.mode === "ac" || this.mode === "noise" ? "log" : "linear",
      ...(this.mode === "dc-sweep" ? { xVector: "sweep", xUnit: this.result?.sweep?.primary.unit ?? "" } : {}),
      ...(this.mode === "noise" ? { xVector: "frequency", xUnit: "Hz" } : {}),
      showControls: true,
      className: "schemagic-waveform-viewer",
    });
    this.renderLocus();
  }

  private renderData(): void {
    this.renderNoiseTotals();
    if (!this.viewer || !this.result || (this.mode !== "tran" && this.mode !== "ac" && this.mode !== "noise" && this.mode !== "dc-sweep")) return;
    const vectors = new Map<string, Float64Array>();
    if (this.mode === "noise") {
      const noise = this.result.noise;
      if (!noise) return;
      const frequency = this.result.data.get(noise.frequencyVector);
      const output = this.result.data.get(noise.outputVector);
      const input = this.result.data.get(noise.inputVector);
      if (!frequency || !output || !input) return;
      vectors.set(noise.frequencyVector, frequency);
      vectors.set(noise.outputVector, output);
      vectors.set(noise.inputVector, input);
      this.viewer.setData({ kind: "noise", vectors });
      return;
    }
    if (this.mode === "dc-sweep") {
      const sweep = this.result.data.get("sweep");
      const first = this.dcSegments()[0];
      if (!sweep || !first) return;
      vectors.set("sweep", sweep.subarray(first.startIndex, first.startIndex + first.length));
      this.probes.forEach((probe, probeIndex) => {
        const values = this.result?.data.get(`v(${probe.node})`.toLowerCase());
        if (!values) return;
        this.dcSegments().forEach((segment, segmentIndex) => {
          vectors.set(dcFamilySource(probeIndex, segmentIndex), values.subarray(segment.startIndex, segment.startIndex + segment.length));
        });
      });
      this.viewer.setData({ kind: "dc-sweep", vectors });
      return;
    }
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

  private renderNoiseTotals(): void {
    const noise = this.mode === "noise" ? this.result?.noise : undefined;
    this.noiseTotals.hidden = !noise;
    if (!noise) {
      this.noiseTotals.replaceChildren();
      return;
    }
    const output = noise.output.total;
    const input = noise.input.total;
    this.noiseTotals.innerHTML = `<span><strong>Integrated output</strong> ${formatValue(output.rms, { unit: output.rmsUnit, reserveSign: false })} RMS · ${formatValue(output.meanSquare, { unit: output.meanSquareUnit, reserveSign: false })}</span><span><strong>Integrated input-referred</strong> ${formatValue(input.rms, { unit: input.rmsUnit, reserveSign: false })} RMS · ${formatValue(input.meanSquare, { unit: input.meanSquareUnit, reserveSign: false })}</span><span>${formatValue(noise.frequency.fstart, { unit: "Hz", reserveSign: false })} to ${formatValue(noise.frequency.fstop, { unit: "Hz", reserveSign: false })} · ${noise.temperatureC} °C</span>`;
  }

  private renderLocus(): void {
    if (!this.viewer) return;
    if (this.locus.length < 2) {
      this.viewer.removeAnnotation(LOCUS_ANNOTATION_ID);
      return;
    }
    this.viewer.addAnnotation({
      id: LOCUS_ANNOTATION_ID,
      label: "Pot sweep",
      points: this.locus,
      style: {
        axisGroup: "voltage",
        color: TRACE_COLORS[0],
        lineWidth: 1.5,
        opacity: 0.4,
        unit: "V",
        xMode: "normalized",
      },
    });
  }

  private setScaleState(auto: boolean): void {
    this.autoButton.classList.toggle("active", auto);
    this.manualButton.classList.toggle("active", !auto);
    this.autoButton.setAttribute("aria-pressed", String(auto));
    this.manualButton.setAttribute("aria-pressed", String(!auto));
  }

  private promptManualRange(): void {
    if (!this.viewer) return;
    const min = Number(prompt(this.mode === "noise" ? "Minimum output noise density" : "Minimum voltage", "0"));
    if (!Number.isFinite(min)) return;
    const max = Number(prompt(this.mode === "noise" ? "Maximum output noise density" : "Maximum voltage", this.mode === "noise" ? "1e-6" : "5"));
    if (!Number.isFinite(max) || max <= min) return;
    if (this.mode === "noise") {
      this.viewer.setYRange("output noise", { min, max });
      const inputMin = Number(prompt("Minimum input-referred density", String(min)));
      const inputMax = Number(prompt("Maximum input-referred density", String(max)));
      if (Number.isFinite(inputMin) && Number.isFinite(inputMax) && inputMax > inputMin) this.viewer.setYRange("input-referred noise", { min: inputMin, max: inputMax });
    } else if (this.mode === "ac") {
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
