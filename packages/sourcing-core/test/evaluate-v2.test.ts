import { describe, expect, it } from "vitest";
import type { EvaluateSourcingV2 } from "@opencircuit/design-engine";
import {
  finalizeOfferSnapshotV2,
  validateCandidateSourcingEvaluationContextV2,
  type CandidateSourcingEvaluationV2,
  type DistributorOfferV2,
  type ManufacturerPartIdentity,
  type OfferSnapshotV2Content,
  type OfferSnapshotV2,
  type SourcingPolicy,
  type SnapshotAuthorizationVerifierV1,
  type VerifiedCommercialAuthorizationOperationV1,
} from "@opencircuit/sourcing-schema";
import { evaluateBomSourcingV2, evaluateCandidateSourcingV2, type SourcingBomLineV2 } from "../src";

const designEngineCompatibleEvaluatorV2: EvaluateSourcingV2 = evaluateCandidateSourcingV2;
void designEngineCompatibleEvaluatorV2;

const AT = "2026-08-23T00:00:10.000000000Z";
const PART_A = { manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-A" } as const;
const PART_B = { manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-B" } as const;

function policy(overrides: Partial<SourcingPolicy> = {}): SourcingPolicy {
  return {
    schemaVersion: 1,
    distributors: ["digikey"],
    mode: "any_selected",
    buildQuantity: 10,
    region: "US",
    currency: "USD",
    allowedLifecycle: ["active", "nrnd"],
    minimumStock: 0,
    maximumLeadTimeDays: 30,
    allowBackorder: false,
    allowMarketplace: false,
    packaging: ["cut_tape"],
    maximumSnapshotAgeSeconds: 300,
    ...overrides,
  };
}

function line(id: string, part: ManufacturerPartIdentity, quantityPerAssembly = 1): SourcingBomLineV2 {
  return { bomLineId: id, part, quantityPerAssembly };
}

function offer(
  distributor: "digikey" | "mouser",
  part: ManufacturerPartIdentity,
  retrievedAt: string,
  overrides: Partial<DistributorOfferV2> = {},
): DistributorOfferV2 {
  return {
    distributor,
    distributorSku: `${distributor}-${part.manufacturerPartNumber}`,
    part,
    region: { state: "known", value: "US" },
    currency: { state: "known", value: "USD" },
    packaging: { state: "known", value: "cut_tape" },
    marketplace: { state: "known", value: false },
    backorderAvailable: { state: "known", value: false },
    stockQuantity: 100,
    minimumOrderQuantity: 1,
    orderMultiple: 1,
    leadTimeDays: { state: "known", value: 7 },
    leadTimeKind: { state: "known", value: "estimated_ship" },
    lifecycle: { state: "known", value: "active" },
    lifecycleSource: { state: "known", value: "distributor" },
    priceBreaks: [{ quantity: 1, unitPrice: part.manufacturerPartNumber === "SYN-A" ? 2 : 0.5 }],
    productUrl: `https://example.invalid/${distributor}/${part.manufacturerPartNumber}`,
    retrievedAt,
    ...overrides,
  };
}

function snapshot(
  distributor: "digikey" | "mouser",
  parts: readonly ManufacturerPartIdentity[],
  retrievedAt: string,
  offers = parts.map((part) => offer(distributor, part, retrievedAt)),
  expiresAt = "2026-08-23T00:05:00.000000000Z",
) {
  const content: OfferSnapshotV2Content = {
    schemaVersion: 2,
    provider: distributor,
    requestedParts: parts.map((part) => ({ ...part })),
    retrievedAt,
    expiresAt,
    persistence: "ephemeral",
    evaluationEligibility: "native_v2",
    status: "complete",
    errors: [],
    offers,
    lineage: [],
  };
  return finalizeOfferSnapshotV2(content);
}

function contextualIssues(
  result: CandidateSourcingEvaluationV2,
  lines: readonly SourcingBomLineV2[],
  snapshots: readonly OfferSnapshotV2[],
  sourcePolicy: SourcingPolicy,
) {
  const operation = { use: "display", checkedAt: AT } as VerifiedCommercialAuthorizationOperationV1;
  const authorizationVerifier: SnapshotAuthorizationVerifierV1 = {
    verify: () => [],
    authorizeOperation: () => operation,
    validateOperation: () => [],
  };
  return validateCandidateSourcingEvaluationContextV2(result, {
    candidateId: "candidate:synthetic",
    components: lines.map((entry) => ({
      id: entry.bomLineId,
      part: entry.part,
      quantityPerAssembly: entry.quantityPerAssembly,
    })),
    policy: sourcePolicy,
    snapshots,
    authorizations: [],
    authorizationVerifier,
    authorizationOperation: operation,
    expectedAuthorizationUse: "display",
    evaluatedAt: AT,
  });
}

describe("deterministic sourcing V2 evaluation", () => {
  it("projects exact quantities, costs, constraints, and aggregates", () => {
    const source = snapshot("digikey", [PART_A, PART_B], "2026-08-23T00:00:00.000000000Z");
    const lines = [line("driver", PART_A), line("caps", PART_B, 2)];
    const sourcePolicy = policy();
    const result = evaluateBomSourcingV2({
      lines,
      snapshots: [source],
      policy: sourcePolicy,
      evaluatedAt: AT,
    });

    expect(result.policyStatus).toBe("pass");
    expect(result.metrics).toMatchObject({
      status: "complete",
      requestedBuildQuantity: 10,
      snapshotAgeSeconds: 10,
      buildableQuantity: 50,
      extendedBomCost: { amount: 30, currency: "USD" },
      distributorSplitCount: 1,
      singleDistributorComplete: true,
      lifecycleCounts: { active: 2, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 },
    });
    expect(result.metrics.lines.find((entry) => entry.bomLineId === "caps")).toMatchObject({
      purchaseQuantity: 20,
      buildableQuantity: 50,
      extendedCost: { amount: 10, currency: "USD" },
    });
    expect(result.constraints.every((entry) => entry.ruleCatalogVersion === 1)).toBe(true);
    expect(result.constraints.every((entry) => entry.explanation.startsWith("{"))).toBe(true);

    expect(contextualIssues(result, lines, [source], sourcePolicy)).toEqual([]);
  });

  it("selects active snapshots independently per exact part and ignores input order", () => {
    const first = snapshot("digikey", [PART_A], "2026-08-23T00:00:00.000000000Z");
    const second = snapshot("digikey", [PART_B], "2026-08-23T00:00:05.000000000Z");
    const input = {
      lines: [line("a", PART_A), line("b", PART_B)],
      policy: policy(),
      evaluatedAt: AT,
    };
    const forward = evaluateBomSourcingV2({ ...input, snapshots: [first, second] });
    const reversed = evaluateBomSourcingV2({ ...input, snapshots: [second, first] });

    expect(forward).toEqual(reversed);
    expect(forward.metrics.lines.map((entry) => entry.evaluatedOffer?.snapshot.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(forward.metrics.snapshotAgeSeconds).toBe(10);
  });

  it("retains an inactive stale ref for audit without letting it alter active freshness", () => {
    const staleAt = "2026-08-22T23:50:00.000000000Z";
    const stale = snapshot(
      "digikey",
      [PART_A],
      staleAt,
      [offer("digikey", PART_A, staleAt)],
      "2026-08-22T23:51:00.000000000Z",
    );
    const active = snapshot("digikey", [PART_A], "2026-08-23T00:00:00.000000000Z");
    const result = evaluateBomSourcingV2({
      lines: [line("a", PART_A)],
      snapshots: [stale, active],
      policy: policy(),
      evaluatedAt: AT,
    });

    expect(result.metrics.status).toBe("complete");
    expect(result.metrics.snapshotAgeSeconds).toBe(10);
    expect(result.metrics.snapshotRefs).toHaveLength(2);
    expect(result.metrics.lines[0]?.evaluatedOffer?.snapshot.id).toBe(active.id);
  });

  it("keeps a proven single-distributor pass despite a missing non-selected plan", () => {
    const source = snapshot("digikey", [PART_A, PART_B], "2026-08-23T00:00:00.000000000Z");
    const lines = [line("a", PART_A), line("b", PART_B)];
    const sourcePolicy = policy({ mode: "single_distributor", distributors: ["digikey", "mouser"] });
    const result = evaluateBomSourcingV2({
      lines,
      snapshots: [source],
      policy: sourcePolicy,
      evaluatedAt: AT,
    });

    expect(result.policyStatus).toBe("pass");
    expect(result.metrics.status).toBe("complete");
    expect(result.constraints).toContainEqual(expect.objectContaining({
      code: "single_distributor",
      status: "pass",
      inputs: expect.objectContaining({ selectedDistributor: "digikey", observedDistributors: ["digikey"] }),
    }));
    expect(contextualIssues(result, lines, [source], sourcePolicy)).toEqual([]);
  });

  it("projects a stale single-distributor policy failure to unknown", () => {
    const retrievedAt = "2026-08-23T00:00:00.000000000Z";
    const staleFailure = snapshot("digikey", [PART_A], retrievedAt, [
      offer("digikey", PART_A, retrievedAt, { region: { state: "known", value: "CA" } }),
    ]);
    const lines = [line("a", PART_A)];
    const sourcePolicy = policy({
      mode: "single_distributor",
      maximumSnapshotAgeSeconds: 9,
    });
    const result = evaluateBomSourcingV2({
      lines,
      snapshots: [staleFailure],
      policy: sourcePolicy,
      evaluatedAt: AT,
    });

    expect(result.metrics.status).toBe("stale");
    expect(result.policyStatus).toBe("unknown");
    expect(result.metrics.lines[0]?.status).toBe("unknown");
    expect(result.constraints).toContainEqual(expect.objectContaining({ code: "region", status: "unknown" }));
    expect(result.constraints).toContainEqual(expect.objectContaining({ code: "single_distributor", status: "unknown" }));
    expect(contextualIssues(result, lines, [staleFailure], sourcePolicy)).toEqual([]);
  });

  it("keeps an equality-fresh complete single-distributor failure authoritative", () => {
    const retrievedAt = "2026-08-23T00:00:00.000000000Z";
    const freshFailure = snapshot("digikey", [PART_A], retrievedAt, [
      offer("digikey", PART_A, retrievedAt, { region: { state: "known", value: "CA" } }),
    ]);
    const lines = [line("a", PART_A)];
    const sourcePolicy = policy({
      mode: "single_distributor",
      maximumSnapshotAgeSeconds: 10,
    });
    const result = evaluateBomSourcingV2({
      lines,
      snapshots: [freshFailure],
      policy: sourcePolicy,
      evaluatedAt: AT,
    });

    expect(result.metrics.status).toBe("complete");
    expect(result.policyStatus).toBe("fail");
    expect(result.metrics.lines[0]?.status).toBe("policy_rejected");
    expect(result.constraints).toContainEqual(expect.objectContaining({ code: "region", status: "fail" }));
    expect(result.constraints).toContainEqual(expect.objectContaining({ code: "single_distributor", status: "fail" }));
    expect(contextualIssues(result, lines, [freshFailure], sourcePolicy)).toEqual([]);
  });

  it("keeps unknown observations explicit and outside policy pass", () => {
    const retrievedAt = "2026-08-23T00:00:00.000000000Z";
    const unknown = offer("digikey", PART_A, retrievedAt, {
      marketplace: { state: "unknown", reason: "not_supported" },
    });
    const source = snapshot("digikey", [PART_A], retrievedAt, [unknown]);
    const lines = [line("a", PART_A)];
    const sourcePolicy = policy();
    const result = evaluateBomSourcingV2({
      lines,
      snapshots: [source],
      policy: sourcePolicy,
      evaluatedAt: AT,
    });

    expect(result.policyStatus).toBe("unknown");
    expect(result.metrics.unknownObservationCount).toBe(1);
    expect(result.metrics.lines[0]).toMatchObject({
      status: "unknown",
      marketplace: { state: "unknown", reason: "not_supported" },
    });
    expect(contextualIssues(result, lines, [source], sourcePolicy)).toEqual([]);
  });

  it("keeps derivable stock and quantity fields on a policy-rejected offer but omits mismatched-currency cost", () => {
    const retrievedAt = "2026-08-23T00:00:00.000000000Z";
    const rejected = offer("digikey", PART_A, retrievedAt, {
      currency: { state: "known", value: "EUR" },
    });
    const source = snapshot("digikey", [PART_A], retrievedAt, [rejected]);
    const lines = [line("a", PART_A)];
    const sourcePolicy = policy();
    const result = evaluateBomSourcingV2({
      lines,
      snapshots: [source],
      policy: sourcePolicy,
      evaluatedAt: AT,
    });

    expect(result.metrics.lines[0]).toMatchObject({
      status: "policy_rejected",
      stockQuantity: 100,
      purchaseQuantity: 10,
      buildableQuantity: 100,
    });
    expect(result.metrics.lines[0]).not.toHaveProperty("extendedCost");
    expect(contextualIssues(result, lines, [source], sourcePolicy)).toEqual([]);
  });

  it("does not mark the single-distributor rule failed when a failed plan also contains an unknown line", () => {
    const retrievedAt = "2026-08-23T00:00:00.000000000Z";
    const digikey = snapshot("digikey", [PART_A, PART_B], retrievedAt, [
      offer("digikey", PART_A, retrievedAt, { region: { state: "known", value: "CA" } }),
      offer("digikey", PART_B, retrievedAt, { marketplace: { state: "unknown", reason: "not_supported" } }),
    ]);
    const mouser = snapshot("mouser", [PART_A, PART_B], retrievedAt, [
      offer("mouser", PART_A, retrievedAt, { region: { state: "known", value: "CA" } }),
      offer("mouser", PART_B, retrievedAt, { region: { state: "known", value: "CA" } }),
    ]);
    const lines = [line("a", PART_A), line("b", PART_B)];
    const sourcePolicy = policy({ mode: "single_distributor", distributors: ["digikey", "mouser"] });
    const result = evaluateBomSourcingV2({
      lines,
      snapshots: [digikey, mouser],
      policy: sourcePolicy,
      evaluatedAt: AT,
    });

    expect(result.constraints).toContainEqual(expect.objectContaining({
      code: "single_distributor",
      status: "unknown",
      inputs: expect.objectContaining({ selectedDistributor: "digikey" }),
    }));
    expect(contextualIssues(result, lines, [digikey, mouser], sourcePolicy)).toEqual([]);
  });

  it("rejects unsafe derived quantity overflow before evaluation", () => {
    const source = snapshot("digikey", [PART_A], "2026-08-23T00:00:00.000000000Z");
    expect(() => evaluateBomSourcingV2({
      lines: [line("a", PART_A, Number.MAX_SAFE_INTEGER)],
      snapshots: [source],
      policy: policy({ buildQuantity: 2 }),
      evaluatedAt: AT,
    })).toThrow(/safe integer/i);
    const unsafePolicy = policy({ minimumStock: 10_000_000_000_000_000 });
    expect(() => evaluateBomSourcingV2({
      lines: [line("a", PART_A)],
      snapshots: [source],
      policy: unsafePolicy,
      evaluatedAt: AT,
    })).toThrow(/safe integers/i);
    const safePolicy = policy();
    const safeResult = evaluateBomSourcingV2({
      lines: [line("a", PART_A)], snapshots: [source], policy: safePolicy, evaluatedAt: AT,
    });
    expect(contextualIssues(safeResult, [line("a", PART_A)], [source], unsafePolicy))
      .toContainEqual(expect.objectContaining({ path: "context.policy" }));
  });

  it("exposes a design-engine-compatible candidate evaluator without changing bytes", () => {
    const retrievedAt = "2026-08-23T00:00:00.000000000Z";
    const source = snapshot("digikey", [PART_A], retrievedAt, [offer("digikey", PART_A, retrievedAt)]);
    const sourcePolicy = policy();
    const lines = [line("a", PART_A)];
    const direct = evaluateBomSourcingV2({ lines, snapshots: [source], policy: sourcePolicy, evaluatedAt: AT });
    const candidate = evaluateCandidateSourcingV2({
      id: `candidate:v2:sha256:${"1".repeat(64)}`,
      components: [{ id: "a", part: PART_A, quantityPerAssembly: 1 }],
    }, [source], sourcePolicy, AT);
    expect(candidate).toEqual(direct);
  });
});
