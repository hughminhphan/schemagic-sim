import { contentHash, type DesignLibrary } from "@opencircuit/design-engine";
import { MOTOR_CATALOG_CONTENT_HASH, MOTOR_LIBRARY_VERSION } from "./catalog";
import { MOTOR_DESIGN_RECIPES } from "./recipes";

export const MOTOR_DESIGN_LIBRARY: DesignLibrary = {
  version: MOTOR_LIBRARY_VERSION,
  contentHash: contentHash({
    catalog: MOTOR_CATALOG_CONTENT_HASH,
    recipes: MOTOR_DESIGN_RECIPES.map((recipe) => ({ id: recipe.id, version: recipe.version, contentHash: recipe.contentHash })),
    ranking: "motor-ranking-v1",
  }),
  paretoCriteria: [
    { source: "metric", metricId: "motor.loss.total", direction: "minimize" },
    { source: "metric", metricId: "motor.board-area-proxy", direction: "minimize" },
    { source: "metric", metricId: "motor.temperature.hottest-junction", direction: "minimize" },
  ],
  rankingProfiles: {
    balanced: [
      { source: "metric", metricId: "motor.loss.total", direction: "minimize" },
      { source: "metric", metricId: "motor.board-area-proxy", direction: "minimize" },
      { source: "metric", metricId: "motor.temperature.hottest-junction", direction: "minimize" },
    ],
    efficiency: [
      { source: "metric", metricId: "motor.efficiency", direction: "maximize" },
      { source: "metric", metricId: "motor.loss.total", direction: "minimize" },
    ],
    area: [{ source: "metric", metricId: "motor.board-area-proxy", direction: "minimize" }],
    temperature: [{ source: "metric", metricId: "motor.temperature.hottest-junction", direction: "minimize" }],
  },
};
