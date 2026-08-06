import { canonicalizeCircuit, fnv1a64 } from "./canonical";
import type {
  AnalysisMode,
  CircuitComponent,
  CircuitDocument,
  GeneratedNetlist,
  NetlistLine,
} from "./types";

const NPN_MODEL = ".model OC_2N3904 NPN(IS=6.734F BF=255.9 VAF=74.03 IKF=0.2847 ISE=6.734F NE=1.307 BR=6.092 VAR=12.5 IKR=0.1 ISC=0 NC=2 RB=10 IRB=0.1 RBM=10 RE=0.1 RC=1 XTB=1.5 CJE=4.493P VJE=0.75 MJE=0.2593 TF=0.3012N XTF=2 VTF=4 ITF=0.4 CJC=3.638P VJC=0.75 MJC=0.3085 TR=239.5N)";
const LED_MODEL = ".model OC_LED_RED D(IS=1e-20 N=2 RS=10 EG=1.8 CJO=30P M=0.4 VJ=0.75 BV=5 IBV=10U)";

type Point = [number, number];

class UnionFind {
  private readonly parents = new Map<string, string>();

  add(key: string): void {
    if (!this.parents.has(key)) this.parents.set(key, key);
  }

  find(key: string): string {
    this.add(key);
    const parent = this.parents.get(key);
    if (parent === undefined || parent === key) return key;
    const root = this.find(parent);
    this.parents.set(key, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parents.set(rootB, rootA);
  }
}

const pointKey = ([x, y]: Point): string => `${x},${y}`;
const idNumber = (id: string): string => id.replace(/\D/g, "") || id.replace(/[^a-z0-9]/gi, "");

function basePinOffsets(type: string): Point[] {
  switch (type) {
    case "vsource":
    case "led":
      return [[0, -2], [0, 2]];
    case "potentiometer":
      return [[0, -6], [4, 0], [0, 6]];
    case "resistor":
      return [[-2, 0], [2, 0]];
    case "bjt_npn":
      return [[2, -4], [-2, 0], [2, 4]];
    case "ground":
      return [[0, 0]];
    default:
      throw new Error(`Unsupported component type ${type}`);
  }
}

function transformOffset([inputX, inputY]: Point, component: CircuitComponent): Point {
  const x = component.mirror ? -inputX : inputX;
  const y = inputY;
  switch (component.rot) {
    case 0:
      return [x, y];
    case 90:
      return [-y, x];
    case 180:
      return [-x, -y];
    case 270:
      return [y, -x];
  }
}

export function componentPinPoints(component: CircuitComponent): Point[] {
  return basePinOffsets(component.type).map((offset) => {
    const [x, y] = transformOffset(offset, component);
    return [component.pos[0] + x, component.pos[1] + y];
  });
}

function spiceValue(value: number | string | undefined, fallback: number): string {
  if (typeof value === "number") return Number(value.toPrecision(12)).toString();
  if (typeof value === "string" && value.trim()) return value.trim();
  return String(fallback);
}

function potWiper(component: CircuitComponent): number {
  const raw = Number(component.params?.t ?? 0.5);
  return Math.min(0.995, Math.max(0.005, Number.isFinite(raw) ? raw : 0.5));
}

function addLine(lines: string[], lineMap: NetlistLine[], text: string, map: Omit<NetlistLine, "line">): void {
  const rendered = map.componentId ? `${text} $ component:${map.componentId}` : text;
  lines.push(rendered);
  lineMap.push({ line: lines.length, ...map });
}

export function generateNetlist(document: CircuitDocument, requestedMode?: AnalysisMode): GeneratedNetlist {
  if (document.format !== "opencircuit-circuit" || document.version !== 1) {
    throw new Error("Unsupported circuit document format or version");
  }

  const components = [...document.components].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const wires = [...document.wires].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const union = new UnionFind();
  const pins = new Map<string, Point[]>();

  for (const wire of wires) {
    if (wire.points.length < 2) throw new Error(`Wire ${wire.id} needs at least two points`);
    const first = pointKey(wire.points[0] as Point);
    union.add(first);
    for (const point of wire.points.slice(1)) union.union(first, pointKey(point));
  }

  for (const component of components) {
    const points = componentPinPoints(component);
    pins.set(component.id, points);
    for (const point of points) union.add(pointKey(point));
  }

  const groundComponents = components.filter((component) => component.type === "ground");
  if (groundComponents.length === 0) throw new Error("Circuit needs a ground symbol before it can run");
  const groundRoot = union.find(pointKey((pins.get(groundComponents[0]!.id) ?? [])[0] as Point));
  for (const ground of groundComponents.slice(1)) {
    union.union(groundRoot, pointKey((pins.get(ground.id) ?? [])[0] as Point));
  }
  const normalizedGroundRoot = union.find(groundRoot);

  const rootNames = new Map<string, string>();
  rootNames.set(normalizedGroundRoot, "0");
  let nextNode = 1;
  for (const component of components) {
    const points = pins.get(component.id) ?? [];
    points.forEach((point) => {
      const root = union.find(pointKey(point));
      if (!rootNames.has(root)) rootNames.set(root, `n${nextNode++}`);
    });
  }

  const nodeAt = (point: Point): string => {
    const root = union.find(pointKey(point));
    return root === union.find(normalizedGroundRoot) ? "0" : (rootNames.get(root) ?? `n${nextNode++}`);
  };
  const componentNodes: Record<string, string[]> = {};
  for (const component of components) componentNodes[component.id] = (pins.get(component.id) ?? []).map(nodeAt);
  const wireNodes = Object.fromEntries(wires.map((wire) => [wire.id, nodeAt(wire.points[0] as Point)]));

  const canonical = canonicalizeCircuit(document, false);
  const documentHash = fnv1a64(canonical);
  const lines: string[] = [];
  const lineMap: NetlistLine[] = [];
  addLine(lines, lineMap, `OpenCircuit document ${documentHash}`, { stage: "header" });
  addLine(lines, lineMap, `* document-hash ${documentHash}`, { stage: "header" });

  const mode = requestedMode ?? document.sim.mode;
  const savedCurrents: string[] = [];
  let pot: CircuitComponent | undefined;

  for (const component of components) {
    if (component.type === "ground") continue;
    const nodes = componentNodes[component.id] ?? [];
    const suffix = idNumber(component.id);
    switch (component.type) {
      case "vsource": {
        const ac = mode === "ac" ? " AC 0" : "";
        addLine(lines, lineMap, `V${suffix} ${nodes[0]} ${nodes[1]} DC ${spiceValue(component.value, 5)}${ac}`, { stage: "component", componentId: component.id });
        break;
      }
      case "resistor": {
        const name = `R${suffix}`;
        addLine(lines, lineMap, `${name} ${nodes[0]} ${nodes[1]} ${spiceValue(component.value, 1000)}`, { stage: "component", componentId: component.id });
        savedCurrents.push(`@${name.toLowerCase()}[i]`);
        break;
      }
      case "potentiometer": {
        pot = component;
        if (mode === "live" || mode === "op") {
          const total = Number(component.value ?? 10_000);
          const t = potWiper(component);
          const top = Math.max(0.001, total * (1 - t));
          const bottom = Math.max(0.001, total * t);
          addLine(lines, lineMap, `R${suffix}T ${nodes[0]} ${nodes[1]} ${spiceValue(top, 5000)}`, { stage: "component", componentId: component.id });
          addLine(lines, lineMap, `R${suffix}B ${nodes[1]} ${nodes[2]} ${spiceValue(bottom, 5000)}`, { stage: "component", componentId: component.id });
          savedCurrents.push(`@r${suffix.toLowerCase()}t[i]`, `@r${suffix.toLowerCase()}b[i]`);
        }
        break;
      }
      case "led": {
        const name = `D${suffix}`;
        addLine(lines, lineMap, `${name} ${nodes[0]} ${nodes[1]} OC_LED_RED`, { stage: "component", componentId: component.id });
        savedCurrents.push(`@${name.toLowerCase()}[id]`);
        break;
      }
      case "bjt_npn": {
        const name = `Q${suffix}`;
        addLine(lines, lineMap, `${name} ${nodes[0]} ${nodes[1]} ${nodes[2]} OC_2N3904`, { stage: "component", componentId: component.id });
        savedCurrents.push(`@${name.toLowerCase()}[ic]`);
        break;
      }
      default:
        throw new Error(`No SPICE mapping for ${component.type}`);
    }
  }

  if (pot && (mode === "tran" || mode === "ac")) {
    const nodes = componentNodes[pot.id] ?? [];
    const t = potWiper(pot);
    const high = 5 * t;
    if (mode === "tran") {
      addLine(lines, lineMap, `VDRIVE ${nodes[1]} 0 PULSE(0 ${spiceValue(high, 2.5)} 1m 10u 10u 4m 10m)`, { stage: "analysis", componentId: pot.id });
    } else {
      addLine(lines, lineMap, `VDRIVE ${nodes[1]} 0 DC ${spiceValue(high, 2.5)} AC 1`, { stage: "analysis", componentId: pot.id });
    }
  }

  const bjt = components.find((component) => component.type === "bjt_npn");
  if (bjt) addLine(lines, lineMap, NPN_MODEL, { stage: "model", componentId: bjt.id });
  const led = components.find((component) => component.type === "led");
  if (led) addLine(lines, lineMap, LED_MODEL, { stage: "model", componentId: led.id });

  const save = [...new Set(savedCurrents)].join(" ");
  addLine(lines, lineMap, `.save all ${save}`, { stage: "analysis" });
  if (mode === "tran") {
    const tran = document.sim.tran ?? { tstop: 0.01, tstep: 0.00002, maxstep: 0.00005 };
    addLine(lines, lineMap, `.tran ${spiceValue(tran.tstep, 0.00002)} ${spiceValue(tran.tstop, 0.01)} 0 ${spiceValue(tran.maxstep, 0.00005)}`, { stage: "analysis" });
  } else if (mode === "ac") {
    const ac = document.sim.ac ?? { fstart: 10, fstop: 1_000_000, pointsPerDecade: 30, sweep: "dec" as const };
    addLine(lines, lineMap, `.ac dec ${Math.max(1, Math.round(ac.pointsPerDecade))} ${spiceValue(ac.fstart, 10)} ${spiceValue(ac.fstop, 1_000_000)}`, { stage: "analysis" });
  } else {
    addLine(lines, lineMap, ".op", { stage: "analysis" });
  }
  addLine(lines, lineMap, ".end", { stage: "analysis" });

  return { netlist: `${lines.join("\n")}\n`, lineMap, componentNodes, wireNodes, documentHash };
}

export const interimModels = {
  OC_2N3904: NPN_MODEL,
  OC_LED_RED: LED_MODEL,
} as const;
