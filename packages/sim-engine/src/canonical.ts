import type { CircuitDocument } from "./types";

function roundNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Circuit documents cannot contain non-finite numbers");
  return Number(value.toPrecision(12));
}

function canonicalValue(value: unknown, key?: string): unknown {
  if (typeof value === "number") return roundNumber(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalValue(item));
    if (key === "components" || key === "wires" || key === "probes") {
      return [...items].sort((left, right) => {
        const a = (left as { id?: string }).id ?? "";
        const b = (right as { id?: string }).id ?? "";
        return a.localeCompare(b, undefined, { numeric: true });
      });
    }
    return items;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .filter((entry) => record[entry] !== undefined)
        .sort()
        .map((entry) => [entry, canonicalValue(record[entry], entry)]),
    );
  }
  return value;
}

export function canonicalizeCircuit(document: CircuitDocument, includeView = true): string {
  const source = includeView ? document : { ...document, view: undefined };
  return JSON.stringify(canonicalValue(source));
}

export function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(input);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}
