import type { CircuitComponent, ComponentType, Point } from "./types";

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
export function componentPoint(component: CircuitComponent, [inputX,inputY]: Point): Point {
  const x = component.mirror ? -inputX : inputX;
  let offset: Point;
  switch (component.rot) { case 0:offset=[x,inputY];break; case 90:offset=[-inputY,x];break; case 180:offset=[-x,-inputY];break; case 270:offset=[inputY,-x];break; }
  return [component.pos[0]+offset[0],component.pos[1]+offset[1]];
}
export function componentPinPoints(component: CircuitComponent): Point[] {
  return partByType(component.type).pins.map((offset) => componentPoint(component, offset));
}
export function parseEngineering(value: number | string | undefined, fallback = 0): number {
  if (typeof value === "number") return value;
  if (!value?.trim()) return fallback;
  const text = value.trim().replace(/µ/g, "u");
  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([pnumkKMG]?)(?:[a-zA-ZΩ]*)$/);
  if (!match) return Number(text);
  const factor: Record<string, number> = { p:1e-12,n:1e-9,u:1e-6,m:1e-3,"":1,k:1e3,K:1e3,M:1e6,G:1e9 };
  return Number(match[1]) * (factor[match[2] ?? ""] ?? 1);
}
