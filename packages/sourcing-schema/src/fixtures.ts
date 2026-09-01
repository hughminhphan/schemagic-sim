/**
 * Entirely synthetic sourcing data for contract and engine tests. Names, SKUs,
 * prices, stock, and URLs below are invented and were not copied from providers.
 */
import { calculateOfferSnapshotContentHash } from "./canonical";
import { DISTRIBUTOR_IDS, type DistributorId, type ManufacturerPartIdentity } from "./ids";
import {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
  type CandidateSourcingMetrics,
} from "./metrics";
import type { DistributorOffer } from "./offer";
import {
  SOURCING_POLICY_SCHEMA_VERSION,
  type SourcingPolicy,
} from "./policy";
import {
  OFFER_SNAPSHOT_SCHEMA_VERSION,
  type OfferSnapshot,
  type ProviderError,
  type ProviderRequestStatus,
} from "./snapshot";

export interface SyntheticSourcingFixture {
  description: string;
  policy: SourcingPolicy;
  snapshots: OfferSnapshot[];
  metrics: CandidateSourcingMetrics;
}

const RETRIEVED_AT = "2026-08-23T00:00:00.000Z";
const EXPIRES_AT = "2026-08-23T01:00:00.000Z";
export const SYNTHETIC_FIXTURE_EVALUATED_AT = "2026-08-23T00:30:00.000Z";

function policy(overrides: Partial<SourcingPolicy> = {}): SourcingPolicy {
  return {
    schemaVersion: SOURCING_POLICY_SCHEMA_VERSION,
    distributors: [DISTRIBUTOR_IDS.digikey, DISTRIBUTOR_IDS.mouser],
    mode: "any_selected",
    buildQuantity: 100,
    region: "US",
    currency: "USD",
    allowedLifecycle: ["active"],
    minimumStock: 100,
    maximumLeadTimeDays: 30,
    allowBackorder: false,
    allowMarketplace: false,
    packaging: ["cut_tape", "reel"],
    maximumSnapshotAgeSeconds: 3_600,
    ...overrides,
  };
}

interface SyntheticOfferRequired {
  distributor: DistributorId;
  distributorSku: string;
  part: ManufacturerPartIdentity;
}

function offer(required: SyntheticOfferRequired, overrides: Partial<DistributorOffer> = {}): DistributorOffer {
  return {
    distributor: required.distributor,
    distributorSku: required.distributorSku,
    part: required.part,
    region: "US",
    currency: "USD",
    packaging: "cut_tape",
    marketplace: false,
    backorderAvailable: false,
    stockQuantity: 1_000,
    minimumOrderQuantity: 1,
    orderMultiple: 1,
    leadTimeDays: 14,
    leadTimeKind: "manufacturer",
    lifecycle: "active",
    lifecycleSource: "manufacturer",
    priceBreaks: [
      { quantity: 1, unitPrice: 1.25 },
      { quantity: 100, unitPrice: 0.8 },
    ],
    productUrl: `https://example.invalid/${required.distributor}/${required.distributorSku}`,
    retrievedAt: RETRIEVED_AT,
    ...overrides,
  };
}

interface SnapshotOptions {
  id: string;
  provider: DistributorId;
  requestedParts: ManufacturerPartIdentity[];
  offers?: DistributorOffer[];
  status?: ProviderRequestStatus;
  errors?: ProviderError[];
  retrievedAt?: string;
  expiresAt?: string;
}

function snapshot(options: SnapshotOptions): OfferSnapshot {
  const withoutHash: Omit<OfferSnapshot, "contentHash"> = {
    schemaVersion: OFFER_SNAPSHOT_SCHEMA_VERSION,
    id: options.id,
    provider: options.provider,
    requestedParts: options.requestedParts,
    retrievedAt: options.retrievedAt ?? RETRIEVED_AT,
    expiresAt: options.expiresAt ?? EXPIRES_AT,
    persistence: "ephemeral",
    status: options.status ?? "complete",
    errors: options.errors ?? [],
    offers: options.offers ?? [],
  };
  return { ...withoutHash, contentHash: calculateOfferSnapshotContentHash(withoutHash) };
}

function part(manufacturerPartNumber: string): ManufacturerPartIdentity {
  return { manufacturerId: "synthetic-components", manufacturerPartNumber };
}

const digikeyDriver = offer(
  { distributor: DISTRIBUTOR_IDS.digikey, distributorSku: "SYN-DK-DRIVER-1", part: part("SYN-DRIVER-A") },
  { stockQuantity: 200 },
);
const digikeyCapacitor = offer(
  { distributor: DISTRIBUTOR_IDS.digikey, distributorSku: "SYN-DK-CAP-1", part: part("SYN-CAP-A") },
  {
    stockQuantity: 1_000,
    priceBreaks: [
      { quantity: 1, unitPrice: 0.08 },
      { quantity: 100, unitPrice: 0.05 },
    ],
  },
);
const mouserDriver = offer(
  { distributor: DISTRIBUTOR_IDS.mouser, distributorSku: "SYN-MOU-DRIVER-1", part: part("SYN-DRIVER-A") },
  { stockQuantity: 400, priceBreaks: [{ quantity: 1, unitPrice: 0.9 }, { quantity: 100, unitPrice: 0.75 }] },
);
const mouserCapacitor = offer(
  { distributor: DISTRIBUTOR_IDS.mouser, distributorSku: "SYN-MOU-CAP-1", part: part("SYN-CAP-A") },
  { stockQuantity: 600, priceBreaks: [{ quantity: 1, unitPrice: 0.07 }, { quantity: 100, unitPrice: 0.045 }] },
);

const digikeyCompleteSnapshot = snapshot({
  id: "snapshot:synthetic:digikey:active-100",
  provider: DISTRIBUTOR_IDS.digikey,
  requestedParts: [part("SYN-DRIVER-A"), part("SYN-CAP-A")],
  offers: [digikeyDriver, digikeyCapacitor],
});

const mouserCompleteSnapshot = snapshot({
  id: "snapshot:synthetic:mouser:active-100",
  provider: DISTRIBUTOR_IDS.mouser,
  requestedParts: [part("SYN-DRIVER-A"), part("SYN-CAP-A")],
  offers: [mouserDriver, mouserCapacitor],
});

const completeMetrics: CandidateSourcingMetrics = {
  schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
  status: "complete",
  requestedBuildQuantity: 100,
  evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
  snapshotIds: [digikeyCompleteSnapshot.id],
  snapshotAgeSeconds: 1_800,
  earliestSnapshotExpiresAt: EXPIRES_AT,
  lines: [
    {
      bomLineId: "driver",
      part: part("SYN-DRIVER-A"),
      quantityPerAssembly: 1,
      status: "sourced",
      selectedOffer: { snapshotId: digikeyCompleteSnapshot.id, distributor: DISTRIBUTOR_IDS.digikey, distributorSku: digikeyDriver.distributorSku },
      packaging: "cut_tape",
      lifecycle: "active",
      stockQuantity: 200,
      purchaseQuantity: 100,
      buildableQuantity: 200,
      extendedCost: { amount: 80, currency: "USD" },
      leadTimeDays: 14,
      leadTimeKind: "manufacturer",
      warnings: [],
    },
    {
      bomLineId: "bulk-capacitor",
      part: part("SYN-CAP-A"),
      quantityPerAssembly: 2,
      status: "sourced",
      selectedOffer: { snapshotId: digikeyCompleteSnapshot.id, distributor: DISTRIBUTOR_IDS.digikey, distributorSku: digikeyCapacitor.distributorSku },
      packaging: "cut_tape",
      lifecycle: "active",
      stockQuantity: 1_000,
      purchaseQuantity: 200,
      buildableQuantity: 500,
      extendedCost: { amount: 10, currency: "USD" },
      leadTimeDays: 14,
      leadTimeKind: "manufacturer",
      warnings: [],
    },
  ],
  buildableQuantity: 200,
  extendedBomCost: { amount: 90, currency: "USD" },
  bottleneckPart: { bomLineId: "driver", part: part("SYN-DRIVER-A"), reason: "stock" },
  maximumLeadTimeDays: 14,
  maximumLeadTimeKind: "manufacturer",
  lifecycleCounts: { active: 2, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 },
  distributorSplitCount: 1,
  singleDistributorComplete: true,
  warnings: [],
};

const singleDistributorMetrics: CandidateSourcingMetrics = {
  ...completeMetrics,
  snapshotIds: [digikeyCompleteSnapshot.id, mouserCompleteSnapshot.id],
  lines: [
    {
      ...completeMetrics.lines[0]!,
      selectedOffer: { snapshotId: mouserCompleteSnapshot.id, distributor: DISTRIBUTOR_IDS.mouser, distributorSku: mouserDriver.distributorSku },
      stockQuantity: 400,
      purchaseQuantity: 100,
      buildableQuantity: 400,
      extendedCost: { amount: 75, currency: "USD" },
    },
    {
      ...completeMetrics.lines[1]!,
      selectedOffer: { snapshotId: mouserCompleteSnapshot.id, distributor: DISTRIBUTOR_IDS.mouser, distributorSku: mouserCapacitor.distributorSku },
      stockQuantity: 600,
      purchaseQuantity: 200,
      buildableQuantity: 300,
      extendedCost: { amount: 9, currency: "USD" },
    },
  ],
  buildableQuantity: 300,
  extendedBomCost: { amount: 84, currency: "USD" },
  bottleneckPart: { bomLineId: "bulk-capacitor", part: part("SYN-CAP-A"), reason: "stock" },
};

const mixedDistributorMetrics: CandidateSourcingMetrics = {
  ...completeMetrics,
  snapshotIds: [digikeyCompleteSnapshot.id, mouserCompleteSnapshot.id],
  lines: [
    completeMetrics.lines[0]!,
    {
      ...completeMetrics.lines[1]!,
      selectedOffer: { snapshotId: mouserCompleteSnapshot.id, distributor: DISTRIBUTOR_IDS.mouser, distributorSku: mouserCapacitor.distributorSku },
      stockQuantity: 600,
      purchaseQuantity: 200,
      buildableQuantity: 300,
      extendedCost: { amount: 9, currency: "USD" },
    },
  ],
  extendedBomCost: { amount: 89, currency: "USD" },
  distributorSplitCount: 2,
  singleDistributorComplete: false,
};

const lifecycleSnapshot = snapshot({
  id: "snapshot:synthetic:digikey:lifecycle-matrix",
  provider: DISTRIBUTOR_IDS.digikey,
  requestedParts: [part("SYN-OBSOLETE"), part("SYN-NRND"), part("SYN-UNKNOWN")],
  offers: [
    offer(
      { distributor: DISTRIBUTOR_IDS.digikey, distributorSku: "SYN-DK-OBSOLETE", part: part("SYN-OBSOLETE") },
      { lifecycle: "obsolete", lifecycleSource: "manufacturer", stockQuantity: 12 },
    ),
    offer(
      { distributor: DISTRIBUTOR_IDS.digikey, distributorSku: "SYN-DK-NRND", part: part("SYN-NRND") },
      { lifecycle: "nrnd", lifecycleSource: "manufacturer", stockQuantity: 300 },
    ),
    offer(
      { distributor: DISTRIBUTOR_IDS.digikey, distributorSku: "SYN-DK-UNKNOWN", part: part("SYN-UNKNOWN") },
      { lifecycle: "unknown", lifecycleSource: "unknown", stockQuantity: 500 },
    ),
  ],
});

const lifecycleMetrics: CandidateSourcingMetrics = {
  schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
  status: "complete",
  requestedBuildQuantity: 100,
  evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
  snapshotIds: [lifecycleSnapshot.id],
  lines: [
    { bomLineId: "obsolete", part: part("SYN-OBSOLETE"), quantityPerAssembly: 1, status: "policy_rejected", lifecycle: "obsolete", warnings: ["Obsolete lifecycle is never allowed by policy"] },
    { bomLineId: "nrnd", part: part("SYN-NRND"), quantityPerAssembly: 1, status: "sourced", selectedOffer: { snapshotId: lifecycleSnapshot.id, distributor: DISTRIBUTOR_IDS.digikey, distributorSku: "SYN-DK-NRND" }, packaging: "cut_tape", lifecycle: "nrnd", stockQuantity: 300, purchaseQuantity: 100, buildableQuantity: 300, extendedCost: { amount: 80, currency: "USD" }, leadTimeDays: 14, leadTimeKind: "manufacturer", warnings: [] },
    { bomLineId: "unknown", part: part("SYN-UNKNOWN"), quantityPerAssembly: 1, status: "unknown", lifecycle: "unknown", stockQuantity: 500, warnings: ["Lifecycle is unknown"] },
  ],
  buildableQuantity: 0,
  bottleneckPart: { bomLineId: "obsolete", part: part("SYN-OBSOLETE"), reason: "policy" },
  lifecycleCounts: { active: 0, nrnd: 1, last_time_buy: 0, obsolete: 1, unknown: 1 },
  distributorSplitCount: 1,
  singleDistributorComplete: false,
  warnings: ["One obsolete line failed policy and one lifecycle state is unknown"],
};

const staleDriver = offer(
  { distributor: DISTRIBUTOR_IDS.digikey, distributorSku: "SYN-DK-DRIVER-1", part: part("SYN-DRIVER-A") },
  { stockQuantity: 200, retrievedAt: "2026-08-22T00:00:00.000Z" },
);

const staleSnapshot = snapshot({
  id: "snapshot:synthetic:digikey:stale",
  provider: DISTRIBUTOR_IDS.digikey,
  requestedParts: [part("SYN-DRIVER-A")],
  offers: [staleDriver],
  retrievedAt: "2026-08-22T00:00:00.000Z",
  expiresAt: "2026-08-22T01:00:00.000Z",
});

const staleMetrics: CandidateSourcingMetrics = {
  ...completeMetrics,
  status: "stale",
  snapshotIds: [staleSnapshot.id],
  snapshotAgeSeconds: 88_200,
  earliestSnapshotExpiresAt: staleSnapshot.expiresAt,
  lines: [
    {
      ...completeMetrics.lines[0]!,
      selectedOffer: { snapshotId: staleSnapshot.id, distributor: DISTRIBUTOR_IDS.digikey, distributorSku: digikeyDriver.distributorSku },
      warnings: ["Offer snapshot is stale"],
    },
  ],
  buildableQuantity: 200,
  extendedBomCost: { amount: 80, currency: "USD" },
  bottleneckPart: { bomLineId: "driver", part: part("SYN-DRIVER-A"), reason: "stock" },
  lifecycleCounts: { active: 1, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 },
  warnings: ["Refresh offers before relying on availability"],
};

const partialSnapshot = snapshot({
  id: "snapshot:synthetic:mouser:partial",
  provider: DISTRIBUTOR_IDS.mouser,
  requestedParts: [part("SYN-DRIVER-A"), part("SYN-CAP-A")],
  offers: [mouserDriver],
  status: "partial",
  errors: [{ code: "timeout", message: "Synthetic timeout after the first exact-MPN lookup", retryable: true }],
});

const providerErrorSnapshot = snapshot({
  id: "snapshot:synthetic:digikey:provider-error",
  provider: DISTRIBUTOR_IDS.digikey,
  requestedParts: [part("SYN-DRIVER-A"), part("SYN-CAP-A")],
  status: "provider_error",
  errors: [{ code: "rate_limited", message: "Synthetic provider rate-limit response", retryable: true }],
});

const partialMetrics: CandidateSourcingMetrics = {
  schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
  status: "partial",
  requestedBuildQuantity: 100,
  evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
  snapshotIds: [partialSnapshot.id],
  snapshotAgeSeconds: 1_800,
  earliestSnapshotExpiresAt: EXPIRES_AT,
  lines: [
    {
      ...singleDistributorMetrics.lines[0]!,
      selectedOffer: { snapshotId: partialSnapshot.id, distributor: DISTRIBUTOR_IDS.mouser, distributorSku: mouserDriver.distributorSku },
    },
    { bomLineId: "bulk-capacitor", part: part("SYN-CAP-A"), quantityPerAssembly: 2, status: "unavailable", lifecycle: "unknown", warnings: ["Provider lookup did not complete"] },
  ],
  buildableQuantity: 0,
  bottleneckPart: { bomLineId: "bulk-capacitor", part: part("SYN-CAP-A"), reason: "unavailable" },
  lifecycleCounts: { active: 1, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 1 },
  distributorSplitCount: 1,
  singleDistributorComplete: false,
  warnings: ["Provider returned only part of the requested offer set"],
};

const providerErrorMetrics: CandidateSourcingMetrics = {
  schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
  status: "provider_error",
  requestedBuildQuantity: 100,
  evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
  snapshotIds: [providerErrorSnapshot.id],
  snapshotAgeSeconds: 1_800,
  earliestSnapshotExpiresAt: EXPIRES_AT,
  lines: [],
  lifecycleCounts: { active: 0, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 },
  warnings: ["Synthetic provider error; electrical generation remains available"],
};

export const SYNTHETIC_SOURCING_FIXTURES: Record<string, SyntheticSourcingFixture> = {
  offline: {
    description: "No offer snapshots; electrical generation remains available",
    policy: policy(),
    snapshots: [],
    metrics: {
      schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
      status: "unavailable",
      requestedBuildQuantity: 100,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
      snapshotIds: [],
      lines: [],
      lifecycleCounts: { active: 0, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 },
      warnings: ["No sourcing data was requested or available"],
    },
  },
  digikeyOnlyActiveInStockBuild100: {
    description: "DigiKey-only, active/in-stock policy for a build quantity of 100",
    policy: policy({ distributors: [DISTRIBUTOR_IDS.digikey] }),
    snapshots: [digikeyCompleteSnapshot],
    metrics: completeMetrics,
  },
  singleDistributor: {
    description: "Both providers queried, with the complete BOM selected from one distributor",
    policy: policy({ mode: "single_distributor" }),
    snapshots: [digikeyCompleteSnapshot, mouserCompleteSnapshot],
    metrics: singleDistributorMetrics,
  },
  mixedDistributors: {
    description: "A mixed-distributor BOM using one exact offer from each provider",
    policy: policy({ mode: "any_selected" }),
    snapshots: [digikeyCompleteSnapshot, mouserCompleteSnapshot],
    metrics: mixedDistributorMetrics,
  },
  obsoleteNrndUnknown: {
    description: "Distinct obsolete, NRND, and unknown lifecycle observations",
    policy: policy({ distributors: [DISTRIBUTOR_IDS.digikey], allowedLifecycle: ["active", "nrnd", "unknown"] }),
    snapshots: [lifecycleSnapshot],
    metrics: lifecycleMetrics,
  },
  staleSnapshot: {
    description: "A structurally valid offer snapshot evaluated after expiration",
    policy: policy({ distributors: [DISTRIBUTOR_IDS.digikey] }),
    snapshots: [staleSnapshot],
    metrics: staleMetrics,
  },
  partialProviderResponse: {
    description: "A provider returns one offer and a bounded error for another exact MPN",
    policy: policy({ distributors: [DISTRIBUTOR_IDS.mouser] }),
    snapshots: [partialSnapshot],
    metrics: partialMetrics,
  },
  providerError: {
    description: "A total provider error degrades sourcing without blocking electrical work",
    policy: policy({ distributors: [DISTRIBUTOR_IDS.digikey] }),
    snapshots: [providerErrorSnapshot],
    metrics: providerErrorMetrics,
  },
};

export {
  SYNTHETIC_SOURCING_FIXTURES_V2,
  SYNTHETIC_V2_EVALUATED_AT,
  SYNTHETIC_V2_RETRIEVED_AT,
  type SyntheticSourcingFixtureV2,
} from "./fixtures-v2";
