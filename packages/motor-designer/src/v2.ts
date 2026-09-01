import { getBundledReviewedReleaseDocuments } from "@opencircuit/design-library/bundled-reviewed-release";
import {
  DesignGenerationErrorV2,
  buildReviewedProfileCatalogV2,
  calculateElectricalDesignContextManifestV2ContentHash,
  calculateElectricalRankingPolicyV2ContentHash,
  generateElectricalDesignV2,
  getInstalledCompilerImplementationRefV2,
  getInstalledMotorRecipeRefsV2,
  resolveInstalledMotorRecipeRegistryV2,
  type DesignExecutionReportV2,
  type DesignGenerationV2,
  type ElectricalDesignContextManifestV2,
  type ElectricalRankingPolicyV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-motor-runtime";
import {
  canonicalDesignV2Payload,
  designValidationIssue,
  detachedFrozenDesignV2Value,
  type BrushedDcMotorDesignRequestV2,
  type DesignResultV2,
} from "@opencircuit/design-schema";
import { assessMotorDesignV2ProductionReadiness } from "./v2-readiness";
import { MOTOR_DESIGN_V2_PRODUCTION_STATUS } from "./v2-status";

const documents = getBundledReviewedReleaseDocuments();
const catalog = buildReviewedProfileCatalogV2(documents);
const recipeRefs = getInstalledMotorRecipeRefsV2();
const area = { source: "metric", metricId: "motor.native.board-area", direction: "minimize" } as const;
const count = { source: "metric", metricId: "motor.native.component-count", direction: "minimize" } as const;
const policyPayload: Omit<ElectricalRankingPolicyV2, "contentHash"> = {
  format: "schemagic-electrical-ranking-policy",
  schemaVersion: 2,
  version: "motor-native-ranking-v2.1",
  application: "motor.brushed-dc",
  paretoCriteria: [area, count],
  rankingProfiles: { area: [area, count], balanced: [area, count], efficiency: [area, count], temperature: [area, count] },
};
const rankingPolicy = detachedFrozenDesignV2Value({ ...policyPayload, contentHash: calculateElectricalRankingPolicyV2ContentHash(policyPayload) });
const manifestPayload: Omit<ElectricalDesignContextManifestV2, "contentHash"> = {
  format: "schemagic-electrical-design-context",
  schemaVersion: 2,
  version: catalog.version,
  application: "motor.brushed-dc",
  compiler: getInstalledCompilerImplementationRefV2(),
  catalog: { version: catalog.version, contentHash: catalog.contentHash, sourceReleaseContentHash: catalog.sourceRelease.contentHash },
  rankingPolicy: { version: rankingPolicy.version, contentHash: rankingPolicy.contentHash },
  recipes: [...recipeRefs],
};
const manifest = detachedFrozenDesignV2Value({ ...manifestPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(manifestPayload) });
const installedRecipeRegistry = resolveInstalledMotorRecipeRegistryV2(manifest);
const evaluatedProductionStatus = assessMotorDesignV2ProductionReadiness(catalog, recipeRefs);
const productionStatusSnapshotMatches = canonicalDesignV2Payload(evaluatedProductionStatus)
  === canonicalDesignV2Payload(MOTOR_DESIGN_V2_PRODUCTION_STATUS);

export { MOTOR_DESIGN_V2_PRODUCTION_STATUS } from "./v2-status";
export { assessMotorDesignV2ProductionReadiness } from "./v2-readiness";
export type {
  MotorDesignV2ProductionBlocker,
  MotorDesignV2ProductionStatus,
  MotorDesignV2ProfileRequirementStatus,
  MotorDesignV2RecipeReadiness,
} from "./v2-readiness";

export interface VerifiedMotorDesignGenerationV2 {
  readonly kind: "production_context_verified";
  readonly application: "motor.brushed-dc";
  readonly contextManifestContentHash: string;
  readonly result: Readonly<DesignResultV2>;
  readonly execution: Readonly<DesignExecutionReportV2>;
}

export function getMotorDesignContextManifestV2(): Readonly<ElectricalDesignContextManifestV2> { return detachedFrozenDesignV2Value(manifest); }
export function getMotorDesignContextV2(): Readonly<GenerateElectricalContextV2> {
  if (!productionStatusSnapshotMatches) {
    throw new DesignGenerationErrorV2(
      { code: "invalid_context", stage: "context" },
      [designValidationIssue("context_mismatch", "/production-status")],
    );
  }
  if (evaluatedProductionStatus.status !== "ready") {
    throw new DesignGenerationErrorV2(
      { code: "invalid_context", stage: "context" },
      [designValidationIssue("context_mismatch", "/catalog/profiles")],
    );
  }
  if (installedRecipeRegistry === undefined) {
    throw new DesignGenerationErrorV2(
      { code: "invalid_context", stage: "context" },
      [designValidationIssue("context_mismatch", "/recipes")],
    );
  }
  return Object.freeze({
    manifest: getMotorDesignContextManifestV2(),
    catalogDocuments: getBundledReviewedReleaseDocuments(),
    rankingPolicy: detachedFrozenDesignV2Value(rankingPolicy),
    installedRecipeRegistry,
  });
}
export function generateMotorDesignV2(request: BrushedDcMotorDesignRequestV2): DesignGenerationV2 {
  return generateElectricalDesignV2(request, getMotorDesignContextV2());
}

/**
 * Production adapter boundary. The returned trust marker is issued only by the
 * installed Motor generator after the result binds to the exact request and
 * context manifest used by this execution.
 */
export function generateVerifiedMotorDesignV2(
  request: BrushedDcMotorDesignRequestV2,
): VerifiedMotorDesignGenerationV2 {
  const context = getMotorDesignContextV2();
  const generation = generateElectricalDesignV2(request, context);
  if (
    generation.result.libraryVersion !== context.manifest.version
    || generation.result.libraryContentHash !== context.manifest.contentHash
    || canonicalDesignV2Payload(generation.result.request) !== canonicalDesignV2Payload(request)
  ) {
    throw new DesignGenerationErrorV2(
      { code: "invalid_context", stage: "context" },
      [designValidationIssue("context_mismatch", "/result")],
    );
  }
  return Object.freeze({
    kind: "production_context_verified",
    application: "motor.brushed-dc",
    contextManifestContentHash: context.manifest.contentHash,
    result: generation.result,
    execution: generation.execution,
  });
}
