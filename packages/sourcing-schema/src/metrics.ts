import type { DistributorId, ManufacturerPartIdentity } from "./ids";
import type { LifecycleStatus, PackagingType } from "./policy";
import type { LeadTimeKind } from "./offer";

export const CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION = 1 as const;

export type SourcingDataStatus = "unavailable" | "complete" | "partial" | "stale" | "provider_error";
export type BomLineSourcingStatus = "sourced" | "unavailable" | "policy_rejected" | "unknown";

export interface Money {
  amount: number;
  currency: string;
}

export interface SelectedOfferRef {
  snapshotId: string;
  distributor: DistributorId;
  distributorSku: string;
}

export interface BomLineSourcingMetrics {
  bomLineId: string;
  part: ManufacturerPartIdentity;
  quantityPerAssembly: number;
  status: BomLineSourcingStatus;
  selectedOffer?: SelectedOfferRef;
  packaging?: PackagingType;
  lifecycle?: LifecycleStatus;
  stockQuantity?: number;
  purchaseQuantity?: number;
  buildableQuantity?: number;
  extendedCost?: Money;
  leadTimeDays?: number;
  leadTimeKind?: LeadTimeKind;
  warnings: string[];
}

export type BottleneckReason = "stock" | "lead_time" | "unavailable" | "policy";

export interface BomBottleneck {
  bomLineId: string;
  part: ManufacturerPartIdentity;
  reason: BottleneckReason;
}

export type LifecycleCounts = Record<LifecycleStatus, number>;

export interface CandidateSourcingMetrics {
  schemaVersion: typeof CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION;
  status: SourcingDataStatus;
  requestedBuildQuantity: number;
  evaluatedAt: string;
  snapshotIds: string[];
  snapshotAgeSeconds?: number;
  earliestSnapshotExpiresAt?: string;
  lines: BomLineSourcingMetrics[];
  buildableQuantity?: number;
  extendedBomCost?: Money;
  bottleneckPart?: BomBottleneck;
  maximumLeadTimeDays?: number;
  maximumLeadTimeKind?: LeadTimeKind;
  lifecycleCounts: LifecycleCounts;
  distributorSplitCount?: number;
  singleDistributorComplete?: boolean;
  warnings: string[];
}

export function emptyLifecycleCounts(): LifecycleCounts {
  return { active: 0, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 };
}
