import { generateScenarioNetlist } from "@opencircuit/circuit-schema/v4-netlist";
import {
  parseElectricalDesignContextManifestV2,
  validateDesignResultExecutionContextV2,
  type DesignResultExecutionContextV2,
  type ElectricalDesignContextManifestV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-export-runtime";
import {
  canonicalDesignV2Payload,
  designSha256ContentHash,
  type PrimaryPartCustomizedResultSidecarV1,
} from "@opencircuit/design-schema";
import {
  _renderCandidateKicadSchematicV2FromProjection,
  _renderCandidateKicadSchematicV2PayloadFromProjection,
} from "./kicad-schematic-v2";
import {
  _renderCandidatePrintableReportV2FromProjection,
  _renderCandidatePrintableReportV2PayloadFromProjection,
} from "./printable-report-v2";
import {
  _assertPrimaryPartCustomizedArtifactByteLimitV1,
  _parsePrimaryPartCustomizedResultForArtifactV1,
  _primaryPartCustomizedArtifactMetadataForV1,
  _primaryPartCustomizedArtifactNameV1,
  PrimaryPartCustomizedArtifactErrorV1,
  type PrimaryPartCustomizedArtifactMetadataV1,
  type PrimaryPartCustomizedInstalledArtifactKindV1,
  type PrimaryPartCustomizedInstalledArtifactV1,
} from "./primary-part-customized-artifact-v1";
import {
  _renderBehavioralScenarioSpiceV2FromProjection,
  CandidateScenarioSpiceExportErrorV2,
  encodeSpiceCommentLinesV2,
} from "./spice-v2";

export interface PrimaryPartCustomizedInstalledRenderContextV1 {
  readonly engineeringContext: Readonly<GenerateElectricalContextV2>;
  readonly executionContext: Readonly<DesignResultExecutionContextV2>;
}

function supportedKind(value: unknown): value is PrimaryPartCustomizedInstalledArtifactKindV1 {
  return value === "customized_target_engineering_report_html"
    || value === "customized_target_structural_kicad"
    || value === "customized_target_behavioral_scenario_spice";
}

function exactManifest(
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  context: Readonly<PrimaryPartCustomizedInstalledRenderContextV1>,
): ElectricalDesignContextManifestV2 {
  try {
    const manifest = parseElectricalDesignContextManifestV2(context.engineeringContext.manifest);
    const expected = customizedResult.instruction.context;
    const recipe = manifest.recipes.find((entry) => entry.id === expected.recipe.id);
    const capability = context.engineeringContext.installedRecipeRegistry;
    if (manifest.application !== customizedResult.application
      || manifest.version !== expected.libraryVersion
      || manifest.contentHash !== customizedResult.contextManifestContentHash
      || manifest.catalog.version !== expected.catalog.version
      || manifest.catalog.contentHash !== expected.catalog.contentHash
      || manifest.catalog.sourceReleaseContentHash !== expected.catalog.sourceReleaseContentHash
      || recipe === undefined
      || recipe.version !== expected.recipe.version
      || recipe.contentHash !== expected.recipe.contentHash
      || !recipe.applications.includes(customizedResult.application)
      || capability.manifestContentHash !== manifest.contentHash
      || capability.compiler.id !== manifest.compiler.id
      || capability.compiler.version !== manifest.compiler.version
      || capability.compiler.contentHash !== manifest.compiler.contentHash) {
      throw new TypeError("Installed engineering context does not match the customized result");
    }
    const executionIssues = validateDesignResultExecutionContextV2(
      customizedResult.targetResultProjection,
      context.executionContext,
    );
    if (executionIssues.length !== 0) {
      throw new TypeError("Installed execution context does not match the customized result");
    }
    return manifest;
  } catch (error) {
    if (error instanceof PrimaryPartCustomizedArtifactErrorV1) throw error;
    throw new PrimaryPartCustomizedArtifactErrorV1("installed_context_unverified");
  }
}

function safeScenarioFilenameToken(scenarioId: string): string {
  const token = scenarioId.replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
  if (token.length === 0 || token.length > 128) {
    throw new PrimaryPartCustomizedArtifactErrorV1("behavioral_scenario_unavailable");
  }
  return token;
}

export function _encodePrimaryPartCustomizedSpiceMetadataCommentsV1(
  canonicalMetadata: string,
): string[] {
  const chunks: string[] = [];
  const safePrefix = "* metadata ";
  for (const safeLine of encodeSpiceCommentLinesV2("metadata", canonicalMetadata)) {
    const characters = Array.from(safeLine.slice(safePrefix.length));
    const chunkCount = Math.max(1, Math.ceil(characters.length / 96));
    for (let index = 0; index < chunkCount; index += 1) {
      const ordinal = String(chunks.length + 1).padStart(4, "0");
      chunks.push(...encodeSpiceCommentLinesV2(
        `customized-metadata-${ordinal}`,
        characters.slice(index * 96, (index + 1) * 96).join(""),
      ));
    }
  }
  return chunks;
}

function customizedSpiceContent(
  payload: string,
  metadata: Readonly<PrimaryPartCustomizedArtifactMetadataV1>,
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
): string {
  const candidate = customizedResult.targetResultProjection.candidates[0]!;
  const scenarioId = candidate.circuit.defaultScenarioId;
  if (scenarioId === null) {
    throw new PrimaryPartCustomizedArtifactErrorV1("behavioral_scenario_unavailable");
  }
  const scenario = candidate.circuit.scenarios.find((entry) => entry.id === scenarioId);
  if (scenario === undefined) {
    throw new PrimaryPartCustomizedArtifactErrorV1("behavioral_scenario_unavailable");
  }
  const scenarioMetadata = metadata.provenance.target.scenario;
  if (scenarioMetadata === undefined) {
    throw new PrimaryPartCustomizedArtifactErrorV1("behavioral_scenario_unavailable");
  }
  const canonicalMetadata = canonicalDesignV2Payload(metadata);
  const expected = customizedResult.instruction.context;
  const identities = [
    ["artifact-kind", metadata.artifactKind],
    ["source-result-hash", customizedResult.source.resultContentHash],
    ["source-execution-hash", customizedResult.source.executionReportContentHash],
    ["source-candidate-id", customizedResult.source.candidateId],
    ["customized-result-hash", customizedResult.contentHash],
    ["instruction-hash", customizedResult.instruction.contentHash],
    ["request-hash", customizedResult.instruction.requestHash],
    ["request-byte-hash", customizedResult.instruction.requestByteContentHash],
    ["target-result-hash", customizedResult.targetResultProjection.contentHash],
    ["target-candidate-id", candidate.id],
    ["target-profile-id", customizedResult.instruction.substitution.targetProfile.profileId],
    ["target-profile-hash", customizedResult.instruction.substitution.targetProfile.contentHash],
    ["manifest-hash", customizedResult.contextManifestContentHash],
    ["catalog-hash", expected.catalog.contentHash],
    ["source-release-hash", expected.catalog.sourceReleaseContentHash],
    ["recipe-hash", expected.recipe.contentHash],
    ["constraint-policy-hash", expected.constraintPolicy.contentHash],
    ["constraint-decision-hash", customizedResult.constraintDecision.contentHash],
    ["default-circuit-id", candidate.circuit.defaultCircuitId],
    ["default-scenario-id", scenarioId],
    ["scenario-circuit-id", scenario.circuitId],
    ["scenarioHash", scenarioMetadata.scenarioHash],
    ["serializationHash", scenarioMetadata.serializationHash],
    ["netlistContentHash", scenarioMetadata.netlistContentHash],
    ["scenario-summary", '{"coverageTier":"behavioral","omissionCount":0}'],
  ] as const;
  const comments = [
    ...encodeSpiceCommentLinesV2(
      "customized-target-boundary",
      "INSPECTION ONLY; not ordinary-result, eligibility, ranking, commercial, simulation-execution, or release evidence.",
    ),
    ...identities.flatMap(([label, value]) => encodeSpiceCommentLinesV2(label, value)),
    ..._encodePrimaryPartCustomizedSpiceMetadataCommentsV1(canonicalMetadata),
  ];
  const firstLineEnd = payload.indexOf("\n");
  if (firstLineEnd < 0) throw new TypeError("Generated deck has no title line");
  return `${payload.slice(0, firstLineEnd + 1)}${comments.join("\n")}\n${payload.slice(firstLineEnd + 1)}`;
}

function materialize(
  customizedResultInput: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  kindInput: unknown,
  context: Readonly<PrimaryPartCustomizedInstalledRenderContextV1>,
): Readonly<{
  artifact: PrimaryPartCustomizedInstalledArtifactV1;
  metadata: PrimaryPartCustomizedArtifactMetadataV1;
}> {
  if (!supportedKind(kindInput)) throw new PrimaryPartCustomizedArtifactErrorV1("unsupported_kind");
  const customizedResult = _parsePrimaryPartCustomizedResultForArtifactV1(customizedResultInput);
  const manifest = exactManifest(customizedResult, context);
  const result = customizedResult.targetResultProjection;
  const candidate = result.candidates[0]!;
  const circuit = candidate.circuit.circuits.find(
    (entry) => entry.id === candidate.circuit.defaultCircuitId,
  );
  if (circuit === undefined) throw new PrimaryPartCustomizedArtifactErrorV1("render_failed");

  try {
    let payload: string;
    let content: string;
    let filename: string;
    let mimeType: string;
    let metadata: PrimaryPartCustomizedArtifactMetadataV1;
    switch (kindInput) {
      case "customized_target_engineering_report_html": {
        payload = _renderCandidatePrintableReportV2PayloadFromProjection(result, candidate, manifest);
        metadata = _primaryPartCustomizedArtifactMetadataForV1(customizedResult, kindInput, payload, {});
        content = _renderCandidatePrintableReportV2FromProjection(result, candidate, manifest, {
          kind: "customized_target_inspection",
          canonicalMetadata: canonicalDesignV2Payload(metadata),
        });
        filename = _primaryPartCustomizedArtifactNameV1(customizedResult, "engineering-report.html");
        mimeType = "text/html;charset=utf-8";
        break;
      }
      case "customized_target_structural_kicad": {
        payload = _renderCandidateKicadSchematicV2PayloadFromProjection(
          result,
          candidate,
          circuit,
          manifest,
          context.executionContext,
        );
        metadata = _primaryPartCustomizedArtifactMetadataForV1(customizedResult, kindInput, payload, {});
        content = _renderCandidateKicadSchematicV2FromProjection(
          result,
          candidate,
          circuit,
          manifest,
          context.executionContext,
          {
            kind: "customized_target_inspection",
            canonicalMetadata: canonicalDesignV2Payload(metadata),
          },
        );
        filename = _primaryPartCustomizedArtifactNameV1(customizedResult, "structural.kicad_sch");
        mimeType = "application/x-kicad-schematic;charset=utf-8";
        break;
      }
      case "customized_target_behavioral_scenario_spice": {
        const scenarioId = candidate.circuit.defaultScenarioId;
        if (scenarioId === null) {
          throw new PrimaryPartCustomizedArtifactErrorV1("behavioral_scenario_unavailable");
        }
        const generated = generateScenarioNetlist(candidate.circuit, scenarioId, {
          ...(context.executionContext.trustedSubcircuitRegistry === undefined
            ? {}
            : { registry: context.executionContext.trustedSubcircuitRegistry }),
        });
        if (generated.omissions.length !== 0) {
          throw new PrimaryPartCustomizedArtifactErrorV1("behavioral_scenario_unavailable");
        }
        const projection = _renderBehavioralScenarioSpiceV2FromProjection(
          result,
          candidate.id,
          scenarioId,
          context.executionContext,
        );
        if (projection.scenario.omissionCount !== 0
          || projection.scenario.coverageTier !== "behavioral"
          || projection.scenario.scenarioHash !== generated.scenarioHash
          || projection.scenario.serializationHash !== generated.serializationHash
          || projection.scenario.netlistContentHash !== designSha256ContentHash(generated.netlist)) {
          throw new PrimaryPartCustomizedArtifactErrorV1("behavioral_scenario_unavailable");
        }
        payload = projection.payload;
        metadata = _primaryPartCustomizedArtifactMetadataForV1(customizedResult, kindInput, payload, {
          scenario: projection.scenario,
        });
        content = customizedSpiceContent(payload, metadata, customizedResult);
        filename = _primaryPartCustomizedArtifactNameV1(
          customizedResult,
          `${safeScenarioFilenameToken(scenarioId)}-behavioral.cir`,
        );
        mimeType = "text/x-spice;charset=utf-8";
        break;
      }
    }
    _assertPrimaryPartCustomizedArtifactByteLimitV1(content);
    return Object.freeze({
      artifact: Object.freeze({ kind: kindInput, filename, mimeType, content }),
      metadata,
    });
  } catch (error) {
    if (error instanceof PrimaryPartCustomizedArtifactErrorV1) throw error;
    if (error instanceof CandidateScenarioSpiceExportErrorV2) {
      if (error.code === "scenario_not_found" || error.code === "coverage_unavailable") {
        throw new PrimaryPartCustomizedArtifactErrorV1("behavioral_scenario_unavailable");
      }
      if (error.code === "execution_context_invalid") {
        throw new PrimaryPartCustomizedArtifactErrorV1("installed_context_unverified");
      }
    }
    throw new PrimaryPartCustomizedArtifactErrorV1("render_failed");
  }
}

export function _exportPrimaryPartCustomizedInstalledArtifactV1(
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  kind: PrimaryPartCustomizedInstalledArtifactKindV1,
  context: Readonly<PrimaryPartCustomizedInstalledRenderContextV1>,
): PrimaryPartCustomizedInstalledArtifactV1 {
  return materialize(customizedResult, kind, context).artifact;
}

function artifactRecord(input: unknown): PrimaryPartCustomizedInstalledArtifactV1 {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PrimaryPartCustomizedArtifactErrorV1("artifact_unverified");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(input);
  const expected = ["content", "filename", "kind", "mimeType"];
  if (keys.some((key) => typeof key !== "string")
    || (keys as string[]).sort().some((key, index) => key !== expected[index])
    || expected.some((key) => {
      const descriptor = descriptors[key];
      return descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true;
    })) {
    throw new PrimaryPartCustomizedArtifactErrorV1("artifact_unverified");
  }
  const values = Object.fromEntries(
    expected.map((key) => [key, descriptors[key]!.value]),
  ) as Record<string, unknown>;
  if (!supportedKind(values.kind)
    || typeof values.filename !== "string"
    || typeof values.mimeType !== "string"
    || typeof values.content !== "string") {
    throw new PrimaryPartCustomizedArtifactErrorV1("artifact_unverified");
  }
  _assertPrimaryPartCustomizedArtifactByteLimitV1(values.content);
  return values as unknown as PrimaryPartCustomizedInstalledArtifactV1;
}

export function _verifyPrimaryPartCustomizedInstalledArtifactV1(
  artifactInput: unknown,
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  context: Readonly<PrimaryPartCustomizedInstalledRenderContextV1>,
): Readonly<PrimaryPartCustomizedArtifactMetadataV1> {
  const artifact = artifactRecord(artifactInput);
  const expected = materialize(customizedResult, artifact.kind, context);
  if (artifact.kind !== expected.artifact.kind
    || artifact.filename !== expected.artifact.filename
    || artifact.mimeType !== expected.artifact.mimeType
    || artifact.content !== expected.artifact.content) {
    throw new PrimaryPartCustomizedArtifactErrorV1("artifact_unverified");
  }
  return expected.metadata;
}
