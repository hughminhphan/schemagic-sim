export type * from "@opencircuit/circuit-schema";

export type SimulationRequestType = "runOpPoint" | "runTransient" | "runAC";
export interface SimulationLimits { timeoutMs?: number; maxRawfileBytes?: number; maxSamples?: number }
export interface SimulationRequest { id: number; type: SimulationRequestType; netlist: string; limits?: SimulationLimits }
export interface VectorMeta { name: string; kind: "voltage" | "current" | "time" | "frequency" | "unknown"; length: number; complex: boolean; bufferIndex: number }
export interface SimulationDiagnostic { stage: "parse" | "solve" | "limit" | "engine" | "settings"; message: string; netLine?: number; componentId?: string }
export type SimulationErrorCode = "PARSE" | "CONVERGENCE" | "LIMIT" | "ENGINE" | "CANCELLED";
export interface SimulationProtocolError { code: SimulationErrorCode; message: string; diagnostics: SimulationDiagnostic[] }
export interface WorkerReadyResponse { id: number; type: "ready"; engine: string; initMs: number }
export interface WorkerResultResponse { id: number; type: "result"; vectors: VectorMeta[]; buffers: ArrayBuffer[]; elapsedMs: number; rawfileBytes: number }
export interface WorkerErrorResponse { id: number; type: "error"; error: SimulationProtocolError }
export type SimulationResponse = WorkerReadyResponse | WorkerResultResponse | WorkerErrorResponse;
export interface SimulationResult { vectors: VectorMeta[]; data: Map<string, Float64Array>; elapsedMs: number; rawfileBytes: number }
