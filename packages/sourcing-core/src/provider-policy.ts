import type {
  DistributorId,
  ProviderPolicyRefV2,
  Sha256ContentHash,
  SnapshotPersistence,
} from "@opencircuit/sourcing-schema";
import { createHash } from "node:crypto";

export const PROVIDER_POLICY_SCHEMA_VERSION = 1 as const;

export type ProviderPolicyState = "disabled_pending_approval" | "enabled";
export type ProviderApprovalState = "pending" | "approved";
export type ProviderRateLimitState = "unconfigured" | "configured";
export type ProviderAvailability = "disabled_pending_approval" | "enabled";
export type ProviderPolicyExecutionModeV2 = "public_hosted" | "self_hosted";

export type ProviderPolicyOperationPermissionCodeV2 =
  | "policy_disabled"
  | "authorization_not_approved"
  | "approval_reference_invalid"
  | "rate_limit_invalid"
  | "lookup_scope_invalid"
  | "lookup_timeout_invalid"
  | "cache_policy_invalid"
  | "deletion_policy_invalid"
  | "user_local_retention_unapproved"
  | "export_retention_unapproved"
  | "public_share_retention_unapproved"
  | "attribution_invalid"
  | "execution_mode_invalid"
  | "execution_mode_unavailable";

export interface ProviderPolicyOperationPermissionIssueV2 {
  code: ProviderPolicyOperationPermissionCodeV2;
  path: string;
  message: string;
}

export interface ProviderPolicyManifest {
  schemaVersion: typeof PROVIDER_POLICY_SCHEMA_VERSION;
  policyId: string;
  provider: DistributorId;
  displayName: string;
  providerDocumentationUrl: string;
  state: ProviderPolicyState;
  authorization: {
    mode: "oauth2" | "api_key";
    credentialLocation: "server_only";
    approval: ProviderApprovalState;
    approvalReference?: string;
  };
  lookup: {
    exactMpnOnly: true;
    maximumPartsPerRequest: number;
    bulkCaptureAllowed: false;
    timeoutMilliseconds: number;
  };
  rateLimit: {
    state: ProviderRateLimitState;
    requestsPerMinute?: number;
  };
  cache: {
    maximumTtlSeconds: number;
    staleIfErrorSeconds: number;
  };
  attribution: {
    required: boolean;
    label: string;
  };
  persistence: {
    allowedSnapshotPersistence: readonly SnapshotPersistence[];
    browserStorageAllowed: boolean;
    publicShareAllowed: boolean;
    exportAllowed: boolean;
    deleteAfterSeconds: number;
  };
  availability: {
    publicHosted: ProviderAvailability;
    selfHosted: ProviderAvailability;
  };
  notes: readonly string[];
}

export const PROVIDER_POLICY_SCHEMA_VERSION_V2 = 2 as const;

export type ProviderPolicyManifestV1 = ProviderPolicyManifest;

export type ProviderPolicyContentHashV2 = Sha256ContentHash;
export type { ProviderPolicyRefV2 } from "@opencircuit/sourcing-schema";

export interface ProviderPolicyManifestV2
  extends Omit<ProviderPolicyManifestV1, "schemaVersion" | "persistence"> {
  format: "schemagic-provider-policy";
  schemaVersion: typeof PROVIDER_POLICY_SCHEMA_VERSION_V2;
  version: string;
  persistence: ProviderPolicyManifestV1["persistence"] & {
    userLocalRetention: "forbidden" | "perpetual_approved";
    externalExportRetention:
      | "forbidden"
      | "until_delete_after"
      | "perpetual_approved";
  };
  contentHash: ProviderPolicyContentHashV2;
}

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const POLICY_V2_KEYS = [
  "format", "schemaVersion", "version", "policyId", "provider", "displayName",
  "providerDocumentationUrl", "state", "authorization", "lookup", "rateLimit",
  "cache", "attribution", "persistence", "availability", "notes", "contentHash",
] as const;
const AUTHORIZATION_KEYS = ["mode", "credentialLocation", "approval", "approvalReference"] as const;
const LOOKUP_KEYS = ["exactMpnOnly", "maximumPartsPerRequest", "bulkCaptureAllowed", "timeoutMilliseconds"] as const;
const RATE_LIMIT_KEYS = ["state", "requestsPerMinute"] as const;
const CACHE_KEYS = ["maximumTtlSeconds", "staleIfErrorSeconds"] as const;
const ATTRIBUTION_KEYS = ["required", "label"] as const;
const PERSISTENCE_V2_KEYS = [
  "allowedSnapshotPersistence", "browserStorageAllowed", "publicShareAllowed",
  "exportAllowed", "deleteAfterSeconds", "userLocalRetention", "externalExportRetention",
] as const;
const AVAILABILITY_KEYS = ["publicHosted", "selfHosted"] as const;
const APPROVAL_REFERENCE_MAX_CODE_UNITS = 512;
const APPROVAL_REFERENCE_CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  input: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) throw new Error(`${path}${key}: Unknown key`);
  }
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path}: Must be an object`);
  return value;
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${path}: Must be a non-empty string`);
  return value;
}

function isValidRecordedApprovalReference(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= APPROVAL_REFERENCE_MAX_CODE_UNITS
    && value === value.trim()
    && !APPROVAL_REFERENCE_CONTROL_PATTERN.test(value);
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path}: Must be boolean`);
  return value;
}

function requireSafeInteger(value: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${path}: Must be a safe integer greater than or equal to ${minimum}`);
  }
  return value as number;
}

function requireMember<T extends string>(value: unknown, members: readonly T[], path: string): T {
  if (typeof value !== "string" || !members.includes(value as T)) {
    throw new Error(`${path}: Unsupported value`);
  }
  return value as T;
}

function canonicalJson(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical provider policy cannot contain a non-finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (isRecord(value)) {
    const result: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) {
      const nested = value[key];
      if (nested === undefined) throw new Error(`Canonical provider policy cannot contain undefined at ${key}`);
      result[key] = canonicalJson(nested);
    }
    return result;
  }
  throw new Error(`Canonical provider policy cannot contain ${typeof value}`);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortedUniqueStrings(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${path}: Must be an array of strings`);
  }
  const copy = [...value] as string[];
  const sorted = [...copy].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  if (new Set(copy).size !== copy.length || copy.some((entry, index) => entry !== sorted[index])) {
    throw new Error(`${path}: Must be code-unit sorted and unique`);
  }
  return copy;
}

export function canonicalProviderPolicyManifestV2Payload(
  policy: Omit<ProviderPolicyManifestV2, "contentHash"> | ProviderPolicyManifestV2,
): string {
  const { contentHash: _contentHash, ...payload } = policy as ProviderPolicyManifestV2;
  return JSON.stringify(canonicalJson(payload));
}

export function calculateProviderPolicyManifestV2ContentHash(
  policy: Omit<ProviderPolicyManifestV2, "contentHash"> | ProviderPolicyManifestV2,
): ProviderPolicyContentHashV2 {
  return `sha256:${createHash("sha256").update(canonicalProviderPolicyManifestV2Payload(policy), "utf8").digest("hex")}`;
}

export function parseProviderPolicyManifestV2(input: unknown): ProviderPolicyManifestV2 {
  const policy = requireRecord(input, "policy");
  assertExactKeys(policy, POLICY_V2_KEYS, "policy.");
  if (policy.format !== "schemagic-provider-policy") throw new Error("policy.format: Unsupported format");
  if (policy.schemaVersion !== PROVIDER_POLICY_SCHEMA_VERSION_V2) throw new Error("policy.schemaVersion: Must equal 2");
  requireNonEmptyString(policy.version, "policy.version");
  requireNonEmptyString(policy.policyId, "policy.policyId");
  requireNonEmptyString(policy.provider, "policy.provider");
  requireNonEmptyString(policy.displayName, "policy.displayName");
  requireNonEmptyString(policy.providerDocumentationUrl, "policy.providerDocumentationUrl");
  requireMember(policy.state, ["disabled_pending_approval", "enabled"], "policy.state");

  const authorization = requireRecord(policy.authorization, "policy.authorization");
  assertExactKeys(authorization, AUTHORIZATION_KEYS, "policy.authorization.");
  requireMember(authorization.mode, ["oauth2", "api_key"], "policy.authorization.mode");
  if (authorization.credentialLocation !== "server_only") throw new Error("policy.authorization.credentialLocation: Must equal server_only");
  requireMember(authorization.approval, ["pending", "approved"], "policy.authorization.approval");
  if (authorization.approvalReference !== undefined && typeof authorization.approvalReference !== "string") {
    throw new Error("policy.authorization.approvalReference: Must be a string when present");
  }

  const lookup = requireRecord(policy.lookup, "policy.lookup");
  assertExactKeys(lookup, LOOKUP_KEYS, "policy.lookup.");
  if (lookup.exactMpnOnly !== true) throw new Error("policy.lookup.exactMpnOnly: Must equal true");
  requireSafeInteger(lookup.maximumPartsPerRequest, "policy.lookup.maximumPartsPerRequest", 1);
  if (lookup.bulkCaptureAllowed !== false) throw new Error("policy.lookup.bulkCaptureAllowed: Must equal false");
  requireSafeInteger(lookup.timeoutMilliseconds, "policy.lookup.timeoutMilliseconds", 1);

  const rateLimit = requireRecord(policy.rateLimit, "policy.rateLimit");
  assertExactKeys(rateLimit, RATE_LIMIT_KEYS, "policy.rateLimit.");
  requireMember(rateLimit.state, ["unconfigured", "configured"], "policy.rateLimit.state");
  if (rateLimit.requestsPerMinute !== undefined) requireSafeInteger(rateLimit.requestsPerMinute, "policy.rateLimit.requestsPerMinute", 1);
  if (rateLimit.state === "configured" && rateLimit.requestsPerMinute === undefined) {
    throw new Error("policy.rateLimit.requestsPerMinute: Required when configured");
  }
  if (rateLimit.state === "unconfigured" && rateLimit.requestsPerMinute !== undefined) {
    throw new Error("policy.rateLimit.requestsPerMinute: Forbidden when unconfigured");
  }

  const cache = requireRecord(policy.cache, "policy.cache");
  assertExactKeys(cache, CACHE_KEYS, "policy.cache.");
  requireSafeInteger(cache.maximumTtlSeconds, "policy.cache.maximumTtlSeconds");
  requireSafeInteger(cache.staleIfErrorSeconds, "policy.cache.staleIfErrorSeconds");

  const attribution = requireRecord(policy.attribution, "policy.attribution");
  assertExactKeys(attribution, ATTRIBUTION_KEYS, "policy.attribution.");
  requireBoolean(attribution.required, "policy.attribution.required");
  requireNonEmptyString(attribution.label, "policy.attribution.label");

  const persistence = requireRecord(policy.persistence, "policy.persistence");
  assertExactKeys(persistence, PERSISTENCE_V2_KEYS, "policy.persistence.");
  const persistences = sortedUniqueStrings(persistence.allowedSnapshotPersistence, "policy.persistence.allowedSnapshotPersistence");
  for (const value of persistences) requireMember(value, ["ephemeral", "user_local", "exportable"], "policy.persistence.allowedSnapshotPersistence");
  requireBoolean(persistence.browserStorageAllowed, "policy.persistence.browserStorageAllowed");
  requireBoolean(persistence.publicShareAllowed, "policy.persistence.publicShareAllowed");
  requireBoolean(persistence.exportAllowed, "policy.persistence.exportAllowed");
  requireSafeInteger(persistence.deleteAfterSeconds, "policy.persistence.deleteAfterSeconds");
  requireMember(persistence.userLocalRetention, ["forbidden", "perpetual_approved"], "policy.persistence.userLocalRetention");
  requireMember(
    persistence.externalExportRetention,
    ["forbidden", "until_delete_after", "perpetual_approved"],
    "policy.persistence.externalExportRetention",
  );

  const availability = requireRecord(policy.availability, "policy.availability");
  assertExactKeys(availability, AVAILABILITY_KEYS, "policy.availability.");
  requireMember(availability.publicHosted, ["disabled_pending_approval", "enabled"], "policy.availability.publicHosted");
  requireMember(availability.selfHosted, ["disabled_pending_approval", "enabled"], "policy.availability.selfHosted");
  if (!Array.isArray(policy.notes) || policy.notes.some((note) => typeof note !== "string")) {
    throw new Error("policy.notes: Must be an array of strings");
  }
  if (typeof policy.contentHash !== "string" || !HASH_PATTERN.test(policy.contentHash)) {
    throw new Error("policy.contentHash: Must be a canonical SHA-256 content hash");
  }
  const expectedHash = calculateProviderPolicyManifestV2ContentHash(policy as unknown as ProviderPolicyManifestV2);
  if (policy.contentHash !== expectedHash) throw new Error("policy.contentHash: Does not match canonical policy bytes");
  return cloneJson(policy) as unknown as ProviderPolicyManifestV2;
}

export function providerPolicyRefV2(policy: Readonly<ProviderPolicyManifestV2>): ProviderPolicyRefV2 {
  const parsed = parseProviderPolicyManifestV2(policy);
  return { id: parsed.policyId, version: parsed.version, contentHash: parsed.contentHash };
}

function permissionIssue(
  code: ProviderPolicyOperationPermissionCodeV2,
  path: string,
  message: string,
): ProviderPolicyOperationPermissionIssueV2 {
  return Object.freeze({ code, path, message });
}

/**
 * Returns the complete, deterministic set of policy blockers for one provider
 * operation. This is the sole authorization predicate for runtime lookup,
 * authorization issuance, and trusted authorization verification.
 */
export function validateProviderPolicyOperationPermissionV2(
  policy: Readonly<ProviderPolicyManifestV2>,
  executionMode: unknown,
): readonly ProviderPolicyOperationPermissionIssueV2[] {
  const issues: ProviderPolicyOperationPermissionIssueV2[] = [];
  if (policy.state !== "enabled") {
    issues.push(permissionIssue(
      "policy_disabled",
      "providerPolicy.state",
      "Provider policy is not enabled; access is disabled pending approval",
    ));
  }
  if (policy.authorization.approval !== "approved") {
    issues.push(permissionIssue(
      "authorization_not_approved",
      "providerPolicy.authorization.approval",
      "Provider authorization and intended use are not approved",
    ));
  }
  if (!isValidRecordedApprovalReference(policy.authorization.approvalReference)) {
    issues.push(permissionIssue(
      "approval_reference_invalid",
      "providerPolicy.authorization.approvalReference",
      "Provider authorization requires a valid recorded approval reference",
    ));
  }
  if (policy.rateLimit.state !== "configured"
    || policy.rateLimit.requestsPerMinute === undefined
    || !Number.isSafeInteger(policy.rateLimit.requestsPerMinute)
    || policy.rateLimit.requestsPerMinute <= 0) {
    issues.push(permissionIssue(
      "rate_limit_invalid",
      "providerPolicy.rateLimit",
      "Provider rate limit is not positively configured",
    ));
  }
  if (!policy.lookup.exactMpnOnly
    || policy.lookup.bulkCaptureAllowed
    || !Number.isSafeInteger(policy.lookup.maximumPartsPerRequest)
    || policy.lookup.maximumPartsPerRequest <= 0) {
    issues.push(permissionIssue(
      "lookup_scope_invalid",
      "providerPolicy.lookup",
      "Provider policy does not permit bounded exact-MPN-only lookup",
    ));
  }
  if (!Number.isSafeInteger(policy.lookup.timeoutMilliseconds)
    || policy.lookup.timeoutMilliseconds <= 0) {
    issues.push(permissionIssue(
      "lookup_timeout_invalid",
      "providerPolicy.lookup.timeoutMilliseconds",
      "Provider lookup timeout is not positively configured",
    ));
  }
  if (!Number.isSafeInteger(policy.cache.maximumTtlSeconds)
    || policy.cache.maximumTtlSeconds <= 0
    || !Number.isSafeInteger(policy.cache.staleIfErrorSeconds)
    || policy.cache.staleIfErrorSeconds < 0) {
    issues.push(permissionIssue(
      "cache_policy_invalid",
      "providerPolicy.cache",
      "Provider cache policy is disabled or invalid",
    ));
  }
  if (!Number.isSafeInteger(policy.persistence.deleteAfterSeconds)
    || policy.persistence.deleteAfterSeconds <= 0) {
    issues.push(permissionIssue(
      "deletion_policy_invalid",
      "providerPolicy.persistence.deleteAfterSeconds",
      "Provider deletion lifetime is not positively configured",
    ));
  }
  if (policy.persistence.allowedSnapshotPersistence.includes("user_local")
    && (!policy.persistence.browserStorageAllowed
      || policy.persistence.userLocalRetention !== "perpetual_approved")) {
    issues.push(permissionIssue(
      "user_local_retention_unapproved",
      "providerPolicy.persistence.userLocalRetention",
      "Provider user-local persistence lacks perpetual written approval",
    ));
  }
  if (policy.persistence.allowedSnapshotPersistence.includes("exportable")
    && (!policy.persistence.exportAllowed
      || policy.persistence.externalExportRetention !== "perpetual_approved")) {
    issues.push(permissionIssue(
      "export_retention_unapproved",
      "providerPolicy.persistence.externalExportRetention",
      "Provider export persistence lacks perpetual written approval",
    ));
  }
  if (policy.persistence.publicShareAllowed
    && (!policy.persistence.exportAllowed
      || policy.persistence.externalExportRetention !== "perpetual_approved")) {
    issues.push(permissionIssue(
      "public_share_retention_unapproved",
      "providerPolicy.persistence.publicShareAllowed",
      "Provider public sharing lacks export retention approval",
    ));
  }
  if (policy.attribution.required && policy.attribution.label.trim() === "") {
    issues.push(permissionIssue(
      "attribution_invalid",
      "providerPolicy.attribution.label",
      "Provider attribution label is missing",
    ));
  }
  if (executionMode !== "public_hosted" && executionMode !== "self_hosted") {
    issues.push(permissionIssue(
      "execution_mode_invalid",
      "executionMode",
      "Provider execution mode must be public_hosted or self_hosted",
    ));
  } else {
    const availability = executionMode === "public_hosted"
      ? policy.availability.publicHosted
      : policy.availability.selfHosted;
    if (availability !== "enabled") {
      issues.push(permissionIssue(
        "execution_mode_unavailable",
        "providerPolicy.availability",
        `Provider is not approved for ${executionMode.replace("_", "-")} execution`,
      ));
    }
  }
  return Object.freeze(issues);
}

export function assertProviderPolicyAllowsOperationV2(
  policy: Readonly<ProviderPolicyManifestV2>,
  executionMode: unknown,
): void {
  const issues = validateProviderPolicyOperationPermissionV2(policy, executionMode);
  if (issues.length === 0) return;
  throw new Error(
    `${policy.displayName} provider operation blocked: ${issues.map((entry) => `${entry.path}: ${entry.message}`).join("; ")}`,
  );
}

export function migrateProviderPolicyManifestV1ToV2(
  policy: Readonly<ProviderPolicyManifestV1>,
  version: string,
): ProviderPolicyManifestV2 {
  requireNonEmptyString(version, "version");
  const content = {
    ...cloneJson(policy),
    format: "schemagic-provider-policy" as const,
    schemaVersion: PROVIDER_POLICY_SCHEMA_VERSION_V2,
    version,
    persistence: {
      ...cloneJson(policy.persistence),
      userLocalRetention: "forbidden" as const,
      externalExportRetention: "forbidden" as const,
    },
  };
  const contentHash = calculateProviderPolicyManifestV2ContentHash(content);
  return parseProviderPolicyManifestV2({ ...content, contentHash });
}

export function providerPolicyBlockers(
  policy: Readonly<ProviderPolicyManifestV1 | ProviderPolicyManifestV2>,
): string[] {
  const blockers: string[] = [];
  if (policy.state !== "enabled") blockers.push("provider policy is disabled pending approval");
  if (policy.authorization.approval !== "approved") blockers.push("provider authorization and intended use are not approved");
  if (!isValidRecordedApprovalReference(policy.authorization.approvalReference)) {
    blockers.push("provider authorization requires a valid recorded approval reference");
  }
  if (policy.rateLimit.state !== "configured" || policy.rateLimit.requestsPerMinute === undefined) {
    blockers.push("provider rate limit is not configured from an approved account");
  }
  if (policy.cache.maximumTtlSeconds <= 0) blockers.push("provider cache TTL is disabled pending approved terms");
  if (policy.persistence.deleteAfterSeconds <= 0) blockers.push("provider deletion lifetime is disabled pending approved terms");
  if (policy.availability.publicHosted !== "enabled" && policy.availability.selfHosted !== "enabled") {
    blockers.push("provider is unavailable for both public-hosted and self-hosted execution");
  }
  return blockers;
}

export function assertProviderPolicyAllowsExecution(
  policy: Readonly<ProviderPolicyManifestV1 | ProviderPolicyManifestV2>,
): void {
  const blockers = providerPolicyBlockers(policy);
  if (blockers.length > 0) throw new Error(`${policy.displayName} provider access blocked: ${blockers.join("; ")}`);
}
