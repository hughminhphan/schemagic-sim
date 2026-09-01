import type { DistributorId } from "./ids";

export const SOURCING_POLICY_SCHEMA_VERSION = 1 as const;

export const LIFECYCLE_STATUSES = ["active", "nrnd", "last_time_buy", "obsolete", "unknown"] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];
export type AllowedLifecycleStatus = Exclude<LifecycleStatus, "obsolete">;

export const PACKAGING_TYPES = ["cut_tape", "reel", "tray", "tube", "bulk"] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];

export interface SourcingPolicy {
  schemaVersion: typeof SOURCING_POLICY_SCHEMA_VERSION;
  distributors: DistributorId[];
  mode: "any_selected" | "single_distributor";
  buildQuantity: number;
  region: string;
  currency: string;
  allowedLifecycle: AllowedLifecycleStatus[];
  minimumStock?: number;
  maximumLeadTimeDays?: number;
  allowBackorder: boolean;
  allowMarketplace: boolean;
  packaging?: PackagingType[];
  maximumSnapshotAgeSeconds: number;
}
