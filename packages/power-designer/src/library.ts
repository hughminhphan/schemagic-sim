import { contentHash, type DesignLibrary } from "@opencircuit/design-engine";
import { SYNTHETIC_BUCK_TEST_CATALOG } from "./catalog";
import { BUCK_EQUATION_IDS } from "./equations";
import { BUCK_RECIPES } from "./recipe";

export const BUCK_DESIGN_LIBRARY: DesignLibrary = Object.freeze({
  version: SYNTHETIC_BUCK_TEST_CATALOG.version,
  contentHash: contentHash({
    catalog: SYNTHETIC_BUCK_TEST_CATALOG,
    equations: BUCK_EQUATION_IDS,
    recipes: BUCK_RECIPES.map(({ id, version, contentHash: recipeContentHash }) => ({
      id,
      version,
      contentHash: recipeContentHash,
    })),
  }),
  paretoCriteria: Object.freeze([
    { source: "metric" as const, metricId: "power.efficiency", direction: "maximize" as const },
    { source: "metric" as const, metricId: "power.board-area", direction: "minimize" as const },
  ]),
  rankingProfiles: Object.freeze({
    area: Object.freeze([
      { source: "metric" as const, metricId: "power.board-area", direction: "minimize" as const },
      { source: "metric" as const, metricId: "power.efficiency", direction: "maximize" as const },
    ]),
    balanced: Object.freeze([
      { source: "metric" as const, metricId: "power.efficiency", direction: "maximize" as const },
      { source: "metric" as const, metricId: "power.board-area", direction: "minimize" as const },
      { source: "metric" as const, metricId: "power.hottest-junction-temperature", direction: "minimize" as const },
    ]),
    efficiency: Object.freeze([
      { source: "metric" as const, metricId: "power.efficiency", direction: "maximize" as const },
      { source: "metric" as const, metricId: "power.hottest-junction-temperature", direction: "minimize" as const },
    ]),
    temperature: Object.freeze([
      { source: "metric" as const, metricId: "power.hottest-junction-temperature", direction: "minimize" as const },
      { source: "metric" as const, metricId: "power.efficiency", direction: "maximize" as const },
    ]),
  }),
});
