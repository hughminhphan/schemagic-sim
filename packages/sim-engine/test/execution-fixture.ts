import { SIMULATION_ENGINE_IDENTITY_V1 } from "../src/provenance";
import type { SimulationExecutionReceiptV1, SimulationRequestType } from "../src/types";

const EMPTY_SHA256 = "sha256:0000000000000000000000000000000000000000000000000000000000000000" as const;

export function testExecutionReceipt(
  requestType: SimulationRequestType,
  rawfileBytes = 1,
): SimulationExecutionReceiptV1 {
  return {
    format: "opencircuit-simulation-execution-receipt",
    schemaVersion: 1,
    engine: { ...SIMULATION_ENGINE_IDENTITY_V1 },
    executionHost: "local_worker",
    attestation: "none",
    requestType,
    netlistContentHash: EMPTY_SHA256,
    sampleContentHash: EMPTY_SHA256,
    vectorCount: 1,
    scalarSampleCount: 1,
    rawfileBytes,
    contentHash: EMPTY_SHA256,
  };
}
