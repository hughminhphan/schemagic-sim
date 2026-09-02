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
import { validateCommercialDataBoundary, validateFactsAgainstSpec } from "./validation";
import { validateMountedGeometry } from "./v3-validation";
import type { DesignProfileV33 } from "./v33-types";
import { validateProfileSemanticsV33 } from "./v33-validation";
import {
  POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V35,
  V35_BOUND_TYPED_FACT_IDS,
  V35_PART_CLASS_IDS,
  V35_PART_CLASS_SPECS,
  type V35PartClassId,
} from "./v35-specs";
import { FACTS_SCHEMA_VERSION_V35, type DesignProfileV35 } from "./v35-types";

type JsonRecord = Record<string, unknown>;

const PROFILE_KEYS = ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"] as const;
const PART_KEYS = ["manufacturerId", "manufacturerPartNumber"] as const;
const COMMON_KEYS = ["packageName", "boardArea", "maximumHeight"] as const;
const PRIMARY_EVIDENCE_KINDS = new Set<ProfileEvidenceRef["kind"]>([
  "manufacturer_datasheet",
  "manufacturer_product_page",
  "independent_measurement",
]);

const COMMON_V35_SPEC = {
  operatingRanges: {},
  facts: {
    packageName: { kind: "text", requiredForAdmission: true },
    boardArea: { kind: "quantity", unit: "m2", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    maximumHeight: { kind: "quantity", unit: "m", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
  },
} as const satisfies PartClassSpec;

/**
 * A bound-typed field is only meaningful next to the observation it bounds.
 * `bound` must never contradict `observation`: a declared minimum cannot exceed
 * the nominal it derates from, and a declared maximum cannot fall below the
 * point value it envelopes.
 */
const BOUND_OBSERVATION_ORDERING = deepFreeze([
  { partClass: "power.power-inductor", bound: "inductanceMinimum", observation: "inductance", relation: "at_most" },
  { partClass: "power.power-inductor", bound: "coreLossMaximum", observation: "coreLoss", relation: "at_least" },
  { partClass: "shared.mlcc-capacitor", bound: "effectiveCapacitanceMinimum", observation: "nominalCapacitance", relation: "at_most" },
  { partClass: "shared.mlcc-capacitor", bound: "esrMaximum", observation: "equivalentSeriesResistance", relation: "at_least" },
  { partClass: "power.integrated-synchronous-buck-regulator", bound: "minimumOnTimeMaximum", observation: "minimumOnTime", relation: "at_least" },
  { partClass: "power.integrated-synchronous-buck-regulator", bound: "minimumOffTimeMaximum", observation: "minimumOffTime", relation: "at_least" },
] as const satisfies readonly {
  partClass: V35PartClassId;
  bound: string;
  observation: string;
  relation: "at_most" | "at_least";
}[]);

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

function factNumber(fact: unknown): number | undefined {
  if (typeof fact !== "object" || fact === null || factState(fact) === "unknown") return undefined;
  const value = (fact as JsonRecord).value;
  if (typeof value !== "object" || value === null) return undefined;
  const number = (value as JsonRecord).value;
  return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

function conditionIds(fact: unknown): string[] {
  if (typeof fact !== "object" || fact === null || !Array.isArray((fact as JsonRecord).validFor)) return [];
  return ((fact as JsonRecord).validFor as unknown[]).flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const parameterId = (entry as JsonRecord).parameterId;
    return typeof parameterId === "string" ? [parameterId] : [];
  });
}

function validateConditionOrder(fact: unknown, path: string, issues: ValidationIssue[]): void {
  const ids = conditionIds(fact);
  for (let index = 1; index < ids.length; index += 1) {
    if (compareAscii(ids[index - 1]!, ids[index]!) >= 0) {
      issues.push(issue(`${path}.validFor.${index}.parameterId`, "unstable_condition_order", "Conditions must be unique and strictly ASCII-sorted"));
    }
  }
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
    issues.push(issue(path, "legacy_geometry_must_be_unknown", "Facts 3.5.0 legacy geometry must be explicit unknown with no evidence or ranges"));
  }
}

/** The 3.4.0 inclusive excitation policy for reviewed nominal inductance, unchanged. */
function validateInductanceExcitation(facts: JsonRecord, issues: ValidationIssue[]): void {
  const policy = POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V35;
  const inductance = facts[policy.factId];
  if (typeof inductance !== "object" || inductance === null || (inductance as JsonRecord).state !== "reviewed") return;
  const ids = conditionIds(inductance);
  const count = (parameterId: string): number => ids.filter((candidate) => candidate === parameterId).length;
  for (const parameterId of policy.requiredExactlyOnce) {
    const occurrences = count(parameterId);
    if (occurrences === 0) {
      issues.push(issue("facts.inductance.validFor", "missing_required_condition", `Reviewed inductance requires exactly one ${parameterId} condition`));
    } else if (occurrences > 1) {
      issues.push(issue("facts.inductance.validFor", "duplicate_condition", `Reviewed inductance permits only one ${parameterId} condition`));
    }
  }
  for (const parameterId of policy.uniqueWhenPresent) {
    if (count(parameterId) > 1) {
      issues.push(issue("facts.inductance.validFor", "duplicate_condition", `Reviewed inductance permits only one ${parameterId} condition`));
    }
  }
  if (!policy.requiredAtLeastOneOf.some((parameterId) => count(parameterId) === 1)) {
    issues.push(issue(
      "facts.inductance.validFor",
      "missing_alternative_condition",
      `Reviewed inductance requires at least one of ${policy.requiredAtLeastOneOf.join(" or ")}`,
    ));
  }
}

/**
 * A bound-typed field is a production claim, so it is admitted only in the
 * `reviewed` state; `estimated` or `calculated` bounds would silently launder a
 * derived number into a guarantee.
 */
function validateBoundStates(partClass: V35PartClassId, facts: JsonRecord, issues: ValidationIssue[]): void {
  for (const factId of V35_BOUND_TYPED_FACT_IDS[partClass]) {
    const state = factState(facts[factId]);
    if (state !== undefined && state !== "reviewed" && state !== "unknown") {
      issues.push(issue(
        `facts.${factId}.state`,
        "bound_requires_reviewed_state",
        "A bound-typed fact is either reviewed against published guaranteed evidence or unknown",
      ));
    }
  }
}

/** A junction-to-ambient thermal resistance without a named board is not comparable. */
function validateThermalBoardQualifier(facts: JsonRecord, issues: ValidationIssue[]): void {
  const resistance = factState(facts.thermalResistanceJunctionAmbient);
  const board = factState(facts.thermalResistanceJunctionAmbientBoard);
  if (resistance === "reviewed" && board !== "reviewed") {
    issues.push(issue(
      "facts.thermalResistanceJunctionAmbientBoard.state",
      "missing_board_qualifier",
      "A reviewed junction-to-ambient thermal resistance requires a reviewed board qualifier (jedec_2s2p or declared)",
    ));
  }
  if (board === "reviewed" && resistance !== "reviewed") {
    issues.push(issue(
      "facts.thermalResistanceJunctionAmbientBoard.state",
      "orphan_board_qualifier",
      "A board qualifier is only meaningful beside a reviewed junction-to-ambient thermal resistance",
    ));
  }
}

function validateBoundOrdering(partClass: V35PartClassId, facts: JsonRecord, issues: ValidationIssue[]): void {
  for (const entry of BOUND_OBSERVATION_ORDERING) {
    if (entry.partClass !== partClass) continue;
    const bound = factNumber(facts[entry.bound]);
    const observation = factNumber(facts[entry.observation]);
    if (bound === undefined || observation === undefined) continue;
    if (entry.relation === "at_most" ? bound > observation : bound < observation) {
      issues.push(issue(
        `facts.${entry.bound}.value`,
        "bound_contradicts_observation",
        `${entry.bound} must be ${entry.relation === "at_most" ? "at most" : "at least"} the reviewed ${entry.observation}`,
      ));
    }
  }
}

/** Deterministic semantics for the additive bound-typed facts 3.5.0 contract. */
export function validateProfileSemanticsV35(profile: DesignProfileV35): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const partClass = profile.partClass as V35PartClassId;
  const spec = V35_PART_CLASS_SPECS[partClass];
  if (!spec) return issues;
  const facts = profile.facts as unknown as JsonRecord;
  for (const factId of Object.keys(spec.facts)) validateConditionOrder(facts[factId], `facts.${factId}`, issues);
  validateBoundStates(partClass, facts, issues);
  validateBoundOrdering(partClass, facts, issues);
  if (partClass === "power.power-inductor") validateInductanceExcitation(facts, issues);
  if (partClass === "power.integrated-synchronous-buck-regulator") {
    // Every 3.3.0 role, pairing, and ordering rule for this class carries forward unchanged.
    issues.push(...validateProfileSemanticsV33(profile as unknown as DesignProfileV33));
    validateThermalBoardQualifier(facts, issues);
  }
  return issues;
}

/** Closed profile-envelope validation for the additive bound-typed facts schema 3.5.0. */
export function validateDesignProfileV35(input: unknown, registry?: ManufacturerRegistryV1): ValidationIssue[] {
  const capture = captured(input);
  if (capture.failure) return [capture.failure];
  const snapshot = capture.value;
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(snapshot)];
  const profile = record(snapshot, PROFILE_KEYS, "", issues);
  if (!profile) return issues;
  if (profile.format !== DESIGN_PROFILE_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${DESIGN_PROFILE_FORMAT}`));
  if (profile.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V35) issues.push(issue("factsSchemaVersion", "invalid_facts_version", `Must equal ${FACTS_SCHEMA_VERSION_V35}`));
  const known = (V35_PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass);
  if (!known) {
    issues.push(issue("partClass", "invalid_part_class", `Facts 3.5.0 is limited to ${V35_PART_CLASS_IDS.join(", ")}`));
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
    issues.push(...validateFactsAgainstSpec(common, COMMON_V35_SPEC, manufacturer)
      .filter((entry) => entry.code !== "commercial_boundary_violation")
      .map((entry) => ({ ...entry, path: entry.path === "facts" ? "commonFacts" : entry.path.replace(/^facts\./, "commonFacts.") })));
    validateLegacyGeometryUnknown(common.boardArea, "commonFacts.boardArea", issues);
    validateLegacyGeometryUnknown(common.maximumHeight, "commonFacts.maximumHeight", issues);
  }

  if (known) {
    const spec = V35_PART_CLASS_SPECS[profile.partClass as V35PartClassId];
    const facts = record(profile.facts, [...Object.keys(spec.facts), "mountedGeometry"], "facts", issues);
    if (facts) {
      const coreFacts = Object.fromEntries(Object.keys(spec.facts).map((key) => [key, facts[key]]));
      issues.push(...validateFactsAgainstSpec(coreFacts, spec, manufacturer).filter((entry) => entry.code !== "commercial_boundary_violation"));
      validateMountedGeometry(facts.mountedGeometry, manufacturer, issues);
      issues.push(...validateProfileSemanticsV35(snapshot as DesignProfileV35));
    }
  }
  return issues;
}

export function assertValidDesignProfileV35(input: unknown, registry?: ManufacturerRegistryV1): asserts input is DesignProfileV35 {
  const first = validateDesignProfileV35(input, registry)[0];
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
}

export function parseDesignProfileV35(input: unknown, registry?: ManufacturerRegistryV1): DesignProfileV35 {
  const capture = captured(input);
  if (capture.failure) throw new Error(`${capture.failure.path || "profile"} [${capture.failure.code}]: ${capture.failure.message}`);
  const snapshot = capture.value;
  const first = validateDesignProfileV35(snapshot, registry).find((entry) => registry !== undefined || entry.code !== "unknown_manufacturer");
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
  deepFreeze(snapshot);
  return snapshot as DesignProfileV35;
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

/** Admission keeps every required predecessor fact reviewed; bound-typed fields stay optional. */
export function validateProfileAdmissionRulesV35(profile: DesignProfileV35): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (profile.commonFacts.packageName.state !== "reviewed") {
    issues.push(issue("commonFacts.packageName.state", "not_reviewed", "Package name must be reviewed for admission"));
  }
  const facts = profile.facts as unknown as Record<string, ProfileFact<unknown>>;
  for (const [factId, spec] of Object.entries(V35_PART_CLASS_SPECS[profile.partClass as V35PartClassId].facts)) {
    const state = facts[factId]?.state;
    if (spec.requiredForAdmission && state !== "reviewed") {
      issues.push(issue(`facts.${factId}.state`, "not_reviewed", "Required facts 3.5.0 fact must be reviewed"));
    }
  }
  for (const { path, evidence } of allEvidence(profile)) {
    if (!PRIMARY_EVIDENCE_KINDS.has(evidence.kind)) {
      issues.push(issue(`${path}.kind`, "non_primary_review_evidence", "Admission requires manufacturer evidence or independent measurement"));
    }
  }
  return issues;
}

export function canonicalDesignProfileV35(profile: DesignProfileV35): string {
  return canonicalJson(profile);
}

export function designProfileContentHashV35(profile: DesignProfileV35): `sha256:${string}` {
  return contentHash(profile);
}
