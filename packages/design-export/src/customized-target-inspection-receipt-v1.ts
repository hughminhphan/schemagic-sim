import type { Sha256ContentHash } from "@opencircuit/circuit-schema";
import {
  DesignParseErrorV2,
  PrimaryPartCustomizedResultParseErrorV1,
  boundedDetachedFrozenDesignV2Value,
  canonicalDesignV2Payload,
  containsUnsafeDesignDisplayCharactersV2,
  designSha256ContentHash,
  detachedFrozenDesignV2Value,
  parsePrimaryPartCustomizedResultSidecarV1,
  serializePrimaryPartCustomizedResultSidecarV1,
  type PrimaryPartCustomizedResultSidecarV1,
} from "@opencircuit/design-schema";
import {
  PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1,
  PrimaryPartCustomizedArtifactErrorV1,
  exportPrimaryPartCustomizedArtifactV1,
  type PrimaryPartCustomizedReplayableArtifactKindV1,
  type PrimaryPartCustomizedReplayableArtifactV1,
} from "./primary-part-customized-artifact-v1";

const FORMAT = "schemagic-customized-target-inspection-receipt" as const;
const SCHEMA_VERSION = 1 as const;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/u;

const ARTIFACT_KINDS = Object.freeze([
  "customized_target_electrical_bom_csv",
  "customized_target_structural_svg",
] as const satisfies readonly PrimaryPartCustomizedReplayableArtifactKindV1[]);

const ARTIFACT_MIME_TYPES = Object.freeze({
  customized_target_electrical_bom_csv: "text/csv;charset=utf-8",
  customized_target_structural_svg: "image/svg+xml;charset=utf-8",
} as const satisfies Readonly<Record<PrimaryPartCustomizedReplayableArtifactKindV1, string>>);

const ARTIFACT_FILENAME_SUFFIXES = Object.freeze({
  customized_target_electrical_bom_csv: "-customized-target-electrical-bom.csv",
  customized_target_structural_svg: "-customized-target-structural-schematic.svg",
} as const satisfies Readonly<Record<PrimaryPartCustomizedReplayableArtifactKindV1, string>>);

/**
 * The embedded sidecar is capped at 3 MiB by Design Schema. One additional MiB
 * is reserved for the fixed receipt envelope and its two compact descriptors.
 */
export const CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1 = 4 * 1024 * 1024;

export interface CustomizedTargetInspectionReceiptArtifactDescriptorV1 {
  readonly kind: PrimaryPartCustomizedReplayableArtifactKindV1;
  readonly filename: string;
  readonly mimeType:
    | "text/csv;charset=utf-8"
    | "image/svg+xml;charset=utf-8";
  readonly utf8ByteLength: number;
  readonly utf8Sha256: Sha256ContentHash;
}

export interface CustomizedTargetInspectionReceiptClaimBoundaryV1 {
  readonly purpose: "inspection_only";
  readonly artifactReplay: "required";
  readonly parseAndSelfHash: "integrity_only";
  readonly installedContextAuthority: "not_conferred";
  readonly ordinaryResultEvidence: "not_evidence";
  readonly eligibilityEvidence: "not_evidence";
  readonly rankingEvidence: "not_evidence";
  readonly selectedPartModel: "not_added";
  readonly simulationData: "not_included";
  readonly commercialAuthority: "not_added";
  readonly attestation: "none";
}

export interface CustomizedTargetInspectionReceiptDraftV1 {
  readonly format: typeof FORMAT;
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>;
  readonly artifacts: readonly Readonly<CustomizedTargetInspectionReceiptArtifactDescriptorV1>[];
  readonly claimBoundary: Readonly<CustomizedTargetInspectionReceiptClaimBoundaryV1>;
}

export interface CustomizedTargetInspectionReceiptV1
  extends CustomizedTargetInspectionReceiptDraftV1 {
  readonly contentHash: Sha256ContentHash;
}

export type CustomizedTargetInspectionReceiptErrorCodeV1 =
  | "invalid_receipt"
  | "noncanonical_serialization"
  | "resource_limit"
  | "artifact_replay_failed"
  | "artifact_descriptor_mismatch";

export class CustomizedTargetInspectionReceiptErrorV1 extends Error {
  readonly code: CustomizedTargetInspectionReceiptErrorCodeV1;
  readonly path: string;

  constructor(code: CustomizedTargetInspectionReceiptErrorCodeV1, path = "") {
    super(`scheMAGIC customized-target inspection receipt was rejected: ${code}${path ? ` at ${path}` : ""}`);
    this.name = "CustomizedTargetInspectionReceiptErrorV1";
    this.code = code;
    this.path = path;
  }
}

function fail(path = ""): never {
  throw new CustomizedTargetInspectionReceiptErrorV1("invalid_receipt", path);
}

function resource(path = ""): never {
  throw new CustomizedTargetInspectionReceiptErrorV1("resource_limit", path);
}

function isResourceError(error: unknown): boolean {
  return (
    error instanceof DesignParseErrorV2 && error.detail.code === "resource_limit"
  ) || (
    error instanceof PrimaryPartCustomizedResultParseErrorV1 && error.code === "resource_limit"
  ) || (
    error instanceof PrimaryPartCustomizedArtifactErrorV1 && error.code === "resource_limit"
  ) || (
    error instanceof CustomizedTargetInspectionReceiptErrorV1 && error.code === "resource_limit"
  );
}

function snapshot(input: unknown): unknown {
  try {
    return boundedDetachedFrozenDesignV2Value(
      input,
      "design_result",
      CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1,
    );
  } catch (error) {
    if (isResourceError(error)) return resource();
    return fail();
  }
}

function record(input: unknown, path: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail(path);
  return input as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length
    || actual.some((key, index) => key !== sortedExpected[index])) return fail(path);
}

function exactHash(input: unknown, path: string): Sha256ContentHash {
  if (typeof input !== "string" || !HASH.test(input)) return fail(path);
  return input as Sha256ContentHash;
}

function positiveArtifactByteLength(input: unknown, path: string): number {
  if (!Number.isSafeInteger(input)
    || (input as number) <= 0
    || (input as number) > PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1) return fail(path);
  return input as number;
}

function exactFilename(
  input: unknown,
  kind: PrimaryPartCustomizedReplayableArtifactKindV1,
  path: string,
): string {
  if (typeof input !== "string"
    || input.length === 0
    || input.length > 256
    || !SAFE_FILENAME.test(input)
    || !input.startsWith("schemagic-")
    || !input.endsWith(ARTIFACT_FILENAME_SUFFIXES[kind])) return fail(path);
  return input;
}

function parseArtifactDescriptor(
  input: unknown,
  kind: PrimaryPartCustomizedReplayableArtifactKindV1,
  index: number,
): CustomizedTargetInspectionReceiptArtifactDescriptorV1 {
  const path = `/artifacts/${index}`;
  const value = record(input, path);
  exactKeys(value, ["kind", "filename", "mimeType", "utf8ByteLength", "utf8Sha256"], path);
  if (value.kind !== kind) return fail(`${path}/kind`);
  const mimeType = ARTIFACT_MIME_TYPES[kind];
  if (value.mimeType !== mimeType) return fail(`${path}/mimeType`);
  return {
    kind,
    filename: exactFilename(value.filename, kind, `${path}/filename`),
    mimeType,
    utf8ByteLength: positiveArtifactByteLength(value.utf8ByteLength, `${path}/utf8ByteLength`),
    utf8Sha256: exactHash(value.utf8Sha256, `${path}/utf8Sha256`),
  };
}

function parseArtifacts(input: unknown): readonly CustomizedTargetInspectionReceiptArtifactDescriptorV1[] {
  if (!Array.isArray(input) || input.length !== ARTIFACT_KINDS.length) return fail("/artifacts");
  return ARTIFACT_KINDS.map((kind, index) => parseArtifactDescriptor(input[index], kind, index));
}

function parseClaimBoundary(input: unknown): CustomizedTargetInspectionReceiptClaimBoundaryV1 {
  const path = "/claimBoundary";
  const value = record(input, path);
  exactKeys(value, [
    "purpose",
    "artifactReplay",
    "parseAndSelfHash",
    "installedContextAuthority",
    "ordinaryResultEvidence",
    "eligibilityEvidence",
    "rankingEvidence",
    "selectedPartModel",
    "simulationData",
    "commercialAuthority",
    "attestation",
  ], path);
  if (value.purpose !== "inspection_only") return fail(`${path}/purpose`);
  if (value.artifactReplay !== "required") return fail(`${path}/artifactReplay`);
  if (value.parseAndSelfHash !== "integrity_only") return fail(`${path}/parseAndSelfHash`);
  if (value.installedContextAuthority !== "not_conferred") {
    return fail(`${path}/installedContextAuthority`);
  }
  if (value.ordinaryResultEvidence !== "not_evidence") {
    return fail(`${path}/ordinaryResultEvidence`);
  }
  if (value.eligibilityEvidence !== "not_evidence") return fail(`${path}/eligibilityEvidence`);
  if (value.rankingEvidence !== "not_evidence") return fail(`${path}/rankingEvidence`);
  if (value.selectedPartModel !== "not_added") return fail(`${path}/selectedPartModel`);
  if (value.simulationData !== "not_included") return fail(`${path}/simulationData`);
  if (value.commercialAuthority !== "not_added") return fail(`${path}/commercialAuthority`);
  if (value.attestation !== "none") return fail(`${path}/attestation`);
  return {
    purpose: "inspection_only",
    artifactReplay: "required",
    parseAndSelfHash: "integrity_only",
    installedContextAuthority: "not_conferred",
    ordinaryResultEvidence: "not_evidence",
    eligibilityEvidence: "not_evidence",
    rankingEvidence: "not_evidence",
    selectedPartModel: "not_added",
    simulationData: "not_included",
    commercialAuthority: "not_added",
    attestation: "none",
  };
}

function parseCustomizedResult(input: unknown): PrimaryPartCustomizedResultSidecarV1 {
  try {
    const parsed = parsePrimaryPartCustomizedResultSidecarV1(input);
    // A portable receipt must contain a sidecar that passes its own bounded
    // canonical serialization contract, not merely its object/hash parser.
    serializePrimaryPartCustomizedResultSidecarV1(parsed);
    return parsed;
  } catch (error) {
    if (isResourceError(error)) return resource("/customizedResult");
    return fail("/customizedResult");
  }
}

export function canonicalCustomizedTargetInspectionReceiptPayloadV1(
  receipt: Readonly<CustomizedTargetInspectionReceiptDraftV1 | CustomizedTargetInspectionReceiptV1>,
): string {
  return canonicalDesignV2Payload(receipt, true);
}

export function calculateCustomizedTargetInspectionReceiptContentHashV1(
  receipt: Readonly<CustomizedTargetInspectionReceiptDraftV1 | CustomizedTargetInspectionReceiptV1>,
): Sha256ContentHash {
  return designSha256ContentHash(canonicalCustomizedTargetInspectionReceiptPayloadV1(receipt));
}

/**
 * Strictly parse the receipt's portable integrity envelope. This does not
 * replay its artifacts and never establishes installed application context.
 */
export function parseCustomizedTargetInspectionReceiptV1(
  input: unknown,
): CustomizedTargetInspectionReceiptV1 {
  const value = record(snapshot(input), "");
  exactKeys(value, [
    "format",
    "schemaVersion",
    "customizedResult",
    "artifacts",
    "claimBoundary",
    "contentHash",
  ], "");
  if (value.format !== FORMAT) return fail("/format");
  if (value.schemaVersion !== SCHEMA_VERSION) return fail("/schemaVersion");

  const parsed: CustomizedTargetInspectionReceiptV1 = {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    customizedResult: parseCustomizedResult(value.customizedResult),
    artifacts: parseArtifacts(value.artifacts),
    claimBoundary: parseClaimBoundary(value.claimBoundary),
    contentHash: exactHash(value.contentHash, "/contentHash"),
  };
  if (parsed.contentHash !== calculateCustomizedTargetInspectionReceiptContentHashV1(parsed)) {
    return fail("/contentHash");
  }
  return detachedFrozenDesignV2Value(parsed);
}

function assertSerializedByteLimit(source: string): void {
  if (source.length > CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1) return resource();
  if (new TextEncoder().encode(source).byteLength
    > CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1) return resource();
}

/** Parse only exact canonical receipt bytes; whitespace/key-order drift fails. */
export function parseCustomizedTargetInspectionReceiptV1Text(
  source: string,
): CustomizedTargetInspectionReceiptV1 {
  if (typeof source !== "string") return fail();
  assertSerializedByteLimit(source);
  if (containsUnsafeDesignDisplayCharactersV2(source)) return fail();
  let input: unknown;
  try {
    input = JSON.parse(source) as unknown;
  } catch {
    return fail();
  }
  const parsed = parseCustomizedTargetInspectionReceiptV1(input);
  if (canonicalDesignV2Payload(parsed) !== source) {
    throw new CustomizedTargetInspectionReceiptErrorV1("noncanonical_serialization");
  }
  return parsed;
}

/** Decode only bounded, well-formed UTF-8 before applying the canonical parser. */
export function parseCustomizedTargetInspectionReceiptV1Bytes(
  bytes: Uint8Array,
): CustomizedTargetInspectionReceiptV1 {
  if (!(bytes instanceof Uint8Array)) return fail();
  let byteLength: number;
  try {
    byteLength = bytes.byteLength;
  } catch {
    return fail();
  }
  if (byteLength > CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1) return resource();
  let source: string;
  try {
    // Preserve a leading BOM as U+FEFF so the canonical text parser rejects it
    // instead of silently accepting different bytes for the same JSON value.
    source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return fail();
  }
  return parseCustomizedTargetInspectionReceiptV1Text(source);
}

/** Emit one canonical UTF-8 JSON representation with no terminal newline. */
export function serializeCustomizedTargetInspectionReceiptV1(
  receipt: Readonly<CustomizedTargetInspectionReceiptV1>,
): string {
  const parsed = parseCustomizedTargetInspectionReceiptV1(receipt);
  const source = canonicalDesignV2Payload(parsed);
  assertSerializedByteLimit(source);
  if (containsUnsafeDesignDisplayCharactersV2(source)) return fail();
  return source;
}

function descriptorFor(
  artifact: Readonly<PrimaryPartCustomizedReplayableArtifactV1>,
): CustomizedTargetInspectionReceiptArtifactDescriptorV1 {
  const bytes = new TextEncoder().encode(artifact.content);
  return {
    kind: artifact.kind,
    filename: artifact.filename,
    mimeType: artifact.mimeType as CustomizedTargetInspectionReceiptArtifactDescriptorV1["mimeType"],
    utf8ByteLength: bytes.byteLength,
    utf8Sha256: designSha256ContentHash(artifact.content),
  };
}

function replayArtifacts(
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
): readonly CustomizedTargetInspectionReceiptArtifactDescriptorV1[] {
  try {
    // Materialize both before comparison so descriptor drift cannot select a
    // narrower replay surface.
    return ARTIFACT_KINDS.map((kind) => descriptorFor(
      exportPrimaryPartCustomizedArtifactV1(customizedResult, kind),
    ));
  } catch (error) {
    if (isResourceError(error)) return resource("/artifacts");
    throw new CustomizedTargetInspectionReceiptErrorV1("artifact_replay_failed", "/artifacts");
  }
}

/**
 * Create a portable receipt by replaying both closed inspection artifacts.
 * This is integrity capture only and does not assert an installed context.
 */
export function createCustomizedTargetInspectionReceiptV1(
  customizedResultInput: Readonly<PrimaryPartCustomizedResultSidecarV1>,
): CustomizedTargetInspectionReceiptV1 {
  const customizedResult = parseCustomizedResult(customizedResultInput);
  const draft: CustomizedTargetInspectionReceiptDraftV1 = {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    customizedResult,
    artifacts: replayArtifacts(customizedResult),
    claimBoundary: {
      purpose: "inspection_only",
      artifactReplay: "required",
      parseAndSelfHash: "integrity_only",
      installedContextAuthority: "not_conferred",
      ordinaryResultEvidence: "not_evidence",
      eligibilityEvidence: "not_evidence",
      rankingEvidence: "not_evidence",
      selectedPartModel: "not_added",
      simulationData: "not_included",
      commercialAuthority: "not_added",
      attestation: "none",
    },
  };
  return parseCustomizedTargetInspectionReceiptV1({
    ...draft,
    contentHash: calculateCustomizedTargetInspectionReceiptContentHashV1(draft),
  });
}

/**
 * Replay both existing customized-target artifacts and exact-compare every
 * descriptor. A successful replay proves deterministic byte association only;
 * it returns no installed-context authority or authority-bearing token.
 */
export function verifyCustomizedTargetInspectionReceiptV1(
  input: unknown,
): CustomizedTargetInspectionReceiptV1 {
  const parsed = parseCustomizedTargetInspectionReceiptV1(input);
  const replayed = replayArtifacts(parsed.customizedResult);
  if (canonicalDesignV2Payload(replayed) !== canonicalDesignV2Payload(parsed.artifacts)) {
    throw new CustomizedTargetInspectionReceiptErrorV1(
      "artifact_descriptor_mismatch",
      "/artifacts",
    );
  }
  return parsed;
}
