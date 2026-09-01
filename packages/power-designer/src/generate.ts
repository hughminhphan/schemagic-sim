import { generateDesign, type DesignGeneration } from "@opencircuit/design-engine";
import type { BuckDesignRequest } from "@opencircuit/design-schema";
import { BUCK_DESIGN_LIBRARY } from "./library";
import { BUCK_RECIPES } from "./recipe";

const TRACK_B1_EVALUATED_AT = "2026-08-23T00:00:00.000Z";

/**
 * Generate deterministic analytic buck candidates from the frozen Designer request
 * contract. Track B1 performs no network access and uses only the clearly labeled
 * synthetic fixture catalog pinned by the request's libraryVersion.
 */
export function generateBuckDesign(request: BuckDesignRequest): DesignGeneration {
  return generateDesign(request, {
    library: BUCK_DESIGN_LIBRARY,
    recipes: BUCK_RECIPES,
    evaluatedAt: TRACK_B1_EVALUATED_AT,
  });
}
