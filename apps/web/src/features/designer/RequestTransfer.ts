import {
  DESIGN_REQUEST_V2_MAX_CANONICAL_BYTES,
  DesignParseErrorV2,
  canonicalElectricalDesignRequestV2Payload,
  designRequestHashV2,
  designSha256ContentHash,
  parseElectricalDesignRequestV2,
  type ElectricalDesignRequestV2,
  type Sha256ContentHash,
} from "@opencircuit/design-schema";
import { deflateSync, inflateSync } from "fflate";

const SHARE_FORMAT = "schemagic-designer-request-share";
const SHARE_SCHEMA_VERSION = 1;
const SHARE_PARAMETER = "r";
const RESULT_SHARE_PARAMETER = "d";

export const DESIGN_REQUEST_IMPORT_MAX_BYTES = DESIGN_REQUEST_V2_MAX_CANONICAL_BYTES;
export const DESIGN_REQUEST_SHARE_MAX_UNCOMPRESSED_BYTES = DESIGN_REQUEST_V2_MAX_CANONICAL_BYTES + 1024;
export const DESIGN_REQUEST_SHARE_MAX_COMPRESSED_BYTES = 64 * 1024;
export const DESIGN_REQUEST_SHARE_MAX_ENCODED_CHARACTERS = Math.ceil(DESIGN_REQUEST_SHARE_MAX_COMPRESSED_BYTES * 4 / 3) + 4;

export type ElectricalDesignRequestTransferErrorCode = "invalid_request" | "invalid_share" | "resource_limit";

export class ElectricalDesignRequestTransferError extends Error {
  readonly code: ElectricalDesignRequestTransferErrorCode;

  constructor(code: ElectricalDesignRequestTransferErrorCode) {
    super(code === "resource_limit"
      ? "Electrical requirements exceed the supported transfer limits."
      : code === "invalid_request"
        ? "Electrical requirements must be exact canonical V2 request JSON."
        : "Shared electrical requirements failed strict validation.");
    this.name = "ElectricalDesignRequestTransferError";
    this.code = code;
  }
}

export interface ElectricalDesignRequestTransfer {
  readonly request: ElectricalDesignRequestV2;
  readonly canonicalText: string;
  readonly requestHash: Sha256ContentHash;
  readonly byteContentHash: Sha256ContentHash;
}

interface RequestSharePayloadV1 {
  format: typeof SHARE_FORMAT;
  schemaVersion: typeof SHARE_SCHEMA_VERSION;
  request: string;
  requestHash: Sha256ContentHash;
  byteContentHash: Sha256ContentHash;
}

function transfer(request: ElectricalDesignRequestV2, canonicalText: string): ElectricalDesignRequestTransfer {
  return Object.freeze({
    request,
    canonicalText,
    requestHash: designRequestHashV2(request),
    byteContentHash: designSha256ContentHash(canonicalText),
  });
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (
    value.length === 0
    || value.length > DESIGN_REQUEST_SHARE_MAX_ENCODED_CHARACTERS
    || value.length % 4 === 1
    || !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new ElectricalDesignRequestTransferError(
      value.length > DESIGN_REQUEST_SHARE_MAX_ENCODED_CHARACTERS ? "resource_limit" : "invalid_share",
    );
  }
  let bytes: Uint8Array;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new ElectricalDesignRequestTransferError("invalid_share");
  }
  if (bytes.byteLength > DESIGN_REQUEST_SHARE_MAX_COMPRESSED_BYTES || base64Url(bytes) !== value) {
    throw new ElectricalDesignRequestTransferError(
      bytes.byteLength > DESIGN_REQUEST_SHARE_MAX_COMPRESSED_BYTES ? "resource_limit" : "invalid_share",
    );
  }
  return bytes;
}

function parseCanonicalRequest(source: string, errorCode: "invalid_request" | "invalid_share"): ElectricalDesignRequestTransfer {
  if (new TextEncoder().encode(source).byteLength > DESIGN_REQUEST_IMPORT_MAX_BYTES) {
    throw new ElectricalDesignRequestTransferError("resource_limit");
  }
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch {
    throw new ElectricalDesignRequestTransferError(errorCode);
  }
  let request: ElectricalDesignRequestV2;
  try {
    request = parseElectricalDesignRequestV2(input);
  } catch (error) {
    if (error instanceof DesignParseErrorV2 && error.detail.code === "resource_limit") {
      throw new ElectricalDesignRequestTransferError("resource_limit");
    }
    throw new ElectricalDesignRequestTransferError(errorCode);
  }
  const canonicalText = canonicalElectricalDesignRequestV2Payload(request);
  if (canonicalText !== source) throw new ElectricalDesignRequestTransferError(errorCode);
  return transfer(request, canonicalText);
}

export function serializeElectricalDesignRequestV2(request: Readonly<ElectricalDesignRequestV2>): string {
  return canonicalElectricalDesignRequestV2Payload(parseElectricalDesignRequestV2(request));
}

export function parseElectricalDesignRequestV2Text(source: string): ElectricalDesignRequestTransfer {
  return parseCanonicalRequest(source, "invalid_request");
}

export function parseElectricalDesignRequestV2Bytes(bytes: Uint8Array): ElectricalDesignRequestTransfer {
  if (bytes.byteLength > DESIGN_REQUEST_IMPORT_MAX_BYTES) {
    throw new ElectricalDesignRequestTransferError("resource_limit");
  }
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ElectricalDesignRequestTransferError("invalid_request");
  }
  return parseElectricalDesignRequestV2Text(source);
}

export function encodeElectricalDesignRequestShare(request: Readonly<ElectricalDesignRequestV2>): string {
  const canonicalText = serializeElectricalDesignRequestV2(request);
  const parsed = parseElectricalDesignRequestV2Text(canonicalText);
  const payload: RequestSharePayloadV1 = {
    format: SHARE_FORMAT,
    schemaVersion: SHARE_SCHEMA_VERSION,
    request: canonicalText,
    requestHash: parsed.requestHash,
    byteContentHash: parsed.byteContentHash,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.byteLength > DESIGN_REQUEST_SHARE_MAX_UNCOMPRESSED_BYTES) {
    throw new ElectricalDesignRequestTransferError("resource_limit");
  }
  const compressed = deflateSync(bytes, { level: 9 });
  if (compressed.byteLength > DESIGN_REQUEST_SHARE_MAX_COMPRESSED_BYTES) {
    throw new ElectricalDesignRequestTransferError("resource_limit");
  }
  return base64Url(compressed);
}

export function decodeElectricalDesignRequestShare(encoded: string): ElectricalDesignRequestTransfer {
  const compressed = fromBase64Url(encoded);
  let bytes: Uint8Array;
  try {
    bytes = inflateSync(compressed, { out: new Uint8Array(DESIGN_REQUEST_SHARE_MAX_UNCOMPRESSED_BYTES + 1) });
  } catch {
    throw new ElectricalDesignRequestTransferError("invalid_share");
  }
  if (bytes.byteLength > DESIGN_REQUEST_SHARE_MAX_UNCOMPRESSED_BYTES) {
    throw new ElectricalDesignRequestTransferError("resource_limit");
  }
  let source: string;
  let parsed: unknown;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(source);
  } catch {
    throw new ElectricalDesignRequestTransferError("invalid_share");
  }
  if (
    !parsed
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || !exactKeys(parsed as Record<string, unknown>, ["format", "schemaVersion", "request", "requestHash", "byteContentHash"])
  ) {
    throw new ElectricalDesignRequestTransferError("invalid_share");
  }
  const payload = parsed as Partial<RequestSharePayloadV1>;
  if (
    payload.format !== SHARE_FORMAT
    || payload.schemaVersion !== SHARE_SCHEMA_VERSION
    || typeof payload.request !== "string"
    || typeof payload.requestHash !== "string"
    || typeof payload.byteContentHash !== "string"
  ) {
    throw new ElectricalDesignRequestTransferError("invalid_share");
  }
  const transferred = parseCanonicalRequest(payload.request, "invalid_share");
  if (payload.requestHash !== transferred.requestHash || payload.byteContentHash !== transferred.byteContentHash) {
    throw new ElectricalDesignRequestTransferError("invalid_share");
  }
  const canonicalPayload: RequestSharePayloadV1 = {
    format: SHARE_FORMAT,
    schemaVersion: SHARE_SCHEMA_VERSION,
    request: transferred.canonicalText,
    requestHash: transferred.requestHash,
    byteContentHash: transferred.byteContentHash,
  };
  const canonicalCompressed = deflateSync(new TextEncoder().encode(JSON.stringify(canonicalPayload)), { level: 9 });
  if (base64Url(canonicalCompressed) !== encoded) {
    throw new ElectricalDesignRequestTransferError("invalid_share");
  }
  return transferred;
}

export function electricalDesignRequestShareFromHash(hash: string): ElectricalDesignRequestTransfer | undefined {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const requestValues = params.getAll(SHARE_PARAMETER);
  const resultValues = params.getAll(RESULT_SHARE_PARAMETER);
  if (requestValues.length > 0 && resultValues.length > 0) {
    throw new ElectricalDesignRequestTransferError("invalid_share");
  }
  if (requestValues.length === 0) return undefined;
  if (requestValues.length !== 1 || [...params.keys()].some((key) => key !== SHARE_PARAMETER)) {
    throw new ElectricalDesignRequestTransferError("invalid_share");
  }
  return decodeElectricalDesignRequestShare(requestValues[0]!);
}

export function electricalDesignRequestShareUrl(
  request: Readonly<ElectricalDesignRequestV2>,
  location: Pick<Location, "href"> = window.location,
): string {
  const url = new URL(location.href);
  url.hash = new URLSearchParams({ [SHARE_PARAMETER]: encodeElectricalDesignRequestShare(request) }).toString();
  return url.toString();
}

export function clearElectricalDesignRequestShareFromUrl(
  location: Pick<Location, "href"> = window.location,
): string {
  const url = new URL(location.href);
  const params = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  params.delete(SHARE_PARAMETER);
  url.hash = params.toString();
  return url.toString();
}
