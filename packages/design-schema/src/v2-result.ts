import { canonicalizeCircuitV4, migrateCircuit, validateCircuit, validateCircuitV4, type CircuitDocumentV4 } from "@opencircuit/circuit-schema";
import { parseCandidateSourcingMetrics } from "@opencircuit/sourcing-schema";
import { assertValidDesignRequest } from "./validation";
import { designRequestHash } from "./migration";
import {
  DESIGN_RESULT_V2_MAX_CANONICAL_BYTES, DESIGN_V2_MAX_CANDIDATES,
  DESIGN_V2_MAX_CIRCUIT_BOM_NON_REPRESENTATIONS, DESIGN_V2_MAX_CIRCUIT_INSTANCE_CLASSIFICATIONS,
  DESIGN_V2_MAX_COMPONENTS_PER_CANDIDATE, DESIGN_V2_MAX_CONSTRAINTS_PER_CANDIDATE,
  DESIGN_V2_MAX_COVERAGE_PER_CANDIDATE, DESIGN_V2_MAX_DERIVED_VALUES_PER_CANDIDATE,
  DESIGN_V2_MAX_METRICS_PER_CANDIDATE, DESIGN_V2_MAX_REJECTIONS, DESIGN_V2_MAX_WARNINGS_PER_CANDIDATE,
} from "./v2-limits";
import {
  boundedDetachedFrozenDesignV2Value, canonicalDesignResultV2ContentHash, canonicalDesignV2Payload,
  canonicalDesignV2Value, compareDesignV2Tokens, designRequestHashV2, designValidationIssue,
  containsUnsafeDesignDisplayCharactersV2, detachedFrozenDesignV2Value, escapePointer,
} from "./v2-canonical";
import { migrateDesignRequestV1ToV2, parseElectricalDesignRequestV2 } from "./v2-request";
import {
  DesignParseErrorV2, type CircuitBomNonRepresentationV2, type CircuitInstanceClassificationV2,
  type DesignCandidateV2, type DesignResultV1RegenerationPlan, type DesignResultV2,
  type ElectricalDesignObjectiveV2, type PersistedDesignResultV1, type ParsedPersistedDesignResult,
} from "./v2-types";

const HASH = /^sha256:[0-9a-f]{64}$/;
const CANDIDATE_ID = /^candidate:v2:sha256:[0-9a-f]{64}$/;
const ELECTRICAL_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const RESERVED = ["sourcing.", "commercial.", "offer.", "provider.", "distributor."] as const;
const SI_UNITS = new Set(["1","A","F","H","Hz","K","V","V_s_per_rad","W","count","m","m2","ohm","rad_per_s","s"]);
type Artifact = "design_result" | "persisted_design_result";
type IssueCode = "invalid_type" | "unknown_key" | "invalid_value" | "invalid_hash" | "invalid_reference" | "invalid_order" | "resource_limit" | "coverage_contract" | "circuit_bom_binding";

function fail(path: string, code: IssueCode = "invalid_value", artifact: Artifact = "design_result"): never {
  throw new DesignParseErrorV2({ code: code === "resource_limit" ? "resource_limit" : "invalid_document", stage: "parse", artifact }, [designValidationIssue(code, path)]);
}
function object(value: unknown, path: string, artifact: Artifact = "design_result"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path, "invalid_type", artifact);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, required: readonly string[] = allowed, artifact:Artifact="design_result"): void {
  const set = new Set(allowed);
  for (const key of Object.keys(value)) if (!set.has(key)) fail(`${path}/${escapePointer(key)}`, "unknown_key",artifact);
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${path}/${escapePointer(key)}`, "invalid_type",artifact);
}
function stringValue(value: unknown, path: string,artifact:Artifact="design_result"): string {
  if (typeof value !== "string" || value.length === 0) return fail(path, "invalid_type",artifact);
  return value;
}
function controlFree(value: unknown, path: string,artifact:Artifact="design_result"): string {
  const parsed = stringValue(value, path,artifact);
  if (containsUnsafeDesignDisplayCharactersV2(parsed)) fail(path, "invalid_value", artifact);
  return parsed;
}
function electricalId(value: unknown, path: string, artifact: Artifact = "design_result"): string {
  const parsed = controlFree(value, path, artifact);
  if (!ELECTRICAL_ID.test(parsed) || RESERVED.some((prefix) => parsed.startsWith(prefix))) fail(path, "invalid_value", artifact);
  return parsed;
}
function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) return fail(path, "invalid_type");
  if (value.length > max) return fail(path, "resource_limit");
  return value;
}
function requireSortedUniqueStrings(values: unknown[], path: string): void {
  for (const [index, value] of values.entries()) controlFree(value, `${path}/${index}`);
  for (let index = 1; index < values.length; index += 1) if (compareDesignV2Tokens(values[index - 1] as string, values[index] as string) >= 0) fail(path, "invalid_order");
}
function tupleCompare(left: readonly string[], right: readonly string[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const compared = compareDesignV2Tokens(left[index] ?? "", right[index] ?? ""); if (compared !== 0) return compared;
  }
  return 0;
}
function requireSortedBy(values: unknown[], path: string, key: (value: Record<string, unknown>) => readonly string[], unique = true): void {
  for (let index = 1; index < values.length; index += 1) {
    const order = tupleCompare(key(object(values[index - 1], `${path}/${index - 1}`)), key(object(values[index], `${path}/${index}`)));
    if (order > 0 || (unique && order === 0)) fail(path, "invalid_order");
  }
}
function assertSafeCircuitResultStrings(value: unknown, path: string, propertyName?: string): void {
  if (typeof value === "string") {
    if (propertyName !== "mpn" && containsUnsafeDesignDisplayCharactersV2(value)) fail(path, "invalid_value");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafeCircuitResultStrings(entry, `${path}/${index}`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) assertSafeCircuitResultStrings(entry, `${path}/${escapePointer(key)}`, key);
}
function validateQuantity(value: unknown, path: string,artifact:Artifact="design_result"): void {
  const quantity=object(value,path,artifact);exactKeys(quantity,["value","unit","displayUnit"],path,["value","unit","displayUnit"],artifact);
  if(typeof quantity.value!=="number"||!Number.isFinite(quantity.value))fail(`${path}/value`,"invalid_value",artifact);
  if(typeof quantity.unit!=="string"||!SI_UNITS.has(quantity.unit))fail(`${path}/unit`,"invalid_value",artifact);
  controlFree(quantity.displayUnit,`${path}/displayUnit`,artifact);
}
function validateEvidence(value: unknown, path: string,artifact:Artifact="design_result"): void {
  const evidence=object(value,path,artifact);exactKeys(evidence,["sourceId","locator","retrievedAt","contentHash","licenseNote"],path,["sourceId","locator","licenseNote"],artifact);
  controlFree(evidence.sourceId,`${path}/sourceId`,artifact);controlFree(evidence.locator,`${path}/locator`,artifact);controlFree(evidence.licenseNote,`${path}/licenseNote`,artifact);
  if(evidence.retrievedAt!==undefined)controlFree(evidence.retrievedAt,`${path}/retrievedAt`,artifact);
  if(evidence.contentHash!==undefined)controlFree(evidence.contentHash,`${path}/contentHash`,artifact);
}
function validateEvidenceList(value:unknown,path:string,artifact:Artifact="design_result"):void{if(!Array.isArray(value))fail(path,"invalid_type",artifact);value.forEach((entry,index)=>validateEvidence(entry,`${path}/${index}`,artifact));}
function validateConstraint(value: unknown, path: string,artifact:Artifact="design_result",rejectCommercial=true): string {
  const constraint = object(value, path,artifact);
  exactKeys(constraint, ["ruleId", "status", "actual", "limit", "margin", "explanation", "evidence"], path, ["ruleId", "status", "explanation", "evidence"],artifact);
  const ruleId = rejectCommercial ? electricalId(constraint.ruleId, `${path}/ruleId`, artifact) : controlFree(constraint.ruleId, `${path}/ruleId`, artifact);
  if (!["fail", "pass", "unknown", "warning"].includes(constraint.status as string)) fail(`${path}/status`, "invalid_value",artifact);
  for(const field of ["actual","limit","margin"] as const)if(constraint[field]!==undefined)validateQuantity(constraint[field],`${path}/${field}`,artifact);
  controlFree(constraint.explanation, `${path}/explanation`,artifact);
  validateEvidenceList(constraint.evidence,`${path}/evidence`,artifact);
  return ruleId;
}

function validateSelectedComponents(values: unknown[], path: string): Map<string, Record<string, unknown>> {
  requireSortedBy(values, path, (entry) => [controlFree(entry.id, `${path}/id`)]);
  const selected = new Map<string, Record<string, unknown>>();
  values.forEach((value, index) => {
    const itemPath = `${path}/${index}`; const component = object(value, itemPath);
    exactKeys(component, ["id", "role", "profileId", "part", "quantityPerAssembly", "value", "evidence"], itemPath, ["id", "role", "profileId", "part", "quantityPerAssembly", "evidence"]);
    const id = controlFree(component.id, `${itemPath}/id`);
    controlFree(component.role, `${itemPath}/role`); controlFree(component.profileId, `${itemPath}/profileId`);
    const part = object(component.part, `${itemPath}/part`);
    exactKeys(part, ["manufacturerId", "manufacturerPartNumber"], `${itemPath}/part`);
    controlFree(part.manufacturerId, `${itemPath}/part/manufacturerId`); stringValue(part.manufacturerPartNumber, `${itemPath}/part/manufacturerPartNumber`);
    if (!Number.isSafeInteger(component.quantityPerAssembly) || (component.quantityPerAssembly as number) <= 0) fail(`${itemPath}/quantityPerAssembly`, "invalid_value");
    if(component.value!==undefined)validateQuantity(component.value,`${itemPath}/value`);
    validateEvidenceList(component.evidence,`${itemPath}/evidence`);
    selected.set(id, component);
  });
  return selected;
}

function validateCoverage(candidate: Record<string, unknown>, circuit: CircuitDocumentV4, path: string): void {
  const coverage = array(candidate.simulationCoverage, `${path}/simulationCoverage`, DESIGN_V2_MAX_COVERAGE_PER_CANDIDATE);
  requireSortedBy(coverage, `${path}/simulationCoverage`, (entry) => [controlFree(entry.scenarioId, `${path}/simulationCoverage/scenarioId`)]);
  const byId = new Map<string, Record<string, unknown>>();
  coverage.forEach((raw, index) => {
    const itemPath = `${path}/simulationCoverage/${index}`; const item = object(raw, itemPath);
    exactKeys(item, ["scenarioId", "modelTier", "limitations"], itemPath);
    const scenarioId = controlFree(item.scenarioId, `${itemPath}/scenarioId`);
    if (item.modelTier !== "behavioral" && item.modelTier !== "unavailable") fail(`${itemPath}/modelTier`, "coverage_contract");
    const limitations = array(item.limitations, `${itemPath}/limitations`, DESIGN_V2_MAX_WARNINGS_PER_CANDIDATE);
    requireSortedUniqueStrings(limitations, `${itemPath}/limitations`);
    limitations.forEach((reason, reasonIndex) => controlFree(reason, `${itemPath}/limitations/${reasonIndex}`));
    byId.set(scenarioId, item);
  });
  const scenarios = new Map(circuit.scenarios.map((scenario) => [scenario.id, scenario]));
  for (const scenario of circuit.scenarios) if (!byId.has(scenario.id)) fail(`${path}/circuit/scenarios`, "coverage_contract");
  for (const [scenarioId, item] of byId) {
    const scenario = scenarios.get(scenarioId);
    if (item.modelTier === "behavioral" && !scenario) fail(`${path}/simulationCoverage`, "coverage_contract");
    if (!scenario) continue;
    const graph = circuit.circuits.find((entry) => entry.id === scenario.circuitId)!;
    const omissionLimitations = graph.components.flatMap((component) => {
      if (component.type !== "design_block") return [];
      const block = circuit.designBlocks.find((entry) => entry.id === component.block.id && entry.version === component.block.version && entry.contentHash === component.block.contentHash);
      if (block?.netlist.kind !== "schematic_only") return [];
      return [canonicalDesignV2Payload({ code:"SCHEMATIC_ONLY_BLOCK_OMITTED",scenarioId,circuitId:graph.id,componentId:component.id,blockId:block.id,reason:block.netlist.reason })];
    }).sort(compareDesignV2Tokens);
    const schematicOnly = omissionLimitations.length > 0;
    if (item.modelTier === "behavioral" ? schematicOnly : !schematicOnly) fail(`${path}/simulationCoverage`, "coverage_contract");
    if (item.modelTier === "unavailable" && omissionLimitations.some((limitation) => !(item.limitations as string[]).includes(limitation))) fail(`${path}/simulationCoverage`, "coverage_contract");
  }
}

function pairKey(circuitId: string, componentId: string): string { return JSON.stringify([circuitId, componentId]); }

function validateBindings(candidate: Record<string, unknown>, circuit: CircuitDocumentV4, selected: Map<string, Record<string, unknown>>, path: string): void {
  const classifications = array(candidate.circuitInstanceClassifications, `${path}/circuitInstanceClassifications`, DESIGN_V2_MAX_CIRCUIT_INSTANCE_CLASSIFICATIONS);
  const nonRepresentations = array(candidate.circuitBomNonRepresentations, `${path}/circuitBomNonRepresentations`, DESIGN_V2_MAX_CIRCUIT_BOM_NON_REPRESENTATIONS);
  requireSortedBy(classifications, `${path}/circuitInstanceClassifications`, (entry) => [controlFree(entry.circuitId, ""), controlFree(entry.componentId, "")]);
  requireSortedBy(nonRepresentations, `${path}/circuitBomNonRepresentations`, (entry) => [controlFree(entry.circuitId, ""), controlFree(entry.selectedComponentId, "")]);
  const graphs = new Map(circuit.circuits.map((graph) => [graph.id, new Map(graph.components.map((component) => [component.id, component]))]));
  const instances = new Set<string>(); const physical = new Map<string, number>(); const behavioral = new Set<string>();
  for (const [index, raw] of classifications.entries()) {
    const itemPath = `${path}/circuitInstanceClassifications/${index}`;
    const item = object(raw, itemPath) as unknown as CircuitInstanceClassificationV2 & Record<string, unknown>;
    const baseKeys = ["circuitId", "componentId", "kind"];
    if (item.kind === "physical") exactKeys(item, [...baseKeys, "selectedComponentId", "representedQuantityPerAssembly"], itemPath);
    else if (item.kind === "behavioral") exactKeys(item, [...baseKeys, "selectedComponentId", "reason"], itemPath);
    else if (item.kind === "non_bom") exactKeys(item, [...baseKeys, "reason"], itemPath);
    else fail(`${itemPath}/kind`, "circuit_bom_binding");
    const instance = graphs.get(item.circuitId)?.get(item.componentId);
    if (!instance) fail(itemPath, "circuit_bom_binding");
    instances.add(pairKey(item.circuitId, item.componentId));
    if (item.kind === "physical") {
      const selectedComponent = selected.get(item.selectedComponentId);
      if (!selectedComponent || !Number.isSafeInteger(item.representedQuantityPerAssembly) || item.representedQuantityPerAssembly <= 0) fail(itemPath, "circuit_bom_binding");
      if (instance.mpn !== (selectedComponent.part as Record<string, unknown>).manufacturerPartNumber) fail(itemPath, "circuit_bom_binding");
      const pair = pairKey(item.circuitId, item.selectedComponentId); physical.set(pair, (physical.get(pair) ?? 0) + item.representedQuantityPerAssembly);
    } else {
      if (instance.mpn !== undefined) fail(itemPath, "circuit_bom_binding");
      controlFree(item.reason, `${itemPath}/reason`);
      if (item.kind === "behavioral") {
        if (!selected.has(item.selectedComponentId)) fail(itemPath, "circuit_bom_binding");
        behavioral.add(pairKey(item.circuitId, item.selectedComponentId));
      }
    }
  }
  for (const [circuitId, components] of graphs) for (const componentId of components.keys()) if (!instances.has(pairKey(circuitId, componentId))) fail(`${path}/circuitInstanceClassifications`, "circuit_bom_binding");
  const nonrep = new Set<string>();
  nonRepresentations.forEach((raw, index) => {
    const itemPath = `${path}/circuitBomNonRepresentations/${index}`;
    const item = object(raw, itemPath) as unknown as CircuitBomNonRepresentationV2 & Record<string, unknown>;
    exactKeys(item, ["circuitId", "selectedComponentId", "reason"], itemPath);
    if (!graphs.has(item.circuitId) || !selected.has(item.selectedComponentId)) fail(itemPath, "circuit_bom_binding");
    controlFree(item.reason, `${itemPath}/reason`); nonrep.add(pairKey(item.circuitId, item.selectedComponentId));
  });
  for (const circuitId of graphs.keys()) for (const [selectedId, selectedComponent] of selected) {
    const pair = pairKey(circuitId, selectedId);
    const states = Number(physical.has(pair)) + Number(behavioral.has(pair)) + Number(nonrep.has(pair));
    if (states !== 1 || (physical.has(pair) && physical.get(pair) !== selectedComponent.quantityPerAssembly)) fail(`${path}/circuitBomNonRepresentations`, "circuit_bom_binding");
  }
}

function validateCandidate(raw: unknown, index: number, requestHash: string, libraryVersion: string): DesignCandidateV2 {
  const path = `/candidates/${index}`; const candidate = object(raw, path);
  exactKeys(candidate, ["schemaVersion", "id", "requestHash", "recipeId", "libraryVersion", "components", "derivedValues", "constraints", "metrics", "simulationCoverage", "circuit", "circuitInstanceClassifications", "circuitBomNonRepresentations", "warnings"], path);
  if (candidate.schemaVersion !== 2 || typeof candidate.id !== "string" || !CANDIDATE_ID.test(candidate.id)) fail(`${path}/id`, "invalid_hash");
  if (candidate.requestHash !== requestHash || candidate.libraryVersion !== libraryVersion) fail(path, "invalid_reference");
  controlFree(candidate.recipeId, `${path}/recipeId`);
  const components = array(candidate.components, `${path}/components`, DESIGN_V2_MAX_COMPONENTS_PER_CANDIDATE);
  const selected = validateSelectedComponents(components, `${path}/components`);
  const derived = array(candidate.derivedValues, `${path}/derivedValues`, DESIGN_V2_MAX_DERIVED_VALUES_PER_CANDIDATE);
  requireSortedBy(derived, `${path}/derivedValues`, (entry) => [controlFree(entry.id, "")]);
  derived.forEach((rawDerived,derivedIndex)=>{const itemPath=`${path}/derivedValues/${derivedIndex}`;const value=object(rawDerived,itemPath);exactKeys(value,["id","value","equationId","state","evidence"],itemPath);electricalId(value.id,`${itemPath}/id`);controlFree(value.equationId,`${itemPath}/equationId`);if(value.state!=="calculated"&&value.state!=="estimated")fail(`${itemPath}/state`,`invalid_value`);validateQuantity(value.value,`${itemPath}/value`);validateEvidenceList(value.evidence,`${itemPath}/evidence`);});
  const constraints = array(candidate.constraints, `${path}/constraints`, DESIGN_V2_MAX_CONSTRAINTS_PER_CANDIDATE);
  const ruleIds = constraints.map((entry, constraintIndex) => validateConstraint(entry, `${path}/constraints/${constraintIndex}`));
  if (new Set(ruleIds).size !== ruleIds.length) fail(`${path}/constraints`, "invalid_order");
  requireSortedBy(constraints, `${path}/constraints`, (entry) => [entry.ruleId as string, canonicalDesignV2Payload(entry)]);
  const metrics = object(candidate.metrics, `${path}/metrics`);
  exactKeys(metrics, ["values", "warningCount", "estimateCount", "unknownCount"], `${path}/metrics`);
  const metricValues = array(metrics.values, `${path}/metrics/values`, DESIGN_V2_MAX_METRICS_PER_CANDIDATE);
  requireSortedBy(metricValues, `${path}/metrics/values`, (entry) => [controlFree(entry.id, "")]);
  for (const [metricIndex, rawMetric] of metricValues.entries()) {
    const metricPath = `${path}/metrics/values/${metricIndex}`; const metric = object(rawMetric, metricPath);
    exactKeys(metric, ["id", "value", "state", "explanation", "evidence"], metricPath);
    electricalId(metric.id,`${metricPath}/id`);controlFree(metric.explanation,`${metricPath}/explanation`);validateEvidenceList(metric.evidence,`${metricPath}/evidence`);
    if (!["calculated", "estimated", "unknown"].includes(metric.state as string)) fail(`${metricPath}/state`, "invalid_value");
    if ((metric.state === "unknown") !== (metric.value === null)) fail(`${metricPath}/value`, "invalid_value");
    if(metric.value!==null)validateQuantity(metric.value,`${metricPath}/value`);
  }
  const warningCount = constraints.filter((entry) => (entry as Record<string, unknown>).status === "warning").length;
  const estimateCount = metricValues.filter((entry) => (entry as Record<string, unknown>).state === "estimated").length;
  const unknownCount = constraints.filter((entry) => (entry as Record<string, unknown>).status === "unknown").length + metricValues.filter((entry) => (entry as Record<string, unknown>).state === "unknown").length;
  if (metrics.warningCount !== warningCount || metrics.estimateCount !== estimateCount || metrics.unknownCount !== unknownCount) fail(`${path}/metrics`, "invalid_value");
  const warnings = array(candidate.warnings, `${path}/warnings`, DESIGN_V2_MAX_WARNINGS_PER_CANDIDATE); requireSortedUniqueStrings(warnings, `${path}/warnings`);
  let normalizedCircuit: CircuitDocumentV4;
  assertSafeCircuitResultStrings(candidate.circuit, `${path}/circuit`);
  try { normalizedCircuit = JSON.parse(canonicalizeCircuitV4(candidate.circuit as CircuitDocumentV4, true)) as CircuitDocumentV4; }
  catch { return fail(`${path}/circuit`, "invalid_value"); }
  if (validateCircuitV4(normalizedCircuit).length > 0) fail(`${path}/circuit`, "invalid_value");
  candidate.circuit = normalizedCircuit;
  validateCoverage(candidate, normalizedCircuit, path); validateBindings(candidate, normalizedCircuit, selected, path);
  return candidate as unknown as DesignCandidateV2;
}

export function parseDesignResultV2(input: unknown): DesignResultV2 {
  const snapshot=boundedDetachedFrozenDesignV2Value(input, "design_result", DESIGN_RESULT_V2_MAX_CANONICAL_BYTES);
  const result = object(canonicalDesignV2Value(snapshot), "");
  exactKeys(result, ["format", "schemaVersion", "request", "requestHash", "libraryVersion", "libraryContentHash", "candidates", "rejectedCandidates", "diagnostics", "contentHash"], "");
  if (result.format !== "schemagic-design-result" || result.schemaVersion !== 2) fail("/schemaVersion", "invalid_value");
  const request = parseElectricalDesignRequestV2(result.request); result.request = request;
  if (typeof result.requestHash !== "string" || !HASH.test(result.requestHash) || result.requestHash !== designRequestHashV2(request)) fail("/requestHash", "invalid_hash");
  const libraryVersion = controlFree(result.libraryVersion, "/libraryVersion");
  if (request.libraryVersion !== libraryVersion) fail("/libraryVersion", "invalid_reference");
  if (typeof result.libraryContentHash !== "string" || !HASH.test(result.libraryContentHash)) fail("/libraryContentHash", "invalid_hash");
  const candidates = array(result.candidates, "/candidates", DESIGN_V2_MAX_CANDIDATES).map((entry, index) => validateCandidate(entry, index, result.requestHash as string, libraryVersion));
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) fail("/candidates", "invalid_order");
  result.candidates = candidates;
  const rejected = array(result.rejectedCandidates, "/rejectedCandidates", DESIGN_V2_MAX_REJECTIONS);
  rejected.forEach((entry, index) => {
    const path = `/rejectedCandidates/${index}`; const rejection = object(entry, path);
    exactKeys(rejection, ["recipeId", "componentProfileIds", "constraints"], path);
    controlFree(rejection.recipeId, `${path}/recipeId`);
    const profileIds = array(rejection.componentProfileIds, `${path}/componentProfileIds`, DESIGN_V2_MAX_COMPONENTS_PER_CANDIDATE); requireSortedUniqueStrings(profileIds, `${path}/componentProfileIds`);
    const rejectionConstraints = array(rejection.constraints, `${path}/constraints`, DESIGN_V2_MAX_CONSTRAINTS_PER_CANDIDATE);
    const rejectionRuleIds=rejectionConstraints.map((constraint, constraintIndex) => validateConstraint(constraint, `${path}/constraints/${constraintIndex}`));
    if(new Set(rejectionRuleIds).size!==rejectionRuleIds.length)fail(`${path}/constraints`,"invalid_order");
    requireSortedBy(rejectionConstraints,`${path}/constraints`,(entry)=>[entry.ruleId as string,canonicalDesignV2Payload(entry)]);
  });
  requireSortedBy(rejected, "/rejectedCandidates", (entry) => [canonicalDesignV2Payload([entry.recipeId, entry.componentProfileIds, entry.constraints])], false);
  const diagnostics = array(result.diagnostics, "/diagnostics", 1); requireSortedUniqueStrings(diagnostics, "/diagnostics");
  if (diagnostics.some((entry) => entry !== "design.no_supported_recipe") || (diagnostics.length > 0 && (candidates.length > 0 || rejected.length > 0))) fail("/diagnostics", "invalid_value");
  if (typeof result.contentHash !== "string" || !HASH.test(result.contentHash) || result.contentHash !== canonicalDesignResultV2ContentHash(result as unknown as DesignResultV2)) fail("/contentHash", "invalid_hash");
  return detachedFrozenDesignV2Value(result as unknown as DesignResultV2);
}

export function serializeDesignResultV2(result: Readonly<DesignResultV2>): string {
  return canonicalDesignV2Payload(parseDesignResultV2(result));
}

function legacyCanonical(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Cannot export a non-finite number"); return Object.is(value, -0) ? 0 : value; }
  if (Array.isArray(value)) return value.map(legacyCanonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort((a, b) => a.localeCompare(b)).filter((key) => (value as Record<string, unknown>)[key] !== undefined).map((key) => [key, legacyCanonical((value as Record<string, unknown>)[key])]));
  }
  throw new Error(`Cannot export ${typeof value} in design JSON`);
}

export function serializeDesignResultV1(result: Readonly<PersistedDesignResultV1>): string {
  return `${JSON.stringify(legacyCanonical(result), null, 2)}\n`;
}

function validateV1SelectedComponents(value:unknown,path:string):void{
  if(!Array.isArray(value))fail(path,"invalid_type","persisted_design_result");
  value.forEach((raw,index)=>{const itemPath=`${path}/${index}`;const component=object(raw,itemPath,"persisted_design_result");exactKeys(component,["id","role","profileId","part","quantityPerAssembly","value","evidence"],itemPath,["id","role","profileId","part","quantityPerAssembly","evidence"],"persisted_design_result");controlFree(component.id,`${itemPath}/id`,`persisted_design_result`);controlFree(component.role,`${itemPath}/role`,`persisted_design_result`);controlFree(component.profileId,`${itemPath}/profileId`,`persisted_design_result`);const part=object(component.part,`${itemPath}/part`,`persisted_design_result`);exactKeys(part,["manufacturerId","manufacturerPartNumber"],`${itemPath}/part`,undefined,"persisted_design_result");controlFree(part.manufacturerId,`${itemPath}/part/manufacturerId`,`persisted_design_result`);stringValue(part.manufacturerPartNumber,`${itemPath}/part/manufacturerPartNumber`,`persisted_design_result`);if(!Number.isSafeInteger(component.quantityPerAssembly)||(component.quantityPerAssembly as number)<=0)fail(`${itemPath}/quantityPerAssembly`,`invalid_value`,`persisted_design_result`);if(component.value!==undefined)validateQuantity(component.value,`${itemPath}/value`,`persisted_design_result`);validateEvidenceList(component.evidence,`${itemPath}/evidence`,`persisted_design_result`);});
}
function validateV1DerivedValues(value:unknown,path:string):void{if(!Array.isArray(value))fail(path,"invalid_type","persisted_design_result");value.forEach((raw,index)=>{const itemPath=`${path}/${index}`;const item=object(raw,itemPath,"persisted_design_result");exactKeys(item,["id","value","equationId","state","evidence"],itemPath,undefined,"persisted_design_result");controlFree(item.id,`${itemPath}/id`,`persisted_design_result`);validateQuantity(item.value,`${itemPath}/value`,`persisted_design_result`);controlFree(item.equationId,`${itemPath}/equationId`,`persisted_design_result`);if(item.state!=="calculated"&&item.state!=="estimated")fail(`${itemPath}/state`,`invalid_value`,`persisted_design_result`);validateEvidenceList(item.evidence,`${itemPath}/evidence`,`persisted_design_result`);});}
function validateV1Constraints(value:unknown,path:string):void{if(!Array.isArray(value))fail(path,"invalid_type","persisted_design_result");value.forEach((entry,index)=>validateConstraint(entry,`${path}/${index}`,"persisted_design_result",false));}
function validateV1Metrics(value:unknown,path:string):void{const metrics=object(value,path,"persisted_design_result");exactKeys(metrics,["values","warningCount","estimateCount","unknownCount"],path,undefined,"persisted_design_result");if(!Array.isArray(metrics.values))fail(`${path}/values`,`invalid_type`,`persisted_design_result`);metrics.values.forEach((raw,index)=>{const itemPath=`${path}/values/${index}`;const metric=object(raw,itemPath,"persisted_design_result");exactKeys(metric,["id","value","state","explanation","evidence"],itemPath,undefined,"persisted_design_result");controlFree(metric.id,`${itemPath}/id`,`persisted_design_result`);if(!["authored_rule","calculated","estimated","reviewed","unknown","simulated"].includes(metric.state as string))fail(`${itemPath}/state`,`invalid_value`,`persisted_design_result`);if(metric.value!==null)validateQuantity(metric.value,`${itemPath}/value`,`persisted_design_result`);if(metric.state==="unknown"&&metric.value!==null)fail(`${itemPath}/value`,`invalid_value`,`persisted_design_result`);controlFree(metric.explanation,`${itemPath}/explanation`,`persisted_design_result`);validateEvidenceList(metric.evidence,`${itemPath}/evidence`,`persisted_design_result`);});for(const key of ["warningCount","estimateCount","unknownCount"] as const)if(!Number.isSafeInteger(metrics[key])||(metrics[key] as number)<0)fail(`${path}/${key}`,"invalid_value","persisted_design_result");}
function validateV1Coverage(value:unknown,path:string):void{if(!Array.isArray(value))fail(path,"invalid_type","persisted_design_result");value.forEach((raw,index)=>{const itemPath=`${path}/${index}`;const entry=object(raw,itemPath,"persisted_design_result");exactKeys(entry,["scenarioId","modelTier","limitations"],itemPath,undefined,"persisted_design_result");controlFree(entry.scenarioId,`${itemPath}/scenarioId`,`persisted_design_result`);if(!["behavioral","reviewed","unavailable","user_imported"].includes(entry.modelTier as string))fail(`${itemPath}/modelTier`,`invalid_value`,`persisted_design_result`);if(!Array.isArray(entry.limitations))fail(`${itemPath}/limitations`,`invalid_type`,`persisted_design_result`);entry.limitations.forEach((limitation,limitationIndex)=>controlFree(limitation,`${itemPath}/limitations/${limitationIndex}`,"persisted_design_result"));});}
function validateV1RejectedCandidates(value:unknown,path:string):void{if(!Array.isArray(value))fail(path,"invalid_type","persisted_design_result");value.forEach((raw,index)=>{const itemPath=`${path}/${index}`;const rejection=object(raw,itemPath,"persisted_design_result");exactKeys(rejection,["recipeId","componentProfileIds","constraints"],itemPath,undefined,"persisted_design_result");controlFree(rejection.recipeId,`${itemPath}/recipeId`,`persisted_design_result`);if(!Array.isArray(rejection.componentProfileIds))fail(`${itemPath}/componentProfileIds`,`invalid_type`,`persisted_design_result`);rejection.componentProfileIds.forEach((profileId,profileIndex)=>controlFree(profileId,`${itemPath}/componentProfileIds/${profileIndex}`,"persisted_design_result"));validateV1Constraints(rejection.constraints,`${itemPath}/constraints`);});}
function validateV1CandidateCircuit(value: unknown, path: string): void {
  try {
    const current = migrateCircuit(value);
    if (validateCircuit(current).length > 0) fail(path, "invalid_value", "persisted_design_result");
  } catch (error) {
    if (error instanceof DesignParseErrorV2) throw error;
    fail(path, "invalid_value", "persisted_design_result");
  }
}
function validateV1Candidate(raw:unknown,index:number,result:Record<string,unknown>):void{const path=`/candidates/${index}`;const candidate=object(raw,path,"persisted_design_result");exactKeys(candidate,["schemaVersion","id","requestHash","recipeId","libraryVersion","components","derivedValues","constraints","metrics","sourcing","simulationCoverage","circuit","warnings"],path,["schemaVersion","id","requestHash","recipeId","libraryVersion","components","derivedValues","constraints","metrics","simulationCoverage","circuit","warnings"],"persisted_design_result");if(candidate.schemaVersion!==1)fail(`${path}/schemaVersion`,`invalid_value`,`persisted_design_result`);for(const key of ["id","requestHash","recipeId","libraryVersion"] as const)controlFree(candidate[key],`${path}/${key}`,"persisted_design_result");if(candidate.requestHash!==result.requestHash||candidate.libraryVersion!==result.libraryVersion)fail(path,"invalid_reference","persisted_design_result");validateV1SelectedComponents(candidate.components,`${path}/components`);validateV1DerivedValues(candidate.derivedValues,`${path}/derivedValues`);validateV1Constraints(candidate.constraints,`${path}/constraints`);validateV1Metrics(candidate.metrics,`${path}/metrics`);if(candidate.sourcing!==undefined){try{parseCandidateSourcingMetrics(candidate.sourcing);}catch{fail(`${path}/sourcing`,`invalid_value`,`persisted_design_result`);}}validateV1Coverage(candidate.simulationCoverage,`${path}/simulationCoverage`);validateV1CandidateCircuit(candidate.circuit,`${path}/circuit`);if(!Array.isArray(candidate.warnings))fail(`${path}/warnings`,`invalid_type`,`persisted_design_result`);candidate.warnings.forEach((warning,warningIndex)=>controlFree(warning,`${path}/warnings/${warningIndex}`,"persisted_design_result"));}

const V1_PIPELINE=["normalize","enumerate","solve","match","check","estimate","dedupe","pareto","rank","materialize"] as const;
const V1_COUNT_KEYS=["recipes","enumerated","solved","matched","checked","estimated","sourced","deduped","pareto","materialized","rejected"] as const;
function validateV1Legacy(result:Record<string,unknown>):void{if(!Array.isArray(result.rejections))fail("/rejections","invalid_type","persisted_design_result");result.rejections.forEach((raw,index)=>{const path=`/rejections/${index}`;const rejection=object(raw,path,"persisted_design_result");exactKeys(rejection,["stage","recipeId","optionKey","candidateId","componentProfileIds","constraints","reason"],path,["stage","recipeId","optionKey","componentProfileIds","constraints","reason"],"persisted_design_result");if(!["solve","match","check","sourcing","dedupe","pareto"].includes(rejection.stage as string))fail(`${path}/stage`,`invalid_value`,`persisted_design_result`);for(const key of ["recipeId","optionKey","reason"] as const)controlFree(rejection[key],`${path}/${key}`,"persisted_design_result");if(rejection.candidateId!==undefined)controlFree(rejection.candidateId,`${path}/candidateId`,`persisted_design_result`);if(!Array.isArray(rejection.componentProfileIds))fail(`${path}/componentProfileIds`,`invalid_type`,`persisted_design_result`);rejection.componentProfileIds.forEach((entry,entryIndex)=>controlFree(entry,`${path}/componentProfileIds/${entryIndex}`,"persisted_design_result"));validateV1Constraints(rejection.constraints,`${path}/constraints`);});const trace=object(result.trace,"/trace","persisted_design_result");exactKeys(trace,["pipeline","counts"],"/trace",undefined,"persisted_design_result");if(!Array.isArray(trace.pipeline)||trace.pipeline.length!==V1_PIPELINE.length||trace.pipeline.some((entry,index)=>entry!==V1_PIPELINE[index]))fail("/trace/pipeline","invalid_value","persisted_design_result");const counts=object(trace.counts,"/trace/counts","persisted_design_result");exactKeys(counts,V1_COUNT_KEYS,"/trace/counts",undefined,"persisted_design_result");for(const key of V1_COUNT_KEYS)if(!Number.isSafeInteger(counts[key])||(counts[key] as number)<0)fail(`/trace/counts/${key}`,"invalid_value","persisted_design_result");if(counts.rejected!==(result.rejections as unknown[]).length)fail("/trace/counts/rejected","invalid_value","persisted_design_result");}

export function parseDesignResultV1(input: unknown): PersistedDesignResultV1 {
  const result = object(boundedDetachedFrozenDesignV2Value(input,"persisted_design_result",DESIGN_RESULT_V2_MAX_CANONICAL_BYTES), "", "persisted_design_result");
  const base = ["format", "schemaVersion", "request", "requestHash", "libraryVersion", "libraryContentHash", "candidates", "rejectedCandidates", "diagnostics"];
  const hasRejections = Object.prototype.hasOwnProperty.call(result, "rejections");
  const hasTrace = Object.prototype.hasOwnProperty.call(result, "trace");
  if (hasRejections !== hasTrace) fail(hasRejections ? "/trace" : "/rejections", "invalid_type", "persisted_design_result");
  const allowed = new Set(hasRejections ? [...base, "rejections", "trace"] : base);
  for (const key of Object.keys(result)) if (!allowed.has(key)) fail(`/${escapePointer(key)}`, "unknown_key", "persisted_design_result");
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(result, key)) fail(`/${escapePointer(key)}`, "invalid_type", "persisted_design_result");
  if (result.format !== "schemagic-design-result" || result.schemaVersion !== 1) fail("/schemaVersion", "invalid_value", "persisted_design_result");
  try { assertValidDesignRequest(result.request); } catch { fail("/request", "invalid_value", "persisted_design_result"); }
  if (result.requestHash !== designRequestHash(result.request as never) || result.libraryVersion !== (result.request as { libraryVersion: string }).libraryVersion) fail("/requestHash", "invalid_reference", "persisted_design_result");
  controlFree(result.requestHash,"/requestHash","persisted_design_result");controlFree(result.libraryVersion,"/libraryVersion","persisted_design_result");controlFree(result.libraryContentHash,"/libraryContentHash","persisted_design_result");
  if (!Array.isArray(result.candidates) || !Array.isArray(result.rejectedCandidates) || !Array.isArray(result.diagnostics)) fail("/candidates", "invalid_type", "persisted_design_result");
  result.candidates.forEach((raw,index)=>validateV1Candidate(raw,index,result));validateV1RejectedCandidates(result.rejectedCandidates,"/rejectedCandidates");result.diagnostics.forEach((diagnostic,index)=>controlFree(diagnostic,`/diagnostics/${index}`,"persisted_design_result"));
  if (hasRejections) validateV1Legacy(result);
  return result as unknown as PersistedDesignResultV1;
}

export function parsePersistedDesignResult(input: unknown): ParsedPersistedDesignResult {
  const snapshot=boundedDetachedFrozenDesignV2Value(input,"persisted_design_result",DESIGN_RESULT_V2_MAX_CANONICAL_BYTES);
  const version = object(snapshot, "", "persisted_design_result").schemaVersion;
  if (version === 1) return parseDesignResultV1(snapshot);
  if (version === 2) {
    try { return parseDesignResultV2(snapshot); }
    catch (error) {
      if (error instanceof DesignParseErrorV2) throw new DesignParseErrorV2({ ...error.detail, artifact: "persisted_design_result" }, error.issues);
      throw error;
    }
  }
  return fail("/schemaVersion", "invalid_value", "persisted_design_result");
}

export function planDesignResultV1Regeneration(
  result: PersistedDesignResultV1,
  targetLibraryVersion: string,
  engineeringObjective?: ElectricalDesignObjectiveV2,
): DesignResultV1RegenerationPlan {
  const parsed = parseDesignResultV1(result);
  const migration = migrateDesignRequestV1ToV2(parsed.request, targetLibraryVersion, engineeringObjective);
  if (migration.status !== "migrated") return migration;
  return {
    status: "regeneration_required",
    reason: "v1_result_is_lossy",
    requestMigration: migration,
    diagnostics: ["legacy_v1_rejections_are_lossy", "legacy_v1_sourcing_rejection_requires_regeneration", "legacy_v1_rank_requires_regeneration"],
  };
}
