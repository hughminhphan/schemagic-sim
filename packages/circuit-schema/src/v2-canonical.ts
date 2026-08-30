import { canonicalizeCircuit, fnv1a64 } from "./canonical";
import type {
  AnyCircuitDocument,
  CircuitDocumentV2,
  DesignBlockDefinition,
  Sha256ContentHash,
} from "./types";

type JsonPrimitive = boolean | number | string | null;
export type CanonicalJsonValue = JsonPrimitive | CanonicalJsonValue[] | { [key: string]: CanonicalJsonValue };
type CanonicalContext = "generic" | "circuit" | "scenario" | "design-block";

export function compareCircuitV2Tokens(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

export function canonicalCircuitNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Circuit documents cannot contain non-finite numbers");
  return Number(value.toPrecision(12));
}

function compareSetMembers(left: CanonicalJsonValue, right: CanonicalJsonValue, key: string): number {
  const a = left as { id?: string; version?: string; contentHash?: string };
  const b = right as { id?: string; version?: string; contentHash?: string };
  if (key === "trustedAssets") {
    const hashOrder = compareCircuitV2Tokens(a.contentHash ?? "", b.contentHash ?? "");
    return hashOrder !== 0 ? hashOrder : compareCircuitV2Tokens(JSON.stringify(left), JSON.stringify(right));
  }
  const idOrder = compareCircuitV2Tokens(a.id ?? "", b.id ?? "");
  if (idOrder !== 0 || key !== "designBlocks") return idOrder;
  const versionOrder = compareCircuitV2Tokens(a.version ?? "", b.version ?? "");
  return versionOrder !== 0 ? versionOrder : compareCircuitV2Tokens(a.contentHash ?? "", b.contentHash ?? "");
}

function createJsonObject(): { [key: string]: CanonicalJsonValue } {
  return Object.create(null) as { [key: string]: CanonicalJsonValue };
}

function setOwn<T>(target: { [key: string]: T }, key: string, value: T): void {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
}

function setArrayKey(path: readonly string[], context: CanonicalContext): string | undefined {
  const joined = path.join(".");
  if (context === "circuit") {
    if (["designBlocks", "circuits", "scenarios"].includes(joined)) return path.at(-1);
    if (/^circuits\.\*\.(components|wires|probes)$/.test(joined)) return path.at(-1);
  }
  if (context === "scenario") {
    if (["designBlocks", "trustedAssets", "graph.components", "graph.wires", "graph.probes"].includes(joined)) return path.at(-1);
  }
  return undefined;
}

function omitKey(path: readonly string[], key: string, context: CanonicalContext, includeView: boolean): boolean {
  if (context === "design-block" && path.length === 0 && key === "contentHash") return true;
  return context === "circuit" && !includeView && path.length === 2 && path[0] === "circuits" && path[1] === "*" && key === "view";
}

function canonicalizeValue(
  value: unknown,
  path: readonly string[],
  context: CanonicalContext,
  includeView: boolean,
): CanonicalJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return canonicalCircuitNumber(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeValue(item, [...path, "*"], context, includeView));
    const setKey = setArrayKey(path, context);
    return setKey ? [...items].sort((a, b) => compareSetMembers(a, b, setKey)) : items;
  }
  if (value && typeof value === "object") {
    const result = createJsonObject();
    for (const objectKey of Object.keys(value).sort(compareCircuitV2Tokens)) {
      if (omitKey(path, objectKey, context, includeView)) continue;
      const nested = (value as Record<string, unknown>)[objectKey];
      if (nested !== undefined) setOwn(result, objectKey, canonicalizeValue(nested, [...path, objectKey], context, includeView));
    }
    return result;
  }
  throw new Error(`Circuit documents cannot contain ${typeof value}`);
}

export function canonicalizeV2Value(value: unknown): CanonicalJsonValue {
  return canonicalizeValue(value, [], "generic", true);
}

export function canonicalizeCircuitV2(document: CircuitDocumentV2, includeView = true): string {
  return JSON.stringify(canonicalizeValue(document, [], "circuit", includeView));
}

export function canonicalizeV2SimulationProjection(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value, [], "scenario", true));
}

export function canonicalizeAnyCircuit(document: AnyCircuitDocument, includeView = true): string {
  return document.version === 2
    ? canonicalizeCircuitV2(document, includeView)
    : canonicalizeCircuit(document, includeView);
}

export function canonicalDesignBlockPayload(
  definition: Omit<DesignBlockDefinition, "contentHash"> | DesignBlockDefinition,
): string {
  return JSON.stringify(canonicalizeValue(definition, [], "design-block", true));
}

function detachValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string" || value === undefined) return value;
  if (typeof value === "number") return canonicalCircuitNumber(value);
  if (Array.isArray(value)) return value.map((entry) => detachValue(entry));
  if (typeof value === "object") {
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const keys = Object.keys(value);
    for (const key of keys) setOwn(result, key, detachValue((value as Record<string, unknown>)[key]));
    return result;
  }
  throw new Error(`Circuit documents cannot contain ${typeof value}`);
}

function freezeValue(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const key of Object.keys(value)) freezeValue((value as Record<string, unknown>)[key]);
  Object.freeze(value);
}

export function detachedCircuitV2Snapshot(document: CircuitDocumentV2): CircuitDocumentV2 {
  const snapshot = detachValue(document) as CircuitDocumentV2;
  freezeValue(snapshot);
  return snapshot;
}

// Browser-safe synchronous SHA-256. The same fixed implementation is used for
// design-block definitions and trusted pre-namespace model bytes.
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

export function sha256Hex(value: string): string {
  const input = new TextEncoder().encode(value);
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const prior15 = words[index - 15]!;
      const prior2 = words[index - 2]!;
      const sigma0 = rotateRight(prior15, 7) ^ rotateRight(prior15, 18) ^ (prior15 >>> 3);
      const sigma1 = rotateRight(prior2, 17) ^ rotateRight(prior2, 19) ^ (prior2 >>> 10);
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state as [number, number, number, number, number, number, number, number];
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_K[index]! + words[index]!) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0]! + a) >>> 0;
    state[1] = (state[1]! + b) >>> 0;
    state[2] = (state[2]! + c) >>> 0;
    state[3] = (state[3]! + d) >>> 0;
    state[4] = (state[4]! + e) >>> 0;
    state[5] = (state[5]! + f) >>> 0;
    state[6] = (state[6]! + g) >>> 0;
    state[7] = (state[7]! + h) >>> 0;
  }
  return state.map((word) => word.toString(16).padStart(8, "0")).join("");
}

export function calculateDesignBlockContentHash(
  definition: Omit<DesignBlockDefinition, "contentHash"> | DesignBlockDefinition,
): Sha256ContentHash {
  return `sha256:${sha256Hex(canonicalDesignBlockPayload(definition))}`;
}

export function circuitV2SerializationHash(document: CircuitDocumentV2): string {
  return fnv1a64(canonicalizeCircuitV2(document, false));
}
