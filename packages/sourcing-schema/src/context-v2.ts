import { canonicalJsonForVersionedSourcing } from "./canonical";
import { offerSnapshotRef } from "./canonical-v2";
import {
  canonicalCommercialNumberV2,
  canonicalCommercialRationalV2,
  compareRfc3339InstantsV2,
  formatRfc3339InstantV2,
  parseRfc3339InstantV2,
} from "./commercial-primitives-v2";
import type { ManufacturerPartIdentity } from "./ids";
import type { SourcingPolicy } from "./policy";
import { validateSourcingPolicy, type ValidationIssue } from "./validation";
import { validateCandidateSourcingEvaluationV2, validateOfferSnapshotV2 } from "./validation-v2";
import {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2,
  MAXIMUM_LEAD_KIND_TIE_BREAK_V2,
  SOURCING_ADVISORY_WARNING_CATALOG_VERSION,
  aggregateSourcingPolicyStatus,
  renderSourcingAdvisoryWarning,
  renderSourcingPolicyConstraintV2,
  type BomLineSourcingMetricsV2,
  type CandidateSourcingEvaluationV2,
  type CandidateSourcingValidationComponentV2,
  type CandidateSourcingValidationContextV2,
  type DistributorOfferV2,
  type OfferSnapshotV2,
  type SourcingPolicyConstraintV2,
  type SourcingPolicyStatus,
} from "./v2";

interface Cell {
  distributor: string;
  component: CandidateSourcingValidationComponentV2;
  snapshot: OfferSnapshotV2 | undefined;
}

interface ProjectedLine {
  line: BomLineSourcingMetricsV2;
  constraints: SourcingPolicyConstraintV2[];
  policyStatus: SourcingPolicyStatus;
}

interface DistributorPlan {
  distributor: string;
  lines: ProjectedLine[];
  status: SourcingPolicyStatus;
  sourcedLineCount: number;
  proofComplete: boolean;
  cost?: number;
}

function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function partEquals(left: ManufacturerPartIdentity, right: ManufacturerPartIdentity): boolean { return left.manufacturerId === right.manufacturerId && left.manufacturerPartNumber === right.manufacturerPartNumber; }
function partKey(part: ManufacturerPartIdentity): string { return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`; }
function refKey(snapshot: OfferSnapshotV2): string { return `${snapshot.schemaVersion}\u0000${snapshot.id}\u0000${snapshot.contentHash}`; }
function constraintKey(constraint: SourcingPolicyConstraintV2): string { return `${constraint.bomLineId ?? ""}\u0000${constraint.ruleId}\u0000${constraint.explanation}`; }
function statusRank(status: SourcingPolicyStatus): number { return status === "pass" ? 0 : status === "unknown" ? 1 : 2; }
function sortedUnique(values: readonly string[]): boolean { return values.every((value, index) => index === 0 || compareText(values[index - 1]!, value) < 0); }
function canonicalEqual(left: unknown, right: unknown): boolean {
  try { return canonicalJsonForVersionedSourcing(left) === canonicalJsonForVersionedSourcing(right); } catch { return false; }
}

function statusForObservedEquality(observation: DistributorOfferV2["region"], required: string): SourcingPolicyStatus {
  return observation.state === "unknown" ? "unknown" : observation.value === required ? "pass" : "fail";
}

function requiredPurchaseQuantity(component: CandidateSourcingValidationComponentV2, policy: SourcingPolicy, offer: DistributorOfferV2): number {
  const required = BigInt(component.quantityPerAssembly) * BigInt(policy.buildQuantity);
  const minimum = BigInt(offer.minimumOrderQuantity ?? 1);
  const multiple = BigInt(offer.orderMultiple ?? 1);
  const target = required > minimum ? required : minimum;
  const purchase = ((target + multiple - 1n) / multiple) * multiple;
  if (purchase <= 0n || purchase > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Purchase quantity exceeds safe-integer range");
  return Number(purchase);
}

function stockStatus(offer: DistributorOfferV2, purchaseQuantity: number, policy: SourcingPolicy): SourcingPolicyStatus {
  const statuses: SourcingPolicyStatus[] = [];
  if (policy.minimumStock !== undefined) statuses.push(offer.stockQuantity === undefined ? "unknown" : offer.stockQuantity >= policy.minimumStock ? "pass" : "fail");
  if (offer.stockQuantity === undefined) statuses.push(policy.minimumStock === undefined && policy.allowBackorder && offer.backorderAvailable.state === "known" && offer.backorderAvailable.value ? "pass" : "unknown");
  else if (offer.stockQuantity >= purchaseQuantity) statuses.push("pass");
  else if (!policy.allowBackorder) statuses.push("fail");
  else statuses.push(offer.backorderAvailable.state === "unknown" ? "unknown" : offer.backorderAvailable.value ? "pass" : "fail");
  return reduceStatuses(statuses);
}

function reduceStatuses(statuses: readonly SourcingPolicyStatus[]): SourcingPolicyStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("unknown")) return "unknown";
  return "pass";
}

function lineWarnings(line: BomLineSourcingMetricsV2, constraints: readonly SourcingPolicyConstraintV2[], policy: SourcingPolicy): string[] {
  const warnings = constraints.filter((constraint) => constraint.status !== "pass").map((constraint) => constraint.explanation);
  if (line.leadTimeKind?.state === "known" && line.leadTimeKind.value === "manufacturer") warnings.push(renderSourcingAdvisoryWarning({ code: "manufacturer_lead_not_delivery" }));
  if (line.leadTimeKind?.state === "known" && line.leadTimeKind.value === "factory") warnings.push(renderSourcingAdvisoryWarning({ code: "factory_lead_not_delivery" }));
  if (line.purchaseQuantity !== undefined && line.extendedCost === undefined) warnings.push(renderSourcingAdvisoryWarning({ code: "price_break_unavailable", purchaseQuantity: line.purchaseQuantity }));
  if (policy.allowBackorder && line.backorderAvailable?.state === "known" && line.backorderAvailable.value && line.purchaseQuantity !== undefined) {
    if (line.stockQuantity === undefined) warnings.push(renderSourcingAdvisoryWarning({ code: "stock_unknown_backorder" }));
    else if (line.stockQuantity < line.purchaseQuantity) warnings.push(renderSourcingAdvisoryWarning({ code: "stock_short_backorder", stockQuantity: line.stockQuantity, purchaseQuantity: line.purchaseQuantity }));
  }
  return [...new Set(warnings)].sort(compareText);
}

function projectOffer(component: CandidateSourcingValidationComponentV2, offer: DistributorOfferV2, snapshot: OfferSnapshotV2, policy: SourcingPolicy): ProjectedLine {
  const purchaseQuantity = requiredPurchaseQuantity(component, policy, offer);
  const constraints: SourcingPolicyConstraintV2[] = [];
  constraints.push(renderSourcingPolicyConstraintV2("offer_available", "pass", { code: "offer_available", proof: "offer_present" }, component.id));
  constraints.push(renderSourcingPolicyConstraintV2("region", statusForObservedEquality(offer.region, policy.region), { code: "region", observed: offer.region, required: policy.region }, component.id));
  constraints.push(renderSourcingPolicyConstraintV2("currency", statusForObservedEquality(offer.currency, policy.currency), { code: "currency", observed: offer.currency, required: policy.currency }, component.id));
  if (policy.packaging !== undefined) {
    const allowed = [...policy.packaging].sort(compareText);
    const status = offer.packaging.state === "unknown" ? "unknown" : allowed.includes(offer.packaging.value) ? "pass" : "fail";
    constraints.push(renderSourcingPolicyConstraintV2("packaging", status, { code: "packaging", observed: offer.packaging, allowed }, component.id));
  }
  if (!policy.allowMarketplace) {
    const status = offer.marketplace.state === "unknown" ? "unknown" : offer.marketplace.value ? "fail" : "pass";
    constraints.push(renderSourcingPolicyConstraintV2("marketplace", status, { code: "marketplace", observed: offer.marketplace, allowed: false }, component.id));
  }
  const allowedLifecycle = policy.allowedLifecycle.filter((value): value is Exclude<typeof value, "unknown"> => value !== "unknown").sort(compareText);
  const lifecycleStatus = offer.lifecycle.state === "unknown" ? "unknown" : offer.lifecycle.value === "obsolete" || !allowedLifecycle.includes(offer.lifecycle.value) ? "fail" : "pass";
  constraints.push(renderSourcingPolicyConstraintV2("lifecycle", lifecycleStatus, { code: "lifecycle", observed: offer.lifecycle, allowed: allowedLifecycle }, component.id));
  if (policy.maximumLeadTimeDays !== undefined) {
    const status = offer.leadTimeDays.state === "unknown" || offer.leadTimeKind.state === "unknown" ? "unknown" : offer.leadTimeDays.value <= policy.maximumLeadTimeDays ? "pass" : "fail";
    constraints.push(renderSourcingPolicyConstraintV2("lead_time", status, { code: "lead_time", days: offer.leadTimeDays, kind: offer.leadTimeKind, maximumDays: policy.maximumLeadTimeDays }, component.id));
  }
  constraints.push(renderSourcingPolicyConstraintV2("stock", stockStatus(offer, purchaseQuantity, policy), {
    code: "stock",
    stockQuantity: offer.stockQuantity ?? null,
    purchaseQuantity,
    minimumStock: policy.minimumStock ?? null,
    backorderAvailable: offer.backorderAvailable,
    allowBackorder: policy.allowBackorder,
  }, component.id));
  constraints.sort((left, right) => compareText(constraintKey(left), constraintKey(right)));
  const policyStatus = aggregateSourcingPolicyStatus(constraints);
  const priceBreak = offer.priceBreaks.filter((price) => price.quantity <= purchaseQuantity).at(-1);
  const cost = offer.currency.state === "known" && offer.currency.value === policy.currency && priceBreak !== undefined
    ? canonicalCommercialNumberV2(priceBreak.unitPrice * purchaseQuantity)
    : undefined;
  if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) throw new RangeError("Derived line cost is invalid");
  const buildableQuantity = offer.stockQuantity === undefined ? undefined : Number(BigInt(offer.stockQuantity) / BigInt(component.quantityPerAssembly));
  const line: BomLineSourcingMetricsV2 = {
    bomLineId: component.id,
    part: { ...component.part },
    quantityPerAssembly: component.quantityPerAssembly,
    status: policyStatus === "pass" ? "sourced" : policyStatus === "unknown" ? "unknown" : "policy_rejected",
    evaluatedOffer: { snapshot: offerSnapshotRef(snapshot), distributor: offer.distributor, distributorSku: offer.distributorSku },
    region: structuredClone(offer.region),
    currency: structuredClone(offer.currency),
    packaging: structuredClone(offer.packaging),
    marketplace: structuredClone(offer.marketplace),
    backorderAvailable: structuredClone(offer.backorderAvailable),
    lifecycle: structuredClone(offer.lifecycle),
    lifecycleSource: structuredClone(offer.lifecycleSource),
    leadTimeDays: structuredClone(offer.leadTimeDays),
    leadTimeKind: structuredClone(offer.leadTimeKind),
    ...(offer.stockQuantity === undefined ? {} : { stockQuantity: offer.stockQuantity }),
    purchaseQuantity,
    ...(buildableQuantity === undefined ? {} : { buildableQuantity }),
    ...(cost === undefined ? {} : { extendedCost: { amount: cost, currency: policy.currency } }),
    warnings: [],
  };
  line.warnings = lineWarnings(line, constraints, policy);
  return { line, constraints, policyStatus };
}

function projectNoOffer(component: CandidateSourcingValidationComponentV2, proof: "fresh_complete_no_offer" | "not_proven"): ProjectedLine {
  const constraint = renderSourcingPolicyConstraintV2("offer_available", proof === "fresh_complete_no_offer" ? "fail" : "unknown", { code: "offer_available", proof }, component.id);
  return {
    line: { bomLineId: component.id, part: { ...component.part }, quantityPerAssembly: component.quantityPerAssembly, status: "unavailable", warnings: [constraint.explanation] },
    constraints: [constraint],
    policyStatus: constraint.status,
  };
}

function reprojectUntrustedFailures(projected: ProjectedLine, policy: SourcingPolicy): ProjectedLine {
  if (!projected.constraints.some((constraint) => constraint.status === "fail")) return projected;
  const constraints = projected.constraints.map((constraint) => constraint.status === "fail"
    ? (renderSourcingPolicyConstraintV2 as (...args: unknown[]) => SourcingPolicyConstraintV2)(
        constraint.code,
        "unknown",
        constraint.inputs,
        constraint.bomLineId,
      )
    : constraint);
  const policyStatus = aggregateSourcingPolicyStatus(constraints);
  const line: BomLineSourcingMetricsV2 = {
    ...projected.line,
    status: projected.line.evaluatedOffer === undefined
      ? "unavailable"
      : policyStatus === "pass" ? "sourced" : policyStatus === "unknown" ? "unknown" : "policy_rejected",
    warnings: [],
  };
  line.warnings = lineWarnings(line, constraints, policy);
  return { line, constraints, policyStatus };
}

function activeSnapshot(snapshots: readonly OfferSnapshotV2[], distributor: string, part: ManufacturerPartIdentity): OfferSnapshotV2 | undefined {
  return snapshots.filter((snapshot) => snapshot.provider === distributor && snapshot.requestedParts.some((requested) => partEquals(requested, part))).sort((left, right) => (
    -compareRfc3339InstantsV2(left.retrievedAt, right.retrievedAt)
    || compareText(left.retrievedAt, right.retrievedAt)
    || compareText(refKey(left), refKey(right))
  ))[0];
}

function snapshotFresh(snapshot: OfferSnapshotV2, evaluatedAt: string, maximumAgeSeconds: number): boolean {
  const evaluatedNs = parseRfc3339InstantV2(evaluatedAt).epochNanoseconds;
  const expiresNs = parseRfc3339InstantV2(snapshot.expiresAt).epochNanoseconds;
  const policyExpiresNs = parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds + BigInt(maximumAgeSeconds) * 1_000_000_000n;
  formatRfc3339InstantV2(policyExpiresNs);
  return evaluatedNs <= (expiresNs < policyExpiresNs ? expiresNs : policyExpiresNs);
}

function offerComparator(left: ProjectedLine, right: ProjectedLine): number {
  const leftCost = left.line.extendedCost?.amount;
  const rightCost = right.line.extendedCost?.amount;
  const leftBuildable = left.line.buildableQuantity;
  const rightBuildable = right.line.buildableQuantity;
  const leftLeadDays = left.line.leadTimeDays?.state === "known" ? left.line.leadTimeDays.value : undefined;
  const rightLeadDays = right.line.leadTimeDays?.state === "known" ? right.line.leadTimeDays.value : undefined;
  const leftLeadKind = left.line.leadTimeKind?.state === "known" ? left.line.leadTimeKind.value : undefined;
  const rightLeadKind = right.line.leadTimeKind?.state === "known" ? right.line.leadTimeKind.value : undefined;
  return statusRank(left.policyStatus) - statusRank(right.policyStatus)
    || Number(leftCost === undefined) - Number(rightCost === undefined)
    || (leftCost ?? 0) - (rightCost ?? 0)
    || Number(leftBuildable === undefined) - Number(rightBuildable === undefined)
    || (rightBuildable ?? 0) - (leftBuildable ?? 0)
    || Number(leftLeadDays === undefined || leftLeadKind === undefined) - Number(rightLeadDays === undefined || rightLeadKind === undefined)
    || (leftLeadDays ?? 0) - (rightLeadDays ?? 0)
    || MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(leftLeadKind ?? "manufacturer") - MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(rightLeadKind ?? "manufacturer")
    || compareText(left.line.evaluatedOffer!.distributor, right.line.evaluatedOffer!.distributor)
    || compareText(left.line.evaluatedOffer!.distributorSku, right.line.evaluatedOffer!.distributorSku)
    || compareText(`${left.line.evaluatedOffer!.snapshot.schemaVersion}\u0000${left.line.evaluatedOffer!.snapshot.id}\u0000${left.line.evaluatedOffer!.snapshot.contentHash}`, `${right.line.evaluatedOffer!.snapshot.schemaVersion}\u0000${right.line.evaluatedOffer!.snapshot.id}\u0000${right.line.evaluatedOffer!.snapshot.contentHash}`);
}

function offersForCell(cell: Cell, policy: SourcingPolicy): ProjectedLine[] {
  if (cell.snapshot === undefined) return [];
  return cell.snapshot.offers.filter((offer) => partEquals(offer.part, cell.component.part)).map((offer) => projectOffer(cell.component, offer, cell.snapshot!, policy)).sort(offerComparator);
}

function planForDistributor(distributor: string, components: readonly CandidateSourcingValidationComponentV2[], snapshots: readonly OfferSnapshotV2[], policy: SourcingPolicy, evaluatedAt: string): DistributorPlan {
  const planCells = components.map((component) => ({ component, snapshot: activeSnapshot(snapshots, distributor, component.part) }));
  const lines = planCells.map(({ component, snapshot }) => {
    const offers = offersForCell({ distributor, component, snapshot }, policy);
    if (offers.length > 0) {
      const selected = offers[0]!;
      const freshComplete = snapshot !== undefined
        && snapshot.status === "complete"
        && snapshotFresh(snapshot, evaluatedAt, policy.maximumSnapshotAgeSeconds);
      return freshComplete ? selected : reprojectUntrustedFailures(selected, policy);
    }
    const proof = snapshot !== undefined && snapshot.status === "complete" && snapshotFresh(snapshot, evaluatedAt, policy.maximumSnapshotAgeSeconds) ? "fresh_complete_no_offer" : "not_proven";
    return projectNoOffer(component, proof);
  });
  const status = reduceStatuses(lines.map((line) => line.policyStatus));
  const sourcedLineCount = lines.filter((line) => line.policyStatus === "pass").length;
  const proofComplete = planCells.every(({ snapshot }) => snapshot !== undefined && snapshot.status === "complete" && snapshotFresh(snapshot, evaluatedAt, policy.maximumSnapshotAgeSeconds));
  let cost: number | undefined = 0;
  for (const projected of [...lines].sort((left, right) => compareText(left.line.bomLineId, right.line.bomLineId))) {
    if (projected.line.extendedCost === undefined) { cost = undefined; break; }
    cost = canonicalCommercialNumberV2(cost! + projected.line.extendedCost.amount);
  }
  return { distributor, lines, status, sourcedLineCount, proofComplete, ...(cost === undefined ? {} : { cost }) };
}

function planComparator(left: DistributorPlan, right: DistributorPlan): number {
  return statusRank(left.status) - statusRank(right.status)
    || right.sourcedLineCount - left.sourcedLineCount
    || Number(left.cost === undefined) - Number(right.cost === undefined)
    || (left.cost ?? 0) - (right.cost ?? 0)
    || compareText(left.distributor, right.distributor);
}

function transport(cells: readonly Cell[], evaluatedAt: string, policy: SourcingPolicy): { status: CandidateSourcingEvaluationV2["metrics"]["status"]; snapshotAgeSeconds?: number; earliestSnapshotExpiresAt?: string } {
  const active = [...new Map(cells.filter((cell) => cell.snapshot !== undefined).map((cell) => [refKey(cell.snapshot!), cell.snapshot!])).values()];
  if (active.length === 0) return { status: "unavailable" };
  const evaluatedNs = parseRfc3339InstantV2(evaluatedAt).epochNanoseconds;
  const ages = active.map((snapshot) => canonicalCommercialRationalV2(evaluatedNs - parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds, 1_000_000_000n));
  const earliest = [...active].sort((left, right) => compareRfc3339InstantsV2(left.expiresAt, right.expiresAt) || compareText(left.expiresAt, right.expiresAt) || compareText(refKey(left), refKey(right)))[0]!.expiresAt;
  const common = { snapshotAgeSeconds: Math.max(...ages), earliestSnapshotExpiresAt: earliest };
  if (cells.every((cell) => cell.snapshot !== undefined) && active.every((snapshot) => snapshot.status === "provider_error" && snapshot.offers.length === 0)) return { status: "provider_error", ...common };
  if (active.some((snapshot) => !snapshotFresh(snapshot, evaluatedAt, policy.maximumSnapshotAgeSeconds))) return { status: "stale", ...common };
  if (cells.some((cell) => cell.snapshot === undefined) || active.some((snapshot) => snapshot.status !== "complete")) return { status: "partial", ...common };
  return { status: "complete", ...common };
}

function expectedEvaluation(context: CandidateSourcingValidationContextV2): CandidateSourcingEvaluationV2 {
  const policy = context.policy as SourcingPolicy;
  const components = [...context.components].sort((left, right) => compareText(left.id, right.id));
  const cells = new Map<string, Cell>();
  for (const distributor of policy.distributors) for (const component of components) cells.set(`${distributor}\u0000${partKey(component.part)}\u0000${component.id}`, { distributor, component, snapshot: activeSnapshot(context.snapshots, distributor, component.part) });
  let selectedLines: ProjectedLine[];
  let activeCells: Cell[];
  let singleConstraint: SourcingPolicyConstraintV2 | undefined;
  if (policy.mode === "single_distributor") {
    const plans = policy.distributors.map((distributor) => planForDistributor(distributor, components, context.snapshots, policy, context.evaluatedAt)).sort(planComparator);
    const winner = plans[0]!;
    selectedLines = winner.lines;
    activeCells = components.map((component) => cells.get(`${winner.distributor}\u0000${partKey(component.part)}\u0000${component.id}`)!);
    const observedDistributors = [...new Set(winner.lines.map((line) => line.line.evaluatedOffer?.distributor).filter((value): value is string => value !== undefined))].sort(compareText);
    const allPlansProvenFail = plans.every((plan) => plan.proofComplete && plan.lines.some((line) => line.policyStatus === "fail") && plan.lines.every((line) => line.policyStatus !== "unknown"));
    const status: SourcingPolicyStatus = winner.status === "pass" ? "pass" : allPlansProvenFail ? "fail" : "unknown";
    singleConstraint = renderSourcingPolicyConstraintV2("single_distributor", status, { code: "single_distributor", selectedDistributor: winner.distributor, observedDistributors });
  } else {
    selectedLines = components.map((component) => {
      const componentCells = policy.distributors.map((distributor) => cells.get(`${distributor}\u0000${partKey(component.part)}\u0000${component.id}`)!);
      const offers = componentCells.flatMap((cell) => offersForCell(cell, policy)).sort(offerComparator);
      if (offers.length > 0) return offers[0]!;
      const negative = componentCells.every((cell) => cell.snapshot !== undefined && cell.snapshot.status === "complete" && snapshotFresh(cell.snapshot, context.evaluatedAt, policy.maximumSnapshotAgeSeconds));
      return projectNoOffer(component, negative ? "fresh_complete_no_offer" : "not_proven");
    });
    activeCells = [...cells.values()];
  }
  selectedLines.sort((left, right) => compareText(left.line.bomLineId, right.line.bomLineId));
  const transportState = transport(activeCells, context.evaluatedAt, policy);
  const dataConstraint = renderSourcingPolicyConstraintV2("data_status", transportState.status === "complete" ? "pass" : "unknown", { code: "data_status", dataStatus: transportState.status });
  const constraints = [dataConstraint, ...selectedLines.flatMap((line) => line.constraints), ...(singleConstraint === undefined ? [] : [singleConstraint])].sort((left, right) => compareText(constraintKey(left), constraintKey(right)));
  const policyStatus = aggregateSourcingPolicyStatus(constraints);
  const lines = selectedLines.map((projected) => projected.line);
  const allSourced = lines.length > 0 && lines.every((line) => line.status === "sourced");
  const allBuildable = allSourced && lines.every((line) => line.buildableQuantity !== undefined);
  const allCosted = allSourced && lines.every((line) => line.extendedCost !== undefined);
  const allLead = allSourced && lines.every((line) => line.leadTimeDays?.state === "known" && line.leadTimeKind?.state === "known");
  let extendedBomCost: number | undefined;
  if (allCosted) {
    extendedBomCost = 0;
    for (const line of lines) extendedBomCost = canonicalCommercialNumberV2(extendedBomCost + line.extendedCost!.amount);
  }
  const lifecycleCounts = { active: 0, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 };
  for (const line of lines) {
    if (line.lifecycle?.state === "known") lifecycleCounts[line.lifecycle.value] += 1;
    else lifecycleCounts.unknown += 1;
  }
  const distributors = new Set(lines.map((line) => line.evaluatedOffer?.distributor).filter((value): value is string => value !== undefined));
  const knownLead = (line: BomLineSourcingMetricsV2) => {
    if (line.leadTimeDays?.state !== "known" || line.leadTimeKind?.state !== "known") throw new Error("Known lead projection was unavailable");
    return { days: line.leadTimeDays.value, kind: line.leadTimeKind.value };
  };
  const maxLeadLine = allLead ? [...lines].sort((left, right) => knownLead(right).days - knownLead(left).days || MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(knownLead(left).kind) - MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(knownLead(right).kind) || compareText(left.bomLineId, right.bomLineId))[0] : undefined;
  const bottleneck = lines.length > 0 && lines.every((line) => line.buildableQuantity !== undefined && line.status !== "unknown") ? [...lines].sort((left, right) => left.buildableQuantity! - right.buildableQuantity! || compareText(left.bomLineId, right.bomLineId))[0] : undefined;
  const candidateWarnings = [...new Set([
    ...lines.flatMap((line) => line.warnings),
    ...constraints.filter((constraint) => constraint.bomLineId === undefined && constraint.status !== "pass").map((constraint) => constraint.explanation),
  ])].sort(compareText);
  return {
    metrics: {
      schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2,
      warningCatalogVersion: SOURCING_ADVISORY_WARNING_CATALOG_VERSION,
      status: transportState.status,
      policyStatus,
      unknownObservationCount: lines.reduce((sum, line) => sum + [line.region, line.currency, line.packaging, line.marketplace, line.backorderAvailable, line.lifecycle, line.lifecycleSource, line.leadTimeDays, line.leadTimeKind].filter((observation) => observation?.state === "unknown").length, 0),
      requestedBuildQuantity: policy.buildQuantity,
      evaluatedAt: context.evaluatedAt,
      snapshotRefs: context.snapshots.map(offerSnapshotRef).sort((left, right) => compareText(`${left.schemaVersion}\u0000${left.id}\u0000${left.contentHash}`, `${right.schemaVersion}\u0000${right.id}\u0000${right.contentHash}`)),
      ...(transportState.snapshotAgeSeconds === undefined ? {} : { snapshotAgeSeconds: transportState.snapshotAgeSeconds }),
      ...(transportState.earliestSnapshotExpiresAt === undefined ? {} : { earliestSnapshotExpiresAt: transportState.earliestSnapshotExpiresAt }),
      lines,
      ...(allBuildable ? { buildableQuantity: Math.min(...lines.map((line) => line.buildableQuantity!)) } : {}),
      ...(extendedBomCost === undefined ? {} : { extendedBomCost: { amount: extendedBomCost, currency: policy.currency } }),
      ...(bottleneck === undefined ? {} : { bottleneckPart: { bomLineId: bottleneck.bomLineId, part: { ...bottleneck.part }, reason: bottleneck.status === "sourced" ? "stock" as const : "policy" as const } }),
      ...(maxLeadLine === undefined ? {} : { maximumLeadTimeDays: knownLead(maxLeadLine).days, maximumLeadTimeKind: knownLead(maxLeadLine).kind }),
      lifecycleCounts,
      ...(allSourced ? { distributorSplitCount: distributors.size, singleDistributorComplete: distributors.size === 1 } : {}),
      warnings: candidateWarnings,
    },
    policyStatus,
    constraints,
  };
}

export function validateCandidateSourcingEvaluationContextV2(
  evaluation: Readonly<CandidateSourcingEvaluationV2>,
  context: Readonly<CandidateSourcingValidationContextV2>,
): ValidationIssue[] {
  const issues = validateCandidateSourcingEvaluationV2(evaluation);
  issues.push(...validateSourcingPolicy(context.policy).map((issue) => ({ ...issue, path: `context.policy${issue.path ? `.${issue.path}` : ""}` })));
  if (typeof context.candidateId !== "string" || context.candidateId.trim() === "") issues.push({ path: "context.candidateId", message: "Must be a non-empty candidate ID" });
  if (!Number.isSafeInteger(context.policy.buildQuantity) || context.policy.buildQuantity <= 0
    || !Number.isSafeInteger(context.policy.maximumSnapshotAgeSeconds) || context.policy.maximumSnapshotAgeSeconds <= 0
    || (context.policy.minimumStock !== undefined && (!Number.isSafeInteger(context.policy.minimumStock) || context.policy.minimumStock < 0))) {
    issues.push({ path: "context.policy", message: "Build quantity and snapshot age must be positive safe integers; minimum stock must be a non-negative safe integer" });
  }
  const componentKeys = context.components.map((component) => component.id);
  if (new Set(componentKeys).size !== componentKeys.length || context.components.some((component) => !Number.isSafeInteger(component.quantityPerAssembly) || component.quantityPerAssembly <= 0)) issues.push({ path: "context.components", message: "Components require unique IDs and positive safe-integer quantities" });
  const snapshotKeys = context.snapshots.map(refKey);
  if (!sortedUnique(snapshotKeys)) issues.push({ path: "context.snapshots", message: "Must be full-ref sorted and unique" });
  context.snapshots.forEach((snapshot, index) => {
    issues.push(...validateOfferSnapshotV2(snapshot).map((issue) => ({ ...issue, path: `context.snapshots.${index}${issue.path ? `.${issue.path}` : ""}` })));
    if (snapshot.evaluationEligibility !== "native_v2") issues.push({ path: `context.snapshots.${index}.evaluationEligibility`, message: "Native evaluation requires native_v2" });
    try { if (compareRfc3339InstantsV2(snapshot.retrievedAt, context.evaluatedAt) > 0) issues.push({ path: `context.snapshots.${index}.retrievedAt`, message: "Cannot be later than evaluatedAt" }); } catch { issues.push({ path: `context.snapshots.${index}.retrievedAt`, message: "Invalid exact timestamp" }); }
  });
  try {
    issues.push(...context.authorizationVerifier.validateOperation(context.authorizationOperation, context.expectedAuthorizationUse, context.snapshots, context.authorizations).map((issue) => ({ ...issue, path: `context.${issue.path || "authorizationOperation"}` })));
  } catch { issues.push({ path: "context.authorizationOperation", message: "Authorization operation was rejected" }); }
  if (context.authorizationOperation?.checkedAt !== context.evaluatedAt) issues.push({ path: "context.evaluatedAt", message: "Must equal the verifier-authorized operation checkedAt" });
  if (issues.length > 0) return issues;
  try {
    const expected = expectedEvaluation(context as CandidateSourcingValidationContextV2);
    if (!canonicalEqual(evaluation.metrics, expected.metrics)) issues.push({ path: "metrics", message: "Does not equal the schema-owned active-snapshot/offer/plan projection" });
    if (!canonicalEqual(evaluation.constraints, expected.constraints)) issues.push({ path: "constraints", message: "Does not equal the complete schema-owned policy constraint set" });
    if (evaluation.policyStatus !== expected.policyStatus) issues.push({ path: "policyStatus", message: "Does not equal the schema-owned policy reduction" });
  } catch (error) {
    issues.push({ path: "context", message: error instanceof Error ? error.message : "Context could not be evaluated exactly" });
  }
  return issues;
}
