import { readFileSync } from "node:fs";
import { calculateDesignBlockContentHash } from "@opencircuit/circuit-schema";
import {
  canonicalDesignResultV2ContentHash,
  calculateCommercialOverlayV1ContentHash,
  calculateCommercialOverlayV1Id,
  canonicalCommercialCandidateSetHashV1,
  designRequestHashV2,
  migrateDesignRequestV1ToV2,
  type DesignRequestV1,
  type DesignResultV2,
  type CommercialOverlayV1,
} from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
  calculateSnapshotAuthorizationContentHashV1,
  createSnapshotAuthorizationVerifierV1,
  finalizeOfferSnapshotV2,
  type CommercialSnapshotContextV1,
  type OfferSnapshotV2,
  type SnapshotAuthorizationV1,
  type SnapshotAuthorizedUseV1,
  type SourcingPolicy,
} from "@opencircuit/sourcing-schema";
import {
  CandidateScenarioSpiceExportErrorV2,
  CandidateScenarioExportPlanErrorV2,
  CommercialDesignExportErrorV2,
  createDesignScenarioSimulationProvenanceV2,
  decodeBomTextCellV2,
  encodeSpiceCommentLinesV2,
  escapeBomTextCellV2,
  exportDesignResultScenarioSpiceV2,
  parseDesignExportBundleV2,
  planDesignResultScenarioExportsV2,
  parseDesignResultV2,
  serializeAuthorizedOfferSnapshotForLocalStorageV2,
  serializeAuthorizedOfferSnapshotForPublicShareV2,
  serializeAuthorizedOfferSnapshotV2,
  serializeCommercialOverlayForLocalStorageV1,
  serializeCommercialOverlayV1,
  serializeDesignResultV2,
  serializeDesignExportBundleForPublicShareV2,
  serializeDesignExportBundleV2,
} from "../src/index";
import { _bomJsonCellV2 } from "../src/bom-v2";

function emptyResult(): DesignResultV2 {
  const legacy = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/p1-compact.design-request.json", import.meta.url),
    "utf8",
  )) as DesignRequestV1;
  const migration = migrateDesignRequestV1ToV2(legacy, "designer-v2.empty", "area");
  if (migration.status !== "migrated") throw new Error("Fixture request did not migrate");
  const withoutHash: Omit<DesignResultV2, "contentHash"> = {
    format: "schemagic-design-result",
    schemaVersion: 2,
    request: migration.request,
    requestHash: designRequestHashV2(migration.request),
    libraryVersion: migration.request.libraryVersion,
    libraryContentHash: `sha256:${"1".repeat(64)}`,
    candidates: [],
    rejectedCandidates: [],
    diagnostics: ["design.no_supported_recipe"],
  };
  return { ...withoutHash, contentHash: canonicalDesignResultV2ContentHash(withoutHash) };
}

function scenarioResult(): DesignResultV2 {
  const base = emptyResult();
  const blockPayload = {
    id: "fixture-controller",
    version: "1",
    title: "Fixture controller",
    pins: [{ id: "gnd", name: "GND", offset: [0, 0] as [number, number] }],
    netlist: { kind: "schematic_only" as const, reason: "No reviewed executable model is pinned" },
  };
  const block = { ...blockPayload, contentHash: calculateDesignBlockContentHash(blockPayload) };
  const candidate: DesignResultV2["candidates"][number] = {
    schemaVersion: 2,
    id: `candidate:v2:sha256:${"2".repeat(64)}`,
    requestHash: base.requestHash,
    recipeId: "test.scenario-plan",
    libraryVersion: base.libraryVersion,
    components: [],
    derivedValues: [],
    constraints: [],
    metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
    simulationCoverage: [
      {
        scenarioId: "incomplete",
        modelTier: "unavailable",
        limitations: [
          "Controller block is schematic-only",
          '{"blockId":"fixture-controller","circuitId":"incomplete","code":"SCHEMATIC_ONLY_BLOCK_OMITTED","componentId":"u1","reason":"No reviewed executable model is pinned","scenarioId":"incomplete"}',
        ],
      },
      { scenarioId: "op", modelTier: "behavioral", limitations: ["Behavioral operating point only"] },
      { scenarioId: "startup", modelTier: "unavailable", limitations: ["No startup graph is authored"] },
    ],
    circuit: {
      format: "opencircuit-circuit",
      version: 2,
      meta: { title: "Scenario-plan fixture" },
      designBlocks: [block],
      circuits: [
        {
          id: "incomplete",
          title: "Incomplete control graph",
          components: [
            { id: "gnd", type: "ground", pos: [0, 0], rot: 0, mirror: false },
            { id: "u1", type: "design_block", block: { id: block.id, version: block.version, contentHash: block.contentHash }, pos: [10, 0], rot: 0, mirror: false },
          ],
          wires: [],
          probes: [],
        },
        {
          id: "main",
          title: "Operating-point graph",
          components: [{ id: "gnd", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
          wires: [],
          probes: [{ id: "output", kind: "voltage", target: { componentPin: ["gnd", 0] } }],
        },
      ],
      scenarios: [
        { id: "incomplete", title: "Incomplete controller", circuitId: "incomplete", config: { mode: "op" } },
        { id: "op", title: "Operating point", circuitId: "main", config: { mode: "op" } },
      ],
      defaultCircuitId: "main",
      defaultScenarioId: "op",
    },
    circuitInstanceClassifications: [
      { circuitId: "incomplete", componentId: "gnd", kind: "non_bom", reason: "Ground is not a BOM line" },
      { circuitId: "incomplete", componentId: "u1", kind: "non_bom", reason: "Schematic-only fixture block is not a BOM line" },
      { circuitId: "main", componentId: "gnd", kind: "non_bom", reason: "Ground is not a BOM line" },
    ],
    circuitBomNonRepresentations: [],
    warnings: [],
  };
  const payload: Omit<DesignResultV2, "contentHash"> = {
    ...base,
    candidates: [candidate],
    diagnostics: [],
  };
  const { contentHash: _contentHash, ...withoutHash } = payload as DesignResultV2;
  return { ...withoutHash, contentHash: canonicalDesignResultV2ContentHash(withoutHash) };
}

function decodeOneRfc4180Cell(cell: string): string {
  if (!cell.startsWith('"')) return cell;
  if (!cell.endsWith('"')) throw new Error("Malformed test cell");
  return cell.slice(1, -1).replaceAll('""', '"');
}

function expectSpiceErrorCode(
  callback: () => unknown,
  code: CandidateScenarioSpiceExportErrorV2["code"],
): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(CandidateScenarioSpiceExportErrorV2);
    expect((error as CandidateScenarioSpiceExportErrorV2).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

function expectPlanErrorCode(
  callback: () => unknown,
  code: "invalid_result" | "candidate_not_found",
): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(CandidateScenarioExportPlanErrorV2);
    expect((error as CandidateScenarioExportPlanErrorV2).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

function exportableSnapshot(): OfferSnapshotV2 {
  return finalizeOfferSnapshotV2({
    schemaVersion: OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
    provider: "digikey",
    requestedParts: [{ manufacturerId: "synthetic", manufacturerPartNumber: "SYN-1" }],
    retrievedAt: "2026-08-23T00:00:00.000Z",
    expiresAt: "2026-08-23T01:00:00.000Z",
    persistence: "exportable",
    evaluationEligibility: "native_v2",
    status: "complete",
    errors: [],
    offers: [],
    lineage: [],
  });
}

function authorizationFor(
  snapshot: OfferSnapshotV2,
  uses: SnapshotAuthorizedUseV1[],
): SnapshotAuthorizationV1 {
  const policy = { id: "policy:synthetic", version: "1", contentHash: `sha256:${"3".repeat(64)}` as const };
  const claims = {
    format: "schemagic-snapshot-authorization" as const,
    schemaVersion: 1 as const,
    snapshotRef: { id: snapshot.id, schemaVersion: 2 as const, contentHash: snapshot.contentHash },
    provider: snapshot.provider,
    providerPolicy: policy,
    attribution: { provider: snapshot.provider, providerPolicy: policy, required: true, label: "Synthetic distributor" },
    executionMode: "self_hosted" as const,
    effectivePersistence: snapshot.persistence,
    effectiveEvaluationEligibility: "native_v2" as const,
    authorizedUses: uses,
    issuedAt: snapshot.retrievedAt,
    notAfter: snapshot.persistence === "ephemeral" ? snapshot.expiresAt : null,
    issuerKeyId: "test:export-v1",
  };
  const contentHash = calculateSnapshotAuthorizationContentHashV1(claims);
  return {
    ...claims,
    id: `snapshot-authorization:v1:${contentHash}`,
    contentHash,
    signature: "A".repeat(86),
  };
}

function authorizedContext(
  snapshot: OfferSnapshotV2,
  authorization: SnapshotAuthorizationV1,
  use: SnapshotAuthorizedUseV1,
): CommercialSnapshotContextV1 {
  const verifier = createSnapshotAuthorizationVerifierV1({
    checkedAt: () => "2026-08-23T00:30:00.000Z",
    verifySignatureAndPolicy: () => [],
  });
  return {
    snapshots: [snapshot],
    authorizations: [authorization],
    authorizationVerifier: verifier,
    authorizationOperation: verifier.authorizeOperation(use, [snapshot], [authorization]),
  };
}

function emptyCommercialContext(use: SnapshotAuthorizedUseV1): CommercialSnapshotContextV1 {
  const verifier = createSnapshotAuthorizationVerifierV1({
    checkedAt: () => "2026-08-23T00:30:00.000Z",
    verifySignatureAndPolicy: () => [],
  });
  return {
    snapshots: [],
    authorizations: [],
    authorizationVerifier: verifier,
    authorizationOperation: verifier.authorizeOperation(use, [], []),
  };
}

function emptyOverlay(result: DesignResultV2, persistence: "user_local" | "exportable"): CommercialOverlayV1 {
  const policy: SourcingPolicy = {
    schemaVersion: 1,
    distributors: ["digikey"],
    mode: "any_selected",
    buildQuantity: 1,
    region: "US",
    currency: "USD",
    allowedLifecycle: ["active"],
    allowBackorder: false,
    allowMarketplace: false,
    maximumSnapshotAgeSeconds: 3600,
  };
  const withoutIdentity: Omit<CommercialOverlayV1, "id" | "contentHash"> = {
    format: "schemagic-commercial-overlay",
    schemaVersion: 1,
    persistence,
    designResultRef: {
      schemaVersion: 2,
      designResultContentHash: result.contentHash,
      requestHash: result.requestHash,
      libraryVersion: result.libraryVersion,
      libraryContentHash: result.libraryContentHash,
      candidateSetHash: canonicalCommercialCandidateSetHashV1([]),
    },
    policy,
    evaluatedAt: "2026-08-23T00:30:00.000Z",
    snapshotRefs: [],
    authorizationRefs: [],
    authorizationNotAfter: null,
    attributions: [],
    paretoCriteria: [],
    rankingCriteria: [],
    candidates: [],
  };
  return {
    ...withoutIdentity,
    id: calculateCommercialOverlayV1Id(withoutIdentity),
    contentHash: calculateCommercialOverlayV1ContentHash(withoutIdentity),
  };
}

describe("scheMAGIC Designer V2 export", () => {
  it("fails simulation provenance closed before samples when engineering context is unverified", async () => {
    const result = scenarioResult();
    await expect(createDesignScenarioSimulationProvenanceV2(
      result,
      result.candidates[0]!.id,
      "op",
      {} as never,
      { engineeringContext: {} as never, executionContext: {} },
    )).rejects.toMatchObject({ code: "engineering_context_unverified" });
  });

  it("plans each persisted scenario gate without validating or promoting execution", () => {
    const result = scenarioResult();
    const plan = planDesignResultScenarioExportsV2(result, result.candidates[0]!.id);

    expect(plan).toEqual({
      candidateId: result.candidates[0]!.id,
      entries: [
        {
          scenarioId: "incomplete",
          title: "Incomplete controller",
          circuitId: "incomplete",
          circuitTitle: "Incomplete control graph",
          analysisMode: "op",
          coverageTier: "unavailable",
          limitations: [
            "Controller block is schematic-only",
            '{"blockId":"fixture-controller","circuitId":"incomplete","code":"SCHEMATIC_ONLY_BLOCK_OMITTED","componentId":"u1","reason":"No reviewed executable model is pinned","scenarioId":"incomplete"}',
          ],
          isDefaultScenario: false,
          isDefaultCircuit: false,
          componentCount: 2,
          probeCount: 0,
          schematicOnlyInstanceCount: 1,
          spiceExportGate: "incomplete_export_requires_verified_context_and_opt_in",
        },
        {
          scenarioId: "op",
          title: "Operating point",
          circuitId: "main",
          circuitTitle: "Operating-point graph",
          analysisMode: "op",
          coverageTier: "behavioral",
          limitations: ["Behavioral operating point only"],
          isDefaultScenario: true,
          isDefaultCircuit: true,
          componentCount: 1,
          probeCount: 1,
          schematicOnlyInstanceCount: 0,
          spiceExportGate: "export_requires_verified_context",
        },
        {
          scenarioId: "startup",
          title: null,
          circuitId: null,
          circuitTitle: null,
          analysisMode: null,
          coverageTier: "unavailable",
          limitations: ["No startup graph is authored"],
          isDefaultScenario: false,
          isDefaultCircuit: false,
          componentCount: null,
          probeCount: null,
          schematicOnlyInstanceCount: null,
          spiceExportGate: "no_scenario",
        },
      ],
    });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.entries)).toBe(true);
    expect(Object.isFrozen(plan.entries[0]!.limitations)).toBe(true);
  });

  it("fails scenario planning closed for malformed results and unknown candidates", () => {
    const result = scenarioResult();
    expectPlanErrorCode(() => planDesignResultScenarioExportsV2(
      { ...result, contentHash: `sha256:${"0".repeat(64)}` },
      result.candidates[0]!.id,
    ), "invalid_result");
    expectPlanErrorCode(() => planDesignResultScenarioExportsV2(
      result,
      `candidate:v2:sha256:${"9".repeat(64)}`,
    ), "candidate_not_found");
  });

  it("strictly round-trips deterministic electrical result bytes", () => {
    const result = emptyResult();
    const first = serializeDesignResultV2(result);
    const second = serializeDesignResultV2(structuredClone(result));

    expect(second).toBe(first);
    expect(parseDesignResultV2(JSON.parse(first))).toEqual(result);
    expect(() => serializeDesignResultV2({ ...result, contentHash: `sha256:${"0".repeat(64)}` }))
      .toThrow();
  });

  it("reversibly escapes controls, backslashes, formula prefixes, and Unicode", () => {
    const allC0C1Del = String.fromCodePoint(
      ...Array.from({ length: 0x20 }, (_, index) => index),
      0x7f,
      ...Array.from({ length: 0x20 }, (_, index) => 0x80 + index),
    );
    const values = [
      "=x",
      "'=x",
      "''=x",
      "  +SUM(A1:A2)",
      "back\\slash",
      "nul\u0000del\u007fc1\u0085ls\u2028ps\u2029",
      "quote\" comma, newline\n",
      allC0C1Del,
      "Ω雪",
    ];
    const encoded = values.map(escapeBomTextCellV2);

    expect(new Set(encoded).size).toBe(values.length);
    expect(encoded.slice(0, 3)).toEqual(["'=x", "''=x", "'''=x"]);
    for (const [index, cell] of encoded.entries()) {
      expect(cell).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u);
      expect(decodeBomTextCellV2(decodeOneRfc4180Cell(cell))).toBe(values[index]);
    }
    expect(() => decodeBomTextCellV2("\\u0041")).toThrow("non-canonical");
    expect(() => decodeBomTextCellV2("\\x")).toThrow("malformed");
    expect(() => decodeBomTextCellV2("raw\u0000control")).toThrow("unescaped control");
  });

  it("keeps evidence and attribution JSON directly parseable without raw forbidden controls", () => {
    const forbidden = "\u007f\u0085\u009f\u2028\u2029";
    const literalEscapes = "\\u007F\\u0085\\u009F\\u2028\\u2029";
    const evidence = [{
      sourceId: `raw:${forbidden}`,
      locator: `literal:${literalEscapes}`,
      licenseNote: "existing newline escape:\n",
    }];
    const attributions = [{
      provider: "digikey",
      providerPolicy: {
        id: `literal:${literalEscapes}`,
        version: "1",
        contentHash: `sha256:${"4".repeat(64)}`,
      },
      required: true,
      label: `raw:${forbidden}`,
    }];

    const evidenceJson = decodeOneRfc4180Cell(_bomJsonCellV2(evidence));
    const attributionsJson = decodeOneRfc4180Cell(_bomJsonCellV2(attributions));
    expect(evidenceJson).toBe(
      `[{"licenseNote":"existing newline escape:\\n","locator":"literal:\\\\u007F\\\\u0085\\\\u009F\\\\u2028\\\\u2029","sourceId":"raw:\\u007F\\u0085\\u009F\\u2028\\u2029"}]`,
    );
    expect(attributionsJson).toBe(
      `[{"label":"raw:\\u007F\\u0085\\u009F\\u2028\\u2029","provider":"digikey","providerPolicy":{"contentHash":"sha256:${"4".repeat(64)}","id":"literal:\\\\u007F\\\\u0085\\\\u009F\\\\u2028\\\\u2029","version":"1"},"required":true}]`,
    );
    for (const json of [evidenceJson, attributionsJson]) {
      expect(json).not.toMatch(/[\u007f-\u009f\u2028\u2029]/u);
    }
    expect(JSON.parse(evidenceJson)).toEqual(evidence);
    expect(JSON.parse(attributionsJson)).toEqual(attributions);
  });

  it("encodes every injected physical SPICE line as a safe comment", () => {
    expect(encodeSpiceCommentLinesV2("limitation", "first\r\n.control\u0000\u0085.end\u2028last"))
      .toEqual([
        "* limitation first",
        "* limitation .control\\u{0}",
        "* limitation .end",
        "* limitation last",
      ]);
    expect(() => encodeSpiceCommentLinesV2("bad label", ".end")).toThrow("closed ASCII token");
  });

  it("fails closed before candidate or scenario lookup when engineering context is unverified", () => {
    const result = emptyResult();
    expectSpiceErrorCode(() => exportDesignResultScenarioSpiceV2(
      result,
      `candidate:v2:sha256:${"2".repeat(64)}`,
      "missing",
      { engineeringContext: {} as never, executionContext: {} },
    ), "engineering_context_unverified");
  });

  it("rejects malformed V2 results with a closed error before any context use", () => {
    const result: DesignResultV2 = { ...emptyResult(), contentHash: `sha256:${"0".repeat(64)}` };
    expectSpiceErrorCode(() => exportDesignResultScenarioSpiceV2(
      result,
      `candidate:v2:sha256:${"2".repeat(64)}`,
      "missing",
      { engineeringContext: {} as never, executionContext: {} },
    ), "invalid_result");
  });

  it("serializes authorized snapshots only for the exact operation and persistence target", () => {
    const snapshot = exportableSnapshot();
    const uses: SnapshotAuthorizedUseV1[] = ["display", "download_export", "public_share", "user_local_storage"];
    const authorization = authorizationFor(snapshot, uses);
    const downloadContext = authorizedContext(snapshot, authorization, "download_export");
    const localContext = authorizedContext(snapshot, authorization, "user_local_storage");
    const publicContext = authorizedContext(snapshot, authorization, "public_share");

    const first = serializeAuthorizedOfferSnapshotV2(snapshot, downloadContext);
    expect(serializeAuthorizedOfferSnapshotV2(structuredClone(snapshot), downloadContext)).toBe(first);
    expect(first.endsWith("\n")).toBe(true);
    expect(JSON.parse(first)).toEqual({
      format: "schemagic-authorized-offer-snapshot",
      schemaVersion: 2,
      snapshot,
      authorization,
    });
    expect(serializeAuthorizedOfferSnapshotForLocalStorageV2(snapshot, localContext)).toContain(snapshot.id);
    expect(serializeAuthorizedOfferSnapshotForPublicShareV2(snapshot, publicContext)).toContain(snapshot.id);
    expect(() => serializeAuthorizedOfferSnapshotV2(snapshot, localContext))
      .toThrow(expect.objectContaining({ code: "commercial_context_unverified" }));
  });

  it("rejects user-local snapshots from transferable snapshot serializers", () => {
    const base = exportableSnapshot();
    const snapshot = finalizeOfferSnapshotV2({
      schemaVersion: base.schemaVersion,
      provider: base.provider,
      requestedParts: base.requestedParts,
      retrievedAt: base.retrievedAt,
      expiresAt: base.expiresAt,
      persistence: "user_local",
      evaluationEligibility: base.evaluationEligibility,
      status: base.status,
      errors: base.errors,
      offers: base.offers,
      lineage: base.lineage,
    });
    const authorization = authorizationFor(snapshot, ["display", "download_export", "user_local_storage"]);
    const context = authorizedContext(snapshot, authorization, "download_export");
    try {
      serializeAuthorizedOfferSnapshotV2(snapshot, context);
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialDesignExportErrorV2);
      expect((error as CommercialDesignExportErrorV2).code).toBe("persistence_not_exportable");
      return;
    }
    throw new Error("Expected user-local snapshot export to fail");
  });

  it("gates overlay and bundle bytes by exact local, download, and public-share operations", () => {
    const result = emptyResult();
    const overlay = emptyOverlay(result, "exportable");
    const localContext = emptyCommercialContext("user_local_storage");
    const downloadContext = emptyCommercialContext("download_export");
    const publicContext = emptyCommercialContext("public_share");
    const bundle = {
      format: "schemagic-design-export" as const,
      schemaVersion: 2 as const,
      design: result,
      commercialOverlays: [overlay],
    };

    const overlayBytes = serializeCommercialOverlayV1(result, overlay, downloadContext);
    expect(serializeCommercialOverlayV1(result, structuredClone(overlay), downloadContext)).toBe(overlayBytes);
    expect(serializeCommercialOverlayForLocalStorageV1(result, overlay, localContext)).toBe(overlayBytes);
    expect(overlayBytes.endsWith("\n")).toBe(true);
    const bundleBytes = serializeDesignExportBundleV2(bundle, downloadContext);
    expect(parseDesignExportBundleV2(JSON.parse(bundleBytes))).toEqual(bundle);
    expect(serializeDesignExportBundleForPublicShareV2(bundle, publicContext)).toBe(bundleBytes);
    expect(() => serializeDesignExportBundleV2(bundle, publicContext))
      .toThrow(expect.objectContaining({ code: "commercial_context_unverified" }));
  });

  it("keeps user-local overlays out of downloads and transfer bundles", () => {
    const result = emptyResult();
    const overlay = emptyOverlay(result, "user_local");
    const localContext = emptyCommercialContext("user_local_storage");
    expect(serializeCommercialOverlayForLocalStorageV1(result, overlay, localContext)).toContain(overlay.id);
    expect(() => serializeCommercialOverlayV1(result, overlay, emptyCommercialContext("download_export")))
      .toThrow(expect.objectContaining({ code: "persistence_not_exportable" }));
    expect(() => parseDesignExportBundleV2({
      format: "schemagic-design-export",
      schemaVersion: 2,
      design: result,
      commercialOverlays: [overlay],
    })).toThrow(/not exportable/u);
  });
});
