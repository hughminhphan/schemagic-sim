import type { PartClassId } from "@opencircuit/design-library";
import type { DesignRecipeRefV2, ReviewedProfileCatalogV2 } from "@opencircuit/design-engine";
import { canonicalDesignV2Payload, compareDesignV2Tokens, detachedFrozenDesignV2Value } from "@opencircuit/design-schema";

export type MotorDesignV2ProductionBlocker =
  | "incomplete_recipe_profile_coverage"
  | "incompatible_facts_schema_versions"
  | "no_independently_reviewed_profiles"
  | "release_topology_recipe_missing"
  | "unrecognized_installed_recipe_contract";

type RecipeFactsSchemaVersion = "1.0.0" | "2.0.0" | "3.0.0" | "3.1.0" | "3.2.0";

export interface MotorDesignV2ProfileRequirementStatus {
  partClass: PartClassId;
  factsSchemaVersion: RecipeFactsSchemaVersion;
  reviewedProfileCount: number;
  otherFactsSchemaVersions: string[];
}

export interface MotorDesignV2RecipeReadiness {
  recipeId: string;
  recipeVersion: string;
  recognizedContract: boolean;
  ready: boolean;
  profileRequirements: MotorDesignV2ProfileRequirementStatus[];
}

export interface MotorDesignV2ProductionStatus {
  status: "blocked" | "ready";
  reason: MotorDesignV2ProductionBlocker | null;
  catalogVersion: string;
  catalogProfileCount: number;
  reviewedProfileCount: number;
  compatibleProfileCount: number;
  installedRecipeSet: boolean;
  factsV2RecipeInstalled: boolean;
  requiredTopologyRecipeIds: string[];
  missingTopologyRecipeIds: string[];
  readyRecipeIds: string[];
  missingProfileRequirements: string[];
  recipeReadiness: MotorDesignV2RecipeReadiness[];
  diagnostics: string[];
}

interface RecipeProfileRequirement {
  partClass: PartClassId;
  factsSchemaVersion: RecipeFactsSchemaVersion;
}

interface RecipeProfileContract {
  id: string;
  version: string;
  contentHash?: `sha256:${string}`;
  profileRequirements: readonly RecipeProfileRequirement[];
}

const RECIPE_PROFILE_CONTRACTS: readonly RecipeProfileContract[] = [
  {
    id: "motor.native.integrated-h-bridge",
    version: "1.0.0",
    profileRequirements: [
      { partClass: "motor.integrated-h-bridge", factsSchemaVersion: "1.0.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "1.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "1.0.0" },
    ],
  },
  {
    id: "motor.native.integrated-h-bridge.facts-v2",
    version: "2.0.0",
    profileRequirements: [
      { partClass: "motor.integrated-h-bridge", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
    ],
  },
  {
    id: "motor.native.integrated-h-bridge.facts-v3-2",
    version: "3.2.3",
    contentHash: "sha256:86d3e6fed563d7e663d74f692286a2287b2932afea198fe76dc86eab07c50ece",
    profileRequirements: [
      { partClass: "motor.integrated-h-bridge", factsSchemaVersion: "3.2.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
    ],
  },
  {
    id: "motor.native.integrated-h-bridge.facts-v3-2",
    version: "3.2.4",
    contentHash: "sha256:b33804be0fd68ac15bde76ce46db501325dac5030c5b13f7916cd8362c853d84",
    profileRequirements: [
      { partClass: "motor.integrated-h-bridge", factsSchemaVersion: "3.2.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
    ],
  },
  {
    id: "motor.native.integrated-h-bridge.facts-v3-2",
    version: "3.2.5",
    contentHash: "sha256:75e1ea8fa6c3c4fadd44187b9134a2e61840d2ad5b0123d0bbaff17a910dce1a",
    profileRequirements: [
      { partClass: "motor.integrated-h-bridge", factsSchemaVersion: "3.2.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
    ],
  },
  {
    id: "motor.native.integrated-h-bridge.facts-v3-2",
    version: "3.2.6",
    contentHash: "sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07",
    profileRequirements: [
      { partClass: "motor.integrated-h-bridge", factsSchemaVersion: "3.2.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
    ],
  },
  {
    id: "motor.native.external-nmos-h-bridge.facts-v2",
    version: "2.0.0",
    profileRequirements: [
      { partClass: "motor.full-bridge-gate-driver", factsSchemaVersion: "2.0.0" },
      { partClass: "motor.supply-tvs-diode", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.current-sense-resistor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.general-purpose-resistor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.n-channel-power-mosfet", factsSchemaVersion: "2.0.0" },
    ],
  },
  {
    id: "motor.native.external-nmos-h-bridge.facts-v3",
    version: "3.0.0",
    profileRequirements: [
      { partClass: "motor.full-bridge-gate-driver", factsSchemaVersion: "2.0.0" },
      { partClass: "motor.supply-tvs-diode", factsSchemaVersion: "3.0.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.current-sense-resistor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.general-purpose-resistor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.n-channel-power-mosfet", factsSchemaVersion: "3.0.0" },
    ],
  },
  {
    id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
    version: "3.1.6",
    contentHash: "sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320",
    profileRequirements: [
      { partClass: "motor.full-bridge-gate-driver", factsSchemaVersion: "3.1.0" },
      { partClass: "motor.supply-tvs-diode", factsSchemaVersion: "3.0.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.current-sense-resistor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.general-purpose-resistor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.n-channel-power-mosfet", factsSchemaVersion: "3.0.0" },
    ],
  },
  {
    id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
    version: "3.1.7",
    contentHash: "sha256:e526bba9ce25114b505264e7d281607ee223c10de19e795780a64f04617c0947",
    profileRequirements: [
      { partClass: "motor.full-bridge-gate-driver", factsSchemaVersion: "3.1.0" },
      { partClass: "motor.supply-tvs-diode", factsSchemaVersion: "3.0.0" },
      { partClass: "shared.bulk-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.current-sense-resistor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.general-purpose-resistor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
      { partClass: "shared.n-channel-power-mosfet", factsSchemaVersion: "3.0.0" },
    ],
  },
];

const REQUIRED_RELEASE_TOPOLOGY_RECIPES = [
  { id: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified", version: "3.1.7" },
  { id: "motor.native.integrated-h-bridge.facts-v3-2", version: "3.2.6" },
] as const;

function contractKey(id: string, version: string): string {
  return `${id}@${version}`;
}

function recipeRefKey(recipe: Readonly<DesignRecipeRefV2>): string {
  return canonicalDesignV2Payload([recipe.id, recipe.version, recipe.contentHash]);
}

const CONTRACT_BY_KEY = new Map(RECIPE_PROFILE_CONTRACTS.map((contract) => [
  contractKey(contract.id, contract.version),
  contract,
]));
const MOTOR_RELEVANT_PART_CLASSES = new Set(RECIPE_PROFILE_CONTRACTS.flatMap((contract) => (
  contract.profileRequirements.map((requirement) => requirement.partClass)
)));

function requirementToken(requirement: Readonly<MotorDesignV2ProfileRequirementStatus>): string {
  return `${requirement.partClass}@facts-${requirement.factsSchemaVersion}`;
}

/**
 * Assesses only profile coverage for a catalog already validated by design-engine.
 * It neither validates nor admits profile bytes and never mutates the release.
 */
export function assessMotorDesignV2ProductionReadiness(
  catalog: Readonly<ReviewedProfileCatalogV2>,
  installedRecipes: readonly DesignRecipeRefV2[],
): Readonly<MotorDesignV2ProductionStatus> {
  const recipes = [...installedRecipes]
    .sort((left, right) => compareDesignV2Tokens(recipeRefKey(left), recipeRefKey(right)))
    .map((recipe): MotorDesignV2RecipeReadiness => {
      const contract = CONTRACT_BY_KEY.get(contractKey(recipe.id, recipe.version));
      if (contract === undefined || (contract.contentHash !== undefined && contract.contentHash !== recipe.contentHash)) {
        return {
          recipeId: recipe.id,
          recipeVersion: recipe.version,
          recognizedContract: false,
          ready: false,
          profileRequirements: [],
        };
      }
      const profileRequirements = [...contract.profileRequirements]
        .sort((left, right) => compareDesignV2Tokens(left.partClass, right.partClass))
        .map((requirement): MotorDesignV2ProfileRequirementStatus => {
          const matchingClass = catalog.profiles.filter((profile) => profile.partClass === requirement.partClass);
          return {
            partClass: requirement.partClass,
            factsSchemaVersion: requirement.factsSchemaVersion,
            reviewedProfileCount: matchingClass.filter((profile) => profile.factsSchemaVersion === requirement.factsSchemaVersion).length,
            otherFactsSchemaVersions: [...new Set(matchingClass
              .map((profile) => profile.factsSchemaVersion)
              .filter((version) => version !== requirement.factsSchemaVersion))]
              .sort(compareDesignV2Tokens),
          };
        });
      return {
        recipeId: recipe.id,
        recipeVersion: recipe.version,
        recognizedContract: true,
        ready: profileRequirements.every((requirement) => requirement.reviewedProfileCount > 0),
        profileRequirements,
      };
    });

  const installedRecipeSet = recipes.length > 0 && recipes.every((recipe) => recipe.recognizedContract);
  const installedContractKeys = new Set(recipes.map((recipe) => contractKey(recipe.recipeId, recipe.recipeVersion)));
  const missingReleaseTopologyRecipes = REQUIRED_RELEASE_TOPOLOGY_RECIPES
    .filter((recipe) => !installedContractKeys.has(contractKey(recipe.id, recipe.version)));
  const requiredTopologyRecipeIds = REQUIRED_RELEASE_TOPOLOGY_RECIPES
    .map((recipe) => recipe.id)
    .sort(compareDesignV2Tokens);
  const missingTopologyRecipeIds = missingReleaseTopologyRecipes
    .map((recipe) => recipe.id)
    .sort(compareDesignV2Tokens);
  const releaseRecipeReadiness = REQUIRED_RELEASE_TOPOLOGY_RECIPES
    .map((required) => recipes.find((recipe) => (
      recipe.recipeId === required.id && recipe.recipeVersion === required.version
    )))
    .filter((recipe): recipe is MotorDesignV2RecipeReadiness => recipe !== undefined);
  const readyRecipeIds = recipes
    .filter((recipe) => recipe.ready)
    .map((recipe) => recipe.recipeId)
    .sort(compareDesignV2Tokens);
  const missingRequirements = recipes
    .flatMap((recipe) => recipe.profileRequirements)
    .filter((requirement) => requirement.reviewedProfileCount === 0);
  const missingProfileRequirements = [...new Set(missingRequirements.map(requirementToken))]
    .sort(compareDesignV2Tokens);
  const compatibleProfiles = new Set<string>();
  const reviewedProfileCount = catalog.profiles
    .filter((profile) => MOTOR_RELEVANT_PART_CLASSES.has(profile.partClass))
    .length;
  for (const recipe of recipes) {
    for (const requirement of recipe.profileRequirements) {
      for (const profile of catalog.profiles) {
        if (profile.partClass !== requirement.partClass || profile.factsSchemaVersion !== requirement.factsSchemaVersion) continue;
        compatibleProfiles.add([
          profile.partClass,
          profile.factsSchemaVersion,
          profile.part.manufacturerId,
          profile.part.manufacturerPartNumber,
        ].join("\n"));
      }
    }
  }

  let reason: MotorDesignV2ProductionBlocker | null = null;
  if (!installedRecipeSet) reason = "unrecognized_installed_recipe_contract";
  else if (missingReleaseTopologyRecipes.length > 0) reason = "release_topology_recipe_missing";
  else if (reviewedProfileCount === 0) reason = "no_independently_reviewed_profiles";
  else if (!releaseRecipeReadiness.every((recipe) => recipe.ready)) {
    const releaseMissingRequirements = releaseRecipeReadiness
      .flatMap((recipe) => recipe.profileRequirements)
      .filter((requirement) => requirement.reviewedProfileCount === 0);
    reason = releaseMissingRequirements.some((requirement) => requirement.otherFactsSchemaVersions.length > 0)
      ? "incompatible_facts_schema_versions"
      : "incomplete_recipe_profile_coverage";
  }

  const diagnostics = [...new Set([
    ...recipes
      .filter((recipe) => !recipe.recognizedContract)
      .map((recipe) => `unrecognized_recipe:${contractKey(recipe.recipeId, recipe.recipeVersion)}`),
    ...missingReleaseTopologyRecipes
      .map((recipe) => `missing_release_topology_recipe:${contractKey(recipe.id, recipe.version)}`),
    ...missingRequirements.map((requirement) => requirement.otherFactsSchemaVersions.length === 0
      ? `missing_profile_requirement:${requirementToken(requirement)}`
      : `profile_schema_mismatch:${requirementToken(requirement)}:found-${requirement.otherFactsSchemaVersions.join(",")}`),
  ])].sort(compareDesignV2Tokens);

  return detachedFrozenDesignV2Value({
    status: reason === null ? "ready" : "blocked",
    reason,
    catalogVersion: catalog.version,
    catalogProfileCount: catalog.profiles.length,
    reviewedProfileCount,
    compatibleProfileCount: compatibleProfiles.size,
    installedRecipeSet,
    factsV2RecipeInstalled: recipes.some((recipe) => (
      recipe.recipeId === "motor.native.integrated-h-bridge.facts-v2"
      && recipe.recipeVersion === "2.0.0"
    )),
    requiredTopologyRecipeIds,
    missingTopologyRecipeIds,
    readyRecipeIds,
    missingProfileRequirements,
    recipeReadiness: recipes,
    diagnostics,
  });
}
