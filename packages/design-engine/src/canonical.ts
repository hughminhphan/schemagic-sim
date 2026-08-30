import { fnv1a64 } from "@opencircuit/circuit-schema";

function canonicalValue(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical values cannot contain non-finite numbers");
    return Number(value.toPrecision(12));
  }
  if (typeof value === "string" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .filter((key) => object[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalValue(object[key])]),
    );
  }
  if (value === undefined) return undefined;
  throw new Error(`Unsupported canonical value ${typeof value}`);
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function contentHash(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalStringify(value))}`;
}
