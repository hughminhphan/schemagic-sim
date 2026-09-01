import type {
  DCSweepResultMetadata,
  NoiseResultMetadata,
  SimulationEngineIdentityV1,
  SimulationExecutionReceiptIssueCodeV1,
  SimulationExecutionReceiptV1,
  SimulationRequestType,
  SimulationResult,
  VectorMeta,
} from "./types";

export const SIMULATION_ENGINE_IDENTITY_V1: Readonly<SimulationEngineIdentityV1> = Object.freeze({
  id: "@opencircuit/ngspice-wasm",
  buildVersion: "ngspice-46-opencircuit-wasm1",
  simulatorVersion: "ngspice-46",
  solver: "KLU",
  numericFormat: "ieee754-binary64",
});

const HASH = /^sha256:[0-9a-f]{64}$/u;
const KINDS = new Set<VectorMeta["kind"]>([
  "voltage",
  "current",
  "time",
  "frequency",
  "sweep",
  "output-noise-density",
  "input-noise-density",
  "unknown",
]);
const REQUEST_TYPES = new Set<SimulationRequestType>([
  "runOpPoint",
  "runDCSweep",
  "runTransient",
  "runAC",
  "runNoise",
]);

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

function canonicalValue(value: unknown): CanonicalValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Simulation provenance metadata must be finite");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) result[key] = canonicalValue(nested);
    }
    return result;
  }
  throw new TypeError("Simulation provenance metadata must be JSON-compatible");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

async function sha256(bytes: Uint8Array): Promise<`sha256:${string}`> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
  return `sha256:${[...digest].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export async function calculateSimulationNetlistContentHashV1(netlist: string): Promise<`sha256:${string}`> {
  if (typeof netlist !== "string" || netlist.length === 0) throw new TypeError("Simulation netlist must be non-empty");
  return sha256(new TextEncoder().encode(netlist));
}

interface SampleMaterialV1 {
  vectors: readonly VectorMeta[];
  data: ReadonlyMap<string, Float64Array>;
  rawfileBytes: number;
  sweep?: DCSweepResultMetadata;
  noise?: NoiseResultMetadata;
}

function validatedVectors(material: Readonly<SampleMaterialV1>): {
  vectors: VectorMeta[];
  arrays: Float64Array[];
  scalarSampleCount: number;
} {
  if (!Number.isSafeInteger(material.rawfileBytes) || material.rawfileBytes <= 0) {
    throw new TypeError("Simulation rawfile size must be a positive safe integer");
  }
  if (material.vectors.length === 0 || material.data.size !== material.vectors.length) {
    throw new TypeError("Simulation vectors and data must be complete");
  }
  const names = new Set<string>();
  const arrays: Float64Array[] = [];
  let scalarSampleCount = 0;
  const vectors = material.vectors.map((vector, index) => {
    if (!vector || typeof vector.name !== "string" || vector.name.length === 0
      || vector.name !== vector.name.toLowerCase() || /[\u0000-\u001f\u007f-\u009f]/u.test(vector.name)
      || !KINDS.has(vector.kind) || !Number.isSafeInteger(vector.length) || vector.length <= 0
      || typeof vector.complex !== "boolean" || vector.bufferIndex !== index || names.has(vector.name)) {
      throw new TypeError("Simulation vector contract is invalid");
    }
    names.add(vector.name);
    const values = material.data.get(vector.name);
    const expectedLength = vector.length * (vector.complex ? 2 : 1);
    if (!(values instanceof Float64Array) || values.length !== expectedLength) {
      throw new TypeError("Simulation vector data length is invalid");
    }
    for (const value of values) if (!Number.isFinite(value)) throw new TypeError("Simulation samples must be finite");
    scalarSampleCount += values.length;
    if (!Number.isSafeInteger(scalarSampleCount)) throw new TypeError("Simulation sample count exceeds safe integer range");
    arrays.push(values);
    return { ...vector };
  });
  for (const key of material.data.keys()) if (!names.has(key)) throw new TypeError("Simulation data has an undeclared vector");
  return { vectors, arrays, scalarSampleCount };
}

async function calculateSampleContentHash(material: Readonly<SampleMaterialV1>): Promise<{
  hash: `sha256:${string}`;
  vectorCount: number;
  scalarSampleCount: number;
}> {
  const validated = validatedVectors(material);
  const header = new TextEncoder().encode(canonicalJson({
    format: "opencircuit-simulation-samples",
    schemaVersion: 1,
    vectors: validated.vectors,
    rawfileBytes: material.rawfileBytes,
    ...(material.sweep === undefined ? {} : { sweep: material.sweep }),
    ...(material.noise === undefined ? {} : { noise: material.noise }),
  }));
  const prefix = new TextEncoder().encode("opencircuit-simulation-samples-v1\u0000");
  const headerLength = new Uint8Array(8);
  new DataView(headerLength.buffer).setBigUint64(0, BigInt(header.byteLength));
  const bytes = new Uint8Array(prefix.byteLength + headerLength.byteLength + header.byteLength + validated.scalarSampleCount * 8);
  bytes.set(prefix, 0);
  bytes.set(headerLength, prefix.byteLength);
  bytes.set(header, prefix.byteLength + headerLength.byteLength);
  const view = new DataView(bytes.buffer);
  let offset = prefix.byteLength + headerLength.byteLength + header.byteLength;
  for (const values of validated.arrays) for (const value of values) {
    view.setFloat64(offset, value, false);
    offset += 8;
  }
  return {
    hash: await sha256(bytes),
    vectorCount: validated.vectors.length,
    scalarSampleCount: validated.scalarSampleCount,
  };
}

function receiptPayload(receipt: Omit<SimulationExecutionReceiptV1, "contentHash"> | SimulationExecutionReceiptV1): Omit<SimulationExecutionReceiptV1, "contentHash"> {
  const { contentHash: _contentHash, ...payload } = receipt as SimulationExecutionReceiptV1;
  return payload;
}

async function receiptContentHash(receipt: Omit<SimulationExecutionReceiptV1, "contentHash"> | SimulationExecutionReceiptV1): Promise<`sha256:${string}`> {
  return sha256(new TextEncoder().encode(canonicalJson(receiptPayload(receipt))));
}

/** @internal The worker is the only production caller that may mint a receipt. */
export async function _createSimulationExecutionReceiptV1(input: Readonly<{
  requestType: SimulationRequestType;
  netlist: string;
  vectors: readonly VectorMeta[];
  data: ReadonlyMap<string, Float64Array>;
  rawfileBytes: number;
  sweep?: DCSweepResultMetadata;
  noise?: NoiseResultMetadata;
}>): Promise<SimulationExecutionReceiptV1> {
  if (!REQUEST_TYPES.has(input.requestType)) throw new TypeError("Simulation request type is invalid");
  const samples = await calculateSampleContentHash(input);
  const payload: Omit<SimulationExecutionReceiptV1, "contentHash"> = {
    format: "opencircuit-simulation-execution-receipt",
    schemaVersion: 1,
    engine: { ...SIMULATION_ENGINE_IDENTITY_V1 },
    executionHost: "local_worker",
    attestation: "none",
    requestType: input.requestType,
    netlistContentHash: await calculateSimulationNetlistContentHashV1(input.netlist),
    sampleContentHash: samples.hash,
    vectorCount: samples.vectorCount,
    scalarSampleCount: samples.scalarSampleCount,
    rawfileBytes: input.rawfileBytes,
  };
  return Object.freeze({ ...payload, contentHash: await receiptContentHash(payload) });
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validReceiptShape(receipt: unknown): receipt is SimulationExecutionReceiptV1 {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
  const value = receipt as Record<string, unknown>;
  if (!exactKeys(value, [
    "format", "schemaVersion", "engine", "executionHost", "attestation", "requestType",
    "netlistContentHash", "sampleContentHash", "vectorCount", "scalarSampleCount",
    "rawfileBytes", "contentHash",
  ])) return false;
  const engine = value.engine;
  return value.format === "opencircuit-simulation-execution-receipt"
    && value.schemaVersion === 1
    && value.executionHost === "local_worker"
    && value.attestation === "none"
    && REQUEST_TYPES.has(value.requestType as SimulationRequestType)
    && typeof value.netlistContentHash === "string" && HASH.test(value.netlistContentHash)
    && typeof value.sampleContentHash === "string" && HASH.test(value.sampleContentHash)
    && typeof value.contentHash === "string" && HASH.test(value.contentHash)
    && Number.isSafeInteger(value.vectorCount) && (value.vectorCount as number) > 0
    && Number.isSafeInteger(value.scalarSampleCount) && (value.scalarSampleCount as number) > 0
    && Number.isSafeInteger(value.rawfileBytes) && (value.rawfileBytes as number) > 0
    && !!engine && typeof engine === "object" && !Array.isArray(engine)
    && exactKeys(engine as Record<string, unknown>, ["id", "buildVersion", "simulatorVersion", "solver", "numericFormat"]);
}

/** Verify closed receipt shape plus exact vector/sample and receipt hashes. */
export async function verifySimulationExecutionReceiptV1(
  result: Readonly<SimulationResult>,
): Promise<readonly SimulationExecutionReceiptIssueCodeV1[]> {
  if (!validReceiptShape(result.receipt)) return Object.freeze(["invalid_receipt"]);
  if (canonicalJson(result.receipt.engine) !== canonicalJson(SIMULATION_ENGINE_IDENTITY_V1)) {
    return Object.freeze(["engine_identity_mismatch"]);
  }
  let samples: Awaited<ReturnType<typeof calculateSampleContentHash>>;
  try {
    samples = await calculateSampleContentHash(result);
  } catch {
    return Object.freeze(["vector_contract_invalid"]);
  }
  if (samples.vectorCount !== result.receipt.vectorCount
    || samples.scalarSampleCount !== result.receipt.scalarSampleCount
    || result.rawfileBytes !== result.receipt.rawfileBytes
    || samples.hash !== result.receipt.sampleContentHash) {
    return Object.freeze(["sample_hash_mismatch"]);
  }
  if (await receiptContentHash(result.receipt) !== result.receipt.contentHash) {
    return Object.freeze(["receipt_hash_mismatch"]);
  }
  return Object.freeze([]);
}
