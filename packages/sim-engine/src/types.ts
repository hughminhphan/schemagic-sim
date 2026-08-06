export type AnalysisMode = "live" | "op" | "tran" | "ac";

export interface CircuitMeta {
  title: string;
  description?: string;
}

export interface ComponentLabel {
  text: string;
  offset: [number, number];
}

export interface CircuitComponent {
  id: string;
  type: string;
  mpn?: string;
  value?: number | string;
  params?: Record<string, unknown>;
  pos: [number, number];
  rot: 0 | 90 | 180 | 270;
  mirror: boolean;
  label?: ComponentLabel;
}

export interface CircuitWire {
  id: string;
  points: [number, number][];
}

export interface CircuitProbe {
  id: string;
  kind: "voltage" | "current" | "diff";
  target: { node?: string; componentPin?: [string, number]; wire?: string };
  color?: string;
}

export interface SimConfig {
  mode: AnalysisMode;
  tran?: { tstop: number; tstep?: number; maxstep?: number };
  ac?: { fstart: number; fstop: number; pointsPerDecade: number; sweep: "dec" };
}

export interface CircuitDocument {
  format: "opencircuit-circuit";
  version: 1;
  meta: CircuitMeta;
  components: CircuitComponent[];
  wires: CircuitWire[];
  probes: CircuitProbe[];
  sim: SimConfig;
  view?: { pan: [number, number]; zoom: number };
}

export interface NetlistLine {
  line: number;
  componentId?: string;
  stage: "component" | "model" | "analysis" | "header";
}

export interface GeneratedNetlist {
  netlist: string;
  lineMap: NetlistLine[];
  componentNodes: Record<string, string[]>;
  wireNodes: Record<string, string>;
  documentHash: string;
}

export type SimulationRequestType = "runOpPoint" | "runTransient" | "runAC";

export interface SimulationLimits {
  timeoutMs?: number;
  maxRawfileBytes?: number;
  maxSamples?: number;
}

export interface SimulationRequest {
  id: number;
  type: SimulationRequestType;
  netlist: string;
  limits?: SimulationLimits;
}

export interface VectorMeta {
  name: string;
  kind: "voltage" | "current" | "time" | "frequency" | "unknown";
  length: number;
  complex: boolean;
  bufferIndex: number;
}

export interface SimulationDiagnostic {
  stage: "parse" | "solve" | "limit" | "engine" | "settings";
  message: string;
  netLine?: number;
  componentId?: string;
}

export type SimulationErrorCode = "PARSE" | "CONVERGENCE" | "LIMIT" | "ENGINE" | "CANCELLED";

export interface SimulationProtocolError {
  code: SimulationErrorCode;
  message: string;
  diagnostics: SimulationDiagnostic[];
}

export interface WorkerReadyResponse {
  id: number;
  type: "ready";
  engine: string;
  initMs: number;
}

export interface WorkerResultResponse {
  id: number;
  type: "result";
  vectors: VectorMeta[];
  buffers: ArrayBuffer[];
  elapsedMs: number;
  rawfileBytes: number;
}

export interface WorkerErrorResponse {
  id: number;
  type: "error";
  error: SimulationProtocolError;
}

export type SimulationResponse = WorkerReadyResponse | WorkerResultResponse | WorkerErrorResponse;

export interface SimulationResult {
  vectors: VectorMeta[];
  data: Map<string, Float64Array>;
  elapsedMs: number;
  rawfileBytes: number;
}
