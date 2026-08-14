import { canonicalizeCircuit, migrateCircuit, type CircuitDocument } from "@opencircuit/circuit-schema";
import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeCircuit(document: CircuitDocument): string {
  return base64Url(deflateSync(strToU8(canonicalizeCircuit(document)), { level: 9 }));
}

export function decodeCircuit(payload: string): CircuitDocument {
  const parsed = JSON.parse(strFromU8(inflateSync(fromBase64Url(payload)))) as { format?: unknown; version?: unknown; components?: unknown; wires?: unknown };
  if (parsed.format !== "opencircuit-circuit" || (parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.components) || !Array.isArray(parsed.wires)) {
    throw new Error("Share URL does not contain a supported circuit document");
  }
  return migrateCircuit(parsed);
}

export function circuitFromLocation(hash: string): CircuitDocument | undefined {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const payload = params.get("c");
  return payload ? decodeCircuit(payload) : undefined;
}

export function shareUrl(document: CircuitDocument, location: Location = window.location): string {
  const url = new URL(location.href);
  url.hash = `c=${encodeCircuit(document)}`;
  return url.toString();
}
