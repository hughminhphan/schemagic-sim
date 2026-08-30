import { getBundledReviewedReleaseDocuments } from "@opencircuit/design-library/bundled-reviewed-release";
import {
  DesignGenerationErrorV2,
  buildReviewedProfileCatalogV2,
  calculateElectricalDesignContextManifestV2ContentHash,
  calculateElectricalRankingPolicyV2ContentHash,
  generateElectricalDesignV2,
  getInstalledCompilerImplementationRefV2,
  getInstalledPowerRecipeRefsV2,
  resolveInstalledPowerRecipeRegistryV2,
  type DesignExecutionReportV2,
  type DesignGenerationV2,
  type ElectricalDesignContextManifestV2,
  type ElectricalRankingPolicyV2,
  type GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-power-runtime";
import { canonicalDesignV2Payload, designValidationIssue, detachedFrozenDesignV2Value, type BuckDesignRequestV2, type DesignResultV2 } from "@opencircuit/design-schema";
import { assessPowerDesignV2ProductionReadiness } from "./v2-readiness";
import { POWER_DESIGN_V2_PRODUCTION_STATUS } from "./v2-status";

const documents = getBundledReviewedReleaseDocuments();
const catalog = buildReviewedProfileCatalogV2(documents);
const recipeRefs = getInstalledPowerRecipeRefsV2();
const area = { source: "metric", metricId: "power.native.board-area", direction: "minimize" } as const;
const count = { source: "metric", metricId: "power.native.component-count", direction: "minimize" } as const;
const policyPayload: Omit<ElectricalRankingPolicyV2, "contentHash"> = {
  format: "schemagic-electrical-ranking-policy",
  schemaVersion: 2,
  version: "power-native-ranking-v2.1",
  application: "power.buck",
  paretoCriteria: [area, count],
  rankingProfiles: { area: [area, count], balanced: [area, count], efficiency: [area, count], temperature: [area, count] },
};
const rankingPolicy = detachedFrozenDesignV2Value({ ...policyPayload, contentHash: calculateElectricalRankingPolicyV2ContentHash(policyPayload) });
const manifestPayload: Omit<ElectricalDesignContextManifestV2, "contentHash"> = {
  format: "schemagic-electrical-design-context",
  schemaVersion: 2,
  version: catalog.version,
  application: "power.buck",
  compiler: getInstalledCompilerImplementationRefV2(),
  catalog: { version: catalog.version, contentHash: catalog.contentHash, sourceReleaseContentHash: catalog.sourceRelease.contentHash },
  rankingPolicy: { version: rankingPolicy.version, contentHash: rankingPolicy.contentHash },
  recipes: [...recipeRefs],
};
const manifest = detachedFrozenDesignV2Value({ ...manifestPayload, contentHash: calculateElectricalDesignContextManifestV2ContentHash(manifestPayload) });
const installedRecipeRegistry = resolveInstalledPowerRecipeRegistryV2(manifest);
const evaluatedProductionStatus = assessPowerDesignV2ProductionReadiness(catalog, recipeRefs);
const productionStatusSnapshotMatches = canonicalDesignV2Payload(evaluatedProductionStatus)
  === canonicalDesignV2Payload(POWER_DESIGN_V2_PRODUCTION_STATUS);

export { POWER_DESIGN_V2_PRODUCTION_STATUS } from "./v2-status";
export { assessPowerDesignV2ProductionReadiness } from "./v2-readiness";
export type {
  PowerDesignV2ProductionBlocker,
  PowerDesignV2ProductionStatus,
  PowerDesignV2ProfileRequirementStatus,
  PowerDesignV2RecipeReadiness,
} from "./v2-readiness";
export interface VerifiedPowerDesignGenerationV2 {
  readonly kind: "production_context_verified";
  readonly application: "power.buck";
  readonly contextManifestContentHash: string;
  readonly result: Readonly<DesignResultV2>;
  readonly execution: Readonly<DesignExecutionReportV2>;
}
export function getPowerDesignContextManifestV2(): Readonly<ElectricalDesignContextManifestV2> { return detachedFrozenDesignV2Value(manifest); }
export function getPowerDesignContextV2(): Readonly<GenerateElectricalContextV2> {
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
    manifest: getPowerDesignContextManifestV2(),
    catalogDocuments: getBundledReviewedReleaseDocuments(),
    rankingPolicy: detachedFrozenDesignV2Value(rankingPolicy),
    installedRecipeRegistry,
  });
}
export function generateBuckDesignV2(request: BuckDesignRequestV2): DesignGenerationV2 {
  return generateElectricalDesignV2(request, getPowerDesignContextV2());
}

/** Issues production trust only after exact request and context binding. */
export function generateVerifiedBuckDesignV2(
  request: BuckDesignRequestV2,
): VerifiedPowerDesignGenerationV2 {
  const context = getPowerDesignContextV2();
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
    application: "power.buck",
    contextManifestContentHash: context.manifest.contentHash,
    result: generation.result,
    execution: generation.execution,
  });
}
