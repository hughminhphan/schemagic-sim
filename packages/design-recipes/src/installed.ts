import { canonicalDesignV2Payload, compareDesignV2Tokens } from "@opencircuit/design-schema";
import type { NativeRecipeV2 } from "./types";

function snapshotRecipe(source: NativeRecipeV2): NativeRecipeV2 {
  const callbacks = {
    supports: source.supports,
    enumerate: source.enumerate,
    solve: source.solve,
    match: source.match,
    check: source.check,
    estimate: source.estimate,
    materialize: source.materialize,
  };
  const recipe: NativeRecipeV2 = {
    id: source.id,
    version: source.version,
    contentHash: source.contentHash,
    applications: Object.freeze([...source.applications]) as unknown as NativeRecipeV2["applications"],
    metricDeclarations: Object.freeze(source.metricDeclarations.map((entry) => Object.freeze({ ...entry }))) as NativeRecipeV2["metricDeclarations"],
    supports: Object.freeze((...args: Parameters<NativeRecipeV2["supports"]>) => Reflect.apply(callbacks.supports, undefined, args)),
    enumerate: Object.freeze((...args: Parameters<NativeRecipeV2["enumerate"]>) => Reflect.apply(callbacks.enumerate, undefined, args)),
    solve: Object.freeze((...args: Parameters<NativeRecipeV2["solve"]>) => Reflect.apply(callbacks.solve, undefined, args)),
    match: Object.freeze((...args: Parameters<NativeRecipeV2["match"]>) => Reflect.apply(callbacks.match, undefined, args)),
    check: Object.freeze((...args: Parameters<NativeRecipeV2["check"]>) => Reflect.apply(callbacks.check, undefined, args)),
    estimate: Object.freeze((...args: Parameters<NativeRecipeV2["estimate"]>) => Reflect.apply(callbacks.estimate, undefined, args)),
    materialize: Object.freeze((...args: Parameters<NativeRecipeV2["materialize"]>) => Reflect.apply(callbacks.materialize, undefined, args)),
  };
  return Object.freeze(recipe);
}

function recipeKey(recipe: Readonly<NativeRecipeV2>): string {
  return canonicalDesignV2Payload([recipe.id, recipe.version, recipe.contentHash]);
}

export function installedRecipeSet(...sources: readonly NativeRecipeV2[]): readonly NativeRecipeV2[] {
  const recipes = sources
    .map(snapshotRecipe)
    .sort((left, right) => compareDesignV2Tokens(recipeKey(left), recipeKey(right)));
  if (new Set(recipes.map((recipe) => recipe.id)).size !== recipes.length) {
    throw new TypeError("Installed recipe IDs must be unique within an application");
  }
  return Object.freeze(recipes);
}
