import { describe, expect, it } from "vitest";
import { designRequestHash, type ConstraintResult } from "@opencircuit/design-schema";
import {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
  DISTRIBUTOR_IDS,
  OFFER_SNAPSHOT_SCHEMA_VERSION,
  calculateOfferSnapshotContentHash,
  emptyLifecycleCounts,
  type CandidateSourcingMetrics,
  type DistributorOffer,
  type ManufacturerPartIdentity,
  type OfferSnapshot,
  type SourcingPolicy,
} from "@opencircuit/sourcing-schema";
import {
  generateDesign,
  type CandidateForMaterialization,
  type DesignRecipe,
  type EvaluateSourcing,
  type RecipeEnvironment,
  type SourcingCandidate,
  type SourcingEvaluation,
} from "../src";
import { createToyPipelineHarness } from "./toy";

const EVALUATED_AT = "2026-08-23T00:00:00.000Z";
const EXPIRES_AT = "2026-08-23T01:00:00.000Z";
const recipeRequestExcludesSourcing: "sourcing" extends keyof RecipeEnvironment["request"] ? false : true = true;
const materializationExcludesSourcing: "sourcing" extends keyof CandidateForMaterialization ? false : true = true;

const toyPartKeys = [
  "boundary",
  "dominated",
  "duplicate",
  "fail",
  "match-reject",
  "solve-reject",
  "tie-a",
  "tie-b",
  "unknown",
] as const;

function toyPart(partKey: string): ManufacturerPartIdentity {
  return { manufacturerId: "toy-vendor", manufacturerPartNumber: `TOY-${partKey.toUpperCase()}` };
}

function samePart(left: ManufacturerPartIdentity, right: ManufacturerPartIdentity): boolean {
  return left.manufacturerId === right.manufacturerId && left.manufacturerPartNumber === right.manufacturerPartNumber;
}

function sourcingPolicy(buildQuantity = 100): SourcingPolicy {
  return {
    schemaVersion: 1,
    distributors: [DISTRIBUTOR_IDS.digikey],
    mode: "any_selected",
    buildQuantity,
    region: "US",
    currency: "USD",
    allowedLifecycle: ["active"],
    minimumStock: buildQuantity,
    maximumLeadTimeDays: 30,
    allowBackorder: false,
    allowMarketplace: false,
    packaging: ["cut_tape"],
    maximumSnapshotAgeSeconds: 3_600,
  };
}

function toySnapshot(stockQuantity: number, unitPrice: number): OfferSnapshot {
  const offers: DistributorOffer[] = toyPartKeys.map((partKey) => ({
    distributor: DISTRIBUTOR_IDS.digikey,
    distributorSku: `SYN-DK-${partKey.toUpperCase()}`,
    part: toyPart(partKey),
    region: "US",
    currency: "USD",
    packaging: "cut_tape",
    marketplace: false,
    backorderAvailable: false,
    stockQuantity,
    minimumOrderQuantity: 1,
    orderMultiple: 1,
    leadTimeDays: 14,
    leadTimeKind: "manufacturer",
    lifecycle: "active",
    lifecycleSource: "manufacturer",
    priceBreaks: [{ quantity: 1, unitPrice: unitPrice + 0.25 }, { quantity: 100, unitPrice }],
    productUrl: `https://example.invalid/digikey/SYN-DK-${partKey.toUpperCase()}`,
    retrievedAt: EVALUATED_AT,
  }));
  const withoutHash: Omit<OfferSnapshot, "contentHash"> = {
    schemaVersion: OFFER_SNAPSHOT_SCHEMA_VERSION,
    id: `snapshot:synthetic:toy:${stockQuantity}:${unitPrice}`,
    provider: DISTRIBUTOR_IDS.digikey,
    requestedParts: toyPartKeys.map(toyPart),
    retrievedAt: EVALUATED_AT,
    expiresAt: EXPIRES_AT,
    persistence: "ephemeral",
    status: "complete",
    errors: [],
    offers,
  };
  return { ...withoutHash, contentHash: calculateOfferSnapshotContentHash(withoutHash) };
}

function sourcingMetrics(
  candidate: Readonly<SourcingCandidate>,
  snapshots: readonly OfferSnapshot[],
  policy: Readonly<SourcingPolicy>,
  evaluatedAt: string,
  manufacturerLabel: string,
): CandidateSourcingMetrics {
  const snapshot = snapshots[0];
  if (!snapshot) throw new Error("Test evaluator requires a synthetic snapshot");
  const lines = candidate.components.map((component) => {
    const offer = snapshot.offers.find((entry) => samePart(entry.part, component.part));
    if (!offer || offer.stockQuantity === undefined) throw new Error(`Missing synthetic offer for ${component.part.manufacturerPartNumber}`);
    const required = policy.buildQuantity * component.quantityPerAssembly;
    const minimum = Math.max(required, offer.minimumOrderQuantity ?? 1);
    const multiple = offer.orderMultiple ?? 1;
    const purchaseQuantity = Math.ceil(minimum / multiple) * multiple;
    const price = offer.priceBreaks.filter((entry) => entry.quantity <= purchaseQuantity).at(-1);
    if (!price) throw new Error("Synthetic offer is missing an applicable price break");
    if (offer.leadTimeDays === undefined || offer.leadTimeKind === undefined) throw new Error("Synthetic offer is missing lead-time semantics");
    return {
      bomLineId: component.id,
      part: component.part,
      quantityPerAssembly: component.quantityPerAssembly,
      status: "sourced" as const,
      selectedOffer: { snapshotId: snapshot.id, distributor: offer.distributor, distributorSku: offer.distributorSku },
      packaging: offer.packaging,
      lifecycle: offer.lifecycle,
      stockQuantity: offer.stockQuantity,
      purchaseQuantity,
      buildableQuantity: Math.floor(offer.stockQuantity / component.quantityPerAssembly),
      extendedCost: { amount: purchaseQuantity * price.unitPrice, currency: offer.currency },
      leadTimeDays: offer.leadTimeDays,
      leadTimeKind: offer.leadTimeKind,
      warnings: [`Display label: ${manufacturerLabel}`],
    };
  });
  const totalCost = lines.reduce((total, line) => total + line.extendedCost.amount, 0);
  return {
    schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
    status: "complete",
    requestedBuildQuantity: policy.buildQuantity,
    evaluatedAt,
    snapshotIds: [snapshot.id],
    snapshotAgeSeconds: 0,
    earliestSnapshotExpiresAt: snapshot.expiresAt,
    lines,
    buildableQuantity: Math.min(...lines.map((line) => line.buildableQuantity)),
    extendedBomCost: { amount: totalCost, currency: policy.currency },
    maximumLeadTimeDays: Math.max(...lines.map((line) => line.leadTimeDays ?? 0)),
    maximumLeadTimeKind: "manufacturer",
    lifecycleCounts: { ...emptyLifecycleCounts(), active: lines.length },
    distributorSplitCount: 1,
    singleDistributorComplete: true,
    warnings: [`Manufacturer display labels are volatile: ${manufacturerLabel}`],
  };
}

function evaluator(
  manufacturerLabel: string,
  evaluatedParts: ManufacturerPartIdentity[] = [],
  reject?: (candidate: Readonly<SourcingCandidate>) => boolean,
  seenTimestamps: string[] = [],
): EvaluateSourcing {
  return (candidate, snapshots, policy, evaluatedAt): SourcingEvaluation => {
    evaluatedParts.push(...candidate.components.map((component) => component.part));
    seenTimestamps.push(evaluatedAt);
    const isRejected = reject?.(candidate) ?? false;
    const constraints: ConstraintResult[] = [{
      ruleId: "sourcing.synthetic-policy",
      status: isRejected ? "fail" : "pass",
      explanation: isRejected ? "Synthetic sourcing policy rejection" : "Synthetic sourcing policy pass",
      evidence: [],
    }];
    return {
      metrics: sourcingMetrics(candidate, snapshots, policy, evaluatedAt, manufacturerLabel),
      eligible: !isRejected,
      constraints,
    };
  };
}

function withSourcingPolicy(): ReturnType<typeof createToyPipelineHarness> {
  const harness = createToyPipelineHarness();
  harness.request.sourcing = sourcingPolicy();
  return harness;
}

function instrumentElectricalBoundary(
  recipe: DesignRecipe,
  runtimeChecks: boolean[],
): DesignRecipe {
  const checkEnvironment = (environment: RecipeEnvironment): void => {
    runtimeChecks.push(!("sourcing" in environment.request));
  };
  return {
    ...recipe,
    supports: (request) => {
      runtimeChecks.push(!("sourcing" in request));
      return recipe.supports(request);
    },
    enumerate: (environment) => {
      checkEnvironment(environment);
      return recipe.enumerate(environment);
    },
    solve: (option, environment) => {
      checkEnvironment(environment);
      return recipe.solve(option, environment);
    },
    match: (option, environment) => {
      checkEnvironment(environment);
      return recipe.match(option, environment);
    },
    check: (option, environment) => {
      checkEnvironment(environment);
      return recipe.check(option, environment);
    },
    estimate: (option, constraints, environment) => {
      checkEnvironment(environment);
      return recipe.estimate(option, constraints, environment);
    },
    materialize: (candidate, environment) => {
      checkEnvironment(environment);
      runtimeChecks.push(!("sourcing" in candidate));
      runtimeChecks.push(candidate.constraints.every((constraint) => !constraint.ruleId.startsWith("sourcing.")));
      return recipe.materialize(candidate, environment);
    },
  };
}

function electricalProjection(candidate: ReturnType<typeof generateDesign>["candidates"][number]): unknown {
  return {
    id: candidate.id,
    components: candidate.components,
    derivedValues: candidate.derivedValues,
    metrics: candidate.metrics,
    simulationCoverage: candidate.simulationCoverage,
    circuit: candidate.circuit,
    warnings: candidate.warnings,
  };
}

describe("design-engine sourcing boundary", () => {
  it("retains electrical candidates with explicit unavailable sourcing when snapshots are missing", () => {
    const baselineHarness = createToyPipelineHarness();
    const baseline = generateDesign(baselineHarness.request, baselineHarness.context);
    const sourcedHarness = withSourcingPolicy();
    let evaluatorCalls = 0;
    sourcedHarness.context.evaluateSourcing = (..._arguments) => {
      evaluatorCalls += 1;
      throw new Error("Evaluator must not run without a validated snapshot");
    };
    const unavailable = generateDesign(sourcedHarness.request, sourcedHarness.context);

    expect(evaluatorCalls).toBe(0);
    expect(unavailable.candidates).toHaveLength(baseline.candidates.length);
    expect(unavailable.candidates.map((candidate) => candidate.id)).toEqual(baseline.candidates.map((candidate) => candidate.id));
    expect(unavailable.candidates.map((candidate) => candidate.circuit)).toEqual(baseline.candidates.map((candidate) => candidate.circuit));
    expect(unavailable.candidates.every((candidate) => candidate.sourcing?.status === "unavailable")).toBe(true);
    expect(unavailable.candidates.every((candidate) => candidate.sourcing?.lines.every((line) => line.status === "unavailable"))).toBe(true);
    expect(unavailable.requestHash).toBe(designRequestHash(unavailable.request));
  });

  it("keeps electrical feasibility, IDs, and circuits independent of labels and volatile offers", () => {
    const electricalHarness = createToyPipelineHarness();
    const electricalOnly = generateDesign(electricalHarness.request, electricalHarness.context);
    const highStock = withSourcingPolicy();
    const highTimestamps: string[] = [];
    highStock.context.offerSnapshots = [toySnapshot(1_000, 0.5)];
    highStock.context.evaluateSourcing = evaluator("Original Brand Label", [], undefined, highTimestamps);
    const highResult = generateDesign(highStock.request, highStock.context);

    const lowStock = withSourcingPolicy();
    const lowTimestamps: string[] = [];
    lowStock.context.offerSnapshots = [toySnapshot(200, 1.25)];
    lowStock.context.evaluateSourcing = evaluator("Renamed Brand Label", [], undefined, lowTimestamps);
    const lowResult = generateDesign(lowStock.request, lowStock.context);

    expect(highResult.candidates.map(electricalProjection)).toEqual(electricalOnly.candidates.map(electricalProjection));
    expect(highResult.candidates.map(electricalProjection)).toEqual(lowResult.candidates.map(electricalProjection));
    expect(highResult.candidates.map((candidate) => candidate.sourcing?.buildableQuantity)).not.toEqual(lowResult.candidates.map((candidate) => candidate.sourcing?.buildableQuantity));
    expect(highResult.candidates.map((candidate) => candidate.sourcing?.extendedBomCost)).not.toEqual(lowResult.candidates.map((candidate) => candidate.sourcing?.extendedBomCost));
    expect(highTimestamps.length).toBeGreaterThan(0);
    expect(highTimestamps.every((timestamp) => timestamp === EVALUATED_AT)).toBe(true);
    expect(lowTimestamps.every((timestamp) => timestamp === EVALUATED_AT)).toBe(true);
    expect(highResult.requestHash).toBe(designRequestHash(highResult.request));
    expect(lowResult.requestHash).toBe(designRequestHash(lowResult.request));
  });

  it("enriches only after electrical checks and never exposes sourcing to recipe hooks", () => {
    expect(recipeRequestExcludesSourcing).toBe(true);
    expect(materializationExcludesSourcing).toBe(true);
    const harness = withSourcingPolicy();
    const runtimeChecks: boolean[] = [];
    harness.context.recipes = harness.context.recipes.map((recipe) => instrumentElectricalBoundary(recipe, runtimeChecks));
    harness.context.offerSnapshots = [toySnapshot(1_000, 0.5)];
    const evaluatedParts: ManufacturerPartIdentity[] = [];
    harness.context.evaluateSourcing = evaluator("Synthetic Brand", evaluatedParts);
    const result = generateDesign(harness.request, harness.context);

    expect(runtimeChecks.length).toBeGreaterThan(0);
    expect(runtimeChecks.every(Boolean)).toBe(true);
    expect(evaluatedParts.length).toBeGreaterThan(0);
    expect(evaluatedParts.some((part) => part.manufacturerPartNumber === "TOY-FAIL")).toBe(false);
    expect(evaluatedParts.some((part) => part.manufacturerPartNumber === "TOY-UNKNOWN")).toBe(false);
    expect(result.rejections).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "check", optionKey: harness.expected.optionKeys.overBoundaryFail }),
      expect.objectContaining({ stage: "check", optionKey: harness.expected.optionKeys.missingUnknown }),
    ]));
    expect(result.trace.counts.sourced).toBe(evaluatedParts.length);
    expect(result.candidates.every((candidate) => candidate.constraints.some((constraint) => constraint.ruleId === "sourcing.synthetic-policy" && constraint.status === "pass"))).toBe(true);
    for (const candidate of result.candidates) {
      const identity: ManufacturerPartIdentity = candidate.components[0]!.part;
      expect(identity.manufacturerId).toBe("toy-vendor");
      expect(identity.manufacturerPartNumber).toMatch(/^TOY-/);
    }
  });

  it("cannot use an in-stock sourcing alternative to bypass electrical recheck", () => {
    const baselineHarness = createToyPipelineHarness();
    const baseline = generateDesign(baselineHarness.request, baselineHarness.context);
    const boundary = baseline.candidates.find((candidate) => candidate.circuit.meta.title === "boundary-pass");
    expect(boundary).toBeDefined();

    const harness = withSourcingPolicy();
    harness.context.offerSnapshots = [toySnapshot(10_000, 0.1)];
    const evaluatedParts: ManufacturerPartIdentity[] = [];
    harness.context.evaluateSourcing = evaluator(
      "Synthetic Brand",
      evaluatedParts,
      (candidate) => candidate.components.some((component) => component.part.manufacturerPartNumber === "TOY-BOUNDARY"),
    );
    const result = generateDesign(harness.request, harness.context);

    expect(result.candidates.some((candidate) => candidate.id === boundary!.id)).toBe(false);
    expect(result.rejections).toContainEqual(expect.objectContaining({
      stage: "sourcing",
      candidateId: boundary!.id,
      optionKey: harness.expected.optionKeys.boundaryPass,
    }));
    expect(result.rejections).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: "check", optionKey: harness.expected.optionKeys.overBoundaryFail }),
    ]));
    expect(evaluatedParts.some((part) => part.manufacturerPartNumber === "TOY-FAIL")).toBe(false);
    expect(result.candidates.some((candidate) => candidate.components.some((component) => component.part.manufacturerPartNumber === "TOY-FAIL"))).toBe(false);
  });
});
