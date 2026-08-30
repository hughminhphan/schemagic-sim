import "./v2-installed-motor";
import {
  getInstalledRecipeRefsV2,
  resolveInstalledRecipeRegistryV2,
} from "./v2-context";
import type {
  DesignRecipeRefV2,
  ElectricalDesignContextManifestV2,
  InstalledRecipeRegistryCapabilityV2,
} from "./v2-types";

export {
  buildReviewedProfileCatalogV2,
  calculateElectricalDesignContextManifestV2ContentHash,
  calculateElectricalRankingPolicyV2ContentHash,
  getInstalledCompilerImplementationRefV2,
} from "./v2-context";
export {
  generateElectricalDesignV2,
  listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1,
  validateDesignExecutionReportContextV2,
} from "./v2-generate";
export { DesignGenerationErrorV2 } from "./v2-types";
export type {
  DesignGenerationV2,
  DesignExecutionReportV2,
  ElectricalDesignContextManifestV2,
  ElectricalRankingPolicyV2,
  GenerateElectricalContextV2,
} from "./v2-types";

export function getInstalledMotorRecipeRefsV2(): readonly DesignRecipeRefV2[] {
  return getInstalledRecipeRefsV2("motor.brushed-dc");
}

export function resolveInstalledMotorRecipeRegistryV2(
  manifest: Readonly<ElectricalDesignContextManifestV2>,
): InstalledRecipeRegistryCapabilityV2 | undefined {
  if (manifest.application !== "motor.brushed-dc") return undefined;
  return resolveInstalledRecipeRegistryV2(manifest);
}
