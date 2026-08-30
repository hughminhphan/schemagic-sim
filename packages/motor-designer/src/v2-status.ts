const profileRequirement = (
  partClass:
    | "motor.full-bridge-gate-driver"
    | "motor.integrated-h-bridge"
    | "motor.supply-tvs-diode"
    | "shared.bulk-capacitor"
    | "shared.current-sense-resistor"
    | "shared.general-purpose-resistor"
    | "shared.mlcc-capacitor"
    | "shared.n-channel-power-mosfet",
  factsSchemaVersion: "1.0.0" | "2.0.0" | "3.0.0" | "3.1.0" | "3.2.0",
  reviewedProfileCount = 0,
  otherFactsSchemaVersions: readonly string[] = [],
) => Object.freeze({
  partClass,
  factsSchemaVersion,
  reviewedProfileCount,
  otherFactsSchemaVersions: Object.freeze([...otherFactsSchemaVersions]),
});

/**
 * Data-only release snapshot for production UI/status imports. The full Motor
 * module recomputes this state from the bundled catalog and fails closed if it
 * drifts, without pulling catalog or recipe implementation bytes into here.
 */
export const MOTOR_DESIGN_V2_PRODUCTION_STATUS = Object.freeze({
  status: "ready" as const,
  reason: null,
  catalogVersion: "2026-08-27.2",
  catalogProfileCount: 24,
  reviewedProfileCount: 19,
  compatibleProfileCount: 19,
  installedRecipeSet: true,
  factsV2RecipeInstalled: true,
  requiredTopologyRecipeIds: Object.freeze([
    "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
    "motor.native.integrated-h-bridge.facts-v3-2",
  ]),
  missingTopologyRecipeIds: Object.freeze([] as string[]),
  readyRecipeIds: Object.freeze([
    "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
    "motor.native.integrated-h-bridge.facts-v3-2",
  ]),
  missingProfileRequirements: Object.freeze([
    "motor.full-bridge-gate-driver@facts-2.0.0",
    "motor.integrated-h-bridge@facts-1.0.0",
    "motor.integrated-h-bridge@facts-2.0.0",
    "motor.supply-tvs-diode@facts-2.0.0",
    "shared.bulk-capacitor@facts-1.0.0",
    "shared.mlcc-capacitor@facts-1.0.0",
    "shared.n-channel-power-mosfet@facts-2.0.0",
  ]),
  recipeReadiness: Object.freeze([
    Object.freeze({
      recipeId: "motor.native.external-nmos-h-bridge.facts-v2",
      recipeVersion: "2.0.0",
      recognizedContract: true,
      ready: false,
      profileRequirements: Object.freeze([
        profileRequirement("motor.full-bridge-gate-driver", "2.0.0", 0, ["3.1.0"]),
        profileRequirement("motor.supply-tvs-diode", "2.0.0", 0, ["3.0.0"]),
        profileRequirement("shared.bulk-capacitor", "2.0.0", 2),
        profileRequirement("shared.current-sense-resistor", "2.0.0", 1),
        profileRequirement("shared.general-purpose-resistor", "2.0.0", 4),
        profileRequirement("shared.mlcc-capacitor", "2.0.0", 5),
        profileRequirement("shared.n-channel-power-mosfet", "2.0.0", 0, ["3.0.0"]),
      ]),
    }),
    Object.freeze({
      recipeId: "motor.native.external-nmos-h-bridge.facts-v3",
      recipeVersion: "3.0.0",
      recognizedContract: true,
      ready: false,
      profileRequirements: Object.freeze([
        profileRequirement("motor.full-bridge-gate-driver", "2.0.0", 0, ["3.1.0"]),
        profileRequirement("motor.supply-tvs-diode", "3.0.0", 2),
        profileRequirement("shared.bulk-capacitor", "2.0.0", 2),
        profileRequirement("shared.current-sense-resistor", "2.0.0", 1),
        profileRequirement("shared.general-purpose-resistor", "2.0.0", 4),
        profileRequirement("shared.mlcc-capacitor", "2.0.0", 5),
        profileRequirement("shared.n-channel-power-mosfet", "3.0.0", 1),
      ]),
    }),
    Object.freeze({
      recipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      recipeVersion: "3.1.7",
      recognizedContract: true,
      ready: true,
      profileRequirements: Object.freeze([
        profileRequirement("motor.full-bridge-gate-driver", "3.1.0", 1),
        profileRequirement("motor.supply-tvs-diode", "3.0.0", 2),
        profileRequirement("shared.bulk-capacitor", "2.0.0", 2),
        profileRequirement("shared.current-sense-resistor", "2.0.0", 1),
        profileRequirement("shared.general-purpose-resistor", "2.0.0", 4),
        profileRequirement("shared.mlcc-capacitor", "2.0.0", 5),
        profileRequirement("shared.n-channel-power-mosfet", "3.0.0", 1),
      ]),
    }),
    Object.freeze({
      recipeId: "motor.native.integrated-h-bridge",
      recipeVersion: "1.0.0",
      recognizedContract: true,
      ready: false,
      profileRequirements: Object.freeze([
        profileRequirement("motor.integrated-h-bridge", "1.0.0", 0, ["3.2.0"]),
        profileRequirement("shared.bulk-capacitor", "1.0.0", 0, ["2.0.0"]),
        profileRequirement("shared.mlcc-capacitor", "1.0.0", 0, ["2.0.0"]),
      ]),
    }),
    Object.freeze({
      recipeId: "motor.native.integrated-h-bridge.facts-v2",
      recipeVersion: "2.0.0",
      recognizedContract: true,
      ready: false,
      profileRequirements: Object.freeze([
        profileRequirement("motor.integrated-h-bridge", "2.0.0", 0, ["3.2.0"]),
        profileRequirement("shared.bulk-capacitor", "2.0.0", 2),
        profileRequirement("shared.mlcc-capacitor", "2.0.0", 5),
      ]),
    }),
    Object.freeze({
      recipeId: "motor.native.integrated-h-bridge.facts-v3-2",
      recipeVersion: "3.2.6",
      recognizedContract: true,
      ready: true,
      profileRequirements: Object.freeze([
        profileRequirement("motor.integrated-h-bridge", "3.2.0", 3),
        profileRequirement("shared.bulk-capacitor", "2.0.0", 2),
        profileRequirement("shared.mlcc-capacitor", "2.0.0", 5),
      ]),
    }),
  ]),
  diagnostics: Object.freeze([
    "profile_schema_mismatch:motor.full-bridge-gate-driver@facts-2.0.0:found-3.1.0",
    "profile_schema_mismatch:motor.integrated-h-bridge@facts-1.0.0:found-3.2.0",
    "profile_schema_mismatch:motor.integrated-h-bridge@facts-2.0.0:found-3.2.0",
    "profile_schema_mismatch:motor.supply-tvs-diode@facts-2.0.0:found-3.0.0",
    "profile_schema_mismatch:shared.bulk-capacitor@facts-1.0.0:found-2.0.0",
    "profile_schema_mismatch:shared.mlcc-capacitor@facts-1.0.0:found-2.0.0",
    "profile_schema_mismatch:shared.n-channel-power-mosfet@facts-2.0.0:found-3.0.0",
  ]),
});
