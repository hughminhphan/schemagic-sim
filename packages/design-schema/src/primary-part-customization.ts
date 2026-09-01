import {
  canonicalDesignV2Payload,
  containsUnsafeDesignDisplayCharactersV2,
  designSha256ContentHash,
} from "./v2-canonical";
import type { Sha256ContentHash } from "@opencircuit/circuit-schema";
import type { DesignApplication } from "./application";
import type { CandidateIdV2 } from "./v2-types";

const FORMAT = "schemagic-designer-primary-part-customization";
const SCHEMA_VERSION = 1;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/u;
const PROFILE_ID = /^packages\/design-library\/parts\/([a-z][a-z0-9]*(?:[.-][a-z0-9]+)*)\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:[A-Za-z0-9_-]|%[0-9A-F]{2})+\.json$/u;

export const PRIMARY_PART_CUSTOMIZATION_MAX_BYTES = 16 * 1024;

/**
 * Strict transfer contract for an untrusted, pre-generation customization
 * instruction anchored to an exact regenerated source result and candidate.
 * Parsing and hashing do not admit either profile, execute a recipe, create a
 * replacement candidate, or confer production, commercial, or simulation
 * trust. Those checks belong to an exact installed-context evaluator.
 */

export type PrimaryPartCustomizationTransferErrorCode = "invalid_customization" | "resource_limit";

export class PrimaryPartCustomizationTransferError extends Error {
  readonly code: PrimaryPartCustomizationTransferErrorCode;

  constructor(code: PrimaryPartCustomizationTransferErrorCode) {
    super(code === "resource_limit"
      ? "Primary-part customization exceeds the supported transfer limits."
      : "Primary-part customization must be exact canonical JSON.");
    this.name = "PrimaryPartCustomizationTransferError";
    this.code = code;
  }
}

export interface PrimaryPartCustomizationContextV1 {
  readonly libraryVersion: string;
  readonly contextManifestContentHash: Sha256ContentHash;
  readonly catalog: Readonly<{
    version: string;
    contentHash: Sha256ContentHash;
    sourceReleaseContentHash: Sha256ContentHash;
  }>;
  readonly recipe: Readonly<{
    id: string;
    version: string;
    contentHash: Sha256ContentHash;
  }>;
  readonly constraintPolicy: Readonly<{
    id: "production_strict_v1";
    contentHash: Sha256ContentHash;
  }>;
}

export interface PrimaryPartProfileSubstitutionV1 {
  readonly role: "primary";
  readonly sourceProfile: Readonly<{
    profileId: string;
    contentHash: Sha256ContentHash;
  }>;
  readonly targetProfile: Readonly<{
    profileId: string;
    contentHash: Sha256ContentHash;
  }>;
}

export interface PrimaryPartCustomizationDraftV1 {
  readonly format: typeof FORMAT;
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly application: DesignApplication;
  readonly requestHash: Sha256ContentHash;
  readonly requestByteContentHash: Sha256ContentHash;
  readonly sourceResultContentHash: Sha256ContentHash;
  readonly sourceCandidateId: CandidateIdV2;
  readonly context: Readonly<PrimaryPartCustomizationContextV1>;
  readonly substitution: Readonly<PrimaryPartProfileSubstitutionV1>;
}

export interface PrimaryPartCustomizationSidecarV1 extends PrimaryPartCustomizationDraftV1 {
  readonly contentHash: Sha256ContentHash;
}

export interface PrimaryPartCustomizationTransfer {
  readonly sidecar: Readonly<PrimaryPartCustomizationSidecarV1>;
  readonly canonicalText: string;
}

function fail(): never {
  throw new PrimaryPartCustomizationTransferError("invalid_customization");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) fail();
}

function exactString(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 4096
    || new TextEncoder().encode(value).byteLength > 4096
    || containsUnsafeDesignDisplayCharactersV2(value)
  ) fail();
  return value;
}

function exactHash(value: unknown): Sha256ContentHash {
  if (typeof value !== "string" || !HASH.test(value)) fail();
  return value as Sha256ContentHash;
}

function exactCandidateId(value: unknown): CandidateIdV2 {
  if (typeof value !== "string" || !CANDIDATE_ID.test(value)) fail();
  return value as CandidateIdV2;
}

function parseContext(value: unknown): PrimaryPartCustomizationContextV1 {
  const context = record(value);
  exactKeys(context, ["libraryVersion", "contextManifestContentHash", "catalog", "recipe", "constraintPolicy"]);

  const catalog = record(context.catalog);
  exactKeys(catalog, ["version", "contentHash", "sourceReleaseContentHash"]);
  const recipe = record(context.recipe);
  exactKeys(recipe, ["id", "version", "contentHash"]);
  const constraintPolicy = record(context.constraintPolicy);
  exactKeys(constraintPolicy, ["id", "contentHash"]);
  if (constraintPolicy.id !== "production_strict_v1") fail();

  const libraryVersion = exactString(context.libraryVersion);
  const catalogVersion = exactString(catalog.version);
  if (libraryVersion !== catalogVersion) fail();
  return {
    libraryVersion,
    contextManifestContentHash: exactHash(context.contextManifestContentHash),
    catalog: {
      version: catalogVersion,
      contentHash: exactHash(catalog.contentHash),
      sourceReleaseContentHash: exactHash(catalog.sourceReleaseContentHash),
    },
    recipe: {
      id: exactString(recipe.id),
      version: exactString(recipe.version),
      contentHash: exactHash(recipe.contentHash),
    },
    constraintPolicy: {
      id: "production_strict_v1",
      contentHash: exactHash(constraintPolicy.contentHash),
    },
  };
}

function parseSubstitution(value: unknown): PrimaryPartProfileSubstitutionV1 {
  const substitution = record(value);
  exactKeys(substitution, ["role", "sourceProfile", "targetProfile"]);
  if (substitution.role !== "primary") fail();
  const sourceProfile = record(substitution.sourceProfile);
  const targetProfile = record(substitution.targetProfile);
  exactKeys(sourceProfile, ["profileId", "contentHash"]);
  exactKeys(targetProfile, ["profileId", "contentHash"]);
  const sourceProfileId = exactString(sourceProfile.profileId);
  const targetProfileId = exactString(targetProfile.profileId);
  const sourceMatch = PROFILE_ID.exec(sourceProfileId);
  const targetMatch = PROFILE_ID.exec(targetProfileId);
  if (!sourceMatch || !targetMatch || sourceMatch[1] !== targetMatch[1] || sourceProfileId === targetProfileId) fail();
  return {
    role: "primary",
    sourceProfile: { profileId: sourceProfileId, contentHash: exactHash(sourceProfile.contentHash) },
    targetProfile: { profileId: targetProfileId, contentHash: exactHash(targetProfile.contentHash) },
  };
}

function parseDraft(value: unknown): PrimaryPartCustomizationDraftV1 {
  const draft = record(value);
  exactKeys(draft, ["format", "schemaVersion", "application", "requestHash", "requestByteContentHash", "sourceResultContentHash", "sourceCandidateId", "context", "substitution"]);
  if (
    draft.format !== FORMAT
    || draft.schemaVersion !== SCHEMA_VERSION
    || (draft.application !== "motor.brushed-dc" && draft.application !== "power.buck")
  ) fail();
  return {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    application: draft.application,
    requestHash: exactHash(draft.requestHash),
    requestByteContentHash: exactHash(draft.requestByteContentHash),
    sourceResultContentHash: exactHash(draft.sourceResultContentHash),
    sourceCandidateId: exactCandidateId(draft.sourceCandidateId),
    context: parseContext(draft.context),
    substitution: parseSubstitution(draft.substitution),
  };
}

function parseSidecar(value: unknown): PrimaryPartCustomizationSidecarV1 {
  const sidecar = record(value);
  exactKeys(sidecar, ["format", "schemaVersion", "application", "requestHash", "requestByteContentHash", "sourceResultContentHash", "sourceCandidateId", "context", "substitution", "contentHash"]);
  const draft = parseDraft({
    format: sidecar.format,
    schemaVersion: sidecar.schemaVersion,
    application: sidecar.application,
    requestHash: sidecar.requestHash,
    requestByteContentHash: sidecar.requestByteContentHash,
    sourceResultContentHash: sidecar.sourceResultContentHash,
    sourceCandidateId: sidecar.sourceCandidateId,
    context: sidecar.context,
    substitution: sidecar.substitution,
  });
  const contentHash = exactHash(sidecar.contentHash);
  if (contentHash !== calculatePrimaryPartCustomizationContentHash(draft)) fail();
  return Object.freeze({
    ...draft,
    context: Object.freeze({
      ...draft.context,
      catalog: Object.freeze({ ...draft.context.catalog }),
      recipe: Object.freeze({ ...draft.context.recipe }),
      constraintPolicy: Object.freeze({ ...draft.context.constraintPolicy }),
    }),
    substitution: Object.freeze({
      ...draft.substitution,
      sourceProfile: Object.freeze({ ...draft.substitution.sourceProfile }),
      targetProfile: Object.freeze({ ...draft.substitution.targetProfile }),
    }),
    contentHash,
  });
}

export function canonicalPrimaryPartCustomizationPayload(
  sidecar: Readonly<PrimaryPartCustomizationDraftV1 | PrimaryPartCustomizationSidecarV1>,
): string {
  return canonicalDesignV2Payload(sidecar, true);
}

export function calculatePrimaryPartCustomizationContentHash(
  sidecar: Readonly<PrimaryPartCustomizationDraftV1 | PrimaryPartCustomizationSidecarV1>,
): Sha256ContentHash {
  return designSha256ContentHash(canonicalPrimaryPartCustomizationPayload(sidecar));
}

export function createPrimaryPartCustomizationSidecarV1(
  input: Readonly<PrimaryPartCustomizationDraftV1>,
): PrimaryPartCustomizationSidecarV1 {
  const draft = parseDraft(input);
  const sidecar = parseSidecar({ ...draft, contentHash: calculatePrimaryPartCustomizationContentHash(draft) });
  if (new TextEncoder().encode(canonicalDesignV2Payload(sidecar)).byteLength > PRIMARY_PART_CUSTOMIZATION_MAX_BYTES) {
    throw new PrimaryPartCustomizationTransferError("resource_limit");
  }
  return sidecar;
}

export function serializePrimaryPartCustomizationSidecarV1(
  sidecar: Readonly<PrimaryPartCustomizationSidecarV1>,
): string {
  const parsed = parseSidecar(sidecar);
  const source = canonicalDesignV2Payload(parsed);
  if (new TextEncoder().encode(source).byteLength > PRIMARY_PART_CUSTOMIZATION_MAX_BYTES) {
    throw new PrimaryPartCustomizationTransferError("resource_limit");
  }
  return source;
}

export function serializePrimaryPartCustomizationSidecarV1Bytes(
  sidecar: Readonly<PrimaryPartCustomizationSidecarV1>,
): Uint8Array {
  return new TextEncoder().encode(serializePrimaryPartCustomizationSidecarV1(sidecar));
}

export function parsePrimaryPartCustomizationSidecarV1Text(source: string): PrimaryPartCustomizationTransfer {
  if (
    source.length > PRIMARY_PART_CUSTOMIZATION_MAX_BYTES
    || new TextEncoder().encode(source).byteLength > PRIMARY_PART_CUSTOMIZATION_MAX_BYTES
  ) {
    throw new PrimaryPartCustomizationTransferError("resource_limit");
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    fail();
  }
  const sidecar = parseSidecar(value);
  const canonicalText = serializePrimaryPartCustomizationSidecarV1(sidecar);
  if (source !== canonicalText) fail();
  return Object.freeze({ sidecar, canonicalText });
}

export function parsePrimaryPartCustomizationSidecarV1Bytes(bytes: Uint8Array): PrimaryPartCustomizationTransfer {
  if (bytes.byteLength > PRIMARY_PART_CUSTOMIZATION_MAX_BYTES) {
    throw new PrimaryPartCustomizationTransferError("resource_limit");
  }
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail();
  }
  const canonicalBytes = new TextEncoder().encode(source);
  if (canonicalBytes.byteLength !== bytes.byteLength || canonicalBytes.some((byte, index) => byte !== bytes[index])) fail();
  return parsePrimaryPartCustomizationSidecarV1Text(source);
}
