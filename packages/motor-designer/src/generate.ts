import { generateDesign, type DesignGeneration } from "@opencircuit/design-engine";
import type { BrushedDcMotorDesignRequest } from "@opencircuit/design-schema";
import { MOTOR_DESIGN_LIBRARY } from "./library";
import { MOTOR_DESIGN_RECIPES } from "./recipes";

const ELECTRICAL_ONLY_EVALUATED_AT = "2000-01-01T00:00:00.000Z";

/** Generate deterministic analytical Motor A1 candidates through the shared design engine. */
export function generateMotorDesign(request: BrushedDcMotorDesignRequest): DesignGeneration {
  return generateDesign(request, {
    library: MOTOR_DESIGN_LIBRARY,
    recipes: MOTOR_DESIGN_RECIPES,
    evaluatedAt: ELECTRICAL_ONLY_EVALUATED_AT,
  });
}
