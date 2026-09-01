import type { DistributorId, OfferSnapshot, SnapshotPersistence } from "@opencircuit/sourcing-schema";
import type { SourcingLookupRequest } from "./request";

/**
 * Runtime subset of the versioned provider manifest from sourcing-core. The
 * full manifest is structurally assignable to this boundary.
 */
export interface ProviderRuntimePolicy {
  provider: DistributorId;
  displayName: string;
  state: "disabled_pending_approval" | "enabled";
  authorization: {
    approval: "pending" | "approved";
  };
  lookup: {
    exactMpnOnly: true;
    maximumPartsPerRequest: number;
    bulkCaptureAllowed: false;
    timeoutMilliseconds: number;
  };
  rateLimit: {
    state: "unconfigured" | "configured";
    requestsPerMinute?: number;
  };
  cache: {
    maximumTtlSeconds: number;
    staleIfErrorSeconds: number;
  };
  attribution: {
    required: boolean;
    label: string;
  };
  persistence: {
    allowedSnapshotPersistence: readonly SnapshotPersistence[];
    deleteAfterSeconds: number;
  };
  availability: {
    publicHosted: "disabled_pending_approval" | "enabled";
    selfHosted: "disabled_pending_approval" | "enabled";
  };
}

export interface ProviderLookupContext {
  signal: AbortSignal;
}

/**
 * Construct adapters only on the server. Credentials are captured by the
 * implementation and never passed through this method boundary.
 */
export interface SourcingProviderAdapter {
  readonly id: DistributorId;
  lookup(
    request: Readonly<SourcingLookupRequest>,
    context: Readonly<ProviderLookupContext>,
  ): Promise<OfferSnapshot>;
}

export class ProviderAdapterError extends Error {
  readonly code: "rate_limited" | "authentication" | "upstream" | "invalid_response" | "unknown";
  readonly retryable: boolean;

  constructor(
    code: ProviderAdapterError["code"],
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderAdapterError";
    this.code = code;
    this.retryable = retryable;
  }
}
