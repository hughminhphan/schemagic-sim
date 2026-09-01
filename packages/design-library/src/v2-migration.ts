import { compareAscii, deepFreeze } from "./canonical";
import { designProfileId } from "./path";
import { PART_CLASS_SPECS } from "./specs";
import { FACTS_SCHEMA_VERSION, type ManufacturerRegistryV1, type PartClassId, type ValidationIssue } from "./types";
import { parseDesignProfile } from "./validation";
import {
  POWER_EXTERNAL_CLAIM_SPECS_V2,
  POWER_INTEGRATED_CLAIM_SPECS_V2,
} from "./v2-claims";
import {
  FACTS_SCHEMA_VERSION_V2,
  type DesignProfileFactsV1ToV2MigrationPlan,
  type DesignProfileWithFactsV2,
} from "./v2-types";
import { parseDesignProfileEnvelope, validateDesignProfileEnvelope, validateProfileAdmissionRulesV2 } from "./v2-validation";

type JsonRecord = Record<string, unknown>;

function detachedDataOnly(value: unknown, path = "", active = new Set<object>()): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path || "overrides"} [invalid_override]: Numbers must be finite`);
    return value;
  }
  if (typeof value !== "object" || active.has(value)) throw new TypeError(`${path || "overrides"} [invalid_override]: Must be acyclic JSON data`);
  active.add(value);
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  try { descriptors = Object.getOwnPropertyDescriptors(value); prototype = Object.getPrototypeOf(value); }
  catch { throw new TypeError(`${path || "overrides"} [invalid_override]: Cannot inspect override data`); }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) throw new TypeError(`${path || "overrides"} [invalid_override]: Symbol keys are forbidden`);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) throw new TypeError(`${path || "overrides"} [invalid_override]: Exotic arrays are forbidden`);
    const length = value.length;
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) throw new TypeError(`${path}/${index} [invalid_override]: Sparse arrays and accessors are forbidden`);
      result.push(detachedDataOnly(descriptor.value, `${path}/${index}`, active));
    }
    if (keys.some((key) => key !== "length" && (!/^(?:0|[1-9][0-9]*)$/.test(String(key)) || Number(key) >= length))) throw new TypeError(`${path || "overrides"} [invalid_override]: Extra array keys are forbidden`);
    active.delete(value);
    return result;
  }
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path || "overrides"} [invalid_override]: Exotic objects are forbidden`);
  const result = Object.create(null) as JsonRecord;
  for (const key of (keys as string[]).sort(compareAscii)) {
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || descriptor.enumerable !== true) throw new TypeError(`${path}/${key} [invalid_override]: Accessors and hidden fields are forbidden`);
    result[key] = detachedDataOnly(descriptor.value, `${path}/${key}`, active);
  }
  active.delete(value);
  return result;
}

function parseOverrides(value: unknown): { mountedGeometry: unknown | null; powerClaims: unknown | null } {
  const snapshot = detachedDataOnly(value);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new TypeError("overrides [invalid_override]: Must be a closed object");
  const record = snapshot as JsonRecord;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !Object.prototype.hasOwnProperty.call(record, "mountedGeometry") || !Object.prototype.hasOwnProperty.call(record, "powerClaims")) {
    throw new TypeError("overrides [invalid_override]: Exact keys mountedGeometry and powerClaims are required");
  }
  if (record.mountedGeometry !== null && (typeof record.mountedGeometry !== "object" || Array.isArray(record.mountedGeometry))) throw new TypeError("overrides/mountedGeometry [invalid_override]: Must be an object or null");
  if (record.powerClaims !== null && (typeof record.powerClaims !== "object" || Array.isArray(record.powerClaims))) throw new TypeError("overrides/powerClaims [invalid_override]: Must be an object or null");
  return { mountedGeometry: record.mountedGeometry, powerClaims: record.powerClaims };
}

function pointer(path: string): string {
  const segments = path.split(".").filter(Boolean).map((segment) => segment.replaceAll("~", "~0").replaceAll("/", "~1"));
  return `/${segments.join("/")}`;
}

function requiredPowerPaths(partClass: PartClassId): string[] {
  if (partClass === "power.integrated-synchronous-buck-regulator") {
    return [
      ...Object.keys(POWER_INTEGRATED_CLAIM_SPECS_V2).filter((field) => field !== "riseTimeMaximum" && field !== "fallTimeMaximum"),
      "controlEvidenceBasis",
    ].map((field) => `/facts/${field}`);
  }
  if (partClass === "power.external-fet-synchronous-buck-controller") {
    return [
      ...Object.keys(POWER_EXTERNAL_CLAIM_SPECS_V2).filter((field) => field !== "controllerLossMaximum"),
      "controlEvidenceBasis",
      "currentSenseThresholdOptions",
      "gateDriveVoltageOptions",
    ].map((field) => `/facts/${field}`);
  }
  return [];
}

function allowedPowerClaimFields(partClass: PartClassId): readonly string[] {
  if (partClass === "power.integrated-synchronous-buck-regulator") {
    return [...Object.keys(POWER_INTEGRATED_CLAIM_SPECS_V2), "controlEvidenceBasis"];
  }
  if (partClass === "power.external-fet-synchronous-buck-controller") {
    return [
      ...Object.keys(POWER_EXTERNAL_CLAIM_SPECS_V2),
      "controlEvidenceBasis",
      "currentSenseThresholdOptions",
      "gateDriveVoltageOptions",
    ];
  }
  return [];
}

function assertClosedPowerClaims(partClass: PartClassId, powerClaims: unknown | null): void {
  if (powerClaims === null) return;
  const allowed = new Set(allowedPowerClaimFields(partClass));
  for (const key of Object.keys(powerClaims as JsonRecord)) {
    if (!allowed.has(key)) throw new TypeError(`overrides/powerClaims/${key} [cross_class_override]: Field is not declared by ${partClass}`);
  }
}

function issuePointers(issue: ValidationIssue): string[] {
  const path = issue.path;
  const aggregateClaims: Readonly<Record<string, readonly string[]>> = {
    "facts.inputVoltage": ["inputVoltageMinimum", "inputVoltageMaximum"],
    "facts.outputVoltage": ["outputVoltageMinimum", "outputVoltageMaximum"],
    "facts.switchingFrequency": ["switchingFrequencyMinimum", "switchingFrequencyRecommended", "switchingFrequencyMaximum"],
    "facts.feedbackReference": ["feedbackReferenceMinimum", "feedbackReferenceTypical", "feedbackReferenceMaximum"],
    "facts.currentLimit": ["currentLimitMinimum", "currentLimitTypical", "currentLimitMaximum"],
  };
  const aggregate = aggregateClaims[path];
  if (aggregate) return aggregate.map((field) => `/facts/${field}`);
  if (path === "facts.mountedGeometry") {
    return issue.message.toLowerCase().includes("height")
      ? ["/facts/mountedGeometry/maximumHeight"]
      : ["/facts/mountedGeometry/boardArea"];
  }
  const segments = path.split(".").filter(Boolean);
  if (segments[0] === "facts" && segments[1] === "mountedGeometry") {
    if (segments[2] === "boardArea") return ["/facts/mountedGeometry/boardArea"];
    if (segments[2] === "maximumHeight") return ["/facts/mountedGeometry/maximumHeight"];
    return ["/facts/mountedGeometry/boardArea", "/facts/mountedGeometry/maximumHeight"];
  }
  if (segments[0] === "facts" && segments[1]) return [`/facts/${segments[1].replaceAll("~", "~0").replaceAll("/", "~1")}`];
  if (segments[0] === "commonFacts" && segments[1]) return [`/commonFacts/${segments[1].replaceAll("~", "~0").replaceAll("/", "~1")}`];
  return [pointer(path)];
}

function addAuthoringIssues(issues: readonly ValidationIssue[], unresolved: Set<string>): void {
  const hardFailure = issues.find((entry) => [
    "unknown_key",
    "invalid_data_boundary",
    "invalid_format",
    "invalid_version",
    "invalid_facts_version",
    "invalid_part_class",
    "invalid_manufacturer_id",
    "invalid_mpn",
    "unregistered_manufacturer",
    "claim_kind_mismatch",
    "claim_basis_mismatch",
    "unknown_condition",
  ].includes(entry.code));
  if (hardFailure) throw new TypeError(`overrides/${hardFailure.path.replaceAll(".", "/")} [invalid_override]: ${hardFailure.message}`);
  for (const issue of issues) for (const path of issuePointers(issue)) unresolved.add(path);
}

function addRawAdmissionGaps(partClass: PartClassId, candidate: JsonRecord, unresolved: Set<string>): void {
  const common = candidate.commonFacts as JsonRecord | undefined;
  const packageName = common?.packageName as JsonRecord | undefined;
  if (packageName?.state !== "reviewed") unresolved.add("/commonFacts/packageName");
  const facts = candidate.facts as JsonRecord | undefined;
  const mounted = facts?.mountedGeometry as JsonRecord | undefined;
  const boardArea = mounted?.boardArea as JsonRecord | undefined;
  const maximumHeight = mounted?.maximumHeight as JsonRecord | undefined;
  if (boardArea?.state !== "calculated") unresolved.add("/facts/mountedGeometry/boardArea");
  if (maximumHeight?.state !== "reviewed") unresolved.add("/facts/mountedGeometry/maximumHeight");
  if (!facts) return;

  if (partClass === "power.integrated-synchronous-buck-regulator") {
    for (const field of Object.keys(POWER_INTEGRATED_CLAIM_SPECS_V2)) {
      const state = (facts[field] as JsonRecord | undefined)?.state;
      if (field === "riseTimeMaximum" || field === "fallTimeMaximum") {
        if (state !== "reviewed" && state !== "unknown") unresolved.add(`/facts/${field}`);
      } else if (state !== "reviewed") unresolved.add(`/facts/${field}`);
    }
    if ((facts.controlEvidenceBasis as JsonRecord | undefined)?.state !== "reviewed") unresolved.add("/facts/controlEvidenceBasis");
    return;
  }

  if (partClass === "power.external-fet-synchronous-buck-controller") {
    const gateAlternatives = new Set([
      "gateSourceCurrentMinimum",
      "gateSinkCurrentMinimum",
      "gatePullupResistanceMaximum",
      "gatePulldownResistanceMaximum",
    ]);
    for (const field of Object.keys(POWER_EXTERNAL_CLAIM_SPECS_V2)) {
      const state = (facts[field] as JsonRecord | undefined)?.state;
      if (field === "controllerLossMaximum") {
        if (state !== "reviewed" && state !== "unknown") unresolved.add(`/facts/${field}`);
      } else if (!gateAlternatives.has(field) && state !== "reviewed") unresolved.add(`/facts/${field}`);
    }
    const requireAlternative = (left: string, right: string): void => {
      if ((facts[left] as JsonRecord | undefined)?.state === "reviewed" || (facts[right] as JsonRecord | undefined)?.state === "reviewed") return;
      unresolved.add(`/facts/${left}`);
      unresolved.add(`/facts/${right}`);
    };
    requireAlternative("gateSourceCurrentMinimum", "gatePullupResistanceMaximum");
    requireAlternative("gateSinkCurrentMinimum", "gatePulldownResistanceMaximum");
    for (const field of ["currentSenseThresholdOptions", "gateDriveVoltageOptions"] as const) {
      const options = facts[field];
      if (!Array.isArray(options) || options.length === 0) {
        unresolved.add(`/facts/${field}`);
        continue;
      }
      if (options.some((option) => {
        const record = option as JsonRecord | undefined;
        return !record || ["minimum", "typical", "maximum"].some((claim) => (record[claim] as JsonRecord | undefined)?.state !== "reviewed");
      })) unresolved.add(`/facts/${field}`);
    }
    if ((facts.controlEvidenceBasis as JsonRecord | undefined)?.state !== "reviewed") unresolved.add("/facts/controlEvidenceBasis");
    return;
  }

  for (const [field, spec] of Object.entries(PART_CLASS_SPECS[partClass].facts)) {
    if (spec.requiredForAdmission && (facts[field] as JsonRecord | undefined)?.state !== "reviewed") unresolved.add(`/facts/${field}`);
  }
}

function sourceAdmissionPaths(source: ReturnType<typeof parseDesignProfile>): string[] {
  const paths: string[] = [];
  if (source.commonFacts.packageName.state !== "reviewed") paths.push("/commonFacts/packageName");
  if (source.partClass !== "power.integrated-synchronous-buck-regulator" && source.partClass !== "power.external-fet-synchronous-buck-controller") {
    for (const [field, spec] of Object.entries(PART_CLASS_SPECS[source.partClass].facts)) {
      if (spec.requiredForAdmission && (source.facts as Record<string, { state?: unknown }>)[field]?.state !== "reviewed") paths.push(`/facts/${field}`);
    }
  }
  return paths;
}

export function planDesignProfileFactsV1ToV2(
  input: unknown,
  overrides: unknown,
  registry: ManufacturerRegistryV1,
): DesignProfileFactsV1ToV2MigrationPlan {
  const source = parseDesignProfile(input, registry);
  if (source.factsSchemaVersion !== FACTS_SCHEMA_VERSION) throw new TypeError("factsSchemaVersion [invalid_v1_source]: Expected facts schema 1.0.0");
  const supplied = parseOverrides(overrides);
  const sourceProfileId = designProfileId(source.partClass, source.part);
  const isPower = source.partClass === "power.integrated-synchronous-buck-regulator" || source.partClass === "power.external-fet-synchronous-buck-controller";
  if (!isPower && supplied.powerClaims !== null) throw new TypeError("overrides/powerClaims [cross_class_override]: Non-Power migration forbids Power claims");
  if (isPower) assertClosedPowerClaims(source.partClass, supplied.powerClaims);

  const unresolved = new Set<string>(sourceAdmissionPaths(source));
  if (supplied.mountedGeometry === null) {
    unresolved.add("/facts/mountedGeometry/boardArea");
    unresolved.add("/facts/mountedGeometry/maximumHeight");
  }
  if (isPower && supplied.powerClaims === null) for (const path of requiredPowerPaths(source.partClass)) unresolved.add(path);

  let draft: DesignProfileWithFactsV2<PartClassId, object> | null = null;
  if (supplied.mountedGeometry !== null && (!isPower || supplied.powerClaims !== null)) {
    const unknownGeometry = (label: string) => ({
      value: null,
      state: "unknown" as const,
      evidence: [],
      validFor: [],
      explanation: `${label} is represented only by facts.mountedGeometry in facts schema 2.0.0.`,
    });
    const facts = isPower
      ? { ...(supplied.powerClaims as JsonRecord), mountedGeometry: supplied.mountedGeometry }
      : { ...(source.facts as JsonRecord), mountedGeometry: supplied.mountedGeometry };
    const candidate = {
      ...source,
      factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
      commonFacts: {
        ...source.commonFacts,
        boardArea: unknownGeometry("Board area"),
        maximumHeight: unknownGeometry("Maximum height"),
      },
      facts,
    };
    addRawAdmissionGaps(source.partClass, candidate, unresolved);
    const envelopeIssues = validateDesignProfileEnvelope(candidate, registry);
    addAuthoringIssues(envelopeIssues, unresolved);
    if (envelopeIssues.length === 0) {
      const parsed = parseDesignProfileEnvelope(candidate, registry);
      if (parsed.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V2) throw new Error("factsSchemaVersion [migration_contract]: Expected facts schema 2.0.0");
      draft = parsed as DesignProfileWithFactsV2<PartClassId, object>;
      addAuthoringIssues(validateProfileAdmissionRulesV2(draft), unresolved);
    }
  }

  const unresolvedPaths = [...unresolved].sort(compareAscii);
  const result: DesignProfileFactsV1ToV2MigrationPlan = {
    status: draft !== null && unresolvedPaths.length === 0 ? "ready_for_authored_v2" : "needs_evidence",
    sourceProfileId,
    unresolvedPaths,
    draft,
  };
  return deepFreeze(result) as DesignProfileFactsV1ToV2MigrationPlan;
}
