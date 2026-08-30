import {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
  emptyLifecycleCounts,
  isManufacturerId,
  parseCandidateSourcingMetrics,
  parseOfferSnapshot,
  parseSourcingPolicy,
  snapshotFreshnessAt,
  type BomBottleneck,
  type BomLineSourcingMetrics,
  type DistributorOffer,
  type LeadTimeKind,
  type LifecycleCounts,
  type ManufacturerPartIdentity,
  type OfferSnapshot,
  type SourcingDataStatus,
  type SourcingPolicy,
} from "@opencircuit/sourcing-schema";
import type {
  BomSourcingEvaluation,
  CandidateSourcingEvaluation,
  CandidateWithSourcingBom,
  EvaluateBomSourcingInput,
  SourcingBomLine,
  SourcingPolicyDecision,
  SourcingPolicyDecisionCode,
  SourcingPolicyDecisionStatus,
} from "./types";

type LineFailureReason = "policy" | "stock" | "lead_time" | "unavailable";
type OfferState = "accepted" | "unknown" | "rejected";

interface ActiveSnapshot {
  snapshot: OfferSnapshot;
  stale: boolean;
}

interface EvaluatedOffer {
  snapshot: OfferSnapshot;
  offer: DistributorOffer;
  state: OfferState;
  purchaseQuantity: number;
  buildableQuantity?: number;
  extendedCost?: number;
  failureReason?: LineFailureReason;
  code: SourcingPolicyDecisionCode;
  explanation: string;
  warnings: string[];
}

interface EvaluatedLine {
  metrics: BomLineSourcingMetrics;
  decision: SourcingPolicyDecision;
  failureReason?: LineFailureReason;
}

interface DistributorPlan {
  distributor: string;
  lines: EvaluatedLine[];
  status: SourcingPolicyDecisionStatus;
}

const LEAD_TIME_KIND_ORDER: readonly LeadTimeKind[] = [
  "estimated_ship",
  "factory",
  "manufacturer",
  "unknown",
];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function identityKey(part: ManufacturerPartIdentity): string {
  return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
}

function samePart(left: ManufacturerPartIdentity, right: ManufacturerPartIdentity): boolean {
  return identityKey(left) === identityKey(right);
}

function normalizedAmount(value: number): number {
  return Number(value.toFixed(12));
}

function decision(
  code: SourcingPolicyDecisionCode,
  status: SourcingPolicyDecisionStatus,
  explanation: string,
  bomLineId?: string,
): SourcingPolicyDecision {
  return {
    ruleId: bomLineId === undefined ? `sourcing.policy.${code}` : `sourcing.policy.${bomLineId}.${code}`,
    code,
    status,
    explanation,
    ...(bomLineId === undefined ? {} : { bomLineId }),
  };
}

function validateLines(lines: readonly SourcingBomLine[]): SourcingBomLine[] {
  if (lines.length === 0) throw new Error("Sourcing BOM must contain at least one line");
  const ids = new Set<string>();
  return lines.map((line) => {
    if (!line.bomLineId.trim()) throw new Error("Sourcing BOM line ID must be a non-empty string");
    if (ids.has(line.bomLineId)) throw new Error(`Duplicate sourcing BOM line ID: ${line.bomLineId}`);
    ids.add(line.bomLineId);
    if (!isManufacturerId(line.part.manufacturerId) || !line.part.manufacturerPartNumber.trim()) {
      throw new Error(`Sourcing BOM line ${line.bomLineId} must use an exact manufacturer identity`);
    }
    if (!Number.isInteger(line.quantityPerAssembly) || line.quantityPerAssembly <= 0) {
      throw new Error(`Sourcing BOM line ${line.bomLineId} quantityPerAssembly must be a positive integer`);
    }
    return {
      bomLineId: line.bomLineId,
      part: { ...line.part },
      quantityPerAssembly: line.quantityPerAssembly,
    };
  }).sort((left, right) => compareText(left.bomLineId, right.bomLineId)
    || compareText(identityKey(left.part), identityKey(right.part)));
}

function activeSnapshots(
  snapshots: readonly OfferSnapshot[],
  policy: SourcingPolicy,
  evaluatedAt: string,
): ActiveSnapshot[] {
  const selected = new Map<string, OfferSnapshot>();
  for (const source of snapshots) {
    const snapshot = parseOfferSnapshot(source);
    if (!policy.distributors.includes(snapshot.provider)) continue;
    const prior = selected.get(snapshot.provider);
    if (prior === undefined
      || Date.parse(snapshot.retrievedAt) > Date.parse(prior.retrievedAt)
      || (Date.parse(snapshot.retrievedAt) === Date.parse(prior.retrievedAt)
        && compareText(snapshot.id, prior.id) < 0)) {
      selected.set(snapshot.provider, snapshot);
    }
  }
  return [...selected.values()]
    .sort((left, right) => compareText(left.provider, right.provider) || compareText(left.id, right.id))
    .map((snapshot) => ({
      snapshot,
      stale: snapshotFreshnessAt(snapshot, evaluatedAt, policy.maximumSnapshotAgeSeconds) === "stale",
    }));
}

function sourcingDataStatus(active: readonly ActiveSnapshot[], policy: SourcingPolicy): SourcingDataStatus {
  if (active.length === 0) return "unavailable";
  const missingProvider = policy.distributors.some(
    (provider) => !active.some((entry) => entry.snapshot.provider === provider),
  );
  const allProviderErrors = active.every((entry) => entry.snapshot.status === "provider_error")
    && active.every((entry) => entry.snapshot.offers.length === 0);
  if (allProviderErrors) return "provider_error";
  if (active.some((entry) => entry.stale)) return "stale";
  if (missingProvider || active.some((entry) => entry.snapshot.status !== "complete")) return "partial";
  return "complete";
}

function purchaseQuantity(line: SourcingBomLine, offer: DistributorOffer, buildQuantity: number): number {
  const required = line.quantityPerAssembly * buildQuantity;
  const minimum = Math.max(required, offer.minimumOrderQuantity ?? 1);
  const multiple = offer.orderMultiple ?? 1;
  return Math.ceil(minimum / multiple) * multiple;
}

function applicableUnitPrice(offer: DistributorOffer, quantity: number): number | undefined {
  let value: number | undefined;
  for (const priceBreak of offer.priceBreaks) {
    if (priceBreak.quantity <= quantity) value = priceBreak.unitPrice;
    else break;
  }
  return value;
}

function evaluatedOffer(
  line: SourcingBomLine,
  snapshot: OfferSnapshot,
  offer: DistributorOffer,
  policy: SourcingPolicy,
): EvaluatedOffer {
  const quantity = purchaseQuantity(line, offer, policy.buildQuantity);
  const buildable = offer.stockQuantity === undefined
    ? undefined
    : Math.floor(offer.stockQuantity / line.quantityPerAssembly);
  const price = applicableUnitPrice(offer, quantity);
  const base = {
    snapshot,
    offer,
    purchaseQuantity: quantity,
    ...(buildable === undefined ? {} : { buildableQuantity: buildable }),
    ...(price === undefined ? {} : { extendedCost: normalizedAmount(price * quantity) }),
  };
  const failures: Array<{ code: SourcingPolicyDecisionCode; reason: LineFailureReason; warning: string }> = [];
  const unknowns: Array<{ code: SourcingPolicyDecisionCode; warning: string }> = [];
  const warnings: string[] = [];

  if (offer.region !== policy.region) failures.push({ code: "region", reason: "policy", warning: `Offer region ${offer.region} does not match ${policy.region}` });
  if (offer.currency !== policy.currency) failures.push({ code: "currency", reason: "policy", warning: `Offer currency ${offer.currency} does not match ${policy.currency}` });
  if (policy.packaging !== undefined && !policy.packaging.includes(offer.packaging)) {
    failures.push({ code: "packaging", reason: "policy", warning: `Packaging ${offer.packaging} is not allowed` });
  }
  if (offer.marketplace && !policy.allowMarketplace) failures.push({ code: "marketplace", reason: "policy", warning: "Marketplace offers are not allowed" });

  if (offer.lifecycle === "obsolete") {
    failures.push({ code: "lifecycle", reason: "policy", warning: "Obsolete lifecycle is never allowed" });
  } else if (!policy.allowedLifecycle.includes(offer.lifecycle)) {
    failures.push({ code: "lifecycle", reason: "policy", warning: `Lifecycle ${offer.lifecycle} is not allowed` });
  } else if (offer.lifecycle === "unknown") {
    unknowns.push({ code: "lifecycle", warning: "Lifecycle is unknown and cannot become a policy pass" });
  }

  if (policy.minimumStock !== undefined) {
    if (offer.stockQuantity === undefined) unknowns.push({ code: "stock", warning: "Stock is unknown, so the minimum-stock policy cannot be proven" });
    else if (offer.stockQuantity < policy.minimumStock) failures.push({ code: "stock", reason: "stock", warning: `Stock ${offer.stockQuantity} is below the minimum ${policy.minimumStock}` });
  }
  if (offer.stockQuantity === undefined) {
    if (!(policy.allowBackorder && offer.backorderAvailable)) {
      unknowns.push({ code: "stock", warning: "Stock is unknown and no permitted backorder proves availability" });
    } else {
      warnings.push("Current stock is unknown; the selected offer relies on a permitted backorder");
    }
  } else if (offer.stockQuantity < quantity) {
    if (policy.allowBackorder && offer.backorderAvailable) {
      warnings.push(`Only ${offer.stockQuantity} units are currently in stock; the order relies on backorder availability`);
    } else {
      failures.push({ code: "stock", reason: "stock", warning: `Stock ${offer.stockQuantity} cannot fulfill purchase quantity ${quantity}` });
    }
  }

  if (policy.maximumLeadTimeDays !== undefined) {
    if (offer.leadTimeDays === undefined || offer.leadTimeKind === undefined) {
      unknowns.push({ code: "lead_time", warning: "Lead time is unknown, so the maximum-lead-time policy cannot be proven" });
    } else if (offer.leadTimeDays > policy.maximumLeadTimeDays) {
      failures.push({ code: "lead_time", reason: "lead_time", warning: `${offer.leadTimeKind} lead time ${offer.leadTimeDays} days exceeds ${policy.maximumLeadTimeDays} days` });
    }
  }
  if (offer.leadTimeDays === undefined) warnings.push("Lead time is unknown");
  else if (offer.leadTimeKind === "manufacturer") warnings.push("Manufacturer lead time is not a guaranteed ship or delivery date");
  else if (offer.leadTimeKind === "factory") warnings.push("Factory lead time is not a guaranteed ship or delivery date");
  else if (offer.leadTimeKind === "unknown") warnings.push("Lead-time meaning is unknown");
  if (price === undefined) warnings.push(`No price break applies at purchase quantity ${quantity}; extended cost is unknown`);

  if (failures.length > 0) {
    const failure = failures.sort((left, right) => compareText(left.code, right.code) || compareText(left.warning, right.warning))[0]!;
    return {
      ...base,
      state: "rejected",
      failureReason: failure.reason,
      code: failure.code,
      explanation: failure.warning,
      warnings: stableUnique([...failures.map((entry) => entry.warning), ...unknowns.map((entry) => entry.warning), ...warnings]),
    };
  }
  if (unknowns.length > 0) {
    const unknown = unknowns.sort((left, right) => compareText(left.code, right.code) || compareText(left.warning, right.warning))[0]!;
    return {
      ...base,
      state: "unknown",
      code: unknown.code,
      explanation: unknown.warning,
      warnings: stableUnique([...unknowns.map((entry) => entry.warning), ...warnings]),
    };
  }
  return {
    ...base,
    state: "accepted",
    code: "offer_available",
    explanation: "A policy-compliant offer was selected",
    warnings: stableUnique(warnings),
  };
}

function compareOffers(left: EvaluatedOffer, right: EvaluatedOffer): number {
  const stateRank: Record<OfferState, number> = { accepted: 0, unknown: 1, rejected: 2 };
  const state = stateRank[left.state] - stateRank[right.state];
  if (state !== 0) return state;
  const cost = (left.extendedCost ?? Number.POSITIVE_INFINITY) - (right.extendedCost ?? Number.POSITIVE_INFINITY);
  if (cost !== 0) return cost;
  const buildable = (right.buildableQuantity ?? -1) - (left.buildableQuantity ?? -1);
  if (buildable !== 0) return buildable;
  const lead = (left.offer.leadTimeDays ?? Number.POSITIVE_INFINITY) - (right.offer.leadTimeDays ?? Number.POSITIVE_INFINITY);
  if (lead !== 0) return lead;
  return compareText(left.offer.distributor, right.offer.distributor)
    || compareText(left.offer.distributorSku, right.offer.distributorSku)
    || compareText(left.snapshot.id, right.snapshot.id);
}

function lifecycleConflictWarning(offers: readonly EvaluatedOffer[]): string | undefined {
  const lifecycles = stableUnique(offers.map((entry) => entry.offer.lifecycle));
  return lifecycles.length > 1 ? `Lifecycle observations conflict: ${lifecycles.join(", ")}` : undefined;
}

function noOfferIsKnown(
  line: SourcingBomLine,
  active: readonly ActiveSnapshot[],
): boolean {
  return active.some((entry) => !entry.stale
    && entry.snapshot.status === "complete"
    && entry.snapshot.requestedParts.some((part) => samePart(part, line.part)));
}

function lineFromOffers(
  line: SourcingBomLine,
  offers: readonly EvaluatedOffer[],
  active: readonly ActiveSnapshot[],
): EvaluatedLine {
  const selected = [...offers].sort(compareOffers)[0];
  const conflict = lifecycleConflictWarning(offers);
  if (selected === undefined) {
    const known = noOfferIsKnown(line, active);
    const warnings = [known
      ? "Provider lookup completed without an offer for this exact manufacturer part"
      : "Provider lookup did not complete for this exact manufacturer part"];
    return {
      metrics: {
        bomLineId: line.bomLineId,
        part: line.part,
        quantityPerAssembly: line.quantityPerAssembly,
        status: "unavailable",
        lifecycle: "unknown",
        warnings,
      },
      decision: decision("offer_available", known ? "fail" : "unknown", warnings[0]!, line.bomLineId),
      failureReason: "unavailable",
    };
  }

  const warnings = stableUnique([...selected.warnings, ...(conflict === undefined ? [] : [conflict])]);
  const observed = {
    bomLineId: line.bomLineId,
    part: line.part,
    quantityPerAssembly: line.quantityPerAssembly,
    lifecycle: selected.offer.lifecycle,
    ...(selected.offer.stockQuantity === undefined ? {} : { stockQuantity: selected.offer.stockQuantity }),
    ...(selected.offer.leadTimeDays === undefined || selected.offer.leadTimeKind === undefined ? {} : {
      leadTimeDays: selected.offer.leadTimeDays,
      leadTimeKind: selected.offer.leadTimeKind,
    }),
    warnings,
  };
  if (selected.state === "rejected") {
    return {
      metrics: { ...observed, status: "policy_rejected" },
      decision: decision(selected.code, "fail", selected.explanation, line.bomLineId),
      failureReason: selected.failureReason ?? "policy",
    };
  }
  if (selected.state === "unknown") {
    return {
      metrics: { ...observed, status: "unknown" },
      decision: decision(selected.code, "unknown", selected.explanation, line.bomLineId),
      failureReason: "unavailable",
    };
  }

  const conflictStatus: SourcingPolicyDecisionStatus = conflict === undefined ? "pass" : "unknown";
  return {
    metrics: {
      ...observed,
      status: "sourced",
      selectedOffer: {
        snapshotId: selected.snapshot.id,
        distributor: selected.offer.distributor,
        distributorSku: selected.offer.distributorSku,
      },
      packaging: selected.offer.packaging,
      purchaseQuantity: selected.purchaseQuantity,
      ...(selected.buildableQuantity === undefined ? {} : { buildableQuantity: selected.buildableQuantity }),
      ...(selected.extendedCost === undefined ? {} : {
        extendedCost: { amount: selected.extendedCost, currency: selected.offer.currency },
      }),
    },
    decision: decision(
      conflict === undefined ? "offer_available" : "lifecycle",
      conflictStatus,
      conflict ?? "A policy-compliant offer was selected",
      line.bomLineId,
    ),
  };
}

function evaluatedOffersForLine(
  line: SourcingBomLine,
  active: readonly ActiveSnapshot[],
  policy: SourcingPolicy,
  distributor?: string,
): EvaluatedOffer[] {
  const values: EvaluatedOffer[] = [];
  for (const source of active) {
    if (distributor !== undefined && source.snapshot.provider !== distributor) continue;
    for (const offer of source.snapshot.offers) {
      if (samePart(offer.part, line.part)) values.push(evaluatedOffer(line, source.snapshot, offer, policy));
    }
  }
  return values;
}

function aggregateStatus(lines: readonly EvaluatedLine[]): SourcingPolicyDecisionStatus {
  if (lines.some((line) => line.decision.status === "fail")) return "fail";
  if (lines.some((line) => line.decision.status === "unknown")) return "unknown";
  return "pass";
}

function comparePlans(left: DistributorPlan, right: DistributorPlan): number {
  const statusRank: Record<SourcingPolicyDecisionStatus, number> = { pass: 0, unknown: 1, fail: 2 };
  const status = statusRank[left.status] - statusRank[right.status];
  if (status !== 0) return status;
  const sourced = right.lines.filter((line) => line.metrics.status === "sourced").length
    - left.lines.filter((line) => line.metrics.status === "sourced").length;
  if (sourced !== 0) return sourced;
  const leftCosts = left.lines.map((line) => line.metrics.extendedCost?.amount);
  const rightCosts = right.lines.map((line) => line.metrics.extendedCost?.amount);
  const leftCost = leftCosts.every((value) => value !== undefined)
    ? leftCosts.reduce<number>((total, value) => total + (value ?? 0), 0)
    : Number.POSITIVE_INFINITY;
  const rightCost = rightCosts.every((value) => value !== undefined)
    ? rightCosts.reduce<number>((total, value) => total + (value ?? 0), 0)
    : Number.POSITIVE_INFINITY;
  if (leftCost !== rightCost) return leftCost - rightCost;
  return compareText(left.distributor, right.distributor);
}

function selectLines(
  lines: readonly SourcingBomLine[],
  active: readonly ActiveSnapshot[],
  policy: SourcingPolicy,
): { lines: EvaluatedLine[]; singleDistributorDecision?: SourcingPolicyDecision } {
  if (policy.mode === "any_selected") {
    return {
      lines: lines.map((line) => lineFromOffers(line, evaluatedOffersForLine(line, active, policy), active)),
    };
  }
  const plans = policy.distributors.map((distributor): DistributorPlan => {
    const providerSnapshots = active.filter((entry) => entry.snapshot.provider === distributor);
    const evaluated = lines.map((line) => lineFromOffers(
      line,
      evaluatedOffersForLine(line, providerSnapshots, policy, distributor),
      providerSnapshots,
    ));
    return { distributor, lines: evaluated, status: aggregateStatus(evaluated) };
  }).sort(comparePlans);
  const selected = plans[0];
  if (selected === undefined) {
    return {
      lines: lines.map((line) => lineFromOffers(line, [], active)),
      singleDistributorDecision: decision("single_distributor", "unknown", "No distributor policy was available"),
    };
  }
  return {
    lines: selected.lines,
    singleDistributorDecision: decision(
      "single_distributor",
      selected.status,
      selected.status === "pass"
        ? `${selected.distributor} can supply the complete BOM under policy`
        : selected.status === "fail"
          ? `No selected distributor can supply the complete BOM under policy; ${selected.distributor} is the deterministic closest plan`
          : `Complete single-distributor coverage is unknown; ${selected.distributor} is the deterministic closest plan`,
    ),
  };
}

function lifecycleCounts(lines: readonly BomLineSourcingMetrics[]): LifecycleCounts {
  const counts = emptyLifecycleCounts();
  for (const line of lines) counts[line.lifecycle ?? "unknown"] += 1;
  return counts;
}

function maximumLeadTime(lines: readonly BomLineSourcingMetrics[]): { days: number; kind: LeadTimeKind } | undefined {
  const withLead = lines.filter((line): line is BomLineSourcingMetrics & { leadTimeDays: number; leadTimeKind: LeadTimeKind } => (
    line.status === "sourced" && line.leadTimeDays !== undefined && line.leadTimeKind !== undefined
  ));
  return withLead.sort((left, right) => right.leadTimeDays - left.leadTimeDays
    || LEAD_TIME_KIND_ORDER.indexOf(left.leadTimeKind) - LEAD_TIME_KIND_ORDER.indexOf(right.leadTimeKind)
    || compareText(left.bomLineId, right.bomLineId))[0] === undefined
    ? undefined
    : { days: withLead[0]!.leadTimeDays, kind: withLead[0]!.leadTimeKind };
}

function bottleneck(lines: readonly EvaluatedLine[]): BomBottleneck | undefined {
  const failed = lines.find((line) => line.metrics.status === "policy_rejected")
    ?? lines.find((line) => line.metrics.status === "unavailable" || line.metrics.status === "unknown");
  if (failed !== undefined) {
    return {
      bomLineId: failed.metrics.bomLineId,
      part: failed.metrics.part,
      reason: failed.failureReason ?? (failed.metrics.status === "policy_rejected" ? "policy" : "unavailable"),
    };
  }
  const stock = [...lines]
    .filter((line): line is EvaluatedLine & { metrics: BomLineSourcingMetrics & { buildableQuantity: number } } => (
      line.metrics.status === "sourced" && line.metrics.buildableQuantity !== undefined
    ))
    .sort((left, right) => left.metrics.buildableQuantity - right.metrics.buildableQuantity
      || compareText(left.metrics.bomLineId, right.metrics.bomLineId))[0];
  return stock === undefined ? undefined : {
    bomLineId: stock.metrics.bomLineId,
    part: stock.metrics.part,
    reason: "stock",
  };
}

function dataWarnings(status: SourcingDataStatus): string[] {
  if (status === "unavailable") return ["No sourcing data was requested or available"];
  if (status === "stale") return ["One or more offer snapshots are stale; refresh before relying on availability"];
  if (status === "partial") return ["Provider data is partial; missing observations remain unknown"];
  if (status === "provider_error") return ["Provider request failed; electrical generation remains available"];
  return [];
}

function dataDecision(status: SourcingDataStatus): SourcingPolicyDecision {
  return decision(
    "data_status",
    status === "complete" ? "pass" : "unknown",
    status === "complete" ? "All selected provider snapshots are complete and fresh" : dataWarnings(status)[0]!,
  );
}

function normalizedEvaluatedAt(value: string, policy: SourcingPolicy): string {
  const verified = parseCandidateSourcingMetrics({
    schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
    status: "unavailable",
    requestedBuildQuantity: policy.buildQuantity,
    evaluatedAt: value,
    snapshotIds: [],
    lines: [],
    lifecycleCounts: emptyLifecycleCounts(),
    warnings: [],
  }).evaluatedAt;
  return new Date(verified).toISOString();
}

export function evaluateBomSourcing(input: EvaluateBomSourcingInput): BomSourcingEvaluation {
  const policy = parseSourcingPolicy(input.policy);
  const lines = validateLines(input.lines);
  const evaluatedAt = normalizedEvaluatedAt(input.evaluatedAt, policy);
  const evaluatedAtMs = Date.parse(evaluatedAt);
  const active = activeSnapshots(input.snapshots, policy, evaluatedAt);
  const status = sourcingDataStatus(active, policy);
  const selected = selectLines(lines, active, policy);
  const lineMetrics = selected.lines.map((line) => line.metrics);
  const selectedOffers = lineMetrics.filter((line) => line.status === "sourced" && line.selectedOffer !== undefined);
  const distributors = new Set(selectedOffers.map((line) => line.selectedOffer!.distributor));
  const allSourced = lineMetrics.length > 0 && lineMetrics.every((line) => line.status === "sourced");
  const allBuildable = allSourced && lineMetrics.every((line) => line.buildableQuantity !== undefined);
  const knownBuildabilityFailure = selected.lines.some((line) => line.decision.status === "fail");
  const allCosted = allSourced && lineMetrics.every((line) => line.extendedCost !== undefined);
  const maximumLead = maximumLeadTime(lineMetrics);
  const snapshotIds = active.map((entry) => entry.snapshot.id).sort(compareText);
  const ages = active.map((entry) => Math.max(0, (evaluatedAtMs - Date.parse(entry.snapshot.retrievedAt)) / 1_000));
  const expires = active.map((entry) => entry.snapshot.expiresAt).sort((left, right) => Date.parse(left) - Date.parse(right) || compareText(left, right));
  const conflictWarnings = selected.lines.flatMap((line) => line.metrics.warnings.filter((warning) => warning.startsWith("Lifecycle observations conflict:")));
  const metrics = parseCandidateSourcingMetrics({
    schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
    status,
    requestedBuildQuantity: policy.buildQuantity,
    evaluatedAt,
    snapshotIds,
    ...(ages.length === 0 ? {} : { snapshotAgeSeconds: Math.max(...ages) }),
    ...(expires[0] === undefined ? {} : { earliestSnapshotExpiresAt: expires[0] }),
    lines: lineMetrics,
    ...(allBuildable
      ? { buildableQuantity: Math.min(...lineMetrics.map((line) => line.buildableQuantity!)) }
      : knownBuildabilityFailure ? { buildableQuantity: 0 } : {}),
    ...(allCosted ? {
      extendedBomCost: {
        amount: normalizedAmount(lineMetrics.reduce((total, line) => total + line.extendedCost!.amount, 0)),
        currency: policy.currency,
      },
    } : {}),
    ...(bottleneck(selected.lines) === undefined ? {} : { bottleneckPart: bottleneck(selected.lines) }),
    ...(maximumLead === undefined ? {} : { maximumLeadTimeDays: maximumLead.days, maximumLeadTimeKind: maximumLead.kind }),
    lifecycleCounts: lifecycleCounts(lineMetrics),
    ...(lineMetrics.length === 0 ? {} : {
      distributorSplitCount: distributors.size,
      singleDistributorComplete: allSourced && distributors.size === 1,
    }),
    warnings: stableUnique([...dataWarnings(status), ...conflictWarnings]),
  });
  const decisions = [
    dataDecision(status),
    ...selected.lines.map((line) => line.decision),
    ...(selected.singleDistributorDecision === undefined ? [] : [selected.singleDistributorDecision]),
  ].sort((left, right) => compareText(left.ruleId, right.ruleId));
  const policyStatus = decisions.some((entry) => entry.status === "fail")
    ? "fail"
    : decisions.some((entry) => entry.status === "unknown") ? "unknown" : "pass";
  return { metrics, policyStatus, decisions };
}

export function evaluateCandidateSourcing(
  candidate: Readonly<CandidateWithSourcingBom>,
  snapshots: readonly OfferSnapshot[],
  policy: Readonly<SourcingPolicy>,
  evaluatedAt: string,
): CandidateSourcingEvaluation {
  const evaluation = evaluateBomSourcing({
    lines: candidate.components.map((component) => ({
      bomLineId: component.id,
      part: component.part,
      quantityPerAssembly: component.quantityPerAssembly,
    })),
    snapshots,
    policy,
    evaluatedAt,
  });
  return {
    metrics: evaluation.metrics,
    eligible: evaluation.policyStatus !== "fail",
    constraints: evaluation.decisions.map((entry) => ({
      ruleId: entry.ruleId,
      status: entry.status,
      explanation: entry.explanation,
      evidence: [],
    })),
  };
}
