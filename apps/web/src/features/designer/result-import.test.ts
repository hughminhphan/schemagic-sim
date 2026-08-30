import {
  canonicalDesignV2Payload,
  canonicalDesignResultV2ContentHash,
  designSha256ContentHash,
  designRequestHashV2,
  migrateDesignRequestV1ToV2,
  type DesignResultV2,
  type Sha256ContentHash,
} from "@opencircuit/design-schema";
import { serializeDesignResultV1, serializeDesignResultV2 } from "@opencircuit/design-export";
import { generateMotorDesign } from "@opencircuit/motor-designer";
import { M1_COMPACT_REQUEST } from "@opencircuit/motor-designer/fixtures";
import { SYNTHETIC_SOURCING_FIXTURES } from "@opencircuit/sourcing-schema/fixtures";
import { deflateSync } from "fflate";
import { describe, expect, it } from "vitest";
import { renderImportedResult } from "./ImportedResultView";
import {
  ImportedDesignResultError,
  LEGACY_INLINE_SOURCING_EXPORT_REASON,
  importedResultHasLegacyInlineSourcing,
  parseImportedDesignResultText,
  serializeImportedDesignResult,
} from "./ResultImport";
import {
  SCENARIO_GATE_PLAN_MAX_BYTES,
  ScenarioGatePlanExportErrorV2,
  parseScenarioGatePlanV2,
  serializeScenarioGatePlanV2,
} from "./ResultExport";
import {
  DESIGN_RESULT_SHARE_MAX_ENCODED_CHARACTERS,
  DESIGN_RESULT_SHARE_MAX_UNCOMPRESSED_BYTES,
  ImportedDesignResultShareError,
  decodeImportedDesignResultShare,
  encodeImportedDesignResultShare,
  importedDesignResultShareFromHash,
  importedDesignResultShareUrl,
} from "./ResultShare";

function hash(character: string): Sha256ContentHash {
  return `sha256:${character.repeat(64)}` as Sha256ContentHash;
}

function emptyV2Result(): DesignResultV2 {
  const migration = migrateDesignRequestV1ToV2(M1_COMPACT_REQUEST, "motor-library-v2");
  if (migration.status !== "migrated") throw new Error("Expected request migration");
  const payload: Omit<DesignResultV2, "contentHash"> = {
    format: "schemagic-design-result",
    schemaVersion: 2,
    request: migration.request,
    requestHash: designRequestHashV2(migration.request),
    libraryVersion: migration.request.libraryVersion,
    libraryContentHash: hash("a"),
    candidates: [],
    rejectedCandidates: [],
    diagnostics: ["design.no_supported_recipe"],
  };
  return { ...payload, contentHash: canonicalDesignResultV2ContentHash(payload) };
}

function scenarioV2Result(): DesignResultV2 {
  const base = emptyV2Result();
  const candidate: DesignResultV2["candidates"][number] = {
    schemaVersion: 2,
    id: `candidate:v2:${hash("c")}`,
    requestHash: base.requestHash,
    recipeId: "fixture.scenario-inspection",
    libraryVersion: base.libraryVersion,
    components: [],
    derivedValues: [],
    constraints: [],
    metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
    simulationCoverage: [
      { scenarioId: "op", modelTier: "behavioral", limitations: ["Behavioral operating point only"] },
      { scenarioId: "startup", modelTier: "unavailable", limitations: ["No startup graph is authored"] },
    ],
    circuit: {
      format: "opencircuit-circuit",
      version: 2,
      meta: { title: "Scenario inspection fixture" },
      designBlocks: [],
      circuits: [{
        id: "main",
        title: "Behavioral operating-point graph",
        components: [{ id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
        wires: [],
        probes: [],
      }],
      scenarios: [{ id: "op", title: "Operating point", circuitId: "main", config: { mode: "op" } }],
      defaultCircuitId: "main",
      defaultScenarioId: "op",
    },
    circuitInstanceClassifications: [{ circuitId: "main", componentId: "ground", kind: "non_bom", reason: "Ground is not a BOM line" }],
    circuitBomNonRepresentations: [],
    warnings: [],
  };
  const { contentHash: _contentHash, ...payload } = base;
  const withCandidate = { ...payload, candidates: [candidate], diagnostics: [] };
  return { ...withCandidate, contentHash: canonicalDesignResultV2ContentHash(withCandidate) };
}

describe("persisted result import", () => {
  it("keeps sourcing-free V1 artifacts audit-only while allowing canonical legacy JSON", () => {
    const source = serializeDesignResultV1(generateMotorDesign(structuredClone(M1_COMPACT_REQUEST)));
    const imported = parseImportedDesignResultText(source);

    expect(imported.trust).toBe("legacy_v1_audit_only");
    expect(importedResultHasLegacyInlineSourcing(imported)).toBe(false);
    expect(imported.result.schemaVersion).toBe(1);
    expect(serializeImportedDesignResult(imported)).toBe(source);
    const html = renderImportedResult(imported, imported.result.candidates[0]?.id);
    expect(html).toContain("LEGACY V1 · AUDIT ONLY");
    expect(html).toContain("contains no inline sourcing");
    expect(html).toContain("Canonical legacy design JSON");
    expect(html).toContain("Electrical BOM CSV");
    expect(html).toContain("Scenario SPICE");
    expect(html).toContain("Scenario gate plan unavailable");
    expect(html).toContain("requires strict V2 circuit and scenario structure");
    expect(html).not.toContain('data-imported-export="scenario-gate-plan"');
    expect(html).toContain("Simulation CSV");
    expect(html).toContain("Commercial export");
    expect(html).toContain("Open in Simulator");
    expect(html.match(/ disabled/g)?.length).toBeGreaterThanOrEqual(5);
    expect(html).not.toContain("data-production-export=");
    expect(html).not.toContain("data-production-schematic-preview");
    expect(html).not.toContain("data-imported-pin");
    expect(html).not.toContain("data-pinned-comparison");
    expect(html).not.toContain("data-production-execution-ledger");
    expect(html).not.toContain("data-lcsc-search");
    expect(html).not.toContain("data-production-evidence-dossier");
  });

  it("disables every V1 JSON export path when any candidate has inline sourcing", () => {
    const result = structuredClone(generateMotorDesign(structuredClone(M1_COMPACT_REQUEST)));
    result.candidates[0]!.sourcing = SYNTHETIC_SOURCING_FIXTURES.staleSnapshot!.metrics;
    const imported = parseImportedDesignResultText(serializeDesignResultV1(result));

    expect(importedResultHasLegacyInlineSourcing(imported)).toBe(true);
    expect(() => serializeImportedDesignResult(imported)).toThrow(LEGACY_INLINE_SOURCING_EXPORT_REASON);
    const html = renderImportedResult(imported, imported.result.candidates[0]?.id);
    expect(html).toContain("contains inline sourcing without an authorized V2 commercial context");
    expect(html).toContain("Legacy JSON export unavailable");
    expect(html).toContain(LEGACY_INLINE_SOURCING_EXPORT_REASON);
    expect(html).not.toContain('data-imported-export="json"');
    expect(html).not.toContain("data-imported-share");
    expect(() => encodeImportedDesignResultShare(imported, imported.result.candidates[0]?.id))
      .toThrow(new ImportedDesignResultShareError("commercial_data_forbidden"));
  });

  it("labels hash-valid V2 as structural-only and preserves the no-recipe diagnostic", () => {
    const source = serializeDesignResultV2(emptyV2Result());
    const imported = parseImportedDesignResultText(source);

    expect(imported.trust).toBe("structurally_valid");
    expect(imported.result.schemaVersion).toBe(2);
    expect(serializeImportedDesignResult(imported)).toBe(source);
    const html = renderImportedResult(imported, undefined);
    expect(html).toContain("STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED");
    expect(html).toContain("design.no_supported_recipe");
    expect(html).toContain("no supported production recipe produced a candidate");
    expect(html).toContain("Electrical design JSON");
    expect(html).not.toContain("data-imported-regenerate-production");
    expect(html).not.toContain("viable");

    const regeneratableHtml = renderImportedResult(
      imported,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      new Set(),
      "",
      true,
      false,
    );
    expect(regeneratableHtml).toContain("Regenerate with installed context");
    expect(regeneratableHtml).toContain("data-imported-regenerate-production");
  });

  it("rejects caller-authored V3 decision fields and envelopes from the V1/V2 import boundary", () => {
    const result = emptyV2Result();
    const withDecision = {
      ...JSON.parse(serializeDesignResultV2(result)) as Record<string, unknown>,
      constraintDecision: {
        format: "schemagic-constraint-decision",
        schemaVersion: 3,
      },
    };
    const envelope = {
      result,
      constraintDecision: withDecision.constraintDecision,
    };

    expect(() => parseImportedDesignResultText(JSON.stringify(withDecision)))
      .toThrow(new ImportedDesignResultError("invalid_result"));
    expect(() => parseImportedDesignResultText(JSON.stringify(envelope)))
      .toThrow(new ImportedDesignResultError("invalid_result"));
  });

  it("maps V2 coverage through named scenarios and keeps every execution/export gate explicit", () => {
    const source = serializeDesignResultV2(scenarioV2Result());
    const imported = parseImportedDesignResultText(source);
    const candidate = imported.result.candidates[0]!;
    const defaultHtml = renderImportedResult(imported, candidate.id);

    expect(defaultHtml).toContain("Scenario workspace");
    expect(defaultHtml).toContain("COVERAGE → SCENARIO → GRAPH → ANALYSIS");
    expect(defaultHtml).toMatch(/data-imported-scenario="op"[^>]*aria-pressed="true"/u);
    expect(defaultHtml).toMatch(/data-imported-scenario="startup"[^>]*aria-pressed="false"/u);
    expect(defaultHtml).toContain("Behavioral operating-point graph");
    expect(defaultHtml).toContain('data-imported-export="scenario-gate-plan"');
    expect(defaultHtml).toContain("Scenario gate plan JSON");
    expect(defaultHtml).toContain("hash-bound structural metadata only");
    expect(defaultHtml).toContain("prohibited from candidate ranking");
    expect(defaultHtml).toContain("Structural SVG");
    expect(defaultHtml).toContain("Engineering report HTML");
    expect(defaultHtml).toContain("KiCad schematic");
    expect(defaultHtml).toContain("Behavioral claim, not execution proof");
    expect(defaultHtml).toContain("Verified contexts + receipt required");
    expect(defaultHtml).toContain("byte integrity, not independent execution attestation");
    expect(defaultHtml).toContain("Simulation CSV");
    expect(defaultHtml).not.toContain("data-production-export=");
    expect(defaultHtml).not.toContain("data-production-schematic-preview");
    expect(defaultHtml).not.toContain("data-imported-pin");
    expect(defaultHtml).not.toContain("data-pinned-comparison");
    expect(defaultHtml).not.toContain("data-production-execution-ledger");
    expect(defaultHtml).not.toContain("data-lcsc-search");
    expect(defaultHtml).not.toContain("data-production-evidence-dossier");
    expect(defaultHtml).not.toContain("Run simulation");

    const demonstrationHtml = renderImportedResult(imported, candidate.id, undefined, undefined, {
      code: "M1",
      title: "Structural demonstration",
      topology: "Behavioral graph",
      artifactContentHash: imported.result.schemaVersion === 2 ? imported.result.contentHash : hash("f"),
    }, false, undefined, new Set([candidate.id]));
    expect(demonstrationHtml).not.toContain("data-imported-pin");
    expect(demonstrationHtml).not.toContain("data-pinned-comparison");
    expect(demonstrationHtml).not.toContain("data-production-execution-ledger");
    expect(demonstrationHtml).not.toContain("data-lcsc-search");
    expect(demonstrationHtml).not.toContain("data-production-evidence-dossier");

    const unavailableHtml = renderImportedResult(imported, candidate.id, undefined, "startup");
    expect(unavailableHtml).toMatch(/data-imported-scenario="startup"[^>]*aria-pressed="true"/u);
    expect(unavailableHtml).toContain("No same-ID circuit scenario exists");
    expect(unavailableHtml).toContain("This is a display-only coverage record and cannot produce SPICE or simulation-data bytes.");
    expect(unavailableHtml).toContain("No executable scenario");

    const encoded = encodeImportedDesignResultShare(imported, candidate.id, "startup");
    const restored = decodeImportedDesignResultShare(encoded);
    expect(restored.imported).toEqual(imported);
    expect(restored.selectedCandidateId).toBe(candidate.id);
    expect(restored.selectedScenarioId).toBe("startup");
    const url = importedDesignResultShareUrl(imported, candidate.id, "startup", { href: "https://example.test/?designer" });
    expect(importedDesignResultShareFromHash(new URL(url).hash)).toEqual(restored);
  });

  it("round-trips exact structural scenario-gate bytes without adding trust or executable data", () => {
    const result = scenarioV2Result();
    const candidate = result.candidates[0]!;
    const source = serializeScenarioGatePlanV2(result, candidate.id);
    const parsed = parseScenarioGatePlanV2(source, result);
    const { contentHash: _contentHash, ...payload } = parsed;

    expect(serializeScenarioGatePlanV2(structuredClone(result), candidate.id)).toBe(source);
    expect(source).toBe(canonicalDesignV2Payload(JSON.parse(source)));
    expect(parsed.contentHash).toBe(designSha256ContentHash(canonicalDesignV2Payload(payload)));
    expect(parsed.designResultRef).toEqual({
      contentHash: result.contentHash,
      requestHash: result.requestHash,
      libraryVersion: result.libraryVersion,
      libraryContentHash: result.libraryContentHash,
    });
    expect(parsed.plan).toEqual({
      candidateId: candidate.id,
      entries: [
        expect.objectContaining({ scenarioId: "op", spiceExportGate: "export_requires_verified_context" }),
        expect.objectContaining({ scenarioId: "startup", spiceExportGate: "no_scenario" }),
      ],
    });
    expect(parsed.boundaries).toEqual({
      engineeringContext: "not_present",
      executionContext: "not_present",
      commercialData: "not_included",
      spiceNetlist: "not_included",
      simulationData: "not_included",
      simulationAttestation: "none",
      physicalImplementation: "not_verified",
      candidateRankingUse: "prohibited",
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.plan.entries)).toBe(true);
    expect(source).not.toContain('"circuit":');
    expect(source).not.toContain('"samples":');
  });

  it("rejects noncanonical, tampered, wrong-result, unknown-candidate, and oversized gate plans", () => {
    const result = scenarioV2Result();
    const candidate = result.candidates[0]!;
    const source = serializeScenarioGatePlanV2(result, candidate.id);
    const tampered = JSON.parse(source) as {
      plan: { entries: Array<{ spiceExportGate: string }> };
    };
    tampered.plan.entries[0]!.spiceExportGate = "no_scenario";

    expect(() => parseScenarioGatePlanV2(canonicalDesignV2Payload(tampered), result))
      .toThrow(new ScenarioGatePlanExportErrorV2("invalid_artifact"));
    expect(() => parseScenarioGatePlanV2(`${source}\n`, result))
      .toThrow(new ScenarioGatePlanExportErrorV2("invalid_artifact"));
    expect(() => parseScenarioGatePlanV2(source, { ...result, contentHash: hash("0") }))
      .toThrow(new ScenarioGatePlanExportErrorV2("invalid_result"));
    expect(() => serializeScenarioGatePlanV2(result, `candidate:v2:${hash("9")}`))
      .toThrow(new ScenarioGatePlanExportErrorV2("candidate_not_found"));
    expect(() => parseScenarioGatePlanV2("x".repeat(SCENARIO_GATE_PLAN_MAX_BYTES + 1), result))
      .toThrow(new ScenarioGatePlanExportErrorV2("resource_limit"));
  });

  it("fails closed on noncanonical, duplicated, tampered, and invalid-selection result shares", () => {
    const imported = parseImportedDesignResultText(serializeDesignResultV2(scenarioV2Result()));
    const candidate = imported.result.candidates[0]!;
    const encoded = encodeImportedDesignResultShare(imported, candidate.id, "op");

    expect(() => decodeImportedDesignResultShare(`${encoded}A`))
      .toThrow(ImportedDesignResultShareError);
    expect(() => importedDesignResultShareFromHash(`#d=${encoded}&d=${encoded}`))
      .toThrow(new ImportedDesignResultShareError("invalid_share"));
    expect(() => importedDesignResultShareFromHash(`#d=${encoded}&extra=1`))
      .toThrow(new ImportedDesignResultShareError("invalid_share"));
    expect(() => encodeImportedDesignResultShare(imported, "candidate:v2:missing", "op"))
      .toThrow(new ImportedDesignResultShareError("invalid_share"));
    expect(() => encodeImportedDesignResultShare(imported, candidate.id, "missing"))
      .toThrow(new ImportedDesignResultShareError("invalid_share"));
    expect(() => decodeImportedDesignResultShare("A".repeat(DESIGN_RESULT_SHARE_MAX_ENCODED_CHARACTERS + 1)))
      .toThrow(new ImportedDesignResultShareError("resource_limit"));
    const expansionBomb = deflateSync(new TextEncoder().encode(
      "x".repeat(DESIGN_RESULT_SHARE_MAX_UNCOMPRESSED_BYTES + 1),
    ), { level: 9 });
    expect(() => decodeImportedDesignResultShare(Buffer.from(expansionBomb).toString("base64url")))
      .toThrow(new ImportedDesignResultShareError("resource_limit"));
  });

  it("uses closed errors for malformed JSON, bad hashes, and parser resource limits", () => {
    expect(() => parseImportedDesignResultText("{not json"))
      .toThrow(new ImportedDesignResultError("invalid_json"));

    const badHash = JSON.parse(serializeDesignResultV2(emptyV2Result())) as Record<string, unknown>;
    badHash.contentHash = hash("0");
    expect(() => parseImportedDesignResultText(JSON.stringify(badHash)))
      .toThrow(new ImportedDesignResultError("invalid_result"));

    const tooManySetMembers = JSON.parse(serializeDesignResultV2(emptyV2Result())) as {
      request: { constraints: { allowedPackages: string[] } };
    };
    tooManySetMembers.request.constraints.allowedPackages = Array.from({ length: 257 }, (_, index) => `P${index}`);
    expect(() => parseImportedDesignResultText(JSON.stringify(tooManySetMembers)))
      .toThrow(new ImportedDesignResultError("resource_limit"));
  });
});
