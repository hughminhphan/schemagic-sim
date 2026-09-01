import { containsUnsafeDesignDisplayCharactersV2 } from "@opencircuit/design-schema";
import { isManufacturerId } from "@opencircuit/sourcing-schema";
import { canonicalJson, compareAscii, contentHash, deepFreeze } from "./canonical";
import { PART_CLASS_SPECS } from "./specs";
import {
  DESIGN_PROFILE_FORMAT,
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION,
  PART_CLASS_IDS,
  type DesignProfileV1,
  type ManufacturerRegistryEntryV1,
  type ManufacturerRegistryV1,
  type PartClassId,
  type ProfileEvidenceRef,
  type ProfileUnit,
  type ValidationIssue,
} from "./types";
import {
  POWER_CONDITION_PARAMETER_SPECS_V2,
  POWER_EXTERNAL_CLAIM_SPECS_V2,
  POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2,
  POWER_EXTERNAL_REQUIRED_CONDITIONS_V2,
  POWER_INTEGRATED_CLAIM_SPECS_V2,
  POWER_INTEGRATED_REQUIRED_CONDITIONS_V2,
  type ClaimConditionParameterSpecV2,
  type QuantityClaimSpecV2,
} from "./v2-claims";
import { assertMountedGeometryFactsV2 } from "./v2-geometry";
import {
  FACTS_SCHEMA_VERSION_V2,
  type DesignProfileEnvelope,
  type DesignProfileWithFactsV2,
  type MountedGeometryFactsV2,
  type PowerExternalFetSynchronousBuckFactsV2,
  type PowerIntegratedSynchronousBuckFactsV2,
} from "./v2-types";
import {
  validateCommercialDataBoundary,
  validateDesignProfile,
  validateFactsForCodec,
  validateProfileEvidenceListV2,
} from "./validation";
import { FACTS_SCHEMA_VERSION_V3 } from "./v3-types";
import { FACTS_SCHEMA_VERSION_V31 } from "./v31-types";
import { validateDesignProfileV3, validateDesignProfileV31 } from "./v3-validation";
import { FACTS_SCHEMA_VERSION_V32 } from "./v32-types";
import { validateDesignProfileV32 } from "./v32-validation";
import { FACTS_SCHEMA_VERSION_V33 } from "./v33-types";
import { validateDesignProfileV33 } from "./v33-validation";
import { FACTS_SCHEMA_VERSION_V34 } from "./v34-types";
import { validateDesignProfileV34 } from "./v34-validation";

type JsonRecord = Record<string, unknown>;

const PROFILE_KEYS = ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"] as const;
const PART_KEYS = ["manufacturerId", "manufacturerPartNumber"] as const;
const COMMON_KEYS = ["packageName", "boardArea", "maximumHeight"] as const;
const FACT_KEYS = ["value", "state", "evidence", "validFor", "explanation"] as const;
const QUANTITY_KEYS = ["value", "unit", "displayUnit"] as const;
const MOUNTED_KEYS = ["boardArea", "maximumHeight"] as const;
const BOARD_PROJECTION_KEYS = ["area", "basis", "calculation", "sourceDimensions"] as const;
const HEIGHT_PROJECTION_KEYS = ["height", "basis"] as const;
const DIMENSION_KEYS = ["axis", "dimensionId", "multiplier", "maximum", "evidence"] as const;
const CLAIM_KEYS = ["claimKind", "basis", "value", "state", "evidence", "validFor", "explanation"] as const;
const OPTION_KEYS = ["settingId", "setting", "minimum", "typical", "maximum"] as const;
const CONDITION_QUANTITY_KEYS = ["parameterId", "kind", "minimum", "maximum", "evidence"] as const;
const CONDITION_TOKEN_KEYS = ["parameterId", "kind", "value", "evidence"] as const;
const STATES = ["reviewed", "calculated", "estimated", "unknown"] as const;
const TOKEN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

class SnapshotFailure extends Error {
  constructor(readonly path: string) { super(path); }
}

function snapshotDataOnly(input: unknown): unknown {
  const active = new Set<object>();
  const visit = (value: unknown, path: string): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new SnapshotFailure(path);
      return value;
    }
    if (typeof value !== "object") throw new SnapshotFailure(path);
    if (active.has(value)) throw new SnapshotFailure(path);
    active.add(value);
    let descriptors: PropertyDescriptorMap;
    let prototype: object | null;
    try { descriptors = Object.getOwnPropertyDescriptors(value); prototype = Object.getPrototypeOf(value); }
    catch { throw new SnapshotFailure(path); }
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some((key) => typeof key !== "string")) throw new SnapshotFailure(path);
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) throw new SnapshotFailure(path);
      const lengthDescriptor = descriptors.length;
      if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) throw new SnapshotFailure(path);
      const length = lengthDescriptor.value as number;
      const result: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) throw new SnapshotFailure(`${path}.${index}`);
        result.push(visit(descriptor.value, `${path}.${index}`));
      }
      if (keys.some((key) => key !== "length" && (!/^(?:0|[1-9][0-9]*)$/.test(key as string) || Number(key) >= length))) throw new SnapshotFailure(path);
      active.delete(value);
      return result;
    }
    if (prototype !== Object.prototype && prototype !== null) throw new SnapshotFailure(path);
    const result = Object.create(null) as JsonRecord;
    for (const key of (keys as string[]).sort(compareAscii)) {
      const descriptor = descriptors[key]!;
      if (!("value" in descriptor) || descriptor.enumerable !== true) throw new SnapshotFailure(path ? `${path}.${key}` : key);
      result[key] = visit(descriptor.value, path ? `${path}.${key}` : key);
    }
    active.delete(value);
    return result;
  };
  return visit(input, "");
}

function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

function record(value: unknown, keys: readonly string[], path: string, issues: ValidationIssue[]): JsonRecord | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    issues.push(issue(path, "invalid_object", "Must be a plain object"));
    return undefined;
  }
  const object = value as JsonRecord;
  for (const key of Object.keys(object)) if (!keys.includes(key)) issues.push(issue(path ? `${path}.${key}` : key, "unknown_key", "Unknown key in closed persisted contract"));
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(object, key)) issues.push(issue(path ? `${path}.${key}` : key, "missing_key", "Required key is missing"));
  return object;
}

function text(value: unknown, path: string, issues: ValidationIssue[], token = false): value is string {
  if (typeof value !== "string" || value.trim() === "" || containsUnsafeDesignDisplayCharactersV2(value) || (token && !TOKEN.test(value))) {
    issues.push(issue(path, "invalid_string", token ? "Must use the closed electrical-token grammar" : "Must be nonblank and control-free"));
    return false;
  }
  return true;
}

function quantity(
  value: unknown,
  path: string,
  unit: ProfileUnit,
  domain: "positive" | "nonnegative",
  issues: ValidationIssue[],
): void {
  const parsed = record(value, QUANTITY_KEYS, path, issues);
  if (!parsed) return;
  if (parsed.unit !== unit) issues.push(issue(`${path}.unit`, "unit_mismatch", `Must use canonical unit ${unit}`));
  const number = parsed.value;
  if (
    typeof number !== "number"
    || !Number.isFinite(number)
    || Object.is(number, -0)
    || (domain === "positive" ? number <= 0 : number < 0)
  ) issues.push(issue(`${path}.value`, "invalid_quantity", `Must be finite ${domain}`));
  text(parsed.displayUnit, `${path}.displayUnit`, issues);
}

function evidence(
  value: unknown,
  path: string,
  manufacturer: ManufacturerRegistryEntryV1 | undefined,
  requireNonEmpty: boolean,
  issues: ValidationIssue[],
): void {
  issues.push(...validateProfileEvidenceListV2(value, path, manufacturer, requireNonEmpty));
}

function factShell(value: unknown, path: string, issues: ValidationIssue[]): JsonRecord | undefined {
  const fact = record(value, FACT_KEYS, path, issues);
  if (!fact) return undefined;
  if (!(STATES as readonly unknown[]).includes(fact.state)) issues.push(issue(`${path}.state`, "invalid_fact_state", "Unsupported fact state"));
  text(fact.explanation, `${path}.explanation`, issues);
  if (!Array.isArray(fact.validFor)) issues.push(issue(`${path}.validFor`, "invalid_ranges", "Must be an array"));
  return fact;
}

function unknownCommonFact(value: unknown, path: string, issues: ValidationIssue[]): void {
  const fact = factShell(value, path, issues);
  if (!fact) return;
  if (fact.state !== "unknown" || fact.value !== null || !Array.isArray(fact.evidence) || fact.evidence.length !== 0 || !Array.isArray(fact.validFor) || fact.validFor.length !== 0) {
    issues.push(issue(path, "legacy_geometry_must_be_unknown", "Facts-V2 legacy geometry must be explicit unknown with no evidence or ranges"));
  }
}

function packageNameFact(value: unknown, path: string, manufacturer: ManufacturerRegistryEntryV1 | undefined, issues: ValidationIssue[]): void {
  const fact = factShell(value, path, issues);
  if (!fact) return;
  const unknown = fact.state === "unknown";
  if (unknown) {
    if (fact.value !== null || !Array.isArray(fact.evidence) || fact.evidence.length !== 0 || !Array.isArray(fact.validFor) || fact.validFor.length !== 0) issues.push(issue(path, "invalid_unknown_fact", "Unknown fact must have null value, no evidence, and no ranges"));
    return;
  }
  text(fact.value, `${path}.value`, issues);
  evidence(fact.evidence, `${path}.evidence`, manufacturer, true, issues);
  if (!Array.isArray(fact.validFor) || fact.validFor.length !== 0) issues.push(issue(`${path}.validFor`, "unexpected_range", "Package name is condition-free"));
}

function condition(
  value: unknown,
  path: string,
  manufacturer: ManufacturerRegistryEntryV1 | undefined,
  issues: ValidationIssue[],
): string | undefined {
  const kind = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord).kind : undefined;
  const parsed = record(value, kind === "token_equals" ? CONDITION_TOKEN_KEYS : CONDITION_QUANTITY_KEYS, path, issues);
  if (!parsed || !text(parsed.parameterId, `${path}.parameterId`, issues, true)) return undefined;
  const spec = (POWER_CONDITION_PARAMETER_SPECS_V2 as Readonly<Record<string, ClaimConditionParameterSpecV2>>)[parsed.parameterId];
  if (!spec || parsed.kind !== spec.kind) {
    issues.push(issue(`${path}.kind`, "unknown_condition", "Condition is outside the closed Power vocabulary"));
    return parsed.parameterId;
  }
  evidence(parsed.evidence, `${path}.evidence`, manufacturer, true, issues);
  if (spec.kind === "token_equals") text(parsed.value, `${path}.value`, issues, true);
  else {
    if (parsed.minimum === null && parsed.maximum === null) issues.push(issue(path, "empty_range", "At least one condition bound is required"));
    if (parsed.minimum !== null) quantity(parsed.minimum, `${path}.minimum`, spec.unit, spec.domain, issues);
    if (parsed.maximum !== null) quantity(parsed.maximum, `${path}.maximum`, spec.unit, spec.domain, issues);
    const minimum = typeof parsed.minimum === "object" && parsed.minimum !== null ? (parsed.minimum as JsonRecord).value : undefined;
    const maximum = typeof parsed.maximum === "object" && parsed.maximum !== null ? (parsed.maximum as JsonRecord).value : undefined;
    if (typeof minimum === "number" && typeof maximum === "number" && minimum > maximum) issues.push(issue(path, "inverted_range", "Minimum cannot exceed maximum"));
  }
  return parsed.parameterId;
}

function validateClaim(
  value: unknown,
  path: string,
  spec: QuantityClaimSpecV2,
  requiredConditions: readonly string[],
  manufacturer: ManufacturerRegistryEntryV1 | undefined,
  issues: ValidationIssue[],
): JsonRecord | undefined {
  const claim = record(value, CLAIM_KEYS, path, issues);
  if (!claim) return undefined;
  if (claim.claimKind !== spec.claimKind) issues.push(issue(`${path}.claimKind`, "claim_kind_mismatch", `Must equal ${spec.claimKind}`));
  if (claim.basis !== spec.basis) issues.push(issue(`${path}.basis`, "claim_basis_mismatch", `Must equal ${spec.basis}`));
  if (!(STATES as readonly unknown[]).includes(claim.state)) issues.push(issue(`${path}.state`, "invalid_fact_state", "Unsupported claim state"));
  text(claim.explanation, `${path}.explanation`, issues);
  const unknown = claim.state === "unknown";
  if (unknown) {
    if (claim.value !== null || !Array.isArray(claim.evidence) || claim.evidence.length !== 0 || !Array.isArray(claim.validFor) || claim.validFor.length !== 0) issues.push(issue(path, "invalid_unknown_claim", "Unknown claim must have null value, no evidence, and no conditions"));
    return claim;
  }
  if (claim.value === null) issues.push(issue(`${path}.value`, "known_missing_value", "Known claim requires a value"));
  else quantity(claim.value, `${path}.value`, spec.unit, spec.domain, issues);
  evidence(claim.evidence, `${path}.evidence`, manufacturer, true, issues);
  if (!Array.isArray(claim.validFor)) issues.push(issue(`${path}.validFor`, "invalid_conditions", "Must be an array"));
  else {
    const seen = new Set<string>(); let prior = "";
    claim.validFor.forEach((entry, index) => {
      const parameterId = condition(entry, `${path}.validFor.${index}`, manufacturer, issues);
      if (parameterId === undefined) return;
      if (seen.has(parameterId)) issues.push(issue(`${path}.validFor.${index}.parameterId`, "duplicate_condition", "Condition parameter must be unique"));
      if (prior && compareAscii(prior, parameterId) >= 0) issues.push(issue(`${path}.validFor.${index}.parameterId`, "unstable_order", "Conditions must be strictly code-unit sorted"));
      seen.add(parameterId); prior = parameterId;
    });
    for (const parameterId of requiredConditions) if (!seen.has(parameterId)) issues.push(issue(`${path}.validFor`, "missing_required_condition", `Missing required condition ${parameterId}`));
  }
  return claim;
}

function factValueNumber(claim: JsonRecord | undefined): number | undefined {
  if (!claim || claim.state === "unknown" || typeof claim.value !== "object" || claim.value === null) return undefined;
  const value = (claim.value as JsonRecord).value;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sameConditions(left: JsonRecord | undefined, right: JsonRecord | undefined): boolean {
  return !!left && !!right && canonicalJson(left.validFor) === canonicalJson(right.validFor);
}

function orderedGroup(
  minimum: JsonRecord | undefined,
  typical: JsonRecord | undefined,
  maximum: JsonRecord | undefined,
  path: string,
  issues: ValidationIssue[],
): void {
  const values = [factValueNumber(minimum), factValueNumber(typical), factValueNumber(maximum)];
  if (values.every((entry) => entry !== undefined) && !(values[0]! <= values[1]! && values[1]! <= values[2]!)) issues.push(issue(path, "inconsistent_claim_order", "Minimum, typical, and maximum claims must be ordered"));
  if ((minimum?.state !== "unknown" || typical?.state !== "unknown" || maximum?.state !== "unknown") && (!sameConditions(minimum, typical) || !sameConditions(typical, maximum))) {
    issues.push(issue(path, "condition_group_mismatch", "Minimum, typical, and maximum claims require byte-identical conditions"));
  }
}

function pairGroup(lower: JsonRecord | undefined, upper: JsonRecord | undefined, path: string, issues: ValidationIssue[]): void {
  const low = factValueNumber(lower); const high = factValueNumber(upper);
  if (low !== undefined && high !== undefined && low > high) issues.push(issue(path, "inconsistent_claim_order", "Minimum claim must not exceed maximum claim"));
  if ((lower?.state !== "unknown" || upper?.state !== "unknown") && !sameConditions(lower, upper)) {
    issues.push(issue(path, "condition_group_mismatch", "Minimum and maximum claims require byte-identical conditions"));
  }
}

function validateMountedGeometry(
  value: unknown,
  path: string,
  manufacturer: ManufacturerRegistryEntryV1 | undefined,
  issues: ValidationIssue[],
): void {
  const mounted = record(value, MOUNTED_KEYS, path, issues);
  if (!mounted) return;
  const board = factShell(mounted.boardArea, `${path}.boardArea`, issues);
  if (board) {
    evidence(board.evidence, `${path}.boardArea.evidence`, manufacturer, true, issues);
    if (!Array.isArray(board.validFor) || board.validFor.length !== 0) issues.push(issue(`${path}.boardArea.validFor`, "unexpected_range", "Mounted board area is condition-free"));
    const projection = record(board.value, BOARD_PROJECTION_KEYS, `${path}.boardArea.value`, issues);
    if (projection) {
      quantity(projection.area, `${path}.boardArea.value.area`, "m2", "positive", issues);
      if (!Array.isArray(projection.sourceDimensions)) issues.push(issue(`${path}.boardArea.value.sourceDimensions`, "invalid_array", "Must be an array"));
      else projection.sourceDimensions.forEach((entry, index) => {
        const termPath = `${path}.boardArea.value.sourceDimensions.${index}`;
        const term = record(entry, DIMENSION_KEYS, termPath, issues);
        if (!term) return;
        if (term.axis !== "x" && term.axis !== "y") issues.push(issue(`${termPath}.axis`, "invalid_axis", "Must equal x or y"));
        text(term.dimensionId, `${termPath}.dimensionId`, issues, true);
        if (!Number.isSafeInteger(term.multiplier) || (term.multiplier as number) <= 0) issues.push(issue(`${termPath}.multiplier`, "invalid_multiplier", "Must be a positive safe integer"));
        quantity(term.maximum, `${termPath}.maximum`, "m", "positive", issues);
        evidence(term.evidence, `${termPath}.evidence`, manufacturer, true, issues);
        if (projection.basis === "manufacturer_recommended_land_pattern_bounding_box" && Array.isArray(term.evidence) && term.evidence.some((item) => typeof item !== "object" || item === null || !["manufacturer_datasheet", "manufacturer_product_page"].includes(String((item as JsonRecord).kind)))) issues.push(issue(`${termPath}.evidence`, "geometry_evidence_basis", "Manufacturer land dimensions require manufacturer evidence"));
        if (projection.basis === "reviewed_assembly_footprint_bounding_box" && Array.isArray(term.evidence) && term.evidence.some((item) => typeof item !== "object" || item === null || (item as JsonRecord).kind !== "independent_measurement")) issues.push(issue(`${termPath}.evidence`, "geometry_evidence_basis", "Reviewed assembly dimensions require independent measurement"));
      });
    }
  }
  const height = factShell(mounted.maximumHeight, `${path}.maximumHeight`, issues);
  if (height) {
    evidence(height.evidence, `${path}.maximumHeight.evidence`, manufacturer, true, issues);
    if (!Array.isArray(height.validFor) || height.validFor.length !== 0) issues.push(issue(`${path}.maximumHeight.validFor`, "unexpected_range", "Mounted maximum height is condition-free"));
    const projection = record(height.value, HEIGHT_PROJECTION_KEYS, `${path}.maximumHeight.value`, issues);
    if (projection) {
      quantity(projection.height, `${path}.maximumHeight.value.height`, "m", "positive", issues);
      if (projection.basis === "manufacturer_package_maximum_in_surface_mount_orientation" && Array.isArray(height.evidence) && height.evidence.some((item) => typeof item !== "object" || item === null || !["manufacturer_datasheet", "manufacturer_product_page"].includes(String((item as JsonRecord).kind)))) issues.push(issue(`${path}.maximumHeight.evidence`, "geometry_evidence_basis", "Manufacturer package height requires manufacturer evidence"));
      if (projection.basis === "reviewed_assembly_envelope_maximum" && Array.isArray(height.evidence) && height.evidence.some((item) => typeof item !== "object" || item === null || (item as JsonRecord).kind !== "independent_measurement")) issues.push(issue(`${path}.maximumHeight.evidence`, "geometry_evidence_basis", "Reviewed assembly height requires independent measurement"));
    }
  }
  try { assertMountedGeometryFactsV2(value as MountedGeometryFactsV2["mountedGeometry"]); }
  catch (error) { issues.push(issue(path, "invalid_mounted_geometry", error instanceof Error ? error.message : "Invalid mounted geometry")); }
}

function validateReviewedSetting(value: unknown, path: string, manufacturer: ManufacturerRegistryEntryV1 | undefined, issues: ValidationIssue[]): JsonRecord | undefined {
  const fact = factShell(value, path, issues);
  if (!fact) return undefined;
  if (fact.state !== "reviewed" || !text(fact.value, `${path}.value`, issues, true) || !Array.isArray(fact.validFor) || fact.validFor.length !== 0) issues.push(issue(path, "invalid_configured_setting", "Configured setting must be reviewed, token-valued, and condition-free"));
  evidence(fact.evidence, `${path}.evidence`, manufacturer, true, issues);
  return fact;
}

function validateConfiguredOptions(
  value: unknown,
  path: string,
  requiredConditions: readonly string[],
  manufacturer: ManufacturerRegistryEntryV1 | undefined,
  issues: ValidationIssue[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(issue(path, "missing_configured_options", "Configured options must be a non-empty array"));
    return;
  }
  let prior = ""; const seen = new Set<string>();
  value.forEach((entry, index) => {
    const optionPath = `${path}.${index}`;
    const option = record(entry, OPTION_KEYS, optionPath, issues);
    if (!option) return;
    const settingId = text(option.settingId, `${optionPath}.settingId`, issues, true) ? option.settingId : undefined;
    if (settingId) {
      if (seen.has(settingId)) issues.push(issue(`${optionPath}.settingId`, "duplicate_setting", "settingId must be unique"));
      if (prior && compareAscii(prior, settingId) >= 0) issues.push(issue(`${optionPath}.settingId`, "unstable_order", "Options must be strictly code-unit sorted"));
      seen.add(settingId); prior = settingId;
    }
    const setting = validateReviewedSetting(option.setting, `${optionPath}.setting`, manufacturer, issues);
    const spec = (kind: QuantityClaimSpecV2["claimKind"]): QuantityClaimSpecV2 => ({ unit: "V", claimKind: kind, basis: "production_spread", domain: "positive" });
    const minimum = validateClaim(option.minimum, `${optionPath}.minimum`, spec("guaranteed_minimum"), requiredConditions, manufacturer, issues);
    const typical = validateClaim(option.typical, `${optionPath}.typical`, spec("typical"), requiredConditions, manufacturer, issues);
    const maximum = validateClaim(option.maximum, `${optionPath}.maximum`, spec("guaranteed_maximum"), requiredConditions, manufacturer, issues);
    orderedGroup(minimum, typical, maximum, optionPath, issues);
    if (setting && Array.isArray(setting.evidence)) {
      const settingEvidence = new Set(setting.evidence.map((item) => canonicalJson(item)));
      for (const [claimId, claim] of [["minimum", minimum], ["typical", typical], ["maximum", maximum]] as const) {
        if (claim?.state === "unknown" || !Array.isArray(claim?.evidence)) continue;
        const claimEvidence = new Set(claim.evidence.map((item) => canonicalJson(item)));
        for (const item of settingEvidence) if (!claimEvidence.has(item)) issues.push(issue(`${optionPath}.${claimId}.evidence`, "missing_setting_evidence", "Configured claim evidence must include every setting-evidence ref"));
      }
    }
  });
}

function validatePowerFacts(
  value: unknown,
  partClass: "power.integrated-synchronous-buck-regulator" | "power.external-fet-synchronous-buck-controller",
  manufacturer: ManufacturerRegistryEntryV1 | undefined,
  issues: ValidationIssue[],
): void {
  const integrated = partClass === "power.integrated-synchronous-buck-regulator";
  const specs = integrated ? POWER_INTEGRATED_CLAIM_SPECS_V2 : POWER_EXTERNAL_CLAIM_SPECS_V2;
  const required = integrated ? POWER_INTEGRATED_REQUIRED_CONDITIONS_V2 : POWER_EXTERNAL_REQUIRED_CONDITIONS_V2;
  const specialKeys = integrated
    ? ["mountedGeometry", "controlEvidenceBasis"]
    : ["mountedGeometry", "controlEvidenceBasis", "currentSenseThresholdOptions", "gateDriveVoltageOptions"];
  const facts = record(value, [...Object.keys(specs), ...specialKeys], "facts", issues);
  if (!facts) return;
  validateMountedGeometry(facts.mountedGeometry, "facts.mountedGeometry", manufacturer, issues);
  packageNameFact(facts.controlEvidenceBasis, "facts.controlEvidenceBasis", manufacturer, issues);
  const claims = new Map<string, JsonRecord | undefined>();
  for (const [field, spec] of Object.entries(specs)) {
    claims.set(field, validateClaim(facts[field], `facts.${field}`, spec, (required as Readonly<Record<string, readonly string[]>>)[field]!, manufacturer, issues));
  }
  pairGroup(claims.get("inputVoltageMinimum"), claims.get("inputVoltageMaximum"), "facts.inputVoltage", issues);
  pairGroup(claims.get("outputVoltageMinimum"), claims.get("outputVoltageMaximum"), "facts.outputVoltage", issues);
  pairGroup(claims.get("switchingFrequencyMinimum"), claims.get("switchingFrequencyMaximum"), "facts.switchingFrequency", issues);
  orderedGroup(claims.get("switchingFrequencyMinimum"), claims.get("switchingFrequencyRecommended"), claims.get("switchingFrequencyMaximum"), "facts.switchingFrequency", issues);
  orderedGroup(claims.get("feedbackReferenceMinimum"), claims.get("feedbackReferenceTypical"), claims.get("feedbackReferenceMaximum"), "facts.feedbackReference", issues);
  if (integrated) orderedGroup(claims.get("currentLimitMinimum"), claims.get("currentLimitTypical"), claims.get("currentLimitMaximum"), "facts.currentLimit", issues);
  else {
    validateConfiguredOptions(facts.currentSenseThresholdOptions, "facts.currentSenseThresholdOptions", POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.currentSenseThresholdOptions, manufacturer, issues);
    validateConfiguredOptions(facts.gateDriveVoltageOptions, "facts.gateDriveVoltageOptions", POWER_EXTERNAL_CONFIGURED_SPREAD_REQUIRED_CONDITIONS_V2.gateDriveVoltageOptions, manufacturer, issues);
  }
}

function validateV2Envelope(snapshot: unknown, registry?: ManufacturerRegistryV1): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(snapshot)];
  const profile = record(snapshot, PROFILE_KEYS, "", issues);
  if (!profile) return issues;
  if (profile.format !== DESIGN_PROFILE_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${DESIGN_PROFILE_FORMAT}`));
  if (profile.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V2) issues.push(issue("factsSchemaVersion", "invalid_facts_version", `Must equal ${FACTS_SCHEMA_VERSION_V2}`));
  if (!(PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) issues.push(issue("partClass", "invalid_part_class", "Unknown manifest part-class ID"));
  const part = record(profile.part, PART_KEYS, "part", issues);
  let manufacturer: ManufacturerRegistryEntryV1 | undefined;
  if (part) {
    if (!isManufacturerId(part.manufacturerId)) issues.push(issue("part.manufacturerId", "invalid_manufacturer_id", "Must be a stable lowercase manufacturer registry key"));
    if (typeof part.manufacturerPartNumber !== "string" || part.manufacturerPartNumber.length === 0 || part.manufacturerPartNumber !== part.manufacturerPartNumber.trim()) issues.push(issue("part.manufacturerPartNumber", "invalid_mpn", "Exact MPN must be nonempty without surrounding whitespace"));
    manufacturer = registry?.manufacturers.find((entry) => entry.manufacturerId === part.manufacturerId);
    if (registry && !manufacturer) issues.push(issue("part.manufacturerId", "unregistered_manufacturer", "Profile manufacturer is absent from the pinned registry"));
  }
  const common = record(profile.commonFacts, COMMON_KEYS, "commonFacts", issues);
  if (common) {
    packageNameFact(common.packageName, "commonFacts.packageName", manufacturer, issues);
    unknownCommonFact(common.boardArea, "commonFacts.boardArea", issues);
    unknownCommonFact(common.maximumHeight, "commonFacts.maximumHeight", issues);
  }
  if ((PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) {
    const partClass = profile.partClass as PartClassId;
    if (partClass === "power.integrated-synchronous-buck-regulator" || partClass === "power.external-fet-synchronous-buck-controller") validatePowerFacts(profile.facts, partClass, manufacturer, issues);
    else {
      const facts = record(profile.facts, [...Object.keys(PART_CLASS_SPECS[partClass].facts), "mountedGeometry"], "facts", issues);
      if (facts) {
        const legacyFacts = Object.fromEntries(Object.keys(PART_CLASS_SPECS[partClass].facts).map((key) => [key, facts[key]]));
        issues.push(...validateFactsForCodec(legacyFacts, partClass, manufacturer).filter((entry) => entry.code !== "commercial_boundary_violation"));
        validateMountedGeometry(facts.mountedGeometry, "facts.mountedGeometry", manufacturer, issues);
      }
    }
  }
  return issues;
}

function captured(input: unknown): { value?: unknown; issue?: ValidationIssue } {
  try { return { value: snapshotDataOnly(input) }; }
  catch (error) { return { issue: issue(error instanceof SnapshotFailure ? error.path : "", "invalid_data_boundary", "Input must be finite own enumerable data without accessors, exotic prototypes, sparse arrays, or cycles") }; }
}

export function validateDesignProfileEnvelope(input: unknown, registry?: ManufacturerRegistryV1): ValidationIssue[] {
  const result = captured(input);
  if (result.issue) return [result.issue];
  const profile = result.value as JsonRecord;
  if (profile?.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) return [issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`)];
  if (profile?.factsSchemaVersion === FACTS_SCHEMA_VERSION) return validateDesignProfile(profile, registry);
  if (profile?.factsSchemaVersion === FACTS_SCHEMA_VERSION_V2) return validateV2Envelope(profile, registry);
  if (profile?.factsSchemaVersion === FACTS_SCHEMA_VERSION_V3) return validateDesignProfileV3(profile, registry);
  if (profile?.factsSchemaVersion === FACTS_SCHEMA_VERSION_V31) return validateDesignProfileV31(profile, registry);
  if (profile?.factsSchemaVersion === FACTS_SCHEMA_VERSION_V32) return validateDesignProfileV32(profile, registry);
  if (profile?.factsSchemaVersion === FACTS_SCHEMA_VERSION_V33) return validateDesignProfileV33(profile, registry);
  if (profile?.factsSchemaVersion === FACTS_SCHEMA_VERSION_V34) return validateDesignProfileV34(profile, registry);
  return [issue("factsSchemaVersion", "invalid_facts_version", "Unknown facts schema version")];
}

export function assertValidDesignProfileEnvelope(input: unknown, registry?: ManufacturerRegistryV1): asserts input is DesignProfileEnvelope {
  const first = validateDesignProfileEnvelope(input, registry)[0];
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
}

export function parseDesignProfileEnvelope(input: unknown, registry?: ManufacturerRegistryV1): DesignProfileEnvelope {
  const result = captured(input);
  if (result.issue) throw new Error(`${result.issue.path || "profile"} [${result.issue.code}]: ${result.issue.message}`);
  const snapshot = result.value;
  const validation = validateDesignProfileEnvelope(snapshot, registry);
  const first = registry === undefined
    ? validation.find((entry) => entry.code !== "unknown_manufacturer")
    : validation[0];
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
  deepFreeze(snapshot);
  return snapshot as DesignProfileEnvelope;
}

export function canonicalDesignProfileEnvelope(profile: DesignProfileEnvelope): string {
  return canonicalJson(profile);
}

export function designProfileEnvelopeContentHash(profile: DesignProfileEnvelope): `sha256:${string}` {
  return contentHash(profile);
}

function allEvidence(value: unknown, path = ""): Array<{ path: string; evidence: ProfileEvidenceRef }> {
  const found: Array<{ path: string; evidence: ProfileEvidenceRef }> = [];
  const visit = (entry: unknown, currentPath: string): void => {
    if (Array.isArray(entry)) { entry.forEach((item, index) => visit(item, `${currentPath}.${index}`)); return; }
    if (typeof entry !== "object" || entry === null) return;
    const object = entry as JsonRecord;
    if ("kind" in object && "sourceId" in object && "locator" in object && "licenseNote" in object) {
      found.push({ path: currentPath, evidence: entry as ProfileEvidenceRef });
      return;
    }
    for (const [key, item] of Object.entries(object)) visit(item, currentPath ? `${currentPath}.${key}` : key);
  };
  visit(value, path);
  return found;
}

export function validateProfileAdmissionRulesV2(profile: DesignProfileWithFactsV2<PartClassId, object>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (profile.commonFacts.packageName.state !== "reviewed") issues.push(issue("commonFacts.packageName.state", "not_reviewed", "Package name must be reviewed for admission"));
  for (const { path, evidence: ref } of allEvidence(profile)) if (ref.kind === "authored_derivation" || ref.kind === "synthetic_fixture") issues.push(issue(`${path}.kind`, "non_primary_review_evidence", "Admission requires manufacturer evidence or independent measurement"));
  if (profile.partClass === "power.integrated-synchronous-buck-regulator") {
    const facts = profile.facts as PowerIntegratedSynchronousBuckFactsV2;
    for (const field of Object.keys(POWER_INTEGRATED_CLAIM_SPECS_V2)) {
      const optional = field === "riseTimeMaximum" || field === "fallTimeMaximum";
      const claim = facts[field as keyof typeof POWER_INTEGRATED_CLAIM_SPECS_V2];
      if (!optional && claim.state !== "reviewed") issues.push(issue(`facts.${field}.state`, "not_reviewed", "Required Power claim must be reviewed"));
      if (optional && claim.state !== "reviewed" && claim.state !== "unknown") issues.push(issue(`facts.${field}.state`, "invalid_optional_state", "Optional claim may be reviewed or explicit unknown"));
    }
    if (facts.controlEvidenceBasis.state !== "reviewed") issues.push(issue("facts.controlEvidenceBasis.state", "not_reviewed", "Control evidence basis must be reviewed"));
  } else if (profile.partClass === "power.external-fet-synchronous-buck-controller") {
    const facts = profile.facts as PowerExternalFetSynchronousBuckFactsV2;
    const gateAlternatives = new Set([
      "gateSourceCurrentMinimum",
      "gateSinkCurrentMinimum",
      "gatePullupResistanceMaximum",
      "gatePulldownResistanceMaximum",
    ]);
    for (const field of Object.keys(POWER_EXTERNAL_CLAIM_SPECS_V2)) {
      const optional = field === "controllerLossMaximum";
      const claim = facts[field as keyof typeof POWER_EXTERNAL_CLAIM_SPECS_V2];
      if (!optional && !gateAlternatives.has(field) && claim.state !== "reviewed") issues.push(issue(`facts.${field}.state`, "not_reviewed", "Required Power claim must be reviewed"));
      if (optional && claim.state !== "reviewed" && claim.state !== "unknown") issues.push(issue(`facts.${field}.state`, "invalid_optional_state", "Optional claim may be reviewed or explicit unknown"));
      if (gateAlternatives.has(field) && claim.state !== "reviewed" && claim.state !== "unknown") issues.push(issue(`facts.${field}.state`, "invalid_gate_capability_state", "Gate capability alternatives may be reviewed or explicit unknown"));
    }
    const factStates = facts as unknown as Readonly<Record<string, { state: unknown }>>;
    const requireCapabilityGroup = (left: string, right: string): void => {
      if (factStates[left]?.state === "reviewed" || factStates[right]?.state === "reviewed") return;
      issues.push(issue(`facts.${String(left)}`, "missing_gate_capability_group", "At least one reviewed gate capability representation is required"));
      issues.push(issue(`facts.${String(right)}`, "missing_gate_capability_group", "At least one reviewed gate capability representation is required"));
    };
    requireCapabilityGroup("gateSourceCurrentMinimum", "gatePullupResistanceMaximum");
    requireCapabilityGroup("gateSinkCurrentMinimum", "gatePulldownResistanceMaximum");
    for (const [field, options] of [
      ["currentSenseThresholdOptions", facts.currentSenseThresholdOptions],
      ["gateDriveVoltageOptions", facts.gateDriveVoltageOptions],
    ] as const) {
      options.forEach((option, index) => {
        for (const claimField of ["minimum", "typical", "maximum"] as const) {
          if (option[claimField].state !== "reviewed") issues.push(issue(`facts.${field}.${index}.${claimField}.state`, "not_reviewed", "Configured production-spread claims must be reviewed for admission"));
        }
      });
    }
    if (facts.controlEvidenceBasis.state !== "reviewed") issues.push(issue("facts.controlEvidenceBasis.state", "not_reviewed", "Control evidence basis must be reviewed"));
  } else {
    const facts = profile.facts as Record<string, { state?: unknown }>;
    for (const [field, spec] of Object.entries(PART_CLASS_SPECS[profile.partClass].facts)) if (spec.requiredForAdmission && facts[field]?.state !== "reviewed") issues.push(issue(`facts.${field}.state`, "not_reviewed", "Required class fact must be reviewed"));
  }
  return issues;
}

export type AnyProfileEnvelopeV2 = DesignProfileV1 | DesignProfileWithFactsV2<PartClassId, object>;
