import { installedRecipeSet } from "./installed";
import { POWER_NATIVE_RECIPE } from "./power";
import { POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3 } from "./power-external-v3";
import { POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS } from "./power-integrated-v34-inductor-qualified";
import { POWER_NATIVE_RECIPE_FACTS_V2 } from "./power-v2";
import type { NativeRecipeV2 } from "./types";

export {
  calculateIntegratedBuckCurrentLimitV1,
  calculateIntegratedBuckJunctionTemperatureV1,
  calculateIntegratedBuckLossV1,
  type IntegratedBuckCurrentLimitInputsV1,
  type IntegratedBuckCurrentLimitResultV1,
  type IntegratedBuckJunctionTemperatureInputsV1,
  type IntegratedBuckJunctionTemperatureResultV1,
  type IntegratedBuckLossInputsV1,
  type IntegratedBuckLossResultV1,
  type PowerCalculatorUnknownV1,
} from "./power-integrated-calculators-v1";

/** Power-only engine leaf. It must not import Motor recipes. */
export function createInstalledPowerRecipeSet(): readonly NativeRecipeV2[] {
  return installedRecipeSet(
    POWER_NATIVE_RECIPE,
    POWER_NATIVE_RECIPE_FACTS_V2,
    POWER_NATIVE_EXTERNAL_FET_SYNCHRONOUS_BUCK_RECIPE_FACTS_V3,
    POWER_NATIVE_INTEGRATED_SYNCHRONOUS_BUCK_RECIPE_FACTS_V34_REFERENCE_PASSIVE_OBSERVATIONS,
  );
}
Object.freeze(createInstalledPowerRecipeSet);
