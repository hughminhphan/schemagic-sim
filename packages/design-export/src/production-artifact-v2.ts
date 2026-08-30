import {
  canonicalDesignV2Payload,
  designSha256ContentHash,
  detachedFrozenDesignV2Value,
  parseConstraintDecisionV3,
  parseDesignResultV2,
  type CandidateIdV2,
  type CandidateConstraintDecisionV3,
  type ConstraintDecisionV3,
  type DesignResultV2,
} from "@opencircuit/design-schema";
import type {
  DesignResultExecutionContextV2,
  GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-export-runtime";
import { validateDesignResultEngineeringContextV2 } from "@opencircuit/design-engine/v2-export-runtime";
import { _renderElectricalBomCsvV2, escapeBomTextCellV2, exportElectricalBomCsvV2 } from "./bom-v2";
import {
  _renderCandidateCircuitSvgV2FromProjection,
  exportDesignResultCircuitSvgV2,
} from "./circuit-svg-v2";
import { csvWithRepeatedPrefixFitsByteLimitV1 } from "./csv-repeated-prefix-byte-limit-internal";
import { exportDesignResultKicadSchematicV2 } from "./kicad-schematic-v2";
import { exportDesignResultPrintableReportV2 } from "./printable-report-v2";
import { exportDesignResultScenarioSpiceV2 } from "./spice-v2";

export type ProductionDesignArtifactKindV2 =
  | "electrical_bom_csv"
  | "scenario_spice"
  | "structural_svg"
  | "engineering_report_html"
  | "structural_kicad"
  | "physical_handoff_json";

export interface ProductionDesignArtifactV2 {
  readonly kind: ProductionDesignArtifactKindV2;
  readonly filename: string;
  readonly mimeType: string;
  readonly content: string;
}

const OBSERVATION_METADATA_FORMAT = "schemagic-production-constraint-observation-artifact-metadata" as const;
const OBSERVATION_METADATA_SCHEMA_VERSION = 1 as const;
const OBSERVATION_SVG_METADATA_ID = "schemagic-production-constraint-observation-artifact-metadata-v1" as const;
const OBSERVATION_ARTIFACT_MAX_BYTES = 16 * 1024 * 1024;
const OBSERVATION_CSV_PREFIX_COLUMNS = Object.freeze([
  "artifact_boundary",
  "candidate_policy_state",
  "constraint_decision_content_hash",
  "constraint_policy_content_hash",
  "blocked_failure_count",
  "blocked_unknown_count",
  "blocked_rule_ids_json",
  "canonical_observation_metadata_json",
] as const);

export type ProductionConstraintObservationArtifactKindV1 =
  | "electrical_bom_csv"
  | "structural_svg";

export interface ProductionConstraintObservationArtifactMetadataV1 {
  readonly format: typeof OBSERVATION_METADATA_FORMAT;
  readonly schemaVersion: typeof OBSERVATION_METADATA_SCHEMA_VERSION;
  readonly artifactKind: ProductionConstraintObservationArtifactKindV1;
  readonly artifactPayloadContentHash: `sha256:${string}`;
  readonly provenance: Readonly<{
    application: DesignResultV2["request"]["application"];
    result: Readonly<{
      contentHash: DesignResultV2["contentHash"];
      requestHash: DesignResultV2["requestHash"];
      libraryVersion: string;
      libraryContentHash: DesignResultV2["libraryContentHash"];
    }>;
    engineeringContext: Readonly<{
      manifestVersion: string;
      manifestContentHash: `sha256:${string}`;
    }>;
    candidate: Readonly<{
      id: CandidateIdV2;
      recipeId: string;
      recipeContentHash: `sha256:${string}`;
    }>;
    constraintDecision: Readonly<{
      contentHash: `sha256:${string}`;
      policy: Readonly<{
        constraintPolicy: "production_strict_v1";
        contentHash: `sha256:${string}`;
      }>;
      eligible: boolean;
      blockedFailureCount: number;
      blockedUnknownCount: number;
      blockedRuleIds: readonly string[];
    }>;
  }>;
  readonly claimBoundary: Readonly<{
    purpose: "production_constraint_observation";
    eligibilityState: "exact_decision_recorded_not_inferred";
    ordinaryResultMutation: "none";
    simulationData: "not_included";
    commercialAuthority: "not_added";
    attestation: "none";
  }>;
  readonly contentHash: `sha256:${string}`;
}

export type ProductionConstraintObservationArtifactErrorCodeV1 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "invalid_decision"
  | "decision_source_mismatch"
  | "candidate_not_found"
  | "candidate_decision_not_found"
  | "recipe_mismatch"
  | "unsupported_kind"
  | "render_failed"
  | "resource_limit"
  | "artifact_unverified";

export class ProductionConstraintObservationArtifactErrorV1 extends Error {
  readonly code: ProductionConstraintObservationArtifactErrorCodeV1;

  constructor(code: ProductionConstraintObservationArtifactErrorCodeV1) {
    super(`scheMAGIC production constraint-observation artifact was rejected: ${code}`);
    this.name = "ProductionConstraintObservationArtifactErrorV1";
    this.code = code;
  }
}

interface ExactObservationArtifactContext {
  readonly result: DesignResultV2;
  readonly candidate: DesignResultV2["candidates"][number];
  readonly candidateDecision: CandidateConstraintDecisionV3;
  readonly decision: ConstraintDecisionV3;
  readonly recipeContentHash: `sha256:${string}`;
}

function exactObservationArtifactContext(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
  decisionInput: Readonly<ConstraintDecisionV3>,
): ExactObservationArtifactContext {
  let result: DesignResultV2;
  try { result = parseDesignResultV2(resultInput); }
  catch { throw new ProductionConstraintObservationArtifactErrorV1("invalid_result"); }
  if (validateDesignResultEngineeringContextV2(resultInput, engineeringContext).length > 0) {
    throw new ProductionConstraintObservationArtifactErrorV1("engineering_context_unverified");
  }
  let decision: ConstraintDecisionV3;
  try { decision = parseConstraintDecisionV3(decisionInput); }
  catch { throw new ProductionConstraintObservationArtifactErrorV1("invalid_decision"); }
  const resultCandidateIds = [...result.candidates.map((candidate) => candidate.id)].sort();
  if (decision.source.resultContentHash !== result.contentHash
    || canonicalDesignV2Payload(decision.source.candidateIds) !== canonicalDesignV2Payload(resultCandidateIds)) {
    throw new ProductionConstraintObservationArtifactErrorV1("decision_source_mismatch");
  }
  for (const candidateDecision of decision.candidates) {
    const sourceCandidate = result.candidates.find((candidate) => candidate.id === candidateDecision.candidateId);
    if (sourceCandidate === undefined) {
      throw new ProductionConstraintObservationArtifactErrorV1("decision_source_mismatch");
    }
    if (sourceCandidate.recipeId !== candidateDecision.recipeId) {
      throw new ProductionConstraintObservationArtifactErrorV1("recipe_mismatch");
    }
    const recipe = engineeringContext.manifest.recipes.find((entry) => entry.id === sourceCandidate.recipeId);
    if (recipe === undefined || recipe.contentHash !== candidateDecision.recipeContentHash) {
      throw new ProductionConstraintObservationArtifactErrorV1("recipe_mismatch");
    }
  }
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new ProductionConstraintObservationArtifactErrorV1("candidate_not_found");
  const candidateDecision = decision.candidates.find((entry) => entry.candidateId === candidate.id);
  if (candidateDecision === undefined) {
    throw new ProductionConstraintObservationArtifactErrorV1("candidate_decision_not_found");
  }
  const recipe = engineeringContext.manifest.recipes.find((entry) => entry.id === candidate.recipeId);
  if (recipe === undefined || recipe.contentHash !== candidateDecision.recipeContentHash) {
    throw new ProductionConstraintObservationArtifactErrorV1("recipe_mismatch");
  }
  return { result, candidate, candidateDecision, decision, recipeContentHash: recipe.contentHash };
}

function observationMetadata(
  exact: Readonly<ExactObservationArtifactContext>,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
  kind: ProductionConstraintObservationArtifactKindV1,
  payload: string,
): ProductionConstraintObservationArtifactMetadataV1 {
  const blockedFailureRuleIds = exact.candidateDecision.rules
    .filter((rule) => rule.disposition === "blocked_failure")
    .map((rule) => rule.ruleId);
  const blockedUnknownRuleIds = exact.candidateDecision.rules
    .filter((rule) => rule.disposition === "blocked_unknown")
    .map((rule) => rule.ruleId);
  const blockedRuleIds = [...blockedFailureRuleIds, ...blockedUnknownRuleIds].sort();
  const draft: Omit<ProductionConstraintObservationArtifactMetadataV1, "contentHash"> = {
    format: OBSERVATION_METADATA_FORMAT,
    schemaVersion: OBSERVATION_METADATA_SCHEMA_VERSION,
    artifactKind: kind,
    artifactPayloadContentHash: designSha256ContentHash(payload),
    provenance: {
      application: exact.result.request.application,
      result: {
        contentHash: exact.result.contentHash,
        requestHash: exact.result.requestHash,
        libraryVersion: exact.result.libraryVersion,
        libraryContentHash: exact.result.libraryContentHash,
      },
      engineeringContext: {
        manifestVersion: engineeringContext.manifest.version,
        manifestContentHash: engineeringContext.manifest.contentHash,
      },
      candidate: {
        id: exact.candidate.id,
        recipeId: exact.candidate.recipeId,
        recipeContentHash: exact.recipeContentHash,
      },
      constraintDecision: {
        contentHash: exact.decision.contentHash,
        policy: { ...exact.decision.policy },
        eligible: exact.candidateDecision.eligible,
        blockedFailureCount: blockedFailureRuleIds.length,
        blockedUnknownCount: blockedUnknownRuleIds.length,
        blockedRuleIds,
      },
    },
    claimBoundary: {
      purpose: "production_constraint_observation",
      eligibilityState: "exact_decision_recorded_not_inferred",
      ordinaryResultMutation: "none",
      simulationData: "not_included",
      commercialAuthority: "not_added",
      attestation: "none",
    },
  };
  return detachedFrozenDesignV2Value({
    ...draft,
    contentHash: designSha256ContentHash(canonicalDesignV2Payload(draft)),
  });
}

function observationCsv(payload: string, metadata: Readonly<ProductionConstraintObservationArtifactMetadataV1>): string {
  const [bomHeader, ...bomRowsWithTerminal] = payload.split("\n");
  const bomRows = bomRowsWithTerminal.filter((row) => row.length > 0);
  if (bomHeader === undefined || bomHeader.length === 0 || bomRows.length === 0) {
    throw new ProductionConstraintObservationArtifactErrorV1("render_failed");
  }
  const state = metadata.provenance.constraintDecision;
  const prefix = [
    escapeBomTextCellV2("observation_only"),
    escapeBomTextCellV2(state.eligible ? "eligible" : "ineligible"),
    escapeBomTextCellV2(state.contentHash),
    escapeBomTextCellV2(state.policy.contentHash),
    JSON.stringify(state.blockedFailureCount),
    JSON.stringify(state.blockedUnknownCount),
    escapeBomTextCellV2(canonicalDesignV2Payload(state.blockedRuleIds)),
    escapeBomTextCellV2(canonicalDesignV2Payload(metadata)),
  ].join(",");
  const header = `${OBSERVATION_CSV_PREFIX_COLUMNS.join(",")},${bomHeader}\n`;
  if (!csvWithRepeatedPrefixFitsByteLimitV1(
    header,
    bomRows,
    prefix,
    OBSERVATION_ARTIFACT_MAX_BYTES,
  )) {
    throw new ProductionConstraintObservationArtifactErrorV1("resource_limit");
  }
  return `${header}${bomRows.map((row) => `${prefix},${row}`).join("\n")}\n`;
}

function assertObservationArtifactByteLimit(content: string): void {
  if (content.length > OBSERVATION_ARTIFACT_MAX_BYTES
    || new TextEncoder().encode(content).byteLength > OBSERVATION_ARTIFACT_MAX_BYTES) {
    throw new ProductionConstraintObservationArtifactErrorV1("resource_limit");
  }
}

function materializeObservationArtifact(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  kind: ProductionConstraintObservationArtifactKindV1,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
  decisionInput: Readonly<ConstraintDecisionV3>,
): Readonly<{
  artifact: ProductionDesignArtifactV2;
  metadata: ProductionConstraintObservationArtifactMetadataV1;
}> {
  const exact = exactObservationArtifactContext(resultInput, candidateId, engineeringContext, decisionInput);
  const circuit = exact.candidate.circuit.circuits.find(
    (entry) => entry.id === exact.candidate.circuit.defaultCircuitId,
  );
  if (circuit === undefined) throw new ProductionConstraintObservationArtifactErrorV1("render_failed");
  try {
    const payload = kind === "electrical_bom_csv"
      ? _renderElectricalBomCsvV2(exact.candidate)
      : _renderCandidateCircuitSvgV2FromProjection(exact.result, exact.candidate, circuit);
    const metadata = observationMetadata(exact, engineeringContext, kind, payload);
    let content: string;
    let mimeType: string;
    let suffix: string;
    if (kind === "electrical_bom_csv") {
      content = observationCsv(payload, metadata);
      mimeType = "text/csv;charset=utf-8";
      suffix = "electrical-bom.csv";
    } else {
      const state = metadata.provenance.constraintDecision;
      const eligibility = state.eligible ? "ELIGIBLE" : "INELIGIBLE";
      const blockedRuleText = state.blockedRuleIds.join(", ") || "none";
      const description = `OBSERVATION ONLY. ${eligibility}. ${state.blockedFailureCount} blocked failures and ${state.blockedUnknownCount} blocked unknowns. Blocked rules: ${blockedRuleText}. Simulation data is not included.`;
      if (new TextEncoder().encode(blockedRuleText).byteLength > 4096
        || new TextEncoder().encode(description).byteLength > 4096) {
        throw new ProductionConstraintObservationArtifactErrorV1("resource_limit");
      }
      content = _renderCandidateCircuitSvgV2FromProjection(
        exact.result,
        exact.candidate,
        circuit,
        {
          metadataId: OBSERVATION_SVG_METADATA_ID,
          canonicalMetadata: canonicalDesignV2Payload(metadata),
          headerLines: [
            "OBSERVATION ONLY",
            `Eligibility: ${eligibility} · blocked failures: ${state.blockedFailureCount} · blocked unknowns: ${state.blockedUnknownCount}`,
            `Blocked rules: ${blockedRuleText}`,
            `Decision hash: ${state.contentHash}`,
            `Policy: ${state.policy.constraintPolicy} · ${state.policy.contentHash}`,
          ],
          description,
        },
      );
      mimeType = "image/svg+xml;charset=utf-8";
      suffix = "structural-schematic.svg";
    }
    assertObservationArtifactByteLimit(content);
    return {
      artifact: Object.freeze({
        kind,
        filename: artifactName(exact.result, exact.candidate.id, suffix),
        mimeType,
        content,
      }),
      metadata,
    };
  } catch (error) {
    if (error instanceof ProductionConstraintObservationArtifactErrorV1) throw error;
    throw new ProductionConstraintObservationArtifactErrorV1("render_failed");
  }
}

function artifactName(
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  suffix: string,
): string {
  const application = result.request.application.replaceAll(".", "-");
  const candidate = candidateId.slice(-12);
  return `schemagic-${application}-${candidate}-${suffix}`;
}

function scenarioArtifactName(
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  scenarioId: string,
): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(scenarioId)) {
    throw new TypeError("Production scenario ID is not a safe artifact token");
  }
  return artifactName(result, candidateId, `${scenarioId.replaceAll(/[^A-Za-z0-9]+/gu, "-")}-behavioral.cir`);
}

/**
 * Lazily load the Power-only physical implementation contract so ordinary
 * electrical, behavioral, SVG, report, and KiCad exports do not pull its
 * inspection runtime into the browser. The loaded V2 creator still performs
 * exact result/context verification and the serializer reparses its output.
 */
export async function exportProductionPowerPhysicalHandoffArtifactV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): Promise<ProductionDesignArtifactV2> {
  const result = parseDesignResultV2(resultInput);
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new TypeError("Production artifact candidate is absent from the exact result");
  const {
    createPowerPhysicalImplementationHandoffV2,
    serializePowerPhysicalImplementationHandoffV2,
  } = await import("./power-physical-implementation-handoff-v2");
  const handoff = createPowerPhysicalImplementationHandoffV2(result, candidateId, engineeringContext);
  return Object.freeze({
    kind: "physical_handoff_json",
    filename: artifactName(result, candidateId, "physical-implementation-handoff-v2.json"),
    mimeType: "application/json;charset=utf-8",
    content: serializePowerPhysicalImplementationHandoffV2(handoff),
  });
}

/**
 * Emit only deterministic artifacts whose exact V2 result and engineering
 * context are revalidated by the underlying exporter. Structural KiCad also
 * requires the caller's execution context when authored scenarios exist; a
 * scenario-free result records execution coverage as not applicable. It still
 * contains no footprints, simulation samples, or external KiCad attestation.
 */
export function exportProductionDesignArtifactV2(
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  kind: ProductionDesignArtifactKindV2,
  options: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    executionContext?: DesignResultExecutionContextV2;
    scenarioId?: string;
    constraintDecision?: Readonly<ConstraintDecisionV3>;
  }>,
): ProductionDesignArtifactV2 {
  const result = parseDesignResultV2(resultInput);
  const candidate = result.candidates.find((entry) => entry.id === candidateId);
  if (candidate === undefined) throw new TypeError("Production artifact candidate is absent from the exact result");
  const circuitId = candidate.circuit.defaultCircuitId;

  if (options.constraintDecision !== undefined) {
    if (kind !== "electrical_bom_csv" && kind !== "structural_svg") {
      throw new ProductionConstraintObservationArtifactErrorV1("unsupported_kind");
    }
    return materializeObservationArtifact(
      resultInput,
      candidateId,
      kind,
      options.engineeringContext,
      options.constraintDecision,
    ).artifact;
  }

  switch (kind) {
    case "electrical_bom_csv":
      return Object.freeze({
        kind,
        filename: artifactName(result, candidateId, "electrical-bom.csv"),
        mimeType: "text/csv;charset=utf-8",
        content: exportElectricalBomCsvV2(result, candidateId, options.engineeringContext),
      });
    case "scenario_spice": {
      if (options.executionContext === undefined || options.scenarioId === undefined) {
        throw new TypeError("Behavioral scenario SPICE export requires an exact scenario and execution context");
      }
      const content = exportDesignResultScenarioSpiceV2(result, candidateId, options.scenarioId, {
        engineeringContext: options.engineeringContext,
        executionContext: options.executionContext,
      });
      return Object.freeze({
        kind,
        filename: scenarioArtifactName(result, candidateId, options.scenarioId),
        mimeType: "text/x-spice;charset=utf-8",
        content,
      });
    }
    case "structural_svg":
      return Object.freeze({
        kind,
        filename: artifactName(result, candidateId, "structural-schematic.svg"),
        mimeType: "image/svg+xml;charset=utf-8",
        content: exportDesignResultCircuitSvgV2(result, candidateId, circuitId, options.engineeringContext),
      });
    case "engineering_report_html":
      return Object.freeze({
        kind,
        filename: artifactName(result, candidateId, "engineering-report.html"),
        mimeType: "text/html;charset=utf-8",
        content: exportDesignResultPrintableReportV2(result, candidateId, options.engineeringContext),
      });
    case "structural_kicad": {
      if (options.executionContext === undefined) {
        throw new TypeError("Structural KiCad export requires an exact execution context");
      }
      return Object.freeze({
        kind,
        filename: artifactName(result, candidateId, "structural.kicad_sch"),
        mimeType: "application/x-kicad-schematic;charset=utf-8",
        content: exportDesignResultKicadSchematicV2(result, candidateId, circuitId, {
          engineeringContext: options.engineeringContext,
          executionContext: options.executionContext,
        }),
      });
    }
    case "physical_handoff_json":
      throw new TypeError("Power physical handoff export requires the lazy asynchronous production exporter");
    default:
      throw new TypeError("Unsupported production artifact kind");
  }
}

/**
 * Regenerate and byte-verify one observation-bearing CSV or SVG against the
 * exact V2 result, selected candidate, engineering context, and parsed V3
 * decision. Self-hashes establish integrity; the application leaf remains
 * responsible for asserting its installed policy before export.
 */
export function verifyProductionConstraintObservationArtifactV1(
  artifactInput: unknown,
  resultInput: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
  decisionInput: Readonly<ConstraintDecisionV3>,
): Readonly<ProductionConstraintObservationArtifactMetadataV1> {
  if (!artifactInput || typeof artifactInput !== "object" || Array.isArray(artifactInput)) {
    throw new ProductionConstraintObservationArtifactErrorV1("artifact_unverified");
  }
  const descriptors = Object.getOwnPropertyDescriptors(artifactInput);
  const keys = Reflect.ownKeys(artifactInput);
  const expectedKeys = ["content", "filename", "kind", "mimeType"];
  if (keys.some((key) => typeof key !== "string")
    || (keys as string[]).sort().some((key, index) => key !== expectedKeys[index])
    || expectedKeys.some((key) => {
      const descriptor = descriptors[key];
      return descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true;
    })) {
    throw new ProductionConstraintObservationArtifactErrorV1("artifact_unverified");
  }
  const values = Object.fromEntries(expectedKeys.map((key) => [key, descriptors[key]!.value])) as Record<string, unknown>;
  if ((values.kind !== "electrical_bom_csv" && values.kind !== "structural_svg")
    || typeof values.filename !== "string"
    || typeof values.mimeType !== "string"
    || typeof values.content !== "string") {
    throw new ProductionConstraintObservationArtifactErrorV1("artifact_unverified");
  }
  assertObservationArtifactByteLimit(values.content);
  const expected = materializeObservationArtifact(
    resultInput,
    candidateId,
    values.kind,
    engineeringContext,
    decisionInput,
  );
  if (values.kind !== expected.artifact.kind
    || values.filename !== expected.artifact.filename
    || values.mimeType !== expected.artifact.mimeType
    || values.content !== expected.artifact.content) {
    throw new ProductionConstraintObservationArtifactErrorV1("artifact_unverified");
  }
  return expected.metadata;
}
