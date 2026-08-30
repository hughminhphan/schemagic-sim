import { canonicalJsonForVersionedSourcing, sha256HexForVersionedSourcing } from "./canonical";
import type { ManufacturerId } from "./ids";
import type { AllowedLifecycleStatus, PackagingType } from "./policy";
import type { Sha256ContentHash } from "./v2";

export const SOURCING_REQUEST_PACKET_SCHEMA_VERSION_V1 = 1 as const;
export const SOURCING_REQUEST_PACKET_MAX_BYTES_V1 = 256 * 1024;
export const SOURCING_REQUEST_PACKET_MAX_BOM_LINES_V1 = 256;
export const SOURCING_REQUEST_PACKET_MAX_TEXT_BYTES_V1 = 256;
export const SOURCING_REQUEST_PACKET_MAX_BUILD_QUANTITY_V1 = 1_000_000;
export const SOURCING_REQUEST_PACKET_MAX_QUANTITY_PER_ASSEMBLY_V1 = 1_000_000;

const MAX_TOTAL_REQUIRED_UNITS = 1_000_000_000_000;
const MAXIMUM_LEAD_TIME_DAYS = 36_500;
const MAXIMUM_SNAPSHOT_AGE_SECONDS = 31_536_000;
const HASH = /^sha256:[0-9a-f]{64}$/;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/;
const MANUFACTURER_ID = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const CURRENCY = /^[A-Z]{3}$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const ALLOWED_LIFECYCLE = ["active", "last_time_buy", "nrnd", "unknown"] as const satisfies readonly AllowedLifecycleStatus[];
const PACKAGING = ["bulk", "cut_tape", "reel", "tray", "tube"] as const satisfies readonly PackagingType[];

export type SourcingRequestPacketErrorCodeV1 =
  | "invalid_input"
  | "invalid_packet"
  | "resource_limit"
  | "authority_mismatch";

export class SourcingRequestPacketErrorV1 extends Error {
  readonly code: SourcingRequestPacketErrorCodeV1;

  constructor(code: SourcingRequestPacketErrorCodeV1) {
    super(code === "resource_limit"
      ? "Sourcing request packet exceeds a fixed resource limit"
      : code === "authority_mismatch"
        ? "Sourcing request packet does not match the exact authorized request"
        : code === "invalid_packet"
          ? "Sourcing request packet is not exact canonical V1 data"
          : "Sourcing request packet input is invalid");
    this.name = "SourcingRequestPacketErrorV1";
    this.code = code;
  }
}

export interface SourcingRequestDesignResultRefV1 {
  readonly schemaVersion: 2;
  readonly designResultContentHash: Sha256ContentHash;
  readonly requestHash: Sha256ContentHash;
  readonly libraryVersion: string;
  readonly libraryContentHash: Sha256ContentHash;
}

export interface SourcingRequestCandidateRefV1 {
  readonly id: `candidate:v2:${Sha256ContentHash}`;
  readonly recipeId: string;
}

export interface SourcingRequestBomLineV1 {
  readonly lineId: string;
  readonly manufacturerId: ManufacturerId;
  readonly manufacturerPartNumber: string;
  readonly quantityPerAssembly: number;
}

/** Provider-neutral constraints only. It intentionally has no distributor list or selection mode. */
export interface SourcingRequestPolicyV1 {
  readonly schemaVersion: 1;
  readonly region: string;
  readonly currency: string;
  readonly allowedLifecycle: readonly AllowedLifecycleStatus[];
  readonly minimumStock?: number;
  readonly maximumLeadTimeDays?: number;
  readonly allowBackorder: boolean;
  readonly allowMarketplace: boolean;
  readonly packaging?: readonly PackagingType[];
  readonly maximumSnapshotAgeSeconds: number;
}

export interface SourcingRequestPacketInputV1 {
  readonly designResultRef: SourcingRequestDesignResultRefV1;
  readonly candidateRef: SourcingRequestCandidateRefV1;
  readonly bomLines: readonly SourcingRequestBomLineV1[];
  readonly buildQuantity: number;
  readonly policy: SourcingRequestPolicyV1;
}

export interface SourcingRequestPacketV1 extends SourcingRequestPacketInputV1 {
  readonly format: "schemagic-sourcing-request-packet";
  readonly schemaVersion: typeof SOURCING_REQUEST_PACKET_SCHEMA_VERSION_V1;
  readonly boundaries: {
    readonly purpose: "provider_neutral_sourcing_request";
    readonly offers: "not_included";
    readonly providerUrls: "not_included";
    readonly providerSelection: "not_included";
    readonly credentials: "not_included";
    readonly commercialObservations: "not_included";
    readonly providerAccess: "not_authorized";
  };
  readonly contentHash: Sha256ContentHash;
}

type UnknownRecord = Record<string, unknown>;

function fail(code: SourcingRequestPacketErrorCodeV1): never {
  throw new SourcingRequestPacketErrorV1(code);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function record(value: unknown): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("invalid_input");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail("invalid_input");
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") fail("invalid_input");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) fail("invalid_input");
  }
  return value as UnknownRecord;
}

function exactKeys(value: UnknownRecord, required: readonly string[], optional: readonly string[] = []): void {
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) fail("invalid_input");
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(value, key)) fail("invalid_input");
  for (const key of optional) {
    if (Object.prototype.hasOwnProperty.call(value, key) && value[key] === undefined) fail("invalid_input");
  }
}

function array(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) fail("invalid_input");
  if (value.length > maximum) fail("resource_limit");
  const keys = Object.keys(value);
  if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) fail("invalid_input");
  return value;
}

function text(value: unknown, maximumBytes = SOURCING_REQUEST_PACKET_MAX_TEXT_BYTES_V1): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim() || value !== value.normalize("NFC") || CONTROL.test(value)) fail("invalid_input");
  if (byteLength(value) > maximumBytes) fail("resource_limit");
  return value;
}

function hash(value: unknown): Sha256ContentHash {
  if (typeof value !== "string" || !HASH.test(value)) fail("invalid_input");
  return value as Sha256ContentHash;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) fail("invalid_input");
  return value as number;
}

function boundedNumber(value: unknown, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Object.is(value, -0) || value < 0 || value > maximum) fail("invalid_input");
  return value;
}

function sortedUniqueMembers<T extends string>(value: unknown, members: readonly T[]): T[] {
  const values = array(value, members.length).map((entry) => {
    if (typeof entry !== "string" || !members.includes(entry as T)) fail("invalid_input");
    return entry as T;
  });
  if (values.length === 0 || new Set(values).size !== values.length) fail("invalid_input");
  return [...values].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseDesignResultRef(value: unknown): SourcingRequestDesignResultRefV1 {
  const ref = record(value);
  exactKeys(ref, ["schemaVersion", "designResultContentHash", "requestHash", "libraryVersion", "libraryContentHash"]);
  if (ref.schemaVersion !== 2) fail("invalid_input");
  return {
    schemaVersion: 2,
    designResultContentHash: hash(ref.designResultContentHash),
    requestHash: hash(ref.requestHash),
    libraryVersion: text(ref.libraryVersion, 128),
    libraryContentHash: hash(ref.libraryContentHash),
  };
}

function parseCandidateRef(value: unknown): SourcingRequestCandidateRefV1 {
  const ref = record(value);
  exactKeys(ref, ["id", "recipeId"]);
  if (typeof ref.id !== "string" || !CANDIDATE_ID.test(ref.id)) fail("invalid_input");
  return { id: ref.id as SourcingRequestCandidateRefV1["id"], recipeId: text(ref.recipeId) };
}

function parseBomLines(value: unknown): SourcingRequestBomLineV1[] {
  const lines = array(value, SOURCING_REQUEST_PACKET_MAX_BOM_LINES_V1).map((entry) => {
    const line = record(entry);
    exactKeys(line, ["lineId", "manufacturerId", "manufacturerPartNumber", "quantityPerAssembly"]);
    const manufacturerId = text(line.manufacturerId, 64);
    if (!MANUFACTURER_ID.test(manufacturerId)) fail("invalid_input");
    return {
      lineId: text(line.lineId),
      manufacturerId,
      manufacturerPartNumber: text(line.manufacturerPartNumber),
      quantityPerAssembly: boundedInteger(line.quantityPerAssembly, 1, SOURCING_REQUEST_PACKET_MAX_QUANTITY_PER_ASSEMBLY_V1),
    };
  });
  if (lines.length === 0 || new Set(lines.map((line) => line.lineId)).size !== lines.length) fail("invalid_input");
  return lines.sort((left, right) => compareText(left.lineId, right.lineId));
}

function parsePolicy(value: unknown): SourcingRequestPolicyV1 {
  const policy = record(value);
  exactKeys(policy, [
    "schemaVersion", "region", "currency", "allowedLifecycle", "allowBackorder",
    "allowMarketplace", "maximumSnapshotAgeSeconds",
  ], ["minimumStock", "maximumLeadTimeDays", "packaging"]);
  if (policy.schemaVersion !== 1 || typeof policy.allowBackorder !== "boolean" || typeof policy.allowMarketplace !== "boolean") fail("invalid_input");
  const currency = text(policy.currency, 3);
  if (!CURRENCY.test(currency)) fail("invalid_input");
  const minimumStock = policy.minimumStock === undefined
    ? undefined
    : boundedInteger(policy.minimumStock, 0, MAX_TOTAL_REQUIRED_UNITS);
  const maximumLeadTimeDays = policy.maximumLeadTimeDays === undefined
    ? undefined
    : boundedNumber(policy.maximumLeadTimeDays, MAXIMUM_LEAD_TIME_DAYS);
  const packaging = policy.packaging === undefined
    ? undefined
    : sortedUniqueMembers(policy.packaging, PACKAGING);
  return {
    schemaVersion: 1,
    region: text(policy.region, 128),
    currency,
    allowedLifecycle: sortedUniqueMembers(policy.allowedLifecycle, ALLOWED_LIFECYCLE),
    ...(minimumStock === undefined ? {} : { minimumStock }),
    ...(maximumLeadTimeDays === undefined ? {} : { maximumLeadTimeDays }),
    allowBackorder: policy.allowBackorder,
    allowMarketplace: policy.allowMarketplace,
    ...(packaging === undefined ? {} : { packaging }),
    maximumSnapshotAgeSeconds: boundedInteger(policy.maximumSnapshotAgeSeconds, 1, MAXIMUM_SNAPSHOT_AGE_SECONDS),
  };
}

function normalizeInput(value: unknown): SourcingRequestPacketInputV1 {
  const input = record(value);
  exactKeys(input, ["designResultRef", "candidateRef", "bomLines", "buildQuantity", "policy"]);
  const buildQuantity = boundedInteger(input.buildQuantity, 1, SOURCING_REQUEST_PACKET_MAX_BUILD_QUANTITY_V1);
  const bomLines = parseBomLines(input.bomLines);
  if (bomLines.some((line) => line.quantityPerAssembly * buildQuantity > MAX_TOTAL_REQUIRED_UNITS)) fail("resource_limit");
  return {
    designResultRef: parseDesignResultRef(input.designResultRef),
    candidateRef: parseCandidateRef(input.candidateRef),
    bomLines,
    buildQuantity,
    policy: parsePolicy(input.policy),
  };
}

function boundaries(): SourcingRequestPacketV1["boundaries"] {
  return {
    purpose: "provider_neutral_sourcing_request",
    offers: "not_included",
    providerUrls: "not_included",
    providerSelection: "not_included",
    credentials: "not_included",
    commercialObservations: "not_included",
    providerAccess: "not_authorized",
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function packetPayload(input: Readonly<SourcingRequestPacketInputV1>): Omit<SourcingRequestPacketV1, "contentHash"> {
  const normalized = normalizeInput(input);
  return {
    format: "schemagic-sourcing-request-packet",
    schemaVersion: SOURCING_REQUEST_PACKET_SCHEMA_VERSION_V1,
    boundaries: boundaries(),
    ...normalized,
  };
}

export function canonicalSourcingRequestPacketPayloadV1(input: Readonly<SourcingRequestPacketInputV1>): string {
  return canonicalJsonForVersionedSourcing(packetPayload(input));
}

export function calculateSourcingRequestPacketContentHashV1(input: Readonly<SourcingRequestPacketInputV1>): Sha256ContentHash {
  return `sha256:${sha256HexForVersionedSourcing(canonicalSourcingRequestPacketPayloadV1(input))}`;
}

export function finalizeSourcingRequestPacketV1(input: Readonly<SourcingRequestPacketInputV1>): SourcingRequestPacketV1 {
  const payload = packetPayload(input);
  const packet: SourcingRequestPacketV1 = {
    ...payload,
    contentHash: `sha256:${sha256HexForVersionedSourcing(canonicalJsonForVersionedSourcing(payload))}`,
  };
  const source = canonicalJsonForVersionedSourcing(packet);
  if (byteLength(source) > SOURCING_REQUEST_PACKET_MAX_BYTES_V1) fail("resource_limit");
  return deepFreeze(packet);
}

export function serializeSourcingRequestPacketV1(input: Readonly<SourcingRequestPacketInputV1>): string {
  return canonicalJsonForVersionedSourcing(finalizeSourcingRequestPacketV1(input));
}

function inputFromWire(value: unknown): { input: SourcingRequestPacketInputV1; contentHash: Sha256ContentHash } {
  const packet = record(value);
  exactKeys(packet, [
    "format", "schemaVersion", "boundaries", "designResultRef", "candidateRef",
    "bomLines", "buildQuantity", "policy", "contentHash",
  ]);
  if (packet.format !== "schemagic-sourcing-request-packet" || packet.schemaVersion !== SOURCING_REQUEST_PACKET_SCHEMA_VERSION_V1) fail("invalid_input");
  const packetBoundaries = record(packet.boundaries);
  exactKeys(packetBoundaries, [
    "purpose", "offers", "providerUrls", "providerSelection", "credentials",
    "commercialObservations", "providerAccess",
  ]);
  if (canonicalJsonForVersionedSourcing(packetBoundaries) !== canonicalJsonForVersionedSourcing(boundaries())) fail("invalid_input");
  return {
    input: normalizeInput({
      designResultRef: packet.designResultRef,
      candidateRef: packet.candidateRef,
      bomLines: packet.bomLines,
      buildQuantity: packet.buildQuantity,
      policy: packet.policy,
    }),
    contentHash: hash(packet.contentHash),
  };
}

/** Parse only exact canonical wire bytes. This establishes integrity, not design-result authority. */
export function parseSourcingRequestPacketV1(source: string): SourcingRequestPacketV1 {
  if (typeof source !== "string") fail("invalid_packet");
  if (byteLength(source) > SOURCING_REQUEST_PACKET_MAX_BYTES_V1) fail("resource_limit");
  let wire: unknown;
  try { wire = JSON.parse(source); }
  catch { fail("invalid_packet"); }
  try {
    const { input, contentHash } = inputFromWire(wire);
    const expected = finalizeSourcingRequestPacketV1(input);
    if (contentHash !== expected.contentHash || source !== canonicalJsonForVersionedSourcing(expected)) fail("invalid_packet");
    return expected;
  } catch (error) {
    if (error instanceof SourcingRequestPacketErrorV1 && error.code === "resource_limit") throw error;
    fail("invalid_packet");
  }
}

/** Regenerate exact bytes from authoritative result/candidate data before accepting a transfer. */
export function verifySourcingRequestPacketV1(
  source: string,
  exactInput: Readonly<SourcingRequestPacketInputV1>,
): SourcingRequestPacketV1 {
  const parsed = parseSourcingRequestPacketV1(source);
  let expected: string;
  try { expected = serializeSourcingRequestPacketV1(exactInput); }
  catch (error) {
    if (error instanceof SourcingRequestPacketErrorV1 && error.code === "resource_limit") throw error;
    fail("invalid_input");
  }
  if (source !== expected) fail("authority_mismatch");
  return parsed;
}
