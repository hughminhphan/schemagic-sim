export {
  DISTRIBUTOR_IDS,
  DISTRIBUTOR_ID_PATTERN,
  MANUFACTURER_ID_PATTERN,
  assertDistributorId,
  assertManufacturerId,
  isDistributorId,
  isManufacturerId,
} from "./ids";
export { CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION, emptyLifecycleCounts } from "./metrics";
export { LIFECYCLE_STATUSES, PACKAGING_TYPES, SOURCING_POLICY_SCHEMA_VERSION } from "./policy";
export { OFFER_SNAPSHOT_SCHEMA_VERSION, snapshotFreshnessAt } from "./snapshot";
export {
  assertValidCandidateSourcingMetrics,
  assertValidOfferSnapshot,
  assertValidSourcingPolicy,
  migrateOfferSnapshot,
  migrateSourcingPolicy,
  parseCandidateSourcingMetrics,
  parseOfferSnapshot,
  parseSourcingPolicy,
  validateCandidateSourcingMetrics,
  validateDistributorOffer,
  validateOfferSnapshot,
  validateSourcingPolicy,
} from "./validation";
export type * from "./ids";
export type * from "./metrics";
export type * from "./offer";
export type * from "./policy";
export type * from "./snapshot";
export type { ValidationIssue } from "./validation";
export { calculateOfferSnapshotContentHash, canonicalOfferSnapshotPayload } from "./canonical";

// Compatibility release: all unsuffixed exports above remain the frozen V1
// contract. Explicit V1 and V2 names may be consumed side by side.
export {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION as CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V1,
  emptyLifecycleCounts as emptyLifecycleCountsV1,
} from "./metrics";
export {
  OFFER_SNAPSHOT_SCHEMA_VERSION as OFFER_SNAPSHOT_SCHEMA_VERSION_V1,
  snapshotFreshnessAt as snapshotFreshnessAtV1,
} from "./snapshot";
export {
  SOURCING_POLICY_SCHEMA_VERSION as SOURCING_POLICY_SCHEMA_VERSION_V1,
} from "./policy";
export {
  assertValidCandidateSourcingMetrics as assertValidCandidateSourcingMetricsV1,
  assertValidOfferSnapshot as assertValidOfferSnapshotV1,
  assertValidSourcingPolicy as assertValidSourcingPolicyV1,
  migrateOfferSnapshot as migrateOfferSnapshotV1,
  migrateSourcingPolicy as migrateSourcingPolicyV1,
  parseCandidateSourcingMetrics as parseCandidateSourcingMetricsV1,
  parseOfferSnapshot as parseOfferSnapshotV1,
  parseSourcingPolicy as parseSourcingPolicyV1,
  validateCandidateSourcingMetrics as validateCandidateSourcingMetricsV1,
  validateOfferSnapshot as validateOfferSnapshotV1,
  validateSourcingPolicy as validateSourcingPolicyV1,
} from "./validation";
export {
  calculateOfferSnapshotContentHash as calculateOfferSnapshotContentHashV1,
  canonicalOfferSnapshotPayload as canonicalOfferSnapshotPayloadV1,
} from "./canonical";
export {
  assertValidDistributorOfferV1,
  parseDistributorOfferV1,
  validateDistributorOfferV1,
} from "./compat-v1";
export type {
  BomBottleneck as BomBottleneckV1,
  BottleneckReason as BottleneckReasonV1,
  BomLineSourcingMetrics as BomLineSourcingMetricsV1,
  BomLineSourcingStatus as BomLineSourcingStatusV1,
  CandidateSourcingMetrics as CandidateSourcingMetricsV1,
  LifecycleCounts as LifecycleCountsV1,
  Money as MoneyV1,
  SelectedOfferRef as SelectedOfferRefV1,
  SourcingDataStatus as SourcingDataStatusV1,
} from "./metrics";
export type {
  DistributorOffer as DistributorOfferV1,
  LeadTimeKind as LeadTimeKindV1,
  LifecycleSource as LifecycleSourceV1,
  PriceBreak as PriceBreakV1,
} from "./offer";
export type { SourcingPolicy as SourcingPolicyV1 } from "./policy";
export type {
  OfferSnapshot as OfferSnapshotV1,
  ProviderError as ProviderErrorV1,
  ProviderRequestStatus as ProviderRequestStatusV1,
  SnapshotPersistence as SnapshotPersistenceV1,
} from "./snapshot";

export {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2,
  MAXIMUM_LEAD_KIND_TIE_BREAK_V2,
  OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
  PROVIDER_ERROR_CATALOG_VERSION_V2,
  PROVIDER_ERROR_TEMPLATES_V2,
  SOURCING_ADVISORY_WARNING_CATALOG_VERSION,
  SOURCING_ADVISORY_WARNING_CODES,
  SOURCING_ADVISORY_WARNING_TEMPLATES,
  SOURCING_POLICY_RULE_CATALOG_VERSION,
  UNKNOWN_OBSERVATION_REASONS,
  aggregateSourcingPolicyStatus,
  emptyLifecycleCountsV2,
  renderProviderErrorV2,
  renderSourcingAdvisoryWarning,
  renderSourcingPolicyConstraintV2,
  sourcingPolicyRuleIdV1,
} from "./v2";
export type * from "./v2";
export {
  DISTRIBUTOR_PRODUCT_LINK_HOSTS_V2,
  canonicalCommercialNumberV2,
  canonicalCommercialRationalV2,
  compareRfc3339InstantsV2,
  formatRfc3339InstantV2,
  isVerifiedDistributorProductUrlV2,
  parseRfc3339InstantV2,
} from "./commercial-primitives-v2";
export type { ParsedRfc3339InstantV2 } from "./commercial-primitives-v2";
export {
  calculateOfferSnapshotContentHashV2,
  calculateOfferSnapshotIdV2,
  canonicalOfferSnapshotPayloadV2,
  finalizeOfferSnapshotV2,
  normalizeOfferSnapshotV2Content,
  offerSnapshotRef,
} from "./canonical-v2";
export {
  assertValidCandidateSourcingMetricsV2,
  assertValidDistributorOfferV2,
  assertValidOfferSnapshotV2,
  parseCandidateSourcingEvaluationV2,
  parseCandidateSourcingMetricsV2,
  parseDistributorOfferV2,
  parseOfferSnapshotRef,
  parseOfferSnapshotV2,
  parseOfferSnapshotV2Ref,
  parseSourcingPolicyConstraintV2,
  validateCandidateSourcingEvaluationV2,
  validateCandidateSourcingMetricsV2,
  validateDistributorOfferV2,
  validateOfferSnapshotRef,
  validateOfferSnapshotV2,
  validateOfferSnapshotV2Ref,
  validateSourcingPolicyConstraintV2,
} from "./validation-v2";
export { validateCandidateSourcingEvaluationContextV2 } from "./context-v2";
export {
  calculateSnapshotAuthorizationContentHashV1,
  calculateSnapshotAuthorizationIdV1,
  canonicalSnapshotAuthorizationClaimsV1,
  createSnapshotAuthorizationVerifierV1,
  parseAuthorizedOfferSnapshotDocumentV2,
  parseSnapshotAuthorizationV1,
  snapshotAuthorizationRefV1,
  validateSnapshotAuthorizationV1,
} from "./authorization-v1";
export type { SnapshotAuthorizationVerifierDependenciesV1 } from "./authorization-v1";
export {
  calculateLegacyCandidateSourcingAuditV2ContentHash,
  canonicalLegacyCandidateSourcingAuditV2Payload,
  migrateCandidateSourcingMetricsV1ToAuditV2,
  parseLegacyCandidateSourcingAuditV2,
  validateLegacyCandidateSourcingAuditV2,
} from "./legacy-audit-v2";
export {
  V1_REEVALUATION_WARNING,
  V1_SOURCE_UNAVAILABLE_WARNING,
  migrateCandidateSourcingMetricsV1ToV2,
  migrateOfferSnapshotV2,
  migrateOfferSnapshotToV2,
  migrateOfferSnapshotV1ToV2,
  parsePersistedOfferSnapshot,
} from "./migration-v2";
export {
  SOURCING_REQUEST_PACKET_MAX_BOM_LINES_V1,
  SOURCING_REQUEST_PACKET_MAX_BUILD_QUANTITY_V1,
  SOURCING_REQUEST_PACKET_MAX_BYTES_V1,
  SOURCING_REQUEST_PACKET_MAX_QUANTITY_PER_ASSEMBLY_V1,
  SOURCING_REQUEST_PACKET_MAX_TEXT_BYTES_V1,
  SOURCING_REQUEST_PACKET_SCHEMA_VERSION_V1,
  SourcingRequestPacketErrorV1,
  calculateSourcingRequestPacketContentHashV1,
  canonicalSourcingRequestPacketPayloadV1,
  finalizeSourcingRequestPacketV1,
  parseSourcingRequestPacketV1,
  serializeSourcingRequestPacketV1,
  verifySourcingRequestPacketV1,
} from "./request-packet-v1";
export type {
  SourcingRequestBomLineV1,
  SourcingRequestCandidateRefV1,
  SourcingRequestDesignResultRefV1,
  SourcingRequestPacketErrorCodeV1,
  SourcingRequestPacketInputV1,
  SourcingRequestPacketV1,
  SourcingRequestPolicyV1,
} from "./request-packet-v1";
