import { canonicalizeCircuit, deserializeCircuit, type CircuitDocument } from "@opencircuit/circuit-schema";
import { deflateSync, inflateSync, strFromU8 } from "fflate";
import { normalizeMeasurementWorkbenchState, type MeasurementWorkbenchState } from "./measurement-state";

export interface SharedWorkspaceState {
  format: "schemagic-workspace-share";
  version: 1;
  document: CircuitDocument;
  instrumentState?: MeasurementWorkbenchState;
}

const CURRENT_SHARE_PREFIX = "v2.";
const LEGACY_SHARE_PREFIX = "v1.";
const MAX_SHARE_BYTES = 6_000_000;

const enum ValueTag {
  Null = 0,
  False = 1,
  True = 2,
  Zero = 3,
  One = 4,
  PositiveInteger = 5,
  NegativeInteger = 6,
  Decimal = 7,
  String = 8,
  InternedString = 9,
  Array = 10,
  Object = 11,
}

// The v2 dictionaries are wire-format contracts. Append only, or bump the share prefix.
const STRUCTURAL_KEYS = [
  "ac", "baseType", "catalogPartId", "catalogSupplyBindings", "color", "comparison", "components", "contentHash",
  "dcSweep", "delay", "description", "displayUnit", "expression", "expressionVersion", "fall", "format", "frequency",
  "fstart", "fstop", "id", "inputSourceId", "instrumentState", "kind", "label", "manufacturer", "maxstep", "meta",
  "mirror", "mode", "model", "modelImports", "mpn", "name", "negative", "netLabel", "noise", "offset", "outputProbeId",
  "pan", "params", "parts", "period", "phaseDeg", "points", "pointsPerDecade", "pos", "positive", "probes", "profiles",
  "rise", "rot", "savedCaptureIds", "sim", "sourceId", "sourceName", "sourceText", "start", "step", "stimulus", "stop",
  "sweep", "t", "target", "temperatureC", "text", "title", "tran", "tstep", "tstop", "type", "v1", "v2", "value",
  "vcc", "vee", "version", "view", "viewer", "width", "wire", "wireId", "wires", "zoom",
] as const;
const STRUCTURAL_KEY_INDEX = new Map<string, number>(STRUCTURAL_KEYS.map((key, index) => [key, index]));

const STRUCTURAL_STRINGS = [
  "opencircuit-circuit", "opencircuit-imported-models", "schemagic-workspace-share", "runtime-node", "schematic-wire",
  "voltage", "current", "power", "live", "op", "dc-sweep", "tran", "ac", "noise", "dec", "lin", "oct",
  "resistor", "capacitor", "inductor", "diode", "led", "bjt_npn", "bjt_pnp", "mosfet_n", "mosfet_p", "opamp",
  "vsource", "vsource_sine", "vsource_pulse", "isource", "ground", "potentiometer", "switch", "transformer",
] as const;
const STRUCTURAL_STRING_INDEX = new Map<string, number>(STRUCTURAL_STRINGS.map((value, index) => [value, index]));

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 8_000_000) throw new Error("Share URL payload is malformed or too large");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function canonicalShareValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalShareValue);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => [key, canonicalShareValue(record[key])]));
  }
  return value;
}

function writeUnsignedVarInt(output: number[], value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Share payload integer is outside the supported range");
  do {
    const byte = value % 128;
    value = Math.floor(value / 128);
    output.push(byte | (value > 0 ? 0x80 : 0));
  } while (value > 0);
}

function writeRawString(output: number[], encoder: TextEncoder, value: string): void {
  const bytes = encoder.encode(value);
  writeUnsignedVarInt(output, bytes.byteLength);
  output.push(...bytes);
}

function encodeStructuralValue(value: unknown): Uint8Array {
  const output: number[] = [];
  const encoder = new TextEncoder();
  const write = (candidate: unknown): void => {
    if (candidate === null) {
      output.push(ValueTag.Null);
    } else if (candidate === false) {
      output.push(ValueTag.False);
    } else if (candidate === true) {
      output.push(ValueTag.True);
    } else if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) throw new Error("Share payload contains a non-finite number");
      if (candidate === 0) {
        output.push(ValueTag.Zero);
      } else if (candidate === 1) {
        output.push(ValueTag.One);
      } else if (Number.isSafeInteger(candidate)) {
        output.push(candidate >= 0 ? ValueTag.PositiveInteger : ValueTag.NegativeInteger);
        writeUnsignedVarInt(output, Math.abs(candidate));
      } else {
        output.push(ValueTag.Decimal);
        writeRawString(output, encoder, String(candidate));
      }
    } else if (typeof candidate === "string") {
      const dictionaryIndex = STRUCTURAL_STRING_INDEX.get(candidate);
      if (dictionaryIndex === undefined) {
        output.push(ValueTag.String);
        writeRawString(output, encoder, candidate);
      } else {
        output.push(ValueTag.InternedString);
        writeUnsignedVarInt(output, dictionaryIndex);
      }
    } else if (Array.isArray(candidate)) {
      output.push(ValueTag.Array);
      writeUnsignedVarInt(output, candidate.length);
      for (const item of candidate) write(item);
    } else if (candidate && typeof candidate === "object") {
      const entries = Object.entries(candidate as Record<string, unknown>);
      output.push(ValueTag.Object);
      writeUnsignedVarInt(output, entries.length);
      for (const [key, item] of entries) {
        const dictionaryIndex = STRUCTURAL_KEY_INDEX.get(key);
        writeUnsignedVarInt(output, dictionaryIndex === undefined ? 0 : dictionaryIndex + 1);
        if (dictionaryIndex === undefined) writeRawString(output, encoder, key);
        write(item);
      }
    } else {
      throw new Error("Share payload contains an unsupported value");
    }
  };
  write(value);
  return Uint8Array.from(output);
}

function decodeStructuralValue(bytes: Uint8Array): unknown {
  let offset = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const readByte = (): number => {
    const value = bytes[offset];
    if (value === undefined) throw new Error("Share payload ended unexpectedly");
    offset += 1;
    return value;
  };
  const readUnsignedVarInt = (): number => {
    let value = 0;
    let multiplier = 1;
    for (let count = 0; count < 8; count += 1) {
      const byte = readByte();
      value += (byte & 0x7f) * multiplier;
      if (!Number.isSafeInteger(value)) throw new Error("Share payload integer is outside the supported range");
      if ((byte & 0x80) === 0) return value;
      multiplier *= 128;
    }
    throw new Error("Share payload integer is malformed");
  };
  const readRawString = (): string => {
    const length = readUnsignedVarInt();
    if (offset + length > bytes.byteLength) throw new Error("Share payload ended inside a string");
    const value = decoder.decode(bytes.subarray(offset, offset + length));
    offset += length;
    return value;
  };
  const read = (depth: number): unknown => {
    if (depth > 256) throw new Error("Share payload is nested too deeply");
    const tag = readByte();
    if (tag === ValueTag.Null) return null;
    if (tag === ValueTag.False) return false;
    if (tag === ValueTag.True) return true;
    if (tag === ValueTag.Zero) return 0;
    if (tag === ValueTag.One) return 1;
    if (tag === ValueTag.PositiveInteger) return readUnsignedVarInt();
    if (tag === ValueTag.NegativeInteger) return -readUnsignedVarInt();
    if (tag === ValueTag.Decimal) {
      const value = Number(readRawString());
      if (!Number.isFinite(value)) throw new Error("Share payload contains an invalid number");
      return value;
    }
    if (tag === ValueTag.String) return readRawString();
    if (tag === ValueTag.InternedString) {
      const value = STRUCTURAL_STRINGS[readUnsignedVarInt()];
      if (value === undefined) throw new Error("Share payload string dictionary index is invalid");
      return value;
    }
    if (tag === ValueTag.Array) {
      const length = readUnsignedVarInt();
      const value: unknown[] = [];
      for (let index = 0; index < length; index += 1) value.push(read(depth + 1));
      return value;
    }
    if (tag === ValueTag.Object) {
      const length = readUnsignedVarInt();
      const value: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (let index = 0; index < length; index += 1) {
        const keyIndex = readUnsignedVarInt();
        const key = keyIndex === 0 ? readRawString() : STRUCTURAL_KEYS[keyIndex - 1];
        if (key === undefined) throw new Error("Share payload key dictionary index is invalid");
        value[key] = read(depth + 1);
      }
      return value;
    }
    throw new Error("Share payload contains an unknown value tag");
  };
  const value = read(0);
  if (offset !== bytes.byteLength) throw new Error("Share payload contains trailing bytes");
  return value;
}

function compressedPayload(value: unknown): string {
  const structural = encodeStructuralValue(canonicalShareValue(value));
  return `${CURRENT_SHARE_PREFIX}${base64Url(deflateSync(structural, { level: 9 }))}`;
}

export function encodeCircuit(document: CircuitDocument): string {
  return compressedPayload(JSON.parse(canonicalizeCircuit(document)) as CircuitDocument);
}

export function encodeWorkspaceShare(document: CircuitDocument, instrumentState?: MeasurementWorkbenchState): string {
  const normalizedState = instrumentState ? normalizeMeasurementWorkbenchState(instrumentState) : undefined;
  if (normalizedState) {
    normalizedState.savedCaptureIds = [];
    normalizedState.comparison = {};
  }
  const payload: SharedWorkspaceState = {
    format: "schemagic-workspace-share",
    version: 1,
    document: JSON.parse(canonicalizeCircuit(document)) as CircuitDocument,
    ...(normalizedState ? { instrumentState: normalizedState } : {}),
  };
  return compressedPayload(payload);
}

export function decodeCircuit(payload: string): CircuitDocument {
  return decodeWorkspaceShare(payload).document;
}

export function decodeWorkspaceShare(payload: string): { document: CircuitDocument; instrumentState?: MeasurementWorkbenchState } {
  try {
    let source: unknown;
    if (payload.startsWith(CURRENT_SHARE_PREFIX)) {
      const compressed = fromBase64Url(payload.slice(CURRENT_SHARE_PREFIX.length));
      if (compressed.byteLength > MAX_SHARE_BYTES) throw new Error("Share URL payload is too large");
      const inflated = inflateSync(compressed);
      if (inflated.byteLength > MAX_SHARE_BYTES) throw new Error("Share URL circuit is too large");
      source = decodeStructuralValue(inflated);
    } else {
      if (/^v\d+\./.test(payload) && !payload.startsWith(LEGACY_SHARE_PREFIX)) throw new Error("Unsupported share URL version");
      const encoded = payload.startsWith(LEGACY_SHARE_PREFIX) ? payload.slice(LEGACY_SHARE_PREFIX.length) : payload;
      const compressed = fromBase64Url(encoded);
      if (compressed.byteLength > MAX_SHARE_BYTES) throw new Error("Share URL payload is too large");
      const inflated = inflateSync(compressed);
      if (inflated.byteLength > MAX_SHARE_BYTES) throw new Error("Share URL circuit is too large");
      source = JSON.parse(strFromU8(inflated)) as unknown;
    }
    if (source && typeof source === "object" && !Array.isArray(source) && (source as { format?: string }).format === "schemagic-workspace-share") {
      const parsed = source as Partial<SharedWorkspaceState>;
      if (parsed.version !== 1 || !parsed.document) throw new Error("Unsupported shared workspace version");
      return {
        document: deserializeCircuit(JSON.stringify(parsed.document)),
        ...(parsed.instrumentState ? { instrumentState: normalizeMeasurementWorkbenchState(parsed.instrumentState) } : {}),
      };
    }
    return { document: deserializeCircuit(JSON.stringify(source)) };
  } catch (error) {
    throw new Error("Share URL does not contain a valid supported circuit document", { cause: error });
  }
}

export function workspaceShareFromLocation(hash: string): { document: CircuitDocument; instrumentState?: MeasurementWorkbenchState } | undefined {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const payload = params.get("c");
  return payload ? decodeWorkspaceShare(payload) : undefined;
}

export function circuitFromLocation(hash: string): CircuitDocument | undefined {
  return workspaceShareFromLocation(hash)?.document;
}

export function shareUrl(document: CircuitDocument, location: Location = window.location, instrumentState?: MeasurementWorkbenchState): string {
  const url = new URL(location.href);
  url.hash = `c=${instrumentState ? encodeWorkspaceShare(document, instrumentState) : encodeCircuit(document)}`;
  return url.toString();
}
