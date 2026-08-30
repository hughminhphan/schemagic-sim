import type { Sha256ContentHash } from "@opencircuit/circuit-schema";
import {
  PrimaryPartCustomizedResultParseErrorV1,
  canonicalDesignV2Payload,
  designSha256ContentHash,
  detachedFrozenDesignV2Value,
  parsePrimaryPartCustomizedResultSidecarV1,
  type CandidateIdV2,
  type ConstraintCriticalityV3,
  type ConstraintDispositionV3,
  type ConstraintTruthSourceStatusV3,
  type ConstraintTruthV3,
  type DesignApplication,
  type PrimaryPartCustomizedResultSidecarV1,
} from "@opencircuit/design-schema";
import { _renderElectricalBomCsvV2, escapeBomTextCellV2 } from "./bom-v2";
import { _renderCandidateCircuitSvgV2FromProjection } from "./circuit-svg-v2";
import { csvWithRepeatedPrefixFitsByteLimitV1 } from "./csv-repeated-prefix-byte-limit-internal";

const FORMAT = "schemagic-primary-part-customized-artifact-metadata" as const;
const SCHEMA_VERSION = 1 as const;
const CUSTOMIZED_TARGET_SVG_METADATA_ID = "schemagic-primary-part-customized-artifact-metadata-v1" as const;
const CUSTOMIZED_TARGET_CSV_PREFIX_COLUMNS = Object.freeze([
  "artifact_purpose",
  "target_policy_state",
  "canonical_metadata_json",
] as const);

export const PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1 = 16 * 1024 * 1024;

export type PrimaryPartCustomizedReplayableArtifactKindV1 =
  | "customized_target_electrical_bom_csv"
  | "customized_target_structural_svg";

export type PrimaryPartCustomizedInstalledArtifactKindV1 =
  | "customized_target_engineering_report_html"
  | "customized_target_structural_kicad"
  | "customized_target_behavioral_scenario_spice";

export type PrimaryPartCustomizedArtifactKindV1 =
  | PrimaryPartCustomizedReplayableArtifactKindV1
  | PrimaryPartCustomizedInstalledArtifactKindV1;

export interface PrimaryPartCustomizedArtifactV1<
  Kind extends PrimaryPartCustomizedArtifactKindV1 = PrimaryPartCustomizedArtifactKindV1,
> {
  readonly kind: Kind;
  readonly filename: string;
  readonly mimeType: string;
  readonly content: string;
}

export type PrimaryPartCustomizedReplayableArtifactV1 =
  PrimaryPartCustomizedArtifactV1<PrimaryPartCustomizedReplayableArtifactKindV1>;

export type PrimaryPartCustomizedInstalledArtifactV1 =
  PrimaryPartCustomizedArtifactV1<PrimaryPartCustomizedInstalledArtifactKindV1>;

export interface PrimaryPartCustomizedArtifactBlockedRuleV1 {
  readonly ruleId: string;
  readonly sourceStatus: ConstraintTruthSourceStatusV3;
  readonly truth: ConstraintTruthV3;
  readonly criticality: ConstraintCriticalityV3;
  readonly disposition: Extract<ConstraintDispositionV3, "blocked_failure" | "blocked_unknown">;
  readonly policyRationale: string;
}

export interface PrimaryPartCustomizedArtifactScenarioV1 {
  readonly scenarioId: string;
  readonly circuitId: string;
  readonly analysisMode: "op" | "tran" | "ac" | "dc-sweep" | "noise";
  readonly scenarioHash: string;
  readonly serializationHash: string;
  readonly netlistContentHash: Sha256ContentHash;
  readonly coverageTier: "behavioral";
  readonly limitations: readonly string[];
  readonly omissionCount: 0;
}

export interface PrimaryPartCustomizedArtifactMetadataV1 {
  readonly format: typeof FORMAT;
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly artifactKind: PrimaryPartCustomizedArtifactKindV1;
  readonly artifactPayloadContentHash: Sha256ContentHash;
  readonly provenance: Readonly<{
    application: DesignApplication;
    customizedResultContentHash: Sha256ContentHash;
    instruction: Readonly<{
      contentHash: Sha256ContentHash;
      requestHash: Sha256ContentHash;
      requestByteContentHash: Sha256ContentHash;
    }>;
    source: Readonly<{
      resultContentHash: Sha256ContentHash;
      executionReportContentHash: Sha256ContentHash;
      candidateId: CandidateIdV2;
    }>;
    engineeringContext: Readonly<{
      libraryVersion: string;
      manifestContentHash: Sha256ContentHash;
      catalog: Readonly<{
        version: string;
        contentHash: Sha256ContentHash;
        sourceReleaseContentHash: Sha256ContentHash;
      }>;
      recipe: Readonly<{
        id: string;
        version: string;
        contentHash: Sha256ContentHash;
      }>;
      constraintPolicy: Readonly<{
        id: "production_strict_v1";
        contentHash: Sha256ContentHash;
      }>;
    }>;
    target: Readonly<{
      resultContentHash: Sha256ContentHash;
      candidateId: CandidateIdV2;
      defaultCircuitId: string;
      profile: Readonly<{
        role: "primary";
        profileId: string;
        contentHash: Sha256ContentHash;
      }>;
      constraintDecisionContentHash: Sha256ContentHash;
      eligible: boolean;
      sourceWarnings: readonly string[];
      blockedRules: readonly Readonly<PrimaryPartCustomizedArtifactBlockedRuleV1>[];
      scenario?: Readonly<PrimaryPartCustomizedArtifactScenarioV1>;
    }>;
  }>;
  readonly claimBoundary: Readonly<{
    purpose: "inspection_only";
    ordinaryGenerationMutation: "none";
    ordinaryResultEvidence: "not_evidence";
    eligibilityEvidence: "not_evidence";
    rankingEvidence: "not_evidence";
    ranking: "not_recomputed";
    selectedPartModel: "not_added";
    simulationData: "not_included";
    commercialAuthority: "not_added";
    attestation: "none";
  }>;
  readonly installedProjectionBoundary?: Readonly<{
    authority: "customized_target_only";
    installedContext: "exact_reasserted";
    ordinaryExporterGate: "not_bypassed";
    selectedPartModel: "not_added";
    simulationSamples: "not_included";
    simulationExecution: "not_performed";
    physicalImplementation: "not_verified";
    footprintMapping: "unavailable";
    externalKicadOpenVerification: "unverified";
    kicadAttestation: "none";
    commercialAuthority: "not_added";
    releaseAuthority: "not_added";
    attestation: "none";
  }>;
  readonly contentHash: Sha256ContentHash;
}

export type PrimaryPartCustomizedArtifactErrorCodeV1 =
  | "invalid_customized_result"
  | "unsupported_kind"
  | "installed_context_unverified"
  | "behavioral_scenario_unavailable"
  | "render_failed"
  | "resource_limit"
  | "artifact_unverified";

export class PrimaryPartCustomizedArtifactErrorV1 extends Error {
  readonly code: PrimaryPartCustomizedArtifactErrorCodeV1;

  constructor(code: PrimaryPartCustomizedArtifactErrorCodeV1) {
    super(`scheMAGIC customized-target artifact was rejected: ${code}`);
    this.name = "PrimaryPartCustomizedArtifactErrorV1";
    this.code = code;
  }
}

function supportedKind(value: unknown): value is PrimaryPartCustomizedReplayableArtifactKindV1 {
  return value === "customized_target_electrical_bom_csv"
    || value === "customized_target_structural_svg";
}

export function _parsePrimaryPartCustomizedResultForArtifactV1(
  input: Readonly<PrimaryPartCustomizedResultSidecarV1>,
): PrimaryPartCustomizedResultSidecarV1 {
  try {
    return parsePrimaryPartCustomizedResultSidecarV1(input);
  } catch (error) {
    throw new PrimaryPartCustomizedArtifactErrorV1(
      error instanceof PrimaryPartCustomizedResultParseErrorV1 && error.code === "resource_limit"
        ? "resource_limit"
        : "invalid_customized_result",
    );
  }
}

function renderPayload(
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  kind: PrimaryPartCustomizedReplayableArtifactKindV1,
): string {
  const result = customizedResult.targetResultProjection;
  const candidate = result.candidates[0]!;
  switch (kind) {
    case "customized_target_electrical_bom_csv":
      return _renderElectricalBomCsvV2(candidate);
    case "customized_target_structural_svg": {
      const circuit = candidate.circuit.circuits.find(
        (entry) => entry.id === candidate.circuit.defaultCircuitId,
      );
      if (circuit === undefined) throw new TypeError("Customized-target default circuit is absent");
      return _renderCandidateCircuitSvgV2FromProjection(result, candidate, circuit);
    }
  }
}

export function _primaryPartCustomizedArtifactMetadataForV1(
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  kind: PrimaryPartCustomizedArtifactKindV1,
  payload: string,
  installed?: Readonly<{
    scenario?: Readonly<PrimaryPartCustomizedArtifactScenarioV1>;
  }>,
): PrimaryPartCustomizedArtifactMetadataV1 {
  const candidate = customizedResult.targetResultProjection.candidates[0]!;
  const decision = customizedResult.constraintDecision.candidates[0]!;
  const primary = candidate.components.find((component) => component.id === "primary")!;
  const blockedRules = decision.rules
    .filter((rule): rule is typeof rule & {
      disposition: "blocked_failure" | "blocked_unknown";
    } => rule.disposition === "blocked_failure" || rule.disposition === "blocked_unknown")
    .map((rule): PrimaryPartCustomizedArtifactBlockedRuleV1 => ({
      ruleId: rule.ruleId,
      sourceStatus: rule.sourceStatus,
      truth: rule.truth,
      criticality: rule.criticality,
      disposition: rule.disposition,
      policyRationale: rule.policyRationale,
    }));
  const draft: Omit<PrimaryPartCustomizedArtifactMetadataV1, "contentHash"> = {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    artifactKind: kind,
    artifactPayloadContentHash: designSha256ContentHash(payload),
    provenance: {
      application: customizedResult.application,
      customizedResultContentHash: customizedResult.contentHash,
      instruction: {
        contentHash: customizedResult.instruction.contentHash,
        requestHash: customizedResult.instruction.requestHash,
        requestByteContentHash: customizedResult.instruction.requestByteContentHash,
      },
      source: {
        resultContentHash: customizedResult.source.resultContentHash,
        executionReportContentHash: customizedResult.source.executionReportContentHash,
        candidateId: customizedResult.source.candidateId,
      },
      engineeringContext: {
        libraryVersion: customizedResult.instruction.context.libraryVersion,
        manifestContentHash: customizedResult.contextManifestContentHash,
        catalog: { ...customizedResult.instruction.context.catalog },
        recipe: { ...customizedResult.instruction.context.recipe },
        constraintPolicy: { ...customizedResult.instruction.context.constraintPolicy },
      },
      target: {
        resultContentHash: customizedResult.targetResultProjection.contentHash,
        candidateId: candidate.id,
        defaultCircuitId: candidate.circuit.defaultCircuitId,
        profile: {
          role: "primary",
          profileId: primary.profileId,
          contentHash: customizedResult.instruction.substitution.targetProfile.contentHash,
        },
        constraintDecisionContentHash: customizedResult.constraintDecision.contentHash,
        eligible: decision.eligible,
        sourceWarnings: [...decision.sourceWarnings],
        blockedRules,
        ...(installed?.scenario === undefined
          ? {}
          : { scenario: structuredClone(installed.scenario) }),
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
    ...(installed === undefined
      ? {}
      : {
          installedProjectionBoundary: {
            authority: "customized_target_only" as const,
            installedContext: "exact_reasserted" as const,
            ordinaryExporterGate: "not_bypassed" as const,
            selectedPartModel: "not_added" as const,
            simulationSamples: "not_included" as const,
            simulationExecution: "not_performed" as const,
            physicalImplementation: "not_verified" as const,
            footprintMapping: "unavailable" as const,
            externalKicadOpenVerification: "unverified" as const,
            kicadAttestation: "none" as const,
            commercialAuthority: "not_added" as const,
            releaseAuthority: "not_added" as const,
            attestation: "none" as const,
          },
        }),
  };
  return detachedFrozenDesignV2Value({
    ...draft,
    contentHash: designSha256ContentHash(canonicalDesignV2Payload(draft)),
  });
}

export function _primaryPartCustomizedArtifactNameV1(
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  suffix: string,
): string {
  const application = customizedResult.application.replaceAll(".", "-");
  const targetCandidate = customizedResult.targetResultProjection.candidates[0]!.id.slice(-12);
  return `schemagic-${application}-${targetCandidate}-customized-target-${suffix}`;
}

export function _assertPrimaryPartCustomizedArtifactByteLimitV1(content: string): void {
  if (content.length > PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1
    || new TextEncoder().encode(content).byteLength > PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1) {
    throw new PrimaryPartCustomizedArtifactErrorV1("resource_limit");
  }
}

function materialize(
  customizedResultInput: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  kindInput: unknown,
): {
  artifact: PrimaryPartCustomizedReplayableArtifactV1;
  metadata: PrimaryPartCustomizedArtifactMetadataV1;
} {
  if (!supportedKind(kindInput)) throw new PrimaryPartCustomizedArtifactErrorV1("unsupported_kind");
  const customizedResult = _parsePrimaryPartCustomizedResultForArtifactV1(customizedResultInput);
  try {
    const payload = renderPayload(customizedResult, kindInput);
    const metadata = _primaryPartCustomizedArtifactMetadataForV1(customizedResult, kindInput, payload);
    const canonicalMetadata = canonicalDesignV2Payload(metadata);
    let artifact: PrimaryPartCustomizedReplayableArtifactV1;
    if (kindInput === "customized_target_electrical_bom_csv") {
      const [bomHeader, ...bomRowsWithTerminal] = payload.split("\n");
      const bomRows = bomRowsWithTerminal.filter((row) => row.length > 0);
      if (bomHeader === undefined || bomHeader.length === 0 || bomRows.length === 0) {
        throw new TypeError("Customized-target electrical BOM is empty");
      }
      const prefix = [
        escapeBomTextCellV2("inspection_only"),
        escapeBomTextCellV2(metadata.provenance.target.eligible ? "eligible" : "ineligible"),
        escapeBomTextCellV2(canonicalMetadata),
      ].join(",");
      const header = `${CUSTOMIZED_TARGET_CSV_PREFIX_COLUMNS.join(",")},${bomHeader}\n`;
      if (!csvWithRepeatedPrefixFitsByteLimitV1(
        header,
        bomRows,
        prefix,
        PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1,
      )) {
        throw new PrimaryPartCustomizedArtifactErrorV1("resource_limit");
      }
      const content = `${header}${bomRows.map((row) => `${prefix},${row}`).join("\n")}\n`;
      _assertPrimaryPartCustomizedArtifactByteLimitV1(content);
      artifact = {
        kind: kindInput,
        filename: _primaryPartCustomizedArtifactNameV1(customizedResult, "electrical-bom.csv"),
        mimeType: "text/csv;charset=utf-8",
        content,
      };
    } else {
      const candidate = customizedResult.targetResultProjection.candidates[0]!;
      const circuit = candidate.circuit.circuits.find(
        (entry) => entry.id === candidate.circuit.defaultCircuitId,
      );
      if (circuit === undefined) throw new TypeError("Customized-target default circuit is absent");
      const eligibility = metadata.provenance.target.eligible ? "eligible" : "ineligible";
      const blocked = metadata.provenance.target.blockedRules.map((rule) => rule.ruleId).join(", ") || "none";
      const content = _renderCandidateCircuitSvgV2FromProjection(
        customizedResult.targetResultProjection,
        candidate,
        circuit,
        {
          metadataId: CUSTOMIZED_TARGET_SVG_METADATA_ID,
          canonicalMetadata,
          headerLines: [
            "CUSTOMIZED TARGET - INSPECTION ONLY",
            "Not ordinary-result, eligibility, or ranking evidence.",
            "No selected-part model, simulation data, commercial authority, or attestation.",
            `Recorded evaluated-policy state: ${eligibility}; blocked rules: ${blocked}.`,
          ],
          description: "Customized-target structural schematic for inspection only. It is not ordinary-result, eligibility, or ranking evidence. Simulation data is not included.",
        },
      );
      _assertPrimaryPartCustomizedArtifactByteLimitV1(content);
      artifact = {
        kind: kindInput,
        filename: _primaryPartCustomizedArtifactNameV1(customizedResult, "structural-schematic.svg"),
        mimeType: "image/svg+xml;charset=utf-8",
        content,
      };
    }
    return {
      artifact: Object.freeze(artifact),
      metadata,
    };
  } catch (error) {
    if (error instanceof PrimaryPartCustomizedArtifactErrorV1) throw error;
    throw new PrimaryPartCustomizedArtifactErrorV1("render_failed");
  }
}

/**
 * Emit one of the two closed customized-target inspection artifacts.
 *
 * The sole authority input is the exact self-hashed target-result sidecar. No
 * caller-selected candidate, circuit, context, simulation, or commercial state
 * is accepted. An installed application leaf must separately authorize that
 * exact sidecar before calling this render-only contract.
 */
export function exportPrimaryPartCustomizedArtifactV1(
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  kind: PrimaryPartCustomizedReplayableArtifactKindV1,
): PrimaryPartCustomizedReplayableArtifactV1 {
  return materialize(customizedResult, kind).artifact;
}

function artifactRecord(input: unknown): PrimaryPartCustomizedReplayableArtifactV1 {
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
  const values = Object.fromEntries(expected.map((key) => [key, descriptors[key]!.value])) as Record<string, unknown>;
  if (!supportedKind(values.kind)
    || typeof values.filename !== "string"
    || typeof values.mimeType !== "string"
    || typeof values.content !== "string") {
    throw new PrimaryPartCustomizedArtifactErrorV1("artifact_unverified");
  }
  _assertPrimaryPartCustomizedArtifactByteLimitV1(values.content);
  return values as unknown as PrimaryPartCustomizedReplayableArtifactV1;
}

/** Regenerate and byte-verify an artifact against its exact customized result. */
export function verifyPrimaryPartCustomizedArtifactV1(
  artifactInput: unknown,
  customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
): Readonly<PrimaryPartCustomizedArtifactMetadataV1> {
  const artifact = artifactRecord(artifactInput);
  const expected = materialize(customizedResult, artifact.kind);
  if (artifact.kind !== expected.artifact.kind
    || artifact.filename !== expected.artifact.filename
    || artifact.mimeType !== expected.artifact.mimeType
    || artifact.content !== expected.artifact.content) {
    throw new PrimaryPartCustomizedArtifactErrorV1("artifact_unverified");
  }
  return expected.metadata;
}
