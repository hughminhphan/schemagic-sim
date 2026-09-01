import type {
  CircuitDocumentV4,
  CircuitGraphV4,
  CircuitProbeV4,
  SimulationScenarioV4,
} from "@opencircuit/circuit-schema";
import { generateScenarioNetlist } from "@opencircuit/circuit-schema/v4-netlist";
import {
  SimulationClient,
  calculateSimulationNetlistContentHashV1,
  verifySimulationExecutionReceiptV1,
  type SimulationResult,
  type WorkerReadyResponse,
} from "@opencircuit/sim-engine";
import {
  formatValue,
  mount,
  type TraceDefinition,
  type WaveformViewer,
} from "@opencircuit/waveform-viewer";
import "@opencircuit/waveform-viewer/style.css";

const TRACE_COLORS = ["#4fb3ff", "#f2a33c", "#62d59b", "#f17b66", "#c59bff", "#f2dc5d"] as const;
const SVG_NS = "http://www.w3.org/2000/svg";

export interface DesignerSimulationInput {
  readonly key: string;
  readonly netlist: string;
  readonly circuit: Readonly<CircuitDocumentV4>;
  readonly scenarioId: string;
}

export interface DesignerSimulationTrace {
  readonly source: string;
  readonly label: string;
  readonly unit: "V" | "A" | "";
  readonly color: string;
}

export interface DesignerSimulationExecution {
  readonly key: string;
  readonly ready: Readonly<WorkerReadyResponse>;
  readonly scenario: Readonly<SimulationScenarioV4>;
  readonly graph: Readonly<CircuitGraphV4>;
  readonly result: Readonly<SimulationResult>;
  readonly traces: readonly DesignerSimulationTrace[];
}

function humanize(value: string): string {
  return value
    .replace(/[._-]+/gu, " ")
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

function targetNode(
  probe: Readonly<CircuitProbeV4>,
  generated: Readonly<ReturnType<typeof generateScenarioNetlist>>,
): string | undefined {
  if (probe.target.node !== undefined) return probe.target.node;
  if (probe.target.wire !== undefined) return generated.wireNodes[probe.target.wire];
  const target = probe.target.componentPin;
  if (target === undefined) return undefined;
  return generated.componentPinNodes[target[0]]?.[String(target[1])];
}

function probeTrace(
  probe: Readonly<CircuitProbeV4>,
  generated: Readonly<ReturnType<typeof generateScenarioNetlist>>,
  result: Readonly<SimulationResult>,
  index: number,
): DesignerSimulationTrace | undefined {
  const color = probe.color?.startsWith("#") ? probe.color : TRACE_COLORS[index % TRACE_COLORS.length]!;
  if (probe.kind === "current") {
    const componentId = probe.target.componentPin?.[0];
    const source = componentId === undefined ? undefined : generated.componentCurrents[componentId]?.toLowerCase();
    if (source === undefined || !result.data.has(source)) return undefined;
    return { source, label: humanize(probe.id), unit: "A", color };
  }
  const node = targetNode(probe, generated);
  const source = node === undefined ? undefined : `v(${node})`.toLowerCase();
  if (source === undefined || !result.data.has(source)) return undefined;
  return { source, label: humanize(probe.id), unit: "V", color };
}

function fallbackTraces(result: Readonly<SimulationResult>): DesignerSimulationTrace[] {
  return result.vectors
    .filter((vector) => vector.kind === "voltage" || vector.kind === "current")
    .slice(0, TRACE_COLORS.length)
    .map((vector, index) => ({
      source: vector.name,
      label: humanize(vector.name),
      unit: vector.kind === "current" ? "A" as const : "V" as const,
      color: TRACE_COLORS[index]!,
    }));
}

function tracesFor(
  graph: Readonly<CircuitGraphV4>,
  generated: Readonly<ReturnType<typeof generateScenarioNetlist>>,
  result: Readonly<SimulationResult>,
): DesignerSimulationTrace[] {
  const probes = graph.probes
    .map((probe, index) => probeTrace(probe, generated, result, index))
    .filter((trace): trace is DesignerSimulationTrace => trace !== undefined)
    .slice(0, TRACE_COLORS.length);
  return probes.length > 0 ? probes : fallbackTraces(result);
}

export class DesignerSimulationRunner {
  readonly #client = new SimulationClient();

  cancel(): void {
    this.#client.cancel();
  }

  dispose(): void {
    this.#client.dispose();
  }

  async run(input: Readonly<DesignerSimulationInput>): Promise<DesignerSimulationExecution> {
    const circuit = structuredClone(input.circuit) as CircuitDocumentV4;
    const scenario = circuit.scenarios.find((entry) => entry.id === input.scenarioId);
    if (scenario === undefined) throw new Error("The selected behavioral scenario is no longer present.");
    const graph = circuit.circuits.find((entry) => entry.id === scenario.circuitId);
    if (graph === undefined) throw new Error("The selected behavioral circuit is no longer present.");
    if (scenario.config.mode !== "op" && scenario.config.mode !== "tran" && scenario.config.mode !== "ac") {
      throw new Error("This Designer release runs authored operating-point, transient, and AC scenarios. Use Simulator for DC sweep or noise setup.");
    }
    const generated = generateScenarioNetlist(circuit, scenario.id);
    if (generated.omissions.length !== 0) {
      throw new Error("The selected scenario contains an omitted schematic-only block and cannot be executed as a complete behavioral deck.");
    }
    const ready = await this.#client.ready;
    const result = scenario.config.mode === "op"
      ? await this.#client.runOpPoint(input.netlist, { timeoutMs: 5_000, maxRawfileBytes: 16 * 1024 * 1024, maxSamples: 500_000 })
      : scenario.config.mode === "tran"
        ? await this.#client.runTransient(input.netlist, { timeoutMs: 10_000, maxRawfileBytes: 32 * 1024 * 1024, maxSamples: 1_000_000 })
        : await this.#client.runAC(input.netlist, { timeoutMs: 10_000, maxRawfileBytes: 32 * 1024 * 1024, maxSamples: 1_000_000 });
    const expectedNetlistHash = await calculateSimulationNetlistContentHashV1(input.netlist);
    if (result.receipt.netlistContentHash !== expectedNetlistHash) {
      throw new Error("The simulation receipt does not bind the exact exported behavioral deck.");
    }
    const receiptIssues = await verifySimulationExecutionReceiptV1(result);
    if (receiptIssues.length > 0) {
      throw new Error(`The local simulation receipt failed verification: ${receiptIssues.join(", ")}`);
    }
    return {
      key: input.key,
      ready,
      scenario,
      graph,
      result,
      traces: tracesFor(graph, generated, result),
    };
  }
}

function svgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

function addSvgText(svg: SVGSVGElement, text: string, x: number, y: number, className: string, anchor?: string): void {
  const element = svgElement("text");
  element.textContent = text;
  element.setAttribute("x", String(x));
  element.setAttribute("y", String(y));
  element.setAttribute("class", className);
  if (anchor !== undefined) element.setAttribute("text-anchor", anchor);
  svg.append(element);
}

function mountOperatingPoint(host: HTMLElement, execution: Readonly<DesignerSimulationExecution>): () => void {
  const values = execution.traces.flatMap((trace) => {
    const value = execution.result.data.get(trace.source)?.[0];
    return value === undefined || !Number.isFinite(value) ? [] : [{ trace, value }];
  });
  const groups = (["V", "A"] as const).flatMap((unit) => {
    const entries = values.filter((entry) => entry.trace.unit === unit);
    return entries.length === 0 ? [] : [{ unit, entries }];
  });
  const root = document.createElement("div");
  root.className = "designer-op-point-plots";
  root.tabIndex = 0;
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Solved behavioral operating point plots");
  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "ngspice completed, but the authored scenario exposed no plottable probe vectors.";
    root.append(empty);
  }
  for (const group of groups) {
    const figure = document.createElement("figure");
    const caption = document.createElement("figcaption");
    caption.textContent = group.unit === "V" ? "Solved node voltages" : "Solved branch currents";
    const svg = svgElement("svg");
    const height = 180 + group.entries.length * 100;
    svg.setAttribute("viewBox", `0 0 820 ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${caption.textContent}: ${group.entries.map(({ trace, value }) => `${trace.label} ${formatValue(value, { unit: group.unit, reserveSign: false })}`).join(", ")}. One solved behavioral operating point.`);
    const minimum = Math.min(0, ...group.entries.map((entry) => entry.value));
    const maximum = Math.max(0, ...group.entries.map((entry) => entry.value));
    const span = Math.max(maximum - minimum, Math.max(Math.abs(minimum), Math.abs(maximum), 1) * .1);
    const paddedMinimum = minimum - span * .08;
    const paddedMaximum = maximum + span * .08;
    const x = (value: number) => 220 + ((value - paddedMinimum) / (paddedMaximum - paddedMinimum)) * 470;
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = paddedMinimum + (paddedMaximum - paddedMinimum) * tick / 4;
      const tickX = x(value);
      const line = svgElement("line");
      line.setAttribute("x1", String(tickX));
      line.setAttribute("x2", String(tickX));
      line.setAttribute("y1", "32");
      line.setAttribute("y2", String(height - 38));
      line.setAttribute("class", "designer-op-grid");
      svg.append(line);
      addSvgText(svg, formatValue(value, { unit: group.unit, reserveSign: false }), tickX, height - 12, "designer-op-tick", "middle");
    }
    group.entries.forEach(({ trace, value }, index) => {
      const rowY = group.entries.length === 1
        ? height / 2
        : 70 + index * ((height - 140) / (group.entries.length - 1));
      addSvgText(svg, trace.label, 12, rowY + 5, "designer-op-label");
      const axis = svgElement("line");
      axis.setAttribute("x1", "220");
      axis.setAttribute("x2", "690");
      axis.setAttribute("y1", String(rowY));
      axis.setAttribute("y2", String(rowY));
      axis.setAttribute("class", "designer-op-axis");
      const stem = svgElement("line");
      stem.setAttribute("x1", String(x(0)));
      stem.setAttribute("x2", String(x(value)));
      stem.setAttribute("y1", String(rowY));
      stem.setAttribute("y2", String(rowY));
      stem.setAttribute("class", "designer-op-stem");
      stem.setAttribute("style", `--designer-trace:${trace.color}`);
      const marker = svgElement("circle");
      marker.setAttribute("cx", String(x(value)));
      marker.setAttribute("cy", String(rowY));
      marker.setAttribute("r", "5");
      marker.setAttribute("class", "designer-op-marker");
      marker.setAttribute("style", `--designer-trace:${trace.color}`);
      svg.append(axis, stem, marker);
      addSvgText(svg, formatValue(value, { unit: group.unit, reserveSign: false }), 804, rowY + 5, "designer-op-value", "end");
    });
    figure.append(caption, svg);
    root.append(figure);
  }
  host.replaceChildren(root);
  return () => root.remove();
}

export function mountDesignerSimulation(
  host: HTMLElement,
  execution: Readonly<DesignerSimulationExecution>,
): () => void {
  if (execution.scenario.config.mode === "op") return mountOperatingPoint(host, execution);
  const traces: TraceDefinition[] = execution.traces.map((trace) => ({
    source: trace.source,
    label: trace.label,
    unit: trace.unit,
    axisGroup: trace.unit === "A" ? "current" : "voltage",
    color: trace.color,
  }));
  const viewer: WaveformViewer = mount(host, {
    traces,
    colors: [...TRACE_COLORS],
    xScale: execution.scenario.config.mode === "ac" ? "log" : "linear",
    showControls: true,
    className: "designer-waveform-viewer",
  });
  viewer.setData({
    kind: execution.scenario.config.mode,
    vectors: execution.result.data,
  });
  const readout = host.querySelector<HTMLElement>(".oc-waveform-viewer__readout");
  if (readout !== null) {
    readout.tabIndex = 0;
    readout.setAttribute("role", "region");
    readout.setAttribute("aria-label", "Waveform cursor readout");
  }
  return () => viewer.destroy();
}
