import { readFileSync } from "node:fs";
import {
  calculateConstraintDecisionV3ContentHash,
  canonicalDesignResultV2ContentHash,
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
import * as rootPublicSurface from "../src/index";
import * as customizedArtifactPublicSurface from "../src/primary-part-customized-artifact-v1-public";
import {
  PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1,
  exportPrimaryPartCustomizedArtifactV1,
  type PrimaryPartCustomizedReplayableArtifactKindV1,
} from "../src/primary-part-customized-artifact-v1";
import {
  CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1,
  CustomizedTargetInspectionReceiptErrorV1,
  calculateCustomizedTargetInspectionReceiptContentHashV1,
  createCustomizedTargetInspectionReceiptV1,
  parseCustomizedTargetInspectionReceiptV1,
  parseCustomizedTargetInspectionReceiptV1Bytes,
  parseCustomizedTargetInspectionReceiptV1Text,
  serializeCustomizedTargetInspectionReceiptV1,
  verifyCustomizedTargetInspectionReceiptV1,
  type CustomizedTargetInspectionReceiptV1,
} from "../src/customized-target-inspection-receipt-v1";

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
      version: 2,
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

function customizedResult(
  manufacturerPartNumber = "TARGET",
): PrimaryPartCustomizedResultSidecarV1 {
  const boundRequest = request();
  const instructionRequestHash = designRequestHashV2(boundRequest);
  const candidate = targetCandidate(instructionRequestHash, manufacturerPartNumber);
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

function expectReceiptError(
  callback: () => unknown,
  code: CustomizedTargetInspectionReceiptErrorV1["code"],
  path?: string,
): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(CustomizedTargetInspectionReceiptErrorV1);
    expect((error as CustomizedTargetInspectionReceiptErrorV1).code).toBe(code);
    if (path !== undefined) expect((error as CustomizedTargetInspectionReceiptErrorV1).path).toBe(path);
    return;
  }
  throw new Error(`Expected ${code}`);
}

function rehash(receipt: CustomizedTargetInspectionReceiptV1): CustomizedTargetInspectionReceiptV1 {
  (receipt as { contentHash: Sha256ContentHash }).contentHash =
    calculateCustomizedTargetInspectionReceiptContentHashV1(receipt);
  return receipt;
}

describe("customized-target inspection receipt V1", () => {
  it("round-trips one bounded canonical receipt with both exact artifact descriptors", () => {
    const sidecar = customizedResult();
    const receipt = createCustomizedTargetInspectionReceiptV1(sidecar);
    const kinds: PrimaryPartCustomizedReplayableArtifactKindV1[] = [
      "customized_target_electrical_bom_csv",
      "customized_target_structural_svg",
    ];

    expect(receipt).toMatchObject({
      format: "schemagic-customized-target-inspection-receipt",
      schemaVersion: 1,
      customizedResult: sidecar,
      claimBoundary: {
        purpose: "inspection_only",
        artifactReplay: "required",
        parseAndSelfHash: "integrity_only",
        installedContextAuthority: "not_conferred",
        ordinaryResultEvidence: "not_evidence",
        eligibilityEvidence: "not_evidence",
        rankingEvidence: "not_evidence",
        selectedPartModel: "not_added",
        simulationData: "not_included",
        commercialAuthority: "not_added",
        attestation: "none",
      },
    });
    expect(receipt.artifacts.map((artifact) => artifact.kind)).toEqual(kinds);
    for (const [index, kind] of kinds.entries()) {
      const artifact = exportPrimaryPartCustomizedArtifactV1(sidecar, kind);
      expect(receipt.artifacts[index]).toEqual({
        kind,
        filename: artifact.filename,
        mimeType: artifact.mimeType,
        utf8ByteLength: new TextEncoder().encode(artifact.content).byteLength,
        utf8Sha256: designSha256ContentHash(artifact.content),
      });
    }
    expect(receipt.contentHash)
      .toBe(calculateCustomizedTargetInspectionReceiptContentHashV1(receipt));
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt.customizedResult)).toBe(true);
    expect(Object.isFrozen(receipt.artifacts)).toBe(true);
    expect(Object.isFrozen(receipt.artifacts[0])).toBe(true);

    const serialized = serializeCustomizedTargetInspectionReceiptV1(receipt);
    expect(new TextEncoder().encode(serialized).byteLength)
      .toBeLessThanOrEqual(CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1);
    expect(parseCustomizedTargetInspectionReceiptV1Text(serialized)).toEqual(receipt);
    expect(parseCustomizedTargetInspectionReceiptV1Bytes(new TextEncoder().encode(serialized)))
      .toEqual(receipt);
    expect(serializeCustomizedTargetInspectionReceiptV1(
      parseCustomizedTargetInspectionReceiptV1(JSON.parse(serialized)),
    )).toBe(serialized);
    expect(verifyCustomizedTargetInspectionReceiptV1(receipt)).toEqual(receipt);
  });

  it("rejects fixed-field and root self-hash drift even after an attacker rehashes the envelope", () => {
    const receipt = createCustomizedTargetInspectionReceiptV1(customizedResult());

    const format = structuredClone(receipt) as any;
    format.format = "schemagic-production-receipt";
    rehash(format);
    expectReceiptError(() => parseCustomizedTargetInspectionReceiptV1(format), "invalid_receipt", "/format");

    const boundary = structuredClone(receipt) as any;
    boundary.claimBoundary.installedContextAuthority = "installed";
    rehash(boundary);
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1(boundary),
      "invalid_receipt",
      "/claimBoundary/installedContextAuthority",
    );

    const replay = structuredClone(receipt) as any;
    replay.claimBoundary.artifactReplay = "optional";
    rehash(replay);
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1(replay),
      "invalid_receipt",
      "/claimBoundary/artifactReplay",
    );

    const contentHash = structuredClone(receipt);
    (contentHash as { contentHash: Sha256ContentHash }).contentHash = hash("f");
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1(contentHash),
      "invalid_receipt",
      "/contentHash",
    );
  });

  it("treats parse/hash validity as integrity only and requires artifact replay", () => {
    const receipt = createCustomizedTargetInspectionReceiptV1(customizedResult());

    for (const index of [0, 1]) {
      const forgedHash = structuredClone(receipt);
      (forgedHash.artifacts[index] as { utf8Sha256: Sha256ContentHash }).utf8Sha256 = hash(
        index === 0 ? "c" : "d",
      );
      rehash(forgedHash);
      expect(parseCustomizedTargetInspectionReceiptV1(forgedHash)).toEqual(forgedHash);
      expectReceiptError(
        () => verifyCustomizedTargetInspectionReceiptV1(forgedHash),
        "artifact_descriptor_mismatch",
        "/artifacts",
      );
    }

    const forgedBytes = structuredClone(receipt);
    (forgedBytes.artifacts[0] as { utf8ByteLength: number }).utf8ByteLength += 1;
    rehash(forgedBytes);
    expect(parseCustomizedTargetInspectionReceiptV1(forgedBytes)).toEqual(forgedBytes);
    expectReceiptError(
      () => verifyCustomizedTargetInspectionReceiptV1(forgedBytes),
      "artifact_descriptor_mismatch",
      "/artifacts",
    );

    const forgedFilename = structuredClone(receipt);
    (forgedFilename.artifacts[1] as { filename: string }).filename =
      `schemagic-forged${forgedFilename.artifacts[1]!.filename.slice("schemagic".length)}`;
    rehash(forgedFilename);
    expect(parseCustomizedTargetInspectionReceiptV1(forgedFilename)).toEqual(forgedFilename);
    expectReceiptError(
      () => verifyCustomizedTargetInspectionReceiptV1(forgedFilename),
      "artifact_descriptor_mismatch",
      "/artifacts",
    );

    const forgedMime = structuredClone(receipt) as any;
    forgedMime.artifacts[0].mimeType = "image/svg+xml;charset=utf-8";
    rehash(forgedMime);
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1(forgedMime),
      "invalid_receipt",
      "/artifacts/0/mimeType",
    );
  });

  it("rejects invalid embedded sidecars and replay-mismatches a different valid sidecar", () => {
    const receipt = createCustomizedTargetInspectionReceiptV1(customizedResult());

    const invalidSidecar = structuredClone(receipt);
    invalidSidecar.customizedResult.targetResultProjection.candidates[0]!.warnings.push("forged");
    rehash(invalidSidecar);
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1(invalidSidecar),
      "invalid_receipt",
      "/customizedResult",
    );

    const differentValidSidecar = structuredClone(receipt);
    (differentValidSidecar as { customizedResult: PrimaryPartCustomizedResultSidecarV1 })
      .customizedResult = customizedResult("DIFFERENT-TARGET");
    rehash(differentValidSidecar);
    expect(parseCustomizedTargetInspectionReceiptV1(differentValidSidecar))
      .toEqual(differentValidSidecar);
    expectReceiptError(
      () => verifyCustomizedTargetInspectionReceiptV1(differentValidSidecar),
      "artifact_descriptor_mismatch",
      "/artifacts",
    );
  });

  it("rejects descriptor order drift and noncanonical serialized key order", () => {
    const receipt = createCustomizedTargetInspectionReceiptV1(customizedResult());

    const reversed = structuredClone(receipt);
    (reversed as { artifacts: typeof reversed.artifacts }).artifacts = [
      reversed.artifacts[1]!,
      reversed.artifacts[0]!,
    ];
    rehash(reversed);
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1(reversed),
      "invalid_receipt",
      "/artifacts/0/kind",
    );

    const { format, ...remainingFields } = receipt;
    const noncanonicalText = JSON.stringify({ format, ...remainingFields });
    expect(JSON.parse(noncanonicalText)).toEqual(receipt);
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1Text(noncanonicalText),
      "noncanonical_serialization",
    );
  });

  it("rejects extra keys at the receipt and descriptor boundaries", () => {
    const receipt = createCustomizedTargetInspectionReceiptV1(customizedResult());

    const rootExtra = { ...structuredClone(receipt), unexpected: true } as any;
    rehash(rootExtra);
    expectReceiptError(() => parseCustomizedTargetInspectionReceiptV1(rootExtra), "invalid_receipt", "");

    const descriptorExtra = structuredClone(receipt) as any;
    descriptorExtra.artifacts[0].authority = "installed";
    rehash(descriptorExtra);
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1(descriptorExtra),
      "invalid_receipt",
      "/artifacts/0",
    );
  });

  it("fails closed before parsing oversized object or serialized inputs", () => {
    const descriptorSize = structuredClone(
      createCustomizedTargetInspectionReceiptV1(customizedResult()),
    );
    (descriptorSize.artifacts[0] as { utf8ByteLength: number }).utf8ByteLength =
      PRIMARY_PART_CUSTOMIZED_ARTIFACT_MAX_BYTES_V1 + 1;
    rehash(descriptorSize);
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1(descriptorSize),
      "invalid_receipt",
      "/artifacts/0/utf8ByteLength",
    );

    const receipt = structuredClone(
      createCustomizedTargetInspectionReceiptV1(customizedResult()),
    ) as any;
    receipt.artifacts[0].filename = "x".repeat(
      CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1 + 1,
    );
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1(receipt),
      "resource_limit",
    );
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1Text(
        "x".repeat(CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1 + 1),
      ),
      "resource_limit",
    );
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1Bytes(
        new Uint8Array(CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1 + 1),
      ),
      "resource_limit",
    );
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1Bytes(new Uint8Array([0xff])),
      "invalid_receipt",
    );
    const canonicalBytes = new TextEncoder().encode(serializeCustomizedTargetInspectionReceiptV1(
      createCustomizedTargetInspectionReceiptV1(customizedResult()),
    ));
    const bomPrefixed = new Uint8Array(canonicalBytes.byteLength + 3);
    bomPrefixed.set([0xef, 0xbb, 0xbf]);
    bomPrefixed.set(canonicalBytes, 3);
    expectReceiptError(
      () => parseCustomizedTargetInspectionReceiptV1Bytes(bomPrefixed),
      "invalid_receipt",
    );
  });

  it("keeps every receipt runtime function and constant off public package surfaces", () => {
    const packageDocument = JSON.parse(readFileSync(
      new URL("../package.json", import.meta.url),
      "utf8",
    )) as { exports: Record<string, string> };
    expect(packageDocument.exports).not.toHaveProperty("./customized-target-inspection-receipt-v1");
    expect(Object.keys(customizedArtifactPublicSurface)).toEqual([]);

    for (const forbidden of [
      "CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1",
      "CustomizedTargetInspectionReceiptErrorV1",
      "calculateCustomizedTargetInspectionReceiptContentHashV1",
      "canonicalCustomizedTargetInspectionReceiptPayloadV1",
      "createCustomizedTargetInspectionReceiptV1",
      "parseCustomizedTargetInspectionReceiptV1",
      "parseCustomizedTargetInspectionReceiptV1Bytes",
      "parseCustomizedTargetInspectionReceiptV1Text",
      "serializeCustomizedTargetInspectionReceiptV1",
      "verifyCustomizedTargetInspectionReceiptV1",
    ]) {
      expect(rootPublicSurface).not.toHaveProperty(forbidden);
      expect(customizedArtifactPublicSurface).not.toHaveProperty(forbidden);
    }
  });
});
