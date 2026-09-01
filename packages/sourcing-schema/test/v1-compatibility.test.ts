import { describe, expect, it } from "vitest";
import {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V1,
  OFFER_SNAPSHOT_SCHEMA_VERSION,
  OFFER_SNAPSHOT_SCHEMA_VERSION_V1,
  calculateOfferSnapshotContentHash,
  calculateOfferSnapshotContentHashV1,
  canonicalOfferSnapshotPayload,
  canonicalOfferSnapshotPayloadV1,
  emptyLifecycleCounts,
  emptyLifecycleCountsV1,
  parseCandidateSourcingMetrics,
  parseCandidateSourcingMetricsV1,
  parseOfferSnapshot,
  parseOfferSnapshotV1,
  type CandidateSourcingMetrics,
  type CandidateSourcingMetricsV1,
  type BottleneckReason,
  type BottleneckReasonV1,
  type DistributorOffer,
  type DistributorOfferV1,
  type OfferSnapshot,
  type OfferSnapshotV1,
} from "../src";
import { SYNTHETIC_SOURCING_FIXTURES } from "../src/fixtures";

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends
  (<T>() => T extends Right ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

type OfferAliasStayedV1 = Expect<Equal<DistributorOffer, DistributorOfferV1>>;
type SnapshotAliasStayedV1 = Expect<Equal<OfferSnapshot, OfferSnapshotV1>>;
type MetricsAliasStayedV1 = Expect<Equal<CandidateSourcingMetrics, CandidateSourcingMetricsV1>>;
type BottleneckReasonAliasStayedV1 = Expect<Equal<BottleneckReason, BottleneckReasonV1>>;

const compileV1Consumer = (offer: DistributorOffer, snapshot: OfferSnapshot, metrics: CandidateSourcingMetrics) => {
  const region: string = offer.region;
  const marketplace: boolean = offer.marketplace;
  const snapshotIds: string[] = metrics.snapshotIds;
  const selectedSnapshotId: string | undefined = metrics.lines[0]?.selectedOffer?.snapshotId;
  return [region, marketplace, snapshot.id, snapshotIds, selectedSnapshotId] as const;
};

// @ts-expect-error The compatibility release must not widen V1 region to an observation wrapper.
const invalidV1Region: DistributorOffer["region"] = { state: "known", value: "US" };
// @ts-expect-error The compatibility release must not replace the V1 bare snapshot ID array.
const invalidV1SnapshotRef: CandidateSourcingMetrics["snapshotIds"][number] = { id: "x", schemaVersion: 1, contentHash: "sha256:x" };

void invalidV1Region;
void invalidV1SnapshotRef;
void (null as unknown as OfferAliasStayedV1);
void (null as unknown as SnapshotAliasStayedV1);
void (null as unknown as MetricsAliasStayedV1);
void (null as unknown as BottleneckReasonAliasStayedV1);

describe("frozen V1 source compatibility", () => {
  it("keeps unsuffixed V1 values, parsers, constants, and hash bytes identical", () => {
    const fixture = SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!;
    const snapshot = fixture.snapshots[0]!;
    const offer = snapshot.offers[0]!;
    expect(compileV1Consumer(offer, snapshot, fixture.metrics)[0]).toBe("US");
    expect(OFFER_SNAPSHOT_SCHEMA_VERSION).toBe(OFFER_SNAPSHOT_SCHEMA_VERSION_V1);
    expect(CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION).toBe(CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V1);
    expect(parseOfferSnapshot(snapshot)).toEqual(parseOfferSnapshotV1(snapshot));
    expect(parseCandidateSourcingMetrics(fixture.metrics)).toEqual(parseCandidateSourcingMetricsV1(fixture.metrics));
    expect(canonicalOfferSnapshotPayload(snapshot)).toBe(canonicalOfferSnapshotPayloadV1(snapshot));
    expect(calculateOfferSnapshotContentHash(snapshot)).toBe(calculateOfferSnapshotContentHashV1(snapshot));
    expect(emptyLifecycleCounts()).toEqual(emptyLifecycleCountsV1());
  });

  it("pins hand-authored V1 canonical bytes and SHA-256 to literal goldens", () => {
    const golden: OfferSnapshotV1 = {
      schemaVersion: 1,
      id: "snapshot:golden:v1",
      provider: "digikey",
      requestedParts: [{ manufacturerId: "synthetic-golden", manufacturerPartNumber: "GOLD-1" }],
      retrievedAt: "2026-01-02T03:04:05.000Z",
      expiresAt: "2026-01-02T04:04:05.000Z",
      persistence: "ephemeral",
      status: "complete",
      errors: [],
      offers: [{
        distributor: "digikey",
        distributorSku: "GOLD-SKU",
        part: { manufacturerId: "synthetic-golden", manufacturerPartNumber: "GOLD-1" },
        region: "US",
        currency: "USD",
        packaging: "cut_tape",
        marketplace: false,
        backorderAvailable: false,
        stockQuantity: 7,
        minimumOrderQuantity: 1,
        orderMultiple: 1,
        leadTimeDays: 5,
        leadTimeKind: "manufacturer",
        lifecycle: "active",
        lifecycleSource: "manufacturer",
        priceBreaks: [{ quantity: 1, unitPrice: 1.5 }],
        productUrl: "https://example.invalid/golden",
        retrievedAt: "2026-01-02T03:04:05.000Z",
      }],
      contentHash: "sha256:ad1a68cc0b8a22fd3495f924c0c0dd99ed76eb79bc7b223317b5dfb7d3dcce7d",
    };
    const canonicalBytes = '{"errors":[],"expiresAt":"2026-01-02T04:04:05.000Z","id":"snapshot:golden:v1","offers":[{"backorderAvailable":false,"currency":"USD","distributor":"digikey","distributorSku":"GOLD-SKU","leadTimeDays":5,"leadTimeKind":"manufacturer","lifecycle":"active","lifecycleSource":"manufacturer","marketplace":false,"minimumOrderQuantity":1,"orderMultiple":1,"packaging":"cut_tape","part":{"manufacturerId":"synthetic-golden","manufacturerPartNumber":"GOLD-1"},"priceBreaks":[{"quantity":1,"unitPrice":1.5}],"productUrl":"https://example.invalid/golden","region":"US","retrievedAt":"2026-01-02T03:04:05.000Z","stockQuantity":7}],"persistence":"ephemeral","provider":"digikey","requestedParts":[{"manufacturerId":"synthetic-golden","manufacturerPartNumber":"GOLD-1"}],"retrievedAt":"2026-01-02T03:04:05.000Z","schemaVersion":1,"status":"complete"}';
    expect(canonicalOfferSnapshotPayloadV1(golden)).toBe(canonicalBytes);
    expect(calculateOfferSnapshotContentHashV1(golden)).toBe("sha256:ad1a68cc0b8a22fd3495f924c0c0dd99ed76eb79bc7b223317b5dfb7d3dcce7d");
    expect(parseOfferSnapshotV1(golden)).toEqual(golden);
  });
});
