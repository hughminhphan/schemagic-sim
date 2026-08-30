import { createInstalledPowerRecipeSet } from "@opencircuit/design-recipes/power-engine-internal";
import { _installNativeRecipeSetV2 } from "./v2-context";
import type { DesignRecipeV2 } from "./v2-types";

_installNativeRecipeSetV2(
  "power.buck",
  createInstalledPowerRecipeSet() as readonly DesignRecipeV2[],
);
