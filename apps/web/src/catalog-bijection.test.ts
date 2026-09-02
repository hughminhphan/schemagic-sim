import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { componentPinPoints, isCatalogOnlyType, partByType, type CircuitComponent, type CircuitDocument, type CircuitWire, type Point } from "@opencircuit/circuit-schema";
import { beforeAll, describe, expect, it } from "vitest";
import {
  CATALOG_NATIVE_WASM_DISAGREEMENT,
  CATALOG_NONPLACEABLE_BREAKDOWN,
  CATALOG_PARTS,
  CATALOG_PLACEABLE_COUNT,
  CATALOG_REFERENCE_ONLY_COUNT,
  CATALOG_REVIEWED_COUNT,
  preloadCatalogPart,
  type CatalogPart,
  type ValidationResults,
} from "./catalog";
import { generateNetlistWithCatalog, CATALOG_ANALYSIS_BY_MODE } from "./catalog-netlist";
import { declaredNodeOrder } from "./catalog-truth";
import type { AnalysisMode } from "@opencircuit/circuit-schema";

/**
 * Node index the netlist writer must use for a role-mapped legacy symbol. The
 * table is restated here on purpose: if the writer's own table changes, this
 * test has to be changed too, which is the point of a bijection contract.
 */
const LEGACY_PIN_INDEX: Readonly<Record<string, number>> = Object.freeze({
  anode: 0, cathode: 1,
  collector: 0, base: 1, emitter: 2,
  drain: 0, gate: 1, source: 2,
  inp: 0, inn: 1, out: 2,
});
const VIRTUAL_SUPPLY_NODES = new Set(["vcc", "vee"]);

const netLabel = (index: number): string => `ocpin${index}`;

const MODELS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/model-library/models");

/** Walks the library on disk so the bundled catalog cannot silently disagree with it. */
function loadLibraryPackageIds(): { id: string; directory: string }[] {
  return readdirSync(MODELS_ROOT, { withFileTypes: true })
    .filter((manufacturer) => manufacturer.isDirectory())
    .flatMap((manufacturer) => readdirSync(join(MODELS_ROOT, manufacturer.name), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ id: `${manufacturer.name}/${entry.name}`, directory: join(MODELS_ROOT, manufacturer.name, entry.name) })));
}

/** Puts every schematic pin of one placed catalog part on its own named net. */
function benchDocument(part: CatalogPart): CircuitDocument {
  const type = part.baseType!;
  const component: CircuitComponent = {
    id: "c1", type, pos: [0, 0], rot: 0, mirror: false,
    mpn: part.manifest.canonical_mpn,
    params: { catalogPartId: part.id },
  };
  const ground: CircuitComponent = { id: "c2", type: "ground", pos: [200, 400], rot: 0, mirror: false };
  const wires: CircuitWire[] = componentPinPoints(component).map((pin, index) => {
    const [offsetX, offsetY] = partByType(type).pins[index]!;
    const lane = -24 - 2 * index;
    const outward: Point = Math.abs(offsetX) >= Math.abs(offsetY) ? [pin[0] + Math.sign(offsetX || 1) * 4, pin[1]] : [pin[0], lane];
    const points: Point[] = Math.abs(offsetX) >= Math.abs(offsetY)
      ? [pin, outward, [outward[0], lane], [outward[0] + 8, lane]]
      : [pin, [pin[0], lane], [pin[0] + 8, lane]];
    return { id: `w${index}`, points, netLabel: netLabel(index) };
  });
  return {
    format: "opencircuit-circuit", version: 3,
    meta: { title: "bijection bench" },
    components: [component, ground],
    wires,
    probes: [],
    sim: { mode: "op" },
  };
}

function supportedMode(part: CatalogPart): AnalysisMode | undefined {
  const declared = part.manifest.supported_analyses ?? [];
  return (["op", "dc-sweep", "tran", "ac", "noise"] as AnalysisMode[])
    .find((mode) => declared.includes(CATALOG_ANALYSIS_BY_MODE[mode]));
}

function deviceNodes(netlist: string, modelName: string): string[] {
  const line = netlist.split("\n").find((candidate) => / \$ component:c1$/.test(candidate) && !candidate.startsWith("*") && candidate.split(/\s+/).includes(modelName));
  if (!line) throw new Error(`no device line for c1 in\n${netlist}`);
  const tokens = line.replace(/ \$ component:c1$/, "").trim().split(/\s+/);
  const modelIndex = tokens.lastIndexOf(modelName);
  if (modelIndex < 1) throw new Error(`model ${modelName} not found in ${line}`);
  return tokens.slice(1, modelIndex);
}

describe("catalog symbol to subcircuit bijection", () => {
  beforeAll(async () => {
    await Promise.all(CATALOG_PARTS.map((part) => preloadCatalogPart(part.id).catch(() => undefined)));
  }, 120_000);

  it("gives every reviewed package a symbol", () => {
    expect(CATALOG_REVIEWED_COUNT).toBe(CATALOG_PARTS.length);
    const orphans = [...new Set(CATALOG_PARTS.filter((part) => !part.baseType).map((part) => part.manifest.electrical_family))];
    expect(orphans).toEqual([]);
  });

  it("counts only recorded native and WASM disagreement as reference-only", () => {
    const recorded = loadLibraryPackageIds()
      .filter((entry) => {
        const validation = JSON.parse(readFileSync(join(entry.directory, "validation-results.json"), "utf8")) as ValidationResults;
        return validation.native_wasm_all_pass !== true || validation.expectations_all_pass !== true || validation.expectation_fail_count !== 0;
      })
      .map((entry) => entry.id)
      .sort();
    expect([...CATALOG_NATIVE_WASM_DISAGREEMENT].sort()).toEqual(recorded);
    expect(CATALOG_REFERENCE_ONLY_COUNT).toBe(recorded.length);
    expect(CATALOG_PLACEABLE_COUNT).toBe(CATALOG_REVIEWED_COUNT - recorded.length);
    expect(Object.keys(CATALOG_NONPLACEABLE_BREAKDOWN)).toEqual(["comparator"]);
  });

  for (const part of CATALOG_PARTS) {
    it(`emits ${part.id} with the package pin order`, () => {
      expect(part.placeable).toBe(!CATALOG_NATIVE_WASM_DISAGREEMENT.includes(part.id));
      const type = part.baseType!;
      const nodes = declaredNodeOrder(part.manifest);
      expect(nodes, `${part.id} declares a broken symbol-pin mapping`).toBeTruthy();
      const pinCount = partByType(type).pins.length;

      if (isCatalogOnlyType(type)) {
        // The symbol's pin set is exactly the subcircuit node list, in order.
        expect(nodes!.length).toBe(pinCount);
      }

      if (!part.placeable) return;
      const mode = supportedMode(part);
      expect(mode, `${part.id} declares no analysis this build can request`).toBeTruthy();
      const generated = generateNetlistWithCatalog(benchDocument(part), mode, [part]);
      const emitted = deviceNodes(generated.netlist, part.modelName!);

      const expected = nodes!.map((node, index) => {
        if (isCatalogOnlyType(type)) return netLabel(index);
        const legacyIndex = LEGACY_PIN_INDEX[node];
        if (legacyIndex !== undefined) return netLabel(legacyIndex);
        expect(VIRTUAL_SUPPLY_NODES.has(node), `${part.id} maps unknown node ${node}`).toBe(true);
        return `oc_1_${node}`;
      });
      // MOS primitives repeat the source node as the bulk terminal.
      expect(emitted.slice(0, expected.length)).toEqual(expected);
      expect(new Set(emitted)).toEqual(new Set([...expected, ...emitted.slice(expected.length)]));
      for (let index = 0; index < pinCount; index += 1) {
        expect(emitted, `${part.id} leaves symbol pin ${index + 1} unconnected`).toContain(netLabel(index));
      }
    });
  }
});
