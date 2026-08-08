export type AnalysisMode = "live" | "op" | "dc-sweep" | "tran" | "ac";
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
export interface SimConfig {
  mode: AnalysisMode;
  tran?: { tstop: number; tstep?: number; maxstep?: number };
  ac?: { fstart: number; fstop: number; pointsPerDecade: number; sweep: "dec" };
  dcSweep?: DCSweepConfig;
}
export interface CircuitDocument {
  format: "opencircuit-circuit"; version: 1; meta: CircuitMeta;
  components: CircuitComponent[]; wires: CircuitWire[]; probes: CircuitProbe[]; sim: SimConfig;
  view?: { pan: Point; zoom: number };
}
export interface NetlistLine { line: number; componentId?: string; stage: "component" | "model" | "analysis" | "header" }
export interface GeneratedNetlist {
  netlist: string; lineMap: NetlistLine[]; componentNodes: Record<string, string[]>;
  wireNodes: Record<string, string>; documentHash: string; componentCurrents: Record<string, string>;
}
export interface ValidationIssue { path: string; message: string; componentId?: string }
