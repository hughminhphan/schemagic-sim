import { canonicalizeCircuit, deserializeCircuit, type CircuitDocument } from "@opencircuit/circuit-schema";
import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { normalizeMeasurementWorkbenchState, type MeasurementWorkbenchState } from "./measurement-state";

export interface SharedWorkspaceState {
  format: "schemagic-workspace-share";
  version: 1;
  document: CircuitDocument;
  instrumentState?: MeasurementWorkbenchState;
}

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

export function encodeCircuit(document: CircuitDocument): string {
  return base64Url(deflateSync(strToU8(canonicalizeCircuit(document)), { level: 9 }));
}

function canonicalShareValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalShareValue);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => [key, canonicalShareValue(record[key])]));
  }
  return value;
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
  return base64Url(deflateSync(strToU8(JSON.stringify(canonicalShareValue(payload))), { level: 9 }));
}

export function decodeCircuit(payload: string): CircuitDocument {
  return decodeWorkspaceShare(payload).document;
}

export function decodeWorkspaceShare(payload: string): { document: CircuitDocument; instrumentState?: MeasurementWorkbenchState } {
  const compressed = fromBase64Url(payload);
  if (compressed.byteLength > 6_000_000) throw new Error("Share URL payload is too large");
  const inflated = inflateSync(compressed);
  if (inflated.byteLength > 6_000_000) throw new Error("Share URL circuit is too large");
  try {
    const source = strFromU8(inflated);
    const parsed = JSON.parse(source) as Partial<SharedWorkspaceState> & { format?: string };
    if (parsed.format === "schemagic-workspace-share") {
      if (parsed.version !== 1 || !parsed.document) throw new Error("Unsupported shared workspace version");
      return {
        document: deserializeCircuit(JSON.stringify(parsed.document)),
        ...(parsed.instrumentState ? { instrumentState: normalizeMeasurementWorkbenchState(parsed.instrumentState) } : {}),
      };
    }
    return { document: deserializeCircuit(source) };
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
