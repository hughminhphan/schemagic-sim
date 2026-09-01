#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const POWER_ADI_EVIDENCE_SOURCES = Object.freeze([
  Object.freeze({
    id: "adi-lt8640s-product",
    url: "https://www.analog.com/en/products/lt8640s.html",
    fileName: "adi-lt8640s.product.html",
    contentType: "text/html",
    kind: "manufacturer_product_page",
    identityMarker: "LT8640SIV#PBF",
  }),
  Object.freeze({
    id: "adi-lt8640s-datasheet",
    url: "https://www.analog.com/media/en/technical-documentation/data-sheets/lt8640s-lt8643s-lt8640sa-lt8643sa.pdf",
    fileName: "adi-lt8640s.datasheet.pdf",
    contentType: "application/pdf",
    kind: "manufacturer_datasheet",
    identityMarker: "LT8640S",
  }),
  Object.freeze({
    id: "adi-ltc3891-product",
    url: "https://www.analog.com/en/products/ltc3891.html",
    fileName: "adi-ltc3891.product.html",
    contentType: "text/html",
    kind: "manufacturer_product_page",
    identityMarker: "LTC3891EFE#PBF",
  }),
  Object.freeze({
    id: "adi-ltc3891-datasheet",
    url: "https://www.analog.com/media/en/technical-documentation/data-sheets/3891fa.pdf",
    fileName: "adi-ltc3891.datasheet.pdf",
    contentType: "application/pdf",
    kind: "manufacturer_datasheet",
    identityMarker: "LTC3891",
  }),
  Object.freeze({
    id: "adi-ltc3895-product",
    url: "https://www.analog.com/en/products/ltc3895.html",
    fileName: "adi-ltc3895.product.html",
    contentType: "text/html",
    kind: "manufacturer_product_page",
    identityMarker: "LTC3895EFE#PBF",
  }),
  Object.freeze({
    id: "adi-ltc3895-datasheet",
    url: "https://www.analog.com/media/en/technical-documentation/data-sheets/3895fa.pdf",
    fileName: "adi-ltc3895.datasheet.pdf",
    contentType: "application/pdf",
    kind: "manufacturer_datasheet",
    identityMarker: "LTC3895",
  }),
]);

const FORMAT = "schemagic-power-adi-evidence-capture";
const SCHEMA_VERSION = 1;
const RECEIPT_FILE_NAME = "power-adi-evidence-capture.json";
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const RECEIPT_KEYS = ["capturedAt", "format", "schemaVersion", "sources"];
const SOURCE_KEYS = ["byteLength", "contentHash", "contentType", "fileName", "finalUrl", "id", "kind", "sourceUrl"];

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label}:object_required`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label}:exact_keys_required`);
  }
}

function isInsideRepository(path) {
  const token = relative(REPOSITORY_ROOT, path);
  return token === "" || (!token.startsWith("..") && !isAbsolute(token));
}

function normalizedContentType(value) {
  return String(value ?? "").split(";", 1)[0].trim().toLowerCase();
}

function isRfc3339Instant(value) {
  return typeof value === "string" && RFC3339_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function assertCanonicalFinalUrl(source, finalUrl) {
  const original = new URL(source.url);
  let resolved;
  try {
    resolved = new URL(finalUrl);
  } catch {
    throw new TypeError(`${source.id}:final_url_invalid`);
  }
  if (resolved.protocol !== "https:") throw new TypeError(`${source.id}:final_url_not_https`);
  if (resolved.host !== "www.analog.com" || resolved.username !== "" || resolved.password !== "") {
    throw new TypeError(`${source.id}:final_url_not_official_analog_devices`);
  }
  if (resolved.pathname !== original.pathname || resolved.search !== "" || resolved.hash !== "") {
    throw new TypeError(`${source.id}:final_url_path_mismatch`);
  }
}

function assertSourceBytes(source, bytes, contentType, finalUrl) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError(`${source.id}:bytes_required`);
  if (bytes.byteLength < 1024) throw new TypeError(`${source.id}:source_too_small`);
  if (normalizedContentType(contentType) !== source.contentType) throw new TypeError(`${source.id}:content_type_mismatch`);
  assertCanonicalFinalUrl(source, finalUrl);
  if (source.kind === "manufacturer_datasheet") {
    const header = new TextDecoder("ascii").decode(bytes.subarray(0, 8));
    const trailer = new TextDecoder("ascii").decode(bytes.subarray(Math.max(0, bytes.byteLength - 2048)));
    const document = new TextDecoder("latin1").decode(bytes);
    if (!header.startsWith("%PDF-") || !trailer.includes("%%EOF")) throw new TypeError(`${source.id}:pdf_structure_mismatch`);
    if (!document.includes(source.identityMarker)) throw new TypeError(`${source.id}:pdf_identity_mismatch`);
    return;
  }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  for (const marker of ["<html", "Analog Devices", source.identityMarker]) {
    if (!html.includes(marker)) throw new TypeError(`${source.id}:html_identity_mismatch:${marker}`);
  }
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function captureEntry(source, bytes, contentType, finalUrl) {
  assertSourceBytes(source, bytes, contentType, finalUrl);
  return {
    byteLength: bytes.byteLength,
    contentHash: sha256(bytes),
    contentType: source.contentType,
    fileName: source.fileName,
    finalUrl,
    id: source.id,
    kind: source.kind,
    sourceUrl: source.url,
  };
}

export function createPowerAdiEvidenceReceipt(captures, capturedAt) {
  if (!Array.isArray(captures) || captures.length !== POWER_ADI_EVIDENCE_SOURCES.length) {
    throw new TypeError("capture_set:exact_source_count_required");
  }
  if (!isRfc3339Instant(capturedAt)) throw new TypeError("capturedAt:rfc3339_required");
  const byId = new Map(captures.map((capture) => [capture.id, capture]));
  const sources = POWER_ADI_EVIDENCE_SOURCES.map((source) => {
    const capture = byId.get(source.id);
    if (capture === undefined) throw new TypeError(`${source.id}:capture_missing`);
    return captureEntry(source, capture.bytes, capture.contentType, capture.finalUrl);
  });
  if (byId.size !== sources.length) throw new TypeError("capture_set:duplicate_or_unknown_source");
  return { capturedAt, format: FORMAT, schemaVersion: SCHEMA_VERSION, sources };
}

export async function verifyPowerAdiEvidenceReceipt(receiptPath) {
  const absoluteReceipt = resolve(receiptPath);
  const parsed = JSON.parse(await readFile(absoluteReceipt, "utf8"));
  exactKeys(parsed, RECEIPT_KEYS, "receipt");
  if (parsed.format !== FORMAT || parsed.schemaVersion !== SCHEMA_VERSION) throw new TypeError("receipt:unsupported_contract");
  if (!isRfc3339Instant(parsed.capturedAt)) throw new TypeError("receipt:invalid_capturedAt");
  if (!Array.isArray(parsed.sources) || parsed.sources.length !== POWER_ADI_EVIDENCE_SOURCES.length) {
    throw new TypeError("receipt:exact_source_count_required");
  }
  const verified = [];
  for (let index = 0; index < POWER_ADI_EVIDENCE_SOURCES.length; index += 1) {
    const expected = POWER_ADI_EVIDENCE_SOURCES[index];
    const declared = parsed.sources[index];
    exactKeys(declared, SOURCE_KEYS, `receipt.sources.${index}`);
    if (declared.id !== expected.id || declared.sourceUrl !== expected.url || declared.fileName !== expected.fileName || declared.kind !== expected.kind) {
      throw new TypeError(`${expected.id}:receipt_identity_mismatch`);
    }
    if (declared.contentType !== expected.contentType || !HASH_PATTERN.test(declared.contentHash) || !Number.isSafeInteger(declared.byteLength) || declared.byteLength < 1024) {
      throw new TypeError(`${expected.id}:receipt_metadata_mismatch`);
    }
    const bytes = await readFile(resolve(dirname(absoluteReceipt), expected.fileName));
    assertSourceBytes(expected, bytes, declared.contentType, declared.finalUrl);
    if (bytes.byteLength !== declared.byteLength || sha256(bytes) !== declared.contentHash) {
      throw new TypeError(`${expected.id}:exact_bytes_mismatch`);
    }
    verified.push({ id: expected.id, contentHash: declared.contentHash, byteLength: declared.byteLength, sourceUrl: expected.url });
  }
  return { status: "verified_exact_bytes", capturedAt: parsed.capturedAt, sources: verified };
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function writeAtomically(path, bytes) {
  const temporary = `${path}.partial`;
  await writeFile(temporary, bytes, { flag: "wx" });
  await rename(temporary, path);
}

export async function capturePowerAdiEvidence({ outputDirectory, fetchImpl = globalThis.fetch, capturedAt = new Date().toISOString() }) {
  if (typeof fetchImpl !== "function") throw new TypeError("capture:fetch_required");
  const output = resolve(outputDirectory);
  if (await pathExists(output)) throw new TypeError("capture:output_directory_must_not_exist");
  const canonicalParent = await realpath(dirname(output));
  if (isInsideRepository(resolve(canonicalParent, basename(output)))) throw new TypeError("capture:repository_output_forbidden");
  const captures = [];
  for (const source of POWER_ADI_EVIDENCE_SOURCES) {
    let response;
    try {
      response = await fetchImpl(source.url, {
        redirect: "follow",
        headers: { accept: source.contentType },
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new TypeError(`${source.id}:official_transport_unavailable`);
    }
    if (!response?.ok) {
      const status = Number.isInteger(response?.status) ? response.status : "unavailable";
      throw new TypeError(`${source.id}:official_http_${status}`);
    }
    let bytes;
    let contentType;
    let finalUrl;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
      contentType = response.headers.get("content-type");
      finalUrl = response.url || source.url;
    } catch {
      throw new TypeError(`${source.id}:official_transport_unavailable`);
    }
    assertSourceBytes(source, bytes, contentType, finalUrl);
    captures.push({ id: source.id, bytes, contentType, finalUrl });
  }
  const receipt = createPowerAdiEvidenceReceipt(captures, capturedAt);
  await mkdir(output);
  for (const capture of captures) {
    const source = POWER_ADI_EVIDENCE_SOURCES.find((candidate) => candidate.id === capture.id);
    await writeAtomically(resolve(output, source.fileName), capture.bytes);
  }
  await writeAtomically(resolve(output, RECEIPT_FILE_NAME), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

function usage() {
  return "usage: node scripts/capture-adi-evidence.mjs capture <new-output-directory> | verify <receipt.json>";
}

async function main(argv) {
  const [command, path, ...extra] = argv;
  if (extra.length > 0 || (command !== "capture" && command !== "verify") || typeof path !== "string") throw new TypeError(usage());
  const result = command === "capture"
    ? await capturePowerAdiEvidence({ outputDirectory: path })
    : await verifyPowerAdiEvidenceReceipt(path);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
