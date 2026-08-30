import { isManufacturerId } from "@opencircuit/sourcing-schema";
import { canonicalJson, contentHash, deepFreeze } from "./canonical";
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
import {
  POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34,
  V34_PART_CLASS_IDS,
  V34_PART_CLASS_SPECS,
} from "./v34-specs";
import { FACTS_SCHEMA_VERSION_V34, type DesignProfileV34 } from "./v34-types";

type JsonRecord = Record<string, unknown>;

const PROFILE_KEYS = ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"] as const;
const PART_KEYS = ["manufacturerId", "manufacturerPartNumber"] as const;
const COMMON_KEYS = ["packageName", "boardArea", "maximumHeight"] as const;
const PRIMARY_EVIDENCE_KINDS = new Set<ProfileEvidenceRef["kind"]>([
  "manufacturer_datasheet",
  "manufacturer_product_page",
  "independent_measurement",
]);

const COMMON_V34_SPEC = {
  operatingRanges: {},
  facts: {
    packageName: { kind: "text", requiredForAdmission: true },
    boardArea: { kind: "quantity", unit: "m2", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
    maximumHeight: { kind: "quantity", unit: "m", requiredForAdmission: false, domain: { exclusiveMinimum: 0 } },
  },
} as const satisfies PartClassSpec;

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
    issues.push(issue(path, "legacy_geometry_must_be_unknown", "Facts 3.4.0 legacy geometry must be explicit unknown with no evidence or ranges"));
  }
}

function conditionIds(fact: unknown): string[] {
  if (typeof fact !== "object" || fact === null || !Array.isArray((fact as JsonRecord).validFor)) return [];
  return ((fact as JsonRecord).validFor as unknown[]).flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const parameterId = (entry as JsonRecord).parameterId;
    return typeof parameterId === "string" ? [parameterId] : [];
  });
}

/** Applies the single code-owned inclusive excitation policy used by runtime and schema generation. */
export function validateProfileSemanticsV34(profile: DesignProfileV34): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const inductance = (profile.facts as unknown as JsonRecord)[POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34.factId];
  if (typeof inductance !== "object" || inductance === null || (inductance as JsonRecord).state !== "reviewed") return issues;
  const ids = conditionIds(inductance);
  const count = (parameterId: string): number => ids.filter((candidate) => candidate === parameterId).length;
  for (const parameterId of POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34.requiredExactlyOnce) {
    const occurrences = count(parameterId);
    if (occurrences === 0) {
      issues.push(issue("facts.inductance.validFor", "missing_required_condition", `Reviewed inductance requires exactly one ${parameterId} condition`));
    } else if (occurrences > 1) {
      issues.push(issue("facts.inductance.validFor", "duplicate_condition", `Reviewed inductance permits only one ${parameterId} condition`));
    }
  }
  for (const parameterId of POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34.uniqueWhenPresent) {
    if (count(parameterId) > 1) {
      issues.push(issue("facts.inductance.validFor", "duplicate_condition", `Reviewed inductance permits only one ${parameterId} condition`));
    }
  }
  if (!POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34.requiredAtLeastOneOf.some((parameterId) => count(parameterId) === 1)) {
    issues.push(issue(
      "facts.inductance.validFor",
      "missing_alternative_condition",
      `Reviewed inductance requires at least one of ${POWER_INDUCTOR_INDUCTANCE_CONDITION_POLICY_V34.requiredAtLeastOneOf.join(" or ")}`,
    ));
  }
  return issues;
}

/** Closed profile-envelope validation for the power-inductor-only facts schema 3.4.0. */
export function validateDesignProfileV34(input: unknown, registry?: ManufacturerRegistryV1): ValidationIssue[] {
  const capture = captured(input);
  if (capture.failure) return [capture.failure];
  const snapshot = capture.value;
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(snapshot)];
  const profile = record(snapshot, PROFILE_KEYS, "", issues);
  if (!profile) return issues;
  if (profile.format !== DESIGN_PROFILE_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${DESIGN_PROFILE_FORMAT}`));
  if (profile.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V34) issues.push(issue("factsSchemaVersion", "invalid_facts_version", `Must equal ${FACTS_SCHEMA_VERSION_V34}`));
  if (!(V34_PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) {
    issues.push(issue("partClass", "invalid_part_class", "Facts 3.4.0 is limited to the power inductor class"));
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
    issues.push(...validateFactsAgainstSpec(common, COMMON_V34_SPEC, manufacturer)
      .filter((entry) => entry.code !== "commercial_boundary_violation")
      .map((entry) => ({ ...entry, path: entry.path === "facts" ? "commonFacts" : entry.path.replace(/^facts\./, "commonFacts.") })));
    validateLegacyGeometryUnknown(common.boardArea, "commonFacts.boardArea", issues);
    validateLegacyGeometryUnknown(common.maximumHeight, "commonFacts.maximumHeight", issues);
  }

  if ((V34_PART_CLASS_IDS as readonly unknown[]).includes(profile.partClass)) {
    const spec = V34_PART_CLASS_SPECS["power.power-inductor"];
    const facts = record(profile.facts, [...Object.keys(spec.facts), "mountedGeometry"], "facts", issues);
    if (facts) {
      const coreFacts = Object.fromEntries(Object.keys(spec.facts).map((key) => [key, facts[key]]));
      issues.push(...validateFactsAgainstSpec(coreFacts, spec, manufacturer).filter((entry) => entry.code !== "commercial_boundary_violation"));
      validateMountedGeometry(facts.mountedGeometry, manufacturer, issues);
      issues.push(...validateProfileSemanticsV34(snapshot as DesignProfileV34));
    }
  }
  return issues;
}

export function assertValidDesignProfileV34(input: unknown, registry?: ManufacturerRegistryV1): asserts input is DesignProfileV34 {
  const first = validateDesignProfileV34(input, registry)[0];
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
}

export function parseDesignProfileV34(input: unknown, registry?: ManufacturerRegistryV1): DesignProfileV34 {
  const capture = captured(input);
  if (capture.failure) throw new Error(`${capture.failure.path || "profile"} [${capture.failure.code}]: ${capture.failure.message}`);
  const snapshot = capture.value;
  const first = validateDesignProfileV34(snapshot, registry).find((entry) => registry !== undefined || entry.code !== "unknown_manufacturer");
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
  deepFreeze(snapshot);
  return snapshot as DesignProfileV34;
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

/** Admission keeps every required V2-shaped fact reviewed while preserving V2 optional-state semantics. */
export function validateProfileAdmissionRulesV34(profile: DesignProfileV34): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (profile.commonFacts.packageName.state !== "reviewed") {
    issues.push(issue("commonFacts.packageName.state", "not_reviewed", "Package name must be reviewed for admission"));
  }
  const facts = profile.facts as unknown as Record<string, ProfileFact<unknown>>;
  for (const [factId, spec] of Object.entries(V34_PART_CLASS_SPECS[profile.partClass].facts)) {
    const state = facts[factId]?.state;
    if (spec.requiredForAdmission && state !== "reviewed") {
      issues.push(issue(`facts.${factId}.state`, "not_reviewed", "Required facts 3.4.0 power-inductor fact must be reviewed"));
    }
  }
  for (const { path, evidence } of allEvidence(profile)) {
    if (!PRIMARY_EVIDENCE_KINDS.has(evidence.kind)) {
      issues.push(issue(`${path}.kind`, "non_primary_review_evidence", "Admission requires manufacturer evidence or independent measurement"));
    }
  }
  return issues;
}

export function canonicalDesignProfileV34(profile: DesignProfileV34): string {
  return canonicalJson(profile);
}

export function designProfileContentHashV34(profile: DesignProfileV34): `sha256:${string}` {
  return contentHash(profile);
}
