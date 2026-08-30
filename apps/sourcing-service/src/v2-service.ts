import {
  assertProviderPolicyAllowsOperationV2,
  parseProviderPolicyManifestV2,
  type ProviderPolicyManifestV2,
} from "@opencircuit/sourcing-core";
import {
  OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
  PROVIDER_ERROR_CATALOG_VERSION_V2,
  compareRfc3339InstantsV2,
  finalizeOfferSnapshotV2,
  formatRfc3339InstantV2,
  isVerifiedDistributorProductUrlV2,
  parseOfferSnapshotV2,
  parseRfc3339InstantV2,
  type ManufacturerPartIdentity,
  type OfferSnapshotV2,
  type ProviderErrorCodeV2,
} from "@opencircuit/sourcing-schema";
import { ProviderAdapterError } from "./provider";
import { InMemoryFixedWindowRateLimiter, type ProviderRateLimiter } from "./rate-limit";
import { parseSourcingLookupRequest, type SourcingLookupRequest } from "./request";
import { InMemorySnapshotCacheV2, type SnapshotCacheV2 } from "./v2-cache";
import type { SourcingProviderAdapterV2 } from "./v2-provider";

export interface SourcingServiceV2 {
  lookup(input: unknown): Promise<OfferSnapshotV2>;
}

export type SourcingExecutionModeV2 = "public_hosted" | "self_hosted";

export interface SourcingServiceOptionsV2 {
  executionMode: SourcingExecutionModeV2;
  adapters: readonly SourcingProviderAdapterV2[];
  policies: readonly ProviderPolicyManifestV2[];
  cache?: SnapshotCacheV2;
  rateLimiter?: ProviderRateLimiter;
  now?: () => Date;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function identityKey(part: ManufacturerPartIdentity): string {
  return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
}

function sameIdentities(left: readonly ManufacturerPartIdentity[], right: readonly ManufacturerPartIdentity[]): boolean {
  const leftKeys = left.map(identityKey).sort(compareText);
  const rightKeys = right.map(identityKey).sort(compareText);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]);
}

function cacheKey(request: SourcingLookupRequest): string {
  return JSON.stringify({
    schemaVersion: 2,
    provider: request.provider,
    parts: request.parts,
    region: request.region,
    currency: request.currency,
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

function validNow(now: () => Date): Date {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error("Sourcing service clock returned an invalid instant");
  return new Date(value.getTime());
}

function plusSeconds(instant: string, seconds: number): string {
  const value = parseRfc3339InstantV2(instant).epochNanoseconds + BigInt(seconds) * 1_000_000_000n;
  return formatRfc3339InstantV2(value);
}

function validateProviderSnapshotV2(
  source: OfferSnapshotV2,
  request: SourcingLookupRequest,
  policy: ProviderPolicyManifestV2,
  observedAt: string,
  allowExpired = false,
): OfferSnapshotV2 {
  const snapshot = parseOfferSnapshotV2(source);
  if (snapshot.provider !== request.provider) throw new Error("Provider snapshot does not match the requested provider");
  if (!sameIdentities(snapshot.requestedParts, request.parts)) throw new Error("Provider snapshot requested identities do not match the bounded request");
  if (snapshot.evaluationEligibility !== "native_v2") throw new Error("Provider snapshot is not eligible for native V2 evaluation");
  if (snapshot.lineage.length !== 0) throw new Error("Native provider snapshot must not claim imported lineage");
  if (!policy.persistence.allowedSnapshotPersistence.includes(snapshot.persistence)) throw new Error("Provider snapshot persistence is not allowed by policy");
  if (snapshot.persistence === "user_local"
    && (!policy.persistence.browserStorageAllowed || policy.persistence.userLocalRetention !== "perpetual_approved")) {
    throw new Error("Provider snapshot user-local persistence is not approved");
  }
  if (snapshot.persistence === "exportable"
    && (!policy.persistence.exportAllowed || policy.persistence.externalExportRetention !== "perpetual_approved")) {
    throw new Error("Provider snapshot export persistence is not approved");
  }
  if (snapshot.offers.some((offer) => offer.region.state === "known" && offer.region.value !== request.region)) {
    throw new Error("Provider offer region does not match the request");
  }
  if (snapshot.offers.some((offer) => offer.currency.state === "known" && offer.currency.value !== request.currency)) {
    throw new Error("Provider offer currency does not match the request");
  }
  if (snapshot.offers.some((offer) => !isVerifiedDistributorProductUrlV2(offer))) {
    throw new Error("Provider offer product URL is not an approved distributor host");
  }
  if (compareRfc3339InstantsV2(snapshot.retrievedAt, observedAt) > 0) {
    throw new Error("Provider snapshot retrieval instant is in the future");
  }
  const maximumExpiry = plusSeconds(snapshot.retrievedAt, policy.cache.maximumTtlSeconds);
  if (compareRfc3339InstantsV2(snapshot.expiresAt, maximumExpiry) > 0) {
    throw new Error("Provider snapshot expiresAt exceeds the approved cache TTL");
  }
  const deletionDeadline = plusSeconds(snapshot.retrievedAt, policy.persistence.deleteAfterSeconds);
  if (compareRfc3339InstantsV2(snapshot.expiresAt, deletionDeadline) > 0) {
    throw new Error("Provider snapshot expiry exceeds the approved deletion lifetime");
  }
  if (compareRfc3339InstantsV2(observedAt, deletionDeadline) >= 0) {
    throw new Error("Provider snapshot exceeds the approved persistence deletion lifetime");
  }
  if (!allowExpired && compareRfc3339InstantsV2(snapshot.expiresAt, observedAt) <= 0) {
    throw new Error("Provider snapshot expiresAt is not in the future");
  }
  return snapshot;
}

function staleFallbackIsAllowedV2(
  cached: OfferSnapshotV2 | undefined,
  policy: ProviderPolicyManifestV2,
  observedAt: string,
): cached is OfferSnapshotV2 {
  if (cached === undefined || policy.cache.staleIfErrorSeconds <= 0) return false;
  const observed = parseRfc3339InstantV2(observedAt).epochNanoseconds;
  const expires = parseRfc3339InstantV2(cached.expiresAt).epochNanoseconds;
  const deletion = parseRfc3339InstantV2(cached.retrievedAt).epochNanoseconds
    + BigInt(policy.persistence.deleteAfterSeconds) * 1_000_000_000n;
  return observed > expires
    && observed - expires <= BigInt(policy.cache.staleIfErrorSeconds) * 1_000_000_000n
    && observed < deletion;
}

function errorCode(error: unknown): { code: ProviderErrorCodeV2; retryable: boolean } {
  if (error instanceof ProviderAdapterError) return { code: error.code, retryable: error.retryable };
  if (error instanceof Error && error.name === "TimeoutError") return { code: "timeout", retryable: true };
  if (error instanceof Error && /snapshot|contentHash|offer|provider|requested|region|currency|persistence|expiresAt|retrieval|lineage|product URL/i.test(error.message)) {
    return { code: "invalid_response", retryable: false };
  }
  return { code: "upstream", retryable: true };
}

function errorSnapshotV2(
  request: SourcingLookupRequest,
  code: ProviderErrorCodeV2,
  retryable: boolean,
  observedAt: string,
  policy: ProviderPolicyManifestV2,
): OfferSnapshotV2 {
  const ttl = Math.max(1, Math.min(30, policy.cache.maximumTtlSeconds, policy.persistence.deleteAfterSeconds));
  return parseOfferSnapshotV2(finalizeOfferSnapshotV2({
    schemaVersion: OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
    provider: request.provider,
    requestedParts: request.parts.map((part) => ({ ...part })),
    retrievedAt: observedAt,
    expiresAt: plusSeconds(observedAt, ttl),
    persistence: "ephemeral",
    evaluationEligibility: "native_v2",
    status: "provider_error",
    errors: [{ catalogVersion: PROVIDER_ERROR_CATALOG_VERSION_V2, code, retryable }],
    offers: [],
    lineage: [],
  }));
}

async function withTimeoutV2<T>(
  timeoutMilliseconds: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      const error = new Error("Provider request timed out");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMilliseconds);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function secondsBetween(later: string, earlier: string): number {
  const difference = parseRfc3339InstantV2(later).epochNanoseconds
    - parseRfc3339InstantV2(earlier).epochNanoseconds;
  return Number(difference) / 1_000_000_000;
}

export function createSourcingServiceV2(options: SourcingServiceOptionsV2): SourcingServiceV2 {
  if (options.executionMode !== "public_hosted" && options.executionMode !== "self_hosted") {
    throw new Error("Sourcing service V2 executionMode must be public_hosted or self_hosted");
  }
  const adapters = new Map(options.adapters.map((adapter) => [adapter.id, adapter]));
  const parsedPolicies = options.policies.map((policy) => parseProviderPolicyManifestV2(policy));
  const policies = new Map(parsedPolicies.map((policy) => [policy.provider, policy]));
  if (adapters.size !== options.adapters.length) throw new Error("Duplicate V2 provider adapter ID");
  if (policies.size !== parsedPolicies.length) throw new Error("Duplicate V2 provider policy ID");
  const now = options.now ?? (() => new Date());
  const nowMilliseconds = (): number => validNow(now).getTime();
  const cache = options.cache ?? new InMemorySnapshotCacheV2(nowMilliseconds);
  const rateLimiter = options.rateLimiter ?? new InMemoryFixedWindowRateLimiter();

  return {
    async lookup(input: unknown): Promise<OfferSnapshotV2> {
      const request = deepFreeze(parseSourcingLookupRequest(input));
      const policy = policies.get(request.provider);
      if (policy === undefined) throw new Error(`No V2 provider policy is registered for ${request.provider}`);
      assertProviderPolicyAllowsOperationV2(policy, options.executionMode);
      if (request.parts.length > policy.lookup.maximumPartsPerRequest) {
        throw new Error(`Exact-MPN request exceeds ${policy.lookup.maximumPartsPerRequest} parts`);
      }
      const adapter = adapters.get(request.provider);
      if (adapter === undefined) throw new Error(`No V2 provider adapter is registered for ${request.provider}`);
      const key = cacheKey(request);
      const cachedSource = await cache.get(key);
      const cacheObservedAt = validNow(now).toISOString();
      let cached: OfferSnapshotV2 | undefined;
      if (cachedSource !== undefined) {
        try {
          cached = validateProviderSnapshotV2(cachedSource, request, policy, cacheObservedAt, true);
        } catch {
          cached = undefined;
        }
      }
      if (cached !== undefined && compareRfc3339InstantsV2(cached.expiresAt, cacheObservedAt) > 0) return cached;
      if (!rateLimiter.consume(request.provider, policy.rateLimit.requestsPerMinute!, validNow(now).getTime())) {
        const observedAt = validNow(now).toISOString();
        if (staleFallbackIsAllowedV2(cached, policy, observedAt)) return cached;
        return errorSnapshotV2(request, "rate_limited", true, observedAt, policy);
      }
      try {
        const source = await withTimeoutV2(
          policy.lookup.timeoutMilliseconds,
          (signal) => adapter.lookup(request, { signal }),
        );
        const observedAt = validNow(now).toISOString();
        const snapshot = validateProviderSnapshotV2(source, request, policy, observedAt);
        const deletionDeadline = plusSeconds(snapshot.retrievedAt, policy.persistence.deleteAfterSeconds);
        const retentionSeconds = Math.min(
          secondsBetween(deletionDeadline, observedAt),
          secondsBetween(snapshot.expiresAt, observedAt) + policy.cache.staleIfErrorSeconds,
        );
        if (snapshot.status !== "provider_error") await cache.set(key, snapshot, retentionSeconds);
        return snapshot;
      } catch (error) {
        const observedAt = validNow(now).toISOString();
        if (staleFallbackIsAllowedV2(cached, policy, observedAt)) return cached;
        const mapped = errorCode(error);
        return errorSnapshotV2(request, mapped.code, mapped.retryable, observedAt, policy);
      }
    },
  };
}
