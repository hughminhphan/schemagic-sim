import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  DESIGNER_DEMONSTRATIONS,
  DesignerDemonstrationLoadError,
  loadDesignerDemonstration,
  renderDesignerDemonstrationGallery,
} from "./ExampleGallery";

const artifactRoot = new URL("../../../../../packages/designer-examples/artifacts/", import.meta.url);

function artifact(path: string): string {
  return readFileSync(new URL(path.replace(/^artifacts\//u, ""), artifactRoot), "utf8");
}

function jsonResponse(source: string): Response {
  return new Response(source, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-length": String(Buffer.byteLength(source)),
    },
  });
}

function galleryFetcher(onCall?: (path: string, source: string) => string): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).replace(/^\/designer-examples\//u, "");
    const source = artifact(path);
    return jsonResponse(onCall?.(path, source) ?? source);
  }) as unknown as typeof fetch;
}

describe("Designer demonstration gallery", () => {
  it("renders four topology lanes and the complete evidence boundary without fetching", () => {
    const fetcher = vi.fn();
    const html = renderDesignerDemonstrationGallery();

    expect(fetcher).not.toHaveBeenCalled();
    expect(html.match(/data-designer-example=/gu)).toHaveLength(4);
    for (const example of DESIGNER_DEMONSTRATIONS) {
      expect(html).toContain(`Open ${example.code} demonstration result`);
      expect(html).toContain(example.topology);
      expect(html).toContain(example.recipeId);
    }
    expect(html).toContain("Demonstration data only.");
    expect(html).toContain("No production admission, live provider or commercial data, or selected-part or simulation-fidelity claim.");
    expect(html).not.toContain("Generate candidates");
  });

  it.each(DESIGNER_DEMONSTRATIONS)(
    "opens $code only after exact manifest, artifact, identity, and strict-import checks",
    async (example) => {
      const fetcher = galleryFetcher();
      const loaded = await loadDesignerDemonstration(example.id, fetcher);

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(fetcher).toHaveBeenNthCalledWith(1, "/designer-examples/manifest.json", expect.objectContaining({
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
      }));
      expect(fetcher).toHaveBeenNthCalledWith(2, `/designer-examples/${example.artifact.path}`, expect.any(Object));
      expect(loaded.example).toBe(example);
      expect(loaded.artifactContentHash).toBe(example.artifact.contentHash);
      expect(loaded.imported.trust).toBe("legacy_v1_audit_only");
      expect(loaded.imported.result.request.application).toBe(example.domain === "Motor" ? "motor.brushed-dc" : "power.buck");
      expect(loaded.imported.result.candidates[0]?.recipeId).toBe(example.recipeId);
      expect(loaded.imported.result.candidates.every((candidate) => !("sourcing" in candidate) || candidate.sourcing === undefined)).toBe(true);
    },
  );

  it("fails before requesting an artifact when the exact manifest bytes change", async () => {
    const fetcher = galleryFetcher((path, source) => path === "manifest.json"
      ? source.replace("M1 compact motor bridge", "X1 compact motor bridge")
      : source);

    await expect(loadDesignerDemonstration("m1-compact", fetcher))
      .rejects.toEqual(new DesignerDemonstrationLoadError("manifest_integrity"));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails closed on altered, truncated, and mislabeled artifact responses", async () => {
    const altered = galleryFetcher((path, source) => path === "artifacts/m1-compact.json"
      ? source.replace("M1 compact motor bridge", "X1 compact motor bridge")
      : source);
    await expect(loadDesignerDemonstration("m1-compact", altered))
      .rejects.toEqual(new DesignerDemonstrationLoadError("artifact_integrity"));

    const truncated = galleryFetcher((path, source) => path === "artifacts/m1-compact.json" ? source.slice(1) : source);
    await expect(loadDesignerDemonstration("m1-compact", truncated))
      .rejects.toEqual(new DesignerDemonstrationLoadError("artifact_integrity"));

    const wrongType = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input).replace(/^\/designer-examples\//u, "");
      const source = artifact(path);
      return new Response(source, { headers: { "content-type": "text/plain", "content-length": String(Buffer.byteLength(source)) } });
    }) as unknown as typeof fetch;
    await expect(loadDesignerDemonstration("m1-compact", wrongType))
      .rejects.toEqual(new DesignerDemonstrationLoadError("manifest_unavailable"));
  });

  it("marks the active lane busy and disables every concurrent open action", () => {
    const html = renderDesignerDemonstrationGallery({ loadingId: "m2-power" });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Opening M2…");
    expect(html.match(/ disabled/gu)).toHaveLength(4);
  });
});
