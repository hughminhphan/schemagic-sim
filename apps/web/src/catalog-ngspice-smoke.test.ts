import { existsSync } from "node:fs";
import { componentPinPoints, isCatalogOnlyType, partByType, type CircuitComponent, type CircuitDocument, type CircuitWire, type Point } from "@opencircuit/circuit-schema";
import { beforeAll, describe, expect, it } from "vitest";
import { CATALOG_PARTS, preloadCatalogPart, type CatalogPart } from "./catalog";
import { generateNetlistWithCatalog } from "./catalog-netlist";
import { declaredPinNames } from "./catalog-truth";
// The native reference harness already owns process spawning, timeouts and
// rawfile parsing for ngspice, so the smoke bench reuses it instead of shelling
// out again with different semantics.
// @ts-expect-error -- plain ESM harness outside the TypeScript workspaces
import { DEFAULT_NGSPICE_PATH, runNative } from "../../../tools/native-ngspice-reference/lib/run-native.mjs";

const NGSPICE = String(DEFAULT_NGSPICE_PATH);
const HAS_NGSPICE = existsSync(NGSPICE);

/** Every part that only became placeable once catalog-only symbols existed. */
const NEWLY_PLACEABLE = CATALOG_PARTS.filter((part) => part.baseType && isCatalogOnlyType(part.baseType));

const VCC_ROLES = /^(positive_supply|supply|input)$/;
const GND_ROLES = /^(ground|negative_supply)$/;

type Rail = "vcc" | "gnd" | "load";

/** Supplies go to the rail they name; every other pin gets a 10k/10k bias so the node has a DC path. */
function railForPin(part: CatalogPart, index: number): Rail {
  const names = declaredPinNames(part.manifest);
  const roles = [...(part.manifest.spice_pin_mapping ?? [])]
    .sort((left, right) => left.order - right.order)
    .map((entry) => (part.manifest.symbol_pins ?? []).find((pin) => pin.number === entry.symbol_pin_number)?.role ?? "");
  const role = roles[index] ?? "";
  const name = (names[index] ?? "").toUpperCase();
  if (GND_ROLES.test(role) || name === "GND" || name === "VSS" || name === "V-") return "gnd";
  if (VCC_ROLES.test(role) || name === "VCC" || name === "VDD" || name === "V+") return "vcc";
  return "load";
}

const VCC_BUS_X = -200;
const GND_BUS_X = 200;
const LOAD_X = 60;

/**
 * Builds a real schematic: the part is placed, every pin is routed with wires,
 * supply pins reach a 5 V source and the rest sit on a resistive divider.
 * Wires may cross because only shared vertices join nets.
 */
function benchDocument(part: CatalogPart): CircuitDocument {
  const type = part.baseType!;
  const component: CircuitComponent = {
    id: "c1", type, pos: [0, 0], rot: 0, mirror: false,
    mpn: part.manifest.canonical_mpn,
    params: { catalogPartId: part.id },
  };
  const components: CircuitComponent[] = [component];
  const wires: CircuitWire[] = [];
  const vccBus: Point[] = [];
  const gndBus: Point[] = [];
  const pins = componentPinPoints(component);
  const offsets = partByType(type).pins;

  pins.forEach((pin, index) => {
    const lane = -40 - 2 * index;
    const [offsetX, offsetY] = offsets[index]!;
    const stub: Point = Math.abs(offsetX) >= Math.abs(offsetY)
      ? [pin[0] + Math.sign(offsetX || 1) * 4, pin[1]]
      : [pin[0], pin[1] + Math.sign(offsetY || 1) * 4];
    const spine: Point[] = [pin, stub, [stub[0], lane]];
    const rail = railForPin(part, index);
    if (rail === "vcc") {
      wires.push({ id: `wv${index}`, points: [...spine, [VCC_BUS_X, lane]] });
      vccBus.push([VCC_BUS_X, lane]);
      return;
    }
    if (rail === "gnd") {
      wires.push({ id: `wg${index}`, points: [...spine, [GND_BUS_X, lane]] });
      gndBus.push([GND_BUS_X, lane]);
      return;
    }
    wires.push({ id: `wl${index}`, points: [...spine, [LOAD_X, lane]] });
    // Pull-up shares the load node, pull-down carries it on to the ground bus.
    components.push({ id: `r${100 + index}`, type: "resistor", pos: [LOAD_X - 2, lane], rot: 0, mirror: false, value: "10k" });
    components.push({ id: `r${200 + index}`, type: "resistor", pos: [LOAD_X + 2, lane], rot: 0, mirror: false, value: "10k" });
    wires.push({ id: `wu${index}`, points: [[LOAD_X - 4, lane], [VCC_BUS_X, lane]] });
    wires.push({ id: `wd${index}`, points: [[LOAD_X + 4, lane], [GND_BUS_X, lane]] });
    vccBus.push([VCC_BUS_X, lane]);
    gndBus.push([GND_BUS_X, lane]);
  });

  components.push({ id: "v900", type: "vsource", pos: [VCC_BUS_X, 300], rot: 0, mirror: false, value: 5 });
  components.push({ id: "g901", type: "ground", pos: [GND_BUS_X, 400], rot: 0, mirror: false });
  vccBus.push([VCC_BUS_X, 298]);
  wires.push({ id: "wreturn", points: [[VCC_BUS_X, 302], [GND_BUS_X, 302]] });
  gndBus.push([GND_BUS_X, 302], [GND_BUS_X, 400]);

  const bus = (x: number, points: Point[], id: string): CircuitWire => ({
    id,
    points: [...new Set(points.map(([, y]) => y))].sort((left, right) => left - right).map((y) => [x, y] as Point),
  });
  wires.push(bus(VCC_BUS_X, vccBus, "wbusv"), bus(GND_BUS_X, gndBus, "wbusg"));

  return {
    format: "opencircuit-circuit", version: 3,
    meta: { title: `${part.manifest.canonical_mpn} smoke bench` },
    components, wires, probes: [], sim: { mode: "op" },
  };
}

describe.skipIf(!HAS_NGSPICE)("newly placeable catalog parts solve an operating point in native ngspice", () => {
  beforeAll(async () => {
    await Promise.all(NEWLY_PLACEABLE.map((part) => preloadCatalogPart(part.id).catch(() => undefined)));
  }, 120_000);

  it("covers every newly placeable package", () => {
    expect(NEWLY_PLACEABLE.length).toBe(43);
  });

  for (const part of NEWLY_PLACEABLE) {
    it(`runs .op for ${part.id}`, async () => {
      if (!part.placeable) return;
      const generated = generateNetlistWithCatalog(benchDocument(part), "op", [part]);
      expect(generated.netlist).toMatch(/^\.op$/m);
      const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
      expect(run.stderr, `${part.id} ngspice stderr:\n${run.stderr}`).not.toMatch(/error|singular|aborted/i);
      expect(Object.keys(run.vectors ?? {}).length).toBeGreaterThan(0);
    }, 90_000);
  }
});
