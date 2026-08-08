import { defaultDCSweepConfig } from "./dc-sweep";
import { defaultNoiseConfig } from "./noise";
import type { CircuitDocument } from "./types";

function roundNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Circuit documents cannot contain non-finite numbers");
  return Number(value.toPrecision(12));
}
function canonicalValue(value: unknown, key?: string): unknown {
  if (typeof value === "number") return roundNumber(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalValue(item));
    return key === "components" || key === "wires" || key === "probes"
      ? [...items].sort((a, b) => ((a as { id?: string }).id ?? "").localeCompare((b as { id?: string }).id ?? "", undefined, { numeric: true }))
      : items;
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
export function deserializeCircuit(source: string): CircuitDocument {
  return migrateCircuit(JSON.parse(source));
}
export function migrateCircuit(input: unknown): CircuitDocument {
  const value = input as Partial<CircuitDocument>;
  if (value.format !== "opencircuit-circuit") throw new Error("Not a scheMAGIC circuit document");
  if (value.version === 1) {
    const document = value as CircuitDocument;
    if (document.sim?.mode === "dc-sweep" && !document.sim.dcSweep) {
      const dcSweep = defaultDCSweepConfig(document);
      return { ...document, sim: { ...document.sim, ...(dcSweep ? { dcSweep } : {}) } };
    }
    if (document.sim?.mode === "noise" && !document.sim.noise) {
      const noise = defaultNoiseConfig(document);
      return { ...document, sim: { ...document.sim, ...(noise ? { noise } : {}) } };
    }
    return document;
  }
  throw new Error(`Unsupported circuit document version ${String(value.version)}`);
}
export function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(input)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 0x100000001b3n); }
  return hash.toString(16).padStart(16, "0");
}
