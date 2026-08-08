/// <reference lib="webworker" />

import { createNgspiceEngine, NGSPICE_VERSION } from "../../../tools/ngspice-wasm-build/dist-loader/index.mjs";
import { classifyEngineError, parseEngineDiagnostics } from "./diagnostics";
import { parseBinaryRawfile, parseDCSweepRawfile } from "./rawfile";
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
  stdout: string;
  stderr: string;
  timingMs: number;
}

interface NgspiceEngine {
  runNetlist(netlist: string): Promise<NgspiceRunResult>;
  getInitInfo(): string;
  readonly memoryBytes: number;
}

let simulator: NgspiceEngine;
let running = false;

function post(response: SimulationResponse, transfer: Transferable[] = []): void {
  scope.postMessage(response, transfer);
}

function protocolError(id: number, error: SimulationProtocolError): WorkerErrorResponse {
  return { id, type: "error", error };
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
    }));
    return;
  }
  running = true;
  const started = performance.now();
  try {
    validateNetlist(request.netlist);
    const runResult = await simulator.runNetlist(request.netlist);
    const info = `${runResult.stdout}\n${runResult.stderr}`;
    const diagnostics = parseEngineDiagnostics(request.netlist, info);
    const fatalDiagnostics = diagnostics.filter((entry) => /fatal|error|converg|singular/i.test(entry.message));
    if (fatalDiagnostics.length > 0) {
      const message = fatalDiagnostics.at(-1)?.message ?? "Simulation failed";
      post(protocolError(request.id, { code: classifyEngineError(message), message, diagnostics }));
      return;
    }

    if (simulator.memoryBytes > 256 * 1024 * 1024) throw new Error("WASM memory exceeds 256 MiB limit");
    const rawfileLimits = {
      ...(request.limits?.maxRawfileBytes ? { maxRawfileBytes: request.limits.maxRawfileBytes } : {}),
      ...(request.limits?.maxSamples ? { maxSamples: request.limits.maxSamples } : {}),
    };
    const parsed = request.type === "runDCSweep"
      ? parseDCSweepRawfile(runResult.rawfile, request.sweep, rawfileLimits)
      : parseBinaryRawfile(runResult.rawfile, rawfileLimits);
    const response: SimulationResponse = {
      id: request.id,
      type: "result",
      vectors: parsed.vectors,
      buffers: parsed.buffers,
      elapsedMs: performance.now() - started,
      rawfileBytes: parsed.bytes,
      ...(request.type === "runDCSweep" && "sweep" in parsed ? { sweep: parsed.sweep as import("./types").DCSweepResultMetadata } : {}),
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
    }));
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
