import type {
  DCSweepRunSpec,
  NoiseRunSpec,
  SimulationLimits,
  SimulationProtocolError,
  SimulationRequest,
  SimulationRequestType,
  SimulationResponse,
  SimulationResult,
  WorkerReadyResponse,
} from "./types";

export class SimulationFailure extends Error {
  readonly detail: SimulationProtocolError;

  constructor(detail: SimulationProtocolError) {
    super(detail.message);
    this.name = "SimulationFailure";
    this.detail = detail;
  }
}

interface WorkerSlot {
  worker: Worker;
  ready: Promise<WorkerReadyResponse>;
}

interface PendingRun {
  request: SimulationRequest;
  resolve: (result: SimulationResult) => void;
  reject: (error: SimulationFailure) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class SimulationClient {
  private current: WorkerSlot;
  private spare: WorkerSlot;
  private nextId = 1;
  private active: PendingRun | undefined;
  private queued: PendingRun | undefined;
  private disposed = false;

  readonly ready: Promise<WorkerReadyResponse>;

  constructor() {
    this.current = this.createSlot();
    this.spare = this.createSlot();
    this.ready = this.current.ready;
  }

  runOpPoint(netlist: string, limits?: SimulationLimits): Promise<SimulationResult> {
    return this.enqueue("runOpPoint", netlist, limits);
  }

  runDCSweep(netlist: string, sweep: DCSweepRunSpec, limits?: SimulationLimits): Promise<SimulationResult> {
    return this.enqueue("runDCSweep", netlist, limits, sweep);
  }

  runTransient(netlist: string, limits?: SimulationLimits): Promise<SimulationResult> {
    return this.enqueue("runTransient", netlist, limits);
  }

  runAC(netlist: string, limits?: SimulationLimits): Promise<SimulationResult> {
    return this.enqueue("runAC", netlist, limits);
  }

  runNoise(netlist: string, noise: NoiseRunSpec, limits?: SimulationLimits): Promise<SimulationResult> {
    return this.enqueue("runNoise", netlist, limits, undefined, noise);
  }

  cancel(): void {
    if (!this.active && !this.queued) return;
    const failure = new SimulationFailure({
      code: "CANCELLED",
      message: "Simulation cancelled",
      diagnostics: [{ stage: "engine", message: "The worker was terminated and replaced" }],
    });
    if (this.active?.timer) clearTimeout(this.active.timer);
    this.active?.reject(failure);
    this.queued?.reject(failure);
    this.active = undefined;
    this.queued = undefined;
    this.current.worker.terminate();
    this.current = this.spare;
    this.spare = this.createSlot();
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
    this.current.worker.terminate();
    this.spare.worker.terminate();
  }

  private createSlot(): WorkerSlot {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "opencircuit-sim" });
    let settleReady: ((response: WorkerReadyResponse) => void) | undefined;
    let rejectReady: ((error: Error) => void) | undefined;
    const ready = new Promise<WorkerReadyResponse>((resolve, reject) => {
      settleReady = resolve;
      rejectReady = reject;
    });
    worker.addEventListener("message", (event: MessageEvent<SimulationResponse>) => {
      const response = event.data;
      if (response.type === "ready") settleReady?.(response);
      else if (response.type === "error" && response.id === 0) rejectReady?.(new SimulationFailure(response.error));
      this.handleResponse(worker, response);
    });
    worker.addEventListener("error", (event) => {
      rejectReady?.(new Error(event.message));
      if (this.current?.worker === worker && this.active) {
        const job = this.active;
        this.active = undefined;
        job.reject(new SimulationFailure({
          code: "ENGINE",
          message: event.message || "Simulation worker crashed",
          diagnostics: [{ stage: "engine", message: event.message || "Simulation worker crashed" }],
        }));
        this.dispatchQueued();
      }
    });
    return { worker, ready };
  }

  private enqueue(type: SimulationRequestType, netlist: string, limits?: SimulationLimits, sweep?: DCSweepRunSpec, noise?: NoiseRunSpec): Promise<SimulationResult> {
    if (this.disposed) return Promise.reject(new SimulationFailure({ code: "CANCELLED", message: "Simulation client is disposed", diagnostics: [] }));
    const id = this.nextId++;
    const request: SimulationRequest = type === "runDCSweep"
      ? { id, type, netlist, sweep: sweep!, ...(limits ? { limits } : {}) }
      : type === "runNoise"
        ? { id, type, netlist, noise: noise!, ...(limits ? { limits } : {}) }
        : { id, type, netlist, ...(limits ? { limits } : {}) };
    return new Promise<SimulationResult>((resolve, reject) => {
      const job: PendingRun = { request, resolve, reject };
      if (this.active) {
        this.queued?.reject(new SimulationFailure({
          code: "CANCELLED",
          message: "Simulation replaced by a newer request",
          diagnostics: [{ stage: "engine", message: "A queued request was replaced before it started" }],
        }));
        this.queued = job;
      } else {
        this.active = job;
        void this.dispatch(job);
      }
    });
  }

  private async dispatch(job: PendingRun): Promise<void> {
    try {
      await this.current.ready;
      if (this.active !== job || this.disposed) return;
      const fallback = job.request.type === "runOpPoint" ? 2000 : 10_000;
      const timeoutMs = job.request.limits?.timeoutMs ?? fallback;
      job.timer = setTimeout(() => {
        if (this.active === job) this.cancel();
      }, timeoutMs);
      this.current.worker.postMessage(job.request);
    } catch (caught) {
      if (this.active !== job) return;
      this.active = undefined;
      job.reject(caught instanceof SimulationFailure ? caught : new SimulationFailure({
        code: "ENGINE",
        message: caught instanceof Error ? caught.message : String(caught),
        diagnostics: [{ stage: "engine", message: "Simulation worker did not become ready" }],
      }));
      this.dispatchQueued();
    }
  }

  private handleResponse(worker: Worker, response: SimulationResponse): void {
    if (response.type === "ready" || worker !== this.current.worker) return;
    const job = this.active;
    if (!job || response.id !== job.request.id) return;
    if (job.timer) clearTimeout(job.timer);
    this.active = undefined;
    if (response.type === "error") {
      job.reject(new SimulationFailure(response.error));
    } else {
      const data = new Map<string, Float64Array>();
      for (const vector of response.vectors) {
        const buffer = response.buffers[vector.bufferIndex];
        if (buffer) data.set(vector.name.toLowerCase(), new Float64Array(buffer));
      }
      job.resolve({
        vectors: response.vectors,
        data,
        elapsedMs: response.elapsedMs,
        rawfileBytes: response.rawfileBytes,
        receipt: response.receipt,
        ...(response.sweep ? { sweep: response.sweep } : {}),
        ...(response.noise ? { noise: response.noise } : {}),
      });
    }
    this.dispatchQueued();
  }

  private dispatchQueued(): void {
    if (!this.queued || this.active || this.disposed) return;
    const next = this.queued;
    this.queued = undefined;
    this.active = next;
    void this.dispatch(next);
  }
}
