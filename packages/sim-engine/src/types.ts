export type * from "@opencircuit/circuit-schema";

export type SimulationRequestType = "runOpPoint" | "runDCSweep" | "runTransient" | "runAC";
export interface SimulationLimits { timeoutMs?: number; maxRawfileBytes?: number; maxSamples?: number }
export interface DCSweepSourceSpec { componentId: string; name: string; unit: "V" | "A"; start: number; stop: number; step: number }
export interface DCSweepRunSpec { primary: DCSweepSourceSpec; secondary?: DCSweepSourceSpec }
interface BaseSimulationRequest { id: number; netlist: string; limits?: SimulationLimits }
export type SimulationRequest =
  | (BaseSimulationRequest & { type: "runOpPoint" | "runTransient" | "runAC" })
  | (BaseSimulationRequest & { type: "runDCSweep"; sweep: DCSweepRunSpec });
export interface VectorMeta { name: string; kind: "voltage" | "current" | "time" | "frequency" | "sweep" | "unknown"; length: number; complex: boolean; bufferIndex: number }
export interface DCSweepSegment { startIndex: number; length: number; secondaryValue?: number }
export interface DCSweepResultMetadata {
  axisVector: "sweep";
  primary: DCSweepSourceSpec;
  secondary?: DCSweepSourceSpec;
  segments: DCSweepSegment[];
}
export interface SimulationDiagnostic { stage: "parse" | "solve" | "limit" | "engine" | "settings"; message: string; netLine?: number; componentId?: string }
export type SimulationErrorCode = "PARSE" | "CONVERGENCE" | "LIMIT" | "ENGINE" | "CANCELLED";
export interface SimulationProtocolError { code: SimulationErrorCode; message: string; diagnostics: SimulationDiagnostic[] }
export interface WorkerReadyResponse { id: number; type: "ready"; engine: string; initMs: number }
export interface WorkerResultResponse { id: number; type: "result"; vectors: VectorMeta[]; buffers: ArrayBuffer[]; elapsedMs: number; rawfileBytes: number; sweep?: DCSweepResultMetadata }
export interface WorkerErrorResponse { id: number; type: "error"; error: SimulationProtocolError }
export type SimulationResponse = WorkerReadyResponse | WorkerResultResponse | WorkerErrorResponse;
export interface SimulationResult { vectors: VectorMeta[]; data: Map<string, Float64Array>; elapsedMs: number; rawfileBytes: number; sweep?: DCSweepResultMetadata }
