import type { DistributorId, ManufacturerPartIdentity } from "./ids";
import type { DistributorOffer } from "./offer";

export const OFFER_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type SnapshotPersistence = "ephemeral" | "user_local" | "exportable";
export type ProviderRequestStatus = "complete" | "partial" | "provider_error";

export interface ProviderError {
  code: "timeout" | "rate_limited" | "authentication" | "upstream" | "invalid_response" | "unknown";
  message: string;
  retryable: boolean;
}

export interface OfferSnapshot {
  schemaVersion: typeof OFFER_SNAPSHOT_SCHEMA_VERSION;
  id: string;
  provider: DistributorId;
  requestedParts: ManufacturerPartIdentity[];
  retrievedAt: string;
  expiresAt: string;
  persistence: SnapshotPersistence;
  status: ProviderRequestStatus;
  errors: ProviderError[];
  offers: DistributorOffer[];
  contentHash: string;
}

export type SnapshotFreshness = "fresh" | "stale";

export function snapshotFreshnessAt(
  snapshot: OfferSnapshot,
  evaluatedAt: string | Date,
  maximumAgeSeconds?: number,
): SnapshotFreshness {
  const at = evaluatedAt instanceof Date ? evaluatedAt : new Date(evaluatedAt);
  const providerExpiry = new Date(snapshot.expiresAt).getTime();
  const policyExpiry = maximumAgeSeconds === undefined
    ? providerExpiry
    : new Date(snapshot.retrievedAt).getTime() + maximumAgeSeconds * 1_000;
  return at.getTime() <= Math.min(providerExpiry, policyExpiry) ? "fresh" : "stale";
}
