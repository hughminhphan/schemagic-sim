import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateSnapshotAuthorizationContentHashV1,
  createSnapshotAuthorizationVerifierV1,
  emptyLifecycleCountsV2,
  finalizeOfferSnapshotV2,
  parseCandidateSourcingEvaluationV2,
  renderSourcingPolicyConstraintV2,
  snapshotAuthorizationRefV1,
  type CandidateSourcingEvaluationV2,
  type SnapshotAuthorizationV1,
  type SourcingPolicy,
} from "@opencircuit/sourcing-schema";
import {
  canonicalDesignResultV2ContentHash,
  calculateCommercialOverlayV1ContentHash,
  calculateCommercialOverlayV1Id,
  canonicalCommercialCandidateSetHashV1,
  canonicalCommercialOverlayV1Payload,
  designRequestHashV2,
  migrateDesignRequestV1ToV2,
  parseDesignResultV2,
  parseCommercialOverlayV1,
  validateCommercialOverlayContextV1,
  validateCommercialOverlayDesignBindingV1,
  validateCommercialOverlaySetContextV1,
  type CommercialOverlayV1,
  type DesignResultV2,
} from "../src";

const hash = (digit: string) => `sha256:${digit.repeat(64)}` as `sha256:${string}`;

function overlay(): CommercialOverlayV1 {
  const payload: Omit<CommercialOverlayV1, "id" | "contentHash"> = {
    format: "schemagic-commercial-overlay",
    schemaVersion: 1,
    persistence: "user_local",
    designResultRef: {
      schemaVersion: 2,
      designResultContentHash: hash("1"),
      requestHash: hash("2"),
      libraryVersion: "test-library-v2",
      libraryContentHash: hash("3"),
      candidateSetHash: canonicalCommercialCandidateSetHashV1([]),
    },
    policy: {
      schemaVersion: 1,
      distributors: ["digikey"],
      mode: "any_selected",
      buildQuantity: 1,
      region: "US",
      currency: "USD",
      allowedLifecycle: ["active"],
      allowBackorder: false,
      allowMarketplace: false,
      maximumSnapshotAgeSeconds: 60,
    },
    evaluatedAt: "2026-08-24T00:00:00.000Z",
    snapshotRefs: [],
    authorizationRefs: [],
    authorizationNotAfter: null,
    attributions: [],
    paretoCriteria: [],
    rankingCriteria: [],
    candidates: [],
  };
  const contentHash = calculateCommercialOverlayV1ContentHash(payload);
  return { ...payload, id: calculateCommercialOverlayV1Id(payload), contentHash };
}

function oneCandidateResult(): DesignResultV2 {
  const source = JSON.parse(readFileSync(new URL("./fixtures/requests/p1-compact.design-request.json", import.meta.url), "utf8"));
  const migration = migrateDesignRequestV1ToV2(source, source.libraryVersion);
  if (migration.status !== "migrated") throw new Error("Expected request migration");
  const requestHash = designRequestHashV2(migration.request);
  const candidate = {
    schemaVersion: 2 as const,
    id: `candidate:v2:${hash("c")}` as const,
    requestHash,
    recipeId: "test.recipe",
    libraryVersion: migration.request.libraryVersion,
    components: [{
      id: "primary", role: "test.primary", profileId: "test.profile",
      part: { manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-1" },
      quantityPerAssembly: 1, evidence: [],
    }],
    derivedValues: [], constraints: [],
    metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
    simulationCoverage: [{ scenarioId: "op", modelTier: "behavioral" as const, limitations: [] }],
    circuit: {
      format: "opencircuit-circuit" as const, version: 2 as const, meta: { title: "Commercial fixture" },
      designBlocks: [],
      circuits: [{
        id: "main", title: "Main",
        components: [{ id: "ground", type: "ground" as const, pos: [0, 0] as [number, number], rot: 0 as const, mirror: false }],
        wires: [], probes: [],
      }],
      scenarios: [{ id: "op", title: "Operating point", circuitId: "main", config: { mode: "op" as const } }],
      defaultCircuitId: "main", defaultScenarioId: "op",
    },
    circuitInstanceClassifications: [{ circuitId: "main", componentId: "ground", kind: "non_bom" as const, reason: "Ground is not a BOM line" }],
    circuitBomNonRepresentations: [{ circuitId: "main", selectedComponentId: "primary", reason: "Fixture omits physical representation" }],
    warnings: [],
  };
  const payload: Omit<DesignResultV2, "contentHash"> = {
    format: "schemagic-design-result", schemaVersion: 2, request: migration.request, requestHash,
    libraryVersion: migration.request.libraryVersion, libraryContentHash: hash("d"),
    candidates: [candidate], rejectedCandidates: [], diagnostics: [],
  };
  return { ...payload, contentHash: canonicalDesignResultV2ContentHash(payload) };
}

function unknownEvaluation(policy: SourcingPolicy, evaluatedAt: string): CandidateSourcingEvaluationV2 {
  const offer = renderSourcingPolicyConstraintV2("offer_available", "unknown", {
    code: "offer_available", proof: "not_proven",
  }, "primary");
  const data = renderSourcingPolicyConstraintV2("data_status", "unknown", {
    code: "data_status", dataStatus: "unavailable",
  });
  return {
    metrics: {
      schemaVersion: 2, warningCatalogVersion: 1, status: "unavailable", policyStatus: "unknown",
      unknownObservationCount: 0, requestedBuildQuantity: policy.buildQuantity, evaluatedAt,
      snapshotRefs: [],
      lines: [{
        bomLineId: "primary", part: { manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-1" },
        quantityPerAssembly: 1, status: "unavailable", warnings: [offer.explanation],
      }],
      lifecycleCounts: { ...emptyLifecycleCountsV2(), unknown: 1 },
      warnings: [data.explanation, offer.explanation].sort(),
    },
    policyStatus: "unknown",
    constraints: [data, offer],
  };
}

describe("commercial overlay V1", () => {
  it("rejects hash-valid hostile V2 result display strings and electrical IDs", () => {
    const rehash = (input: DesignResultV2): DesignResultV2 => {
      const { contentHash: _contentHash, ...payload } = input;
      return { ...payload, contentHash: canonicalDesignResultV2ContentHash(payload) };
    };
    const controls = [...Array.from({ length: 32 }, (_, index) => String.fromCharCode(index)), "\u007f", ...Array.from({ length: 32 }, (_, index) => String.fromCharCode(0x80 + index)), "\u061c", "\u200e", "\u200f", "\u2028", "\u2029", "\u202a", "\u202b", "\u202c", "\u202d", "\u202e", "\u2066", "\u2067", "\u2068", "\u2069"];
    for (const control of controls) {
      const version = structuredClone(oneCandidateResult());
      version.request.libraryVersion = `test${control}library`;
      version.libraryVersion = version.request.libraryVersion;
      version.candidates[0]!.libraryVersion = version.request.libraryVersion;
      version.requestHash = designRequestHashV2(version.request);
      version.candidates[0]!.requestHash = version.requestHash;
      const hostileVersion = rehash(version);
      expect(hostileVersion.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(() => parseDesignResultV2(hostileVersion)).toThrow();

      const display = structuredClone(oneCandidateResult());
      display.candidates[0]!.components[0]!.role = `primary${control}role`;
      const hostileDisplay = rehash(display);
      expect(hostileDisplay.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(() => parseDesignResultV2(hostileDisplay)).toThrow();
    }
    const nestedCircuitDisplay = structuredClone(oneCandidateResult());
    nestedCircuitDisplay.candidates[0]!.circuit.meta.title = "Circuit\u202eTitle";
    expect(() => parseDesignResultV2(rehash(nestedCircuitDisplay))).toThrow();
    for (const hostileId of ["Bad_ID", "sourcing.cost", "commercial.cost", "offer.cost", "provider.cost", "distributor.cost"]) {
      const metric = structuredClone(oneCandidateResult());
      metric.candidates[0]!.metrics.values = [{ id: hostileId, value: { value: 1, unit: "count", displayUnit: "count" }, state: "calculated", explanation: "Hostile metric ID fixture", evidence: [] }];
      expect(() => parseDesignResultV2(rehash(metric))).toThrow();
      const derived = structuredClone(oneCandidateResult());
      derived.candidates[0]!.derivedValues = [{ id: hostileId, value: { value: 1, unit: "count", displayUnit: "count" }, equationId: "test.equation", state: "calculated", evidence: [] }];
      expect(() => parseDesignResultV2(rehash(derived))).toThrow();
    }
  });

  it("uses independent SHA-256 canonical payload, ID, and sorted candidate-set hashes", () => {
    const document = overlay();
    const independent = `sha256:${createHash("sha256").update(canonicalCommercialOverlayV1Payload(document)).digest("hex")}`;
    expect(document.contentHash).toBe(independent);
    expect(document.id).toBe(`commercial-overlay:v1:${independent}`);
    const a = `candidate:v2:${hash("a")}` as const;
    const b = `candidate:v2:${hash("b")}` as const;
    expect(canonicalCommercialCandidateSetHashV1([b, a])).toBe(canonicalCommercialCandidateSetHashV1([a, b]));
    expect(() => canonicalCommercialCandidateSetHashV1([a, a])).toThrow("unique");
  });

  it("strictly parses closed bytes and rejects identity or policy-set drift", () => {
    const document = overlay();
    expect(parseCommercialOverlayV1(document)).toEqual(document);
    expect(() => parseCommercialOverlayV1({ ...document, extra: true })).toThrow("Unknown key");
    expect(() => parseCommercialOverlayV1({ ...document, contentHash: hash("f") })).toThrow("canonical payload");
    const changed = { ...document, policy: { ...document.policy, distributors: ["mouser", "digikey"] } };
    const changedHash = calculateCommercialOverlayV1ContentHash(changed);
    expect(() => parseCommercialOverlayV1({ ...changed, id: `commercial-overlay:v1:${changedHash}`, contentHash: changedHash })).toThrow("sorted");
    const unsafeCount = { ...document, policy: { ...document.policy, minimumStock: 10_000_000_000_000_000 } };
    const unsafeHash = calculateCommercialOverlayV1ContentHash(unsafeCount);
    expect(() => parseCommercialOverlayV1({
      ...unsafeCount,
      id: `commercial-overlay:v1:${unsafeHash}`,
      contentHash: unsafeHash,
    })).toThrow("safe integers");
  });

  it("rejects inherited JSON substitution and sorts attributions by the frozen provider-first tuple", () => {
    const base = overlay();
    const smuggledPolicy = { ...base.policy, apiKey: "SECRET" };
    const smuggledPayload = { ...base, policy: smuggledPolicy };
    const smuggledHash = calculateCommercialOverlayV1ContentHash(smuggledPayload);
    const maliciousPolicy = Object.assign(Object.create({ toJSON: () => smuggledPolicy }), base.policy);
    expect(() => parseCommercialOverlayV1({
      ...base,
      policy: maliciousPolicy,
      id: `commercial-overlay:v1:${smuggledHash}`,
      contentHash: smuggledHash,
    })).toThrow("plain prototype");
    const refsWithDroppedProperty: unknown[] = [];
    Object.defineProperty(refsWithDroppedProperty, "4294967295", {
      value: { apiKey: "SECRET" }, enumerable: true,
    });
    expect(() => parseCommercialOverlayV1({ ...base, snapshotRefs: refsWithDroppedProperty })).toThrow("dense JSON array");

    const attributions = [{
      provider: "digikey" as const,
      providerPolicy: { id: "digikey", version: "1", contentHash: hash("8") },
      required: true,
      label: "Z",
    }, {
      provider: "mouser" as const,
      providerPolicy: { id: "mouser", version: "1", contentHash: hash("7") },
      required: true,
      label: "A",
    }];
    const payload = { ...base, attributions };
    const contentHash = calculateCommercialOverlayV1ContentHash(payload);
    expect(parseCommercialOverlayV1({
      ...payload,
      id: `commercial-overlay:v1:${contentHash}`,
      contentHash,
    }).attributions).toEqual(attributions);
    const reversed = { ...payload, attributions: [...attributions].reverse() };
    const reversedHash = calculateCommercialOverlayV1ContentHash(reversed);
    expect(() => parseCommercialOverlayV1({
      ...reversed,
      id: `commercial-overlay:v1:${reversedHash}`,
      contentHash: reversedHash,
    })).toThrow("sorted and unique");
  });

  it("binds every electrical candidate and fully recomputes an unknown no-snapshot evaluation", () => {
    const result = oneCandidateResult();
    const base = overlay();
    const evaluation = unknownEvaluation(base.policy, base.evaluatedAt);
    expect(parseCandidateSourcingEvaluationV2(evaluation)).toEqual(evaluation);
    const payload: Omit<CommercialOverlayV1, "id" | "contentHash"> = {
      ...base,
      designResultRef: {
        schemaVersion: 2, designResultContentHash: result.contentHash, requestHash: result.requestHash,
        libraryVersion: result.libraryVersion, libraryContentHash: result.libraryContentHash,
        candidateSetHash: canonicalCommercialCandidateSetHashV1(result.candidates.map((candidate) => candidate.id)),
      },
      candidates: [{
        candidateId: result.candidates[0]!.id, status: "unproven", policyStatus: "unknown",
        metrics: evaluation.metrics, constraints: evaluation.constraints,
        pareto: { status: "not_evaluated", reason: "policy_not_pass" },
        rank: { status: "unranked", reason: "policy_not_pass" }, order: 0,
      }],
    };
    const contentHash = calculateCommercialOverlayV1ContentHash(payload);
    const document = { ...payload, id: calculateCommercialOverlayV1Id(payload), contentHash };
    const verifier = createSnapshotAuthorizationVerifierV1({
      checkedAt: () => base.evaluatedAt,
      verifySignatureAndPolicy: () => [],
    });
    const context = {
      snapshots: [], authorizations: [], authorizationVerifier: verifier,
      authorizationOperation: verifier.authorizeOperation("user_local_storage", [], []),
    };
    expect(validateCommercialOverlayDesignBindingV1(result, document)).toEqual([]);
    expect(validateCommercialOverlayContextV1(result, document, context)).toEqual([]);
    const tampered = { ...document, candidates: [{ ...document.candidates[0]!, status: "compliant" as const }] };
    expect(validateCommercialOverlayDesignBindingV1(result, tampered)).not.toEqual([]);
  });

  it("reports design binding before a bad standalone authorization operation", () => {
    const result = oneCandidateResult();
    const base = overlay();
    const wrongPayload = {
      ...base,
      designResultRef: {
        ...base.designResultRef,
        designResultContentHash: hash("f"),
      },
    };
    const contentHash = calculateCommercialOverlayV1ContentHash(wrongPayload);
    const wrongBinding = {
      ...wrongPayload,
      id: calculateCommercialOverlayV1Id(wrongPayload),
      contentHash,
    };
    const verifier = createSnapshotAuthorizationVerifierV1({
      checkedAt: () => base.evaluatedAt,
      verifySignatureAndPolicy: () => [],
    });
    expect(validateCommercialOverlayContextV1(result, wrongBinding, {
      snapshots: [],
      authorizations: [],
      authorizationVerifier: verifier,
      authorizationOperation: {} as never,
    })).toContainEqual(expect.objectContaining({ path: "overlay.designResultRef" }));
  });

  it("rejects an authorization disconnected from an individual overlay in a valid union context", () => {
    const sourceResult = oneCandidateResult();
    const { contentHash: _sourceContentHash, ...sourcePayload } = sourceResult;
    const resultPayload: Omit<DesignResultV2, "contentHash"> = {
      ...sourcePayload,
      candidates: [],
    };
    const result = { ...resultPayload, contentHash: canonicalDesignResultV2ContentHash(resultPayload) };
    const part = { manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-1" };
    const snapshot = finalizeOfferSnapshotV2({
      schemaVersion: 2,
      provider: "digikey",
      requestedParts: [part],
      retrievedAt: "2026-08-24T00:00:00.000000000Z",
      expiresAt: "2026-08-24T01:00:00.000000000Z",
      persistence: "exportable",
      evaluationEligibility: "native_v2",
      status: "provider_error",
      errors: [{ catalogVersion: 1, code: "timeout", retryable: false }],
      offers: [],
      lineage: [],
    });
    const policyRef = { id: "policy:synthetic", version: "1", contentHash: hash("9") };
    const attribution = { provider: "digikey" as const, providerPolicy: policyRef, required: true, label: "Synthetic distributor" };
    const claims = {
      format: "schemagic-snapshot-authorization" as const,
      schemaVersion: 1 as const,
      snapshotRef: { id: snapshot.id, schemaVersion: 2 as const, contentHash: snapshot.contentHash },
      provider: "digikey" as const,
      providerPolicy: policyRef,
      attribution,
      executionMode: "self_hosted" as const,
      effectivePersistence: "exportable" as const,
      effectiveEvaluationEligibility: "native_v2" as const,
      authorizedUses: ["display", "download_export"] as Array<"display" | "download_export">,
      issuedAt: "2026-08-24T00:00:00.000000001Z",
      notAfter: null,
      issuerKeyId: "test:issuer-v1",
    };
    const authorizationHash = calculateSnapshotAuthorizationContentHashV1(claims);
    const authorization: SnapshotAuthorizationV1 = {
      ...claims,
      id: `snapshot-authorization:v1:${authorizationHash}`,
      contentHash: authorizationHash,
      signature: "A".repeat(86),
    };
    const makeOverlay = (hasSnapshot: boolean): CommercialOverlayV1 => {
      const { id: _id, contentHash: _contentHash, ...base } = overlay();
      const payload: Omit<CommercialOverlayV1, "id" | "contentHash"> = {
        ...base,
        persistence: "exportable",
        designResultRef: {
          schemaVersion: 2,
          designResultContentHash: result.contentHash,
          requestHash: result.requestHash,
          libraryVersion: result.libraryVersion,
          libraryContentHash: result.libraryContentHash,
          candidateSetHash: canonicalCommercialCandidateSetHashV1([]),
        },
        snapshotRefs: hasSnapshot ? [{ id: snapshot.id, schemaVersion: 2, contentHash: snapshot.contentHash }] : [],
        authorizationRefs: [snapshotAuthorizationRefV1(authorization)],
        attributions: [attribution],
      };
      const contentHash = calculateCommercialOverlayV1ContentHash(payload);
      return { ...payload, id: calculateCommercialOverlayV1Id(payload), contentHash };
    };
    const verifier = createSnapshotAuthorizationVerifierV1({
      checkedAt: () => "2026-08-24T00:30:00.000000000Z",
      verifySignatureAndPolicy: () => [],
    });
    const operation = verifier.authorizeOperation("download_export", [snapshot], [authorization]);
    expect(validateCommercialOverlaySetContextV1(result, [makeOverlay(false), makeOverlay(true)], {
      snapshots: [snapshot],
      authorizations: [authorization],
      authorizationVerifier: verifier,
      authorizationOperation: operation,
    }, "download_export")).toContainEqual(expect.objectContaining({
      path: "overlays.0.authorizations",
    }));
  });
});
