import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as motorCustomizationRuntime from "../src/v3-motor-runtime";
import * as powerCustomizationRuntime from "../src/v3-power-runtime";
import {
  buildReviewedProfileCatalogV2,
  listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1,
  PrimaryPartCustomizationEvaluationErrorV1,
  type DesignRecipeV2,
  validateDesignResultEngineeringContextV2,
} from "../src/index";
import {
  generateElectricalDesignV2ForTesting,
  listExactGenerationPrimaryPartCustomizationTargetProfileIdsForTestingV1,
} from "../src/v2-testing";
import {
  assertMotorPrimaryPartCustomizedResultWithInstalledPolicyV1,
  evaluateMotorPrimaryPartCustomizationWithInstalledPolicyV1,
  generateMotorPrimaryPartCustomizedResultWithInstalledPolicyV1,
  getInstalledMotorConstraintPolicyCatalogV3,
} from "../src/v3-motor-runtime";
import { designProfileEnvelopeContentHash, designProfileId } from "@opencircuit/design-library/v2-runtime";
import {
  canonicalDesignV2Payload,
  canonicalElectricalDesignRequestV2Payload,
  createPrimaryPartCustomizationSidecarV1,
  designSha256ContentHash,
  migrateDesignRequestV1ToV2,
  type PrimaryPartCustomizationDraftV1,
} from "@opencircuit/design-schema";
import { generateMotorDesignV2, getMotorDesignContextV2 } from "@opencircuit/motor-designer/v2";
import { createInstalledMotorRecipeSet } from "@opencircuit/design-recipes/motor-engine-internal";

const DRV8262_PROFILE_ID =
  "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json";

function fixtureRequest() {
  const context = getMotorDesignContextV2();
  const source = JSON.parse(readFileSync(
    new URL("../../design-schema/test/fixtures/requests/m1-compact.design-request.json", import.meta.url),
    "utf8",
  ));
  const migration = migrateDesignRequestV1ToV2(source, context.manifest.version);
  if (migration.status !== "migrated" || migration.request.application !== "motor.brushed-dc") {
    throw new Error("Expected a migrated Motor request");
  }
  const request = structuredClone(migration.request);
  request.constraints.allowUnknownHardConstraints = true;
  request.requirements.stallCurrent.value = 3;
  if (request.requirements.motorModel.windingResistance !== null) {
    request.requirements.motorModel.windingResistance.value = 4;
  }
  return request;
}

function setup() {
  const context = getMotorDesignContextV2();
  const request = fixtureRequest();
  const generation = generateMotorDesignV2(request);
  const sourceCandidate = generation.result.candidates.find((candidate) => (
    candidate.recipeId === "motor.native.integrated-h-bridge.facts-v3-2"
    && candidate.components.some((component) => component.id === "primary")
  ));
  if (!sourceCandidate) throw new Error("Expected a retained integrated Motor candidate");
  const sourcePrimary = sourceCandidate.components.find((component) => component.id === "primary")!;
  const catalog = buildReviewedProfileCatalogV2(context.catalogDocuments);
  const sourceProfile = catalog.profiles.find((profile) => designProfileId(profile.partClass, profile.part) === sourcePrimary.profileId);
  const targetProfile = catalog.profiles.find((profile) => (
    profile.partClass === sourceProfile?.partClass
    && profile.factsSchemaVersion === sourceProfile.factsSchemaVersion
    && designProfileId(profile.partClass, profile.part) !== sourcePrimary.profileId
    && designProfileId(profile.partClass, profile.part) !== DRV8262_PROFILE_ID
  ));
  if (!sourceProfile || !targetProfile) throw new Error("Expected two compatible integrated Motor profiles");
  const recipe = context.manifest.recipes.find((entry) => entry.id === sourceCandidate.recipeId)!;
  const policy = getInstalledMotorConstraintPolicyCatalogV3();
  const draft: PrimaryPartCustomizationDraftV1 = {
    format: "schemagic-designer-primary-part-customization",
    schemaVersion: 1,
    application: request.application,
    requestHash: generation.result.requestHash,
    requestByteContentHash: designSha256ContentHash(canonicalElectricalDesignRequestV2Payload(request)),
    sourceResultContentHash: generation.result.contentHash,
    sourceCandidateId: sourceCandidate.id,
    context: {
      libraryVersion: context.manifest.version,
      contextManifestContentHash: context.manifest.contentHash,
      catalog: { ...context.manifest.catalog },
      recipe: { id: recipe.id, version: recipe.version, contentHash: recipe.contentHash },
      constraintPolicy: { id: "production_strict_v1", contentHash: policy.contentHash },
    },
    substitution: {
      role: "primary",
      sourceProfile: { profileId: sourcePrimary.profileId, contentHash: designProfileEnvelopeContentHash(sourceProfile) },
      targetProfile: { profileId: designProfileId(targetProfile.partClass, targetProfile.part), contentHash: designProfileEnvelopeContentHash(targetProfile) },
    },
  };
  return { context, generation, sourceCandidate, draft };
}

describe("exact primary-part customization evaluator", () => {
  it("does not expose misleading installed-context customization helper names", () => {
    expect(motorCustomizationRuntime).not.toHaveProperty(
      "generateInstalledMotorPrimaryPartCustomizedResultV1",
    );
    expect(motorCustomizationRuntime).not.toHaveProperty(
      "assertInstalledMotorPrimaryPartCustomizedResultV1",
    );
    expect(powerCustomizationRuntime).not.toHaveProperty(
      "generateInstalledPowerPrimaryPartCustomizedResultV1",
    );
    expect(powerCustomizationRuntime).not.toHaveProperty(
      "assertInstalledPowerPrimaryPartCustomizedResultV1",
    );
    expect(motorCustomizationRuntime).not.toHaveProperty(
      "evaluateInstalledMotorPrimaryPartCustomizationV1",
    );
    expect(motorCustomizationRuntime).not.toHaveProperty(
      "evaluateInstalledMotorConstraintDecisionV3",
    );
    expect(motorCustomizationRuntime).not.toHaveProperty(
      "assertInstalledMotorConstraintDecisionContextV3",
    );
    expect(powerCustomizationRuntime).not.toHaveProperty(
      "evaluateInstalledPowerPrimaryPartCustomizationV1",
    );
    expect(powerCustomizationRuntime).not.toHaveProperty(
      "evaluateInstalledPowerConstraintDecisionV3",
    );
    expect(powerCustomizationRuntime).not.toHaveProperty(
      "assertInstalledPowerConstraintDecisionContextV3",
    );
  });

  it("reuses only the exact in-process pre-Pareto generation witness for target discovery", () => {
    const { generation, sourceCandidate, draft } = setup();

    const targetProfileIds = listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1(
      generation,
      sourceCandidate.id,
    );
    expect(targetProfileIds).toEqual([draft.substitution.targetProfile.profileId]);
    expect(targetProfileIds).not.toContain(DRV8262_PROFILE_ID);
    expect(generation.result.candidates.some((candidate) => candidate.components.some((component) => (
      component.id === "primary" && component.profileId === DRV8262_PROFILE_ID
    )))).toBe(false);
    const exactDrv8262Rejections = generation.execution.rejections.filter((rejection) => (
      rejection.stage === "match"
      && rejection.componentProfileIds.includes(DRV8262_PROFILE_ID)
    ));
    expect(exactDrv8262Rejections).toHaveLength(10);
    expect(exactDrv8262Rejections.every((rejection) => (
      rejection.reasonCode === "recipe_rejected"
      && rejection.recipeReason.startsWith("companion_network_unrepresentable:")
      && rejection.constraints.some((constraint) => (
        constraint.ruleId === "motor.integrated.companion-network-representability"
        && constraint.status === "fail"
      ))
    ))).toBe(true);
    expect(listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1(
      generation,
      `candidate:v2:sha256:${"0".repeat(64)}`,
    )).toEqual([]);
    expect(listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1(
      structuredClone(generation),
      sourceCandidate.id,
    )).toBeUndefined();
  }, 30_000);

  it("omits a structurally compatible target when the exact pre-Pareto witness is ambiguous", () => {
    const baseline = setup();
    const targetProfileId = baseline.draft.substitution.targetProfile.profileId;
    const sourceProfileId = baseline.draft.substitution.sourceProfile.profileId;
    const productionContext = getMotorDesignContextV2();
    const recipes = createInstalledMotorRecipeSet().map((recipe) => {
      if (recipe.id !== baseline.sourceCandidate.recipeId) return recipe as DesignRecipeV2;
      const original = recipe as DesignRecipeV2;
      return {
        ...original,
        match(option, environment) {
          return original.match(option, environment).flatMap((outcome) => {
            if (
              outcome.status !== "ok"
              || !outcome.value.components.some((component) => (
                component.id === "primary" && component.profileId === targetProfileId
              ))
            ) return [outcome];
            return [
              outcome,
              {
                status: "ok" as const,
                value: {
                  ...outcome.value,
                  data: { ...outcome.value.data, testAmbiguityMarker: "duplicate" },
                },
              },
            ];
          });
        },
      } satisfies DesignRecipeV2;
    });
    const generation = generateElectricalDesignV2ForTesting(fixtureRequest(), {
      testOnly: true,
      manifest: productionContext.manifest,
      catalog: buildReviewedProfileCatalogV2(productionContext.catalogDocuments),
      rankingPolicy: productionContext.rankingPolicy,
      recipes,
    });
    const sourceCandidate = generation.result.candidates.find((candidate) => (
      candidate.recipeId === baseline.sourceCandidate.recipeId
      && candidate.components.some((component) => (
        component.id === "primary" && component.profileId === sourceProfileId
      ))
    ));
    if (!sourceCandidate) throw new Error("Expected an unambiguous source candidate");

    expect(listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1(
      generation,
      sourceCandidate.id,
    )).toBeUndefined();
    expect(listExactGenerationPrimaryPartCustomizationTargetProfileIdsForTestingV1(
      generation,
      sourceCandidate.id,
    )).toEqual([]);
    expect(listExactGenerationPrimaryPartCustomizationTargetProfileIdsForTestingV1(
      structuredClone(generation),
      sourceCandidate.id,
    )).toBeUndefined();
  }, 30_000);

  it("recovers one fully materialized pre-Pareto target without changing the ordinary generation", () => {
    const { context, generation, sourceCandidate, draft } = setup();
    const before = canonicalDesignV2Payload(generation);
    const instruction = createPrimaryPartCustomizationSidecarV1(draft);
    const observation = evaluateMotorPrimaryPartCustomizationWithInstalledPolicyV1(instruction, generation, context);

    expect(canonicalDesignV2Payload(generation)).toBe(before);
    expect(observation.baseGeneration).toEqual(generation);
    expect(observation.sourceCandidate).toEqual(sourceCandidate);
    expect(observation.instructionContentHash).toBe(instruction.contentHash);
    expect(observation.targetCandidate.id).not.toBe(sourceCandidate.id);
    expect(observation.targetCandidate.recipeId).toBe(sourceCandidate.recipeId);
    expect(observation.targetCandidate.components.find((component) => component.id === "primary")?.profileId)
      .toBe(draft.substitution.targetProfile.profileId);
    expect(observation.targetCandidate.components.filter((component) => component.id !== "primary"))
      .toEqual(sourceCandidate.components.filter((component) => component.id !== "primary"));
    expect(observation.claimBoundary).toEqual({
      constraintPolicyEligibility: "not_evaluated",
      selectedPartModel: "not_added",
    });
    expect(Object.isFrozen(observation)).toBe(true);
    expect(Object.isFrozen(observation.baseGeneration.result)).toBe(true);
    expect(Object.isFrozen(observation.targetCandidate.circuit)).toBe(true);
  }, 30_000);

  it("builds a distinct target-only result and evaluates it under the installed policy", () => {
    const { context, generation, sourceCandidate, draft } = setup();
    const ordinaryBytes = canonicalDesignV2Payload(generation);
    const instruction = createPrimaryPartCustomizationSidecarV1(draft);
    const customized = generateMotorPrimaryPartCustomizedResultWithInstalledPolicyV1(
      instruction,
      generation,
      context,
    );

    expect(canonicalDesignV2Payload(generation)).toBe(ordinaryBytes);
    expect(customized.source).toMatchObject({
      resultContentHash: generation.result.contentHash,
      candidateId: sourceCandidate.id,
    });
    expect(customized.targetResultProjection.candidates).toHaveLength(1);
    expect(customized.targetResultProjection.rejectedCandidates).toEqual([]);
    expect(customized.targetResultProjection.diagnostics).toEqual([]);
    const target = customized.targetResultProjection.candidates[0]!;
    expect(target.id).not.toBe(sourceCandidate.id);
    expect(target.components.find((component) => component.id === "primary")?.profileId)
      .toBe(draft.substitution.targetProfile.profileId);
    expect(customized.constraintDecision.source).toEqual({
      schemaVersion: 2,
      resultContentHash: customized.targetResultProjection.contentHash,
      candidateIds: [target.id],
    });
    expect(customized.constraintDecision.policy.contentHash)
      .toBe(getInstalledMotorConstraintPolicyCatalogV3().contentHash);
    expect(customized.constraintDecision.candidates).toHaveLength(1);
    expect(customized.constraintDecision.candidates[0]!.eligible).toBe(false);
    expect(customized.claimBoundary).toEqual({
      ordinaryGenerationMutation: "none",
      targetConstraintPolicyEligibility: "evaluated",
      ranking: "not_recomputed",
      selectedPartModel: "not_added",
      commercialAuthority: "not_added",
    });
    expect(validateDesignResultEngineeringContextV2(customized.targetResultProjection, context))
      .not.toEqual([]);
    expect(assertMotorPrimaryPartCustomizedResultWithInstalledPolicyV1(customized, generation, context))
      .toEqual(customized);
    expect(Object.isFrozen(customized)).toBe(true);
    expect(Object.isFrozen(customized.constraintDecision)).toBe(true);

    const tampered = structuredClone(customized);
    tampered.targetResultProjection.candidates[0]!.warnings.push("forged warning");
    expect(() => assertMotorPrimaryPartCustomizedResultWithInstalledPolicyV1(
      tampered,
      generation,
      context,
    )).toThrow(PrimaryPartCustomizationEvaluationErrorV1);
  }, 30_000);

  it("fails closed on instruction request/profile bindings and source execution", () => {
    const { context, generation, draft } = setup();
    const expectCode = (run: () => unknown, code: PrimaryPartCustomizationEvaluationErrorV1["code"]) => {
      try { run(); throw new Error("Expected customization failure"); }
      catch (error) {
        expect(error).toBeInstanceOf(PrimaryPartCustomizationEvaluationErrorV1);
        expect((error as PrimaryPartCustomizationEvaluationErrorV1).code).toBe(code);
      }
    };

    expectCode(() => evaluateMotorPrimaryPartCustomizationWithInstalledPolicyV1(
      createPrimaryPartCustomizationSidecarV1({ ...draft, requestByteContentHash: (`sha256:${"0".repeat(64)}`) }),
      generation,
      context,
    ), "invalid_source");
    expectCode(() => evaluateMotorPrimaryPartCustomizationWithInstalledPolicyV1(
      createPrimaryPartCustomizationSidecarV1({
        ...draft,
        substitution: {
          ...draft.substitution,
          targetProfile: { ...draft.substitution.targetProfile, contentHash: (`sha256:${"1".repeat(64)}`) },
        },
      }),
      generation,
      context,
    ), "profile_mismatch");
    expectCode(() => evaluateMotorPrimaryPartCustomizationWithInstalledPolicyV1(
      createPrimaryPartCustomizationSidecarV1(draft),
      { ...generation, execution: { ...generation.execution, counts: { ...generation.execution.counts, recipes: generation.execution.counts.recipes + 1 } } },
      context,
    ), "invalid_source");
  }, 30_000);

  it("rejects a well-formed sidecar carrying a forged installed-policy hash", () => {
    const { context, generation, draft } = setup();
    const forgedPolicyHash = `sha256:${"2".repeat(64)}` as const;
    const instruction = createPrimaryPartCustomizationSidecarV1({
      ...draft,
      context: {
        ...draft.context,
        constraintPolicy: {
          ...draft.context.constraintPolicy,
          contentHash: forgedPolicyHash,
        },
      },
    });

    expect(instruction.context.constraintPolicy.contentHash).toBe(forgedPolicyHash);
    try {
      evaluateMotorPrimaryPartCustomizationWithInstalledPolicyV1(instruction, generation, context);
      throw new Error("Expected installed-policy authorization failure");
    } catch (error) {
      expect(error).toBeInstanceOf(PrimaryPartCustomizationEvaluationErrorV1);
      expect((error as PrimaryPartCustomizationEvaluationErrorV1).code).toBe("policy_mismatch");
      expect((error as PrimaryPartCustomizationEvaluationErrorV1).path).toBe("/context/constraintPolicy");
    }
  }, 30_000);
});
