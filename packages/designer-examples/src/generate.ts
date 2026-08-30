import {
  canonicalDesignV2Payload,
  canonicalDesignV2Value,
  designSha256ContentHash,
  type DesignRequest,
} from "@opencircuit/design-schema";
import type { DesignGeneration, DesignLibrary, DesignRecipe } from "@opencircuit/design-engine";
import {
  EXTERNAL_NMOS_H_BRIDGE_RECIPE,
  generateMotorDesign,
  INTEGRATED_H_BRIDGE_RECIPE,
  MOTOR_DESIGN_LIBRARY,
} from "@opencircuit/motor-designer";
import { M1_COMPACT_REQUEST, M2_POWER_REQUEST } from "@opencircuit/motor-designer/fixtures";
import {
  BUCK_DESIGN_LIBRARY,
  EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE,
  INTEGRATED_SYNCHRONOUS_BUCK_RECIPE,
} from "@opencircuit/power-designer";
import {
  createP1CompactRequest,
  createP2HighVoltageRequest,
  generateP1CompactFixture,
  generateP2HighVoltageFixture,
} from "@opencircuit/power-designer/fixtures";
import type {
  DesignerExampleBoundaries,
  DesignerExampleDocument,
  DesignerExampleGalleryBundle,
  DesignerExampleGalleryManifest,
  DesignerExampleGeneratorRef,
  DesignerExampleId,
  DesignerExampleManifestEntry,
  DesignerExampleRecipeRef,
  Sha256ContentHash,
} from "./types";

const LIMITATIONS = Object.freeze([
  "Every component identity and engineering fact in these examples comes from an installed synthetic test-fixture catalog.",
  "The examples contain no reviewed or admitted production profile and make no orderability claim.",
  "No live provider, price, stock, lifecycle, lead-time, or other commercial response is included.",
  "Behavioral circuits and analytic outputs are deterministic regression examples, not selected-part or simulator-fidelity evidence.",
]);

export const DESIGNER_EXAMPLE_BOUNDARIES: DesignerExampleBoundaries = Object.freeze({
  classification: "synthetic_test_fixture",
  allowedUse: "testing_and_ui_examples_only",
  productionProfileCount: 0,
  productionProfileAdmissionClaim: "none",
  providerAccess: "none",
  commercialData: "none",
  simulationFidelityClaim: "none",
  limitations: LIMITATIONS,
});

interface ExampleSpec {
  id: DesignerExampleId;
  title: string;
  summary: string;
  generator: DesignerExampleGeneratorRef;
  request: () => DesignRequest;
  generate: () => DesignGeneration;
  library: Readonly<DesignLibrary>;
  recipe: Readonly<DesignRecipe>;
}

const EXAMPLE_SPECS: readonly ExampleSpec[] = Object.freeze([
  {
    id: "m1-compact",
    title: "M1 compact motor bridge",
    summary: "A 9–16 V, 1.5 A continuous brushed-DC motor request using the synthetic integrated H-bridge recipe.",
    generator: {
      packageName: "@opencircuit/motor-designer",
      packageVersion: "0.0.1",
      requestExport: "M1_COMPACT_REQUEST",
      generatorExport: "generateMotorDesign",
    },
    request: () => structuredClone(M1_COMPACT_REQUEST),
    generate: () => generateMotorDesign(structuredClone(M1_COMPACT_REQUEST)),
    library: MOTOR_DESIGN_LIBRARY,
    recipe: INTEGRATED_H_BRIDGE_RECIPE,
  },
  {
    id: "m2-power",
    title: "M2 power motor bridge",
    summary: "An 18–30 V, 5 A continuous brushed-DC motor request using the synthetic external-NMOS H-bridge recipe.",
    generator: {
      packageName: "@opencircuit/motor-designer",
      packageVersion: "0.0.1",
      requestExport: "M2_POWER_REQUEST",
      generatorExport: "generateMotorDesign",
    },
    request: () => structuredClone(M2_POWER_REQUEST),
    generate: () => generateMotorDesign(structuredClone(M2_POWER_REQUEST)),
    library: MOTOR_DESIGN_LIBRARY,
    recipe: EXTERNAL_NMOS_H_BRIDGE_RECIPE,
  },
  {
    id: "p1-compact",
    title: "P1 compact buck",
    summary: "A 9–16 V input, 5 V / 3 A buck request using the synthetic integrated synchronous-regulator recipe.",
    generator: {
      packageName: "@opencircuit/power-designer",
      packageVersion: "0.0.1",
      requestExport: "createP1CompactRequest",
      generatorExport: "generateP1CompactFixture",
    },
    request: createP1CompactRequest,
    generate: generateP1CompactFixture,
    library: BUCK_DESIGN_LIBRARY,
    recipe: INTEGRATED_SYNCHRONOUS_BUCK_RECIPE,
  },
  {
    id: "p2-high-voltage",
    title: "P2 high-voltage buck",
    summary: "A 36–52 V input, 12 V / 5 A buck request using the synthetic external-NMOS controller recipe.",
    generator: {
      packageName: "@opencircuit/power-designer",
      packageVersion: "0.0.1",
      requestExport: "createP2HighVoltageRequest",
      generatorExport: "generateP2HighVoltageFixture",
    },
    request: createP2HighVoltageRequest,
    generate: generateP2HighVoltageFixture,
    library: BUCK_DESIGN_LIBRARY,
    recipe: EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE,
  },
]);

function canonicalHash(value: unknown): Sha256ContentHash {
  return designSha256ContentHash(canonicalDesignV2Payload(value));
}

function recipeRef(spec: Readonly<ExampleSpec>): DesignerExampleRecipeRef {
  return {
    packageName: spec.generator.packageName,
    id: spec.recipe.id,
    version: spec.recipe.version,
    contentHash: spec.recipe.contentHash,
  };
}

function assertExactGenerationContext(
  spec: Readonly<ExampleSpec>,
  request: Readonly<DesignRequest>,
  result: Readonly<DesignGeneration>,
): void {
  if (canonicalDesignV2Payload(result.request) !== canonicalDesignV2Payload(request)) {
    throw new Error(`${spec.id}: generated request payload mismatch`);
  }
  if (result.requestHash !== result.candidates[0]?.requestHash && result.candidates.length > 0) {
    throw new Error(`${spec.id}: result/candidate request identity mismatch`);
  }
  if (result.libraryVersion !== request.libraryVersion || result.libraryVersion !== spec.library.version) {
    throw new Error(`${spec.id}: library version identity mismatch`);
  }
  if (result.libraryContentHash !== spec.library.contentHash) {
    throw new Error(`${spec.id}: library content identity mismatch`);
  }
  const observedRecipeIds = new Set([
    ...result.candidates.map((candidate) => candidate.recipeId),
    ...result.rejections.map((rejection) => rejection.recipeId),
  ]);
  if (observedRecipeIds.size !== 1 || !observedRecipeIds.has(spec.recipe.id)) {
    throw new Error(`${spec.id}: recipe identity mismatch`);
  }
}

function buildDocument(spec: Readonly<ExampleSpec>): DesignerExampleDocument {
  const request = spec.request();
  const result = spec.generate();
  assertExactGenerationContext(spec, request, result);
  return canonicalDesignV2Value({
    format: "schemagic-designer-example",
    schemaVersion: 1,
    id: spec.id,
    title: spec.title,
    summary: spec.summary,
    generator: spec.generator,
    identities: {
      request: {
        format: request.format,
        schemaVersion: request.schemaVersion,
        requestHash: result.requestHash,
        canonicalContentHash: canonicalHash(request),
      },
      result: {
        format: result.format,
        schemaVersion: result.schemaVersion,
        canonicalContentHash: canonicalHash(result),
      },
      library: { version: spec.library.version, contentHash: spec.library.contentHash },
      recipes: [recipeRef(spec)],
    },
    boundaries: DESIGNER_EXAMPLE_BOUNDARIES,
    request,
    result,
  }) as unknown as DesignerExampleDocument;
}

export function serializeDesignerExampleArtifact(document: Readonly<DesignerExampleDocument>): string {
  return `${JSON.stringify(canonicalDesignV2Value(document), null, 2)}\n`;
}

export function serializeDesignerExampleManifest(manifest: Readonly<DesignerExampleGalleryManifest>): string {
  return `${JSON.stringify(canonicalDesignV2Value(manifest), null, 2)}\n`;
}

export function buildDesignerExampleGalleryBundle(): DesignerExampleGalleryBundle {
  const artifacts = new Map<DesignerExampleId, { document: DesignerExampleDocument; text: string }>();
  const entries: DesignerExampleManifestEntry[] = [];
  for (const spec of EXAMPLE_SPECS) {
    const document = buildDocument(spec);
    const text = serializeDesignerExampleArtifact(document);
    artifacts.set(spec.id, { document, text });
    entries.push({
      id: spec.id,
      title: spec.title,
      application: document.request.application,
      artifact: {
        path: `artifacts/${spec.id}.json`,
        byteLength: new TextEncoder().encode(text).byteLength,
        contentHash: designSha256ContentHash(text),
      },
      generator: document.generator,
      request: document.identities.request,
      result: document.identities.result,
      library: document.identities.library,
      recipes: document.identities.recipes,
      candidateIds: document.result.candidates.map((candidate) => candidate.id),
    });
  }
  const manifestPayload = {
    format: "schemagic-designer-example-gallery" as const,
    schemaVersion: 1 as const,
    contractVersion: "designer-reference-gallery.1" as const,
    boundaries: DESIGNER_EXAMPLE_BOUNDARIES,
    examples: entries,
  };
  const manifest = canonicalDesignV2Value({
    ...manifestPayload,
    contentHash: canonicalHash(manifestPayload),
  }) as unknown as DesignerExampleGalleryManifest;
  return { manifest, manifestText: serializeDesignerExampleManifest(manifest), artifacts };
}
