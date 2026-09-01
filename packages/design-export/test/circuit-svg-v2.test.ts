import { readFileSync } from "node:fs";
import {
  admissionContentHash,
  designCatalogContentHash,
  designProfileContentHash,
  designProfileId,
  type DesignLibraryDocuments,
  type DesignProfileV1,
} from "@opencircuit/design-library";
import { createSyntheticReviewedLibraryFixture } from "@opencircuit/design-library/fixtures";
import { componentPinPointsV4 } from "@opencircuit/circuit-schema";
import {
  buildReviewedProfileCatalogV2,
  calculateElectricalDesignContextManifestV2ContentHash,
  calculateElectricalRankingPolicyV2ContentHash,
  generateElectricalDesignV2,
  getInstalledCompilerImplementationRefV2,
  getInstalledRecipeRefsV2,
  resolveInstalledRecipeRegistryV2,
  type ElectricalDesignContextManifestV2,
  type ElectricalRankingPolicyV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine";
import {
  calculateConstraintDecisionV3ContentHash,
  migrateDesignRequestV1ToV2,
  type ConstraintDecisionV3,
  type ElectricalDesignRequestV2,
} from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  CandidateCircuitSvgExportErrorV2,
  CandidateKicadSchematicExportErrorV2,
  ProductionConstraintObservationArtifactErrorV1,
  exportElectricalBomCsvV2,
  exportDesignResultCircuitSvgV2,
  exportDesignResultKicadSchematicV2,
  exportProductionDesignArtifactV2,
  parseDesignResultCircuitSvgV2,
  parseDesignResultKicadSchematicV2,
  verifyProductionConstraintObservationArtifactV1,
  type CandidateCircuitSvgMetadataV2,
} from "../src/index";
import { _renderCandidateCircuitSvgV2ForTest } from "../src/circuit-svg-v2";
import { csvWithRepeatedPrefixFitsByteLimitV1 } from "../src/csv-repeated-prefix-byte-limit-internal";

function refreshedDocuments(): DesignLibraryDocuments {
  const documents = structuredClone(createSyntheticReviewedLibraryFixture([
    "power.integrated-synchronous-buck-regulator",
    "power.power-inductor",
    "shared.mlcc-capacitor",
    "shared.general-purpose-resistor",
  ])) as any;
  const changes: Record<string, Record<string, number>> = {
    "power.integrated-synchronous-buck-regulator": {
      inputVoltageMaximum: 20,
      feedbackReference: 2.5,
      switchingFrequencyMaximum: 2_000_000,
    },
    "power.power-inductor": { saturationCurrent: 5, rmsCurrent: 5 },
    "shared.mlcc-capacitor": { ratedVoltage: 25 },
  };
  for (const profile of Object.values(documents.profiles) as DesignProfileV1[]) {
    const updates = changes[profile.partClass] ?? {};
    for (const [factId, value] of Object.entries(updates)) {
      const facts = profile.facts as Record<string, { value: { value: number } }>;
      facts[factId]!.value.value = value;
    }
  }
  for (const entry of documents.admission.entries) {
    const profile = documents.profiles[entry.profilePath] as DesignProfileV1;
    entry.profileContentHash = designProfileContentHash(profile);
  }
  documents.catalogRelease.admissionContentHash = admissionContentHash(documents.admission);
  for (const ref of documents.catalogRelease.profiles) {
    const profile = Object.values(documents.profiles).find((entry: any) => designProfileId(entry.partClass, entry.part) === ref.profileId) as DesignProfileV1;
    ref.profileContentHash = designProfileContentHash(profile);
  }
  documents.catalogRelease.contentHash = designCatalogContentHash(
    documents.manufacturerRegistry,
    documents.admission,
    Object.values(documents.profiles),
  );
  return documents;
}

function ranking(): ElectricalRankingPolicyV2 {
  const area = { source: "metric", metricId: "power.native.board-area", direction: "minimize" } as const;
  const count = { source: "metric", metricId: "power.native.component-count", direction: "minimize" } as const;
  const payload: Omit<ElectricalRankingPolicyV2, "contentHash"> = {
    format: "schemagic-electrical-ranking-policy",
    schemaVersion: 2,
    version: "power-svg-test.1",
    application: "power.buck",
    paretoCriteria: [area, count],
    rankingProfiles: {
      area: [area, count],
      balanced: [area, count],
      efficiency: [area, count],
      temperature: [area, count],
    },
  };
  return { ...payload, contentHash: calculateElectricalRankingPolicyV2ContentHash(payload) };
}

function context(documents: DesignLibraryDocuments): GenerateElectricalContextV2 {
  const policy = ranking();
  const catalog = buildReviewedProfileCatalogV2(documents);
  const payload: Omit<ElectricalDesignContextManifestV2, "contentHash"> = {
    format: "schemagic-electrical-design-context",
    schemaVersion: 2,
    version: catalog.version,
    application: "power.buck",
    compiler: getInstalledCompilerImplementationRefV2(),
    catalog: {
      version: catalog.version,
      contentHash: catalog.contentHash,
      sourceReleaseContentHash: catalog.sourceRelease.contentHash,
    },
    rankingPolicy: { version: policy.version, contentHash: policy.contentHash },
    recipes: [...getInstalledRecipeRefsV2("power.buck")],
  };
  const manifest = { ...payload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(payload) };
  const installedRecipeRegistry = resolveInstalledRecipeRegistryV2(manifest);
  if (installedRecipeRegistry === undefined) throw new Error("Expected exact installed recipe capability");
  return { manifest, catalogDocuments: documents, rankingPolicy: policy, installedRecipeRegistry };
}

function request(libraryVersion: string): ElectricalDesignRequestV2 {
  const source = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/p1-compact.design-request.json", import.meta.url),
    "utf8",
  ));
  const migrated = migrateDesignRequestV1ToV2(source, libraryVersion, "area");
  if (migrated.status !== "migrated") throw new Error("Expected migrated power request");
  const result = structuredClone(migrated.request);
  result.constraints.allowUnknownHardConstraints = true;
  return result;
}

function fixture() {
  const documents = refreshedDocuments();
  const exactContext = context(documents);
  const result = generateElectricalDesignV2(
    request((documents.catalogRelease as { version: string }).version),
    exactContext,
  ).result;
  const candidate = result.candidates[0];
  if (candidate === undefined) throw new Error("Expected a generated candidate");
  const circuit = candidate.circuit.circuits[0];
  if (circuit === undefined) throw new Error("Expected a generated circuit");
  return { result, candidate, circuit, exactContext };
}

function observationDecision(
  result: ReturnType<typeof fixture>["result"],
  exactContext: GenerateElectricalContextV2,
): ConstraintDecisionV3 {
  const candidates = [...result.candidates]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((candidate) => {
      const recipe = exactContext.manifest.recipes.find((entry) => entry.id === candidate.recipeId);
      if (recipe === undefined) throw new Error("Expected candidate recipe in exact context");
      return {
        candidateId: candidate.id,
        recipeId: candidate.recipeId,
        recipeContentHash: recipe.contentHash,
        sourceWarnings: [],
        rules: [
          {
            ruleId: "power.control.loop-stability",
            sourceStatus: "unknown" as const,
            truth: "unknown" as const,
            criticality: "safety" as const,
            disposition: "blocked_unknown" as const,
            policyRationale: "A reviewed stability proof is required.",
          },
          {
            ruleId: "power.regulator.current-limit",
            sourceStatus: "fail" as const,
            truth: "fail" as const,
            criticality: "safety" as const,
            disposition: "blocked_failure" as const,
            policyRationale: "Protection coordination must pass.",
          },
        ],
        eligible: false,
      };
    });
  const payload: Omit<ConstraintDecisionV3, "contentHash"> = {
    format: "schemagic-constraint-decision",
    schemaVersion: 3,
    source: {
      schemaVersion: 2,
      resultContentHash: result.contentHash,
      candidateIds: candidates.map((candidate) => candidate.candidateId),
    },
    policy: {
      constraintPolicy: "production_strict_v1",
      contentHash: `sha256:${"8".repeat(64)}`,
    },
    candidates,
    eligibleCandidateIds: [],
  };
  return { ...payload, contentHash: calculateConstraintDecisionV3ContentHash(payload) };
}

function rehashDecision(decision: ConstraintDecisionV3): ConstraintDecisionV3 {
  const { contentHash: _contentHash, ...payload } = decision;
  return { ...payload, contentHash: calculateConstraintDecisionV3ContentHash(payload) };
}

function expectObservationArtifactError(
  callback: () => unknown,
  code: ProductionConstraintObservationArtifactErrorV1["code"],
): void {
  try { callback(); }
  catch (error) {
    expect(error).toBeInstanceOf(ProductionConstraintObservationArtifactErrorV1);
    expect((error as ProductionConstraintObservationArtifactErrorV1).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

function expectSvgError(callback: () => unknown, code: CandidateCircuitSvgExportErrorV2["code"]): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(CandidateCircuitSvgExportErrorV2);
    expect((error as CandidateCircuitSvgExportErrorV2).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

describe("verified Designer V2 structural SVG", () => {
  it("round-trips deterministic graph, scenario, limitation, and provenance semantics", () => {
    const { result, candidate, circuit, exactContext } = fixture();
    const first = exportDesignResultCircuitSvgV2(result, candidate.id, circuit.id, exactContext);
    const second = exportDesignResultCircuitSvgV2(structuredClone(result), candidate.id, circuit.id, exactContext);
    const parsed = parseDesignResultCircuitSvgV2(first, result, exactContext);

    expect(second).toBe(first);
    expect(first.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')).toBe(true);
    expect(first.endsWith("</svg>\n")).toBe(true);
    expect(parsed.designResultRef).toEqual({
      contentHash: result.contentHash,
      requestHash: result.requestHash,
      libraryVersion: result.libraryVersion,
      libraryContentHash: result.libraryContentHash,
    });
    expect(parsed.candidateRef).toEqual({ id: candidate.id, recipeId: candidate.recipeId });
    expect(parsed.circuit).toEqual(circuit);
    expect(parsed.simulationDataState).toBe("not_included");
    expect(parsed.scenarios.every((entry) => entry.scenario.circuitId === circuit.id)).toBe(true);
    expect(parsed.scenarios.map((entry) => entry.coverage)).toEqual(
      candidate.circuit.scenarios
        .filter((scenario) => scenario.circuitId === circuit.id)
        .map((scenario) => candidate.simulationCoverage.find((coverage) => coverage.scenarioId === scenario.id)),
    );
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.circuit.components)).toBe(true);
    for (const component of circuit.components) {
      expect(first).toContain(`data-component-id="${component.id}"`);
      expect(first).toContain(`data-component-type="${component.type}"`);
    }
    for (const wire of circuit.wires) expect(first).toContain(`data-wire-id="${wire.id}"`);
    for (const probe of circuit.probes) expect(first).toContain(`Probe ${probe.id}: ${probe.kind}; target`);
    expect(first).toContain("Structural schematic · exact persisted V2 graph · no simulation results");
  });

  it("rejects any visible or semantic SVG drift instead of trusting embedded claims", () => {
    const { result, candidate, circuit, exactContext } = fixture();
    const svg = exportDesignResultCircuitSvgV2(result, candidate.id, circuit.id, exactContext);
    const componentId = circuit.components[0]!.id;

    expectSvgError(
      () => parseDesignResultCircuitSvgV2(
        svg.replace(`data-component-id="${componentId}"`, 'data-component-id="tampered"'),
        result,
        exactContext,
      ),
      "artifact_unverified",
    );
    expectSvgError(
      () => parseDesignResultCircuitSvgV2(svg.replace("structural_schematic", "simulated_schematic"), result, exactContext),
      "invalid_svg",
    );
    expectSvgError(() => parseDesignResultCircuitSvgV2("<svg/>", result, exactContext), "invalid_svg");
  });

  it("wraps maximum-sized display strings and explicitly keeps node-only probes textual", () => {
    const { result, candidate, circuit, exactContext } = fixture();
    const baseSvg = exportDesignResultCircuitSvgV2(result, candidate.id, circuit.id, exactContext);
    const metadata = structuredClone(
      parseDesignResultCircuitSvgV2(baseSvg, result, exactContext),
    ) as CandidateCircuitSvgMetadataV2;
    const longTitle = "T".repeat(16_000);
    const longLabel = "C".repeat(16_000);
    const longLimitation = "L".repeat(16_000);
    const longWarning = "W".repeat(16_000);
    metadata.circuit.title = longTitle;
    metadata.circuit.components[0]!.label = { text: longLabel, offset: [0, -3] };
    metadata.circuit.probes = [{ id: "node-only", kind: "voltage", target: { node: "logical-output" } }];
    metadata.scenarios = [{
      scenario: { id: "long-text", title: "Long text", circuitId: metadata.circuit.id, config: { mode: "op" } },
      coverage: { scenarioId: "long-text", modelTier: "unavailable", limitations: [longLimitation] },
    }];
    metadata.candidateWarnings = [longWarning];

    const svg = _renderCandidateCircuitSvgV2ForTest(metadata);
    const width = Number(svg.match(/<svg[^>]* width="([0-9]+)"/u)?.[1]);
    const height = Number(svg.match(/<svg[^>]* height="([0-9]+)"/u)?.[1]);
    const baseHeight = Number(baseSvg.match(/<svg[^>]* height="([0-9]+)"/u)?.[1]);
    const headerLines = [...svg.matchAll(/<text class="[^"]+" data-header-kind="[^"]+"[^>]*>([^<]*)<\/text>/gu)];
    const titleLines = [...svg.matchAll(/<text class="title" data-header-kind="title"[^>]*>([^<]*)<\/text>/gu)];
    const componentLabelLines = [...svg.matchAll(/<text class="component-label" data-component-text="label"[^>]*>([^<]*)<\/text>/gu)];

    expect(Number.isFinite(width)).toBe(true);
    expect(height).toBeGreaterThan(baseHeight);
    expect(titleLines.map((match) => match[1]).join("")).toBe(longTitle);
    expect(componentLabelLines.map((match) => match[1]).join("")).toContain(longLabel);
    const visibleHeaderText = headerLines.map((match) => match[1]).join("");
    expect(visibleHeaderText).toContain(longLimitation);
    expect(visibleHeaderText).toContain(longWarning);
    expect(visibleHeaderText).toContain("text only; node target has no persisted coordinate");
    expect(svg).not.toContain('data-probe-id="node-only"');
    for (const match of svg.matchAll(/<text[^>]* data-header-kind="[^"]+"[^>]* textLength="([0-9.]+)"/gu)) {
      expect(Number(match[1])).toBeLessThanOrEqual(width - 64);
    }
    for (const match of svg.matchAll(/<text class="component-(?:label|value)"[^>]* textLength="([0-9.]+)"/gu)) {
      expect(Number(match[1])).toBeLessThanOrEqual(14);
    }
  });

  it("stagger-renders adjacent default component labels with a readable geometry gap", () => {
    const { result, candidate, circuit, exactContext } = fixture();
    const baseSvg = exportDesignResultCircuitSvgV2(result, candidate.id, circuit.id, exactContext);
    const metadata = structuredClone(
      parseDesignResultCircuitSvgV2(baseSvg, result, exactContext),
    ) as CandidateCircuitSvgMetadataV2;
    metadata.circuit.components = [
      { id: "bulk-capacitor", type: "capacitor", value: 330e-6, pos: [16, 16], rot: 90, mirror: false },
      { id: "local-decoupling", type: "capacitor", value: 100e-9, pos: [24, 16], rot: 90, mirror: false },
    ];
    metadata.circuit.wires = [
      { id: "bulk-lead", points: [[16, 14], [16, 8]] },
      { id: "local-lead", points: [[24, 14], [24, 8]] },
      { id: "nearby-control", points: [[4, 12], [30, 12]] },
    ];
    metadata.circuit.probes = [];
    metadata.designBlocks = [];
    metadata.scenarios = [];
    metadata.candidateWarnings = [];

    const svg = _renderCandidateCircuitSvgV2ForTest(metadata);
    expect(_renderCandidateCircuitSvgV2ForTest(structuredClone(metadata))).toBe(svg);
    expect(svg).not.toContain('"label":');
    const textBounds = (componentId: string) => {
      const matches = [...svg.matchAll(new RegExp(`<text class="component-(label|value)"[^>]* data-component-id="${componentId}" x="([^"]+)" y="([^"]+)"[^>]* textLength="([^"]+)"`, "gu"))];
      if (matches.length !== 2) throw new Error(`Missing label geometry for ${componentId}`);
      const lines = matches.map((match) => ({
        kind: match[1],
        x: Number(match[2]),
        y: Number(match[3]),
        width: Number(match[4]),
      }));
      return {
        left: Math.min(...lines.map((line) => line.x - line.width / 2)),
        right: Math.max(...lines.map((line) => line.x + line.width / 2)),
        top: Math.min(...lines.map((line) => line.y - (line.kind === "label" ? .62 : .48))),
        bottom: Math.max(...lines.map((line) => line.y + .12)),
      };
    };
    const bulk = textBounds("bulk-capacitor");
    const local = textBounds("local-decoupling");
    const intersectsWire = (bounds: ReturnType<typeof textBounds>, wire: typeof metadata.circuit.wires[number]) => wire.points.slice(1).some((end, index) => {
      const start = wire.points[index]!;
      if (start[0] === end[0]) return start[0] >= bounds.left && start[0] <= bounds.right
        && Math.max(Math.min(start[1], end[1]), bounds.top) <= Math.min(Math.max(start[1], end[1]), bounds.bottom);
      if (start[1] === end[1]) return start[1] >= bounds.top && start[1] <= bounds.bottom
        && Math.max(Math.min(start[0], end[0]), bounds.left) <= Math.min(Math.max(start[0], end[0]), bounds.right);
      throw new Error("Test fixture wires must be orthogonal");
    });

    expect(bulk.right + .5 <= local.left || local.right + .5 <= bulk.left || bulk.bottom + .5 <= local.top || local.bottom + .5 <= bulk.top).toBe(true);
    expect(metadata.circuit.wires.some((wire) => intersectsWire(bulk, wire))).toBe(false);
    expect(metadata.circuit.wires.some((wire) => intersectsWire(local, wire))).toBe(false);
  });

  it("fails closed for malformed results, context drift, and unknown selections", () => {
    const { result, candidate, circuit, exactContext } = fixture();
    expectSvgError(
      () => exportDesignResultCircuitSvgV2(
        { ...result, contentHash: `sha256:${"0".repeat(64)}` },
        candidate.id,
        circuit.id,
        exactContext,
      ),
      "invalid_result",
    );
    expectSvgError(
      () => exportDesignResultCircuitSvgV2(result, candidate.id, circuit.id, {} as never),
      "engineering_context_unverified",
    );
    expectSvgError(
      () => exportDesignResultCircuitSvgV2(result, `candidate:v2:sha256:${"9".repeat(64)}`, circuit.id, exactContext),
      "candidate_not_found",
    );
    expectSvgError(
      () => exportDesignResultCircuitSvgV2(result, candidate.id, "missing-circuit", exactContext),
      "circuit_not_found",
    );
  });
});

describe("production constraint-observation CSV/SVG boundary", () => {
  it("leaves ordinary V2 CSV and SVG bytes exactly on their established renderers", () => {
    const { result, candidate, exactContext } = fixture();
    const csv = exportProductionDesignArtifactV2(result, candidate.id, "electrical_bom_csv", {
      engineeringContext: exactContext,
    });
    const svg = exportProductionDesignArtifactV2(result, candidate.id, "structural_svg", {
      engineeringContext: exactContext,
    });

    expect(csv.content).toBe(exportElectricalBomCsvV2(result, candidate.id, exactContext));
    expect(svg.content).toBe(exportDesignResultCircuitSvgV2(
      result,
      candidate.id,
      candidate.circuit.defaultCircuitId,
      exactContext,
    ));
    expect(csv.content).not.toContain("observation_only");
    expect(svg.content).not.toContain("OBSERVATION ONLY");
  });

  it("inseparably records exact candidate policy state in deterministic CSV and accessible SVG", () => {
    const { result, candidate, exactContext } = fixture();
    const decision = observationDecision(result, exactContext);
    const artifacts = [
      exportProductionDesignArtifactV2(result, candidate.id, "electrical_bom_csv", {
        engineeringContext: exactContext,
        constraintDecision: decision,
      }),
      exportProductionDesignArtifactV2(result, candidate.id, "structural_svg", {
        engineeringContext: exactContext,
        constraintDecision: decision,
      }),
    ] as const;

    for (const artifact of artifacts) {
      const metadata = verifyProductionConstraintObservationArtifactV1(
        artifact,
        result,
        candidate.id,
        exactContext,
        decision,
      );
      expect(metadata).toMatchObject({
        format: "schemagic-production-constraint-observation-artifact-metadata",
        schemaVersion: 1,
        artifactKind: artifact.kind,
        provenance: {
          result: { contentHash: result.contentHash },
          candidate: {
            id: candidate.id,
            recipeId: candidate.recipeId,
          },
          constraintDecision: {
            contentHash: decision.contentHash,
            policy: decision.policy,
            eligible: false,
            blockedFailureCount: 1,
            blockedUnknownCount: 1,
            blockedRuleIds: [
              "power.control.loop-stability",
              "power.regulator.current-limit",
            ],
          },
        },
        claimBoundary: {
          purpose: "production_constraint_observation",
          eligibilityState: "exact_decision_recorded_not_inferred",
          simulationData: "not_included",
        },
      });
      expect(Object.isFrozen(metadata)).toBe(true);
    }

    const csv = artifacts[0].content;
    expect(csv).toMatch(/^artifact_boundary,candidate_policy_state,constraint_decision_content_hash,constraint_policy_content_hash,blocked_failure_count,blocked_unknown_count,blocked_rule_ids_json,canonical_observation_metadata_json,/u);
    expect(csv).toContain(`observation_only,ineligible,${decision.contentHash},${decision.policy.contentHash},1,1,`);
    expect(csv).toContain("power.control.loop-stability");
    expect(csv).toContain("power.regulator.current-limit");
    for (const row of exportElectricalBomCsvV2(result, candidate.id, exactContext).trimEnd().split("\n").slice(1)) {
      expect(csv).toContain(`,${row}`);
    }

    const svg = artifacts[1].content;
    expect(svg.match(/id="schemagic-production-constraint-observation-artifact-metadata-v1"/gu)).toHaveLength(1);
    expect(svg).toContain("OBSERVATION ONLY");
    expect(svg).toContain("Eligibility: INELIGIBLE · blocked failures: 1 · blocked unknowns: 1");
    expect(svg).toContain("Blocked rules: power.control.loop-stability, power.regulator.current-limit");
    expect(svg).toContain(`Decision hash: ${decision.contentHash}`);
    expect(svg).toContain(`Policy: production_strict_v1 · ${decision.policy.contentHash}`);
    expect(svg).toContain("<desc id=\"schemagic-description\">OBSERVATION ONLY. INELIGIBLE.");
    expectSvgError(() => parseDesignResultCircuitSvgV2(svg, result, exactContext), "invalid_svg");
  });

  it("fails closed on decision, source, candidate recipe, artifact, or unsupported-kind drift", () => {
    const { result, candidate, exactContext } = fixture();
    const decision = observationDecision(result, exactContext);
    const exportCsv = (input: ConstraintDecisionV3) => exportProductionDesignArtifactV2(
      result,
      candidate.id,
      "electrical_bom_csv",
      { engineeringContext: exactContext, constraintDecision: input },
    );

    expectObservationArtifactError(
      () => exportCsv({ ...decision, contentHash: `sha256:${"0".repeat(64)}` }),
      "invalid_decision",
    );
    const sourceDrift = structuredClone(decision);
    sourceDrift.source.resultContentHash = `sha256:${"1".repeat(64)}`;
    expectObservationArtifactError(() => exportCsv(rehashDecision(sourceDrift)), "decision_source_mismatch");
    const recipeIdDrift = structuredClone(decision);
    recipeIdDrift.candidates.find((entry) => entry.candidateId === candidate.id)!.recipeId = "power.forged-recipe";
    expectObservationArtifactError(() => exportCsv(rehashDecision(recipeIdDrift)), "recipe_mismatch");
    const recipeHashDrift = structuredClone(decision);
    recipeHashDrift.candidates.find((entry) => entry.candidateId === candidate.id)!.recipeContentHash = `sha256:${"2".repeat(64)}`;
    expectObservationArtifactError(() => exportCsv(rehashDecision(recipeHashDrift)), "recipe_mismatch");
    expectObservationArtifactError(
      () => exportProductionDesignArtifactV2(result, candidate.id, "scenario_spice", {
        engineeringContext: exactContext,
        executionContext: {},
        scenarioId: candidate.circuit.defaultScenarioId ?? "unused-observation-scenario",
        constraintDecision: decision,
      }),
      "unsupported_kind",
    );

    const artifact = exportCsv(decision);
    expectObservationArtifactError(
      () => verifyProductionConstraintObservationArtifactV1(
        { ...artifact, content: artifact.content.replace("observation_only,ineligible", "observation_only,eligible") },
        result,
        candidate.id,
        exactContext,
        decision,
      ),
      "artifact_unverified",
    );
    expectObservationArtifactError(
      () => verifyProductionConstraintObservationArtifactV1(
        { ...artifact, unexpected: true },
        result,
        candidate.id,
        exactContext,
        decision,
      ),
      "artifact_unverified",
    );
  });

  it("rejects an oversized repeated CSV metadata prefix before concatenating BOM rows", () => {
    const prefix = `observation_only,ineligible,${"a".repeat(320_000)}`;
    const rows = Array.from({ length: 64 }, (_, index) => `line-${index}`);
    expect(csvWithRepeatedPrefixFitsByteLimitV1(
      "artifact_boundary,line_id\n",
      rows,
      prefix,
      16 * 1024 * 1024,
    )).toBe(false);
    expect(csvWithRepeatedPrefixFitsByteLimitV1(
      "artifact_boundary,line_id\n",
      rows.slice(0, 2),
      prefix,
      16 * 1024 * 1024,
    )).toBe(true);
  });

  it("keeps internal resource preflight off the public observation-artifact subpath", async () => {
    const publicModule = await import("../src/production-artifact-v2");
    expect(Object.keys(publicModule).sort()).toEqual([
      "ProductionConstraintObservationArtifactErrorV1",
      "exportProductionDesignArtifactV2",
      "exportProductionPowerPhysicalHandoffArtifactV2",
      "verifyProductionConstraintObservationArtifactV1",
    ]);
  });
});

function expectKicadError(
  callback: () => unknown,
  code: CandidateKicadSchematicExportErrorV2["code"],
): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(CandidateKicadSchematicExportErrorV2);
    expect((error as CandidateKicadSchematicExportErrorV2).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

describe("verified Designer V2 structural KiCad schematic", () => {
  it("round-trips deterministic project-authored symbols, exact nets, fields, contexts, and boundaries", () => {
    const { result, candidate, circuit, exactContext } = fixture();
    const options = { engineeringContext: exactContext, executionContext: {} } as const;
    const first = exportDesignResultKicadSchematicV2(result, candidate.id, circuit.id, options);
    const second = exportDesignResultKicadSchematicV2(structuredClone(result), candidate.id, circuit.id, options);
    const parsed = parseDesignResultKicadSchematicV2(first, result, options);

    expect(second).toBe(first);
    expect(first.startsWith("(kicad_sch\n  (version 20231120)\n  (generator \"schemagic\")")).toBe(true);
    expect(first.endsWith(")\n")).toBe(true);
    expect(first).toMatch(/\(paper "User" [0-9.]+ [0-9.]+\)/u);
    expect(first).not.toContain('(text "schemagic_metadata_v2:');
    expect(first).toContain('(property "scheMAGIC Metadata V2" "schemagic_metadata_v2:');
    expect(first.match(/\(property "scheMAGIC Metadata V2"/gu)).toHaveLength(1);
    expect(first).toMatch(/\(text "scheMAGIC structural-only schematic;[^\n]+\(justify left\)/u);
    expect(first).toMatch(/\(label "(?:GND|SM_NET_[0-9]{3})"[^\n]+\(justify (?:left|right)\)/u);
    // KiCad 8's 20231120 writer fixtures use these forms even though the
    // generic S-expression documentation describes the tokens more broadly.
    expect(first).toContain('(effects (font (size 1.27 1.27)) (hide yes))');
    expect(first).toMatch(/\(uuid "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"\)/u);
    expect(parsed.designResultRef.contentHash).toBe(result.contentHash);
    expect(parsed.engineeringContextRef).toEqual({
      manifestVersion: exactContext.manifest.version,
      manifestContentHash: exactContext.manifest.contentHash,
    });
    expect(parsed.candidateRef).toEqual({ id: candidate.id, recipeId: candidate.recipeId });
    expect(parsed.circuit).toEqual(circuit);
    expect(parsed.kicadFormat).toMatchObject({
      extension: ".kicad_sch",
      generator: "schemagic",
      symbols: "project_authored",
      externalOpenVerification: "unverified",
    });
    expect(parsed.fidelity).toEqual({
      circuit: "exact_persisted_v2_structure",
      simulationData: "not_included",
      physicalModel: "not_claimed",
      footprintMapping: "unavailable",
    });
    expect(parsed.connectivityEncoding).toEqual({
      electrical: "local_labels_from_exact_point_union",
      wireGeometry: "project_authored_graphical_polylines",
    });
    expect(parsed.components.map((entry) => entry.componentId)).toEqual(
      [...circuit.components].map((entry) => entry.id).sort(),
    );
    expect(new Set(parsed.components.map((entry) => entry.reference)).size).toBe(parsed.components.length);
    for (const exported of parsed.components) {
      const component = circuit.components.find((entry) => entry.id === exported.componentId)!;
      expect(exported.footprint).toBe("");
      expect(exported.pins.map((pin) => pin.point)).toEqual(componentPinPointsV4(component, candidate.circuit.designBlocks));
      expect(exported.pins.every((pin) => /^(?:GND|SM_NET_[0-9]{3})$/u.test(pin.netLabel))).toBe(true);
      expect(first).toContain(`(lib_id ${JSON.stringify(exported.libraryId)})`);
      expect(first).toContain(`(property "Reference" ${JSON.stringify(exported.reference)}`);
      expect(first).toContain(`(property "Value" ${JSON.stringify(exported.value)}`);
    }
    expect(parsed.wires.map((wire) => ({ id: wire.wireId, points: wire.points }))).toEqual(
      [...circuit.wires].sort((left, right) => left.id.localeCompare(right.id)).map((wire) => ({ id: wire.id, points: wire.points })),
    );
    expect(first).toContain('(property "Footprint" ""');
    expect(first).not.toContain('(generator "eeschema")');
    expect(first).not.toMatch(/\(lib_id "(?:Device|power|Simulation_SPICE):/u);
    expect(parsed.visibleNotices).toContain(
      "Footprint mapping unavailable: every Footprint field is intentionally empty; package names are not KiCad footprint identities.",
    );
    expect(parsed.visibleNotices).toContain(
      "External KiCad open verification: UNVERIFIED; no kicad-cli result is attached to this artifact.",
    );
    for (const notice of parsed.visibleNotices) expect(first).toContain(JSON.stringify(notice.slice(0, 96)));
    expect(parsed.scenarios.every((entry) => /^sha256:[0-9a-f]{64}$/u.test(entry.execution.netlistContentHash))).toBe(true);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.components[0]?.pins)).toBe(true);
  });

  it("rejects reference, value, footprint, connectivity, geometry, metadata, and syntax drift", () => {
    const { result, candidate, circuit, exactContext } = fixture();
    const options = { engineeringContext: exactContext, executionContext: {} } as const;
    const file = exportDesignResultKicadSchematicV2(result, candidate.id, circuit.id, options);
    const parsed = parseDesignResultKicadSchematicV2(file, result, options);
    const component = parsed.components[0]!;
    const pin = component.pins[0]!;
    const mutations = [
      file.replace(`(property "Reference" ${JSON.stringify(component.reference)}`, '(property "Reference" "R999"'),
      file.replace(`(property "Value" ${JSON.stringify(component.value)}`, '(property "Value" "tampered"'),
      file.replace('(property "Footprint" ""', '(property "Footprint" "Package_SO:Invented"'),
      file.replace(`(label ${JSON.stringify(pin.netLabel)}`, '(label "SM_NET_999"'),
      file.replace("(rectangle (start ", "(rectangle (start 999 "),
      file.replace(result.contentHash, `sha256:${"0".repeat(64)}`),
    ];
    for (const mutation of mutations) {
      expect(mutation).not.toBe(file);
      expectKicadError(() => parseDesignResultKicadSchematicV2(mutation, result, options), "artifact_unverified");
    }
    expectKicadError(() => parseDesignResultKicadSchematicV2("(kicad_sch", result, options), "invalid_kicad_schematic");
    expectKicadError(() => parseDesignResultKicadSchematicV2("(not_kicad)\n", result, options), "invalid_kicad_schematic");
  });

  it("fails closed for malformed results, context drift, and unknown selections", () => {
    const { result, candidate, circuit, exactContext } = fixture();
    const options = { engineeringContext: exactContext, executionContext: {} } as const;
    expectKicadError(
      () => exportDesignResultKicadSchematicV2(
        { ...result, contentHash: `sha256:${"0".repeat(64)}` },
        candidate.id,
        circuit.id,
        options,
      ),
      "invalid_result",
    );
    expectKicadError(
      () => exportDesignResultKicadSchematicV2(result, candidate.id, circuit.id, {
        engineeringContext: {} as never,
        executionContext: {},
      }),
      "engineering_context_unverified",
    );
    expectKicadError(
      () => exportDesignResultKicadSchematicV2(
        result,
        `candidate:v2:sha256:${"9".repeat(64)}`,
        circuit.id,
        options,
      ),
      "candidate_not_found",
    );
    expectKicadError(
      () => exportDesignResultKicadSchematicV2(result, candidate.id, "missing-circuit", options),
      "circuit_not_found",
    );
  });
});
