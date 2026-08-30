type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type DeepReadonly<Value> = Value extends (...args: never[]) => unknown
  ? Value
  : Value extends readonly unknown[]
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

/** Recursively freezes data-only code-owned tables without invoking accessors. */
export function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value as DeepReadonly<Value>;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) deepFreeze(descriptor.value);
  }
  return Object.freeze(value) as DeepReadonly<Value>;
}

function canonicalValue(value: unknown, path: string): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Canonical JSON cannot contain a non-finite number at ${path}`);
    return value;
  }
  if (Array.isArray(value)) {
    const length = value.length;
    const result: JsonValue[] = [];
    for (let index = 0; index < length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) throw new Error(`Canonical JSON arrays cannot contain inherited entries or holes at ${path}.${index}`);
      result.push(canonicalValue(Reflect.get(value, index), `${path}.${index}`));
    }
    return result;
  }
  if (typeof value === "object") {
    const result = Object.create(null) as Record<string, JsonValue>;
    for (const key of Object.keys(value).sort(compareAscii)) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested === undefined) throw new Error(`Canonical JSON cannot contain undefined at ${path}.${key}`);
      result[key] = canonicalValue(nested, `${path}.${key}`);
    }
    return result;
  }
  throw new Error(`Canonical JSON cannot contain ${typeof value} at ${path}`);
}

export function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value, "$"));
}

/** V2 engineering arithmetic boundary: ECMAScript binary64 rounded to twelve significant digits. */
export function canonicalProfileNumberV2(value: number): number {
  if (!Number.isFinite(value)) throw new Error("V2 profile arithmetic requires a finite number");
  const normalized = Number(value.toPrecision(12));
  if (!Number.isFinite(normalized)) throw new Error("V2 profile arithmetic exceeded the finite number domain");
  return Object.is(normalized, -0) ? 0 : normalized;
}

/** Captures own enumerable JSON data once before validation can reread live input. */
export function detachedJsonSnapshot<Value>(value: Value): Value {
  return JSON.parse(canonicalJson(value)) as Value;
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee,
  0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

function sha256Hex(text: string): string {
  const input = new TextEncoder().encode(text);
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const state = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15]!;
      const b = words[index - 2]!;
      const sigma0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3);
      const sigma1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10);
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
    state[0] = (state[0]! + a) >>> 0; state[1] = (state[1]! + b) >>> 0;
    state[2] = (state[2]! + c) >>> 0; state[3] = (state[3]! + d) >>> 0;
    state[4] = (state[4]! + e) >>> 0; state[5] = (state[5]! + f) >>> 0;
    state[6] = (state[6]! + g) >>> 0; state[7] = (state[7]! + h) >>> 0;
  }
  return state.map((word) => word.toString(16).padStart(8, "0")).join("");
}

export function contentHash(value: unknown): `sha256:${string}` {
  return `sha256:${sha256Hex(typeof value === "string" ? value : canonicalJson(value))}`;
}
