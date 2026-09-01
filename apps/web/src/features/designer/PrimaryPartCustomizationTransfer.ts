import {
  PRIMARY_PART_CUSTOMIZATION_MAX_BYTES,
  designRequestHashV2,
  designSha256ContentHash,
  parsePrimaryPartCustomizationSidecarV1Bytes,
  parsePrimaryPartCustomizationSidecarV1Text,
  serializePrimaryPartCustomizationSidecarV1,
  type ElectricalDesignRequestV2,
  type PrimaryPartCustomizationSidecarV1,
  type PrimaryPartCustomizationTransfer,
} from "@opencircuit/design-schema";
import { deflateSync, inflateSync } from "fflate";
import {
  encodeElectricalDesignRequestShare,
  serializeElectricalDesignRequestV2,
} from "./RequestTransfer";

const SHARE_FORMAT = "schemagic-designer-primary-part-customization-share";
const SHARE_SCHEMA_VERSION = 1;
export const PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_UNCOMPRESSED_BYTES = PRIMARY_PART_CUSTOMIZATION_MAX_BYTES + 1024;
export const PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_COMPRESSED_BYTES = 32 * 1024;
export const PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_ENCODED_CHARACTERS = Math.ceil(
  PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_COMPRESSED_BYTES * 4 / 3,
) + 4;

export type PrimaryPartCustomizationTransferErrorCode =
  | "invalid_customization"
  | "invalid_share"
  | "request_mismatch"
  | "resource_limit";

export class PrimaryPartCustomizationTransferError extends Error {
  readonly code: PrimaryPartCustomizationTransferErrorCode;

  constructor(code: PrimaryPartCustomizationTransferErrorCode) {
    super(code === "resource_limit"
      ? "Primary-part customization exceeds the supported transfer limits."
      : code === "request_mismatch"
        ? "Primary-part customization does not bind to the exact current requirements."
        : code === "invalid_customization"
          ? "Primary-part customization must be exact canonical JSON."
          : "Shared primary-part customization failed strict validation.");
    this.name = "PrimaryPartCustomizationTransferError";
    this.code = code;
  }
}

interface CustomizationSharePayloadV1 {
  format: typeof SHARE_FORMAT;
  schemaVersion: typeof SHARE_SCHEMA_VERSION;
  customization: string;
  contentHash: `sha256:${string}`;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
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
    || value.length > PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_ENCODED_CHARACTERS
    || value.length % 4 === 1
    || !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new PrimaryPartCustomizationTransferError(
      value.length > PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_ENCODED_CHARACTERS
        ? "resource_limit"
        : "invalid_share",
    );
  }
  let bytes: Uint8Array;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new PrimaryPartCustomizationTransferError("invalid_share");
  }
  if (
    bytes.byteLength > PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_COMPRESSED_BYTES
    || base64Url(bytes) !== value
  ) {
    throw new PrimaryPartCustomizationTransferError(
      bytes.byteLength > PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_COMPRESSED_BYTES
        ? "resource_limit"
        : "invalid_share",
    );
  }
  return bytes;
}

function parseFile(run: () => PrimaryPartCustomizationTransfer): PrimaryPartCustomizationTransfer {
  try {
    return run();
  } catch (error) {
    const resource = Boolean(
      error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: unknown }).code === "resource_limit",
    );
    throw new PrimaryPartCustomizationTransferError(resource ? "resource_limit" : "invalid_customization");
  }
}

export function serializePrimaryPartCustomizationFileV1(
  sidecar: Readonly<PrimaryPartCustomizationSidecarV1>,
): string {
  return parseFile(() => parsePrimaryPartCustomizationSidecarV1Text(
    serializePrimaryPartCustomizationSidecarV1(sidecar),
  )).canonicalText;
}

export function parsePrimaryPartCustomizationFileV1Text(
  source: string,
): PrimaryPartCustomizationTransfer {
  return parseFile(() => parsePrimaryPartCustomizationSidecarV1Text(source));
}

export function parsePrimaryPartCustomizationFileV1Bytes(
  bytes: Uint8Array,
): PrimaryPartCustomizationTransfer {
  return parseFile(() => parsePrimaryPartCustomizationSidecarV1Bytes(bytes));
}

export function assertPrimaryPartCustomizationRequestBinding(
  sidecar: Readonly<PrimaryPartCustomizationSidecarV1>,
  request: Readonly<ElectricalDesignRequestV2>,
): void {
  const canonicalRequest = serializeElectricalDesignRequestV2(request);
  if (
    sidecar.application !== request.application
    || sidecar.requestHash !== designRequestHashV2(request)
    || sidecar.requestByteContentHash !== designSha256ContentHash(canonicalRequest)
  ) throw new PrimaryPartCustomizationTransferError("request_mismatch");
}

export function encodePrimaryPartCustomizationShare(
  sidecar: Readonly<PrimaryPartCustomizationSidecarV1>,
): string {
  const customization = serializePrimaryPartCustomizationFileV1(sidecar);
  const payload: CustomizationSharePayloadV1 = {
    format: SHARE_FORMAT,
    schemaVersion: SHARE_SCHEMA_VERSION,
    customization,
    contentHash: sidecar.contentHash,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.byteLength > PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_UNCOMPRESSED_BYTES) {
    throw new PrimaryPartCustomizationTransferError("resource_limit");
  }
  const compressed = deflateSync(bytes, { level: 9 });
  if (compressed.byteLength > PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_COMPRESSED_BYTES) {
    throw new PrimaryPartCustomizationTransferError("resource_limit");
  }
  return base64Url(compressed);
}

export function decodePrimaryPartCustomizationShare(
  encoded: string,
): PrimaryPartCustomizationTransfer {
  const compressed = fromBase64Url(encoded);
  let bytes: Uint8Array;
  try {
    bytes = inflateSync(compressed, {
      out: new Uint8Array(PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_UNCOMPRESSED_BYTES + 1),
    });
  } catch {
    throw new PrimaryPartCustomizationTransferError("invalid_share");
  }
  if (bytes.byteLength > PRIMARY_PART_CUSTOMIZATION_SHARE_MAX_UNCOMPRESSED_BYTES) {
    throw new PrimaryPartCustomizationTransferError("resource_limit");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new PrimaryPartCustomizationTransferError("invalid_share");
  }
  if (
    !parsed
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || !exactKeys(parsed as Record<string, unknown>, [
      "format",
      "schemaVersion",
      "customization",
      "contentHash",
    ])
  ) throw new PrimaryPartCustomizationTransferError("invalid_share");
  const payload = parsed as Partial<CustomizationSharePayloadV1>;
  if (
    payload.format !== SHARE_FORMAT
    || payload.schemaVersion !== SHARE_SCHEMA_VERSION
    || typeof payload.customization !== "string"
    || typeof payload.contentHash !== "string"
  ) throw new PrimaryPartCustomizationTransferError("invalid_share");

  let transferred: PrimaryPartCustomizationTransfer;
  try {
    transferred = parsePrimaryPartCustomizationSidecarV1Text(payload.customization);
  } catch {
    throw new PrimaryPartCustomizationTransferError("invalid_share");
  }
  if (transferred.sidecar.contentHash !== payload.contentHash) {
    throw new PrimaryPartCustomizationTransferError("invalid_share");
  }
  const canonicalPayload: CustomizationSharePayloadV1 = {
    format: SHARE_FORMAT,
    schemaVersion: SHARE_SCHEMA_VERSION,
    customization: transferred.canonicalText,
    contentHash: transferred.sidecar.contentHash,
  };
  const canonicalCompressed = deflateSync(
    new TextEncoder().encode(JSON.stringify(canonicalPayload)),
    { level: 9 },
  );
  if (base64Url(canonicalCompressed) !== encoded) {
    throw new PrimaryPartCustomizationTransferError("invalid_share");
  }
  return transferred;
}

export function primaryPartCustomizationShareUrl(
  request: Readonly<ElectricalDesignRequestV2>,
  sidecar: Readonly<PrimaryPartCustomizationSidecarV1>,
  location: Pick<Location, "href"> = window.location,
): string {
  assertPrimaryPartCustomizationRequestBinding(sidecar, request);
  const url = new URL(location.href);
  url.hash = new URLSearchParams({
    r: encodeElectricalDesignRequestShare(request),
    c: encodePrimaryPartCustomizationShare(sidecar),
  }).toString();
  return url.toString();
}

export function clearPrimaryPartCustomizationShareFromUrl(
  location: Pick<Location, "href"> = window.location,
): string {
  const url = new URL(location.href);
  const params = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  params.delete("c");
  url.hash = params.toString();
  return url.toString();
}
