import {
  OFFER_SNAPSHOT_SCHEMA_VERSION,
  calculateOfferSnapshotContentHash,
  parseOfferSnapshot,
  type DistributorId,
  type DistributorOffer,
  type ManufacturerPartIdentity,
  type OfferSnapshot,
  type PackagingType,
  type PriceBreak,
  type ProviderError,
} from "@opencircuit/sourcing-schema";
import { createHash } from "node:crypto";
import { ProviderAdapterError } from "../provider";

export interface ProviderOfferDraft {
  distributor: DistributorId;
  distributorSku?: string | undefined;
  part: ManufacturerPartIdentity;
  region: string;
  currency: string;
  packaging?: PackagingType | undefined;
  marketplace?: boolean | undefined;
  backorderAvailable?: boolean | undefined;
  stockQuantity?: number | undefined;
  minimumOrderQuantity?: number | undefined;
  orderMultiple?: number | undefined;
  leadTimeDays?: number | undefined;
  leadTimeKind?: DistributorOffer["leadTimeKind"] | undefined;
  lifecycle: DistributorOffer["lifecycle"];
  lifecycleSource: DistributorOffer["lifecycleSource"];
  lastTimeBuyAt?: string | undefined;
  priceBreaks: PriceBreak[];
  productUrl?: string | undefined;
  retrievedAt: string;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function partKey(part: ManufacturerPartIdentity): string {
  return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
}

export function parseNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parsePositiveInteger(value: unknown): number | undefined {
  const parsed = parseNonNegativeInteger(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

export function parseAsciiDecimal(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function normalizePriceBreaks(
  source: readonly { quantity: unknown; unitPrice: unknown }[],
): PriceBreak[] {
  const byQuantity = new Map<number, number>();
  const conflictingQuantities = new Set<number>();
  for (const entry of source) {
    const quantity = parsePositiveInteger(entry.quantity);
    const unitPrice = parseAsciiDecimal(entry.unitPrice);
    if (quantity === undefined || unitPrice === undefined) continue;
    const previous = byQuantity.get(quantity);
    if (previous !== undefined && previous !== unitPrice) conflictingQuantities.add(quantity);
    else byQuantity.set(quantity, unitPrice);
  }
  return [...byQuantity]
    .filter(([quantity]) => !conflictingQuantities.has(quantity))
    .sort(([left], [right]) => left - right)
    .map(([quantity, unitPrice]) => ({ quantity, unitPrice }));
}

export function finalizeOfferDraft(draft: ProviderOfferDraft): DistributorOffer | undefined {
  if (draft.distributorSku === undefined || draft.distributorSku.trim() === "") return undefined;
  if (draft.packaging === undefined || draft.marketplace === undefined || draft.backorderAvailable === undefined) return undefined;
  if (draft.productUrl === undefined || !/^https?:\/\//.test(draft.productUrl)) return undefined;
  return {
    distributor: draft.distributor,
    distributorSku: draft.distributorSku,
    part: { ...draft.part },
    region: draft.region,
    currency: draft.currency,
    packaging: draft.packaging,
    marketplace: draft.marketplace,
    backorderAvailable: draft.backorderAvailable,
    ...(draft.stockQuantity === undefined ? {} : { stockQuantity: draft.stockQuantity }),
    ...(draft.minimumOrderQuantity === undefined ? {} : { minimumOrderQuantity: draft.minimumOrderQuantity }),
    ...(draft.orderMultiple === undefined ? {} : { orderMultiple: draft.orderMultiple }),
    ...(draft.leadTimeDays === undefined || draft.leadTimeKind === undefined
      ? {}
      : { leadTimeDays: draft.leadTimeDays, leadTimeKind: draft.leadTimeKind }),
    lifecycle: draft.lifecycle,
    lifecycleSource: draft.lifecycleSource,
    ...(draft.lastTimeBuyAt === undefined ? {} : { lastTimeBuyAt: draft.lastTimeBuyAt }),
    priceBreaks: draft.priceBreaks.map((priceBreak) => ({ ...priceBreak })),
    productUrl: draft.productUrl,
    retrievedAt: draft.retrievedAt,
  };
}

export function createNormalizedSnapshot(input: {
  provider: DistributorId;
  requestedParts: readonly ManufacturerPartIdentity[];
  retrievedAt: string;
  ttlSeconds: number;
  offers: readonly DistributorOffer[];
  errors: readonly ProviderError[];
}): OfferSnapshot {
  if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds <= 0) {
    throw new Error("Normalized snapshot TTL must be a positive integer");
  }
  const requestedParts = input.requestedParts
    .map((part) => ({ ...part }))
    .sort((left, right) => compareText(partKey(left), partKey(right)));
  const offers = input.offers
    .map((offer) => ({
      ...offer,
      part: { ...offer.part },
      priceBreaks: offer.priceBreaks.map((priceBreak) => ({ ...priceBreak })),
    }))
    .sort((left, right) => compareText(partKey(left.part), partKey(right.part))
      || compareText(left.distributorSku, right.distributorSku));
  const errors = input.errors
    .map((error) => ({ ...error }))
    .sort((left, right) => compareText(left.code, right.code)
      || compareText(left.message, right.message)
      || Number(left.retryable) - Number(right.retryable));
  const status = errors.length === 0 ? "complete" : "partial";
  const requestDigest = createHash("sha256")
    .update(JSON.stringify({ provider: input.provider, requestedParts }))
    .digest("hex")
    .slice(0, 16);
  const withoutHash: Omit<OfferSnapshot, "contentHash"> = {
    schemaVersion: OFFER_SNAPSHOT_SCHEMA_VERSION,
    id: `snapshot:${input.provider}:${input.retrievedAt}:${requestDigest}`,
    provider: input.provider,
    requestedParts,
    retrievedAt: input.retrievedAt,
    expiresAt: new Date(Date.parse(input.retrievedAt) + input.ttlSeconds * 1_000).toISOString(),
    persistence: "ephemeral",
    status,
    errors,
    offers,
  };
  return parseOfferSnapshot({
    ...withoutHash,
    contentHash: calculateOfferSnapshotContentHash(withoutHash),
  });
}

export function invalidNormalizationError(providerName: string): ProviderError {
  return {
    code: "invalid_response",
    message: `${providerName} exact result could not be normalized without guessing`,
    retryable: false,
  };
}

export function sanitizedTransportError(providerName: string, error: unknown): ProviderAdapterError {
  if (error instanceof ProviderAdapterError) {
    return new ProviderAdapterError(error.code, `${providerName} transport failed`, error.retryable);
  }
  return new ProviderAdapterError("upstream", `${providerName} transport failed`, true);
}
