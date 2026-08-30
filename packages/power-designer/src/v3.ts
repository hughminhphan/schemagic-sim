import { designProfileEnvelopeContentHash, designProfileId } from "@opencircuit/design-library/v2-runtime";
import {
  assertPowerConstraintDecisionContextWithInstalledPolicyV3,
  assertPowerPrimaryPartCustomizedResultWithInstalledPolicyV1,
  evaluatePowerConstraintDecisionWithInstalledPolicyV3,
  generatePowerPrimaryPartCustomizedResultWithInstalledPolicyV1,
  getInstalledPowerConstraintPolicyCatalogV3,
} from "@opencircuit/design-engine/v3-power-runtime";
import {
  buildReviewedProfileCatalogV2,
  listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1,
  type DesignGenerationV2,
} from "@opencircuit/design-engine/v2-power-runtime";
import {
  canonicalElectricalDesignRequestV2Payload,
  ConstraintParseErrorV3,
  createPrimaryPartCustomizationSidecarV1,
  designSha256ContentHash,
  detachedFrozenDesignV2Value,
  parseElectricalDesignRequestV3,
  projectElectricalDesignRequestV3ToObservationV2,
  type BuckDesignRequestV3,
  type ConstraintDecisionV3,
  type PrimaryPartCustomizationSidecarV1,
  type PrimaryPartCustomizedResultSidecarV1,
} from "@opencircuit/design-schema";
import { generateBuckDesignV2, getPowerDesignContextManifestV2, getPowerDesignContextV2 } from "./v2";

export interface PowerPrimaryPartCustomizationTargetV1 {
  readonly instruction: Readonly<PrimaryPartCustomizationSidecarV1>;
  readonly targetProfile: Readonly<{
    profileId: string;
    contentHash: `sha256:${string}`;
    manufacturerId: string;
    manufacturerPartNumber: string;
  }>;
}

/** Power currently has no compatible same-facts-schema primary alternate. */
export function listPowerPrimaryPartCustomizationTargetsV1(
  sourceGeneration: Readonly<DesignGenerationV2>,
  sourceCandidateId: string,
): readonly PowerPrimaryPartCustomizationTargetV1[] {
  const context = getPowerDesignContextV2();
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
  const policy = getInstalledPowerConstraintPolicyCatalogV3();
  const targets: PowerPrimaryPartCustomizationTargetV1[] = [];
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
      application: "power.buck",
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

export function generatePowerPrimaryPartCustomizedResultV1(
  instruction: Readonly<PrimaryPartCustomizationSidecarV1>,
  sourceGeneration: Readonly<DesignGenerationV2>,
): PrimaryPartCustomizedResultSidecarV1 {
  return generatePowerPrimaryPartCustomizedResultWithInstalledPolicyV1(
    instruction,
    sourceGeneration,
    getPowerDesignContextV2(),
  );
}

export function assertPowerPrimaryPartCustomizedResultV1(
  sidecar: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  sourceGeneration: Readonly<DesignGenerationV2>,
): PrimaryPartCustomizedResultSidecarV1 {
  return assertPowerPrimaryPartCustomizedResultWithInstalledPolicyV1(
    sidecar,
    sourceGeneration,
    getPowerDesignContextV2(),
  );
}

/** Reassert one decision against the installed Power context and policy. */
export function assertPowerProductionConstraintObservationDecisionV3(
  decision: Readonly<ConstraintDecisionV3>,
  source: Readonly<DesignGenerationV2["result"]>,
): ConstraintDecisionV3 {
  return assertPowerConstraintDecisionContextWithInstalledPolicyV3(
    decision,
    source,
    getPowerDesignContextManifestV2(),
  );
}

/**
 * A transient in-process pair of a permissive V2 structural observation and the
 * installed production policy decision. The decision binds the exact result;
 * this wrapper is not a standalone serialized artifact, verification, or claim.
 */
export interface BuckConstraintObservationV3 {
  readonly kind: "production_constraint_observation";
  readonly application: "power.buck";
  readonly observation: Readonly<DesignGenerationV2>;
  readonly decision: Readonly<ConstraintDecisionV3>;
}

export function generateBuckConstraintObservationV3(
  requestInput: Readonly<BuckDesignRequestV3>,
): BuckConstraintObservationV3 {
  const request = parseElectricalDesignRequestV3(requestInput);
  if (request.application !== "power.buck") {
    throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "/application");
  }
  const projectedRequest = projectElectricalDesignRequestV3ToObservationV2(request);
  if (projectedRequest.application !== "power.buck") {
    throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "/application");
  }
  const observation = generateBuckDesignV2(projectedRequest);
  const manifest = getPowerDesignContextManifestV2();
  const decision = evaluatePowerConstraintDecisionWithInstalledPolicyV3(
    observation.result,
    manifest,
  );
  return Object.freeze({
    kind: "production_constraint_observation",
    application: "power.buck",
    observation,
    decision,
  });
}
