import { describe, expect, it } from "vitest";
import { parseOfferSnapshotV2 } from "@opencircuit/sourcing-schema";
import {
  createDigiKeyProviderAdapterV2,
  type DigiKeyExactProductTransportRequest,
} from "../src/providers/digikey";
import {
  createMouserProviderAdapterV2,
  type MouserExactPartsTransportRequest,
} from "../src/providers/mouser";
import type { SourcingLookupRequest } from "../src";
import { SYNTHETIC_DIGIKEY_PRODUCT_DETAILS } from "./fixtures/digikey-wire";
import { SYNTHETIC_MOUSER_SEARCH } from "./fixtures/mouser-wire";

const NOW = new Date("2026-08-24T00:00:00.000Z");
const CONTEXT = { signal: new AbortController().signal };

function request(provider: "digikey" | "mouser", mpn: string): SourcingLookupRequest {
  return {
    schemaVersion: 1,
    provider,
    parts: [{ manufacturerId: "synthetic-components", manufacturerPartNumber: mpn }],
    region: "US",
    currency: "USD",
  };
}

describe("native V2 provider normalizers", () => {
  it("promotes a fully documented DigiKey result to a canonical native V2 snapshot", async () => {
    let transportRequest: DigiKeyExactProductTransportRequest | undefined;
    const adapter = createDigiKeyProviderAdapterV2({
      transport: {
        async lookupExactProduct(input) {
          transportRequest = input;
          return structuredClone(SYNTHETIC_DIGIKEY_PRODUCT_DETAILS);
        },
      },
      manufacturerReferences: { "synthetic-components": { manufacturerId: 4242 } },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });
    const result = await adapter.lookup(request("digikey", "SYN-DK-100"), CONTEXT);

    expect(transportRequest).toEqual({
      productNumber: "SYN-DK-100",
      manufacturerId: 4242,
      site: "US",
      currency: "USD",
    });
    expect(parseOfferSnapshotV2(result)).toEqual(result);
    expect(result).toMatchObject({
      schemaVersion: 2,
      evaluationEligibility: "native_v2",
      status: "complete",
      lineage: [],
    });
    expect(result.offers[0]).toMatchObject({
      region: { state: "known", value: "US" },
      currency: { state: "known", value: "USD" },
      packaging: { state: "known", value: "cut_tape" },
      marketplace: { state: "known", value: false },
      backorderAvailable: { state: "known", value: true },
    });
  });

  it("retains Mouser draft facts while marking unsupported semantics explicitly unknown", async () => {
    let transportRequest: MouserExactPartsTransportRequest | undefined;
    const adapter = createMouserProviderAdapterV2({
      transport: {
        async lookupExactParts(input) {
          transportRequest = input;
          return structuredClone(SYNTHETIC_MOUSER_SEARCH);
        },
      },
      manufacturerReferences: { "synthetic-components": { manufacturerName: "Synthetic Components" } },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });
    const result = await adapter.lookup(request("mouser", "SYN-MO-100"), CONTEXT);

    expect(transportRequest).toEqual({
      partNumbers: ["SYN-MO-100"],
      manufacturerName: "Synthetic Components",
      partSearchOptions: "Exact",
      region: "US",
      currency: "USD",
    });
    expect(parseOfferSnapshotV2(result)).toEqual(result);
    expect(result.status).toBe("partial");
    expect(result.errors).toEqual([{ catalogVersion: 1, code: "invalid_response", retryable: false }]);
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({
      distributorSku: "999-SYN-MO-100",
      region: { state: "unknown", reason: "not_reported" },
      currency: { state: "known", value: "USD" },
      packaging: { state: "unknown", reason: "not_supported" },
      marketplace: { state: "unknown", reason: "not_reported" },
      backorderAvailable: { state: "unknown", reason: "unmapped" },
      stockQuantity: 1200,
      minimumOrderQuantity: 5,
      orderMultiple: 10,
      lifecycle: { state: "unknown", reason: "unmapped" },
      priceBreaks: [
        { quantity: 1, unitPrice: 1.25 },
        { quantity: 100, unitPrice: 0.75 },
      ],
    });
  });

  it("does not admit a provider product URL outside the verified distributor host", async () => {
    const wire = structuredClone(SYNTHETIC_DIGIKEY_PRODUCT_DETAILS);
    wire.Product!.ProductUrl = "https://example.invalid/not-digikey";
    const adapter = createDigiKeyProviderAdapterV2({
      transport: { async lookupExactProduct() { return wire; } },
      manufacturerReferences: { "synthetic-components": { manufacturerId: 4242 } },
      snapshotTtlSeconds: 60,
      now: () => new Date(NOW),
    });
    const result = await adapter.lookup(request("digikey", "SYN-DK-100"), CONTEXT);

    expect(result.status).toBe("partial");
    expect(result.offers).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("example.invalid");
  });
});
