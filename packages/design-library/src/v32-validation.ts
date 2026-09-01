import { isManufacturerId } from "@opencircuit/sourcing-schema";
import { canonicalJson, compareAscii, contentHash, deepFreeze } from "./canonical";
import { DescriptorSafeJsonSnapshotError, descriptorSafeJsonSnapshot } from "./data-snapshot";
import type { PartClassSpec } from "./specs";
import {
  DESIGN_PROFILE_FORMAT,
  DESIGN_PROFILE_SCHEMA_VERSION,
  type ManufacturerRegistryEntryV1,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ValidationIssue,
} from "./types";
import {
  validateCommercialDataBoundary,
  validateFactsAgainstSpec,
} from "./validation";
import { validateMountedGeometry } from "./v3-validation";
import {
  V32_PART_CLASS_IDS,
  V32_PART_CLASS_SPECS,
} from "./v32-specs";
import {
  FACTS_SCHEMA_VERSION_V32,
  type CapacitanceRequirementV32,
  type DesignProfileV32,
} from "./v32-types";

type JsonRecord = Record<string, unknown>;

const PROFILE_KEYS = ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"] as const;
const PART_KEYS = ["manufacturerId", "manufacturerPartNumber"] as const;
const COMMON_KEYS = ["packageName", "boardArea", "maximumHeight"] as const;
const PRIMARY_EVIDENCE_KINDS = new Set<ProfileEvidenceRef["kind"]>([
  "manufacturer_datasheet",
  "manufacturer_product_page",
  "independent_measurement",
]);

const COMMON_V32_SPEC = {
  operatingRanges: {},
  facts: {
    packageName: { kind: "text", requiredForAdmission: true },
    boardArea: { kind: "quantity", unit: "m2", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    maximumHeight: { kind: "quantity", unit: "m", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
  },
} as const satisfies PartClassSpec;

const QUANTITY_ROLE_PAIRS = [
  ["continuousOutputCurrent", "continuousOutputCurrentRole"],
  ["peakOutputCurrent", "peakOutputCurrentRole"],
  ["pwmMaximum", "pwmMaximumRole"],
  ["minimumInputPulseWidth", "minimumInputPulseWidthRole"],
  ["pathResistance", "pathResistanceRole"],
  ["switchingTransitionTime", "switchingTransitionTimeRole"],
  ["activeSupplyCurrent", "activeSupplyCurrentRole"],
] as const;

const KNOWN_CAPACITANCE_REQUIREMENTS = new Set<CapacitanceRequirementV32>([
  "required_minimum",
  "recommended_value",
  "typical_observation",
]);

function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

function record(value: unknown, keys: readonly string[], path: string, issues: ValidationIssue[]): JsonRecord | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    issues.push(issue(path, "invalid_object", "Must be a plain object"));
    return undefined;
  }
  const object = value as JsonRecord;
  for (const key of Object.keys(object)) {
    if (!keys.includes(key)) issues.push(issue(path ? `${path}.${key}` : key, "unknown_key", "Unknown key in closed persisted contract"));
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) issues.push(issue(path ? `${path}.${key}` : key, "missing_key", "Required key is missing"));
  }
  return object;
}

function validateLegacyGeometryUnknown(value: unknown, path: string, issues: ValidationIssue[]): void {
  const fact = typeof value === "object" && value !== null ? value as JsonRecord : undefined;
  if (
    !fact
    || fact.state !== "unknown"
    || fact.value !== null
    || !Array.isArray(fact.evidence)
    || fact.evidence.length !== 0
    || !Array.isArray(fact.validFor)
    || fact.validFor.length !== 0
  ) {
    issues.push(issue(path, "legacy_geometry_must_be_unknown", "Facts 3.2.0 legacy geometry must be explicit unknown with no evidence or ranges"));
  }
}

function captured(input: unknown): { value?: unknown; failure?: ValidationIssue } {
  try {
    return { value: descriptorSafeJsonSnapshot(input) };
  } catch (error) {
    return {
      failure: issue(
        error instanceof DescriptorSafeJsonSnapshotError ? error.path : "",
        "invalid_data_boundary",
        "Input must be finite own enumerable data without accessors, exotic prototypes, sparse arrays, or cycles",
      ),
    };
  }
}

function factState(fact: unknown): unknown {
  return typeof fact === "object" && fact !== null ? (fact as JsonRecord).state : undefined;
}

function factText(fact: unknown): unknown {
  return typeof fact === "object" && fact !== null ? (fact as JsonRecord).value : undefined;
}

function factNumber(fact: unknown): number | undefined {
  if (typeof fact !== "object" || fact === null || factState(fact) === "unknown") return undefined;
  const value = (fact as JsonRecord).value;
  if (typeof value !== "object" || value === null) return undefined;
  const number = (value as JsonRecord).value;
  return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

function conditionIds(fact: unknown): string[] | undefined {
  if (typeof fact !== "object" || fact === null) return undefined;
  const validFor = (fact as JsonRecord).validFor;
  if (!Array.isArray(validFor)) return undefined;
  const ids = validFor.map((entry) => typeof entry === "object" && entry !== null ? (entry as JsonRecord).parameterId : undefined);
  return ids.every((id): id is string => typeof id === "string") ? ids : undefined;
}

function validateConditionOrder(fact: unknown, path: string, issues: ValidationIssue[]): void {
  const ids = conditionIds(fact);
  if (!ids) return;
  for (let index = 1; index < ids.length; index += 1) {
    if (compareAscii(ids[index - 1]!, ids[index]!) >= 0) {
      issues.push(issue(`${path}.validFor.${index}.parameterId`, "unstable_condition_order", "Conditions must be unique and strictly ASCII-sorted"));
    }
  }
}

function validateExactUnknown(fact: unknown, path: string, issues: ValidationIssue[]): void {
  if (
    typeof fact !== "object"
    || fact === null
    || factState(fact) !== "unknown"
    || (fact as JsonRecord).value !== null
    || !Array.isArray((fact as JsonRecord).evidence)
    || ((fact as JsonRecord).evidence as unknown[]).length !== 0
    || !Array.isArray((fact as JsonRecord).validFor)
    || ((fact as JsonRecord).validFor as unknown[]).length !== 0
  ) {
    issues.push(issue(path, "paired_unknown_mismatch", "An unavailable paired quantity or role must be an exact unknown without evidence or conditions"));
  }
}

function canonicalArray(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  try {
    return canonicalJson(value);
  } catch {
    return undefined;
  }
}

function canonicalSet(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  try {
    return value.map((entry) => canonicalJson(entry)).sort(compareAscii);
  } catch {
    return undefined;
  }
}

function sameCanonicalArray(left: unknown, right: unknown): boolean {
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  const leftBytes = canonicalArray((left as JsonRecord).validFor);
  const rightBytes = canonicalArray((right as JsonRecord).validFor);
  return leftBytes !== undefined && leftBytes === rightBytes;
}

function sameCanonicalEvidenceSet(left: unknown, right: unknown): boolean {
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  const leftSet = canonicalSet((left as JsonRecord).evidence);
  const rightSet = canonicalSet((right as JsonRecord).evidence);
  return leftSet !== undefined
    && rightSet !== undefined
    && leftSet.length === rightSet.length
    && leftSet.every((entry, index) => entry === rightSet[index]);
}

function validateReviewedPair(
  quantityFact: unknown,
  roleFact: unknown,
  quantityPath: string,
  rolePath: string,
  issues: ValidationIssue[],
): void {
  if (factState(roleFact) !== "reviewed") {
    issues.push(issue(`${rolePath}.state`, "evidence_role_mismatch", `${quantityPath} reviewed evidence requires a reviewed evidence role`));
    return;
  }
  if (!sameCanonicalArray(quantityFact, roleFact)) {
    issues.push(issue(`${rolePath}.validFor`, "paired_condition_mismatch", "Paired quantity and role conditions must be byte-identical canonical arrays"));
  }
  if (!sameCanonicalEvidenceSet(quantityFact, roleFact)) {
    issues.push(issue(`${rolePath}.evidence`, "paired_evidence_mismatch", "Paired quantity and role evidence sets must be identical"));
  }
}

function validateQuantityRolePair(
  facts: JsonRecord,
  quantityId: string,
  roleId: string,
  issues: ValidationIssue[],
): void {
  const quantityFact = facts[quantityId];
  const roleFact = facts[roleId];
  if (factState(quantityFact) === "unknown") {
    validateExactUnknown(roleFact, `facts.${roleId}`, issues);
  } else if (factState(quantityFact) === "reviewed") {
    validateReviewedPair(quantityFact, roleFact, `facts.${quantityId}`, `facts.${roleId}`, issues);
  }
}

function validateCapacitancePair(
  facts: JsonRecord,
  quantityId: string,
  requirementId: string,
  issues: ValidationIssue[],
): void {
  const quantityFact = facts[quantityId];
  const requirementFact = facts[requirementId];
  const requirement = factText(requirementFact) as CapacitanceRequirementV32 | null;
  if (factState(requirementFact) === "unknown") {
    validateExactUnknown(quantityFact, `facts.${quantityId}`, issues);
    return;
  }
  if (requirement === "application_dependent" || requirement === "not_specified") {
    validateExactUnknown(quantityFact, `facts.${quantityId}`, issues);
    return;
  }
  if (requirement !== null && KNOWN_CAPACITANCE_REQUIREMENTS.has(requirement)) {
    if (factState(quantityFact) !== "reviewed") {
      issues.push(issue(`facts.${quantityId}.state`, "capacitance_requirement_mismatch", `${requirementId}=${requirement} requires a reviewed capacitance quantity`));
      return;
    }
    validateReviewedPair(requirementFact, quantityFact, `facts.${requirementId}`, `facts.${quantityId}`, issues);
  }
}

function validateSupplyOrdering(facts: JsonRecord, issues: ValidationIssue[]): void {
  const minimum = factNumber(facts.supplyVoltageOperatingMinimum);
  const maximum = factNumber(facts.supplyVoltageOperatingMaximum);
  const absolute = factNumber(facts.supplyVoltageAbsoluteMaximum);
  if (minimum !== undefined && maximum !== undefined && minimum >= maximum) {
    issues.push(issue("facts.supplyVoltageOperatingMinimum", "inconsistent_fact_order", "supplyVoltageOperatingMinimum must be strictly less than supplyVoltageOperatingMaximum"));
  }
  if (maximum !== undefined && absolute !== undefined && maximum > absolute) {
    issues.push(issue("facts.supplyVoltageOperatingMaximum", "inconsistent_fact_order", "supplyVoltageOperatingMaximum must not exceed supplyVoltageAbsoluteMaximum"));
  }
}

/** Deterministic semantics for the integrated-H-bridge-only facts 3.2.0 contract. */
export function validateProfileSemanticsV32(profile: DesignProfileV32): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const facts = profile.facts as unknown as JsonRecord;
  for (const factId of Object.keys(V32_PART_CLASS_SPECS[profile.partClass].facts)) {
    validateConditionOrder(facts[factId], `facts.${factId}`, issues);
  }
  for (const [quantityId, roleId] of QUANTITY_ROLE_PAIRS) {
    validateQuantityRolePair(facts, quantityId, roleId, issues);
  }
  validateCapacitancePair(facts, "localSupplyDecouplingCapacitance", "localSupplyDecouplingRequirement", issues);
  validateCapacitancePair(facts, "bulkCapacitance", "bulkCapacitanceRequirement", issues);
  validateSupplyOrdering(facts, issues);
  return issues;
}

/** Closed profile-envelope validation for integrated H-bridge facts schema 3.2.0. */
export function validateDesignProfileV32(input: unknown, registry?: ManufacturerRegistryV1): ValidationIssue[] {
  const capture = captured(input);
  if (capture.failure) return [capture.failure];
  const snapshot = capture.value;
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(snapshot)];
  const profile = record(snapshot, PROFILE_KEYS, "", issues);
  if (!profile) return issues;
  if (profile.format !== DESIGN_PROFILE_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${DESIGN_PROFILE_FORMAT}`));
  if (profile.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V32) issues.push(issue("factsSchemaVersion", "invalid_facts_version", `Must equal ${FACTS_SCHEMA_VERSION_V32}`));
  if (!(V32_PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) {
    issues.push(issue("partClass", "invalid_part_class", "Facts 3.2.0 is limited to the integrated H-bridge class"));
  }

  const part = record(profile.part, PART_KEYS, "part", issues);
  let manufacturer: ManufacturerRegistryEntryV1 | undefined;
  if (part) {
    if (!isManufacturerId(part.manufacturerId)) issues.push(issue("part.manufacturerId", "invalid_manufacturer_id", "Must be a stable lowercase manufacturer registry key"));
    if (typeof part.manufacturerPartNumber !== "string" || part.manufacturerPartNumber.length === 0 || part.manufacturerPartNumber !== part.manufacturerPartNumber.trim()) {
      issues.push(issue("part.manufacturerPartNumber", "invalid_mpn", "Exact MPN must be nonempty without surrounding whitespace"));
    }
    manufacturer = registry?.manufacturers.find((entry) => entry.manufacturerId === part.manufacturerId);
    if (registry && !manufacturer) issues.push(issue("part.manufacturerId", "unregistered_manufacturer", "Profile manufacturer is absent from the pinned registry"));
  }

  const common = record(profile.commonFacts, COMMON_KEYS, "commonFacts", issues);
  if (common) {
    issues.push(...validateFactsAgainstSpec(common, COMMON_V32_SPEC, manufacturer)
      .filter((entry) => entry.code !== "commercial_boundary_violation")
      .map((entry) => ({ ...entry, path: entry.path === "facts" ? "commonFacts" : entry.path.replace(/^facts\./, "commonFacts.") })));
    validateLegacyGeometryUnknown(common.boardArea, "commonFacts.boardArea", issues);
    validateLegacyGeometryUnknown(common.maximumHeight, "commonFacts.maximumHeight", issues);
  }

  if ((V32_PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) {
    const spec = V32_PART_CLASS_SPECS["motor.integrated-h-bridge"];
    const facts = record(profile.facts, [...Object.keys(spec.facts), "mountedGeometry"], "facts", issues);
    if (facts) {
      const coreFacts = Object.fromEntries(Object.keys(spec.facts).map((key) => [key, facts[key]]));
      issues.push(...validateFactsAgainstSpec(coreFacts, spec, manufacturer).filter((entry) => entry.code !== "commercial_boundary_violation"));
      validateMountedGeometry(facts.mountedGeometry, manufacturer, issues);
      issues.push(...validateProfileSemanticsV32(snapshot as DesignProfileV32));
    }
  }
  return issues;
}

export function assertValidDesignProfileV32(input: unknown, registry?: ManufacturerRegistryV1): asserts input is DesignProfileV32 {
  const first = validateDesignProfileV32(input, registry)[0];
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
}

export function parseDesignProfileV32(input: unknown, registry?: ManufacturerRegistryV1): DesignProfileV32 {
  const capture = captured(input);
  if (capture.failure) throw new Error(`${capture.failure.path || "profile"} [${capture.failure.code}]: ${capture.failure.message}`);
  const snapshot = capture.value;
  const first = validateDesignProfileV32(snapshot, registry).find((entry) => registry !== undefined || entry.code !== "unknown_manufacturer");
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
  deepFreeze(snapshot);
  return snapshot as DesignProfileV32;
}

function allEvidence(value: unknown, path = ""): Array<{ path: string; evidence: ProfileEvidenceRef }> {
  const found: Array<{ path: string; evidence: ProfileEvidenceRef }> = [];
  const visit = (entry: unknown, currentPath: string): void => {
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => visit(item, `${currentPath}.${index}`));
      return;
    }
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

function requireReviewed(facts: Record<string, ProfileFact<unknown>>, field: string, issues: ValidationIssue[]): void {
  if (factState(facts[field]) !== "reviewed") {
    issues.push(issue(`facts.${field}.state`, "not_reviewed", "Required facts 3.2.0 integrated H-bridge fact must be reviewed"));
  }
}

/** Admission preserves explicit unknown optional facts and requires one reviewed output-current capability. */
export function validateProfileAdmissionRulesV32(profile: DesignProfileV32): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (profile.commonFacts.packageName.state !== "reviewed") {
    issues.push(issue("commonFacts.packageName.state", "not_reviewed", "Package name must be reviewed for admission"));
  }
  const facts = profile.facts as unknown as Record<string, ProfileFact<unknown>>;
  const specs = V32_PART_CLASS_SPECS[profile.partClass].facts;
  for (const [factId, spec] of Object.entries(specs)) {
    const state = factState(facts[factId]);
    if (spec.requiredForAdmission) requireReviewed(facts, factId, issues);
    else if (state !== "reviewed" && state !== "unknown") {
      issues.push(issue(`facts.${factId}.state`, "invalid_optional_state", "Optional facts 3.2.0 electrical evidence must be reviewed or explicit unknown"));
    }
  }
  if (factState(facts.continuousOutputCurrent) !== "reviewed" && factState(facts.peakOutputCurrent) !== "reviewed") {
    issues.push(issue("facts.continuousOutputCurrent.state", "missing_capability_group", "At least one of continuousOutputCurrent or peakOutputCurrent must be reviewed"));
    issues.push(issue("facts.peakOutputCurrent.state", "missing_capability_group", "At least one of continuousOutputCurrent or peakOutputCurrent must be reviewed"));
  }
  for (const { path, evidence } of allEvidence(profile)) {
    if (!PRIMARY_EVIDENCE_KINDS.has(evidence.kind)) {
      issues.push(issue(`${path}.kind`, "non_primary_review_evidence", "Admission requires manufacturer evidence or independent measurement"));
    }
  }
  return issues;
}

export function canonicalDesignProfileV32(profile: DesignProfileV32): string {
  return canonicalJson(profile);
}

export function designProfileContentHashV32(profile: DesignProfileV32): `sha256:${string}` {
  return contentHash(profile);
}
