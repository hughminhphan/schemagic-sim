import { containsUnsafeDesignDisplayCharactersV2 } from "@opencircuit/design-schema";
import { isManufacturerId } from "@opencircuit/sourcing-schema";
import { canonicalJson, compareAscii, contentHash, deepFreeze } from "./canonical";
import type { PartClassSpec } from "./specs";
import {
  DESIGN_PROFILE_FORMAT,
  DESIGN_PROFILE_SCHEMA_VERSION,
  type ManufacturerRegistryEntryV1,
  type ManufacturerRegistryV1,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileUnit,
  type ValidationIssue,
} from "./types";
import { assertMountedGeometryFactsV2 } from "./v2-geometry";
import type { MountedGeometryFactsV2 } from "./v2-types";
import {
  validateCommercialDataBoundary,
  validateFactsAgainstSpec,
  validateProfileEvidenceListV2,
} from "./validation";
import {
  FACTS_SCHEMA_VERSION_V3,
  MOSFET_ON_RESISTANCE_TEMPERATURE_PARAMETERS_V3,
  TVS_MATCHED_CONDITION_PARAMETERS_V3,
  type DesignProfileV3,
} from "./v3-types";
import {
  V3_PART_CLASS_IDS,
  V3_PART_CLASS_SPECS,
  type V3PartClassId,
} from "./v3-specs";
import { V31_PART_CLASS_IDS, V31_PART_CLASS_SPECS } from "./v31-specs";
import {
  FACTS_SCHEMA_VERSION_V31,
  type DesignProfileV31,
} from "./v31-types";

type JsonRecord = Record<string, unknown>;

const PROFILE_KEYS = ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"] as const;
const PART_KEYS = ["manufacturerId", "manufacturerPartNumber"] as const;
const COMMON_KEYS = ["packageName", "boardArea", "maximumHeight"] as const;
const FACT_KEYS = ["value", "state", "evidence", "validFor", "explanation"] as const;
const MOUNTED_KEYS = ["boardArea", "maximumHeight"] as const;
const BOARD_PROJECTION_KEYS = ["area", "basis", "calculation", "sourceDimensions"] as const;
const HEIGHT_PROJECTION_KEYS = ["height", "basis"] as const;
const DIMENSION_KEYS = ["axis", "dimensionId", "multiplier", "maximum", "evidence"] as const;
const QUANTITY_KEYS = ["value", "unit", "displayUnit"] as const;
const PRIMARY_EVIDENCE_KINDS = new Set<ProfileEvidenceRef["kind"]>([
  "manufacturer_datasheet",
  "manufacturer_product_page",
  "independent_measurement",
]);

const COMMON_V3_SPEC = {
  operatingRanges: {},
  facts: {
    packageName: { kind: "text", requiredForAdmission: true },
    boardArea: { kind: "quantity", unit: "m2", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    maximumHeight: { kind: "quantity", unit: "m", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
  },
} as const satisfies PartClassSpec;

class SnapshotFailure extends Error {
  constructor(readonly path: string) { super(path); }
}

function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

function snapshotDataOnly(input: unknown): unknown {
  const active = new Set<object>();
  const visit = (value: unknown, path: string): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new SnapshotFailure(path);
      return value;
    }
    if (typeof value !== "object" || active.has(value)) throw new SnapshotFailure(path);
    active.add(value);
    let descriptors: PropertyDescriptorMap;
    let prototype: object | null;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
      prototype = Object.getPrototypeOf(value);
    } catch {
      throw new SnapshotFailure(path);
    }
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
    const result: JsonRecord = {};
    for (const key of keys as string[]) {
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true || descriptor.value === undefined) throw new SnapshotFailure(path ? `${path}.${key}` : key);
      result[key] = visit(descriptor.value, path ? `${path}.${key}` : key);
    }
    active.delete(value);
    return result;
  };
  return visit(input, "");
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

function text(value: unknown, path: string, issues: ValidationIssue[]): value is string {
  if (typeof value !== "string" || value.trim() === "" || containsUnsafeDesignDisplayCharactersV2(value)) {
    issues.push(issue(path, "invalid_string", "Must be nonblank and control-free"));
    return false;
  }
  return true;
}

function quantity(value: unknown, path: string, unit: ProfileUnit, issues: ValidationIssue[]): void {
  const parsed = record(value, QUANTITY_KEYS, path, issues);
  if (!parsed) return;
  if (parsed.unit !== unit) issues.push(issue(`${path}.unit`, "unit_mismatch", `Must use canonical unit ${unit}`));
  if (typeof parsed.value !== "number" || !Number.isFinite(parsed.value) || Object.is(parsed.value, -0) || parsed.value <= 0) {
    issues.push(issue(`${path}.value`, "invalid_quantity", "Must be finite and positive"));
  }
  text(parsed.displayUnit, `${path}.displayUnit`, issues);
}

function remapCommonIssue(entry: ValidationIssue): ValidationIssue {
  return { ...entry, path: entry.path === "facts" ? "commonFacts" : entry.path.replace(/^facts\./, "commonFacts.") };
}

function validateLegacyGeometryUnknown(value: unknown, path: string, issues: ValidationIssue[]): void {
  const fact = typeof value === "object" && value !== null ? value as JsonRecord : undefined;
  if (!fact || fact.state !== "unknown" || fact.value !== null || !Array.isArray(fact.evidence) || fact.evidence.length !== 0 || !Array.isArray(fact.validFor) || fact.validFor.length !== 0) {
    issues.push(issue(path, "legacy_geometry_must_be_unknown", "Facts-V3 legacy geometry must be explicit unknown with no evidence or ranges"));
  }
}

function validateGeometryFactShell(value: unknown, path: string, issues: ValidationIssue[]): JsonRecord | undefined {
  const fact = record(value, FACT_KEYS, path, issues);
  if (!fact) return undefined;
  text(fact.explanation, `${path}.explanation`, issues);
  if (!Array.isArray(fact.validFor)) issues.push(issue(`${path}.validFor`, "invalid_ranges", "Must be an array"));
  return fact;
}

/** Shared mounted-geometry boundary for additive facts versions. */
export function validateMountedGeometry(
  value: unknown,
  manufacturer: ManufacturerRegistryEntryV1 | undefined,
  issues: ValidationIssue[],
): void {
  const path = "facts.mountedGeometry";
  const mounted = record(value, MOUNTED_KEYS, path, issues);
  if (!mounted) return;
  const board = validateGeometryFactShell(mounted.boardArea, `${path}.boardArea`, issues);
  if (board) {
    issues.push(...validateProfileEvidenceListV2(board.evidence, `${path}.boardArea.evidence`, manufacturer, true));
    const projection = record(board.value, BOARD_PROJECTION_KEYS, `${path}.boardArea.value`, issues);
    if (projection) {
      quantity(projection.area, `${path}.boardArea.value.area`, "m2", issues);
      if (!Array.isArray(projection.sourceDimensions)) issues.push(issue(`${path}.boardArea.value.sourceDimensions`, "invalid_array", "Must be an array"));
      else projection.sourceDimensions.forEach((entry, index) => {
        const termPath = `${path}.boardArea.value.sourceDimensions.${index}`;
        const term = record(entry, DIMENSION_KEYS, termPath, issues);
        if (!term) return;
        if (term.axis !== "x" && term.axis !== "y") issues.push(issue(`${termPath}.axis`, "invalid_axis", "Must equal x or y"));
        text(term.dimensionId, `${termPath}.dimensionId`, issues);
        if (!Number.isSafeInteger(term.multiplier) || (term.multiplier as number) <= 0) issues.push(issue(`${termPath}.multiplier`, "invalid_multiplier", "Must be a positive safe integer"));
        quantity(term.maximum, `${termPath}.maximum`, "m", issues);
        issues.push(...validateProfileEvidenceListV2(term.evidence, `${termPath}.evidence`, manufacturer, true));
        if (
          projection.basis === "manufacturer_recommended_land_pattern_bounding_box"
          && Array.isArray(term.evidence)
          && term.evidence.some((item) => typeof item !== "object" || item === null || !["manufacturer_datasheet", "manufacturer_product_page"].includes(String((item as JsonRecord).kind)))
        ) {
          issues.push(issue(`${termPath}.evidence`, "geometry_evidence_basis", "Manufacturer land dimensions require manufacturer evidence"));
        }
        if (
          projection.basis === "reviewed_assembly_footprint_bounding_box"
          && Array.isArray(term.evidence)
          && term.evidence.some((item) => typeof item !== "object" || item === null || (item as JsonRecord).kind !== "independent_measurement")
        ) {
          issues.push(issue(`${termPath}.evidence`, "geometry_evidence_basis", "Reviewed assembly dimensions require independent measurement"));
        }
      });
    }
  }
  const height = validateGeometryFactShell(mounted.maximumHeight, `${path}.maximumHeight`, issues);
  if (height) {
    issues.push(...validateProfileEvidenceListV2(height.evidence, `${path}.maximumHeight.evidence`, manufacturer, true));
    const projection = record(height.value, HEIGHT_PROJECTION_KEYS, `${path}.maximumHeight.value`, issues);
    if (projection) {
      quantity(projection.height, `${path}.maximumHeight.value.height`, "m", issues);
      if (
        projection.basis === "manufacturer_package_maximum_in_surface_mount_orientation"
        && Array.isArray(height.evidence)
        && height.evidence.some((item) => typeof item !== "object" || item === null || !["manufacturer_datasheet", "manufacturer_product_page"].includes(String((item as JsonRecord).kind)))
      ) {
        issues.push(issue(`${path}.maximumHeight.evidence`, "geometry_evidence_basis", "Manufacturer package height requires manufacturer evidence"));
      }
      if (
        projection.basis === "reviewed_assembly_envelope_maximum"
        && Array.isArray(height.evidence)
        && height.evidence.some((item) => typeof item !== "object" || item === null || (item as JsonRecord).kind !== "independent_measurement")
      ) {
        issues.push(issue(`${path}.maximumHeight.evidence`, "geometry_evidence_basis", "Reviewed assembly height requires independent measurement"));
      }
    }
  }
  try {
    assertMountedGeometryFactsV2(value as MountedGeometryFactsV2["mountedGeometry"]);
  } catch (error) {
    issues.push(issue(path, "invalid_mounted_geometry", error instanceof Error ? error.message : "Invalid mounted geometry"));
  }
}

function captured(input: unknown): { value?: unknown; failure?: ValidationIssue } {
  try {
    return { value: snapshotDataOnly(input) };
  } catch (error) {
    return {
      failure: issue(
        error instanceof SnapshotFailure ? error.path : "",
        "invalid_data_boundary",
        "Input must be finite own enumerable data without accessors, exotic prototypes, sparse arrays, or cycles",
      ),
    };
  }
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

function validateExactConditions(fact: unknown, expected: readonly string[], path: string, issues: ValidationIssue[]): void {
  const ids = conditionIds(fact);
  if (!ids || ids.length !== expected.length || ids.some((id, index) => id !== expected[index])) {
    issues.push(issue(`${path}.validFor`, "condition_set_mismatch", `Conditions must equal ${expected.join(", ")} in canonical order`));
  }
}

function factNumber(fact: unknown): number | undefined {
  if (typeof fact !== "object" || fact === null || (fact as JsonRecord).state === "unknown") return undefined;
  const value = (fact as JsonRecord).value;
  if (typeof value !== "object" || value === null) return undefined;
  const number = (value as JsonRecord).value;
  return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

function validateOrderedPair(facts: JsonRecord, lower: string, upper: string, path: string, issues: ValidationIssue[]): void {
  const low = factNumber(facts[lower]);
  const high = factNumber(facts[upper]);
  if (low !== undefined && high !== undefined && low > high) issues.push(issue(path, "inconsistent_fact_order", `${lower} must not exceed ${upper}`));
}

function sameConditions(left: unknown, right: unknown): boolean {
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  try {
    return canonicalJson((left as JsonRecord).validFor) === canonicalJson((right as JsonRecord).validFor);
  } catch {
    return false;
  }
}

function evidenceFromFact(fact: unknown): ProfileEvidenceRef[] {
  if (typeof fact !== "object" || fact === null || !Array.isArray((fact as JsonRecord).evidence)) return [];
  const evidence = (fact as JsonRecord).evidence as unknown[];
  return evidence.filter((entry): entry is ProfileEvidenceRef => typeof entry === "object" && entry !== null);
}

function primaryHashes(fact: unknown): Set<string> {
  return new Set(evidenceFromFact(fact)
    .filter((entry) => PRIMARY_EVIDENCE_KINDS.has(entry.kind) && typeof entry.contentHash === "string")
    .map((entry) => entry.contentHash as string));
}

function validateSharedTvsSource(facts: JsonRecord, issues: ValidationIssue[]): void {
  const clamp = primaryHashes(facts.clampingVoltage);
  const pulse = primaryHashes(facts.pulseCurrent);
  const waveform = primaryHashes(facts.pulseWaveform);
  const shared = [...clamp].some((hash) => pulse.has(hash) && waveform.has(hash));
  if (!shared) {
    issues.push(issue(
      "facts.pulseWaveform.evidence",
      "missing_shared_primary_source",
      "Clamping voltage, pulse current, and pulse waveform must share a primary evidence content hash",
    ));
  }
}

/** Deterministic V3 semantic checks beyond the reusable structural fact codec. */
export function validateProfileSemanticsV3(profile: DesignProfileV3): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const facts = profile.facts as unknown as JsonRecord;
  for (const factId of Object.keys(V3_PART_CLASS_SPECS[profile.partClass].facts)) {
    validateConditionOrder(facts[factId], `facts.${factId}`, issues);
  }
  if (profile.partClass === "shared.n-channel-power-mosfet") {
    const onResistanceIds = conditionIds(facts.onResistance) ?? [];
    const temperatures = onResistanceIds.filter((id) => (MOSFET_ON_RESISTANCE_TEMPERATURE_PARAMETERS_V3 as readonly string[]).includes(id));
    const expected = [...onResistanceIds].sort(compareAscii);
    if (
      temperatures.length !== 1
      || !onResistanceIds.includes("drainCurrent")
      || !onResistanceIds.includes("gateVoltage")
      || onResistanceIds.length !== 3
      || onResistanceIds.some((id, index) => id !== expected[index])
    ) {
      issues.push(issue(
        "facts.onResistance.validFor",
        "invalid_on_resistance_conditions",
        "On-resistance requires drainCurrent, gateVoltage, and exactly one ambientTemperature, caseTemperature, or junctionTemperature condition in canonical order",
      ));
    }
    validateExactConditions(facts.pulsedDrainCurrent, ["dutyCycle", "pulseDuration"], "facts.pulsedDrainCurrent", issues);
    validateOrderedPair(facts, "continuousDrainCurrent", "pulsedDrainCurrent", "facts.continuousDrainCurrent", issues);
  } else {
    validateExactConditions(facts.clampingVoltage, TVS_MATCHED_CONDITION_PARAMETERS_V3, "facts.clampingVoltage", issues);
    validateExactConditions(facts.pulseCurrent, TVS_MATCHED_CONDITION_PARAMETERS_V3, "facts.pulseCurrent", issues);
    if (!sameConditions(facts.clampingVoltage, facts.pulseCurrent)) {
      issues.push(issue("facts.pulseCurrent.validFor", "condition_group_mismatch", "Clamping voltage and pulse current require byte-identical conditions"));
    }
    validateSharedTvsSource(facts, issues);
    validateOrderedPair(facts, "standOffVoltage", "breakdownVoltageMinimum", "facts.standOffVoltage", issues);
    validateOrderedPair(facts, "breakdownVoltageMinimum", "breakdownVoltageMaximum", "facts.breakdownVoltageMinimum", issues);
    const behavior = typeof facts.clampingBehavior === "object" && facts.clampingBehavior !== null
      ? (facts.clampingBehavior as JsonRecord).value
      : undefined;
    if (behavior === "avalanche") validateOrderedPair(facts, "breakdownVoltageMaximum", "clampingVoltage", "facts.breakdownVoltageMaximum", issues);
    const energyState = typeof facts.pulseEnergy === "object" && facts.pulseEnergy !== null
      ? (facts.pulseEnergy as JsonRecord).state
      : undefined;
    if (energyState === "calculated") {
      issues.push(issue("facts.pulseEnergy.state", "derived_pulse_energy_forbidden", "V3 does not derive TVS pulse energy"));
    }
  }
  return issues;
}

/** Closed profile-envelope validation for the two explicitly selected facts-V3 classes. */
export function validateDesignProfileV3(input: unknown, registry?: ManufacturerRegistryV1): ValidationIssue[] {
  const capture = captured(input);
  if (capture.failure) return [capture.failure];
  const snapshot = capture.value;
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(snapshot)];
  const profile = record(snapshot, PROFILE_KEYS, "", issues);
  if (!profile) return issues;
  if (profile.format !== DESIGN_PROFILE_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${DESIGN_PROFILE_FORMAT}`));
  if (profile.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V3) issues.push(issue("factsSchemaVersion", "invalid_facts_version", `Must equal ${FACTS_SCHEMA_VERSION_V3}`));
  if (!(V3_PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) issues.push(issue("partClass", "invalid_part_class", "Facts-V3 is limited to the selected MOSFET and supply-TVS classes"));
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
    issues.push(...validateFactsAgainstSpec(common, COMMON_V3_SPEC, manufacturer)
      .filter((entry) => entry.code !== "commercial_boundary_violation")
      .map(remapCommonIssue));
    validateLegacyGeometryUnknown(common.boardArea, "commonFacts.boardArea", issues);
    validateLegacyGeometryUnknown(common.maximumHeight, "commonFacts.maximumHeight", issues);
  }
  if ((V3_PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) {
    const partClass = profile.partClass as V3PartClassId;
    const spec = V3_PART_CLASS_SPECS[partClass];
    const facts = record(profile.facts, [...Object.keys(spec.facts), "mountedGeometry"], "facts", issues);
    if (facts) {
      const coreFacts = Object.fromEntries(Object.keys(spec.facts).map((key) => [key, facts[key]]));
      issues.push(...validateFactsAgainstSpec(coreFacts, spec, manufacturer).filter((entry) => entry.code !== "commercial_boundary_violation"));
      validateMountedGeometry(facts.mountedGeometry, manufacturer, issues);
      issues.push(...validateProfileSemanticsV3(snapshot as DesignProfileV3));
    }
  }
  return issues;
}

export function assertValidDesignProfileV3(input: unknown, registry?: ManufacturerRegistryV1): asserts input is DesignProfileV3 {
  const first = validateDesignProfileV3(input, registry)[0];
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
}

export function parseDesignProfileV3(input: unknown, registry?: ManufacturerRegistryV1): DesignProfileV3 {
  const capture = captured(input);
  if (capture.failure) throw new Error(`${capture.failure.path || "profile"} [${capture.failure.code}]: ${capture.failure.message}`);
  const snapshot = capture.value;
  const first = validateDesignProfileV3(snapshot, registry).find((entry) => registry !== undefined || entry.code !== "unknown_manufacturer");
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
  deepFreeze(snapshot);
  return snapshot as DesignProfileV3;
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

/** Admission rules stay separate from structural validity and never upgrade weaker fact states. */
export function validateProfileAdmissionRulesV3(profile: DesignProfileV3): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (profile.commonFacts.packageName.state !== "reviewed") {
    issues.push(issue("commonFacts.packageName.state", "not_reviewed", "Package name must be reviewed for admission"));
  }
  const facts = profile.facts as unknown as Record<string, ProfileFact<unknown>>;
  const specs = V3_PART_CLASS_SPECS[profile.partClass].facts;
  for (const [factId, spec] of Object.entries(specs)) {
    const state = facts[factId]?.state;
    if (profile.partClass === "motor.supply-tvs-diode" && factId === "pulseEnergy") {
      if (state !== "reviewed" && state !== "unknown") {
        issues.push(issue("facts.pulseEnergy.state", "invalid_pulse_energy_state", "Pulse energy must be reviewed source data or explicit unknown for admission"));
      }
    } else if (spec.requiredForAdmission && state !== "reviewed") {
      issues.push(issue(`facts.${factId}.state`, "not_reviewed", "Required facts-V3 class fact must be reviewed for admission"));
    }
  }
  for (const { path, evidence } of allEvidence(profile)) {
    if (!PRIMARY_EVIDENCE_KINDS.has(evidence.kind)) {
      issues.push(issue(`${path}.kind`, "non_primary_review_evidence", "Admission requires manufacturer evidence or independent measurement"));
    }
  }
  return issues;
}

export function canonicalDesignProfileV3(profile: DesignProfileV3): string {
  return canonicalJson(profile);
}

export function designProfileContentHashV3(profile: DesignProfileV3): `sha256:${string}` {
  return contentHash(profile);
}

function factState(fact: unknown): unknown {
  return typeof fact === "object" && fact !== null ? (fact as JsonRecord).state : undefined;
}

function factText(fact: unknown): unknown {
  return typeof fact === "object" && fact !== null ? (fact as JsonRecord).value : undefined;
}

function validateExactUnknown(fact: unknown, path: string, issues: ValidationIssue[]): void {
  if (
    typeof fact !== "object"
    || fact === null
    || (fact as JsonRecord).state !== "unknown"
    || (fact as JsonRecord).value !== null
    || !Array.isArray((fact as JsonRecord).evidence)
    || ((fact as JsonRecord).evidence as unknown[]).length !== 0
    || !Array.isArray((fact as JsonRecord).validFor)
    || ((fact as JsonRecord).validFor as unknown[]).length !== 0
  ) {
    issues.push(issue(path, "inactive_branch_must_be_unknown", "Inactive architecture facts must be exact unknowns without evidence or conditions"));
  }
}

function validateQuantityRolePair(
  quantityFact: unknown,
  roleFact: unknown,
  quantityPath: string,
  rolePath: string,
  issues: ValidationIssue[],
): void {
  const state = factState(quantityFact);
  if (state === "unknown") validateExactUnknown(roleFact, rolePath, issues);
  else if (state === "reviewed" && factState(roleFact) !== "reviewed") {
    issues.push(issue(rolePath, "timing_role_mismatch", `${quantityPath} reviewed evidence requires a reviewed evidence role`));
  }
}

/** Deterministic architecture semantics for the gate-driver-only facts 3.1.0 contract. */
export function validateProfileSemanticsV31(profile: DesignProfileV31): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const facts = profile.facts as unknown as JsonRecord;
  for (const factId of Object.keys(V31_PART_CLASS_SPECS[profile.partClass].facts)) {
    validateConditionOrder(facts[factId], `facts.${factId}`, issues);
  }
  validateOrderedPair(facts, "bridgeVoltageOperatingMinimum", "bridgeVoltageOperatingMaximum", "facts.bridgeVoltageOperatingMinimum", issues);
  validateOrderedPair(facts, "bridgeVoltageOperatingMaximum", "bridgeVoltageAbsoluteMaximum", "facts.bridgeVoltageOperatingMaximum", issues);
  validateQuantityRolePair(facts.pwmMaximum, facts.pwmMaximumRole, "facts.pwmMaximum", "facts.pwmMaximumRole", issues);
  validateQuantityRolePair(facts.minimumPulseWidth, facts.minimumPulseWidthRole, "facts.minimumPulseWidth", "facts.minimumPulseWidthRole", issues);

  const biasSource = factText(facts.driverBiasSource);
  if (biasSource === "external_supply") {
    validateExactUnknown(facts.driverBiasOutputMinimum, "facts.driverBiasOutputMinimum", issues);
    validateExactUnknown(facts.driverBiasOutputMaximum, "facts.driverBiasOutputMaximum", issues);
    validateOrderedPair(facts, "driverBiasInputMinimum", "driverBiasInputMaximum", "facts.driverBiasInputMinimum", issues);
  } else if (biasSource === "internal_regulator") {
    validateExactUnknown(facts.driverBiasInputMinimum, "facts.driverBiasInputMinimum", issues);
    validateExactUnknown(facts.driverBiasInputMaximum, "facts.driverBiasInputMaximum", issues);
    validateOrderedPair(facts, "driverBiasOutputMinimum", "driverBiasOutputMaximum", "facts.driverBiasOutputMinimum", issues);
  }

  if (factText(facts.currentSenseInterface) === "none") {
    validateExactUnknown(facts.senseMaximumVoltage, "facts.senseMaximumVoltage", issues);
  }
  return issues;
}

/** Closed profile-envelope validation for gate-driver facts schema 3.1.0. */
export function validateDesignProfileV31(input: unknown, registry?: ManufacturerRegistryV1): ValidationIssue[] {
  const capture = captured(input);
  if (capture.failure) return [capture.failure];
  const snapshot = capture.value;
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(snapshot)];
  const profile = record(snapshot, PROFILE_KEYS, "", issues);
  if (!profile) return issues;
  if (profile.format !== DESIGN_PROFILE_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${DESIGN_PROFILE_FORMAT}`));
  if (profile.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V31) issues.push(issue("factsSchemaVersion", "invalid_facts_version", `Must equal ${FACTS_SCHEMA_VERSION_V31}`));
  if (!(V31_PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) issues.push(issue("partClass", "invalid_part_class", "Facts 3.1.0 is limited to the selected full-bridge gate-driver class"));
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
    issues.push(...validateFactsAgainstSpec(common, COMMON_V3_SPEC, manufacturer)
      .filter((entry) => entry.code !== "commercial_boundary_violation")
      .map(remapCommonIssue));
    validateLegacyGeometryUnknown(common.boardArea, "commonFacts.boardArea", issues);
    validateLegacyGeometryUnknown(common.maximumHeight, "commonFacts.maximumHeight", issues);
  }
  if ((V31_PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) {
    const spec = V31_PART_CLASS_SPECS["motor.full-bridge-gate-driver"];
    const facts = record(profile.facts, [...Object.keys(spec.facts), "mountedGeometry"], "facts", issues);
    if (facts) {
      const coreFacts = Object.fromEntries(Object.keys(spec.facts).map((key) => [key, facts[key]]));
      issues.push(...validateFactsAgainstSpec(coreFacts, spec, manufacturer).filter((entry) => entry.code !== "commercial_boundary_violation"));
      validateMountedGeometry(facts.mountedGeometry, manufacturer, issues);
      issues.push(...validateProfileSemanticsV31(snapshot as DesignProfileV31));
    }
  }
  return issues;
}

export function assertValidDesignProfileV31(input: unknown, registry?: ManufacturerRegistryV1): asserts input is DesignProfileV31 {
  const first = validateDesignProfileV31(input, registry)[0];
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
}

export function parseDesignProfileV31(input: unknown, registry?: ManufacturerRegistryV1): DesignProfileV31 {
  const capture = captured(input);
  if (capture.failure) throw new Error(`${capture.failure.path || "profile"} [${capture.failure.code}]: ${capture.failure.message}`);
  const snapshot = capture.value;
  const first = validateDesignProfileV31(snapshot, registry).find((entry) => registry !== undefined || entry.code !== "unknown_manufacturer");
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
  deepFreeze(snapshot);
  return snapshot as DesignProfileV31;
}

function requireReviewed(facts: Record<string, ProfileFact<unknown>>, field: string, issues: ValidationIssue[]): void {
  if (factState(facts[field]) !== "reviewed") issues.push(issue(`facts.${field}.state`, "not_reviewed", "Required facts 3.1.0 gate-driver fact must be reviewed"));
}

function requireReviewedAlternative(
  facts: Record<string, ProfileFact<unknown>>,
  left: string,
  right: string,
  issues: ValidationIssue[],
): void {
  if (factState(facts[left]) === "reviewed" || factState(facts[right]) === "reviewed") return;
  issues.push(issue(`facts.${left}.state`, "missing_capability_group", `At least one of ${left} or ${right} must be reviewed`));
  issues.push(issue(`facts.${right}.state`, "missing_capability_group", `At least one of ${left} or ${right} must be reviewed`));
}

/** Admission keeps architecture alternatives explicit and never upgrades unknown values. */
export function validateProfileAdmissionRulesV31(profile: DesignProfileV31): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (profile.commonFacts.packageName.state !== "reviewed") {
    issues.push(issue("commonFacts.packageName.state", "not_reviewed", "Package name must be reviewed for admission"));
  }
  const facts = profile.facts as unknown as Record<string, ProfileFact<unknown>>;
  const specs = V31_PART_CLASS_SPECS[profile.partClass].facts;
  for (const [factId, spec] of Object.entries(specs)) {
    const state = factState(facts[factId]);
    if (spec.requiredForAdmission) requireReviewed(facts, factId, issues);
    else if (state !== "reviewed" && state !== "unknown") {
      issues.push(issue(`facts.${factId}.state`, "invalid_optional_state", "Optional facts 3.1.0 electrical evidence must be reviewed or explicit unknown"));
    }
  }
  const biasSource = factText(facts.driverBiasSource);
  if (biasSource === "external_supply") {
    requireReviewed(facts, "driverBiasInputMinimum", issues);
    requireReviewed(facts, "driverBiasInputMaximum", issues);
  } else if (biasSource === "internal_regulator") {
    requireReviewed(facts, "driverBiasOutputMinimum", issues);
    requireReviewed(facts, "driverBiasOutputMaximum", issues);
  }
  requireReviewedAlternative(facts, "pwmMaximum", "minimumPulseWidth", issues);
  requireReviewedAlternative(facts, "sourceCurrent", "gatePullupResistance", issues);
  requireReviewedAlternative(facts, "sinkCurrent", "gatePulldownResistance", issues);
  if (factText(facts.deadTimeControl) === "fixed") requireReviewed(facts, "deadTime", issues);
  for (const { path, evidence } of allEvidence(profile)) {
    if (!PRIMARY_EVIDENCE_KINDS.has(evidence.kind)) {
      issues.push(issue(`${path}.kind`, "non_primary_review_evidence", "Admission requires manufacturer evidence or independent measurement"));
    }
  }
  return issues;
}

export function canonicalDesignProfileV31(profile: DesignProfileV31): string {
  return canonicalJson(profile);
}

export function designProfileContentHashV31(profile: DesignProfileV31): `sha256:${string}` {
  return contentHash(profile);
}
