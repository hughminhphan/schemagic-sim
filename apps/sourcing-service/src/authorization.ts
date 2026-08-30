import { createPrivateKey, KeyObject, sign } from "node:crypto";
import {
  calculateSnapshotAuthorizationContentHashV1,
  calculateSnapshotAuthorizationIdV1,
  canonicalSnapshotAuthorizationClaimsV1,
  formatRfc3339InstantV2,
  offerSnapshotRef as offerSnapshotRefV2,
  parseOfferSnapshotV2,
  parseRfc3339InstantV2,
  parseSnapshotAuthorizationV1,
  type OfferSnapshotV2,
  type SnapshotAuthorizationSignerV1,
  type SnapshotAuthorizationV1,
  type SnapshotAuthorizedUseV1,
} from "@opencircuit/sourcing-schema";
import {
  assertProviderPolicyAllowsOperationV2,
  parseProviderPolicyManifestV2,
  providerPolicyRefV2,
  type ProviderPolicyManifestV2,
} from "@opencircuit/sourcing-core";

export interface IssueSnapshotAuthorizationRequestV1 {
  executionMode: "public_hosted" | "self_hosted";
  authorizedUses: readonly SnapshotAuthorizedUseV1[];
  issuedAt: string;
}

export interface Ed25519SnapshotAuthorizationSignerOptionsV1 {
  issuerKeyId: string;
  privateKey: KeyObject | string | Buffer;
}

const USE_ORDER: readonly SnapshotAuthorizedUseV1[] = [
  "display", "download_export", "public_share", "user_local_storage",
];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertIssuerKeyId(value: string): void {
  if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/.test(value)) throw new Error("issuerKeyId: Invalid stable issuer key ID");
}

function assertSortedUniqueUses(uses: readonly SnapshotAuthorizedUseV1[]): SnapshotAuthorizedUseV1[] {
  const copy = [...uses];
  const sorted = [...copy].sort(compareText);
  if (copy.length === 0 || new Set(copy).size !== copy.length
    || copy.some((value, index) => value !== sorted[index])) {
    throw new Error("authorizedUses: Must be non-empty, code-unit sorted, and unique");
  }
  if (copy.some((value) => !USE_ORDER.includes(value))) throw new Error("authorizedUses: Unsupported use");
  if (!copy.includes("display")) throw new Error("authorizedUses: Every authorization must include display");
  return copy;
}

function assertPolicyCanIssue(
  snapshot: OfferSnapshotV2,
  policy: ProviderPolicyManifestV2,
  request: IssueSnapshotAuthorizationRequestV1,
): void {
  assertProviderPolicyAllowsOperationV2(policy, request.executionMode);
  if (policy.provider !== snapshot.provider) throw new Error("Provider policy does not match snapshot provider");
  if (!policy.persistence.allowedSnapshotPersistence.includes(snapshot.persistence)) {
    throw new Error("Snapshot persistence is not permitted by provider policy");
  }
  if (snapshot.evaluationEligibility !== "native_v2") throw new Error("Audit-only snapshots cannot be authorized");

  const retrieved = parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds;
  const expires = parseRfc3339InstantV2(snapshot.expiresAt).epochNanoseconds;
  const maximumExpiry = retrieved + BigInt(policy.cache.maximumTtlSeconds) * 1_000_000_000n;
  formatRfc3339InstantV2(maximumExpiry);
  if (expires > maximumExpiry) throw new Error("Snapshot expiry exceeds the provider-policy maximum TTL");
  const issued = parseRfc3339InstantV2(request.issuedAt).epochNanoseconds;
  if (issued < retrieved) throw new Error("Authorization cannot be issued before snapshot retrieval");

  const uses = assertSortedUniqueUses(request.authorizedUses);
  if (snapshot.persistence === "ephemeral") {
    if (uses.length !== 1 || uses[0] !== "display") throw new Error("Ephemeral snapshots authorize display only");
  } else if (snapshot.persistence === "user_local") {
    if (!policy.persistence.browserStorageAllowed
      || policy.persistence.userLocalRetention !== "perpetual_approved") {
      throw new Error("User-local persistence is not perpetually approved");
    }
    if (uses.some((use) => use !== "display" && use !== "user_local_storage")) {
      throw new Error("User-local snapshots cannot authorize transfer uses");
    }
  } else {
    if (!policy.persistence.exportAllowed
      || policy.persistence.externalExportRetention !== "perpetual_approved") {
      throw new Error("Export persistence is not perpetually approved");
    }
    if (uses.includes("user_local_storage")
      && (!policy.persistence.browserStorageAllowed
        || policy.persistence.userLocalRetention !== "perpetual_approved")) {
      throw new Error("User-local storage use is not approved");
    }
    if (uses.includes("public_share") && !policy.persistence.publicShareAllowed) {
      throw new Error("Public-share use is not approved");
    }
  }
}

export function createEd25519SnapshotAuthorizationSignerV1(
  options: Readonly<Ed25519SnapshotAuthorizationSignerOptionsV1>,
): SnapshotAuthorizationSignerV1 {
  assertIssuerKeyId(options.issuerKeyId);
  const privateKey = options.privateKey instanceof KeyObject
    ? options.privateKey
    : createPrivateKey(options.privateKey);
  if (privateKey.type !== "private" || privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("Snapshot authorization signer requires an Ed25519 private key");
  }
  return Object.freeze({
    issuerKeyId: options.issuerKeyId,
    signCanonicalClaims(claims: Uint8Array): string {
      return sign(null, claims, privateKey).toString("base64url");
    },
  });
}

export async function issueSnapshotAuthorizationV1(
  snapshotInput: Readonly<OfferSnapshotV2>,
  policyInput: Readonly<ProviderPolicyManifestV2>,
  request: Readonly<IssueSnapshotAuthorizationRequestV1>,
  signer: SnapshotAuthorizationSignerV1,
): Promise<SnapshotAuthorizationV1> {
  const snapshot = parseOfferSnapshotV2(snapshotInput);
  const policy = parseProviderPolicyManifestV2(policyInput);
  assertIssuerKeyId(signer.issuerKeyId);
  assertPolicyCanIssue(snapshot, policy, request);
  const retrieved = parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds;
  const issued = parseRfc3339InstantV2(request.issuedAt).epochNanoseconds;
  let notAfter: string | null = null;
  if (snapshot.persistence === "ephemeral") {
    const cutoff = retrieved + BigInt(policy.persistence.deleteAfterSeconds) * 1_000_000_000n;
    if (issued >= cutoff) throw new Error("Authorization issue time is at or after the deletion cutoff");
    notAfter = formatRfc3339InstantV2(cutoff);
  }
  const claims = {
    format: "schemagic-snapshot-authorization" as const,
    schemaVersion: 1 as const,
    snapshotRef: offerSnapshotRefV2(snapshot),
    provider: snapshot.provider,
    providerPolicy: providerPolicyRefV2(policy),
    attribution: {
      provider: snapshot.provider,
      providerPolicy: providerPolicyRefV2(policy),
      required: policy.attribution.required,
      label: policy.attribution.label,
    },
    executionMode: request.executionMode,
    effectivePersistence: snapshot.persistence,
    effectiveEvaluationEligibility: "native_v2" as const,
    authorizedUses: [...request.authorizedUses],
    issuedAt: request.issuedAt,
    notAfter,
    issuerKeyId: signer.issuerKeyId,
  };
  const contentHash = calculateSnapshotAuthorizationContentHashV1(claims);
  const id = calculateSnapshotAuthorizationIdV1(claims);
  const signature = await signer.signCanonicalClaims(
    new TextEncoder().encode(canonicalSnapshotAuthorizationClaimsV1(claims)),
  );
  return parseSnapshotAuthorizationV1({ ...claims, id, contentHash, signature });
}
