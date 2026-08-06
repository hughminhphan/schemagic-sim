import "./style.css";
import {
  SimulationClient,
  SimulationFailure,
  generateNetlist,
  type AnalysisMode,
  type CircuitComponent,
  type CircuitDocument,
  type GeneratedNetlist,
  type SimulationDiagnostic,
  type SimulationResult,
} from "@opencircuit/sim-engine";
import { demoCircuit } from "./demo";
import { formatEngineering, readingMarkup } from "./format";
import { circuitFromLocation, shareUrl } from "./share";
import { PulseRenderer, VIEW_HEIGHT, canvasPoint, scalar, schematicMarkup, updateSchematicVisuals } from "./schematic";
import { ScopePlot, type HoldPoint } from "./scope";

declare global {
  interface Window {
    __ocMetrics: {
      engineInitMs: number;
      warmOpMs: number[];
      wasmTransferSize: number;
      rawfileBytes: number;
      longTasks: number;
      resetLongTasks: () => void;
    };
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root is missing");

let loadDiagnostic: SimulationDiagnostic | undefined;
let circuit: CircuitDocument;
try {
  circuit = circuitFromLocation(location.hash) ?? structuredClone(demoCircuit);
} catch (caught) {
  circuit = structuredClone(demoCircuit);
  loadDiagnostic = { stage: "parse", message: caught instanceof Error ? caught.message : String(caught) };
}

const modeLabels: Record<AnalysisMode, string> = { live: "LIVE", op: "DC", tran: "TRAN", ac: "AC" };
const analysisModes: AnalysisMode[] = ["live", "op", "tran", "ac"];
const initialCollapsed = innerHeight < 760;

app.innerHTML = `<main class="app-shell${initialCollapsed ? " scope-collapsed" : ""}">
  <header class="chrome">
    <div class="brand-line"><span class="wordmark">OPENCIRCUIT</span><span class="version">0.1 P1</span><span class="document-name" id="document-name"></span></div>
    <nav class="analysis-tabs" aria-label="Analysis mode">${analysisModes.map((mode) => `<button class="analysis-tab" data-mode="${mode}" aria-selected="${circuit.sim.mode === mode}">${modeLabels[mode]}</button>`).join("")}</nav>
    <div class="chrome-actions"><button class="chrome-action" id="copy-link">Copy share link</button><button class="chrome-action" id="export-json">Export JSON</button><button class="chrome-action" id="import-json">Load JSON</button></div>
  </header>
  <section class="workbench">
    <aside class="symbol-rail" aria-label="Symbol rail">
      <div class="rail-title">PARTS</div>
      <button class="symbol-tool" aria-label="Voltage source"><svg viewBox="0 0 32 24"><path d="M16 1v4m0 14v4M16 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-3 4h6m-3-3v6m-3 3h6"/></svg><span class="rail-flyout"><strong>DC source</strong>Generic voltage source · F3 primitive</span></button>
      <button class="symbol-tool" aria-label="Resistor"><svg viewBox="0 0 32 24"><path d="M1 12h5l3-5 5 10 5-10 5 10 3-5h4"/></svg><span class="rail-flyout"><strong>Resistor</strong>Generic resistor · F3 primitive</span></button>
      <button class="symbol-tool" aria-label="NPN transistor"><svg viewBox="0 0 32 24"><path d="M7 5v14m0-7h6m0-5 10-6m-10 16 10 6m-4-2 4 2-1-4"/></svg><span class="rail-flyout"><strong>2N3904</strong>Small-signal NPN · F1 approximation</span></button>
      <button class="symbol-tool" aria-label="LED"><svg viewBox="0 0 32 24"><path d="M3 12h6m14 0h6M9 6v12l14-6-14-6Zm14 0v12m1-13 5-5m-2 9 5-5"/></svg><span class="rail-flyout"><strong>Red LED</strong>Functional diode model · F1 approximation</span></button>
      <div class="rail-footer" title="Command insert arrives with free editing">/</div>
    </aside>
    <section class="canvas-wrap" id="canvas-wrap">
      ${schematicMarkup(circuit)}
      <div class="canvas-status" id="engine-banner" data-testid="engine-banner"><span class="run-indicator busy"></span><span id="engine-status">Warming worker-hosted WASM engine</span></div>
      <div class="vref-legend"><span id="vref-negative">−5 V</span><span class="voltage-ramp"></span><span id="vref-positive">+5 V</span></div>
      <div class="hover-readout" id="hover-readout"></div>
    </section>
    <aside class="inspector" aria-label="Property inspector"><div class="inspector-head">INSPECTOR</div><div id="inspector-content"></div></aside>
  </section>
  <section class="scope-dock" aria-label="Scope panel">
    <div class="scope-toolbar"><button class="scope-toggle" id="scope-toggle">${initialCollapsed ? "Open scope" : "Close scope"}</button><span class="scope-title" id="scope-title">OPERATING POINT</span><span>Ch1 V(collector)</span><span id="scope-scale">2.00 V/div · 1.00 ms/div</span><button id="keep-hold" class="scope-toggle" hidden>Keep hold</button><span class="scope-run-state"><span class="run-indicator"></span>RUN</span></div>
    <div class="scope-well"><canvas class="scope-canvas" id="scope-canvas"></canvas><div class="scope-empty" id="scope-empty">Run TRAN or drag the pot to draw a trace.</div></div>
    <div class="scope-cursors"><span id="scope-cursor">Cursor A  --</span><span>Cursor B  --</span><span>Δ  --</span><span class="guidance">Drag the pot.</span></div>
  </section>
  <input class="file-input" id="json-file" type="file" accept="application/json,.json" />
</main>`;

const shell = must<HTMLDivElement>(".app-shell");
const statusText = must<HTMLElement>("#engine-status");
const statusIndicator = must<HTMLElement>("#engine-banner .run-indicator");
const hoverReadout = must<HTMLElement>("#hover-readout");
const inspectorContent = must<HTMLElement>("#inspector-content");
const scopeCanvas = must<HTMLCanvasElement>("#scope-canvas");
const scopeCursor = must<HTMLElement>("#scope-cursor");
const scopeEmpty = must<HTMLElement>("#scope-empty");
const scopePlot = new ScopePlot(scopeCanvas, scopeCursor);
const pulseRenderer = new PulseRenderer(must<HTMLCanvasElement>("#pulse-layer"));
const client = new SimulationClient();

let generated: GeneratedNetlist = generateNetlist(circuit, "op");
let visualResult: SimulationResult | undefined;
let scopeResult: SimulationResult | undefined;
let selectedId = "c6";
let hoveredNode: string | undefined;
let diagnostics: SimulationDiagnostic[] = loadDiagnostic ? [loadDiagnostic] : [];
let busy = true;
let solveGeneration = 0;
let resimTimer: ReturnType<typeof setTimeout> | undefined;
let resimQueued = false;
let draggingPot = false;
let traceHold: HoldPoint[] = [];
let holdCommitted = false;
let holdOffer = false;
let firstOp = true;
let engineLabel = "ngspice WASM";

window.__ocMetrics = {
  engineInitMs: 0,
  warmOpMs: [],
  wasmTransferSize: 0,
  rawfileBytes: 0,
  longTasks: 0,
  resetLongTasks() { this.longTasks = 0; },
};

if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
  const observer = new PerformanceObserver((list) => { window.__ocMetrics.longTasks += list.getEntries().length; });
  observer.observe({ type: "longtask", buffered: true });
}

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

function selectedComponent(): CircuitComponent {
  return circuit.components.find((component) => component.id === selectedId) ?? circuit.components[0]!;
}

function componentCurrent(component: CircuitComponent): number | undefined {
  const suffix = component.id.replace(/\D/g, "");
  const name = component.type === "led" ? `i(@d${suffix}[id])`
    : component.type === "bjt_npn" ? `i(@q${suffix}[ic])`
      : component.type === "resistor" ? `i(@r${suffix}[i])`
        : component.type === "vsource" ? `i(v${suffix})`
          : undefined;
  return name ? scalar(visualResult, name) : undefined;
}

function pinVoltage(componentId: string, pin: number): number | undefined {
  const node = generated.componentNodes[componentId]?.[pin];
  return node === "0" ? 0 : node ? scalar(visualResult, `v(${node})`) : undefined;
}

function collectorVoltage(): number | undefined {
  return pinVoltage("c4", 0);
}

function ledVoltage(): number | undefined {
  return pinVoltage("c6", 0);
}

function partDetails(component: CircuitComponent): { ref: string; name: string; identity: string; fidelity: string; note?: string } {
  const ref = component.label?.text ?? component.id.toUpperCase();
  switch (component.type) {
    case "bjt_npn": return { ref, name: "NPN transistor", identity: "2N3904", fidelity: "F1", note: "F1 functional approximation, pending model factory. Model source pending Phase 3." };
    case "led": return { ref, name: "Red light-emitting diode", identity: "OC_LED_RED", fidelity: "F1", note: "F1 functional approximation, pending model factory. Model source pending Phase 3." };
    case "potentiometer": return { ref, name: "Linear potentiometer", identity: "10 kΩ generic", fidelity: "F3" };
    case "resistor": return { ref, name: "Resistor", identity: "Generic ideal", fidelity: "F3" };
    case "vsource": return { ref, name: "DC voltage source", identity: "Generic ideal", fidelity: "F3" };
    case "ground": return { ref: "GND", name: "Reference node", identity: "Node 0", fidelity: "F3" };
    default: return { ref, name: component.type, identity: "Generic", fidelity: "F0" };
  }
}

function renderInspector(): void {
  const component = selectedComponent();
  const details = partDetails(component);
  const current = componentCurrent(component);
  const power = component.type === "resistor" && current !== undefined ? current ** 2 * Number(component.value ?? 0) : undefined;
  const valueEditor = component.type === "resistor" || component.type === "potentiometer" || component.type === "vsource"
    ? `<div class="inspector-section"><label class="field-label" for="component-value">${component.type === "vsource" ? "DC value (V)" : "Value (Ω)"}</label><input class="value-input" id="component-value" type="number" min="${component.type === "vsource" ? "0" : "0.001"}" step="${component.type === "vsource" ? "0.1" : "1"}" value="${Number(component.value ?? 0)}"/>${component.type === "potentiometer" ? `<label class="field-label" for="wiper-value" style="margin-top:10px">Wiper t</label><input class="value-input" id="wiper-value" type="range" min="0.005" max="0.995" step="0.001" value="${Number(component.params?.t ?? 0.5)}"/><div style="margin-top:5px">${readingMarkup(Number(component.params?.t ?? 0.5) * 100, "%")}</div>` : ""}</div>`
    : `<div class="inspector-section"><span class="field-label">Value</span><div>${details.identity}</div></div>`;
  const pinRows = (generated.componentNodes[component.id] ?? []).map((_, pin) => `<div class="measure-row"><span class="measure-label">Pin ${pin + 1} V</span>${readingMarkup(pinVoltage(component.id, pin), "V")}</div>`).join("");
  inspectorContent.innerHTML = `<section class="inspector-section"><div class="part-heading"><span class="part-ref">${details.ref}</span><span class="fidelity">${details.fidelity}</span></div><div class="part-name">${details.name}<br>${details.identity}</div>${details.note ? `<p class="honesty-note">${details.note}</p>` : ""}</section>
    ${valueEditor}
    <section class="inspector-section"><span class="field-label">LIVE MEASUREMENTS</span>${pinRows}<div class="measure-row"><span class="measure-label">Branch I</span>${readingMarkup(current, "A")}</div><div class="measure-row"><span class="measure-label">Power</span>${readingMarkup(power, "W")}</div></section>
    <section class="inspector-section"><span class="field-label">CIRCUIT READOUTS</span><div class="measure-row"><span class="measure-label">LED node</span>${readingMarkup(ledVoltage(), "V", "led-voltage")}</div><div class="measure-row"><span class="measure-label">Collector</span>${readingMarkup(collectorVoltage(), "V", "collector-voltage")}</div><div class="measure-row"><span class="measure-label">LED current</span>${readingMarkup(Math.abs(scalar(visualResult, "i(@d6[id])") ?? 0), "A", "led-current")}</div></section>
    ${diagnostics.length > 0 ? `<section class="inspector-section"><span class="field-label">MESSAGES</span><ul class="error-list">${diagnostics.map((entry) => `<li class="error-item"><span class="fault-glyph"></span><button data-diagnostic-component="${entry.componentId ?? ""}">${entry.message}</button></li>`).join("")}</ul></section>` : ""}`;
  inspectorContent.querySelector<HTMLInputElement>("#component-value")?.addEventListener("input", onValueInput);
  document.querySelector<HTMLInputElement>("#wiper-value")?.addEventListener("input", (event) => updatePot(Number((event.target as HTMLInputElement).value)));
  inspectorContent.querySelectorAll<HTMLButtonElement>("[data-diagnostic-component]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.diagnosticComponent;
    if (id) selectComponent(id);
  }));
}

function onValueInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value) || value <= 0) return;
  selectedComponent().value = value;
  scheduleSimulation();
}

function updatePot(t: number): void {
  const pot = circuit.components.find((component) => component.id === "c2");
  if (!pot) return;
  const clamped = Math.min(0.995, Math.max(0.005, t));
  pot.params = { ...(pot.params ?? {}), t: clamped };
  updatePotGraphic(clamped);
  if (selectedId === "c2") renderInspector();
  scheduleSimulation();
}

function updatePotGraphic(t: number): void {
  const [x, y] = canvasPoint([18, 22]);
  const targetY = y + (0.5 - t) * 80;
  must<SVGPathElement>("#pot-wiper").setAttribute("d", `M${x + 32} ${targetY}L${x + 7} ${targetY}`);
  const knob = must<SVGRectElement>("#pot-knob");
  knob.setAttribute("y", String(targetY - 5));
}

function selectComponent(id: string): void {
  selectedId = id;
  document.querySelectorAll(".component").forEach((element) => element.classList.toggle("selected", (element as HTMLElement).dataset.componentId === id));
  renderInspector();
}

function setStatus(text: string, state: "ready" | "busy" | "error"): void {
  statusText.textContent = text;
  statusIndicator.className = `run-indicator${state === "ready" ? "" : ` ${state}`}`;
  const banner = must<HTMLElement>("#engine-banner");
  if (state === "ready") banner.dataset.testid = "engine-ready";
  else banner.dataset.testid = "engine-banner";
}

function updateDisplay(): void {
  must<HTMLElement>("#document-name").textContent = circuit.meta.title;
  const visual = updateSchematicVisuals(circuit, generated, visualResult, hoveredNode);
  pulseRenderer.update(visual.wires, visualResult, visual.vref, visual.branchCurrents);
  const reference = formatEngineering(visual.vref, "V");
  must<HTMLElement>("#vref-negative").textContent = `−${reference.value.replace(/^[+− ]/, "")} ${reference.unit}`;
  must<HTMLElement>("#vref-positive").textContent = `+${reference.value.replace(/^[+− ]/, "")} ${reference.unit}`;
  renderInspector();
  const mode = circuit.sim.mode;
  scopePlot.setData(mode, mode === "tran" || mode === "ac" ? scopeResult : visualResult, generated, traceHold);
  scopeEmpty.hidden = (mode === "tran" || mode === "ac") ? (scopeResult?.vectors.length ?? 0) > 0 : traceHold.length > 1;
  must<HTMLElement>("#scope-title").textContent = mode === "tran" ? "TRANSIENT" : mode === "ac" ? "AC RESPONSE" : "OPERATING POINT";
  must<HTMLElement>("#scope-scale").textContent = mode === "ac" ? "20.0 dB/div · decade · driven base" : mode === "tran" ? "2.00 V/div · 1.00 ms/div · driven wiper step" : "Wiper · collector voltage";
  const keep = must<HTMLButtonElement>("#keep-hold");
  keep.hidden = !holdOffer;
  keep.textContent = holdCommitted ? "Hold kept" : `Keep hold (${traceHold.length})`;
}

function collectHoldPoint(): void {
  if (!draggingPot || visualResult === undefined) return;
  traceHold.push({ t: Number(circuit.components.find((component) => component.id === "c2")?.params?.t ?? 0.5), collector: collectorVoltage() ?? 0 });
  if (traceHold.length > 400) traceHold.shift();
}

async function simulate(): Promise<void> {
  const generation = ++solveGeneration;
  busy = true;
  setStatus("Running worker-hosted WASM solve", "busy");
  diagnostics = loadDiagnostic ? [loadDiagnostic] : [];
  try {
    generated = generateNetlist(circuit, "op");
    const opResult = await client.runOpPoint(generated.netlist);
    if (generation !== solveGeneration) return;
    visualResult = opResult;
    window.__ocMetrics.rawfileBytes = opResult.rawfileBytes;
    if (!firstOp) window.__ocMetrics.warmOpMs.push(opResult.elapsedMs);
    firstOp = false;
    collectHoldPoint();
    if (circuit.sim.mode === "tran" || circuit.sim.mode === "ac") {
      generated = generateNetlist(circuit, circuit.sim.mode);
      scopeResult = circuit.sim.mode === "tran" ? await client.runTransient(generated.netlist) : await client.runAC(generated.netlist);
      if (generation !== solveGeneration) return;
      window.__ocMetrics.rawfileBytes = Math.max(window.__ocMetrics.rawfileBytes, scopeResult.rawfileBytes);
    } else {
      scopeResult = undefined;
    }
    busy = false;
    setStatus(`ENGINE READY · ${engineLabel} · ${formatEngineering(opResult.elapsedMs / 1000, "s").value.trim()} ${formatEngineering(opResult.elapsedMs / 1000, "s").unit} solve`, "ready");
    updateDisplay();
  } catch (caught) {
    if (generation !== solveGeneration) return;
    busy = false;
    const failure = caught instanceof SimulationFailure ? caught : undefined;
    if (failure?.detail.code === "CANCELLED") return;
    diagnostics = failure?.detail.diagnostics.length ? failure.detail.diagnostics : [{ stage: "engine", message: caught instanceof Error ? caught.message : String(caught) }];
    setStatus(diagnostics.at(-1)?.message ?? "Simulation failed", "error");
    updateDisplay();
  }
  if (resimQueued && !busy) scheduleSimulation();
}

function scheduleSimulation(): void {
  resimQueued = true;
  if (resimTimer || busy) return;
  resimTimer = setTimeout(() => {
    resimTimer = undefined;
    if (!resimQueued) return;
    resimQueued = false;
    void simulate().finally(() => { if (resimQueued) scheduleSimulation(); });
  }, 30);
}

function pointerToPot(event: PointerEvent): number {
  const rect = must<SVGSVGElement>("#schematic").getBoundingClientRect();
  const y = (event.clientY - rect.top) / rect.height * VIEW_HEIGHT;
  const center = canvasPoint([18, 22])[1];
  return Math.min(0.995, Math.max(0.005, 0.5 - (y - center) / 80));
}

function bindInteractions(): void {
  document.querySelectorAll<SVGGElement>("[data-component-id]").forEach((element) => {
    element.addEventListener("click", () => selectComponent(element.dataset.componentId ?? "c6"));
    element.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") selectComponent(element.dataset.componentId ?? "c6"); });
  });
  const potHit = must<SVGPathElement>("#pot-hit");
  potHit.addEventListener("pointerdown", (event) => {
    draggingPot = true;
    if (!holdCommitted) traceHold = [];
    holdCommitted = false;
    holdOffer = false;
    potHit.setPointerCapture(event.pointerId);
    updatePot(pointerToPot(event));
  });
  potHit.addEventListener("pointermove", (event) => { if (draggingPot) updatePot(pointerToPot(event)); });
  const finishDrag = (event: PointerEvent) => {
    if (!draggingPot) return;
    draggingPot = false;
    if (potHit.hasPointerCapture(event.pointerId)) potHit.releasePointerCapture(event.pointerId);
    if (traceHold.length > 200) traceHold = traceHold.filter((_, index) => index % Math.ceil(traceHold.length / 200) === 0).slice(0, 200);
    holdOffer = traceHold.length > 1;
    updateDisplay();
  };
  potHit.addEventListener("pointerup", finishDrag);
  potHit.addEventListener("pointercancel", finishDrag);

  document.querySelectorAll<SVGPathElement>("[data-wire-hit]").forEach((element) => {
    element.addEventListener("pointerenter", (event) => {
      const wire = element.dataset.wireHit ?? "";
      hoveredNode = generated.wireNodes[wire];
      const voltage = hoveredNode === "0" ? 0 : scalar(visualResult, `v(${hoveredNode})`);
      showHover(event, `Net ${hoveredNode ?? "?"} · ${formatEngineering(voltage, "V", 5).value} ${formatEngineering(voltage, "V", 5).unit}`);
      updateDisplay();
    });
    element.addEventListener("pointermove", (event) => moveHover(event));
    element.addEventListener("pointerleave", () => { hoveredNode = undefined; hoverReadout.classList.remove("visible"); updateDisplay(); });
  });
  document.querySelectorAll<SVGCircleElement>("[data-component-pin]").forEach((element) => {
    element.addEventListener("pointerenter", (event) => {
      const [id = "", pinText = "0"] = (element.dataset.componentPin ?? "").split(":");
      const component = circuit.components.find((entry) => entry.id === id);
      const voltage = pinVoltage(id, Number(pinText));
      const current = component ? componentCurrent(component) : undefined;
      showHover(event, `Pin ${Number(pinText) + 1} · V ${formatEngineering(voltage, "V", 5).value} ${formatEngineering(voltage, "V", 5).unit} · I ${formatEngineering(current, "A", 5).value} ${formatEngineering(current, "A", 5).unit}`);
    });
    element.addEventListener("pointermove", moveHover);
    element.addEventListener("pointerleave", () => hoverReadout.classList.remove("visible"));
  });

  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.addEventListener("click", () => {
    const mode = button.dataset.mode as AnalysisMode;
    circuit.sim.mode = mode;
    document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((entry) => entry.setAttribute("aria-selected", String(entry === button)));
    void simulate();
  }));
  must<HTMLButtonElement>("#scope-toggle").addEventListener("click", () => {
    shell.classList.toggle("scope-collapsed");
    must<HTMLButtonElement>("#scope-toggle").textContent = shell.classList.contains("scope-collapsed") ? "Open scope" : "Close scope";
  });
  must<HTMLButtonElement>("#keep-hold").addEventListener("click", () => { holdCommitted = true; holdOffer = false; updateDisplay(); });
  must<HTMLButtonElement>("#copy-link").addEventListener("click", async () => {
    const url = shareUrl(circuit);
    if (url.length > 8000) setStatus("Share URL is long. JSON export is recommended.", "error");
    try { await navigator.clipboard.writeText(url); setStatus("Share link copied", "ready"); }
    catch { history.replaceState(null, "", url); setStatus("Share link placed in the address bar", "ready"); }
  });
  must<HTMLButtonElement>("#export-json").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(circuit, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob); anchor.download = "npn-led-bench.json"; anchor.click(); URL.revokeObjectURL(anchor.href);
  });
  must<HTMLButtonElement>("#import-json").addEventListener("click", () => must<HTMLInputElement>("#json-file").click());
  must<HTMLInputElement>("#json-file").addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const loaded = JSON.parse(await file.text()) as CircuitDocument;
      if (loaded.format !== "opencircuit-circuit" || loaded.version !== 1) throw new Error("Unsupported project JSON");
      circuit = loaded; location.href = shareUrl(circuit); location.reload();
    } catch (caught) {
      diagnostics = [{ stage: "parse", message: caught instanceof Error ? caught.message : String(caught) }]; updateDisplay();
    }
  });
}

function showHover(event: PointerEvent, text: string): void {
  hoverReadout.textContent = text;
  hoverReadout.classList.add("visible");
  moveHover(event);
}

function moveHover(event: PointerEvent): void {
  const wrap = must<HTMLElement>("#canvas-wrap").getBoundingClientRect();
  hoverReadout.style.left = `${Math.min(wrap.width - 260, event.clientX - wrap.left + 12)}px`;
  hoverReadout.style.top = `${Math.max(6, event.clientY - wrap.top - 28)}px`;
}

async function boot(): Promise<void> {
  bindInteractions();
  updatePotGraphic(Number(circuit.components.find((component) => component.id === "c2")?.params?.t ?? 0.5));
  renderInspector();
  try {
    const ready = await client.ready;
    window.__ocMetrics.engineInitMs = ready.initMs;
    engineLabel = ready.engine;
    setTimeout(() => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const engineResource = resources.filter((entry) => /worker|sim-engine|eecircuit/i.test(entry.name)).sort((a, b) => b.encodedBodySize - a.encodedBodySize)[0];
      window.__ocMetrics.wasmTransferSize = engineResource?.transferSize || engineResource?.encodedBodySize || 0;
    }, 0);
    await simulate();
  } catch (caught) {
    diagnostics = [{ stage: "engine", message: caught instanceof Error ? caught.message : String(caught) }];
    setStatus(diagnostics[0]!.message, "error");
    updateDisplay();
  }
  if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
}

void boot();
window.addEventListener("beforeunload", () => { pulseRenderer.dispose(); client.dispose(); });
