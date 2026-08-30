import {
  canonicalDesignV2Payload,
  designSha256ContentHash,
  serializeDesignResultV1,
} from "@opencircuit/design-schema";
import {
  parseImportedDesignResultText,
  type ImportedDesignResult,
} from "./ResultImport";
import { escapeHtml } from "./view";

export const DESIGNER_DEMONSTRATION_IDS = [
  "m1-compact",
  "m2-power",
  "p1-compact",
  "p2-high-voltage",
] as const;

export type DesignerDemonstrationId = typeof DESIGNER_DEMONSTRATION_IDS[number];

export interface DesignerDemonstrationSummary {
  id: DesignerDemonstrationId;
  code: "M1" | "M2" | "P1" | "P2";
  domain: "Motor" | "Power";
  title: string;
  topology: string;
  operatingPoint: string;
  recipeId: string;
  artifact: {
    path: `artifacts/${DesignerDemonstrationId}.json`;
    byteLength: number;
    contentHash: `sha256:${string}`;
  };
}

export interface LoadedDesignerDemonstration {
  example: DesignerDemonstrationSummary;
  imported: ImportedDesignResult;
  artifactContentHash: `sha256:${string}`;
}

export type DesignerDemonstrationLoadErrorCode =
  | "manifest_unavailable"
  | "manifest_integrity"
  | "artifact_unavailable"
  | "artifact_integrity"
  | "artifact_invalid";

export class DesignerDemonstrationLoadError extends Error {
  readonly code: DesignerDemonstrationLoadErrorCode;

  constructor(code: DesignerDemonstrationLoadErrorCode) {
    super(code === "manifest_unavailable" || code === "artifact_unavailable"
      ? "Demonstration files are unavailable. Check this static deployment and try again."
      : code === "artifact_invalid"
        ? "Demonstration data failed strict result validation. Nothing was opened."
        : "Demonstration data failed its published identity check. Nothing was opened.");
    this.name = "DesignerDemonstrationLoadError";
    this.code = code;
  }
}

const MANIFEST = Object.freeze({
  url: "/designer-examples/manifest.json",
  byteLength: 7_062,
  byteContentHash: "sha256:552798dcc0e084654c1b64ea20370d0008ef69d62d06d2a2ef1809aa9da19692",
  contentHash: "sha256:4b4d6183e83948f9370da067fea6e6df6495cdff733a73152e0ed64f179cbb30",
  boundariesContentHash: "sha256:93acd15f54f0a1f005064a549b8f57d1c98081dfc92066e2b959ef312cbba904",
});

export const DESIGNER_DEMONSTRATIONS: readonly DesignerDemonstrationSummary[] = Object.freeze([
  {
    id: "m1-compact",
    code: "M1",
    domain: "Motor",
    title: "Compact motor bridge",
    topology: "Integrated H-bridge",
    operatingPoint: "9–16 V · 1.5 A continuous",
    recipeId: "motor.brushed-dc.integrated-h-bridge.v1",
    artifact: {
      path: "artifacts/m1-compact.json",
      byteLength: 211_284,
      contentHash: "sha256:60b872807462648a517f820da7c3383aaa2f3d4126f4d6c5b7c4e24a334e7674",
    },
  },
  {
    id: "m2-power",
    code: "M2",
    domain: "Motor",
    title: "Power motor bridge",
    topology: "External-NMOS H-bridge",
    operatingPoint: "18–30 V · 5 A continuous",
    recipeId: "motor.brushed-dc.external-nmos-h-bridge.v1",
    artifact: {
      path: "artifacts/m2-power.json",
      byteLength: 845_563,
      contentHash: "sha256:14b2b4f71a7b1b8704d6c3f7c5cdf775718229ceae50a9c93fead0e34aed6284",
    },
  },
  {
    id: "p1-compact",
    code: "P1",
    domain: "Power",
    title: "Compact buck",
    topology: "Integrated synchronous buck",
    operatingPoint: "9–16 V in · 5 V / 3 A out",
    recipeId: "schemagic.power.buck.integrated-synchronous.v1",
    artifact: {
      path: "artifacts/p1-compact.json",
      byteLength: 372_144,
      contentHash: "sha256:3a1fb56086ccba3af1ec1816f87318ced7076b1b56a6c8ca1ea5daef09f9ba1a",
    },
  },
  {
    id: "p2-high-voltage",
    code: "P2",
    domain: "Power",
    title: "High-voltage buck",
    topology: "Controller + external NMOS",
    operatingPoint: "36–52 V in · 12 V / 5 A requested",
    recipeId: "schemagic.power.buck.controller-external-nmos.v1",
    artifact: {
      path: "artifacts/p2-high-voltage.json",
      byteLength: 292_365,
      contentHash: "sha256:7c6c83f0f5339ec56ed14a67ef152bd37f13b5c37a40a76e6a050b299f754554",
    },
  },
]);

const DEMONSTRATION_BY_ID = new Map(DESIGNER_DEMONSTRATIONS.map((entry) => [entry.id, entry]));

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function jsonText(bytes: Uint8Array, code: DesignerDemonstrationLoadErrorCode): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DesignerDemonstrationLoadError(code);
  }
}

async function exactResponseBytes(
  response: Response,
  expectedByteLength: number,
  unavailableCode: DesignerDemonstrationLoadErrorCode,
  integrityCode: DesignerDemonstrationLoadErrorCode,
): Promise<Uint8Array> {
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new DesignerDemonstrationLoadError(unavailableCode);
  }
  const declaredLength = response.headers.get("content-length");
  const encoded = response.headers.has("content-encoding");
  if (!encoded && declaredLength !== null && Number(declaredLength) !== expectedByteLength) {
    throw new DesignerDemonstrationLoadError(integrityCode);
  }
  if (!response.body) throw new DesignerDemonstrationLoadError(unavailableCode);
  const bytes = new Uint8Array(expectedByteLength);
  const reader = response.body.getReader();
  let offset = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (offset + chunk.value.byteLength > expectedByteLength) {
        throw new DesignerDemonstrationLoadError(integrityCode);
      }
      bytes.set(chunk.value, offset);
      offset += chunk.value.byteLength;
    }
  } catch (error) {
    if (error instanceof DesignerDemonstrationLoadError) throw error;
    throw new DesignerDemonstrationLoadError(unavailableCode);
  } finally {
    reader.releaseLock();
  }
  if (offset !== expectedByteLength) throw new DesignerDemonstrationLoadError(integrityCode);
  return bytes;
}

async function fetchStaticJson(
  url: string,
  expectedByteLength: number,
  expectedContentHash: string,
  unavailableCode: DesignerDemonstrationLoadErrorCode,
  integrityCode: DesignerDemonstrationLoadErrorCode,
  fetcher: typeof fetch | undefined,
): Promise<string> {
  let response: Response;
  try {
    const init: RequestInit = {
      cache: "no-cache",
      credentials: "same-origin",
      mode: "same-origin",
      redirect: "error",
      headers: { Accept: "application/json" },
    };
    response = fetcher ? await fetcher(url, init) : await fetch(url, init);
  } catch {
    throw new DesignerDemonstrationLoadError(unavailableCode);
  }
  const bytes = await exactResponseBytes(response, expectedByteLength, unavailableCode, integrityCode);
  const source = jsonText(bytes, integrityCode);
  if (designSha256ContentHash(source) !== expectedContentHash) {
    throw new DesignerDemonstrationLoadError(integrityCode);
  }
  return source;
}

function parseJsonObject(source: string, code: DesignerDemonstrationLoadErrorCode): JsonObject {
  try {
    const parsed = objectValue(JSON.parse(source));
    if (parsed) return parsed;
  } catch {
    // The closed error below deliberately does not surface parser internals.
  }
  throw new DesignerDemonstrationLoadError(code);
}

function verifiedManifest(source: string): JsonObject {
  const manifest = parseJsonObject(source, "manifest_integrity");
  const { contentHash, ...payload } = manifest;
  if (manifest.format !== "schemagic-designer-example-gallery"
    || manifest.schemaVersion !== 1
    || manifest.contractVersion !== "designer-reference-gallery.1"
    || contentHash !== MANIFEST.contentHash
    || designSha256ContentHash(canonicalDesignV2Payload(payload)) !== MANIFEST.contentHash
    || designSha256ContentHash(canonicalDesignV2Payload(manifest.boundaries)) !== MANIFEST.boundariesContentHash
    || !Array.isArray(manifest.examples)
    || manifest.examples.length !== DESIGNER_DEMONSTRATION_IDS.length
    || manifest.examples.some((entry, index) => objectValue(entry)?.id !== DESIGNER_DEMONSTRATION_IDS[index])) {
    throw new DesignerDemonstrationLoadError("manifest_integrity");
  }
  return manifest;
}

function equalCanonical(left: unknown, right: unknown): boolean {
  try {
    return canonicalDesignV2Payload(left) === canonicalDesignV2Payload(right);
  } catch {
    return false;
  }
}

function verifiedArtifact(
  source: string,
  example: DesignerDemonstrationSummary,
  manifest: JsonObject,
): LoadedDesignerDemonstration {
  const entries = manifest.examples as unknown[];
  const entry = objectValue(entries.find((candidate) => objectValue(candidate)?.id === example.id));
  const artifact = objectValue(entry?.artifact);
  if (!entry
    || !artifact
    || artifact.path !== example.artifact.path
    || artifact.byteLength !== example.artifact.byteLength
    || artifact.contentHash !== example.artifact.contentHash) {
    throw new DesignerDemonstrationLoadError("manifest_integrity");
  }

  const document = parseJsonObject(source, "artifact_invalid");
  const identities = objectValue(document.identities);
  const requestIdentity = objectValue(identities?.request);
  const resultIdentity = objectValue(identities?.result);
  const result = objectValue(document.result);
  const candidates = result?.candidates;
  if (document.format !== "schemagic-designer-example"
    || document.schemaVersion !== 1
    || document.id !== example.id
    || document.title !== entry.title
    || !identities
    || !requestIdentity
    || !resultIdentity
    || !result
    || !equalCanonical(document.generator, entry.generator)
    || !equalCanonical(identities.library, entry.library)
    || !equalCanonical(identities.recipes, entry.recipes)
    || !equalCanonical(requestIdentity, entry.request)
    || !equalCanonical(resultIdentity, entry.result)
    || !equalCanonical(document.boundaries, manifest.boundaries)
    || designSha256ContentHash(canonicalDesignV2Payload(document.request)) !== requestIdentity.canonicalContentHash
    || designSha256ContentHash(canonicalDesignV2Payload(result)) !== resultIdentity.canonicalContentHash
    || !Array.isArray(candidates)
    || !equalCanonical(candidates.map((candidate) => objectValue(candidate)?.id), entry.candidateIds)
    || candidates.some((candidate) => objectValue(candidate)?.sourcing !== undefined)) {
    throw new DesignerDemonstrationLoadError("artifact_invalid");
  }

  try {
    const imported = parseImportedDesignResultText(
      serializeDesignResultV1(result as Parameters<typeof serializeDesignResultV1>[0]),
    );
    if (imported.trust !== "legacy_v1_audit_only") {
      throw new DesignerDemonstrationLoadError("artifact_invalid");
    }
    return { example, imported, artifactContentHash: example.artifact.contentHash };
  } catch (error) {
    if (error instanceof DesignerDemonstrationLoadError) throw error;
    throw new DesignerDemonstrationLoadError("artifact_invalid");
  }
}

export async function loadDesignerDemonstration(
  id: DesignerDemonstrationId,
  fetcher?: typeof fetch,
): Promise<LoadedDesignerDemonstration> {
  const example = DEMONSTRATION_BY_ID.get(id);
  if (!example) throw new DesignerDemonstrationLoadError("manifest_integrity");
  const manifestSource = await fetchStaticJson(
    MANIFEST.url,
    MANIFEST.byteLength,
    MANIFEST.byteContentHash,
    "manifest_unavailable",
    "manifest_integrity",
    fetcher,
  );
  const manifest = verifiedManifest(manifestSource);
  const artifactSource = await fetchStaticJson(
    `/designer-examples/${example.artifact.path}`,
    example.artifact.byteLength,
    example.artifact.contentHash,
    "artifact_unavailable",
    "artifact_integrity",
    fetcher,
  );
  return verifiedArtifact(artifactSource, example, manifest);
}

export interface DesignerDemonstrationGalleryState {
  loadingId?: DesignerDemonstrationId | undefined;
}

export function renderDesignerDemonstrationGallery(
  state: Readonly<DesignerDemonstrationGalleryState> = {},
): string {
  const busy = state.loadingId !== undefined;
  return `<section class="designer-example-gallery" aria-labelledby="designer-examples-title"${busy ? ' aria-busy="true"' : ""}><header><div><span class="designer-section-code">FOUR BOUNDED DEMONSTRATIONS</span><h2 id="designer-examples-title">Open a complete result</h2></div><p>Inspect the shared candidate, circuit, constraint, and export surfaces using detached, content-verified demonstration data.</p></header><p class="designer-example-boundary" id="designer-example-boundary"><strong>Demonstration data only.</strong> No production admission, live provider or commercial data, or selected-part or simulation-fidelity claim.</p><div class="designer-example-lanes">${DESIGNER_DEMONSTRATIONS.map((example) => {
    const loading = state.loadingId === example.id;
    return `<article data-example-domain="${example.domain.toLowerCase()}"><div class="designer-example-identity"><strong>${example.code}</strong><span>${escapeHtml(example.domain)}</span></div><div class="designer-example-topology" aria-hidden="true"><i></i><span>${escapeHtml(example.topology)}</span><i></i></div><div class="designer-example-copy"><h3>${escapeHtml(example.title)}</h3><p>${escapeHtml(example.operatingPoint)}</p><code>${escapeHtml(example.recipeId)}</code></div><div class="designer-example-action"><small>${Math.round(example.artifact.byteLength / 1024)} KiB · verified on open</small><button data-designer-example="${example.id}" aria-describedby="designer-example-boundary"${busy ? " disabled" : ""}>${loading ? `Opening ${example.code}…` : `Open ${example.code} demonstration result`}</button></div></article>`;
  }).join("")}</div></section>`;
}
