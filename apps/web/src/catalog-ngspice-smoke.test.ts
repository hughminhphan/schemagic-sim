import { existsSync } from "node:fs";
import { componentPinPoints, isCatalogOnlyType, validateCircuit, type CircuitDocument, type Point } from "@opencircuit/circuit-schema";
import { beforeAll, describe, expect, it } from "vitest";
import { CATALOG_PARTS, preloadCatalogPart, type CatalogPart } from "./catalog";
import { catalogBenchDocument, ne555AstableDocument, type CatalogBenchPart } from "./catalog-bench";
import { generateNetlistWithCatalog } from "./catalog-netlist";
// The native reference harness already owns process spawning, timeouts and
// rawfile parsing for ngspice, so the smoke bench reuses it instead of shelling
// out again with different semantics.
// @ts-expect-error -- plain ESM harness outside the TypeScript workspaces
import { DEFAULT_NGSPICE_PATH, runNative } from "../../../tools/native-ngspice-reference/lib/run-native.mjs";

const NGSPICE = String(DEFAULT_NGSPICE_PATH);
const HAS_NGSPICE = existsSync(NGSPICE);

/** Every part that only became placeable once catalog-only symbols existed. */
const NEWLY_PLACEABLE = CATALOG_PARTS.filter((part) => part.baseType && isCatalogOnlyType(part.baseType));
/** Narrows a catalog part to the bench slice without losing the live, mutated object identity. */
const bench = (part: CatalogPart): CatalogBenchPart => ({ id: part.id, baseType: part.baseType!, manifest: part.manifest });

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
      const generated = generateNetlistWithCatalog(catalogBenchDocument(bench(part)), "op", [part]);
      expect(generated.netlist).toMatch(/^\.op$/m);
      const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 60_000 });
      expect(run.stderr, `${part.id} ngspice stderr:\n${run.stderr}`).not.toMatch(/error|singular|aborted/i);
      expect(Object.keys(run.vectors ?? {}).length).toBeGreaterThan(0);
    }, 90_000);
  }
});

/** No wire may run over a pin that is not one of its own vertices, or the schematic reads as a short. */
function pinsCoveredByForeignWires(document: CircuitDocument): string[] {
  const pins = document.components.flatMap((component) => componentPinPoints(component).map((point) => ({ component: component.id, point })));
  const covered: string[] = [];
  for (const wire of document.wires) {
    const vertices = new Set(wire.points.map(([x, y]) => `${x},${y}`));
    for (let index = 1; index < wire.points.length; index += 1) {
      const [ax, ay] = wire.points[index - 1] as Point;
      const [bx, by] = wire.points[index] as Point;
      for (const pin of pins) {
        const [px, py] = pin.point;
        if (vertices.has(`${px},${py}`)) continue;
        const onSegment = ax === bx
          ? px === ax && py > Math.min(ay, by) && py < Math.max(ay, by)
          : py === ay && px > Math.min(ax, bx) && px < Math.max(ax, bx);
        if (onSegment) covered.push(`${wire.id} runs over ${pin.component} pin at ${px},${py}`);
      }
    }
  }
  return covered;
}

describe.skipIf(!HAS_NGSPICE)("the NE555 astable capture bench", () => {
  const part = CATALOG_PARTS.find((candidate) => candidate.manifest.canonical_mpn === "NE555")!;
  beforeAll(async () => { await preloadCatalogPart(part.id); }, 60_000);

  it("is a valid schematic with no wire crossing a foreign pin", () => {
    const document = ne555AstableDocument(bench(part));
    expect(validateCircuit(document)).toEqual([]);
    expect(pinsCoveredByForeignWires(document)).toEqual([]);
  });

  it("oscillates in native ngspice", async () => {
    const generated = generateNetlistWithCatalog(ne555AstableDocument(bench(part)), "tran", [part]);
    const run = await runNative({ netlist: generated.netlist, ngspicePath: NGSPICE, timeoutMs: 90_000 });
    expect(run.stderr, run.stderr).not.toMatch(/error|singular|aborted/i);
    const swings = Object.values(run.vectors as Record<string, unknown>)
      .map((vector) => (Array.isArray(vector) ? vector : (vector as { values?: number[] }).values) ?? [])
      .filter((values) => values.length > 10 && Math.max(...values) - Math.min(...values) > 1);
    expect(swings.length, "no node swings by more than a volt, so the timer never ran").toBeGreaterThan(0);
  }, 120_000);
});

