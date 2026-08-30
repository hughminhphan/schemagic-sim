export type AnalysisMode = "live" | "op" | "dc-sweep" | "tran" | "ac" | "noise";
export type Rotation = 0 | 90 | 180 | 270;
export type Point = [number, number];
export type ComponentType =
  | "resistor" | "capacitor" | "inductor" | "vsource" | "vsource_pulse" | "vsource_sine"
  | "isource" | "ground" | "switch_spst" | "potentiometer" | "diode" | "led"
  | "bjt_npn" | "bjt_pnp" | "nmos" | "pmos" | "opamp_ideal";

export interface CircuitMeta { title: string; description?: string }
export interface ComponentLabel { text: string; offset: Point }
export interface CircuitComponent {
  id: string; type: ComponentType; mpn?: string; value?: number | string;
  params?: Record<string, unknown>; pos: Point; rot: Rotation; mirror: boolean; label?: ComponentLabel;
}
export interface CircuitWire { id: string; points: Point[] }
export interface CircuitProbe {
  id: string; kind: "voltage" | "current" | "diff";
  target: { node?: string; componentPin?: [string, number]; wire?: string }; color?: string;
}
export interface DCSweepRange { sourceId: string; start: number; stop: number; step: number }
export interface DCSweepConfig extends DCSweepRange { secondary?: DCSweepRange }
export interface NoiseConfig {
  outputProbeId: string;
  inputSourceId: string;
  fstart: number;
  fstop: number;
  pointsPerDecade: number;
  sweep: "dec";
  temperatureC: number;
}
export interface SimConfig {
  mode: AnalysisMode;
  tran?: { tstop: number; tstep?: number; maxstep?: number };
  ac?: { fstart: number; fstop: number; pointsPerDecade: number; sweep: "dec" };
  dcSweep?: DCSweepConfig;
  noise?: NoiseConfig;
}
export interface CircuitDocument {
  format: "opencircuit-circuit"; version: 1; meta: CircuitMeta;
  components: CircuitComponent[]; wires: CircuitWire[]; probes: CircuitProbe[]; sim: SimConfig;
  view?: CircuitView;
}
export interface CircuitView { pan: Point; zoom: number }
export type CircuitDocumentV1 = CircuitDocument;
export type CircuitComponentV1 = CircuitComponent;
export type CircuitProbeV1 = CircuitProbe;
export type SimConfigV1 = SimConfig;

export type Sha256ContentHash = `sha256:${string}`;
export type EngineeringLiteral = string;
export type EngineeringValue = number | EngineeringLiteral;
export type JsonAnnotation = null | boolean | number | string | JsonAnnotation[] | { [key: string]: JsonAnnotation };

export interface DesignBlockRef { id: string; version: string; contentHash: Sha256ContentHash }
export interface DesignBlockPin { id: string; name: string; offset: Point }
export interface TrustedSubcircuitRef { assetId: string; contentHash: Sha256ContentHash; entrypoint: string }
export type DesignBlockNetlistBehavior =
  | { kind: "schematic_only"; reason: string }
  | { kind: "spice_subcircuit"; asset: TrustedSubcircuitRef; pinOrder: string[] };
export interface DesignBlockDefinition {
  id: string;
  version: string;
  contentHash: Sha256ContentHash;
  title: string;
  pins: DesignBlockPin[];
  netlist: DesignBlockNetlistBehavior;
}

export interface CircuitComponentBaseV2 {
  id: string;
  type: string;
  pos: Point;
  rot: Rotation;
  mirror: boolean;
  mpn?: string;
  label?: ComponentLabel;
  annotations?: { [key: string]: JsonAnnotation };
}
export interface PassiveComponentV2 extends CircuitComponentBaseV2 {
  type: "resistor" | "capacitor" | "inductor";
  value: EngineeringValue;
  params?: never;
}
export interface DcVoltageSourceComponentV2 extends CircuitComponentBaseV2 {
  type: "vsource";
  value: EngineeringValue;
  params?: { ac?: EngineeringValue };
}
export interface DcCurrentSourceComponentV2 extends CircuitComponentBaseV2 {
  type: "isource";
  value: EngineeringValue;
  params?: never;
}
export interface PulsedVoltageSourceComponentV2 extends CircuitComponentBaseV2 {
  type: "vsource_pulse";
  params: {
    v1: EngineeringValue;
    v2: EngineeringValue;
    delay: EngineeringValue;
    rise: EngineeringValue;
    fall: EngineeringValue;
    width: EngineeringValue;
    period: EngineeringValue;
  };
}
export interface SineVoltageSourceComponentV2 extends CircuitComponentBaseV2 {
  type: "vsource_sine";
  value: EngineeringValue;
  params: { offset: EngineeringValue; frequency: EngineeringValue; ac?: EngineeringValue };
}
export interface PulsedCurrentParams {
  i1: number;
  i2: number;
  delay: number;
  rise: number;
  fall: number;
  width: number;
  period: number;
}
export interface PulsedCurrentSourceComponent extends CircuitComponentBaseV2 {
  type: "isource_pulse";
  params: PulsedCurrentParams;
}
export interface SwitchComponentV2 extends CircuitComponentBaseV2 {
  type: "switch_spst";
  params: { closed: boolean };
}
export interface PotentiometerComponentV2 extends CircuitComponentBaseV2 {
  type: "potentiometer";
  value: EngineeringValue;
  params: { t: number };
}
export interface FixedModelComponentV2 extends CircuitComponentBaseV2 {
  type: "diode" | "led" | "bjt_npn" | "bjt_pnp" | "nmos" | "pmos" | "opamp_ideal" | "ground";
  params?: never;
}
export interface DesignBlockComponent extends CircuitComponentBaseV2 {
  type: "design_block";
  block: DesignBlockRef;
}
export type CircuitComponentV2 =
  | PassiveComponentV2
  | DcVoltageSourceComponentV2
  | DcCurrentSourceComponentV2
  | PulsedVoltageSourceComponentV2
  | SineVoltageSourceComponentV2
  | PulsedCurrentSourceComponent
  | SwitchComponentV2
  | PotentiometerComponentV2
  | FixedModelComponentV2
  | DesignBlockComponent;

export type CircuitProbeTargetV2 =
  | { node: string; wire?: never; componentPin?: never }
  | { wire: string; node?: never; componentPin?: never }
  | { componentPin: [componentId: string, pin: number | string]; node?: never; wire?: never };
export interface CircuitProbeV2 {
  id: string;
  kind: "voltage" | "current" | "diff";
  target: CircuitProbeTargetV2;
  color?: string;
}
export interface CircuitGraphV2 {
  id: string;
  title: string;
  components: CircuitComponentV2[];
  wires: CircuitWire[];
  probes: CircuitProbeV2[];
  view?: CircuitView;
}
export type ExecutableSimConfigV2 =
  | { mode: "op" }
  | { mode: "tran"; tran: { tstop: number; tstep: number; maxstep: number } }
  | { mode: "ac"; ac: { fstart: number; fstop: number; pointsPerDecade: number; sweep: "dec" } }
  | { mode: "dc-sweep"; dcSweep: DCSweepConfig }
  | { mode: "noise"; noise: NoiseConfig };
export interface SimulationScenarioV2 { id: string; title: string; circuitId: string; config: ExecutableSimConfigV2 }
export interface CircuitDocumentV2 {
  format: "opencircuit-circuit";
  version: 2;
  meta: CircuitMeta;
  designBlocks: DesignBlockDefinition[];
  circuits: CircuitGraphV2[];
  scenarios: SimulationScenarioV2[];
  defaultCircuitId: string;
  defaultScenarioId: string | null;
}
export type AnyCircuitDocument = CircuitDocumentV1 | CircuitDocumentV2;

export interface NetlistLine { line: number; componentId?: string; stage: "component" | "model" | "analysis" | "header" }
export interface GeneratedNetlist {
  netlist: string; lineMap: NetlistLine[]; componentNodes: Record<string, string[]>;
  wireNodes: Record<string, string>; documentHash: string; componentCurrents: Record<string, string>;
}
export interface ValidationIssue { path: string; message: string; componentId?: string }

export const CIRCUIT_CONTRACT_FAILURE_CODES = [
  "UNSUPPORTED_CIRCUIT_VERSION", "UNKNOWN_FIELD", "DUPLICATE_ID", "INVALID_REFERENCE",
  "BLOCK_HASH_MISMATCH", "BLOCK_PIN_MAPPING_INVALID", "UNSAFE_SPICE_TOKEN", "INVALID_PULSE",
  "INVALID_SIM_CONFIG", "SCENARIO_NOT_FOUND", "TRUSTED_MODEL_NOT_FOUND", "TRUSTED_MODEL_REF_MISMATCH",
  "TRUSTED_MODEL_NOT_CANONICAL", "TRUSTED_MODEL_HASH_MISMATCH", "TRUSTED_MODEL_HASH_COLLISION",
  "TRUSTED_MODEL_ENTRYPOINT_INVALID", "TRUSTED_MODEL_UNSAFE", "TRUSTED_MODEL_PIN_MISMATCH",
  "TRUSTED_MODEL_RESOLUTION_FAILED",
  "EMITTED_NAME_COLLISION", "EXECUTION_LIMIT",
] as const;
export type CircuitContractFailureCode = typeof CIRCUIT_CONTRACT_FAILURE_CODES[number];
export interface CircuitContractIssue {
  code: CircuitContractFailureCode;
  path: string;
  message: string;
  circuitId?: string;
  scenarioId?: string;
  componentId?: string;
  blockId?: string;
}
export class CircuitNetlistError extends Error {
  readonly issue: CircuitContractIssue;
  constructor(issue: CircuitContractIssue) {
    super(issue.message);
    this.name = "CircuitNetlistError";
    this.issue = issue;
  }
}
export interface RegistrySubcircuitAsset { ref: TrustedSubcircuitRef; canonicalText: string }
export interface TrustedSubcircuitRegistry { resolve(ref: TrustedSubcircuitRef): RegistrySubcircuitAsset | undefined }
export interface ScenarioNetlistOptions { registry?: TrustedSubcircuitRegistry }
export interface NetlistOmission {
  code: "SCHEMATIC_ONLY_BLOCK_OMITTED";
  scenarioId: string;
  circuitId: string;
  componentId: string;
  blockId: string;
  reason: string;
}
export interface GeneratedScenarioNetlist extends GeneratedNetlist {
  scenarioId: string;
  circuitId: string;
  scenarioHash: string;
  serializationHash: string;
  componentPinNodes: Record<string, Record<string, string>>;
  omissions: NetlistOmission[];
}
