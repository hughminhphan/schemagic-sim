import type { SerializedSignalProbe } from "@opencircuit/signal-workbench";

export type AnalysisMode = "live" | "op" | "dc-sweep" | "tran" | "ac" | "noise";
export type Rotation = 0 | 90 | 180 | 270;
export type Point = [number, number];
export type ComponentType =
  | "resistor" | "capacitor" | "inductor" | "vsource" | "vsource_pulse" | "vsource_sine"
  | "isource" | "isource_pulse" | "ground"
  | "switch_spst" | "switch_spdt" | "switch_dpdt" | "switch_pushbutton" | "switch_toggle" | "switch_vcontrolled"
  | "potentiometer" | "diode" | "zener" | "led"
  | "bjt_npn" | "bjt_pnp" | "nmos" | "pmos" | "opamp_ideal"
  | "vcvs" | "vccs" | "cccs" | "ccvs" | "behavioral_source"
  | "transformer" | "crystal" | "transmission_line" | "battery" | "fuse"
  | CatalogOnlyComponentType;

/**
 * Symbols that exist only to host a reviewed catalog package. They carry no
 * generic device model, so a document is invalid unless the component names a
 * catalog package. Pin index i is the i-th node of the package subcircuit, so
 * the emitted node order is the package's declared order by construction.
 */
export type CatalogOnlyComponentType =
  | "timer_555" | "vreg_linear_3" | "comparator" | "jfet_n" | "optocoupler_led"
  | "ic_block_2" | "ic_block_3" | "ic_block_4" | "ic_block_5" | "ic_block_6"
  | "ic_block_8" | "ic_block_9" | "ic_block_14" | "ic_block_16";

export interface CircuitMeta { title: string; description?: string }
export interface ComponentLabel { text: string; offset: Point }

/**
 * Typed Simulator V3 parameter contracts. CircuitComponent.params remains a
 * record for backwards compatibility with imported/catalog annotations, while
 * validation enforces these exact shapes for the corresponding new elements.
 */
export interface BinarySwitchParamsV3 { closed: boolean }
export interface ThrowSwitchParamsV3 { throw: "a" | "b" }
export interface VoltageControlledSwitchParamsV3 {
  ron: EngineeringValue;
  roff: EngineeringValue;
  threshold: EngineeringValue;
  hysteresis: EngineeringValue;
}
export interface LinearDependentSourceParamsV3 { gain: EngineeringValue }
export type BehavioralNodeReferenceV3 =
  | { kind: "ground" }
  | { kind: "wire"; wireId: string }
  | { kind: "pin"; componentId: string; pin: number };
export type BehavioralExpressionV3 =
  | { kind: "constant"; value: EngineeringValue }
  | { kind: "voltage"; positive: BehavioralNodeReferenceV3; negative?: BehavioralNodeReferenceV3 }
  | { kind: "unary"; operator: "+" | "-"; operand: BehavioralExpressionV3 }
  | { kind: "binary"; operator: "+" | "-" | "*" | "/" | "^"; left: BehavioralExpressionV3; right: BehavioralExpressionV3 }
  | { kind: "function"; name: "abs" | "sqrt" | "exp" | "ln" | "log" | "sin" | "cos" | "tan" | "min" | "max"; arguments: BehavioralExpressionV3[] };
export interface BehavioralSourceParamsV3 {
  output: "voltage" | "current";
  expression: BehavioralExpressionV3;
}
export interface TransformerParamsV3 {
  primaryInductance: EngineeringValue;
  secondaryInductance: EngineeringValue;
  coupling: number;
}
export interface CrystalParamsV3 {
  seriesResistance: EngineeringValue;
  seriesInductance: EngineeringValue;
  seriesCapacitance: EngineeringValue;
  parallelCapacitance: EngineeringValue;
}
export interface TransmissionLineParamsV3 { impedance: EngineeringValue; delay: EngineeringValue }
export interface FuseParamsV3 { blown: boolean; blownResistance: EngineeringValue }
export interface CurrentPulseParamsV3 {
  i1: EngineeringValue;
  i2: EngineeringValue;
  delay: EngineeringValue;
  rise: EngineeringValue;
  fall: EngineeringValue;
  width: EngineeringValue;
  period: EngineeringValue;
}
export type SimulatorComponentParamsV3 =
  | BinarySwitchParamsV3
  | ThrowSwitchParamsV3
  | VoltageControlledSwitchParamsV3
  | LinearDependentSourceParamsV3
  | BehavioralSourceParamsV3
  | TransformerParamsV3
  | CrystalParamsV3
  | TransmissionLineParamsV3
  | FuseParamsV3
  | CurrentPulseParamsV3;
export interface CircuitComponent {
  id: string; type: ComponentType; mpn?: string; value?: number | string;
  params?: Record<string, unknown>; pos: Point; rot: Rotation; mirror: boolean; label?: ComponentLabel;
}
export interface CircuitWire { id: string; points: Point[]; netLabel?: string }

export interface LegacyCircuitProbe {
  id: string; kind: "voltage" | "current" | "diff";
  target: { node?: string; componentPin?: [string, number]; wire?: string }; color?: string;
  label?: string;
}
export type CircuitProbe = SerializedSignalProbe;

export interface DCSweepRange { sourceId: string; start: number; stop: number; step: number }
export interface DCSweepConfig extends DCSweepRange { secondary?: DCSweepRange }
export interface TransientConfig { tstop: number; tstep?: number; maxstep?: number }
export interface ACStimulusConfig { sourceId: string; magnitude: number; phaseDeg: number }
export interface ACConfig {
  fstart: number;
  fstop: number;
  pointsPerDecade: number;
  sweep: "dec";
  stimulus?: ACStimulusConfig;
}
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
  tran?: TransientConfig;
  ac?: ACConfig;
  dcSweep?: DCSweepConfig;
  noise?: NoiseConfig;
}
export type ImportedDefinitionKind = "model" | "subckt";
export interface ImportedDefinitionSelector {
  kind: ImportedDefinitionKind;
  name: string;
  scopePath: string[];
  librarySection?: string;
}
export interface ImportedPinMapping { symbolPinIndex: number; modelPinIndex: number }
export interface ImportedAnalysisLimitation {
  modes: AnalysisMode[];
  message: string;
}
export interface ImportedAnalysisValidity {
  version: 1;
  supportedModes: AnalysisMode[];
  limitations?: ImportedAnalysisLimitation[];
}
export interface ImportedModelPart {
  id: string;
  sourceName: string;
  sourceText: string;
  definition: ImportedDefinitionSelector;
  baseType: ComponentType;
  pinMapping: ImportedPinMapping[];
  analysisValidity: ImportedAnalysisValidity;
}
export interface ImportedModelLibrary {
  format: "opencircuit-imported-models";
  version: 1;
  parts: ImportedModelPart[];
}

interface CircuitDocumentBase<TProbe> {
  format: "opencircuit-circuit";
  meta: CircuitMeta;
  components: CircuitComponent[];
  wires: CircuitWire[];
  probes: TProbe[];
  sim: SimConfig;
  view?: CircuitView;
}

export interface CircuitView { pan: Point; zoom: number }

export interface CircuitDocument extends CircuitDocumentBase<CircuitProbe> {
  version: 3;
  modelImports?: ImportedModelLibrary;
}
export interface CircuitDocumentV2 extends CircuitDocumentBase<LegacyCircuitProbe> {
  version: 2;
  /** Legacy web-only field. v2 -> v3 migration never trusts its derived emitted fields. */
  importedParts?: unknown;
}
export interface CircuitDocumentV1 extends CircuitDocumentBase<LegacyCircuitProbe> {
  version: 1;
  importedParts?: unknown;
}

export type CircuitComponentV1 = CircuitComponent;
export type CircuitProbeV1 = LegacyCircuitProbe;
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

export interface CircuitComponentBaseV4 {
  id: string;
  type: string;
  pos: Point;
  rot: Rotation;
  mirror: boolean;
  mpn?: string;
  label?: ComponentLabel;
  annotations?: { [key: string]: JsonAnnotation };
}
export interface PassiveComponentV4 extends CircuitComponentBaseV4 {
  type: "resistor" | "capacitor" | "inductor";
  value: EngineeringValue;
  params?: never;
}
export interface DcVoltageSourceComponentV4 extends CircuitComponentBaseV4 {
  type: "vsource";
  value: EngineeringValue;
  params?: { ac?: EngineeringValue };
}
export interface DcCurrentSourceComponentV4 extends CircuitComponentBaseV4 {
  type: "isource";
  value: EngineeringValue;
  params?: never;
}
export interface PulsedVoltageSourceComponentV4 extends CircuitComponentBaseV4 {
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
export interface SineVoltageSourceComponentV4 extends CircuitComponentBaseV4 {
  type: "vsource_sine";
  value: EngineeringValue;
  params: { offset: EngineeringValue; frequency: EngineeringValue; ac?: EngineeringValue };
}
export interface PulsedCurrentParamsV4 {
  i1: number;
  i2: number;
  delay: number;
  rise: number;
  fall: number;
  width: number;
  period: number;
}
export interface PulsedCurrentSourceComponentV4 extends CircuitComponentBaseV4 {
  type: "isource_pulse";
  params: PulsedCurrentParamsV4;
}
export interface SwitchComponentV4 extends CircuitComponentBaseV4 {
  type: "switch_spst";
  params: { closed: boolean };
}
export interface PotentiometerComponentV4 extends CircuitComponentBaseV4 {
  type: "potentiometer";
  value: EngineeringValue;
  params: { t: number };
}
export interface FixedModelComponentV4 extends CircuitComponentBaseV4 {
  type: "diode" | "led" | "bjt_npn" | "bjt_pnp" | "nmos" | "pmos" | "opamp_ideal" | "ground";
  params?: never;
}
export interface DesignBlockComponentV4 extends CircuitComponentBaseV4 {
  type: "design_block";
  block: DesignBlockRef;
}
export type CircuitComponentV4 =
  | PassiveComponentV4
  | DcVoltageSourceComponentV4
  | DcCurrentSourceComponentV4
  | PulsedVoltageSourceComponentV4
  | SineVoltageSourceComponentV4
  | PulsedCurrentSourceComponentV4
  | SwitchComponentV4
  | PotentiometerComponentV4
  | FixedModelComponentV4
  | DesignBlockComponentV4;

export type CircuitProbeTargetV4 =
  | { node: string; wire?: never; componentPin?: never }
  | { wire: string; node?: never; componentPin?: never }
  | { componentPin: [componentId: string, pin: number | string]; node?: never; wire?: never };
export interface CircuitProbeV4 {
  id: string;
  kind: "voltage" | "current" | "diff";
  target: CircuitProbeTargetV4;
  color?: string;
}
export interface CircuitGraphV4 {
  id: string;
  title: string;
  components: CircuitComponentV4[];
  wires: CircuitWire[];
  probes: CircuitProbeV4[];
  view?: CircuitView;
}
export type ExecutableSimConfigV4 =
  | { mode: "op" }
  | { mode: "tran"; tran: { tstop: number; tstep: number; maxstep: number } }
  | { mode: "ac"; ac: { fstart: number; fstop: number; pointsPerDecade: number; sweep: "dec" } }
  | { mode: "dc-sweep"; dcSweep: DCSweepConfig }
  | { mode: "noise"; noise: NoiseConfig };
export interface SimulationScenarioV4 { id: string; title: string; circuitId: string; config: ExecutableSimConfigV4 }
export interface CircuitDocumentV4 {
  format: "opencircuit-circuit";
  version: 4;
  meta: CircuitMeta;
  designBlocks: DesignBlockDefinition[];
  circuits: CircuitGraphV4[];
  scenarios: SimulationScenarioV4[];
  defaultCircuitId: string;
  defaultScenarioId: string | null;
}
export type AnyCircuitDocument = CircuitDocumentV1 | CircuitDocumentV2 | CircuitDocument | CircuitDocumentV4;

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
