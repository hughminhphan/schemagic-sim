import { describe, expect, it } from "vitest";
import {
  _createSimulationExecutionReceiptV1,
  SIMULATION_ENGINE_IDENTITY_V1,
  calculateSimulationNetlistContentHashV1,
  verifySimulationExecutionReceiptV1,
} from "../src/provenance";
import { createRunProvenance, effectiveSimulationLimits } from "../src/identity";
import type { SimulationResult, VectorMeta } from "../src/types";

const vectors: VectorMeta[] = [
  { name: "time", kind: "time", length: 3, complex: false, bufferIndex: 0 },
  { name: "v(out)", kind: "voltage", length: 3, complex: false, bufferIndex: 1 },
];

async function result(): Promise<SimulationResult> {
  const data = new Map<string, Float64Array>([
    ["time", Float64Array.from([0, 1e-6, 2e-6])],
    ["v(out)", Float64Array.from([-0, 1 / 3, 1])],
  ]);
  const receipt = await _createSimulationExecutionReceiptV1({
    requestType: "runTransient",
    netlist: "receipt fixture\n.tran 1u 2u\n.end\n",
    vectors,
    data,
    rawfileBytes: 256,
  });
  const limits = effectiveSimulationLimits("runTransient");
  const provenance = await createRunProvenance({
    type: "runTransient",
    netlist: "receipt fixture\n.tran 1u 2u\n.end\n",
    limits,
  });
  return {
    provenance,
    vectors: structuredClone(vectors),
    data,
    elapsedMs: 12.5,
    engineMs: 10,
    parseMs: 1,
    queueMs: 0.5,
    rawfileBytes: 256,
    receipt,
  };
}

describe("simulation execution receipt V1", () => {
  it("binds exact engine, request netlist, vector structure, and finite sample bits deterministically", async () => {
    const first = await result();
    const second = await result();

    expect(second.receipt).toEqual(first.receipt);
    expect(first.receipt.engine).toEqual(SIMULATION_ENGINE_IDENTITY_V1);
    expect(first.receipt.attestation).toBe("none");
    expect(first.receipt.netlistContentHash).toBe(
      await calculateSimulationNetlistContentHashV1("receipt fixture\n.tran 1u 2u\n.end\n"),
    );
    expect(first.receipt.vectorCount).toBe(2);
    expect(first.receipt.scalarSampleCount).toBe(6);
    expect(first.provenance.runKey).toMatch(/^[0-9a-f]{64}$/);
    expect(first.provenance.requestType).toBe(first.receipt.requestType);
    await expect(verifySimulationExecutionReceiptV1(first)).resolves.toEqual([]);
  });

  it("rejects sample, structure, receipt, and engine drift", async () => {
    const sampleDrift = await result();
    sampleDrift.data.get("v(out)")![1] = 0.5;
    await expect(verifySimulationExecutionReceiptV1(sampleDrift)).resolves.toEqual(["sample_hash_mismatch"]);

    const structureDrift = await result();
    structureDrift.vectors[1]!.length = 2;
    await expect(verifySimulationExecutionReceiptV1(structureDrift)).resolves.toEqual(["vector_contract_invalid"]);

    const receiptDrift = await result();
    receiptDrift.receipt = { ...receiptDrift.receipt, rawfileBytes: 257 };
    await expect(verifySimulationExecutionReceiptV1(receiptDrift)).resolves.toEqual(["sample_hash_mismatch"]);

    const engineDrift = await result();
    engineDrift.receipt = {
      ...engineDrift.receipt,
      engine: { ...engineDrift.receipt.engine, solver: "classic" as never },
    };
    await expect(verifySimulationExecutionReceiptV1(engineDrift)).resolves.toEqual(["engine_identity_mismatch"]);
  });

  it("refuses to mint a receipt for non-finite or colliding sample vectors", async () => {
    await expect(_createSimulationExecutionReceiptV1({
      requestType: "runOpPoint",
      netlist: "bad samples\n.op\n.end\n",
      vectors: [{ name: "v(out)", kind: "voltage", length: 1, complex: false, bufferIndex: 0 }],
      data: new Map([["v(out)", Float64Array.from([Number.NaN])]]),
      rawfileBytes: 64,
    })).rejects.toThrow("finite");
    await expect(_createSimulationExecutionReceiptV1({
      requestType: "runOpPoint",
      netlist: "bad names\n.op\n.end\n",
      vectors: [
        { name: "v(out)", kind: "voltage", length: 1, complex: false, bufferIndex: 0 },
        { name: "v(out)", kind: "voltage", length: 1, complex: false, bufferIndex: 1 },
      ],
      data: new Map([["v(out)", Float64Array.from([1])]]),
      rawfileBytes: 64,
    })).rejects.toThrow("complete");
  });
});
