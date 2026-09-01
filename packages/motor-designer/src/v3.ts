import { designProfileEnvelopeContentHash, designProfileId } from "@opencircuit/design-library/v2-runtime";
import {
  assertMotorConstraintDecisionContextWithInstalledPolicyV3,
  assertMotorPrimaryPartCustomizedResultWithInstalledPolicyV1,
  evaluateMotorConstraintDecisionWithInstalledPolicyV3,
  generateMotorPrimaryPartCustomizedResultWithInstalledPolicyV1,
  getInstalledMotorConstraintPolicyCatalogV3,
} from "@opencircuit/design-engine/v3-motor-runtime";
import {
  canonicalElectricalDesignRequestV2Payload,
  ConstraintParseErrorV3,
  createPrimaryPartCustomizationSidecarV1,
  designSha256ContentHash,
  detachedFrozenDesignV2Value,
  parseElectricalDesignRequestV3,
  projectElectricalDesignRequestV3ToObservationV2,
  type BrushedDcMotorDesignRequestV3,
  type ConstraintDecisionV3,
  type PrimaryPartCustomizationSidecarV1,
  type PrimaryPartCustomizedResultSidecarV1,
} from "@opencircuit/design-schema";
import {
  buildReviewedProfileCatalogV2,
  listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1,
  type DesignGenerationV2,
} from "@opencircuit/design-engine/v2-motor-runtime";
import { generateMotorDesignV2, getMotorDesignContextManifestV2, getMotorDesignContextV2 } from "./v2";

export interface MotorPrimaryPartCustomizationTargetV1 {
  readonly instruction: Readonly<PrimaryPartCustomizationSidecarV1>;
  readonly targetProfile: Readonly<{
    profileId: string;
    contentHash: `sha256:${string}`;
    manufacturerId: string;
    manufacturerPartNumber: string;
  }>;
}

/**
 * Lists only exact same-recipe primary substitutions that the installed Motor
 * generator can recover before Pareto pruning. The returned instruction is
 * inert; target eligibility is evaluated only by the explicit generate call.
 */
export function listMotorPrimaryPartCustomizationTargetsV1(
  sourceGeneration: Readonly<DesignGenerationV2>,
  sourceCandidateId: string,
): readonly MotorPrimaryPartCustomizationTargetV1[] {
  const context = getMotorDesignContextV2();
  const candidate = sourceGeneration.result.candidates.find((entry) => entry.id === sourceCandidateId);
  const sourcePrimary = candidate?.components.filter((component) => component.id === "primary");
  const recipe = candidate === undefined
    ? undefined
    : context.manifest.recipes.find((entry) => entry.id === candidate.recipeId);
  if (candidate === undefined || sourcePrimary?.length !== 1 || recipe === undefined) return Object.freeze([]);
  const witnessedTargetProfileIds = listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1(
    sourceGeneration,
    sourceCandidateId,
  );
  if (witnessedTargetProfileIds === undefined) return Object.freeze([]);
  const witnessedTargetProfileIdSet = new Set(witnessedTargetProfileIds);

  const catalog = buildReviewedProfileCatalogV2(context.catalogDocuments);
  const sourceProfile = catalog.profiles.find((profile) => (
    designProfileId(profile.partClass, profile.part) === sourcePrimary[0]!.profileId
  ));
  if (sourceProfile === undefined) return Object.freeze([]);
  const policy = getInstalledMotorConstraintPolicyCatalogV3();
  const targets: MotorPrimaryPartCustomizationTargetV1[] = [];
  for (const profile of catalog.profiles) {
    const profileId = designProfileId(profile.partClass, profile.part);
    if (
      profileId === sourcePrimary[0]!.profileId
      || profile.partClass !== sourceProfile.partClass
      || profile.factsSchemaVersion !== sourceProfile.factsSchemaVersion
      || !witnessedTargetProfileIdSet.has(profileId)
    ) continue;
    const instruction = createPrimaryPartCustomizationSidecarV1({
      format: "schemagic-designer-primary-part-customization",
      schemaVersion: 1,
      application: "motor.brushed-dc",
      requestHash: sourceGeneration.result.requestHash,
      requestByteContentHash: designSha256ContentHash(
        canonicalElectricalDesignRequestV2Payload(sourceGeneration.result.request),
      ),
      sourceResultContentHash: sourceGeneration.result.contentHash,
      sourceCandidateId: candidate.id,
      context: {
        libraryVersion: context.manifest.version,
        contextManifestContentHash: context.manifest.contentHash,
        catalog: { ...context.manifest.catalog },
        recipe: { id: recipe.id, version: recipe.version, contentHash: recipe.contentHash },
        constraintPolicy: { id: "production_strict_v1", contentHash: policy.contentHash },
      },
      substitution: {
        role: "primary",
        sourceProfile: {
          profileId: sourcePrimary[0]!.profileId,
          contentHash: designProfileEnvelopeContentHash(sourceProfile),
        },
        targetProfile: {
          profileId,
          contentHash: designProfileEnvelopeContentHash(profile),
        },
      },
    });
    targets.push({
      instruction,
      targetProfile: {
        profileId,
        contentHash: designProfileEnvelopeContentHash(profile),
        manufacturerId: profile.part.manufacturerId,
        manufacturerPartNumber: profile.part.manufacturerPartNumber,
      },
    });
  }
  return detachedFrozenDesignV2Value(targets);
}

export function generateMotorPrimaryPartCustomizedResultV1(
  instruction: Readonly<PrimaryPartCustomizationSidecarV1>,
  sourceGeneration: Readonly<DesignGenerationV2>,
): PrimaryPartCustomizedResultSidecarV1 {
  return generateMotorPrimaryPartCustomizedResultWithInstalledPolicyV1(
    instruction,
    sourceGeneration,
    getMotorDesignContextV2(),
  );
}

export function assertMotorPrimaryPartCustomizedResultV1(
  sidecar: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  sourceGeneration: Readonly<DesignGenerationV2>,
): PrimaryPartCustomizedResultSidecarV1 {
  return assertMotorPrimaryPartCustomizedResultWithInstalledPolicyV1(
    sidecar,
    sourceGeneration,
    getMotorDesignContextV2(),
  );
}

/** Reassert one decision against the installed Motor context and policy. */
export function assertMotorProductionConstraintObservationDecisionV3(
  decision: Readonly<ConstraintDecisionV3>,
  source: Readonly<DesignGenerationV2["result"]>,
): ConstraintDecisionV3 {
  return assertMotorConstraintDecisionContextWithInstalledPolicyV3(
    decision,
    source,
    getMotorDesignContextManifestV2(),
  );
}

/**
 * A transient in-process pair of a permissive V2 structural observation and the
 * installed production policy decision. The decision binds the exact result;
 * this wrapper is not a standalone serialized artifact, verification, or claim.
 */
export interface MotorConstraintObservationV3 {
  readonly kind: "production_constraint_observation";
  readonly application: "motor.brushed-dc";
  readonly observation: Readonly<DesignGenerationV2>;
  readonly decision: Readonly<ConstraintDecisionV3>;
}

export function generateMotorConstraintObservationV3(
  requestInput: Readonly<BrushedDcMotorDesignRequestV3>,
): MotorConstraintObservationV3 {
  const request = parseElectricalDesignRequestV3(requestInput);
  if (request.application !== "motor.brushed-dc") {
    throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "/application");
  }
  const projectedRequest = projectElectricalDesignRequestV3ToObservationV2(request);
  if (projectedRequest.application !== "motor.brushed-dc") {
    throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "/application");
  }
  const observation = generateMotorDesignV2(projectedRequest);
  const manifest = getMotorDesignContextManifestV2();
  const decision = evaluateMotorConstraintDecisionWithInstalledPolicyV3(
    observation.result,
    manifest,
  );
  return Object.freeze({
    kind: "production_constraint_observation",
    application: "motor.brushed-dc",
    observation,
    decision,
  });
}
