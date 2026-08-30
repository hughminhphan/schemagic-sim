import { canonicalJsonForVersionedSourcing, sha256HexForVersionedSourcing } from "./canonical";
import type { CandidateSourcingMetrics as CandidateSourcingMetricsV1 } from "./metrics";
import type { OfferSnapshot as OfferSnapshotV1 } from "./snapshot";
import { parseCandidateSourcingMetrics, parseOfferSnapshot, type ValidationIssue } from "./validation";
import { migrateCandidateSourcingMetricsV1ToV2, migrateOfferSnapshotV2, V1_REEVALUATION_WARNING, V1_SOURCE_UNAVAILABLE_WARNING } from "./migration-v2";
import { parseCandidateSourcingEvaluationV2, parseOfferSnapshotRef, parseOfferSnapshotV2 } from "./validation-v2";
import type {
  LegacyCandidateSourcingAuditMigrationV2,
  LegacyCandidateSourcingAuditV2,
  OfferSnapshotV1Ref,
  OfferSnapshotV2,
  Sha256ContentHash,
} from "./v2";

type UnknownRecord = Record<string, unknown>;
const AUDIT_KEYS = ["format", "schemaVersion", "sourceCandidateId", "metrics", "constraints", "snapshotLineage", "warnings", "contentHash"] as const;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isRecord(input: unknown): input is UnknownRecord {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function refKey(ref: OfferSnapshotV1Ref): string {
  return `${ref.schemaVersion}\u0000${ref.id}\u0000${ref.contentHash}`;
}

function constraintKey(constraint: LegacyCandidateSourcingAuditV2["constraints"][number]): string {
  return `${constraint.bomLineId ?? ""}\u0000${constraint.code}`;
}

function sortedUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || compareText(values[index - 1]!, value) < 0);
}

export function canonicalLegacyCandidateSourcingAuditV2Payload(
  audit: Omit<LegacyCandidateSourcingAuditV2, "contentHash"> | LegacyCandidateSourcingAuditV2,
): string {
  const { contentHash: _contentHash, ...payload } = audit as LegacyCandidateSourcingAuditV2;
  return canonicalJsonForVersionedSourcing(payload);
}

export function calculateLegacyCandidateSourcingAuditV2ContentHash(
  audit: Omit<LegacyCandidateSourcingAuditV2, "contentHash"> | LegacyCandidateSourcingAuditV2,
): Sha256ContentHash {
  return `sha256:${sha256HexForVersionedSourcing(canonicalLegacyCandidateSourcingAuditV2Payload(audit))}`;
}

function auditDocument(
  sourceCandidateId: string,
  evaluation: ReturnType<typeof migrateCandidateSourcingMetricsV1ToV2>,
  snapshotLineage: OfferSnapshotV1Ref[],
  warning: string,
): LegacyCandidateSourcingAuditV2 {
  const payload = {
    format: "schemagic-legacy-candidate-sourcing-audit" as const,
    schemaVersion: 2 as const,
    sourceCandidateId,
    metrics: evaluation.metrics,
    constraints: evaluation.constraints,
    snapshotLineage,
    warnings: [warning],
  };
  return { ...payload, contentHash: calculateLegacyCandidateSourcingAuditV2ContentHash(payload) };
}

export function migrateCandidateSourcingMetricsV1ToAuditV2(
  sourceCandidateId: string,
  metricsInput: Readonly<CandidateSourcingMetricsV1>,
  verifiedV1Snapshots: readonly OfferSnapshotV1[] = [],
): LegacyCandidateSourcingAuditMigrationV2 {
  if (typeof sourceCandidateId !== "string" || sourceCandidateId.trim() === "") return { status: "invalid_v1_source", issues: [{ path: "sourceCandidateId", message: "Must be a non-empty source candidate ID" }] };
  let metrics: CandidateSourcingMetricsV1;
  let snapshots: OfferSnapshotV1[];
  try {
    metrics = parseCandidateSourcingMetrics(metricsInput);
    snapshots = verifiedV1Snapshots.map((snapshot) => parseOfferSnapshot(snapshot));
  } catch (error) {
    return { status: "invalid_v1_source", issues: [{ path: "source", message: error instanceof Error ? error.message : "Invalid V1 source" }] };
  }

  const byId = new Map<string, OfferSnapshotV1[]>();
  for (const snapshot of snapshots) byId.set(snapshot.id, [...(byId.get(snapshot.id) ?? []), snapshot]);
  const referenced = metrics.snapshotIds.map((id) => byId.get(id)).filter((matches): matches is OfferSnapshotV1[] => matches !== undefined && matches.length === 1).map((matches) => matches[0]!);
  const fullyResolved = metrics.snapshotIds.length > 0 && referenced.length === metrics.snapshotIds.length;
  if (!fullyResolved) {
    const evaluation = migrateCandidateSourcingMetricsV1ToV2(metrics);
    return {
      status: "migrated",
      audit: auditDocument(sourceCandidateId, evaluation, [], V1_SOURCE_UNAVAILABLE_WARNING),
      migratedSnapshots: [],
    };
  }

  const migratedSnapshots: OfferSnapshotV2[] = [];
  for (const snapshot of referenced) {
    const migration = migrateOfferSnapshotV2(snapshot);
    if (migration.status === "invalid_source") return { status: "invalid_v1_source", issues: migration.issues };
    if (migration.status === "unsupported_v1_value") return { status: "unsupported_v1_value", issues: migration.issues };
    migratedSnapshots.push(migration.snapshot);
  }
  const evaluation = migrateCandidateSourcingMetricsV1ToV2(metrics, referenced);
  if (evaluation.metrics.snapshotRefs.length !== referenced.length) {
    const degraded = migrateCandidateSourcingMetricsV1ToV2(metrics);
    return { status: "migrated", audit: auditDocument(sourceCandidateId, degraded, [], V1_SOURCE_UNAVAILABLE_WARNING), migratedSnapshots: [] };
  }
  evaluation.metrics.lines.sort((left, right) => compareText(left.bomLineId, right.bomLineId));
  const snapshotLineage = referenced.map((snapshot): OfferSnapshotV1Ref => ({
    id: snapshot.id,
    schemaVersion: 1,
    contentHash: snapshot.contentHash as Sha256ContentHash,
  })).sort((left, right) => compareText(refKey(left), refKey(right)));
  migratedSnapshots.sort((left, right) => compareText(`${left.schemaVersion}\u0000${left.id}\u0000${left.contentHash}`, `${right.schemaVersion}\u0000${right.id}\u0000${right.contentHash}`));
  return {
    status: "migrated",
    audit: auditDocument(sourceCandidateId, evaluation, snapshotLineage, V1_REEVALUATION_WARNING),
    migratedSnapshots,
  };
}

export function parseLegacyCandidateSourcingAuditV2(input: unknown): LegacyCandidateSourcingAuditV2 {
  if (!isRecord(input)) throw new Error("audit: Must be an object");
  for (const key of Object.keys(input)) if (!(AUDIT_KEYS as readonly string[]).includes(key)) throw new Error(`${key}: Unknown key`);
  if (input.format !== "schemagic-legacy-candidate-sourcing-audit") throw new Error("format: Invalid legacy audit format");
  if (input.schemaVersion !== 2) throw new Error("schemaVersion: Must equal 2");
  if (typeof input.sourceCandidateId !== "string" || input.sourceCandidateId.trim() === "") throw new Error("sourceCandidateId: Must be non-empty");
  const evaluation = parseCandidateSourcingEvaluationV2({
    metrics: input.metrics,
    policyStatus: isRecord(input.metrics) ? input.metrics.policyStatus : undefined,
    constraints: input.constraints,
  });
  if (!Array.isArray(input.snapshotLineage)) throw new Error("snapshotLineage: Must be an array");
  const snapshotLineage = input.snapshotLineage.map((ref, index) => {
    const parsed = parseOfferSnapshotRef(ref);
    if (parsed.schemaVersion !== 1) throw new Error(`snapshotLineage.${index}.schemaVersion: Must equal 1`);
    return parsed;
  });
  if (!sortedUnique(snapshotLineage.map(refKey))) throw new Error("snapshotLineage: Must be sorted and unique");
  if (!Array.isArray(input.constraints) || !sortedUnique((evaluation.constraints).map(constraintKey))) throw new Error("constraints: Must be sorted and unique by scope and code");
  if (!Array.isArray(input.warnings) || input.warnings.some((warning) => typeof warning !== "string" || warning.length === 0) || !sortedUnique(input.warnings as string[])) throw new Error("warnings: Must be sorted unique non-empty strings");
  if (typeof input.contentHash !== "string" || !HASH_PATTERN.test(input.contentHash)) throw new Error("contentHash: Must be a canonical SHA-256 hash");
  const candidate = {
    format: input.format,
    schemaVersion: input.schemaVersion,
    sourceCandidateId: input.sourceCandidateId,
    metrics: evaluation.metrics,
    constraints: evaluation.constraints,
    snapshotLineage,
    warnings: input.warnings as string[],
    contentHash: input.contentHash as Sha256ContentHash,
  } satisfies LegacyCandidateSourcingAuditV2;
  if (calculateLegacyCandidateSourcingAuditV2ContentHash(candidate) !== candidate.contentHash) throw new Error("contentHash: Does not match canonical legacy audit payload");
  return JSON.parse(JSON.stringify(candidate)) as LegacyCandidateSourcingAuditV2;
}

export function validateLegacyCandidateSourcingAuditV2(input: unknown): ValidationIssue[] {
  try { parseLegacyCandidateSourcingAuditV2(input); return []; } catch (error) { return [{ path: "audit", message: error instanceof Error ? error.message : "Invalid legacy audit" }]; }
}

export function assertMigratedSnapshotsAreAuditOnlyV2(snapshots: readonly unknown[]): OfferSnapshotV2[] {
  return snapshots.map((snapshot, index) => {
    const parsed = parseOfferSnapshotV2(snapshot);
    if (parsed.evaluationEligibility !== "legacy_audit_only") throw new Error(`snapshots.${index}.evaluationEligibility: Must equal legacy_audit_only`);
    return parsed;
  });
}
