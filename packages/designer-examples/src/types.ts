import type { DesignGeneration } from "@opencircuit/design-engine";
import type { DesignRequest } from "@opencircuit/design-schema";

export const DESIGNER_EXAMPLE_IDS = ["m1-compact", "m2-power", "p1-compact", "p2-high-voltage"] as const;

export type DesignerExampleId = typeof DESIGNER_EXAMPLE_IDS[number];
export type Sha256ContentHash = `sha256:${string}`;

export interface DesignerExampleGeneratorRef {
  packageName: "@opencircuit/motor-designer" | "@opencircuit/power-designer";
  packageVersion: "0.0.1";
  requestExport: string;
  generatorExport: string;
}

export interface DesignerExampleRecipeRef {
  packageName: "@opencircuit/motor-designer" | "@opencircuit/power-designer";
  id: string;
  version: string;
  contentHash: string;
}

export interface DesignerExampleBoundaries {
  classification: "synthetic_test_fixture";
  allowedUse: "testing_and_ui_examples_only";
  productionProfileCount: 0;
  productionProfileAdmissionClaim: "none";
  providerAccess: "none";
  commercialData: "none";
  simulationFidelityClaim: "none";
  limitations: readonly string[];
}

export interface DesignerExampleDocument {
  format: "schemagic-designer-example";
  schemaVersion: 1;
  id: DesignerExampleId;
  title: string;
  summary: string;
  generator: DesignerExampleGeneratorRef;
  identities: {
    request: {
      format: "schemagic-design-request";
      schemaVersion: 1;
      requestHash: string;
      canonicalContentHash: Sha256ContentHash;
    };
    result: {
      format: "schemagic-design-result";
      schemaVersion: 1;
      canonicalContentHash: Sha256ContentHash;
    };
    library: {
      version: string;
      contentHash: string;
    };
    recipes: readonly DesignerExampleRecipeRef[];
  };
  boundaries: DesignerExampleBoundaries;
  request: DesignRequest;
  result: DesignGeneration;
}

export interface DesignerExampleManifestEntry {
  id: DesignerExampleId;
  title: string;
  application: DesignRequest["application"];
  artifact: {
    path: `artifacts/${DesignerExampleId}.json`;
    byteLength: number;
    contentHash: Sha256ContentHash;
  };
  generator: DesignerExampleGeneratorRef;
  request: DesignerExampleDocument["identities"]["request"];
  result: DesignerExampleDocument["identities"]["result"];
  library: DesignerExampleDocument["identities"]["library"];
  recipes: readonly DesignerExampleRecipeRef[];
  candidateIds: readonly string[];
}

export interface DesignerExampleGalleryManifest {
  format: "schemagic-designer-example-gallery";
  schemaVersion: 1;
  contractVersion: "designer-reference-gallery.1";
  contentHash: Sha256ContentHash;
  boundaries: DesignerExampleBoundaries;
  examples: readonly DesignerExampleManifestEntry[];
}

export interface DesignerExampleGalleryBundle {
  manifest: DesignerExampleGalleryManifest;
  manifestText: string;
  artifacts: ReadonlyMap<DesignerExampleId, { document: DesignerExampleDocument; text: string }>;
}
