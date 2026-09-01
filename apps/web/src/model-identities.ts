import { fnv1a64, type CircuitDocument } from "@opencircuit/circuit-schema";
import type { CaptureModelIdentity } from "./persistence";

export const BUILTIN_MODEL_CONTRACT_VERSION = 1 as const;
export const MODEL_CONTENT_HASH_ALGORITHM = "fnv1a64" as const;

export interface CatalogModelIdentitySource {
  id: string;
  /** Exact loaded model.cir text used to build the runtime netlist. */
  modelSource?: string;
}

export type CatalogModelIdentityResolver = (idOrMpn: string) => CatalogModelIdentitySource | undefined;

function contentHash(source: string): string {
  return `${MODEL_CONTENT_HASH_ALGORITHM}:${fnv1a64(source)}`;
}

function stringParameter(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Describe every component that contributes a device line to the generated
 * netlist. Ground is connectivity, not a modeled device. The caller supplies
 * catalog lookup so this pure contract never imports mutable global catalog
 * state and can hash the exact lazily-loaded source used for the solve.
 */
export function captureModelIdentities(
  document: Pick<CircuitDocument, "components" | "modelImports">,
  resolveCatalog: CatalogModelIdentityResolver,
): CaptureModelIdentity[] {
  const imported = new Map(document.modelImports?.parts.map((part) => [part.id, part]) ?? []);
  return document.components
    .filter((component) => component.type !== "ground")
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }))
    .map((component) => {
      const catalogId = stringParameter(component.params?.catalogPartId);
      if (catalogId) {
        const catalog = resolveCatalog(catalogId);
        return {
          componentId: component.id,
          modelId: `catalog:${catalog?.id ?? catalogId}`,
          ...(catalog?.modelSource === undefined ? {} : { contentHash: contentHash(catalog.modelSource) }),
        };
      }

      const importedId = stringParameter(component.params?.importedPartId);
      if (importedId) {
        const part = imported.get(importedId);
        return {
          componentId: component.id,
          modelId: `imported:${importedId}`,
          ...(part ? { contentHash: contentHash(part.sourceText) } : {}),
        };
      }

      const mpn = stringParameter(component.mpn);
      if (mpn) return { componentId: component.id, modelId: `mpn:${mpn}` };

      return {
        componentId: component.id,
        modelId: `builtin:${component.type}@${BUILTIN_MODEL_CONTRACT_VERSION}`,
      };
    });
}
