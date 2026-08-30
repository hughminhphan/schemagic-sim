import { describe, expect, it } from "vitest";
import {
  PROVIDER_ERROR_CATALOG_VERSION_V2,
  calculateOfferSnapshotContentHashV1,
  calculateOfferSnapshotContentHashV2,
  calculateOfferSnapshotIdV2,
  calculateSnapshotAuthorizationContentHashV1,
  calculateSnapshotAuthorizationIdV1,
  canonicalCommercialNumberV2,
  canonicalCommercialRationalV2,
  canonicalSnapshotAuthorizationClaimsV1,
  compareRfc3339InstantsV2,
  createSnapshotAuthorizationVerifierV1,
  finalizeOfferSnapshotV2,
  formatRfc3339InstantV2,
  migrateCandidateSourcingMetricsV1ToAuditV2,
  migrateOfferSnapshotV2,
  parseAuthorizedOfferSnapshotDocumentV2,
  parseCandidateSourcingEvaluationV2,
  parseDistributorOfferV2,
  parseOfferSnapshotV2,
  parseOfferSnapshotV2Ref,
  parsePersistedOfferSnapshot,
  parseLegacyCandidateSourcingAuditV2,
  parseRfc3339InstantV2,
  parseSnapshotAuthorizationV1,
  parseSourcingPolicyConstraintV2,
  renderProviderErrorV2,
  renderSourcingPolicyConstraintV2,
  snapshotAuthorizationRefV1,
  validateCandidateSourcingMetricsV2,
  validateCandidateSourcingEvaluationContextV2,
  validateOfferSnapshotV2,
  type OfferSnapshotV2,
  type SnapshotAuthorizationV1,
} from "../src/index";
import { SYNTHETIC_SOURCING_FIXTURES_V2 } from "../src/fixtures-v2";
import { SYNTHETIC_SOURCING_FIXTURES } from "../src/fixtures";

function knownFixture() {
  return SYNTHETIC_SOURCING_FIXTURES_V2.knownFalseAndComplete!;
}

function authorizationFor(snapshot: OfferSnapshotV2): SnapshotAuthorizationV1 {
  const claims = {
    format: "schemagic-snapshot-authorization" as const,
    schemaVersion: 1 as const,
    snapshotRef: { id: snapshot.id, schemaVersion: 2 as const, contentHash: snapshot.contentHash },
    provider: snapshot.provider,
    providerPolicy: { id: "policy:synthetic", version: "2026-08-23", contentHash: `sha256:${"1".repeat(64)}` as const },
    attribution: {
      provider: snapshot.provider,
      providerPolicy: { id: "policy:synthetic", version: "2026-08-23", contentHash: `sha256:${"1".repeat(64)}` as const },
      required: true,
      label: "Synthetic distributor",
    },
    executionMode: "self_hosted" as const,
    effectivePersistence: "ephemeral" as const,
    effectiveEvaluationEligibility: "native_v2" as const,
    authorizedUses: ["display"] as Array<"display">,
    issuedAt: "2026-08-23T00:00:00.000000001Z",
    notAfter: "2026-08-23T01:00:00.000000000Z",
    issuerKeyId: "test:issuer-v1",
  };
  const contentHash = calculateSnapshotAuthorizationContentHashV1(claims);
  return {
    ...claims,
    authorizedUses: [...claims.authorizedUses],
    id: `snapshot-authorization:v1:${contentHash}`,
    contentHash,
    signature: "A".repeat(86),
  };
}

describe("sourcing schema V2 compatibility surface", () => {
  it("uses exact RFC3339 nanosecond parsing, formatting, and rational projection", () => {
    const oneNs = parseRfc3339InstantV2("1970-01-01T00:00:00.000000001Z");
    expect(oneNs.epochNanoseconds).toBe(1n);
    expect(formatRfc3339InstantV2(oneNs.epochNanoseconds)).toBe("1970-01-01T00:00:00.000000001Z");
    expect(compareRfc3339InstantsV2("2026-08-23T10:00:00+10:00", "2026-08-23T00:00:00Z")).toBe(0);
    for (const invalid of ["0000-01-01T00:00:00Z", "2026-02-29T00:00:00Z", "2026-01-01T24:00:00Z", "2026-01-01T00:00:60Z", "2026-01-01T00:00:00+14:01", "2026-01-01T00:00:00.0000000000Z"]) {
      expect(() => parseRfc3339InstantV2(invalid), invalid).toThrow();
    }
    expect(canonicalCommercialRationalV2(1n, 1_000_000_000n)).toBe(1e-9);
    expect(canonicalCommercialRationalV2(12_345_678_901_25n, 100n)).toBe(12_345_678_901.2);
    expect(canonicalCommercialNumberV2(1.23456789012345)).toBe(1.23456789012);
  });

  it("preserves known false and closes unknown observation and URL syntax", () => {
    const offer = knownFixture().snapshots[0]!.offers[0]!;
    expect(parseDistributorOfferV2(offer).marketplace).toEqual({ state: "known", value: false });
    const unknown = structuredClone(offer);
    unknown.marketplace = { state: "unknown", reason: "not_supported" };
    expect(parseDistributorOfferV2(unknown).marketplace).toEqual({ state: "unknown", reason: "not_supported" });
    expect(() => parseDistributorOfferV2({ ...unknown, marketplace: { state: "unknown", reason: "not_supported", value: false } })).toThrow(/unknown key/i);
    expect(() => parseDistributorOfferV2({ ...unknown, distributorSku: "unsafe\n.control" })).toThrow(/control/i);
    expect(() => parseDistributorOfferV2({ ...unknown, productUrl: "http://example.invalid/part" })).toThrow(/https/i);
    expect(() => parseDistributorOfferV2({ ...unknown, productUrl: "https://user@example.invalid/part" })).toThrow(/https/i);
  });

  it("content-addresses snapshots without id/hash and closes provider errors", () => {
    const snapshot = knownFixture().snapshots[0]!;
    expect(parseOfferSnapshotV2(snapshot)).toEqual(snapshot);
    expect(calculateOfferSnapshotContentHashV2(snapshot)).toBe(snapshot.contentHash);
    expect(calculateOfferSnapshotIdV2(snapshot)).toBe(snapshot.id);
    const mutated = structuredClone(snapshot);
    mutated.offers[0]!.marketplace = { state: "unknown", reason: "not_reported" };
    const finalized = finalizeOfferSnapshotV2({ ...mutated, id: undefined, contentHash: undefined } as never);
    expect(finalized.contentHash).not.toBe(snapshot.contentHash);
    expect(finalized.id).toBe(`snapshot:v2:${finalized.contentHash}`);

    const errorSnapshot = finalizeOfferSnapshotV2({
      schemaVersion: 2,
      provider: "digikey",
      requestedParts: structuredClone(snapshot.requestedParts),
      retrievedAt: snapshot.retrievedAt,
      expiresAt: snapshot.expiresAt,
      persistence: "ephemeral",
      evaluationEligibility: "native_v2",
      status: "provider_error",
      errors: [{ catalogVersion: PROVIDER_ERROR_CATALOG_VERSION_V2, code: "timeout", retryable: false }],
      offers: [],
      lineage: [],
    });
    expect(renderProviderErrorV2(errorSnapshot.errors[0]!)).toBe("Provider request timed out");
    expect(validateOfferSnapshotV2({ ...errorSnapshot, errors: [{ ...errorSnapshot.errors[0], message: "raw upstream" }] }).map((issue) => issue.path)).toContain("errors.0.message");
  });

  it("permits V1 refs only in lineage and requires full V2 refs in native metrics", () => {
    const snapshot = knownFixture().snapshots[0]!;
    expect(parseOfferSnapshotV2Ref({ id: snapshot.id, schemaVersion: 2, contentHash: snapshot.contentHash })).toEqual({ id: snapshot.id, schemaVersion: 2, contentHash: snapshot.contentHash });
    expect(() => parseOfferSnapshotV2Ref({ id: "legacy", schemaVersion: 1, contentHash: `sha256:${"0".repeat(64)}` })).toThrow(/schemaVersion/i);
    const metrics = structuredClone(knownFixture().evaluation.metrics);
    metrics.snapshotRefs = [{ id: "legacy", schemaVersion: 1, contentHash: `sha256:${"0".repeat(64)}` } as never];
    expect(validateCandidateSourcingMetricsV2(metrics).map((issue) => issue.path)).toContain("snapshotRefs.0.schemaVersion");
  });

  it("renders and parses the correlated closed sourcing constraint catalog", () => {
    const constraint = renderSourcingPolicyConstraintV2("stock", "unknown", {
      code: "stock",
      stockQuantity: null,
      purchaseQuantity: 100,
      minimumStock: 100,
      backorderAvailable: { state: "unknown", reason: "not_supported" },
      allowBackorder: false,
    }, "driver");
    expect(parseSourcingPolicyConstraintV2(constraint)).toEqual(constraint);
    expect(constraint.ruleId).toBe("sourcing.policy.stock");
    expect(JSON.parse(constraint.explanation)).toEqual({
      bomLineId: "driver",
      code: "stock",
      inputs: constraint.inputs,
      ruleCatalogVersion: 1,
      ruleId: "sourcing.policy.stock",
      status: "unknown",
    });
    expect(() => parseSourcingPolicyConstraintV2({ ...constraint, ruleId: "sourcing.policy.region" })).toThrow(/derived/i);
    expect(() => parseSourcingPolicyConstraintV2({ ...constraint, explanation: "arbitrary" })).toThrow(/canonical/i);
  });

  it("parses authorization wire data and issues verifier-scoped unforgeable operations", () => {
    const snapshot = knownFixture().snapshots[0]!;
    const authorization = authorizationFor(snapshot);
    expect(parseSnapshotAuthorizationV1(authorization)).toEqual(authorization);
    expect(canonicalSnapshotAuthorizationClaimsV1(authorization)).not.toContain(authorization.signature);
    expect(calculateSnapshotAuthorizationIdV1(authorization)).toBe(authorization.id);
    expect(snapshotAuthorizationRefV1(authorization)).toEqual({ id: authorization.id, contentHash: authorization.contentHash, issuerKeyId: authorization.issuerKeyId });
    expect(parseAuthorizedOfferSnapshotDocumentV2({ format: "schemagic-authorized-offer-snapshot", schemaVersion: 2, snapshot, authorization }).authorization.id).toBe(authorization.id);

    const verifier = createSnapshotAuthorizationVerifierV1({
      checkedAt: () => "2026-08-23T00:30:00Z",
      verifySignatureAndPolicy: () => [],
    });
    const token = verifier.authorizeOperation("display", [snapshot], [authorization]);
    expect(verifier.validateOperation(token, "display", [snapshot], [authorization])).toEqual([]);
    expect(verifier.validateOperation({ use: "display", checkedAt: token.checkedAt } as never, "display", [snapshot], [authorization])[0]?.path).toBe("authorizationOperation");
    expect(verifier.validateOperation(token, "download_export", [snapshot], [authorization])[0]?.path).toBe("authorizationOperation");
  });

  it("keeps V1 dispatch byte-compatible and makes migration explicit and audit-only", () => {
    const v1 = SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!.snapshots[0]!;
    expect(parsePersistedOfferSnapshot(v1)).toEqual(v1);
    expect(calculateOfferSnapshotContentHashV1(v1)).toBe(v1.contentHash);
    const migration = migrateOfferSnapshotV2(v1);
    expect(migration.status).toBe("migrated");
    if (migration.status !== "migrated") throw new Error("migration failed");
    expect(migration.snapshot.evaluationEligibility).toBe("legacy_audit_only");
    expect(migration.snapshot.lineage).toEqual([{ id: v1.id, schemaVersion: 1, contentHash: v1.contentHash }]);
    expect(migrateOfferSnapshotV2(migration.snapshot)).toEqual({ status: "migrated", snapshot: migration.snapshot });
  });

  it("structurally parses the complete synthetic evaluation", () => {
    expect(parseCandidateSourcingEvaluationV2(knownFixture().evaluation)).toEqual(knownFixture().evaluation);
  });

  it("independently recomputes the exact native evaluation and binds trusted time", () => {
    const fixture = knownFixture();
    const snapshot = fixture.snapshots[0]!;
    const authorization = authorizationFor(snapshot);
    const verifier = createSnapshotAuthorizationVerifierV1({
      checkedAt: () => fixture.evaluation.metrics.evaluatedAt,
      verifySignatureAndPolicy: () => [],
    });
    const operation = verifier.authorizeOperation("display", [snapshot], [authorization]);
    const context = {
      candidateId: "candidate:synthetic:native-v2",
      components: fixture.evaluation.metrics.lines.map((line) => ({ id: line.bomLineId, part: line.part, quantityPerAssembly: line.quantityPerAssembly })),
      policy: fixture.policy,
      snapshots: fixture.snapshots,
      authorizations: [authorization],
      authorizationVerifier: verifier,
      authorizationOperation: operation,
      expectedAuthorizationUse: "display" as const,
      evaluatedAt: fixture.evaluation.metrics.evaluatedAt,
    };
    expect(validateCandidateSourcingEvaluationContextV2(fixture.evaluation, context)).toEqual([]);
    expect(validateCandidateSourcingEvaluationContextV2(fixture.evaluation, { ...context, evaluatedAt: "2026-08-23T00:20:00Z" }).map((issue) => issue.path)).toContain("context.evaluatedAt");
    const alternative = structuredClone(fixture.evaluation);
    alternative.metrics.lines[0]!.extendedCost!.amount = 201;
    expect(validateCandidateSourcingEvaluationContextV2(alternative, context).some((issue) => issue.path.startsWith("metrics"))).toBe(true);
    expect(validateCandidateSourcingEvaluationContextV2(fixture.evaluation, {
      ...context,
      policy: { ...context.policy, maximumSnapshotAgeSeconds: Number.MAX_SAFE_INTEGER },
    })).toContainEqual(expect.objectContaining({ path: "context" }));
  });

  it("produces closed unattached V1 candidate audit migrations", () => {
    const fixture = SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!;
    const resolved = migrateCandidateSourcingMetricsV1ToAuditV2("candidate:v1:synthetic", fixture.metrics, fixture.snapshots);
    expect(resolved.status).toBe("migrated");
    if (resolved.status !== "migrated") throw new Error("resolved migration failed");
    expect(parseLegacyCandidateSourcingAuditV2(resolved.audit)).toEqual(resolved.audit);
    expect(resolved.audit.snapshotLineage).toHaveLength(fixture.metrics.snapshotIds.length);
    expect(resolved.migratedSnapshots.every((snapshot) => snapshot.evaluationEligibility === "legacy_audit_only")).toBe(true);
    expect((resolved.audit as unknown as Record<string, unknown>).candidateId).toBeUndefined();

    const degraded = migrateCandidateSourcingMetricsV1ToAuditV2("candidate:v1:synthetic", fixture.metrics);
    expect(degraded.status).toBe("migrated");
    if (degraded.status !== "migrated") throw new Error("degraded migration failed");
    expect(degraded.audit.snapshotLineage).toEqual([]);
    expect(degraded.migratedSnapshots).toEqual([]);
    expect(degraded.audit.metrics.snapshotRefs).toEqual([]);
  });
});
