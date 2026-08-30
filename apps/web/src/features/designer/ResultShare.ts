import { deflateSync, inflateSync } from "fflate";
import {
  importedResultHasLegacyInlineSourcing,
  parseImportedDesignResultText,
  serializeImportedDesignResult,
  type ImportedDesignResult,
} from "./ResultImport";

const SHARE_FORMAT = "schemagic-designer-result-share";
const SHARE_SCHEMA_VERSION = 1;
const SHARE_PARAMETER = "d";
export const DESIGN_RESULT_SHARE_MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;

export const DESIGN_RESULT_SHARE_MAX_COMPRESSED_BYTES = 256 * 1024;
export const DESIGN_RESULT_SHARE_MAX_ENCODED_CHARACTERS = Math.ceil(DESIGN_RESULT_SHARE_MAX_COMPRESSED_BYTES * 4 / 3) + 4;

export type ImportedDesignResultShareErrorCode = "invalid_share" | "resource_limit" | "commercial_data_forbidden";

export class ImportedDesignResultShareError extends Error {
  readonly code: ImportedDesignResultShareErrorCode;

  constructor(code: ImportedDesignResultShareErrorCode) {
    super(code === "resource_limit"
      ? "Shared design result exceeds the supported URL limits."
      : code === "commercial_data_forbidden"
        ? "Legacy inline sourcing cannot enter a share URL without an authorized V2 commercial context."
        : "Shared design result failed strict validation.");
    this.name = "ImportedDesignResultShareError";
    this.code = code;
  }
}

export interface ImportedDesignResultShareState {
  imported: ImportedDesignResult;
  selectedCandidateId?: string;
  selectedScenarioId?: string;
}

interface SharePayloadV1 {
  format: typeof SHARE_FORMAT;
  schemaVersion: typeof SHARE_SCHEMA_VERSION;
  result: string;
  selectedCandidateId: string | null;
  selectedScenarioId: string | null;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (value.length === 0 || value.length > DESIGN_RESULT_SHARE_MAX_ENCODED_CHARACTERS
    || value.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new ImportedDesignResultShareError(value.length > DESIGN_RESULT_SHARE_MAX_ENCODED_CHARACTERS ? "resource_limit" : "invalid_share");
  }
  let bytes: Uint8Array;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  if (bytes.byteLength > DESIGN_RESULT_SHARE_MAX_COMPRESSED_BYTES || base64Url(bytes) !== value) {
    throw new ImportedDesignResultShareError(bytes.byteLength > DESIGN_RESULT_SHARE_MAX_COMPRESSED_BYTES ? "resource_limit" : "invalid_share");
  }
  return bytes;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function validateSelection(
  imported: Readonly<ImportedDesignResult>,
  selectedCandidateId: string | null,
  selectedScenarioId: string | null,
): void {
  if (selectedCandidateId !== null && (typeof selectedCandidateId !== "string" || selectedCandidateId.length === 0)) {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  if (selectedScenarioId !== null && (typeof selectedScenarioId !== "string" || selectedScenarioId.length === 0)) {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  const selected = selectedCandidateId === null
    ? undefined
    : imported.result.candidates.find((candidate) => candidate.id === selectedCandidateId);
  if ((selectedCandidateId !== null && selected === undefined) || (selectedCandidateId === null && selectedScenarioId !== null)) {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  if (selectedScenarioId !== null && (imported.result.schemaVersion !== 2
    || selected?.schemaVersion !== 2
    || !selected.simulationCoverage.some((coverage) => coverage.scenarioId === selectedScenarioId))) {
    throw new ImportedDesignResultShareError("invalid_share");
  }
}

export function encodeImportedDesignResultShare(
  imported: Readonly<ImportedDesignResult>,
  selectedCandidateId?: string,
  selectedScenarioId?: string,
): string {
  if (importedResultHasLegacyInlineSourcing(imported)) {
    throw new ImportedDesignResultShareError("commercial_data_forbidden");
  }
  const candidate = selectedCandidateId ?? null;
  const scenario = selectedScenarioId ?? null;
  validateSelection(imported, candidate, scenario);
  const result = serializeImportedDesignResult(imported);
  const payload: SharePayloadV1 = {
    format: SHARE_FORMAT,
    schemaVersion: SHARE_SCHEMA_VERSION,
    result,
    selectedCandidateId: candidate,
    selectedScenarioId: scenario,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.byteLength > DESIGN_RESULT_SHARE_MAX_UNCOMPRESSED_BYTES) throw new ImportedDesignResultShareError("resource_limit");
  const compressed = deflateSync(bytes, { level: 9 });
  if (compressed.byteLength > DESIGN_RESULT_SHARE_MAX_COMPRESSED_BYTES) {
    throw new ImportedDesignResultShareError("resource_limit");
  }
  return base64Url(compressed);
}

export function decodeImportedDesignResultShare(encoded: string): ImportedDesignResultShareState {
  const compressed = fromBase64Url(encoded);
  let bytes: Uint8Array;
  try {
    bytes = inflateSync(compressed, { out: new Uint8Array(DESIGN_RESULT_SHARE_MAX_UNCOMPRESSED_BYTES + 1) });
  } catch {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  if (bytes.byteLength > DESIGN_RESULT_SHARE_MAX_UNCOMPRESSED_BYTES) throw new ImportedDesignResultShareError("resource_limit");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
    || !exactKeys(parsed as Record<string, unknown>, ["format", "schemaVersion", "result", "selectedCandidateId", "selectedScenarioId"])) {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  const payload = parsed as Partial<SharePayloadV1>;
  if (payload.format !== SHARE_FORMAT || payload.schemaVersion !== SHARE_SCHEMA_VERSION
    || typeof payload.result !== "string"
    || (payload.selectedCandidateId !== null && typeof payload.selectedCandidateId !== "string")
    || (payload.selectedScenarioId !== null && typeof payload.selectedScenarioId !== "string")) {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  let imported: ImportedDesignResult;
  try {
    imported = parseImportedDesignResultText(payload.result);
  } catch {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  if (importedResultHasLegacyInlineSourcing(imported) || serializeImportedDesignResult(imported) !== payload.result) {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  validateSelection(imported, payload.selectedCandidateId, payload.selectedScenarioId);
  const canonicalPayload: SharePayloadV1 = {
    format: SHARE_FORMAT,
    schemaVersion: SHARE_SCHEMA_VERSION,
    result: payload.result,
    selectedCandidateId: payload.selectedCandidateId,
    selectedScenarioId: payload.selectedScenarioId,
  };
  const canonicalCompressed = deflateSync(new TextEncoder().encode(JSON.stringify(canonicalPayload)), { level: 9 });
  if (base64Url(canonicalCompressed) !== encoded) {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  return {
    imported,
    ...(payload.selectedCandidateId === null ? {} : { selectedCandidateId: payload.selectedCandidateId }),
    ...(payload.selectedScenarioId === null ? {} : { selectedScenarioId: payload.selectedScenarioId }),
  };
}

export function importedDesignResultShareFromHash(hash: string): ImportedDesignResultShareState | undefined {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const values = params.getAll(SHARE_PARAMETER);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || [...params.keys()].some((key) => key !== SHARE_PARAMETER)) {
    throw new ImportedDesignResultShareError("invalid_share");
  }
  return decodeImportedDesignResultShare(values[0]!);
}

export function importedDesignResultShareUrl(
  imported: Readonly<ImportedDesignResult>,
  selectedCandidateId: string | undefined,
  selectedScenarioId: string | undefined,
  location: Pick<Location, "href"> = window.location,
): string {
  const url = new URL(location.href);
  url.hash = new URLSearchParams({
    [SHARE_PARAMETER]: encodeImportedDesignResultShare(imported, selectedCandidateId, selectedScenarioId),
  }).toString();
  return url.toString();
}

export function clearImportedDesignResultShareFromUrl(location: Pick<Location, "href"> = window.location): string {
  const url = new URL(location.href);
  const params = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  params.delete(SHARE_PARAMETER);
  url.hash = params.toString();
  return url.toString();
}
