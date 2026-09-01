import { canonicalJsonForVersionedSourcing, sha256HexForVersionedSourcing } from "./canonical";
import { compareRfc3339InstantsV2, parseRfc3339InstantV2 } from "./commercial-primitives-v2";
import { isDistributorId } from "./ids";
import type { ValidationIssue } from "./validation";
import { parseOfferSnapshotV2, parseOfferSnapshotV2Ref } from "./validation-v2";
import type {
  AuthorizedOfferSnapshotDocumentV2,
  OfferSnapshotV2,
  ProviderPolicyRefV2,
  Sha256ContentHash,
  SnapshotAuthorizationRefV1,
  SnapshotAuthorizationV1,
  SnapshotAuthorizationV1Id,
  SnapshotAuthorizationVerifierV1,
  SnapshotAuthorizedUseV1,
  VerifiedCommercialAuthorizationOperationV1,
} from "./v2";

type UnknownRecord = Record<string, unknown>;

const AUTHORIZATION_KEYS = ["format", "schemaVersion", "id", "snapshotRef", "provider", "providerPolicy", "attribution", "executionMode", "effectivePersistence", "effectiveEvaluationEligibility", "authorizedUses", "issuedAt", "notAfter", "issuerKeyId", "contentHash", "signature"] as const;
const POLICY_REF_KEYS = ["id", "version", "contentHash"] as const;
const ATTRIBUTION_KEYS = ["provider", "providerPolicy", "required", "label"] as const;
const AUTHORIZED_DOCUMENT_KEYS = ["format", "schemaVersion", "snapshot", "authorization"] as const;
const AUTHORIZED_USES = ["display", "download_export", "public_share", "user_local_storage"] as const satisfies readonly SnapshotAuthorizedUseV1[];
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const AUTHORIZATION_ID_PATTERN = /^snapshot-authorization:v1:sha256:[a-f0-9]{64}$/;
const ISSUER_KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{86}$/;

function isRecord(input: unknown): input is UnknownRecord {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function cloneJson<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function unknownKeyIssues(input: UnknownRecord, allowed: readonly string[], path: string): ValidationIssue[] {
  return Object.keys(input).filter((key) => !allowed.includes(key)).map((key) => ({ path: `${path}${path ? "." : ""}${key}`, message: "Unknown key" }));
}

function requiredText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function samePolicyRef(left: ProviderPolicyRefV2, right: ProviderPolicyRefV2): boolean {
  return left.id === right.id && left.version === right.version && left.contentHash === right.contentHash;
}

function policyRefIssues(input: unknown, path: string): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Provider policy ref must be an object" }];
  const issues = unknownKeyIssues(input, POLICY_REF_KEYS, path);
  if (!requiredText(input.id)) issues.push({ path: `${path}.id`, message: "Must be a non-empty policy ID" });
  if (!requiredText(input.version)) issues.push({ path: `${path}.version`, message: "Must be a non-empty policy version" });
  if (typeof input.contentHash !== "string" || !HASH_PATTERN.test(input.contentHash)) issues.push({ path: `${path}.contentHash`, message: "Must be a canonical SHA-256 hash" });
  return issues;
}

function isCanonicalSignature(value: unknown): value is string {
  if (typeof value !== "string" || !SIGNATURE_PATTERN.test(value)) return false;
  // An unpadded 64-byte base64url value has four permitted final characters;
  // this rejects non-zero discarded padding bits without a host decoder.
  return "AEIMQUYcgkosw048".includes(value.at(-1)!);
}

function refKey(snapshot: OfferSnapshotV2): string {
  return `${snapshot.schemaVersion}\u0000${snapshot.id}\u0000${snapshot.contentHash}`;
}

function authorizationRefKey(authorization: SnapshotAuthorizationV1): string {
  return `${authorization.id}\u0000${authorization.contentHash}\u0000${authorization.issuerKeyId}`;
}

export function canonicalSnapshotAuthorizationClaimsV1(
  authorization: Omit<SnapshotAuthorizationV1, "id" | "contentHash" | "signature"> | SnapshotAuthorizationV1,
): string {
  const { id: _id, contentHash: _hash, signature: _signature, ...claims } = authorization as SnapshotAuthorizationV1;
  return canonicalJsonForVersionedSourcing(claims);
}

export function calculateSnapshotAuthorizationContentHashV1(
  authorization: Omit<SnapshotAuthorizationV1, "id" | "contentHash" | "signature"> | SnapshotAuthorizationV1,
): Sha256ContentHash {
  return `sha256:${sha256HexForVersionedSourcing(canonicalSnapshotAuthorizationClaimsV1(authorization))}`;
}

export function calculateSnapshotAuthorizationIdV1(
  authorization: Omit<SnapshotAuthorizationV1, "id" | "contentHash" | "signature"> | SnapshotAuthorizationV1,
): SnapshotAuthorizationV1Id {
  return `snapshot-authorization:v1:${calculateSnapshotAuthorizationContentHashV1(authorization)}`;
}

export function snapshotAuthorizationRefV1(authorization: Readonly<SnapshotAuthorizationV1>): SnapshotAuthorizationRefV1 {
  return { id: authorization.id, contentHash: authorization.contentHash, issuerKeyId: authorization.issuerKeyId };
}

export function validateSnapshotAuthorizationV1(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) return [{ path: "", message: "Snapshot authorization must be an object" }];
  const issues = unknownKeyIssues(input, AUTHORIZATION_KEYS, "");
  if (input.format !== "schemagic-snapshot-authorization") issues.push({ path: "format", message: "Must identify a scheMAGIC snapshot authorization" });
  if (input.schemaVersion !== 1) issues.push({ path: "schemaVersion", message: "Must equal 1" });
  if (typeof input.id !== "string" || !AUTHORIZATION_ID_PATTERN.test(input.id)) issues.push({ path: "id", message: "Must be a content-addressed V1 authorization ID" });
  issues.push(...parseIssues(() => parseOfferSnapshotV2Ref(input.snapshotRef), "snapshotRef"));
  if (!isDistributorId(input.provider)) issues.push({ path: "provider", message: "Must be a stable distributor ID" });
  issues.push(...policyRefIssues(input.providerPolicy, "providerPolicy"));
  if (!isRecord(input.attribution)) issues.push({ path: "attribution", message: "Must be an attribution object" });
  else {
    issues.push(...unknownKeyIssues(input.attribution, ATTRIBUTION_KEYS, "attribution"));
    if (!isDistributorId(input.attribution.provider)) issues.push({ path: "attribution.provider", message: "Must be a stable distributor ID" });
    issues.push(...policyRefIssues(input.attribution.providerPolicy, "attribution.providerPolicy"));
    if (typeof input.attribution.required !== "boolean") issues.push({ path: "attribution.required", message: "Must be boolean" });
    if (!requiredText(input.attribution.label)) issues.push({ path: "attribution.label", message: "Must be a non-empty attribution label" });
    if (input.attribution.provider !== input.provider) issues.push({ path: "attribution.provider", message: "Must equal authorization provider" });
    if (isRecord(input.providerPolicy) && isRecord(input.attribution.providerPolicy)
      && !samePolicyRef(input.providerPolicy as unknown as ProviderPolicyRefV2, input.attribution.providerPolicy as unknown as ProviderPolicyRefV2)) {
      issues.push({ path: "attribution.providerPolicy", message: "Must equal authorization provider policy ref" });
    }
  }
  if (input.executionMode !== "public_hosted" && input.executionMode !== "self_hosted") issues.push({ path: "executionMode", message: "Unsupported execution mode" });
  if (input.effectivePersistence !== "ephemeral" && input.effectivePersistence !== "user_local" && input.effectivePersistence !== "exportable") issues.push({ path: "effectivePersistence", message: "Unsupported persistence" });
  if (input.effectiveEvaluationEligibility !== "native_v2") issues.push({ path: "effectiveEvaluationEligibility", message: "Must equal native_v2" });
  if (!Array.isArray(input.authorizedUses) || input.authorizedUses.length === 0 || input.authorizedUses.some((use) => !AUTHORIZED_USES.includes(use as SnapshotAuthorizedUseV1))) issues.push({ path: "authorizedUses", message: "Must contain supported authorization uses" });
  else {
    const uses = input.authorizedUses as string[];
    if (uses[0] !== "display" || uses.some((use, index) => index > 0 && compareText(uses[index - 1]!, use) >= 0)) issues.push({ path: "authorizedUses", message: "Must be sorted, unique, and include display" });
  }
  issues.push(...timestampIssues(input.issuedAt, "issuedAt"));
  if (input.notAfter !== null) issues.push(...timestampIssues(input.notAfter, "notAfter"));
  if (typeof input.issuedAt === "string" && typeof input.notAfter === "string") {
    try { if (compareRfc3339InstantsV2(input.issuedAt, input.notAfter) >= 0) issues.push({ path: "notAfter", message: "Must be later than issuedAt" }); } catch { /* individual issues already emitted */ }
  }
  if ((input.effectivePersistence === "user_local" || input.effectivePersistence === "exportable") && input.notAfter !== null) issues.push({ path: "notAfter", message: "Persistent authorization must have no expiry" });
  if (input.effectivePersistence === "ephemeral" && input.notAfter === null) issues.push({ path: "notAfter", message: "Ephemeral authorization must have a finite expiry" });
  if (typeof input.issuerKeyId !== "string" || !ISSUER_KEY_ID_PATTERN.test(input.issuerKeyId)) issues.push({ path: "issuerKeyId", message: "Invalid issuer key ID" });
  if (typeof input.contentHash !== "string" || !HASH_PATTERN.test(input.contentHash)) issues.push({ path: "contentHash", message: "Must be a canonical SHA-256 hash" });
  if (!isCanonicalSignature(input.signature)) issues.push({ path: "signature", message: "Must be an unpadded canonical 64-byte base64url signature" });
  try {
    const expectedHash = calculateSnapshotAuthorizationContentHashV1(input as unknown as SnapshotAuthorizationV1);
    if (input.contentHash !== expectedHash) issues.push({ path: "contentHash", message: "Does not match canonical authorization claims" });
    if (input.id !== `snapshot-authorization:v1:${expectedHash}`) issues.push({ path: "id", message: "Does not match authorization content hash" });
  } catch {
    issues.push({ path: "contentHash", message: "Authorization claims could not be canonicalized" });
  }
  return issues;
}

function timestampIssues(input: unknown, path: string): ValidationIssue[] {
  try { parseRfc3339InstantV2(input as string); return []; } catch { return [{ path, message: "Must be a strict RFC 3339 instant" }]; }
}

function parseIssues(parse: () => unknown, path: string): ValidationIssue[] {
  try { parse(); return []; } catch (error) { return [{ path, message: error instanceof Error ? error.message : "Invalid value" }]; }
}

export function parseSnapshotAuthorizationV1(input: unknown): SnapshotAuthorizationV1 {
  const issue = validateSnapshotAuthorizationV1(input)[0];
  if (issue) throw new Error(`${issue.path || "authorization"}: ${issue.message}`);
  return cloneJson(input) as SnapshotAuthorizationV1;
}

export function parseAuthorizedOfferSnapshotDocumentV2(input: unknown): AuthorizedOfferSnapshotDocumentV2 {
  if (!isRecord(input)) throw new Error("document: Authorized snapshot document must be an object");
  const unknown = unknownKeyIssues(input, AUTHORIZED_DOCUMENT_KEYS, "")[0];
  if (unknown) throw new Error(`${unknown.path}: ${unknown.message}`);
  if (input.format !== "schemagic-authorized-offer-snapshot") throw new Error("format: Must identify an authorized snapshot document");
  if (input.schemaVersion !== 2) throw new Error("schemaVersion: Must equal 2");
  const snapshot = parseOfferSnapshotV2(input.snapshot);
  const authorization = parseSnapshotAuthorizationV1(input.authorization);
  if (authorization.snapshotRef.id !== snapshot.id || authorization.snapshotRef.schemaVersion !== snapshot.schemaVersion || authorization.snapshotRef.contentHash !== snapshot.contentHash) throw new Error("authorization.snapshotRef: Must exactly match snapshot");
  if (authorization.provider !== snapshot.provider) throw new Error("authorization.provider: Must exactly match snapshot provider");
  if (authorization.effectivePersistence !== snapshot.persistence) throw new Error("authorization.effectivePersistence: Must exactly match snapshot persistence");
  if (snapshot.evaluationEligibility !== "native_v2") throw new Error("snapshot.evaluationEligibility: Authorized documents require native_v2");
  return { format: "schemagic-authorized-offer-snapshot", schemaVersion: 2, snapshot, authorization };
}

export interface SnapshotAuthorizationVerifierDependenciesV1 {
  checkedAt(): string;
  verifySignatureAndPolicy(
    authorization: Readonly<SnapshotAuthorizationV1>,
    snapshot: Readonly<OfferSnapshotV2>,
    canonicalClaims: Uint8Array,
  ): ValidationIssue[];
}

interface TokenRecord {
  use: SnapshotAuthorizedUseV1;
  checkedAt: string;
  snapshotKeys: string[];
  authorizationKeys: string[];
}

export function createSnapshotAuthorizationVerifierV1(
  dependencies: Readonly<SnapshotAuthorizationVerifierDependenciesV1>,
): SnapshotAuthorizationVerifierV1 {
  const tokens = new WeakMap<object, TokenRecord>();
  const verifier: SnapshotAuthorizationVerifierV1 = {
    verify(authorization, snapshot) {
      const issues = validateSnapshotAuthorizationV1(authorization);
      const snapshotIssues = parseIssues(() => parseOfferSnapshotV2(snapshot), "snapshot");
      issues.push(...snapshotIssues);
      if (snapshotIssues.length === 0) {
        if (authorization.snapshotRef.id !== snapshot.id || authorization.snapshotRef.schemaVersion !== 2 || authorization.snapshotRef.contentHash !== snapshot.contentHash) issues.push({ path: "snapshotRef", message: "Must exactly match snapshot" });
        if (authorization.provider !== snapshot.provider) issues.push({ path: "provider", message: "Must exactly match snapshot provider" });
        if (authorization.effectivePersistence !== snapshot.persistence) issues.push({ path: "effectivePersistence", message: "Must exactly match snapshot persistence" });
        if (snapshot.evaluationEligibility !== "native_v2") issues.push({ path: "snapshot.evaluationEligibility", message: "Authorization requires native_v2" });
        try { if (compareRfc3339InstantsV2(authorization.issuedAt, snapshot.retrievedAt) < 0) issues.push({ path: "issuedAt", message: "Must be at or after snapshot retrieval" }); } catch { /* parsed above */ }
      }
      if (issues.length === 0) issues.push(...dependencies.verifySignatureAndPolicy(authorization, snapshot, new TextEncoder().encode(canonicalSnapshotAuthorizationClaimsV1(authorization))));
      return issues;
    },
    authorizeOperation(use, snapshots, authorizations) {
      const checkedAt = dependencies.checkedAt();
      parseRfc3339InstantV2(checkedAt);
      const issues = operationIssues(verifier, use, checkedAt, snapshots, authorizations);
      if (issues.length > 0) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
      const token = Object.freeze({ use, checkedAt }) as VerifiedCommercialAuthorizationOperationV1;
      tokens.set(token as object, {
        use,
        checkedAt,
        snapshotKeys: snapshots.map(refKey).sort(compareText),
        authorizationKeys: authorizations.map(authorizationRefKey).sort(compareText),
      });
      return token;
    },
    validateOperation(operation, expectedUse, snapshots, authorizations) {
      const record = typeof operation === "object" && operation !== null ? tokens.get(operation as object) : undefined;
      if (record === undefined) return [{ path: "authorizationOperation", message: "Not an operation token issued by this verifier" }];
      const snapshotKeys = snapshots.map(refKey).sort(compareText);
      const authorizationKeys = authorizations.map(authorizationRefKey).sort(compareText);
      if (record.use !== expectedUse || record.snapshotKeys.join("\u0001") !== snapshotKeys.join("\u0001") || record.authorizationKeys.join("\u0001") !== authorizationKeys.join("\u0001")) return [{ path: "authorizationOperation", message: "Token use or exact authorization context does not match" }];
      return operationIssues(verifier, expectedUse, record.checkedAt, snapshots, authorizations);
    },
  };
  return verifier;
}

function operationIssues(
  verifier: SnapshotAuthorizationVerifierV1,
  use: SnapshotAuthorizedUseV1,
  checkedAt: string,
  snapshots: readonly OfferSnapshotV2[],
  authorizations: readonly SnapshotAuthorizationV1[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (new Set(snapshots.map(refKey)).size !== snapshots.length) issues.push({ path: "snapshots", message: "Duplicate snapshot refs" });
  if (new Set(authorizations.map(authorizationRefKey)).size !== authorizations.length) issues.push({ path: "authorizations", message: "Duplicate authorization refs" });
  for (const [index, snapshot] of snapshots.entries()) {
    const matches = authorizations.filter((authorization) => authorization.snapshotRef.id === snapshot.id && authorization.snapshotRef.schemaVersion === 2 && authorization.snapshotRef.contentHash === snapshot.contentHash);
    if (matches.length !== 1) { issues.push({ path: `authorizations.${index}`, message: "Exactly one authorization must match each snapshot" }); continue; }
    const authorization = matches[0]!;
    issues.push(...verifier.verify(authorization, snapshot).map((issue) => ({ ...issue, path: `authorizations.${index}.${issue.path}` })));
    if (!authorization.authorizedUses.includes(use)) issues.push({ path: `authorizations.${index}.authorizedUses`, message: `Does not authorize ${use}` });
    try {
      if (compareRfc3339InstantsV2(authorization.issuedAt, checkedAt) > 0) issues.push({ path: `authorizations.${index}.issuedAt`, message: "Authorization was not yet valid" });
      if (authorization.notAfter !== null && compareRfc3339InstantsV2(checkedAt, authorization.notAfter) > 0) issues.push({ path: `authorizations.${index}.notAfter`, message: "Authorization has expired" });
    } catch { issues.push({ path: `authorizations.${index}`, message: "Authorization time could not be compared" }); }
  }
  if (authorizations.some((authorization) => !snapshots.some((snapshot) => authorization.snapshotRef.id === snapshot.id && authorization.snapshotRef.schemaVersion === 2 && authorization.snapshotRef.contentHash === snapshot.contentHash))) issues.push({ path: "authorizations", message: "Extra authorization does not resolve to a supplied snapshot" });
  return issues;
}
