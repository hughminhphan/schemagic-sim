import { componentPinPoints, partByType, type CircuitComponent, type CircuitDocument, type CircuitWire, type Point } from "@opencircuit/circuit-schema";
import { declaredPinNames } from "./catalog-truth";
import type { CatalogPart } from "./catalog";

/**
 * Test-support scaffolding, not part of the application bundle. Builds a real
 * schematic around one placed catalog package: supplies reach a DC source and
 * every other pin sits on a 10k/10k divider so no node floats. Wires may cross,
 * because only a shared vertex joins two nets.
 */
export interface CatalogBenchLayout {
  /** x column of the positive rail. */
  vccBusX: number;
  /** x column of the ground rail. */
  gndBusX: number;
  /** x column where the divider pair sits. */
  loadX: number;
  /** y of the first pin lane; lanes step upward from here. */
  firstLane: number;
  supplyVolts: number;
}

export const WIDE_CATALOG_BENCH: CatalogBenchLayout = Object.freeze({ vccBusX: -200, gndBusX: 200, loadX: 60, firstLane: -40, supplyVolts: 5 });
export const COMPACT_CATALOG_BENCH: CatalogBenchLayout = Object.freeze({ vccBusX: -30, gndBusX: 30, loadX: 16, firstLane: -14, supplyVolts: 5 });

const GROUND_NAMES = new Set(["GND", "VSS", "V-", "0"]);
const SUPPLY_NAMES = new Set(["VCC", "VDD", "V+", "VS", "+VS"]);
const GROUND_ROLES = /^(ground|negative_supply)$/;
const SUPPLY_ROLES = /^(positive_supply|supply|input)$/;

export type CatalogBenchRail = "vcc" | "gnd" | "load";

export function benchRailForPin(part: CatalogPart, index: number): CatalogBenchRail {
  const name = (declaredPinNames(part.manifest)[index] ?? "").toUpperCase();
  const role = [...(part.manifest.spice_pin_mapping ?? [])]
    .sort((left, right) => left.order - right.order)
    .map((entry) => (part.manifest.symbol_pins ?? []).find((pin) => pin.number === entry.symbol_pin_number)?.role ?? "")[index] ?? "";
  if (GROUND_ROLES.test(role) || GROUND_NAMES.has(name)) return "gnd";
  if (SUPPLY_ROLES.test(role) || SUPPLY_NAMES.has(name)) return "vcc";
  return "load";
}

export function catalogBenchDocument(part: CatalogPart, layout: CatalogBenchLayout = WIDE_CATALOG_BENCH): CircuitDocument {
  const type = part.baseType!;
  const device: CircuitComponent = {
    id: "c1", type, pos: [0, 0], rot: 0, mirror: false,
    mpn: part.manifest.canonical_mpn,
    params: { catalogPartId: part.id },
    label: { text: part.manifest.canonical_mpn, offset: [0, -10] },
  };
  const components: CircuitComponent[] = [device];
  const wires: CircuitWire[] = [];
  const vccBus: number[] = [];
  const gndBus: number[] = [];
  const offsets = partByType(type).pins;

  componentPinPoints(device).forEach((pin, index) => {
    const lane = layout.firstLane - 2 * index;
    const [offsetX, offsetY] = offsets[index]!;
    const stub: Point = Math.abs(offsetX) >= Math.abs(offsetY)
      ? [pin[0] + Math.sign(offsetX || 1) * 2, pin[1]]
      : [pin[0], pin[1] + Math.sign(offsetY || 1) * 2];
    const spine: Point[] = [pin, stub, [stub[0], lane]];
    const rail = benchRailForPin(part, index);
    if (rail === "vcc") {
      wires.push({ id: `wv${index}`, points: [...spine, [layout.vccBusX, lane]] });
      vccBus.push(lane);
      return;
    }
    if (rail === "gnd") {
      wires.push({ id: `wg${index}`, points: [...spine, [layout.gndBusX, lane]] });
      gndBus.push(lane);
      return;
    }
    wires.push({ id: `wl${index}`, points: [...spine, [layout.loadX, lane]] });
    components.push({ id: `r${100 + index}`, type: "resistor", pos: [layout.loadX - 2, lane], rot: 0, mirror: false, value: "10k" });
    components.push({ id: `r${200 + index}`, type: "resistor", pos: [layout.loadX + 2, lane], rot: 0, mirror: false, value: "10k" });
    wires.push({ id: `wu${index}`, points: [[layout.loadX - 4, lane], [layout.vccBusX, lane]] });
    wires.push({ id: `wd${index}`, points: [[layout.loadX + 4, lane], [layout.gndBusX, lane]] });
    vccBus.push(lane);
    gndBus.push(lane);
  });

  const sourceY = 20;
  components.push({ id: "v900", type: "vsource", pos: [layout.vccBusX, sourceY + 2], rot: 0, mirror: false, value: layout.supplyVolts });
  components.push({ id: "g901", type: "ground", pos: [layout.gndBusX, sourceY + 12], rot: 0, mirror: false });
  vccBus.push(sourceY);
  wires.push({ id: "wreturn", points: [[layout.vccBusX, sourceY + 4], [layout.gndBusX, sourceY + 4]] });
  gndBus.push(sourceY + 4, sourceY + 12);

  const bus = (x: number, lanes: number[], id: string): CircuitWire =>
    ({ id, points: [...new Set(lanes)].sort((left, right) => left - right).map((y) => [x, y] as Point) });
  wires.push(bus(layout.vccBusX, vccBus, "wbusv"), bus(layout.gndBusX, gndBus, "wbusg"));

  return {
    format: "opencircuit-circuit", version: 3,
    meta: { title: `${part.manifest.canonical_mpn} bench` },
    components, wires, probes: [], sim: { mode: "op" },
  };
}

/**
 * Classic 555 astable. R1 charges the timing capacitor through R2 and pin 7
 * discharges the junction, so the part runs on its own rather than sitting on a
 * bias network. Pin index i is package node i: GND TRIG OUT RESET CONT THRES
 * DISCH VCC, which is what puts OUT on the left and DISCH on the right.
 */
export function ne555AstableDocument(part: CatalogPart): CircuitDocument {
  const components: CircuitComponent[] = [
    {
      id: "c1", type: "timer_555", pos: [0, 0], rot: 0, mirror: false,
      mpn: part.manifest.canonical_mpn,
      params: { catalogPartId: part.id },
      label: { text: part.manifest.canonical_mpn, offset: [0, -6] },
    },
    { id: "v900", type: "vsource", pos: [-30, 1], rot: 0, mirror: false, value: 9 },
    { id: "g901", type: "ground", pos: [0, 22], rot: 0, mirror: false },
    { id: "r101", type: "resistor", pos: [14, -9], rot: 90, mirror: false, value: "10k" },
    { id: "r102", type: "resistor", pos: [18, 6], rot: 0, mirror: false, value: "68k" },
    { id: "c103", type: "capacitor", pos: [26, 10], rot: 90, mirror: false, value: "100n" },
    { id: "c104", type: "capacitor", pos: [34, 10], rot: 90, mirror: false, value: "10n" },
    { id: "r105", type: "resistor", pos: [-18, 8], rot: 90, mirror: false, value: "1k" },
  ];
  const wires: CircuitWire[] = [
    { id: "w1", points: [[-30, -14], [-14, -14], [6, -14], [14, -14]] },
    { id: "w2", points: [[-30, 16], [-22, 16], [-18, 16], [0, 16], [26, 16], [34, 16]] },
    { id: "w3", points: [[-30, -1], [-30, -14]] },
    { id: "w4", points: [[-30, 3], [-30, 16]] },
    { id: "w5", points: [[0, 16], [0, 22]] },
    { id: "w6", points: [[6, -3], [6, -14]] },
    { id: "w7", points: [[-6, 3], [-14, 3], [-14, -14]] },
    { id: "w8", points: [[-6, -3], [-22, -3], [-22, 16]] },
    { id: "w9", points: [[14, -11], [14, -14]] },
    { id: "w10", points: [[14, -7], [14, -1], [14, 6], [16, 6]] },
    { id: "w11", points: [[6, -1], [14, -1]] },
    { id: "w12", points: [[20, 6], [22, 6], [22, 1], [6, 1]] },
    { id: "w13", points: [[22, 6], [26, 6], [26, 8]] },
    { id: "w14", points: [[26, 12], [26, 16]] },
    { id: "w15", points: [[-6, -1], [-10, -1], [-10, 13], [22, 13], [22, 6]] },
    { id: "w16", points: [[6, 3], [34, 3], [34, 8]] },
    { id: "w17", points: [[34, 12], [34, 16]] },
    { id: "w18", points: [[-6, 1], [-18, 1], [-18, 6]] },
    { id: "w19", points: [[-18, 10], [-18, 16]] },
  ];
  return {
    format: "opencircuit-circuit", version: 3,
    meta: { title: `${part.manifest.canonical_mpn} astable` },
    components, wires, probes: [],
    sim: { mode: "tran", tran: { tstop: 0.01, tstep: 0.00002, maxstep: 0.00005 } },
  };
}
