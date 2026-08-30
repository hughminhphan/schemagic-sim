export type * from "@opencircuit/circuit-schema";

export type SimulationRequestType = "runOpPoint" | "runDCSweep" | "runTransient" | "runAC" | "runNoise";
export interface SimulationLimits { timeoutMs?: number; maxRawfileBytes?: number; maxSamples?: number }
export interface SimulationExecutionOptions extends SimulationLimits { signal?: AbortSignal; scheduling?: "queue-latest" | "replace-active" }
export interface DCSweepSourceSpec { componentId: string; name: string; unit: "V" | "A"; start: number; stop: number; step: number }
export interface DCSweepRunSpec { primary: DCSweepSourceSpec; secondary?: DCSweepSourceSpec }
export interface NoiseOutputSpec { probeId: string; positiveNode: string; negativeNode: string }
export interface NoiseInputSourceSpec { componentId: string; name: string; unit: "V" | "A" }
export interface NoiseSweepSpec { sweep: "dec"; pointsPerDecade: number; fstart: number; fstop: number }
export interface NoiseRunSpec { output: NoiseOutputSpec; input: NoiseInputSourceSpec; frequency: NoiseSweepSpec; temperatureC: number }
export interface SimulationRunProvenance {
  runKey: string;
  identityVersion: 1;
  engine: "ngspice-46-opencircuit-wasm1";
  requestType: SimulationRequestType;
  limits: Required<SimulationLimits>;
}
interface BaseSimulationRequest { id: number; netlist: string; limits: Required<SimulationLimits>; provenance: SimulationRunProvenance }
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
export interface SimulationDiagnostic { stage: "parse" | "model" | "solve" | "limit" | "engine" | "settings"; message: string; netLine?: number; componentId?: string }
export type SimulationErrorCode = "PARSE" | "CONVERGENCE" | "LIMIT" | "ENGINE" | "CANCELLED";
export type SimulationCancellationReason = "user" | "superseded" | "disposed";
export interface SimulationProtocolError { code: SimulationErrorCode; message: string; diagnostics: SimulationDiagnostic[]; cancellationReason?: SimulationCancellationReason; provenance?: SimulationRunProvenance }
export interface WorkerReadyResponse { id: number; type: "ready"; engine: string; initMs: number }
export interface WorkerResultResponse { id: number; type: "result"; provenance: SimulationRunProvenance; vectors: VectorMeta[]; buffers: ArrayBuffer[]; elapsedMs: number; engineMs: number; parseMs: number; rawfileBytes: number; sweep?: DCSweepResultMetadata; noise?: NoiseResultMetadata }
export interface WorkerErrorResponse { id: number; type: "error"; error: SimulationProtocolError; provenance?: SimulationRunProvenance }
export type SimulationResponse = WorkerReadyResponse | WorkerResultResponse | WorkerErrorResponse;
export interface SimulationResult { provenance: SimulationRunProvenance; vectors: VectorMeta[]; data: Map<string, Float64Array>; elapsedMs: number; engineMs: number; parseMs: number; queueMs: number; rawfileBytes: number; sweep?: DCSweepResultMetadata; noise?: NoiseResultMetadata }
