import { designProfileEnvelopeContentHash, type PartClassId } from "@opencircuit/design-library/v2-runtime";
import type { DesignRecipeRefV2, ReviewedProfileCatalogV2 } from "@opencircuit/design-engine";
import { compareDesignV2Tokens, detachedFrozenDesignV2Value } from "@opencircuit/design-schema";

export type PowerDesignV2ProductionBlocker =
  | "incomplete_recipe_profile_coverage"
  | "incompatible_facts_schema_versions"
  | "no_release_eligible_recipe_contract"
  | "no_independently_reviewed_profiles"
  | "unrecognized_installed_recipe_contract";

type RecipeFactsSchemaVersion = "1.0.0" | "2.0.0" | "3.0.0" | "3.3.0" | "3.4.0";

export interface PowerDesignV2ProfileRequirementStatus {
  requirementId: string;
  partClass: PartClassId;
  factsSchemaVersion: RecipeFactsSchemaVersion;
  exactProfileContentHash: `sha256:${string}` | null;
  factsSchemaProfileCount: number;
  reviewedProfileCount: number;
  otherFactsSchemaVersions: string[];
}

export interface PowerDesignV2RecipeReadiness {
  recipeId: string;
  recipeVersion: string;
  recognizedContract: boolean;
  releaseEligible: boolean;
  ready: boolean;
  profileRequirements: PowerDesignV2ProfileRequirementStatus[];
}

export interface PowerDesignV2ProductionStatus {
  status: "blocked" | "ready";
  reason: PowerDesignV2ProductionBlocker | null;
  catalogVersion: string;
  catalogProfileCount: number;
  reviewedProfileCount: number;
  compatibleProfileCount: number;
  installedRecipeSet: boolean;
  factsV2RecipeInstalled: boolean;
  readyRecipeIds: string[];
  missingProfileRequirements: string[];
  recipeReadiness: PowerDesignV2RecipeReadiness[];
  diagnostics: string[];
}

interface RecipeProfileRequirement {
  requirementId: string;
  partClass: PartClassId;
  factsSchemaVersion: RecipeFactsSchemaVersion;
  exactProfileContentHash?: `sha256:${string}`;
}

interface RecipeProfileContract {
  id: string;
  version: string;
  contentHash?: `sha256:${string}`;
  releaseEligible: boolean;
  profileRequirements: readonly RecipeProfileRequirement[];
}

const RECIPE_PROFILE_CONTRACTS: readonly RecipeProfileContract[] = [
  {
    id: "power.native.integrated-synchronous-buck",
    version: "1.0.0",
    releaseEligible: false,
    profileRequirements: [
      { requirementId: "integrated-regulator", partClass: "power.integrated-synchronous-buck-regulator", factsSchemaVersion: "1.0.0" },
      { requirementId: "power-inductor", partClass: "power.power-inductor", factsSchemaVersion: "1.0.0" },
      { requirementId: "general-purpose-resistor", partClass: "shared.general-purpose-resistor", factsSchemaVersion: "1.0.0" },
      { requirementId: "generic-mlcc-support", partClass: "shared.mlcc-capacitor", factsSchemaVersion: "1.0.0" },
    ],
  },
  {
    id: "power.native.facts-v2",
    version: "2.0.0",
    releaseEligible: false,
    profileRequirements: [
      { requirementId: "external-controller", partClass: "power.external-fet-synchronous-buck-controller", factsSchemaVersion: "2.0.0" },
      { requirementId: "integrated-regulator", partClass: "power.integrated-synchronous-buck-regulator", factsSchemaVersion: "2.0.0" },
      { requirementId: "power-inductor", partClass: "power.power-inductor", factsSchemaVersion: "2.0.0" },
      { requirementId: "current-sense-resistor", partClass: "shared.current-sense-resistor", factsSchemaVersion: "2.0.0" },
      { requirementId: "general-purpose-resistor", partClass: "shared.general-purpose-resistor", factsSchemaVersion: "2.0.0" },
      { requirementId: "generic-mlcc-support", partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
      { requirementId: "power-mosfet", partClass: "shared.n-channel-power-mosfet", factsSchemaVersion: "2.0.0" },
    ],
  },
  {
    id: "power.native.external-fet-synchronous-buck.facts-v3",
    version: "3.0.0",
    contentHash: "sha256:1a8be545a31f9403ab9426486f63f1be64e891ce38fa788ad301656ba958c538",
    releaseEligible: false,
    profileRequirements: [
      { requirementId: "external-controller", partClass: "power.external-fet-synchronous-buck-controller", factsSchemaVersion: "2.0.0" },
      { requirementId: "power-inductor", partClass: "power.power-inductor", factsSchemaVersion: "2.0.0" },
      { requirementId: "current-sense-resistor", partClass: "shared.current-sense-resistor", factsSchemaVersion: "2.0.0" },
      { requirementId: "general-purpose-resistor", partClass: "shared.general-purpose-resistor", factsSchemaVersion: "2.0.0" },
      { requirementId: "generic-mlcc-support", partClass: "shared.mlcc-capacitor", factsSchemaVersion: "2.0.0" },
      { requirementId: "power-mosfet", partClass: "shared.n-channel-power-mosfet", factsSchemaVersion: "3.0.0" },
    ],
  },
  {
    id: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
    version: "3.4.6",
    contentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
    releaseEligible: true,
    profileRequirements: [
      {
        requirementId: "integrated-regulator",
        partClass: "power.integrated-synchronous-buck-regulator",
        factsSchemaVersion: "3.3.0",
        exactProfileContentHash: "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
      },
      {
        requirementId: "power-inductor",
        partClass: "power.power-inductor",
        factsSchemaVersion: "3.4.0",
        exactProfileContentHash: "sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b",
      },
      { requirementId: "general-purpose-resistor", partClass: "shared.general-purpose-resistor", factsSchemaVersion: "2.0.0" },
      {
        requirementId: "generic-mlcc-support",
        partClass: "shared.mlcc-capacitor",
        factsSchemaVersion: "2.0.0",
      },
      {
        requirementId: "output-capacitor-bank",
        partClass: "shared.mlcc-capacitor",
        factsSchemaVersion: "2.0.0",
        exactProfileContentHash: "sha256:ba45d2aae55200c43cb69718e5d31f5e34f5995e049a60945072f6eac05fc5da",
      },
    ],
  },
];

function contractKey(id: string, version: string): string {
  return `${id}@${version}`;
}

const CONTRACT_BY_KEY = new Map(RECIPE_PROFILE_CONTRACTS.map((contract) => [
  contractKey(contract.id, contract.version),
  contract,
]));
const POWER_RELEVANT_PART_CLASSES = new Set(RECIPE_PROFILE_CONTRACTS.flatMap((contract) => (
  contract.profileRequirements.map((requirement) => requirement.partClass)
)));

function requirementToken(
  requirement: Readonly<PowerDesignV2ProfileRequirementStatus>,
  disambiguate = false,
): string {
  const base = `${requirement.partClass}@facts-${requirement.factsSchemaVersion}`;
  return disambiguate ? `${base}#${requirement.requirementId}` : base;
}

/**
 * Assesses exact profile coverage for a catalog already validated by design-engine.
 * It does not parse, review, admit, or mutate profile bytes.
 */
export function assessPowerDesignV2ProductionReadiness(
  catalog: Readonly<ReviewedProfileCatalogV2>,
  installedRecipes: readonly DesignRecipeRefV2[],
): Readonly<PowerDesignV2ProductionStatus> {
  const recipes = [...installedRecipes]
    .sort((left, right) => compareDesignV2Tokens(contractKey(left.id, left.version), contractKey(right.id, right.version)))
    .map((recipe): PowerDesignV2RecipeReadiness => {
      const contract = CONTRACT_BY_KEY.get(contractKey(recipe.id, recipe.version));
      if (contract === undefined || (contract.contentHash !== undefined && contract.contentHash !== recipe.contentHash)) {
        return {
          recipeId: recipe.id,
          recipeVersion: recipe.version,
          recognizedContract: false,
          releaseEligible: false,
          ready: false,
          profileRequirements: [],
        };
      }
      const profileRequirements = [...contract.profileRequirements]
        .sort((left, right) => compareDesignV2Tokens(
          `${left.partClass}\n${left.requirementId}`,
          `${right.partClass}\n${right.requirementId}`,
        ))
        .map((requirement): PowerDesignV2ProfileRequirementStatus => {
          const matchingClass = catalog.profiles.filter((profile) => profile.partClass === requirement.partClass);
          const matchingFactsSchema = matchingClass.filter((profile) => (
            profile.factsSchemaVersion === requirement.factsSchemaVersion
          ));
          return {
            requirementId: requirement.requirementId,
            partClass: requirement.partClass,
            factsSchemaVersion: requirement.factsSchemaVersion,
            exactProfileContentHash: requirement.exactProfileContentHash ?? null,
            factsSchemaProfileCount: matchingFactsSchema.length,
            reviewedProfileCount: matchingFactsSchema.filter((profile) => (
              requirement.exactProfileContentHash === undefined
              || designProfileEnvelopeContentHash(profile) === requirement.exactProfileContentHash
            )).length,
            otherFactsSchemaVersions: [...new Set(matchingClass
              .map((profile) => profile.factsSchemaVersion)
              .filter((version) => version !== requirement.factsSchemaVersion))]
              .sort(compareDesignV2Tokens),
          };
        });
      const profileCoverageComplete = profileRequirements.every((requirement) => requirement.reviewedProfileCount > 0);
      return {
        recipeId: recipe.id,
        recipeVersion: recipe.version,
        recognizedContract: true,
        releaseEligible: contract.releaseEligible,
        ready: contract.releaseEligible && profileCoverageComplete,
        profileRequirements,
      };
    });

  const installedRecipeSet = recipes.length > 0 && recipes.every((recipe) => recipe.recognizedContract);
  const releaseEligibleRecipes = recipes.filter((recipe) => recipe.releaseEligible);
  const readyRecipeIds = recipes
    .filter((recipe) => recipe.ready)
    .map((recipe) => recipe.recipeId)
    .sort(compareDesignV2Tokens);
  const missingRequirements = recipes.flatMap((recipe) => recipe.profileRequirements
    .filter((requirement) => requirement.reviewedProfileCount === 0)
    .map((requirement) => ({ recipe, requirement })));
  const releaseEligibleMissingRequirements = releaseEligibleRecipes
    .flatMap((recipe) => recipe.profileRequirements)
    .filter((requirement) => requirement.reviewedProfileCount === 0);
  const missingProfileRequirements = [...new Set(missingRequirements.map(({ recipe, requirement }) => requirementToken(
    requirement,
    recipe.profileRequirements.filter((entry) => (
      entry.partClass === requirement.partClass
      && entry.factsSchemaVersion === requirement.factsSchemaVersion
    )).length > 1,
  )))]
    .sort(compareDesignV2Tokens);
  const compatibleProfiles = new Set<string>();
  const reviewedProfileCount = catalog.profiles
    .filter((profile) => POWER_RELEVANT_PART_CLASSES.has(profile.partClass))
    .length;
  for (const recipe of recipes) {
    for (const requirement of recipe.profileRequirements) {
      for (const profile of catalog.profiles) {
        if (
          profile.partClass !== requirement.partClass
          || profile.factsSchemaVersion !== requirement.factsSchemaVersion
          || (
            requirement.exactProfileContentHash !== null
            && designProfileEnvelopeContentHash(profile) !== requirement.exactProfileContentHash
          )
        ) continue;
        compatibleProfiles.add([
          profile.partClass,
          profile.factsSchemaVersion,
          profile.part.manufacturerId,
          profile.part.manufacturerPartNumber,
        ].join("\n"));
      }
    }
  }

  let reason: PowerDesignV2ProductionBlocker | null = null;
  if (!installedRecipeSet) reason = "unrecognized_installed_recipe_contract";
  else if (reviewedProfileCount === 0) reason = "no_independently_reviewed_profiles";
  else if (releaseEligibleRecipes.length === 0) reason = "no_release_eligible_recipe_contract";
  else if (readyRecipeIds.length === 0) {
    reason = releaseEligibleMissingRequirements.some((requirement) => (
      requirement.factsSchemaProfileCount === 0
      && requirement.otherFactsSchemaVersions.length > 0
    ))
      ? "incompatible_facts_schema_versions"
      : "incomplete_recipe_profile_coverage";
  }

  const diagnostics = [...new Set([
    ...recipes
      .filter((recipe) => !recipe.recognizedContract)
      .map((recipe) => `unrecognized_recipe:${contractKey(recipe.recipeId, recipe.recipeVersion)}`),
    ...missingRequirements.map(({ recipe, requirement }) => {
      const token = requirementToken(
        requirement,
        recipe.profileRequirements.filter((entry) => (
          entry.partClass === requirement.partClass
          && entry.factsSchemaVersion === requirement.factsSchemaVersion
        )).length > 1,
      );
      return requirement.factsSchemaProfileCount > 0 || requirement.otherFactsSchemaVersions.length === 0
        ? `missing_profile_requirement:${token}`
        : `profile_schema_mismatch:${token}:found-${requirement.otherFactsSchemaVersions.join(",")}`;
    }),
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
      recipe.recipeId === "power.native.facts-v2"
      && recipe.recipeVersion === "2.0.0"
    )),
    readyRecipeIds,
    missingProfileRequirements,
    recipeReadiness: recipes,
    diagnostics,
  });
}
