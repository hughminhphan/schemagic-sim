import { designProfileEnvelopeContentHash, designProfileId } from "@opencircuit/design-library/v2-runtime";
import { canonicalizeCircuitV4, validateCircuitV4 } from "@opencircuit/circuit-schema";
import { generateScenarioNetlist } from "@opencircuit/circuit-schema/v4-netlist";
import {
  DESIGN_EXECUTION_REPORT_V2_MAX_CANONICAL_BYTES, DESIGN_RESULT_V2_MAX_CANONICAL_BYTES,
  DESIGN_V2_MAX_CANDIDATES, DESIGN_V2_MAX_DRAFTS, DESIGN_V2_MAX_HOOK_VALUE_CANONICAL_BYTES,
  DESIGN_V2_MAX_CIRCUIT_BOM_NON_REPRESENTATIONS, DESIGN_V2_MAX_CIRCUIT_INSTANCE_CLASSIFICATIONS,
  DESIGN_V2_MAX_COMPONENTS_PER_CANDIDATE, DESIGN_V2_MAX_CONSTRAINTS_PER_CANDIDATE,
  DESIGN_V2_MAX_COVERAGE_PER_CANDIDATE, DESIGN_V2_MAX_DERIVED_VALUES_PER_CANDIDATE,
  DESIGN_V2_MAX_MATCH_OUTCOMES_PER_OPTION, DESIGN_V2_MAX_METRICS_PER_CANDIDATE,
  DESIGN_V2_MAX_OPTIONS_PER_RECIPE, DESIGN_V2_MAX_RECIPES, DESIGN_V2_MAX_REJECTIONS,
  DESIGN_V2_MAX_REVIEWED_PROFILES, DESIGN_V2_MAX_WARNINGS_PER_CANDIDATE,
  PRIMARY_PART_CUSTOMIZATION_MAX_BYTES,
  DesignParseErrorV2, canonicalDesignResultV2ContentHash, canonicalDesignV2Payload,
  canonicalElectricalDesignRequestV2Payload, designSha256ContentHash,
  boundedDetachedFrozenDesignExecutionReportV2Value, boundedDetachedFrozenDesignV2Value, compareDesignV2Tokens, designRequestHashV2, designValidationIssue,
  detachedFrozenDesignV2Value, escapePointer,
  parseConstraintPolicyCatalogV3, parseDesignResultV1, parseDesignResultV2, parseElectricalDesignRequestV2,
  parsePrimaryPartCustomizationSidecarV1Text, serializePrimaryPartCustomizationSidecarV1,
  canonicalPrimaryPartCustomizedResultPayload, createPrimaryPartCustomizedResultSidecarV1,
  parsePrimaryPartCustomizedResultSidecarV1,
  migrateDesignRequestV1ToV2, type CandidateIdV2, type ConstraintResult,
  type DesignCandidateV2, type DesignResultV2, type DesignValidationIssue,
  type ElectricalDesignObjectiveV2, type ElectricalDesignRequestV2, type PersistedDesignResultV1,
  type ConstraintPolicyCatalogV3, type PrimaryPartCustomizationSidecarV1,
  type PrimaryPartCustomizedResultSidecarV1,
} from "@opencircuit/design-schema";
import {
  DESIGN_CONTEXT_V2_BYTE_LIMIT, _contextCanonicalBytesV2, _dereferenceInstalledRecipeRegistryV2,
  buildReviewedProfileCatalogV2, calculateReviewedProfileCatalogV2ContentHash, getInstalledCompilerImplementationRefV2,
  parseElectricalDesignContextManifestV2, parseElectricalRankingPolicyV2,
} from "./v2-context";
import { canonicalCandidateIdentityV2, candidateCompleteForCriteriaV2, compareCandidatesByCriteriaV2, dominatesCandidateV2, projectCandidateIdentityDerivedValuesV2, projectCandidateIdentitySelectedComponentsV2 } from "./v2-ranking";
import { evaluateConstraintDecisionV3 } from "./v3-constraint-sidecar";
import {
  DesignGenerationErrorV2, PIPELINE_STAGES_V2, PrimaryPartCustomizationEvaluationErrorV1,
  type CandidateForMaterializationV2, type DesignExecutionReportV2, type DesignGenerationErrorDetailV2,
  type DesignGenerationV2, type DesignRecipeV2, type ElectricalDesignContextManifestV2,
  type DesignResultExecutionContextV2, type ElectricalRankingPolicyV2, type GenerateElectricalContextV2, type GenerationCountsV2,
  type GenerationRejectionMessageInputV2, type GenerationRejectionV2, type MatchedOptionV2,
  type RecipeEnvironmentV2, type RecipeHookStageV2, type ReviewedProfileCatalogV2,
  type PrimaryPartCustomizationObservationV1,
  type StageOutcomeV2,
} from "./v2-types";

interface CandidateDraft { candidate: DesignCandidateV2; recipe: DesignRecipeV2; optionKey: string }
interface PreparedContext { manifest: ElectricalDesignContextManifestV2; catalog: ReviewedProfileCatalogV2; ranking: ElectricalRankingPolicyV2; recipes: readonly DesignRecipeV2[] }
interface PreparedGeneration { generation: DesignGenerationV2; preParetoDrafts: readonly CandidateDraft[] }
interface PrimaryPartCustomizationGenerationWitness {
  readonly authority: "installed_context" | "test_context";
  readonly contextManifestContentHash: string;
  readonly resultContentHash: string;
  readonly executionContentHash: string;
  readonly uniqueTargetProfileIdsByStructure: ReadonlyMap<string, readonly string[]>;
}

// A generation result is already detached and frozen before it leaves this
// module. Retain only a compact exact in-process pre-Pareto witness without
// serializing hidden candidates into the portable result or granting cloned
// input access to it. The WeakMap cannot keep an abandoned generation alive.
const primaryPartCustomizationWitnessByExactResult = new WeakMap<
  object,
  PrimaryPartCustomizationGenerationWitness
>();

function error(detail: DesignGenerationErrorDetailV2, code: DesignValidationIssue["code"], path = ""): never {
  throw new DesignGenerationErrorV2(detail, [designValidationIssue(code, path)]);
}
function resource(stage: import("./v2-types").DesignEngineResourceStageV2): never {
  return error({ code: "resource_limit", stage }, "resource_limit");
}
function canonicalSame(left: unknown, right: unknown): boolean { return canonicalDesignV2Payload(left) === canonicalDesignV2Payload(right); }
function recipeRef(recipe: DesignRecipeV2) { return { id: recipe.id, version: recipe.version, contentHash: recipe.contentHash, applications: recipe.applications, metricDeclarations: recipe.metricDeclarations }; }
const RECIPE_KEYS=["id","version","contentHash","applications","metricDeclarations","supports","enumerate","solve","match","check","estimate","materialize"] as const;
function captureRecipeV2(input:DesignRecipeV2):DesignRecipeV2{
  if(!input||typeof input!=="object"||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype)return error({code:"invalid_context",stage:"context"},"context_mismatch");
  const descriptors=Object.getOwnPropertyDescriptors(input);if(Reflect.ownKeys(descriptors).some((key)=>typeof key!=="string"||!RECIPE_KEYS.includes(key as typeof RECIPE_KEYS[number])))return error({code:"invalid_context",stage:"context"},"context_mismatch");
  for(const key of RECIPE_KEYS){const descriptor=descriptors[key];if(!descriptor||!("value" in descriptor))return error({code:"invalid_context",stage:"context"},"context_mismatch");}
  const jsonRef={id:descriptors.id!.value,version:descriptors.version!.value,contentHash:descriptors.contentHash!.value,applications:descriptors.applications!.value,metricDeclarations:descriptors.metricDeclarations!.value};
  let ref:ReturnType<typeof recipeRef>;try{ref=boundedDetachedFrozenDesignV2Value(jsonRef,"electrical_context_manifest",DESIGN_V2_MAX_HOOK_VALUE_CANONICAL_BYTES) as ReturnType<typeof recipeRef>;}catch{return error({code:"invalid_context",stage:"context"},"context_mismatch");}
  const callbacks=Object.fromEntries(["supports","enumerate","solve","match","check","estimate","materialize"].map((key)=>[key,descriptors[key]!.value])) as Record<string,unknown>;
  if(Object.values(callbacks).some((callback)=>typeof callback!=="function"))return error({code:"invalid_context",stage:"context"},"context_mismatch");
  return Object.freeze({...ref,supports:callbacks.supports as DesignRecipeV2["supports"],enumerate:callbacks.enumerate as DesignRecipeV2["enumerate"],solve:callbacks.solve as DesignRecipeV2["solve"],match:callbacks.match as DesignRecipeV2["match"],check:callbacks.check as DesignRecipeV2["check"],estimate:callbacks.estimate as DesignRecipeV2["estimate"],materialize:callbacks.materialize as DesignRecipeV2["materialize"]});
}

function engineeringRequest(request: ElectricalDesignRequestV2): ElectricalDesignRequestV2 {
  const project = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(project);
    if (!value || typeof value !== "object") return value;
    const source = value as Record<string, unknown>; const result: Record<string, unknown> = {};
    for (const key of Object.keys(source)) result[key] = key === "displayUnit" && typeof source.unit === "string" ? source.unit : project(source[key]);
    return result;
  };
  return detachedFrozenDesignV2Value(project(request) as ElectricalDesignRequestV2);
}

const GENERATE_CONTEXT_KEYS=["manifest","catalogDocuments","rankingPolicy","installedRecipeRegistry"] as const;
function captureGenerateContextV2(input:GenerateElectricalContextV2):GenerateElectricalContextV2{
  if(!input||typeof input!=="object"||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype)return error({code:"invalid_context",stage:"context"},"context_mismatch");
  const descriptors=Object.getOwnPropertyDescriptors(input);
  if(Reflect.ownKeys(descriptors).some((key)=>typeof key!=="string"||!GENERATE_CONTEXT_KEYS.includes(key as typeof GENERATE_CONTEXT_KEYS[number])))return error({code:"invalid_context",stage:"context"},"context_mismatch");
  for(const key of GENERATE_CONTEXT_KEYS)if(!descriptors[key]||!("value" in descriptors[key]!))return error({code:"invalid_context",stage:"context"},"context_mismatch");
  return {manifest:descriptors.manifest!.value,catalogDocuments:descriptors.catalogDocuments!.value,rankingPolicy:descriptors.rankingPolicy!.value,installedRecipeRegistry:descriptors.installedRecipeRegistry!.value} as GenerateElectricalContextV2;
}

function prepareContext(request: ElectricalDesignRequestV2, contextInput: GenerateElectricalContextV2, recipeOverride?: readonly DesignRecipeV2[]): PreparedContext {
  try {
    const context=captureGenerateContextV2(contextInput);
    if (_contextCanonicalBytesV2(context) > DESIGN_CONTEXT_V2_BYTE_LIMIT) error({ code: "invalid_context", stage: "context" }, "resource_limit");
    const manifest = parseElectricalDesignContextManifestV2(context.manifest);
    const ranking = parseElectricalRankingPolicyV2(context.rankingPolicy);
    const catalog = buildReviewedProfileCatalogV2(context.catalogDocuments);
    const installedRecipes = recipeOverride ?? _dereferenceInstalledRecipeRegistryV2(context.installedRecipeRegistry, manifest.contentHash);
    if (!installedRecipes || request.application !== manifest.application || ranking.application !== manifest.application || request.libraryVersion !== manifest.version) error({ code: "invalid_context", stage: "context" }, "context_mismatch");
    const recipes=installedRecipes.map(captureRecipeV2).sort((left,right)=>compareDesignV2Tokens(canonicalDesignV2Payload([left.id,left.version,left.contentHash]),canonicalDesignV2Payload([right.id,right.version,right.contentHash])));
    if (!canonicalSame(manifest.compiler, getInstalledCompilerImplementationRefV2()) || ranking.version !== manifest.rankingPolicy.version || ranking.contentHash !== manifest.rankingPolicy.contentHash) error({ code: "invalid_context", stage: "context" }, "context_mismatch");
    if (catalog.version !== manifest.catalog.version || catalog.contentHash !== manifest.catalog.contentHash || catalog.sourceRelease.contentHash !== manifest.catalog.sourceReleaseContentHash) error({ code: "invalid_context", stage: "context" }, "context_mismatch");
    const refs = recipes.map(recipeRef).sort((left, right) => compareDesignV2Tokens(canonicalDesignV2Payload([left.id,left.version,left.contentHash]), canonicalDesignV2Payload([right.id,right.version,right.contentHash])));
    if (!canonicalSame(refs, manifest.recipes)) error({ code: "invalid_context", stage: "context" }, "context_mismatch");
    const declarations = new Map<string, string>();
    for (const recipe of recipes) for (const declaration of recipe.metricDeclarations) {
      const prior = declarations.get(declaration.id); if (prior !== undefined && prior !== declaration.unit) error({ code: "invalid_context", stage: "context" }, "context_mismatch"); declarations.set(declaration.id, declaration.unit);
    }
    const requiredMetrics=new Set([...ranking.paretoCriteria,...Object.values(ranking.rankingProfiles).flat()].map((criterion)=>criterion.metricId));
    for (const metricId of requiredMetrics) if (!declarations.has(metricId)||recipes.some((recipe)=>!recipe.metricDeclarations.some((declaration)=>declaration.id===metricId))) error({ code: "invalid_context", stage: "context" }, "invalid_reference");
    return { manifest, catalog, ranking, recipes };
  } catch (caught) {
    if (caught instanceof DesignGenerationErrorV2) throw caught;
    if (caught instanceof DesignParseErrorV2) return error({ code: "invalid_context", stage: "context" }, caught.detail.code === "resource_limit" ? "resource_limit" : "context_mismatch");
    return error({ code: "invalid_context", stage: "context" }, "context_mismatch");
  }
}

function plainRecord(value:unknown,allowed:readonly string[],required:readonly string[]=allowed):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))throw new TypeError("Expected object");const record=value as Record<string,unknown>;const keys=Object.keys(record);if(keys.some((key)=>!allowed.includes(key))||required.some((key)=>!Object.prototype.hasOwnProperty.call(record,key)))throw new TypeError("Invalid closed shape");return record;}
function jsonObject(value:unknown):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))throw new TypeError("Expected JSON object");return value as Record<string,unknown>;}
function safeString(value:unknown):string{if(typeof value!=="string"||value.length===0||/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value))throw new TypeError("Invalid string");return value;}
function exactMpnString(value:unknown):string{if(typeof value!=="string"||value.length===0)throw new TypeError("Invalid exact MPN");return value;}
const ELECTRICAL_SI_UNITS=new Set(["1","A","F","H","Hz","K","V","V_s_per_rad","W","count","m","m2","ohm","rad_per_s","s"]);
function shapeArray(value:unknown,max:number,label:string):unknown[]{if(!Array.isArray(value))throw new TypeError(`Invalid ${label}`);if(value.length>max)throw new RangeError(`${label} exceeds limit`);return value;}
function uniqueKeys(values:readonly unknown[],key:(value:unknown)=>string,label:string):void{if(new Set(values.map(key)).size!==values.length)throw new TypeError(`Duplicate ${label}`);}
function quantityShape(value:unknown):void{const quantity=plainRecord(value,["value","unit","displayUnit"]);if(typeof quantity.value!=="number"||!Number.isFinite(quantity.value)||typeof quantity.unit!=="string"||!ELECTRICAL_SI_UNITS.has(quantity.unit))throw new TypeError("Invalid quantity");safeString(quantity.displayUnit);}
function evidenceShape(value:unknown):void{const evidence=plainRecord(value,["sourceId","locator","retrievedAt","contentHash","licenseNote"],["sourceId","locator","licenseNote"]);safeString(evidence.sourceId);safeString(evidence.locator);safeString(evidence.licenseNote);if(evidence.retrievedAt!==undefined)safeString(evidence.retrievedAt);if(evidence.contentHash!==undefined)safeString(evidence.contentHash);}
function evidenceListShape(value:unknown):void{if(!Array.isArray(value))throw new TypeError("Invalid evidence");value.forEach(evidenceShape);}
function constraintShape(value:unknown):string{const constraint=plainRecord(value,["ruleId","status","actual","limit","margin","explanation","evidence"],["ruleId","status","explanation","evidence"]);const ruleId=safeString(constraint.ruleId);if(RESERVED_RULE_PREFIXES.some((prefix)=>ruleId.startsWith(prefix)))throw new TypeError("Reserved constraint namespace");if(!["fail","pass","unknown","warning"].includes(constraint.status as string))throw new TypeError("Invalid constraint status");for(const key of ["actual","limit","margin"] as const)if(constraint[key]!==undefined)quantityShape(constraint[key]);safeString(constraint.explanation);evidenceListShape(constraint.evidence);return ruleId;}
function constraintsShape(value:unknown):void{const constraints=shapeArray(value,DESIGN_V2_MAX_CONSTRAINTS_PER_CANDIDATE,"constraints");uniqueKeys(constraints,constraintShape,"constraint rule");}
function derivedShape(value:unknown):string{const derived=plainRecord(value,["id","value","equationId","state","evidence"]);const id=safeString(derived.id);quantityShape(derived.value);safeString(derived.equationId);if(derived.state!=="calculated"&&derived.state!=="estimated")throw new TypeError("Invalid derived state");evidenceListShape(derived.evidence);return id;}
function componentShape(value:unknown):string{const component=plainRecord(value,["id","role","profileId","part","quantityPerAssembly","value","evidence"],["id","role","profileId","part","quantityPerAssembly","evidence"]);const id=safeString(component.id);safeString(component.role);safeString(component.profileId);const part=plainRecord(component.part,["manufacturerId","manufacturerPartNumber"]);safeString(part.manufacturerId);exactMpnString(part.manufacturerPartNumber);if(!Number.isSafeInteger(component.quantityPerAssembly)||(component.quantityPerAssembly as number)<=0)throw new TypeError("Invalid quantity per assembly");if(component.value!==undefined)quantityShape(component.value);evidenceListShape(component.evidence);return id;}
function coverageShape(value:unknown):string{const coverage=plainRecord(value,["scenarioId","modelTier","limitations"]);const scenarioId=safeString(coverage.scenarioId);if(coverage.modelTier!=="behavioral"&&coverage.modelTier!=="unavailable")throw new TypeError("Invalid coverage");const limitations=shapeArray(coverage.limitations,DESIGN_V2_MAX_WARNINGS_PER_CANDIDATE,"limitations");limitations.forEach(safeString);uniqueKeys(limitations,(entry)=>entry as string,"limitation");return scenarioId;}
function metricShape(value:unknown):string{const metric=plainRecord(value,["id","value","state","explanation","evidence"]);const id=safeString(metric.id);if(!["calculated","estimated","unknown"].includes(metric.state as string))throw new TypeError("Invalid metric");if(metric.value!==null)quantityShape(metric.value);if((metric.state==="unknown")!==(metric.value===null))throw new TypeError("Invalid metric state");safeString(metric.explanation);evidenceListShape(metric.evidence);return id;}
function rejectedShape(value:Record<string,unknown>):void{safeString(value.reason);if(value.constraints!==undefined)constraintsShape(value.constraints);if(value.componentProfileIds!==undefined){const ids=shapeArray(value.componentProfileIds,DESIGN_V2_MAX_COMPONENTS_PER_CANDIDATE,"profile ids");ids.forEach(safeString);uniqueKeys(ids,(entry)=>entry as string,"profile id");}}
function hookShape(stage:RecipeHookStageV2,value:unknown):void{
  if(stage==="supports"){if(typeof value!=="boolean")throw new TypeError("supports must return boolean");return;}
  if(stage==="enumerate"){const entries=shapeArray(value,DESIGN_V2_MAX_OPTIONS_PER_RECIPE,"enumerated options");const keys=entries.map((entry)=>{const option=plainRecord(entry,["optionKey","data"]);const key=safeString(option.optionKey);jsonObject(option.data);return key;});uniqueKeys(keys,(entry)=>entry as string,"option key");return;}
  if(stage==="solve"){const outcome=plainRecord(value,(value as {status?:unknown})?.status==="ok"?["status","value"]:["status","reason","constraints","componentProfileIds"],(value as {status?:unknown})?.status==="ok"?["status","value"]:["status","reason"]);if(outcome.status==="rejected"){rejectedShape(outcome);return;}if(outcome.status!=="ok")throw new TypeError("Invalid outcome");const solved=plainRecord(outcome.value,["data","derivedValues"]);jsonObject(solved.data);const derived=shapeArray(solved.derivedValues,DESIGN_V2_MAX_DERIVED_VALUES_PER_CANDIDATE,"derived values");uniqueKeys(derived,derivedShape,"derived value id");return;}
  if(stage==="match"){const outcomes=shapeArray(value,DESIGN_V2_MAX_MATCH_OUTCOMES_PER_OPTION,"match outcomes");if(outcomes.length===0)throw new TypeError("Empty match outcomes");outcomes.forEach((raw)=>{const outcome=plainRecord(raw,(raw as {status?:unknown})?.status==="ok"?["status","value"]:["status","reason","constraints","componentProfileIds"],(raw as {status?:unknown})?.status==="ok"?["status","value"]:["status","reason"]);if(outcome.status==="rejected"){rejectedShape(outcome);return;}if(outcome.status!=="ok")throw new TypeError("Invalid outcome");const matched=plainRecord(outcome.value,["data","derivedValues","components","simulationCoverage","warnings"]);jsonObject(matched.data);const derived=shapeArray(matched.derivedValues,DESIGN_V2_MAX_DERIVED_VALUES_PER_CANDIDATE,"derived values");uniqueKeys(derived,derivedShape,"derived value id");const components=shapeArray(matched.components,DESIGN_V2_MAX_COMPONENTS_PER_CANDIDATE,"components");uniqueKeys(components,componentShape,"component id");const coverage=shapeArray(matched.simulationCoverage,DESIGN_V2_MAX_COVERAGE_PER_CANDIDATE,"coverage");uniqueKeys(coverage,coverageShape,"coverage scenario");const warnings=shapeArray(matched.warnings,DESIGN_V2_MAX_WARNINGS_PER_CANDIDATE,"warnings");warnings.forEach(safeString);uniqueKeys(warnings,(entry)=>entry as string,"warning");});return;}
  if(stage==="check"){constraintsShape(value);return;}
  if(stage==="estimate"){const estimate=plainRecord(value,["metrics","warnings"]);const metrics=shapeArray(estimate.metrics,DESIGN_V2_MAX_METRICS_PER_CANDIDATE,"metrics");uniqueKeys(metrics,metricShape,"metric id");const warnings=shapeArray(estimate.warnings,DESIGN_V2_MAX_WARNINGS_PER_CANDIDATE,"warnings");warnings.forEach(safeString);uniqueKeys(warnings,(entry)=>entry as string,"warning");return;}
  const materialization=plainRecord(value,["circuit","circuitInstanceClassifications","circuitBomNonRepresentations"]);jsonObject(materialization.circuit);shapeArray(materialization.circuitInstanceClassifications,DESIGN_V2_MAX_CIRCUIT_INSTANCE_CLASSIFICATIONS,"circuit classifications");shapeArray(materialization.circuitBomNonRepresentations,DESIGN_V2_MAX_CIRCUIT_BOM_NON_REPRESENTATIONS,"BOM non-representations");
}
function normalizedConstraintRecords(value:unknown):unknown[]{return [...(value as unknown[])].sort((left,right)=>{const leftRecord=left as Record<string,unknown>,rightRecord=right as Record<string,unknown>;return compareDesignV2Tokens(leftRecord.ruleId as string,rightRecord.ruleId as string)||compareDesignV2Tokens(canonicalDesignV2Payload(left),canonicalDesignV2Payload(right));});}
function normalizedRejectedRecord(value:Record<string,unknown>):Record<string,unknown>{return{...value,...(value.componentProfileIds===undefined?{}:{componentProfileIds:[...(value.componentProfileIds as string[])].sort(compareDesignV2Tokens)}),...(value.constraints===undefined?{}:{constraints:normalizedConstraintRecords(value.constraints)})};}
function normalizedHookValue(stage:RecipeHookStageV2,value:unknown):unknown{
  if(stage==="supports")return value;
  if(stage==="enumerate")return[...(value as Record<string,unknown>[])].sort((left,right)=>compareDesignV2Tokens(left.optionKey as string,right.optionKey as string)||compareDesignV2Tokens(canonicalDesignV2Payload(left.data),canonicalDesignV2Payload(right.data)));
  if(stage==="solve"){
    const outcome=value as Record<string,unknown>;if(outcome.status==="rejected")return normalizedRejectedRecord(outcome);
    const solved=outcome.value as Record<string,unknown>;return{status:"ok",value:{...solved,derivedValues:[...(solved.derivedValues as Record<string,unknown>[])].sort((left,right)=>compareDesignV2Tokens(left.id as string,right.id as string))}};
  }
  if(stage==="match")return(value as Record<string,unknown>[]).map((outcome)=>{
    if(outcome.status==="rejected")return normalizedRejectedRecord(outcome);
    const matched=outcome.value as Record<string,unknown>;
    return{status:"ok",value:{...matched,derivedValues:[...(matched.derivedValues as Record<string,unknown>[])].sort((left,right)=>compareDesignV2Tokens(left.id as string,right.id as string)),components:[...(matched.components as Record<string,unknown>[])].sort((left,right)=>compareDesignV2Tokens(left.id as string,right.id as string)),simulationCoverage:[...(matched.simulationCoverage as Record<string,unknown>[])].map((coverage)=>({...coverage,limitations:[...(coverage.limitations as string[])].sort(compareDesignV2Tokens)}) as Record<string,unknown>).sort((left,right)=>compareDesignV2Tokens(left.scenarioId as string,right.scenarioId as string)),warnings:[...(matched.warnings as string[])].sort(compareDesignV2Tokens)}};
  }).sort((left,right)=>compareDesignV2Tokens(left.status as string,right.status as string)||compareDesignV2Tokens(canonicalDesignV2Payload(left),canonicalDesignV2Payload(right)));
  if(stage==="check")return normalizedConstraintRecords(value);
  if(stage==="estimate"){const estimate=value as Record<string,unknown>;return{metrics:[...(estimate.metrics as Record<string,unknown>[])].sort((left,right)=>compareDesignV2Tokens(left.id as string,right.id as string)),warnings:[...(estimate.warnings as string[])].sort(compareDesignV2Tokens)};}
  const materialization=value as Record<string,unknown>;return{...materialization,circuitInstanceClassifications:[...(materialization.circuitInstanceClassifications as Record<string,unknown>[])].sort((left,right)=>compareDesignV2Tokens(String(left.circuitId),String(right.circuitId))||compareDesignV2Tokens(String(left.componentId),String(right.componentId))),circuitBomNonRepresentations:[...(materialization.circuitBomNonRepresentations as Record<string,unknown>[])].sort((left,right)=>compareDesignV2Tokens(String(left.circuitId),String(right.circuitId))||compareDesignV2Tokens(String(left.selectedComponentId),String(right.selectedComponentId)))};
}
function hook<T>(recipe: DesignRecipeV2, stage: RecipeHookStageV2, callback: () => T): T {
  let returned: T;
  try { returned = callback(); }
  catch { return error({ code: "recipe_hook_threw", stage, recipeId: recipe.id }, "recipe_contract"); }
  try {
    const bounded=boundedDetachedFrozenDesignV2Value(returned,"candidate_identity",DESIGN_V2_MAX_HOOK_VALUE_CANONICAL_BYTES);hookShape(stage,bounded);return detachedFrozenDesignV2Value(normalizedHookValue(stage,bounded)) as T;
  } catch (caught) {
    if (caught instanceof DesignGenerationErrorV2) throw caught;
    return error({ code: "recipe_contract_invalid", stage, recipeId: recipe.id }, "recipe_contract");
  }
}
function frozenHookInput<T>(value:T):Readonly<T>{return boundedDetachedFrozenDesignV2Value(value,"candidate_identity",DESIGN_V2_MAX_HOOK_VALUE_CANONICAL_BYTES);}
function sortedUnique(values: readonly string[]): string[] { return [...new Set(values)].sort(compareDesignV2Tokens); }
function sortConstraints(values: readonly ConstraintResult[]): ConstraintResult[] {
  const result = [...values].sort((left, right) => compareDesignV2Tokens(left.ruleId, right.ruleId) || compareDesignV2Tokens(canonicalDesignV2Payload(left), canonicalDesignV2Payload(right)));
  if (new Set(result.map((entry) => entry.ruleId)).size !== result.length) throw new TypeError("Duplicate constraint rule"); return result;
}
function appendRejection(rejections: GenerationRejectionV2[], rejection: GenerationRejectionV2): void { if (rejections.length >= DESIGN_V2_MAX_REJECTIONS) resource(rejection.stage); rejections.push(rejection); }

export function renderGenerationRejectionMessageV2(rejection: Readonly<GenerationRejectionMessageInputV2>): string {
  return canonicalDesignV2Payload(rejection);
}
export function projectGenerationRejectionV2(rejection: Readonly<GenerationRejectionV2>) { return { recipeId: rejection.recipeId, componentProfileIds: [...rejection.componentProfileIds], constraints: [...rejection.constraints] }; }
function rejection<T extends Omit<GenerationRejectionV2, "message">>(value: T): GenerationRejectionV2 { return { ...value, message: renderGenerationRejectionMessageV2(value as GenerationRejectionMessageInputV2) } as GenerationRejectionV2; }

function normalizedRecipeReason(recipe: DesignRecipeV2, stage: "solve" | "match", value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || /[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value)) return error({ code: "recipe_contract_invalid", stage, recipeId: recipe.id }, "recipe_contract");
  return value;
}
function rejectedOutcome(stage: "solve" | "match", recipe: DesignRecipeV2, optionKey: string, outcome: Extract<StageOutcomeV2<unknown>, {status:"rejected"}>): GenerationRejectionV2 {
  let constraints: ConstraintResult[]; try { constraints = sortConstraints(outcome.constraints ?? []); } catch { return error({ code: "recipe_contract_invalid", stage, recipeId: recipe.id }, "recipe_contract"); }
  return rejection({ stage, reasonCode: "recipe_rejected", recipeId: recipe.id, optionKey, recipeReason: normalizedRecipeReason(recipe, stage, outcome.reason), componentProfileIds: sortedUnique(outcome.componentProfileIds ?? []), constraints });
}
function validateRejectionProfiles(recipe: DesignRecipeV2, stage: "solve" | "match", rejection: GenerationRejectionV2, catalog: ReviewedProfileCatalogV2): void {
  const profileIds = new Set(catalog.profiles.map((profile) => designProfileId(profile.partClass, profile.part)));
  if (rejection.componentProfileIds.some((profileId) => !profileIds.has(profileId))) error({ code: "recipe_contract_invalid", stage, recipeId: recipe.id }, "recipe_contract");
}
function validateCatalogComponents(recipe: DesignRecipeV2, components: MatchedOptionV2["components"], catalog: ReviewedProfileCatalogV2): void {
  const byId = new Map(catalog.profiles.map((profile) => [designProfileId(profile.partClass, profile.part), profile]));
  for (const component of components) {
    const profile = byId.get(component.profileId);
    if (!profile || profile.part.manufacturerId !== component.part.manufacturerId || profile.part.manufacturerPartNumber !== component.part.manufacturerPartNumber) error({ code: "recipe_contract_invalid", stage: "match", recipeId: recipe.id }, "recipe_contract");
  }
}
function candidateMetrics(recipe: DesignRecipeV2, constraints: ConstraintResult[], rawMetrics: ReturnType<DesignRecipeV2["estimate"]>["metrics"]): DesignCandidateV2["metrics"] {
  const values = [...rawMetrics].sort((left, right) => compareDesignV2Tokens(left.id, right.id));
  if (new Set(values.map((entry) => entry.id)).size !== values.length || values.length !== recipe.metricDeclarations.length) error({ code: "recipe_contract_invalid", stage: "estimate", recipeId: recipe.id }, "recipe_contract");
  for (let index = 0; index < values.length; index += 1) {
    const metric = values[index]!; const declaration = recipe.metricDeclarations[index]!;
    if (metric.id !== declaration.id || (metric.value !== null && metric.value.unit !== declaration.unit) || ((metric.state === "unknown") !== (metric.value === null)) || metric.state === ("simulated" as never)) error({ code: "recipe_contract_invalid", stage: "estimate", recipeId: recipe.id }, "recipe_contract");
  }
  return { values, warningCount: constraints.filter((entry) => entry.status === "warning").length, estimateCount: values.filter((entry) => entry.state === "estimated").length, unknownCount: constraints.filter((entry) => entry.status === "unknown").length + values.filter((entry) => entry.state === "unknown").length };
}

function counts(recipes: number): GenerationCountsV2 { return { recipes, supportedRecipes:0, enumerated:0, solved:0, matchOutcomes:0, matched:0, checked:0, estimated:0, deduped:0, pareto:0, materialized:0, coverageValidated:0, rejected:0 }; }

function generatePreparedWithDrafts(request: ElectricalDesignRequestV2, prepared: PreparedContext): PreparedGeneration {
  const environment: RecipeEnvironmentV2 = detachedFrozenDesignV2Value({ request: engineeringRequest(request), catalog: prepared.catalog, manifest: prepared.manifest });
  const executionCounts = counts(prepared.recipes.length); const rejections: GenerationRejectionV2[] = []; const drafts: CandidateDraft[] = [];
  const supported: DesignRecipeV2[] = [];
  for (const recipe of prepared.recipes) if (hook(recipe, "supports", () => recipe.supports(frozenHookInput(environment.request)))) supported.push(recipe);
  executionCounts.supportedRecipes = supported.length;
  for (const recipe of supported) {
    const enumerated = hook(recipe, "enumerate", () => recipe.enumerate(frozenHookInput(environment)));
    if (!Array.isArray(enumerated)) error({ code: "recipe_contract_invalid", stage: "enumerate", recipeId: recipe.id }, "recipe_contract");
    if (enumerated.length > DESIGN_V2_MAX_OPTIONS_PER_RECIPE) error({ code: "recipe_contract_invalid", stage: "enumerate", recipeId: recipe.id }, "resource_limit");
    const options = [...enumerated].sort((left, right) => compareDesignV2Tokens(left.optionKey, right.optionKey) || compareDesignV2Tokens(canonicalDesignV2Payload(left.data), canonicalDesignV2Payload(right.data)));
    if (new Set(options.map((entry) => entry.optionKey)).size !== options.length) error({ code: "recipe_contract_invalid", stage: "enumerate", recipeId: recipe.id }, "recipe_contract");
    if (executionCounts.enumerated + options.length > DESIGN_V2_MAX_DRAFTS) resource("enumerate"); executionCounts.enumerated += options.length;
    for (const option of options) {
      const solvedInput=frozenHookInput({data:option.data});const solvedEnvironment=frozenHookInput(environment);const solvedOutput = hook(recipe, "solve", () => recipe.solve(solvedInput, solvedEnvironment));
      if (solvedOutput.status === "rejected") { const rejected = rejectedOutcome("solve", recipe, option.optionKey, solvedOutput); validateRejectionProfiles(recipe, "solve", rejected, prepared.catalog); appendRejection(rejections, rejected); continue; }
      const solved=detachedFrozenDesignV2Value({status:"ok" as const,value:{data:solvedOutput.value.data,derivedValues:[...solvedOutput.value.derivedValues].sort((left,right)=>compareDesignV2Tokens(left.id,right.id))}});
      executionCounts.solved += 1;
      const matchInput=frozenHookInput(solved.value);const matchEnvironment=frozenHookInput(environment);const outcomes = hook(recipe, "match", () => recipe.match(matchInput, matchEnvironment));
      if (!Array.isArray(outcomes) || outcomes.length === 0) error({ code: "recipe_contract_invalid", stage: "match", recipeId: recipe.id }, "recipe_contract");
      if(outcomes.length>DESIGN_V2_MAX_MATCH_OUTCOMES_PER_OPTION)error({ code: "recipe_contract_invalid", stage: "match", recipeId: recipe.id }, "resource_limit");
      const sortedOutcomes = [...(outcomes as readonly StageOutcomeV2<MatchedOptionV2>[])].sort((left, right) => compareDesignV2Tokens(left.status, right.status) || compareDesignV2Tokens(canonicalDesignV2Payload(left), canonicalDesignV2Payload(right)));
      if (new Set(sortedOutcomes.map((entry) => canonicalDesignV2Payload(entry))).size !== sortedOutcomes.length) error({ code: "recipe_contract_invalid", stage: "match", recipeId: recipe.id }, "recipe_contract");
      if (executionCounts.matchOutcomes + sortedOutcomes.length > DESIGN_V2_MAX_DRAFTS) resource("match");
      executionCounts.matchOutcomes += sortedOutcomes.length;
      for (const outcome of sortedOutcomes) {
        if (outcome.status === "rejected") { const rejected = rejectedOutcome("match", recipe, option.optionKey, outcome); validateRejectionProfiles(recipe, "match", rejected, prepared.catalog); appendRejection(rejections, rejected); continue; }
        executionCounts.matched += 1;
        const matched:MatchedOptionV2=detachedFrozenDesignV2Value({...outcome.value,components:[...outcome.value.components].sort((left,right)=>compareDesignV2Tokens(left.id,right.id)),derivedValues:[...outcome.value.derivedValues].sort((left,right)=>compareDesignV2Tokens(left.id,right.id)),simulationCoverage:[...outcome.value.simulationCoverage].map((entry)=>({...entry,limitations:[...entry.limitations].sort(compareDesignV2Tokens)})).sort((left,right)=>compareDesignV2Tokens(left.scenarioId,right.scenarioId)),warnings:[...outcome.value.warnings].sort(compareDesignV2Tokens)});
        validateCatalogComponents(recipe, matched.components, prepared.catalog);
        const identityInput = { recipe: { id: recipe.id, version: recipe.version, contentHash: recipe.contentHash }, context: { version: prepared.manifest.version, contentHash: prepared.manifest.contentHash }, requestHash: designRequestHashV2(request), data: matched.data, components: projectCandidateIdentitySelectedComponentsV2(matched.components), derivedValues: projectCandidateIdentityDerivedValuesV2(matched.derivedValues) } as const;
        const candidateId = canonicalCandidateIdentityV2(identityInput);
        let constraints: ConstraintResult[]; try { constraints = detachedFrozenDesignV2Value(sortConstraints(hook(recipe, "check", () => recipe.check(frozenHookInput(matched), frozenHookInput(environment))))) as ConstraintResult[]; } catch (caught) { if (caught instanceof DesignGenerationErrorV2) throw caught; return error({ code: "recipe_contract_invalid", stage: "check", recipeId: recipe.id }, "recipe_contract"); }
        executionCounts.checked += 1;
        const failed = constraints.some((entry) => entry.status === "fail"); const unknown = constraints.some((entry) => entry.status === "unknown") && !request.constraints.allowUnknownHardConstraints; const warning = constraints.some((entry) => entry.status === "warning") && !request.constraints.allowUnknownWarnings;
        if (failed || unknown || warning) {
          const reasonCode = failed ? "hard_constraint_failed" : unknown ? "unknown_constraint_disallowed" : "warning_disallowed";
          appendRejection(rejections, rejection({ stage:"check", reasonCode, recipeId:recipe.id, optionKey:option.optionKey, candidateId, componentProfileIds:sortedUnique(matched.components.map((entry) => entry.profileId)), constraints })); continue;
        }
        const estimate = hook(recipe, "estimate", () => recipe.estimate(frozenHookInput(matched), frozenHookInput(constraints), frozenHookInput(environment))); executionCounts.estimated += 1;
        const metrics = candidateMetrics(recipe, constraints, estimate.metrics);
        const estimatedValuesDisallowed = !request.constraints.allowEstimatedValues && (
          matched.derivedValues.some((entry) => entry.state === "estimated")
          || metrics.values.some((entry) => entry.state === "estimated")
        );
        if (estimatedValuesDisallowed) {
          appendRejection(rejections, rejection({ stage:"estimate", reasonCode:"estimated_values_disallowed", recipeId:recipe.id, optionKey:option.optionKey, candidateId, componentProfileIds:sortedUnique(matched.components.map((entry) => entry.profileId)), constraints })); continue;
        }
        const missingPareto = prepared.ranking.paretoCriteria.filter((criterion) => !metrics.values.find((entry) => entry.id === criterion.metricId)?.value).map((criterion) => `electrical.metric_unknown:${criterion.metricId}`);
        const warnings = sortedUnique([...matched.warnings, ...estimate.warnings, ...missingPareto]);
        const coverage = [...matched.simulationCoverage].map((entry) => ({ ...entry, limitations: sortedUnique(entry.limitations) })).sort((left,right) => compareDesignV2Tokens(left.scenarioId,right.scenarioId));
        const forMaterialization: CandidateForMaterializationV2 = detachedFrozenDesignV2Value({ id:candidateId, recipeId:recipe.id, libraryVersion:prepared.manifest.version, data:matched.data, components:matched.components, derivedValues:matched.derivedValues, constraints, metrics, simulationCoverage:coverage, warnings });
        const materialization = hook(recipe, "materialize", () => recipe.materialize(frozenHookInput(forMaterialization), frozenHookInput(environment))); executionCounts.materialized += 1;
        if (validateCircuitV4(materialization.circuit).length > 0) error({ code:"recipe_contract_invalid", stage:"materialize", recipeId:recipe.id }, "recipe_contract");
        const circuit=JSON.parse(canonicalizeCircuitV4(materialization.circuit,true)) as typeof materialization.circuit;
        const candidate: DesignCandidateV2 = { schemaVersion:2, id:candidateId, requestHash:identityInput.requestHash, recipeId:recipe.id, libraryVersion:prepared.manifest.version, components:matched.components, derivedValues:matched.derivedValues, constraints, metrics, simulationCoverage:coverage, circuit, circuitInstanceClassifications:materialization.circuitInstanceClassifications, circuitBomNonRepresentations:materialization.circuitBomNonRepresentations, warnings };
        let validatedCandidate: DesignCandidateV2;
        try {
          const envelopeWithoutHash: Omit<DesignResultV2,"contentHash"> = { format:"schemagic-design-result",schemaVersion:2,request,requestHash:identityInput.requestHash,libraryVersion:prepared.manifest.version,libraryContentHash:prepared.manifest.contentHash,candidates:[candidate],rejectedCandidates:[],diagnostics:[] };
          validatedCandidate = parseDesignResultV2({ ...envelopeWithoutHash, contentHash: canonicalDesignResultV2ContentHash(envelopeWithoutHash) }).candidates[0]!;
        } catch { return error({ code:"recipe_contract_invalid", stage:"materialize", recipeId:recipe.id }, "recipe_contract"); }
        if(drafts.length>=DESIGN_V2_MAX_DRAFTS)resource("dedupe");drafts.push({candidate:validatedCandidate,recipe,optionKey:option.optionKey});
        executionCounts.coverageValidated += 1;
      }
    }
  }

  drafts.sort((left,right) => compareDesignV2Tokens(left.candidate.id,right.candidate.id) || compareDesignV2Tokens(left.recipe.id,right.recipe.id) || compareDesignV2Tokens(left.optionKey,right.optionKey));
  const deduped: CandidateDraft[] = []; const byId = new Map<CandidateIdV2,CandidateDraft>();
  for (const draft of drafts) { const prior = byId.get(draft.candidate.id); if (!prior) {byId.set(draft.candidate.id,draft);deduped.push(draft);} else appendRejection(rejections,rejection({stage:"dedupe",reasonCode:"duplicate_candidate",recipeId:draft.recipe.id,optionKey:draft.optionKey,candidateId:draft.candidate.id,kept:{candidateId:prior.candidate.id,recipeId:prior.recipe.id,optionKey:prior.optionKey},componentProfileIds:sortedUnique(draft.candidate.components.map((entry)=>entry.profileId)),constraints:draft.candidate.constraints})); }
  executionCounts.deduped = deduped.length;
  const complete = deduped.filter((entry)=>candidateCompleteForCriteriaV2(entry.candidate,prepared.ranking.paretoCriteria)); const incomplete = deduped.filter((entry)=>!complete.includes(entry)); const dominated = new Set<CandidateDraft>();
  for (const candidate of complete) { const dominators = complete.filter((other)=>other!==candidate&&dominatesCandidateV2(other.candidate,candidate.candidate,prepared.ranking.paretoCriteria)).sort((a,b)=>compareDesignV2Tokens(a.candidate.id,b.candidate.id)); if (dominators[0]) { dominated.add(candidate); appendRejection(rejections,rejection({stage:"pareto",reasonCode:"pareto_dominated",recipeId:candidate.recipe.id,optionKey:candidate.optionKey,candidateId:candidate.candidate.id,dominatedByCandidateId:dominators[0].candidate.id,componentProfileIds:sortedUnique(candidate.candidate.components.map((entry)=>entry.profileId)),constraints:candidate.candidate.constraints})); } }
  const frontier = complete.filter((entry)=>!dominated.has(entry));
  const criteria = prepared.ranking.rankingProfiles[request.objective];
  const rankComplete = frontier.filter((entry)=>candidateCompleteForCriteriaV2(entry.candidate,criteria)).sort((a,b)=>compareCandidatesByCriteriaV2(a.candidate,b.candidate,criteria));
  const rankIncomplete = frontier.filter((entry)=>!candidateCompleteForCriteriaV2(entry.candidate,criteria)).sort((a,b)=>compareDesignV2Tokens(a.candidate.id,b.candidate.id));
  incomplete.sort((a,b)=>compareDesignV2Tokens(a.candidate.id,b.candidate.id)); const survivors = [...rankComplete,...rankIncomplete,...incomplete];
  executionCounts.pareto = survivors.length;
  if (survivors.length > DESIGN_V2_MAX_CANDIDATES) resource("result");
  rejections.sort((left,right)=>compareDesignV2Tokens(rejectionSortKey(left),rejectionSortKey(right))); executionCounts.rejected=rejections.length;
  const rejectedCandidates = rejections.map(projectGenerationRejectionV2).sort((left,right)=>compareDesignV2Tokens(canonicalDesignV2Payload([left.recipeId,left.componentProfileIds,left.constraints]),canonicalDesignV2Payload([right.recipeId,right.componentProfileIds,right.constraints])));
  const resultWithoutHash: Omit<DesignResultV2,"contentHash"> = { format:"schemagic-design-result",schemaVersion:2,request,requestHash:designRequestHashV2(request),libraryVersion:prepared.manifest.version,libraryContentHash:prepared.manifest.contentHash,candidates:survivors.map((entry)=>entry.candidate),rejectedCandidates,diagnostics:supported.length===0?["design.no_supported_recipe"]:[] };
  if (new TextEncoder().encode(canonicalDesignV2Payload(resultWithoutHash)).byteLength > DESIGN_RESULT_V2_MAX_CANONICAL_BYTES) resource("result");
  let result: DesignResultV2; try { result=parseDesignResultV2({...resultWithoutHash,contentHash:canonicalDesignResultV2ContentHash(resultWithoutHash)}); } catch { const recipeId=survivors[0]?.recipe.id; if (recipeId) return error({code:"recipe_contract_invalid",stage:"materialize",recipeId},"recipe_contract"); return error({code:"invalid_context",stage:"context"},"context_mismatch"); }
  const executionInput: DesignExecutionReportV2 = { pipeline:PIPELINE_STAGES_V2,counts:executionCounts,rejections };
  if (new TextEncoder().encode(canonicalDesignV2Payload(executionInput)).byteLength > DESIGN_EXECUTION_REPORT_V2_MAX_CANONICAL_BYTES) resource("report");
  let execution:DesignExecutionReportV2;try{execution=parseDesignExecutionReportV2(executionInput);}catch(caught){if(caught instanceof DesignParseErrorV2&&caught.detail.code==="resource_limit")resource("report");return error({code:"invalid_context",stage:"context"},"context_mismatch");}
  return { generation: detachedFrozenDesignV2Value({result,execution}), preParetoDrafts: deduped };
}

function generatePrepared(
  request: ElectricalDesignRequestV2,
  prepared: PreparedContext,
  witnessAuthority: PrimaryPartCustomizationGenerationWitness["authority"],
): DesignGenerationV2 {
  const compiled = generatePreparedWithDrafts(request, prepared);
  const survivingStructureKeys = new Set(compiled.generation.result.candidates.flatMap((candidate) => {
    const identity = primaryPartCustomizationStructureIdentity(candidate);
    return identity === undefined ? [] : [identity.structureKey];
  }));
  const profileCountsByStructure = new Map<string, Map<string, number>>();
  for (const draft of compiled.preParetoDrafts) {
    const identity = primaryPartCustomizationStructureIdentity(draft.candidate);
    if (identity === undefined || !survivingStructureKeys.has(identity.structureKey)) continue;
    const profileCounts = profileCountsByStructure.get(identity.structureKey) ?? new Map<string, number>();
    profileCounts.set(identity.primaryProfileId, (profileCounts.get(identity.primaryProfileId) ?? 0) + 1);
    profileCountsByStructure.set(identity.structureKey, profileCounts);
  }
  const uniqueTargetProfileIdsByStructure = new Map<string, readonly string[]>();
  for (const [structureKey, counts] of profileCountsByStructure) {
    uniqueTargetProfileIdsByStructure.set(
      structureKey,
      detachedFrozenDesignV2Value([...counts]
        .filter(([, count]) => count === 1)
        .map(([profileId]) => profileId)
        .sort(compareDesignV2Tokens)),
    );
  }
  primaryPartCustomizationWitnessByExactResult.set(compiled.generation.result, {
    authority: witnessAuthority,
    contextManifestContentHash: prepared.manifest.contentHash,
    resultContentHash: compiled.generation.result.contentHash,
    executionContentHash: designSha256ContentHash(
      canonicalDesignExecutionReportV2Payload(compiled.generation.execution),
    ),
    uniqueTargetProfileIdsByStructure,
  });
  return compiled.generation;
}

export function generateElectricalDesignV2(requestInput: ElectricalDesignRequestV2, context: GenerateElectricalContextV2): DesignGenerationV2 {
  let request: ElectricalDesignRequestV2; try { request=parseElectricalDesignRequestV2(requestInput); } catch { return error({code:"invalid_request",stage:"request"},"invalid_value"); }
  return generatePrepared(request,prepareContext(request,context),"installed_context");
}

export interface GenerateElectricalTestContextV2 { readonly manifest: Readonly<ElectricalDesignContextManifestV2>; readonly catalog: Readonly<ReviewedProfileCatalogV2>; readonly rankingPolicy: Readonly<ElectricalRankingPolicyV2>; readonly recipes: readonly DesignRecipeV2[]; readonly testOnly: true }
function parseTestCatalogV2(input:unknown):ReviewedProfileCatalogV2{const catalog=boundedDetachedFrozenDesignV2Value(input,"reviewed_profile_catalog",DESIGN_CONTEXT_V2_BYTE_LIMIT) as ReviewedProfileCatalogV2;if(!catalog||catalog.format!=="schemagic-reviewed-profile-catalog"||catalog.schemaVersion!==2||typeof catalog.version!=="string"||!catalog.version||!catalog.sourceRelease||catalog.sourceRelease.version!==catalog.version||!Array.isArray(catalog.profiles))throw new TypeError("Invalid test catalog");if(catalog.profiles.length>DESIGN_V2_MAX_REVIEWED_PROFILES)throw new DesignParseErrorV2({code:"resource_limit",stage:"parse",artifact:"reviewed_profile_catalog"},[designValidationIssue("resource_limit","/profiles")]);if(catalog.contentHash!==calculateReviewedProfileCatalogV2ContentHash(catalog))throw new TypeError("Invalid test catalog hash");const ids=catalog.profiles.map((profile)=>designProfileId(profile.partClass,profile.part));if(ids.some((id,index)=>index>0&&compareDesignV2Tokens(ids[index-1]!,id)>=0))throw new TypeError("Invalid test catalog order");return catalog;}
const TEST_CONTEXT_KEYS=["manifest","catalog","rankingPolicy","recipes","testOnly"] as const;
function captureTestContextV2(input:GenerateElectricalTestContextV2):GenerateElectricalTestContextV2{if(!input||typeof input!=="object"||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype)return error({code:"invalid_context",stage:"context"},"context_mismatch");const descriptors=Object.getOwnPropertyDescriptors(input);if(Reflect.ownKeys(descriptors).some((key)=>typeof key!=="string"||!TEST_CONTEXT_KEYS.includes(key as typeof TEST_CONTEXT_KEYS[number])))return error({code:"invalid_context",stage:"context"},"context_mismatch");for(const key of TEST_CONTEXT_KEYS)if(!descriptors[key]||!("value" in descriptors[key]!))return error({code:"invalid_context",stage:"context"},"context_mismatch");if(descriptors.testOnly!.value!==true||!Array.isArray(descriptors.recipes!.value))return error({code:"invalid_context",stage:"context"},"context_mismatch");if(descriptors.recipes!.value.length>DESIGN_V2_MAX_RECIPES)return error({code:"invalid_context",stage:"context"},"resource_limit");return{manifest:descriptors.manifest!.value as GenerateElectricalTestContextV2["manifest"],catalog:descriptors.catalog!.value as GenerateElectricalTestContextV2["catalog"],rankingPolicy:descriptors.rankingPolicy!.value as GenerateElectricalTestContextV2["rankingPolicy"],recipes:descriptors.recipes!.value as GenerateElectricalTestContextV2["recipes"],testOnly:true};}
export function generateElectricalDesignV2ForTesting(requestInput: ElectricalDesignRequestV2, contextInput: GenerateElectricalTestContextV2): DesignGenerationV2 {
  let request: ElectricalDesignRequestV2; try { request=parseElectricalDesignRequestV2(requestInput); } catch { return error({code:"invalid_request",stage:"request"},"invalid_value"); }
  const context=captureTestContextV2(contextInput);
  let manifest:ElectricalDesignContextManifestV2;let ranking:ElectricalRankingPolicyV2;let catalog:ReviewedProfileCatalogV2;
  try{manifest=parseElectricalDesignContextManifestV2(context.manifest);ranking=parseElectricalRankingPolicyV2(context.rankingPolicy);catalog=parseTestCatalogV2(context.catalog);}catch(caught){return error({code:"invalid_context",stage:"context"},caught instanceof DesignParseErrorV2&&caught.detail.code==="resource_limit"?"resource_limit":"context_mismatch");}
  const recipes=context.recipes.map(captureRecipeV2).sort((left,right)=>compareDesignV2Tokens(canonicalDesignV2Payload([left.id,left.version,left.contentHash]),canonicalDesignV2Payload([right.id,right.version,right.contentHash])));
  if(request.application!==manifest.application||ranking.application!==manifest.application||request.libraryVersion!==manifest.version||catalog.version!==manifest.catalog.version||catalog.contentHash!==manifest.catalog.contentHash||catalog.sourceRelease.contentHash!==manifest.catalog.sourceReleaseContentHash||!canonicalSame(recipes.map(recipeRef),manifest.recipes))return error({code:"invalid_context",stage:"context"},"context_mismatch");
  const requiredMetrics=new Set([...ranking.paretoCriteria,...Object.values(ranking.rankingProfiles).flat()].map((criterion)=>criterion.metricId));if([...requiredMetrics].some((metricId)=>recipes.some((recipe)=>!recipe.metricDeclarations.some((declaration)=>declaration.id===metricId))))return error({code:"invalid_context",stage:"context"},"invalid_reference");
  return generatePrepared(request,{manifest,catalog,ranking,recipes},"test_context");
}

export function canonicalDesignExecutionReportV2Payload(report: Readonly<DesignExecutionReportV2>): string { return canonicalDesignV2Payload(report); }

const REPORT_COUNT_KEYS = ["recipes","supportedRecipes","enumerated","solved","matchOutcomes","matched","checked","estimated","deduped","pareto","materialized","coverageValidated","rejected"] as const satisfies readonly (keyof GenerationCountsV2)[];
const REJECTION_STAGE_INDEX: Readonly<Record<GenerationRejectionV2["stage"],number>> = { solve:2,match:3,check:4,estimate:5,dedupe:8,pareto:9 };
const CANDIDATE_ID_V2 = /^candidate:v2:sha256:[0-9a-f]{64}$/;
const RESERVED_RULE_PREFIXES = ["sourcing.","commercial.","offer.","provider.","distributor."] as const;

function reportFailure(path:string,code:DesignValidationIssue["code"]="invalid_value"):never {
  throw new DesignParseErrorV2({code:code==="resource_limit"?"resource_limit":"invalid_document",stage:"parse",artifact:"execution_report"},[designValidationIssue(code,path)]);
}
function reportObject(value:unknown,path:string):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))return reportFailure(path,"invalid_type");return value as Record<string,unknown>;}
function reportKeys(value:Record<string,unknown>,allowed:readonly string[],path:string):void{const set=new Set(allowed);for(const key of Object.keys(value))if(!set.has(key))reportFailure(`${path}/${escapePointer(key)}`,"unknown_key");for(const key of allowed)if(!Object.prototype.hasOwnProperty.call(value,key))reportFailure(`${path}/${escapePointer(key)}`,"invalid_type");}
function reportString(value:unknown,path:string):string{if(typeof value!=="string"||value.length===0||/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value))return reportFailure(path,"invalid_value");return value;}
const REPORT_SI_UNITS=new Set(["1","A","F","H","Hz","K","V","V_s_per_rad","W","count","m","m2","ohm","rad_per_s","s"]);
function reportQuantity(value:unknown,path:string):void{const quantity=reportObject(value,path);reportKeys(quantity,["value","unit","displayUnit"],path);if(typeof quantity.value!=="number"||!Number.isFinite(quantity.value)||typeof quantity.unit!=="string"||!REPORT_SI_UNITS.has(quantity.unit))reportFailure(path,"invalid_value");reportString(quantity.displayUnit,`${path}/displayUnit`);}
function reportEvidence(value:unknown,path:string):void{const evidence=reportObject(value,path);const allowed=["sourceId","locator","retrievedAt","contentHash","licenseNote"] as const;const required=["sourceId","locator","licenseNote"] as const;const set=new Set<string>(allowed);for(const key of Object.keys(evidence))if(!set.has(key))reportFailure(`${path}/${escapePointer(key)}`,"unknown_key");for(const key of required)if(!Object.prototype.hasOwnProperty.call(evidence,key))reportFailure(`${path}/${key}`,"invalid_type");reportString(evidence.sourceId,`${path}/sourceId`);reportString(evidence.locator,`${path}/locator`);if(evidence.retrievedAt!==undefined)reportString(evidence.retrievedAt,`${path}/retrievedAt`);if(evidence.contentHash!==undefined)reportString(evidence.contentHash,`${path}/contentHash`);reportString(evidence.licenseNote,`${path}/licenseNote`);}
function reportConstraint(value:unknown,path:string):ConstraintResult{const constraint=reportObject(value,path);const allowed=["ruleId","status","actual","limit","margin","explanation","evidence"] as const;const required=["ruleId","status","explanation","evidence"] as const;const set=new Set<string>(allowed);for(const key of Object.keys(constraint))if(!set.has(key))reportFailure(`${path}/${escapePointer(key)}`,"unknown_key");for(const key of required)if(!Object.prototype.hasOwnProperty.call(constraint,key))reportFailure(`${path}/${key}`,"invalid_type");const ruleId=reportString(constraint.ruleId,`${path}/ruleId`);if(RESERVED_RULE_PREFIXES.some((prefix)=>ruleId.startsWith(prefix)))reportFailure(`${path}/ruleId`);if(!["fail","pass","unknown","warning"].includes(constraint.status as string))reportFailure(`${path}/status`);for(const field of ["actual","limit","margin"] as const)if(constraint[field]!==undefined)reportQuantity(constraint[field],`${path}/${field}`);reportString(constraint.explanation,`${path}/explanation`);if(!Array.isArray(constraint.evidence))reportFailure(`${path}/evidence`,`invalid_type`);constraint.evidence.forEach((entry,index)=>reportEvidence(entry,`${path}/evidence/${index}`));return constraint as unknown as ConstraintResult;}
function rejectionSortKey(rejection:Readonly<GenerationRejectionV2>):string{
  const correlated = rejection.reasonCode==="recipe_rejected"?rejection.recipeReason:rejection.reasonCode==="duplicate_candidate"?rejection.kept:rejection.reasonCode==="pareto_dominated"?rejection.dominatedByCandidateId:null;
  return canonicalDesignV2Payload([REJECTION_STAGE_INDEX[rejection.stage],rejection.recipeId,rejection.optionKey,"candidateId" in rejection?rejection.candidateId??null:null,rejection.componentProfileIds,rejection.constraints,rejection.reasonCode,correlated,rejection.message]);
}
function parseGenerationRejectionV2(input:unknown,index:number):GenerationRejectionV2{
  const path=`/rejections/${index}`;const value=reportObject(input,path);const stage=value.stage;const reason=value.reasonCode;
  let correlated:readonly string[];
  if((stage==="solve"||stage==="match")&&reason==="recipe_rejected")correlated=["recipeReason"];
  else if(stage==="check"&&(reason==="hard_constraint_failed"||reason==="unknown_constraint_disallowed"||reason==="warning_disallowed"))correlated=["candidateId"];
  else if(stage==="estimate"&&reason==="estimated_values_disallowed")correlated=["candidateId"];
  else if(stage==="dedupe"&&reason==="duplicate_candidate")correlated=["candidateId","kept"];
  else if(stage==="pareto"&&reason==="pareto_dominated")correlated=["candidateId","dominatedByCandidateId"];
  else return reportFailure(`${path}/reasonCode`);
  reportKeys(value,["stage","reasonCode","recipeId","optionKey","componentProfileIds","constraints","message",...correlated],path);
  reportString(value.recipeId,`${path}/recipeId`);reportString(value.optionKey,`${path}/optionKey`);
  if(!Array.isArray(value.componentProfileIds))reportFailure(`${path}/componentProfileIds`,"invalid_type");
  if(value.componentProfileIds.length>DESIGN_V2_MAX_COMPONENTS_PER_CANDIDATE)reportFailure(`${path}/componentProfileIds`,"resource_limit");
  const profileIds=value.componentProfileIds.map((entry,profileIndex)=>reportString(entry,`${path}/componentProfileIds/${profileIndex}`));
  for(let profileIndex=1;profileIndex<profileIds.length;profileIndex+=1)if(compareDesignV2Tokens(profileIds[profileIndex-1]!,profileIds[profileIndex]!)>=0)reportFailure(`${path}/componentProfileIds`,"invalid_order");
  if(!Array.isArray(value.constraints))reportFailure(`${path}/constraints`,"invalid_type");
  if(value.constraints.length>DESIGN_V2_MAX_CONSTRAINTS_PER_CANDIDATE)reportFailure(`${path}/constraints`,"resource_limit");
  const constraints=value.constraints.map((entry,constraintIndex)=>reportConstraint(entry,`${path}/constraints/${constraintIndex}`));
  for(let constraintIndex=1;constraintIndex<constraints.length;constraintIndex+=1){const left=constraints[constraintIndex-1]!,right=constraints[constraintIndex]!;if(compareDesignV2Tokens(left.ruleId,right.ruleId)>=0)reportFailure(`${path}/constraints`,"invalid_order");}
  if("candidateId" in value&&(!CANDIDATE_ID_V2.test(String(value.candidateId))))reportFailure(`${path}/candidateId`);
  if("recipeReason" in value)reportString(value.recipeReason,`${path}/recipeReason`);
  if("dominatedByCandidateId" in value){if(!CANDIDATE_ID_V2.test(String(value.dominatedByCandidateId))||value.dominatedByCandidateId===value.candidateId)reportFailure(`${path}/dominatedByCandidateId`);}
  if("kept" in value){const kept=reportObject(value.kept,`${path}/kept`);reportKeys(kept,["candidateId","recipeId","optionKey"],`${path}/kept`);if(!CANDIDATE_ID_V2.test(String(kept.candidateId)))reportFailure(`${path}/kept/candidateId`);reportString(kept.recipeId,`${path}/kept/recipeId`);reportString(kept.optionKey,`${path}/kept/optionKey`);if(kept.recipeId===value.recipeId&&kept.optionKey===value.optionKey)reportFailure(`${path}/kept`);}
  const {message,...withoutMessage}=value;const expected=renderGenerationRejectionMessageV2(withoutMessage as GenerationRejectionMessageInputV2);if(message!==expected)reportFailure(`${path}/message`);
  return value as unknown as GenerationRejectionV2;
}
export function parseDesignExecutionReportV2(input: unknown): DesignExecutionReportV2 {
  const report=reportObject(boundedDetachedFrozenDesignExecutionReportV2Value(input),"");reportKeys(report,["pipeline","counts","rejections"],"");
  if(!Array.isArray(report.pipeline)||report.pipeline.length!==PIPELINE_STAGES_V2.length||report.pipeline.some((stage,index)=>stage!==PIPELINE_STAGES_V2[index]))reportFailure("/pipeline","invalid_value");
  const rawCounts=reportObject(report.counts,"/counts");reportKeys(rawCounts,REPORT_COUNT_KEYS,"/counts");const parsedCounts={} as GenerationCountsV2;
  for(const key of REPORT_COUNT_KEYS){const count=rawCounts[key];if(!Number.isSafeInteger(count)||(count as number)<0)reportFailure(`/counts/${key}`);parsedCounts[key]=count as number;}
  if(parsedCounts.supportedRecipes>parsedCounts.recipes)reportFailure("/counts/supportedRecipes");
  if(!Array.isArray(report.rejections))reportFailure("/rejections","invalid_type");if(report.rejections.length>DESIGN_V2_MAX_REJECTIONS)reportFailure("/rejections","resource_limit");
  const rejections=report.rejections.map(parseGenerationRejectionV2);
  for(let index=1;index<rejections.length;index+=1)if(compareDesignV2Tokens(rejectionSortKey(rejections[index-1]!),rejectionSortKey(rejections[index]!))>=0)reportFailure("/rejections","invalid_order");
  const stageCount=(stage:GenerationRejectionV2["stage"])=>rejections.filter((entry)=>entry.stage===stage).length;
  if(parsedCounts.rejected!==rejections.length||parsedCounts.solved+stageCount("solve")!==parsedCounts.enumerated||parsedCounts.matched+stageCount("match")!==parsedCounts.matchOutcomes||parsedCounts.checked!==parsedCounts.matched||parsedCounts.estimated+stageCount("check")!==parsedCounts.checked||parsedCounts.materialized+stageCount("estimate")!==parsedCounts.estimated||parsedCounts.coverageValidated!==parsedCounts.materialized||parsedCounts.deduped+stageCount("dedupe")!==parsedCounts.coverageValidated||parsedCounts.pareto+stageCount("pareto")!==parsedCounts.deduped)reportFailure("/counts","invalid_value");
  return detachedFrozenDesignV2Value({pipeline:PIPELINE_STAGES_V2,counts:parsedCounts,rejections});
}

function customizationFailure(
  code: import("./v2-types").PrimaryPartCustomizationEvaluationErrorCodeV1,
  path = "",
): never {
  throw new PrimaryPartCustomizationEvaluationErrorV1(code, path);
}

function customizationInstruction(input: Readonly<PrimaryPartCustomizationSidecarV1>): PrimaryPartCustomizationSidecarV1 {
  try {
    const snapshot = boundedDetachedFrozenDesignV2Value(
      input,
      "candidate_identity",
      PRIMARY_PART_CUSTOMIZATION_MAX_BYTES,
    ) as PrimaryPartCustomizationSidecarV1;
    return parsePrimaryPartCustomizationSidecarV1Text(
      serializePrimaryPartCustomizationSidecarV1(snapshot),
    ).sidecar;
  } catch {
    return customizationFailure("invalid_instruction");
  }
}

function customizationSourceGeneration(input: Readonly<DesignGenerationV2>): {
  result: DesignResultV2;
  execution: DesignExecutionReportV2;
  exactResultObject: object;
} {
  const prototype = input && typeof input === "object" && !Array.isArray(input) ? Object.getPrototypeOf(input) : undefined;
  if (!input || typeof input !== "object" || Array.isArray(input) || (prototype !== Object.prototype && prototype !== null)) {
    return customizationFailure("invalid_source");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (
    Reflect.ownKeys(descriptors).some((key) => typeof key !== "string" || (key !== "result" && key !== "execution"))
    || !descriptors.result || !("value" in descriptors.result)
    || !descriptors.execution || !("value" in descriptors.execution)
  ) return customizationFailure("invalid_source");
  const exactResultObject = descriptors.result.value;
  if (!exactResultObject || typeof exactResultObject !== "object" || Array.isArray(exactResultObject)) {
    return customizationFailure("invalid_source");
  }
  try {
    return {
      result: parseDesignResultV2(descriptors.result.value),
      execution: parseDesignExecutionReportV2(descriptors.execution.value),
      exactResultObject,
    };
  } catch {
    return customizationFailure("invalid_source");
  }
}

function customizationPolicyCatalog(
  input: Readonly<ConstraintPolicyCatalogV3>,
): ConstraintPolicyCatalogV3 {
  try {
    return parseConstraintPolicyCatalogV3(input);
  } catch {
    return customizationFailure("policy_mismatch", "/installedPolicy");
  }
}

function sameComponentBytes(left: readonly DesignCandidateV2["components"][number][], right: readonly DesignCandidateV2["components"][number][]): boolean {
  return canonicalDesignV2Payload(left) === canonicalDesignV2Payload(right);
}

function primaryPartCustomizationStructureIdentity(
  candidate: Readonly<DesignCandidateV2>,
): Readonly<{ structureKey: string; primaryProfileId: string }> | undefined {
  const primaries = candidate.components.filter((component) => component.id === "primary");
  if (primaries.length !== 1) return undefined;
  const primary = primaries[0]!;
  return {
    structureKey: designSha256ContentHash(canonicalDesignV2Payload({
      recipeId: candidate.recipeId,
      primaryRole: primary.role,
      primaryQuantityPerAssembly: primary.quantityPerAssembly,
      primaryValue: primary.value ?? null,
      nonPrimaryComponents: candidate.components.filter((component) => component.id !== "primary"),
    })),
    primaryProfileId: primary.profileId,
  };
}

/**
 * Returns an authority-free list of primary profile IDs witnessed in the exact
 * in-process generation before Pareto pruning. A serialized or cloned result
 * intentionally has no witness and returns `undefined`; installed application
 * leaves fail closed instead of multiplying regeneration across caller-owned
 * catalog inputs. No candidate, decision, or eligibility data is exposed by
 * this optimization.
 */
function listExactGenerationPrimaryPartCustomizationTargetProfileIdsFromWitnessV1(
  sourceGenerationInput: Readonly<DesignGenerationV2>,
  sourceCandidateId: string,
  requiredAuthority: PrimaryPartCustomizationGenerationWitness["authority"],
): readonly string[] | undefined {
  const sourceGeneration = customizationSourceGeneration(sourceGenerationInput);
  const witness = primaryPartCustomizationWitnessByExactResult.get(sourceGeneration.exactResultObject);
  if (
    witness === undefined
    || witness.authority !== requiredAuthority
    || witness.resultContentHash !== sourceGeneration.result.contentHash
    || witness.executionContentHash !== designSha256ContentHash(
      canonicalDesignExecutionReportV2Payload(sourceGeneration.execution),
    )
  ) return undefined;
  const sourceCandidates = sourceGeneration.result.candidates.filter(
    (candidate) => candidate.id === sourceCandidateId,
  );
  if (sourceCandidates.length !== 1) return Object.freeze([]);
  const sourceIdentity = primaryPartCustomizationStructureIdentity(sourceCandidates[0]!);
  if (sourceIdentity === undefined) return Object.freeze([]);
  return detachedFrozenDesignV2Value(
    (witness.uniqueTargetProfileIdsByStructure.get(sourceIdentity.structureKey) ?? [])
      .filter((profileId) => profileId !== sourceIdentity.primaryProfileId),
  );
}

export function listExactGenerationPrimaryPartCustomizationTargetProfileIdsV1(
  sourceGenerationInput: Readonly<DesignGenerationV2>,
  sourceCandidateId: string,
): readonly string[] | undefined {
  return listExactGenerationPrimaryPartCustomizationTargetProfileIdsFromWitnessV1(
    sourceGenerationInput,
    sourceCandidateId,
    "installed_context",
  );
}

/** Explicit test-context witness access. Not exported by a production runtime surface. */
export function listExactGenerationPrimaryPartCustomizationTargetProfileIdsForTestingV1(
  sourceGenerationInput: Readonly<DesignGenerationV2>,
  sourceCandidateId: string,
): readonly string[] | undefined {
  return listExactGenerationPrimaryPartCustomizationTargetProfileIdsFromWitnessV1(
    sourceGenerationInput,
    sourceCandidateId,
    "test_context",
  );
}

/**
 * Engine-internal mechanism. A self-hashed policy catalog is not production
 * authorization; application runtimes must bind this primitive to their exact
 * installed code-owned catalog. Evaluates one exact admitted primary-profile customization without modifying
 * the ordinary V2 result. The target is selected only from candidates that ran
 * through the installed recipe's ordinary check, estimate, materialize, circuit
 * validation, and DesignResultV2 parse path before Pareto pruning.
 */
export function evaluatePrimaryPartCustomizationV1(
  instructionInput: Readonly<PrimaryPartCustomizationSidecarV1>,
  sourceGenerationInput: Readonly<DesignGenerationV2>,
  contextInput: Readonly<GenerateElectricalContextV2>,
  policyInput: Readonly<ConstraintPolicyCatalogV3>,
): PrimaryPartCustomizationObservationV1 {
  const instruction = customizationInstruction(instructionInput);
  const sourceGeneration = customizationSourceGeneration(sourceGenerationInput);
  const policy = customizationPolicyCatalog(policyInput);
  const request = sourceGeneration.result.request;

  let prepared: PreparedContext;
  let compiled: PreparedGeneration;
  try {
    prepared = prepareContext(request, contextInput);
    compiled = generatePreparedWithDrafts(request, prepared);
  } catch {
    return customizationFailure("context_mismatch");
  }
  const baseGeneration = compiled.generation;
  if (
    !canonicalSame(baseGeneration.result, sourceGeneration.result)
    || canonicalDesignExecutionReportV2Payload(baseGeneration.execution)
      !== canonicalDesignExecutionReportV2Payload(sourceGeneration.execution)
  ) return customizationFailure("invalid_source");

  const requestByteContentHash = designSha256ContentHash(canonicalElectricalDesignRequestV2Payload(request));
  if (
    instruction.application !== request.application
    || instruction.requestHash !== designRequestHashV2(request)
    || instruction.requestHash !== baseGeneration.result.requestHash
    || instruction.requestByteContentHash !== requestByteContentHash
    || instruction.sourceResultContentHash !== baseGeneration.result.contentHash
  ) return customizationFailure("invalid_source", "/request");

  const sourceCandidates = baseGeneration.result.candidates.filter((candidate) => candidate.id === instruction.sourceCandidateId);
  if (sourceCandidates.length !== 1) return customizationFailure("invalid_source", "/sourceCandidateId");
  const sourceCandidate = sourceCandidates[0]!;
  const recipeRef = prepared.manifest.recipes.find((recipe) => recipe.id === sourceCandidate.recipeId);
  if (
    instruction.context.libraryVersion !== prepared.manifest.version
    || instruction.context.contextManifestContentHash !== prepared.manifest.contentHash
    || instruction.context.catalog.version !== prepared.manifest.catalog.version
    || instruction.context.catalog.contentHash !== prepared.manifest.catalog.contentHash
    || instruction.context.catalog.sourceReleaseContentHash !== prepared.manifest.catalog.sourceReleaseContentHash
  ) return customizationFailure("context_mismatch", "/context");
  if (
    !recipeRef
    || instruction.context.recipe.id !== recipeRef.id
    || instruction.context.recipe.version !== recipeRef.version
    || instruction.context.recipe.contentHash !== recipeRef.contentHash
  ) return customizationFailure("context_mismatch", "/context/recipe");
  const manifestRecipes = new Map(prepared.manifest.recipes.map((recipe) => [recipe.id, recipe]));
  for (const [policyRecipeIndex, policyRecipe] of policy.recipePolicies.entries()) {
    const installedRecipe = manifestRecipes.get(policyRecipe.recipeId);
    if (!installedRecipe || installedRecipe.contentHash !== policyRecipe.recipeContentHash) {
      return customizationFailure("policy_mismatch", `/installedPolicy/recipePolicies/${policyRecipeIndex}/recipeContentHash`);
    }
  }
  const sourceRecipePolicy = policy.recipePolicies.find((entry) => entry.recipeId === recipeRef.id);
  if (
    policy.application !== prepared.manifest.application
    || !sourceRecipePolicy
    || sourceRecipePolicy.recipeContentHash !== recipeRef.contentHash
    || instruction.context.constraintPolicy.id !== policy.constraintPolicy
    || instruction.context.constraintPolicy.contentHash !== policy.contentHash
  ) return customizationFailure("policy_mismatch", "/context/constraintPolicy");

  const profilesById = new Map(prepared.catalog.profiles.map((profile) => [designProfileId(profile.partClass, profile.part), profile]));
  const sourceProfile = profilesById.get(instruction.substitution.sourceProfile.profileId);
  const targetProfile = profilesById.get(instruction.substitution.targetProfile.profileId);
  if (
    !sourceProfile || !targetProfile
    || designProfileEnvelopeContentHash(sourceProfile) !== instruction.substitution.sourceProfile.contentHash
    || designProfileEnvelopeContentHash(targetProfile) !== instruction.substitution.targetProfile.contentHash
  ) return customizationFailure("profile_mismatch", "/substitution");
  if (
    sourceProfile.partClass !== targetProfile.partClass
    || sourceProfile.factsSchemaVersion !== targetProfile.factsSchemaVersion
  ) return customizationFailure("profile_mismatch", "/substitution/targetProfile");

  const sourcePrimaries = sourceCandidate.components.filter((component) => component.id === "primary");
  if (
    sourcePrimaries.length !== 1
    || sourcePrimaries[0]!.profileId !== instruction.substitution.sourceProfile.profileId
  ) return customizationFailure("recipe_role_mismatch", "/sourceCandidate/primary");
  const sourcePrimary = sourcePrimaries[0]!;
  const sourceNonPrimary = sourceCandidate.components.filter((component) => component.id !== "primary");
  const targets = compiled.preParetoDrafts.filter((draft) => {
    if (draft.candidate.recipeId !== sourceCandidate.recipeId) return false;
    const primaries = draft.candidate.components.filter((component) => component.id === "primary");
    if (primaries.length !== 1) return false;
    const primary = primaries[0]!;
    if (
      primary.profileId !== instruction.substitution.targetProfile.profileId
      || primary.role !== sourcePrimary.role
      || primary.quantityPerAssembly !== sourcePrimary.quantityPerAssembly
      || canonicalDesignV2Payload(primary.value ?? null) !== canonicalDesignV2Payload(sourcePrimary.value ?? null)
    ) return false;
    return sameComponentBytes(
      draft.candidate.components.filter((component) => component.id !== "primary"),
      sourceNonPrimary,
    );
  });
  if (targets.length !== 1) return customizationFailure("target_not_unique", "/substitution/targetProfile");

  return detachedFrozenDesignV2Value({
    kind: "primary_part_customization_observation",
    application: request.application,
    instructionContentHash: instruction.contentHash,
    baseGeneration,
    sourceCandidate,
    targetCandidate: targets[0]!.candidate,
    claimBoundary: {
      constraintPolicyEligibility: "not_evaluated",
      selectedPartModel: "not_added",
    },
  });
}

/**
 * Engine-internal construction of a distinct target-only projection. The
 * ordinary generation remains byte-identical; ranking is deliberately not
 * recomputed. Public application leaves must close this primitive over their
 * code-owned installed policy catalog before treating the returned sidecar as
 * an authorized in-process customization.
 */
export function generatePrimaryPartCustomizedResultV1(
  instructionInput: Readonly<PrimaryPartCustomizationSidecarV1>,
  sourceGenerationInput: Readonly<DesignGenerationV2>,
  contextInput: Readonly<GenerateElectricalContextV2>,
  policyInput: Readonly<ConstraintPolicyCatalogV3>,
): PrimaryPartCustomizedResultSidecarV1 {
  const instruction = customizationInstruction(instructionInput);
  const observation = evaluatePrimaryPartCustomizationV1(
    instruction,
    sourceGenerationInput,
    contextInput,
    policyInput,
  );
  const base = observation.baseGeneration.result;
  const targetResultWithoutHash: Omit<DesignResultV2, "contentHash"> = {
    format: "schemagic-design-result",
    schemaVersion: 2,
    request: base.request,
    requestHash: base.requestHash,
    libraryVersion: base.libraryVersion,
    libraryContentHash: base.libraryContentHash,
    candidates: [observation.targetCandidate],
    rejectedCandidates: [],
    diagnostics: [],
  };
  const targetResultProjection = parseDesignResultV2({
    ...targetResultWithoutHash,
    contentHash: canonicalDesignResultV2ContentHash(targetResultWithoutHash),
  });
  const capturedContext = captureGenerateContextV2(contextInput);
  const manifest = parseElectricalDesignContextManifestV2(capturedContext.manifest);
  const policy = customizationPolicyCatalog(policyInput);
  const constraintDecision = evaluateConstraintDecisionV3(
    targetResultProjection,
    manifest,
    policy,
  );
  return createPrimaryPartCustomizedResultSidecarV1({
    format: "schemagic-designer-primary-part-customized-result",
    schemaVersion: 1,
    application: observation.application,
    instruction,
    source: {
      resultContentHash: base.contentHash,
      executionReportContentHash: designSha256ContentHash(
        canonicalDesignExecutionReportV2Payload(observation.baseGeneration.execution),
      ),
      candidateId: observation.sourceCandidate.id,
    },
    contextManifestContentHash: manifest.contentHash,
    targetResultProjection,
    constraintDecision,
    claimBoundary: {
      ordinaryGenerationMutation: "none",
      targetConstraintPolicyEligibility: "evaluated",
      ranking: "not_recomputed",
      selectedPartModel: "not_added",
      commercialAuthority: "not_added",
    },
  });
}

/** Recomputes the exact installed-context projection before accepting it. */
export function assertPrimaryPartCustomizedResultV1(
  sidecarInput: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  sourceGenerationInput: Readonly<DesignGenerationV2>,
  contextInput: Readonly<GenerateElectricalContextV2>,
  policyInput: Readonly<ConstraintPolicyCatalogV3>,
): PrimaryPartCustomizedResultSidecarV1 {
  let parsed: PrimaryPartCustomizedResultSidecarV1;
  try { parsed = parsePrimaryPartCustomizedResultSidecarV1(sidecarInput); }
  catch { return customizationFailure("customized_result_mismatch", "/customizedResult"); }
  const expected = generatePrimaryPartCustomizedResultV1(
    parsed.instruction,
    sourceGenerationInput,
    contextInput,
    policyInput,
  );
  if (
    canonicalPrimaryPartCustomizedResultPayload(parsed)
      !== canonicalPrimaryPartCustomizedResultPayload(expected)
  ) return customizationFailure("customized_result_mismatch", "/customizedResult");
  return detachedFrozenDesignV2Value(parsed);
}

export function validateDesignExecutionReportContextV2(report: Readonly<DesignExecutionReportV2>,result:Readonly<DesignResultV2>,context:Readonly<GenerateElectricalContextV2>): DesignValidationIssue[] {
  try{const parsedReport=parseDesignExecutionReportV2(report);const parsedResult=parseDesignResultV2(result);const generated=generateElectricalDesignV2(parsedResult.request,context);return canonicalDesignExecutionReportV2Payload(generated.execution)===canonicalDesignExecutionReportV2Payload(parsedReport)&&canonicalSame(generated.result,parsedResult)?[]:[designValidationIssue("context_mismatch","")];}catch{return[designValidationIssue("context_mismatch","")];}
}
export function validateDesignResultEngineeringContextV2(result:Readonly<DesignResultV2>,context:Readonly<GenerateElectricalContextV2>):DesignValidationIssue[]{try{const exactWitness=primaryPartCustomizationWitnessByExactResult.get(result);const parsed=parseDesignResultV2(result);const prepared=prepareContext(parsed.request,context);if(exactWitness?.authority==="installed_context"&&exactWitness.resultContentHash===parsed.contentHash&&exactWitness.contextManifestContentHash===prepared.manifest.contentHash)return[];return canonicalSame(generatePrepared(parsed.request,prepared,"installed_context").result,parsed)?[]:[designValidationIssue("context_mismatch","")];}catch{return[designValidationIssue("context_mismatch","")];}}

export function validateDesignResultExecutionContextV2(result:Readonly<DesignResultV2>,context:Readonly<DesignResultExecutionContextV2>):DesignValidationIssue[]{
  let parsed:DesignResultV2;try{parsed=parseDesignResultV2(result);}catch{return[designValidationIssue("coverage_contract","")];}
  const issues:DesignValidationIssue[]=[];
  parsed.candidates.forEach((candidate,candidateIndex)=>candidate.simulationCoverage.forEach((coverage,coverageIndex)=>{
    if(!candidate.circuit.scenarios.some((scenario)=>scenario.id===coverage.scenarioId))return;
    const path=`/candidates/${candidateIndex}/simulationCoverage/${coverageIndex}`;
    try{const options=context.trustedSubcircuitRegistry===undefined?{}:{registry:context.trustedSubcircuitRegistry};const generated=generateScenarioNetlist(candidate.circuit,coverage.scenarioId,options);const omissionLimitations=generated.omissions.map((omission)=>canonicalDesignV2Payload(omission)).sort(compareDesignV2Tokens);
      if(coverage.modelTier==="behavioral"?generated.omissions.length!==0:generated.omissions.length===0||omissionLimitations.some((limitation)=>!coverage.limitations.includes(limitation)))issues.push(designValidationIssue("coverage_contract",path));
    }catch{issues.push(designValidationIssue("coverage_contract",path));}
  }));
  return issues;
}

export function regenerateDesignResultV1AsV2(resultInput:PersistedDesignResultV1,context:GenerateElectricalContextV2,engineeringObjective?:ElectricalDesignObjectiveV2):import("./v2-types").DesignResultV1Regeneration{
  const result=parseDesignResultV1(resultInput);const sourceObjective=result.request.objective;
  if(["area","balanced","efficiency","temperature"].includes(sourceObjective)&&engineeringObjective!==undefined&&sourceObjective!==engineeringObjective)return{status:"engineering_objective_conflict",sourceObjective:sourceObjective as ElectricalDesignObjectiveV2,suppliedObjective:engineeringObjective};
  if(["availability","bom_cost","lead_time"].includes(sourceObjective)&&engineeringObjective===undefined)return migrateDesignRequestV1ToV2(result.request,"",engineeringObjective) as import("@opencircuit/design-schema").DesignRequestV2MigrationBlock;
  const migration=migrateDesignRequestV1ToV2(result.request,context.manifest.version,engineeringObjective); if(migration.status!=="migrated")return migration; return{status:"generated",generation:generateElectricalDesignV2(migration.request,context)};
}
