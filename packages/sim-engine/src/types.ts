export type * from "@opencircuit/circuit-schema";

export type SimulationRequestType = "runOpPoint" | "runDCSweep" | "runTransient" | "runAC" | "runNoise";
export interface SimulationLimits { timeoutMs?: number; maxRawfileBytes?: number; maxSamples?: number }
export interface DCSweepSourceSpec { componentId: string; name: string; unit: "V" | "A"; start: number; stop: number; step: number }
export interface DCSweepRunSpec { primary: DCSweepSourceSpec; secondary?: DCSweepSourceSpec }
export interface NoiseOutputSpec { probeId: string; positiveNode: string; negativeNode: "0" }
export interface NoiseInputSourceSpec { componentId: string; name: string; unit: "V" | "A" }
export interface NoiseSweepSpec { sweep: "dec"; pointsPerDecade: number; fstart: number; fstop: number }
export interface NoiseRunSpec { output: NoiseOutputSpec; input: NoiseInputSourceSpec; frequency: NoiseSweepSpec; temperatureC: number }
interface BaseSimulationRequest { id: number; netlist: string; limits?: SimulationLimits }
export type SimulationRequest =
  | (BaseSimulationRequest & { type: "runOpPoint" | "runTransient" | "runAC" })
  | (BaseSimulationRequest & { type: "runDCSweep"; sweep: DCSweepRunSpec })
  | (BaseSimulationRequest & { type: "runNoise"; noise: NoiseRunSpec });
export interface VectorMeta { name: string; kind: "voltage" | "current" | "time" | "frequency" | "sweep" | "output-noise-density" | "input-noise-density" | "unknown"; length: number; complex: boolean; bufferIndex: number }
export interface DCSweepSegment { startIndex: number; length: number; secondaryValue?: number }
export interface DCSweepResultMetadata {
  axisVector: "sweep";
  primary: DCSweepSourceSpec;
  secondary?: DCSweepSourceSpec;
  segments: DCSweepSegment[];
}
export interface NoiseIntegratedTotal {
  rms: number;
  meanSquare: number;
  rmsUnit: "V" | "A";
  meanSquareUnit: "V²" | "A²";
}
export interface NoiseResultMetadata {
  frequencyVector: "frequency";
  outputVector: "onoise_spectrum";
  inputVector: "inoise_spectrum";
  output: NoiseOutputSpec & { densityUnit: "V/√Hz"; total: NoiseIntegratedTotal };
  input: NoiseInputSourceSpec & { densityUnit: "V/√Hz" | "A/√Hz"; total: NoiseIntegratedTotal };
  frequency: NoiseSweepSpec;
  temperatureC: number;
}
export interface SimulationDiagnostic { stage: "parse" | "solve" | "limit" | "engine" | "settings"; message: string; netLine?: number; componentId?: string }
export type SimulationErrorCode = "PARSE" | "CONVERGENCE" | "LIMIT" | "ENGINE" | "CANCELLED";
export interface SimulationProtocolError { code: SimulationErrorCode; message: string; diagnostics: SimulationDiagnostic[] }
export interface SimulationEngineIdentityV1 {
  id: "@opencircuit/ngspice-wasm";
  buildVersion: "ngspice-46-opencircuit-wasm1";
  simulatorVersion: "ngspice-46";
  solver: "KLU";
  numericFormat: "ieee754-binary64";
}
export interface SimulationExecutionReceiptV1 {
  format: "opencircuit-simulation-execution-receipt";
  schemaVersion: 1;
  engine: SimulationEngineIdentityV1;
  executionHost: "local_worker";
  attestation: "none";
  requestType: SimulationRequestType;
  netlistContentHash: `sha256:${string}`;
  sampleContentHash: `sha256:${string}`;
  vectorCount: number;
  scalarSampleCount: number;
  rawfileBytes: number;
  contentHash: `sha256:${string}`;
}
export type SimulationExecutionReceiptIssueCodeV1 =
  | "invalid_receipt"
  | "engine_identity_mismatch"
  | "vector_contract_invalid"
  | "sample_hash_mismatch"
  | "receipt_hash_mismatch";
export interface WorkerReadyResponse { id: number; type: "ready"; engine: string; engineIdentity: SimulationEngineIdentityV1; initMs: number }
export interface WorkerResultResponse { id: number; type: "result"; vectors: VectorMeta[]; buffers: ArrayBuffer[]; elapsedMs: number; rawfileBytes: number; receipt: SimulationExecutionReceiptV1; sweep?: DCSweepResultMetadata; noise?: NoiseResultMetadata }
export interface WorkerErrorResponse { id: number; type: "error"; error: SimulationProtocolError }
export type SimulationResponse = WorkerReadyResponse | WorkerResultResponse | WorkerErrorResponse;
export interface SimulationResult { vectors: VectorMeta[]; data: Map<string, Float64Array>; elapsedMs: number; rawfileBytes: number; receipt: SimulationExecutionReceiptV1; sweep?: DCSweepResultMetadata; noise?: NoiseResultMetadata }
