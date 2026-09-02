import { describe, expect, it } from "vitest";
import { CATALOG_PARTS } from "./catalog";
import { EMPTY_CATALOG_FILTERS, catalogMatch, rankCatalogParts, selectModelDefinition, type CatalogFilters } from "./catalog-truth";

const mpns = (parts: readonly { manifest: { canonical_mpn: string } }[]): string[] => parts.map((part) => part.manifest.canonical_mpn);
const filters = (overrides: Partial<CatalogFilters>): CatalogFilters => ({ ...EMPTY_CATALOG_FILTERS, ...overrides });

describe("catalog search ranking", () => {
  it("puts the 555 timer first for a bare 555", () => {
    const ranked = mpns(rankCatalogParts(CATALOG_PARTS, "555"));
    expect(ranked[0]).toBe("NE555");
    expect(ranked).toContain("LMC555");
    expect(ranked).toContain("TLC555");
    expect(ranked).toContain("ICM7555");
  });

  it("prefers an exact MPN over anything that merely contains it", () => {
    const ranked = mpns(rankCatalogParts(CATALOG_PARTS, "lm358"));
    expect(ranked[0]).toBe("LM358");
  });

  it("ranks an MPN prefix above a description hit", () => {
    const ranked = rankCatalogParts(CATALOG_PARTS, "74HC");
    expect(ranked[0]!.manifest.canonical_mpn.startsWith("74HC")).toBe(true);
    const prefixCount = ranked.filter((part) => part.manifest.canonical_mpn.startsWith("74HC")).length;
    expect(mpns(ranked).slice(0, prefixCount).every((mpn) => mpn.startsWith("74HC"))).toBe(true);
  });

  it("matches an ordering-code alias", () => {
    const match = catalogMatch(CATALOG_PARTS.find((part) => part.manifest.canonical_mpn === "NE555")!, "NE555P");
    expect(match?.rank).toBe(1);
  });

  it("is case-insensitive and ignores surrounding space", () => {
    expect(mpns(rankCatalogParts(CATALOG_PARTS, "  Ne555  "))[0]).toBe("NE555");
  });

  it("falls back to manufacturer, family and description substrings", () => {
    const byMaker = rankCatalogParts(CATALOG_PARTS, "nexperia");
    expect(byMaker.length).toBeGreaterThan(0);
    expect(byMaker.every((part) => part.manifest.manufacturer.toLowerCase().includes("nexperia"))).toBe(true);
    expect(byMaker.every((part) => !part.manifest.canonical_mpn.toLowerCase().includes("nexperia"))).toBe(true);
    const byFamily = rankCatalogParts(CATALOG_PARTS, "comparator");
    expect(byFamily.every((part) => part.manifest.electrical_family === "comparator" || part.manifest.description.toLowerCase().includes("comparator"))).toBe(true);
  });

  it("returns nothing for a query that matches no field", () => {
    expect(rankCatalogParts(CATALOG_PARTS, "zzzznotapart")).toEqual([]);
  });

  it("returns the whole catalog for an empty query", () => {
    expect(rankCatalogParts(CATALOG_PARTS, "").length).toBe(CATALOG_PARTS.length);
  });
});

describe("catalog filter chips", () => {
  it("narrows to placeable packages", () => {
    const placeable = rankCatalogParts(CATALOG_PARTS, "", filters({ placeableOnly: true }));
    expect(placeable.length).toBe(CATALOG_PARTS.filter((part) => part.placeable).length);
    expect(placeable.every((part) => part.placeable)).toBe(true);
  });

  it("narrows by fidelity tier", () => {
    const tierOne = rankCatalogParts(CATALOG_PARTS, "", filters({ tiers: ["F1"] }));
    expect(tierOne.length).toBeGreaterThan(0);
    expect(tierOne.every((part) => part.manifest.fidelity_tier.startsWith("F1"))).toBe(true);
    const both = rankCatalogParts(CATALOG_PARTS, "", filters({ tiers: ["F1", "F2"] }));
    expect(both.length).toBeGreaterThan(tierOne.length);
  });

  it("requires every selected analysis", () => {
    const noise = rankCatalogParts(CATALOG_PARTS, "", filters({ analyses: ["noise"] }));
    expect(noise.every((part) => part.manifest.supported_analyses?.includes("noise"))).toBe(true);
    const both = rankCatalogParts(CATALOG_PARTS, "", filters({ analyses: ["noise", "transient"] }));
    expect(both.length).toBeLessThanOrEqual(noise.length);
    expect(both.every((part) => part.manifest.supported_analyses?.includes("transient"))).toBe(true);
  });

  it("combines a query with chips", () => {
    const ranked = rankCatalogParts(CATALOG_PARTS, "555", filters({ analyses: ["transient"] }));
    expect(ranked[0]?.manifest.canonical_mpn).toBe("NE555");
    expect(ranked.every((part) => part.manifest.supported_analyses?.includes("transient"))).toBe(true);
  });
});

describe("model entry point selection", () => {
  it("skips helper subcircuits and takes the definition nothing instantiates", () => {
    const source = [
      ".subckt HELPER IN Y VCC GND",
      "RX IN Y 1k",
      ".ends HELPER",
      ".subckt TOP A B VCC GND",
      "XU1 A B VCC GND HELPER",
      ".ends TOP",
    ].join("\n");
    expect(selectModelDefinition(source, "subckt")).toEqual({ name: "TOP", ports: ["A", "B", "VCC", "GND"] });
  });

  it("folds continuation lines into the port list", () => {
    const source = ".subckt TOP A B\n+ C D\n+ PARAMS: K=1\nR1 A B 1k\n.ends TOP";
    expect(selectModelDefinition(source, "subckt")?.ports).toEqual(["A", "B", "C", "D"]);
  });

  it("reads a primitive model name", () => {
    expect(selectModelDefinition(".model OC_TEST D(IS=1e-14)", "dot_model")).toEqual({ name: "OC_TEST", ports: [] });
  });

  it("refuses an ambiguous file with two unreferenced definitions", () => {
    const source = ".subckt ONE A B\nR1 A B 1k\n.ends ONE\n.subckt TWO A B\nR1 A B 1k\n.ends TWO";
    expect(selectModelDefinition(source, "subckt")).toBeUndefined();
  });
});
