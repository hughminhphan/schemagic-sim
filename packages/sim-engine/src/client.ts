import { createRunProvenance, effectiveSimulationLimits } from "./identity";
import type {
  DCSweepRunSpec,
  NoiseRunSpec,
  SimulationCancellationReason,
  SimulationExecutionOptions,
  SimulationProtocolError,
  SimulationRequest,
  SimulationRequestType,
  SimulationResponse,
  SimulationResult,
  WorkerReadyResponse,
} from "./types";

export interface SimulationWorkerLike {
  addEventListener(type: "message", listener: (event: MessageEvent<SimulationResponse>) => void): void;
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  postMessage(message: SimulationRequest): void;
  terminate(): void;
}

export type SimulationWorkerFactory = () => SimulationWorkerLike;

export interface SimulationClientOptions {
  workerFactory?: SimulationWorkerFactory;
}

export class SimulationFailure extends Error {
  readonly detail: SimulationProtocolError;

  constructor(detail: SimulationProtocolError) {
    super(detail.message);
    this.name = "SimulationFailure";
    this.detail = detail;
  }
}

interface WorkerSlot {
  worker: SimulationWorkerLike;
  ready: Promise<WorkerReadyResponse>;
}

interface PendingRun {
  request: SimulationRequest;
  resolve: (result: SimulationResult) => void;
  reject: (error: SimulationFailure) => void;
  queuedAt: number;
  dispatchedAt?: number;
  timer?: ReturnType<typeof setTimeout>;
  removeAbort?: () => void;
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function cancellation(job: PendingRun, reason: SimulationCancellationReason, message: string): SimulationFailure {
  return new SimulationFailure({
    code: "CANCELLED",
    message,
    cancellationReason: reason,
    provenance: job.request.provenance,
    diagnostics: [{ stage: "engine", message }],
  });
}

export class SimulationClient {
  private current: WorkerSlot;
  private spare: WorkerSlot;
  private nextId = 1;
  private active: PendingRun | undefined;
  private queued: PendingRun | undefined;
  private disposed = false;
  private cancellationEpoch = 0;
  private preparation: Promise<void> = Promise.resolve();
  private readonly workerFactory: SimulationWorkerFactory;

  readonly ready: Promise<WorkerReadyResponse>;

  constructor(options: SimulationClientOptions = {}) {
    this.workerFactory = options.workerFactory ?? (() => new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "opencircuit-sim" }));
    this.current = this.createSlot();
    this.spare = this.createSlot();
    this.ready = this.current.ready;
  }

  runOpPoint(netlist: string, options?: SimulationExecutionOptions): Promise<SimulationResult> {
    return this.enqueue("runOpPoint", netlist, options);
  }

  runDCSweep(netlist: string, sweep: DCSweepRunSpec, options?: SimulationExecutionOptions): Promise<SimulationResult> {
    return this.enqueue("runDCSweep", netlist, options, sweep);
  }

  runTransient(netlist: string, options?: SimulationExecutionOptions): Promise<SimulationResult> {
    return this.enqueue("runTransient", netlist, options);
  }

  runAC(netlist: string, options?: SimulationExecutionOptions): Promise<SimulationResult> {
    return this.enqueue("runAC", netlist, options);
  }

  runNoise(netlist: string, noise: NoiseRunSpec, options?: SimulationExecutionOptions): Promise<SimulationResult> {
    return this.enqueue("runNoise", netlist, options, undefined, noise);
  }

  /** Cancel all work explicitly requested by the caller. AbortSignal cancels only its associated run. */
  cancel(): void {
    this.cancellationEpoch += 1;
    if (!this.active && !this.queued) return;
    if (this.active) this.finishFailure(this.active, cancellation(this.active, "user", "Simulation cancelled by user"));
    if (this.queued) this.finishFailure(this.queued, cancellation(this.queued, "user", "Queued simulation cancelled by user"));
    this.active = undefined;
    this.queued = undefined;
    if (!this.disposed) this.rotateCurrent();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.active) this.finishFailure(this.active, cancellation(this.active, "disposed", "Simulation client disposed"));
    if (this.queued) this.finishFailure(this.queued, cancellation(this.queued, "disposed", "Simulation client disposed"));
    this.active = undefined;
    this.queued = undefined;
    this.current.worker.terminate();
    this.spare.worker.terminate();
  }

  private createSlot(): WorkerSlot {
    const worker = this.workerFactory();
    let settleReady: ((response: WorkerReadyResponse) => void) | undefined;
    let rejectReady: ((error: Error) => void) | undefined;
    const ready = new Promise<WorkerReadyResponse>((resolve, reject) => {
      settleReady = resolve;
      rejectReady = reject;
    });
    worker.addEventListener("message", (event) => {
      const response = event.data;
      if (response.type === "ready") settleReady?.(response);
      else if (response.type === "error" && response.id === 0) rejectReady?.(new SimulationFailure(response.error));
      this.handleResponse(worker, response);
    });
    worker.addEventListener("error", (event) => {
      const message = event.message || "Simulation worker crashed";
      rejectReady?.(new Error(message));
      this.handleWorkerCrash(worker, message);
    });
    return { worker, ready };
  }

  private enqueue(
    type: SimulationRequestType,
    netlist: string,
    options: SimulationExecutionOptions = {},
    sweep?: DCSweepRunSpec,
    noise?: NoiseRunSpec,
  ): Promise<SimulationResult> {
    if (this.disposed) return Promise.reject(new SimulationFailure({ code: "CANCELLED", message: "Simulation client is disposed", cancellationReason: "disposed", diagnostics: [] }));
    const id = this.nextId++;
    const requestedAt = now();
    const cancellationEpoch = this.cancellationEpoch;
    return new Promise<SimulationResult>((resolve, reject) => {
      const prepare = async () => {
        try {
          const limits = effectiveSimulationLimits(type, options);
          const provenance = await createRunProvenance({ type, netlist, limits, ...(sweep ? { sweep } : {}), ...(noise ? { noise } : {}) });
          const request: SimulationRequest = type === "runDCSweep"
            ? { id, type, netlist, limits, provenance, sweep: sweep! }
            : type === "runNoise"
              ? { id, type, netlist, limits, provenance, noise: noise! }
              : { id, type, netlist, limits, provenance };
          const job: PendingRun = { request, resolve, reject, queuedAt: requestedAt };
          if (this.disposed) {
            reject(cancellation(job, "disposed", "Simulation client disposed"));
            return;
          }
          if (cancellationEpoch !== this.cancellationEpoch) {
            reject(cancellation(job, "user", "Simulation cancelled by user"));
            return;
          }
          if (options.signal?.aborted) {
            reject(cancellation(job, "user", "Simulation aborted before it started"));
            return;
          }
          if (options.signal) {
            const onAbort = () => this.abortJob(job);
            options.signal.addEventListener("abort", onAbort, { once: true });
            job.removeAbort = () => options.signal?.removeEventListener("abort", onAbort);
          }
          this.schedule(job, options.scheduling ?? "queue-latest");
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught);
          reject(caught instanceof SimulationFailure ? caught : new SimulationFailure({
            code: /limit|positive safe integer/i.test(message) ? "LIMIT" : "ENGINE",
            message,
            diagnostics: [{ stage: /limit|positive safe integer/i.test(message) ? "limit" : "settings", message }],
          }));
        }
      };
      this.preparation = this.preparation.then(prepare, prepare);
    });
  }

  private schedule(job: PendingRun, scheduling: NonNullable<SimulationExecutionOptions["scheduling"]>): void {
    if (!this.active) {
      this.active = job;
      void this.dispatch(job);
      return;
    }
    if (this.queued) this.finishFailure(this.queued, cancellation(this.queued, "superseded", "Queued simulation superseded by a newer request"));
    this.queued = job;
    if (scheduling === "replace-active") {
      const stale = this.active;
      this.active = undefined;
      this.finishFailure(stale, cancellation(stale, "superseded", "Active simulation superseded by a newer request"));
      this.rotateCurrent();
      this.dispatchQueued();
    }
  }

  private abortJob(job: PendingRun): void {
    if (this.queued === job) {
      this.queued = undefined;
      this.finishFailure(job, cancellation(job, "user", "Queued simulation aborted"));
      return;
    }
    if (this.active !== job) return;
    this.active = undefined;
    this.finishFailure(job, cancellation(job, "user", "Active simulation aborted"));
    if (!this.disposed) this.rotateCurrent();
    this.dispatchQueued();
  }

  private async dispatch(job: PendingRun): Promise<void> {
    const slot = this.current;
    try {
      await slot.ready;
      if (this.active !== job || this.disposed || slot !== this.current) return;
      job.dispatchedAt = now();
      job.timer = setTimeout(() => {
        if (this.active !== job) return;
        this.active = undefined;
        this.finishFailure(job, new SimulationFailure({
          code: "LIMIT",
          message: `Simulation exceeded the ${job.request.limits.timeoutMs} ms time limit`,
          provenance: job.request.provenance,
          diagnostics: [{ stage: "limit", message: "The active worker was terminated after its time budget elapsed" }],
        }));
        if (!this.disposed) this.rotateCurrent();
        this.dispatchQueued();
      }, job.request.limits.timeoutMs);
      slot.worker.postMessage(job.request);
    } catch (caught) {
      if (this.active !== job) return;
      this.active = undefined;
      const message = caught instanceof Error ? caught.message : String(caught);
      this.finishFailure(job, caught instanceof SimulationFailure ? caught : new SimulationFailure({
        code: "ENGINE",
        message,
        provenance: job.request.provenance,
        diagnostics: [{ stage: "engine", message: "Simulation worker did not become ready" }],
      }));
      if (!this.disposed && slot === this.current) this.rotateCurrent();
      this.dispatchQueued();
    }
  }

  private handleResponse(worker: SimulationWorkerLike, response: SimulationResponse): void {
    if (response.type === "ready" || worker !== this.current.worker) return;
    const job = this.active;
    if (!job || response.id !== job.request.id) return;
    if (response.type === "error") {
      this.active = undefined;
      const detail = { ...response.error, provenance: response.provenance ?? response.error.provenance ?? job.request.provenance };
      this.finishFailure(job, new SimulationFailure(detail));
      this.dispatchQueued();
      return;
    }
    if (response.provenance.runKey !== job.request.provenance.runKey) {
      this.active = undefined;
      this.finishFailure(job, new SimulationFailure({
        code: "ENGINE",
        message: "Worker returned mismatched run provenance",
        provenance: job.request.provenance,
        diagnostics: [{ stage: "engine", message: "The result did not match the exact submitted netlist and request" }],
      }));
      if (!this.disposed) this.rotateCurrent();
      this.dispatchQueued();
      return;
    }
    this.active = undefined;
    const data = new Map<string, Float64Array>();
    for (const vector of response.vectors) {
      const buffer = response.buffers[vector.bufferIndex];
      if (buffer) data.set(vector.name.toLowerCase(), new Float64Array(buffer));
    }
    this.finishSuccess(job, {
      provenance: response.provenance,
      vectors: response.vectors,
      data,
      elapsedMs: response.elapsedMs,
      engineMs: response.engineMs,
      parseMs: response.parseMs,
      queueMs: Math.max(0, (job.dispatchedAt ?? job.queuedAt) - job.queuedAt),
      rawfileBytes: response.rawfileBytes,
      ...(response.sweep ? { sweep: response.sweep } : {}),
      ...(response.noise ? { noise: response.noise } : {}),
    });
    this.dispatchQueued();
  }

  private handleWorkerCrash(worker: SimulationWorkerLike, message: string): void {
    if (worker === this.current?.worker) {
      const job = this.active;
      this.active = undefined;
      if (job) this.finishFailure(job, new SimulationFailure({
        code: "ENGINE",
        message,
        provenance: job.request.provenance,
        diagnostics: [{ stage: "engine", message }],
      }));
      if (!this.disposed) this.rotateCurrent();
      this.dispatchQueued();
      return;
    }
    if (worker === this.spare?.worker && !this.disposed) {
      worker.terminate();
      this.spare = this.createSlot();
    }
  }

  private finishFailure(job: PendingRun, error: SimulationFailure): void {
    if (job.timer) clearTimeout(job.timer);
    job.removeAbort?.();
    job.reject(error);
  }

  private finishSuccess(job: PendingRun, result: SimulationResult): void {
    if (job.timer) clearTimeout(job.timer);
    job.removeAbort?.();
    job.resolve(result);
  }

  private rotateCurrent(): void {
    this.current.worker.terminate();
    if (this.disposed) return;
    this.current = this.spare;
    this.spare = this.createSlot();
  }

  private dispatchQueued(): void {
    if (!this.queued || this.active || this.disposed) return;
    const next = this.queued;
    this.queued = undefined;
    this.active = next;
    void this.dispatch(next);
  }
}
