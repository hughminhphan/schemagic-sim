import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRIMARY_PART_CUSTOMIZED_RESULT_MAX_BYTES,
  PrimaryPartCustomizedResultParseErrorV1,
  calculateConstraintDecisionV3ContentHash,
  calculatePrimaryPartCustomizedResultContentHash,
  canonicalDesignResultV2ContentHash,
  canonicalElectricalDesignRequestV2Payload,
  canonicalPrimaryPartCustomizedResultPayload,
  createPrimaryPartCustomizationSidecarV1,
  createPrimaryPartCustomizedResultSidecarV1,
  designRequestHashV2,
  designSha256ContentHash,
  migrateDesignRequestV1ToV2,
  parsePrimaryPartCustomizedResultSidecarV1,
  parseDesignResultV2,
  serializePrimaryPartCustomizedResultSidecarV1,
  type ConstraintDecisionV3,
  type DesignCandidateV2,
  type DesignResultV2,
  type PrimaryPartCustomizedResultDraftV1,
  type Sha256ContentHash,
} from "../src";

const hash = (character: string): Sha256ContentHash => (
  `sha256:${character.repeat(64)}` as Sha256ContentHash
);
const candidateId = (character: string) => `candidate:v2:${hash(character)}` as const;

function request() {
  const source = JSON.parse(readFileSync(
    new URL("./fixtures/requests/m1-compact.design-request.json", import.meta.url),
    "utf8",
  ));
  const migration = migrateDesignRequestV1ToV2(source, "reviewed-release");
  if (migration.status !== "migrated" || migration.request.application !== "motor.brushed-dc") {
    throw new Error("Expected a migrated Motor request");
  }
  return migration.request;
}

function targetCandidate(requestHash: Sha256ContentHash): DesignCandidateV2 {
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
      part: { manufacturerId: "vendor", manufacturerPartNumber: "TARGET" },
      quantityPerAssembly: 1,
      evidence: [],
    }],
    derivedValues: [],
    constraints: [],
    metrics: { values: [], warningCount: 0, estimateCount: 0, unknownCount: 0 },
    simulationCoverage: [],
    circuit: {
      format: "opencircuit-circuit",
      version: 2,
      meta: { title: "Schema-only target projection" },
      designBlocks: [],
      circuits: [{
        id: "main",
        title: "Schema-only target projection",
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
      reason: "Schema fixture does not author a physical target instance.",
    }],
    warnings: [],
  };
}

function draft(): PrimaryPartCustomizedResultDraftV1 {
  const boundRequest = request();
  const instructionRequestHash = designRequestHashV2(boundRequest);
  const candidate = targetCandidate(instructionRequestHash);
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
        sourceStatus: "unknown",
        truth: "unknown",
        criticality: "safety",
        disposition: "blocked_unknown",
        policyRationale: "Unknown safety evidence blocks eligibility.",
      }],
      eligible: false,
    }],
    eligibleCandidateIds: [],
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
  return {
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
}

describe("primary-part customized result sidecar", () => {
  it("round-trips a self-hashed target-only policy projection", () => {
    const sidecar = createPrimaryPartCustomizedResultSidecarV1(draft());
    const source = serializePrimaryPartCustomizedResultSidecarV1(sidecar);
    expect(parsePrimaryPartCustomizedResultSidecarV1(JSON.parse(source))).toEqual(sidecar);
    expect(source).toContain('"ordinaryGenerationMutation":"none"');
    expect(sidecar.contentHash).toBe(calculatePrimaryPartCustomizedResultContentHash(sidecar));
    expect(canonicalPrimaryPartCustomizedResultPayload(sidecar)).not.toContain(sidecar.contentHash);
    expect(Object.isFrozen(sidecar)).toBe(true);
    expect(Object.isFrozen(sidecar.targetResultProjection.candidates[0]!.circuit)).toBe(true);
    expect(Object.isFrozen(sidecar.constraintDecision)).toBe(true);
  });

  it("rejects root, target, policy, source, and claim-boundary tampering", () => {
    const sidecar = createPrimaryPartCustomizedResultSidecarV1(draft());
    const mutations: unknown[] = [
      { ...sidecar, contentHash: hash("0") },
      { ...sidecar, source: { ...sidecar.source, candidateId: candidateId("f") } },
      { ...sidecar, claimBoundary: { ...sidecar.claimBoundary, ranking: "recomputed" } },
      {
        ...sidecar,
        targetResultProjection: {
          ...sidecar.targetResultProjection,
          candidates: [{ ...sidecar.targetResultProjection.candidates[0]!, warnings: ["forged"] }],
        },
      },
      {
        ...sidecar,
        constraintDecision: {
          ...sidecar.constraintDecision,
          policy: { ...sidecar.constraintDecision.policy, contentHash: hash("f") },
        },
      },
    ];
    for (const mutation of mutations) {
      expect(() => parsePrimaryPartCustomizedResultSidecarV1(mutation))
        .toThrow(PrimaryPartCustomizedResultParseErrorV1);
    }
  });

  it("fails with a resource-limit code before accepting oversized nested input", () => {
    const oversized = structuredClone(createPrimaryPartCustomizedResultSidecarV1(draft()));
    oversized.targetResultProjection.candidates[0]!.warnings = [
      "x".repeat(PRIMARY_PART_CUSTOMIZED_RESULT_MAX_BYTES + 1),
    ];
    try {
      parsePrimaryPartCustomizedResultSidecarV1(oversized);
      throw new Error("Expected a resource limit");
    } catch (error) {
      expect(error).toBeInstanceOf(PrimaryPartCustomizedResultParseErrorV1);
      expect((error as PrimaryPartCustomizedResultParseErrorV1).code).toBe("resource_limit");
    }
  });
});
