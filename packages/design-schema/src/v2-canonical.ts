import type { Sha256ContentHash } from "@opencircuit/circuit-schema";
import {
  DESIGN_EXECUTION_REPORT_V2_MAX_CANONICAL_BYTES,
  DESIGN_REQUEST_V2_MAX_CANONICAL_BYTES,
  DESIGN_V2_MAX_OBJECT_DEPTH,
  DESIGN_V2_MAX_STRING_UTF8_BYTES,
  DESIGN_V2_MAX_VISITED_NODES,
} from "./v2-limits";
import {
  DESIGN_VALIDATION_ISSUE_MESSAGE_PREFIX,
  DesignParseErrorV2,
  type DesignParseArtifactV2,
  type DesignResultV2,
  type DesignValidationIssue,
  type DesignValidationIssueCode,
  type ElectricalDesignRequestV2,
} from "./v2-types";

export type DesignJsonPrimitiveV2 = boolean | null | number | string;
export type DesignJsonValueV2 = DesignJsonPrimitiveV2 | DesignJsonValueV2[] | { [key: string]: DesignJsonValueV2 };
export type DesignJsonObjectV2 = { [key: string]: DesignJsonValueV2 };

export function compareDesignV2Tokens(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

const UNSAFE_DISPLAY_CHARACTERS_V2 = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ud800-\udfff]/u;

/** Rejects terminal controls, Unicode line separators, bidi controls, and lone UTF-16 surrogates. */
export function containsUnsafeDesignDisplayCharactersV2(value: string): boolean {
  return UNSAFE_DISPLAY_CHARACTERS_V2.test(value);
}

export function canonicalDesignV2Number(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError("Non-finite number");
  const rounded = Number(value.toPrecision(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function canonicalValue(value: unknown, omitRootContentHash: boolean, depth = 0): DesignJsonValueV2 {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return canonicalDesignV2Number(value);
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry, false, depth + 1));
  if (value && typeof value === "object") {
    const result: DesignJsonObjectV2 = Object.create(null) as DesignJsonObjectV2;
    for (const key of Object.keys(value).sort(compareDesignV2Tokens)) {
      if (omitRootContentHash && depth === 0 && key === "contentHash") continue;
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) result[key] = canonicalValue(nested, false, depth + 1);
    }
    return result;
  }
  throw new TypeError(`Unsupported ${typeof value}`);
}

export function canonicalDesignV2Value(value: unknown): DesignJsonValueV2 {
  return canonicalValue(value, false);
}

export function canonicalDesignV2Payload(value: unknown, omitRootContentHash = false): string {
  return JSON.stringify(canonicalValue(value, omitRootContentHash));
}

function freezeDeep(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const key of Object.keys(value)) freezeDeep((value as Record<string, unknown>)[key]);
  Object.freeze(value);
}

export function detachedFrozenDesignV2Value<T>(value: T): T {
  const detached = canonicalValue(value, false) as T;
  freezeDeep(detached);
  return detached;
}

const SHA256_K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
] as const;

const rotateRight = (value: number, count: number): number => (value >>> count) | (value << (32 - count));

export function designSha256Hex(value: string): string {
  const input = new TextEncoder().encode(value);
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input); bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const state = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15]!; const b = words[index - 2]!;
      words[index] = (words[index - 16]! + (rotateRight(a,7)^rotateRight(a,18)^(a>>>3)) + words[index - 7]! + (rotateRight(b,17)^rotateRight(b,19)^(b>>>10))) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = state as [number,number,number,number,number,number,number,number];
    for (let index = 0; index < 64; index += 1) {
      const t1 = (h + (rotateRight(e,6)^rotateRight(e,11)^rotateRight(e,25)) + ((e&f)^(~e&g)) + SHA256_K[index]! + words[index]!) >>> 0;
      const t2 = ((rotateRight(a,2)^rotateRight(a,13)^rotateRight(a,22)) + ((a&b)^(a&c)^(b&c))) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,h].forEach((entry,index) => { state[index] = (state[index]! + entry) >>> 0; });
  }
  return state.map((entry) => entry.toString(16).padStart(8,"0")).join("");
}

export function designSha256ContentHash(value: string): Sha256ContentHash {
  return `sha256:${designSha256Hex(value)}`;
}

export function renderDesignValidationIssueMessage(issue: Readonly<Pick<DesignValidationIssue, "code" | "path">>): string {
  return `${DESIGN_VALIDATION_ISSUE_MESSAGE_PREFIX[issue.code]} at ${issue.path || "/"}`;
}

export function designValidationIssue(code: DesignValidationIssueCode, path: string): DesignValidationIssue {
  const issue = { code, path, message: "" } as DesignValidationIssue;
  issue.message = renderDesignValidationIssueMessage(issue);
  return Object.freeze(issue);
}

function boundedDesignV2InputInternal(
  value: unknown,
  artifact: DesignParseArtifactV2,
  maxCanonicalBytes: number,
  derivedStringPath?: (path: string) => boolean,
): DesignJsonValueV2 {
  let nodes = 0;
  const active = new Set<object>();
  const invalid = (path: string): never => {
    throw new DesignParseErrorV2({ code: "invalid_document", stage: "parse", artifact }, [designValidationIssue("invalid_type", path)]);
  };
  const walk = (entry: unknown, depth: number, path: string): DesignJsonValueV2 => {
    nodes += 1;
    if (nodes > DESIGN_V2_MAX_VISITED_NODES || depth > DESIGN_V2_MAX_OBJECT_DEPTH) {
      throw new DesignParseErrorV2({ code: "resource_limit", stage: "parse", artifact }, [designValidationIssue("resource_limit", path)]);
    }
    if (entry === null || typeof entry === "boolean") return entry;
    if (typeof entry === "number") {
      if (!Number.isFinite(entry)) return invalid(path);
      return Object.is(entry,-0)?0:entry;
    }
    if (typeof entry === "string") {
      if (derivedStringPath?.(path)) {
        if (entry.length > maxCanonicalBytes) throw new DesignParseErrorV2({ code: "resource_limit", stage: "parse", artifact }, [designValidationIssue("resource_limit", path)]);
      } else if (new TextEncoder().encode(entry).byteLength > DESIGN_V2_MAX_STRING_UTF8_BYTES) {
        throw new DesignParseErrorV2({ code: "resource_limit", stage: "parse", artifact }, [designValidationIssue("resource_limit", path)]);
      }
      return entry;
    }
    if (!entry || typeof entry !== "object") return invalid(path);
    if (active.has(entry)) throw new DesignParseErrorV2({ code: "invalid_document", stage: "parse", artifact }, [designValidationIssue("invalid_type", path)]);
    active.add(entry);
    let descriptors: PropertyDescriptorMap;
    let prototype: object | null;
    try { descriptors = Object.getOwnPropertyDescriptors(entry); prototype = Object.getPrototypeOf(entry); }
    catch { return invalid(path); }
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== "string")) return invalid(path);
    let result: DesignJsonValueV2;
    if (Array.isArray(entry)) {
      if (prototype !== Array.prototype) return invalid(path);
      const lengthDescriptor = descriptors.length;
      if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return invalid(path);
      const length = lengthDescriptor.value as number;
      const array: DesignJsonValueV2[] = [];
      for (let index = 0; index < length; index += 1) {
        const key = String(index); const descriptor = descriptors[key];
        if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) return invalid(`${path}/${key}`);
        array.push(walk(descriptor.value, depth + 1, `${path}/${key}`));
      }
      if (ownKeys.some((key) => key !== "length" && (!/^(?:0|[1-9][0-9]*)$/u.test(key as string) || Number(key) >= length))) return invalid(path);
      result = array;
    } else {
      if (prototype !== Object.prototype && prototype !== null) return invalid(path);
      const object: DesignJsonObjectV2 = Object.create(null) as DesignJsonObjectV2;
      for (const key of (ownKeys as string[]).sort(compareDesignV2Tokens)) {
        const descriptor = descriptors[key]!;
        if (!("value" in descriptor) || descriptor.enumerable !== true) return invalid(`${path}/${escapePointer(key)}`);
        object[key] = walk(descriptor.value, depth + 1, `${path}/${escapePointer(key)}`);
      }
      result = object;
    }
    active.delete(entry);
    return result;
  };
  const snapshot = walk(value, 0, "");
  const canonical = canonicalDesignV2Payload(snapshot);
  if (new TextEncoder().encode(canonical).byteLength > maxCanonicalBytes) {
    throw new DesignParseErrorV2({ code: "resource_limit", stage: "parse", artifact }, [designValidationIssue("resource_limit", "")]);
  }
  freezeDeep(snapshot);
  return snapshot;
}

export function assertBoundedDesignV2Input(value: unknown, artifact: DesignParseArtifactV2, maxCanonicalBytes: number): void {
  void boundedDesignV2InputInternal(value, artifact, maxCanonicalBytes);
}

/** Descriptor-safe, single-read JSON snapshot used at every untrusted V2 parse/hook boundary. */
export function boundedDetachedFrozenDesignV2Value<T>(value: T, artifact: DesignParseArtifactV2, maxCanonicalBytes: number): T {
  return boundedDesignV2InputInternal(value, artifact, maxCanonicalBytes) as T;
}

/** The execution-report parser recomputes these engine-derived messages byte-for-byte. */
export function assertBoundedDesignExecutionReportV2Input(value: unknown): void {
  void boundedDesignV2InputInternal(value, "execution_report", DESIGN_EXECUTION_REPORT_V2_MAX_CANONICAL_BYTES, (path) => /^\/rejections\/(?:0|[1-9][0-9]*)\/message$/u.test(path));
}

export function boundedDetachedFrozenDesignExecutionReportV2Value<T>(value: T): T {
  return boundedDesignV2InputInternal(value, "execution_report", DESIGN_EXECUTION_REPORT_V2_MAX_CANONICAL_BYTES, (path) => /^\/rejections\/(?:0|[1-9][0-9]*)\/message$/u.test(path)) as T;
}

export function escapePointer(token: string): string { return token.replaceAll("~", "~0").replaceAll("/", "~1"); }

function presentationFree(value: unknown): DesignJsonValueV2 {
  if (value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") return canonicalValue(value, false);
  if (Array.isArray(value)) return value.map(presentationFree);
  const result: DesignJsonObjectV2 = Object.create(null) as DesignJsonObjectV2;
  for (const key of Object.keys(value as object).sort(compareDesignV2Tokens)) {
    if (key === "displayUnit") continue;
    const nested = (value as Record<string, unknown>)[key];
    if (nested !== undefined) result[key] = presentationFree(nested);
  }
  return result;
}

export function projectElectricalDesignRequestIdentityV2(request: Readonly<ElectricalDesignRequestV2>): DesignJsonObjectV2 {
  return presentationFree(request) as DesignJsonObjectV2;
}
export function canonicalElectricalDesignRequestIdentityV2Payload(request: Readonly<ElectricalDesignRequestV2>): string {
  return canonicalDesignV2Payload(projectElectricalDesignRequestIdentityV2(request));
}
export function canonicalElectricalDesignRequestV2Payload(request: Readonly<ElectricalDesignRequestV2>): string {
  return canonicalDesignV2Payload(request);
}
export function designRequestHashV2(request: Readonly<ElectricalDesignRequestV2>): Sha256ContentHash {
  return designSha256ContentHash(canonicalElectricalDesignRequestIdentityV2Payload(request));
}
export function canonicalDesignResultV2Payload(result: Omit<DesignResultV2, "contentHash"> | DesignResultV2): string {
  return canonicalDesignV2Payload(result, true);
}
export function canonicalDesignResultV2ContentHash(result: Omit<DesignResultV2, "contentHash"> | DesignResultV2): Sha256ContentHash {
  return designSha256ContentHash(canonicalDesignResultV2Payload(result));
}
export function assertBoundedElectricalRequestV2(value: unknown): void {
  assertBoundedDesignV2Input(value, "electrical_request", DESIGN_REQUEST_V2_MAX_CANONICAL_BYTES);
}
export function boundedDetachedFrozenElectricalRequestV2Value<T>(value: T): T {
  return boundedDetachedFrozenDesignV2Value(value, "electrical_request", DESIGN_REQUEST_V2_MAX_CANONICAL_BYTES);
}
