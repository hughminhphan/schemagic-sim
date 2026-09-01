/**
 * Stable, lowercase registry key. A registry decides which IDs are enabled; the
 * schema deliberately does not close this type over today's providers.
 */
export type DistributorId = string;
export type ManufacturerId = string;

export const DISTRIBUTOR_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
export const MANUFACTURER_ID_PATTERN = DISTRIBUTOR_ID_PATTERN;

/** Vendor-neutral identity used wherever an exact orderable part is referenced. */
export interface ManufacturerPartIdentity {
  manufacturerId: ManufacturerId;
  manufacturerPartNumber: string;
}

/** Stable IDs reserved by the scheMAGIC Sourcing registry. */
export const DISTRIBUTOR_IDS = {
  digikey: "digikey",
  mouser: "mouser",
  lcsc: "lcsc",
} as const satisfies Record<string, DistributorId>;

export interface DistributorRegistryEntry {
  id: DistributorId;
  displayName: string;
  capabilities: readonly ("exact_mpn_search" | "stock" | "pricing" | "lifecycle" | "lead_time")[];
  integration: "live" | "link_only" | "disabled";
}

export function isDistributorId(value: unknown): value is DistributorId {
  return typeof value === "string" && DISTRIBUTOR_ID_PATTERN.test(value);
}

export function assertDistributorId(value: unknown): asserts value is DistributorId {
  if (!isDistributorId(value)) throw new Error("Distributor ID must be a stable lowercase registry key");
}

export function isManufacturerId(value: unknown): value is ManufacturerId {
  return typeof value === "string" && MANUFACTURER_ID_PATTERN.test(value);
}

export function assertManufacturerId(value: unknown): asserts value is ManufacturerId {
  if (!isManufacturerId(value)) throw new Error("Manufacturer ID must be a stable lowercase registry key");
}
