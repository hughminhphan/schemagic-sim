import type { CircuitComponent, CircuitComponentV4, ComponentType, DesignBlockDefinition, Point } from "./types";

export interface PartDefinition { type: ComponentType; name: string; prefix: string; pins: Point[]; defaultValue?: number | string; note?: string }
export const PARTS: readonly PartDefinition[] = [
  { type: "resistor", name: "Resistor", prefix: "R", pins: [[-2,0],[2,0]], defaultValue: "1k" },
  { type: "capacitor", name: "Capacitor", prefix: "C", pins: [[-2,0],[2,0]], defaultValue: "100n" },
  { type: "inductor", name: "Inductor", prefix: "L", pins: [[-2,0],[2,0]], defaultValue: "1m" },
  { type: "vsource", name: "DC voltage source", prefix: "V", pins: [[0,-2],[0,2]], defaultValue: 5 },
  { type: "vsource_pulse", name: "Pulse voltage source", prefix: "VP", pins: [[0,-2],[0,2]], defaultValue: 5 },
  { type: "vsource_sine", name: "Sine voltage source", prefix: "VS", pins: [[0,-2],[0,2]], defaultValue: 1 },
  { type: "isource", name: "DC current source", prefix: "I", pins: [[0,-2],[0,2]], defaultValue: "1m" },
  { type: "ground", name: "Ground", prefix: "GND", pins: [[0,0]] },
  { type: "switch_spst", name: "SPST switch", prefix: "S", pins: [[-2,0],[2,0]], note: "Ideal switch uses 1 mΩ on and 1 GΩ off." },
  { type: "potentiometer", name: "Potentiometer", prefix: "P", pins: [[0,-2],[2,0],[0,2]], defaultValue: "10k" },
  { type: "diode", name: "Diode", prefix: "D", pins: [[0,-2],[0,2]], defaultValue: "generic" },
  { type: "led", name: "LED", prefix: "LED", pins: [[0,-2],[0,2]], defaultValue: "red" },
  { type: "bjt_npn", name: "NPN transistor", prefix: "Q", pins: [[2,-3],[-2,0],[2,3]], note: "Generic device unless an MPN is selected." },
  { type: "bjt_pnp", name: "PNP transistor", prefix: "Q", pins: [[2,-3],[-2,0],[2,3]], note: "Generic device unless an MPN is selected." },
  { type: "nmos", name: "NMOS", prefix: "M", pins: [[2,-3],[-2,0],[2,3]], note: "Generic level-1 device. No manufacturer part is implied." },
  { type: "pmos", name: "PMOS", prefix: "M", pins: [[2,-3],[-2,0],[2,3]], note: "Generic level-1 device. No manufacturer part is implied." },
  { type: "opamp_ideal", name: "Ideal opamp", prefix: "U", pins: [[-4,-2],[-4,2],[4,0]], note: "Simple high-gain VCVS model, not a real opamp." },
];
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
  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(meg|[pnumkKMG]?)(?:[a-zA-ZΩ]*)$/i);
  if (!match) return Number(text);
  const suffix = match[2] ?? "";
  const factor: Record<string, number> = { p:1e-12,n:1e-9,u:1e-6,m:1e-3,"":1,k:1e3,meg:1e6,g:1e9 };
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
    const match = candidate.trim().replace(/µ/g, "u").match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(meg|[pnumkKMG]?)(?:[a-zA-ZΩ]*)$/i);
    if (match) {
      const coefficient = Number(match[1]).toString();
      const suffix = match[2] === "M" ? "meg" : (match[2] ?? "").toLowerCase();
      return `${coefficient}${suffix}`;
    }
  }
  return Number(parsed.toPrecision(12)).toString();
}
