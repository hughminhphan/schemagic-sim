import { MOTOR_NATIVE_RECIPE } from "./motor";
import {
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3,
  MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED,
} from "./motor-external-v2";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED } from "./motor-integrated-v32-companion-network-gated";
import { MOTOR_NATIVE_RECIPE_FACTS_V2 } from "./motor-v2";
import { installedRecipeSet } from "./installed";
import type { NativeRecipeV2 } from "./types";

/** Motor-only engine leaf. It must not import Power recipes. */
export function createInstalledMotorRecipeSet(): readonly NativeRecipeV2[] {
  return installedRecipeSet(
    MOTOR_NATIVE_RECIPE,
    MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V2,
    MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V3,
    MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED,
    MOTOR_NATIVE_RECIPE_FACTS_V2,
    MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED,
  );
}
Object.freeze(createInstalledMotorRecipeSet);
