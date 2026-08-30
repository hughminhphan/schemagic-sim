import { describe, expect, it } from "vitest";
import { SimulationClient, type SimulationWorkerLike } from "../src/client";
import type { SimulationRequest, SimulationResponse, WorkerResultResponse } from "../src/types";

class FakeWorker implements SimulationWorkerLike {
  readonly posted: SimulationRequest[] = [];
  terminateCount = 0;
  private readonly messageListeners: Array<(event: MessageEvent<SimulationResponse>) => void> = [];
  private readonly errorListeners: Array<(event: ErrorEvent) => void> = [];

  addEventListener(type: "message", listener: (event: MessageEvent<SimulationResponse>) => void): void;
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  addEventListener(type: "message" | "error", listener: ((event: MessageEvent<SimulationResponse>) => void) | ((event: ErrorEvent) => void)): void {
    if (type === "message") this.messageListeners.push(listener as (event: MessageEvent<SimulationResponse>) => void);
    else this.errorListeners.push(listener as (event: ErrorEvent) => void);
  }

  postMessage(message: SimulationRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  ready(): void {
    this.emit({ id: 0, type: "ready", engine: "fake", initMs: 1 });
  }

  succeed(request = this.posted.at(-1)): void {
    if (!request) throw new Error("No posted request to complete");
    const response: WorkerResultResponse = {
      id: request.id,
      type: "result",
      provenance: request.provenance,
      vectors: [],
      buffers: [],
      elapsedMs: 3,
      engineMs: 2,
      parseMs: 0.5,
      rawfileBytes: 0,
    };
    this.emit(response);
  }

  crash(message = "fake crash"): void {
    for (const listener of this.errorListeners) listener({ message } as ErrorEvent);
  }

  private emit(response: SimulationResponse): void {
    for (const listener of this.messageListeners) listener({ data: response } as MessageEvent<SimulationResponse>);
  }
}

function harness(): { client: SimulationClient; workers: FakeWorker[] } {
  const workers: FakeWorker[] = [];
  const client = new SimulationClient({
    workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      queueMicrotask(() => worker.ready());
      return worker;
    },
  });
  return { client, workers };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for fake worker state");
}

describe("SimulationClient lifecycle", () => {
  it("cancels a run even while its deterministic provenance is being prepared", async () => {
    const { client, workers } = harness();
    const pending = client.runTransient("cancel-before-dispatch\n.end\n");
    const failure = expect(pending).rejects.toMatchObject({ detail: { code: "CANCELLED", cancellationReason: "user", provenance: { requestType: "runTransient" } } });
    client.cancel();
    await failure;
    expect(workers).toHaveLength(2);
    expect(workers[0]!.posted).toHaveLength(0);
    client.dispose();
  });

  it("keeps only the newest queued run and preserves exact result provenance", async () => {
    const { client, workers } = harness();
    await client.ready;
    const first = client.runOpPoint("first\n.end\n");
    await waitFor(() => workers[0]!.posted.length === 1);
    const second = client.runTransient("second\n.end\n");
    const secondFailure = expect(second).rejects.toMatchObject({ detail: { code: "CANCELLED", cancellationReason: "superseded", provenance: { requestType: "runTransient" } } });
    const third = client.runAC("third\n.end\n");
    await secondFailure;
    workers[0]!.succeed(workers[0]!.posted[0]);
    const firstResult = await first;
    await waitFor(() => workers[0]!.posted.length === 2);
    expect(firstResult.provenance.requestType).toBe("runOpPoint");
    workers[0]!.succeed(workers[0]!.posted[1]);
    expect((await third).provenance.requestType).toBe("runAC");
    client.dispose();
  });

  it("replace-active terminates stale work, swaps the warm spare and marks superseded", async () => {
    const { client, workers } = harness();
    await client.ready;
    const stale = client.runTransient("stale\n.end\n");
    const staleFailure = expect(stale).rejects.toMatchObject({ detail: { code: "CANCELLED", cancellationReason: "superseded" } });
    await waitFor(() => workers[0]!.posted.length === 1);
    const latest = client.runTransient("latest\n.end\n", { scheduling: "replace-active" });
    await staleFailure;
    expect(workers[0]!.terminateCount).toBe(1);
    await waitFor(() => workers[1]!.posted.length === 1);
    workers[1]!.succeed();
    expect((await latest).provenance.runKey).toBe(workers[1]!.posted[0]!.provenance.runKey);
    expect(workers).toHaveLength(3);
    client.dispose();
  });

  it("AbortSignal cancels only its active run and dispatches the preserved newest queue", async () => {
    const { client, workers } = harness();
    await client.ready;
    const controller = new AbortController();
    const active = client.runTransient("active\n.end\n", { signal: controller.signal });
    const activeFailure = expect(active).rejects.toMatchObject({ detail: { code: "CANCELLED", cancellationReason: "user" } });
    await waitFor(() => workers[0]!.posted.length === 1);
    const queued = client.runAC("queued\n.end\n");
    await waitFor(() => workers.length === 2);
    controller.abort();
    await activeFailure;
    await waitFor(() => workers[1]!.posted.length === 1);
    workers[1]!.succeed();
    expect((await queued).provenance.requestType).toBe("runAC");
    client.dispose();
  });

  it("reports timeout as LIMIT, rotates the worker and preserves queued work", async () => {
    const { client, workers } = harness();
    await client.ready;
    const timed = client.runTransient("slow\n.end\n", { timeoutMs: 10 });
    const timedFailure = expect(timed).rejects.toMatchObject({ detail: { code: "LIMIT", provenance: { requestType: "runTransient" } } });
    await waitFor(() => workers[0]!.posted.length === 1);
    const queued = client.runOpPoint("next\n.end\n");
    await timedFailure;
    expect(workers[0]!.terminateCount).toBe(1);
    await waitFor(() => workers[1]!.posted.length === 1);
    workers[1]!.succeed();
    await queued;
    client.dispose();
  });

  it("rotates crashes, and dispose rejects work without spawning another worker", async () => {
    const { client, workers } = harness();
    await client.ready;
    const crashed = client.runOpPoint("crash\n.end\n");
    const crashFailure = expect(crashed).rejects.toMatchObject({ detail: { code: "ENGINE", message: "boom", provenance: { requestType: "runOpPoint" } } });
    await waitFor(() => workers[0]!.posted.length === 1);
    const queued = client.runAC("survivor\n.end\n");
    workers[0]!.crash("boom");
    await crashFailure;
    await waitFor(() => workers[1]!.posted.length === 1);
    workers[1]!.succeed();
    await queued;
    const beforeDispose = workers.length;
    const pending = client.runTransient("disposed\n.end\n");
    const disposedFailure = expect(pending).rejects.toMatchObject({ detail: { code: "CANCELLED", cancellationReason: "disposed" } });
    client.dispose();
    await disposedFailure;
    expect(workers).toHaveLength(beforeDispose);
    expect(workers[1]!.terminateCount).toBeGreaterThan(0);
  });
});
