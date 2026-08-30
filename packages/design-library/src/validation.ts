import { isManufacturerId } from "@opencircuit/sourcing-schema";
import { canonicalJson, compareAscii, contentHash, deepFreeze, detachedJsonSnapshot } from "./canonical";
import { parseCanonicalEvidenceUrl } from "./evidence-url";
import { designProfileId, designProfilePath } from "./path";
import { PART_CLASS_SPECS, type FactSpec, type FactsFor, type NumericDomain, type PartClassSpec } from "./specs";
import {
  ADMISSION_LEDGER_FORMAT,
  CATALOG_RELEASE_FORMAT,
  DESIGN_PROFILE_FORMAT,
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION,
  MANUFACTURER_REGISTRY_FORMAT,
  PART_CLASS_IDS,
  type AdmissionCheckV1,
  type CatalogProfileRefV1,
  type CommercialBoundaryCategory,
  type CommercialBoundaryIssue,
  type DesignCatalogReleaseV1,
  type DesignProfileAdmissionEntryV1,
  type DesignProfileAdmissionLedgerV1,
  type DesignProfileV1,
  type ManufacturerRegistryEntryV1,
  type ManufacturerRegistryV1,
  type OperatingRange,
  type PartClassId,
  type ProfileEvidenceRef,
  type ProfileFact,
  type ProfileQuantity,
  type ProfileUnit,
  type ValidationIssue,
} from "./types";

type UnknownRecord = Record<string, unknown>;

const PROFILE_KEYS = ["format", "schemaVersion", "partClass", "part", "factsSchemaVersion", "commonFacts", "facts"] as const;
const PART_KEYS = ["manufacturerId", "manufacturerPartNumber"] as const;
const COMMON_FACT_KEYS = ["packageName", "boardArea", "maximumHeight"] as const;
const FACT_KEYS = ["value", "state", "evidence", "validFor", "explanation"] as const;
const EVIDENCE_KEYS = ["sourceId", "locator", "retrievedAt", "contentHash", "licenseNote", "kind", "url", "revision", "publicationBasis"] as const;
const RANGE_KEYS = ["parameterId", "minimum", "maximum", "evidence"] as const;
const QUANTITY_KEYS = ["value", "unit", "displayUnit"] as const;
const REGISTRY_KEYS = ["format", "schemaVersion", "manufacturers"] as const;
const MANUFACTURER_KEYS = ["manufacturerId", "displayName", "primaryEvidenceHosts"] as const;
const LEDGER_KEYS = ["format", "schemaVersion", "entries"] as const;
const ADMISSION_KEYS = ["partClass", "part", "profilePath", "ownerTrack", "reviewerTrack", "state", "authoredBy", "authoredAt", "reviewedBy", "reviewedAt", "profileContentHash", "checks"] as const;
const CHECK_KEYS = ["checkId", "status"] as const;
const RELEASE_KEYS = ["format", "schemaVersion", "version", "releasedAt", "manufacturerRegistryContentHash", "admissionContentHash", "profiles", "contentHash"] as const;
const RELEASE_PROFILE_KEYS = ["profileId", "profilePath", "partClass", "part", "profileContentHash"] as const;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const RFC3339_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;
const PROFILE_UNITS = new Set<ProfileUnit>(["1", "A", "F", "H", "Hz", "K", "V", "V_s_per_rad", "W", "count", "m", "m2", "ohm", "rad_per_s", "s", "C", "J", "K/W", "1/K"]);
const STATES = ["reviewed", "calculated", "estimated", "unknown"] as const;
const EVIDENCE_KINDS = ["manufacturer_datasheet", "manufacturer_product_page", "independent_measurement", "authored_derivation", "synthetic_fixture"] as const;
const PUBLICATION_BASES = ["public_facts", "licensed_redistribution", "original_measurement"] as const;
const OWNERSHIP_TRACKS = ["motor", "power", "integration-data-review"] as const;
const ADMISSION_STATES = ["planned", "researching", "authored", "in_independent_review", "reviewed", "blocked"] as const;
const CURRENT_DISTRIBUTOR_HOSTS = deepFreeze([
  "arrow.com", "digikey.com", "element14.com", "farnell.com", "findchips.com", "futureelectronics.com",
  "lcsc.com", "mouser.com", "newark.com", "octopart.com", "rs-online.com", "rutronik.com", "tme.eu",
] as const);

export const TRUSTED_INDEPENDENT_EVIDENCE_HOSTS = deepFreeze(["osf.io", "zenodo.org"] as const);
export const EVIDENCE_TRUST_RULES = deepFreeze({
  manufacturer_datasheet: { publicationBases: ["public_facts", "licensed_redistribution"], hostPolicy: "profile_manufacturer_registry" },
  manufacturer_product_page: { publicationBases: ["public_facts", "licensed_redistribution"], hostPolicy: "profile_manufacturer_registry" },
  independent_measurement: { publicationBases: ["original_measurement"], hostPolicy: "trusted_independent_registry" },
  authored_derivation: { publicationBases: ["public_facts", "licensed_redistribution"], hostPolicy: "non_commercial_https" },
} as const);

const OWNER_BY_CLASS: Readonly<Record<PartClassId, typeof OWNERSHIP_TRACKS[number]>> = deepFreeze({
  "motor.integrated-h-bridge": "motor",
  "motor.full-bridge-gate-driver": "motor",
  "power.integrated-synchronous-buck-regulator": "power",
  "power.external-fet-synchronous-buck-controller": "power",
  "shared.n-channel-power-mosfet": "integration-data-review",
  "shared.current-sense-resistor": "integration-data-review",
  "shared.general-purpose-resistor": "integration-data-review",
  "shared.switching-diode": "integration-data-review",
  "shared.mlcc-capacitor": "integration-data-review",
  "shared.bulk-capacitor": "integration-data-review",
  "motor.supply-tvs-diode": "integration-data-review",
  "power.power-inductor": "integration-data-review",
});

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function member<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

function exactKeys(value: unknown, allowed: readonly string[], path: string, issues: ValidationIssue[]): UnknownRecord | undefined {
  if (!isRecord(value)) {
    issues.push(issue(path, "invalid_object", "Must be a plain object"));
    return undefined;
  }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(issue(path ? `${path}.${key}` : key, "unknown_key", "Unknown key in closed persisted contract"));
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(value, key)) issues.push(issue(path ? `${path}.${key}` : key, "missing_key", "Required key is missing"));
  return value;
}

function nonEmptyString(value: unknown, path: string, issues: ValidationIssue[]): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(issue(path, "invalid_string", "Must be a non-empty string"));
    return false;
  }
  return true;
}

function nullableString(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value !== null) nonEmptyString(value, path, issues);
}

function timestamp(value: unknown, path: string, issues: ValidationIssue[]): value is string {
  if (typeof value !== "string") {
    issues.push(issue(path, "invalid_timestamp", "Must be a valid RFC 3339 timestamp with an explicit offset"));
    return false;
  }
  const match = RFC3339_PATTERN.exec(value);
  if (!match) {
    issues.push(issue(path, "invalid_timestamp", "Must be a valid RFC 3339 timestamp with an explicit offset"));
    return false;
  }
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const hour = Number(match[4]); const minute = Number(match[5]); const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]); const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59 || !Number.isFinite(Date.parse(value))) {
    issues.push(issue(path, "invalid_timestamp", "Must be a valid RFC 3339 calendar timestamp with an explicit offset"));
    return false;
  }
  return true;
}

function hash(value: unknown, path: string, issues: ValidationIssue[], nullable = false): value is `sha256:${string}` {
  if (nullable && value === null) return false;
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    issues.push(issue(path, "invalid_hash", "Must be sha256: followed by 64 lowercase hexadecimal digits"));
    return false;
  }
  return true;
}

function validatePart(value: unknown, path: string, issues: ValidationIssue[]): UnknownRecord | undefined {
  const part = exactKeys(value, PART_KEYS, path, issues);
  if (!part) return undefined;
  if (!isManufacturerId(part.manufacturerId)) issues.push(issue(`${path}.manufacturerId`, "invalid_manufacturer_id", "Must be a stable lowercase manufacturer registry key"));
  if (nonEmptyString(part.manufacturerPartNumber, `${path}.manufacturerPartNumber`, issues) && part.manufacturerPartNumber !== part.manufacturerPartNumber.trim()) {
    issues.push(issue(`${path}.manufacturerPartNumber`, "surrounding_whitespace", "Exact MPN cannot contain surrounding whitespace"));
  }
  return part;
}

function isCommercialHost(host: string): boolean {
  return CURRENT_DISTRIBUTOR_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function normalizedBoundaryKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function evidenceObject(value: UnknownRecord): boolean {
  return "kind" in value && "sourceId" in value && "locator" in value && "url" in value;
}

export const COMMERCIAL_BOUNDARY_VOCABULARY = deepFreeze([
  { category: "raw_provider_payload", pattern: /^(?:raw|payload)|(?:rawdata|rawrequest|rawresponse|providerpayload|providerresponse|requestpayload|apiresponse|responsebody|requestbody)$/ },
  { category: "secret_or_authorization", pattern: /(?:authorization|permission|apikey|apitoken|accesstoken|oauthtoken|oauth|privatekey|password|credential|secret|authheader|bearertoken)/ },
  { category: "snapshot_state", pattern: /(?:snapshot|expires|expiry|expiration|retrievalerror|retrievalfail|providererror)/ },
  { category: "policy_or_terms", pattern: /(?:attribution|cache|ttl|persist|export|terms|policy|licensepolicy)/ },
  { category: "offer_state", pattern: /(?:offer|quote|price|cost|currency|stock|inventory|availability|availablequantity|availableqty|quantityavailable|lifecycle|eol|endoflife|lastbuy|leadtime|factorylead|leaddays|leadweeks|shipdays|delivery|marketplace|backorder|fulfillment|orderable|moq|minorderqty|minimumorderqty|minimumorderquantity|minimumquantity|minimumpurchasequantity|orderqtyminimum|orderminimum|minbuy|minimumbuy|ordermultiple|packagingoption|buynowurl|supply(?:status|availability|chain|source|constraint))/ },
  { category: "provider_identity", pattern: /(?:provider|distributor|supplier|seller|vendor|merchant)(?:id|name|key|ref|slug|code)?$|^(?:provider|distributor|supplier|seller|vendor|merchant)|sku/ },
] as const satisfies readonly { category: CommercialBoundaryCategory; pattern: RegExp }[]);

export function classifyCommercialBoundaryKey(key: string): CommercialBoundaryCategory | undefined {
  const normalized = normalizedBoundaryKey(key);
  return COMMERCIAL_BOUNDARY_VOCABULARY.find(({ pattern }) => pattern.test(normalized))?.category;
}

export function validateCommercialDataBoundary(input: unknown, path = ""): CommercialBoundaryIssue[] {
  const issues: CommercialBoundaryIssue[] = [];
  const visit = (value: unknown, currentPath: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${currentPath}.${index}`));
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, nested] of Object.entries(value)) {
      const nestedPath = currentPath ? `${currentPath}.${key}` : key;
      const normalized = normalizedBoundaryKey(key);
      const legitimateEvidenceRetrieval = normalized === "retrievedat" && evidenceObject(value);
      const legitimateEvidenceHash = normalized === "contenthash" && evidenceObject(value);
      const legitimateIntegrityHash = normalized === "profilecontenthash" || normalized === "manufacturerregistrycontenthash" || normalized === "admissioncontenthash" || (normalized === "contenthash" && value.format === CATALOG_RELEASE_FORMAT);
      const category = classifyCommercialBoundaryKey(key);
      if (!legitimateEvidenceRetrieval && !legitimateEvidenceHash && !legitimateIntegrityHash && category !== undefined) {
        issues.push({ path: nestedPath, code: "commercial_boundary_violation", category, message: `Commercial/provider ${category} data is forbidden in the engineering library` });
      }
      visit(nested, nestedPath);
    }
  };
  visit(input, path);
  return issues;
}

function validateQuantity(value: unknown, expectedUnit: ProfileUnit, domain: NumericDomain, path: string, issues: ValidationIssue[]): value is ProfileQuantity {
  const quantity = exactKeys(value, QUANTITY_KEYS, path, issues);
  if (!quantity) return false;
  if (typeof quantity.value !== "number" || !Number.isFinite(quantity.value)) issues.push(issue(`${path}.value`, "invalid_quantity", "Must be a finite number"));
  else {
    if (domain.minimum !== undefined && quantity.value < domain.minimum) issues.push(issue(`${path}.value`, "quantity_below_minimum", `Must be at least ${domain.minimum}`));
    if (domain.exclusiveMinimum !== undefined && quantity.value <= domain.exclusiveMinimum) issues.push(issue(`${path}.value`, "quantity_not_positive", `Must be greater than ${domain.exclusiveMinimum}`));
    if (domain.maximum !== undefined && quantity.value > domain.maximum) issues.push(issue(`${path}.value`, "quantity_above_maximum", `Must be at most ${domain.maximum}`));
  }
  if (!PROFILE_UNITS.has(quantity.unit as ProfileUnit)) issues.push(issue(`${path}.unit`, "invalid_profile_unit", "Unsupported closed profile unit"));
  else if (quantity.unit !== expectedUnit) issues.push(issue(`${path}.unit`, "unit_mismatch", `Must use canonical unit ${expectedUnit}`));
  nonEmptyString(quantity.displayUnit, `${path}.displayUnit`, issues);
  return true;
}

function validateEvidence(value: unknown, path: string, manufacturer: ManufacturerRegistryEntryV1 | undefined, issues: ValidationIssue[]): void {
  const evidence = exactKeys(value, EVIDENCE_KEYS, path, issues);
  if (!evidence) return;
  nonEmptyString(evidence.sourceId, `${path}.sourceId`, issues);
  nonEmptyString(evidence.locator, `${path}.locator`, issues);
  nonEmptyString(evidence.licenseNote, `${path}.licenseNote`, issues);
  if (!member(evidence.kind, EVIDENCE_KINDS)) issues.push(issue(`${path}.kind`, "invalid_evidence_kind", "Unsupported evidence kind"));
  if (evidence.kind === "synthetic_fixture") {
    if (evidence.retrievedAt !== null) timestamp(evidence.retrievedAt, `${path}.retrievedAt`, issues);
    if (evidence.contentHash !== null) hash(evidence.contentHash, `${path}.contentHash`, issues);
    if (evidence.url !== null || evidence.revision !== null || evidence.publicationBasis !== null) issues.push(issue(path, "synthetic_provenance_fabrication", "Synthetic fixture evidence must keep unavailable publication fields explicitly null"));
    return;
  }
  timestamp(evidence.retrievedAt, `${path}.retrievedAt`, issues);
  hash(evidence.contentHash, `${path}.contentHash`, issues);
  nonEmptyString(evidence.revision, `${path}.revision`, issues);
  if (!member(evidence.publicationBasis, PUBLICATION_BASES)) issues.push(issue(`${path}.publicationBasis`, "invalid_publication_basis", "Unsupported publication basis"));
  if (!nonEmptyString(evidence.url, `${path}.url`, issues)) return;
  const url = parseCanonicalEvidenceUrl(evidence.url);
  if (!url) {
    issues.push(issue(`${path}.url`, "invalid_url", "Must use the exact canonical lowercase-HTTPS URI grammar with a valid lowercase ASCII hostname and RFC 3986 path, query, fragment, and percent-escape characters"));
    return;
  }
  const host = url.hostname;
  if (isCommercialHost(host)) issues.push(issue(`${path}.url`, "commercial_evidence_host", "Distributor and commercial catalog URLs cannot be relabeled as engineering evidence"));
  if (member(evidence.kind, ["manufacturer_datasheet", "manufacturer_product_page", "independent_measurement", "authored_derivation"] as const)
    && member(evidence.publicationBasis, PUBLICATION_BASES)) {
    const rule = EVIDENCE_TRUST_RULES[evidence.kind];
    if (!(rule.publicationBases as readonly string[]).includes(evidence.publicationBasis)) issues.push(issue(`${path}.publicationBasis`, "evidence_semantics_mismatch", `${evidence.kind} does not permit ${evidence.publicationBasis}`));
  }
  if (evidence.kind === "manufacturer_datasheet" || evidence.kind === "manufacturer_product_page") {
    if (!manufacturer) issues.push(issue(`${path}.url`, "unknown_manufacturer", "Manufacturer evidence requires the exact profile manufacturer registry entry"));
    else if (!manufacturer.primaryEvidenceHosts.includes(host) || isCommercialHost(host)) {
      issues.push(issue(`${path}.url`, "non_manufacturer_host", `Hostname is not an approved primary evidence host for ${manufacturer.manufacturerId}`));
    }
  } else if (evidence.kind === "independent_measurement" && !(TRUSTED_INDEPENDENT_EVIDENCE_HOSTS as readonly string[]).includes(host)) {
    issues.push(issue(`${path}.url`, "untrusted_independent_host", "Independent measurements require an exact code-owned trusted publication host"));
  }
}

function validateEvidenceList(value: unknown, path: string, manufacturer: ManufacturerRegistryEntryV1 | undefined, issues: ValidationIssue[], requireNonEmpty: boolean): void {
  if (!Array.isArray(value)) {
    issues.push(issue(path, "invalid_evidence", "Must be an evidence array"));
    return;
  }
  if (requireNonEmpty && value.length === 0) issues.push(issue(path, "missing_evidence", "Known facts require evidence"));
  value.forEach((entry, index) => validateEvidence(entry, `${path}.${index}`, manufacturer, issues));
}

/** Shared closed evidence validator for additive versioned-facts codecs. */
export function validateProfileEvidenceListV2(
  value: unknown,
  path: string,
  manufacturer: ManufacturerRegistryEntryV1 | undefined,
  requireNonEmpty: boolean,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  validateEvidenceList(value, path, manufacturer, issues, requireNonEmpty);
  return issues;
}

function validateOperatingRange(value: unknown, spec: PartClassSpec, path: string, manufacturer: ManufacturerRegistryEntryV1 | undefined, issues: ValidationIssue[]): void {
  const range = exactKeys(value, RANGE_KEYS, path, issues);
  if (!range) return;
  if (!nonEmptyString(range.parameterId, `${path}.parameterId`, issues)) return;
  const rangeSpec = spec.operatingRanges[range.parameterId];
  if (!rangeSpec) issues.push(issue(`${path}.parameterId`, "unknown_range_parameter", "Parameter is not declared by this part-class codec"));
  if (range.minimum === null && range.maximum === null) issues.push(issue(path, "empty_range", "At least one range bound is required"));
  if (rangeSpec && range.minimum !== null) validateQuantity(range.minimum, rangeSpec.unit, rangeSpec.domain, `${path}.minimum`, issues);
  if (rangeSpec && range.maximum !== null) validateQuantity(range.maximum, rangeSpec.unit, rangeSpec.domain, `${path}.maximum`, issues);
  if (isRecord(range.minimum) && isRecord(range.maximum) && typeof range.minimum.value === "number" && typeof range.maximum.value === "number" && range.minimum.value > range.maximum.value) {
    issues.push(issue(path, "inverted_range", "Minimum cannot exceed maximum"));
  }
  validateEvidenceList(range.evidence, `${path}.evidence`, manufacturer, issues, true);
}

function validateFact(value: unknown, spec: FactSpec, codec: PartClassSpec, path: string, manufacturer: ManufacturerRegistryEntryV1 | undefined, issues: ValidationIssue[]): void {
  const fact = exactKeys(value, FACT_KEYS, path, issues);
  if (!fact) return;
  nonEmptyString(fact.explanation, `${path}.explanation`, issues);
  if (!member(fact.state, STATES)) issues.push(issue(`${path}.state`, "invalid_fact_state", "Unsupported fact state"));
  if (!Array.isArray(fact.validFor)) issues.push(issue(`${path}.validFor`, "invalid_ranges", "Must be an array"));
  else fact.validFor.forEach((range, index) => validateOperatingRange(range, codec, `${path}.validFor.${index}`, manufacturer, issues));
  if (fact.state === "reviewed" && Array.isArray(fact.validFor)) {
    for (const parameterId of spec.requiredRangeParameters ?? []) {
      if (!fact.validFor.some((range) => isRecord(range) && range.parameterId === parameterId)) issues.push(issue(`${path}.validFor`, "missing_required_range", `Reviewed fact requires a declared ${parameterId} operating range`));
    }
  }
  const unknown = fact.state === "unknown";
  if (unknown) {
    if (fact.value !== null) issues.push(issue(`${path}.value`, "unknown_has_value", "Unknown facts must have null value"));
    if (Array.isArray(fact.validFor) && fact.validFor.length > 0) issues.push(issue(`${path}.validFor`, "unknown_has_range", "Unknown facts cannot claim an operating range"));
    validateEvidenceList(fact.evidence, `${path}.evidence`, manufacturer, issues, false);
    if (Array.isArray(fact.evidence) && fact.evidence.length > 0) issues.push(issue(`${path}.evidence`, "unknown_has_evidence", "Unknown facts must not carry evidence that implies a value"));
    return;
  }
  if (fact.value === null) issues.push(issue(`${path}.value`, "known_missing_value", "Known, calculated, and estimated facts require a value"));
  validateEvidenceList(fact.evidence, `${path}.evidence`, manufacturer, issues, true);
  if (fact.value === null) return;
  if (spec.kind === "quantity") validateQuantity(fact.value, spec.unit, spec.domain, `${path}.value`, issues);
  else if (spec.kind === "boolean") {
    if (typeof fact.value !== "boolean") issues.push(issue(`${path}.value`, "invalid_boolean_fact", "Must be boolean"));
  } else if (!nonEmptyString(fact.value, `${path}.value`, issues)) return;
  else if (spec.values && !spec.values.includes(fact.value)) issues.push(issue(`${path}.value`, "invalid_text_fact", "Value is outside the codec's closed vocabulary"));
}

function manufacturerMap(registry: ManufacturerRegistryV1 | undefined): Map<string, ManufacturerRegistryEntryV1> {
  return new Map((registry?.manufacturers ?? []).map((entry) => [entry.manufacturerId, entry]));
}

/** Closed structural fact validation for an explicit version-scoped class specification. */
export function validateFactsAgainstSpec(input: unknown, spec: PartClassSpec, manufacturer?: ManufacturerRegistryEntryV1): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(input, "facts")];
  const facts = exactKeys(input, Object.keys(spec.facts), "facts", issues);
  if (!facts) return issues;
  for (const [factId, factSpec] of Object.entries(spec.facts)) validateFact(facts[factId], factSpec, spec, `facts.${factId}`, manufacturer, issues);
  return issues;
}

export function validateFactsForCodec(input: unknown, partClass: PartClassId, manufacturer?: ManufacturerRegistryEntryV1): ValidationIssue[] {
  return validateFactsAgainstSpec(input, PART_CLASS_SPECS[partClass], manufacturer);
}

function reviewedQuantity(fact: unknown): number | undefined {
  if (!isRecord(fact) || fact.state !== "reviewed" || !isRecord(fact.value) || typeof fact.value.value !== "number") return undefined;
  return fact.value.value;
}

function validateOrderedFactPair(facts: UnknownRecord, lower: string, upper: string, path: string, issues: ValidationIssue[], allowEqual = true): void {
  const low = reviewedQuantity(facts[lower]);
  const high = reviewedQuantity(facts[upper]);
  if (low !== undefined && high !== undefined && (allowEqual ? low > high : low >= high)) issues.push(issue(path, "inconsistent_fact_order", `${lower} must not exceed ${upper}`));
}

function validateClassSemantics(partClass: PartClassId, facts: UnknownRecord, issues: ValidationIssue[]): void {
  if (partClass === "motor.integrated-h-bridge" || partClass === "motor.full-bridge-gate-driver") {
    validateOrderedFactPair(facts, "supplyMinimum", "supplyMaximum", "facts.supplyMinimum", issues, false);
    validateOrderedFactPair(facts, "supplyMaximum", "absoluteMaximum", "facts.supplyMaximum", issues);
  }
  if (partClass === "motor.integrated-h-bridge") {
    validateOrderedFactPair(facts, "continuousCurrent", "peakCurrent", "facts.continuousCurrent", issues);
    validateOrderedFactPair(facts, "currentLimitMinimum", "currentLimitMaximum", "facts.currentLimitMinimum", issues);
  }
  if (partClass === "power.integrated-synchronous-buck-regulator" || partClass === "power.external-fet-synchronous-buck-controller") {
    validateOrderedFactPair(facts, "inputVoltageMinimum", "inputVoltageMaximum", "facts.inputVoltageMinimum", issues, false);
    validateOrderedFactPair(facts, "outputVoltageMinimum", "outputVoltageMaximum", "facts.outputVoltageMinimum", issues, false);
    validateOrderedFactPair(facts, "switchingFrequencyMinimum", "switchingFrequencyRecommended", "facts.switchingFrequencyMinimum", issues);
    validateOrderedFactPair(facts, "switchingFrequencyRecommended", "switchingFrequencyMaximum", "facts.switchingFrequencyRecommended", issues);
  }
  if (partClass === "power.external-fet-synchronous-buck-controller") {
    validateOrderedFactPair(facts, "currentSenseThresholdMinimum", "currentSenseThresholdTypical", "facts.currentSenseThresholdMinimum", issues);
    validateOrderedFactPair(facts, "currentSenseThresholdTypical", "currentSenseThresholdMaximum", "facts.currentSenseThresholdTypical", issues);
    validateOrderedFactPair(facts, "currentSenseThresholdMinimum", "currentSenseThresholdMaximum", "facts.currentSenseThresholdMinimum", issues);
  }
  if (partClass === "shared.n-channel-power-mosfet") validateOrderedFactPair(facts, "continuousDrainCurrent", "pulsedDrainCurrent", "facts.continuousDrainCurrent", issues);
  if (partClass === "motor.supply-tvs-diode") {
    validateOrderedFactPair(facts, "standOffVoltage", "breakdownVoltageMinimum", "facts.standOffVoltage", issues);
    validateOrderedFactPair(facts, "breakdownVoltageMinimum", "breakdownVoltageMaximum", "facts.breakdownVoltageMinimum", issues);
    validateOrderedFactPair(facts, "breakdownVoltageMaximum", "clampingVoltage", "facts.breakdownVoltageMaximum", issues);
  }
}

export function validateDesignProfile(input: unknown, registry?: ManufacturerRegistryV1): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(input)];
  const profile = exactKeys(input, PROFILE_KEYS, "", issues);
  if (!profile) return issues;
  if (profile.format !== DESIGN_PROFILE_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${DESIGN_PROFILE_FORMAT}`));
  if (profile.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  if (!member(profile.partClass, PART_CLASS_IDS)) issues.push(issue("partClass", "invalid_part_class", "Unknown manifest part-class ID"));
  if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION) issues.push(issue("factsSchemaVersion", "invalid_facts_version", `Must equal ${FACTS_SCHEMA_VERSION}`));
  const part = validatePart(profile.part, "part", issues);
  const registryById = manufacturerMap(registry);
  const manufacturerId = typeof part?.manufacturerId === "string" ? part.manufacturerId : "";
  const manufacturer = registry === undefined ? undefined : registryById.get(manufacturerId);
  if (registry !== undefined && !manufacturer) issues.push(issue("part.manufacturerId", "unregistered_manufacturer", "Profile manufacturer is absent from the pinned registry"));
  const common = exactKeys(profile.commonFacts, COMMON_FACT_KEYS, "commonFacts", issues);
  if (common) {
    validateFact(common.packageName, { kind: "text", requiredForAdmission: true }, { facts: {}, operatingRanges: {} }, "commonFacts.packageName", manufacturer, issues);
    validateFact(common.boardArea, { kind: "quantity", unit: "m2", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } }, { facts: {}, operatingRanges: {} }, "commonFacts.boardArea", manufacturer, issues);
    validateFact(common.maximumHeight, { kind: "quantity", unit: "m", requiredForAdmission: true, domain: { exclusiveMinimum: 0 } }, { facts: {}, operatingRanges: {} }, "commonFacts.maximumHeight", manufacturer, issues);
  }
  if (member(profile.partClass, PART_CLASS_IDS)) {
    const codecIssues = validateFactsForCodec(profile.facts, profile.partClass, manufacturer)
      .filter((entry) => entry.code !== "commercial_boundary_violation");
    issues.push(...codecIssues);
    if (isRecord(profile.facts)) validateClassSemantics(profile.partClass, profile.facts, issues);
  }
  return issues;
}

export function assertValidDesignProfile(input: unknown, registry?: ManufacturerRegistryV1): asserts input is DesignProfileV1 {
  const first = validateDesignProfile(input, registry)[0];
  if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
}

export function parseDesignProfile(input: unknown, registry?: ManufacturerRegistryV1): DesignProfileV1 {
  const snapshot = detachedJsonSnapshot(input);
  const registrySnapshot = registry === undefined ? undefined : detachedJsonSnapshot(registry);
  assertValidDesignProfile(snapshot, registrySnapshot);
  return snapshot as DesignProfileV1;
}

export function migrateDesignProfile(input: unknown, registry?: ManufacturerRegistryV1): DesignProfileV1 {
  return parseDesignProfile(input, registry);
}

export function validateManufacturerRegistry(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(input)];
  const registry = exactKeys(input, REGISTRY_KEYS, "", issues);
  if (!registry) return issues;
  if (registry.format !== MANUFACTURER_REGISTRY_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${MANUFACTURER_REGISTRY_FORMAT}`));
  if (registry.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  if (!Array.isArray(registry.manufacturers)) {
    issues.push(issue("manufacturers", "invalid_array", "Must be an array"));
    return issues;
  }
  const ids = new Set<string>();
  let priorId = "";
  registry.manufacturers.forEach((value, index) => {
    const path = `manufacturers.${index}`;
    const entry = exactKeys(value, MANUFACTURER_KEYS, path, issues);
    if (!entry) return;
    if (!isManufacturerId(entry.manufacturerId)) issues.push(issue(`${path}.manufacturerId`, "invalid_manufacturer_id", "Must be a stable lowercase registry key"));
    else {
      if (ids.has(entry.manufacturerId)) issues.push(issue(`${path}.manufacturerId`, "duplicate_manufacturer", "Manufacturer ID must be unique"));
      if (priorId && compareAscii(priorId, entry.manufacturerId) >= 0) issues.push(issue(`${path}.manufacturerId`, "unstable_order", "Manufacturers must be strictly ASCII-sorted by ID"));
      ids.add(entry.manufacturerId); priorId = entry.manufacturerId;
    }
    nonEmptyString(entry.displayName, `${path}.displayName`, issues);
    if (!Array.isArray(entry.primaryEvidenceHosts) || entry.primaryEvidenceHosts.length === 0) issues.push(issue(`${path}.primaryEvidenceHosts`, "missing_hosts", "At least one official evidence hostname is required"));
    else {
      const seen = new Set<string>();
      let priorHost = "";
      entry.primaryEvidenceHosts.forEach((rawHost, hostIndex) => {
        const hostPath = `${path}.primaryEvidenceHosts.${hostIndex}`;
        if (!nonEmptyString(rawHost, hostPath, issues)) return;
        const host = rawHost.toLowerCase();
        const exactHostname = host.length <= 253 && HOSTNAME_PATTERN.test(host);
        if (rawHost !== host || !exactHostname) issues.push(issue(hostPath, "invalid_hostname", "Must be one lowercase ASCII hostname with non-empty labels and no scheme, path, or port"));
        if (isCommercialHost(host)) issues.push(issue(hostPath, "commercial_host", "Distributor, marketplace, and catalog-provider hosts cannot be manufacturer evidence hosts"));
        if (seen.has(host)) issues.push(issue(hostPath, "duplicate_hostname", "Evidence hostname must be unique"));
        if (priorHost && compareAscii(priorHost, host) >= 0) issues.push(issue(hostPath, "unstable_order", "Evidence hosts must be strictly ASCII-sorted"));
        seen.add(host); priorHost = host;
      });
    }
  });
  return issues;
}

export function assertValidManufacturerRegistry(input: unknown): asserts input is ManufacturerRegistryV1 {
  const first = validateManufacturerRegistry(input)[0];
  if (first) throw new Error(`${first.path || "registry"} [${first.code}]: ${first.message}`);
}

export function parseManufacturerRegistry(input: unknown): ManufacturerRegistryV1 {
  const snapshot = detachedJsonSnapshot(input);
  assertValidManufacturerRegistry(snapshot);
  return snapshot as ManufacturerRegistryV1;
}

export const COMMON_ADMISSION_CHECK_IDS = deepFreeze([
  "contract.closed_profile",
  "contract.commercial_boundary",
  "contract.identity_path",
  "contract.profile_content_hash",
  "evidence.primary",
  "facts.reviewed_and_conditioned",
  "review.independent",
] as const);

export function requiredAdmissionCheckIds(partClass: PartClassId): readonly string[] {
  return deepFreeze([...COMMON_ADMISSION_CHECK_IDS, `class.${partClass}.facts_semantics`].sort(compareAscii));
}

function validateAdmissionEntry(value: unknown, path: string, issues: ValidationIssue[]): DesignProfileAdmissionEntryV1 | undefined {
  const entry = exactKeys(value, ADMISSION_KEYS, path, issues);
  if (!entry) return undefined;
  if (!member(entry.partClass, PART_CLASS_IDS)) issues.push(issue(`${path}.partClass`, "invalid_part_class", "Unknown manifest part-class ID"));
  const part = validatePart(entry.part, `${path}.part`, issues);
  if (!member(entry.ownerTrack, OWNERSHIP_TRACKS)) issues.push(issue(`${path}.ownerTrack`, "invalid_track", "Unknown ownership track"));
  if (!member(entry.reviewerTrack, OWNERSHIP_TRACKS)) issues.push(issue(`${path}.reviewerTrack`, "invalid_track", "Unknown reviewer track"));
  if (entry.ownerTrack === entry.reviewerTrack) issues.push(issue(`${path}.reviewerTrack`, "non_independent_review", "Reviewer track must differ from owner track"));
  if (member(entry.partClass, PART_CLASS_IDS) && entry.ownerTrack !== OWNER_BY_CLASS[entry.partClass]) issues.push(issue(`${path}.ownerTrack`, "manifest_owner_mismatch", `Manifest assigns ${OWNER_BY_CLASS[entry.partClass]}`));
  if (!member(entry.state, ADMISSION_STATES)) issues.push(issue(`${path}.state`, "invalid_admission_state", "Unsupported admission state"));
  nullableString(entry.authoredBy, `${path}.authoredBy`, issues); nullableString(entry.reviewedBy, `${path}.reviewedBy`, issues);
  if (entry.authoredAt !== null) timestamp(entry.authoredAt, `${path}.authoredAt`, issues);
  if (entry.reviewedAt !== null) timestamp(entry.reviewedAt, `${path}.reviewedAt`, issues);
  if (entry.profileContentHash !== null) hash(entry.profileContentHash, `${path}.profileContentHash`, issues);
  if (typeof entry.authoredAt === "string" && typeof entry.reviewedAt === "string"
    && timestamp(entry.authoredAt, `${path}.authoredAt`, []) && timestamp(entry.reviewedAt, `${path}.reviewedAt`, [])
    && Date.parse(entry.authoredAt) > Date.parse(entry.reviewedAt)) {
    issues.push(issue(`${path}.reviewedAt`, "invalid_chronology", "reviewedAt must not precede authoredAt"));
  }
  if (member(entry.partClass, PART_CLASS_IDS) && part && typeof part.manufacturerId === "string" && typeof part.manufacturerPartNumber === "string") {
    const expected = designProfilePath(entry.partClass, { manufacturerId: part.manufacturerId, manufacturerPartNumber: part.manufacturerPartNumber });
    if (entry.profilePath !== expected) issues.push(issue(`${path}.profilePath`, "profile_path_mismatch", `Must equal ${expected}`));
  } else nonEmptyString(entry.profilePath, `${path}.profilePath`, issues);
  if (!Array.isArray(entry.checks)) issues.push(issue(`${path}.checks`, "invalid_checks", "Must be an array"));
  else {
    const ids = new Set<string>(); let prior = "";
    entry.checks.forEach((raw, index) => {
      const checkPath = `${path}.checks.${index}`;
      const check = exactKeys(raw, CHECK_KEYS, checkPath, issues);
      if (!check) return;
      if (nonEmptyString(check.checkId, `${checkPath}.checkId`, issues)) {
        if (ids.has(check.checkId)) issues.push(issue(`${checkPath}.checkId`, "duplicate_check", "Check ID must be unique"));
        if (prior && compareAscii(prior, check.checkId) >= 0) issues.push(issue(`${checkPath}.checkId`, "unstable_order", "Checks must be strictly ASCII-sorted"));
        ids.add(check.checkId); prior = check.checkId;
      }
      if (!member(check.status, ["pass", "fail", "not_run"] as const)) issues.push(issue(`${checkPath}.status`, "invalid_check_status", "Unsupported check status"));
    });
    if (member(entry.partClass, PART_CLASS_IDS)) {
      const required = requiredAdmissionCheckIds(entry.partClass);
      for (const requiredId of required) if (!ids.has(requiredId)) issues.push(issue(`${path}.checks`, "missing_required_check", `Missing required admission check ${requiredId}`));
      for (const declaredId of ids) if (!required.includes(declaredId)) issues.push(issue(`${path}.checks`, "extra_admission_check", `Undeclared admission check ${declaredId} is forbidden`));
    }
  }
  if (entry.state === "reviewed") {
    if (entry.authoredBy === null || entry.authoredAt === null || entry.reviewedBy === null || entry.reviewedAt === null || entry.profileContentHash === null) issues.push(issue(path, "incomplete_review", "Reviewed entries require authorship, independent review, and a profile hash"));
    if (entry.authoredBy !== null && entry.authoredBy === entry.reviewedBy) issues.push(issue(`${path}.reviewedBy`, "same_person_review", "Author and reviewer must differ"));
    if (!Array.isArray(entry.checks) || entry.checks.length === 0 || entry.checks.some((check) => !isRecord(check) || check.status !== "pass")) issues.push(issue(`${path}.checks`, "checks_not_passed", "Every required check must pass before review"));
  } else if (entry.reviewedBy !== null || entry.reviewedAt !== null) issues.push(issue(path, "premature_review_metadata", "Non-reviewed entries cannot claim completed review"));
  return value as DesignProfileAdmissionEntryV1;
}

export function validateDesignProfileAdmission(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(input)];
  const ledger = exactKeys(input, LEDGER_KEYS, "", issues);
  if (!ledger) return issues;
  if (ledger.format !== ADMISSION_LEDGER_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${ADMISSION_LEDGER_FORMAT}`));
  if (ledger.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  if (!Array.isArray(ledger.entries)) {
    issues.push(issue("entries", "invalid_array", "Must be an array"));
    return issues;
  }
  const parts = new Set<string>(); const paths = new Set<string>(); const foldedPaths = new Map<string, string>(); let priorPath = "";
  ledger.entries.forEach((value, index) => {
    const entry = validateAdmissionEntry(value, `entries.${index}`, issues);
    if (!entry) return;
    const part = isRecord(entry.part) ? entry.part : undefined;
    if (typeof part?.manufacturerId === "string" && typeof part.manufacturerPartNumber === "string") {
      const partKey = `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
      if (parts.has(partKey)) issues.push(issue(`entries.${index}.part`, "duplicate_part", "Exact manufacturer and MPN identity must be globally unique"));
      parts.add(partKey);
    }
    if (typeof entry.profilePath === "string") {
      if (paths.has(entry.profilePath)) issues.push(issue(`entries.${index}.profilePath`, "duplicate_path", "Profile path must be unique"));
      const foldedPath = entry.profilePath.toLowerCase();
      const priorFoldedPath = foldedPaths.get(foldedPath);
      if (priorFoldedPath !== undefined && priorFoldedPath !== entry.profilePath) issues.push(issue(`entries.${index}.profilePath`, "case_folded_path_collision", "Profile paths must remain unique on case-insensitive filesystems"));
      if (priorPath && compareAscii(priorPath, entry.profilePath) >= 0) issues.push(issue(`entries.${index}.profilePath`, "unstable_order", "Admission entries must be strictly ASCII-sorted by profile path"));
      paths.add(entry.profilePath); foldedPaths.set(foldedPath, entry.profilePath); priorPath = entry.profilePath;
    }
  });
  return issues;
}

export function assertValidDesignProfileAdmission(input: unknown): asserts input is DesignProfileAdmissionLedgerV1 {
  const first = validateDesignProfileAdmission(input)[0];
  if (first) throw new Error(`${first.path || "admission"} [${first.code}]: ${first.message}`);
}

export function parseDesignProfileAdmission(input: unknown): DesignProfileAdmissionLedgerV1 {
  const snapshot = detachedJsonSnapshot(input);
  assertValidDesignProfileAdmission(snapshot);
  return snapshot as DesignProfileAdmissionLedgerV1;
}

export function validateDesignCatalogRelease(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validateCommercialDataBoundary(input)];
  const release = exactKeys(input, RELEASE_KEYS, "", issues);
  if (!release) return issues;
  if (release.format !== CATALOG_RELEASE_FORMAT) issues.push(issue("format", "invalid_format", `Must equal ${CATALOG_RELEASE_FORMAT}`));
  if (release.schemaVersion !== DESIGN_PROFILE_SCHEMA_VERSION) issues.push(issue("schemaVersion", "invalid_version", `Must equal ${DESIGN_PROFILE_SCHEMA_VERSION}`));
  nonEmptyString(release.version, "version", issues); timestamp(release.releasedAt, "releasedAt", issues);
  hash(release.manufacturerRegistryContentHash, "manufacturerRegistryContentHash", issues);
  hash(release.admissionContentHash, "admissionContentHash", issues);
  if (!Array.isArray(release.profiles)) issues.push(issue("profiles", "invalid_array", "Must be an array"));
  else {
    const ids = new Set<string>(); let priorId = "";
    release.profiles.forEach((raw, index) => {
      const path = `profiles.${index}`;
      const ref = exactKeys(raw, RELEASE_PROFILE_KEYS, path, issues);
      if (!ref) return;
      nonEmptyString(ref.profileId, `${path}.profileId`, issues); nonEmptyString(ref.profilePath, `${path}.profilePath`, issues);
      if (!member(ref.partClass, PART_CLASS_IDS)) issues.push(issue(`${path}.partClass`, "invalid_part_class", "Unknown manifest part-class ID"));
      const part = validatePart(ref.part, `${path}.part`, issues); hash(ref.profileContentHash, `${path}.profileContentHash`, issues);
      if (member(ref.partClass, PART_CLASS_IDS) && part && typeof part.manufacturerId === "string" && typeof part.manufacturerPartNumber === "string") {
        const expected = designProfileId(ref.partClass, { manufacturerId: part.manufacturerId, manufacturerPartNumber: part.manufacturerPartNumber });
        if (ref.profileId !== expected || ref.profilePath !== expected) issues.push(issue(path, "profile_identity_mismatch", `profileId and profilePath must both equal ${expected}`));
      }
      if (typeof ref.profileId === "string") {
        if (ids.has(ref.profileId)) issues.push(issue(`${path}.profileId`, "duplicate_profile", "Release profile ID must be unique"));
        if (priorId && compareAscii(priorId, ref.profileId) >= 0) issues.push(issue(`${path}.profileId`, "unstable_order", "Release profiles must be strictly ASCII-sorted"));
        ids.add(ref.profileId); priorId = ref.profileId;
      }
    });
  }
  hash(release.contentHash, "contentHash", issues);
  return issues;
}

export function assertValidDesignCatalogRelease(input: unknown): asserts input is DesignCatalogReleaseV1 {
  const first = validateDesignCatalogRelease(input)[0];
  if (first) throw new Error(`${first.path || "catalogRelease"} [${first.code}]: ${first.message}`);
}

export function parseDesignCatalogRelease(input: unknown): DesignCatalogReleaseV1 {
  const snapshot = detachedJsonSnapshot(input);
  assertValidDesignCatalogRelease(snapshot);
  return snapshot as DesignCatalogReleaseV1;
}

export function validateProfileAdmissionRules(profile: DesignProfileV1): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const validateReviewedEvidence = (fact: ProfileFact<unknown>, path: string): void => {
    if (fact.state !== "reviewed") return;
    fact.evidence.forEach((evidence, index) => {
      if (evidence.kind === "authored_derivation" || evidence.kind === "synthetic_fixture") issues.push(issue(`${path}.evidence.${index}.kind`, "non_primary_review_evidence", "A reviewed fact requires manufacturer evidence or an independent measurement"));
    });
    fact.validFor.forEach((range, rangeIndex) => range.evidence.forEach((evidence, evidenceIndex) => {
      if (evidence.kind === "authored_derivation" || evidence.kind === "synthetic_fixture") issues.push(issue(`${path}.validFor.${rangeIndex}.evidence.${evidenceIndex}.kind`, "non_primary_review_evidence", "A reviewed operating range requires manufacturer evidence or an independent measurement"));
    }));
  };
  for (const [key, fact] of Object.entries(profile.commonFacts)) {
    if (fact.state !== "reviewed") issues.push(issue(`commonFacts.${key}.state`, "not_reviewed", "Common fact must be independently reviewed for admission"));
    validateReviewedEvidence(fact, `commonFacts.${key}`);
  }
  const specs = PART_CLASS_SPECS[profile.partClass].facts;
  for (const [key, spec] of Object.entries(specs)) {
    const fact = (profile.facts as Record<string, ProfileFact<unknown>>)[key];
    if (spec.requiredForAdmission && fact?.state !== "reviewed") issues.push(issue(`facts.${key}.state`, "not_reviewed", "Required class fact must be independently reviewed for admission"));
    if (fact?.state === "reviewed") {
      validateReviewedEvidence(fact, `facts.${key}`);
      for (const parameterId of spec.requiredRangeParameters ?? []) {
        if (!fact.validFor.some((range) => range.parameterId === parameterId)) {
          issues.push(issue(`facts.${key}.validFor`, "missing_required_range", `Reviewed ${key} requires a declared ${parameterId} operating range`));
        }
      }
    }
  }
  if (profile.partClass === "power.external-fet-synchronous-buck-controller") {
    const facts = profile.facts as Record<string, ProfileFact<unknown>>;
    const reviewed = (factId: string) => facts[factId]?.state === "reviewed";
    if (!["currentSenseThresholdMinimum", "currentSenseThresholdTypical", "currentSenseThresholdMaximum"].some(reviewed)) {
      issues.push(issue("facts.currentSenseThresholdTypical.state", "missing_current_sense_capability", "A reviewed controller requires at least one device current-sense threshold"));
    }
    if (!["gateSourceCurrent", "gatePullupResistance"].some(reviewed)) {
      issues.push(issue("facts.gateSourceCurrent.state", "missing_gate_source_capability", "A reviewed controller requires source current or pull-up resistance"));
    }
    if (!["gateSinkCurrent", "gatePulldownResistance"].some(reviewed)) {
      issues.push(issue("facts.gateSinkCurrent.state", "missing_gate_sink_capability", "A reviewed controller requires sink current or pull-down resistance"));
    }
  }
  return issues;
}

export function canonicalDesignProfile(profile: DesignProfileV1): string {
  return canonicalJson(profile);
}

export function designProfileContentHash(profile: DesignProfileV1): `sha256:${string}` {
  return contentHash(profile);
}

export function manufacturerRegistryContentHash(registry: ManufacturerRegistryV1): `sha256:${string}` {
  return contentHash(registry);
}

export function reviewedAdmissionProjection(admission: DesignProfileAdmissionLedgerV1): Pick<DesignProfileAdmissionLedgerV1, "format" | "schemaVersion" | "entries"> {
  return {
    format: admission.format,
    schemaVersion: admission.schemaVersion,
    entries: admission.entries.filter((entry) => entry.state === "reviewed").sort((left, right) => compareAscii(left.profilePath, right.profilePath)),
  };
}

export function admissionContentHash(admission: DesignProfileAdmissionLedgerV1): `sha256:${string}` {
  return contentHash(reviewedAdmissionProjection(admission));
}

export function designCatalogContentHash(
  registry: ManufacturerRegistryV1,
  admission: DesignProfileAdmissionLedgerV1,
  reviewedProfiles: readonly DesignProfileV1[],
): `sha256:${string}` {
  const profiles = [...reviewedProfiles]
    .sort((left, right) => compareAscii(designProfilePath(left.partClass, left.part), designProfilePath(right.partClass, right.part)))
    .map((profile) => canonicalDesignProfile(profile));
  return contentHash({
    manufacturerRegistry: registry,
    admission: reviewedAdmissionProjection(admission),
    profiles,
  });
}

export type DesignProfileFor<ClassId extends PartClassId> = DesignProfileV1<ClassId, FactsFor<ClassId>>;
export type AnyDesignProfile = { [ClassId in PartClassId]: DesignProfileFor<ClassId> }[PartClassId];
export type { AdmissionCheckV1, CatalogProfileRefV1, OperatingRange, ProfileEvidenceRef, ProfileQuantity };
