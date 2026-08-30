type RequiredPartClass =
  | "power.external-fet-synchronous-buck-controller"
  | "power.integrated-synchronous-buck-regulator"
  | "power.power-inductor"
  | "shared.current-sense-resistor"
  | "shared.general-purpose-resistor"
  | "shared.mlcc-capacitor"
  | "shared.n-channel-power-mosfet";

const profileRequirement = (
  requirementId: string,
  partClass: RequiredPartClass,
  factsSchemaVersion: "1.0.0" | "2.0.0" | "3.0.0" | "3.3.0" | "3.4.0",
  reviewedProfileCount = 0,
  otherFactsSchemaVersions: readonly string[] = [],
  exactProfileContentHash: `sha256:${string}` | null = null,
  factsSchemaProfileCount = reviewedProfileCount,
) => Object.freeze({
  requirementId,
  partClass,
  factsSchemaVersion,
  exactProfileContentHash,
  factsSchemaProfileCount,
  reviewedProfileCount,
  otherFactsSchemaVersions: Object.freeze([...otherFactsSchemaVersions]),
});

/**
 * Data-only release snapshot for production UI/status imports. The full Power
 * module recomputes this state from the bundled catalog and installed engine
 * recipe identities, then fails closed if this snapshot drifts.
 */
export const POWER_DESIGN_V2_PRODUCTION_STATUS = Object.freeze({
  status: "ready" as const,
  reason: null,
  catalogVersion: "2026-08-27.2",
  catalogProfileCount: 24,
  reviewedProfileCount: 15,
  compatibleProfileCount: 14,
  installedRecipeSet: true,
  factsV2RecipeInstalled: true,
  readyRecipeIds: Object.freeze([
    "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
  ]),
  missingProfileRequirements: Object.freeze([
    "power.external-fet-synchronous-buck-controller@facts-2.0.0",
    "power.integrated-synchronous-buck-regulator@facts-1.0.0",
    "power.integrated-synchronous-buck-regulator@facts-2.0.0",
    "power.power-inductor@facts-1.0.0",
    "shared.general-purpose-resistor@facts-1.0.0",
    "shared.mlcc-capacitor@facts-1.0.0",
    "shared.n-channel-power-mosfet@facts-2.0.0",
  ]),
  recipeReadiness: Object.freeze([
    Object.freeze({
      recipeId: "power.native.external-fet-synchronous-buck.facts-v3",
      recipeVersion: "3.0.0",
      recognizedContract: true,
      releaseEligible: false,
      ready: false,
      profileRequirements: Object.freeze([
        profileRequirement("external-controller", "power.external-fet-synchronous-buck-controller", "2.0.0"),
        profileRequirement("power-inductor", "power.power-inductor", "2.0.0", 1, ["3.4.0"]),
        profileRequirement("current-sense-resistor", "shared.current-sense-resistor", "2.0.0", 1),
        profileRequirement("general-purpose-resistor", "shared.general-purpose-resistor", "2.0.0", 4),
        profileRequirement("generic-mlcc-support", "shared.mlcc-capacitor", "2.0.0", 5),
        profileRequirement("power-mosfet", "shared.n-channel-power-mosfet", "3.0.0", 1),
      ]),
    }),
    Object.freeze({
      recipeId: "power.native.facts-v2",
      recipeVersion: "2.0.0",
      recognizedContract: true,
      releaseEligible: false,
      ready: false,
      profileRequirements: Object.freeze([
        profileRequirement("external-controller", "power.external-fet-synchronous-buck-controller", "2.0.0"),
        profileRequirement("integrated-regulator", "power.integrated-synchronous-buck-regulator", "2.0.0", 0, ["3.3.0"]),
        profileRequirement("power-inductor", "power.power-inductor", "2.0.0", 1, ["3.4.0"]),
        profileRequirement("current-sense-resistor", "shared.current-sense-resistor", "2.0.0", 1),
        profileRequirement("general-purpose-resistor", "shared.general-purpose-resistor", "2.0.0", 4),
        profileRequirement("generic-mlcc-support", "shared.mlcc-capacitor", "2.0.0", 5),
        profileRequirement("power-mosfet", "shared.n-channel-power-mosfet", "2.0.0", 0, ["3.0.0"]),
      ]),
    }),
    Object.freeze({
      recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
      recipeVersion: "3.4.6",
      recognizedContract: true,
      releaseEligible: true,
      ready: true,
      profileRequirements: Object.freeze([
        profileRequirement(
          "integrated-regulator",
          "power.integrated-synchronous-buck-regulator",
          "3.3.0",
          1,
          [],
          "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
        ),
        profileRequirement(
          "power-inductor",
          "power.power-inductor",
          "3.4.0",
          1,
          ["2.0.0"],
          "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b",
          2,
        ),
        profileRequirement("general-purpose-resistor", "shared.general-purpose-resistor", "2.0.0", 4),
        profileRequirement("generic-mlcc-support", "shared.mlcc-capacitor", "2.0.0", 5),
        profileRequirement(
          "output-capacitor-bank",
          "shared.mlcc-capacitor",
          "2.0.0",
          1,
          [],
          "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
          5,
        ),
      ]),
    }),
    Object.freeze({
      recipeId: "power.native.integrated-synchronous-buck",
      recipeVersion: "1.0.0",
      recognizedContract: true,
      releaseEligible: false,
      ready: false,
      profileRequirements: Object.freeze([
        profileRequirement("integrated-regulator", "power.integrated-synchronous-buck-regulator", "1.0.0", 0, ["3.3.0"]),
        profileRequirement("power-inductor", "power.power-inductor", "1.0.0", 0, ["2.0.0", "3.4.0"]),
        profileRequirement("general-purpose-resistor", "shared.general-purpose-resistor", "1.0.0", 0, ["2.0.0"]),
        profileRequirement("generic-mlcc-support", "shared.mlcc-capacitor", "1.0.0", 0, ["2.0.0"]),
      ]),
    }),
  ]),
  diagnostics: Object.freeze([
    "missing_profile_requirement:power.external-fet-synchronous-buck-controller@facts-2.0.0",
    "profile_schema_mismatch:power.integrated-synchronous-buck-regulator@facts-1.0.0:found-3.3.0",
    "profile_schema_mismatch:power.integrated-synchronous-buck-regulator@facts-2.0.0:found-3.3.0",
    "profile_schema_mismatch:power.power-inductor@facts-1.0.0:found-2.0.0,3.4.0",
    "profile_schema_mismatch:shared.general-purpose-resistor@facts-1.0.0:found-2.0.0",
    "profile_schema_mismatch:shared.mlcc-capacitor@facts-1.0.0:found-2.0.0",
    "profile_schema_mismatch:shared.n-channel-power-mosfet@facts-2.0.0:found-3.0.0",
  ]),
});
