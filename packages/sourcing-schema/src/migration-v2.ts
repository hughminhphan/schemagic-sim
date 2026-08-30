import { finalizeOfferSnapshotV2, offerSnapshotRef } from "./canonical-v2";
import type { CandidateSourcingMetrics as CandidateSourcingMetricsV1 } from "./metrics";
import type { DistributorOffer as DistributorOfferV1 } from "./offer";
import type { OfferSnapshot as OfferSnapshotV1 } from "./snapshot";
import {
  parseCandidateSourcingMetrics,
  parseOfferSnapshot,
} from "./validation";
import {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2,
  OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
  SOURCING_ADVISORY_WARNING_CATALOG_VERSION,
  emptyLifecycleCountsV2,
  renderSourcingAdvisoryWarning,
  renderSourcingPolicyConstraintV2,
  type BomLineSourcingMetricsV2,
  type CandidateSourcingEvaluationV2,
  type DistributorOfferV2,
  type OfferSnapshotV2,
  type OfferSnapshotV2Content,
  type OfferSnapshotMigrationV2,
  type SourcingPolicyConstraintV2,
} from "./v2";
import {
  parseOfferSnapshotV2,
} from "./validation-v2";

export const V1_REEVALUATION_WARNING = renderSourcingAdvisoryWarning({
  code: "migration_v1_reevaluation",
});

export const V1_SOURCE_UNAVAILABLE_WARNING = renderSourcingAdvisoryWarning({
  code: "migration_v1_source_unavailable",
});

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function samePartIdentity(
  left: { manufacturerId: string; manufacturerPartNumber: string },
  right: { manufacturerId: string; manufacturerPartNumber: string },
): boolean {
  return left.manufacturerId === right.manufacturerId
    && left.manufacturerPartNumber === right.manufacturerPartNumber;
}

function migrateOfferV1ToV2(offer: DistributorOfferV1): DistributorOfferV2 {
  return {
    distributor: offer.distributor,
    distributorSku: offer.distributorSku,
    part: cloneJson(offer.part),
    region: { state: "known", value: offer.region },
    currency: { state: "known", value: offer.currency },
    packaging: { state: "known", value: offer.packaging },
    marketplace: { state: "known", value: offer.marketplace },
    backorderAvailable: { state: "known", value: offer.backorderAvailable },
    ...(offer.stockQuantity === undefined ? {} : { stockQuantity: offer.stockQuantity }),
    ...(offer.minimumOrderQuantity === undefined ? {} : { minimumOrderQuantity: offer.minimumOrderQuantity }),
    ...(offer.orderMultiple === undefined ? {} : { orderMultiple: offer.orderMultiple }),
    leadTimeDays: offer.leadTimeDays === undefined
      ? { state: "unknown", reason: "legacy_unknown" }
      : { state: "known", value: offer.leadTimeDays },
    leadTimeKind: offer.leadTimeKind === undefined || offer.leadTimeKind === "unknown"
      ? { state: "unknown", reason: "legacy_unknown" }
      : { state: "known", value: offer.leadTimeKind },
    lifecycle: offer.lifecycle === "unknown"
      ? { state: "unknown", reason: "legacy_unknown" }
      : { state: "known", value: offer.lifecycle },
    lifecycleSource: offer.lifecycleSource === "unknown"
      ? { state: "unknown", reason: "legacy_unknown" }
      : { state: "known", value: offer.lifecycleSource },
    ...(offer.lastTimeBuyAt === undefined ? {} : { lastTimeBuyAt: offer.lastTimeBuyAt }),
    priceBreaks: cloneJson(offer.priceBreaks),
    productUrl: offer.productUrl,
    retrievedAt: offer.retrievedAt,
  };
}

export function migrateOfferSnapshotV1ToV2(input: unknown): OfferSnapshotV2 {
  const snapshot = parseOfferSnapshot(input);
  const content: OfferSnapshotV2Content = {
    schemaVersion: OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
    provider: snapshot.provider,
    requestedParts: cloneJson(snapshot.requestedParts),
    retrievedAt: snapshot.retrievedAt,
    expiresAt: snapshot.expiresAt,
    persistence: snapshot.persistence,
    evaluationEligibility: "legacy_audit_only",
    status: snapshot.status,
    errors: snapshot.errors.map((error) => ({ catalogVersion: 1 as const, code: error.code, retryable: error.retryable })),
    offers: snapshot.offers.map(migrateOfferV1ToV2),
    lineage: [{
      id: snapshot.id,
      schemaVersion: 1,
      contentHash: snapshot.contentHash as `sha256:${string}`,
    }],
  };
  return parseOfferSnapshotV2(finalizeOfferSnapshotV2(content));
}

export function parsePersistedOfferSnapshot(input: unknown): OfferSnapshotV1 | OfferSnapshotV2 {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("snapshot: Persisted offer snapshot must be an object");
  }
  const schemaVersion = (input as Record<string, unknown>).schemaVersion;
  if (schemaVersion === 1) return parseOfferSnapshot(input);
  if (schemaVersion === 2) return parseOfferSnapshotV2(input);
  throw new Error("schemaVersion: Must equal 1 or 2");
}

export function migrateOfferSnapshotToV2(input: unknown): OfferSnapshotV2 {
  const parsed = parsePersistedOfferSnapshot(input);
  return parsed.schemaVersion === 2 ? parsed : migrateOfferSnapshotV1ToV2(parsed);
}

export function migrateOfferSnapshot(input: Readonly<OfferSnapshotV1 | OfferSnapshotV2>): OfferSnapshotMigrationV2 {
  try {
    const parsed = parsePersistedOfferSnapshot(input);
    if (parsed.schemaVersion === 2) return { status: "migrated", snapshot: parsed };
    try {
      return { status: "migrated", snapshot: migrateOfferSnapshotV1ToV2(parsed) };
    } catch (error) {
      return { status: "unsupported_v1_value", issues: [{ path: "snapshot", message: error instanceof Error ? error.message : "V1 value is not representable in V2" }] };
    }
  } catch (error) {
    return { status: "invalid_source", issues: [{ path: "snapshot", message: error instanceof Error ? error.message : "Invalid source snapshot" }] };
  }
}

/** Compatibility-phase name; unsuffixed migrateOfferSnapshot remains frozen V1. */
export const migrateOfferSnapshotV2 = migrateOfferSnapshot;

function partKey(part: { manufacturerId: string; manufacturerPartNumber: string }): string {
  return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
}

function offerKey(distributor: string, distributorSku: string, part: { manufacturerId: string; manufacturerPartNumber: string }): string {
  return `${distributor}\u0000${distributorSku}\u0000${partKey(part)}`;
}

function constraintSortKey(constraint: SourcingPolicyConstraintV2): string {
  return `${constraint.bomLineId ?? ""}\u0000${constraint.ruleId}\u0000${constraint.explanation}`;
}

function unknownObservationCount(lines: readonly BomLineSourcingMetricsV2[]): number {
  return lines.reduce((total, line) => total + [
    line.region,
    line.currency,
    line.packaging,
    line.marketplace,
    line.backorderAvailable,
    line.lifecycle,
    line.lifecycleSource,
    line.leadTimeDays,
    line.leadTimeKind,
  ].filter((observation) => observation?.state === "unknown").length, 0);
}

function lifecycleCounts(lines: readonly BomLineSourcingMetricsV2[]) {
  const counts = emptyLifecycleCountsV2();
  for (const line of lines) {
    if (line.lifecycle?.state === "known") counts[line.lifecycle.value] += 1;
    else counts.unknown += 1;
  }
  return counts;
}

function migrationWarnings(offer?: DistributorOfferV2): string[] {
  const warnings = [V1_REEVALUATION_WARNING];
  if (offer?.leadTimeKind.state === "known" && offer.leadTimeKind.value === "manufacturer") {
    warnings.push(renderSourcingAdvisoryWarning({ code: "manufacturer_lead_not_delivery" }));
  }
  if (offer?.leadTimeKind.state === "known" && offer.leadTimeKind.value === "factory") {
    warnings.push(renderSourcingAdvisoryWarning({ code: "factory_lead_not_delivery" }));
  }
  return [...new Set(warnings)].sort(compareText);
}

function unavailableMigration(metrics: CandidateSourcingMetricsV1): CandidateSourcingEvaluationV2 {
  const lines: BomLineSourcingMetricsV2[] = metrics.lines.map((line) => ({
    bomLineId: line.bomLineId,
    part: cloneJson(line.part),
    quantityPerAssembly: line.quantityPerAssembly,
    status: "unavailable",
    warnings: [V1_SOURCE_UNAVAILABLE_WARNING],
  }));
  const constraints: SourcingPolicyConstraintV2[] = [
    renderSourcingPolicyConstraintV2("data_status", "unknown", { code: "data_status", dataStatus: "unavailable" }),
    ...lines.map((line) => renderSourcingPolicyConstraintV2("migration", "unknown", { code: "migration", reason: "source_unavailable" }, line.bomLineId)),
  ].sort((left, right) => compareText(constraintSortKey(left), constraintSortKey(right)));
  for (const line of lines) {
    const explanation = constraints.find((constraint) => constraint.code === "migration" && constraint.bomLineId === line.bomLineId)!.explanation;
    line.warnings = [V1_SOURCE_UNAVAILABLE_WARNING, explanation].sort(compareText);
  }
  const candidateWarnings = [...new Set([
    ...lines.flatMap((line) => line.warnings),
    ...constraints.filter((constraint) => constraint.bomLineId === undefined && constraint.status !== "pass").map((constraint) => constraint.explanation),
  ])].sort(compareText);
  return {
    metrics: {
      schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2,
      warningCatalogVersion: SOURCING_ADVISORY_WARNING_CATALOG_VERSION,
      status: "unavailable",
      policyStatus: "unknown",
      unknownObservationCount: 0,
      requestedBuildQuantity: metrics.requestedBuildQuantity,
      evaluatedAt: metrics.evaluatedAt,
      snapshotRefs: [],
      lines,
      lifecycleCounts: lifecycleCounts(lines),
      warnings: candidateWarnings,
    },
    policyStatus: "unknown",
    constraints,
  };
}

function lineMatchesV1Offer(line: CandidateSourcingMetricsV1["lines"][number], offer: DistributorOfferV1): boolean {
  return samePartIdentity(line.part, offer.part)
    && (line.packaging === undefined || line.packaging === offer.packaging)
    && (line.lifecycle === undefined || line.lifecycle === offer.lifecycle)
    && (line.stockQuantity === undefined || line.stockQuantity === offer.stockQuantity)
    && (line.leadTimeDays === undefined || line.leadTimeDays === offer.leadTimeDays)
    && (line.leadTimeKind === undefined || line.leadTimeKind === offer.leadTimeKind);
}

export function migrateCandidateSourcingMetricsV1ToV2(
  input: unknown,
  sourceSnapshots: readonly unknown[] = [],
): CandidateSourcingEvaluationV2 {
  const metrics = parseCandidateSourcingMetrics(input);
  if (sourceSnapshots.length === 0) return unavailableMigration(metrics);
  let verifiedSnapshots: OfferSnapshotV1[];
  try {
    verifiedSnapshots = sourceSnapshots.map(parseOfferSnapshot);
  } catch {
    return unavailableMigration(metrics);
  }

  const snapshotsById = new Map<string, OfferSnapshotV1[]>();
  for (const snapshot of verifiedSnapshots) {
    const matches = snapshotsById.get(snapshot.id) ?? [];
    matches.push(snapshot);
    snapshotsById.set(snapshot.id, matches);
  }
  const sourceById = new Map<string, OfferSnapshotV1>();
  for (const id of metrics.snapshotIds) {
    const matches = snapshotsById.get(id);
    if (matches?.length !== 1) return unavailableMigration(metrics);
    sourceById.set(id, matches[0]!);
  }

  const migratedByV1Id = new Map<string, OfferSnapshotV2>();
  for (const [id, snapshot] of sourceById) migratedByV1Id.set(id, migrateOfferSnapshotV1ToV2(snapshot));
  const snapshotRefs = [...migratedByV1Id.values()]
    .map(offerSnapshotRef)
    .sort((left, right) => compareText(`${left.schemaVersion}\u0000${left.id}\u0000${left.contentHash}`, `${right.schemaVersion}\u0000${right.id}\u0000${right.contentHash}`));

  const lines: BomLineSourcingMetricsV2[] = [];
  for (const line of metrics.lines) {
    if (line.selectedOffer === undefined) {
      lines.push({
        bomLineId: line.bomLineId,
        part: cloneJson(line.part),
        quantityPerAssembly: line.quantityPerAssembly,
        status: "unavailable",
        warnings: [V1_REEVALUATION_WARNING],
      });
      continue;
    }
    const sourceSnapshot = sourceById.get(line.selectedOffer.snapshotId);
    const migratedSnapshot = migratedByV1Id.get(line.selectedOffer.snapshotId);
    if (sourceSnapshot === undefined || migratedSnapshot === undefined) return unavailableMigration(metrics);
    const key = offerKey(line.selectedOffer.distributor, line.selectedOffer.distributorSku, line.part);
    const sourceOffers = sourceSnapshot.offers.filter((offer) => offerKey(offer.distributor, offer.distributorSku, offer.part) === key);
    const migratedOffers = migratedSnapshot.offers.filter((offer) => offerKey(offer.distributor, offer.distributorSku, offer.part) === key);
    if (sourceOffers.length !== 1 || migratedOffers.length !== 1 || !lineMatchesV1Offer(line, sourceOffers[0]!)) return unavailableMigration(metrics);
    const offer = migratedOffers[0]!;
    lines.push({
      bomLineId: line.bomLineId,
      part: cloneJson(line.part),
      quantityPerAssembly: line.quantityPerAssembly,
      status: "unknown",
      evaluatedOffer: {
        snapshot: offerSnapshotRef(migratedSnapshot),
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
      ...(offer.stockQuantity === undefined ? {} : { stockQuantity: offer.stockQuantity }),
      warnings: migrationWarnings(offer),
    });
  }

  const constraints: SourcingPolicyConstraintV2[] = [
    renderSourcingPolicyConstraintV2("data_status", "unknown", { code: "data_status", dataStatus: "unavailable" }),
    ...lines.map((line) => renderSourcingPolicyConstraintV2("migration", "unknown", { code: "migration", reason: "reevaluation_required" }, line.bomLineId)),
  ].sort((left, right) => compareText(constraintSortKey(left), constraintSortKey(right)));
  for (const line of lines) {
    const explanation = constraints.find((constraint) => constraint.code === "migration" && constraint.bomLineId === line.bomLineId)!.explanation;
    line.warnings = [...new Set([...line.warnings, explanation])].sort(compareText);
  }
  const warnings = [...new Set([
    ...lines.flatMap((line) => line.warnings),
    ...constraints.filter((constraint) => constraint.bomLineId === undefined && constraint.status !== "pass").map((constraint) => constraint.explanation),
    V1_REEVALUATION_WARNING,
  ])].sort(compareText);
  return {
    metrics: {
      schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2,
      warningCatalogVersion: SOURCING_ADVISORY_WARNING_CATALOG_VERSION,
      status: "unavailable",
      policyStatus: "unknown",
      unknownObservationCount: unknownObservationCount(lines),
      requestedBuildQuantity: metrics.requestedBuildQuantity,
      evaluatedAt: metrics.evaluatedAt,
      snapshotRefs,
      lines,
      lifecycleCounts: lifecycleCounts(lines),
      warnings,
    },
    policyStatus: "unknown",
    constraints,
  };
}
