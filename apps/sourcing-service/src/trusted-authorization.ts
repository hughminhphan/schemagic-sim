import { createPublicKey, KeyObject, verify } from "node:crypto";
import {
  compareRfc3339InstantsV2,
  createSnapshotAuthorizationVerifierV1,
  formatRfc3339InstantV2,
  parseRfc3339InstantV2,
  type OfferSnapshotV2,
  type ProviderPolicyRefV2,
  type SnapshotAuthorizationV1,
  type SnapshotAuthorizationVerifierV1,
  type ValidationIssue,
} from "@opencircuit/sourcing-schema";
import {
  parseProviderPolicyManifestV2,
  providerPolicyRefV2,
  validateProviderPolicyOperationPermissionV2,
  type ProviderPolicyManifestV2,
} from "@opencircuit/sourcing-core";

export interface TrustedSnapshotAuthorizationIssuerKeyV1 {
  issuerKeyId: string;
  publicKey: KeyObject | string | Buffer;
  executionModes: readonly ("public_hosted" | "self_hosted")[];
}

export interface TrustedSnapshotAuthorizationVerifierOptionsV1 {
  keys: readonly TrustedSnapshotAuthorizationIssuerKeyV1[];
  policies: readonly ProviderPolicyManifestV2[];
  checkedAt: () => string;
}

function policyRefKey(ref: ProviderPolicyRefV2): string {
  return JSON.stringify([ref.id, ref.version, ref.contentHash]);
}

function assertTrustedKeyDescriptor(entry: Readonly<TrustedSnapshotAuthorizationIssuerKeyV1>): void {
  if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/.test(entry.issuerKeyId)) {
    throw new Error("Trusted snapshot issuer key ID is invalid");
  }
  if (entry.executionModes.length === 0
    || new Set(entry.executionModes).size !== entry.executionModes.length
    || entry.executionModes.some((mode) => mode !== "public_hosted" && mode !== "self_hosted")) {
    throw new Error(`Trusted key ${entry.issuerKeyId} must declare unique supported execution modes`);
  }
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function sameRef(left: ProviderPolicyRefV2, right: ProviderPolicyRefV2): boolean {
  return left.id === right.id && left.version === right.version && left.contentHash === right.contentHash;
}

function validatePolicyPermission(
  authorization: Readonly<SnapshotAuthorizationV1>,
  snapshot: Readonly<OfferSnapshotV2>,
  policy: Readonly<ProviderPolicyManifestV2>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = validateProviderPolicyOperationPermissionV2(
    policy,
    authorization.executionMode,
  ).map(({ path, message }) => issue(path, message));
  if (policy.provider !== snapshot.provider || policy.provider !== authorization.provider) {
    issues.push(issue("provider", "Resolved provider policy does not match snapshot provider"));
  }
  const expectedRef = providerPolicyRefV2(policy);
  if (!sameRef(expectedRef, authorization.providerPolicy)) issues.push(issue("providerPolicy", "Authorization does not bind the resolved policy ref"));
  if (!sameRef(expectedRef, authorization.attribution.providerPolicy)
    || authorization.attribution.provider !== snapshot.provider
    || authorization.attribution.required !== policy.attribution.required
    || authorization.attribution.label !== policy.attribution.label) {
    issues.push(issue("attribution", "Authorization attribution does not equal the resolved provider policy"));
  }
  if (!policy.persistence.allowedSnapshotPersistence.includes(snapshot.persistence)) {
    issues.push(issue("effectivePersistence", "Snapshot persistence is not permitted by resolved provider policy"));
  }
  if (Number.isSafeInteger(policy.cache.maximumTtlSeconds) && policy.cache.maximumTtlSeconds > 0) {
    try {
      const maximum = parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds
        + BigInt(policy.cache.maximumTtlSeconds) * 1_000_000_000n;
      formatRfc3339InstantV2(maximum);
      if (parseRfc3339InstantV2(snapshot.expiresAt).epochNanoseconds > maximum) {
        issues.push(issue("snapshot.expiresAt", "Snapshot expiry exceeds resolved provider-policy TTL"));
      }
    } catch {
      issues.push(issue("snapshot.expiresAt", "Snapshot TTL could not be verified"));
    }
  }
  if (snapshot.persistence === "ephemeral") {
    if (Number.isSafeInteger(policy.persistence.deleteAfterSeconds) && policy.persistence.deleteAfterSeconds > 0) {
      try {
        const expected = parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds
          + BigInt(policy.persistence.deleteAfterSeconds) * 1_000_000_000n;
        if (authorization.notAfter === null
          || parseRfc3339InstantV2(authorization.notAfter).epochNanoseconds !== expected) {
          issues.push(issue("notAfter", "Ephemeral deadline is not anchored to snapshot retrieval"));
        }
      } catch {
        issues.push(issue("notAfter", "Ephemeral authorization deadline could not be verified"));
      }
    }
    if (authorization.authorizedUses.length !== 1 || authorization.authorizedUses[0] !== "display") {
      issues.push(issue("authorizedUses", "Ephemeral authorization must permit display only"));
    }
  } else if (snapshot.persistence === "user_local") {
    if (!policy.persistence.browserStorageAllowed
      || policy.persistence.userLocalRetention !== "perpetual_approved"
      || authorization.notAfter !== null) {
      issues.push(issue("effectivePersistence", "User-local authorization is not perpetually approved"));
    }
    if (authorization.authorizedUses.some((use) => use !== "display" && use !== "user_local_storage")) {
      issues.push(issue("authorizedUses", "User-local authorization contains a transfer use"));
    }
  } else {
    if (!policy.persistence.exportAllowed
      || policy.persistence.externalExportRetention !== "perpetual_approved"
      || authorization.notAfter !== null) {
      issues.push(issue("effectivePersistence", "Export authorization is not perpetually approved"));
    }
    if (authorization.authorizedUses.includes("user_local_storage")
      && (!policy.persistence.browserStorageAllowed
        || policy.persistence.userLocalRetention !== "perpetual_approved")) {
      issues.push(issue("authorizedUses", "User-local storage use is not approved"));
    }
    if (authorization.authorizedUses.includes("public_share") && !policy.persistence.publicShareAllowed) {
      issues.push(issue("authorizedUses", "Public-share use is not approved"));
    }
  }
  try {
    if (compareRfc3339InstantsV2(authorization.issuedAt, snapshot.retrievedAt) < 0) {
      issues.push(issue("issuedAt", "Authorization predates snapshot retrieval"));
    }
  } catch {
    issues.push(issue("issuedAt", "Authorization issue time could not be verified"));
  }
  return issues;
}

export function createTrustedSnapshotAuthorizationVerifierV1(
  options: Readonly<TrustedSnapshotAuthorizationVerifierOptionsV1>,
): SnapshotAuthorizationVerifierV1 {
  const keys = new Map(options.keys.map((entry) => {
    assertTrustedKeyDescriptor(entry);
    const key = entry.publicKey instanceof KeyObject
      ? entry.publicKey
      : createPublicKey(entry.publicKey);
    if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") {
      throw new Error(`Trusted key ${entry.issuerKeyId} is not an Ed25519 public key`);
    }
    return [entry.issuerKeyId, { key, executionModes: new Set(entry.executionModes) }] as const;
  }));
  if (keys.size !== options.keys.length) throw new Error("Duplicate trusted snapshot issuer key ID");
  const policies = new Map(options.policies.map((source) => {
    const policy = parseProviderPolicyManifestV2(source);
    return [policyRefKey(providerPolicyRefV2(policy)), policy] as const;
  }));
  if (policies.size !== options.policies.length) throw new Error("Duplicate trusted provider policy ref");
  return createSnapshotAuthorizationVerifierV1({
    checkedAt: options.checkedAt,
    verifySignatureAndPolicy(authorization, snapshot, canonicalClaims) {
      const issues: ValidationIssue[] = [];
      const trusted = keys.get(authorization.issuerKeyId);
      if (trusted === undefined) return [issue("issuerKeyId", "Authorization issuer key is not trusted")];
      if (!trusted.executionModes.has(authorization.executionMode)) {
        issues.push(issue("executionMode", "Issuer key is not trusted for this execution mode"));
      }
      const policy = policies.get(policyRefKey(authorization.providerPolicy));
      if (policy === undefined) return [...issues, issue("providerPolicy", "Authorization provider policy ref is not trusted")];
      try {
        const signature = Buffer.from(authorization.signature, "base64url");
        if (!verify(null, canonicalClaims, trusted.key, signature)) {
          issues.push(issue("signature", "Authorization signature is invalid"));
        }
      } catch {
        issues.push(issue("signature", "Authorization signature could not be verified"));
      }
      issues.push(...validatePolicyPermission(authorization, snapshot, policy));
      return issues;
    },
  });
}
