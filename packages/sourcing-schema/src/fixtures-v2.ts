/** Hand-authored synthetic V2 data; no provider response or live part data. */
import { finalizeOfferSnapshotV2, offerSnapshotRef } from "./canonical-v2";
import type { ManufacturerPartIdentity } from "./ids";
import { SOURCING_POLICY_SCHEMA_VERSION, type SourcingPolicy } from "./policy";
import {
  CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2,
  OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
  SOURCING_ADVISORY_WARNING_CATALOG_VERSION,
  renderSourcingPolicyConstraintV2,
  type CandidateSourcingEvaluationV2,
  type DistributorOfferV2,
  type OfferSnapshotV2,
} from "./v2";

export interface SyntheticSourcingFixtureV2 {
  description: string;
  policy: SourcingPolicy;
  snapshots: OfferSnapshotV2[];
  evaluation: CandidateSourcingEvaluationV2;
}

export const SYNTHETIC_V2_RETRIEVED_AT = "2026-08-23T00:00:00.000Z";
export const SYNTHETIC_V2_EVALUATED_AT = "2026-08-23T00:30:00.000Z";

const PART: ManufacturerPartIdentity = {
  manufacturerId: "synthetic-semiconductor-co",
  manufacturerPartNumber: "SYN-MD-1000",
};

const policy: SourcingPolicy = {
  schemaVersion: SOURCING_POLICY_SCHEMA_VERSION,
  distributors: ["digikey"],
  mode: "any_selected",
  buildQuantity: 100,
  region: "US",
  currency: "USD",
  allowedLifecycle: ["active"],
  minimumStock: 100,
  maximumLeadTimeDays: 30,
  allowBackorder: false,
  allowMarketplace: false,
  packaging: ["cut_tape"],
  maximumSnapshotAgeSeconds: 3_600,
};

const offer: DistributorOfferV2 = {
  distributor: "digikey",
  distributorSku: "SYN-DK-MD-1000",
  part: { ...PART },
  region: { state: "known", value: "US" },
  currency: { state: "known", value: "USD" },
  packaging: { state: "known", value: "cut_tape" },
  marketplace: { state: "known", value: false },
  backorderAvailable: { state: "known", value: false },
  stockQuantity: 250,
  minimumOrderQuantity: 1,
  orderMultiple: 1,
  leadTimeDays: { state: "known", value: 21 },
  leadTimeKind: { state: "known", value: "estimated_ship" },
  lifecycle: { state: "known", value: "active" },
  lifecycleSource: { state: "known", value: "manufacturer" },
  priceBreaks: [{ quantity: 1, unitPrice: 2.5 }, { quantity: 100, unitPrice: 2 }],
  productUrl: "https://example.invalid/synthetic-digikey-sku",
  retrievedAt: SYNTHETIC_V2_RETRIEVED_AT,
};

const snapshot = finalizeOfferSnapshotV2({
  schemaVersion: OFFER_SNAPSHOT_SCHEMA_VERSION_V2,
  provider: "digikey",
  requestedParts: [{ ...PART }],
  retrievedAt: SYNTHETIC_V2_RETRIEVED_AT,
  expiresAt: "2026-08-23T01:00:00.000Z",
  persistence: "ephemeral",
  evaluationEligibility: "native_v2",
  status: "complete",
  errors: [],
  offers: [offer],
  lineage: [],
});

const constraints = [
  renderSourcingPolicyConstraintV2("data_status", "pass", { code: "data_status", dataStatus: "complete" }),
  renderSourcingPolicyConstraintV2("offer_available", "pass", { code: "offer_available", proof: "offer_present" }, "driver"),
  renderSourcingPolicyConstraintV2("region", "pass", { code: "region", observed: offer.region, required: "US" }, "driver"),
  renderSourcingPolicyConstraintV2("currency", "pass", { code: "currency", observed: offer.currency, required: "USD" }, "driver"),
  renderSourcingPolicyConstraintV2("packaging", "pass", { code: "packaging", observed: offer.packaging, allowed: ["cut_tape"] }, "driver"),
  renderSourcingPolicyConstraintV2("marketplace", "pass", { code: "marketplace", observed: offer.marketplace, allowed: false }, "driver"),
  renderSourcingPolicyConstraintV2("lifecycle", "pass", { code: "lifecycle", observed: offer.lifecycle, allowed: ["active"] }, "driver"),
  renderSourcingPolicyConstraintV2("lead_time", "pass", { code: "lead_time", days: offer.leadTimeDays, kind: offer.leadTimeKind, maximumDays: 30 }, "driver"),
  renderSourcingPolicyConstraintV2("stock", "pass", { code: "stock", stockQuantity: 250, purchaseQuantity: 100, minimumStock: 100, backorderAvailable: offer.backorderAvailable, allowBackorder: false }, "driver"),
].sort((left, right) => {
  const leftKey = `${left.bomLineId ?? ""}\u0000${left.ruleId}\u0000${left.explanation}`;
  const rightKey = `${right.bomLineId ?? ""}\u0000${right.ruleId}\u0000${right.explanation}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
});

const evaluation: CandidateSourcingEvaluationV2 = {
  metrics: {
    schemaVersion: CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION_V2,
    warningCatalogVersion: SOURCING_ADVISORY_WARNING_CATALOG_VERSION,
    status: "complete",
    policyStatus: "pass",
    unknownObservationCount: 0,
    requestedBuildQuantity: 100,
    evaluatedAt: SYNTHETIC_V2_EVALUATED_AT,
    snapshotRefs: [offerSnapshotRef(snapshot)],
    snapshotAgeSeconds: 1_800,
    earliestSnapshotExpiresAt: "2026-08-23T01:00:00.000Z",
    lines: [{
      bomLineId: "driver",
      part: { ...PART },
      quantityPerAssembly: 1,
      status: "sourced",
      evaluatedOffer: { snapshot: offerSnapshotRef(snapshot), distributor: offer.distributor, distributorSku: offer.distributorSku },
      region: offer.region,
      currency: offer.currency,
      packaging: offer.packaging,
      marketplace: offer.marketplace,
      backorderAvailable: offer.backorderAvailable,
      lifecycle: offer.lifecycle,
      lifecycleSource: offer.lifecycleSource,
      leadTimeDays: offer.leadTimeDays,
      leadTimeKind: offer.leadTimeKind,
      stockQuantity: 250,
      purchaseQuantity: 100,
      buildableQuantity: 250,
      extendedCost: { amount: 200, currency: "USD" },
      warnings: [],
    }],
    buildableQuantity: 250,
    extendedBomCost: { amount: 200, currency: "USD" },
    bottleneckPart: { bomLineId: "driver", part: { ...PART }, reason: "stock" },
    maximumLeadTimeDays: 21,
    maximumLeadTimeKind: "estimated_ship",
    lifecycleCounts: { active: 1, nrnd: 0, last_time_buy: 0, obsolete: 0, unknown: 0 },
    distributorSplitCount: 1,
    singleDistributorComplete: true,
    warnings: [],
  },
  policyStatus: "pass",
  constraints,
};

export const SYNTHETIC_SOURCING_FIXTURES_V2: Record<string, SyntheticSourcingFixtureV2> = Object.freeze({
  knownFalseAndComplete: Object.freeze({
    description: "Known false boolean observations and a complete synthetic sourcing projection",
    policy,
    snapshots: [snapshot],
    evaluation,
  }),
});
