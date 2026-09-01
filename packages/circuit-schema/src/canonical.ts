import { normalizedImportedModelLibrary } from "./imports";
import { legacyCircuitForNetlistHash, migrateCircuitV1toV2, migrateCircuitV2toV3 } from "./migration";
import { assertValidCircuit } from "./validation";
import type { CircuitDocument, CircuitDocumentV1, CircuitDocumentV2 } from "./types";

function roundNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Circuit documents cannot contain non-finite numbers");
  return Number(value.toPrecision(12));
}
function canonicalValue(value: unknown, key?: string): unknown {
  if (typeof value === "number") return roundNumber(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalValue(item));
    if (key === "components" || key === "wires" || key === "probes" || key === "parts") {
      return [...items].sort((a, b) => ((a as { id?: string }).id ?? "").localeCompare((b as { id?: string }).id ?? "", undefined, { numeric: true }));
    }
    if (key === "pinMapping") {
      return [...items].sort((a, b) => {
        const left = a as { symbolPinIndex?: number; modelPinIndex?: number };
        const right = b as { symbolPinIndex?: number; modelPinIndex?: number };
        return (left.symbolPinIndex ?? -1) - (right.symbolPinIndex ?? -1) || (left.modelPinIndex ?? -1) - (right.modelPinIndex ?? -1);
      });
    }
    return items;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).filter((keyName) => record[keyName] !== undefined).sort().map((keyName) => [keyName, canonicalValue(record[keyName], keyName)]));
  }
  return value;
}
export function canonicalizeCircuit(document: CircuitDocument, includeView = true): string {
  return JSON.stringify(canonicalValue(includeView ? document : { ...document, view: undefined }));
}
export function canonicalizeCircuitForNetlistHash(document: CircuitDocument): string {
  return JSON.stringify(canonicalValue({ ...legacyCircuitForNetlistHash(document), view: undefined }));
}
export function deserializeCircuit(source: string): CircuitDocument {
  const document = migrateCircuit(JSON.parse(source));
  assertValidCircuit(document);
  return document;
}
export function migrateCircuit(input: unknown): CircuitDocument {
  const value = input as { format?: unknown; version?: unknown };
  if (value.format !== "opencircuit-circuit") throw new Error("Not a scheMAGIC circuit document");
  if (value.version === 1) return migrateCircuitV2toV3(migrateCircuitV1toV2(value as CircuitDocumentV1));
  if (value.version === 2) return migrateCircuitV2toV3(value as CircuitDocumentV2);
  if (value.version === 3) {
    const document = structuredClone(value as CircuitDocument);
    return document.modelImports
      ? { ...document, modelImports: normalizedImportedModelLibrary(document.modelImports) }
      : document;
  }
  throw new Error(`Unsupported circuit document version ${String(value.version)}`);
}
export function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(input)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 0x100000001b3n); }
  return hash.toString(16).padStart(16, "0");
}
