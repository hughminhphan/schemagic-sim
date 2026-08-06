/// <reference lib="webworker" />

import { Simulation } from "eecircuit-engine";
import { classifyEngineError, parseEngineDiagnostics } from "./diagnostics";
import { parseBinaryRawfile } from "./rawfile";
import type {
  SimulationProtocolError,
  SimulationRequest,
  SimulationResponse,
  WorkerErrorResponse,
} from "./types";

const scope = self as DedicatedWorkerGlobalScope;
const MAX_NETLIST_BYTES = 1024 * 1024;
let simulator: Simulation;
let running = false;

interface SpiceFileSystem {
  readFile(path: string): Uint8Array;
  unlink(path: string): void;
}

interface SpiceModule {
  FS: SpiceFileSystem;
}

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
  simulator = new Simulation();
  await simulator.start();
  const init = simulator.getInitInfo();
  const engine = init.match(/ngspice-[^: \n]+/)?.[0] ?? "ngspice-45.2+";
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
    simulator.setNetList(request.netlist);
    await simulator.runSim();
    const engineErrors = simulator.getError();
    const info = `${simulator.getInfo()}\n${engineErrors.join("\n")}`;
    const diagnostics = parseEngineDiagnostics(request.netlist, info);
    if (engineErrors.length > 0 || diagnostics.some((entry) => /fatal|error|converg|singular/i.test(entry.message))) {
      const message = engineErrors.at(-1) ?? diagnostics.at(-1)?.message ?? "Simulation failed";
      post(protocolError(request.id, { code: classifyEngineError(message), message, diagnostics }));
      return;
    }

    const module = simulator.__getSpiceModuleForTests() as SpiceModule | null;
    if (!module?.FS) throw new Error("Engine rawfile filesystem is unavailable");
    const raw = module.FS.readFile("out.raw");
    const parsed = parseBinaryRawfile(raw, {
      ...(request.limits?.maxRawfileBytes ? { maxRawfileBytes: request.limits.maxRawfileBytes } : {}),
      ...(request.limits?.maxSamples ? { maxSamples: request.limits.maxSamples } : {}),
    });
    try {
      module.FS.unlink("out.raw");
    } catch {
      // The next engine run also performs destroy all. Missing cleanup is harmless.
    }
    const response: SimulationResponse = {
      id: request.id,
      type: "result",
      vectors: parsed.vectors,
      buffers: parsed.buffers,
      elapsedMs: performance.now() - started,
      rawfileBytes: parsed.bytes,
    };
    post(response, parsed.buffers);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const code = classifyEngineError(message);
    const diagnostics = parseEngineDiagnostics(request.netlist, `${simulator?.getInfo?.() ?? ""}\n${message}`);
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
