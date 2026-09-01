import {
  calculateOfferSnapshotContentHash,
  parseOfferSnapshot,
  type OfferSnapshot,
} from "@opencircuit/sourcing-schema";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function partKey(part: { manufacturerId: string; manufacturerPartNumber: string }): string {
  return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
}

export function normalizeOfferSnapshot(snapshot: OfferSnapshot): OfferSnapshot {
  const parsed = parseOfferSnapshot(snapshot);
  const withoutHash: Omit<OfferSnapshot, "contentHash"> = {
    ...parsed,
    requestedParts: [...parsed.requestedParts]
      .map((part) => ({ ...part }))
      .sort((left, right) => compareText(partKey(left), partKey(right))),
    errors: [...parsed.errors]
      .map((error) => ({ ...error }))
      .sort((left, right) => compareText(left.code, right.code)
        || compareText(left.message, right.message)
        || Number(left.retryable) - Number(right.retryable)),
    offers: [...parsed.offers]
      .map((offer) => ({
        ...offer,
        part: { ...offer.part },
        priceBreaks: offer.priceBreaks.map((priceBreak) => ({ ...priceBreak })),
      }))
      .sort((left, right) => compareText(partKey(left.part), partKey(right.part))
        || compareText(left.distributorSku, right.distributorSku)),
  };
  return parseOfferSnapshot({
    ...withoutHash,
    contentHash: calculateOfferSnapshotContentHash(withoutHash),
  });
}
