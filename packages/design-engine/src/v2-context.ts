import {
  FACTS_SCHEMA_VERSION, FACTS_SCHEMA_VERSION_V2, FACTS_SCHEMA_VERSION_V3, FACTS_SCHEMA_VERSION_V31, FACTS_SCHEMA_VERSION_V32, FACTS_SCHEMA_VERSION_V33, FACTS_SCHEMA_VERSION_V34,
  designProfileId, getDesignProfileCodecForVersion, loadReviewedDesignLibraryEnvelope,
  parseDesignProfileFor, parseDesignProfileForV2, parseDesignProfileForV3, parseDesignProfileForV31, parseDesignProfileForV32, parseDesignProfileForV33, parseDesignProfileForV34,
  validateDesignProfileEnvelope,
  type DesignLibraryDocuments, type DesignProfileEnvelope, type DesignProfileForCodec,
  type PartClassId, type VersionedDesignProfileCodec,
} from "@opencircuit/design-library/v2-runtime";
import {
  DESIGN_CONTEXT_V2_MAX_CANONICAL_BYTES, DESIGN_V2_MAX_RANKING_CRITERIA,
  DESIGN_V2_MAX_RECIPES, DESIGN_V2_MAX_REVIEWED_PROFILES,
  DesignParseErrorV2, canonicalDesignV2Payload, compareDesignV2Tokens,
  boundedDetachedFrozenDesignV2Value, designSha256ContentHash, designValidationIssue, detachedFrozenDesignV2Value, escapePointer,
  type ElectricalDesignObjectiveV2, type Sha256ContentHash,
} from "@opencircuit/design-schema";
import {
  InstalledRecipeRegistryCapabilityV2, _mintInstalledRecipeRegistryCapabilityV2,
  type CompilerImplementationRefV2, type DesignRecipeRefV2, type DesignRecipeV2,
  type ElectricalDesignContextManifestV2, type ElectricalRankingPolicyV2,
  type ReviewedProfileCatalogV2,
} from "./v2-types";

const HASH = /^sha256:[0-9a-f]{64}$/;
const METRIC_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const RESERVED = ["sourcing.", "commercial.", "offer.", "provider.", "distributor."] as const;
const OBJECTIVES: readonly ElectricalDesignObjectiveV2[] = ["area", "balanced", "efficiency", "temperature"];
const APPLICATIONS=["motor.brushed-dc","power.buck"] as const;
const SI_UNITS=new Set(["1","A","F","H","Hz","K","V","V_s_per_rad","W","count","m","m2","ohm","rad_per_s","s"]);

function parseError(artifact: "electrical_ranking_policy" | "reviewed_profile_catalog" | "electrical_context_manifest", path: string, code: "invalid_type" | "unknown_key" | "invalid_value" | "invalid_hash" | "invalid_order" | "resource_limit" = "invalid_value"): never {
  throw new DesignParseErrorV2({ code: code === "resource_limit" ? "resource_limit" : "invalid_document", stage: "parse", artifact }, [designValidationIssue(code, path)]);
}
function object(value: unknown, artifact: Parameters<typeof parseError>[0], path = ""): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return parseError(artifact, path, "invalid_type");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], artifact: Parameters<typeof parseError>[0], path = ""): void {
  const set = new Set(allowed);
  for (const key of Object.keys(value)) if (!set.has(key)) parseError(artifact, `${path}/${escapePointer(key)}`, "unknown_key");
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(value, key)) parseError(artifact, `${path}/${escapePointer(key)}`, "invalid_type");
}
function sorted<T>(values: readonly T[], key: (value: T) => string): boolean {
  for (let index = 1; index < values.length; index += 1) if (compareDesignV2Tokens(key(values[index - 1]!), key(values[index]!)) >= 0) return false;
  return true;
}
function contentPayload(value: unknown): string { return canonicalDesignV2Payload(value, true); }

export function canonicalElectricalRankingPolicyV2Payload(policy: Omit<ElectricalRankingPolicyV2, "contentHash"> | ElectricalRankingPolicyV2): string { return contentPayload(policy); }
export function calculateElectricalRankingPolicyV2ContentHash(policy: Omit<ElectricalRankingPolicyV2, "contentHash"> | ElectricalRankingPolicyV2): Sha256ContentHash { return designSha256ContentHash(canonicalElectricalRankingPolicyV2Payload(policy)); }

function validateCriterion(raw: unknown, path: string, artifact: "electrical_ranking_policy"): { source: "metric"; metricId: string; direction: "maximize" | "minimize" } {
  const value = object(raw, artifact, path); keys(value, ["source", "metricId", "direction"], artifact, path);
  if (value.source !== "metric" || typeof value.metricId !== "string" || !METRIC_ID.test(value.metricId) || RESERVED.some((prefix) => (value.metricId as string).startsWith(prefix)) || (value.direction !== "maximize" && value.direction !== "minimize")) parseError(artifact, path);
  return value as ReturnType<typeof validateCriterion>;
}

export function parseElectricalRankingPolicyV2(input: unknown): ElectricalRankingPolicyV2 {
  const artifact = "electrical_ranking_policy" as const;const value = object(boundedDetachedFrozenDesignV2Value(input,artifact,DESIGN_CONTEXT_V2_MAX_CANONICAL_BYTES), artifact); keys(value, ["format", "schemaVersion", "version", "application", "paretoCriteria", "rankingProfiles", "contentHash"], artifact);
  if (value.format !== "schemagic-electrical-ranking-policy" || value.schemaVersion !== 2 || typeof value.version !== "string" || !value.version || (value.application !== "motor.brushed-dc" && value.application !== "power.buck") || typeof value.contentHash !== "string" || !HASH.test(value.contentHash)) parseError(artifact, "");
  if (!Array.isArray(value.paretoCriteria)) parseError(artifact, "/paretoCriteria", "invalid_type");
  if (value.paretoCriteria.length > DESIGN_V2_MAX_RANKING_CRITERIA) parseError(artifact, "/paretoCriteria", "resource_limit");
  const pareto = value.paretoCriteria.map((entry, index) => validateCriterion(entry, `/paretoCriteria/${index}`, artifact));
  if (!sorted(pareto, (entry) => `${entry.metricId}\n${entry.direction}`) || new Set(pareto.map((entry) => entry.metricId)).size !== pareto.length) parseError(artifact, "/paretoCriteria", "invalid_order");
  const profiles = object(value.rankingProfiles, artifact, "/rankingProfiles"); keys(profiles, OBJECTIVES, artifact, "/rankingProfiles");
  for (const objective of OBJECTIVES) {
    if (!Array.isArray(profiles[objective])) parseError(artifact, `/rankingProfiles/${objective}`, "invalid_type");
    if ((profiles[objective] as unknown[]).length > DESIGN_V2_MAX_RANKING_CRITERIA) parseError(artifact, `/rankingProfiles/${objective}`, "resource_limit");
    const criteria = (profiles[objective] as unknown[]).map((entry, index) => validateCriterion(entry, `/rankingProfiles/${objective}/${index}`, artifact));
    if (new Set(criteria.map((entry) => entry.metricId)).size !== criteria.length) parseError(artifact, `/rankingProfiles/${objective}`, "invalid_order");
  }
  if (value.contentHash !== calculateElectricalRankingPolicyV2ContentHash(value as unknown as ElectricalRankingPolicyV2)) parseError(artifact, "/contentHash", "invalid_hash");
  return detachedFrozenDesignV2Value(value as unknown as ElectricalRankingPolicyV2);
}

export function canonicalReviewedProfileCatalogV2Payload(catalog: Omit<ReviewedProfileCatalogV2, "contentHash"> | ReviewedProfileCatalogV2): string { return contentPayload(catalog); }
export function calculateReviewedProfileCatalogV2ContentHash(catalog: Omit<ReviewedProfileCatalogV2, "contentHash"> | ReviewedProfileCatalogV2): Sha256ContentHash { return designSha256ContentHash(canonicalReviewedProfileCatalogV2Payload(catalog)); }
export function buildReviewedProfileCatalogV2(documents: Readonly<DesignLibraryDocuments>): ReviewedProfileCatalogV2 {
  const reviewed = loadReviewedDesignLibraryEnvelope(documents);
  const profiles = [...reviewed.profiles].sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
  const payload: Omit<ReviewedProfileCatalogV2, "contentHash"> = { format: "schemagic-reviewed-profile-catalog", schemaVersion: 2, version: reviewed.version, sourceRelease: { version: reviewed.version, contentHash: reviewed.contentHash }, profiles };
  return detachedFrozenDesignV2Value({ ...payload, contentHash: calculateReviewedProfileCatalogV2ContentHash(payload) });
}
export function parseReviewedProfileCatalogV2(input: unknown): ReviewedProfileCatalogV2 {
  const artifact = "reviewed_profile_catalog" as const;const value = object(boundedDetachedFrozenDesignV2Value(input,artifact,DESIGN_CONTEXT_V2_MAX_CANONICAL_BYTES), artifact); keys(value, ["format", "schemaVersion", "version", "sourceRelease", "profiles", "contentHash"], artifact);
  if (value.format !== "schemagic-reviewed-profile-catalog" || value.schemaVersion !== 2 || typeof value.version !== "string" || !value.version || !Array.isArray(value.profiles)) parseError(artifact, "");
  if(value.profiles.length>DESIGN_V2_MAX_REVIEWED_PROFILES)parseError(artifact,"/profiles","resource_limit");
  value.profiles.forEach((profile,index)=>{
    const issues=validateDesignProfileEnvelope(profile).filter((issue)=>issue.code!=="unknown_manufacturer");
    if(issues.length>0)parseError(artifact,`/profiles/${index}`);
    const envelope=profile as DesignProfileEnvelope;
    let admissionIssues;
    try {
      if(envelope.factsSchemaVersion===FACTS_SCHEMA_VERSION){
        const codec=getDesignProfileCodecForVersion(envelope.partClass,FACTS_SCHEMA_VERSION);
        admissionIssues=codec.validateAdmission(parseDesignProfileFor(codec,envelope));
      }else if(envelope.factsSchemaVersion===FACTS_SCHEMA_VERSION_V2){
        const codec=getDesignProfileCodecForVersion(envelope.partClass,FACTS_SCHEMA_VERSION_V2);
        admissionIssues=codec.validateAdmission(parseDesignProfileForV2(codec,envelope));
      }else if(envelope.factsSchemaVersion===FACTS_SCHEMA_VERSION_V3){
        if(envelope.partClass!=="shared.n-channel-power-mosfet"&&envelope.partClass!=="motor.supply-tvs-diode")parseError(artifact,`/profiles/${index}/partClass`);
        const codec=getDesignProfileCodecForVersion(envelope.partClass,FACTS_SCHEMA_VERSION_V3);
        admissionIssues=codec.validateAdmission(parseDesignProfileForV3(codec,envelope));
      }else if(envelope.factsSchemaVersion===FACTS_SCHEMA_VERSION_V31){
        if(envelope.partClass!=="motor.full-bridge-gate-driver")parseError(artifact,`/profiles/${index}/partClass`);
        const codec=getDesignProfileCodecForVersion(envelope.partClass,FACTS_SCHEMA_VERSION_V31);
        admissionIssues=codec.validateAdmission(parseDesignProfileForV31(codec,envelope));
      }else if(envelope.factsSchemaVersion===FACTS_SCHEMA_VERSION_V32){
        if(envelope.partClass!=="motor.integrated-h-bridge")parseError(artifact,`/profiles/${index}/partClass`);
        const codec=getDesignProfileCodecForVersion(envelope.partClass,FACTS_SCHEMA_VERSION_V32);
        admissionIssues=codec.validateAdmission(parseDesignProfileForV32(codec,envelope));
      }else if(envelope.factsSchemaVersion===FACTS_SCHEMA_VERSION_V33){
        if(envelope.partClass!=="power.integrated-synchronous-buck-regulator")parseError(artifact,`/profiles/${index}/partClass`);
        const codec=getDesignProfileCodecForVersion(envelope.partClass,FACTS_SCHEMA_VERSION_V33);
        admissionIssues=codec.validateAdmission(parseDesignProfileForV33(codec,envelope));
      }else if(envelope.factsSchemaVersion===FACTS_SCHEMA_VERSION_V34){
        if(envelope.partClass!=="power.power-inductor")parseError(artifact,`/profiles/${index}/partClass`);
        const codec=getDesignProfileCodecForVersion(envelope.partClass,FACTS_SCHEMA_VERSION_V34);
        admissionIssues=codec.validateAdmission(parseDesignProfileForV34(codec,envelope));
      }else parseError(artifact,`/profiles/${index}/factsSchemaVersion`);
    }catch{parseError(artifact,`/profiles/${index}`);}
    if(admissionIssues.length>0)parseError(artifact,`/profiles/${index}`);
  });
  if (!sorted(value.profiles, (entry) => { const profile = entry as ReviewedProfileCatalogV2["profiles"][number]; return designProfileId(profile.partClass, profile.part); })) parseError(artifact, "/profiles", "invalid_order");
  const source = object(value.sourceRelease, artifact, "/sourceRelease"); keys(source, ["version", "contentHash"], artifact, "/sourceRelease");
  if (source.version !== value.version || typeof source.contentHash !== "string" || !HASH.test(source.contentHash) || typeof value.contentHash !== "string" || value.contentHash !== calculateReviewedProfileCatalogV2ContentHash(value as unknown as ReviewedProfileCatalogV2)) parseError(artifact, "/contentHash", "invalid_hash");
  return detachedFrozenDesignV2Value(value as unknown as ReviewedProfileCatalogV2);
}
export function getReviewedProfilesForV2<
  ClassId extends PartClassId,
  Codec extends VersionedDesignProfileCodec<ClassId>,
>(catalog: Readonly<ReviewedProfileCatalogV2>, codec: Readonly<Codec>): readonly DesignProfileForCodec<Codec>[];
export function getReviewedProfilesForV2(
  catalog: Readonly<ReviewedProfileCatalogV2>,
  codec: Readonly<VersionedDesignProfileCodec<PartClassId>>,
): readonly DesignProfileEnvelope[] {
  const parsed = parseReviewedProfileCatalogV2(catalog);
  if (codec.factsSchemaVersion === FACTS_SCHEMA_VERSION) {
    const exactCodec = getDesignProfileCodecForVersion(codec.partClass, FACTS_SCHEMA_VERSION);
    const profiles = parsed.profiles
      .filter((profile) => profile.partClass === exactCodec.partClass && profile.factsSchemaVersion === exactCodec.factsSchemaVersion)
      .map((profile) => parseDesignProfileFor(exactCodec, profile))
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
    return detachedFrozenDesignV2Value(profiles);
  }
  if (codec.factsSchemaVersion === FACTS_SCHEMA_VERSION_V2) {
    const exactCodec = getDesignProfileCodecForVersion(codec.partClass, FACTS_SCHEMA_VERSION_V2);
    const profiles = parsed.profiles
      .filter((profile) => profile.partClass === exactCodec.partClass && profile.factsSchemaVersion === exactCodec.factsSchemaVersion)
      .map((profile) => parseDesignProfileForV2(exactCodec, profile))
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
    return detachedFrozenDesignV2Value(profiles);
  }
  if (codec.factsSchemaVersion === FACTS_SCHEMA_VERSION_V3) {
    const partClass=codec.partClass;
    if(partClass!=="shared.n-channel-power-mosfet"&&partClass!=="motor.supply-tvs-diode")throw new TypeError(`factsSchemaVersion [unknown_codec_version]: ${FACTS_SCHEMA_VERSION_V3}`);
    const exactCodec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V3);
    const profiles = parsed.profiles
      .filter((profile) => profile.partClass === exactCodec.partClass && profile.factsSchemaVersion === exactCodec.factsSchemaVersion)
      .map((profile) => parseDesignProfileForV3(exactCodec, profile))
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
    return detachedFrozenDesignV2Value(profiles);
  }
  if (codec.factsSchemaVersion === FACTS_SCHEMA_VERSION_V31) {
    const partClass=codec.partClass;
    if(partClass!=="motor.full-bridge-gate-driver")throw new TypeError(`factsSchemaVersion [unknown_codec_version]: ${FACTS_SCHEMA_VERSION_V31}`);
    const exactCodec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V31);
    const profiles = parsed.profiles
      .filter((profile) => profile.partClass === exactCodec.partClass && profile.factsSchemaVersion === exactCodec.factsSchemaVersion)
      .map((profile) => parseDesignProfileForV31(exactCodec, profile))
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
    return detachedFrozenDesignV2Value(profiles);
  }
  if (codec.factsSchemaVersion === FACTS_SCHEMA_VERSION_V32) {
    const partClass=codec.partClass;
    if(partClass!=="motor.integrated-h-bridge")throw new TypeError(`factsSchemaVersion [unknown_codec_version]: ${FACTS_SCHEMA_VERSION_V32}`);
    const exactCodec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V32);
    const profiles = parsed.profiles
      .filter((profile) => profile.partClass === exactCodec.partClass && profile.factsSchemaVersion === exactCodec.factsSchemaVersion)
      .map((profile) => parseDesignProfileForV32(exactCodec, profile))
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
    return detachedFrozenDesignV2Value(profiles);
  }
  if (codec.factsSchemaVersion === FACTS_SCHEMA_VERSION_V33) {
    const partClass=codec.partClass;
    if(partClass!=="power.integrated-synchronous-buck-regulator")throw new TypeError(`factsSchemaVersion [unknown_codec_version]: ${FACTS_SCHEMA_VERSION_V33}`);
    const exactCodec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V33);
    const profiles = parsed.profiles
      .filter((profile) => profile.partClass === exactCodec.partClass && profile.factsSchemaVersion === exactCodec.factsSchemaVersion)
      .map((profile) => parseDesignProfileForV33(exactCodec, profile))
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
    return detachedFrozenDesignV2Value(profiles);
  }
  if (codec.factsSchemaVersion === FACTS_SCHEMA_VERSION_V34) {
    const partClass=codec.partClass;
    if(partClass!=="power.power-inductor")throw new TypeError(`factsSchemaVersion [unknown_codec_version]: ${FACTS_SCHEMA_VERSION_V34}`);
    const exactCodec = getDesignProfileCodecForVersion(partClass, FACTS_SCHEMA_VERSION_V34);
    const profiles = parsed.profiles
      .filter((profile) => profile.partClass === exactCodec.partClass && profile.factsSchemaVersion === exactCodec.factsSchemaVersion)
      .map((profile) => parseDesignProfileForV34(exactCodec, profile))
      .sort((left, right) => compareDesignV2Tokens(designProfileId(left.partClass, left.part), designProfileId(right.partClass, right.part)));
    return detachedFrozenDesignV2Value(profiles);
  }
  throw new TypeError(`factsSchemaVersion [unknown_codec_version]: ${String((codec as { factsSchemaVersion?: unknown }).factsSchemaVersion)}`);
}

export function canonicalElectricalDesignContextManifestV2Payload(manifest: Omit<ElectricalDesignContextManifestV2, "contentHash"> | ElectricalDesignContextManifestV2): string { return contentPayload(manifest); }
export function calculateElectricalDesignContextManifestV2ContentHash(manifest: Omit<ElectricalDesignContextManifestV2, "contentHash"> | ElectricalDesignContextManifestV2): Sha256ContentHash { return designSha256ContentHash(canonicalElectricalDesignContextManifestV2Payload(manifest)); }

function recipeRefKey(ref: DesignRecipeRefV2): string { return canonicalDesignV2Payload([ref.id, ref.version, ref.contentHash]); }
function validateRecipeRef(raw: unknown, index: number): DesignRecipeRefV2 {
  const artifact = "electrical_context_manifest" as const; const path = `/recipes/${index}`; const value = object(raw, artifact, path);
  keys(value, ["id", "version", "contentHash", "applications", "metricDeclarations"], artifact, path);
  if (typeof value.id !== "string" || !value.id || typeof value.version !== "string" || !value.version || typeof value.contentHash !== "string" || !HASH.test(value.contentHash) || !Array.isArray(value.applications) || !Array.isArray(value.metricDeclarations)) parseError(artifact, path);
  if (value.applications.length === 0 || !sorted(value.applications as string[], String) || !(value.applications as unknown[]).every((application)=>APPLICATIONS.includes(application as never)) || !sorted(value.metricDeclarations as Record<string, unknown>[], (entry) => `${String(entry.id)}\n${String(entry.unit)}`)) parseError(artifact, path, "invalid_order");
  for (const [declarationIndex,declaration] of (value.metricDeclarations as Record<string, unknown>[]).entries()) {
    keys(declaration,["id","unit"],artifact,`${path}/metricDeclarations/${declarationIndex}`);
    const id = declaration.id;
    if (typeof id !== "string" || !METRIC_ID.test(id) || RESERVED.some((prefix) => id.startsWith(prefix)) || typeof declaration.unit !== "string" || !SI_UNITS.has(declaration.unit)) parseError(artifact, path);
  }
  if(new Set((value.metricDeclarations as Record<string,unknown>[]).map((entry)=>entry.id)).size!==(value.metricDeclarations as unknown[]).length)parseError(artifact,`${path}/metricDeclarations`,"invalid_order");
  return value as unknown as DesignRecipeRefV2;
}
export function parseElectricalDesignContextManifestV2(input: unknown): ElectricalDesignContextManifestV2 {
  const artifact = "electrical_context_manifest" as const;const value = object(boundedDetachedFrozenDesignV2Value(input,artifact,DESIGN_CONTEXT_V2_MAX_CANONICAL_BYTES), artifact); keys(value, ["format", "schemaVersion", "version", "application", "compiler", "catalog", "rankingPolicy", "recipes", "contentHash"], artifact);
  if (value.format !== "schemagic-electrical-design-context" || value.schemaVersion !== 2 || typeof value.version !== "string" || !value.version || (value.application !== "motor.brushed-dc" && value.application !== "power.buck")) parseError(artifact, "");
  if(!Array.isArray(value.recipes))parseError(artifact,"/recipes","invalid_type");
  if(value.recipes.length>DESIGN_V2_MAX_RECIPES)parseError(artifact,"/recipes","resource_limit");
  const compiler = object(value.compiler, artifact, "/compiler"); keys(compiler, ["id", "version", "contentHash"], artifact, "/compiler");
  const catalog = object(value.catalog, artifact, "/catalog"); keys(catalog, ["version", "contentHash", "sourceReleaseContentHash"], artifact, "/catalog");
  const ranking = object(value.rankingPolicy, artifact, "/rankingPolicy"); keys(ranking, ["version", "contentHash"], artifact, "/rankingPolicy");
  if(compiler.id!=="@opencircuit/design-engine"||typeof compiler.version!=="string"||!compiler.version||typeof compiler.contentHash!=="string"||!HASH.test(compiler.contentHash))parseError(artifact,"/compiler");
  if(typeof catalog.version!=="string"||!catalog.version||typeof catalog.contentHash!=="string"||!HASH.test(catalog.contentHash)||typeof catalog.sourceReleaseContentHash!=="string"||!HASH.test(catalog.sourceReleaseContentHash))parseError(artifact,"/catalog");
  if(typeof ranking.version!=="string"||!ranking.version||typeof ranking.contentHash!=="string"||!HASH.test(ranking.contentHash))parseError(artifact,"/rankingPolicy");
  const recipes = value.recipes.map(validateRecipeRef);
  if (!sorted(recipes, recipeRefKey) || new Set(recipes.map((entry) => entry.id)).size !== recipes.length || recipes.some((entry) => !entry.applications.includes(value.application as never))) parseError(artifact, "/recipes", "invalid_order");
  if (typeof value.contentHash !== "string" || !HASH.test(value.contentHash) || value.contentHash !== calculateElectricalDesignContextManifestV2ContentHash(value as unknown as ElectricalDesignContextManifestV2)) parseError(artifact, "/contentHash", "invalid_hash");
  return detachedFrozenDesignV2Value(value as unknown as ElectricalDesignContextManifestV2);
}

const compilerPayload = { id: "@opencircuit/design-engine", version: "0.0.1", contract: "schemagic-designer-v2.1" } as const;
const INSTALLED_COMPILER: CompilerImplementationRefV2 = detachedFrozenDesignV2Value({ id: compilerPayload.id, version: compilerPayload.version, contentHash: designSha256ContentHash(canonicalDesignV2Payload(compilerPayload)) });
export function getInstalledCompilerImplementationRefV2(): Readonly<CompilerImplementationRefV2> { return detachedFrozenDesignV2Value(INSTALLED_COMPILER); }

interface InstalledEntry { recipes: readonly DesignRecipeV2[] }
function snapshotInstalledRecipe(recipe: DesignRecipeV2): DesignRecipeV2 {
  const supports = recipe.supports;
  const enumerate = recipe.enumerate;
  const solve = recipe.solve;
  const match = recipe.match;
  const check = recipe.check;
  const estimate = recipe.estimate;
  const materialize = recipe.materialize;
  if ([supports, enumerate, solve, match, check, estimate, materialize].some((callback) => typeof callback !== "function")) throw new TypeError("Installed recipe callbacks must be functions");
  const ref = detachedRecipeRef(recipe);
  return Object.freeze({
    ...ref,
    supports: Object.freeze((...args: Parameters<DesignRecipeV2["supports"]>) => Reflect.apply(supports, undefined, args)),
    enumerate: Object.freeze((...args: Parameters<DesignRecipeV2["enumerate"]>) => Reflect.apply(enumerate, undefined, args)),
    solve: Object.freeze((...args: Parameters<DesignRecipeV2["solve"]>) => Reflect.apply(solve, undefined, args)),
    match: Object.freeze((...args: Parameters<DesignRecipeV2["match"]>) => Reflect.apply(match, undefined, args)),
    check: Object.freeze((...args: Parameters<DesignRecipeV2["check"]>) => Reflect.apply(check, undefined, args)),
    estimate: Object.freeze((...args: Parameters<DesignRecipeV2["estimate"]>) => Reflect.apply(estimate, undefined, args)),
    materialize: Object.freeze((...args: Parameters<DesignRecipeV2["materialize"]>) => Reflect.apply(materialize, undefined, args)),
  });
}
function detachedRecipeRef(recipe: DesignRecipeV2): DesignRecipeRefV2 {
  return detachedFrozenDesignV2Value({ id: recipe.id, version: recipe.version, contentHash: recipe.contentHash, applications: recipe.applications, metricDeclarations: recipe.metricDeclarations });
}
function installedSetKey(recipes: readonly DesignRecipeRefV2[]): string {
  return canonicalDesignV2Payload([...recipes].sort((left, right) => compareDesignV2Tokens(recipeRefKey(left), recipeRefKey(right))));
}
const INSTALLED_BY_APPLICATION = new Map<(typeof APPLICATIONS)[number], readonly DesignRecipeV2[]>();
const INSTALLED_RECIPE_SETS = new Map<string, InstalledEntry>();
const CAPABILITIES = new WeakMap<InstalledRecipeRegistryCapabilityV2, InstalledEntry>();

/** @internal Application-specific runtime leaves register only their own recipes. */
export function _installNativeRecipeSetV2(
  application: (typeof APPLICATIONS)[number],
  sources: readonly DesignRecipeV2[],
): void {
  const recipes = Object.freeze(sources.map(snapshotInstalledRecipe));
  if (
    recipes.length === 0
    || recipes.length > DESIGN_V2_MAX_RECIPES
    || recipes.some((recipe) => !recipe.applications.includes(application))
    || new Set(recipes.map((recipe) => recipe.id)).size !== recipes.length
  ) {
    throw new TypeError(`Invalid installed recipe set for ${application}`);
  }
  const prior = INSTALLED_BY_APPLICATION.get(application);
  if (prior !== undefined) {
    if (installedSetKey(prior.map(detachedRecipeRef)) !== installedSetKey(recipes.map(detachedRecipeRef))) {
      throw new TypeError(`Conflicting installed recipe set for ${application}`);
    }
    return;
  }
  const entry = Object.freeze({ recipes });
  const key = installedSetKey(recipes.map(detachedRecipeRef));
  const collision = INSTALLED_RECIPE_SETS.get(key);
  if (collision !== undefined) throw new TypeError("Installed recipe-set identity collision");
  INSTALLED_BY_APPLICATION.set(application, recipes);
  INSTALLED_RECIPE_SETS.set(key, entry);
}

/** Returns detached immutable identities only; executable recipe callbacks remain engine-private. */
export function getInstalledRecipeRefsV2(application: (typeof APPLICATIONS)[number]): readonly DesignRecipeRefV2[] {
  return detachedFrozenDesignV2Value((INSTALLED_BY_APPLICATION.get(application) ?? []).map(detachedRecipeRef));
}
export function resolveInstalledRecipeRegistryV2(manifestInput: Readonly<ElectricalDesignContextManifestV2>): InstalledRecipeRegistryCapabilityV2 | undefined {
  const manifest = parseElectricalDesignContextManifestV2(manifestInput);
  if (canonicalDesignV2Payload(manifest.compiler) !== canonicalDesignV2Payload(INSTALLED_COMPILER)) return undefined;
  const entry = INSTALLED_RECIPE_SETS.get(installedSetKey(manifest.recipes)); if (!entry) return undefined;
  const capability = _mintInstalledRecipeRegistryCapabilityV2(INSTALLED_COMPILER, manifest.contentHash); CAPABILITIES.set(capability, entry); Object.freeze(capability); return capability;
}
export function _dereferenceInstalledRecipeRegistryV2(capability: InstalledRecipeRegistryCapabilityV2, manifestHash: Sha256ContentHash): readonly DesignRecipeV2[] | undefined {
  const entry = CAPABILITIES.get(capability); return entry && capability.manifestContentHash === manifestHash ? entry.recipes : undefined;
}

export function _contextCanonicalBytesV2(context: { manifest: unknown; catalogDocuments: unknown; rankingPolicy: unknown }): number {
  boundedDetachedFrozenDesignV2Value({manifest:context.manifest,catalogDocuments:context.catalogDocuments,rankingPolicy:context.rankingPolicy},"electrical_context_manifest",DESIGN_CONTEXT_V2_MAX_CANONICAL_BYTES);
  return 0;
}
export const DESIGN_CONTEXT_V2_BYTE_LIMIT = DESIGN_CONTEXT_V2_MAX_CANONICAL_BYTES;
