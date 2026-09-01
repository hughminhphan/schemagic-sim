import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ProviderRuntimePolicy } from "../src/provider";
import * as publicApi from "../src";

function policy(
  state: ProviderRuntimePolicy["state"],
  approval: ProviderRuntimePolicy["authorization"]["approval"],
): ProviderRuntimePolicy {
  return {
    provider: "digikey",
    displayName: "Synthetic legacy provider",
    state,
    authorization: { approval },
    lookup: {
      exactMpnOnly: true,
      maximumPartsPerRequest: 1,
      bulkCaptureAllowed: false,
      timeoutMilliseconds: 20,
    },
    rateLimit: { state: "configured", requestsPerMinute: 10 },
    cache: { maximumTtlSeconds: 60, staleIfErrorSeconds: 0 },
    attribution: { required: true, label: "Synthetic legacy provider" },
    persistence: { allowedSnapshotPersistence: ["ephemeral"], deleteAfterSeconds: 60 },
    availability: { publicHosted: "enabled", selfHosted: "enabled" },
  };
}

describe("legacy V1 sourcing-service authority boundary", () => {
  it.each([
    ["enabled/approved", "enabled", "approved"],
    ["disabled/pending", "disabled_pending_approval", "pending"],
  ] as const)("keeps an approvalReference-incapable %s policy audit-only with zero side effects", async (
    _label,
    state,
    approval,
  ) => {
    let cacheReads = 0;
    let cacheWrites = 0;
    let adapterCalls = 0;
    let rateLimiterCalls = 0;
    let clockReads = 0;
    const legacyPolicy = policy(state, approval);
    expect("approvalReference" in legacyPolicy.authorization).toBe(false);
    const service = publicApi.createSourcingService({
      executionMode: "self_hosted",
      adapters: [{
        id: "digikey",
        async lookup() {
          adapterCalls += 1;
          throw new Error("legacy adapter must remain unreachable");
        },
      }],
      policies: [legacyPolicy],
      cache: {
        async get() { cacheReads += 1; return undefined; },
        async set() { cacheWrites += 1; },
      },
      rateLimiter: {
        consume() { rateLimiterCalls += 1; return true; },
      },
      now: () => { clockReads += 1; return new Date("2026-08-25T00:00:00.000Z"); },
    });

    await expect(service.lookup({ arbitrary: "legacy input is never executed" })).rejects.toMatchObject({
      name: "LegacySourcingServiceV1AuditOnlyError",
      code: "legacy_v1_sourcing_service_audit_only",
      message: publicApi.LEGACY_SOURCING_SERVICE_V1_AUDIT_ONLY_MESSAGE,
    });
    expect({ cacheReads, cacheWrites, adapterCalls, rateLimiterCalls, clockReads }).toEqual({
      cacheReads: 0,
      cacheWrites: 0,
      adapterCalls: 0,
      rateLimiterCalls: 0,
      clockReads: 0,
    });
  });

  it("rejects an unsupported execution mode at construction", () => {
    expect(() => publicApi.createSourcingService({
      executionMode: "remote_hosted" as never,
      adapters: [],
      policies: [],
    })).toThrow("Sourcing service executionMode must be public_hosted or self_hosted");
  });

  it("does not publicly export raw DigiKey or Mouser adapter factories", () => {
    expect(publicApi).not.toHaveProperty("createDigiKeyProviderAdapter");
    expect(publicApi).not.toHaveProperty("createDigiKeyProviderAdapterV2");
    expect(publicApi).not.toHaveProperty("createMouserProviderAdapter");
    expect(publicApi).not.toHaveProperty("createMouserProviderAdapterV2");
    const packageDocument = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { exports: Record<string, string> };
    expect(packageDocument.exports).toEqual({
      ".": "./src/index.ts",
      "./v2": "./src/v2-service.ts",
    });
  });
});
