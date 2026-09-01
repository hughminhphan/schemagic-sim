import { describe, expect, it } from "vitest";
import {
  DISTRIBUTOR_IDS,
  calculateOfferSnapshotContentHash,
  parseOfferSnapshot,
  type OfferSnapshot,
} from "@opencircuit/sourcing-schema";
import {
  createDigiKeyProviderAdapter,
  normalizeDigiKeyProduct,
  type DigiKeyExactProductTransportRequest,
} from "../src/providers/digikey";
import {
  createMouserProviderAdapter,
  normalizeMouserPartDraft,
  type MouserExactPartsTransportRequest,
} from "../src/providers/mouser";
import { createSourcingService, type ProviderRuntimePolicy, type SourcingLookupRequest } from "../src";
import { SYNTHETIC_DIGIKEY_PRODUCT_DETAILS } from "./fixtures/digikey-wire";
import { SYNTHETIC_MOUSER_SEARCH } from "./fixtures/mouser-wire";

const NOW = new Date("2026-08-23T00:00:00.000Z");
const CONTEXT = { signal: new AbortController().signal };

function digikeyRequest(parts = [{ manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-DK-100" }]): SourcingLookupRequest {
  return { schemaVersion: 1, provider: DISTRIBUTOR_IDS.digikey, parts, region: "US", currency: "USD" };
}

function mouserRequest(parts = [{ manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-MO-100" }]): SourcingLookupRequest {
  return { schemaVersion: 1, provider: DISTRIBUTOR_IDS.mouser, parts, region: "US", currency: "USD" };
}

function disabledDigiKeyPolicy(): ProviderRuntimePolicy {
  return {
    provider: DISTRIBUTOR_IDS.digikey,
    displayName: "DigiKey",
    state: "disabled_pending_approval",
    authorization: { approval: "pending" },
    lookup: { exactMpnOnly: true, maximumPartsPerRequest: 1, bulkCaptureAllowed: false, timeoutMilliseconds: 100 },
    rateLimit: { state: "unconfigured" },
    cache: { maximumTtlSeconds: 0, staleIfErrorSeconds: 0 },
    attribution: { required: true, label: "DigiKey" },
    persistence: { allowedSnapshotPersistence: ["ephemeral"], deleteAfterSeconds: 0 },
    availability: { publicHosted: "disabled_pending_approval", selfHosted: "disabled_pending_approval" },
  };
}

function expectCanonicalSnapshot(snapshot: OfferSnapshot): void {
  expect(parseOfferSnapshot(snapshot)).toEqual(snapshot);
  expect(snapshot.contentHash).toBe(calculateOfferSnapshotContentHash(snapshot));
}

describe("DigiKey provider normalizer", () => {
  it("maps only documented exact-product and variation semantics", async () => {
    let transportRequest: DigiKeyExactProductTransportRequest | undefined;
    const adapter = createDigiKeyProviderAdapter({
      transport: {
        async lookupExactProduct(request) {
          transportRequest = request;
          return structuredClone(SYNTHETIC_DIGIKEY_PRODUCT_DETAILS);
        },
      },
      manufacturerReferences: { "synthetic-components": { manufacturerId: 4242 } },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });

    const snapshot = await adapter.lookup(digikeyRequest(), CONTEXT);

    expect(transportRequest).toEqual({
      productNumber: "SYN-DK-100",
      manufacturerId: 4242,
      site: "US",
      currency: "USD",
    });
    expect(transportRequest).not.toHaveProperty("apiKey");
    expect(transportRequest).not.toHaveProperty("accessToken");
    expect(snapshot.status).toBe("complete");
    expect(snapshot.offers).toHaveLength(2);
    expect(snapshot.offers[0]).toMatchObject({
      distributor: "digikey",
      distributorSku: "SYN-DK-100-CT-ND",
      packaging: "cut_tape",
      marketplace: false,
      backorderAvailable: true,
      stockQuantity: 250,
      minimumOrderQuantity: 1,
      leadTimeDays: 42,
      leadTimeKind: "manufacturer",
      lifecycle: "last_time_buy",
      lifecycleSource: "distributor",
      lastTimeBuyAt: "2027-01-01T00:00:00.000Z",
      priceBreaks: [
        { quantity: 1, unitPrice: 1.25 },
        { quantity: 10, unitPrice: 1 },
        { quantity: 100, unitPrice: 0.75 },
      ],
      productUrl: "https://www.digikey.com/en/products/detail/synthetic/SYN-DK-100/1",
      retrievedAt: NOW.toISOString(),
    });
    expect(snapshot.offers[0]).not.toHaveProperty("orderMultiple");
    expectCanonicalSnapshot(snapshot);
  });

  it("keeps conflicting lifecycle and unrecognized packaging unknown/partial", () => {
    const wire = structuredClone(SYNTHETIC_DIGIKEY_PRODUCT_DETAILS);
    wire.Product!.EndOfLife = true;
    wire.Product!.ProductStatus = { Status: "Active" };
    wire.Product!.ProductVariations![1]!.PackageType = { Name: "Synthetic Undocumented Pack" };

    const normalized = normalizeDigiKeyProduct(
      digikeyRequest(),
      digikeyRequest().parts[0]!,
      { manufacturerId: 4242 },
      wire,
      NOW.toISOString(),
    );

    expect(normalized.complete).toBe(false);
    expect(normalized.offers).toHaveLength(1);
    expect(normalized.offers[0]?.lifecycle).toBe("unknown");
    expect(normalized.offers[0]?.lifecycleSource).toBe("unknown");
  });

  it("rejects multi-part requests before transport", async () => {
    let calls = 0;
    const adapter = createDigiKeyProviderAdapter({
      transport: { async lookupExactProduct() { calls += 1; return SYNTHETIC_DIGIKEY_PRODUCT_DETAILS; } },
      manufacturerReferences: { "synthetic-components": { manufacturerId: 4242 } },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });
    await expect(adapter.lookup(digikeyRequest([
      { manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-DK-100" },
      { manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-DK-200" },
    ]), CONTEXT)).rejects.toThrow(/requires exactly 1 part/i);
    expect(calls).toBe(0);
  });

  it("keeps the compatibility V1 service audit-only ahead of the injected transport", async () => {
    let calls = 0;
    const adapter = createDigiKeyProviderAdapter({
      transport: { async lookupExactProduct() { calls += 1; return SYNTHETIC_DIGIKEY_PRODUCT_DETAILS; } },
      manufacturerReferences: { "synthetic-components": { manufacturerId: 4242 } },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });
    const service = createSourcingService({
      executionMode: "self_hosted",
      adapters: [adapter],
      policies: [disabledDigiKeyPolicy()],
      now: () => new Date(NOW),
    });

    await expect(service.lookup(digikeyRequest())).rejects.toThrow(/audit-only/i);
    expect(calls).toBe(0);
  });

  it("sanitizes injected transport failures", async () => {
    const adapter = createDigiKeyProviderAdapter({
      transport: { async lookupExactProduct() { throw new Error("raw token=secret provider payload"); } },
      manufacturerReferences: { "synthetic-components": { manufacturerId: 4242 } },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });
    await expect(adapter.lookup(digikeyRequest(), CONTEXT)).rejects.toMatchObject({
      code: "upstream",
      message: "DigiKey transport failed",
      retryable: true,
    });
  });
});

describe("Mouser provider normalizer", () => {
  it("retains documented draft facts while leaving ambiguous semantics unknown", () => {
    const wirePart = SYNTHETIC_MOUSER_SEARCH.SearchResults!.Parts![0]!;
    const draft = normalizeMouserPartDraft(
      mouserRequest(),
      mouserRequest().parts[0]!,
      { manufacturerName: "Synthetic Components" },
      wirePart,
      NOW.toISOString(),
    );

    expect(draft).toMatchObject({
      distributorSku: "999-SYN-MO-100",
      stockQuantity: 1200,
      minimumOrderQuantity: 5,
      orderMultiple: 10,
      lifecycle: "unknown",
      lifecycleSource: "unknown",
      priceBreaks: [
        { quantity: 1, unitPrice: 1.25 },
        { quantity: 100, unitPrice: 0.75 },
      ],
      productUrl: "https://www.mouser.com/ProductDetail/Synthetic/SYN-MO-100",
      retrievedAt: NOW.toISOString(),
    });
    expect(draft).not.toHaveProperty("packaging");
    expect(draft).not.toHaveProperty("marketplace");
    expect(draft).not.toHaveProperty("backorderAvailable");
    expect(draft).not.toHaveProperty("leadTimeDays");
  });

  it("returns an inspectable partial snapshot instead of fabricating required offer fields", async () => {
    let transportRequest: MouserExactPartsTransportRequest | undefined;
    const adapter = createMouserProviderAdapter({
      transport: {
        async lookupExactParts(request) {
          transportRequest = request;
          return structuredClone(SYNTHETIC_MOUSER_SEARCH);
        },
      },
      manufacturerReferences: { "synthetic-components": { manufacturerName: "Synthetic Components" } },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });

    const snapshot = await adapter.lookup(mouserRequest(), CONTEXT);

    expect(transportRequest).toEqual({
      partNumbers: ["SYN-MO-100"],
      manufacturerName: "Synthetic Components",
      partSearchOptions: "Exact",
      region: "US",
      currency: "USD",
    });
    expect(transportRequest).not.toHaveProperty("apiKey");
    expect(snapshot).toMatchObject({
      provider: "mouser",
      status: "partial",
      offers: [],
      errors: [{
        code: "invalid_response",
        message: "Mouser exact result could not be normalized without guessing",
        retryable: false,
      }],
    });
    expect(JSON.stringify(snapshot)).not.toContain("Synthetic Active Label");
    expect(JSON.stringify(snapshot)).not.toContain("synthetic availability text");
    expectCanonicalSnapshot(snapshot);
  });

  it("enforces official count, length, delimiter, and single-manufacturer bounds before transport", async () => {
    let calls = 0;
    const adapter = createMouserProviderAdapter({
      transport: { async lookupExactParts() { calls += 1; return SYNTHETIC_MOUSER_SEARCH; } },
      manufacturerReferences: {
        "synthetic-components": { manufacturerName: "Synthetic Components" },
        "other-components": { manufacturerName: "Other Components" },
      },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });
    await expect(adapter.lookup(mouserRequest([
      { manufacturerId: "synthetic-components", manufacturerPartNumber: "AB" },
    ]), CONTEXT)).rejects.toThrow(/3-40 characters/i);
    await expect(adapter.lookup(mouserRequest([
      { manufacturerId: "synthetic-components", manufacturerPartNumber: "ABC|DEF" },
    ]), CONTEXT)).rejects.toThrow(/cannot contain a pipe/i);
    await expect(adapter.lookup(mouserRequest([
      { manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-MO-100" },
      { manufacturerId: "other-components", manufacturerPartNumber: "SYN-MO-200" },
    ]), CONTEXT)).rejects.toThrow(/one configured provider manufacturer name/i);
    await expect(adapter.lookup(mouserRequest(Array.from({ length: 11 }, (_, index) => ({
      manufacturerId: "synthetic-components",
      manufacturerPartNumber: `SYN-MO-${100 + index}`,
    }))), CONTEXT)).rejects.toThrow(/limited to 10 parts/i);
    expect(calls).toBe(0);
  });

  it("does not copy provider wire errors into adapter failures", async () => {
    const adapter = createMouserProviderAdapter({
      transport: {
        async lookupExactParts() {
          return { Errors: [{ Code: "RAW-123", Message: "secret raw account error" }] };
        },
      },
      manufacturerReferences: { "synthetic-components": { manufacturerName: "Synthetic Components" } },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });

    const failure = await adapter.lookup(mouserRequest(), CONTEXT).catch((error: unknown) => error);
    expect(failure).toMatchObject({
      code: "unknown",
      message: "Mouser transport response reported an error",
      retryable: false,
    });
    expect(JSON.stringify(failure)).not.toContain("RAW-123");
    expect(JSON.stringify(failure)).not.toContain("secret raw account error");
  });
});
