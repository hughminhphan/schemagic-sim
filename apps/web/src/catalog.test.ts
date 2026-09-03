import { readFileSync } from "node:fs";
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
import { exampleById } from "./examples";
import { decodeCircuit } from "./share";

describe("catalog release truth", () => {
  it("exposes the reviewed/placeable counts and exact reference-only breakdown", () => {
    expect(CATALOG_PARTS).toHaveLength(771);
    expect(CATALOG_REVIEWED_COUNT).toBe(771);
    expect(CATALOG_PLACEABLE_COUNT).toBe(771);
    expect(CATALOG_REFERENCE_ONLY_COUNT).toBe(0);
    // Every reviewed package now has both a symbol and all-pass stored validation.
    expect(CATALOG_NONPLACEABLE_BREAKDOWN).toEqual({});
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
      eagerManifestBytes: 3_392_259,
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

  it("classifies and injects the zener example's reviewed avalanche model", async () => {
    const part = await preloadCatalogPart("onsemi/1N4733A");
    const document = exampleById("zener-regulator")!.document;
    expect(part.baseType).toBe("zener");
    expect(document.components.find((component) => component.id === "c3")).toMatchObject({
      type: "zener",
      params: { catalogPartId: "onsemi/1N4733A" },
    });
    const generated = applyCatalogModels(document, generateNetlist(document), [part]);
    expect(generated.netlist).toMatch(/^D3 0 vout OC_ONSEMI_1N4733A \$ component:c3$/m);
    expect(generated.netlist).toMatch(/^\.model OC_ONSEMI_1N4733A D\([^\n]*\bBV=5\.1000000000e\+00\b/m);
    expect(generated.netlist).not.toContain("awaiting its catalog package model");

    const recordedLine = readFileSync(new URL("../../../examples/URLS.md", import.meta.url), "utf8")
      .split("\n").find((line) => line.startsWith("- zener-regulator: "))!;
    const payload = new URL(recordedLine.slice(recordedLine.indexOf("http"))).hash.slice("#c=".length);
    const legacyDocument = decodeCircuit(payload);
    expect(legacyDocument.components.find((component) => component.id === "c3")).toEqual({
      id: "c3",
      label: { offset: [5, 0], text: "DZ1 5V1" },
      mirror: false,
      mpn: "1N4733A",
      params: { catalogPartId: "onsemi/1N4733A" },
      pos: [30, 14],
      rot: 180,
      type: "diode",
    });
    const legacyGenerated = applyCatalogModels(legacyDocument, generateNetlist(legacyDocument), [part]);
    expect(legacyGenerated.netlist).toMatch(/^D3 0 vout OC_ONSEMI_1N4733A \$ component:c3$/m);
    expect(legacyGenerated.netlist).not.toMatch(/^D3\s+.*\sOC_GENERIC_D(?:\s|$)/m);
  });

  it("does not infer Zener behavior from ordinary-diode omission text", () => {
    for (const mpn of ["1N4148WX-TP", "BAS321"]) {
      expect(CATALOG_PARTS.find((part) => part.manifest.canonical_mpn === mpn)?.baseType, mpn).toBe("diode");
    }
  });
});
