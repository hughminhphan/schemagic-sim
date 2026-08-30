import type { SerializedSignalProbe } from "@opencircuit/signal-workbench";

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
  view?: { pan: Point; zoom: number };
}

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

export interface NetlistLine { line: number; componentId?: string; stage: "component" | "model" | "analysis" | "header" }
export interface GeneratedNetlist {
  netlist: string; lineMap: NetlistLine[]; componentNodes: Record<string, string[]>;
  wireNodes: Record<string, string>; documentHash: string; componentCurrents: Record<string, string>;
}
export interface ValidationIssue { path: string; message: string; componentId?: string }
