import { canonicalJsonForVersionedSourcing } from "./canonical";
import type { DistributorId, ManufacturerPartIdentity } from "./ids";
import type { CandidateSourcingMetrics as CandidateSourcingMetricsV1, LifecycleCounts, Money, SourcingDataStatus } from "./metrics";
import type { LeadTimeKind, LifecycleSource, PriceBreak } from "./offer";
import type { LifecycleStatus, PackagingType, SourcingPolicy } from "./policy";
import type { OfferSnapshot as OfferSnapshotV1, ProviderRequestStatus, SnapshotPersistence } from "./snapshot";
import type { ValidationIssue } from "./validation";

export const OFFER_SNAPSHOT_SCHEMA_VERSION_V1 = 1 as const;
export const OFFER_SNAPSHOT_SCHEMA_VERSION_V2 = 2 as const;
export const CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V1 = 1 as const;
export const CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2 = 2 as const;
export const SOURCING_ADVISORY_WARNING_CATALOG_VERSION = 1 as const;
export const SOURCING_POLICY_RULE_CATALOG_VERSION = 1 as const;
export const PROVIDER_ERROR_CATALOG_VERSION_V2 = 1 as const;

export const UNKNOWN_OBSERVATION_REASONS = [
  "not_reported", "not_supported", "unmapped", "conflicting", "legacy_unknown",
] as const;
export type UnknownObservationReason = typeof UNKNOWN_OBSERVATION_REASONS[number];
export type SourcingObservation<T> =
  | { state: "known"; value: T }
  | { state: "unknown"; reason: UnknownObservationReason };

export type KnownLifecycleStatus = Exclude<LifecycleStatus, "unknown">;
export type KnownLifecycleSource = Exclude<LifecycleSource, "unknown">;
export type KnownLeadTimeKind = Exclude<LeadTimeKind, "unknown">;
export const MAXIMUM_LEAD_KIND_TIE_BREAK_V2 = ["estimated_ship", "factory", "manufacturer"] as const satisfies readonly KnownLeadTimeKind[];

export interface DistributorOfferV2 {
  distributor: DistributorId;
  distributorSku: string;
  part: ManufacturerPartIdentity;
  region: SourcingObservation<string>;
  currency: SourcingObservation<string>;
  packaging: SourcingObservation<PackagingType>;
  marketplace: SourcingObservation<boolean>;
  backorderAvailable: SourcingObservation<boolean>;
  stockQuantity?: number;
  minimumOrderQuantity?: number;
  orderMultiple?: number;
  leadTimeDays: SourcingObservation<number>;
  leadTimeKind: SourcingObservation<KnownLeadTimeKind>;
  lifecycle: SourcingObservation<KnownLifecycleStatus>;
  lifecycleSource: SourcingObservation<KnownLifecycleSource>;
  lastTimeBuyAt?: string;
  priceBreaks: PriceBreak[];
  productUrl: string;
  retrievedAt: string;
}

export type Sha256ContentHash = `sha256:${string}`;
export type OfferSnapshotV2Id = `snapshot:v2:${Sha256ContentHash}`;
export type ProviderErrorCodeV2 = "timeout" | "rate_limited" | "authentication" | "upstream" | "invalid_response" | "unknown";
export interface ProviderErrorV2 {
  catalogVersion: typeof PROVIDER_ERROR_CATALOG_VERSION_V2;
  code: ProviderErrorCodeV2;
  retryable: boolean;
}
export const PROVIDER_ERROR_TEMPLATES_V2: Readonly<Record<ProviderErrorCodeV2, string>> = Object.freeze({
  timeout: "Provider request timed out",
  rate_limited: "Provider rate limit prevented this request",
  authentication: "Provider authentication was unavailable",
  upstream: "Provider service returned an upstream error",
  invalid_response: "Provider response could not be normalized safely",
  unknown: "Provider request failed for an unknown reason",
});
export function renderProviderErrorV2(error: Readonly<ProviderErrorV2>): string {
  const template = PROVIDER_ERROR_TEMPLATES_V2[error.code];
  if (error.catalogVersion !== PROVIDER_ERROR_CATALOG_VERSION_V2 || template === undefined) throw new RangeError("Unsupported provider error catalog entry");
  return template;
}

export interface OfferSnapshotV1Ref { id: string; schemaVersion: 1; contentHash: Sha256ContentHash }
export interface OfferSnapshotV2Ref { id: OfferSnapshotV2Id; schemaVersion: 2; contentHash: Sha256ContentHash }
export type OfferSnapshotLineageRef = OfferSnapshotV1Ref | OfferSnapshotV2Ref;
/** @deprecated Native V2 surfaces require OfferSnapshotV2Ref. */
export type OfferSnapshotRef = OfferSnapshotLineageRef;

export interface OfferSnapshotV2 {
  schemaVersion: typeof OFFER_SNAPSHOT_SCHEMA_VERSION_V2;
  id: OfferSnapshotV2Id;
  provider: DistributorId;
  requestedParts: ManufacturerPartIdentity[];
  retrievedAt: string;
  expiresAt: string;
  persistence: SnapshotPersistence;
  evaluationEligibility: "native_v2" | "legacy_audit_only";
  status: ProviderRequestStatus;
  errors: ProviderErrorV2[];
  offers: DistributorOfferV2[];
  lineage: OfferSnapshotLineageRef[];
  contentHash: Sha256ContentHash;
}
export type OfferSnapshotV2Content = Omit<OfferSnapshotV2, "id" | "contentHash">;
export type PersistedOfferSnapshot = OfferSnapshotV1 | OfferSnapshotV2;
export type OfferSnapshotMigrationV2 =
  | { status: "migrated"; snapshot: OfferSnapshotV2 }
  | { status: "invalid_source"; issues: ValidationIssue[] }
  | { status: "unsupported_v1_value"; issues: ValidationIssue[] };

export type SnapshotAuthorizationV1Id = `snapshot-authorization:v1:${Sha256ContentHash}`;
export interface ProviderPolicyRefV2 { id: string; version: string; contentHash: Sha256ContentHash }
export type SnapshotAuthorizedUseV1 = "display" | "user_local_storage" | "download_export" | "public_share";
export interface ProviderAttributionV1 {
  provider: DistributorId;
  providerPolicy: ProviderPolicyRefV2;
  required: boolean;
  label: string;
}
export interface SnapshotAuthorizationRefV1 {
  id: SnapshotAuthorizationV1Id;
  contentHash: Sha256ContentHash;
  issuerKeyId: string;
}
export interface SnapshotAuthorizationV1 {
  format: "schemagic-snapshot-authorization";
  schemaVersion: 1;
  id: SnapshotAuthorizationV1Id;
  snapshotRef: OfferSnapshotV2Ref;
  provider: DistributorId;
  providerPolicy: ProviderPolicyRefV2;
  attribution: ProviderAttributionV1;
  executionMode: "public_hosted" | "self_hosted";
  effectivePersistence: SnapshotPersistence;
  effectiveEvaluationEligibility: "native_v2";
  authorizedUses: SnapshotAuthorizedUseV1[];
  issuedAt: string;
  notAfter: string | null;
  issuerKeyId: string;
  contentHash: Sha256ContentHash;
  signature: string;
}
const VERIFIED_COMMERCIAL_AUTHORIZATION_OPERATION_V1: unique symbol = Symbol("VerifiedCommercialAuthorizationOperationV1");
export interface VerifiedCommercialAuthorizationOperationV1 {
  readonly [VERIFIED_COMMERCIAL_AUTHORIZATION_OPERATION_V1]: true;
  readonly use: SnapshotAuthorizedUseV1;
  readonly checkedAt: string;
}
export interface SnapshotAuthorizationVerifierV1 {
  verify(authorization: Readonly<SnapshotAuthorizationV1>, snapshot: Readonly<OfferSnapshotV2>): ValidationIssue[];
  authorizeOperation(use: SnapshotAuthorizedUseV1, snapshots: readonly OfferSnapshotV2[], authorizations: readonly SnapshotAuthorizationV1[]): VerifiedCommercialAuthorizationOperationV1;
  validateOperation(operation: VerifiedCommercialAuthorizationOperationV1, expectedUse: SnapshotAuthorizedUseV1, snapshots: readonly OfferSnapshotV2[], authorizations: readonly SnapshotAuthorizationV1[]): ValidationIssue[];
}
export interface SnapshotAuthorizationSignerV1 {
  readonly issuerKeyId: string;
  signCanonicalClaims(claims: Uint8Array): string;
}
export interface CommercialSnapshotContextV1 {
  snapshots: readonly OfferSnapshotV2[];
  authorizations: readonly SnapshotAuthorizationV1[];
  authorizationVerifier: SnapshotAuthorizationVerifierV1;
  authorizationOperation: VerifiedCommercialAuthorizationOperationV1;
}
export interface AuthorizedOfferSnapshotDocumentV2 {
  format: "schemagic-authorized-offer-snapshot";
  schemaVersion: 2;
  snapshot: OfferSnapshotV2;
  authorization: SnapshotAuthorizationV1;
}

export type SourcingPolicyStatus = "pass" | "unknown" | "fail";
export type SourcingPolicyRuleCodeV1 = "data_status" | "offer_available" | "region" | "currency" | "packaging" | "marketplace" | "lifecycle" | "lead_time" | "stock" | "single_distributor" | "migration";
export type SourcingPolicyRuleInputsV1 =
  | { code: "data_status"; dataStatus: SourcingDataStatus }
  | { code: "offer_available"; proof: "offer_present" | "fresh_complete_no_offer" | "not_proven" }
  | { code: "region"; observed: SourcingObservation<string>; required: string }
  | { code: "currency"; observed: SourcingObservation<string>; required: string }
  | { code: "packaging"; observed: SourcingObservation<PackagingType>; allowed: PackagingType[] }
  | { code: "marketplace"; observed: SourcingObservation<boolean>; allowed: false }
  | { code: "lifecycle"; observed: SourcingObservation<KnownLifecycleStatus>; allowed: KnownLifecycleStatus[] }
  | { code: "lead_time"; days: SourcingObservation<number>; kind: SourcingObservation<KnownLeadTimeKind>; maximumDays: number }
  | { code: "stock"; stockQuantity: number | null; purchaseQuantity: number; minimumStock: number | null; backorderAvailable: SourcingObservation<boolean>; allowBackorder: boolean }
  | { code: "single_distributor"; selectedDistributor: DistributorId; observedDistributors: DistributorId[] }
  | { code: "migration"; reason: "reevaluation_required" | "source_unavailable" };
export type CandidateSourcingPolicyRuleCodeV1 = "data_status" | "single_distributor";
export type LineSourcingPolicyRuleCodeV1 = Exclude<SourcingPolicyRuleCodeV1, CandidateSourcingPolicyRuleCodeV1>;
export type SourcingPolicyRuleIdV1<Code extends SourcingPolicyRuleCodeV1> = Code extends "data_status" ? "sourcing.data_status" : Code extends "migration" ? "sourcing.migration" : `sourcing.policy.${Code}`;
export type SourcingPolicyRuleInputsForV1<Code extends SourcingPolicyRuleCodeV1> = Extract<SourcingPolicyRuleInputsV1, { code: Code }>;
export type SourcingPolicyConstraintForV1<Code extends SourcingPolicyRuleCodeV1> = {
  ruleCatalogVersion: typeof SOURCING_POLICY_RULE_CATALOG_VERSION;
  ruleId: SourcingPolicyRuleIdV1<Code>;
  code: Code;
  status: SourcingPolicyStatus;
  inputs: SourcingPolicyRuleInputsForV1<Code>;
  explanation: string;
} & (Code extends CandidateSourcingPolicyRuleCodeV1 ? { bomLineId?: never } : { bomLineId: string });
export type SourcingPolicyConstraintV2 = { [Code in SourcingPolicyRuleCodeV1]: SourcingPolicyConstraintForV1<Code> }[SourcingPolicyRuleCodeV1];

export function sourcingPolicyRuleIdV1<Code extends SourcingPolicyRuleCodeV1>(code: Code): SourcingPolicyRuleIdV1<Code> {
  return (code === "data_status" ? "sourcing.data_status" : code === "migration" ? "sourcing.migration" : `sourcing.policy.${code}`) as SourcingPolicyRuleIdV1<Code>;
}
export function renderSourcingPolicyConstraintV2<Code extends SourcingPolicyRuleCodeV1>(
  code: Code,
  status: SourcingPolicyStatus,
  inputs: SourcingPolicyRuleInputsForV1<Code>,
  ...scope: Code extends CandidateSourcingPolicyRuleCodeV1 ? [] : [bomLineId: string]
): SourcingPolicyConstraintV2 {
  const ruleId = sourcingPolicyRuleIdV1(code);
  const bomLineId = scope[0] as string | undefined;
  const explanation = canonicalJsonForVersionedSourcing({ ruleCatalogVersion: 1, ruleId, code, status, inputs, bomLineId: bomLineId ?? null });
  return { ruleCatalogVersion: 1, ruleId, code, status, inputs, explanation, ...(bomLineId === undefined ? {} : { bomLineId }) } as SourcingPolicyConstraintV2;
}

export interface EvaluatedOfferRef { snapshot: OfferSnapshotV2Ref; distributor: DistributorId; distributorSku: string }
export type BomLineSourcingStatusV2 = "sourced" | "unavailable" | "policy_rejected" | "unknown";
export interface BomLineSourcingMetricsV2 {
  bomLineId: string;
  part: ManufacturerPartIdentity;
  quantityPerAssembly: number;
  status: BomLineSourcingStatusV2;
  evaluatedOffer?: EvaluatedOfferRef;
  region?: SourcingObservation<string>;
  currency?: SourcingObservation<string>;
  packaging?: SourcingObservation<PackagingType>;
  marketplace?: SourcingObservation<boolean>;
  backorderAvailable?: SourcingObservation<boolean>;
  lifecycle?: SourcingObservation<KnownLifecycleStatus>;
  lifecycleSource?: SourcingObservation<KnownLifecycleSource>;
  leadTimeDays?: SourcingObservation<number>;
  leadTimeKind?: SourcingObservation<KnownLeadTimeKind>;
  stockQuantity?: number;
  purchaseQuantity?: number;
  buildableQuantity?: number;
  extendedCost?: Money;
  warnings: string[];
}
export interface BomBottleneckV2 { bomLineId: string; part: ManufacturerPartIdentity; reason: "stock" | "policy" }
export interface CandidateSourcingMetricsV2 {
  schemaVersion: typeof CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2;
  warningCatalogVersion: typeof SOURCING_ADVISORY_WARNING_CATALOG_VERSION;
  status: SourcingDataStatus;
  policyStatus: SourcingPolicyStatus;
  unknownObservationCount: number;
  requestedBuildQuantity: number;
  evaluatedAt: string;
  snapshotRefs: OfferSnapshotV2Ref[];
  snapshotAgeSeconds?: number;
  earliestSnapshotExpiresAt?: string;
  lines: BomLineSourcingMetricsV2[];
  buildableQuantity?: number;
  extendedBomCost?: Money;
  bottleneckPart?: BomBottleneckV2;
  maximumLeadTimeDays?: number;
  maximumLeadTimeKind?: KnownLeadTimeKind;
  lifecycleCounts: LifecycleCounts;
  distributorSplitCount?: number;
  singleDistributorComplete?: boolean;
  warnings: string[];
}
export interface CandidateSourcingEvaluationV2 { metrics: CandidateSourcingMetricsV2; policyStatus: SourcingPolicyStatus; constraints: SourcingPolicyConstraintV2[] }
export interface CandidateSourcingValidationComponentV2 { id: string; part: ManufacturerPartIdentity; quantityPerAssembly: number }
export interface CandidateSourcingValidationContextV2 {
  candidateId: string;
  components: readonly CandidateSourcingValidationComponentV2[];
  policy: Readonly<SourcingPolicy>;
  snapshots: readonly OfferSnapshotV2[];
  authorizations: readonly SnapshotAuthorizationV1[];
  authorizationVerifier: SnapshotAuthorizationVerifierV1;
  authorizationOperation: VerifiedCommercialAuthorizationOperationV1;
  expectedAuthorizationUse: SnapshotAuthorizedUseV1;
  evaluatedAt: string;
}

/** Shared commercial ranking request atom. Overlay documents remain design-schema-owned. */
export interface CommercialRankingCriterionV1 {
  field: "buildableQuantity" | "extendedBomCost" | "maximumLeadTimeDays";
  direction: "maximize" | "minimize";
}

export interface LegacyCandidateSourcingAuditV2 {
  format: "schemagic-legacy-candidate-sourcing-audit";
  schemaVersion: 2;
  sourceCandidateId: string;
  metrics: CandidateSourcingMetricsV2;
  constraints: SourcingPolicyConstraintV2[];
  snapshotLineage: OfferSnapshotV1Ref[];
  warnings: string[];
  contentHash: Sha256ContentHash;
}

export type LegacyCandidateSourcingAuditMigrationV2 =
  | { status: "migrated"; audit: LegacyCandidateSourcingAuditV2; migratedSnapshots: OfferSnapshotV2[] }
  | { status: "invalid_v1_source"; issues: ValidationIssue[] }
  | { status: "unsupported_v1_value"; issues: ValidationIssue[] };

export type MigrateCandidateSourcingMetricsV1ToAuditV2 = (
  sourceCandidateId: string,
  metrics: Readonly<CandidateSourcingMetricsV1>,
  verifiedV1Snapshots?: readonly OfferSnapshotV1[],
) => LegacyCandidateSourcingAuditMigrationV2;

export const SOURCING_ADVISORY_WARNING_CODES = ["manufacturer_lead_not_delivery", "factory_lead_not_delivery", "stock_unknown_backorder", "stock_short_backorder", "price_break_unavailable", "migration_v1_reevaluation", "migration_v1_source_unavailable"] as const;
export type SourcingAdvisoryWarningCode = typeof SOURCING_ADVISORY_WARNING_CODES[number];
export type SourcingAdvisoryWarningInput =
  | { code: "manufacturer_lead_not_delivery" }
  | { code: "factory_lead_not_delivery" }
  | { code: "stock_unknown_backorder" }
  | { code: "stock_short_backorder"; stockQuantity: number; purchaseQuantity: number }
  | { code: "price_break_unavailable"; purchaseQuantity: number }
  | { code: "migration_v1_reevaluation" }
  | { code: "migration_v1_source_unavailable" };
export const SOURCING_ADVISORY_WARNING_TEMPLATES: Readonly<Record<SourcingAdvisoryWarningCode, string>> = Object.freeze({
  manufacturer_lead_not_delivery: "Manufacturer lead time is not a guaranteed ship or delivery date",
  factory_lead_not_delivery: "Factory lead time is not a guaranteed ship or delivery date",
  stock_unknown_backorder: "Current stock is unknown; the evaluated offer relies on a permitted backorder",
  stock_short_backorder: "Only {stockQuantity} units are currently in stock; purchase quantity {purchaseQuantity} relies on backorder availability",
  price_break_unavailable: "No price break applies at purchase quantity {purchaseQuantity}; extended cost is unknown",
  migration_v1_reevaluation: "Migrated V1 sourcing data requires V2 policy re-evaluation",
  migration_v1_source_unavailable: "Migrated V1 sourcing source snapshots were unavailable or ambiguous",
});
function warningInteger(value: number, field: string): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be a non-negative safe integer`);
  return String(value);
}
export function renderSourcingAdvisoryWarning(input: SourcingAdvisoryWarningInput): string {
  if (input.code === "stock_short_backorder") return SOURCING_ADVISORY_WARNING_TEMPLATES.stock_short_backorder.replace("{stockQuantity}", warningInteger(input.stockQuantity, "stockQuantity")).replace("{purchaseQuantity}", warningInteger(input.purchaseQuantity, "purchaseQuantity"));
  if (input.code === "price_break_unavailable") return SOURCING_ADVISORY_WARNING_TEMPLATES.price_break_unavailable.replace("{purchaseQuantity}", warningInteger(input.purchaseQuantity, "purchaseQuantity"));
  const template = SOURCING_ADVISORY_WARNING_TEMPLATES[input.code];
  if (template === undefined) throw new RangeError(`Unsupported sourcing advisory warning code: ${String(input.code)}`);
  return template;
}
export function aggregateSourcingPolicyStatus(constraints: readonly SourcingPolicyConstraintV2[]): SourcingPolicyStatus {
  if (constraints.some((constraint) => constraint.status === "fail")) return "fail";
  if (constraints.some((constraint) => constraint.status === "unknown")) return "unknown";
  return "pass";
}
export function emptyLifecycleCountsV2(): LifecycleCounts { return { active: 0, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 }; }
