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
  migrateDesignRequestV1ToV2,
  type DesignResultV2,
  type ElectricalDesignRequestV2,
} from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  CandidatePrintableReportExportErrorV2,
  exportDesignResultPrintableReportV2,
  parseDesignResultPrintableReportV2,
} from "../src/index";

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
    const profile = Object.values(documents.profiles).find((entry: any) => (
      designProfileId(entry.partClass, entry.part) === ref.profileId
    )) as DesignProfileV1;
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
    version: "power-printable-report-test.1",
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
  return { result, candidate, exactContext };
}

function expectReportError(
  callback: () => unknown,
  code: CandidatePrintableReportExportErrorV2["code"],
): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(CandidatePrintableReportExportErrorV2);
    expect((error as CandidatePrintableReportExportErrorV2).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

describe("verified Designer V2 printable candidate report", () => {
  it("round-trips deterministic, complete engineering semantics without expansive claims", () => {
    const { result, candidate, exactContext } = fixture();
    const first = exportDesignResultPrintableReportV2(result, candidate.id, exactContext);
    const second = exportDesignResultPrintableReportV2(structuredClone(result), candidate.id, exactContext);
    const parsed = parseDesignResultPrintableReportV2(first, result, exactContext);

    expect(second).toBe(first);
    expect(first.startsWith("<!doctype html>\n<html lang=\"en\">\n")).toBe(true);
    expect(first.endsWith("</html>\n")).toBe(true);
    expect(first).not.toMatch(/<(?:script|link|iframe|img|object|embed)\b/iu);
    expect(first).not.toMatch(/\b(?:href|src)\s*=/iu);
    expect(first).toContain("No commercial, distributor, pricing, stock, or availability data is included.");
    expect(first).toContain("simulation attestation is <span class=\"mono\">none</span>");
    expect(first).toContain("Circuit materialization is structural only");
    expect(first).toContain("does not promote independent-review status");

    expect(parsed.provenance.request).toEqual(result.request);
    expect(parsed.provenance.requestHash).toBe(result.requestHash);
    expect(parsed.provenance.result.contentHash).toBe(result.contentHash);
    expect(parsed.provenance.library).toEqual({
      version: result.libraryVersion,
      contentHash: result.libraryContentHash,
    });
    expect(parsed.provenance.engineeringContextManifest).toEqual(exactContext.manifest);
    expect(parsed.provenance.candidate).toEqual({
      schemaVersion: candidate.schemaVersion,
      id: candidate.id,
      requestHash: candidate.requestHash,
      recipe: exactContext.manifest.recipes.find((entry) => entry.id === candidate.recipeId),
      libraryVersion: candidate.libraryVersion,
    });
    expect(parsed.electricalBom).toEqual(candidate.components);
    expect(parsed.derivedValues).toEqual(candidate.derivedValues);
    expect(parsed.representation).toEqual({
      circuitInstances: candidate.circuitInstanceClassifications,
      bomNonRepresentations: candidate.circuitBomNonRepresentations,
    });
    expect(parsed.constraints.map(({ evidenceReferenceState: _state, ...entry }) => entry))
      .toEqual(candidate.constraints);
    expect(parsed.constraints.every((entry) => entry.evidenceReferenceState === (
      entry.evidence.length > 0 ? "references_present" : "no_references"
    ))).toBe(true);
    expect(parsed.metrics).toEqual(candidate.metrics);
    expect(parsed.warnings).toEqual(candidate.warnings);
    expect(parsed.scenarioCoverage.map((entry) => entry.scenarioId)).toEqual(
      [...new Set([
        ...candidate.circuit.scenarios.map((entry) => entry.id),
        ...candidate.simulationCoverage.map((entry) => entry.scenarioId),
      ])].sort(),
    );
    expect(parsed.boundaries).toEqual({
      commercialData: "not_included",
      simulationData: "not_included",
      simulationAttestation: "none",
      circuitFidelity: "structural_only",
      physicalImplementation: "not_verified",
      independentReviewPromotion: "not_claimed_by_report",
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.electricalBom)).toBe(true);
    for (const component of candidate.components) {
      expect(first).toContain(component.part.manufacturerPartNumber);
      expect(first).toContain(component.profileId);
    }
    for (const constraint of candidate.constraints) {
      expect(first).toContain(constraint.ruleId);
      expect(first).toContain(constraint.explanation);
    }
  });

  it("rejects visible, canonical-metadata, resource, and extra-byte tampering", () => {
    const { result, candidate, exactContext } = fixture();
    const report = exportDesignResultPrintableReportV2(result, candidate.id, exactContext);

    expectReportError(
      () => parseDesignResultPrintableReportV2(
        report.replace("Complete electrical BOM", "Partial electrical BOM"),
        result,
        exactContext,
      ),
      "artifact_unverified",
    );
    expectReportError(
      () => parseDesignResultPrintableReportV2(
        report.replace('"commercialData":"not_included"', '"commercialData":"included"'),
        result,
        exactContext,
      ),
      "artifact_unverified",
    );
    expectReportError(
      () => parseDesignResultPrintableReportV2(
        report.replace(
          '<pre id="schemagic-printable-report-metadata-v2" hidden>{',
          '<pre id="schemagic-printable-report-metadata-v2" hidden>{ ',
        ),
        result,
        exactContext,
      ),
      "invalid_report",
    );
    expectReportError(
      () => parseDesignResultPrintableReportV2(
        report.replace(
          "<body>\n",
          '<body>\n<pre id="schemagic-printable-report-metadata-v2" hidden>{}</pre><!-- /schemagic-printable-report-metadata-v2 -->',
        ),
        result,
        exactContext,
      ),
      "invalid_report",
    );
    expectReportError(
      () => parseDesignResultPrintableReportV2(
        report.replace("<body>", "<body>\n<p>Injected</p>"),
        result,
        exactContext,
      ),
      "artifact_unverified",
    );
    expectReportError(
      () => parseDesignResultPrintableReportV2("x".repeat(32 * 1024 * 1024 + 1), result, exactContext),
      "resource_limit",
    );
    expectReportError(
      () => parseDesignResultPrintableReportV2("<html></html>", result, exactContext),
      "invalid_report",
    );
  });

  it("fails closed before export or verification for malformed authority or selection", () => {
    const { result, candidate, exactContext } = fixture();
    const report = exportDesignResultPrintableReportV2(result, candidate.id, exactContext);
    const invalidResult = {
      ...result,
      contentHash: `sha256:${"0".repeat(64)}` as DesignResultV2["contentHash"],
    };
    const wrongContext = { ...exactContext, manifest: { ...exactContext.manifest, version: "wrong" } };
    const unknownCandidate = `candidate:v2:sha256:${"9".repeat(64)}` as const;

    expectReportError(
      () => exportDesignResultPrintableReportV2(invalidResult, candidate.id, exactContext),
      "invalid_result",
    );
    expectReportError(
      () => exportDesignResultPrintableReportV2(result, candidate.id, wrongContext),
      "engineering_context_unverified",
    );
    expectReportError(
      () => exportDesignResultPrintableReportV2(result, unknownCandidate, exactContext),
      "candidate_not_found",
    );
    expectReportError(
      () => parseDesignResultPrintableReportV2(report, invalidResult, exactContext),
      "invalid_result",
    );
    expectReportError(
      () => parseDesignResultPrintableReportV2(report, result, wrongContext),
      "engineering_context_unverified",
    );
  });
});
