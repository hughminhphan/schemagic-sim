import type { OfferSnapshot } from "@opencircuit/sourcing-schema";
import type { SnapshotCache } from "./cache";
import type { ProviderRuntimePolicy, SourcingProviderAdapter } from "./provider";
import type { ProviderRateLimiter } from "./rate-limit";

export const LEGACY_SOURCING_SERVICE_V1_AUDIT_ONLY_CODE = "legacy_v1_sourcing_service_audit_only" as const;
export const LEGACY_SOURCING_SERVICE_V1_AUDIT_ONLY_MESSAGE =
  "Legacy V1 sourcing service is audit-only and cannot execute provider lookups; use createSourcingServiceV2 with a canonical V2 provider policy" as const;

export class LegacySourcingServiceV1AuditOnlyError extends Error {
  readonly code = LEGACY_SOURCING_SERVICE_V1_AUDIT_ONLY_CODE;

  constructor() {
    super(LEGACY_SOURCING_SERVICE_V1_AUDIT_ONLY_MESSAGE);
    this.name = "LegacySourcingServiceV1AuditOnlyError";
  }
}

export interface SourcingService {
  lookup(input: unknown): Promise<OfferSnapshot>;
}

export type SourcingExecutionMode = "public_hosted" | "self_hosted";

/**
 * Compatibility shape for historical callers. V1 policies cannot bind the
 * content-addressed recorded approval required by the native V2 authority.
 */
export interface SourcingServiceOptions {
  executionMode: SourcingExecutionMode;
  adapters: readonly SourcingProviderAdapter[];
  policies: readonly ProviderRuntimePolicy[];
  cache?: SnapshotCache;
  rateLimiter?: ProviderRateLimiter;
  now?: () => Date;
}

/**
 * Preserves the historical API shape for audit and migration only. Every V1
 * lookup rejects before cache, rate-limiter, clock, or adapter state is read.
 */
export function createSourcingService(options: SourcingServiceOptions): SourcingService {
  if (options.executionMode !== "public_hosted" && options.executionMode !== "self_hosted") {
    throw new Error("Sourcing service executionMode must be public_hosted or self_hosted");
  }
  return Object.freeze({
    async lookup(): Promise<OfferSnapshot> {
      throw new LegacySourcingServiceV1AuditOnlyError();
    },
  });
}
