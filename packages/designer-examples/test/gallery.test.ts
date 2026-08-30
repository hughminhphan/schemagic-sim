import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { canonicalDesignV2Payload, designSha256ContentHash } from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  DESIGNER_EXAMPLE_GALLERY,
  DESIGNER_EXAMPLE_GALLERY_MANIFEST,
  DESIGNER_EXAMPLE_IDS,
  getDesignerExample,
} from "../src/index";
import { buildDesignerExampleGalleryBundle } from "../src/generate";

const artifactUrl = (path: string): URL => new URL(`../${path}`, import.meta.url);

describe("content-addressed Designer reference gallery", () => {
  it("regenerates all four checked-in artifacts and the manifest byte-for-byte", async () => {
    const generated = buildDesignerExampleGalleryBundle();
    expect([...generated.artifacts.keys()]).toEqual(DESIGNER_EXAMPLE_IDS);
    for (const [id, artifact] of generated.artifacts) {
      const checkedIn = await readFile(artifactUrl(`artifacts/${id}.json`), "utf8");
      expect(artifact.text).toBe(checkedIn);
      const entry = generated.manifest.examples.find((example) => example.id === id);
      expect(entry?.artifact.byteLength).toBe(Buffer.byteLength(checkedIn));
      expect(entry?.artifact.contentHash).toBe(designSha256ContentHash(checkedIn));
    }
    expect(generated.manifestText).toBe(await readFile(artifactUrl("artifacts/manifest.json"), "utf8"));
  });

  it("is deterministic across independent regeneration passes", () => {
    const first = buildDesignerExampleGalleryBundle();
    const second = buildDesignerExampleGalleryBundle();
    expect(second.manifestText).toBe(first.manifestText);
    expect([...second.artifacts].map(([id, value]) => [id, value.text])).toEqual(
      [...first.artifacts].map(([id, value]) => [id, value.text]),
    );
  });

  it("binds exact request, result, library, recipe, and artifact identities", () => {
    const { contentHash: _contentHash, ...manifestPayload } = DESIGNER_EXAMPLE_GALLERY_MANIFEST;
    expect(DESIGNER_EXAMPLE_GALLERY_MANIFEST.contentHash).toBe(
      designSha256ContentHash(canonicalDesignV2Payload(manifestPayload)),
    );
    for (const entry of DESIGNER_EXAMPLE_GALLERY_MANIFEST.examples) {
      const document = getDesignerExample(entry.id);
      expect(document.generator).toEqual(entry.generator);
      expect(document.identities.request).toEqual(entry.request);
      expect(document.identities.result).toEqual(entry.result);
      expect(document.identities.library).toEqual(entry.library);
      expect(document.identities.recipes).toEqual(entry.recipes);
      expect(document.identities.request.requestHash).toBe(document.result.requestHash);
      expect(document.identities.request.canonicalContentHash).toBe(
        designSha256ContentHash(canonicalDesignV2Payload(document.request)),
      );
      expect(document.identities.result.canonicalContentHash).toBe(
        designSha256ContentHash(canonicalDesignV2Payload(document.result)),
      );
      expect(document.result.libraryVersion).toBe(document.identities.library.version);
      expect(document.result.libraryContentHash).toBe(document.identities.library.contentHash);
      expect(new Set([
        ...document.result.candidates.map((candidate) => candidate.recipeId),
        ...document.result.rejections.map((rejection) => rejection.recipeId),
      ])).toEqual(new Set(document.identities.recipes.map((recipe) => recipe.id)));
      expect(document.result.candidates.map((candidate) => candidate.id)).toEqual(entry.candidateIds);
    }
  });

  it("keeps synthetic fixtures outside production, commercial, provider, and fidelity claims", () => {
    expect(DESIGNER_EXAMPLE_GALLERY).toHaveLength(4);
    for (const document of DESIGNER_EXAMPLE_GALLERY) {
      expect(document.boundaries).toEqual(DESIGNER_EXAMPLE_GALLERY_MANIFEST.boundaries);
      expect(document.boundaries).toMatchObject({
        classification: "synthetic_test_fixture",
        allowedUse: "testing_and_ui_examples_only",
        productionProfileCount: 0,
        productionProfileAdmissionClaim: "none",
        providerAccess: "none",
        commercialData: "none",
        simulationFidelityClaim: "none",
      });
      for (const candidate of document.result.candidates) {
        expect("sourcing" in candidate).toBe(false);
        for (const component of candidate.components) {
          expect(component.part.manufacturerId).toMatch(/synthetic/u);
          expect(component.profileId).toMatch(/(?:fixture|synthetic)/u);
        }
      }
    }
  });

  it("exposes detached read-only checked-in documents to a future browser gallery", () => {
    expect(DESIGNER_EXAMPLE_GALLERY.map((example) => example.id)).toEqual(DESIGNER_EXAMPLE_IDS);
    expect(Object.isFrozen(DESIGNER_EXAMPLE_GALLERY)).toBe(true);
    expect(Object.isFrozen(getDesignerExample("m1-compact").result)).toBe(true);
    expect(fileURLToPath(artifactUrl("artifacts/manifest.json"))).toContain("packages/designer-examples/artifacts/manifest.json");
  });
});
