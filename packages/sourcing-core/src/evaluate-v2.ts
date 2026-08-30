import {
  MAXIMUM_LEAD_KIND_TIE_BREAK_V2,
  aggregateSourcingPolicyStatus,
  canonicalCommercialNumberV2,
  canonicalCommercialRationalV2,
  compareRfc3339InstantsV2,
  emptyLifecycleCountsV2,
  formatRfc3339InstantV2,
  offerSnapshotRef as offerSnapshotRefV2,
  parseCandidateSourcingEvaluationV2,
  parseOfferSnapshotV2,
  parseRfc3339InstantV2,
  parseSourcingPolicy,
  renderSourcingAdvisoryWarning,
  renderSourcingPolicyConstraintV2,
  type BomLineSourcingMetricsV2,
  type CandidateSourcingEvaluationV2,
  type DistributorOfferV2,
  type KnownLeadTimeKind,
  type KnownLifecycleStatus,
  type ManufacturerPartIdentity,
  type OfferSnapshotV2,
  type OfferSnapshotV2Ref,
  type SourcingDataStatus,
  type SourcingPolicy,
  type SourcingPolicyConstraintV2,
  type SourcingPolicyStatus,
} from "@opencircuit/sourcing-schema";

export interface SourcingBomLineV2 {
  bomLineId: string;
  part: ManufacturerPartIdentity;
  quantityPerAssembly: number;
}

export interface EvaluateBomSourcingV2Input {
  lines: readonly SourcingBomLineV2[];
  snapshots: readonly OfferSnapshotV2[];
  policy: Readonly<SourcingPolicy>;
  evaluatedAt: string;
}

export interface SourcingCandidateV2 {
  id: string;
  components: readonly {
    id: string;
    part: ManufacturerPartIdentity;
    quantityPerAssembly: number;
  }[];
}

type CellMap = ReadonlyMap<string, OfferSnapshotV2 | undefined>;

interface EvaluatedLineV2 {
  metrics: BomLineSourcingMetricsV2;
  constraints: SourcingPolicyConstraintV2[];
  status: SourcingPolicyStatus;
}

interface EvaluatedOfferV2 {
  line: EvaluatedLineV2;
  snapshot: OfferSnapshotV2;
  offer: DistributorOfferV2;
}

interface DistributorPlanV2 {
  distributor: string;
  lines: EvaluatedLineV2[];
  status: SourcingPolicyStatus;
  provenFailed: boolean;
  sourcedCount: number;
  comparisonCost?: number;
}

const OBSERVATION_FIELDS = [
  "region", "currency", "packaging", "marketplace", "backorderAvailable",
  "lifecycle", "lifecycleSource", "leadTimeDays", "leadTimeKind",
] as const;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function partKey(part: ManufacturerPartIdentity): string {
  return JSON.stringify([part.manufacturerId, part.manufacturerPartNumber]);
}

function samePart(left: ManufacturerPartIdentity, right: ManufacturerPartIdentity): boolean {
  return left.manufacturerId === right.manufacturerId
    && left.manufacturerPartNumber === right.manufacturerPartNumber;
}

function refKey(ref: OfferSnapshotV2Ref): string {
  return JSON.stringify([ref.schemaVersion, ref.id, ref.contentHash]);
}

function compareRefs(left: OfferSnapshotV2Ref, right: OfferSnapshotV2Ref): number {
  return left.schemaVersion - right.schemaVersion
    || compareText(left.id, right.id)
    || compareText(left.contentHash, right.contentHash);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function normalizePolicy(input: Readonly<SourcingPolicy>): SourcingPolicy {
  const policy = parseSourcingPolicy(input);
  if (!Number.isSafeInteger(policy.buildQuantity) || policy.buildQuantity <= 0
    || !Number.isSafeInteger(policy.maximumSnapshotAgeSeconds) || policy.maximumSnapshotAgeSeconds <= 0
    || (policy.minimumStock !== undefined && (!Number.isSafeInteger(policy.minimumStock) || policy.minimumStock < 0))) {
    throw new Error("V2 sourcing policy unit counts must be safe integers");
  }
  const { distributors, allowedLifecycle, packaging, ...rest } = policy;
  return {
    ...rest,
    distributors: stableUnique(distributors),
    allowedLifecycle: stableUnique(allowedLifecycle) as SourcingPolicy["allowedLifecycle"],
    ...(packaging === undefined
      ? {}
      : { packaging: stableUnique(packaging) as NonNullable<SourcingPolicy["packaging"]> }),
  };
}

function validateLines(input: readonly SourcingBomLineV2[]): SourcingBomLineV2[] {
  if (input.length === 0) throw new Error("Sourcing BOM must contain at least one line");
  const seen = new Set<string>();
  return input.map((source) => {
    if (typeof source.bomLineId !== "string" || source.bomLineId.length === 0) {
      throw new Error("Sourcing BOM line ID must be non-empty");
    }
    if (seen.has(source.bomLineId)) throw new Error(`Duplicate sourcing BOM line ID: ${source.bomLineId}`);
    seen.add(source.bomLineId);
    if (!source.part.manufacturerId || !source.part.manufacturerPartNumber) {
      throw new Error(`Sourcing BOM line ${source.bomLineId} must use exact manufacturer identity`);
    }
    if (!Number.isSafeInteger(source.quantityPerAssembly) || source.quantityPerAssembly <= 0) {
      throw new Error(`Sourcing BOM line ${source.bomLineId} quantity must be a positive safe integer`);
    }
    return cloneJson(source);
  }).sort((left, right) => compareText(left.bomLineId, right.bomLineId));
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error(`${label} exceeds safe integer range`);
  return result;
}

function purchaseQuantity(line: SourcingBomLineV2, offer: DistributorOfferV2, policy: SourcingPolicy): number {
  const required = checkedMultiply(line.quantityPerAssembly, policy.buildQuantity, "Required units");
  const multiple = offer.orderMultiple ?? 1;
  const minimum = Math.max(required, offer.minimumOrderQuantity ?? 1);
  const multipleBigInt = BigInt(multiple);
  const quantityBigInt = ((BigInt(minimum) + multipleBigInt - 1n) / multipleBigInt) * multipleBigInt;
  if (quantityBigInt <= 0n || quantityBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Purchase quantity exceeds safe integer range");
  }
  return Number(quantityBigInt);
}

function applicableUnitPrice(offer: DistributorOfferV2, quantity: number): number | undefined {
  let result: number | undefined;
  for (const priceBreak of offer.priceBreaks) {
    if (priceBreak.quantity <= quantity) result = priceBreak.unitPrice;
    else break;
  }
  return result;
}

function snapshotWinner(left: OfferSnapshotV2, right: OfferSnapshotV2): OfferSnapshotV2 {
  const instant = compareRfc3339InstantsV2(left.retrievedAt, right.retrievedAt);
  if (instant !== 0) return instant > 0 ? left : right;
  const original = compareText(left.retrievedAt, right.retrievedAt);
  if (original !== 0) return original < 0 ? left : right;
  return compareRefs(offerSnapshotRefV2(left), offerSnapshotRefV2(right)) <= 0 ? left : right;
}

function activeCells(
  lines: readonly SourcingBomLineV2[],
  snapshots: readonly OfferSnapshotV2[],
  distributors: readonly string[],
): Map<string, OfferSnapshotV2 | undefined> {
  const cells = new Map<string, OfferSnapshotV2 | undefined>();
  for (const distributor of distributors) {
    for (const line of lines) {
      const key = `${distributor}\u0000${partKey(line.part)}`;
      const matching = snapshots.filter((snapshot) => snapshot.provider === distributor
        && snapshot.requestedParts.some((part) => samePart(part, line.part)));
      cells.set(key, matching.reduce<OfferSnapshotV2 | undefined>(
        (winner, snapshot) => winner === undefined ? snapshot : snapshotWinner(winner, snapshot),
        undefined,
      ));
    }
  }
  return cells;
}

function cell(cells: CellMap, distributor: string, line: SourcingBomLineV2): OfferSnapshotV2 | undefined {
  return cells.get(`${distributor}\u0000${partKey(line.part)}`);
}

function freshnessLimit(snapshot: OfferSnapshotV2, policy: SourcingPolicy): bigint {
  const retrieved = parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds;
  const policyExpiry = retrieved + BigInt(policy.maximumSnapshotAgeSeconds) * 1_000_000_000n;
  formatRfc3339InstantV2(policyExpiry);
  const explicit = parseRfc3339InstantV2(snapshot.expiresAt).epochNanoseconds;
  return explicit < policyExpiry ? explicit : policyExpiry;
}

function isFresh(snapshot: OfferSnapshotV2, policy: SourcingPolicy, evaluatedAt: string): boolean {
  return parseRfc3339InstantV2(evaluatedAt).epochNanoseconds <= freshnessLimit(snapshot, policy);
}

function constraint<Code extends Parameters<typeof renderSourcingPolicyConstraintV2>[0]>(
  code: Code,
  status: SourcingPolicyStatus,
  inputs: Extract<Parameters<typeof renderSourcingPolicyConstraintV2>[2], { code: Code }>,
  bomLineId?: string,
): SourcingPolicyConstraintV2 {
  return bomLineId === undefined
    ? (renderSourcingPolicyConstraintV2 as (...args: unknown[]) => SourcingPolicyConstraintV2)(code, status, inputs)
    : (renderSourcingPolicyConstraintV2 as (...args: unknown[]) => SourcingPolicyConstraintV2)(code, status, inputs, bomLineId);
}

function observationEquality(observed: { state: string; value?: unknown }, required: unknown): SourcingPolicyStatus {
  return observed.state === "unknown" ? "unknown" : observed.value === required ? "pass" : "fail";
}

function evaluateOffer(
  line: SourcingBomLineV2,
  snapshot: OfferSnapshotV2,
  offer: DistributorOfferV2,
  policy: SourcingPolicy,
): EvaluatedOfferV2 {
  const quantity = purchaseQuantity(line, offer, policy);
  const constraints: SourcingPolicyConstraintV2[] = [
    constraint("offer_available", "pass", { code: "offer_available", proof: "offer_present" }, line.bomLineId),
  ];
  const regionStatus = observationEquality(offer.region, policy.region);
  constraints.push(constraint("region", regionStatus, {
    code: "region", observed: cloneJson(offer.region), required: policy.region,
  }, line.bomLineId));
  const currencyStatus = observationEquality(offer.currency, policy.currency);
  constraints.push(constraint("currency", currencyStatus, {
    code: "currency", observed: cloneJson(offer.currency), required: policy.currency,
  }, line.bomLineId));
  if (policy.packaging !== undefined) {
    const status = offer.packaging.state === "unknown"
      ? "unknown"
      : policy.packaging.includes(offer.packaging.value) ? "pass" : "fail";
    constraints.push(constraint("packaging", status, {
      code: "packaging", observed: cloneJson(offer.packaging), allowed: [...policy.packaging],
    }, line.bomLineId));
  }
  if (!policy.allowMarketplace) {
    const status = offer.marketplace.state === "unknown"
      ? "unknown"
      : offer.marketplace.value ? "fail" : "pass";
    constraints.push(constraint("marketplace", status, {
      code: "marketplace", observed: cloneJson(offer.marketplace), allowed: false,
    }, line.bomLineId));
  }
  const allowedLifecycle = stableUnique(
    policy.allowedLifecycle.filter((value) => value !== "unknown"),
  ) as KnownLifecycleStatus[];
  const lifecycleStatus = offer.lifecycle.state === "unknown"
    ? "unknown"
    : offer.lifecycle.value === "obsolete" || !allowedLifecycle.includes(offer.lifecycle.value) ? "fail" : "pass";
  constraints.push(constraint("lifecycle", lifecycleStatus, {
    code: "lifecycle", observed: cloneJson(offer.lifecycle), allowed: allowedLifecycle,
  }, line.bomLineId));
  if (policy.maximumLeadTimeDays !== undefined) {
    const status = offer.leadTimeDays.state === "unknown" || offer.leadTimeKind.state === "unknown"
      ? "unknown"
      : offer.leadTimeDays.value <= policy.maximumLeadTimeDays ? "pass" : "fail";
    constraints.push(constraint("lead_time", status, {
      code: "lead_time",
      days: cloneJson(offer.leadTimeDays),
      kind: cloneJson(offer.leadTimeKind),
      maximumDays: policy.maximumLeadTimeDays,
    }, line.bomLineId));
  }

  let stockStatus: SourcingPolicyStatus = "pass";
  if (policy.minimumStock !== undefined) {
    stockStatus = offer.stockQuantity === undefined
      ? "unknown"
      : offer.stockQuantity >= policy.minimumStock ? "pass" : "fail";
  }
  if (stockStatus !== "fail") {
    if (offer.stockQuantity === undefined) {
      stockStatus = policy.allowBackorder
        && offer.backorderAvailable.state === "known"
        && offer.backorderAvailable.value ? stockStatus : "unknown";
    } else if (offer.stockQuantity < quantity) {
      stockStatus = !policy.allowBackorder
        ? "fail"
        : offer.backorderAvailable.state === "unknown"
          ? "unknown"
          : offer.backorderAvailable.value ? stockStatus : "fail";
    }
  }
  constraints.push(constraint("stock", stockStatus, {
    code: "stock",
    stockQuantity: offer.stockQuantity ?? null,
    purchaseQuantity: quantity,
    minimumStock: policy.minimumStock ?? null,
    backorderAvailable: cloneJson(offer.backorderAvailable),
    allowBackorder: policy.allowBackorder,
  }, line.bomLineId));

  constraints.sort((left, right) => compareText(left.ruleId, right.ruleId));
  const status = aggregateSourcingPolicyStatus(constraints);
  const price = currencyStatus === "pass" ? applicableUnitPrice(offer, quantity) : undefined;
  const amount = price === undefined ? undefined : canonicalCommercialNumberV2(price * quantity);
  const advisories: string[] = [];
  if (offer.leadTimeKind.state === "known" && offer.leadTimeKind.value === "manufacturer") {
    advisories.push(renderSourcingAdvisoryWarning({ code: "manufacturer_lead_not_delivery" }));
  } else if (offer.leadTimeKind.state === "known" && offer.leadTimeKind.value === "factory") {
    advisories.push(renderSourcingAdvisoryWarning({ code: "factory_lead_not_delivery" }));
  }
  if (policy.allowBackorder && offer.backorderAvailable.state === "known" && offer.backorderAvailable.value) {
    if (offer.stockQuantity === undefined) {
      advisories.push(renderSourcingAdvisoryWarning({ code: "stock_unknown_backorder" }));
    } else if (offer.stockQuantity < quantity) {
      advisories.push(renderSourcingAdvisoryWarning({
        code: "stock_short_backorder", stockQuantity: offer.stockQuantity, purchaseQuantity: quantity,
      }));
    }
  }
  if (amount === undefined) {
    advisories.push(renderSourcingAdvisoryWarning({ code: "price_break_unavailable", purchaseQuantity: quantity }));
  }
  const warnings = stableUnique([
    ...constraints.filter((entry) => entry.status !== "pass").map((entry) => entry.explanation),
    ...advisories,
  ]);
  const metrics: BomLineSourcingMetricsV2 = {
    bomLineId: line.bomLineId,
    part: cloneJson(line.part),
    quantityPerAssembly: line.quantityPerAssembly,
    status: status === "pass" ? "sourced" : status === "fail" ? "policy_rejected" : "unknown",
    evaluatedOffer: {
      snapshot: offerSnapshotRefV2(snapshot),
      distributor: offer.distributor,
      distributorSku: offer.distributorSku,
    },
    region: cloneJson(offer.region),
    currency: cloneJson(offer.currency),
    packaging: cloneJson(offer.packaging),
    marketplace: cloneJson(offer.marketplace),
    backorderAvailable: cloneJson(offer.backorderAvailable),
    lifecycle: cloneJson(offer.lifecycle),
    lifecycleSource: cloneJson(offer.lifecycleSource),
    leadTimeDays: cloneJson(offer.leadTimeDays),
    leadTimeKind: cloneJson(offer.leadTimeKind),
    ...(offer.stockQuantity === undefined ? {} : {
      stockQuantity: offer.stockQuantity,
      buildableQuantity: Number(BigInt(offer.stockQuantity) / BigInt(line.quantityPerAssembly)),
    }),
    purchaseQuantity: quantity,
    ...(amount === undefined ? {} : { extendedCost: { amount, currency: policy.currency } }),
    warnings,
  };
  return { line: { metrics, constraints, status }, snapshot, offer };
}

function leadTuple(entry: EvaluatedOfferV2): readonly [number, number] | undefined {
  const days = entry.offer.leadTimeDays;
  const kind = entry.offer.leadTimeKind;
  if (days.state !== "known" || kind.state !== "known") return undefined;
  return [days.value, MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(kind.value)];
}

function compareEvaluatedOffers(left: EvaluatedOfferV2, right: EvaluatedOfferV2): number {
  const statusOrder: Record<SourcingPolicyStatus, number> = { pass: 0, unknown: 1, fail: 2 };
  let result = statusOrder[left.line.status] - statusOrder[right.line.status];
  if (result !== 0) return result;
  const leftCost = left.line.metrics.extendedCost?.amount;
  const rightCost = right.line.metrics.extendedCost?.amount;
  if ((leftCost === undefined) !== (rightCost === undefined)) return leftCost === undefined ? 1 : -1;
  if (leftCost !== undefined && rightCost !== undefined && leftCost !== rightCost) return leftCost - rightCost;
  const leftBuild = left.line.metrics.buildableQuantity;
  const rightBuild = right.line.metrics.buildableQuantity;
  if ((leftBuild === undefined) !== (rightBuild === undefined)) return leftBuild === undefined ? 1 : -1;
  if (leftBuild !== undefined && rightBuild !== undefined && leftBuild !== rightBuild) return rightBuild - leftBuild;
  const leftLead = leadTuple(left);
  const rightLead = leadTuple(right);
  if ((leftLead === undefined) !== (rightLead === undefined)) return leftLead === undefined ? 1 : -1;
  if (leftLead !== undefined && rightLead !== undefined) {
    result = leftLead[0] - rightLead[0] || leftLead[1] - rightLead[1];
    if (result !== 0) return result;
  }
  return compareText(left.offer.distributor, right.offer.distributor)
    || compareText(left.offer.distributorSku, right.offer.distributorSku)
    || compareRefs(offerSnapshotRefV2(left.snapshot), offerSnapshotRefV2(right.snapshot));
}

function unavailableLine(
  line: SourcingBomLineV2,
  proof: "fresh_complete_no_offer" | "not_proven",
): EvaluatedLineV2 {
  const status: SourcingPolicyStatus = proof === "fresh_complete_no_offer" ? "fail" : "unknown";
  const availability = constraint("offer_available", status, { code: "offer_available", proof }, line.bomLineId);
  return {
    metrics: {
      bomLineId: line.bomLineId,
      part: cloneJson(line.part),
      quantityPerAssembly: line.quantityPerAssembly,
      status: "unavailable",
      warnings: [availability.explanation],
    },
    constraints: [availability],
    status,
  };
}

function reprojectUntrustedFailures(line: EvaluatedLineV2): EvaluatedLineV2 {
  if (!line.constraints.some((entry) => entry.status === "fail")) return line;
  const priorConstraintWarnings = new Set(
    line.constraints.filter((entry) => entry.status !== "pass").map((entry) => entry.explanation),
  );
  const constraints = line.constraints.map((entry) => entry.status === "fail"
    ? constraint(entry.code, "unknown", entry.inputs as never, entry.bomLineId)
    : entry);
  const status = aggregateSourcingPolicyStatus(constraints);
  const advisories = line.metrics.warnings.filter((warning) => !priorConstraintWarnings.has(warning));
  const warnings = stableUnique([
    ...constraints.filter((entry) => entry.status !== "pass").map((entry) => entry.explanation),
    ...advisories,
  ]);
  return {
    metrics: {
      ...line.metrics,
      status: line.metrics.evaluatedOffer === undefined
        ? "unavailable"
        : status === "pass" ? "sourced" : status === "unknown" ? "unknown" : "policy_rejected",
      warnings,
    },
    constraints,
    status,
  };
}

function evaluateLineForDistributors(
  line: SourcingBomLineV2,
  distributors: readonly string[],
  cells: CellMap,
  policy: SourcingPolicy,
  evaluatedAt: string,
  requireEveryDistributorForNegativeProof: boolean,
): EvaluatedLineV2 {
  const evaluated: EvaluatedOfferV2[] = [];
  for (const distributor of distributors) {
    const snapshot = cell(cells, distributor, line);
    if (snapshot === undefined) continue;
    for (const offer of snapshot.offers.filter((candidate) => samePart(candidate.part, line.part))) {
      evaluated.push(evaluateOffer(line, snapshot, offer, policy));
    }
  }
  const selected = evaluated.sort(compareEvaluatedOffers)[0];
  if (selected !== undefined) return selected.line;
  const proofs = distributors.map((distributor) => {
    const snapshot = cell(cells, distributor, line);
    return snapshot !== undefined
      && isFresh(snapshot, policy, evaluatedAt)
      && snapshot.status === "complete"
      && !snapshot.offers.some((offer) => samePart(offer.part, line.part));
  });
  const proved = requireEveryDistributorForNegativeProof ? proofs.every(Boolean) : proofs[0] === true;
  return unavailableLine(line, proved ? "fresh_complete_no_offer" : "not_proven");
}

function stagedCost(lines: readonly EvaluatedLineV2[]): number | undefined {
  if (lines.some((line) => line.metrics.extendedCost === undefined)) return undefined;
  let total = 0;
  for (const line of [...lines].sort((left, right) => compareText(left.metrics.bomLineId, right.metrics.bomLineId))) {
    total = canonicalCommercialNumberV2(total + line.metrics.extendedCost!.amount);
  }
  return total;
}

function buildPlan(
  distributor: string,
  lines: readonly SourcingBomLineV2[],
  cells: CellMap,
  policy: SourcingPolicy,
  evaluatedAt: string,
): DistributorPlanV2 {
  const freshComplete = lines.map((line) => {
    const snapshot = cell(cells, distributor, line);
    return snapshot !== undefined
      && snapshot.status === "complete"
      && isFresh(snapshot, policy, evaluatedAt);
  });
  const evaluated = lines.map((line, index) => {
    const projected = evaluateLineForDistributors(
      line, [distributor], cells, policy, evaluatedAt, false,
    );
    return freshComplete[index] ? projected : reprojectUntrustedFailures(projected);
  });
  const comparisonCost = stagedCost(evaluated);
  return {
    distributor,
    lines: evaluated,
    status: aggregateSourcingPolicyStatus(evaluated.flatMap((line) => line.constraints)),
    provenFailed: freshComplete.every(Boolean)
      && evaluated.some((line) => line.status === "fail")
      && evaluated.every((line) => line.status !== "unknown"),
    sourcedCount: evaluated.filter((line) => line.metrics.status === "sourced").length,
    ...(comparisonCost === undefined ? {} : { comparisonCost }),
  };
}

function comparePlans(left: DistributorPlanV2, right: DistributorPlanV2): number {
  const statusOrder: Record<SourcingPolicyStatus, number> = { pass: 0, unknown: 1, fail: 2 };
  const status = statusOrder[left.status] - statusOrder[right.status];
  if (status !== 0) return status;
  const count = right.sourcedCount - left.sourcedCount;
  if (count !== 0) return count;
  if ((left.comparisonCost === undefined) !== (right.comparisonCost === undefined)) {
    return left.comparisonCost === undefined ? 1 : -1;
  }
  if (left.comparisonCost !== undefined && right.comparisonCost !== undefined
    && left.comparisonCost !== right.comparisonCost) return left.comparisonCost - right.comparisonCost;
  return compareText(left.distributor, right.distributor);
}

function transportState(
  active: readonly (OfferSnapshotV2 | undefined)[],
  policy: SourcingPolicy,
  evaluatedAt: string,
): { status: SourcingDataStatus; age?: number; earliest?: string } {
  const distinct = [...new Map(active.filter((value): value is OfferSnapshotV2 => value !== undefined)
    .map((snapshot) => [refKey(offerSnapshotRefV2(snapshot)), snapshot])).values()];
  if (distinct.length === 0) return { status: "unavailable" };
  const evaluated = parseRfc3339InstantV2(evaluatedAt).epochNanoseconds;
  const ages = distinct.map((snapshot) => evaluated - parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds);
  if (ages.some((age) => age < 0n)) throw new Error("Snapshot retrieval must not be later than evaluatedAt");
  let maximumAge = 0n;
  for (const age of ages) if (age > maximumAge) maximumAge = age;
  const earliestSnapshot = [...distinct].sort((left, right) => (
    compareRfc3339InstantsV2(left.expiresAt, right.expiresAt)
    || compareText(left.expiresAt, right.expiresAt)
    || compareRefs(offerSnapshotRefV2(left), offerSnapshotRefV2(right))
  ))[0]!;
  const projection = {
    age: canonicalCommercialRationalV2(maximumAge, 1_000_000_000n),
    earliest: earliestSnapshot.expiresAt,
  };
  if (active.every((snapshot) => snapshot !== undefined)
    && distinct.every((snapshot) => snapshot.status === "provider_error" && snapshot.offers.length === 0)) {
    return { status: "provider_error", ...projection };
  }
  if (distinct.some((snapshot) => !isFresh(snapshot, policy, evaluatedAt))) return { status: "stale", ...projection };
  if (active.some((snapshot) => snapshot === undefined)
    || distinct.some((snapshot) => snapshot.status !== "complete")) return { status: "partial", ...projection };
  return { status: "complete", ...projection };
}

function candidateAggregates(lines: readonly BomLineSourcingMetricsV2[], policy: SourcingPolicy) {
  const allSourced = lines.every((line) => line.status === "sourced");
  const allBuildable = allSourced && lines.every((line) => line.buildableQuantity !== undefined);
  const allCosted = allSourced && lines.every((line) => line.extendedCost?.currency === policy.currency);
  const allLead = allSourced && lines.every((line) => line.leadTimeDays?.state === "known"
    && line.leadTimeKind?.state === "known");
  const distributors = stableUnique(lines.flatMap((line) => line.evaluatedOffer?.distributor ?? []));
  const lifecycleCounts = emptyLifecycleCountsV2();
  for (const line of lines) {
    if (line.lifecycle?.state === "known") lifecycleCounts[line.lifecycle.value] += 1;
    else lifecycleCounts.unknown += 1;
  }
  let cost: number | undefined;
  if (allCosted) {
    let total = 0;
    for (const line of [...lines].sort((left, right) => compareText(left.bomLineId, right.bomLineId))) {
      total = canonicalCommercialNumberV2(total + line.extendedCost!.amount);
    }
    cost = total;
  }
  const knownLeadLines = allLead ? lines.map((line) => {
    const days = line.leadTimeDays;
    const kind = line.leadTimeKind;
    if (days?.state !== "known" || kind?.state !== "known") {
      throw new Error("Known lead-time aggregate invariant was violated");
    }
    return { line, days: days.value, kind: kind.value };
  }) : [];
  const lead = knownLeadLines.sort((left, right) => (
    right.days - left.days
    || MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(left.kind)
      - MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(right.kind)
    || compareText(left.line.bomLineId, right.line.bomLineId)
  ))[0];
  const bottleneckDerivable = lines.every((line) => line.buildableQuantity !== undefined && line.status !== "unknown");
  const bottleneck = bottleneckDerivable ? [...lines].sort((left, right) => (
    left.buildableQuantity! - right.buildableQuantity! || compareText(left.bomLineId, right.bomLineId)
  ))[0] : undefined;
  return {
    ...(allBuildable ? { buildableQuantity: Math.min(...lines.map((line) => line.buildableQuantity!)) } : {}),
    ...(cost === undefined ? {} : { extendedBomCost: { amount: cost, currency: policy.currency } }),
    ...(lead === undefined ? {} : {
      maximumLeadTimeDays: lead.days,
      maximumLeadTimeKind: lead.kind as KnownLeadTimeKind,
    }),
    lifecycleCounts,
    ...(allSourced ? {
      distributorSplitCount: distributors.length,
      singleDistributorComplete: distributors.length === 1,
    } : {}),
    ...(bottleneck === undefined ? {} : {
      bottleneckPart: {
        bomLineId: bottleneck.bomLineId,
        part: cloneJson(bottleneck.part),
        reason: bottleneck.status === "sourced" ? "stock" as const : "policy" as const,
      },
    }),
  };
}

function unknownObservationCount(lines: readonly BomLineSourcingMetricsV2[]): number {
  return lines.reduce((count, line) => count + OBSERVATION_FIELDS.filter(
    (field) => line[field]?.state === "unknown",
  ).length, 0);
}

export function evaluateBomSourcingV2(input: EvaluateBomSourcingV2Input): CandidateSourcingEvaluationV2 {
  const policy = normalizePolicy(input.policy);
  const lines = validateLines(input.lines);
  parseRfc3339InstantV2(input.evaluatedAt);
  const snapshots = input.snapshots.map(parseOfferSnapshotV2)
    .sort((left, right) => compareRefs(offerSnapshotRefV2(left), offerSnapshotRefV2(right)));
  const refs = snapshots.map(offerSnapshotRefV2);
  if (new Set(refs.map(refKey)).size !== refs.length) throw new Error("Duplicate V2 snapshot ref");
  for (const snapshot of snapshots) {
    if (snapshot.evaluationEligibility !== "native_v2") throw new Error("Audit-only snapshots cannot enter V2 evaluation");
    if (compareRfc3339InstantsV2(snapshot.retrievedAt, input.evaluatedAt) > 0) {
      throw new Error("Snapshot retrieval must not be later than evaluatedAt");
    }
  }
  const cells = activeCells(lines, snapshots, policy.distributors);
  let selectedLines: EvaluatedLineV2[];
  let activeForTransport: Array<OfferSnapshotV2 | undefined>;
  let singleConstraint: SourcingPolicyConstraintV2 | undefined;
  if (policy.mode === "single_distributor") {
    const plans = policy.distributors.map((distributor) => buildPlan(
      distributor, lines, cells, policy, input.evaluatedAt,
    )).sort(comparePlans);
    const selected = plans[0];
    if (selected === undefined) throw new Error("Single-distributor policy must contain a distributor");
    selectedLines = selected.lines;
    activeForTransport = lines.map((line) => cell(cells, selected.distributor, line));
    const allPlansProvenFail = plans.every((plan) => plan.provenFailed);
    const status: SourcingPolicyStatus = selected.status === "pass"
      ? "pass"
      : allPlansProvenFail ? "fail" : "unknown";
    singleConstraint = constraint("single_distributor", status, {
      code: "single_distributor",
      selectedDistributor: selected.distributor,
      observedDistributors: stableUnique(selected.lines.flatMap(
        (line) => line.metrics.evaluatedOffer?.distributor ?? [],
      )),
    });
  } else {
    selectedLines = lines.map((line) => evaluateLineForDistributors(
      line, policy.distributors, cells, policy, input.evaluatedAt, true,
    ));
    activeForTransport = policy.distributors.flatMap((distributor) => lines.map((line) => cell(cells, distributor, line)));
  }
  const transport = transportState(activeForTransport, policy, input.evaluatedAt);
  const dataConstraint = constraint("data_status", transport.status === "complete" ? "pass" : "unknown", {
    code: "data_status", dataStatus: transport.status,
  });
  const constraints = [
    dataConstraint,
    ...selectedLines.flatMap((line) => line.constraints),
    ...(singleConstraint === undefined ? [] : [singleConstraint]),
  ].sort((left, right) => compareText(left.bomLineId ?? "", right.bomLineId ?? "")
    || compareText(left.ruleId, right.ruleId)
    || compareText(left.explanation, right.explanation));
  const policyStatus = aggregateSourcingPolicyStatus(constraints);
  const lineMetrics = selectedLines.map((line) => line.metrics).sort((left, right) => compareText(left.bomLineId, right.bomLineId));
  const candidateWarnings = stableUnique([
    ...lineMetrics.flatMap((line) => line.warnings),
    ...constraints.filter((entry) => entry.bomLineId === undefined && entry.status !== "pass")
      .map((entry) => entry.explanation),
  ]);
  return parseCandidateSourcingEvaluationV2({
    metrics: {
      schemaVersion: 2,
      warningCatalogVersion: 1,
      status: transport.status,
      policyStatus,
      unknownObservationCount: unknownObservationCount(lineMetrics),
      requestedBuildQuantity: policy.buildQuantity,
      evaluatedAt: input.evaluatedAt,
      snapshotRefs: refs,
      ...(transport.age === undefined ? {} : { snapshotAgeSeconds: transport.age }),
      ...(transport.earliest === undefined ? {} : { earliestSnapshotExpiresAt: transport.earliest }),
      lines: lineMetrics,
      ...candidateAggregates(lineMetrics, policy),
      warnings: candidateWarnings,
    },
    policyStatus,
    constraints,
  });
}

export function evaluateCandidateSourcingV2(
  candidate: Readonly<SourcingCandidateV2>,
  snapshots: readonly OfferSnapshotV2[],
  policy: Readonly<SourcingPolicy>,
  evaluatedAt: string,
): CandidateSourcingEvaluationV2 {
  return evaluateBomSourcingV2({
    lines: candidate.components.map((component) => ({
      bomLineId: component.id,
      part: component.part,
      quantityPerAssembly: component.quantityPerAssembly,
    })),
    snapshots,
    policy,
    evaluatedAt,
  });
}
