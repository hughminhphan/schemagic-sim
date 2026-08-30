import {
  upgradeCircuitV1ToV4,
  type CircuitDocument,
  type CircuitDocumentV1,
  type CircuitDocumentV4,
  type CircuitProbe,
  type LegacyCircuitProbe,
} from "@opencircuit/circuit-schema";
import { designProfileId, type PartClassId } from "@opencircuit/design-library/v2-runtime";
import {
  DESIGN_V2_MAX_HOOK_VALUE_CANONICAL_BYTES, boundedDetachedFrozenDesignV2Value, canonicalDesignV2Payload, compareDesignV2Tokens, designSha256ContentHash,
  detachedFrozenDesignV2Value, type CircuitBomNonRepresentationV2,
  type CircuitInstanceClassificationV2, type ConstraintResult, type ElectricalDesignRequestV2, type SimulationCoverageV2,
} from "@opencircuit/design-schema";
import type { DesignLibrary, DesignRecipe, ElectricalDesignRequest, JsonObject, MatchedOption, RecipeEnvironment, SolvedOption } from "./types";
import type {
  CandidateMaterializationV2, DesignRecipeV2, ElectricalMetricDeclarationV2,
  EnumeratedOptionV2, MatchedOptionV2, RecipeEnvironmentV2, SolvedOptionV2, StageOutcomeV2,
} from "./v2-types";

const ADAPTER_VERSION = 1 as const;
const NON_BOM_REASON = "v1_adapter_non_bom_or_unproven_instance";
const NON_REP_REASON = "v1_adapter_cannot_prove_selected_component_representation";
const PROFILE_MAP_KEY = "__schemagicV1ProfileIds";
const INVALID_REJECTION_PROFILE_ID = "v1-adapter:unresolved-profile-identity";

interface Envelope extends JsonObject { adapterContractVersion: 1; v1OptionKey: string; v1Data: JsonObject }
export interface LegacyProfileIdentityV2 { profileId:string;partClass:PartClassId;part:{manufacturerId:string;manufacturerPartNumber:string} }
interface CapturedV1Recipe {id:string;version:string;contentHash:string;supports:DesignRecipe["supports"];enumerate:DesignRecipe["enumerate"];solve:DesignRecipe["solve"];match:DesignRecipe["match"];check:DesignRecipe["check"];estimate:DesignRecipe["estimate"];materialize:DesignRecipe["materialize"]}
const V1_RECIPE_KEYS=["id","version","contentHash","supports","enumerate","solve","match","check","estimate","materialize"] as const;
function snapshotJson<T>(value:T):T{return boundedDetachedFrozenDesignV2Value(value,"candidate_identity",DESIGN_V2_MAX_HOOK_VALUE_CANONICAL_BYTES);}
function captureV1Recipe(recipe:DesignRecipe):CapturedV1Recipe{if(!recipe||typeof recipe!=="object"||Array.isArray(recipe)||Object.getPrototypeOf(recipe)!==Object.prototype)throw new TypeError("Invalid V1 recipe");const descriptors=Object.getOwnPropertyDescriptors(recipe);if(Reflect.ownKeys(descriptors).some((key)=>typeof key!=="string"||!V1_RECIPE_KEYS.includes(key as typeof V1_RECIPE_KEYS[number])))throw new TypeError("Invalid V1 recipe keys");for(const key of V1_RECIPE_KEYS)if(!descriptors[key]||!("value" in descriptors[key]!))throw new TypeError("V1 recipe accessors are forbidden");const ref=snapshotJson({id:descriptors.id!.value,version:descriptors.version!.value,contentHash:descriptors.contentHash!.value});if(typeof ref.id!=="string"||!ref.id||typeof ref.version!=="string"||!ref.version||typeof ref.contentHash!=="string"||!ref.contentHash)throw new TypeError("Invalid V1 recipe ref");const callbacks=Object.fromEntries(V1_RECIPE_KEYS.slice(3).map((key)=>[key,descriptors[key]!.value])) as Record<string,unknown>;if(Object.values(callbacks).some((callback)=>typeof callback!=="function"))throw new TypeError("Invalid V1 callback");const captured:CapturedV1Recipe={id:ref.id,version:ref.version,contentHash:ref.contentHash,supports:callbacks.supports as DesignRecipe["supports"],enumerate:callbacks.enumerate as DesignRecipe["enumerate"],solve:callbacks.solve as DesignRecipe["solve"],match:callbacks.match as DesignRecipe["match"],check:callbacks.check as DesignRecipe["check"],estimate:callbacks.estimate as DesignRecipe["estimate"],materialize:callbacks.materialize as DesignRecipe["materialize"]};return Object.freeze(captured);}
function envelope(optionKey: string, data: JsonObject): Envelope { return detachedFrozenDesignV2Value({ adapterContractVersion: ADAPTER_VERSION, v1OptionKey: optionKey, v1Data: data }); }
function unwrap(data: JsonObject): Envelope {
  if (data.adapterContractVersion !== 1 || typeof data.v1OptionKey !== "string" || !data.v1Data || typeof data.v1Data !== "object" || Array.isArray(data.v1Data)) throw new TypeError("Invalid V1 adapter envelope");
  return data as Envelope;
}
function dataWithProfileMap(data:JsonObject,components:MatchedOption["components"]):JsonObject{return{...data,[PROFILE_MAP_KEY]:Object.fromEntries(components.map((entry)=>[entry.id,entry.profileId])) as JsonObject};}
function dataWithoutProfileMap(data:JsonObject):JsonObject{const{[PROFILE_MAP_KEY]:_map,...rest}=data;return rest;}
function localComponents(option:MatchedOptionV2):MatchedOptionV2["components"]{const wrapped=unwrap(option.data);const mapping=wrapped.v1Data[PROFILE_MAP_KEY];if(!mapping||typeof mapping!=="object"||Array.isArray(mapping))throw new TypeError("Missing V1 adapter profile map");return option.components.map((component)=>({...component,profileId:String((mapping as JsonObject)[component.id])}));}
function mappedRequest(request: ElectricalDesignRequestV2): ElectricalDesignRequest {
  return detachedFrozenDesignV2Value({ ...request, schemaVersion: 1 }) as unknown as ElectricalDesignRequest;
}
function v1Environment(environment: RecipeEnvironmentV2): RecipeEnvironment {
  const library: DesignLibrary = { version: environment.manifest.version, contentHash: environment.manifest.contentHash, paretoCriteria: [], rankingProfiles: {} };
  return detachedFrozenDesignV2Value({ request: mappedRequest(environment.request), library });
}
function applications(values: readonly ("motor.brushed-dc" | "power.buck")[]): ("motor.brushed-dc" | "power.buck")[] {
  if (values.length === 0 || new Set(values).size !== values.length) throw new TypeError("Adapter applications must be non-empty and unique");
  const result = [...values].sort(compareDesignV2Tokens); if (result.some((entry, index) => entry !== values[index])) throw new TypeError("Adapter applications must be sorted"); return result;
}
function declarations(values: readonly ElectricalMetricDeclarationV2[]): ElectricalMetricDeclarationV2[] {
  const result = values.map((entry) => ({ ...entry }));
  if (new Set(result.map((entry) => entry.id)).size !== result.length) throw new TypeError("Adapter metric declarations must be unique");
  result.sort((left, right) => compareDesignV2Tokens(`${left.id}\n${left.unit}`, `${right.id}\n${right.unit}`));
  if (result.some((entry, index) => entry.id !== values[index]?.id || entry.unit !== values[index]?.unit)) throw new TypeError("Adapter metric declarations must be sorted");
  return result;
}
function coverage(values: readonly { scenarioId: string; modelTier: string; limitations: string[] }[]): SimulationCoverageV2[] {
  return values.map((entry) => {
    if (entry.modelTier !== "behavioral" && entry.modelTier !== "unavailable") throw new TypeError("V1 adapter accepts only behavioral or unavailable coverage");
    return { scenarioId: entry.scenarioId, modelTier: entry.modelTier as "behavioral" | "unavailable", limitations: [...entry.limitations].sort(compareDesignV2Tokens) };
  }).sort((left, right) => compareDesignV2Tokens(left.scenarioId, right.scenarioId));
}
function matchedV1(option: MatchedOptionV2): MatchedOption {
  const wrapped = unwrap(option.data);
  return { optionKey: wrapped.v1OptionKey, data: dataWithoutProfileMap(wrapped.v1Data), derivedValues: option.derivedValues, components: localComponents(option), simulationCoverage: option.simulationCoverage, warnings: option.warnings } as MatchedOption;
}

function legacyProbeForDesignerUpgrade(probe: Readonly<CircuitProbe>): LegacyCircuitProbe {
  const presentation = {
    id: probe.id,
    ...(probe.label === undefined ? {} : { label: probe.label }),
    ...(probe.color === undefined ? {} : { color: probe.color }),
  };
  const expression = probe.expression;
  if (expression.kind === "voltage") {
    if (expression.negative.kind !== "runtime-node" || expression.negative.name !== "0") {
      throw new TypeError(`V1 recipe probe ${probe.id} uses a differential voltage expression that Designer V4 cannot represent`);
    }
    const positive = expression.positive;
    const target = positive.kind === "schematic-wire"
      ? { wire: positive.wireId }
      : positive.kind === "schematic-pin"
        ? { componentPin: [positive.componentId, positive.pin] as [string, number] }
        : { node: positive.name };
    return { ...presentation, kind: "voltage", target };
  }
  if (expression.kind === "current") {
    if (expression.component.kind !== "schematic-component" || (
      expression.terminal !== undefined && typeof expression.terminal !== "number"
    )) {
      throw new TypeError(`V1 recipe probe ${probe.id} uses a current expression that Designer V4 cannot represent`);
    }
    return {
      ...presentation,
      kind: "current",
      target: { componentPin: [expression.component.componentId, expression.terminal ?? 0] },
    };
  }
  throw new TypeError(`V1 recipe probe ${probe.id} uses an expression that Designer V4 cannot represent`);
}

function upgradeSimulatorCircuitToDesignerV4(input: Readonly<CircuitDocument>): CircuitDocumentV4 {
  if (input.modelImports !== undefined && input.modelImports.parts.length > 0) {
    throw new TypeError("V1 recipe circuit uses imported Simulator models that Designer V4 cannot represent");
  }
  const legacyShape: CircuitDocumentV1 = {
    format: "opencircuit-circuit",
    version: 1,
    meta: structuredClone(input.meta),
    components: structuredClone(input.components),
    wires: structuredClone(input.wires),
    probes: input.probes.map(legacyProbeForDesignerUpgrade),
    sim: structuredClone(input.sim),
    ...(input.view === undefined ? {} : { view: structuredClone(input.view) }),
  };
  return upgradeCircuitV1ToV4(legacyShape);
}

function reviewedComponents(components: MatchedOption["components"], environment: RecipeEnvironmentV2): MatchedOptionV2["components"] {
  return components.map((component) => {
    const matches = environment.catalog.profiles.filter((profile) => profile.part.manufacturerId === component.part.manufacturerId && profile.part.manufacturerPartNumber === component.part.manufacturerPartNumber);
    if (matches.length !== 1) return { ...component, profileId: INVALID_REJECTION_PROFILE_ID };
    const profile = matches[0]!;
    return { ...component, profileId: designProfileId(profile.partClass, profile.part) };
  });
}
function reviewedRejection<T>(outcome: T, environment: RecipeEnvironmentV2,legacyProfiles:readonly LegacyProfileIdentityV2[]): T {
  if (!outcome || typeof outcome !== "object" || (outcome as { status?: unknown }).status !== "rejected") return outcome;
  const rejected = outcome as T & { componentProfileIds?: string[] };
  const resolved=(rejected.componentProfileIds??[]).map((profileId)=>{const direct=environment.catalog.profiles.filter((profile)=>designProfileId(profile.partClass,profile.part)===profileId);if(direct.length===1)return profileId;const legacy=legacyProfiles.filter((profile)=>profile.profileId===profileId);if(legacy.length!==1)return INVALID_REJECTION_PROFILE_ID;const matches=environment.catalog.profiles.filter((profile)=>profile.partClass===legacy[0]!.partClass&&profile.part.manufacturerId===legacy[0]!.part.manufacturerId&&profile.part.manufacturerPartNumber===legacy[0]!.part.manufacturerPartNumber);if(matches.length!==1)return INVALID_REJECTION_PROFILE_ID;return designProfileId(matches[0]!.partClass,matches[0]!.part);});
  if(new Set(resolved).size!==resolved.length)resolved.push(INVALID_REJECTION_PROFILE_ID);return{...rejected,...(rejected.componentProfileIds?{componentProfileIds:resolved.sort(compareDesignV2Tokens)}:{})};
}

function classifyCircuit(circuit: CircuitDocumentV4, components: MatchedOptionV2["components"]): CandidateMaterializationV2 {
  const classifications: CircuitInstanceClassificationV2[] = [];
  const nonRepresentations: CircuitBomNonRepresentationV2[] = [];
  for (const graph of circuit.circuits) {
    const physicalSelected = new Set<string>();
    for (const selected of components) {
      const sameMpnSelected = components.filter((entry) => entry.part.manufacturerPartNumber === selected.part.manufacturerPartNumber);
      const instances = graph.components.filter((entry) => entry.mpn === selected.part.manufacturerPartNumber);
      if (sameMpnSelected.length === 1 && Number.isSafeInteger(selected.quantityPerAssembly) && selected.quantityPerAssembly > 0 && instances.length === selected.quantityPerAssembly) {
        physicalSelected.add(selected.id);
        instances.forEach((instance) => classifications.push({ circuitId: graph.id, componentId: instance.id, kind: "physical", selectedComponentId: selected.id, representedQuantityPerAssembly: 1 }));
      }
    }
    for (const instance of graph.components) {
      if (classifications.some((entry) => entry.circuitId === graph.id && entry.componentId === instance.id)) continue;
      if (instance.mpn !== undefined) delete instance.mpn;
      classifications.push({ circuitId: graph.id, componentId: instance.id, kind: "non_bom", reason: NON_BOM_REASON });
    }
    for (const selected of components) if (!physicalSelected.has(selected.id)) nonRepresentations.push({ circuitId: graph.id, selectedComponentId: selected.id, reason: NON_REP_REASON });
  }
  classifications.sort((left, right) => compareDesignV2Tokens(left.circuitId, right.circuitId) || compareDesignV2Tokens(left.componentId, right.componentId));
  nonRepresentations.sort((left, right) => compareDesignV2Tokens(left.circuitId, right.circuitId) || compareDesignV2Tokens(left.selectedComponentId, right.selectedComponentId));
  return { circuit, circuitInstanceClassifications: classifications, circuitBomNonRepresentations: nonRepresentations };
}

export function adaptDesignRecipeV1ToV2(recipeInput: DesignRecipe, optionsInput: { applications: readonly ("motor.brushed-dc" | "power.buck")[]; metricDeclarations: readonly ElectricalMetricDeclarationV2[];legacyProfileIdentities?:readonly LegacyProfileIdentityV2[] }): DesignRecipeV2 {
  const recipe=captureV1Recipe(recipeInput);const options=snapshotJson(optionsInput);const declaredApplications = detachedFrozenDesignV2Value(applications(options.applications)); const metricDeclarations = detachedFrozenDesignV2Value(declarations(options.metricDeclarations));const legacyProfiles=detachedFrozenDesignV2Value([...(options.legacyProfileIdentities??[])].sort((a,b)=>compareDesignV2Tokens(a.profileId,b.profileId)));if(new Set(legacyProfiles.map((profile)=>profile.profileId)).size!==legacyProfiles.length)throw new TypeError("Duplicate legacy profile identity");
  const version = `${recipe.version}+schemagic-v2-adapter.1`;
  const contentHash = designSha256ContentHash(canonicalDesignV2Payload({ adapterContractVersion: ADAPTER_VERSION, v1RecipeRef: { id: recipe.id, version: recipe.version, contentHash: recipe.contentHash }, applications: declaredApplications, metricDeclarations,legacyProfileIdentities:legacyProfiles }));
  const adapted={
    id: recipe.id, version, contentHash, applications: declaredApplications, metricDeclarations,
    supports: (request: ElectricalDesignRequestV2) => recipe.supports(mappedRequest(request)),
    enumerate(environment: RecipeEnvironmentV2): readonly EnumeratedOptionV2[] {
      const entries=snapshotJson(recipe.enumerate(v1Environment(environment)));return entries.map((entry) => ({ optionKey: entry.optionKey, data: envelope(entry.optionKey, entry.data) }));
    },
    solve(option: Omit<EnumeratedOptionV2, "optionKey">, environment: RecipeEnvironmentV2): StageOutcomeV2<SolvedOptionV2> {
      const wrapped = unwrap(option.data); const outcome = snapshotJson(recipe.solve(snapshotJson({ optionKey: wrapped.v1OptionKey, data: wrapped.v1Data }), v1Environment(environment)));
      if (outcome.status === "rejected") return reviewedRejection(outcome, environment,legacyProfiles);
      return { status: "ok", value: { data: envelope(wrapped.v1OptionKey, outcome.value.data), derivedValues: outcome.value.derivedValues } };
    },
    match(option: SolvedOptionV2, environment: RecipeEnvironmentV2): readonly StageOutcomeV2<MatchedOptionV2>[] {
      const wrapped = unwrap(option.data);
      const source: SolvedOption = { optionKey: wrapped.v1OptionKey, data: wrapped.v1Data, derivedValues: option.derivedValues };
      return snapshotJson(recipe.match(snapshotJson(source), v1Environment(environment))).map((outcome) => outcome.status === "rejected" ? reviewedRejection(outcome, environment,legacyProfiles) : { status: "ok", value: { data: envelope(wrapped.v1OptionKey, dataWithProfileMap(outcome.value.data,outcome.value.components)), derivedValues: outcome.value.derivedValues, components: reviewedComponents(outcome.value.components, environment), simulationCoverage: coverage(outcome.value.simulationCoverage), warnings: [...outcome.value.warnings].sort(compareDesignV2Tokens) } });
    },
    check(option: MatchedOptionV2, environment: RecipeEnvironmentV2) { return snapshotJson(recipe.check(snapshotJson(matchedV1(option)), v1Environment(environment))); },
    estimate(option: MatchedOptionV2, constraints: readonly ConstraintResult[], environment: RecipeEnvironmentV2) { return snapshotJson(recipe.estimate(snapshotJson(matchedV1(option)),snapshotJson(constraints), v1Environment(environment))) as ReturnType<DesignRecipeV2["estimate"]>; },
    materialize(candidate: import("./v2-types").CandidateForMaterializationV2, environment: RecipeEnvironmentV2): CandidateMaterializationV2 {
      const wrapped = unwrap(candidate.data);
      const v1Candidate = { ...candidate, optionKey: wrapped.v1OptionKey, data: dataWithoutProfileMap(wrapped.v1Data), components:localComponents(candidate as unknown as MatchedOptionV2) };
      const source = snapshotJson(recipe.materialize(snapshotJson(v1Candidate) as never, v1Environment(environment)));
      const upgraded = upgradeSimulatorCircuitToDesignerV4(source);
      const explicitConfig = upgraded.scenarios[0]!.config;
      upgraded.scenarios = candidate.simulationCoverage.filter((entry) => entry.modelTier === "behavioral").map((entry) => ({ id: entry.scenarioId, title: entry.scenarioId, circuitId: "main", config: structuredClone(explicitConfig) })).sort((left, right) => compareDesignV2Tokens(left.id, right.id));
      upgraded.defaultScenarioId = upgraded.scenarios[0]?.id ?? null;
      return classifyCircuit(upgraded, candidate.components);
    },
  } satisfies DesignRecipeV2;
  const released={...adapted,applications:Object.freeze([...adapted.applications]),metricDeclarations:Object.freeze(adapted.metricDeclarations.map((entry)=>Object.freeze({...entry})))};
  for(const key of V1_RECIPE_KEYS.slice(3))Object.freeze(released[key]);
  return Object.freeze(released) as unknown as DesignRecipeV2;
}
