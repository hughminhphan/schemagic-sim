import { canonicalJsonForVersionedSourcing, sha256HexForVersionedSourcing } from "./canonical";
import type {
  OfferSnapshotV2,
  OfferSnapshotV2Content,
  OfferSnapshotV2Id,
  OfferSnapshotV2Ref,
  Sha256ContentHash,
} from "./v2";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function partKey(part: { manufacturerId: string; manufacturerPartNumber: string }): string {
  return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
}

export function normalizeOfferSnapshotV2Content(content: OfferSnapshotV2Content): OfferSnapshotV2Content {
  const normalized = cloneJson(content);
  normalized.requestedParts.sort((left, right) => compareText(partKey(left), partKey(right)));
  normalized.errors.sort((left, right) => compareText(left.code, right.code)
    || Number(left.retryable) - Number(right.retryable));
  normalized.offers.sort((left, right) => compareText(left.distributor, right.distributor)
    || compareText(left.distributorSku, right.distributorSku)
    || compareText(partKey(left.part), partKey(right.part)));
  normalized.lineage.sort((left, right) => left.schemaVersion - right.schemaVersion
    || compareText(left.id, right.id)
    || compareText(left.contentHash, right.contentHash));
  return normalized;
}

export function canonicalOfferSnapshotPayloadV2(
  snapshot: OfferSnapshotV2Content | OfferSnapshotV2,
): string {
  const { id: _id, contentHash: _contentHash, ...content } = snapshot as OfferSnapshotV2;
  return canonicalJsonForVersionedSourcing(content);
}

export function calculateOfferSnapshotContentHashV2(
  snapshot: OfferSnapshotV2Content | OfferSnapshotV2,
): Sha256ContentHash {
  return `sha256:${sha256HexForVersionedSourcing(canonicalOfferSnapshotPayloadV2(snapshot))}`;
}

export function calculateOfferSnapshotIdV2(
  snapshot: OfferSnapshotV2Content | OfferSnapshotV2,
): OfferSnapshotV2Id {
  return `snapshot:v2:${calculateOfferSnapshotContentHashV2(snapshot)}`;
}

export function finalizeOfferSnapshotV2(content: OfferSnapshotV2Content): OfferSnapshotV2 {
  const normalized = normalizeOfferSnapshotV2Content(content);
  const contentHash = calculateOfferSnapshotContentHashV2(normalized);
  return {
    ...normalized,
    id: `snapshot:v2:${contentHash}`,
    contentHash,
  };
}

export function offerSnapshotRef(snapshot: Pick<OfferSnapshotV2, "id" | "schemaVersion" | "contentHash">): OfferSnapshotV2Ref {
  return {
    id: snapshot.id,
    schemaVersion: snapshot.schemaVersion,
    contentHash: snapshot.contentHash,
  };
}
