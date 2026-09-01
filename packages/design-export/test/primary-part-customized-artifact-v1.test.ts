import { readFileSync } from "node:fs";
import {
  calculateConstraintDecisionV3ContentHash,
  canonicalDesignResultV2ContentHash,
  canonicalDesignV2Payload,
  canonicalElectricalDesignRequestV2Payload,
  createPrimaryPartCustomizationSidecarV1,
  createPrimaryPartCustomizedResultSidecarV1,
  designRequestHashV2,
  designSha256ContentHash,
  migrateDesignRequestV1ToV2,
  parseDesignResultV2,
  type ConstraintDecisionV3,
  type DesignCandidateV2,
  type DesignResultV2,
  type PrimaryPartCustomizedResultDraftV1,
  type PrimaryPartCustomizedResultSidecarV1,
  type Sha256ContentHash,
} from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  generateMotorDesignV2,
  getMotorDesignContextV2,
} from "@opencircuit/motor-designer/v2";
import {
  generateMotorPrimaryPartCustomizedResultV1,
  listMotorPrimaryPartCustomizationTargetsV1,
} from "@opencircuit/motor-designer/v3";
import {
  decodeBomTextCellV2,
  exportElectricalBomCsvV2,
} from "../src/index";
import { csvWithRepeatedPrefixFitsByteLimitV1 } from "../src/csv-repeated-prefix-byte-limit-internal";
import * as rootPublicSurface from "../src/index";
import * as circuitSvgPublicSurface from "../src/circuit-svg-v2-public";
import * as customizedArtifactPublicSurface from "../src/primary-part-customized-artifact-v1-public";
import * as kicadPublicSurface from "../src/kicad-schematic-v2-public";
import * as printablePublicSurface from "../src/printable-report-v2-public";
import {
  PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1,
  PrimaryPartCustomizedArtifactErrorV1,
  exportPrimaryPartCustomizedArtifactV1,
  verifyPrimaryPartCustomizedArtifactV1,
  type PrimaryPartCustomizedInstalledArtifactKindV1,
  type PrimaryPartCustomizedReplayableArtifactKindV1,
} from "../src/primary-part-customized-artifact-v1";
import {
  _encodePrimaryPartCustomizedSpiceMetadataCommentsV1,
  _exportPrimaryPartCustomizedInstalledArtifactV1,
  _verifyPrimaryPartCustomizedInstalledArtifactV1,
  type PrimaryPartCustomizedInstalledRenderContextV1,
} from "../src/primary-part-customized-installed-artifact-v1";
import { parseDesignResultCircuitSvgV2 } from "../src/circuit-svg-v2-public";
import {
  CandidateScenarioSpiceExportErrorV2,
  _assertBehavioralScenarioSpiceGateV2,
  _renderBehavioralScenarioSpiceV2FromProjection,
  exportDesignResultScenarioSpiceV2,
} from "../src/spice-v2";
import {
  exportDesignResultKicadSchematicV2,
  parseDesignResultKicadSchematicV2,
} from "../src/kicad-schematic-v2-public";
import {
  exportDesignResultPrintableReportV2,
  parseDesignResultPrintableReportV2,
} from "../src/printable-report-v2-public";

const hash = (character: string): Sha256ContentHash => (
  `sha256:${character.repeat(64)}` as Sha256ContentHash
);
const candidateId = (character: string) => `candidate:v2:${hash(character)}` as const;

function request() {
  const source = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/m1-compact.design-request.json", import.meta.url),
    "utf8",
  ));
  const migration = migrateDesignRequestV1ToV2(source, "reviewed-release");
  if (migration.status !== "migrated" || migration.request.application !== "motor.brushed-dc") {
    throw new Error("Expected a migrated Motor request");
  }
  return migration.request;
}

function targetCandidate(
  requestHash: Sha256ContentHash,
  manufacturerPartNumber = "TARGET",
): DesignCandidateV2 {
  return {
    schemaVersion: 2,
    id: candidateId("2"),
    requestHash,
    recipeId: "motor.native.integrated",
    libraryVersion: "reviewed-release",
    components: [{
      id: "primary",
      role: "motor-driver",
      profileId: "packages/design-library/parts/motor.integrated-h-bridge/vendor/TARGET.json",
      part: { manufacturerId: "vendor", manufacturerPartNumber },
      quantityPerAssembly: 1,
      evidence: [],
    }],
    derivedValues: [],
    constraints: [],
    metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
    simulationCoverage: [],
    circuit: {
      format: "opencircuit-circuit",
      version: 4,
      meta: { title: "Customized target projection" },
      designBlocks: [],
      circuits: [{
        id: "main",
        title: "Customized target projection",
        components: [{ id: "ground", type: "ground", pos: [0, 0], rot: 0, mirror: false }],
        wires: [],
        probes: [],
      }],
      scenarios: [],
      defaultCircuitId: "main",
      defaultScenarioId: null,
    },
    circuitInstanceClassifications: [{
      circuitId: "main",
      componentId: "ground",
      kind: "non_bom",
      reason: "Ground is not a BOM line.",
    }],
    circuitBomNonRepresentations: [{
      circuitId: "main",
      selectedComponentId: "primary",
      reason: "Fixture does not author a physical target instance.",
    }],
    warnings: [],
  };
}

function customizedResult(options: Readonly<{
  eligible?: boolean;
  manufacturerPartNumber?: string;
}> = {}): PrimaryPartCustomizedResultSidecarV1 {
  const boundRequest = request();
  const instructionRequestHash = designRequestHashV2(boundRequest);
  const candidate = targetCandidate(instructionRequestHash, options.manufacturerPartNumber);
  const resultWithoutHash: Omit<DesignResultV2, "contentHash"> = {
    format: "schemagic-design-result",
    schemaVersion: 2,
    request: boundRequest,
    requestHash: instructionRequestHash,
    libraryVersion: "reviewed-release",
    libraryContentHash: hash("3"),
    candidates: [candidate],
    rejectedCandidates: [],
    diagnostics: [],
  };
  const targetResultProjection: DesignResultV2 = {
    ...resultWithoutHash,
    contentHash: canonicalDesignResultV2ContentHash(resultWithoutHash),
  };
  parseDesignResultV2(targetResultProjection);
  const policyHash = hash("4");
  const recipeHash = hash("5");
  const eligible = options.eligible ?? false;
  const decisionPayload: Omit<ConstraintDecisionV3, "contentHash"> = {
    format: "schemagic-constraint-decision",
    schemaVersion: 3,
    source: {
      schemaVersion: 2,
      resultContentHash: targetResultProjection.contentHash,
      candidateIds: [candidate.id],
    },
    policy: { constraintPolicy: "production_strict_v1", contentHash: policyHash },
    candidates: [{
      candidateId: candidate.id,
      recipeId: candidate.recipeId,
      recipeContentHash: recipeHash,
      sourceWarnings: [],
      rules: [{
        ruleId: "motor.safety",
        sourceStatus: eligible ? "pass" : "unknown",
        truth: eligible ? "pass" : "unknown",
        criticality: "safety",
        disposition: eligible ? "satisfied" : "blocked_unknown",
        policyRationale: eligible
          ? "Reviewed safety evidence satisfies this fixture rule."
          : "Unknown safety evidence blocks eligibility.",
      }],
      eligible,
    }],
    eligibleCandidateIds: eligible ? [candidate.id] : [],
  };
  const constraintDecision: ConstraintDecisionV3 = {
    ...decisionPayload,
    contentHash: calculateConstraintDecisionV3ContentHash(decisionPayload),
  };
  const instruction = createPrimaryPartCustomizationSidecarV1({
    format: "schemagic-designer-primary-part-customization",
    schemaVersion: 1,
    application: "motor.brushed-dc",
    requestHash: instructionRequestHash,
    requestByteContentHash: designSha256ContentHash(
      canonicalElectricalDesignRequestV2Payload(boundRequest),
    ),
    sourceResultContentHash: hash("6"),
    sourceCandidateId: candidateId("1"),
    context: {
      libraryVersion: "reviewed-release",
      contextManifestContentHash: hash("3"),
      catalog: {
        version: "reviewed-release",
        contentHash: hash("7"),
        sourceReleaseContentHash: hash("8"),
      },
      recipe: { id: candidate.recipeId, version: "1", contentHash: recipeHash },
      constraintPolicy: { id: "production_strict_v1", contentHash: policyHash },
    },
    substitution: {
      role: "primary",
      sourceProfile: {
        profileId: "packages/design-library/parts/motor.integrated-h-bridge/vendor/SOURCE.json",
        contentHash: hash("9"),
      },
      targetProfile: {
        profileId: candidate.components[0]!.profileId,
        contentHash: hash("a"),
      },
    },
  });
  const draft: PrimaryPartCustomizedResultDraftV1 = {
    format: "schemagic-designer-primary-part-customized-result",
    schemaVersion: 1,
    application: "motor.brushed-dc",
    instruction,
    source: {
      resultContentHash: instruction.sourceResultContentHash,
      executionReportContentHash: hash("b"),
      candidateId: instruction.sourceCandidateId,
    },
    contextManifestContentHash: hash("3"),
    targetResultProjection,
    constraintDecision,
    claimBoundary: {
      ordinaryGenerationMutation: "none",
      targetConstraintPolicyEligibility: "evaluated",
      ranking: "not_recomputed",
      selectedPartModel: "not_added",
      commercialAuthority: "not_added",
    },
  };
  return createPrimaryPartCustomizedResultSidecarV1(draft);
}

interface InstalledCustomizedFixture {
  readonly sidecar: PrimaryPartCustomizedResultSidecarV1;
  readonly context: PrimaryPartCustomizedInstalledRenderContextV1;
  readonly scenarioId: string;
  readonly ordinaryResult: DesignResultV2;
  readonly ordinaryCandidateId: DesignCandidateV2["id"];
}

let installedCustomizedFixtureCache: InstalledCustomizedFixture | undefined;

function installedCustomizedFixture(): InstalledCustomizedFixture {
  if (installedCustomizedFixtureCache !== undefined) return installedCustomizedFixtureCache;
  const engineeringContext = getMotorDesignContextV2();
  const source = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/m1-compact.design-request.json", import.meta.url),
    "utf8",
  ));
  const migration = migrateDesignRequestV1ToV2(source, engineeringContext.manifest.version);
  if (migration.status !== "migrated" || migration.request.application !== "motor.brushed-dc") {
    throw new Error("Expected an installed-context Motor request");
  }
  const installedRequest = structuredClone(migration.request);
  installedRequest.constraints.allowUnknownHardConstraints = true;
  installedRequest.requirements.stallCurrent.value = 3;
  if (installedRequest.requirements.motorModel.windingResistance !== null) {
    installedRequest.requirements.motorModel.windingResistance.value = 4;
  }
  const generation = generateMotorDesignV2(installedRequest);
  const sourceCandidate = generation.result.candidates.find((candidate) => (
    candidate.recipeId === "motor.native.integrated-h-bridge.facts-v3-2"
    && candidate.components.some((component) => component.id === "primary")
  ));
  if (sourceCandidate === undefined) throw new Error("Expected an installed integrated Motor candidate");
  const targets = listMotorPrimaryPartCustomizationTargetsV1(generation, sourceCandidate.id);
  for (const target of targets) {
    const sidecar = generateMotorPrimaryPartCustomizedResultV1(target.instruction, generation);
    const candidate = sidecar.targetResultProjection.candidates[0]!;
    const scenarioId = candidate.circuit.defaultScenarioId;
    if (scenarioId !== null && candidate.simulationCoverage.some((entry) => (
      entry.scenarioId === scenarioId && entry.modelTier === "behavioral"
    ))) {
      installedCustomizedFixtureCache = Object.freeze({
        sidecar,
        scenarioId,
        ordinaryResult: generation.result,
        ordinaryCandidateId: sourceCandidate.id,
        context: Object.freeze({
          engineeringContext,
          executionContext: Object.freeze({}),
        }),
      });
      return installedCustomizedFixtureCache;
    }
  }
  throw new Error("Expected an installed customized target with a default behavioral scenario");
}

function expectArtifactError(
  callback: () => unknown,
  code: PrimaryPartCustomizedArtifactErrorV1["code"],
): void {
  try { callback(); }
  catch (error) {
    expect(error).toBeInstanceOf(PrimaryPartCustomizedArtifactErrorV1);
    expect((error as PrimaryPartCustomizedArtifactErrorV1).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

function expectOrdinarySvgError(callback: () => unknown, code: string): void {
  try { callback(); }
  catch (error) {
    expect(error).toBeInstanceOf(circuitSvgPublicSurface.CandidateCircuitSvgExportErrorV2);
    expect((error as circuitSvgPublicSurface.CandidateCircuitSvgExportErrorV2).code).toBe(code);
    return;
  }
  throw new Error(`Expected ordinary SVG ${code}`);
}

function parseRfc4180(source: string): string[][] {
  if (source.includes("\r") || !source.endsWith("\n")) throw new Error("Expected canonical LF-only CSV");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character !== '"') {
        field += character;
      } else if (source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = false;
      }
      continue;
    }
    if (character === '"' && field.length === 0) quoted = true;
    else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted || field.length > 0 || record.length > 0) throw new Error("Malformed terminal CSV record");
  return records;
}

describe("customized-target structural/electrical artifact V1", () => {
  it("keeps package subpaths and the root free of internal render authority", () => {
    const packageDocument = JSON.parse(readFileSync(
      new URL("../package.json", import.meta.url),
      "utf8",
    )) as { exports: Record<string, string> };
    expect(packageDocument.exports["./circuit-svg-v2"])
      .toBe("./src/circuit-svg-v2-public.ts");
    expect(packageDocument.exports["./kicad-schematic-v2"])
      .toBe("./src/kicad-schematic-v2-public.ts");
    expect(packageDocument.exports["./printable-report-v2"])
      .toBe("./src/printable-report-v2-public.ts");
    expect(packageDocument.exports["./primary-part-customized-artifact-v1"])
      .toBe("./src/primary-part-customized-artifact-v1-public.ts");
    expect(Object.keys(circuitSvgPublicSurface).sort()).toEqual([
      "CandidateCircuitSvgExportErrorV2",
      "exportDesignResultCircuitSvgV2",
      "parseDesignResultCircuitSvgV2",
    ]);
    expect(Object.keys(kicadPublicSurface).sort()).toEqual([
      "CandidateKicadSchematicExportErrorV2",
      "exportDesignResultKicadSchematicV2",
      "parseDesignResultKicadSchematicV2",
    ]);
    expect(Object.keys(printablePublicSurface).sort()).toEqual([
      "CandidatePrintableReportExportErrorV2",
      "exportDesignResultPrintableReportV2",
      "parseDesignResultPrintableReportV2",
    ]);
    expect(Object.keys(customizedArtifactPublicSurface)).toEqual([]);
    for (const forbidden of [
      "_renderCandidateCircuitSvgV2ForTest",
      "_renderCandidateCircuitSvgV2FromProjection",
      "PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1",
      "PrimaryPartCustomizedArtifactErrorV1",
      "exportPrimaryPartCustomizedArtifactV1",
      "verifyPrimaryPartCustomizedArtifactV1",
      "_exportPrimaryPartCustomizedInstalledArtifactV1",
      "_verifyPrimaryPartCustomizedInstalledArtifactV1",
      "_renderCandidatePrintableReportV2FromProjection",
      "_renderCandidateKicadSchematicV2FromProjection",
    ]) {
      expect(rootPublicSurface).not.toHaveProperty(forbidden);
      expect(circuitSvgPublicSurface).not.toHaveProperty(forbidden);
      expect(kicadPublicSurface).not.toHaveProperty(forbidden);
      expect(printablePublicSurface).not.toHaveProperty(forbidden);
      expect(customizedArtifactPublicSurface).not.toHaveProperty(forbidden);
    }
  });

  it("emits deterministic, separately named artifacts with exact embedded provenance", () => {
    const sidecar = customizedResult();
    const kinds: PrimaryPartCustomizedReplayableArtifactKindV1[] = [
      "customized_target_electrical_bom_csv",
      "customized_target_structural_svg",
    ];
    for (const kind of kinds) {
      const first = exportPrimaryPartCustomizedArtifactV1(sidecar, kind);
      const second = exportPrimaryPartCustomizedArtifactV1(sidecar, kind);
      expect(first).toEqual(second);
      expect(Object.isFrozen(first)).toBe(true);

      const metadata = verifyPrimaryPartCustomizedArtifactV1(first, sidecar);
      expect(metadata).toMatchObject({
        format: "schemagic-primary-part-customized-artifact-metadata",
        schemaVersion: 1,
        artifactKind: kind,
        provenance: {
          application: "motor.brushed-dc",
          customizedResultContentHash: sidecar.contentHash,
          instruction: {
            contentHash: sidecar.instruction.contentHash,
            requestHash: sidecar.instruction.requestHash,
            requestByteContentHash: sidecar.instruction.requestByteContentHash,
          },
          source: sidecar.source,
          engineeringContext: {
            manifestContentHash: sidecar.contextManifestContentHash,
            catalog: sidecar.instruction.context.catalog,
            recipe: sidecar.instruction.context.recipe,
            constraintPolicy: sidecar.instruction.context.constraintPolicy,
          },
          target: {
            resultContentHash: sidecar.targetResultProjection.contentHash,
            candidateId: sidecar.targetResultProjection.candidates[0]!.id,
            defaultCircuitId: "main",
            profile: {
              role: "primary",
              profileId: sidecar.instruction.substitution.targetProfile.profileId,
              contentHash: sidecar.instruction.substitution.targetProfile.contentHash,
            },
            constraintDecisionContentHash: sidecar.constraintDecision.contentHash,
            eligible: false,
            sourceWarnings: [],
            blockedRules: [{ ruleId: "motor.safety", disposition: "blocked_unknown" }],
          },
        },
        claimBoundary: {
          purpose: "inspection_only",
          ordinaryGenerationMutation: "none",
          ordinaryResultEvidence: "not_evidence",
          eligibilityEvidence: "not_evidence",
          rankingEvidence: "not_evidence",
          ranking: "not_recomputed",
          selectedPartModel: "not_added",
          simulationData: "not_included",
          commercialAuthority: "not_added",
          attestation: "none",
        },
      });
      expect(metadata.contentHash).toBe(
        designSha256ContentHash(canonicalDesignV2Payload(metadata, true)),
      );
      if (kind === "customized_target_electrical_bom_csv") {
        const records = parseRfc4180(first.content);
        expect(records.every((record) => record.length === records[0]!.length)).toBe(true);
        expect(decodeBomTextCellV2(records[1]![2]!)).toBe(canonicalDesignV2Payload(metadata));
      } else {
        expect(first.content).toContain(canonicalDesignV2Payload(metadata));
      }
    }
  });

  it("keeps the CSV useful while labelling it inspection-only and escaping spreadsheet/control input", () => {
    const sidecar = customizedResult({ manufacturerPartNumber: "  =CMD\r\n@next" });
    const artifact = exportPrimaryPartCustomizedArtifactV1(
      sidecar,
      "customized_target_electrical_bom_csv",
    );
    expect(artifact.filename).toMatch(/-customized-target-electrical-bom\.csv$/u);
    expect(artifact.mimeType).toBe("text/csv;charset=utf-8");
    expect(artifact.content).toMatch(/^artifact_purpose,target_policy_state,canonical_metadata_json,/u);
    expect(artifact.content).toContain("bom_line_id,role,manufacturer_id,manufacturer_part_number");
    expect(artifact.content).toContain("'  =CMD\\u000D\\u000A@next");
    expect(artifact.content).not.toContain("\r");
    expect(artifact.content).not.toContain("  =CMD\n");
    const records = parseRfc4180(artifact.content);
    expect(records).toHaveLength(2);
    expect(records[0]).toHaveLength(12);
    expect(records[1]).toHaveLength(records[0]!.length);
    expect(records[1]!.slice(0, 2)).toEqual(["inspection_only", "ineligible"]);
    expect(JSON.parse(decodeBomTextCellV2(records[1]![2]!))).toMatchObject({
      claimBoundary: {
        purpose: "inspection_only",
        ordinaryResultEvidence: "not_evidence",
        eligibilityEvidence: "not_evidence",
        rankingEvidence: "not_evidence",
      },
    });
    expect(decodeBomTextCellV2(records[1]![6]!)).toBe("  =CMD\r\n@next");
    expect(verifyPrimaryPartCustomizedArtifactV1(artifact, sidecar).artifactPayloadContentHash)
      .toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("renders exactly one target metadata block and visible trust boundaries in SVG", () => {
    const sidecar = customizedResult();
    const artifact = exportPrimaryPartCustomizedArtifactV1(
      sidecar,
      "customized_target_structural_svg",
    );
    expect(artifact.filename).toMatch(/-customized-target-structural-schematic\.svg$/u);
    expect(artifact.mimeType).toBe("image/svg+xml;charset=utf-8");
    expect(artifact.content.match(/id="schemagic-circuit-metadata-v2"/gu) ?? []).toHaveLength(0);
    expect(artifact.content.match(/id="schemagic-primary-part-customized-artifact-metadata-v1"/gu))
      .toHaveLength(1);
    expect(artifact.content).toContain("CUSTOMIZED TARGET - INSPECTION ONLY");
    expect(artifact.content).toContain("Not ordinary-result, eligibility, or ranking evidence.");
    expect(artifact.content).toContain("Recorded evaluated-policy state: ineligible; blocked rules: motor.safety.");
    expect(artifact.content).toContain("Simulation data is not included.");
    expect(artifact.content).not.toContain("Structural schematic · exact persisted V2 graph");
    expect(artifact.content).not.toContain(`Candidate ${sidecar.targetResultProjection.candidates[0]!.id} · result`);
    expectOrdinarySvgError(
      () => parseDesignResultCircuitSvgV2(
        artifact.content,
        sidecar.targetResultProjection,
        {} as never,
      ),
      "invalid_svg",
    );
  });

  it("records an exact eligible state without inventing blocked rules", () => {
    const sidecar = customizedResult({ eligible: true });
    const artifact = exportPrimaryPartCustomizedArtifactV1(
      sidecar,
      "customized_target_structural_svg",
    );
    const metadata = verifyPrimaryPartCustomizedArtifactV1(artifact, sidecar);
    expect(metadata.provenance.target.eligible).toBe(true);
    expect(metadata.provenance.target.blockedRules).toEqual([]);
    expect(artifact.content).toContain("Recorded evaluated-policy state: eligible; blocked rules: none.");
  });

  it("rejects unknown kinds and customized-result tampering before rendering", () => {
    const sidecar = customizedResult();
    expectArtifactError(
      () => exportPrimaryPartCustomizedArtifactV1(sidecar, "scenario_spice" as never),
      "unsupported_kind",
    );
    const tampered = structuredClone(sidecar);
    tampered.targetResultProjection.candidates[0]!.warnings.push("forged");
    expectArtifactError(
      () => exportPrimaryPartCustomizedArtifactV1(
        tampered,
        "customized_target_electrical_bom_csv",
      ),
      "invalid_customized_result",
    );
  });

  it("rejects metadata/content drift, duplicate SVG metadata, and non-exact envelopes", () => {
    const sidecar = customizedResult();
    const csv = exportPrimaryPartCustomizedArtifactV1(
      sidecar,
      "customized_target_electrical_bom_csv",
    );
    expectArtifactError(
      () => verifyPrimaryPartCustomizedArtifactV1(
        { ...csv, content: csv.content.replace('""eligible"":false', '""eligible"":true') },
        sidecar,
      ),
      "artifact_unverified",
    );
    expectArtifactError(
      () => verifyPrimaryPartCustomizedArtifactV1({ ...csv, filename: `forged-${csv.filename}` }, sidecar),
      "artifact_unverified",
    );
    expectArtifactError(
      () => verifyPrimaryPartCustomizedArtifactV1({ ...csv, unexpected: true }, sidecar),
      "artifact_unverified",
    );

    const svg = exportPrimaryPartCustomizedArtifactV1(
      sidecar,
      "customized_target_structural_svg",
    );
    const duplicated = svg.content.replace(
      "</metadata><title",
      '</metadata><metadata id="schemagic-primary-part-customized-artifact-metadata-v1">{}</metadata><title',
    );
    expectArtifactError(
      () => verifyPrimaryPartCustomizedArtifactV1({ ...svg, content: duplicated }, sidecar),
      "artifact_unverified",
    );
  });

  it("fails artifact verification closed at the deterministic byte limit", () => {
    const sidecar = customizedResult();
    const artifact = exportPrimaryPartCustomizedArtifactV1(
      sidecar,
      "customized_target_electrical_bom_csv",
    );
    expectArtifactError(
      () => verifyPrimaryPartCustomizedArtifactV1({
        ...artifact,
        content: "x".repeat(PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1 + 1),
      }, sidecar),
      "resource_limit",
    );
  });

  it("preflights repeated customized-target metadata before joining BOM rows", () => {
    const prefix = `inspection_only,ineligible,${"a".repeat(320_000)}`;
    const rows = Array.from({ length: 64 }, (_, index) => `line-${index}`);
    expect(csvWithRepeatedPrefixFitsByteLimitV1(
      "artifact_purpose,line_id\n",
      rows,
      prefix,
      PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1,
    )).toBe(false);
    expect(csvWithRepeatedPrefixFitsByteLimitV1(
      "artifact_purpose,line_id\n",
      rows.slice(0, 2),
      prefix,
      PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1,
    )).toBe(true);
  });

  it("does not weaken the ordinary exporter engineering-context gate", () => {
    const sidecar = customizedResult();
    const result = sidecar.targetResultProjection;
    expect(() => exportElectricalBomCsvV2(result, result.candidates[0]!.id, {} as never))
      .toThrow(expect.objectContaining({ code: "engineering_context_unverified" }));
  });

  it("emits and exact-verifies all installed-context production artifacts", () => {
    const { sidecar, context, scenarioId } = installedCustomizedFixture();
    const kinds = [
      "customized_target_engineering_report_html",
      "customized_target_structural_kicad",
      "customized_target_behavioral_scenario_spice",
    ] as const satisfies readonly PrimaryPartCustomizedInstalledArtifactKindV1[];
    const expected = {
      customized_target_engineering_report_html: {
        suffix: "-customized-target-engineering-report.html",
        mimeType: "text/html;charset=utf-8",
      },
      customized_target_structural_kicad: {
        suffix: "-customized-target-structural.kicad_sch",
        mimeType: "application/x-kicad-schematic;charset=utf-8",
      },
      customized_target_behavioral_scenario_spice: {
        suffix: `-customized-target-${scenarioId}-behavioral.cir`,
        mimeType: "text/x-spice;charset=utf-8",
      },
    } as const;

    for (const kind of kinds) {
      const first = _exportPrimaryPartCustomizedInstalledArtifactV1(sidecar, kind, context);
      const second = _exportPrimaryPartCustomizedInstalledArtifactV1(sidecar, kind, context);
      expect(first).toEqual(second);
      expect(Object.isFrozen(first)).toBe(true);
      expect(first.filename.endsWith(expected[kind].suffix)).toBe(true);
      expect(first.mimeType).toBe(expected[kind].mimeType);
      const metadata = _verifyPrimaryPartCustomizedInstalledArtifactV1(first, sidecar, context);
      expect(metadata).toMatchObject({
        artifactKind: kind,
        provenance: {
          customizedResultContentHash: sidecar.contentHash,
          source: sidecar.source,
          target: {
            resultContentHash: sidecar.targetResultProjection.contentHash,
            candidateId: sidecar.targetResultProjection.candidates[0]!.id,
            defaultCircuitId: sidecar.targetResultProjection.candidates[0]!.circuit.defaultCircuitId,
          },
        },
        installedProjectionBoundary: {
          authority: "customized_target_only",
          installedContext: "exact_reasserted",
          ordinaryExporterGate: "not_bypassed",
          simulationExecution: "not_performed",
          externalKicadOpenVerification: "unverified",
          kicadAttestation: "none",
          releaseAuthority: "not_added",
          attestation: "none",
        },
      });
      expect(metadata.contentHash).toBe(
        designSha256ContentHash(canonicalDesignV2Payload(metadata, true)),
      );
      for (const identity of [
        sidecar.contentHash,
        sidecar.source.resultContentHash,
        sidecar.source.executionReportContentHash,
        sidecar.source.candidateId,
        sidecar.instruction.contentHash,
        sidecar.instruction.requestHash,
        sidecar.instruction.requestByteContentHash,
        sidecar.contextManifestContentHash,
        sidecar.targetResultProjection.contentHash,
        sidecar.targetResultProjection.candidates[0]!.id,
        sidecar.instruction.substitution.targetProfile.profileId,
        sidecar.instruction.substitution.targetProfile.contentHash,
        sidecar.instruction.context.catalog.contentHash,
        sidecar.instruction.context.catalog.sourceReleaseContentHash,
        sidecar.instruction.context.recipe.contentHash,
        sidecar.instruction.context.constraintPolicy.contentHash,
        sidecar.constraintDecision.contentHash,
      ]) expect(first.content).toContain(identity);

      if (kind === "customized_target_engineering_report_html") {
        expect(first.content).toContain("schemagic-primary-part-customized-engineering-report-metadata-v1");
        expect(first.content).toContain("Customized-target authority boundary");
        expect(first.content).not.toContain('id="schemagic-printable-report-metadata-v2"');
      } else if (kind === "customized_target_structural_kicad") {
        expect(first.content).toContain("scheMAGIC Customized Target Artifact Metadata V1");
        expect(first.content).toContain("CUSTOMIZED TARGET - INSPECTION ONLY");
        expect(first.content).not.toContain("schemagic_metadata_v2:");
      } else {
        expect(metadata.provenance.target.scenario).toMatchObject({
          scenarioId,
          coverageTier: "behavioral",
          omissionCount: 0,
        });
        expect(first.content).toContain(`* default-scenario-id ${scenarioId}`);
        expect(first.content).toContain("* customized-target-boundary INSPECTION ONLY");
        const metadataLines = first.content.split("\n")
          .filter((line) => line.startsWith("* customized-metadata-"));
        expect(metadataLines.length).toBeGreaterThan(1);
        expect(Math.max(...metadataLines.map((line) => Array.from(line).length))).toBeLessThanOrEqual(124);
      }
    }
  }, 15_000);

  it("preserves ordinary exporter bytes and keeps every ordinary engineering gate closed", () => {
    const { sidecar, context, ordinaryResult, ordinaryCandidateId } = installedCustomizedFixture();
    const ordinaryCandidate = ordinaryResult.candidates.find((entry) => entry.id === ordinaryCandidateId)!;
    const ordinaryCircuitId = ordinaryCandidate.circuit.defaultCircuitId;
    const ordinaryScenarioId = ordinaryCandidate.circuit.defaultScenarioId!;
    const report = exportDesignResultPrintableReportV2(
      ordinaryResult,
      ordinaryCandidateId,
      context.engineeringContext,
    );
    expect(exportDesignResultPrintableReportV2(
      ordinaryResult,
      ordinaryCandidateId,
      context.engineeringContext,
    )).toBe(report);
    expect(parseDesignResultPrintableReportV2(
      report,
      ordinaryResult,
      context.engineeringContext,
    ).provenance.candidate.id).toBe(ordinaryCandidateId);

    const kicad = exportDesignResultKicadSchematicV2(
      ordinaryResult,
      ordinaryCandidateId,
      ordinaryCircuitId,
      context,
    );
    expect(exportDesignResultKicadSchematicV2(
      ordinaryResult,
      ordinaryCandidateId,
      ordinaryCircuitId,
      context,
    )).toBe(kicad);
    expect(parseDesignResultKicadSchematicV2(kicad, ordinaryResult, context).candidateRef.id)
      .toBe(ordinaryCandidateId);
    const spice = exportDesignResultScenarioSpiceV2(
      ordinaryResult,
      ordinaryCandidateId,
      ordinaryScenarioId,
      context,
    );
    expect(exportDesignResultScenarioSpiceV2(
      ordinaryResult,
      ordinaryCandidateId,
      ordinaryScenarioId,
      context,
    )).toBe(spice);

    const targetResult = sidecar.targetResultProjection;
    const targetCandidate = targetResult.candidates[0]!;
    expect(() => exportDesignResultPrintableReportV2(
      targetResult,
      targetCandidate.id,
      context.engineeringContext,
    )).toThrow(expect.objectContaining({ code: "engineering_context_unverified" }));
    expect(() => exportDesignResultKicadSchematicV2(
      targetResult,
      targetCandidate.id,
      targetCandidate.circuit.defaultCircuitId,
      context,
    )).toThrow(expect.objectContaining({ code: "engineering_context_unverified" }));
    expect(() => exportDesignResultScenarioSpiceV2(
      targetResult,
      targetCandidate.id,
      targetCandidate.circuit.defaultScenarioId!,
      context,
    )).toThrow(expect.objectContaining({ code: "engineering_context_unverified" }));
    expect(() => parseDesignResultPrintableReportV2(
      _exportPrimaryPartCustomizedInstalledArtifactV1(
        sidecar,
        "customized_target_engineering_report_html",
        context,
      ).content,
      targetResult,
      context.engineeringContext,
    )).toThrow();
    expect(() => parseDesignResultKicadSchematicV2(
      _exportPrimaryPartCustomizedInstalledArtifactV1(
        sidecar,
        "customized_target_structural_kicad",
        context,
      ).content,
      targetResult,
      context,
    )).toThrow();
  }, 120_000);

  it("fails installed verification closed and does not widen replay or receipt authority", () => {
    const { sidecar, context } = installedCustomizedFixture();
    const installedKinds = [
      "customized_target_engineering_report_html",
      "customized_target_structural_kicad",
      "customized_target_behavioral_scenario_spice",
    ] as const satisfies readonly PrimaryPartCustomizedInstalledArtifactKindV1[];
    for (const kind of installedKinds) {
      expectArtifactError(
        () => exportPrimaryPartCustomizedArtifactV1(sidecar, kind as never),
        "unsupported_kind",
      );
    }
    const artifact = _exportPrimaryPartCustomizedInstalledArtifactV1(
      sidecar,
      "customized_target_engineering_report_html",
      context,
    );
    expectArtifactError(
      () => _verifyPrimaryPartCustomizedInstalledArtifactV1(
        { ...artifact, content: `${artifact.content}\n` },
        sidecar,
        context,
      ),
      "artifact_unverified",
    );
    expectArtifactError(
      () => _verifyPrimaryPartCustomizedInstalledArtifactV1(
        { ...artifact, extra: true },
        sidecar,
        context,
      ),
      "artifact_unverified",
    );
    const mismatchedContext = {
      ...context,
      engineeringContext: {
        ...context.engineeringContext,
        manifest: { ...context.engineeringContext.manifest, contentHash: hash("f") },
      },
    } as unknown as PrimaryPartCustomizedInstalledRenderContextV1;
    expectArtifactError(
      () => _exportPrimaryPartCustomizedInstalledArtifactV1(
        sidecar,
        "customized_target_engineering_report_html",
        mismatchedContext,
      ),
      "installed_context_unverified",
    );
  });

  it("gates Scenario SPICE on the exact default behavioral, zero-omission scenario", () => {
    const { sidecar, context, scenarioId } = installedCustomizedFixture();
    const result = sidecar.targetResultProjection;
    const candidate = result.candidates[0]!;
    const projection = _renderBehavioralScenarioSpiceV2FromProjection(
      result,
      candidate.id,
      scenarioId,
      context.executionContext,
    );
    expect(projection.scenario).toMatchObject({
      scenarioId,
      coverageTier: "behavioral",
      omissionCount: 0,
    });
    expect(() => _renderBehavioralScenarioSpiceV2FromProjection(
      result,
      candidate.id,
      "selected_part_model",
      context.executionContext,
    )).toThrow(expect.objectContaining({ code: "scenario_not_found" }));

    const unavailableCandidate = structuredClone(candidate);
    unavailableCandidate.simulationCoverage = unavailableCandidate.simulationCoverage.map((entry) => (
      entry.scenarioId === scenarioId
        ? { ...entry, modelTier: "unavailable" as const }
        : entry
    ));
    expect(() => _assertBehavioralScenarioSpiceGateV2(
      unavailableCandidate,
      scenarioId,
    )).toThrow(expect.objectContaining({ code: "coverage_unavailable" }));

    const noDefaultCandidate = structuredClone(candidate);
    noDefaultCandidate.circuit.defaultScenarioId = null;
    expect(() => _assertBehavioralScenarioSpiceGateV2(
      noDefaultCandidate,
      scenarioId,
    )).toThrow(expect.objectContaining({ code: "scenario_not_found" }));

    try {
      _renderBehavioralScenarioSpiceV2FromProjection(
        result,
        candidate.id,
        scenarioId,
        { trustedSubcircuitRegistry: {} as never },
      );
      throw new Error("Expected an invalid execution context");
    } catch (error) {
      expect(error).toBeInstanceOf(CandidateScenarioSpiceExportErrorV2);
      expect((error as CandidateScenarioSpiceExportErrorV2).code).toBe("execution_context_invalid");
    }
  });

  it("chunks canonical SPICE metadata into injection-safe bounded physical comments", () => {
    const comments = _encodePrimaryPartCustomizedSpiceMetadataCommentsV1(
      "a".repeat(220) + "\r\n.control\u0000\u0085.end\u2028last",
    );
    expect(comments.length).toBeGreaterThan(3);
    expect(comments.every((line) => line.startsWith("* customized-metadata-"))).toBe(true);
    expect(Math.max(...comments.map((line) => Array.from(line).length))).toBeLessThanOrEqual(124);
    expect(comments.join("\n")).toContain(".control\\u{0}");
    expect(comments).not.toContain(".end");
    expect(comments.join("\n")).not.toMatch(/[\r\u0085\u2028\u2029]/u);
  });
});
