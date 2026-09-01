import { parentPort } from "node:worker_threads";
import {
  SIMULATION_ENGINE_IDENTITY_V1,
  _createSimulationExecutionReceiptV1,
  verifySimulationExecutionReceiptV1,
} from "../../packages/sim-engine/dist/src/provenance.js";
import { runWasm } from "./lib/run-wasm.mjs";

if (!parentPort) throw new Error("Application golden worker requires a parent worker port");

function receiptMaterial(rawfile, rawfileBytes) {
  const vectors = rawfile.vectors.map((entry, bufferIndex) => ({
    name: entry.name.toLowerCase(),
    kind: entry.name.toLowerCase() === "time"
      ? "time"
      : entry.name.toLowerCase() === "frequency"
        ? "frequency"
        : entry.type === "voltage"
          ? "voltage"
          : entry.type === "current"
            ? "current"
            : "unknown",
    length: entry.values.length,
    complex: false,
    bufferIndex,
  }));
  return {
    vectors,
    data: new Map(rawfile.vectors.map((entry) => [entry.name.toLowerCase(), Float64Array.from(entry.values)])),
    rawfileBytes,
  };
}

parentPort.on("message", async (message) => {
  try {
    if (!message || typeof message !== "object" || !Number.isSafeInteger(message.id)
      || typeof message.netlist !== "string" || message.netlist.length === 0
      || typeof message.engineModule !== "string" || message.engineModule.length === 0
      || (message.requestType !== "runOpPoint" && message.requestType !== "runTransient")) {
      throw new Error("Invalid application golden worker request");
    }
    const wasm = await runWasm({
      netlist: message.netlist,
      timeoutMs: 30_000,
      engineModule: message.engineModule,
    });
    const material = receiptMaterial(wasm.rawfile, wasm.rawfileBytes);
    const receipt = await _createSimulationExecutionReceiptV1({
      requestType: message.requestType,
      netlist: message.netlist,
      ...material,
    });
    const receiptVerificationIssues = await verifySimulationExecutionReceiptV1({
      ...material,
      elapsedMs: 0,
      receipt,
    });
    parentPort.postMessage({
      id: message.id,
      status: "ok",
      rawfile: wasm.rawfile,
      rawfileBytes: wasm.rawfileBytes,
      version: wasm.version,
      ngspiceVersion: wasm.ngspiceVersion,
      engineIdentity: SIMULATION_ENGINE_IDENTITY_V1,
      receipt,
      receiptVerificationIssues,
    });
  } catch (error) {
    parentPort.postMessage({
      id: message?.id,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
