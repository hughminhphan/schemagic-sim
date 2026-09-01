import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  calculateSnapshotAuthorizationContentHashV1,
  calculateSnapshotAuthorizationIdV1,
  canonicalSnapshotAuthorizationClaimsV1,
  finalizeOfferSnapshotV2,
  offerSnapshotRef,
  parseSnapshotAuthorizationV1,
  type OfferSnapshotV2Content,
  type SnapshotAuthorizationSignerV1,
  type SnapshotAuthorizationV1,
} from "@opencircuit/sourcing-schema";
import {
  calculateProviderPolicyManifestV2ContentHash,
  migrateProviderPolicyManifestV1ToV2,
  parseProviderPolicyManifestV2,
  providerPolicyRefV2,
  type ProviderPolicyManifest,
  type ProviderPolicyManifestV2,
} from "@opencircuit/sourcing-core";
import {
  createEd25519SnapshotAuthorizationSignerV1,
  createTrustedSnapshotAuthorizationVerifierV1,
  issueSnapshotAuthorizationV1,
} from "../src";

const RETRIEVED_AT = "2026-08-23T00:00:00.000000000Z";
const ISSUED_AT = "2026-08-23T00:00:01.000000000Z";

function v1Policy(): ProviderPolicyManifest {
  return {
    schemaVersion: 1,
    policyId: "schemagic-sourcing:synthetic:v1",
    provider: "digikey",
    displayName: "Synthetic provider",
    providerDocumentationUrl: "https://example.invalid/provider-policy",
    state: "enabled",
    authorization: {
      mode: "api_key",
      credentialLocation: "server_only",
      approval: "approved",
      approvalReference: "synthetic-test-only",
    },
    lookup: {
      exactMpnOnly: true,
      maximumPartsPerRequest: 1,
      bulkCaptureAllowed: false,
      timeoutMilliseconds: 100,
    },
    rateLimit: { state: "configured", requestsPerMinute: 10 },
    cache: { maximumTtlSeconds: 60, staleIfErrorSeconds: 0 },
    attribution: { required: true, label: "Synthetic provider attribution" },
    persistence: {
      allowedSnapshotPersistence: ["ephemeral"],
      browserStorageAllowed: false,
      publicShareAllowed: false,
      exportAllowed: false,
      deleteAfterSeconds: 120,
    },
    availability: { publicHosted: "disabled_pending_approval", selfHosted: "enabled" },
    notes: ["Synthetic hand-authored authorization fixture"],
  };
}

function enabledPolicy(): ProviderPolicyManifestV2 {
  return migrateProviderPolicyManifestV1ToV2(v1Policy(), "synthetic-2026-08-23");
}

function policyWithApprovalReference(approvalReference: string | undefined): ProviderPolicyManifestV2 {
  const source = v1Policy();
  source.authorization = {
    mode: source.authorization.mode,
    credentialLocation: "server_only",
    approval: "approved",
  };
  if (approvalReference !== undefined) source.authorization.approvalReference = approvalReference;
  return migrateProviderPolicyManifestV1ToV2(source, "synthetic-invalid-approval-reference");
}

function snapshot(overrides: Partial<OfferSnapshotV2Content> = {}) {
  const content: OfferSnapshotV2Content = {
    schemaVersion: 2,
    provider: "digikey",
    requestedParts: [{ manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-A" }],
    retrievedAt: RETRIEVED_AT,
    expiresAt: "2026-08-23T00:01:00.000000000Z",
    persistence: "ephemeral",
    evaluationEligibility: "native_v2",
    status: "complete",
    errors: [],
    offers: [],
    lineage: [],
    ...overrides,
  };
  return finalizeOfferSnapshotV2(content);
}

function signSyntheticAuthorizationForPolicy(
  source: ReturnType<typeof snapshot>,
  policy: ProviderPolicyManifestV2,
  signer: SnapshotAuthorizationSignerV1,
): SnapshotAuthorizationV1 {
  const policyRef = providerPolicyRefV2(policy);
  const claims: Omit<SnapshotAuthorizationV1, "id" | "contentHash" | "signature"> = {
    format: "schemagic-snapshot-authorization",
    schemaVersion: 1,
    snapshotRef: offerSnapshotRef(source),
    provider: source.provider,
    providerPolicy: policyRef,
    attribution: {
      provider: source.provider,
      providerPolicy: policyRef,
      required: policy.attribution.required,
      label: policy.attribution.label,
    },
    executionMode: "self_hosted",
    effectivePersistence: "ephemeral",
    effectiveEvaluationEligibility: "native_v2",
    authorizedUses: ["display"],
    issuedAt: ISSUED_AT,
    notAfter: "2026-08-23T00:02:00.000000000Z",
    issuerKeyId: signer.issuerKeyId,
  };
  const contentHash = calculateSnapshotAuthorizationContentHashV1(claims);
  const id = calculateSnapshotAuthorizationIdV1(claims);
  const signature = signer.signCanonicalClaims(
    new TextEncoder().encode(canonicalSnapshotAuthorizationClaimsV1(claims)),
  );
  return parseSnapshotAuthorizationV1({ ...claims, id, contentHash, signature });
}

describe("snapshot authorization issuance and trust", () => {
  it("issues a retrieval-anchored signed grant and validates one exact operation", async () => {
    const pair = generateKeyPairSync("ed25519");
    const signer = createEd25519SnapshotAuthorizationSignerV1({
      issuerKeyId: "synthetic.self-hosted.2026",
      privateKey: pair.privateKey,
    });
    const policy = enabledPolicy();
    const source = snapshot();
    const authorization = await issueSnapshotAuthorizationV1(source, policy, {
      executionMode: "self_hosted",
      authorizedUses: ["display"],
      issuedAt: ISSUED_AT,
    }, signer);

    expect(authorization.notAfter).toBe("2026-08-23T00:02:00.000000000Z");
    expect(parseSnapshotAuthorizationV1(structuredClone(authorization))).toEqual(authorization);

    const verifier = createTrustedSnapshotAuthorizationVerifierV1({
      keys: [{ issuerKeyId: signer.issuerKeyId, publicKey: pair.publicKey, executionModes: ["self_hosted"] }],
      policies: [policy],
      checkedAt: () => "2026-08-23T00:00:02.000000000Z",
    });
    expect(verifier.verify(authorization, source)).toEqual([]);
    const operation = verifier.authorizeOperation("display", [source], [authorization]);
    expect(verifier.validateOperation(operation, "display", [source], [authorization])).toEqual([]);
    expect(verifier.validateOperation(operation, "download_export", [source], [authorization])).not.toEqual([]);
  });

  it("rejects disabled policies, TTL drift, stale signatures, and retention reissuance", async () => {
    const pair = generateKeyPairSync("ed25519");
    const signer = createEd25519SnapshotAuthorizationSignerV1({ issuerKeyId: "synthetic.key", privateKey: pair.privateKey });
    const source = snapshot();
    const disabled = migrateProviderPolicyManifestV1ToV2({ ...v1Policy(), state: "disabled_pending_approval" }, "disabled");
    await expect(issueSnapshotAuthorizationV1(source, disabled, {
      executionMode: "self_hosted", authorizedUses: ["display"], issuedAt: ISSUED_AT,
    }, signer)).rejects.toThrow(/enabled/i);

    const policy = enabledPolicy();
    await expect(issueSnapshotAuthorizationV1(source, policy, {
      executionMode: "self_hosted",
      authorizedUses: ["display"],
      issuedAt: "2026-08-23T00:02:00.000000000Z",
    }, signer)).rejects.toThrow(/cutoff/i);

    const authorization = await issueSnapshotAuthorizationV1(source, policy, {
      executionMode: "self_hosted", authorizedUses: ["display"], issuedAt: ISSUED_AT,
    }, signer);
    const tampered = structuredClone(authorization);
    tampered.attribution.label = "Changed label";
    tampered.contentHash = calculateProviderPolicyManifestV2ContentHash(policy);
    expect(() => parseSnapshotAuthorizationV1(tampered)).toThrow();

    const { contentHash: _hash, ...policyContent } = policy;
    const driftContent = { ...policyContent, attribution: { ...policy.attribution, label: "Changed" } };
    const drifted = parseProviderPolicyManifestV2({
      ...driftContent,
      contentHash: calculateProviderPolicyManifestV2ContentHash(driftContent),
    });
    const verifier = createTrustedSnapshotAuthorizationVerifierV1({
      keys: [{ issuerKeyId: signer.issuerKeyId, publicKey: pair.publicKey, executionModes: ["self_hosted"] }],
      policies: [drifted],
      checkedAt: () => "2026-08-23T00:00:02.000000000Z",
    });
    expect(verifier.verify(authorization, source)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "providerPolicy" }),
    ]));
  });

  it.each([
    ["missing", undefined],
    ["blank", "   "],
    ["control-bearing", "approval\u0000reference"],
    ["oversized", "a".repeat(513)],
  ])("uses the canonical policy gate for a %s approval reference in issuance and trusted verification", async (_label, approvalReference) => {
    const pair = generateKeyPairSync("ed25519");
    const signer = createEd25519SnapshotAuthorizationSignerV1({
      issuerKeyId: "synthetic.invalid-approval-reference",
      privateKey: pair.privateKey,
    });
    const source = snapshot();
    const policy = policyWithApprovalReference(approvalReference);
    const expected = {
      path: "providerPolicy.authorization.approvalReference",
      message: "Provider authorization requires a valid recorded approval reference",
    };

    await expect(issueSnapshotAuthorizationV1(source, policy, {
      executionMode: "self_hosted",
      authorizedUses: ["display"],
      issuedAt: ISSUED_AT,
    }, signer)).rejects.toThrow(`${expected.path}: ${expected.message}`);

    const authorization = signSyntheticAuthorizationForPolicy(source, policy, signer);
    const verifier = createTrustedSnapshotAuthorizationVerifierV1({
      keys: [{ issuerKeyId: signer.issuerKeyId, publicKey: pair.publicKey, executionModes: ["self_hosted"] }],
      policies: [policy],
      checkedAt: () => "2026-08-23T00:00:02.000000000Z",
    });
    expect(verifier.verify(authorization, source)).toEqual([expected]);
  });

  it("rejects timestamp-bound overflow and non-public trusted key descriptors", async () => {
    const pair = generateKeyPairSync("ed25519");
    const signer = createEd25519SnapshotAuthorizationSignerV1({
      issuerKeyId: "synthetic.boundary",
      privateKey: pair.privateKey,
    });
    const nearMaximum = snapshot({
      retrievedAt: "9999-12-31T23:59:58.000000000Z",
      expiresAt: "9999-12-31T23:59:59.000000000Z",
    });
    await expect(issueSnapshotAuthorizationV1(nearMaximum, enabledPolicy(), {
      executionMode: "self_hosted",
      authorizedUses: ["display"],
      issuedAt: "9999-12-31T23:59:58.000000001Z",
    }, signer)).rejects.toThrow(/outside years/i);

    expect(() => createTrustedSnapshotAuthorizationVerifierV1({
      keys: [{ issuerKeyId: signer.issuerKeyId, publicKey: pair.privateKey, executionModes: ["self_hosted"] }],
      policies: [enabledPolicy()],
      checkedAt: () => ISSUED_AT,
    })).toThrow(/public key/i);
    expect(() => createTrustedSnapshotAuthorizationVerifierV1({
      keys: [{
        issuerKeyId: signer.issuerKeyId,
        publicKey: pair.publicKey,
        executionModes: ["self_hosted", "self_hosted"],
      }],
      policies: [enabledPolicy()],
      checkedAt: () => ISSUED_AT,
    })).toThrow(/unique supported execution modes/i);
  });
});
