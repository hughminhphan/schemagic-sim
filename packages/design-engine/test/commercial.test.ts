import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canonicalDesignResultV2ContentHash,
  calculateCommercialOverlayV1ContentHash,
  calculateCommercialOverlayV1Id,
  canonicalCommercialCandidateSetHashV1,
  designRequestHashV2,
  migrateDesignRequestV1ToV2,
  validateCommercialOverlayContextForUseV1,
  validateCommercialOverlayContextV1,
  type CommercialOverlayV1,
  type DesignResultV2,
} from "@opencircuit/design-schema";
import { createSnapshotAuthorizationVerifierV1 } from "@opencircuit/sourcing-schema";
import {
  CommercialOverlayGenerationErrorV1,
  evaluateCommercialViewV2,
  generateCommercialOverlayV1,
} from "../src";
import { _safeCommercialEvaluatorOutputForTesting } from "../src/commercial";

function validEmptyResult(): DesignResultV2 {
  const source = JSON.parse(readFileSync(new URL("../../design-schema/test/fixtures/requests/p1-compact.design-request.json", import.meta.url), "utf8"));
  const migration = migrateDesignRequestV1ToV2(source, source.libraryVersion);
  if (migration.status !== "migrated") throw new Error("Expected request migration");
  const payload: Omit<DesignResultV2, "contentHash"> = {
    format: "schemagic-design-result",
    schemaVersion: 2,
    request: migration.request,
    requestHash: designRequestHashV2(migration.request),
    libraryVersion: migration.request.libraryVersion,
    libraryContentHash: (`sha256:${"1".repeat(64)}`) as `sha256:${string}`,
    candidates: [],
    rejectedCandidates: [],
    diagnostics: [],
  };
  return { ...payload, contentHash: canonicalDesignResultV2ContentHash(payload) };
}

function errorCode(callback: () => unknown): string | undefined {
  try { callback(); return undefined; }
  catch (error) { return error instanceof CommercialOverlayGenerationErrorV1 ? error.code : "wrong-error"; }
}

function emptyOverlay(result: DesignResultV2, persistence: "user_local" | "exportable" = "user_local"): CommercialOverlayV1 {
  const payload: Omit<CommercialOverlayV1, "id" | "contentHash"> = {
    format: "schemagic-commercial-overlay", schemaVersion: 1, persistence,
    designResultRef: {
      schemaVersion: 2, designResultContentHash: result.contentHash, requestHash: result.requestHash,
      libraryVersion: result.libraryVersion, libraryContentHash: result.libraryContentHash,
      candidateSetHash: canonicalCommercialCandidateSetHashV1([]),
    },
    policy: {
      schemaVersion: 1, distributors: ["digikey"], mode: "any_selected", buildQuantity: 1,
      region: "US", currency: "USD", allowedLifecycle: ["active"], allowBackorder: false,
      allowMarketplace: false, maximumSnapshotAgeSeconds: 60,
    },
    evaluatedAt: "2026-08-24T00:00:00.000Z", snapshotRefs: [], authorizationRefs: [],
    authorizationNotAfter: null, attributions: [], paretoCriteria: [], rankingCriteria: [], candidates: [],
  };
  const contentHash = calculateCommercialOverlayV1ContentHash(payload);
  return { ...payload, id: calculateCommercialOverlayV1Id(payload), contentHash };
}

describe("commercial engine boundary", () => {
  it("rejects an invalid electrical result before reading hostile context", () => {
    let reads = 0;
    const context = new Proxy({}, { get() { reads += 1; throw new Error("secret"); } });
    expect(errorCode(() => evaluateCommercialViewV2({} as DesignResultV2, context as never))).toBe("invalid_design_result");
    expect(reads).toBe(0);
  });

  it("rejects malformed commercial context before engineering verification or evaluation", () => {
    let calls = 0;
    const context = {
      policy: {}, snapshots: [], authorizations: [], paretoCriteria: [], rankingCriteria: [],
      evaluateSourcing: () => { calls += 1; throw new Error("must not run"); },
    };
    expect(errorCode(() => generateCommercialOverlayV1(validEmptyResult(), { ...context, persistenceTarget: "user_local" } as never))).toBe("invalid_context");
    expect(calls).toBe(0);
  });

  it("rejects an own __proto__ context field before engineering verification", () => {
    const result = validEmptyResult();
    const verifier = createSnapshotAuthorizationVerifierV1({
      checkedAt: () => "2026-08-24T00:00:00.000Z",
      verifySignatureAndPolicy: () => [],
    });
    const policy = { ...emptyOverlay(result).policy };
    Object.defineProperty(policy, "__proto__", {
      value: { apiKey: "SECRET" }, enumerable: true,
    });
    let engineeringReads = 0;
    const context = {
      policy,
      snapshots: [],
      authorizations: [],
      authorizationVerifier: verifier,
      authorizationOperation: verifier.authorizeOperation("display", [], []),
      paretoCriteria: [],
      rankingCriteria: [],
      get engineeringContext() { engineeringReads += 1; throw new Error("must not read"); },
    };
    expect(errorCode(() => evaluateCommercialViewV2(result, context as never))).toBe("invalid_context");
    expect(engineeringReads).toBe(0);
  });

  it("classifies returned accessors and Proxy inspection traps without invoking accessors", () => {
    let getterCalls = 0;
    let setterCalls = 0;
    const getter = {};
    Object.defineProperty(getter, "value", {
      enumerable: true,
      get() { getterCalls += 1; return "secret"; },
    });
    const setter = {};
    Object.defineProperty(setter, "value", {
      enumerable: true,
      set(_value: unknown) { setterCalls += 1; },
    });
    expect(() => _safeCommercialEvaluatorOutputForTesting(getter)).toThrow("accessor");
    expect(() => _safeCommercialEvaluatorOutputForTesting(setter)).toThrow("accessor");
    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
    expect(() => _safeCommercialEvaluatorOutputForTesting(new Proxy({}, {
      ownKeys() { throw new Error("secret inspection failure"); },
    }))).toThrow("accessor");
  });

  it("sanitizes public commercial errors", () => {
    const error = new CommercialOverlayGenerationErrorV1("evaluator_threw", [{ path: "evaluateSourcing", message: "Commercial evaluator threw" }]);
    expect(error.message).not.toContain("provider");
    expect(Object.isFrozen(error.issues)).toBe(true);
    expect(error.code).toBe("evaluator_threw");
  });

  it("validates historical overlays with a fresh operation and supports explicit local storage use", () => {
    const result = validEmptyResult();
    const verifier = createSnapshotAuthorizationVerifierV1({
      checkedAt: () => "2026-08-24T01:00:00.000Z",
      verifySignatureAndPolicy: () => [],
    });
    const operation = verifier.authorizeOperation("user_local_storage", [], []);
    const context = { snapshots: [], authorizations: [], authorizationVerifier: verifier, authorizationOperation: operation };
    expect(validateCommercialOverlayContextV1(result, emptyOverlay(result), context)).toEqual([]);
    expect(validateCommercialOverlayContextForUseV1(result, emptyOverlay(result, "exportable"), context, "user_local_storage")).toEqual([]);
    expect(validateCommercialOverlayContextForUseV1(result, emptyOverlay(result), context, "download_export"))
      .toContainEqual(expect.objectContaining({ path: "overlay.persistence" }));
  });
});
