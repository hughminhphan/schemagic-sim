/// <reference lib="webworker" />

import { createNgspiceEngine, ENGINE_VERSION, NGSPICE_VERSION } from "../../../tools/ngspice-wasm-build/dist-loader/index.mjs";
import { classifyEngineError, parseEngineDiagnostics } from "./diagnostics";
import { createRunProvenance, effectiveSimulationLimits, SIM_ENGINE_IDENTITY } from "./identity";
import { parseBinaryRawfile, parseDCSweepRawfile, parseNoiseRawfiles } from "./rawfile";
import type {
  SimulationProtocolError,
  SimulationRequest,
  SimulationResponse,
  WorkerErrorResponse,
} from "./types";

const scope = self as DedicatedWorkerGlobalScope;
const MAX_NETLIST_BYTES = 1024 * 1024;
interface NgspiceRunResult {
  rawfile: Uint8Array;
  integratedRawfile?: Uint8Array;
  stdout: string;
  stderr: string;
  timingMs: number;
}

interface NgspiceEngine {
  runNetlist(netlist: string): Promise<NgspiceRunResult>;
  runNoiseNetlist(netlist: string): Promise<NgspiceRunResult>;
  getInitInfo(): string;
  readonly memoryBytes: number;
}

let simulator: NgspiceEngine;
let running = false;

function post(response: SimulationResponse, transfer: Transferable[] = []): void {
  scope.postMessage(response, transfer);
}

function protocolError(id: number, error: SimulationProtocolError, request?: SimulationRequest): WorkerErrorResponse {
  const provenance = request?.provenance;
  return { id, type: "error", error: provenance ? { ...error, provenance } : error, ...(provenance ? { provenance } : {}) };
}

function validateNetlist(netlist: string): void {
  if (new TextEncoder().encode(netlist).byteLength > MAX_NETLIST_BYTES) {
    throw new Error("Netlist exceeds 1 MiB limit");
  }
  const forbidden = /^\s*\.(?:control|endc|shell|load|include|lib)\b|\b(?:write|wrdata)\s+[/~]|(?:^|\s)[A-Za-z]:\\/im;
  if (forbidden.test(netlist)) {
    throw new Error("Netlist contains a blocked command card or file path");
  }
}

async function initialize(): Promise<void> {
  const started = performance.now();
  if (ENGINE_VERSION !== SIM_ENGINE_IDENTITY) throw new Error(`Engine identity mismatch: loader is ${ENGINE_VERSION}, protocol expects ${SIM_ENGINE_IDENTITY}`);
  simulator = await createNgspiceEngine() as NgspiceEngine;
  const init = simulator.getInitInfo();
  const hasKlu = /klu|suitesparse/i.test(init) || NGSPICE_VERSION === "ngspice-46";
  const engine = `${NGSPICE_VERSION}${hasKlu ? " + KLU" : ""}`;
  post({ id: 0, type: "ready", engine, initMs: performance.now() - started });
}

async function run(request: SimulationRequest): Promise<void> {
  if (running) {
    post(protocolError(request.id, {
      code: "ENGINE",
      message: "Worker accepts one request at a time",
      diagnostics: [{ stage: "engine", message: "A simulation request is already running" }],
    }, request));
    return;
  }
  running = true;
  const started = performance.now();
  try {
    validateNetlist(request.netlist);
    const effectiveLimits = effectiveSimulationLimits(request.type, request.limits);
    if (JSON.stringify(effectiveLimits) !== JSON.stringify(request.limits)) throw new Error("Request limits are not canonical effective limits");
    const expectedProvenance = await createRunProvenance({
      type: request.type,
      netlist: request.netlist,
      limits: request.limits,
      ...(request.type === "runDCSweep" ? { sweep: request.sweep } : {}),
      ...(request.type === "runNoise" ? { noise: request.noise } : {}),
    });
    if (expectedProvenance.runKey !== request.provenance.runKey) throw new Error("Run provenance does not match the exact netlist, request, and effective limits");
    const runResult = request.type === "runNoise"
      ? await simulator.runNoiseNetlist(request.netlist)
      : await simulator.runNetlist(request.netlist);
    const info = `${runResult.stdout}\n${runResult.stderr}`;
    const diagnostics = parseEngineDiagnostics(request.netlist, info);
    const fatalDiagnostics = diagnostics.filter((entry) => /fatal|error|converg|singular/i.test(entry.message));
    if (fatalDiagnostics.length > 0) {
      const message = fatalDiagnostics.at(-1)?.message ?? "Simulation failed";
      post(protocolError(request.id, { code: classifyEngineError(message), message, diagnostics }, request));
      return;
    }

    if (simulator.memoryBytes > 256 * 1024 * 1024) throw new Error("WASM memory exceeds 256 MiB limit");
    const rawfileLimits = { maxRawfileBytes: request.limits.maxRawfileBytes, maxSamples: request.limits.maxSamples };
    const parseStarted = performance.now();
    const parsed = request.type === "runDCSweep"
      ? parseDCSweepRawfile(runResult.rawfile, request.sweep, rawfileLimits)
      : request.type === "runNoise"
        ? parseNoiseRawfiles(runResult.rawfile, runResult.integratedRawfile ?? (() => { throw new Error("Noise analysis did not produce integrated totals"); })(), request.noise, rawfileLimits)
        : parseBinaryRawfile(runResult.rawfile, rawfileLimits);
    const parseMs = performance.now() - parseStarted;
    const response: SimulationResponse = {
      id: request.id,
      type: "result",
      provenance: request.provenance,
      vectors: parsed.vectors,
      buffers: parsed.buffers,
      elapsedMs: performance.now() - started,
      engineMs: runResult.timingMs,
      parseMs,
      rawfileBytes: parsed.bytes,
      ...(request.type === "runDCSweep" && "sweep" in parsed ? { sweep: parsed.sweep as import("./types").DCSweepResultMetadata } : {}),
      ...(request.type === "runNoise" && "noise" in parsed ? { noise: parsed.noise as import("./types").NoiseResultMetadata } : {}),
    };
    post(response, parsed.buffers);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const code = classifyEngineError(message);
    const diagnostics = parseEngineDiagnostics(request.netlist, `${simulator?.getInitInfo?.() ?? ""}\n${message}`);
    post(protocolError(request.id, {
      code,
      message,
      diagnostics: diagnostics.length > 0 ? diagnostics : [{ stage: code === "LIMIT" ? "limit" : "engine", message }],
    }, request));
  } finally {
    running = false;
  }
}

scope.addEventListener("message", (event: MessageEvent<SimulationRequest>) => {
  void run(event.data);
});

void initialize().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  post(protocolError(0, {
    code: "ENGINE",
    message,
    diagnostics: [{ stage: "engine", message: `Engine initialization failed: ${message}` }],
  }));
});
