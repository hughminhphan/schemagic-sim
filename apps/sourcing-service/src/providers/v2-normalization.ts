import {
  OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
  PROVIDER_ERROR_CATALOG_VERSION_V2,
  finalizeOfferSnapshotV2,
  isVerifiedDistributorProductUrlV2,
  parseOfferSnapshotV2,
  type DistributorId,
  type DistributorOffer,
  type DistributorOfferV2,
  type ManufacturerPartIdentity,
  type OfferSnapshotV2,
  type ProviderErrorV2,
  type SourcingObservation,
} from "@opencircuit/sourcing-schema";
import type { ProviderOfferDraft } from "./normalization";

const known = <T>(value: T): SourcingObservation<T> => ({ state: "known", value });
const unknown = <T>(reason: "not_reported" | "not_supported" | "unmapped" | "conflicting"): SourcingObservation<T> => ({ state: "unknown", reason });

export function providerErrorV2(
  code: ProviderErrorV2["code"],
  retryable: boolean,
): ProviderErrorV2 {
  return { catalogVersion: PROVIDER_ERROR_CATALOG_VERSION_V2, code, retryable };
}

export function invalidNormalizationErrorV2(): ProviderErrorV2 {
  return providerErrorV2("invalid_response", false);
}

export function promoteCompleteOfferV1ToV2(
  offer: Readonly<DistributorOffer>,
): DistributorOfferV2 | undefined {
  const lifecycle = offer.lifecycle === "unknown"
    ? unknown<Exclude<DistributorOffer["lifecycle"], "unknown">>("unmapped")
    : known(offer.lifecycle);
  const lifecycleSource = offer.lifecycleSource === "unknown"
    ? unknown<Exclude<DistributorOffer["lifecycleSource"], "unknown">>("unmapped")
    : known(offer.lifecycleSource);
  const hasLeadTime = offer.leadTimeDays !== undefined
    && offer.leadTimeKind !== undefined
    && offer.leadTimeKind !== "unknown";
  const candidate: DistributorOfferV2 = {
    distributor: offer.distributor,
    distributorSku: offer.distributorSku,
    part: { ...offer.part },
    region: known(offer.region),
    currency: known(offer.currency),
    packaging: known(offer.packaging),
    marketplace: known(offer.marketplace),
    backorderAvailable: known(offer.backorderAvailable),
    ...(offer.stockQuantity === undefined ? {} : { stockQuantity: offer.stockQuantity }),
    ...(offer.minimumOrderQuantity === undefined ? {} : { minimumOrderQuantity: offer.minimumOrderQuantity }),
    ...(offer.orderMultiple === undefined ? {} : { orderMultiple: offer.orderMultiple }),
    leadTimeDays: hasLeadTime ? known(offer.leadTimeDays!) : unknown("not_reported"),
    leadTimeKind: hasLeadTime ? known(offer.leadTimeKind as "manufacturer" | "estimated_ship" | "factory") : unknown("not_reported"),
    lifecycle,
    lifecycleSource,
    ...(offer.lastTimeBuyAt === undefined ? {} : { lastTimeBuyAt: offer.lastTimeBuyAt }),
    priceBreaks: offer.priceBreaks.map((entry) => ({ ...entry })),
    productUrl: offer.productUrl,
    retrievedAt: offer.retrievedAt,
  };
  return isVerifiedDistributorProductUrlV2(candidate) ? candidate : undefined;
}

export function promoteMouserDraftToV2(
  draft: Readonly<ProviderOfferDraft>,
): DistributorOfferV2 | undefined {
  if (draft.distributorSku === undefined || draft.distributorSku.trim() === ""
    || draft.productUrl === undefined) return undefined;
  const currencyKnown = draft.priceBreaks.length > 0;
  const candidate: DistributorOfferV2 = {
    distributor: draft.distributor,
    distributorSku: draft.distributorSku,
    part: { ...draft.part },
    region: unknown("not_reported"),
    currency: currencyKnown ? known(draft.currency) : unknown("not_reported"),
    packaging: unknown("not_supported"),
    marketplace: unknown("not_reported"),
    backorderAvailable: unknown("unmapped"),
    ...(draft.stockQuantity === undefined ? {} : { stockQuantity: draft.stockQuantity }),
    ...(draft.minimumOrderQuantity === undefined ? {} : { minimumOrderQuantity: draft.minimumOrderQuantity }),
    ...(draft.orderMultiple === undefined ? {} : { orderMultiple: draft.orderMultiple }),
    leadTimeDays: unknown("unmapped"),
    leadTimeKind: unknown("unmapped"),
    lifecycle: unknown("unmapped"),
    lifecycleSource: unknown("unmapped"),
    priceBreaks: currencyKnown ? draft.priceBreaks.map((entry) => ({ ...entry })) : [],
    productUrl: draft.productUrl,
    retrievedAt: draft.retrievedAt,
  };
  return isVerifiedDistributorProductUrlV2(candidate) ? candidate : undefined;
}

export function createNormalizedSnapshotV2(input: {
  provider: DistributorId;
  requestedParts: readonly ManufacturerPartIdentity[];
  retrievedAt: string;
  expiresAt: string;
  offers: readonly DistributorOfferV2[];
  errors: readonly ProviderErrorV2[];
}): OfferSnapshotV2 {
  const errors = [...new Map(input.errors.map((error) => [
    `${error.code}\u0000${Number(error.retryable)}`,
    { ...error },
  ])).values()];
  const snapshot = finalizeOfferSnapshotV2({
    schemaVersion: OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
    provider: input.provider,
    requestedParts: input.requestedParts.map((part) => ({ ...part })),
    retrievedAt: input.retrievedAt,
    expiresAt: input.expiresAt,
    persistence: "ephemeral",
    evaluationEligibility: "native_v2",
    status: errors.length === 0 ? "complete" : "partial",
    errors,
    offers: input.offers.map((offer) => structuredClone(offer)),
    lineage: [],
  });
  return parseOfferSnapshotV2(snapshot);
}
