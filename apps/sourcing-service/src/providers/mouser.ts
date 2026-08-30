import {
  DISTRIBUTOR_IDS,
  type ManufacturerPartIdentity,
} from "@opencircuit/sourcing-schema";
import { ProviderAdapterError, type ProviderLookupContext, type SourcingProviderAdapter } from "../provider";
import type { SourcingLookupRequest } from "../request";
import type { SourcingProviderAdapterV2 } from "../v2-provider";
import {
  createNormalizedSnapshot,
  finalizeOfferDraft,
  invalidNormalizationError,
  normalizePriceBreaks,
  parseNonNegativeInteger,
  parsePositiveInteger,
  sanitizedTransportError,
  type ProviderOfferDraft,
} from "./normalization";
import {
  createNormalizedSnapshotV2,
  invalidNormalizationErrorV2,
  promoteMouserDraftToV2,
} from "./v2-normalization";

export const MOUSER_ADAPTER_MAXIMUM_PARTS = 10 as const;
export const MOUSER_PART_NUMBER_MINIMUM_LENGTH = 3 as const;
export const MOUSER_PART_NUMBER_MAXIMUM_LENGTH = 40 as const;

export interface MouserManufacturerReference {
  /** Exact value obtained from Mouser's manufacturer-list method. */
  manufacturerName: string;
}

export interface MouserPriceBreakWire {
  Quantity?: unknown;
  Price?: unknown;
  Currency?: unknown;
}

export interface MouserPartWire {
  Availability?: unknown;
  FactoryStock?: unknown;
  LeadTime?: unknown;
  LifecycleStatus?: unknown;
  Manufacturer?: unknown;
  ManufacturerPartNumber?: unknown;
  Min?: unknown;
  Mult?: unknown;
  MouserPartNumber?: unknown;
  PriceBreaks?: readonly MouserPriceBreakWire[];
  ProductDetailUrl?: unknown;
  Reeling?: unknown;
  IsDiscontinued?: unknown;
  AvailableOnOrder?: unknown;
  AvailabilityInStock?: unknown;
}

export interface MouserSearchWireResponse {
  Errors?: readonly { Id?: unknown; Code?: unknown; Message?: unknown }[];
  SearchResults?: {
    NumberOfResult?: unknown;
    Parts?: readonly MouserPartWire[];
  };
}

export interface MouserExactPartsTransportRequest {
  partNumbers: readonly string[];
  manufacturerName: string;
  partSearchOptions: "Exact";
  region: string;
  currency: string;
}

/**
 * Server-only transport boundary. The API key and raw HTTP details are captured
 * by the injected implementation and never cross this interface.
 */
export interface MouserServerTransport {
  lookupExactParts(
    request: Readonly<MouserExactPartsTransportRequest>,
    context: Readonly<ProviderLookupContext>,
  ): Promise<MouserSearchWireResponse>;
}

export interface CreateMouserProviderAdapterOptions {
  transport: MouserServerTransport;
  manufacturerReferences: Readonly<Record<string, MouserManufacturerReference>>;
  snapshotTtlSeconds: number;
  now?: () => Date;
}

/** Server-only adapter; no credentials or live transport are shipped. */
export interface MouserProviderAdapter extends SourcingProviderAdapter {
  readonly id: typeof DISTRIBUTOR_IDS.mouser;
}

export interface MouserProviderAdapterV2 extends SourcingProviderAdapterV2 {
  readonly id: typeof DISTRIBUTOR_IDS.mouser;
}

/**
 * Normalizes only V2 fields whose meanings are documented. The current V2
 * response contract does not provide packaging and does not prove marketplace
 * or backorder booleans, so the returned draft intentionally cannot be promoted
 * to a frozen DistributorOffer.
 */
export function normalizeMouserPartDraft(
  request: SourcingLookupRequest,
  part: ManufacturerPartIdentity,
  manufacturerReference: MouserManufacturerReference,
  wirePart: MouserPartWire,
  retrievedAt: string,
): ProviderOfferDraft | undefined {
  if (wirePart.Manufacturer !== manufacturerReference.manufacturerName
    || wirePart.ManufacturerPartNumber !== part.manufacturerPartNumber) return undefined;
  const priceBreaks = normalizePriceBreaks((wirePart.PriceBreaks ?? [])
    .filter((entry) => entry.Currency === request.currency)
    .map((entry) => ({ quantity: entry.Quantity, unitPrice: entry.Price })));
  return {
    distributor: DISTRIBUTOR_IDS.mouser,
    distributorSku: typeof wirePart.MouserPartNumber === "string" ? wirePart.MouserPartNumber : undefined,
    part: { ...part },
    region: request.region,
    currency: request.currency,
    stockQuantity: parseNonNegativeInteger(wirePart.AvailabilityInStock),
    minimumOrderQuantity: parsePositiveInteger(wirePart.Min),
    orderMultiple: parsePositiveInteger(wirePart.Mult),
    lifecycle: "unknown",
    lifecycleSource: "unknown",
    priceBreaks,
    productUrl: typeof wirePart.ProductDetailUrl === "string" ? wirePart.ProductDetailUrl : undefined,
    retrievedAt,
  };
}

export function normalizeMouserResponse(
  request: SourcingLookupRequest,
  manufacturerReference: MouserManufacturerReference,
  response: MouserSearchWireResponse,
  retrievedAt: string,
): { drafts: ProviderOfferDraft[]; complete: false } {
  const wireParts = response.SearchResults?.Parts;
  if (!Array.isArray(wireParts)) return { drafts: [], complete: false };
  const requestedByMpn = new Map(request.parts.map((part) => [part.manufacturerPartNumber, part]));
  const drafts = wireParts.flatMap((wirePart) => {
    const part = typeof wirePart.ManufacturerPartNumber === "string"
      ? requestedByMpn.get(wirePart.ManufacturerPartNumber)
      : undefined;
    if (part === undefined) return [];
    const draft = normalizeMouserPartDraft(request, part, manufacturerReference, wirePart, retrievedAt);
    return draft === undefined ? [] : [draft];
  });
  return { drafts, complete: false };
}

export function createMouserProviderAdapter(
  options: CreateMouserProviderAdapterOptions,
): MouserProviderAdapter {
  if (!Number.isInteger(options.snapshotTtlSeconds) || options.snapshotTtlSeconds <= 0) {
    throw new Error("Mouser normalized snapshot TTL must be a positive integer");
  }
  const now = options.now ?? (() => new Date());
  return {
    id: DISTRIBUTOR_IDS.mouser,
    async lookup(request, context) {
      if (request.provider !== DISTRIBUTOR_IDS.mouser) throw new Error("Mouser adapter received another provider");
      if (request.parts.length === 0 || request.parts.length > MOUSER_ADAPTER_MAXIMUM_PARTS) {
        throw new Error(`Mouser exact lookup is limited to ${MOUSER_ADAPTER_MAXIMUM_PARTS} parts`);
      }
      if (request.parts.some((part) => part.manufacturerPartNumber.length < MOUSER_PART_NUMBER_MINIMUM_LENGTH
        || part.manufacturerPartNumber.length > MOUSER_PART_NUMBER_MAXIMUM_LENGTH
        || part.manufacturerPartNumber.includes("|"))) {
        throw new Error("Mouser exact part numbers must be 3-40 characters and cannot contain a pipe");
      }
      const references = request.parts.map((part) => options.manufacturerReferences[part.manufacturerId]);
      const manufacturerName = references[0]?.manufacturerName;
      if (manufacturerName === undefined || manufacturerName.trim() === ""
        || references.some((reference) => reference?.manufacturerName !== manufacturerName)) {
        throw new Error("Mouser exact lookup requires one configured provider manufacturer name");
      }
      const retrievedAt = now().toISOString();
      let response: MouserSearchWireResponse;
      try {
        response = await options.transport.lookupExactParts({
          partNumbers: request.parts.map((part) => part.manufacturerPartNumber),
          manufacturerName,
          partSearchOptions: "Exact",
          region: request.region,
          currency: request.currency,
        }, context);
      } catch (error) {
        throw sanitizedTransportError("Mouser", error);
      }
      if ((response.Errors?.length ?? 0) > 0 && !Array.isArray(response.SearchResults?.Parts)) {
        throw new ProviderAdapterError("unknown", "Mouser transport response reported an error", false);
      }
      const normalized = normalizeMouserResponse(request, references[0]!, response, retrievedAt);
      const offers = normalized.drafts.flatMap((draft) => {
        const offer = finalizeOfferDraft(draft);
        return offer === undefined ? [] : [offer];
      });
      return createNormalizedSnapshot({
        provider: DISTRIBUTOR_IDS.mouser,
        requestedParts: request.parts,
        retrievedAt,
        ttlSeconds: options.snapshotTtlSeconds,
        offers,
        errors: [invalidNormalizationError("Mouser")],
      });
    },
  };
}

/**
 * Native V2 keeps documented Mouser fields while expressing unsupported
 * commercial semantics as explicit unknown observations.
 */
export function createMouserProviderAdapterV2(
  options: CreateMouserProviderAdapterOptions,
): MouserProviderAdapterV2 {
  if (!Number.isInteger(options.snapshotTtlSeconds) || options.snapshotTtlSeconds <= 0) {
    throw new Error("Mouser normalized V2 snapshot TTL must be a positive integer");
  }
  const now = options.now ?? (() => new Date());
  return {
    id: DISTRIBUTOR_IDS.mouser,
    async lookup(request, context) {
      if (request.provider !== DISTRIBUTOR_IDS.mouser) throw new Error("Mouser V2 adapter received another provider");
      if (request.parts.length === 0 || request.parts.length > MOUSER_ADAPTER_MAXIMUM_PARTS) {
        throw new Error(`Mouser exact V2 lookup is limited to ${MOUSER_ADAPTER_MAXIMUM_PARTS} parts`);
      }
      if (request.parts.some((part) => part.manufacturerPartNumber.length < MOUSER_PART_NUMBER_MINIMUM_LENGTH
        || part.manufacturerPartNumber.length > MOUSER_PART_NUMBER_MAXIMUM_LENGTH
        || part.manufacturerPartNumber.includes("|"))) {
        throw new Error("Mouser exact V2 part numbers must be 3-40 characters and cannot contain a pipe");
      }
      const references = request.parts.map((part) => options.manufacturerReferences[part.manufacturerId]);
      const manufacturerName = references[0]?.manufacturerName;
      if (manufacturerName === undefined || manufacturerName.trim() === ""
        || references.some((reference) => reference?.manufacturerName !== manufacturerName)) {
        throw new Error("Mouser exact V2 lookup requires one configured provider manufacturer name");
      }
      const retrievedAt = now().toISOString();
      let response: MouserSearchWireResponse;
      try {
        response = await options.transport.lookupExactParts({
          partNumbers: request.parts.map((part) => part.manufacturerPartNumber),
          manufacturerName,
          partSearchOptions: "Exact",
          region: request.region,
          currency: request.currency,
        }, context);
      } catch (error) {
        throw sanitizedTransportError("Mouser", error);
      }
      if ((response.Errors?.length ?? 0) > 0 && !Array.isArray(response.SearchResults?.Parts)) {
        throw new ProviderAdapterError("unknown", "Mouser transport response reported an error", false);
      }
      const normalized = normalizeMouserResponse(request, references[0]!, response, retrievedAt);
      const offers = normalized.drafts.flatMap((draft) => {
        const promoted = promoteMouserDraftToV2(draft);
        return promoted === undefined ? [] : [promoted];
      });
      return createNormalizedSnapshotV2({
        provider: DISTRIBUTOR_IDS.mouser,
        requestedParts: request.parts,
        retrievedAt,
        expiresAt: new Date(Date.parse(retrievedAt) + options.snapshotTtlSeconds * 1_000).toISOString(),
        offers,
        errors: [invalidNormalizationErrorV2()],
      });
    },
  };
}
