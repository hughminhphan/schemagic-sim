import { describe, expect, it } from "vitest";
import {
  DIGIKEY_PROVIDER_POLICY,
  DIGIKEY_PROVIDER_POLICY_V2,
  MOUSER_PROVIDER_POLICY,
  MOUSER_PROVIDER_POLICY_V2,
  calculateProviderPolicyManifestV2ContentHash,
  assertProviderPolicyAllowsExecution,
  migrateProviderPolicyManifestV1ToV2,
  parseProviderPolicyManifestV2,
  providerPolicyRefV2,
  providerPolicyBlockers,
  validateProviderPolicyOperationPermissionV2,
  type ProviderPolicyManifest,
} from "../src";

function enabledPolicyWithApprovalReference(approvalReference: string | undefined) {
  const authorization: ProviderPolicyManifest["authorization"] = {
    mode: "api_key",
    credentialLocation: "server_only",
    approval: "approved",
  };
  if (approvalReference !== undefined) authorization.approvalReference = approvalReference;
  return migrateProviderPolicyManifestV1ToV2({
    ...DIGIKEY_PROVIDER_POLICY,
    state: "enabled",
    authorization,
    rateLimit: { state: "configured", requestsPerMinute: 10 },
    cache: { maximumTtlSeconds: 60, staleIfErrorSeconds: 0 },
    persistence: {
      ...DIGIKEY_PROVIDER_POLICY.persistence,
      deleteAfterSeconds: 120,
    },
    availability: {
      publicHosted: "disabled_pending_approval",
      selfHosted: "enabled",
    },
  }, "synthetic-operation-permission");
}

describe("provider policy manifests", () => {
  it.each([DIGIKEY_PROVIDER_POLICY, MOUSER_PROVIDER_POLICY])("blocks $displayName until access and terms are approved", (manifest) => {
    expect(manifest.state).toBe("disabled_pending_approval");
    expect(manifest.authorization.credentialLocation).toBe("server_only");
    expect(manifest.authorization.approval).toBe("pending");
    expect(manifest.lookup).toMatchObject({ exactMpnOnly: true, bulkCaptureAllowed: false });
    expect(manifest.cache.maximumTtlSeconds).toBe(0);
    expect(manifest.persistence).toMatchObject({
      allowedSnapshotPersistence: ["ephemeral"],
      browserStorageAllowed: false,
      publicShareAllowed: false,
      exportAllowed: false,
    });
    expect(providerPolicyBlockers(manifest).length).toBeGreaterThan(0);
    expect(() => assertProviderPolicyAllowsExecution(manifest)).toThrow(/blocked/i);
  });

  it("contains only the two approved V1 interface targets and no LCSC policy", () => {
    expect([DIGIKEY_PROVIDER_POLICY.provider, MOUSER_PROVIDER_POLICY.provider]).toEqual(["digikey", "mouser"]);
    expect(JSON.stringify([DIGIKEY_PROVIDER_POLICY, MOUSER_PROVIDER_POLICY]).toLowerCase()).not.toContain("lcsc");
  });

  it("records provider-documented exact lookup bounds without enabling either manifest", () => {
    expect(DIGIKEY_PROVIDER_POLICY.lookup.maximumPartsPerRequest).toBe(1);
    expect(MOUSER_PROVIDER_POLICY.lookup.maximumPartsPerRequest).toBe(10);
    expect([DIGIKEY_PROVIDER_POLICY.state, MOUSER_PROVIDER_POLICY.state]).toEqual([
      "disabled_pending_approval",
      "disabled_pending_approval",
    ]);
  });

  it("migrates V1 manifests conservatively into closed hash-pinned V2 documents", () => {
    const migrated = migrateProviderPolicyManifestV1ToV2(DIGIKEY_PROVIDER_POLICY, "2026-08-23");

    expect(migrated).toMatchObject({
      format: "schemagic-provider-policy",
      schemaVersion: 2,
      version: "2026-08-23",
      state: "disabled_pending_approval",
      persistence: {
        userLocalRetention: "forbidden",
        externalExportRetention: "forbidden",
      },
    });
    expect(migrated.contentHash).toBe(calculateProviderPolicyManifestV2ContentHash(migrated));
    expect(providerPolicyRefV2(migrated)).toEqual({
      id: migrated.policyId,
      version: migrated.version,
      contentHash: migrated.contentHash,
    });
    expect(parseProviderPolicyManifestV2(structuredClone(migrated))).toEqual(migrated);
  });

  it("ships exact hash-pinned native V2 policies without opening provider execution", () => {
    expect([DIGIKEY_PROVIDER_POLICY_V2, MOUSER_PROVIDER_POLICY_V2].map((policy) => ({
      provider: policy.provider,
      version: policy.version,
      state: policy.state,
      approval: policy.authorization.approval,
      contentHashValid: policy.contentHash === calculateProviderPolicyManifestV2ContentHash(policy),
    }))).toEqual([
      {
        provider: "digikey",
        version: "2026-08-24",
        state: "disabled_pending_approval",
        approval: "pending",
        contentHashValid: true,
      },
      {
        provider: "mouser",
        version: "2026-08-24",
        state: "disabled_pending_approval",
        approval: "pending",
        contentHashValid: true,
      },
    ]);
    expect(() => parseProviderPolicyManifestV2(DIGIKEY_PROVIDER_POLICY_V2)).not.toThrow();
    expect(() => parseProviderPolicyManifestV2(MOUSER_PROVIDER_POLICY_V2)).not.toThrow();
    expect(providerPolicyBlockers(DIGIKEY_PROVIDER_POLICY_V2)).toEqual(providerPolicyBlockers(DIGIKEY_PROVIDER_POLICY));
    expect(providerPolicyBlockers(MOUSER_PROVIDER_POLICY_V2)).toEqual(providerPolicyBlockers(MOUSER_PROVIDER_POLICY));
  });

  it("rejects V2 policy permission drift, extra keys, and stale hashes", () => {
    const migrated = migrateProviderPolicyManifestV1ToV2(MOUSER_PROVIDER_POLICY, "2026-08-23");
    const tampered = structuredClone(migrated);
    tampered.persistence.publicShareAllowed = true;
    expect(() => parseProviderPolicyManifestV2(tampered)).toThrow(/contentHash/i);

    const extra = { ...migrated, apiKey: "must-not-enter-policy" };
    expect(() => parseProviderPolicyManifestV2(extra)).toThrow(/unknown key/i);
  });

  it.each([
    ["missing", undefined],
    ["blank", "   "],
    ["control-bearing", "approval\u0000reference"],
    ["oversized", "a".repeat(513)],
  ])("fails closed on a %s approval reference with one canonical operation issue", (_label, reference) => {
    const policy = enabledPolicyWithApprovalReference(reference);
    expect(validateProviderPolicyOperationPermissionV2(policy, "self_hosted")).toEqual([{
      code: "approval_reference_invalid",
      path: "providerPolicy.authorization.approvalReference",
      message: "Provider authorization requires a valid recorded approval reference",
    }]);
  });

  it("rejects an unsupported runtime execution mode inside the canonical validator", () => {
    const policy = enabledPolicyWithApprovalReference("synthetic-test-approval");
    expect(validateProviderPolicyOperationPermissionV2(policy, "remote_hosted")).toEqual([{
      code: "execution_mode_invalid",
      path: "executionMode",
      message: "Provider execution mode must be public_hosted or self_hosted",
    }]);
  });
});
