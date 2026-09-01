import { describe, expect, it } from "vitest";
import type { EvaluateSourcing } from "@opencircuit/design-engine";
import {
  calculateOfferSnapshotContentHash,
  type CandidateSourcingMetrics,
  type OfferSnapshot,
} from "@opencircuit/sourcing-schema";
import {
  SYNTHETIC_FIXTURE_EVALUATED_AT,
  SYNTHETIC_SOURCING_FIXTURES,
} from "@opencircuit/sourcing-schema/fixtures";
import {
  evaluateBomSourcing,
  evaluateCandidateSourcing,
  type SourcingBomLine,
} from "../src";

const designEngineCompatibleEvaluator: EvaluateSourcing = evaluateCandidateSourcing;
void designEngineCompatibleEvaluator;

function fixture(name: keyof typeof SYNTHETIC_SOURCING_FIXTURES) {
  const value = SYNTHETIC_SOURCING_FIXTURES[name];
  if (value === undefined) throw new Error(`Missing synthetic sourcing fixture ${String(name)}`);
  return structuredClone(value);
}

function completeLines(): SourcingBomLine[] {
  return fixture("digikeyOnlyActiveInStockBuild100").metrics.lines.map((line) => ({
    bomLineId: line.bomLineId,
    part: line.part,
    quantityPerAssembly: line.quantityPerAssembly,
  }));
}

function rehash(snapshot: OfferSnapshot): OfferSnapshot {
  return { ...snapshot, contentHash: calculateOfferSnapshotContentHash(snapshot) };
}

function evaluate(name: keyof typeof SYNTHETIC_SOURCING_FIXTURES, lines = completeLines()) {
  const source = fixture(name);
  return evaluateBomSourcing({
    lines,
    snapshots: source.snapshots,
    policy: source.policy,
    evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
  });
}

describe("provider-neutral BOM evaluation", () => {
  it("computes build quantity, stock, buildability, price breaks, and total BOM cost", () => {
    const result = evaluate("digikeyOnlyActiveInStockBuild100");

    expect(result.policyStatus).toBe("pass");
    expect(result.metrics).toMatchObject({
      status: "complete",
      requestedBuildQuantity: 100,
      buildableQuantity: 200,
      extendedBomCost: { amount: 90, currency: "USD" },
      distributorSplitCount: 1,
      singleDistributorComplete: true,
      bottleneckPart: { bomLineId: "driver", reason: "stock" },
      maximumLeadTimeDays: 14,
      maximumLeadTimeKind: "manufacturer",
    });
    expect(result.metrics.lines.find((line) => line.bomLineId === "driver")).toMatchObject({
      status: "sourced",
      purchaseQuantity: 100,
      buildableQuantity: 200,
      extendedCost: { amount: 80, currency: "USD" },
    });
    expect(result.metrics.lines.find((line) => line.bomLineId === "bulk-capacitor")).toMatchObject({
      quantityPerAssembly: 2,
      purchaseQuantity: 200,
      buildableQuantity: 500,
      extendedCost: { amount: 10, currency: "USD" },
    });
  });

  it("rounds purchase quantity through MOQ and order multiples before applying a price break", () => {
    const source = fixture("digikeyOnlyActiveInStockBuild100");
    const snapshot = source.snapshots[0]!;
    const driver = snapshot.offers.find((offer) => offer.distributorSku === "SYN-DK-DRIVER-1")!;
    driver.minimumOrderQuantity = 120;
    driver.orderMultiple = 50;
    source.snapshots[0] = rehash(snapshot);

    const result = evaluateBomSourcing({
      lines: completeLines(),
      snapshots: source.snapshots,
      policy: source.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    });
    const line = result.metrics.lines.find((entry) => entry.bomLineId === "driver");

    expect(line).toMatchObject({ purchaseQuantity: 150, extendedCost: { amount: 120, currency: "USD" } });
    expect(result.metrics.extendedBomCost).toEqual({ amount: 130, currency: "USD" });
  });

  it("uses one complete provider in single-distributor mode and never silently mixes", () => {
    const result = evaluate("singleDistributor");

    expect(result.policyStatus).toBe("pass");
    expect(new Set(result.metrics.lines.map((line) => line.selectedOffer?.distributor))).toEqual(new Set(["mouser"]));
    expect(result.metrics).toMatchObject({
      extendedBomCost: { amount: 84, currency: "USD" },
      distributorSplitCount: 1,
      singleDistributorComplete: true,
    });
  });

  it("supports a mixed-provider BOM only in any-selected mode", () => {
    const anySource = fixture("mixedDistributors");
    const digikey = anySource.snapshots.find((snapshot) => snapshot.provider === "digikey")!;
    const mouser = anySource.snapshots.find((snapshot) => snapshot.provider === "mouser")!;
    digikey.offers.find((offer) => offer.part.manufacturerPartNumber === "SYN-CAP-A")!.lifecycle = "obsolete";
    mouser.offers.find((offer) => offer.part.manufacturerPartNumber === "SYN-DRIVER-A")!.lifecycle = "obsolete";
    anySource.snapshots = [rehash(digikey), rehash(mouser)];

    const mixed = evaluateBomSourcing({
      lines: completeLines(),
      snapshots: anySource.snapshots,
      policy: anySource.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    });
    expect(new Set(mixed.metrics.lines.map((line) => line.selectedOffer?.distributor))).toEqual(new Set(["digikey", "mouser"]));
    expect(mixed.metrics.distributorSplitCount).toBe(2);
    expect(mixed.metrics.singleDistributorComplete).toBe(false);
    expect(mixed.decisions.some((entry) => entry.code === "lifecycle" && entry.status === "unknown")).toBe(true);

    const single = evaluateBomSourcing({
      lines: completeLines(),
      snapshots: anySource.snapshots,
      policy: { ...anySource.policy, mode: "single_distributor" },
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    });
    expect(single.policyStatus).toBe("fail");
    expect(new Set(single.metrics.lines.flatMap((line) => line.selectedOffer?.distributor ?? []))).toHaveLength(1);
    expect(single.decisions).toContainEqual(expect.objectContaining({ code: "single_distributor", status: "fail" }));
  });

  it("keeps lifecycle disagreement visible and never turns unknown lifecycle into pass", () => {
    const result = evaluate("obsoleteNrndUnknown", fixture("obsoleteNrndUnknown").metrics.lines.map((line) => ({
      bomLineId: line.bomLineId,
      part: line.part,
      quantityPerAssembly: line.quantityPerAssembly,
    })));

    expect(result.metrics.lifecycleCounts).toEqual({ active: 0, nrnd: 1, last_time_buy: 0, obsolete: 1, unknown: 1 });
    expect(result.metrics.lines.find((line) => line.bomLineId === "obsolete")?.status).toBe("policy_rejected");
    expect(result.metrics.lines.find((line) => line.bomLineId === "unknown")?.status).toBe("unknown");
    expect(result.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ bomLineId: "obsolete", code: "lifecycle", status: "fail" }),
      expect.objectContaining({ bomLineId: "unknown", code: "lifecycle", status: "unknown" }),
    ]));
    expect(result.decisions.some((entry) => entry.bomLineId === "unknown" && entry.status === "pass")).toBe(false);
  });

  it("enforces minimum stock and preserves allowed backorder semantics", () => {
    const source = fixture("digikeyOnlyActiveInStockBuild100");
    const snapshot = source.snapshots[0]!;
    const driver = snapshot.offers.find((offer) => offer.part.manufacturerPartNumber === "SYN-DRIVER-A")!;
    driver.stockQuantity = 50;
    driver.backorderAvailable = true;
    source.snapshots[0] = rehash(snapshot);

    const rejected = evaluateBomSourcing({
      lines: completeLines(),
      snapshots: source.snapshots,
      policy: source.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    });
    expect(rejected.metrics.lines.find((line) => line.bomLineId === "driver")?.status).toBe("policy_rejected");
    expect(rejected.decisions).toContainEqual(expect.objectContaining({ bomLineId: "driver", code: "stock", status: "fail" }));

    const { minimumStock: _minimumStock, ...withoutMinimumStock } = source.policy;
    const backordered = evaluateBomSourcing({
      lines: completeLines(),
      snapshots: source.snapshots,
      policy: { ...withoutMinimumStock, allowBackorder: true },
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    });
    expect(backordered.metrics.lines.find((line) => line.bomLineId === "driver")).toMatchObject({
      status: "sourced",
      buildableQuantity: 50,
    });
    expect(backordered.metrics.lines.find((line) => line.bomLineId === "driver")?.warnings.join(" ")).toMatch(/backorder/i);
  });

  it("enforces maximum lead time while retaining its exact semantic kind", () => {
    const source = fixture("digikeyOnlyActiveInStockBuild100");
    const snapshot = source.snapshots[0]!;
    const driver = snapshot.offers.find((offer) => offer.part.manufacturerPartNumber === "SYN-DRIVER-A")!;
    driver.leadTimeDays = 45;
    driver.leadTimeKind = "estimated_ship";
    source.snapshots[0] = rehash(snapshot);

    const result = evaluateBomSourcing({
      lines: completeLines(),
      snapshots: source.snapshots,
      policy: source.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    });

    expect(result.policyStatus).toBe("fail");
    expect(result.metrics.lines.find((line) => line.bomLineId === "driver")).toMatchObject({
      status: "policy_rejected",
      leadTimeDays: 45,
      leadTimeKind: "estimated_ship",
    });
    expect(result.metrics.bottleneckPart).toMatchObject({ bomLineId: "driver", reason: "lead_time" });
  });

  it.each([
    ["staleSnapshot", "stale"],
    ["partialProviderResponse", "partial"],
    ["providerError", "provider_error"],
  ] as const)("degrades %s data to explicit %s/unknown without a false pass", (name, expectedStatus) => {
    const source = fixture(name);
    const lines = name === "staleSnapshot"
      ? [completeLines().find((line) => line.bomLineId === "driver")!]
      : completeLines();
    const result = evaluateBomSourcing({
      lines,
      snapshots: source.snapshots,
      policy: source.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    });

    expect(result.metrics.status).toBe(expectedStatus);
    expect(result.policyStatus).toBe("unknown");
    expect(result.decisions).toContainEqual(expect.objectContaining({ code: "data_status", status: "unknown" }));
    expect(result.decisions.some((entry) => entry.code === "data_status" && entry.status === "pass")).toBe(false);
  });

  it("normalizes evaluatedAt and validates snapshots through sourcing-schema entrypoints", () => {
    const source = fixture("digikeyOnlyActiveInStockBuild100");
    const offset = evaluateBomSourcing({
      lines: completeLines(),
      snapshots: source.snapshots,
      policy: source.policy,
      evaluatedAt: "2026-08-23T10:30:00+10:00",
    });
    expect(offset.metrics.evaluatedAt).toBe(SYNTHETIC_FIXTURE_EVALUATED_AT);

    const tampered = structuredClone(source.snapshots[0]!);
    tampered.offers[0]!.stockQuantity = 999;
    expect(() => evaluateBomSourcing({
      lines: completeLines(),
      snapshots: [tampered],
      policy: source.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    })).toThrow(/contentHash/i);
    expect(() => evaluateBomSourcing({
      lines: completeLines(),
      snapshots: source.snapshots,
      policy: source.policy,
      evaluatedAt: "2026-08-23T00:30:00",
    })).toThrow(/evaluatedAt/i);
  });

  it("produces byte-stable normalized metrics and decisions independent of input order", () => {
    const source = fixture("singleDistributor");
    const forward = evaluateBomSourcing({
      lines: completeLines(),
      snapshots: source.snapshots,
      policy: source.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    });
    const reversed = evaluateBomSourcing({
      lines: [...completeLines()].reverse(),
      snapshots: [...source.snapshots].reverse(),
      policy: source.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    });

    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
  });

  it("returns the exact design-engine shape and keeps unknown candidates eligible but unpassed", () => {
    const source = fixture("providerError");
    const candidate = { components: completeLines().map((line) => ({ ...line, id: line.bomLineId })) };
    const result = evaluateCandidateSourcing(candidate, source.snapshots, source.policy, SYNTHETIC_FIXTURE_EVALUATED_AT);

    expect(Object.keys(result).sort()).toEqual(["constraints", "eligible", "metrics"]);
    expect(result.metrics.status).toBe("provider_error");
    expect(result.eligible).toBe(true);
    expect(result.constraints).toContainEqual(expect.objectContaining({ status: "unknown", evidence: [] }));
    expect(result.constraints.some((entry) => entry.status === "pass")).toBe(false);
  });

  it("always emits schema-valid frozen metrics", () => {
    const states = Object.keys(SYNTHETIC_SOURCING_FIXTURES) as Array<keyof typeof SYNTHETIC_SOURCING_FIXTURES>;
    const outputs: CandidateSourcingMetrics[] = states.map((name) => {
      const source = fixture(name);
      const lines = source.metrics.lines.length > 0
        ? source.metrics.lines.map((line) => ({ bomLineId: line.bomLineId, part: line.part, quantityPerAssembly: line.quantityPerAssembly }))
        : completeLines();
      return evaluateBomSourcing({ lines, snapshots: source.snapshots, policy: source.policy, evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT }).metrics;
    });
    expect(outputs).toHaveLength(states.length);
  });

  it("rejects an empty or duplicate-line BOM before evaluation", () => {
    const source = fixture("digikeyOnlyActiveInStockBuild100");
    expect(() => evaluateBomSourcing({
      lines: [],
      snapshots: source.snapshots,
      policy: source.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    })).toThrow(/at least one line/i);
    const first = completeLines()[0]!;
    expect(() => evaluateBomSourcing({
      lines: [first, structuredClone(first)],
      snapshots: source.snapshots,
      policy: source.policy,
      evaluatedAt: SYNTHETIC_FIXTURE_EVALUATED_AT,
    })).toThrow(/duplicate/i);
  });
});
