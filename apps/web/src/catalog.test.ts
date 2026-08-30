import { describe, expect, it } from "vitest";
import { generateNetlist } from "@opencircuit/circuit-schema";
import {
  CATALOG_EAGER_PAYLOAD_CONTRACT,
  CATALOG_NONPLACEABLE_BREAKDOWN,
  CATALOG_PARTS,
  CATALOG_PLACEABLE_COUNT,
  CATALOG_REVIEWED_COUNT,
  preloadCatalogPart,
  preloadCatalogPartsForDocument,
} from "./catalog";
import { applyCatalogModels } from "./catalog-netlist";
import { demoCircuit } from "./demo";

describe("catalog release truth", () => {
  it("exposes the reviewed/placeable counts and exact reference-only breakdown", () => {
    expect(CATALOG_PARTS).toHaveLength(710);
    expect(CATALOG_REVIEWED_COUNT).toBe(710);
    expect(CATALOG_PLACEABLE_COUNT).toBe(667);
    expect(CATALOG_NONPLACEABLE_BREAKDOWN).toEqual({
      comparator: 5,
      jfet_n: 4,
      logic_74hc: 14,
      other: 7,
      timer: 4,
      vreg_linear: 9,
    });
    expect(CATALOG_PARTS.filter((part) => part.placeable).every((part) =>
      part.manifestValid && part.reviewed && part.baseType
      && part.manifest.symbol_pins?.length && part.manifest.spice_pin_mapping?.length,
    )).toBe(true);
  });

  it("keeps model bodies, cards, provenance and validation behind lazy loaders", () => {
    expect(CATALOG_EAGER_PAYLOAD_CONTRACT).toEqual({
      manifestCount: 710,
      eagerManifestBytes: 2_846_227,
      eagerDetailCount: 0,
      lazyModelCount: 710,
      lazyModelCardCount: 710,
      lazySourcesCount: 710,
      lazyValidationCount: 710,
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
