import type { DistributorId, ManufacturerPartIdentity } from "./ids";
import type { LifecycleStatus, PackagingType } from "./policy";

export type LifecycleSource = "manufacturer" | "distributor" | "unknown";
export type LeadTimeKind = "manufacturer" | "estimated_ship" | "factory" | "unknown";

export interface PriceBreak {
  quantity: number;
  unitPrice: number;
}

/**
 * A normalized observation from one provider at one point in time. Undefined
 * volatile fields mean unknown, never zero or active.
 */
export interface DistributorOffer {
  distributor: DistributorId;
  distributorSku: string;
  part: ManufacturerPartIdentity;
  region: string;
  currency: string;
  packaging: PackagingType;
  marketplace: boolean;
  backorderAvailable: boolean;
  stockQuantity?: number;
  minimumOrderQuantity?: number;
  orderMultiple?: number;
  leadTimeDays?: number;
  leadTimeKind?: LeadTimeKind;
  lifecycle: LifecycleStatus;
  lifecycleSource: LifecycleSource;
  lastTimeBuyAt?: string;
  priceBreaks: PriceBreak[];
  productUrl: string;
  retrievedAt: string;
}
