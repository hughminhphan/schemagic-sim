import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DIGIKEY_PROVIDER_POLICY,
  DIGIKEY_PROVIDER_POLICY_V2,
  evaluateBomSourcingV2,
  migrateProviderPolicyManifestV1ToV2,
  type ProviderPolicyManifest,
  type ProviderPolicyManifestV2,
} from "@opencircuit/sourcing-core";
import {
  OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
  finalizeOfferSnapshotV2,
  parseOfferSnapshotV2,
  type DistributorOfferV2,
  type OfferSnapshotV2,
} from "@opencircuit/sourcing-schema";
import {
  createEd25519SnapshotAuthorizationSignerV1,
  createSourcingServiceV2,
  createTrustedSnapshotAuthorizationVerifierV1,
  issueSnapshotAuthorizationV1,
  type SourcingLookupRequest,
  type SourcingProviderAdapterV2,
} from "../src";

const NOW = new Date("2026-08-24T00:00:00.000Z");

function request(): SourcingLookupRequest {
  return {
    schemaVersion: 1,
    provider: "digikey",
    parts: [{ manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-V2-100" }],
    region: "US",
    currency: "USD",
  };
}

function policyV1(overrides: Partial<ProviderPolicyManifest> = {}): ProviderPolicyManifest {
  return {
    schemaVersion: 1,
    policyId: "schemagic-sourcing:synthetic-v2:test",
    provider: "digikey",
    displayName: "Synthetic native V2 provider",
    providerDocumentationUrl: "https://example.invalid/provider-policy",
    state: "enabled",
    authorization: {
      mode: "oauth2",
      credentialLocation: "server_only",
      approval: "approved",
      approvalReference: "synthetic-test-approval",
    },
    lookup: {
      exactMpnOnly: true,
      maximumPartsPerRequest: 1,
      bulkCaptureAllowed: false,
      timeoutMilliseconds: 20,
    },
    rateLimit: { state: "configured", requestsPerMinute: 10 },
    cache: { maximumTtlSeconds: 60, staleIfErrorSeconds: 30 },
    attribution: { required: true, label: "Synthetic provider" },
    persistence: {
      allowedSnapshotPersistence: ["ephemeral"],
      browserStorageAllowed: false,
      publicShareAllowed: false,
      exportAllowed: false,
      deleteAfterSeconds: 120,
    },
    availability: { publicHosted: "disabled_pending_approval", selfHosted: "enabled" },
    notes: ["Synthetic native V2 test policy"],
    ...overrides,
  };
}

function policy(overrides: Partial<ProviderPolicyManifest> = {}): ProviderPolicyManifestV2 {
  return migrateProviderPolicyManifestV1ToV2(policyV1(overrides), "synthetic-v2-2026-08-24");
}

function offer(source: SourcingLookupRequest, retrievedAt: string): DistributorOfferV2 {
  return {
    distributor: "digikey",
    distributorSku: "SYN-V2-100-ND",
    part: { ...source.parts[0]! },
    region: { state: "known", value: source.region },
    currency: { state: "known", value: source.currency },
    packaging: { state: "known", value: "cut_tape" },
    marketplace: { state: "known", value: false },
    backorderAvailable: { state: "known", value: false },
    stockQuantity: 100,
    minimumOrderQuantity: 1,
    leadTimeDays: { state: "known", value: 7 },
    leadTimeKind: { state: "known", value: "manufacturer" },
    lifecycle: { state: "known", value: "active" },
    lifecycleSource: { state: "known", value: "distributor" },
    priceBreaks: [{ quantity: 1, unitPrice: 1 }],
    productUrl: "https://www.digikey.com/en/products/detail/synthetic/SYN-V2-100/1",
    retrievedAt,
  };
}

function snapshot(
  source: SourcingLookupRequest,
  overrides: Partial<Omit<OfferSnapshotV2, "id" | "contentHash">> = {},
): OfferSnapshotV2 {
  const retrievedAt = overrides.retrievedAt ?? NOW.toISOString();
  return finalizeOfferSnapshotV2({
    schemaVersion: OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
    provider: source.provider,
    requestedParts: source.parts.map((part) => ({ ...part })),
    retrievedAt,
    expiresAt: new Date(Date.parse(retrievedAt) + 30_000).toISOString(),
    persistence: "ephemeral",
    evaluationEligibility: "native_v2",
    status: "complete",
    errors: [],
    offers: [offer(source, retrievedAt)],
    lineage: [],
    ...overrides,
  });
}

function adapter(lookup: SourcingProviderAdapterV2["lookup"]): SourcingProviderAdapterV2 {
  return { id: "digikey", lookup };
}

describe("native V2 sourcing service", () => {
  it("returns canonical native snapshots that can receive an exact signed commercial authorization", async () => {
    let calls = 0;
    const sourceRequest = request();
    const activePolicy = policy();
    const service = createSourcingServiceV2({
      executionMode: "self_hosted",
      adapters: [adapter(async () => {
        calls += 1;
        return snapshot(sourceRequest);
      })],
      policies: [activePolicy],
      now: () => new Date(NOW),
    });

    const first = await service.lookup(sourceRequest);
    const cached = await service.lookup(sourceRequest);
    expect(parseOfferSnapshotV2(first)).toEqual(first);
    expect(first).toEqual(cached);
    expect(first.evaluationEligibility).toBe("native_v2");
    expect(first.id).toBe(`snapshot:v2:${first.contentHash}`);
    expect(calls).toBe(1);

    const pair = generateKeyPairSync("ed25519");
    const signer = createEd25519SnapshotAuthorizationSignerV1({
      issuerKeyId: "synthetic.native-v2.test",
      privateKey: pair.privateKey,
    });
    const authorization = await issueSnapshotAuthorizationV1(first, activePolicy, {
      executionMode: "self_hosted",
      authorizedUses: ["display"],
      issuedAt: "2026-08-24T00:00:01.000000000Z",
    }, signer);
    expect(authorization.snapshotRef).toEqual({ id: first.id, schemaVersion: 2, contentHash: first.contentHash });
    expect(authorization.providerPolicy.contentHash).toBe(activePolicy.contentHash);
    const verifier = createTrustedSnapshotAuthorizationVerifierV1({
      keys: [{ issuerKeyId: signer.issuerKeyId, publicKey: pair.publicKey, executionModes: ["self_hosted"] }],
      policies: [activePolicy],
      checkedAt: () => "2026-08-24T00:00:02.000000000Z",
    });
    expect(verifier.verify(authorization, first)).toEqual([]);
    expect(verifier.authorizeOperation("display", [first], [authorization]).use).toBe("display");

    const evaluation = evaluateBomSourcingV2({
      lines: [{ bomLineId: "driver", part: sourceRequest.parts[0]!, quantityPerAssembly: 1 }],
      snapshots: [first],
      policy: {
        schemaVersion: 1,
        distributors: ["digikey"],
        mode: "any_selected",
        buildQuantity: 10,
        region: "US",
        currency: "USD",
        allowedLifecycle: ["active"],
        minimumStock: 10,
        maximumLeadTimeDays: 30,
        allowBackorder: false,
        allowMarketplace: false,
        packaging: ["cut_tape"],
        maximumSnapshotAgeSeconds: 60,
      },
      evaluatedAt: "2026-08-24T00:00:02.000000000Z",
    });
    expect(evaluation.policyStatus).toBe("pass");
    expect(evaluation.metrics.extendedBomCost).toEqual({ amount: 10, currency: "USD" });
  });

  it("blocks checked-in disabled provider policy before cache or transport access", async () => {
    let cacheReads = 0;
    let adapterCalls = 0;
    expect(DIGIKEY_PROVIDER_POLICY_V2.provider).toBe(DIGIKEY_PROVIDER_POLICY.provider);
    const disabled = DIGIKEY_PROVIDER_POLICY_V2;
    const service = createSourcingServiceV2({
      executionMode: "self_hosted",
      adapters: [adapter(async (source) => {
        adapterCalls += 1;
        return snapshot(source);
      })],
      policies: [disabled],
      cache: { get: async () => { cacheReads += 1; return undefined; }, set: async () => undefined },
      now: () => new Date(NOW),
    });

    await expect(service.lookup(request())).rejects.toThrow(/disabled pending approval/i);
    expect(cacheReads).toBe(0);
    expect(adapterCalls).toBe(0);
  });

  it.each([
    ["missing", undefined],
    ["blank", "   "],
    ["control-bearing", "approval\u0000reference"],
    ["oversized", "a".repeat(513)],
  ])("blocks a %s approval reference before every cache or adapter call", async (_label, approvalReference) => {
    let cacheReads = 0;
    let cacheWrites = 0;
    let adapterCalls = 0;
    const authorization: ProviderPolicyManifest["authorization"] = {
      mode: "oauth2",
      credentialLocation: "server_only",
      approval: "approved",
    };
    if (approvalReference !== undefined) authorization.approvalReference = approvalReference;
    const service = createSourcingServiceV2({
      executionMode: "self_hosted",
      adapters: [adapter(async (source) => {
        adapterCalls += 1;
        return snapshot(source);
      })],
      policies: [policy({ authorization })],
      cache: {
        get: async () => { cacheReads += 1; return undefined; },
        set: async () => { cacheWrites += 1; },
      },
      now: () => new Date(NOW),
    });

    await expect(service.lookup(request())).rejects.toThrow(
      /providerPolicy\.authorization\.approvalReference: Provider authorization requires a valid recorded approval reference/,
    );
    expect({ cacheReads, cacheWrites, adapterCalls }).toEqual({
      cacheReads: 0,
      cacheWrites: 0,
      adapterCalls: 0,
    });
  });

  it("rejects a hash-tampered policy at service composition", () => {
    const tampered = structuredClone(policy());
    tampered.lookup.maximumPartsPerRequest = 2;
    expect(() => createSourcingServiceV2({
      executionMode: "self_hosted",
      adapters: [],
      policies: [tampered],
    })).toThrow(/contentHash/i);
  });

  it("refuses persistence permissions that are not backed by perpetual written approval", async () => {
    const unsafe = policy({
      persistence: {
        allowedSnapshotPersistence: ["ephemeral", "exportable"],
        browserStorageAllowed: false,
        publicShareAllowed: false,
        exportAllowed: true,
        deleteAfterSeconds: 120,
      },
    });
    const service = createSourcingServiceV2({
      executionMode: "self_hosted",
      adapters: [adapter(async (source) => snapshot(source))],
      policies: [unsafe],
      now: () => new Date(NOW),
    });
    await expect(service.lookup(request())).rejects.toThrow(/export persistence lacks perpetual written approval/i);
  });

  it("sanitizes invalid future and untrusted-host snapshots into closed provider errors", async () => {
    const sourceRequest = request();
    const future = new Date(NOW.getTime() + 10_000).toISOString();
    const futureSnapshot = snapshot(sourceRequest, {
      retrievedAt: future,
      expiresAt: new Date(Date.parse(future) + 30_000).toISOString(),
      offers: [{ ...offer(sourceRequest, future), productUrl: "https://evil.invalid/provider-payload" }],
    });
    const service = createSourcingServiceV2({
      executionMode: "self_hosted",
      adapters: [adapter(async () => futureSnapshot)],
      policies: [policy()],
      now: () => new Date(NOW),
    });

    const result = await service.lookup(sourceRequest);
    expect(result).toMatchObject({
      status: "provider_error",
      errors: [{ catalogVersion: 1, code: "invalid_response", retryable: false }],
      offers: [],
    });
    expect(JSON.stringify(result)).not.toContain("evil.invalid");
  });

  it("serves stale data only inside both stale-if-error and deletion bounds", async () => {
    const sourceRequest = request();
    const stale = snapshot(sourceRequest, {
      retrievedAt: "2026-08-23T23:59:40.000Z",
      expiresAt: "2026-08-23T23:59:55.000Z",
      offers: [offer(sourceRequest, "2026-08-23T23:59:40.000Z")],
    });
    let observed = new Date(NOW);
    const makeService = () => createSourcingServiceV2({
      executionMode: "self_hosted",
      adapters: [adapter(async () => { throw new Error("must not leak"); })],
      policies: [policy()],
      cache: { get: async () => stale, set: async () => undefined },
      rateLimiter: { consume: () => false },
      now: () => new Date(observed),
    });

    expect(await makeService().lookup(sourceRequest)).toEqual(stale);
    observed = new Date("2026-08-24T00:01:40.000Z");
    const expired = await makeService().lookup(sourceRequest);
    expect(expired.status).toBe("provider_error");
    expect(expired.errors[0]?.code).toBe("rate_limited");
    expect(expired).not.toEqual(stale);
  });
});
