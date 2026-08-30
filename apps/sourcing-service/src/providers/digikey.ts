import {
  DISTRIBUTOR_IDS,
  type DistributorOffer,
  type ManufacturerPartIdentity,
  type PackagingType,
} from "@opencircuit/sourcing-schema";
import type { ProviderLookupContext, SourcingProviderAdapter } from "../provider";
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
  promoteCompleteOfferV1ToV2,
} from "./v2-normalization";

export const DIGIKEY_ADAPTER_MAXIMUM_PARTS = 1 as const;

export interface DigiKeyManufacturerReference {
  /** DigiKey's numeric manufacturer ID, obtained from its Manufacturers API. */
  manufacturerId: number;
}

export interface DigiKeyPriceBreakWire {
  BreakQuantity?: unknown;
  UnitPrice?: unknown;
}

export interface DigiKeyProductVariationWire {
  DigiKeyProductNumber?: unknown;
  PackageType?: { Id?: unknown; Name?: unknown };
  StandardPricing?: readonly DigiKeyPriceBreakWire[];
  MarketPlace?: unknown;
  QuantityAvailableforPackageType?: unknown;
  MinimumOrderQuantity?: unknown;
  StandardPackage?: unknown;
}

export interface DigiKeyProductWire {
  Manufacturer?: { Id?: unknown; Name?: unknown };
  ManufacturerProductNumber?: unknown;
  ProductUrl?: unknown;
  ProductVariations?: readonly DigiKeyProductVariationWire[];
  ProductStatus?: { Id?: unknown; Status?: unknown };
  BackOrderNotAllowed?: unknown;
  Discontinued?: unknown;
  EndOfLife?: unknown;
  DateLastBuyChance?: unknown;
  ManufacturerLeadWeeks?: unknown;
}

export interface DigiKeyProductDetailsWireResponse {
  SearchLocaleUsed?: { Site?: unknown; Language?: unknown; Currency?: unknown };
  Product?: DigiKeyProductWire;
}

export interface DigiKeyExactProductTransportRequest {
  productNumber: string;
  manufacturerId: number;
  site: string;
  currency: string;
}

/**
 * Server-only transport boundary. OAuth credentials and raw HTTP details are
 * captured by the injected implementation and never cross this interface.
 */
export interface DigiKeyServerTransport {
  lookupExactProduct(
    request: Readonly<DigiKeyExactProductTransportRequest>,
    context: Readonly<ProviderLookupContext>,
  ): Promise<DigiKeyProductDetailsWireResponse>;
}

export interface CreateDigiKeyProviderAdapterOptions {
  transport: DigiKeyServerTransport;
  manufacturerReferences: Readonly<Record<string, DigiKeyManufacturerReference>>;
  snapshotTtlSeconds: number;
  now?: () => Date;
}

/** Server-only adapter; no credentials or live transport are shipped. */
export interface DigiKeyProviderAdapter extends SourcingProviderAdapter {
  readonly id: typeof DISTRIBUTOR_IDS.digikey;
}

export interface DigiKeyProviderAdapterV2 extends SourcingProviderAdapterV2 {
  readonly id: typeof DISTRIBUTOR_IDS.digikey;
}

const PACKAGE_NAMES: Readonly<Record<string, PackagingType>> = {
  "Tape and Reel(TR)": "reel",
  "Tape and Reel (TR)": "reel",
  "Cut Tape(CT)": "cut_tape",
  "Cut Tape (CT)": "cut_tape",
  "Digi-Reel(DKR)": "reel",
  "Digi-Reel (DKR)": "reel",
  Tube: "tube",
  Tray: "tray",
  Bulk: "bulk",
};

function packaging(value: unknown): PackagingType | undefined {
  return typeof value === "string" ? PACKAGE_NAMES[value] : undefined;
}

function lifecycle(product: DigiKeyProductWire): Pick<DistributorOffer, "lifecycle" | "lifecycleSource"> {
  const status = product.ProductStatus?.Status;
  if (product.EndOfLife === true && status !== undefined && status !== "Obsolete") {
    return { lifecycle: "unknown", lifecycleSource: "unknown" };
  }
  if (product.EndOfLife === true) return { lifecycle: "obsolete", lifecycleSource: "distributor" };
  if (status === "Active") return { lifecycle: "active", lifecycleSource: "distributor" };
  if (status === "Obsolete") return { lifecycle: "obsolete", lifecycleSource: "distributor" };
  if (status === "Last Time Buy") return { lifecycle: "last_time_buy", lifecycleSource: "distributor" };
  if (status === "Not For New Designs") return { lifecycle: "nrnd", lifecycleSource: "distributor" };
  return { lifecycle: "unknown", lifecycleSource: "unknown" };
}

function leadTime(product: DigiKeyProductWire): Pick<ProviderOfferDraft, "leadTimeDays" | "leadTimeKind"> {
  if (typeof product.ManufacturerLeadWeeks !== "string") return {};
  const match = /^(\d+(?:\.\d+)?)(?:\s+weeks?)?$/i.exec(product.ManufacturerLeadWeeks.trim());
  if (match === null) return {};
  const weeks = Number(match[1]);
  return Number.isFinite(weeks) ? { leadTimeDays: weeks * 7, leadTimeKind: "manufacturer" } : {};
}

function lastTimeBuyAt(product: DigiKeyProductWire): string | undefined {
  if (product.ProductStatus?.Status !== "Last Time Buy" || typeof product.DateLastBuyChance !== "string") return undefined;
  return Number.isFinite(Date.parse(product.DateLastBuyChance)) ? new Date(product.DateLastBuyChance).toISOString() : undefined;
}

export function normalizeDigiKeyProduct(
  request: SourcingLookupRequest,
  part: ManufacturerPartIdentity,
  manufacturerReference: DigiKeyManufacturerReference,
  response: DigiKeyProductDetailsWireResponse,
  retrievedAt: string,
): { offers: DistributorOffer[]; complete: boolean } {
  const product = response.Product;
  if (response.SearchLocaleUsed?.Site !== request.region
    || response.SearchLocaleUsed.Currency !== request.currency
    || product === undefined
    || product.Manufacturer?.Id !== manufacturerReference.manufacturerId
    || product.ManufacturerProductNumber !== part.manufacturerPartNumber
    || typeof product.ProductUrl !== "string"
    || typeof product.BackOrderNotAllowed !== "boolean"
    || !Array.isArray(product.ProductVariations)) {
    return { offers: [], complete: false };
  }

  let complete = true;
  const offers: DistributorOffer[] = [];
  const seenSkus = new Set<string>();
  for (const variation of product.ProductVariations as readonly DigiKeyProductVariationWire[]) {
    const draft = finalizeOfferDraft({
      distributor: DISTRIBUTOR_IDS.digikey,
      distributorSku: typeof variation.DigiKeyProductNumber === "string" ? variation.DigiKeyProductNumber : undefined,
      part: { ...part },
      region: request.region,
      currency: request.currency,
      packaging: packaging(variation.PackageType?.Name),
      marketplace: typeof variation.MarketPlace === "boolean" ? variation.MarketPlace : undefined,
      backorderAvailable: !product.BackOrderNotAllowed,
      stockQuantity: parseNonNegativeInteger(variation.QuantityAvailableforPackageType),
      minimumOrderQuantity: parsePositiveInteger(variation.MinimumOrderQuantity),
      ...leadTime(product),
      ...lifecycle(product),
      lastTimeBuyAt: lastTimeBuyAt(product),
      priceBreaks: normalizePriceBreaks((variation.StandardPricing ?? []).map((entry) => ({
        quantity: entry.BreakQuantity,
        unitPrice: entry.UnitPrice,
      }))),
      productUrl: product.ProductUrl,
      retrievedAt,
    });
    if (draft === undefined || seenSkus.has(draft.distributorSku)) complete = false;
    else {
      seenSkus.add(draft.distributorSku);
      offers.push(draft);
    }
  }
  if (offers.length === 0) complete = false;
  return { offers, complete };
}

export function createDigiKeyProviderAdapter(
  options: CreateDigiKeyProviderAdapterOptions,
): DigiKeyProviderAdapter {
  if (!Number.isInteger(options.snapshotTtlSeconds) || options.snapshotTtlSeconds <= 0) {
    throw new Error("DigiKey normalized snapshot TTL must be a positive integer");
  }
  const now = options.now ?? (() => new Date());
  return {
    id: DISTRIBUTOR_IDS.digikey,
    async lookup(request, context) {
      if (request.provider !== DISTRIBUTOR_IDS.digikey) throw new Error("DigiKey adapter received another provider");
      if (request.parts.length !== DIGIKEY_ADAPTER_MAXIMUM_PARTS) {
        throw new Error(`DigiKey exact lookup requires exactly ${DIGIKEY_ADAPTER_MAXIMUM_PARTS} part`);
      }
      const part = request.parts[0]!;
      const manufacturerReference = options.manufacturerReferences[part.manufacturerId];
      if (manufacturerReference === undefined
        || !Number.isInteger(manufacturerReference.manufacturerId)
        || manufacturerReference.manufacturerId <= 0) {
        throw new Error("DigiKey exact lookup requires a configured provider manufacturer ID");
      }
      const retrievedAt = now().toISOString();
      let response: DigiKeyProductDetailsWireResponse;
      try {
        response = await options.transport.lookupExactProduct({
          productNumber: part.manufacturerPartNumber,
          manufacturerId: manufacturerReference.manufacturerId,
          site: request.region,
          currency: request.currency,
        }, context);
      } catch (error) {
        throw sanitizedTransportError("DigiKey", error);
      }
      const normalized = normalizeDigiKeyProduct(request, part, manufacturerReference, response, retrievedAt);
      return createNormalizedSnapshot({
        provider: DISTRIBUTOR_IDS.digikey,
        requestedParts: request.parts,
        retrievedAt,
        ttlSeconds: options.snapshotTtlSeconds,
        offers: normalized.offers,
        errors: normalized.complete ? [] : [invalidNormalizationError("DigiKey")],
      });
    },
  };
}

/** Native V2 adapter. Provider execution remains policy-gated and disabled. */
export function createDigiKeyProviderAdapterV2(
  options: CreateDigiKeyProviderAdapterOptions,
): DigiKeyProviderAdapterV2 {
  if (!Number.isInteger(options.snapshotTtlSeconds) || options.snapshotTtlSeconds <= 0) {
    throw new Error("DigiKey normalized V2 snapshot TTL must be a positive integer");
  }
  const now = options.now ?? (() => new Date());
  return {
    id: DISTRIBUTOR_IDS.digikey,
    async lookup(request, context) {
      if (request.provider !== DISTRIBUTOR_IDS.digikey) throw new Error("DigiKey V2 adapter received another provider");
      if (request.parts.length !== DIGIKEY_ADAPTER_MAXIMUM_PARTS) {
        throw new Error(`DigiKey exact V2 lookup requires exactly ${DIGIKEY_ADAPTER_MAXIMUM_PARTS} part`);
      }
      const part = request.parts[0]!;
      const manufacturerReference = options.manufacturerReferences[part.manufacturerId];
      if (manufacturerReference === undefined
        || !Number.isInteger(manufacturerReference.manufacturerId)
        || manufacturerReference.manufacturerId <= 0) {
        throw new Error("DigiKey exact V2 lookup requires a configured provider manufacturer ID");
      }
      const retrievedAt = now().toISOString();
      let response: DigiKeyProductDetailsWireResponse;
      try {
        response = await options.transport.lookupExactProduct({
          productNumber: part.manufacturerPartNumber,
          manufacturerId: manufacturerReference.manufacturerId,
          site: request.region,
          currency: request.currency,
        }, context);
      } catch (error) {
        throw sanitizedTransportError("DigiKey", error);
      }
      const normalized = normalizeDigiKeyProduct(request, part, manufacturerReference, response, retrievedAt);
      const offers = normalized.offers.flatMap((offer) => {
        const promoted = promoteCompleteOfferV1ToV2(offer);
        return promoted === undefined ? [] : [promoted];
      });
      const complete = normalized.complete && offers.length === normalized.offers.length;
      return createNormalizedSnapshotV2({
        provider: DISTRIBUTOR_IDS.digikey,
        requestedParts: request.parts,
        retrievedAt,
        expiresAt: new Date(Date.parse(retrievedAt) + options.snapshotTtlSeconds * 1_000).toISOString(),
        offers,
        errors: complete ? [] : [invalidNormalizationErrorV2()],
      });
    },
  };
}
