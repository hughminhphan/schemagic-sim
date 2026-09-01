import { calculateOfferSnapshotContentHash } from "./canonical";
import { isDistributorId, isManufacturerId } from "./ids";
import {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION,
  type CandidateSourcingMetrics,
  type LifecycleCounts,
} from "./metrics";
import {
  LIFECYCLE_STATUSES,
  PACKAGING_TYPES,
  SOURCING_POLICY_SCHEMA_VERSION,
  type SourcingPolicy,
} from "./policy";
import {
  OFFER_SNAPSHOT_SCHEMA_VERSION,
  type OfferSnapshot,
} from "./snapshot";

export interface ValidationIssue {
  path: string;
  message: string;
}

type UnknownRecord = Record<string, unknown>;

const ALLOWED_LIFECYCLE = ["active", "nrnd", "last_time_buy", "unknown"] as const;
const LEAD_TIME_KINDS = ["manufacturer", "estimated_ship", "factory", "unknown"] as const;
const LIFECYCLE_SOURCES = ["manufacturer", "distributor", "unknown"] as const;
const SNAPSHOT_PERSISTENCE = ["ephemeral", "user_local", "exportable"] as const;
const PROVIDER_STATUSES = ["complete", "partial", "provider_error"] as const;
const PROVIDER_ERROR_CODES = ["timeout", "rate_limited", "authentication", "upstream", "invalid_response", "unknown"] as const;
const SOURCING_DATA_STATUSES = ["unavailable", "complete", "partial", "stale", "provider_error"] as const;
const BOM_LINE_STATUSES = ["sourced", "unavailable", "policy_rejected", "unknown"] as const;
const BOTTLENECK_REASONS = ["stock", "lead_time", "unavailable", "policy"] as const;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const RFC3339_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

const POLICY_KEYS = ["schemaVersion", "distributors", "mode", "buildQuantity", "region", "currency", "allowedLifecycle", "minimumStock", "maximumLeadTimeDays", "allowBackorder", "allowMarketplace", "packaging", "maximumSnapshotAgeSeconds"] as const;
const PART_IDENTITY_KEYS = ["manufacturerId", "manufacturerPartNumber"] as const;
const OFFER_KEYS = ["distributor", "distributorSku", "part", "region", "currency", "packaging", "marketplace", "backorderAvailable", "stockQuantity", "minimumOrderQuantity", "orderMultiple", "leadTimeDays", "leadTimeKind", "lifecycle", "lifecycleSource", "lastTimeBuyAt", "priceBreaks", "productUrl", "retrievedAt"] as const;
const PRICE_BREAK_KEYS = ["quantity", "unitPrice"] as const;
const SNAPSHOT_KEYS = ["schemaVersion", "id", "provider", "requestedParts", "retrievedAt", "expiresAt", "persistence", "status", "errors", "offers", "contentHash"] as const;
const PROVIDER_ERROR_KEYS = ["code", "message", "retryable"] as const;
const METRICS_KEYS = ["schemaVersion", "status", "requestedBuildQuantity", "evaluatedAt", "snapshotIds", "snapshotAgeSeconds", "earliestSnapshotExpiresAt", "lines", "buildableQuantity", "extendedBomCost", "bottleneckPart", "maximumLeadTimeDays", "maximumLeadTimeKind", "lifecycleCounts", "distributorSplitCount", "singleDistributorComplete", "warnings"] as const;
const LINE_KEYS = ["bomLineId", "part", "quantityPerAssembly", "status", "selectedOffer", "packaging", "lifecycle", "stockQuantity", "purchaseQuantity", "buildableQuantity", "extendedCost", "leadTimeDays", "leadTimeKind", "warnings"] as const;
const SELECTED_OFFER_KEYS = ["snapshotId", "distributor", "distributorSku"] as const;
const MONEY_KEYS = ["amount", "currency"] as const;
const BOTTLENECK_KEYS = ["bomLineId", "part", "reason"] as const;

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
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = RFC3339_PATTERN.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;
  if (zone !== "Z") {
    const offsetHour = Number(zone!.slice(1, 3));
    const offsetMinute = Number(zone!.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function pushUnknownKeys(issues: ValidationIssue[], input: UnknownRecord, allowed: readonly string[], path = ""): void {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) issues.push({ path: path ? `${path}.${key}` : key, message: "Unknown key" });
  }
}

function pushRequiredString(issues: ValidationIssue[], value: unknown, path: string): void {
  if (typeof value !== "string" || value.trim() === "") issues.push({ path, message: "Must be a non-empty string" });
}

function pushCurrency(issues: ValidationIssue[], value: unknown, path: string): void {
  if (typeof value !== "string" || !CURRENCY_PATTERN.test(value)) issues.push({ path, message: "Must be a three-letter uppercase currency code" });
}

function pushUniqueStrings(issues: ValidationIssue[], value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    issues.push({ path, message: "Must be an array" });
    return;
  }
  if (new Set(value).size !== value.length) issues.push({ path, message: "Must not contain duplicates" });
}

function validateMoney(input: unknown, path: string): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Money must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, MONEY_KEYS, path);
  if (!isFiniteNonNegative(input.amount)) issues.push({ path: `${path}.amount`, message: "Must be a non-negative finite number" });
  pushCurrency(issues, input.currency, `${path}.currency`);
  return issues;
}

function partIdentityKey(input: UnknownRecord): string | undefined {
  if (!isManufacturerId(input.manufacturerId) || typeof input.manufacturerPartNumber !== "string" || input.manufacturerPartNumber.trim() === "") return undefined;
  return `${input.manufacturerId}\u0000${input.manufacturerPartNumber}`;
}

function validatePartIdentity(input: unknown, path: string): ValidationIssue[] {
  if (!isRecord(input)) return [{ path, message: "Part identity must be an object" }];
  const issues: ValidationIssue[] = [];
  pushUnknownKeys(issues, input, PART_IDENTITY_KEYS, path);
  if (!isManufacturerId(input.manufacturerId)) issues.push({ path: `${path}.manufacturerId`, message: "Must be a stable lowercase manufacturer registry ID" });
  pushRequiredString(issues, input.manufacturerPartNumber, `${path}.manufacturerPartNumber`);
  return issues;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function validateSourcingPolicy(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return [{ path: "", message: "Sourcing policy must be an object" }];

  pushUnknownKeys(issues, input, POLICY_KEYS);

  if (input.schemaVersion !== SOURCING_POLICY_SCHEMA_VERSION) issues.push({ path: "schemaVersion", message: `Must equal ${SOURCING_POLICY_SCHEMA_VERSION}` });
  if (!Array.isArray(input.distributors) || input.distributors.length === 0) {
    issues.push({ path: "distributors", message: "Select at least one distributor" });
  } else {
    pushUniqueStrings(issues, input.distributors, "distributors");
    input.distributors.forEach((value, index) => {
      if (!isDistributorId(value)) issues.push({ path: `distributors.${index}`, message: "Must be a stable lowercase distributor registry ID" });
    });
  }
  if (!isMember(input.mode, ["any_selected", "single_distributor"])) issues.push({ path: "mode", message: "Must be any_selected or single_distributor" });
  if (!isPositiveInteger(input.buildQuantity)) issues.push({ path: "buildQuantity", message: "Must be a positive integer" });
  pushRequiredString(issues, input.region, "region");
  pushCurrency(issues, input.currency, "currency");
  if (!Array.isArray(input.allowedLifecycle) || input.allowedLifecycle.length === 0) {
    issues.push({ path: "allowedLifecycle", message: "Select at least one allowed lifecycle state" });
  } else {
    pushUniqueStrings(issues, input.allowedLifecycle, "allowedLifecycle");
    input.allowedLifecycle.forEach((value, index) => {
      if (!isMember(value, ALLOWED_LIFECYCLE)) issues.push({ path: `allowedLifecycle.${index}`, message: "Obsolete parts cannot be allowed by a sourcing policy" });
    });
  }
  if (input.minimumStock !== undefined && !isNonNegativeInteger(input.minimumStock)) issues.push({ path: "minimumStock", message: "Must be a non-negative integer" });
  if (input.maximumLeadTimeDays !== undefined && !isFiniteNonNegative(input.maximumLeadTimeDays)) issues.push({ path: "maximumLeadTimeDays", message: "Must be a non-negative finite number" });
  if (typeof input.allowBackorder !== "boolean") issues.push({ path: "allowBackorder", message: "Must be boolean" });
  if (typeof input.allowMarketplace !== "boolean") issues.push({ path: "allowMarketplace", message: "Must be boolean" });
  if (input.packaging !== undefined) {
    if (!Array.isArray(input.packaging) || input.packaging.length === 0) issues.push({ path: "packaging", message: "Must be a non-empty array when present" });
    else {
      pushUniqueStrings(issues, input.packaging, "packaging");
      input.packaging.forEach((value, index) => {
        if (!isMember(value, PACKAGING_TYPES)) issues.push({ path: `packaging.${index}`, message: "Unsupported packaging type" });
      });
    }
  }
  if (!isPositiveInteger(input.maximumSnapshotAgeSeconds)) issues.push({ path: "maximumSnapshotAgeSeconds", message: "Must be a positive integer" });
  return issues;
}

export function assertValidSourcingPolicy(input: unknown): asserts input is SourcingPolicy {
  const issue = validateSourcingPolicy(input)[0];
  if (issue) throw new Error(`${issue.path || "policy"}: ${issue.message}`);
}

export function parseSourcingPolicy(input: unknown): SourcingPolicy {
  assertValidSourcingPolicy(input);
  return cloneJson(input);
}

/** Current-version boundary retained so future versions have one migration entrypoint. */
export function migrateSourcingPolicy(input: unknown): SourcingPolicy {
  return parseSourcingPolicy(input);
}

function validateOffer(input: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return [{ path, message: "Offer must be an object" }];
  pushUnknownKeys(issues, input, OFFER_KEYS, path);
  if (!isDistributorId(input.distributor)) issues.push({ path: `${path}.distributor`, message: "Must be a stable lowercase distributor registry ID" });
  pushRequiredString(issues, input.distributorSku, `${path}.distributorSku`);
  issues.push(...validatePartIdentity(input.part, `${path}.part`));
  pushRequiredString(issues, input.region, `${path}.region`);
  pushCurrency(issues, input.currency, `${path}.currency`);
  if (!isMember(input.packaging, PACKAGING_TYPES)) issues.push({ path: `${path}.packaging`, message: "Unsupported packaging type" });
  if (typeof input.marketplace !== "boolean") issues.push({ path: `${path}.marketplace`, message: "Must be boolean" });
  if (typeof input.backorderAvailable !== "boolean") issues.push({ path: `${path}.backorderAvailable`, message: "Must be boolean" });
  for (const field of ["stockQuantity", "minimumOrderQuantity", "orderMultiple"] as const) {
    if (input[field] !== undefined && !isNonNegativeInteger(input[field])) issues.push({ path: `${path}.${field}`, message: "Must be a non-negative integer" });
  }
  if (input.minimumOrderQuantity === 0) issues.push({ path: `${path}.minimumOrderQuantity`, message: "Must be greater than zero when present" });
  if (input.orderMultiple === 0) issues.push({ path: `${path}.orderMultiple`, message: "Must be greater than zero when present" });
  if (input.leadTimeDays !== undefined && !isFiniteNonNegative(input.leadTimeDays)) issues.push({ path: `${path}.leadTimeDays`, message: "Must be a non-negative finite number" });
  if (input.leadTimeKind !== undefined && !isMember(input.leadTimeKind, LEAD_TIME_KINDS)) issues.push({ path: `${path}.leadTimeKind`, message: "Unsupported lead-time meaning" });
  if ((input.leadTimeDays === undefined) !== (input.leadTimeKind === undefined)) issues.push({ path: `${path}.leadTimeDays`, message: "leadTimeDays and leadTimeKind must be present together" });
  if (!isMember(input.lifecycle, LIFECYCLE_STATUSES)) issues.push({ path: `${path}.lifecycle`, message: "Unsupported lifecycle status" });
  if (!isMember(input.lifecycleSource, LIFECYCLE_SOURCES)) issues.push({ path: `${path}.lifecycleSource`, message: "Unsupported lifecycle source" });
  if (input.lastTimeBuyAt !== undefined && !isTimestamp(input.lastTimeBuyAt)) issues.push({ path: `${path}.lastTimeBuyAt`, message: "Must be an RFC 3339 timestamp" });
  if (!Array.isArray(input.priceBreaks)) issues.push({ path: `${path}.priceBreaks`, message: "Must be an array" });
  else {
    let priorQuantity = 0;
    input.priceBreaks.forEach((priceBreak, index) => {
      const pricePath = `${path}.priceBreaks.${index}`;
      if (!isRecord(priceBreak)) {
        issues.push({ path: pricePath, message: "Price break must be an object" });
        return;
      }
      pushUnknownKeys(issues, priceBreak, PRICE_BREAK_KEYS, pricePath);
      if (!isPositiveInteger(priceBreak.quantity)) issues.push({ path: `${pricePath}.quantity`, message: "Must be a positive integer" });
      else if (priceBreak.quantity <= priorQuantity) issues.push({ path: `${pricePath}.quantity`, message: "Price break quantities must be strictly increasing" });
      if (isPositiveInteger(priceBreak.quantity)) priorQuantity = priceBreak.quantity;
      if (!isFiniteNonNegative(priceBreak.unitPrice)) issues.push({ path: `${pricePath}.unitPrice`, message: "Must be a non-negative finite number" });
    });
  }
  if (typeof input.productUrl !== "string" || !/^https?:\/\//.test(input.productUrl)) issues.push({ path: `${path}.productUrl`, message: "Must be an HTTP(S) URL" });
  if (!isTimestamp(input.retrievedAt)) issues.push({ path: `${path}.retrievedAt`, message: "Must be an RFC 3339 timestamp" });
  return issues;
}

export function validateDistributorOffer(input: unknown): ValidationIssue[] {
  return validateOffer(input, "offer");
}

export function validateOfferSnapshot(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return [{ path: "", message: "Offer snapshot must be an object" }];
  pushUnknownKeys(issues, input, SNAPSHOT_KEYS);
  if (input.schemaVersion !== OFFER_SNAPSHOT_SCHEMA_VERSION) issues.push({ path: "schemaVersion", message: `Must equal ${OFFER_SNAPSHOT_SCHEMA_VERSION}` });
  pushRequiredString(issues, input.id, "id");
  if (!isDistributorId(input.provider)) issues.push({ path: "provider", message: "Must be a stable lowercase distributor registry ID" });
  const requestedIdentityKeys = new Set<string>();
  if (!Array.isArray(input.requestedParts) || input.requestedParts.length === 0) issues.push({ path: "requestedParts", message: "Must contain at least one exact manufacturer and MPN identity" });
  else {
    input.requestedParts.forEach((value, index) => {
      issues.push(...validatePartIdentity(value, `requestedParts.${index}`));
      if (!isRecord(value)) return;
      const key = partIdentityKey(value);
      if (key !== undefined && requestedIdentityKeys.has(key)) issues.push({ path: `requestedParts.${index}`, message: "Duplicate requested part identity" });
      if (key !== undefined) requestedIdentityKeys.add(key);
    });
  }
  if (!isTimestamp(input.retrievedAt)) issues.push({ path: "retrievedAt", message: "Must be an RFC 3339 timestamp" });
  if (!isTimestamp(input.expiresAt)) issues.push({ path: "expiresAt", message: "Must be an RFC 3339 timestamp" });
  if (isTimestamp(input.retrievedAt) && isTimestamp(input.expiresAt) && Date.parse(input.expiresAt) <= Date.parse(input.retrievedAt)) issues.push({ path: "expiresAt", message: "Must be later than retrievedAt" });
  if (!isMember(input.persistence, SNAPSHOT_PERSISTENCE)) issues.push({ path: "persistence", message: "Unsupported persistence policy" });
  if (!isMember(input.status, PROVIDER_STATUSES)) issues.push({ path: "status", message: "Unsupported provider request status" });
  if (!Array.isArray(input.errors)) issues.push({ path: "errors", message: "Must be an array" });
  else input.errors.forEach((error, index) => {
    const errorPath = `errors.${index}`;
    if (!isRecord(error)) {
      issues.push({ path: errorPath, message: "Provider error must be an object" });
      return;
    }
    pushUnknownKeys(issues, error, PROVIDER_ERROR_KEYS, errorPath);
    if (!isMember(error.code, PROVIDER_ERROR_CODES)) issues.push({ path: `${errorPath}.code`, message: "Unsupported provider error code" });
    pushRequiredString(issues, error.message, `${errorPath}.message`);
    if (typeof error.retryable !== "boolean") issues.push({ path: `${errorPath}.retryable`, message: "Must be boolean" });
  });
  if (input.status === "complete" && Array.isArray(input.errors) && input.errors.length > 0) issues.push({ path: "errors", message: "A complete snapshot cannot contain provider errors" });
  if ((input.status === "partial" || input.status === "provider_error") && Array.isArray(input.errors) && input.errors.length === 0) issues.push({ path: "errors", message: `${input.status} must include at least one provider error` });
  if (!Array.isArray(input.offers)) issues.push({ path: "offers", message: "Must be an array" });
  else {
    const offerSkus = new Set<string>();
    input.offers.forEach((offer, index) => {
      issues.push(...validateOffer(offer, `offers.${index}`));
      if (!isRecord(offer)) return;
      if (isDistributorId(input.provider) && offer.distributor !== input.provider) issues.push({ path: `offers.${index}.distributor`, message: "Offer distributor must match snapshot provider" });
      if (typeof offer.distributorSku === "string") {
        if (offerSkus.has(offer.distributorSku)) issues.push({ path: `offers.${index}.distributorSku`, message: "Duplicate distributor SKU in snapshot" });
        offerSkus.add(offer.distributorSku);
      }
      if (isRecord(offer.part)) {
        const key = partIdentityKey(offer.part);
        if (key !== undefined && !requestedIdentityKeys.has(key)) issues.push({ path: `offers.${index}.part`, message: "Offer part identity was not requested" });
      }
      if (isTimestamp(offer.retrievedAt) && isTimestamp(input.retrievedAt) && Date.parse(offer.retrievedAt) !== Date.parse(input.retrievedAt)) issues.push({ path: `offers.${index}.retrievedAt`, message: "Offer retrieval time must equal snapshot retrieval time" });
    });
  }
  if (typeof input.contentHash !== "string" || !CONTENT_HASH_PATTERN.test(input.contentHash)) {
    issues.push({ path: "contentHash", message: "Must be a sha256-prefixed lowercase hex digest" });
  } else {
    try {
      const expected = calculateOfferSnapshotContentHash(input as unknown as OfferSnapshot);
      if (input.contentHash !== expected) issues.push({ path: "contentHash", message: "Does not match the canonical snapshot payload" });
    } catch {
      issues.push({ path: "contentHash", message: "Canonical snapshot payload could not be hashed" });
    }
  }
  return issues;
}

export function assertValidOfferSnapshot(input: unknown): asserts input is OfferSnapshot {
  const issue = validateOfferSnapshot(input)[0];
  if (issue) throw new Error(`${issue.path || "snapshot"}: ${issue.message}`);
}

export function parseOfferSnapshot(input: unknown): OfferSnapshot {
  assertValidOfferSnapshot(input);
  return cloneJson(input);
}

/** Current-version boundary retained so future versions have one migration entrypoint. */
export function migrateOfferSnapshot(input: unknown): OfferSnapshot {
  return parseOfferSnapshot(input);
}

function validateLifecycleCounts(input: unknown): input is LifecycleCounts {
  if (!isRecord(input)) return false;
  return Object.keys(input).every((key) => isMember(key, LIFECYCLE_STATUSES))
    && LIFECYCLE_STATUSES.every((status) => isNonNegativeInteger(input[status]));
}

export function validateCandidateSourcingMetrics(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return [{ path: "", message: "Candidate sourcing metrics must be an object" }];
  pushUnknownKeys(issues, input, METRICS_KEYS);
  if (input.schemaVersion !== CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION) issues.push({ path: "schemaVersion", message: `Must equal ${CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION}` });
  if (!isMember(input.status, SOURCING_DATA_STATUSES)) issues.push({ path: "status", message: "Unsupported sourcing data status" });
  if (!isPositiveInteger(input.requestedBuildQuantity)) issues.push({ path: "requestedBuildQuantity", message: "Must be a positive integer" });
  if (!isTimestamp(input.evaluatedAt)) issues.push({ path: "evaluatedAt", message: "Must be an RFC 3339 timestamp" });
  if (!Array.isArray(input.snapshotIds)) issues.push({ path: "snapshotIds", message: "Must be an array" });
  else {
    pushUniqueStrings(issues, input.snapshotIds, "snapshotIds");
    input.snapshotIds.forEach((value, index) => pushRequiredString(issues, value, `snapshotIds.${index}`));
  }
  if (input.snapshotAgeSeconds !== undefined && !isFiniteNonNegative(input.snapshotAgeSeconds)) issues.push({ path: "snapshotAgeSeconds", message: "Must be a non-negative finite number" });
  if (input.earliestSnapshotExpiresAt !== undefined && !isTimestamp(input.earliestSnapshotExpiresAt)) issues.push({ path: "earliestSnapshotExpiresAt", message: "Must be an RFC 3339 timestamp" });
  if (!Array.isArray(input.lines)) issues.push({ path: "lines", message: "Must be an array" });
  else input.lines.forEach((line, index) => {
    const linePath = `lines.${index}`;
    if (!isRecord(line)) {
      issues.push({ path: linePath, message: "BOM line metric must be an object" });
      return;
    }
    pushUnknownKeys(issues, line, LINE_KEYS, linePath);
    pushRequiredString(issues, line.bomLineId, `${linePath}.bomLineId`);
    issues.push(...validatePartIdentity(line.part, `${linePath}.part`));
    if (!isPositiveInteger(line.quantityPerAssembly)) issues.push({ path: `${linePath}.quantityPerAssembly`, message: "Must be a positive integer" });
    if (!isMember(line.status, BOM_LINE_STATUSES)) issues.push({ path: `${linePath}.status`, message: "Unsupported BOM line sourcing status" });
    if (line.status === "sourced" && !isRecord(line.selectedOffer)) issues.push({ path: `${linePath}.selectedOffer`, message: "A sourced line must reference its selected offer" });
    if (line.selectedOffer !== undefined && isRecord(line.selectedOffer)) {
      pushUnknownKeys(issues, line.selectedOffer, SELECTED_OFFER_KEYS, `${linePath}.selectedOffer`);
      pushRequiredString(issues, line.selectedOffer.snapshotId, `${linePath}.selectedOffer.snapshotId`);
      if (!isDistributorId(line.selectedOffer.distributor)) issues.push({ path: `${linePath}.selectedOffer.distributor`, message: "Must be a stable lowercase distributor registry ID" });
      pushRequiredString(issues, line.selectedOffer.distributorSku, `${linePath}.selectedOffer.distributorSku`);
    }
    if (line.packaging !== undefined && !isMember(line.packaging, PACKAGING_TYPES)) issues.push({ path: `${linePath}.packaging`, message: "Unsupported packaging type" });
    if (line.lifecycle !== undefined && !isMember(line.lifecycle, LIFECYCLE_STATUSES)) issues.push({ path: `${linePath}.lifecycle`, message: "Unsupported lifecycle status" });
    for (const field of ["stockQuantity", "purchaseQuantity", "buildableQuantity"] as const) {
      if (line[field] !== undefined && !isNonNegativeInteger(line[field])) issues.push({ path: `${linePath}.${field}`, message: "Must be a non-negative integer" });
    }
    if (line.leadTimeDays !== undefined && !isFiniteNonNegative(line.leadTimeDays)) issues.push({ path: `${linePath}.leadTimeDays`, message: "Must be a non-negative finite number" });
    if (line.leadTimeKind !== undefined && !isMember(line.leadTimeKind, LEAD_TIME_KINDS)) issues.push({ path: `${linePath}.leadTimeKind`, message: "Unsupported lead-time meaning" });
    if ((line.leadTimeDays === undefined) !== (line.leadTimeKind === undefined)) issues.push({ path: `${linePath}.leadTimeDays`, message: "leadTimeDays and leadTimeKind must be present together" });
    if (line.extendedCost !== undefined) issues.push(...validateMoney(line.extendedCost, `${linePath}.extendedCost`));
    if (!Array.isArray(line.warnings) || line.warnings.some((warning) => typeof warning !== "string")) issues.push({ path: `${linePath}.warnings`, message: "Must be an array of strings" });
  });
  if (input.buildableQuantity !== undefined && !isNonNegativeInteger(input.buildableQuantity)) issues.push({ path: "buildableQuantity", message: "Must be a non-negative integer" });
  if (input.extendedBomCost !== undefined) issues.push(...validateMoney(input.extendedBomCost, "extendedBomCost"));
  if (input.maximumLeadTimeDays !== undefined && !isFiniteNonNegative(input.maximumLeadTimeDays)) issues.push({ path: "maximumLeadTimeDays", message: "Must be a non-negative finite number" });
  if (input.maximumLeadTimeKind !== undefined && !isMember(input.maximumLeadTimeKind, LEAD_TIME_KINDS)) issues.push({ path: "maximumLeadTimeKind", message: "Unsupported lead-time meaning" });
  if ((input.maximumLeadTimeDays === undefined) !== (input.maximumLeadTimeKind === undefined)) issues.push({ path: "maximumLeadTimeDays", message: "maximumLeadTimeDays and maximumLeadTimeKind must be present together" });
  if (isRecord(input.lifecycleCounts)) pushUnknownKeys(issues, input.lifecycleCounts, LIFECYCLE_STATUSES, "lifecycleCounts");
  if (!validateLifecycleCounts(input.lifecycleCounts)) issues.push({ path: "lifecycleCounts", message: "Must contain a non-negative integer for every lifecycle status" });
  if (input.distributorSplitCount !== undefined && !isNonNegativeInteger(input.distributorSplitCount)) issues.push({ path: "distributorSplitCount", message: "Must be a non-negative integer" });
  if (input.singleDistributorComplete !== undefined && typeof input.singleDistributorComplete !== "boolean") issues.push({ path: "singleDistributorComplete", message: "Must be boolean" });
  if (input.bottleneckPart !== undefined) {
    if (!isRecord(input.bottleneckPart)) issues.push({ path: "bottleneckPart", message: "Must be an object" });
    else {
      pushUnknownKeys(issues, input.bottleneckPart, BOTTLENECK_KEYS, "bottleneckPart");
      pushRequiredString(issues, input.bottleneckPart.bomLineId, "bottleneckPart.bomLineId");
      issues.push(...validatePartIdentity(input.bottleneckPart.part, "bottleneckPart.part"));
      if (!isMember(input.bottleneckPart.reason, BOTTLENECK_REASONS)) issues.push({ path: "bottleneckPart.reason", message: "Unsupported bottleneck reason" });
    }
  }
  if (!Array.isArray(input.warnings) || input.warnings.some((warning) => typeof warning !== "string")) issues.push({ path: "warnings", message: "Must be an array of strings" });
  return issues;
}

export function assertValidCandidateSourcingMetrics(input: unknown): asserts input is CandidateSourcingMetrics {
  const issue = validateCandidateSourcingMetrics(input)[0];
  if (issue) throw new Error(`${issue.path || "metrics"}: ${issue.message}`);
}

export function parseCandidateSourcingMetrics(input: unknown): CandidateSourcingMetrics {
  assertValidCandidateSourcingMetrics(input);
  return cloneJson(input);
}
