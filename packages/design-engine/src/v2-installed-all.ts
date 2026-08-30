import { createInstalledNativeRecipeSets } from "@opencircuit/design-recipes/engine-internal";
import { _installNativeRecipeSetV2 } from "./v2-context";
import type { DesignRecipeV2 } from "./v2-types";

const recipeSets = createInstalledNativeRecipeSets();
_installNativeRecipeSetV2(
  "motor.brushed-dc",
  recipeSets["motor.brushed-dc"] as readonly DesignRecipeV2[],
);
_installNativeRecipeSetV2(
  "power.buck",
  recipeSets["power.buck"] as readonly DesignRecipeV2[],
);
