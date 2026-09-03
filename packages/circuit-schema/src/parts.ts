import type { CircuitComponent, CircuitComponentV4, ComponentType, DesignBlockDefinition, Point } from "./types";

export interface PartDefinition { type: ComponentType; name: string; prefix: string; pins: Point[]; defaultValue?: number | string; note?: string; pinNames?: readonly string[] }
export const PARTS: readonly PartDefinition[] = [
  { type: "resistor", name: "Resistor", prefix: "R", pins: [[-2,0],[2,0]], defaultValue: "1k" },
  { type: "capacitor", name: "Capacitor", prefix: "C", pins: [[-2,0],[2,0]], defaultValue: "100n" },
  { type: "inductor", name: "Inductor", prefix: "L", pins: [[-2,0],[2,0]], defaultValue: "1m" },
  { type: "vsource", name: "DC voltage source", prefix: "V", pins: [[0,-2],[0,2]], defaultValue: 5 },
  { type: "vsource_pulse", name: "Pulse voltage source", prefix: "VP", pins: [[0,-2],[0,2]], defaultValue: 5 },
  { type: "vsource_sine", name: "Sine voltage source", prefix: "VS", pins: [[0,-2],[0,2]], defaultValue: 1 },
  { type: "isource", name: "DC current source", prefix: "I", pins: [[0,-2],[0,2]], defaultValue: "1m" },
  { type: "isource_pulse", name: "Pulse current source", prefix: "IP", pins: [[0,-2],[0,2]], note: "Typed PULSE current waveform." },
  { type: "ground", name: "Ground", prefix: "GND", pins: [[0,0]] },
  { type: "switch_spst", name: "SPST switch", prefix: "S", pins: [[-2,0],[2,0]], note: "Ideal switch uses 1 mΩ on and 1 GΩ off." },
  { type: "switch_spdt", name: "SPDT switch", prefix: "S", pins: [[-2,0],[2,-1],[2,1]], note: "Common connects to exactly one throw.", pinNames: ["COM", "A", "B"] },
  { type: "switch_dpdt", name: "DPDT switch", prefix: "S", pins: [[-3,-2],[3,-3],[3,-1],[-3,2],[3,1],[3,3]], note: "Two poles change throw together.", pinNames: ["COM1", "A1", "B1", "COM2", "A2", "B2"] },
  { type: "switch_pushbutton", name: "Pushbutton", prefix: "S", pins: [[-2,0],[2,0]], note: "Momentary switch state is explicit and saved." },
  { type: "switch_toggle", name: "Toggle switch", prefix: "S", pins: [[-2,0],[2,0]], note: "Latching ideal switch state is saved." },
  { type: "switch_vcontrolled", name: "Voltage-controlled switch", prefix: "S", pins: [[-3,-1],[3,-1],[-1,3],[1,3]], note: "Native SPICE switch with typed Ron, Roff, threshold and hysteresis.", pinNames: ["OUT+", "OUT−", "CTRL+", "CTRL−"] },
  { type: "potentiometer", name: "Potentiometer", prefix: "P", pins: [[0,-2],[2,0],[0,2]], defaultValue: "10k" },
  { type: "diode", name: "Diode", prefix: "D", pins: [[0,-2],[0,2]], defaultValue: "generic" },
  { type: "zener", name: "Zener diode", prefix: "D", pins: [[0,-2],[0,2]], note: "Catalog-backed Zener symbol. Choose a reviewed Zener package.", pinNames: ["A", "K"] },
  { type: "led", name: "LED", prefix: "LED", pins: [[0,-2],[0,2]], defaultValue: "red" },
  { type: "bjt_npn", name: "NPN transistor", prefix: "Q", pins: [[2,-3],[-2,0],[2,3]], note: "Generic device unless an MPN is selected." },
  { type: "bjt_pnp", name: "PNP transistor", prefix: "Q", pins: [[2,-3],[-2,0],[2,3]], note: "Generic device unless an MPN is selected." },
  { type: "nmos", name: "NMOS", prefix: "M", pins: [[2,-3],[-2,0],[2,3]], note: "Generic level-1 device. No manufacturer part is implied." },
  { type: "pmos", name: "PMOS", prefix: "M", pins: [[2,-3],[-2,0],[2,3]], note: "Generic level-1 device. No manufacturer part is implied." },
  { type: "opamp_ideal", name: "Ideal opamp", prefix: "U", pins: [[-4,-2],[-4,2],[4,0]], note: "Simple high-gain VCVS model, not a real opamp." },
  { type: "vcvs", name: "Voltage-controlled voltage source", prefix: "E", pins: [[0,-3],[0,3],[-3,-1],[-3,1]], note: "Linear E source.", pinNames: ["OUT+", "OUT−", "CTRL+", "CTRL−"] },
  { type: "vccs", name: "Voltage-controlled current source", prefix: "G", pins: [[0,-3],[0,3],[-3,-1],[-3,1]], note: "Linear G source.", pinNames: ["OUT+", "OUT−", "CTRL+", "CTRL−"] },
  { type: "cccs", name: "Current-controlled current source", prefix: "F", pins: [[0,-3],[0,3],[-3,-1],[-3,1]], note: "Linear F source with an internal zero-volt current sensor.", pinNames: ["OUT+", "OUT−", "SENSE+", "SENSE−"] },
  { type: "ccvs", name: "Current-controlled voltage source", prefix: "H", pins: [[0,-3],[0,3],[-3,-1],[-3,1]], note: "Linear H source with an internal zero-volt current sensor.", pinNames: ["OUT+", "OUT−", "SENSE+", "SENSE−"] },
  { type: "behavioral_source", name: "Behavioural source", prefix: "B", pins: [[0,-2],[0,2]], note: "Typed expression source; raw SPICE text is never accepted.", pinNames: ["+", "−"] },
  { type: "transformer", name: "Coupled-inductor transformer", prefix: "T", pins: [[-3,-2],[-3,2],[3,-2],[3,2]], note: "Two inductors with explicit magnetic coupling.", pinNames: ["P1", "P2", "S1", "S2"] },
  { type: "crystal", name: "Crystal", prefix: "Y", pins: [[-2,0],[2,0]], note: "Motional RLC branch with parallel capacitance." },
  { type: "transmission_line", name: "Transmission line", prefix: "T", pins: [[-3,-1],[-3,1],[3,-1],[3,1]], note: "Lossless native SPICE line with impedance and delay.", pinNames: ["IN+", "IN−", "OUT+", "OUT−"] },
  { type: "battery", name: "Battery", prefix: "BAT", pins: [[0,-2],[0,2]], defaultValue: 9, note: "Ideal DC battery source." },
  { type: "fuse", name: "Fuse", prefix: "F", pins: [[-2,0],[2,0]], defaultValue: "10m", note: "Closed resistance or explicit blown open state." },
  // Catalog-only symbols. Pin index i is subcircuit node i of the selected
  // package, so the emitted node order is the package's declared order.
  { type: "timer_555", name: "555 timer", prefix: "U", pins: [[-6,-3],[-6,-1],[-6,1],[-6,3],[6,3],[6,1],[6,-1],[6,-3]], note: "Catalog-only symbol. Choose a reviewed 555 package from the catalog.", pinNames: ["GND", "TRIG", "OUT", "RESET", "CONT", "THRES", "DISCH", "VCC"] },
  { type: "vreg_linear_3", name: "3-terminal regulator", prefix: "U", pins: [[-4,0],[4,0],[0,3]], note: "Catalog-only symbol. Pin order follows the package: IN, OUT, then GND or ADJ.", pinNames: ["IN", "OUT", "GND/ADJ"] },
  { type: "comparator", name: "Comparator", prefix: "U", pins: [[-6,-2],[-6,2],[6,0],[0,-5],[0,5]], note: "Catalog-only symbol. Pin order is IN+, IN-, OUT, VCC, GND.", pinNames: ["IN+", "IN−", "OUT", "VCC", "GND"] },
  { type: "jfet_n", name: "N-channel JFET", prefix: "J", pins: [[2,-3],[-2,0],[2,3]], note: "Catalog-only symbol. Pin order is D, G, S.", pinNames: ["D", "G", "S"] },
  { type: "optocoupler_led", name: "Optocoupler input LED", prefix: "OK", pins: [[0,-2],[0,2]], note: "Catalog-only symbol. Only the input LED is modelled; the output phototransistor is not.", pinNames: ["A", "K"] },
  { type: "ic_block_2", name: "2-pin IC block", prefix: "U", pins: [[-6,0],[6,0]], note: "Catalog-only labelled block. Pins follow the package subcircuit order." },
  { type: "ic_block_3", name: "3-pin IC block", prefix: "U", pins: [[-6,-1],[-6,1],[6,-1]], note: "Catalog-only labelled block. Pins follow the package subcircuit order." },
  { type: "ic_block_4", name: "4-pin IC block", prefix: "U", pins: [[-6,-1],[-6,1],[6,1],[6,-1]], note: "Catalog-only labelled block. Pins follow the package subcircuit order." },
  { type: "ic_block_5", name: "5-pin IC block", prefix: "U", pins: [[-6,-2],[-6,0],[-6,2],[6,0],[6,-2]], note: "Catalog-only labelled block. Pins follow the package subcircuit order." },
  { type: "ic_block_6", name: "6-pin IC block", prefix: "U", pins: [[-6,-2],[-6,0],[-6,2],[6,2],[6,0],[6,-2]], note: "Catalog-only labelled block. Pins follow the package subcircuit order." },
  { type: "ic_block_8", name: "8-pin IC block", prefix: "U", pins: [[-6,-3],[-6,-1],[-6,1],[-6,3],[6,3],[6,1],[6,-1],[6,-3]], note: "Catalog-only labelled block. Pins follow the package subcircuit order." },
  { type: "ic_block_9", name: "9-pin IC block", prefix: "U", pins: [[-6,-4],[-6,-2],[-6,0],[-6,2],[-6,4],[6,2],[6,0],[6,-2],[6,-4]], note: "Catalog-only labelled block. Pins follow the package subcircuit order." },
  { type: "ic_block_14", name: "14-pin IC block", prefix: "U", pins: [[-6,-6],[-6,-4],[-6,-2],[-6,0],[-6,2],[-6,4],[-6,6],[6,6],[6,4],[6,2],[6,0],[6,-2],[6,-4],[6,-6]], note: "Catalog-only labelled block. Pins follow the package subcircuit order." },
  { type: "ic_block_16", name: "16-pin IC block", prefix: "U", pins: [[-6,-7],[-6,-5],[-6,-3],[-6,-1],[-6,1],[-6,3],[-6,5],[-6,7],[6,7],[6,5],[6,3],[6,1],[6,-1],[6,-3],[6,-5],[6,-7]], note: "Catalog-only labelled block. Pins follow the package subcircuit order." },
];

/**
 * Catalog-only symbols carry no generic device model. Netlist emission for one
 * of these is a positional subcircuit or primitive call whose node order is the
 * symbol's pin order, so the catalog package supplies every electrical fact.
 */
export const CATALOG_ONLY_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
  "zener", "timer_555", "vreg_linear_3", "comparator", "jfet_n", "optocoupler_led",
  "ic_block_2", "ic_block_3", "ic_block_4", "ic_block_5", "ic_block_6",
  "ic_block_8", "ic_block_9", "ic_block_14", "ic_block_16",
]);

/** SPICE element letter used when a catalog-only symbol emits a primitive .model call. */
export const CATALOG_ONLY_PRIMITIVE_PREFIX: Readonly<Partial<Record<ComponentType, string>>> = Object.freeze({
  zener: "D",
  jfet_n: "J",
  optocoupler_led: "D",
});

export const isCatalogOnlyType = (type: ComponentType): boolean => CATALOG_ONLY_TYPES.has(type);

/**
 * Devices whose pins may legitimately share one net, so a covered pin is
 * connectivity rather than a two-terminal body lying across a conductor.
 */
export const isMultiTerminalDevice = (type: ComponentType): boolean =>
  type === "opamp_ideal"
  || ["switch_spdt", "switch_dpdt", "switch_vcontrolled", "vcvs", "vccs", "cccs", "ccvs", "transformer", "transmission_line"].includes(type)
  || (CATALOG_ONLY_TYPES.has(type) && type !== "zener" && type !== "jfet_n" && type !== "optocoupler_led");
export const partByType = (type: ComponentType): PartDefinition => {
  const part = PARTS.find((entry) => entry.type === type);
  if (!part) throw new Error(`Unsupported component type ${type}`);
  return part;
};
export function componentPoint(component: Pick<CircuitComponent, "pos" | "mirror" | "rot">, [inputX,inputY]: Point): Point {
  const x = component.mirror ? -inputX : inputX;
  let offset: Point;
  switch (component.rot) { case 0:offset=[x,inputY];break; case 90:offset=[-inputY,x];break; case 180:offset=[-x,-inputY];break; case 270:offset=[inputY,-x];break; }
  return [component.pos[0]+offset[0],component.pos[1]+offset[1]];
}
export function componentPinPoints(component: CircuitComponent): Point[] {
  return partByType(component.type).pins.map((offset) => componentPoint(component, offset));
}

// Designer V4 preserves the geometry used to author and hash the original
// multi-circuit candidates. The Simulator V3 editor intentionally uses the
// tighter KiCad-derived geometry in PARTS. Keeping these offsets explicit
// prevents a UI-symbol adjustment from silently changing Designer topology.
const DESIGNER_V4_PIN_OFFSETS: Readonly<Partial<Record<ComponentType, readonly Point[]>>> = {
  potentiometer: [[0, -6], [4, 0], [0, 6]],
  bjt_npn: [[2, -4], [-2, 0], [2, 4]],
  bjt_pnp: [[2, -4], [-2, 0], [2, 4]],
  nmos: [[2, -4], [-2, 0], [2, 4]],
  pmos: [[2, -4], [-2, 0], [2, 4]],
};

export function componentPinPointsV4(component: CircuitComponentV4, designBlocks: readonly DesignBlockDefinition[]): Point[] {
  const offsets = component.type === "design_block"
    ? designBlocks.find((block) => block.id === component.block.id && block.version === component.block.version && block.contentHash === component.block.contentHash)?.pins.map((pin) => pin.offset)
    : component.type === "isource_pulse"
      ? partByType("isource").pins
      : DESIGNER_V4_PIN_OFFSETS[component.type] ?? partByType(component.type).pins;
  if (!offsets) throw new Error(`Unresolved design block ${component.type === "design_block" ? component.block.id : component.id}`);
  return offsets.map((offset) => componentPoint(component, offset));
}
export function parseEngineering(value: number | string | undefined, fallback = 0): number {
  if (typeof value === "number") return value;
  if (!value?.trim()) return fallback;
  const text = value.trim().replace(/µ/g, "u");
  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(meg|[fpnumkKMG]?)(?:[a-zA-ZΩ]*)$/i);
  if (!match) return Number(text);
  const suffix = match[2] ?? "";
  const factor: Record<string, number> = { f:1e-15,p:1e-12,n:1e-9,u:1e-6,m:1e-3,"":1,k:1e3,meg:1e6,g:1e9 };
  const normalizedSuffix = suffix === "M" ? "meg" : suffix.toLowerCase();
  return Number(match[1]) * (factor[normalizedSuffix] ?? 1);
}

export function finiteEngineering(value: number | string | undefined, fallback: number | string, label = "Engineering value"): number {
  const fallbackNumber = typeof fallback === "number" ? fallback : parseEngineering(fallback, Number.NaN);
  const parsed = parseEngineering(value, fallbackNumber);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite engineering value`);
  return Object.is(parsed, -0) ? 0 : parsed;
}

export function spiceNumber(value: number | string | undefined, fallback: number | string, label = "Engineering value"): string {
  const candidate = value === undefined || (typeof value === "string" && !value.trim()) ? fallback : value;
  const parsed = finiteEngineering(candidate, fallback, label);
  if (typeof candidate === "string") {
    const match = candidate.trim().replace(/µ/g, "u").match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(meg|[fpnumkKMG]?)(?:[a-zA-ZΩ]*)$/i);
    if (match) {
      const coefficient = Number(match[1]).toString();
      const suffix = match[2] === "M" ? "meg" : (match[2] ?? "").toLowerCase();
      return `${coefficient}${suffix}`;
    }
  }
  return Number(parsed.toPrecision(12)).toString();
}
