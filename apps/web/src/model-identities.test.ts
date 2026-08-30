import { fnv1a64, type CircuitDocument, type ImportedModelPart } from "@opencircuit/circuit-schema";
import { describe, expect, it, vi } from "vitest";
import {
  BUILTIN_MODEL_CONTRACT_VERSION,
  captureModelIdentities,
  type CatalogModelIdentityResolver,
} from "./model-identities";

function circuit(components: CircuitDocument["components"], importedPart?: ImportedModelPart): CircuitDocument {
  return {
    format: "opencircuit-circuit",
    version: 3,
    meta: { title: "Model identity contract" },
    components: [...components, { id: "g1", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
    wires: [],
    probes: [],
    sim: { mode: "op" },
    ...(importedPart ? {
      modelImports: {
        format: "opencircuit-imported-models",
        version: 1,
        parts: [importedPart],
      },
    } : {}),
  };
}

const noCatalog: CatalogModelIdentityResolver = () => undefined;

describe("capture model identities", () => {
  it("identifies every modeled RC component with a versioned builtin contract", () => {
    const document = circuit([
      { id: "c10", type: "capacitor", value: "100n", pos: [8, 0], rot: 0, mirror: false },
      { id: "c2", type: "resistor", value: "1k", pos: [4, 0], rot: 0, mirror: false },
      { id: "c1", type: "vsource", value: 1, pos: [0, 0], rot: 0, mirror: false },
    ]);

    expect(captureModelIdentities(document, noCatalog)).toEqual([
      { componentId: "c1", modelId: `builtin:vsource@${BUILTIN_MODEL_CONTRACT_VERSION}` },
      { componentId: "c2", modelId: `builtin:resistor@${BUILTIN_MODEL_CONTRACT_VERSION}` },
      { componentId: "c10", modelId: `builtin:capacitor@${BUILTIN_MODEL_CONTRACT_VERSION}` },
    ]);
  });

  it("binds catalog and imported source text while retaining explicit MPN identity", () => {
    const importedSource = ".model USER_D D(Is=2e-14)\n";
    const importedPart: ImportedModelPart = {
      id: "imp_user_d",
      sourceName: "user.lib",
      sourceText: importedSource,
      definition: { kind: "model", name: "USER_D", scopePath: [] },
      baseType: "diode",
      pinMapping: [],
      analysisValidity: { version: 1, supportedModes: ["live", "op", "dc-sweep", "tran", "ac", "noise"] },
    };
    const catalogSource = ".model CATALOG_D D(Is=1e-14)\n";
    const resolveCatalog = vi.fn<CatalogModelIdentityResolver>((id) => id === "alias/CAT-D"
      ? { id: "vendor/CAT-D", modelSource: catalogSource }
      : undefined);
    const document = circuit([
      { id: "c10", type: "resistor", value: "10k", pos: [12, 0], rot: 0, mirror: false },
      { id: "c4", type: "diode", pos: [8, 0], rot: 0, mirror: false, params: { importedPartId: importedPart.id } },
      { id: "c3", type: "diode", pos: [4, 0], rot: 0, mirror: false, params: { catalogPartId: "alias/CAT-D" } },
      { id: "c2", type: "bjt_npn", pos: [0, 0], rot: 0, mirror: false, mpn: "2N3904" },
    ], importedPart);

    expect(captureModelIdentities(document, resolveCatalog)).toEqual([
      { componentId: "c2", modelId: "mpn:2N3904" },
      { componentId: "c3", modelId: "catalog:vendor/CAT-D", contentHash: `fnv1a64:${fnv1a64(catalogSource)}` },
      { componentId: "c4", modelId: `imported:${importedPart.id}`, contentHash: `fnv1a64:${fnv1a64(importedSource)}` },
      { componentId: "c10", modelId: `builtin:resistor@${BUILTIN_MODEL_CONTRACT_VERSION}` },
    ]);
    expect(resolveCatalog).toHaveBeenCalledOnce();
    expect(resolveCatalog).toHaveBeenCalledWith("alias/CAT-D");
  });

  it("changes only the matching source hash and never claims an unloaded catalog hash", () => {
    const document = circuit([
      { id: "c1", type: "diode", pos: [0, 0], rot: 0, mirror: false, params: { catalogPartId: "vendor/D" } },
    ]);

    expect(captureModelIdentities(document, () => ({ id: "vendor/D" }))).toEqual([
      { componentId: "c1", modelId: "catalog:vendor/D" },
    ]);
    const first = captureModelIdentities(document, () => ({ id: "vendor/D", modelSource: ".model D D(Is=1e-14)" }));
    const second = captureModelIdentities(document, () => ({ id: "vendor/D", modelSource: ".model D D(Is=2e-14)" }));
    expect(first[0]!.contentHash).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(second[0]!.contentHash).not.toBe(first[0]!.contentHash);
  });
});
