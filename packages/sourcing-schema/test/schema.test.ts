import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DISTRIBUTOR_IDS,
  assertDistributorId,
  calculateOfferSnapshotContentHash,
  canonicalOfferSnapshotPayload,
  migrateOfferSnapshot,
  migrateSourcingPolicy,
  parseCandidateSourcingMetrics,
  snapshotFreshnessAt,
  validateCandidateSourcingMetrics,
  validateOfferSnapshot,
  validateSourcingPolicy,
  type CandidateSourcingMetrics,
  type OfferSnapshot,
} from "../src";
import {
  SYNTHETIC_FIXTURE_EVALUATED_AT,
  SYNTHETIC_SOURCING_FIXTURES,
} from "../src/fixtures";

function rehashSnapshot<T extends OfferSnapshot>(snapshot: T): T {
  return { ...snapshot, contentHash: calculateOfferSnapshotContentHash(snapshot) };
}

function identityKey(part: { manufacturerId: string; manufacturerPartNumber: string }): string {
  return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
}

describe("scheMAGIC Sourcing contracts", () => {
  it("accepts every synthetic policy, snapshot, and metric fixture", () => {
    for (const [name, fixture] of Object.entries(SYNTHETIC_SOURCING_FIXTURES)) {
      expect(validateSourcingPolicy(fixture.policy), `${name} policy`).toEqual([]);
      for (const offerSnapshot of fixture.snapshots) {
        expect(validateOfferSnapshot(offerSnapshot), `${name} snapshot ${offerSnapshot.id}`).toEqual([]);
      }
      expect(validateCandidateSourcingMetrics(fixture.metrics), `${name} metrics`).toEqual([]);
    }
  });

  it("round-trips current versions without sharing mutable input state", () => {
    const fixture = SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!;
    const migratedPolicy = migrateSourcingPolicy(JSON.parse(JSON.stringify(fixture.policy)));
    const migratedSnapshot = migrateOfferSnapshot(JSON.parse(JSON.stringify(fixture.snapshots[0])));
    const parsedMetrics = parseCandidateSourcingMetrics(JSON.parse(JSON.stringify(fixture.metrics)));

    expect(migratedPolicy).toEqual(fixture.policy);
    expect(migratedSnapshot).toEqual(fixture.snapshots[0]);
    expect(parsedMetrics).toEqual(fixture.metrics);
    expect(migratedPolicy).not.toBe(fixture.policy);
    expect(migratedSnapshot).not.toBe(fixture.snapshots[0]);
  });

  it("keeps every synthetic metric arithmetically and referentially consistent", () => {
    for (const [name, fixture] of Object.entries(SYNTHETIC_SOURCING_FIXTURES)) {
      const snapshots = new Map(fixture.snapshots.map((snapshot) => [snapshot.id, snapshot]));
      const selectedLines = fixture.metrics.lines.filter((line) => line.selectedOffer !== undefined);

      for (const line of selectedLines) {
        const selected = line.selectedOffer!;
        expect(fixture.metrics.snapshotIds, `${name}/${line.bomLineId} snapshot listed`).toContain(selected.snapshotId);
        const snapshot = snapshots.get(selected.snapshotId);
        expect(snapshot, `${name}/${line.bomLineId} snapshot exists`).toBeDefined();
        const selectedOffer = snapshot!.offers.find((offer) => offer.distributor === selected.distributor && offer.distributorSku === selected.distributorSku);
        expect(selectedOffer, `${name}/${line.bomLineId} offer exists`).toBeDefined();
        expect(identityKey(selectedOffer!.part), `${name}/${line.bomLineId} part identity`).toBe(identityKey(line.part));
        expect(line.status, `${name}/${line.bomLineId} selected status`).toBe("sourced");
        expect(line.packaging, `${name}/${line.bomLineId} packaging`).toBe(selectedOffer!.packaging);
        expect(line.lifecycle, `${name}/${line.bomLineId} lifecycle`).toBe(selectedOffer!.lifecycle);
        expect(line.stockQuantity, `${name}/${line.bomLineId} stock`).toBe(selectedOffer!.stockQuantity);
        expect(line.leadTimeDays, `${name}/${line.bomLineId} lead time`).toBe(selectedOffer!.leadTimeDays);
        expect(line.leadTimeKind, `${name}/${line.bomLineId} lead time meaning`).toBe(selectedOffer!.leadTimeKind);

        const requiredQuantity = fixture.metrics.requestedBuildQuantity * line.quantityPerAssembly;
        const minimumQuantity = Math.max(requiredQuantity, selectedOffer!.minimumOrderQuantity ?? 1);
        const multiple = selectedOffer!.orderMultiple ?? 1;
        const expectedPurchaseQuantity = Math.ceil(minimumQuantity / multiple) * multiple;
        expect(line.purchaseQuantity, `${name}/${line.bomLineId} purchase quantity`).toBe(expectedPurchaseQuantity);
        expect(line.buildableQuantity, `${name}/${line.bomLineId} buildable quantity`).toBe(Math.floor(selectedOffer!.stockQuantity! / line.quantityPerAssembly));
        const applicablePrice = selectedOffer!.priceBreaks.filter((priceBreak) => priceBreak.quantity <= expectedPurchaseQuantity).at(-1);
        expect(line.extendedCost?.amount, `${name}/${line.bomLineId} extended cost`).toBeCloseTo(expectedPurchaseQuantity * applicablePrice!.unitPrice, 10);
        expect(line.extendedCost?.currency, `${name}/${line.bomLineId} currency`).toBe(selectedOffer!.currency);
      }

      const lifecycleCounts = { active: 0, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 };
      for (const line of fixture.metrics.lines) if (line.lifecycle !== undefined) lifecycleCounts[line.lifecycle] += 1;
      expect(fixture.metrics.lifecycleCounts, `${name} lifecycle counts`).toEqual(lifecycleCounts);

      if (fixture.metrics.lines.length > 0 && fixture.metrics.buildableQuantity !== undefined) {
        const allSourced = fixture.metrics.lines.every((line) => line.status === "sourced" && line.buildableQuantity !== undefined);
        const expectedBuildable = allSourced ? Math.min(...fixture.metrics.lines.map((line) => line.buildableQuantity!)) : 0;
        expect(fixture.metrics.buildableQuantity, `${name} aggregate buildable quantity`).toBe(expectedBuildable);
      }
      if (fixture.metrics.extendedBomCost !== undefined) {
        expect(fixture.metrics.lines.every((line) => line.extendedCost !== undefined), `${name} complete aggregate cost`).toBe(true);
        const lineCost = fixture.metrics.lines.reduce((total, line) => total + line.extendedCost!.amount, 0);
        expect(fixture.metrics.extendedBomCost.amount, `${name} aggregate cost`).toBeCloseTo(lineCost, 10);
      }
      if (fixture.metrics.distributorSplitCount !== undefined) {
        const distributors = new Set(selectedLines.map((line) => line.selectedOffer!.distributor));
        expect(fixture.metrics.distributorSplitCount, `${name} distributor split`).toBe(distributors.size);
      }
      if (fixture.metrics.singleDistributorComplete !== undefined) {
        const distributors = new Set(selectedLines.map((line) => line.selectedOffer!.distributor));
        const expected = fixture.metrics.lines.length > 0 && fixture.metrics.lines.every((line) => line.status === "sourced") && distributors.size === 1;
        expect(fixture.metrics.singleDistributorComplete, `${name} one-distributor completeness`).toBe(expected);
      }
      if (fixture.metrics.bottleneckPart !== undefined) {
        const bottleneck = fixture.metrics.lines.find((line) => line.bomLineId === fixture.metrics.bottleneckPart!.bomLineId);
        expect(bottleneck, `${name} bottleneck line`).toBeDefined();
        expect(identityKey(bottleneck!.part), `${name} bottleneck identity`).toBe(identityKey(fixture.metrics.bottleneckPart.part));
      }
    }
  });

  it("covers offline, distributor selection, lifecycle, freshness, and provider failure states", () => {
    expect(SYNTHETIC_SOURCING_FIXTURES.offline?.metrics.status).toBe("unavailable");
    expect(SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100?.policy).toMatchObject({
      distributors: [DISTRIBUTOR_IDS.digikey],
      buildQuantity: 100,
      allowedLifecycle: ["active"],
    });
    expect(SYNTHETIC_SOURCING_FIXTURES.singleDistributor?.metrics.singleDistributorComplete).toBe(true);
    expect(SYNTHETIC_SOURCING_FIXTURES.mixedDistributors?.metrics.distributorSplitCount).toBe(2);
    expect(SYNTHETIC_SOURCING_FIXTURES.obsoleteNrndUnknown?.metrics.lifecycleCounts).toMatchObject({ obsolete: 1, nrnd: 1, unknown: 1 });
    expect(SYNTHETIC_SOURCING_FIXTURES.partialProviderResponse?.snapshots[0]?.status).toBe("partial");
    expect(SYNTHETIC_SOURCING_FIXTURES.providerError?.snapshots[0]?.status).toBe("provider_error");
    expect(snapshotFreshnessAt(SYNTHETIC_SOURCING_FIXTURES.staleSnapshot!.snapshots[0]!, SYNTHETIC_FIXTURE_EVALUATED_AT)).toBe("stale");
  });

  it("rejects invalid provider IDs, policy ranges, obsolete allowance, and duplicate distributors", () => {
    expect(() => assertDistributorId("Digi Key")).toThrow(/lowercase registry key/i);
    const fixture = SYNTHETIC_SOURCING_FIXTURES.offline!.policy;
    const issues = validateSourcingPolicy({
      ...fixture,
      distributors: ["digikey", "digikey"],
      buildQuantity: 0,
      allowedLifecycle: ["active", "obsolete"],
    });
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(["distributors", "buildQuantity", "allowedLifecycle.1"]));
  });

  it("rejects malformed snapshots and does not collapse partial failures to complete", () => {
    const snapshot = SYNTHETIC_SOURCING_FIXTURES.partialProviderResponse!.snapshots[0]!;
    const issues = validateOfferSnapshot({
      ...snapshot,
      status: "partial",
      errors: [],
      contentHash: "not-a-content-hash",
      offers: snapshot.offers.map((offer) => ({ ...offer, distributor: "mouser-mismatch" })),
    });
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(["errors", "contentHash", "offers.0.distributor"]));
  });

  it("verifies SHA-256 over the documented canonical snapshot payload", () => {
    const snapshot = SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!.snapshots[0]!;
    const nodeHash = `sha256:${createHash("sha256").update(canonicalOfferSnapshotPayload(snapshot), "utf8").digest("hex")}`;
    expect(calculateOfferSnapshotContentHash(snapshot)).toBe(nodeHash);
    expect(validateOfferSnapshot(snapshot)).toEqual([]);

    const changed = structuredClone(snapshot);
    changed.offers[0]!.stockQuantity = changed.offers[0]!.stockQuantity! + 1;
    expect(validateOfferSnapshot(changed)).toContainEqual({ path: "contentHash", message: "Does not match the canonical snapshot payload" });
  });

  it("requires requested manufacturer identities and unique provider SKUs", () => {
    const source = SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!.snapshots[0]!;
    const unrequested = structuredClone(source);
    unrequested.requestedParts[0] = { manufacturerId: "different-manufacturer", manufacturerPartNumber: "SYN-DRIVER-A" };
    expect(validateOfferSnapshot(rehashSnapshot(unrequested)).map((issue) => issue.path)).toContain("offers.0.part");

    const duplicateRequest = structuredClone(source);
    duplicateRequest.requestedParts.push(structuredClone(duplicateRequest.requestedParts[0]!));
    expect(validateOfferSnapshot(rehashSnapshot(duplicateRequest)).map((issue) => issue.path)).toContain("requestedParts.2");

    const duplicateSku = structuredClone(source);
    duplicateSku.offers[1]!.distributorSku = duplicateSku.offers[0]!.distributorSku;
    expect(validateOfferSnapshot(rehashSnapshot(duplicateSku)).map((issue) => issue.path)).toContain("offers.1.distributorSku");
  });

  it("requires strict RFC 3339 timestamps with an explicit timezone", () => {
    const source = SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!.snapshots[0]!;
    const timezoneLess = structuredClone(source);
    timezoneLess.retrievedAt = "2026-08-23T00:00:00";
    timezoneLess.offers.forEach((offer) => { offer.retrievedAt = timezoneLess.retrievedAt; });
    expect(validateOfferSnapshot(rehashSnapshot(timezoneLess)).map((issue) => issue.path)).toEqual(expect.arrayContaining(["retrievedAt", "offers.0.retrievedAt"]));

    const impossibleDate = structuredClone(source);
    impossibleDate.expiresAt = "2026-02-31T01:00:00Z";
    expect(validateOfferSnapshot(rehashSnapshot(impossibleDate)).map((issue) => issue.path)).toContain("expiresAt");
  });

  it("rejects unknown keys and secret, provider-response, or engineering-fact smuggling", () => {
    const policy = SYNTHETIC_SOURCING_FIXTURES.offline!.policy;
    expect(validateSourcingPolicy({ ...policy, apiKey: "must-not-persist" }).map((issue) => issue.path)).toContain("apiKey");
    expect(validateSourcingPolicy({ ...policy, rawProviderResponse: { stock: 1 } }).map((issue) => issue.path)).toContain("rawProviderResponse");

    const source = SYNTHETIC_SOURCING_FIXTURES.partialProviderResponse!.snapshots[0]!;
    const smuggledSnapshot = {
      ...structuredClone(source),
      rawProviderResponse: { secret: "no" },
      requestedParts: source.requestedParts.map((part, index) => index === 0 ? { ...part, maximumVoltage: 60 } : structuredClone(part)),
      errors: source.errors.map((error) => ({ ...error, apiKey: "no" })),
      offers: source.offers.map((offer) => ({
        ...offer,
        rawProviderResponse: { availability: "invented" },
        part: { ...offer.part, engineeringFact: { maximumVoltage: 60 } },
        priceBreaks: offer.priceBreaks.map((priceBreak) => ({ ...priceBreak, providerBlob: "no" })),
      })),
    };
    const snapshotPaths = validateOfferSnapshot(rehashSnapshot(smuggledSnapshot)).map((issue) => issue.path);
    expect(snapshotPaths).toEqual(expect.arrayContaining([
      "rawProviderResponse",
      "requestedParts.0.maximumVoltage",
      "errors.0.apiKey",
      "offers.0.rawProviderResponse",
      "offers.0.part.engineeringFact",
      "offers.0.priceBreaks.0.providerBlob",
    ]));

    const metrics = structuredClone(SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!.metrics) as CandidateSourcingMetrics & Record<string, unknown>;
    metrics.engineeringFacts = { maximumVoltage: 60 };
    Object.assign(metrics.lines[0]!, {
      rawProviderResponse: { no: true },
      part: { ...metrics.lines[0]!.part, voltageRating: 60 },
      selectedOffer: { ...metrics.lines[0]!.selectedOffer!, apiKey: "no" },
      extendedCost: { ...metrics.lines[0]!.extendedCost!, raw: "no" },
    });
    Object.assign(metrics.bottleneckPart!, { rawProviderResponse: "no", part: { ...metrics.bottleneckPart!.part, electrical: true } });
    Object.assign(metrics.lifecycleCounts, { providerStatus: 1 });
    const metricPaths = validateCandidateSourcingMetrics(metrics).map((issue) => issue.path);
    expect(metricPaths).toEqual(expect.arrayContaining([
      "engineeringFacts",
      "lines.0.rawProviderResponse",
      "lines.0.part.voltageRating",
      "lines.0.selectedOffer.apiKey",
      "lines.0.extendedCost.raw",
      "bottleneckPart.rawProviderResponse",
      "bottleneckPart.part.electrical",
      "lifecycleCounts.providerStatus",
    ]));
  });

  it("rejects metrics that claim a sourced line without an offer reference", () => {
    const metrics = SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!.metrics;
    const firstLine = metrics.lines[0]!;
    const { selectedOffer: _selectedOffer, ...withoutOffer } = firstLine;
    const issues = validateCandidateSourcingMetrics({ ...metrics, lines: [withoutOffer, ...metrics.lines.slice(1)] });
    expect(issues).toContainEqual({ path: "lines.0.selectedOffer", message: "A sourced line must reference its selected offer" });
  });
});
