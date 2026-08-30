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
  byteContentHash: "sha256:a4b615ad869aa55627d6295df7e130a3e6a82cf5b017d22367f956ca08c7563c",
  contentHash: "sha256:44c37c4e9edcf1af50ed80e78e37283b64c5c33efe5c03f31b4d4b9f22b304f2",
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
      byteLength: 212_648,
      contentHash: "sha256:53bd5bc2b12d99f5bf296091d8ee82cc493fba5b8911bf3b7397e3678e0f5f2d",
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
      byteLength: 848_291,
      contentHash: "sha256:86471e4d8cf6d1938f85f6fbe53fb0ce99556fac83ac5c60ed4e6ee0c177de42",
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
      byteLength: 379_068,
      contentHash: "sha256:a204952c17f98f5d8999f85d9b57d3566929d6c01a25e1a9a2107437c246b06e",
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
      byteLength: 296_981,
      contentHash: "sha256:2064138ad31abd614485fdd9af8738a3911ecf25acfc140174b33e12720018ab",
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
