import { createInstalledMotorRecipeSet } from "@opencircuit/design-recipes/motor-engine-internal";
import { _installNativeRecipeSetV2 } from "./v2-context";
import type { DesignRecipeV2 } from "./v2-types";

_installNativeRecipeSetV2(
  "motor.brushed-dc",
  createInstalledMotorRecipeSet() as readonly DesignRecipeV2[],
);
