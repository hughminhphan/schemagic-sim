import { describe, expect, it } from "vitest";
import { generateNetlist } from "@opencircuit/circuit-schema";
import {
  CATALOG_EAGER_PAYLOAD_CONTRACT,
  CATALOG_NATIVE_WASM_DISAGREEMENT,
  CATALOG_NONPLACEABLE_BREAKDOWN,
  CATALOG_PARTS,
  CATALOG_PLACEABLE_COUNT,
  CATALOG_REFERENCE_ONLY_COUNT,
  CATALOG_REVIEWED_COUNT,
  preloadCatalogPart,
  preloadCatalogPartsForDocument,
} from "./catalog";
import { applyCatalogModels } from "./catalog-netlist";
import { demoCircuit } from "./demo";

describe("catalog release truth", () => {
  it("exposes the reviewed/placeable counts and exact reference-only breakdown", () => {
    expect(CATALOG_PARTS).toHaveLength(771);
    expect(CATALOG_REVIEWED_COUNT).toBe(771);
    expect(CATALOG_PLACEABLE_COUNT).toBe(768);
    expect(CATALOG_REFERENCE_ONLY_COUNT).toBe(3);
    // Every family now has a symbol. The remainder is three comparator packages
    // whose recorded validation says native and WASM disagree.
    expect(CATALOG_NONPLACEABLE_BREAKDOWN).toEqual({ comparator: 3 });
    expect(CATALOG_PARTS.filter((part) => !part.placeable).map((part) => part.id).sort())
      .toEqual([...CATALOG_NATIVE_WASM_DISAGREEMENT].sort());
    expect(CATALOG_PARTS.filter((part) => part.placeable).every((part) =>
      part.manifestValid && part.reviewed && part.baseType
      && part.manifest.symbol_pins?.length && part.manifest.spice_pin_mapping?.length,
    )).toBe(true);
  });

  it("keeps model bodies, cards, provenance and validation behind lazy loaders", () => {
    expect(CATALOG_EAGER_PAYLOAD_CONTRACT).toEqual({
      manifestCount: 771,
      eagerManifestBytes: 3_392_073,
      eagerDetailCount: 0,
      lazyModelCount: 771,
      lazyModelCardCount: 771,
      lazySourcesCount: 771,
      lazyValidationCount: 771,
    });
    expect(CATALOG_PARTS.every((part) => part.detailState === "unloaded"
      && !("modelSource" in part) && !("modelCard" in part) && !("validation" in part))).toBe(true);
  });

  it("loads and validates one package on demand", async () => {
    const part = await preloadCatalogPart("onsemi/2N3904");
    expect(part.detailState).toBe("loaded");
    expect(part.modelName).toBeTruthy();
    expect(part.modelSource).toMatch(/^\s*\.?/);
    expect(part.validation).toMatchObject({ native_wasm_all_pass: true, expectations_all_pass: true });
    expect(part.placeable).toBe(true);
    const subcircuit = await preloadCatalogPart("ti/LM741");
    expect(subcircuit.manifest.model_type).toBe("subckt");
    expect(subcircuit.modelSource).toMatch(new RegExp(`^\\s*\\.subckt\\s+${subcircuit.modelName}\\b`, "im"));
  });

  it("preloads only bundled identities in the current document and applies the real package map", async () => {
    const loaded = await preloadCatalogPartsForDocument(demoCircuit);
    expect(loaded.map((part) => part.manifest.canonical_mpn)).toEqual(["2N3904"]);
    const generated = applyCatalogModels(demoCircuit, generateNetlist(demoCircuit, "op"), CATALOG_PARTS);
    expect(generated.netlist).toContain("* catalog model: onsemi 2N3904");
    expect(generated.netlist).toMatch(/^Q4 \S+ \S+ \S+ \S+ \$ component:c4$/m);
    expect(generated.netlist).toContain("OC_LED_RED $ component:c6");
  });
});
