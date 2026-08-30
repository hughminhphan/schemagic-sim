import {
  calculateOfferSnapshotContentHashV2,
  offerSnapshotRef,
} from "./canonical-v2";
import { canonicalJsonForVersionedSourcing } from "./canonical";
import {
  canonicalCommercialNumberV2,
  canonicalCommercialRationalV2,
  compareRfc3339InstantsV2,
  isStructurallySafeProductUrlV2,
  parseRfc3339InstantV2,
} from "./commercial-primitives-v2";
import { isDistributorId, isManufacturerId } from "./ids";
import { LIFECYCLE_STATUSES, PACKAGING_TYPES } from "./policy";
import { validateSourcingPolicy, type ValidationIssue } from "./validation";
import {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2,
  MAXIMUM_LEAD_KIND_TIE_BREAK_V2,
  OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
  PROVIDER_ERROR_CATALOG_VERSION_V2,
  SOURCING_ADVISORY_WARNING_CATALOG_VERSION,
  SOURCING_POLICY_RULE_CATALOG_VERSION,
  UNKNOWN_OBSERVATION_REASONS,
  aggregateSourcingPolicyStatus,
  renderSourcingAdvisoryWarning,
  type BomLineSourcingMetricsV2,
  type CandidateSourcingEvaluationV2,
  type CandidateSourcingMetricsV2,
  type CandidateSourcingValidationContextV2,
  type DistributorOfferV2,
  type KnownLeadTimeKind,
  type KnownLifecycleSource,
  type KnownLifecycleStatus,
  sourcingPolicyRuleIdV1,
  type OfferSnapshotLineageRef,
  type OfferSnapshotV2Ref,
  type OfferSnapshotV2,
  type SourcingPolicyRuleCodeV1,
  type SourcingPolicyConstraintV2,
} from "./v2";

type UnknownRecord = Record<string, unknown>;

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const KNOWN_LIFECYCLES = LIFECYCLE_STATUSES.filter((value): value is KnownLifecycleStatus => value !== "unknown");
const KNOWN_LIFECYCLE_SOURCES = ["manufacturer", "distributor"] as const satisfies readonly KnownLifecycleSource[];
const KNOWN_LEAD_KINDS = ["manufacturer", "estimated_ship", "factory"] as const satisfies readonly KnownLeadTimeKind[];
const SOURCING_DATA_STATUSES = ["unavailable", "complete", "partial", "stale", "provider_error"] as const;
const POLICY_STATUSES = ["pass", "unknown", "fail"] as const;
const LINE_STATUSES = ["sourced", "unavailable", "policy_rejected", "unknown"] as const;
const SNAPSHOT_PERSISTENCE = ["ephemeral", "user_local", "exportable"] as const;
const PROVIDER_STATUSES = ["complete", "partial", "provider_error"] as const;
const PROVIDER_ERROR_CODES = ["timeout", "rate_limited", "authentication", "upstream", "invalid_response", "unknown"] as const;
const BOTTLENECK_REASONS = ["stock", "policy"] as const;

const PART_KEYS = ["manufacturerId", "manufacturerPartNumber"] as const;
const OBSERVATION_KNOWN_KEYS = ["state", "value"] as const;
const OBSERVATION_UNKNOWN_KEYS = ["state", "reason"] as const;
const PRICE_BREAK_KEYS = ["quantity", "unitPrice"] as const;
const OFFER_V2_KEYS = ["distributor", "distributorSku", "part", "region", "currency", "packaging", "marketplace", "backorderAvailable", "stockQuantity", "minimumOrderQuantity", "orderMultiple", "leadTimeDays", "leadTimeKind", "lifecycle", "lifecycleSource", "lastTimeBuyAt", "priceBreaks", "productUrl", "retrievedAt"] as const;
const SNAPSHOT_REF_KEYS = ["id", "schemaVersion", "contentHash"] as const;
const SNAPSHOT_V2_KEYS = ["schemaVersion", "id", "provider", "requestedParts", "retrievedAt", "expiresAt", "persistence", "evaluationEligibility", "status", "errors", "offers", "lineage", "contentHash"] as const;
const PROVIDER_ERROR_KEYS = ["catalogVersion", "code", "retryable"] as const;
const MONEY_KEYS = ["amount", "currency"] as const;
const BOTTLENECK_KEYS = ["bomLineId", "part", "reason"] as const;
const EVALUATED_OFFER_KEYS = ["snapshot", "distributor", "distributorSku"] as const;
const LINE_V2_KEYS = ["bomLineId", "part", "quantityPerAssembly", "status", "evaluatedOffer", "region", "currency", "packaging", "marketplace", "backorderAvailable", "lifecycle", "lifecycleSource", "leadTimeDays", "leadTimeKind", "stockQuantity", "purchaseQuantity", "buildableQuantity", "extendedCost", "warnings"] as const;
const METRICS_V2_KEYS = ["schemaVersion", "warningCatalogVersion", "status", "policyStatus", "unknownObservationCount", "requestedBuildQuantity", "evaluatedAt", "snapshotRefs", "snapshotAgeSeconds", "earliestSnapshotExpiresAt", "lines", "buildableQuantity", "extendedBomCost", "bottleneckPart", "maximumLeadTimeDays", "maximumLeadTimeKind", "lifecycleCounts", "distributorSplitCount", "singleDistributorComplete", "warnings"] as const;
const CONSTRAINT_V2_KEYS = ["ruleCatalogVersion", "ruleId", "code", "status", "inputs", "explanation", "bomLineId"] as const;
const EVALUATION_V2_KEYS = ["metrics", "policyStatus", "constraints"] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMember<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { parseRfc3339InstantV2(value); return true; } catch { return false; }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function pushUnknownKeys(issues: ValidationIssue[], input: UnknownRecord, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) issues.push({ path: path ? `${path}.${key}` : key, message: "Unknown key" });
  }
}

function pushRequiredString(issues: ValidationIssue[], value: unknown, path: string): void {
  if (typeof value !== "string" || value.trim() === "") issues.push({ path, message: "Must be a non-empty string" });
}

function isSafeDistributorSku(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)
    && !/[\ud800-\udfff]/u.test(value);
}

function partKey(part: { manufacturerId: string; manufacturerPartNumber: string }): string {
  return `${part.manufacturerId}\u0000${part.manufacturerPartNumber}`;
}

function refKey(ref: OfferSnapshotLineageRef): string {
  return `${ref.schemaVersion}\u0000${ref.id}\u0000${ref.contentHash}`;
}

function samePartIdentity(
  left: { manufacturerId: string; manufacturerPartNumber: string },
  right: { manufacturerId: string; manufacturerPartNumber: string },
): boolean {
  return left.manufacturerId === right.manufacturerId
    && left.manufacturerPartNumber === right.manufacturerPartNumber;
}

function sameObservation(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right) || left.state !== right.state) return false;
  if (left.state === "known" && right.state === "known") return left.value === right.value;
  if (left.state === "unknown" && right.state === "unknown") return left.reason === right.reason;
  return false;
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSnapshotRefArray(left: readonly OfferSnapshotV2Ref[], right: readonly OfferSnapshotV2Ref[]): boolean {
  return left.length === right.length && left.every((ref, index) => {
    const expected = right[index];
    return expected !== undefined
      && ref.id === expected.id
      && ref.schemaVersion === expected.schemaVersion
      && ref.contentHash === expected.contentHash;
  });
}

function sortedUniqueStrings(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || compareText(values[index - 1]!, value) < 0);
}

function validatePart(input: unknown, path: string): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Part identity must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, PART_KEYS, path);
  if (!isManufacturerId(input.manufacturerId)) issues.push({ path: `${path}.manufacturerId`, message: "Must be a stable lowercase manufacturer registry ID" });
  if (typeof input.manufacturerPartNumber !== "string" || input.manufacturerPartNumber.length === 0 || /[\ud800-\udfff]/u.test(input.manufacturerPartNumber)) issues.push({ path: `${path}.manufacturerPartNumber`, message: "Must be a non-empty Unicode scalar identity string" });
  return issues;
}

function validateMoney(input: unknown, path: string): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Money must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, MONEY_KEYS, path);
  if (!isFiniteNonNegative(input.amount)) issues.push({ path: `${path}.amount`, message: "Must be a non-negative finite number" });
  if (typeof input.currency !== "string" || !CURRENCY_PATTERN.test(input.currency)) issues.push({ path: `${path}.currency`, message: "Must be a three-letter uppercase currency code" });
  return issues;
}

function validateObservation(
  input: unknown,
  path: string,
  validateKnown: (value: unknown, valuePath: string) => ValidationIssue[],
): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Must be a sourcing observation object" }];
  const issues: ValidationIssue[] = [];
  if (input.state === "known") {
    pushUnknownKeys(issues, input, OBSERVATION_KNOWN_KEYS, path);
    issues.push(...validateKnown(input.value, `${path}.value`));
  } else if (input.state === "unknown") {
    pushUnknownKeys(issues, input, OBSERVATION_UNKNOWN_KEYS, path);
    if (!isMember(input.reason, UNKNOWN_OBSERVATION_REASONS)) issues.push({ path: `${path}.reason`, message: "Unsupported unknown-observation reason" });
  } else {
    pushUnknownKeys(issues, input, [...OBSERVATION_KNOWN_KEYS, "reason"], path);
    issues.push({ path: `${path}.state`, message: "Must be known or unknown" });
  }
  return issues;
}

function noIssueWhen(predicate: boolean, path: string, message: string): ValidationIssue[] {
  return predicate ? [] : [{ path, message }];
}

export function validateDistributorOfferV2(input: unknown, path = "offer"): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Offer must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, OFFER_V2_KEYS, path);
  if (!isDistributorId(input.distributor)) issues.push({ path: `${path}.distributor`, message: "Must be a stable lowercase distributor registry ID" });
  if (!isSafeDistributorSku(input.distributorSku)) issues.push({ path: `${path}.distributorSku`, message: "Must be a non-empty Unicode scalar string without control characters" });
  issues.push(...validatePart(input.part, `${path}.part`));
  issues.push(...validateObservation(input.region, `${path}.region`, (value, valuePath) => noIssueWhen(typeof value === "string" && value.trim() !== "", valuePath, "Must be a non-empty string")));
  issues.push(...validateObservation(input.currency, `${path}.currency`, (value, valuePath) => noIssueWhen(typeof value === "string" && CURRENCY_PATTERN.test(value), valuePath, "Must be a three-letter uppercase currency code")));
  issues.push(...validateObservation(input.packaging, `${path}.packaging`, (value, valuePath) => noIssueWhen(isMember(value, PACKAGING_TYPES), valuePath, "Unsupported packaging type")));
  issues.push(...validateObservation(input.marketplace, `${path}.marketplace`, (value, valuePath) => noIssueWhen(typeof value === "boolean", valuePath, "Must be boolean")));
  issues.push(...validateObservation(input.backorderAvailable, `${path}.backorderAvailable`, (value, valuePath) => noIssueWhen(typeof value === "boolean", valuePath, "Must be boolean")));
  for (const field of ["stockQuantity", "minimumOrderQuantity", "orderMultiple"] as const) {
    if (input[field] !== undefined && !isNonNegativeInteger(input[field])) issues.push({ path: `${path}.${field}`, message: "Must be a non-negative integer" });
  }
  if (input.minimumOrderQuantity === 0) issues.push({ path: `${path}.minimumOrderQuantity`, message: "Must be greater than zero when present" });
  if (input.orderMultiple === 0) issues.push({ path: `${path}.orderMultiple`, message: "Must be greater than zero when present" });
  issues.push(...validateObservation(input.leadTimeDays, `${path}.leadTimeDays`, (value, valuePath) => noIssueWhen(isFiniteNonNegative(value), valuePath, "Must be a non-negative finite number")));
  issues.push(...validateObservation(input.leadTimeKind, `${path}.leadTimeKind`, (value, valuePath) => noIssueWhen(isMember(value, KNOWN_LEAD_KINDS), valuePath, "Unsupported known lead-time kind")));
  issues.push(...validateObservation(input.lifecycle, `${path}.lifecycle`, (value, valuePath) => noIssueWhen(isMember(value, KNOWN_LIFECYCLES), valuePath, "Unsupported known lifecycle status")));
  issues.push(...validateObservation(input.lifecycleSource, `${path}.lifecycleSource`, (value, valuePath) => noIssueWhen(isMember(value, KNOWN_LIFECYCLE_SOURCES), valuePath, "Unsupported known lifecycle source")));
  if (input.lastTimeBuyAt !== undefined && !isTimestamp(input.lastTimeBuyAt)) issues.push({ path: `${path}.lastTimeBuyAt`, message: "Must be an RFC 3339 timestamp" });
  if (!Array.isArray(input.priceBreaks)) issues.push({ path: `${path}.priceBreaks`, message: "Must be an array" });
  else {
    let prior = 0;
    input.priceBreaks.forEach((priceBreak, index) => {
      const pricePath = `${path}.priceBreaks.${index}`;
      if (!isRecord(priceBreak)) {
        issues.push({ path: pricePath, message: "Price break must be an object" });
        return;
      }
      pushUnknownKeys(issues, priceBreak, PRICE_BREAK_KEYS, pricePath);
      if (!isPositiveInteger(priceBreak.quantity)) issues.push({ path: `${pricePath}.quantity`, message: "Must be a positive integer" });
      else if (priceBreak.quantity <= prior) issues.push({ path: `${pricePath}.quantity`, message: "Price break quantities must be strictly increasing" });
      if (isPositiveInteger(priceBreak.quantity)) prior = priceBreak.quantity;
      if (!isFiniteNonNegative(priceBreak.unitPrice)) issues.push({ path: `${pricePath}.unitPrice`, message: "Must be a non-negative finite number" });
    });
  }
  if (isRecord(input.currency) && input.currency.state === "unknown" && Array.isArray(input.priceBreaks) && input.priceBreaks.length > 0) {
    issues.push({ path: `${path}.priceBreaks`, message: "Must be empty when currency is unknown" });
  }
  if (!isStructurallySafeProductUrlV2(input.productUrl)) issues.push({ path: `${path}.productUrl`, message: "Must be a structurally safe unverified HTTPS product URL" });
  if (!isTimestamp(input.retrievedAt)) issues.push({ path: `${path}.retrievedAt`, message: "Must be an RFC 3339 timestamp" });
  return issues;
}

export function parseDistributorOfferV2(input: unknown): DistributorOfferV2 {
  const issue = validateDistributorOfferV2(input)[0];
  if (issue) throw new Error(`${issue.path}: ${issue.message}`);
  return cloneJson(input) as DistributorOfferV2;
}

export function assertValidDistributorOfferV2(input: unknown): asserts input is DistributorOfferV2 {
  const issue = validateDistributorOfferV2(input)[0];
  if (issue) throw new Error(`${issue.path || "offer"}: ${issue.message}`);
}

function validateSnapshotLineageRef(input: unknown, path: string): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Snapshot ref must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, SNAPSHOT_REF_KEYS, path);
  pushRequiredString(issues, input.id, `${path}.id`);
  if (input.schemaVersion !== 1 && input.schemaVersion !== 2) issues.push({ path: `${path}.schemaVersion`, message: "Must equal 1 or 2" });
  if (typeof input.contentHash !== "string" || !CONTENT_HASH_PATTERN.test(input.contentHash)) issues.push({ path: `${path}.contentHash`, message: "Must be a sha256-prefixed lowercase hex digest" });
  if (input.schemaVersion === 2 && typeof input.contentHash === "string" && CONTENT_HASH_PATTERN.test(input.contentHash)) {
    const expected = `snapshot:v2:${input.contentHash}`;
    if (input.id !== expected) issues.push({ path: `${path}.id`, message: "V2 snapshot ref ID must be derived from contentHash" });
  }
  return issues;
}

export function validateOfferSnapshotRef(input: unknown): ValidationIssue[] {
  return validateSnapshotLineageRef(input, "snapshotRef");
}

export function parseOfferSnapshotRef(input: unknown): OfferSnapshotLineageRef {
  const issue = validateOfferSnapshotRef(input)[0];
  if (issue) throw new Error(`${issue.path}: ${issue.message}`);
  return cloneJson(input) as OfferSnapshotLineageRef;
}

export function validateOfferSnapshotV2Ref(input: unknown): ValidationIssue[] {
  const issues = validateSnapshotLineageRef(input, "snapshotRef");
  if (isRecord(input) && input.schemaVersion !== 2) issues.push({ path: "snapshotRef.schemaVersion", message: "Native V2 refs must equal schemaVersion 2" });
  return issues;
}

export function parseOfferSnapshotV2Ref(input: unknown): OfferSnapshotV2Ref {
  const issue = validateOfferSnapshotV2Ref(input)[0];
  if (issue) throw new Error(`${issue.path}: ${issue.message}`);
  return cloneJson(input) as OfferSnapshotV2Ref;
}

export function validateOfferSnapshotV2(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) return [{ path: "", message: "Offer snapshot V2 must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, SNAPSHOT_V2_KEYS, "");
  if (input.schemaVersion !== OFFER_SNAPSHOT_SCHEMA_VERSION_V2) issues.push({ path: "schemaVersion", message: `Must equal ${OFFER_SNAPSHOT_SCHEMA_VERSION_V2}` });
  pushRequiredString(issues, input.id, "id");
  if (!isDistributorId(input.provider)) issues.push({ path: "provider", message: "Must be a stable lowercase distributor registry ID" });
  const requested = new Set<string>();
  const requestedOrder: string[] = [];
  if (!Array.isArray(input.requestedParts) || input.requestedParts.length === 0) issues.push({ path: "requestedParts", message: "Must contain at least one exact manufacturer and MPN identity" });
  else input.requestedParts.forEach((part, index) => {
    issues.push(...validatePart(part, `requestedParts.${index}`));
    if (!isRecord(part) || !isManufacturerId(part.manufacturerId) || typeof part.manufacturerPartNumber !== "string") return;
    const key = partKey({ manufacturerId: part.manufacturerId, manufacturerPartNumber: part.manufacturerPartNumber });
    if (requested.has(key)) issues.push({ path: `requestedParts.${index}`, message: "Duplicate requested part identity" });
    requested.add(key);
    requestedOrder.push(key);
  });
  if (!sortedUniqueStrings(requestedOrder)) issues.push({ path: "requestedParts", message: "Must be sorted by exact part identity" });
  if (!isTimestamp(input.retrievedAt)) issues.push({ path: "retrievedAt", message: "Must be an RFC 3339 timestamp" });
  if (!isTimestamp(input.expiresAt)) issues.push({ path: "expiresAt", message: "Must be an RFC 3339 timestamp" });
  if (isTimestamp(input.retrievedAt) && isTimestamp(input.expiresAt) && compareRfc3339InstantsV2(input.expiresAt, input.retrievedAt) <= 0) issues.push({ path: "expiresAt", message: "Must be later than retrievedAt" });
  if (!isMember(input.persistence, SNAPSHOT_PERSISTENCE)) issues.push({ path: "persistence", message: "Unsupported persistence policy" });
  if (input.evaluationEligibility !== "native_v2" && input.evaluationEligibility !== "legacy_audit_only") issues.push({ path: "evaluationEligibility", message: "Unsupported evaluation eligibility" });
  if (!isMember(input.status, PROVIDER_STATUSES)) issues.push({ path: "status", message: "Unsupported provider request status" });
  if (!Array.isArray(input.errors)) issues.push({ path: "errors", message: "Must be an array" });
  else {
    const errorSortKeys: string[] = [];
    input.errors.forEach((error, index) => {
      const errorPath = `errors.${index}`;
      if (!isRecord(error)) {
        issues.push({ path: errorPath, message: "Provider error must be an object" });
        return;
      }
      pushUnknownKeys(issues, error, PROVIDER_ERROR_KEYS, errorPath);
      if (error.catalogVersion !== PROVIDER_ERROR_CATALOG_VERSION_V2) issues.push({ path: `${errorPath}.catalogVersion`, message: `Must equal ${PROVIDER_ERROR_CATALOG_VERSION_V2}` });
      if (!isMember(error.code, PROVIDER_ERROR_CODES)) issues.push({ path: `${errorPath}.code`, message: "Unsupported provider error code" });
      if (typeof error.retryable !== "boolean") issues.push({ path: `${errorPath}.retryable`, message: "Must be boolean" });
      if (typeof error.code === "string" && typeof error.retryable === "boolean") {
        errorSortKeys.push(`${error.code}\u0000${Number(error.retryable)}`);
      }
    });
    if (!sortedUniqueStrings(errorSortKeys)) issues.push({ path: "errors", message: "Must be deterministically sorted and contain no duplicate errors" });
  }
  if (input.status === "complete" && Array.isArray(input.errors) && input.errors.length > 0) issues.push({ path: "errors", message: "A complete snapshot cannot contain provider errors" });
  if ((input.status === "partial" || input.status === "provider_error") && Array.isArray(input.errors) && input.errors.length === 0) issues.push({ path: "errors", message: `${input.status} must include at least one provider error` });
  if (!Array.isArray(input.lineage)) issues.push({ path: "lineage", message: "Must be an array" });
  else {
    const keys: string[] = [];
    input.lineage.forEach((ref, index) => {
      issues.push(...validateSnapshotLineageRef(ref, `lineage.${index}`));
      if (isRecord(ref) && (ref.schemaVersion === 1 || ref.schemaVersion === 2) && typeof ref.id === "string" && typeof ref.contentHash === "string") keys.push(`${ref.schemaVersion}\u0000${ref.id}\u0000${ref.contentHash}`);
      if (isRecord(ref) && ref.schemaVersion === input.schemaVersion && ref.id === input.id && ref.contentHash === input.contentHash) issues.push({ path: `lineage.${index}`, message: "Snapshot lineage cannot self-reference" });
    });
    if (!sortedUniqueStrings(keys)) issues.push({ path: "lineage", message: "Must be sorted and contain no duplicate refs" });
  }
  if (!Array.isArray(input.offers)) issues.push({ path: "offers", message: "Must be an array" });
  else {
    const skuKeys: string[] = [];
    const sortKeys: string[] = [];
    input.offers.forEach((offer, index) => {
      issues.push(...validateDistributorOfferV2(offer, `offers.${index}`));
      if (!isRecord(offer)) return;
      if (isDistributorId(input.provider) && offer.distributor !== input.provider) issues.push({ path: `offers.${index}.distributor`, message: "Offer distributor must match snapshot provider" });
      if (typeof offer.distributorSku === "string") {
        const skuKey = `${String(offer.distributor)}\u0000${offer.distributorSku}`;
        if (skuKeys.includes(skuKey)) issues.push({ path: `offers.${index}.distributorSku`, message: "Duplicate distributor SKU in snapshot" });
        skuKeys.push(skuKey);
      }
      if (isRecord(offer.part) && isManufacturerId(offer.part.manufacturerId) && typeof offer.part.manufacturerPartNumber === "string") {
        const key = partKey({ manufacturerId: offer.part.manufacturerId, manufacturerPartNumber: offer.part.manufacturerPartNumber });
        if (!requested.has(key)) issues.push({ path: `offers.${index}.part`, message: "Offer part identity was not requested" });
        sortKeys.push(`${String(offer.distributor)}\u0000${String(offer.distributorSku)}\u0000${key}`);
      }
      if (isTimestamp(offer.retrievedAt) && isTimestamp(input.retrievedAt) && compareRfc3339InstantsV2(offer.retrievedAt, input.retrievedAt) !== 0) issues.push({ path: `offers.${index}.retrievedAt`, message: "Offer retrieval time must equal snapshot retrieval instant" });
    });
    if (!sortedUniqueStrings(sortKeys)) issues.push({ path: "offers", message: "Must be sorted by distributor, SKU, and exact part identity" });
  }
  if (typeof input.contentHash !== "string" || !CONTENT_HASH_PATTERN.test(input.contentHash)) {
    issues.push({ path: "contentHash", message: "Must be a sha256-prefixed lowercase hex digest" });
  } else {
    try {
      const expectedHash = calculateOfferSnapshotContentHashV2(input as unknown as OfferSnapshotV2);
      if (input.contentHash !== expectedHash) issues.push({ path: "contentHash", message: "Does not match the canonical V2 snapshot payload" });
      const expectedId = `snapshot:v2:${input.contentHash}`;
      if (input.id !== expectedId) issues.push({ path: "id", message: "Must equal snapshot:v2:${contentHash}" });
    } catch {
      issues.push({ path: "contentHash", message: "Canonical V2 snapshot payload could not be hashed" });
    }
  }
  return issues;
}

export function assertValidOfferSnapshotV2(input: unknown): asserts input is OfferSnapshotV2 {
  const issue = validateOfferSnapshotV2(input)[0];
  if (issue) throw new Error(`${issue.path || "snapshot"}: ${issue.message}`);
}

export function parseOfferSnapshotV2(input: unknown): OfferSnapshotV2 {
  assertValidOfferSnapshotV2(input);
  return cloneJson(input);
}

function validateWarnings(input: unknown, path: string): ValidationIssue[] {
  if (!Array.isArray(input) || input.some((warning) => typeof warning !== "string" || warning.trim() === "")) return [{ path, message: "Must be an array of non-empty strings" }];
  if (!sortedUniqueStrings(input as string[])) return [{ path, message: "Must be lexically sorted and contain no duplicates" }];
  return [];
}

function validateLineObservationSet(line: UnknownRecord, path: string, issues: ValidationIssue[]): void {
  const observationFields = ["region", "currency", "packaging", "marketplace", "backorderAvailable", "lifecycle", "lifecycleSource", "leadTimeDays", "leadTimeKind"] as const;
  const offerDerivedFields = ["stockQuantity", "purchaseQuantity", "buildableQuantity", "extendedCost"] as const;
  if (line.evaluatedOffer !== undefined) {
    for (const field of observationFields) if (line[field] === undefined) issues.push({ path: `${path}.${field}`, message: "Required when evaluatedOffer is present" });
  } else {
    for (const field of observationFields) if (line[field] !== undefined) issues.push({ path: `${path}.${field}`, message: "Must be omitted without evaluatedOffer" });
    for (const field of offerDerivedFields) if (line[field] !== undefined) issues.push({ path: `${path}.${field}`, message: "Must be omitted without evaluatedOffer" });
  }
}

function observationUnknown(input: unknown): boolean {
  return isRecord(input) && input.state === "unknown";
}

function observationKnownValue<T>(input: unknown): T | undefined {
  return isRecord(input) && input.state === "known" ? input.value as T : undefined;
}

function lifecycleCountsForLines(lines: readonly UnknownRecord[]): Record<string, number> {
  const counts: Record<string, number> = { active: 0, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 };
  for (const line of lines) {
    const lifecycle = observationKnownValue<string>(line.lifecycle);
    if (lifecycle !== undefined && Object.hasOwn(counts, lifecycle)) counts[lifecycle] = counts[lifecycle]! + 1;
    else counts.unknown = counts.unknown! + 1;
  }
  return counts;
}

function validateLineV2(input: unknown, path: string, snapshotRefKeys: ReadonlySet<string>): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "BOM line metric must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, LINE_V2_KEYS, path);
  pushRequiredString(issues, input.bomLineId, `${path}.bomLineId`);
  issues.push(...validatePart(input.part, `${path}.part`));
  if (!isPositiveInteger(input.quantityPerAssembly)) issues.push({ path: `${path}.quantityPerAssembly`, message: "Must be a positive integer" });
  if (!isMember(input.status, LINE_STATUSES)) issues.push({ path: `${path}.status`, message: "Unsupported BOM line sourcing status" });
  if ((input.status === "sourced" || input.status === "unknown" || input.status === "policy_rejected") && !isRecord(input.evaluatedOffer)) issues.push({ path: `${path}.evaluatedOffer`, message: "Required for evaluated line status" });
  if (input.status === "unavailable" && input.evaluatedOffer !== undefined) issues.push({ path: `${path}.evaluatedOffer`, message: "Must be omitted for an unavailable line" });
  if (input.evaluatedOffer !== undefined) {
    if (!isRecord(input.evaluatedOffer)) issues.push({ path: `${path}.evaluatedOffer`, message: "Must be an object" });
    else {
      pushUnknownKeys(issues, input.evaluatedOffer, EVALUATED_OFFER_KEYS, `${path}.evaluatedOffer`);
      issues.push(...validateSnapshotLineageRef(input.evaluatedOffer.snapshot, `${path}.evaluatedOffer.snapshot`));
      if (isRecord(input.evaluatedOffer.snapshot) && input.evaluatedOffer.snapshot.schemaVersion !== 2) issues.push({ path: `${path}.evaluatedOffer.snapshot.schemaVersion`, message: "Native V2 metrics require a V2 snapshot ref" });
      if (isRecord(input.evaluatedOffer.snapshot) && input.evaluatedOffer.snapshot.schemaVersion !== undefined && typeof input.evaluatedOffer.snapshot.id === "string" && typeof input.evaluatedOffer.snapshot.contentHash === "string") {
        const key = `${String(input.evaluatedOffer.snapshot.schemaVersion)}\u0000${input.evaluatedOffer.snapshot.id}\u0000${input.evaluatedOffer.snapshot.contentHash}`;
        if (!snapshotRefKeys.has(key)) issues.push({ path: `${path}.evaluatedOffer.snapshot`, message: "Must exactly match a metrics snapshot ref" });
      }
      if (!isDistributorId(input.evaluatedOffer.distributor)) issues.push({ path: `${path}.evaluatedOffer.distributor`, message: "Must be a stable lowercase distributor registry ID" });
      pushRequiredString(issues, input.evaluatedOffer.distributorSku, `${path}.evaluatedOffer.distributorSku`);
    }
  }
  validateLineObservationSet(input, path, issues);
  if (input.region !== undefined) issues.push(...validateObservation(input.region, `${path}.region`, (value, valuePath) => noIssueWhen(typeof value === "string" && value.trim() !== "", valuePath, "Must be a non-empty string")));
  if (input.currency !== undefined) issues.push(...validateObservation(input.currency, `${path}.currency`, (value, valuePath) => noIssueWhen(typeof value === "string" && CURRENCY_PATTERN.test(value), valuePath, "Must be a three-letter uppercase currency code")));
  if (input.packaging !== undefined) issues.push(...validateObservation(input.packaging, `${path}.packaging`, (value, valuePath) => noIssueWhen(isMember(value, PACKAGING_TYPES), valuePath, "Unsupported packaging type")));
  if (input.marketplace !== undefined) issues.push(...validateObservation(input.marketplace, `${path}.marketplace`, (value, valuePath) => noIssueWhen(typeof value === "boolean", valuePath, "Must be boolean")));
  if (input.backorderAvailable !== undefined) issues.push(...validateObservation(input.backorderAvailable, `${path}.backorderAvailable`, (value, valuePath) => noIssueWhen(typeof value === "boolean", valuePath, "Must be boolean")));
  if (input.lifecycle !== undefined) issues.push(...validateObservation(input.lifecycle, `${path}.lifecycle`, (value, valuePath) => noIssueWhen(isMember(value, KNOWN_LIFECYCLES), valuePath, "Unsupported known lifecycle status")));
  if (input.lifecycleSource !== undefined) issues.push(...validateObservation(input.lifecycleSource, `${path}.lifecycleSource`, (value, valuePath) => noIssueWhen(isMember(value, KNOWN_LIFECYCLE_SOURCES), valuePath, "Unsupported known lifecycle source")));
  if (input.leadTimeDays !== undefined) issues.push(...validateObservation(input.leadTimeDays, `${path}.leadTimeDays`, (value, valuePath) => noIssueWhen(isFiniteNonNegative(value), valuePath, "Must be a non-negative finite number")));
  if (input.leadTimeKind !== undefined) issues.push(...validateObservation(input.leadTimeKind, `${path}.leadTimeKind`, (value, valuePath) => noIssueWhen(isMember(value, KNOWN_LEAD_KINDS), valuePath, "Unsupported known lead-time kind")));
  for (const field of ["stockQuantity", "purchaseQuantity", "buildableQuantity"] as const) if (input[field] !== undefined && !isNonNegativeInteger(input[field])) issues.push({ path: `${path}.${field}`, message: "Must be a non-negative integer" });
  if (input.extendedCost !== undefined) issues.push(...validateMoney(input.extendedCost, `${path}.extendedCost`));
  issues.push(...validateWarnings(input.warnings, `${path}.warnings`));
  return issues;
}

export function validateCandidateSourcingMetricsV2(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) return [{ path: "", message: "Candidate sourcing metrics V2 must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, METRICS_V2_KEYS, "");
  if (input.schemaVersion !== CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2) issues.push({ path: "schemaVersion", message: `Must equal ${CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2}` });
  if (input.warningCatalogVersion !== SOURCING_ADVISORY_WARNING_CATALOG_VERSION) issues.push({ path: "warningCatalogVersion", message: `Must equal ${SOURCING_ADVISORY_WARNING_CATALOG_VERSION}` });
  if (!isMember(input.status, SOURCING_DATA_STATUSES)) issues.push({ path: "status", message: "Unsupported sourcing data status" });
  if (!isMember(input.policyStatus, POLICY_STATUSES)) issues.push({ path: "policyStatus", message: "Unsupported sourcing policy status" });
  if (!isNonNegativeInteger(input.unknownObservationCount)) issues.push({ path: "unknownObservationCount", message: "Must be a non-negative integer" });
  if (!isPositiveInteger(input.requestedBuildQuantity)) issues.push({ path: "requestedBuildQuantity", message: "Must be a positive integer" });
  if (!isTimestamp(input.evaluatedAt)) issues.push({ path: "evaluatedAt", message: "Must be an RFC 3339 timestamp" });
  const snapshotRefKeys = new Set<string>();
  const snapshotRefOrder: string[] = [];
  if (!Array.isArray(input.snapshotRefs)) issues.push({ path: "snapshotRefs", message: "Must be an array" });
  else input.snapshotRefs.forEach((ref, index) => {
    issues.push(...validateSnapshotLineageRef(ref, `snapshotRefs.${index}`));
    if (isRecord(ref) && ref.schemaVersion !== 2) issues.push({ path: `snapshotRefs.${index}.schemaVersion`, message: "Native V2 metrics require V2 snapshot refs" });
    if (isRecord(ref) && ref.schemaVersion === 2 && typeof ref.id === "string" && typeof ref.contentHash === "string") {
      const key = `${ref.schemaVersion}\u0000${ref.id}\u0000${ref.contentHash}`;
      snapshotRefKeys.add(key);
      snapshotRefOrder.push(key);
    }
  });
  if (snapshotRefKeys.size !== snapshotRefOrder.length || !sortedUniqueStrings(snapshotRefOrder)) issues.push({ path: "snapshotRefs", message: "Must be sorted and contain no duplicate refs" });
  if (input.snapshotAgeSeconds !== undefined && !isFiniteNonNegative(input.snapshotAgeSeconds)) issues.push({ path: "snapshotAgeSeconds", message: "Must be a non-negative finite number" });
  if (input.earliestSnapshotExpiresAt !== undefined && !isTimestamp(input.earliestSnapshotExpiresAt)) issues.push({ path: "earliestSnapshotExpiresAt", message: "Must be an RFC 3339 timestamp" });
  const lineRecords: UnknownRecord[] = [];
  const lineIds = new Set<string>();
  const lineOrder: string[] = [];
  if (!Array.isArray(input.lines)) issues.push({ path: "lines", message: "Must be an array" });
  else input.lines.forEach((line, index) => {
    issues.push(...validateLineV2(line, `lines.${index}`, snapshotRefKeys));
    if (isRecord(line)) {
      lineRecords.push(line);
      if (typeof line.bomLineId === "string") {
        if (lineIds.has(line.bomLineId)) issues.push({ path: `lines.${index}.bomLineId`, message: "Duplicate BOM line ID" });
        lineIds.add(line.bomLineId);
        lineOrder.push(line.bomLineId);
      }
    }
  });
  if (!sortedUniqueStrings(lineOrder)) issues.push({ path: "lines", message: "Must be sorted and unique by bomLineId" });
  const observedUnknownCount = lineRecords.reduce((count, line) => count + [line.region, line.currency, line.packaging, line.marketplace, line.backorderAvailable, line.lifecycle, line.lifecycleSource, line.leadTimeDays, line.leadTimeKind].filter(observationUnknown).length, 0);
  if (isNonNegativeInteger(input.unknownObservationCount) && input.unknownObservationCount !== observedUnknownCount) issues.push({ path: "unknownObservationCount", message: "Does not match unknown evaluated-offer observations" });
  if (isRecord(input.lifecycleCounts)) pushUnknownKeys(issues, input.lifecycleCounts, LIFECYCLE_STATUSES, "lifecycleCounts");
  const expectedLifecycleCounts = lifecycleCountsForLines(lineRecords);
  const lifecycleCounts = isRecord(input.lifecycleCounts) ? input.lifecycleCounts : undefined;
  if (lifecycleCounts === undefined || !LIFECYCLE_STATUSES.every((status) => isNonNegativeInteger(lifecycleCounts[status]))) issues.push({ path: "lifecycleCounts", message: "Must contain a non-negative integer for every lifecycle status" });
  else if (!LIFECYCLE_STATUSES.every((status) => lifecycleCounts[status] === expectedLifecycleCounts[status])) issues.push({ path: "lifecycleCounts", message: "Does not match line lifecycle observations" });
  const sourcedLines = lineRecords.filter((line) => line.status === "sourced");
  const allLinesSourced = lineRecords.length > 0 && sourcedLines.length === lineRecords.length;
  const allBuildable = allLinesSourced && sourcedLines.every((line) => isNonNegativeInteger(line.buildableQuantity));
  if (input.buildableQuantity !== undefined) {
    if (!isNonNegativeInteger(input.buildableQuantity)) issues.push({ path: "buildableQuantity", message: "Must be a non-negative integer" });
    else if (lineRecords.length === 0 || sourcedLines.length !== lineRecords.length || sourcedLines.some((line) => !isNonNegativeInteger(line.buildableQuantity))) issues.push({ path: "buildableQuantity", message: "Requires buildable quantity for every sourced line" });
    else if (input.buildableQuantity !== Math.min(...sourcedLines.map((line) => line.buildableQuantity as number))) issues.push({ path: "buildableQuantity", message: "Must equal the minimum line buildable quantity" });
  }
  if (allBuildable && input.buildableQuantity === undefined) issues.push({ path: "buildableQuantity", message: "Required when every sourced line has known buildability" });
  const allCosted = allLinesSourced && sourcedLines.every((line) => isRecord(line.extendedCost));
  if (input.extendedBomCost !== undefined) {
    issues.push(...validateMoney(input.extendedBomCost, "extendedBomCost"));
    if (isRecord(input.extendedBomCost) && sourcedLines.length === lineRecords.length && sourcedLines.length > 0 && sourcedLines.every((line) => isRecord(line.extendedCost))) {
      const currencies = new Set(sourcedLines.map((line) => (line.extendedCost as UnknownRecord).currency));
      const total = [...sourcedLines]
        .sort((left, right) => compareText(String(left.bomLineId), String(right.bomLineId)))
        .reduce((sum, line) => canonicalCommercialNumberV2(sum + Number((line.extendedCost as UnknownRecord).amount)), 0);
      if (currencies.size !== 1 || !currencies.has(input.extendedBomCost.currency) || !isFiniteNonNegative(input.extendedBomCost.amount) || input.extendedBomCost.amount !== total) issues.push({ path: "extendedBomCost", message: "Must exactly equal the deterministic sum of same-currency sourced line costs" });
    } else issues.push({ path: "extendedBomCost", message: "Requires extended cost for every sourced line" });
  }
  if (allCosted && input.extendedBomCost === undefined) issues.push({ path: "extendedBomCost", message: "Required when every sourced line has a known extended cost" });
  const leadLines = sourcedLines.filter((line) => observationKnownValue<number>(line.leadTimeDays) !== undefined && observationKnownValue<KnownLeadTimeKind>(line.leadTimeKind) !== undefined);
  const allLeadKnown = allLinesSourced && leadLines.length === lineRecords.length;
  if (input.maximumLeadTimeDays !== undefined || input.maximumLeadTimeKind !== undefined) {
    if (!isFiniteNonNegative(input.maximumLeadTimeDays)) issues.push({ path: "maximumLeadTimeDays", message: "Must be a non-negative finite number" });
    if (!isMember(input.maximumLeadTimeKind, KNOWN_LEAD_KINDS)) issues.push({ path: "maximumLeadTimeKind", message: "Unsupported known lead-time kind" });
    if (leadLines.length !== lineRecords.length || lineRecords.length === 0) issues.push({ path: "maximumLeadTimeDays", message: "Requires known lead time for every sourced line" });
    else {
      const selectedMaximum = [...leadLines].sort((left, right) => (
        observationKnownValue<number>(right.leadTimeDays)! - observationKnownValue<number>(left.leadTimeDays)!
        || MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(observationKnownValue<KnownLeadTimeKind>(left.leadTimeKind)!)
          - MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(observationKnownValue<KnownLeadTimeKind>(right.leadTimeKind)!)
        || compareText(String(left.bomLineId), String(right.bomLineId))
      ))[0]!;
      const maximum = observationKnownValue<number>(selectedMaximum.leadTimeDays)!;
      const maximumKind = observationKnownValue<KnownLeadTimeKind>(selectedMaximum.leadTimeKind)!;
      if (input.maximumLeadTimeDays !== maximum || input.maximumLeadTimeKind !== maximumKind) issues.push({ path: "maximumLeadTimeDays", message: "Must equal the deterministic maximum known lead time and kind" });
    }
  }
  if (allLeadKnown && input.maximumLeadTimeDays === undefined && input.maximumLeadTimeKind === undefined) issues.push({ path: "maximumLeadTimeDays", message: "Required when every sourced line has known lead days and kind" });
  if (input.distributorSplitCount !== undefined || input.singleDistributorComplete !== undefined) {
    const distributors = new Set(sourcedLines.map((line) => isRecord(line.evaluatedOffer) ? line.evaluatedOffer.distributor : undefined).filter((value): value is string => typeof value === "string"));
    if (!isNonNegativeInteger(input.distributorSplitCount) || input.distributorSplitCount !== distributors.size) issues.push({ path: "distributorSplitCount", message: "Must equal sourced-line distributor count" });
    const expectedSingle = lineRecords.length > 0 && sourcedLines.length === lineRecords.length && distributors.size === 1;
    if (typeof input.singleDistributorComplete !== "boolean" || input.singleDistributorComplete !== expectedSingle) issues.push({ path: "singleDistributorComplete", message: "Must reflect complete one-distributor sourcing" });
  }
  if (allLinesSourced && input.distributorSplitCount === undefined && input.singleDistributorComplete === undefined) {
    issues.push({ path: "distributorSplitCount", message: "Distributor aggregates are required when every line is sourced" });
  }
  if (!allLinesSourced && (input.distributorSplitCount !== undefined || input.singleDistributorComplete !== undefined)) {
    issues.push({ path: "distributorSplitCount", message: "Distributor aggregates must be omitted unless every line is sourced" });
  }
  if (input.bottleneckPart !== undefined) {
    if (!isRecord(input.bottleneckPart)) issues.push({ path: "bottleneckPart", message: "Must be an object" });
    else {
      pushUnknownKeys(issues, input.bottleneckPart, BOTTLENECK_KEYS, "bottleneckPart");
      pushRequiredString(issues, input.bottleneckPart.bomLineId, "bottleneckPart.bomLineId");
      issues.push(...validatePart(input.bottleneckPart.part, "bottleneckPart.part"));
      if (!isMember(input.bottleneckPart.reason, BOTTLENECK_REASONS)) issues.push({ path: "bottleneckPart.reason", message: "Unsupported bottleneck reason" });
      const bottleneckPart = input.bottleneckPart;
      const line = lineRecords.find((candidate) => candidate.bomLineId === bottleneckPart.bomLineId);
      if (line === undefined || !isRecord(line.part) || !isRecord(bottleneckPart.part)
        || typeof line.part.manufacturerId !== "string" || typeof line.part.manufacturerPartNumber !== "string"
        || typeof bottleneckPart.part.manufacturerId !== "string" || typeof bottleneckPart.part.manufacturerPartNumber !== "string"
        || !samePartIdentity(
          { manufacturerId: line.part.manufacturerId, manufacturerPartNumber: line.part.manufacturerPartNumber },
          { manufacturerId: bottleneckPart.part.manufacturerId, manufacturerPartNumber: bottleneckPart.part.manufacturerPartNumber },
        )) issues.push({ path: "bottleneckPart", message: "Must reference an exact metrics line identity" });
    }
  }
  const bottleneckDerivable = lineRecords.length > 0
    && lineRecords.every((line) => isNonNegativeInteger(line.buildableQuantity) && line.status !== "unknown");
  if (bottleneckDerivable) {
    const expectedBottleneck = [...lineRecords].sort((left, right) => (
      Number(left.buildableQuantity) - Number(right.buildableQuantity)
      || compareText(String(left.bomLineId), String(right.bomLineId))
    ))[0]!;
    const expectedReason = expectedBottleneck.status === "sourced"
      ? "stock"
      : expectedBottleneck.status === "unavailable" ? "unavailable" : "policy";
    if (!isRecord(input.bottleneckPart)) issues.push({ path: "bottleneckPart", message: "Required when every line has known buildability" });
    else if (input.bottleneckPart.bomLineId !== expectedBottleneck.bomLineId || input.bottleneckPart.reason !== expectedReason) {
      issues.push({ path: "bottleneckPart", message: "Must equal the deterministic minimum-buildability line and status-derived reason" });
    }
  } else if (input.bottleneckPart !== undefined) {
    issues.push({ path: "bottleneckPart", message: "Must be omitted unless every line has known buildability and a resolved line status" });
  }
  issues.push(...validateWarnings(input.warnings, "warnings"));
  return issues;
}

export function assertValidCandidateSourcingMetricsV2(input: unknown): asserts input is CandidateSourcingMetricsV2 {
  const issue = validateCandidateSourcingMetricsV2(input)[0];
  if (issue) throw new Error(`${issue.path || "metrics"}: ${issue.message}`);
}

export function parseCandidateSourcingMetricsV2(input: unknown): CandidateSourcingMetricsV2 {
  assertValidCandidateSourcingMetricsV2(input);
  return cloneJson(input);
}

const RULE_CODES = ["data_status", "offer_available", "region", "currency", "packaging", "marketplace", "lifecycle", "lead_time", "stock", "single_distributor", "migration"] as const satisfies readonly SourcingPolicyRuleCodeV1[];

function constraintInputIssues(code: SourcingPolicyRuleCodeV1, input: unknown, path: string): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Rule inputs must be an object" }];
  const issues: ValidationIssue[] = [];
  const close = (keys: readonly string[]) => pushUnknownKeys(issues, input, keys, path);
  if (input.code !== code) issues.push({ path: `${path}.code`, message: "Must equal constraint code" });
  switch (code) {
    case "data_status":
      close(["code", "dataStatus"]);
      if (!isMember(input.dataStatus, SOURCING_DATA_STATUSES)) issues.push({ path: `${path}.dataStatus`, message: "Unsupported sourcing data status" });
      break;
    case "offer_available":
      close(["code", "proof"]);
      if (!isMember(input.proof, ["offer_present", "fresh_complete_no_offer", "not_proven"] as const)) issues.push({ path: `${path}.proof`, message: "Unsupported offer proof" });
      break;
    case "region":
      close(["code", "observed", "required"]);
      issues.push(...validateObservation(input.observed, `${path}.observed`, (value, valuePath) => noIssueWhen(typeof value === "string" && value.trim() !== "", valuePath, "Must be a non-empty region")));
      pushRequiredString(issues, input.required, `${path}.required`);
      break;
    case "currency":
      close(["code", "observed", "required"]);
      issues.push(...validateObservation(input.observed, `${path}.observed`, (value, valuePath) => noIssueWhen(typeof value === "string" && CURRENCY_PATTERN.test(value), valuePath, "Must be an uppercase currency")));
      if (typeof input.required !== "string" || !CURRENCY_PATTERN.test(input.required)) issues.push({ path: `${path}.required`, message: "Must be an uppercase currency" });
      break;
    case "packaging":
      close(["code", "observed", "allowed"]);
      issues.push(...validateObservation(input.observed, `${path}.observed`, (value, valuePath) => noIssueWhen(isMember(value, PACKAGING_TYPES), valuePath, "Unsupported packaging")));
      issues.push(...sortedEnumArrayIssues(input.allowed, PACKAGING_TYPES, `${path}.allowed`));
      break;
    case "marketplace":
      close(["code", "observed", "allowed"]);
      issues.push(...validateObservation(input.observed, `${path}.observed`, (value, valuePath) => noIssueWhen(typeof value === "boolean", valuePath, "Must be boolean")));
      if (input.allowed !== false) issues.push({ path: `${path}.allowed`, message: "Must equal false" });
      break;
    case "lifecycle":
      close(["code", "observed", "allowed"]);
      issues.push(...validateObservation(input.observed, `${path}.observed`, (value, valuePath) => noIssueWhen(isMember(value, KNOWN_LIFECYCLES), valuePath, "Unsupported lifecycle")));
      issues.push(...sortedEnumArrayIssues(input.allowed, KNOWN_LIFECYCLES, `${path}.allowed`));
      break;
    case "lead_time":
      close(["code", "days", "kind", "maximumDays"]);
      issues.push(...validateObservation(input.days, `${path}.days`, (value, valuePath) => noIssueWhen(isFiniteNonNegative(value), valuePath, "Must be non-negative finite days")));
      issues.push(...validateObservation(input.kind, `${path}.kind`, (value, valuePath) => noIssueWhen(isMember(value, KNOWN_LEAD_KINDS), valuePath, "Unsupported lead kind")));
      if (!isFiniteNonNegative(input.maximumDays)) issues.push({ path: `${path}.maximumDays`, message: "Must be non-negative finite days" });
      break;
    case "stock":
      close(["code", "stockQuantity", "purchaseQuantity", "minimumStock", "backorderAvailable", "allowBackorder"]);
      if (input.stockQuantity !== null && !isNonNegativeInteger(input.stockQuantity)) issues.push({ path: `${path}.stockQuantity`, message: "Must be a safe integer or null" });
      if (!isPositiveInteger(input.purchaseQuantity)) issues.push({ path: `${path}.purchaseQuantity`, message: "Must be a positive safe integer" });
      if (input.minimumStock !== null && !isNonNegativeInteger(input.minimumStock)) issues.push({ path: `${path}.minimumStock`, message: "Must be a safe integer or null" });
      issues.push(...validateObservation(input.backorderAvailable, `${path}.backorderAvailable`, (value, valuePath) => noIssueWhen(typeof value === "boolean", valuePath, "Must be boolean")));
      if (typeof input.allowBackorder !== "boolean") issues.push({ path: `${path}.allowBackorder`, message: "Must be boolean" });
      break;
    case "single_distributor":
      close(["code", "selectedDistributor", "observedDistributors"]);
      if (!isDistributorId(input.selectedDistributor)) issues.push({ path: `${path}.selectedDistributor`, message: "Must be a stable distributor ID" });
      if (!Array.isArray(input.observedDistributors) || input.observedDistributors.some((value) => !isDistributorId(value)) || !sortedUniqueStrings(input.observedDistributors as string[])) issues.push({ path: `${path}.observedDistributors`, message: "Must be sorted unique distributor IDs" });
      break;
    case "migration":
      close(["code", "reason"]);
      if (input.reason !== "reevaluation_required" && input.reason !== "source_unavailable") issues.push({ path: `${path}.reason`, message: "Unsupported migration reason" });
      break;
  }
  return issues;
}

function sortedEnumArrayIssues<T extends string>(input: unknown, values: readonly T[], path: string): ValidationIssue[] {
  if (!Array.isArray(input) || input.some((value) => !isMember(value, values)) || !sortedUniqueStrings(input as string[])) return [{ path, message: "Must be a sorted unique supported-value array" }];
  return [];
}

function validateConstraintAt(input: unknown, path: string): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Sourcing policy constraint must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, CONSTRAINT_V2_KEYS, path);
  if (input.ruleCatalogVersion !== SOURCING_POLICY_RULE_CATALOG_VERSION) issues.push({ path: `${path}.ruleCatalogVersion`, message: `Must equal ${SOURCING_POLICY_RULE_CATALOG_VERSION}` });
  if (!isMember(input.code, RULE_CODES)) issues.push({ path: `${path}.code`, message: "Unsupported sourcing rule code" });
  if (!isMember(input.status, POLICY_STATUSES)) issues.push({ path: `${path}.status`, message: "Must be pass, unknown, or fail" });
  if (isMember(input.code, RULE_CODES)) {
    const expectedRuleId = sourcingPolicyRuleIdV1(input.code);
    if (input.ruleId !== expectedRuleId) issues.push({ path: `${path}.ruleId`, message: "Must be derived exactly from code" });
    const candidateScope = input.code === "data_status" || input.code === "single_distributor";
    if (candidateScope && input.bomLineId !== undefined) issues.push({ path: `${path}.bomLineId`, message: "Candidate-level rule must omit bomLineId" });
    if (!candidateScope) pushRequiredString(issues, input.bomLineId, `${path}.bomLineId`);
    issues.push(...constraintInputIssues(input.code, input.inputs, `${path}.inputs`));
    if (isMember(input.status, POLICY_STATUSES) && isRecord(input.inputs)) {
      try {
        const expectedExplanation = canonicalJsonForVersionedSourcing({ ruleCatalogVersion: 1, ruleId: expectedRuleId, code: input.code, status: input.status, inputs: input.inputs, bomLineId: candidateScope ? null : input.bomLineId });
        if (input.explanation !== expectedExplanation) issues.push({ path: `${path}.explanation`, message: "Must equal the exact canonical rule rendering" });
      } catch { issues.push({ path: `${path}.explanation`, message: "Rule inputs could not be canonically rendered" }); }
    }
  }
  return issues;
}

export function validateSourcingPolicyConstraintV2(input: unknown): ValidationIssue[] {
  return validateConstraintAt(input, "constraint");
}

export function parseSourcingPolicyConstraintV2(input: unknown): SourcingPolicyConstraintV2 {
  const issue = validateSourcingPolicyConstraintV2(input)[0];
  if (issue) throw new Error(`${issue.path}: ${issue.message}`);
  return cloneJson(input) as SourcingPolicyConstraintV2;
}

function constraintSortKey(constraint: SourcingPolicyConstraintV2): string {
  return `${constraint.bomLineId ?? ""}\u0000${constraint.ruleId}\u0000${constraint.explanation}`;
}

export function validateCandidateSourcingEvaluationV2(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) return [{ path: "", message: "Candidate sourcing evaluation V2 must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, EVALUATION_V2_KEYS, "");
  issues.push(...validateCandidateSourcingMetricsV2(input.metrics).map((issue) => ({ ...issue, path: issue.path ? `metrics.${issue.path}` : "metrics" })));
  if (!isMember(input.policyStatus, POLICY_STATUSES)) issues.push({ path: "policyStatus", message: "Must be pass, unknown, or fail" });
  const constraints: SourcingPolicyConstraintV2[] = [];
  if (!Array.isArray(input.constraints) || input.constraints.length === 0) issues.push({ path: "constraints", message: "Must contain at least one sourcing constraint" });
  else input.constraints.forEach((constraint, index) => {
    issues.push(...validateConstraintAt(constraint, `constraints.${index}`));
    if (isRecord(constraint) && typeof constraint.ruleId === "string" && isMember(constraint.status, POLICY_STATUSES) && typeof constraint.explanation === "string") constraints.push(constraint as unknown as SourcingPolicyConstraintV2);
  });
  if (constraints.length > 0) {
    const keys = constraints.map(constraintSortKey);
    if (!sortedUniqueStrings(keys)) issues.push({ path: "constraints", message: "Must be deterministically sorted" });
    const identities = constraints.map((constraint) => `${constraint.bomLineId ?? ""}\u0000${constraint.ruleId}`);
    if (new Set(identities).size !== identities.length) issues.push({ path: "constraints", message: "Duplicate (bomLineId, ruleId) pair" });
    const aggregate = aggregateSourcingPolicyStatus(constraints);
    if (input.policyStatus !== aggregate) issues.push({ path: "policyStatus", message: "Must equal aggregate constraint status" });
    if (isRecord(input.metrics) && input.metrics.policyStatus !== aggregate) issues.push({ path: "metrics.policyStatus", message: "Must equal aggregate constraint status" });
  }
  return issues;
}

export function parseCandidateSourcingEvaluationV2(input: unknown): CandidateSourcingEvaluationV2 {
  const issue = validateCandidateSourcingEvaluationV2(input)[0];
  if (issue) throw new Error(`${issue.path || "evaluation"}: ${issue.message}`);
  return cloneJson(input) as CandidateSourcingEvaluationV2;
}

function expectedAdvisories(line: BomLineSourcingMetricsV2, policy: CandidateSourcingValidationContextV2["policy"]): string[] {
  const warnings: string[] = [];
  const leadKind = line.leadTimeKind?.state === "known" ? line.leadTimeKind.value : undefined;
  if (leadKind === "manufacturer") warnings.push(renderSourcingAdvisoryWarning({ code: "manufacturer_lead_not_delivery" }));
  if (leadKind === "factory") warnings.push(renderSourcingAdvisoryWarning({ code: "factory_lead_not_delivery" }));
  const backorder = line.backorderAvailable?.state === "known" ? line.backorderAvailable.value : undefined;
  if (policy.allowBackorder && backorder === true) {
    if (line.stockQuantity === undefined) warnings.push(renderSourcingAdvisoryWarning({ code: "stock_unknown_backorder" }));
    else if (line.purchaseQuantity !== undefined && line.stockQuantity < line.purchaseQuantity) warnings.push(renderSourcingAdvisoryWarning({ code: "stock_short_backorder", stockQuantity: line.stockQuantity, purchaseQuantity: line.purchaseQuantity }));
  }
  if (line.purchaseQuantity !== undefined && line.extendedCost === undefined) warnings.push(renderSourcingAdvisoryWarning({ code: "price_break_unavailable", purchaseQuantity: line.purchaseQuantity }));
  return warnings;
}

function prefixIssues(issues: readonly ValidationIssue[], prefix: string): ValidationIssue[] {
  return issues.map((issue) => ({ ...issue, path: issue.path ? `${prefix}.${issue.path}` : prefix }));
}

function aggregateStatuses(statuses: readonly ("pass" | "unknown" | "fail")[]): "pass" | "unknown" | "fail" {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("unknown")) return "unknown";
  return "pass";
}

function observedEquality(observation: unknown, expected: unknown): "pass" | "unknown" | "fail" {
  if (!isRecord(observation) || observation.state === "unknown") return "unknown";
  return observation.state === "known" && observation.value === expected ? "pass" : "fail";
}

function expectedPolicyStatusForLine(
  line: BomLineSourcingMetricsV2,
  offer: DistributorOfferV2,
  policy: CandidateSourcingValidationContextV2["policy"],
): "pass" | "unknown" | "fail" {
  const statuses: Array<"pass" | "unknown" | "fail"> = [
    policy.distributors.includes(offer.distributor) ? "pass" : "fail",
    observedEquality(offer.region, policy.region),
    observedEquality(offer.currency, policy.currency),
  ];
  if (policy.packaging !== undefined) {
    statuses.push(offer.packaging.state === "unknown"
      ? "unknown"
      : policy.packaging.includes(offer.packaging.value) ? "pass" : "fail");
  }
  if (!policy.allowMarketplace) {
    statuses.push(offer.marketplace.state === "unknown"
      ? "unknown"
      : offer.marketplace.value ? "fail" : "pass");
  }
  statuses.push(offer.lifecycle.state === "unknown"
    ? "unknown"
    : offer.lifecycle.value === "obsolete" || !policy.allowedLifecycle.includes(offer.lifecycle.value) ? "fail" : "pass");
  if (policy.maximumLeadTimeDays !== undefined) {
    statuses.push(offer.leadTimeDays.state === "unknown" || offer.leadTimeKind.state === "unknown"
      ? "unknown"
      : offer.leadTimeDays.value <= policy.maximumLeadTimeDays ? "pass" : "fail");
  }
  if (policy.minimumStock !== undefined) {
    statuses.push(offer.stockQuantity === undefined
      ? "unknown"
      : offer.stockQuantity >= policy.minimumStock ? "pass" : "fail");
  }
  const requiredQuantity = policy.buildQuantity * line.quantityPerAssembly;
  const purchaseQuantity = Math.ceil(Math.max(requiredQuantity, offer.minimumOrderQuantity ?? 1) / (offer.orderMultiple ?? 1)) * (offer.orderMultiple ?? 1);
  if (offer.stockQuantity === undefined) {
    statuses.push(policy.allowBackorder && offer.backorderAvailable.state === "known" && offer.backorderAvailable.value
      ? "pass"
      : "unknown");
  } else if (offer.stockQuantity < purchaseQuantity) {
    if (!policy.allowBackorder) statuses.push("fail");
    else statuses.push(offer.backorderAvailable.state === "unknown"
      ? "unknown"
      : offer.backorderAvailable.value ? "pass" : "fail");
  }
  return aggregateStatuses(statuses);
}

interface DerivedTransportStateV2 {
  status: CandidateSourcingMetricsV2["status"];
  snapshotAgeSeconds?: number;
  earliestSnapshotExpiresAt?: string;
}

function snapshotIsStale(
  snapshot: OfferSnapshotV2,
  evaluatedAtNs: bigint,
  maximumSnapshotAgeSeconds: number,
): boolean {
  const providerExpiry = parseRfc3339InstantV2(snapshot.expiresAt).epochNanoseconds;
  const policyExpiry = parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds + BigInt(maximumSnapshotAgeSeconds) * 1_000_000_000n;
  return evaluatedAtNs > (providerExpiry < policyExpiry ? providerExpiry : policyExpiry);
}

function deriveTransportState(
  snapshots: readonly OfferSnapshotV2[],
  policy: CandidateSourcingValidationContextV2["policy"],
  evaluatedAt: string,
): DerivedTransportStateV2 {
  const relevant = snapshots.filter((snapshot) => policy.distributors.includes(snapshot.provider));
  if (relevant.length === 0) return { status: "unavailable" };
  const evaluatedAtNs = parseRfc3339InstantV2(evaluatedAt).epochNanoseconds;
  const ages = relevant.map((snapshot) => canonicalCommercialRationalV2(evaluatedAtNs - parseRfc3339InstantV2(snapshot.retrievedAt).epochNanoseconds, 1_000_000_000n));
  const expires = relevant.map((snapshot) => snapshot.expiresAt)
    .sort((left, right) => compareRfc3339InstantsV2(left, right) || compareText(left, right));
  const derived = {
    snapshotAgeSeconds: Math.max(...ages),
    earliestSnapshotExpiresAt: expires[0]!,
  };
  const allProviderErrors = relevant.every((snapshot) => snapshot.status === "provider_error" && snapshot.offers.length === 0);
  if (allProviderErrors) return { status: "provider_error", ...derived };
  if (relevant.some((snapshot) => snapshotIsStale(snapshot, evaluatedAtNs, policy.maximumSnapshotAgeSeconds))) return { status: "stale", ...derived };
  const completeCoverage = policy.distributors.every((distributor) => relevant.some((snapshot) => snapshot.provider === distributor));
  if (!completeCoverage || relevant.some((snapshot) => snapshot.status !== "complete")) return { status: "partial", ...derived };
  return { status: "complete", ...derived };
}

function expectedSingleDistributorStatus(
  lines: readonly BomLineSourcingMetricsV2[],
  lineStatuses: ReadonlyMap<string, "pass" | "unknown" | "fail">,
): "pass" | "unknown" | "fail" {
  const distributors = new Set(lines
    .map((line) => line.evaluatedOffer?.distributor)
    .filter((value): value is string => value !== undefined));
  if (distributors.size > 1) return "fail";
  if (lines.length === 0 || lines.some((line) => line.evaluatedOffer === undefined)) return "unknown";
  return aggregateStatuses(lines.map((line) => lineStatuses.get(line.bomLineId) ?? "unknown"));
}

export function validateCandidateSourcingEvaluationContextV2(
  evaluation: Readonly<CandidateSourcingEvaluationV2>,
  context: Readonly<CandidateSourcingValidationContextV2>,
): ValidationIssue[] {
  const issues = validateCandidateSourcingEvaluationV2(evaluation);
  if (typeof context.candidateId !== "string" || context.candidateId.trim() === "") issues.push({ path: "context.candidateId", message: "Must be a non-empty stable electrical candidate ID" });
  issues.push(...prefixIssues(validateSourcingPolicy(context.policy), "context.policy"));
  if (!isTimestamp(context.evaluatedAt)) issues.push({ path: "context.evaluatedAt", message: "Must be an RFC 3339 timestamp" });
  context.snapshots.forEach((snapshot, index) => issues.push(...prefixIssues(validateOfferSnapshotV2(snapshot), `context.snapshots.${index}`)));
  context.snapshots.forEach((snapshot, index) => {
    if (snapshot.evaluationEligibility !== "native_v2") issues.push({ path: `context.snapshots.${index}.evaluationEligibility`, message: "Native evaluation requires native_v2 snapshots" });
  });
  if (!isMember(context.expectedAuthorizationUse, ["display", "user_local_storage", "download_export", "public_share"] as const)) issues.push({ path: "context.expectedAuthorizationUse", message: "Unsupported authorization use" });
  if (typeof context.authorizationVerifier?.validateOperation !== "function") issues.push({ path: "context.authorizationVerifier", message: "Must provide an authorization verifier" });
  else {
    try {
      issues.push(...context.authorizationVerifier.validateOperation(context.authorizationOperation, context.expectedAuthorizationUse, context.snapshots, context.authorizations).map((issue) => ({ ...issue, path: issue.path ? `context.${issue.path}` : "context.authorizationOperation" })));
    } catch {
      issues.push({ path: "context.authorizationOperation", message: "Authorization verifier rejected the operation" });
    }
  }
  if (isTimestamp(context.evaluatedAt)) {
    context.snapshots.forEach((snapshot, index) => {
      if (isTimestamp(snapshot.retrievedAt) && compareRfc3339InstantsV2(snapshot.retrievedAt, context.evaluatedAt) > 0) {
        issues.push({ path: `context.snapshots.${index}.retrievedAt`, message: "Must not be later than context evaluatedAt" });
      }
    });
  }
  if (evaluation.metrics.evaluatedAt !== context.evaluatedAt) issues.push({ path: "metrics.evaluatedAt", message: "Must exactly equal context evaluatedAt" });
  if (evaluation.metrics.requestedBuildQuantity !== context.policy.buildQuantity) issues.push({ path: "metrics.requestedBuildQuantity", message: "Must exactly equal policy buildQuantity" });
  const derivedTransport = deriveTransportState(context.snapshots, context.policy, context.evaluatedAt);
  if (evaluation.metrics.status !== derivedTransport.status) issues.push({ path: "metrics.status", message: "Must equal transport status derived from exact snapshots, provider coverage, and freshness" });
  if (evaluation.metrics.snapshotAgeSeconds !== derivedTransport.snapshotAgeSeconds) issues.push({ path: "metrics.snapshotAgeSeconds", message: "Must equal the maximum age of policy-selected snapshots" });
  if (evaluation.metrics.earliestSnapshotExpiresAt !== derivedTransport.earliestSnapshotExpiresAt) issues.push({ path: "metrics.earliestSnapshotExpiresAt", message: "Must equal the earliest policy-selected snapshot expiry" });
  context.components.forEach((component, index) => {
    pushRequiredString(issues, component.id, `context.components.${index}.id`);
    issues.push(...validatePart(component.part, `context.components.${index}.part`));
    if (!isPositiveInteger(component.quantityPerAssembly)) issues.push({ path: `context.components.${index}.quantityPerAssembly`, message: "Must be a positive integer" });
  });
  const componentMap = new Map(context.components.map((component) => [component.id, component]));
  if (componentMap.size !== context.components.length) issues.push({ path: "context.components", message: "Component IDs must be unique" });
  if (evaluation.metrics.lines.length !== context.components.length) issues.push({ path: "metrics.lines", message: "Must contain exactly one line per context component" });
  for (const [index, line] of evaluation.metrics.lines.entries()) {
    const component = componentMap.get(line.bomLineId);
    if (component === undefined) issues.push({ path: `metrics.lines.${index}.bomLineId`, message: "Does not resolve to a context component" });
    else {
      if (!samePartIdentity(line.part, component.part)) issues.push({ path: `metrics.lines.${index}.part`, message: "Must exactly equal context component part identity" });
      if (line.quantityPerAssembly !== component.quantityPerAssembly) issues.push({ path: `metrics.lines.${index}.quantityPerAssembly`, message: "Must exactly equal context component quantity" });
    }
  }
  const contextRefs = context.snapshots.map(offerSnapshotRef).sort((left, right) => compareText(refKey(left), refKey(right)));
  if (new Set(contextRefs.map(refKey)).size !== contextRefs.length) issues.push({ path: "context.snapshots", message: "Snapshot refs must be unique" });
  if (!sameSnapshotRefArray(evaluation.metrics.snapshotRefs, contextRefs)) issues.push({ path: "metrics.snapshotRefs", message: "Must exactly equal all context snapshot refs" });
  const snapshotByRef = new Map(context.snapshots.map((snapshot) => [refKey(offerSnapshotRef(snapshot)), snapshot]));
  const resolvedOfferByLine = new Map<string, DistributorOfferV2>();
  const migratedLineIds = new Set(evaluation.constraints
    .filter((constraint) => constraint.code === "migration" && constraint.bomLineId !== undefined)
    .map((constraint) => constraint.bomLineId!));
  for (const [index, line] of evaluation.metrics.lines.entries()) {
    if (line.evaluatedOffer === undefined) continue;
    const snapshot = snapshotByRef.get(refKey(line.evaluatedOffer.snapshot));
    if (snapshot === undefined) {
      issues.push({ path: `metrics.lines.${index}.evaluatedOffer.snapshot`, message: "Does not resolve to an exact context snapshot" });
      continue;
    }
    const offer = snapshot.offers.find((candidate) => candidate.distributor === line.evaluatedOffer!.distributor && candidate.distributorSku === line.evaluatedOffer!.distributorSku && samePartIdentity(candidate.part, line.part));
    if (offer === undefined) {
      issues.push({ path: `metrics.lines.${index}.evaluatedOffer`, message: "Does not resolve to an exact offer for the BOM part" });
      continue;
    }
    resolvedOfferByLine.set(line.bomLineId, offer);
    for (const field of ["region", "currency", "packaging", "marketplace", "backorderAvailable", "lifecycle", "lifecycleSource", "leadTimeDays", "leadTimeKind"] as const) if (!sameObservation(line[field], offer[field])) issues.push({ path: `metrics.lines.${index}.${field}`, message: "Must exactly equal evaluated offer observation" });
    if (line.stockQuantity !== offer.stockQuantity) issues.push({ path: `metrics.lines.${index}.stockQuantity`, message: "Must exactly equal evaluated offer stock" });
    const requiredQuantity = context.policy.buildQuantity * line.quantityPerAssembly;
    if (!Number.isSafeInteger(requiredQuantity)) {
      issues.push({ path: `metrics.lines.${index}.purchaseQuantity`, message: "Required unit quantity exceeds safe-integer range" });
      continue;
    }
    const minimumQuantity = Math.max(requiredQuantity, offer.minimumOrderQuantity ?? 1);
    const orderMultiple = offer.orderMultiple ?? 1;
    const expectedPurchaseQuantity = Math.ceil(minimumQuantity / orderMultiple) * orderMultiple;
    if (!Number.isSafeInteger(expectedPurchaseQuantity)) {
      issues.push({ path: `metrics.lines.${index}.purchaseQuantity`, message: "Purchase quantity exceeds safe-integer range" });
      continue;
    }
    if (line.purchaseQuantity !== undefined && line.purchaseQuantity !== expectedPurchaseQuantity) {
      issues.push({ path: `metrics.lines.${index}.purchaseQuantity`, message: "Must equal build quantity adjusted for MOQ and order multiple" });
    }
    if (!migratedLineIds.has(line.bomLineId) && line.purchaseQuantity === undefined) {
      issues.push({ path: `metrics.lines.${index}.purchaseQuantity`, message: "A native evaluated line must include its exact purchase quantity" });
    }
    const expectedBuildableQuantity = offer.stockQuantity === undefined
      ? undefined
      : Math.floor(offer.stockQuantity / line.quantityPerAssembly);
    if (line.buildableQuantity !== undefined && line.buildableQuantity !== expectedBuildableQuantity) {
      issues.push({ path: `metrics.lines.${index}.buildableQuantity`, message: "Must equal evaluated stock divided by quantity per assembly" });
    }
    if (!migratedLineIds.has(line.bomLineId) && expectedBuildableQuantity !== undefined && line.buildableQuantity === undefined) {
      issues.push({ path: `metrics.lines.${index}.buildableQuantity`, message: "A native evaluated line must include its derived buildable quantity when stock is known" });
    }
    const priceBreak = offer.priceBreaks.filter((candidate) => candidate.quantity <= expectedPurchaseQuantity).at(-1);
    const currency = offer.currency.state === "known" ? offer.currency.value : undefined;
    const expectedAmount = priceBreak === undefined ? undefined : canonicalCommercialNumberV2(expectedPurchaseQuantity * priceBreak.unitPrice);
    if (line.extendedCost !== undefined) {
      if (currency === undefined || line.extendedCost.currency !== currency) issues.push({ path: `metrics.lines.${index}.extendedCost.currency`, message: "Must equal known evaluated offer currency" });
      if (expectedAmount === undefined || line.extendedCost.amount !== expectedAmount) {
        issues.push({ path: `metrics.lines.${index}.extendedCost.amount`, message: "Must exactly equal the applicable evaluated-offer price break" });
      }
    }
    if (!migratedLineIds.has(line.bomLineId) && currency !== undefined && expectedAmount !== undefined && line.extendedCost === undefined) {
      issues.push({ path: `metrics.lines.${index}.extendedCost`, message: "A native evaluated line must include its exact derivable cost" });
    }
  }
  const lineIds = new Set(context.components.map((component) => component.id));
  for (const [index, constraint] of evaluation.constraints.entries()) if (constraint.bomLineId !== undefined && !lineIds.has(constraint.bomLineId)) issues.push({ path: `constraints.${index}.bomLineId`, message: "Does not resolve to the context BOM" });
  const expectedWarningsByLine = new Map<string, string[]>();
  const linePolicyStatusById = new Map<string, "pass" | "unknown" | "fail">();
  for (const [index, line] of evaluation.metrics.lines.entries()) {
    const lineConstraints = evaluation.constraints.filter((constraint) => constraint.bomLineId === line.bomLineId);
    if (lineConstraints.length === 0) {
      issues.push({ path: `constraints`, message: `Missing constraint for BOM line ${line.bomLineId}` });
      continue;
    }
    const lineStatus = aggregateSourcingPolicyStatus(lineConstraints);
    linePolicyStatusById.set(line.bomLineId, lineStatus);
    if (line.evaluatedOffer === undefined) {
      if (line.status !== "unavailable") issues.push({ path: `metrics.lines.${index}.status`, message: "A line without evaluatedOffer must be unavailable" });
      if (lineStatus === "pass") issues.push({ path: `constraints`, message: `Unavailable BOM line ${line.bomLineId} cannot have pass constraints` });
    } else {
      const expectedStatus = lineStatus === "pass" ? "sourced" : lineStatus === "unknown" ? "unknown" : "policy_rejected";
      if (line.status !== expectedStatus) issues.push({ path: `metrics.lines.${index}.status`, message: `Must equal ${expectedStatus} from line constraints` });
      const resolvedOffer = resolvedOfferByLine.get(line.bomLineId);
      const migrationConstraint = lineConstraints.some((constraint) => constraint.code === "migration");
      if (resolvedOffer !== undefined && !migrationConstraint) {
        const expectedPolicyStatus = expectedPolicyStatusForLine(line, resolvedOffer, context.policy);
        if (lineStatus !== expectedPolicyStatus) issues.push({ path: "constraints", message: `BOM line ${line.bomLineId} status does not match the supplied policy and exact offer observations` });
      }
    }
    const expectedLineWarnings = [...lineConstraints.filter((constraint) => constraint.status !== "pass").map((constraint) => constraint.explanation), ...expectedAdvisories(line, context.policy)].sort(compareText);
    const uniqueLineWarnings = [...new Set(expectedLineWarnings)];
    expectedWarningsByLine.set(line.bomLineId, uniqueLineWarnings);
    if (!sameStringArray(line.warnings, uniqueLineWarnings)) issues.push({ path: `metrics.lines.${index}.warnings`, message: "Must exactly equal non-pass constraint explanations plus catalog advisories" });
  }
  const dataStatusConstraint = evaluation.constraints.find((constraint) => constraint.bomLineId === undefined && constraint.code === "data_status");
  const isMigrationEvaluation = migratedLineIds.size > 0;
  if (dataStatusConstraint === undefined) issues.push({ path: "constraints", message: "Must include candidate-level sourcing.data_status constraint" });
  else {
    const expectedStatus = isMigrationEvaluation ? "unknown" : derivedTransport.status === "complete" ? "pass" : "unknown";
    if (dataStatusConstraint.status !== expectedStatus) issues.push({ path: "constraints", message: "sourcing.data_status status must equal the exact derived transport state" });
    if (dataStatusConstraint.inputs.code !== "data_status" || dataStatusConstraint.inputs.dataStatus !== evaluation.metrics.status) issues.push({ path: "constraints", message: "sourcing.data_status inputs must identify the exact metrics transport state" });
  }
  const singleDistributorConstraint = evaluation.constraints.find((constraint) => constraint.bomLineId === undefined && constraint.code === "single_distributor");
  if (context.policy.mode === "single_distributor" && !isMigrationEvaluation) {
    const expectedStatus = expectedSingleDistributorStatus(evaluation.metrics.lines, linePolicyStatusById);
    if (singleDistributorConstraint === undefined) issues.push({ path: "constraints", message: "single_distributor policy requires a candidate-level sourcing.policy.single_distributor constraint" });
    else {
      if (singleDistributorConstraint.status !== expectedStatus) issues.push({ path: "constraints", message: "Single-distributor constraint status does not match evaluated offers" });
    }
  } else if (context.policy.mode !== "single_distributor" && singleDistributorConstraint !== undefined) {
    issues.push({ path: "constraints", message: "sourcing.policy.single_distributor is not applicable in any_selected mode" });
  }
  const expectedCandidateWarnings = [...new Set([
    ...evaluation.metrics.lines.flatMap((line) => expectedWarningsByLine.get(line.bomLineId) ?? []),
    ...evaluation.constraints.filter((constraint) => constraint.bomLineId === undefined && constraint.status !== "pass").map((constraint) => constraint.explanation),
  ])].sort(compareText);
  if (!sameStringArray(evaluation.metrics.warnings, expectedCandidateWarnings)) issues.push({ path: "metrics.warnings", message: "Must exactly equal line warnings plus candidate-level non-pass explanations" });
  return issues;
}
