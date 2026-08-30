# ADR-0004: Sourcing offer V2 unknown-provider semantics

- Status: Accepted; implementation in progress
- Date: 2026-08-23
- Owners: scheMAGIC Sourcing and scheMAGIC Component Library
- Supersedes for V2: ADR-0001's offer-observation semantics and section 4's combined post-sourcing final rank/candidate-deletion behavior; V1 remains frozen and the engineering/commercial data boundary remains unchanged

ADR-0004 and ADR-0005 keep the complete V2 electrical result immutable.
Commercial eligibility, Pareto, rank, and order exist only in the separate
overlay; a sourcing failure never deletes an electrical V2 candidate or asks
the electrical recipe search for a replacement.

## Decision summary

Introduce a versioned `DistributorOfferV2` and `OfferSnapshotV2`. Provider facts
whose absence or meaning can be uncertain use a closed, explicit
`SourcingObservation<T>` union:

```ts
export const UNKNOWN_OBSERVATION_REASONS = [
  "not_reported",
  "not_supported",
  "unmapped",
  "conflicting",
  "legacy_unknown",
] as const;

export type UnknownObservationReason =
  typeof UNKNOWN_OBSERVATION_REASONS[number];

export type SourcingObservation<T> =
  | { state: "known"; value: T }
  | { state: "unknown"; reason: UnknownObservationReason };
```

An unknown observation is never replaced with `false`, zero, `active`, the
requested region, or an assumed package. It cannot satisfy a policy check, make
a candidate policy-compliant, or provide a value to sourcing ranking. V2 keeps
unknown electrically feasible candidates visible as **sourcing unproven** rather
than relabeling them as a sourcing pass or an electrical failure.

V2 snapshots use a schema-qualified content-addressed ID, retain verified V1
ancestry in explicit lineage, and are referenced by the full
`(id, schemaVersion, contentHash)` tuple. A bare snapshot ID is never a persisted
V2 reference.

Commercial evaluation is persisted in a separately versioned design-schema
overlay keyed by stable electrical candidate ID. Atomic sourcing constraints
authoritatively reduce to policy status; the overlay carries metrics,
constraints, commercial Pareto/rank/order, and never deletes or mutates an
electrical candidate. The overlay also binds the canonical full
`DesignResultV2` content hash, so matching candidate IDs alone cannot attach it
to modified electrical bytes.

This is a contract decision, not an implementation claim. No V2 parser,
normalizer, evaluator, UI, or export behavior described below exists until its
acceptance tests pass.

## Context

The current [`DistributorOffer`](../../packages/sourcing-schema/src/offer.ts)
requires a concrete `packaging`, `marketplace`, and `backorderAvailable`. It also
uses domain-level `"unknown"` values or optional fields for lifecycle and lead
time. This cannot distinguish:

- a provider explicitly reporting `false` from a provider not reporting the fact;
- an endpoint not supporting the fact from a response omitting it;
- an unfamiliar raw value from conflicting raw fields; or
- a migrated V1 uncertainty from a current provider observation.

The result is an asymmetric provider boundary. The official DigiKey Product
Information V4 [`ProductDetails` documentation](https://developer.digikey.com/products/product-information-v4/productsearch/productdetails?prod=true)
documents package type, marketplace status, backorder prohibition, product
status, end-of-life facts, and manufacturer lead weeks. The exact conservative
mapping is recorded in the sourcing service's
[`OFFICIAL_FIELD_MAPPING.md`](../../apps/sourcing-service/src/providers/OFFICIAL_FIELD_MAPPING.md).

The current official Mouser Search API V2
[`MouserPart` schema](https://api.mouser.com/api/docs/V2) documents quantities,
minimums, multiples, and price breaks, but it does not provide a definitive
package for the returned SKU, marketplace status, or a boolean equivalent of
`backorderAvailable`. Its lifecycle and lead-time values are strings without a
documented value vocabulary, conflict precedence, numeric unit, or lead-time
kind that proves scheMAGIC's normalized enum/day semantics. The response also
does not prove a normalized request region. A broad API overview listing a data
category is not a normalization contract for the V2 response field.

V1 therefore cannot serialize a useful partial Mouser offer without inventing
facts. The landed conservative normalizer correctly drops that offer and emits
a partial snapshot. Dropping all known quantity and pricing facts is safe, but
it prevents provider-neutral comparison and hides why the data is incomplete.

The current evaluator already has `pass | fail | unknown` policy decisions, but
the persistence and integration seams are incomplete:

- `evaluateCandidateSourcing` currently maps every status except `fail` to
  `eligible: true`;
- sourcing ranking consumes an aggregate whenever it is present, without a
  policy-pass/completeness gate;
- `SourcingDataStatus` describes transport freshness/completion, while the UI
  can present `complete` as though every semantic observation were known; and
- BOM CSV cells use a blank value for several distinct unknown causes.

## Goals

1. Preserve provider-reported knowledge without inventing unsupported facts.
2. Make known `false` distinct from unknown in TypeScript, JSON, validation,
   canonical hashing, evaluation, display, and export.
3. Let a partially documented provider emit inspectable offers while ensuring
   unknown never improves policy eligibility or sourcing rank.
4. Keep exact manufacturer-key plus exact-MPN identity unchanged.
5. Verify and migrate V1 documents without changing the V1 hash algorithm.
6. Keep the sourcing package independent from design and electrical packages.

## Non-goals

- Approving or enabling any provider, credentials, caching, persistence, or
  public-hosted use.
- Defining undocumented Mouser lifecycle, lead-time, package, marketplace,
  backorder, or region mappings.
- Treating distributor availability as an engineering or manufacturer fact.
- Generalizing every optional numeric field in V2. Existing optional stock,
  MOQ, multiple, and price data already fail closed when absent.
- Changing candidate electrical identity or the exact-MPN lookup key.

## Contract

### 1. Observation states

The reason values have provider-neutral meanings:

| Reason | Meaning |
| --- | --- |
| `not_reported` | The provider contract supports the fact, but this response did not contain a usable value. |
| `not_supported` | The approved endpoint contract has no field that proves the normalized fact. |
| `unmapped` | A raw value exists, but no reviewed deterministic mapping proves the normalized value. |
| `conflicting` | Two or more source fields make incompatible claims and no documented precedence resolves them. |
| `legacy_unknown` | V1 omitted the fact or serialized a domain-level `unknown`; migration cannot recover its cause. |

An adapter selects a reason from its reviewed field-mapping table. It must not
copy raw provider values into `reason`, warnings, logs, snapshots, or client
code. A sanitized diagnostic may identify the normalized field and reason.

### 2. Why an explicit union

V2 does not use nullability, optional absence, `boolean | "unknown"`, or add
`"unknown"` to every domain enum:

- `null` distinguishes unknown from `false`, but not why it is unknown;
- omission is not explicit in canonical JSON and is easily defaulted;
- a tri-state boolean solves only booleans and encourages provider-specific
  branches; and
- a domain enum member can accidentally enter allow-lists, counts, comparisons,
  or ranking as if it were a value in the observed domain.

The tagged union is closed, generic, hash-visible, and forces consumers to
unwrap a known value before using it.

### 3. Exact V2 offer types

V1 types remain exported under explicit names. The unsuffixed V2 alias shown
below is the target state after a coordinated package-version boundary, not a
silent widening of the current V1 API. The staged release sequence is defined
under “Release and source compatibility.”

```ts
export type KnownLifecycleStatus = Exclude<LifecycleStatus, "unknown">;
export type KnownLifecycleSource = Exclude<LifecycleSource, "unknown">;
export type KnownLeadTimeKind = Exclude<LeadTimeKind, "unknown">;
export const MAXIMUM_LEAD_KIND_TIE_BREAK_V2 = [
  "estimated_ship",
  "factory",
  "manufacturer",
] as const;

export interface DistributorOfferV1 {
  // Frozen current schema; no shape or hash changes.
}

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

export type DistributorOffer = DistributorOfferV2;
```

`region` is observed rather than copied from the lookup request. `currency` is
observed because price currency may be absent even when the request specifies a
preferred currency. A provider may emit price breaks only when currency is
known and every retained break has that exact currency. An offer with unknown
currency may retain stock/MOQ/multiple, but its price breaks must be empty.

`productUrl` is structurally HTTPS-only, contains no credentials, fragment,
control/line-separator characters, or non-canonical port, and passes one exact
raw RFC 3986 grammar in browser/server tests without WHATWG normalization.
Structural validity alone
does not make it a trusted purchase link. Before rendering a clickable provider
link, `isVerifiedDistributorProductUrlV2` requires its exact lowercase hostname
in the code-owned set for the offer's exact distributor. An absent or
mismatched registry leaves the URL inspectable as unverified text, never a
clickable purchase action. Registry host arrays are sorted/unique exact names;
suffix and parent-domain matching are forbidden.

`leadTimeDays` and `leadTimeKind` are separate observations because a response
can provide a parseable number without proving whether it is manufacturer,
factory, or estimated-ship time. A maximum-lead policy requires both to be
known.

`lastTimeBuyAt` remains optional in this minimal version because absence already
cannot satisfy policy or ranking. V2 does not infer it. A later schema may add a
`not_applicable` state if last-time-buy dates become a policy dimension.

Example: a V2 Mouser offer may preserve safe commercial values without
fabricating the unsupported fields:

```json
{
  "distributor": "mouser",
  "distributorSku": "synthetic-mouser-sku",
  "part": {
    "manufacturerId": "synthetic-semiconductor-co",
    "manufacturerPartNumber": "SYN-MD-1000"
  },
  "region": { "state": "unknown", "reason": "not_supported" },
  "currency": { "state": "known", "value": "USD" },
  "packaging": { "state": "unknown", "reason": "not_supported" },
  "marketplace": { "state": "unknown", "reason": "not_supported" },
  "backorderAvailable": { "state": "unknown", "reason": "unmapped" },
  "stockQuantity": 240,
  "minimumOrderQuantity": 1,
  "orderMultiple": 1,
  "leadTimeDays": { "state": "unknown", "reason": "unmapped" },
  "leadTimeKind": { "state": "unknown", "reason": "unmapped" },
  "lifecycle": { "state": "unknown", "reason": "unmapped" },
  "lifecycleSource": { "state": "known", "value": "distributor" },
  "priceBreaks": [{ "quantity": 100, "unitPrice": 2.15 }],
  "productUrl": "https://example.invalid/synthetic-mouser-sku",
  "retrievedAt": "2026-08-23T00:00:00.000Z"
}
```

The example is synthetic and is not a copied provider response.

### 4. Snapshot V2 and exact-MPN identity

```ts
export const OFFER_SNAPSHOT_SCHEMA_VERSION_V1 = 1 as const;
export const OFFER_SNAPSHOT_SCHEMA_VERSION = 2 as const;
export type Sha256ContentHash = `sha256:${string}`;
export type OfferSnapshotV2Id = `snapshot:v2:${Sha256ContentHash}`;
export const PROVIDER_ERROR_CATALOG_VERSION_V2 = 1 as const;
export type ProviderErrorCodeV2 =
  | "timeout"
  | "rate_limited"
  | "authentication"
  | "upstream"
  | "invalid_response"
  | "unknown";

export interface ProviderErrorV2 {
  catalogVersion: 1;
  code: ProviderErrorCodeV2;
  retryable: boolean;
}

export const PROVIDER_ERROR_TEMPLATES_V2: Readonly<
  Record<ProviderErrorCodeV2, string>
> = Object.freeze({
  timeout: "Provider request timed out",
  rate_limited: "Provider rate limit prevented this request",
  authentication: "Provider authentication was unavailable",
  upstream: "Provider service returned an upstream error",
  invalid_response: "Provider response could not be normalized safely",
  unknown: "Provider request failed for an unknown reason",
});

export function renderProviderErrorV2(
  error: Readonly<ProviderErrorV2>,
): string;

export interface OfferSnapshotV1Ref {
  id: string;
  schemaVersion: 1;
  contentHash: Sha256ContentHash;
}

export interface OfferSnapshotV2Ref {
  id: OfferSnapshotV2Id;
  schemaVersion: 2;
  contentHash: Sha256ContentHash;
}

export type OfferSnapshotLineageRef =
  | OfferSnapshotV1Ref
  | OfferSnapshotV2Ref;

export interface OfferSnapshotV1 {
  schemaVersion: 1;
  offers: DistributorOfferV1[];
  // All other frozen V1 fields.
}

export interface OfferSnapshotV2 {
  schemaVersion: 2;
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

export type OfferSnapshot = OfferSnapshotV2;
export type PersistedOfferSnapshot = OfferSnapshotV1 | OfferSnapshotV2;

export type OfferSnapshotMigrationV2 =
  | { status: "migrated"; snapshot: OfferSnapshotV2 }
  | { status: "invalid_source"; issues: ValidationIssue[] }
  | { status: "unsupported_v1_value"; issues: ValidationIssue[] };

export function parseOfferSnapshotV1(input: unknown): OfferSnapshotV1;
export function parseOfferSnapshotV2(input: unknown): OfferSnapshotV2;
export function parsePersistedOfferSnapshot(
  input: unknown,
): OfferSnapshotV1 | OfferSnapshotV2;
export function migrateOfferSnapshot(
  input: Readonly<OfferSnapshotV1 | OfferSnapshotV2>,
): OfferSnapshotMigrationV2;
export function canonicalOfferSnapshotPayloadV1(
  snapshot: Readonly<OfferSnapshotV1>,
): string;
export function calculateOfferSnapshotContentHashV1(
  snapshot: Readonly<OfferSnapshotV1>,
): Sha256ContentHash;
export function canonicalOfferSnapshotPayloadV2(
  snapshot: Omit<OfferSnapshotV2, "id" | "contentHash"> | OfferSnapshotV2,
): string;
export function calculateOfferSnapshotContentHashV2(
  snapshot: Omit<OfferSnapshotV2, "id" | "contentHash"> | OfferSnapshotV2,
): Sha256ContentHash;
export function calculateOfferSnapshotIdV2(
  snapshot: Omit<OfferSnapshotV2, "id" | "contentHash"> | OfferSnapshotV2,
): OfferSnapshotV2Id;
export function finalizeOfferSnapshotV2(
  snapshot: Omit<OfferSnapshotV2, "id" | "contentHash">,
): OfferSnapshotV2;

export type ProviderPolicyManifestV1 = ProviderPolicyManifest;
export interface ProviderPolicyManifestV2
  extends Omit<ProviderPolicyManifestV1, "schemaVersion" | "persistence"> {
  format: "schemagic-provider-policy";
  schemaVersion: 2;
  version: string;
  persistence: ProviderPolicyManifestV1["persistence"] & {
    userLocalRetention: "forbidden" | "perpetual_approved";
    externalExportRetention:
      | "forbidden"
      | "until_delete_after"
      | "perpetual_approved";
  };
  contentHash: Sha256ContentHash;
}
export function parseProviderPolicyManifestV2(
  input: unknown,
): ProviderPolicyManifestV2;
export function canonicalProviderPolicyManifestV2Payload(
  policy: Omit<ProviderPolicyManifestV2, "contentHash">
    | ProviderPolicyManifestV2,
): string;
export function calculateProviderPolicyManifestV2ContentHash(
  policy: Omit<ProviderPolicyManifestV2, "contentHash">
    | ProviderPolicyManifestV2,
): Sha256ContentHash;
export function providerPolicyRefV2(
  policy: Readonly<ProviderPolicyManifestV2>,
): ProviderPolicyRefV2;
export function migrateProviderPolicyManifestV1ToV2(
  policy: Readonly<ProviderPolicyManifestV1>,
  version: string,
): ProviderPolicyManifestV2;

export type SnapshotAuthorizationV1Id =
  `snapshot-authorization:v1:${Sha256ContentHash}`;
export interface ProviderPolicyRefV2 {
  id: string;
  version: string;
  contentHash: Sha256ContentHash;
}
export type SnapshotAuthorizedUseV1 =
  | "display"
  | "user_local_storage"
  | "download_export"
  | "public_share";
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
export interface SnapshotAuthorizationVerifierV1 {
  verify(
    authorization: Readonly<SnapshotAuthorizationV1>,
    snapshot: Readonly<OfferSnapshotV2>,
  ): ValidationIssue[];
  authorizeOperation(
    use: SnapshotAuthorizedUseV1,
    snapshots: readonly OfferSnapshotV2[],
    authorizations: readonly SnapshotAuthorizationV1[],
  ): VerifiedCommercialAuthorizationOperationV1;
  validateOperation(
    operation: VerifiedCommercialAuthorizationOperationV1,
    expectedUse: SnapshotAuthorizedUseV1,
    snapshots: readonly OfferSnapshotV2[],
    authorizations: readonly SnapshotAuthorizationV1[],
  ): ValidationIssue[];
}
declare const VERIFIED_COMMERCIAL_AUTHORIZATION_OPERATION_V1: unique symbol;
export interface VerifiedCommercialAuthorizationOperationV1 {
  readonly [VERIFIED_COMMERCIAL_AUTHORIZATION_OPERATION_V1]: true;
  readonly use: SnapshotAuthorizedUseV1;
  readonly checkedAt: string;
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
export function parseAuthorizedOfferSnapshotDocumentV2(
  input: unknown,
): AuthorizedOfferSnapshotDocumentV2;
export function parseSnapshotAuthorizationV1(
  input: unknown,
): SnapshotAuthorizationV1;
export function canonicalSnapshotAuthorizationClaimsV1(
  authorization: Omit<
    SnapshotAuthorizationV1,
    "id" | "contentHash" | "signature"
  > | SnapshotAuthorizationV1,
): string;
export function calculateSnapshotAuthorizationContentHashV1(
  authorization: Omit<
    SnapshotAuthorizationV1,
    "id" | "contentHash" | "signature"
  > | SnapshotAuthorizationV1,
): Sha256ContentHash;
export function calculateSnapshotAuthorizationIdV1(
  authorization: Omit<
    SnapshotAuthorizationV1,
    "id" | "contentHash" | "signature"
  > | SnapshotAuthorizationV1,
): SnapshotAuthorizationV1Id;
export function snapshotAuthorizationRefV1(
  authorization: Readonly<SnapshotAuthorizationV1>,
): SnapshotAuthorizationRefV1;
export function issueSnapshotAuthorizationV1(
  snapshot: Readonly<OfferSnapshotV2>,
  policy: Readonly<ProviderPolicyManifestV2>,
  request: Readonly<{
    executionMode: "public_hosted" | "self_hosted";
    authorizedUses: readonly SnapshotAuthorizedUseV1[];
    issuedAt: string;
  }>,
  signer: SnapshotAuthorizationSignerV1,
): Promise<SnapshotAuthorizationV1>;
```

`ManufacturerPartIdentity` remains exactly the stable manufacturer registry key
plus exact, case-sensitive `manufacturerPartNumber`. An offer must still match a
requested identity. Unknown observations do not weaken duplicate SKU/identity
checks or permit fuzzy, distributor-SKU, parametric, or manufacturer-name-only
matching.

Requested parts are code-unit sorted/unique by the canonical JSON tuple
`[manufacturerId,manufacturerPartNumber]`. Offers are sorted by
`[distributor,distributorSku,manufacturerId,manufacturerPartNumber]` and reject
duplicate `(distributor,distributorSku)`; one SKU resolves to one exact part,
while the same part may legitimately appear under several distinct packaging
SKUs. Price breaks are strictly ascending with unique quantity. Exact MPN
strings preserve ADR-0003's complete non-empty UTF-8 identity bytes, including
characters that require JSON/CSV escaping; they are never interpolated into a
delimiter or executable format. Distributor SKU strings are non-empty Unicode
scalar strings that reject C0/C1/DEL, CR/LF, U+2028, and U+2029 but otherwise
retain spaces and punctuation byte-for-byte.

All V2 timestamps are strict RFC 3339 strings with an explicit `Z` or numeric
offset and zero to nine fractional-second digits. Comparisons use a code-owned
calendar/offset parser to exact signed Unix epoch nanoseconds (`bigint`), never
host `Date.parse`; invalid dates, offsets, leap fields, or out-of-range instants
reject.
The accepted subset has exactly four year digits `0001`–`9999`, Gregorian
calendar dates, hours `00`–`23`, seconds `00`–`59` (no leap seconds), and offsets
from `-14:00` through `+14:00` with minute `00` required at either 14-hour
extreme. Normalizing the offset must stay within
`0001-01-01T00:00:00.000000000Z` through
`9999-12-31T23:59:59.999999999Z` inclusive.
Different strings denoting the same instant tie on their original code-unit
string and then the canonical full ref. An offer's `retrievedAt` must denote
the same instant as its containing snapshot, and `expiresAt` must be strictly
later than `retrievedAt`.

`productUrl` is HTTPS-only, contains no credentials, fragment, control or line
separator, and uses no noncanonical explicit port. Structural validation marks
it only as a syntactically safe unverified link. A code-owned distributor-link
registry binds each `DistributorId` to an exact allowed hostname set;
the dedicated code-owned verification below must prove exact host membership before UI may render a
clickable provider purchase link. An unverified URL is displayed as inert text
or omitted, never as a trusted provider link.

```ts
export interface ParsedRfc3339InstantV2 {
  original: string;
  epochNanoseconds: bigint;
}
export function parseRfc3339InstantV2(value: string): ParsedRfc3339InstantV2;
export function compareRfc3339InstantsV2(left: string, right: string): number;
export function formatRfc3339InstantV2(epochNanoseconds: bigint): string;
export function canonicalCommercialRationalV2(
  numerator: bigint,
  denominator: bigint,
): number;

export const DISTRIBUTOR_PRODUCT_LINK_HOSTS_V2:
  Readonly<Record<DistributorId, readonly string[]>>;
export function isVerifiedDistributorProductUrlV2(
  offer: Readonly<DistributorOfferV2>,
): boolean;
```

The registry is code-owned, exact-host only, recursively frozen, and covered by
provider-policy review. Synthetic `.invalid` URLs deliberately return false.

V2 provider errors contain no free-form upstream message. The closed catalog
maps code to a generic UI string; raw exception text, request values, response
fragments, credentials, URLs, and provider-specific detail never enter the
snapshot, hash, logs, or client. Errors sort by code ascending with the Unicode-
code-unit comparator, then `retryable: false` before `true`; exact tuple
duplicates reject, and every row carries the exact catalog version.
`renderProviderErrorV2` returns exactly `PROVIDER_ERROR_TEMPLATES_V2[code]`;
`retryable` is separately displayed and never changes the message bytes.

V2 defines a new, non-circular canonical identity algorithm:

1. Canonicalize the entire V2 snapshot except `id` and `contentHash`. This
   includes `schemaVersion: 2`, sorted `lineage`, and every observation's
   `state`, `value`, or `reason`.
2. Set `contentHash` to SHA-256 of those canonical bytes.
3. Set `id` to the exact string `snapshot:v2:${contentHash}`.

Validation recomputes both fields and rejects either mismatch. Consequently
known `false` and unknown produce different bytes, hashes, and V2 IDs. Provider
offer sorting, lineage sorting by `(schemaVersion, id, contentHash)`, and the
existing exact-MPN request sorting remain deterministic.

V1 hash verification remains byte-for-byte governed by the V1 canonical
payload. A migrated V2 document receives a newly computed V2 hash; V1 and V2
hashes and IDs are not expected to match. Migration places the verified V1
`{ id, schemaVersion: 1, contentHash }` in V2 `lineage`; it never reuses the V1
ID as the V2 ID. A fresh V2 provider result has `lineage: []` and
`evaluationEligibility: "native_v2"`. A migrated V1 snapshot is marked
`legacy_audit_only`: its hash proves only the historical serialized bytes, not
that its normalizer truly observed V2 packaging, marketplace, backorder,
region, or other required facts. Audit-only snapshots may be retained in
migration history but are rejected by native commercial evaluation and can
never produce a V2 policy pass. A newly approved V2 provider lookup is required
to replace them.

The stable native-evaluation identity is the full `OfferSnapshotV2Ref`, not a
bare ID. Only `OfferSnapshotV2.lineage` may contain the versioned lineage union.
Even a malicious or historical V1 string that resembles a V2 ID cannot resolve
as V2 without the matching schema version and content hash. Caches and stores
index the full ref tuple and namespace canonicalization by schema version;
cache versioning alone is not considered reference integrity.

Snapshot `persistence` and `evaluationEligibility` are claimed audit metadata,
not authority. `finalizeOfferSnapshotV2` is a public deterministic hash helper
and cannot grant provider permission. Every live evaluation, local persistence,
or export operation requires one verified `SnapshotAuthorizationV1` for each
exact V2 full ref. The authorization content hash is SHA-256 over the canonical
claims excluding `id`, `contentHash`, and `signature`; its ID derives from that
hash. `signature` is unpadded base64url Ed25519 over the canonical claim UTF-8
bytes. The verifier resolves `issuerKeyId` through its explicit trusted-key
store, verifies the signature once, exact-joins snapshot ref/provider, resolves
the exact hash-pinned provider-policy manifest, and proves that execution mode
and effective persistence are permitted. No caller-supplied key, manifest, or
Boolean can expand permission.

The current `ProviderPolicyManifest` is explicitly
`ProviderPolicyManifestV1` and remains frozen. V2 is a recursively closed,
hash-pinned additive contract. Its canonical payload excludes only
`contentHash`; any change to state, approval, exact-MPN bound, rate/cache,
attribution, persistence, availability, notes, or terms-related permission
changes the standard SHA-256 hash and policy ref. V1 migration requires an
explicit version, preserves the disabled/approval state and every old field,
and conservatively sets both `userLocalRetention` and
`externalExportRetention` to `"forbidden"`; only a newly reviewed V2 manifest
may assert a broader retention grant.

Ownership remains acyclic. `@opencircuit/sourcing-schema` owns only
`ProviderPolicyRefV2`, authorization wire types, structural parsers/hash/ref
helpers, and the verifier interface. `@opencircuit/sourcing-core` already owns
the V1 manifest and therefore owns `ProviderPolicyManifestV2`, its parser,
canonical/hash/ref helpers, and V1 migration. The server-only sourcing service
owns the signer implementation, trusted policy/key resolution, issuance, and
key rotation. `providerPolicyRefV2(policy)` is exactly
`{id:policy.policyId,version:policy.version,contentHash:
calculateProviderPolicyManifestV2ContentHash(policy)}` and rejects a stored hash
mismatch. Verification resolves by that entire ref and requires exact equality
with the parsed manifest; changing any permission/term/availability byte breaks
the ref and authorization.

Authorization issuance/verification uses this exact truth table:

- all modes require policy `state: "enabled"`, approved authorization,
  configured positive rate limit, positive safe-integer cache maximum TTL and
  deletion lifetime, exact-MPN-only bounded lookup, and the selected execution
  mode enabled;
- `ephemeral` requires that exact persistence in the allow-list and authorizes
  only sorted `display` use;
- `user_local` requires that exact persistence, `browserStorageAllowed: true`,
  and `userLocalRetention: "perpetual_approved"`, and may authorize sorted
  `display,user_local_storage`. A finite deletion promise is not treated as
  enforceable browser storage while a device may be closed/offline/backed up;
- `exportable` requires that exact persistence, `exportAllowed: true`, and
  `externalExportRetention: "perpetual_approved"`; only then may it authorize
  `download_export`. It may additionally authorize `user_local_storage` only
  with browser storage permission and `public_share` only with both
  `publicShareAllowed: true` and the same perpetual approval. A finite
  `until_delete_after` grant is confined to provider-controlled ephemeral cache
  and can never authorize browser storage or irrevocable download/share;
- every claim includes `display`, requires `authorizedUses` in ascending
  Unicode-code-unit order (`display`, `download_export`, `public_share`,
  `user_local_storage` when all four are present), rejects duplicate/unsorted
  uses, and cannot include a use whose preceding condition is false; and
- `effectivePersistence === snapshot.persistence`,
  `effectiveEvaluationEligibility === snapshot.evaluationEligibility ===
  "native_v2"`, and provider/full-ref equality are mandatory. The signed
  permission is an exact verified grant, not a maximum that self-claimed fields
  can expand.

Issuer and verifier both require
`snapshot.expiresAt <= snapshot.retrievedAt +
policy.cache.maximumTtlSeconds * 1_000_000_000n`, using the exact timestamp
parser/BigInt addition and accepted-range check; equality is allowed. Provider
`staleIfErrorSeconds` may govern a server refresh attempt but never lengthens a
signed snapshot's fresh authorization or expiry. An over-bound, overflowing, or
out-of-range expiry cannot receive or retain authorization.

Authorization `attribution` is derived exactly from the resolved policy's
provider/ref and `attribution.required/label`; it is not caller text. Views and
overlays store the code-unit-sorted unique union by
`(provider,policy.contentHash,label)`. UI and every commercial export render
each required label verbatim in a dedicated attribution surface/column. A
changed label changes the policy hash/ref and invalidates the old authorization.

`issuedAt` uses the same exact nanosecond timestamp parser and must be at or
after snapshot retrieval. An ephemeral authorization has finite `notAfter` at
the exact instant `snapshot.retrievedAt + deleteAfterSeconds`, so reissuing an
old snapshot cannot restart its retention clock. Issuance at or after that
cutoff rejects and finite authorization requires `issuedAt < notAfter`.
User-local and exportable
authorization are issued only under their corresponding
`perpetual_approved` rule and therefore require `notAfter: null`; the reverse
combinations reject. A finite `notAfter` must be later than issue time.
Evaluation requires
`issuedAt <= evaluatedAt <= notAfter`, and every display/save/export operation
requires `issuedAt <= trusted checkedAt <= notAfter`; null has no upper bound. The
ephemeral view stores the earliest finite authorization deadline. A persisted
overlay is valid only when all authorizations are perpetual and therefore
stores null; no browser timed-deletion guarantee is claimed. Provider-controlled
ephemeral cache deletion remains a sourcing-service responsibility.
Download/public-share also require their exact signed
use at operation time; the tool never claims it can revoke a file already
exported under an approved grant.
Every derived instant, including `notAfter`, is rendered by
`formatRfc3339InstantV2` in UTC with exactly four year digits, nine fractional
digits, and `Z`; equivalent offset or shorter-fraction spellings cannot create
different authorization bytes.

`issuerKeyId` matches `^[a-z0-9][a-z0-9._:-]{0,127}$`. A structural
authorization parser captures plain data once, rejects unknown keys, validates
an unpadded base64url signature encoding exactly 64 bytes, and recomputes hash/
ID, but never claims cryptographic validity. Only `verify` supplies authority.
`issueSnapshotAuthorizationV1` is server-only; it validates the exact parsed
snapshot and hash-verified policy before calling the injected signer and never
exposes private key bytes. The caller supplies only execution mode, requested
uses, and issue time; provider/ref/effective eligibility/persistence, policy
ref, issuer ID, and deadline are derived, and the signer's issuer ID must match.
Browser-safe
verification and server issuance agree on the exact canonical claim bytes.

Operation time is never ordinary caller data. The application-owned verifier
captures its trusted clock once inside `authorizeOperation`, returns a
non-serializable runtime token registered to that verifier instance, exact use,
snapshot refs, and authorization refs, and later revalidates it through
`validateOperation`. Public evaluation/save/export functions reject a plain
lookalike or a token for another verifier/use/ref set. Production public-hosted
transfer runs server-side; self-hosted composition explicitly owns its trust
clock. Tests may inject a deterministic clock only into the verifier factory,
never into an export request. Back-dating a forged `checkedAt` cannot bypass a
deadline.

The server-only provider service issues an authorization only after the
checked-in provider policy is enabled and the exact execution/persistence use
is approved. Public-hosted and self-hosted deployments use separately trusted
issuer keys/policies. Current disabled DigiKey/Mouser manifests cannot issue an
authorization. A migrated V1 snapshot has no native authorization. Re-finalizing
an audit-only snapshot as native or ephemeral snapshot as exportable changes its
full ref and still lacks a valid signature, so evaluation/export rejects.
Synthetic acceptance tests use an explicitly injected test verifier/key that is
not present in production trust stores.

### 5. Candidate sourcing metrics V2

Transport status and policy knowledge are separate. `status` continues to mean
snapshot transport/freshness state, not that all commercial semantics are
known.

```ts
export const CANDIDATE_SOURCING_METRICS_SCHEMA_VERSION = 2 as const;
export type SourcingPolicyStatus = "pass" | "unknown" | "fail";
export const SOURCING_POLICY_RULE_CATALOG_VERSION = 1 as const;
export type SourcingPolicyRuleCodeV1 =
  | "data_status"
  | "offer_available"
  | "region"
  | "currency"
  | "packaging"
  | "marketplace"
  | "lifecycle"
  | "lead_time"
  | "stock"
  | "single_distributor"
  | "migration";

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

export type CandidateSourcingPolicyRuleCodeV1 =
  | "data_status"
  | "single_distributor";
export type LineSourcingPolicyRuleCodeV1 = Exclude<
  SourcingPolicyRuleCodeV1,
  CandidateSourcingPolicyRuleCodeV1
>;
export type SourcingPolicyRuleIdV1<Code extends SourcingPolicyRuleCodeV1> =
  Code extends "data_status" ? "sourcing.data_status"
    : Code extends "migration" ? "sourcing.migration"
      : `sourcing.policy.${Code}`;
export type SourcingPolicyRuleInputsForV1<
  Code extends SourcingPolicyRuleCodeV1,
> = Extract<SourcingPolicyRuleInputsV1, { code: Code }>;

export type SourcingPolicyConstraintForV1<
  Code extends SourcingPolicyRuleCodeV1,
> = {
  ruleCatalogVersion: 1;
  ruleId: SourcingPolicyRuleIdV1<Code>;
  code: Code;
  status: SourcingPolicyStatus;
  inputs: SourcingPolicyRuleInputsForV1<Code>;
  explanation: string;
} & (Code extends CandidateSourcingPolicyRuleCodeV1
  ? { bomLineId?: never }
  : { bomLineId: string });

export type SourcingPolicyConstraintV2 = {
  [Code in SourcingPolicyRuleCodeV1]: SourcingPolicyConstraintForV1<Code>
}[SourcingPolicyRuleCodeV1];

export declare function parseSourcingPolicyConstraintV2(
  input: unknown,
): SourcingPolicyConstraintV2;

export declare function validateSourcingPolicyConstraintV2(
  input: unknown,
): ValidationIssue[];

export declare function renderSourcingPolicyConstraintV2<
  Code extends SourcingPolicyRuleCodeV1,
>(
  code: Code,
  status: SourcingPolicyStatus,
  inputs: SourcingPolicyRuleInputsForV1<Code>,
  ...scope: Code extends CandidateSourcingPolicyRuleCodeV1
    ? []
    : [bomLineId: string]
): SourcingPolicyConstraintV2;

export interface EvaluatedOfferRef {
  snapshot: OfferSnapshotV2Ref;
  distributor: DistributorId;
  distributorSku: string;
}

export type BomLineSourcingStatusV2 =
  | "sourced"
  | "unavailable"
  | "policy_rejected"
  | "unknown";

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

export interface BomBottleneckV2 {
  bomLineId: string;
  part: ManufacturerPartIdentity;
  reason: "stock" | "policy";
}

export interface CandidateSourcingMetricsV2 {
  schemaVersion: 2;
  warningCatalogVersion: 1;
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

export type CandidateSourcingMetrics = CandidateSourcingMetricsV2;
```

V2 renames V1 `selectedOffer` to `evaluatedOffer` and replaces its bare
`snapshotId` with a full snapshot ref. Candidate metrics likewise replace
`snapshotIds` with sorted, unique `snapshotRefs`. A policy-rejected or unknown
offer was evaluated, but was not selected as policy-compliant. `status:
"sourced"` means the line's policy checks passed; an unknown observation on an
irrelevant policy dimension does not change that line status, but is retained
and counted. Every line ref must exactly equal one entry in candidate
`snapshotRefs`; matching only `id` or only `contentHash` is invalid.

If `evaluatedOffer` is present, all nine observation fields shown above are
present. Its `purchaseQuantity` is mandatory because safe required/MOQ/multiple
arithmetic is always derivable for an admitted offer. `stockQuantity` is an
exact copy and `buildableQuantity` is mandatory iff the selected offer has
known stock; both are absent otherwise. `extendedCost` is mandatory iff the
selected offer has known policy currency and an applicable price break, and is
absent otherwise. These presence rules apply identically to pass, unknown, and
failed policy offers; omission cannot hide a derivable value and an invented
field cannot make unknown data rankable. A line with no evaluated offer omits
all observations and all four derived/copy fields. `unknownObservationCount`
counts unknown fields on evaluated offers only, not offers that lost the
deterministic selection. Lifecycle counts sum to the BOM line count: a known
lifecycle increments its value, while an unknown or absent lifecycle increments
the existing `unknown` count. Aggregate cost requires known currency and an
applicable price. Aggregate lead time requires known days and kind for every
sourced line. Monetary products and the code-unit-BOM-line-ordered total must
match exactly; no epsilon accepts a different commercial rank value.
`bottleneckPart` is present only when every BOM line has known
buildability and a resolved non-unknown line status; it is then the
minimum-buildability line with code-unit ID tie-break and a status-derived
reason. Otherwise it is omitted. No missing value becomes zero.
`lines` are code-unit sorted and unique by `bomLineId`; reversing an evaluator's
line array is normalized before validation and cannot change overlay bytes.

For a line with an evaluated offer, reducing only that line's constraints maps
pass → `sourced`, unknown → `unknown`, and fail → `policy_rejected`. A line with
no evaluated offer is `unavailable`; its offer-availability constraint is fail
only when a fresh complete lookup proves no offer, otherwise unknown. These line
statuses are derived projections and cannot override constraint status.

The sourcing schema, not design-schema or sourcing-core, owns
`SourcingPolicyStatus` and `SourcingPolicyConstraintV2` so the package dependency
remains one-way. A persisted constraint is recursively closed to exactly
`ruleCatalogVersion`, correlated `ruleId`/`code`/`inputs`, `status`, derived
`explanation`, and the rule's required or forbidden `bomLineId`; unknown keys
are rejected. The rule ID is derived exactly from the code. Input objects are
closed, observation branches use V2 semantics, and every set-like input array
is code-unit sorted/unique.

`explanation` is not free text. It is the canonical JSON string of exactly
`{ruleCatalogVersion:1,ruleId,code,status,inputs,bomLineId:<string-or-null>}`
with code-unit key order. `renderSourcingPolicyConstraintV2` is the sole
constructor and an independent canonical implementation must produce identical
UTF-8 bytes. UI may translate `code` and `inputs` into friendlier presentation,
but persisted warnings copy this exact explanation for non-pass rules. The
validator rejects mismatched code/input discriminants, rule IDs, scope,
renderer bytes, or arbitrary messages.

Lifecycle rule `allowed` is exactly the code-unit-sorted unique projection of
`policy.allowedLifecycle.filter((value) => value !== "unknown")`. The frozen
V1 compatibility sentinel stays parseable, may yield an empty known allow-list,
and never turns an unknown observation into pass.

Applicability is exact: every native candidate has one `data_status`; every
native line always has one `offer_available`. A line with an evaluated offer
also has exactly one `region`, `currency`, `lifecycle`, and `stock` rule;
packaging, marketplace, and lead-time appear only when their
corresponding policy filter applies; `single_distributor` appears only once and
only in that mode; migration appears once per migrated line and never in a
native evaluation. A migrated audit has one candidate `data_status` and exactly
one `migration` rule per line, with none of the native policy rules.
Non-applicable rules are absent, not synthetic passes. The
matrix below determines status and inputs; contextual validation recomputes the
complete sorted constraint set. The contract intentionally has no electrical
`EvidenceRef`, `actual`, `limit`, or `margin`. Commercial observation provenance
stays in exact snapshot refs and metrics rather than importing design-schema
evidence types.

## Policy evaluation semantics

Every check returns `pass`, `fail`, or `unknown`. `unknown` means the evidence
cannot prove the predicate; it is never a weak pass.

| Check | Pass | Fail | Unknown |
| --- | --- | --- | --- |
| Region | Known value equals policy region. | Known value differs. | Observation unknown. |
| Currency | Known value equals policy currency. | Known value differs. | Observation unknown. |
| Packaging, filter present | Known value is allowed. | Known value is not allowed. | Observation unknown. |
| Packaging, no filter | Check is not applicable; it does not block the line. | Never. | The observation remains visible/countable but does not change policy status. |
| Marketplace, disallowed | Known `false`. | Known `true`. | Observation unknown. |
| Marketplace, allowed | Check is not applicable; either known boolean passes. | Never. | The observation remains visible/countable but does not change policy status. |
| Lifecycle | Known non-obsolete value is allowed. | Known obsolete, or known value is not allowed. | Lifecycle observation unknown. V1 policy text containing `"unknown"` does not turn this into pass. |
| Maximum lead time set | Days and kind are known, and days are at or below the maximum. | Days and kind are known, and days exceed the maximum. | Either observation is unknown. |
| No maximum lead time | Check is not applicable. | Never. | Unknown is retained/countable but does not change policy status. |
| Minimum current stock set | Known stock is at least `minimumStock`; continue to fulfillment. | Known stock is below `minimumStock`, regardless of backorder. | Stock unknown. |
| Purchase fulfillment, stock known | Stock is at least `purchaseQuantity`, or stock is short and backorder is allowed/known true. | Stock is short and backorder is disallowed or known false. | Stock is short, backorder is allowed, and its observation is unknown. |
| Purchase fulfillment, stock unknown and no minimum | Backorder is allowed and known true, proving orderability but not buildability. | Never from unknown stock alone. | Backorder is disallowed, known false, or unknown; current fulfillment is unproven. |
| Price/cost aggregate (not a V2 policy rule) | Applicable price and known matching currency produce cost. | Never changes policy status in V2. | No applicable break or unknown currency omits cost and emits the advisory; never zero. A future maximum-cost policy requires a new rule-catalog version. |
| Candidate data status | `complete`. | Never. | `unavailable`, `partial`, `stale`, or `provider_error`. |
| Single distributor mode | One selected-distributor plan proves every BOM line pass. | Fresh complete data proves every allowed distributor plan has at least one failed line and none is unknown. | Any required provider/line proof is unavailable, partial, stale, errored, or unknown. |

Multiple line checks combine as `fail` if any check fails, otherwise `unknown`
if any applicable check is unknown, otherwise `pass`. An explicit failure is not
hidden by a different unknown field.

Policy status is derived from the deterministic evaluated offer only.
Non-winning lifecycle observations remain inspectable in their exact snapshots
but do not create a second line-level conflict field or override the selected
offer. This avoids an unpersistable hidden conflict rule; selection and full
snapshot refs make the decision auditable.

### Exact snapshot, offer, and distributor-plan selection

Selection is schema-owned and contextually recomputed; evaluator output cannot
choose a different plausible offer. Timestamps later than `evaluatedAt` are
invalid. The engine first sorts the supplied native-V2 snapshot set by full ref
`[schemaVersion,id,contentHash]`, rejects duplicate refs/documents, and passes
that exact detached order to every callback and contextual validator.

Active selection is per required coverage cell
`(policy distributor, exact BOM ManufacturerPartIdentity)`, not globally per
distributor. For each cell, consider snapshots from that distributor whose
`requestedParts` contains that exact part and select greatest retrieval instant,
then code-unit-smallest original timestamp string, then smallest canonical full
ref tuple. A one-part DigiKey snapshot can therefore remain active alongside a
newer one-part snapshot for another BOM line; one batch snapshot may win several
cells. Retain every supplied full ref in metrics for audit, but evaluate a line
only from the active snapshot in its exact cell.

The evaluation-active cell set is mode-sensitive. For `any_selected` it is
every allowed distributor × BOM-part cell, preserving conservative cross-
provider negative proof. For `single_distributor`, first build/select the plans
below, then it is only the winning distributor's BOM-part cells; missing or
partial non-selected plans remain relevant to proving that all plans fail but
cannot downgrade a winning all-pass plan. Age/expiry aggregation dedupes only
the evaluation-active winning refs. Every supplied ref remains in metrics for
audit.

Transport status has this total precedence over the evaluation-active cells:
if none has an active snapshot it is `unavailable`; if every cell has an active
snapshot and every distinct
active snapshot is `provider_error` with no offers it is `provider_error`;
otherwise any distinct active snapshot is stale → `stale`; otherwise any cell
is missing or any active snapshot is not `complete` → `partial`; otherwise it
is `complete`. A snapshot is stale when `evaluatedAt` is strictly later than
the earlier of its explicit `expiresAt` and
`retrievedAt + policy.maximumSnapshotAgeSeconds`; equality remains fresh.
`maximumSnapshotAgeSeconds` is a positive safe integer and the nanosecond
addition is implemented as exact
`retrievedAtNs + BigInt(maximumSnapshotAgeSeconds) * 1_000_000_000n` and must
remain within the accepted timestamp range. The precedence, not input order,
resolves overlapping error/stale/partial cases.

`snapshotAgeSeconds` is
`canonicalCommercialRationalV2(max(evaluatedAtNs-retrievedAtNs),
1_000_000_000n)` over distinct evaluation-active snapshots and
`earliestSnapshotExpiresAt` is the minimum expiry
instant, tied by original code-unit string then full ref. Both are absent only
when no evaluation-active cell exists. Older/non-selected snapshots remain in sorted audit
`snapshotRefs` but cannot make an otherwise fresh active view stale or alter
age/expiry. Future retrieval is rejected rather than clamped to age zero.

`canonicalCommercialRationalV2` uses BigInt long division to round the exact
non-negative rational to twelve significant decimal digits, ties-to-even, then
parses that canonical base-10 ASCII result as a finite number. It never first
converts a nanosecond numerator to `number`; 1 ns, durations above 104 days, and
the full accepted timestamp range therefore have one cross-runtime result.

For each exact BOM part, derive purchase quantity, observations, atomic policy
constraints, policy status, cost, buildability, and lead information for every
matching offer in that part's active distributor cells. Sort evaluated offers
by this total comparator:

1. policy state `pass`, then `unknown`, then `fail`;
2. known same-policy-currency applicable extended cost before unknown cost,
   then numeric cost ascending;
3. known buildable quantity before unknown, then quantity descending;
4. known lead days and kind before unknown, then days ascending, then the
   exported `MAXIMUM_LEAD_KIND_TIE_BREAK_V2` order;
5. distributor, distributor SKU, and canonical full snapshot-ref tuple by the
   code-unit comparator.

The first entry is the line's `evaluatedOffer`; no input insertion order or
locale participates. Exact monetary amounts use the same deterministic
JavaScript-number multiplication and stable BOM-line summation frozen by the
contextual validator; a tolerance is not permitted.

For `any_selected`, select each line independently. For `single_distributor`,
build one complete line plan per policy distributor using only that
line's active `(distributor, exact part)` cell and the comparator above. Plans sort by aggregate
status `pass`, `unknown`, `fail`; sourced-line count descending; all-line cost
known before incomplete cost; deterministic total cost ascending; then
distributor ID. The first plan supplies every evaluated line and the
candidate-level single-distributor constraint. The contextual validator
recomputes active snapshots, every evaluated offer, and the selected plan from
the exact context and rejects any alternative even when its policy status is
the same.

Plan comparison cost is present whenever every plan line has a derived line
cost, regardless of that line's policy status. It is computed by sorting the
plan lines by BOM line ID, starting at zero, and applying
`canonicalCommercialNumberV2(total + lineCost)` after each addition. Any line
without cost makes the plan comparison cost unknown. This hidden comparator
value selects the persisted offer refs but is not itself a candidate aggregate;
the candidate `extendedBomCost` rule below still requires every line sourced.

The `single_distributor` rule input always stores the first selected plan's
non-null policy `selectedDistributor`, even when that plan is unknown or failed.
`observedDistributors` is exactly the sorted unique distributors of evaluated
offers present in that selected plan and may be empty. Pass means every line in
that plan passes; fail requires fresh-complete proof that every allowed plan has
at least one failed line and none has an unknown line; every other state is
unknown. These exact inputs and status feed the canonical explanation, so no
implementation may substitute the policy allow-list, active-snapshot set, or
all-plan union for `observedDistributors`.
In particular, a complete all-pass DigiKey plan remains candidate `complete`/
`pass` when an allowed but non-selected Mouser plan has no cells; the missing
Mouser proof prevents only a candidate `fail` conclusion about all plans.

An `offer_available` failure requires complete negative proof. In
`any_selected`, every allowed distributor must have an active, fresh,
`complete` snapshot that requested the exact part and none may contain a
matching offer; otherwise the proof is `not_proven`/unknown. In a
`single_distributor` plan the same rule is distributor-local: that
distributor's active fresh complete exact-part lookup may prove no offer for the
plan, while missing/partial/stale/error data stays unknown. One distributor's
negative result never proves another distributor has no offer.

### Exact derived commercial projection

`canonicalCommercialNumberV2(x)` rejects non-finite input and returns
`Number(x.toPrecision(12))`. Derivation uses only already-canonical inputs:

Every unit count is an exact safe integer. Build quantity,
quantity-per-assembly, MOQ, order multiple, and price-break quantity are
positive safe integers; stock is a non-negative safe integer. Required units
and purchase quantity must remain safe integers after every multiplication,
maximum, division/ceiling, and multiplication step. Overflow or loss of safe
integer precision rejects the offer/context before policy evaluation. Monetary
operands/results must remain finite and non-negative after canonicalization.

- required units = `quantityPerAssembly * policy.buildQuantity`;
- purchase quantity =
  `ceil(max(requiredUnits, minimumOrderQuantity ?? 1) /
  (orderMultiple ?? 1)) * (orderMultiple ?? 1)`;
- applicable price is the unique price break with greatest `quantity <=
  purchaseQuantity`; no such break means unknown cost;
- line cost = `canonicalCommercialNumberV2(unitPrice * purchaseQuantity)`;
- buildable quantity = `floor(stockQuantity / quantityPerAssembly)` only when
  stock is known;
- aggregate buildability exists only when every BOM line is sourced and known,
  and equals the minimum line value;
- aggregate cost exists only when every BOM line is sourced/costed in the one
  policy currency. Sort by BOM line ID, start at zero, and apply
  `canonicalCommercialNumberV2(total + lineCost)` after each addition;
- maximum lead exists only when every BOM line is sourced with known days and
  kind. Sort by days descending, then
  `MAXIMUM_LEAD_KIND_TIE_BREAK_V2.indexOf(kind)` ascending, then BOM line ID
  ascending, and take the first; persist that exact days/kind pair;
- lifecycle counts include every BOM line: a known value increments its bucket,
  while unknown or no evaluated offer increments `unknown`;
- distributor split is the number of unique evaluated-offer distributors when
  every line is sourced; `singleDistributorComplete` is exactly `split === 1`;
  and
- a stock bottleneck is derivable only when every BOM line has known
  buildability and a non-unknown status. Choose minimum buildability then BOM
  line ID; reason is `stock` for sourced or `policy` for policy-rejected.
  Unavailable lines cannot carry buildability, so they make the aggregate
  non-derivable. Otherwise `bottleneckPart` is absent.

Every derivable aggregate is mandatory and every non-derivable aggregate is
absent. Contextual validation recomputes these formulas exactly; reversed BOM
input, price-break boundaries, MOQ/multiple boundaries, equal lead kinds, and
sub-nanounit cost mutations cannot create a second valid projection.

Snapshot observation numbers are preserved exactly after snapshot validation;
overlay parsing does not apply the electrical 12-significant-digit projection
to copied stock, MOQ, multiple, price-break, or known lead observations.
`canonicalCommercialNumberV2` applies only to the explicitly derived age,
monetary products, and staged aggregate sums named above. Contextual equality
therefore preserves a valid known lead observation with more than twelve
significant digits while still canonicalizing derived arithmetic identically.

### Policy-status authority and warnings

The sorted atomic sourcing constraints are the single policy-status authority.
sourcing-schema owns and root-exports the constraint parser and aggregation
function. For a non-empty constraint set `C`, every duplicated status is the
exact result of this reduction:

```ts
export function aggregateSourcingPolicyStatus(
  constraints: readonly SourcingPolicyConstraintV2[],
): SourcingPolicyStatus {
  if (constraints.some((constraint) => constraint.status === "fail")) {
    return "fail";
  }
  if (constraints.some((constraint) => constraint.status === "unknown")) {
    return "unknown";
  }
  return "pass";
}
```

An evaluated candidate must have at least the data-status constraint and one
offer/policy constraint per BOM line; an empty set is invalid rather than an
implicit pass. Constraints are sorted by
`(bomLineId ?? "", ruleId, explanation)` and a duplicate `(bomLineId, ruleId)`
pair is invalid. Rule IDs describe the rule, for example
`sourcing.policy.stock`; the BOM line is never interpolated into the rule ID.
`CandidateSourcingMetricsV2.policyStatus`,
`CandidateSourcingEvaluationV2.policyStatus`, and the persisted commercial
state's `policyStatus` must all exactly equal the reduction. Any disagreement is
a contextual-validation failure; no field wins by precedence.

Warnings are explanatory projections, never a second status channel. Every
`fail` or `unknown` constraint explanation must appear in candidate metrics
warnings and, when it has a `bomLineId`, in that line's warnings. A warning
without a matching non-pass constraint cannot make a candidate fail or unknown.
Additional advisory warnings are allowed only from the versioned deterministic
catalog for known observation cases such as manufacturer/factory lead time,
missing price, or migration. Line and candidate warning arrays are
lexicographically sorted and de-duplicated; candidate warnings equal the sorted
union of all line warnings, candidate-level non-pass constraint explanations,
and applicable catalog advisories. The contextual validator recomputes this
equality. Arbitrary evaluator warning text is invalid.

sourcing-schema owns and root-exports the warning contract so its contextual
validator and sourcing-core cannot disagree:

```ts
export const SOURCING_ADVISORY_WARNING_CATALOG_VERSION = 1 as const;
export const SOURCING_ADVISORY_WARNING_CODES = [
  "manufacturer_lead_not_delivery",
  "factory_lead_not_delivery",
  "stock_unknown_backorder",
  "stock_short_backorder",
  "price_break_unavailable",
  "migration_v1_reevaluation",
  "migration_v1_source_unavailable",
] as const;

export type SourcingAdvisoryWarningCode =
  typeof SOURCING_ADVISORY_WARNING_CODES[number];

export type SourcingAdvisoryWarningInput =
  | { code: "manufacturer_lead_not_delivery" }
  | { code: "factory_lead_not_delivery" }
  | { code: "stock_unknown_backorder" }
  | {
      code: "stock_short_backorder";
      stockQuantity: number;
      purchaseQuantity: number;
    }
  | { code: "price_break_unavailable"; purchaseQuantity: number }
  | { code: "migration_v1_reevaluation" }
  | { code: "migration_v1_source_unavailable" };

export declare const SOURCING_ADVISORY_WARNING_TEMPLATES:
  Readonly<Record<SourcingAdvisoryWarningCode, string>>;

export declare function renderSourcingAdvisoryWarning(
  input: SourcingAdvisoryWarningInput,
): string;
```

`CandidateSourcingMetricsV2.warningCatalogVersion` must equal the exported
version. The V2 advisory catalog is closed to these deterministic templates:

| Trigger | Exact warning template |
| --- | --- |
| Known `manufacturer` lead kind | `Manufacturer lead time is not a guaranteed ship or delivery date` |
| Known `factory` lead kind | `Factory lead time is not a guaranteed ship or delivery date` |
| Unknown stock relying on known permitted backorder | `Current stock is unknown; the evaluated offer relies on a permitted backorder` |
| Known short stock relying on known permitted backorder | `Only {stockQuantity} units are currently in stock; purchase quantity {purchaseQuantity} relies on backorder availability` |
| No applicable price break | `No price break applies at purchase quantity {purchaseQuantity}; extended cost is unknown` |
| Resolved V1 metrics migration | `Migrated V1 sourcing data requires V2 policy re-evaluation` |
| Unresolved V1 metrics migration | `Migrated V1 sourcing source snapshots were unavailable or ambiguous` |

Placeholders are rendered from validated integers in base-10 ASCII. Policy
failure/unknown explanations are constraint projections rather than catalog
advisories.

## Eligibility, engine integration, and ranking

The V1 boolean boundary conflates “not known to fail” with “proved eligible.” V2
uses the tri-state directly:

```ts
export interface CandidateSourcingEvaluationV2 {
  metrics: CandidateSourcingMetricsV2;
  policyStatus: SourcingPolicyStatus;
  constraints: SourcingPolicyConstraintV2[];
}
```

`eligible` is removed from the V2 callback. During a compatibility window, a V1
callback may still return it, but the engine derives truth from the complete
constraint set: any fail is `fail`, otherwise any unknown is `unknown`, otherwise
`pass`. A boolean must never promote unknown to pass.

Engine handling is:

- `pass`: retain in the sourcing-compliant candidate set;
- `unknown`: retain the electrically feasible candidate as sourcing unproven,
  show it outside the policy-compliant subset, and preserve its stable electrical
  candidate ID; and
- `fail`: retain the electrical baseline while recording a visible commercial
  sourcing-policy rejection, not an electrical rejection.

This requires the design engine to stop treating `eligible: false` as an
electrical-pipeline failure and to expose commercial status separately. Missing
snapshots continue to retain electrical candidates with unavailable sourcing.
Sourcing never enters electrical checks, materialization, candidate identity, or
the stable electrical request projection. The pre-sourcing electrical
feasibility, Pareto set, and rank frozen by
[ADR-0003](./0003-neutral-design-library-profile-and-admission-contract.md)
remain unchanged.

The additive engine seam is exact:

```ts
export interface CommercialSourcingCandidateV2 {
  id: CandidateIdV2;
  components: readonly {
    id: string;
    part: ManufacturerPartIdentity;
    quantityPerAssembly: number;
  }[];
}

export type EvaluateSourcingV2 = (
  candidate: Readonly<CommercialSourcingCandidateV2>,
  snapshots: readonly OfferSnapshotV2[],
  policy: Readonly<SourcingPolicy>,
  evaluatedAt: string,
) => CandidateSourcingEvaluationV2;

export interface EvaluateCommercialViewContextV2 {
  engineeringContext: Readonly<GenerateElectricalContextV2>;
  policy: Readonly<SourcingPolicy>;
  snapshots: readonly OfferSnapshotV2[];
  authorizations: readonly SnapshotAuthorizationV1[];
  authorizationVerifier: SnapshotAuthorizationVerifierV1;
  authorizationOperation: VerifiedCommercialAuthorizationOperationV1;
  paretoCriteria: readonly CommercialRankingCriterionV1[];
  rankingCriteria: readonly CommercialRankingCriterionV1[];
  evaluateSourcing?: EvaluateSourcingV2;
}

export interface GenerateCommercialOverlayContextV1
  extends EvaluateCommercialViewContextV2 {
  persistenceTarget: "user_local" | "exportable";
}

export type CommercialOverlayGenerationErrorCodeV1 =
  | "invalid_design_result"
  | "invalid_context"
  | "evaluator_threw"
  | "evaluator_contract_invalid";

export class CommercialOverlayGenerationErrorV1 extends Error {
  readonly code: CommercialOverlayGenerationErrorCodeV1;
  readonly issues: readonly ValidationIssue[];
}

declare const EPHEMERAL_COMMERCIAL_VIEW_V2: unique symbol;
export interface CommercialEvaluationViewV2 {
  readonly [EPHEMERAL_COMMERCIAL_VIEW_V2]: true;
  designResultContentHash: Sha256ContentHash;
  policy: SourcingPolicy;
  evaluatedAt: string;
  snapshotRefs: OfferSnapshotV2Ref[];
  authorizationRefs: SnapshotAuthorizationRefV1[];
  authorizationNotAfter: string | null;
  attributions: ProviderAttributionV1[];
  paretoCriteria: CommercialRankingCriterionV1[];
  rankingCriteria: CommercialRankingCriterionV1[];
  candidates: CommercialCandidateOverlayV1[];
}

export function evaluateCommercialViewV2(
  result: Readonly<DesignResultV2>,
  context: Readonly<EvaluateCommercialViewContextV2>,
): CommercialEvaluationViewV2 | undefined;

export function generateCommercialOverlayV1(
  result: Readonly<DesignResultV2>,
  context: Readonly<GenerateCommercialOverlayContextV1>,
): CommercialOverlayV1 | undefined;
```

The engine first strictly parses the electrical result, policy, and every
snapshot/authorization, verifies every signature/policy/effective permission,
verifies the result by deterministic regeneration against
`engineeringContext`, detaches and freezes them, sorts the snapshot and
authorization sets by their exact ref comparators,
canonical full-ref tuple, rejects duplicate refs/documents, and sorts candidate
evaluation by the locale-independent candidate-ID comparator. It rejects any
snapshot without native authorization before a callback in both evaluation
functions and every contextual validator. It calls the evaluator exactly once
per electrical candidate with only the three component fields above. Every
callback result is structurally parsed and context-validated against the exact
candidate, policy, snapshot set, evaluated timestamp, and build quantity before
commercial Pareto/ranking. An invalid callback result throws
`CommercialOverlayGenerationErrorV1` with code
`evaluator_contract_invalid` and stable sanitized issues. `undefined` is
reserved only for the no-evaluator case. The failure never deletes a candidate, changes
the electrical result, or becomes a policy failure. With no evaluator, no
overlay is created. An empty snapshot set may still be evaluated into explicit
unavailable/unknown metrics; it never produces an implicit pass.

Authorization use is part of every public call, not an ambient permission.
`evaluateCommercialViewV2` requires a token for `display`.
`generateCommercialOverlayV1` requires `user_local_storage` when
`persistenceTarget` is `user_local` and `download_export` when it is
`exportable`. Full overlay contextual validation infers and requires the same
use from the persisted target. The local-storage serializer requires
`user_local_storage`; transferable overlay JSON, bundle JSON, and commercial
BOM require `download_export`. A public-share action must separately call the
public-share serializer below with a `public_share` token. A token for a
different use, verifier instance, snapshot-ref set, or authorization-ref set
rejects before evaluation, persistence, or serializer output.

Live `evaluateCommercialViewV2`/`generateCommercialOverlayV1` do not accept a
caller-authored evaluation clock. Their exact `evaluatedAt` is
`authorizationOperation.checkedAt`, captured by the trusted verifier, and that
same canonical instant is passed to every evaluator and persisted metric/view/
overlay. Back-dating cannot make stale data fresh or policy-pass. Structural and
contextual validation of an already persisted overlay verifies its historical
`evaluatedAt` and labels it explicitly “as of” that instant; it does not claim
the observation is current at restore/export time. Any UI/action labelled
current must perform a fresh live evaluation at a newly captured operation
clock or refuse the claim.

`evaluateCommercialViewV2` is the only path allowed to consume native snapshots
whose permission is `ephemeral`. Its branded result has no public parser,
serializer, canonical/hash function, JSON conversion, cache/store seam, or
design-export overload; every scheMAGIC serializer, store, export, share, and
UI persistence action rejects it, and repository guards reject it from
persisted object types. It has no supported persisted representation and is
discarded when the view ends. JavaScript cannot prevent hostile callers from
manually copying enumerable runtime data or calling global `JSON.stringify`;
that is explicitly not treated as provider-authorized persistence or a secure
erasure boundary.

`generateCommercialOverlayV1` enforces a persistence lattice before invoking
the evaluator using verified authorization claims, never snapshot self-claims.
There is exactly one trusted authorization for each supplied snapshot ref, no
more and no fewer; authorization refs are sorted/unique by
`(issuerKeyId,id,contentHash)` and enter view/overlay bytes. For
`persistenceTarget: "user_local"`, every effective permission must permit
`user_local` or `exportable`; for `"exportable"`, every effective permission
must permit `exportable`. Effective ephemeral permission rejects either target.
The produced overlay's `persistence` equals the requested target exactly. Full
contextual validation recomputes the same lattice from the exact snapshots and
rejects any target not permitted by every snapshot. Deliberately producing a
`user_local` overlay from all-`exportable` snapshots is valid; changing it to
`exportable` without regeneration is not. Mixed insufficient permissions
reject. A structurally
valid overlay alone never proves provider permission.

Evaluator inputs are detached and recursively frozen per call. The callback is
captured once; its output is read once into a detached plain-JSON snapshot
before parsing, so getters/proxies cannot change validated bytes. An actual
callback throw, input-mutation trap, or accessor/Proxy throw during detachment
is `evaluator_threw`. A callback that returns `undefined`, a function, symbol,
Promise/thenable, non-finite number, or any other non-plain-JSON/structurally
invalid value is `evaluator_contract_invalid`. Both carry stable generic issues;
arbitrary exception text, provider payloads, and secrets are never copied. No
earlier candidate result is persisted, cached, or returned after either error.

Generation error classification and validation order are exact. First, a
structurally malformed result throws `invalid_design_result`. Second, malformed
policy/snapshots/criteria, forbidden snapshot eligibility or persistence, and
provider-link registry errors throw `invalid_context`. Third, a structurally
valid result that fails exact engineering-context regeneration also throws
`invalid_context`; an inner `DesignGenerationErrorV2` is wrapped into stable
generic issues rather than leaked. Only then is the evaluator called: a throw,
accessor failure, or mutation attempt is `evaluator_threw`, while a returned
value that is structurally or contextually invalid is
`evaluator_contract_invalid`. Each branch carries closed sanitized issue codes
and paths; no raw exception message enters the public error.

Before evaluation and persistence, the overlay policy is normalized to one
canonical projection: `distributors`, `allowedLifecycle`, and optional
`packaging` are code-unit sorted unique sets; all other field order is canonical
object-key order; every number is finite and projected by the shared
12-significant-digit rule. The evaluator receives that same frozen projection.
Permuting an input policy set cannot change overlay bytes or hash.

Commercial sourcing Pareto and ranking operate on the `policyStatus === "pass"`
subset only. Within that subset, `criterionValue` may unwrap an aggregate only
when the aggregate is complete. Unknown and failed candidates are not passed to
the commercial comparator at all; they remain visible in their separate
commercial states. They are not compared as though a missing value were zero,
infinity, or a numerically worse observation, and an empty pass subset stays
empty rather than promoting an unknown candidate.

`unknownObservationCount` is display/audit information, not an implicit ranking
criterion. If two policy-pass candidates tie on every explicit sourcing
criterion, the existing stable candidate-ID tie-break decides their order.
Completeness may affect order only if a future schema adds an explicit,
user-selected criterion for it. Electrical-only ranking remains unchanged.

`paretoCriteria` is a set: it is sorted by `(field, direction)` and rejects a
duplicate field. `rankingCriteria` is an explicit priority list: order is
preserved and duplicate fields are rejected. Each field permits only its
canonical direction (`buildableQuantity: maximize`, `extendedBomCost:
minimize`, `maximumLeadTimeDays: minimize`); a contrary direction is invalid
rather than silently inverted. Both arrays are closed and use the code-unit
comparator, never locale collation.

### Persisted commercial overlay

Sourcing V2 is persisted as a separately versioned commercial overlay owned by
design-schema. It is keyed by stable electrical candidate IDs and never mutates
or deletes the electrical result:

```ts
export const COMMERCIAL_OVERLAY_SCHEMA_VERSION = 1 as const;

export type CommercialCandidateStatus =
  | "compliant"
  | "unproven"
  | "rejected";

export interface CommercialRankingCriterionV1 {
  field:
    | "buildableQuantity"
    | "extendedBomCost"
    | "maximumLeadTimeDays";
  direction: "maximize" | "minimize";
}

export type CommercialParetoV1 =
  | { status: "frontier" }
  | { status: "dominated"; dominatedByCandidateId: CandidateIdV2 }
  | {
      status: "not_evaluated";
      reason:
        | "policy_not_pass"
        | "missing_requested_metric";
    };

export type CommercialRankV1 =
  | { status: "ranked"; rank: number }
  | {
      status: "unranked";
      reason:
        | "policy_not_pass"
        | "missing_requested_metric"
        | "dominated"
        | "no_ranking_criteria";
    };

export interface CommercialCandidateOverlayV1 {
  candidateId: CandidateIdV2;
  status: CommercialCandidateStatus;
  policyStatus: SourcingPolicyStatus;
  metrics: CandidateSourcingMetricsV2;
  constraints: SourcingPolicyConstraintV2[];
  pareto: CommercialParetoV1;
  rank: CommercialRankV1;
  order: number;
}

export type CommercialOverlayV1Id =
  `commercial-overlay:v1:${Sha256ContentHash}`;

export interface CommercialOverlayV1 {
  format: "schemagic-commercial-overlay";
  schemaVersion: 1;
  id: CommercialOverlayV1Id;
  persistence: "user_local" | "exportable";
  designResultRef: {
    schemaVersion: 2;
    designResultContentHash: Sha256ContentHash;
    requestHash: Sha256ContentHash;
    libraryVersion: string;
    libraryContentHash: Sha256ContentHash;
    candidateSetHash: Sha256ContentHash;
  };
  policy: SourcingPolicy;
  evaluatedAt: string;
  snapshotRefs: OfferSnapshotV2Ref[];
  authorizationRefs: SnapshotAuthorizationRefV1[];
  authorizationNotAfter: string | null;
  attributions: ProviderAttributionV1[];
  paretoCriteria: CommercialRankingCriterionV1[];
  rankingCriteria: CommercialRankingCriterionV1[];
  candidates: CommercialCandidateOverlayV1[];
  contentHash: Sha256ContentHash;
}

export function parseCommercialOverlayV1(
  input: unknown,
): CommercialOverlayV1;

export function canonicalCommercialCandidateSetHashV1(
  candidateIds: readonly CandidateIdV2[],
): Sha256ContentHash;

export function canonicalCommercialOverlayV1Payload(
  overlay: Omit<CommercialOverlayV1, "id" | "contentHash">
    | CommercialOverlayV1,
): string;

export function calculateCommercialOverlayV1ContentHash(
  overlay: Omit<CommercialOverlayV1, "id" | "contentHash">
    | CommercialOverlayV1,
): Sha256ContentHash;

export function calculateCommercialOverlayV1Id(
  overlay: Omit<CommercialOverlayV1, "id" | "contentHash">
    | CommercialOverlayV1,
): CommercialOverlayV1Id;

export function validateCommercialOverlayDesignBindingV1(
  result: Readonly<DesignResultV2>,
  overlay: Readonly<CommercialOverlayV1>,
): ValidationIssue[];

export function validateCommercialOverlayContextV1(
  result: Readonly<DesignResultV2>,
  overlay: Readonly<CommercialOverlayV1>,
  context: Readonly<CommercialSnapshotContextV1>,
): ValidationIssue[];

export function validateCommercialOverlaySetContextV1(
  result: Readonly<DesignResultV2>,
  overlays: readonly CommercialOverlayV1[],
  context: Readonly<CommercialSnapshotContextV1>,
  expectedUse: "download_export" | "public_share",
): ValidationIssue[];
```

`candidateSetHash` is SHA-256 over canonical JSON of the code-unit-sorted array
of exact electrical candidate IDs. No concatenation or delimiter encoding is
used. `designResultContentHash` must exactly equal the verified content hash on
the referenced `DesignResultV2`; request/library/candidate-set fields are useful
query keys but are not a substitute for that full-byte binding. Overlay
`contentHash` is SHA-256 over the canonical overlay excluding `id` and
`contentHash`; `id` is exactly
`commercial-overlay:v1:${contentHash}`. The candidate array is sorted by
`order`, and order values are unique contiguous zero-based integers.
Snapshot refs and authorization refs are separately sorted/unique; each
authorization exact-joins one snapshot through its verified `snapshotRef`, and
no unmatched ref is permitted.
The named canonical/hash/ID functions are design-schema owned, browser-safe,
and must agree with an independent standard SHA-256 implementation.

`parseCommercialOverlayV1` is structural. Design-binding validation recomputes
the result hash/ref, request/library query fields, candidate-set hash, exact
candidate membership, overlay Pareto/rank/order, and overlay hash/ID without
claiming the referenced offers exist. Full contextual validation first performs
design binding, then requires exact full-ref equality to `context.snapshots`,
exact authorization-ref equality to verified `context.authorizations`, and
calls `validateCandidateSourcingEvaluationContextV2` for each entry using the
candidate BOM, persisted policy/evaluatedAt, and exact snapshots. Missing,
extra, or wrong-hash snapshots fail. BOM/UI may say
`commercial_context_verified` only after this full validator succeeds.

There is exactly one commercial entry for every candidate in the referenced
electrical `DesignResultV2`, no more and no fewer. `status` is an exact display
mapping from the authoritative reduction: pass → `compliant`, unknown →
`unproven`, fail → `rejected`. Candidate metrics, evaluation status, overlay
policy status, and constraints must satisfy the equality rule above. Overlay
constraints use the reserved `sourcing.` rule-ID namespace and never enter
`DesignCandidateV2.constraints`, electrical rejections, circuit materialization,
electrical Pareto, electrical rank, or electrical candidate identity.

Commercial order groups are deterministic: ranked frontier candidates by
one-based `rank`; complete but dominated pass candidates by candidate ID; pass
candidates missing a requested Pareto/rank aggregate by candidate ID; compliant
candidates with no ranking criteria by candidate ID; unproven candidates by
candidate ID; then rejected candidates by candidate ID. An empty Pareto criteria
list makes every policy-pass candidate a frontier candidate. An empty ranking
criteria list leaves compliant candidates visible unranked. Rank values are
contiguous and exist only for ranked frontier candidates.

For each requested commercial criterion, a pass candidate missing that
aggregate is excluded from that criterion's comparator. Missing a Pareto
aggregate produces `pareto.status: "not_evaluated"`; missing a ranking aggregate
produces `rank.status: "unranked"`; both use reason
`missing_requested_metric`. Missing is never converted to a worst numeric value.
A candidate must have every requested Pareto aggregate to enter commercial
Pareto and every requested ranking aggregate to enter ranking; only Pareto
frontier candidates may be ranked. An empty rankable subset remains empty.

Commercial dominance is computed once against the complete pre-prune set of
policy-pass candidates that have every Pareto aggregate. A candidate dominates
another only when it is no worse on all canonical-direction criteria and
strictly better on at least one. When several entries dominate one candidate,
`dominatedByCandidateId` is the code-unit-smallest exact candidate ID. The
frontier is then ranked by the explicit priority list and candidate ID.
Reversing evaluator/candidate input order cannot change the frontier,
dominator, rank, order, or overlay bytes.

State precedence is exact: non-pass candidates receive `policy_not_pass` for
both fields; a pass candidate missing a Pareto aggregate receives
`missing_requested_metric` for both fields; a Pareto-dominated pass candidate
receives rank reason `dominated` without inspecting ranking aggregates; a
frontier candidate with no ranking criteria receives `no_ranking_criteria`; a
frontier candidate missing a ranking aggregate receives
`missing_requested_metric`; only the remaining frontier candidates are ranked.

## Provider normalization consequences

### DigiKey

The V2 normalizer wraps every documented, successfully normalized value as
`{ state: "known", value }`. A missing documented field is `not_reported`, an
unrecognized documented string is `unmapped`, and contradictory lifecycle
fields are `conflicting`. It does not drop an otherwise useful offer solely
because one observation is unknown.

### Mouser

The V2 draft normalizer may promote a matching draft to an offer with known
stock, MOQ, multiple, currency, and price breaks where those values pass strict
parsing. It emits:

- packaging, marketplace, and normalized region as `not_supported`;
- backorder as `unmapped` because `AvailableOnOrder` does not prove the V2
  boolean;
- lifecycle and lead values as `unmapped` until reviewed, deterministic value
  mappings are backed by official semantics and tests; and
- lifecycle source as known `distributor` when the raw lifecycle string exists,
  even when its normalized lifecycle remains unknown.

This preserves useful observations, but under the current region, lifecycle,
and marketplace-disallowing policy it normally produces policy `unknown`, not a
pass. Provider enablement, cache/persistence permission, raw transport, and
exact-MPN confirmation remain separate blockers. V2 is not authority to enable
Mouser.

## Validation

All persisted objects remain recursively closed. V2 validators add these rules:

1. A known observation has exactly `state` and `value`; an unknown observation
   has exactly `state` and `reason`.
2. `value` on unknown, `reason` on known, null, omission, and any extra key are
   rejected at the exact field path.
3. Known booleans accept `false` as data. No default is applied.
4. Known enum observations exclude the V1 domain sentinel `"unknown"`.
5. Known lead days are finite non-negative numbers. A maximum-lead check requires
   both days and kind known.
6. Known region/currency use the existing normalized validators. Unknown
   currency requires an empty `priceBreaks` array.
7. Every V2 offer contains every required observation wrapper. Optional numeric
   fields retain their current integer/range validation.
8. Snapshot validation still rejects unrequested part identities, duplicate
   offer identities/SKUs, invalid strict RFC 3339 timestamps, provider mismatch,
   invalid/duplicate lineage refs, a content hash that does not match the
   canonical ID-excluding V2 payload, or an ID that is not exactly derived from
   that hash. SHA-256 refs require exactly 64 lowercase hexadecimal digits after
   `sha256:`; V2 lineage cannot self-reference.
9. Metrics validation requires `policyStatus` and the exact sourcing-schema
   warning-catalog version, verifies `unknownObservationCount`, applies
   observation rules recursively, and checks
   that an evaluated offer line carries the full observation set. Native V2
   `sourced`, `unknown`, and `policy_rejected` lines require an evaluated offer;
   an `unavailable` line forbids one and omits offer observations. Every metric
   line snapshot ref must exactly match a member of metrics `snapshotRefs` on
   all of `id`, `schemaVersion`, and `contentHash`; matching the supplied input
   snapshots is contextual validation below.
10. Aggregates and lifecycle counts must be arithmetically consistent with only
    the known, sourced line observations.
11. `SourcingPolicyConstraintV2` validation enforces the exact correlated
    catalog version/code/input/rule-ID/scope union, three-state status, derived
    canonical explanation, applicability, deterministic ordering/uniqueness,
    and rejects `evidence`, electrical quantities, arbitrary messages, or any
    other extra field.

Validation must reject secret/provider-response or engineering-fact smuggling,
including `apiKey`, `rawProviderResponse`, waveform/thermal values, or arbitrary
provider metadata inside either observation branch.

### Structural parsing versus contextual validation

The persisted metrics parser is deliberately structural:

```ts
export function parseCandidateSourcingMetricsV2(
  input: unknown,
): CandidateSourcingMetricsV2;

export interface CandidateSourcingValidationContextV2 {
  candidateId: string;
  components: readonly {
    id: string;
    part: ManufacturerPartIdentity;
    quantityPerAssembly: number;
  }[];
  policy: Readonly<SourcingPolicy>;
  snapshots: readonly OfferSnapshotV2[];
  authorizations: readonly SnapshotAuthorizationV1[];
  authorizationVerifier: SnapshotAuthorizationVerifierV1;
  authorizationOperation: VerifiedCommercialAuthorizationOperationV1;
  expectedAuthorizationUse: SnapshotAuthorizedUseV1;
  evaluatedAt: string;
}

export function validateCandidateSourcingEvaluationContextV2(
  evaluation: Readonly<CandidateSourcingEvaluationV2>,
  context: Readonly<CandidateSourcingValidationContextV2>,
): ValidationIssue[];
```

The structural parser closes keys, validates field types/enums/timestamps/hash
syntax, internal line/count/arithmetic consistency, sorted unique refs, and
line-ref membership in `metrics.snapshotRefs`. It cannot prove that a referenced
snapshot, offer, candidate, timestamp, or policy was the one actually supplied
to evaluation.

The contextual validator requires:

- exact `metrics.evaluatedAt === context.evaluatedAt` and
  `metrics.requestedBuildQuantity === context.policy.buildQuantity`;
- every snapshot `retrievedAt <= context.evaluatedAt`, with no future-age clamp;
- every snapshot has `evaluationEligibility: "native_v2"`; an audit-only
  migrated snapshot rejects before evaluation or ranking;
- every snapshot has exactly one signature-valid authorization whose exact
  snapshot/provider/policy ref resolves through the supplied verifier; claimed
  snapshot eligibility/persistence without that authorization grants nothing;
- `authorizationVerifier.validateOperation` accepts the opaque operation token
  for exactly `expectedAuthorizationUse` and the exact sorted snapshot/
  authorization ref sets; a token for another call or use grants nothing;
- exact one-to-one BOM line identity, part identity, and quantity equality with
  `context.components`;
- exact sorted equality between metrics/overlay snapshot refs and all snapshots
  supplied to the evaluator, on ID, schema version, and content hash;
- each evaluated offer to resolve to exactly one offer in that exact snapshot,
  with matching provider, SKU, part, observation values, exact deterministic
  arithmetic, and the schema-owned active-snapshot/offer/plan selection;
- all constraint `bomLineId` values to resolve to the candidate BOM;
- constraints, all duplicated policy statuses, line statuses, and warnings to
  obey the authoritative aggregation/projection rules.

The design engine must structurally parse policy/snapshots before calling the
evaluator, structurally parse its returned metrics/constraints, and then call
`validateCandidateSourcingEvaluationContextV2` before persisting or ranking the
overlay. Its current ad hoc timestamp, build-quantity, and snapshot-ID checks are
not a substitute. Invalid callback output becomes an evaluator-contract
diagnostic; it never becomes a sourcing-policy fail, candidate deletion, or
electrical rejection.

`validateCommercialOverlayContextV1` separately validates the overlay hash,
the recomputed `DesignResultV2.contentHash`, every design-result ref query field,
candidate-set hash, exactly one entry per electrical candidate, candidate IDs,
contextual evaluation results, commercial Pareto/rank/order, and the absence of
sourcing fields/constraints in `DesignResultV2`. Matching request/library hashes
or candidate IDs cannot compensate for a design-result content-hash mismatch.
It also validates each overlay entry candidate ID against the result candidate
and recomputes the exact overlay persistence permission from every referenced
snapshot.

## Release and source compatibility

The complete current root surface is frozen V1, not only its three top-level
documents. This includes `DistributorOffer`, `OfferSnapshot`,
`CandidateSourcingMetrics`, `ProviderError`, `ProviderRequestStatus`,
`SnapshotPersistence`, `BomBottleneck`, `BottleneckReason`,
`BomLineSourcingMetrics`, `BomLineSourcingStatus`, `LifecycleCounts`, `Money`,
`SelectedOfferRef`, `SourcingDataStatus`, `LeadTimeKind`, `LifecycleSource`,
`PriceBreak`, every current schema-version/policy/lifecycle/packaging constant,
the unsuffixed validators/parsers/assertions/migrations/canonical/hash helpers,
`snapshotFreshnessAt`, and `emptyLifecycleCounts`. None may silently widen,
rename a field, or accept observation wrappers in a compatibility release.
Explicit V1 aliases cover every one of these changed nested contracts and
functions, including `ProviderErrorV1`, `BomLineSourcingMetricsV1`,
`BomLineSourcingStatusV1`, `SelectedOfferRefV1`, and freshness/version helpers.

The transition has two deliberate package phases:

1. A compatibility release preserves every current unsuffixed alias and runtime
   function as V1 and adds explicit parallel exports:
   `DistributorOfferV1`, `OfferSnapshotV1`,
   `CandidateSourcingMetricsV1`, `DistributorOfferV2`, `OfferSnapshotV2`,
   `CandidateSourcingMetricsV2`, `BomLineSourcingMetricsV2`,
   `BomLineSourcingStatusV2`, `EvaluatedOfferRef`, `OfferSnapshotV1Ref`,
   `OfferSnapshotV2Ref`, `OfferSnapshotLineageRef`,
   `SnapshotAuthorizationV1`, `SnapshotAuthorizationRefV1`,
   `SnapshotAuthorizationVerifierV1`, `SnapshotAuthorizationSignerV1`,
   `SnapshotAuthorizedUseV1`, `ProviderAttributionV1`,
   `VerifiedCommercialAuthorizationOperationV1`,
   `CommercialSnapshotContextV1`, `AuthorizedOfferSnapshotDocumentV2`,
   `parseAuthorizedOfferSnapshotDocumentV2`, `ProviderPolicyManifestV1`,
   `ProviderPolicyManifestV2`, `ProviderPolicyRefV2`,
   `ProviderErrorV2`, `ProviderErrorCodeV2`,
   `PROVIDER_ERROR_CATALOG_VERSION_V2`, `renderProviderErrorV2`, every
   authorization/policy parse/canonical/hash/ID/ref/issue/verify helper, their
   version constants, and closed V1/V2 validators/parsers. The frozen V1
   canonical/hash functions remain
   callable as `canonicalOfferSnapshotPayloadV1` and
   `calculateOfferSnapshotContentHashV1`; V2 has corresponding suffixed
   functions with the new ID-excluding payload.
2. A declared breaking package-version boundary coordinates sourcing-schema,
   sourcing-core, sourcing-service, design-schema, design-engine, web, and
   design-export. Only at that boundary do the unsuffixed aliases, latest-only
   validators/parsers, and unsuffixed canonical/hash helpers flip to V2.
   Consumers that need V1 keep using the suffixed V1 exports.

An API-extractor or `tsd` golden pins the complete root type/value export list,
signatures, literal constants, and V1 alias equality in both phases. A
hand-picked three-alias compile test is insufficient.

Standalone `DistributorOffer` has no schema-version field, so its validator is
always explicitly V1 or V2. Persisted snapshot dispatch uses a separately named
`parsePersistedOfferSnapshot(input)` that reads `schemaVersion`, invokes the
matching strict parser/hash function, and returns the exact validated V1 or V2
version it read. Migration is a separately named status-returning operation;
the dispatcher never migrates or guesses from field shape.
`PersistedOfferSnapshot = OfferSnapshotV1 |
OfferSnapshotV2` is exposed only at that dispatch boundary; frozen V1 input APIs
are not widened to the union.

Candidate metrics follow the same rule:
`parseCandidateSourcingMetricsV1` remains callable, V2 has a separate strict
parser, and migration is explicit because resolving V1 bare snapshot IDs may
require verified source snapshots. Release notes and compile-time contract
tests must pin which package version performs the coordinated alias flip.

The current V1 design-engine callback and persisted V1 design results keep their
design-schema `ConstraintResult[]` contract. V2 evaluation/overlay APIs use only
sourcing-schema `SourcingPolicyConstraintV2[]`; neither type is widened to a
union and sourcing-schema adds no design-schema dependency. V1 result migration
is not performed. Candidate sourcing audit migration does not reinterpret V1
electrical evidence objects as V2 commercial constraints: only verified V1
candidate sourcing metrics pass through
`migrateCandidateSourcingMetricsV1ToAuditV2`, which emits the deterministic
closed audit constraints below. V1 result regeneration copies or removes no
candidate constraint.

### design-schema and design-export boundary

The coordinated boundary includes design-schema and design-export because the
current `DesignCandidate` V1 directly imports the unsuffixed
`CandidateSourcingMetrics`. The compatibility release adds named
`DesignCandidateV1` and `DesignResultV1` aliases for the frozen current shapes.
The deliberate design-schema boundary introduces electrical-only V2 contracts:

```ts
export type {
  CandidateIdV2,
  CandidateMetricV2,
  CandidateMetricsV2,
  DesignCandidateV2,
  DesignResultV2,
  ElectricalDesignRequestV2,
  LegacyDesignGenerationArtifactV1,
  PersistedDesignResultV1,
  SimulationCoverageV2,
} from "@opencircuit/design-schema";

export interface DesignExportBundleV2 {
  format: "schemagic-design-export";
  schemaVersion: 2;
  design: DesignResultV2;
  commercialOverlays: CommercialOverlayV1[];
}

export declare function parseDesignExportBundleV2(
  input: unknown,
): DesignExportBundleV2;

export declare function validateDesignExportBundleCommercialContextV2(
  bundle: Readonly<DesignExportBundleV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): ValidationIssue[];

export type CommercialDesignExportErrorCodeV2 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "candidate_not_found"
  | "invalid_snapshot"
  | "invalid_overlay"
  | "commercial_context_unverified"
  | "persistence_not_exportable";

export class CommercialDesignExportErrorV2 extends Error {
  readonly code: CommercialDesignExportErrorCodeV2;
  readonly issues: readonly ValidationIssue[];
}

export declare function serializeAuthorizedOfferSnapshotForLocalStorageV2(
  snapshot: Readonly<OfferSnapshotV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string;

export declare function serializeAuthorizedOfferSnapshotV2(
  snapshot: Readonly<OfferSnapshotV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string;

export declare function serializeAuthorizedOfferSnapshotForPublicShareV2(
  snapshot: Readonly<OfferSnapshotV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string;

export declare function serializeCommercialOverlayForLocalStorageV1(
  result: Readonly<DesignResultV2>,
  overlay: Readonly<CommercialOverlayV1>,
  context: Readonly<CommercialSnapshotContextV1>,
): string;

export declare function serializeCommercialOverlayV1(
  result: Readonly<DesignResultV2>,
  overlay: Readonly<CommercialOverlayV1>,
  context: Readonly<CommercialSnapshotContextV1>,
): string;

export declare function serializeDesignExportBundleV2(
  bundle: Readonly<DesignExportBundleV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string;

export declare function serializeDesignExportBundleForPublicShareV2(
  bundle: Readonly<DesignExportBundleV2>,
  context: Readonly<CommercialSnapshotContextV1>,
): string;

export const ELECTRICAL_BOM_V2_COLUMNS = Object.freeze([
  "bom_line_id", "role", "manufacturer_id", "manufacturer_part_number",
  "profile_id", "quantity_per_assembly", "value", "value_unit",
  "evidence_json",
] as const);
export const COMMERCIAL_BOM_V2_COLUMNS = Object.freeze([
  ...ELECTRICAL_BOM_V2_COLUMNS,
  "sourcing_data_status", "sourcing_policy_status",
  "unknown_observation_count", "snapshot_id", "snapshot_schema_version",
  "snapshot_content_hash", "distributor", "distributor_sku", "line_status",
  "provider_policy_id", "provider_policy_version",
  "provider_policy_content_hash", "provider_attribution_label",
  "all_provider_attributions_json",
  "purchase_quantity", "buildable_quantity", "extended_cost_amount",
  "extended_cost_currency", "stock_quantity",
  "region_state", "region_value", "region_reason",
  "currency_state", "currency_value", "currency_reason",
  "packaging_state", "packaging_value", "packaging_reason",
  "marketplace_state", "marketplace_value", "marketplace_reason",
  "backorder_state", "backorder_value", "backorder_reason",
  "lifecycle_state", "lifecycle_value", "lifecycle_reason",
  "lifecycle_source_state", "lifecycle_source_value",
  "lifecycle_source_reason", "lead_time_days_state", "lead_time_days_value",
  "lead_time_days_reason", "lead_time_kind_state", "lead_time_kind_value",
  "lead_time_kind_reason",
] as const);

export declare function escapeBomTextCellV2(value: string): string;
export declare function decodeBomTextCellV2(rfcDecodedCell: string): string;

export declare function exportElectricalBomCsvV2(
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  engineeringContext: Readonly<GenerateElectricalContextV2>,
): string;

export declare function exportCommercialBomCsvV2(
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  overlay: Readonly<CommercialOverlayV1>,
  context: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    commercial: CommercialSnapshotContextV1;
  }>,
): string;

export declare function canonicalDesignResultV2Payload(
  result: Omit<DesignResultV2, "contentHash"> | DesignResultV2,
): string;

export declare function canonicalDesignResultV2ContentHash(
  result: Omit<DesignResultV2, "contentHash"> | DesignResultV2,
): Sha256ContentHash;
```

ADR-0005 is the sole controlling design-schema decision for the exact request,
candidate, circuit, coverage, engineering-context, parsing, regeneration, and
ordering contracts re-exported above. This ADR does not redeclare or widen
those types; compile-time equality tests bind both coordinated documents to the
same public exports. ADR-0005 does not change this ADR's commercial overlay or
sourcing-observation semantics.

`DesignCandidateV2` has no `sourcing` field. Its constraints, warnings,
rejections, request, and request hash are electrical-only; `sourcing.` is a
reserved constraint namespace and is invalid anywhere inside `DesignResultV2`.
The V2 request hash is recomputed from `ElectricalDesignRequestV2`. Candidate
identity remains electrical-only, but adopting the exact V2 recipe/context ref
changes the ID deterministically as specified by ADR-0005. Commercial policy,
metrics, constraints, warnings, Pareto, and order live only in an overlay.

design-schema owns and root-exports both canonical-result functions.
`canonicalDesignResultV2Payload` serializes the recursively closed result with
lexically sorted object keys and excludes only top-level `contentHash`. It
includes the complete electrical request, request/library hashes, candidate
array order, every candidate circuit/component/derived value/electrical
constraint/metric/simulation/warning byte, rejected candidates, and diagnostics.
Array order is preserved and each producing validator requires the deterministic
order defined by its V2 contract. `canonicalDesignResultV2ContentHash` is SHA-256
of those canonical bytes. `parseDesignResultV2` recomputes and rejects a
mismatch before any overlay may be applied.

The existing design-export `serializeDesignResult` remains callable and frozen
as V1; `serializeDesignResultV1` is a new byte-identical alias. A strict
design-schema `parseDesignResultV1` is a new API, not prior behavior. V2 receives
separate strict parser/serializer functions.
`parsePersistedDesignResult` dispatches only on result `schemaVersion` and
returns the strictly validated version it read: `DesignResultV1 |
LegacyDesignGenerationArtifactV1 | DesignResultV2`. It never silently migrates.
`parseDesignExportBundleV2` structurally validates the electrical result and
each overlay, then validates each overlay's full design-result binding; it does
not claim offer/snapshot contextual verification from refs alone. Embedding an
overlay does not merge it back into candidates. Because the bundle is a
transfer artifact, every embedded overlay must have `persistence:
"exportable"`; a user-local overlay is rejected even before snapshot-context
validation. `commercialOverlays` is sorted
by exact overlay ID with the code-unit comparator and rejects duplicate IDs.
`validateDesignExportBundleCommercialContextV2` first requires the supplied
pool to equal the sorted unique union of all overlay refs. It filters that pool
by each overlay's own refs and performs the full validator; missing, duplicate,
unreferenced-extra, or wrong-hash documents fail. The schema-owned
`validateCommercialOverlaySetContextV1` first validates its one operation token
for the explicit `download_export | public_share` expected use exactly once
against the complete union snapshot/authorization ref set. Its implementation
then passes a module-
private, non-serializable authorization capability into the internal per-
overlay validator; that path rechecks every signature/policy/ref and all
commercial derivations but does not attempt to validate the union token against
a filtered subset. Ordinary bundle validation/download delegates with
`download_export`; the public-share serializer delegates with `public_share`.
The standalone public overlay validator still requires its own
exact-subset token, and callers cannot construct the internal capability. Two
overlays with disjoint snapshot sets can therefore validate
without weakening the exact-ref-set rule or pretending each referenced the
other's snapshots.

All serializer inputs are detached once, strictly parsed, and fully validated
before bytes are returned; errors use only the closed sanitized export error.
The three standalone authorized-snapshot serializers require
`context.snapshots` to be
exactly the one serialized full ref and `context.authorizations` exactly its
one authorization. Local storage requires `user_local_storage` and permits
only `user_local`/`exportable`; ordinary download requires `download_export`
and `exportable`; public share requires `public_share` and `exportable`.
Ephemeral snapshots have no serializer. Output is canonical JSON of
`AuthorizedOfferSnapshotDocumentV2`, containing the complete parsed snapshot
(ID, content hash, observations, provider errors, lineage) and its complete
authorization/signature, followed by one LF. The structural envelope parser
strictly parses both documents and exact-joins `authorization.snapshotRef` to
the snapshot; it does not claim signature/policy trust until the verifier runs.
There is no public ungated snapshot or authorization `JSON.stringify` helper.
Transferable overlay JSON, bundles, and commercial BOM require
`persistence: "exportable"`. The local-storage serializer accepts
`user_local` or `exportable` but is not used by download/share/export actions.
JSON is the corresponding canonical payload plus its verified hash fields,
UTF-8, with one trailing LF. CSV column order is the exact exported constant,
rows are code-unit sorted by BOM line ID, line endings are LF, fields use
RFC-4180 double-quote escaping, and the file ends in one LF. No ambient locale,
spreadsheet formula execution, blank unknown default, or provider URL creates a
second byte representation. `escapeBomTextCellV2` first replaces U+005C with
the literal two-character sequence `\\`; replaces every C0/C1/DEL scalar and
U+2028/U+2029 with the literal six-character sequence `\uXXXX` using uppercase
hexadecimal; and preserves every other Unicode scalar exactly. This makes
ADR-0003 exact MPN identities reversible without placing raw controls in CSV.
It then examines the escaped field: if its first non-ASCII-SP/HT code point is
U+0027 apostrophe, `=`, `+`, `-`, or `@`, it prefixes one U+0027 apostrophe to
the entire field. Including an original apostrophe in that discriminator makes
the transform injective: `=x`, `'=x`, and `''=x` encode to `'=x`, `''=x`, and
`'''=x`. Finally it applies RFC-4180 double-quote escaping. It never trims or
reorders whitespace. After ordinary RFC-4180 decoding,
`decodeBomTextCellV2` removes the leading discriminator iff the remainder's
first non-SP/HT code point is one of that exact five-character set, then parses
`\\` and `\uXXXX` left-to-right as the sole backslash/control escapes. Any
malformed escape rejects; this is an exact inverse, not a best-effort display
cleanup.
This reversible text layer applies only to ordinary string cells. The
`evidence_json` and `all_provider_attributions_json` columns are the canonical
JSON bytes of their exact values; JSON's own escaping already represents
quotes, backslashes, and controls. Those two columns receive only the same
formula-prefix check and final RFC-4180 quoting, never backslash doubling or a
second control escape. Numeric/null cells use their exact declared ASCII
projection before RFC-4180 quoting. A CSV consumer therefore obtains valid
canonical JSON immediately after ordinary RFC-4180 decoding.
Independent goldens cover backslash, NUL, every control family, U+2028/U+2029,
every formula prefix, leading whitespace, embedded quote, and non-ASCII
Unicode, and prove the control escape is reversible.
Per-line provider-policy/ref/label columns come from that line's evaluated
offer authorization, or are empty only when no offer was evaluated.
`all_provider_attributions_json` repeats the canonical sorted complete overlay
attribution union on every row, so required attribution for negative/no-winning
provider lookups is not lost. An empty-BOM export is invalid rather than an
attribution-free header-only commercial artifact.

There is no pure persisted V1-to-V2 result migration. V1 sourcing may have
deleted candidates, changed rank, and left only lossy rejection projections.
ADR-0005 requires contextual regeneration from an explicit engineering
objective plus a hash-verified catalog/ranking/recipe context. A verified legacy
policy may be reused, but migrated legacy snapshots remain audit-only and must
be refreshed through an approved native-V2 provider path before commercial
evaluation. Old candidate metrics are not projected onto regenerated IDs.
They may survive only in a separately typed unattached migration-audit artifact
and never supply or change the regenerated electrical result or new overlay.

design-export keeps explicit V1 JSON/BOM functions. Electrical-only V2 BOM
export requires an engineering-context-verified result and candidate ID, emits
only components, quantities, and engineering evidence, and has no blank or
fabricated sourcing columns. Commercial-enriched BOM/CSV, transferable overlay
JSON, and bundle export additionally require an `exportable` overlay plus its
exact context-validated native snapshots and emit full refs. A `user_local`
overlay is serializable only through a separately named local-storage seam and
cannot enter a transferable bundle/BOM/CSV. Neither path discovers commercial
data through an inline candidate field.

## Migration and backward compatibility

Parsing dispatches on `schemaVersion`; it never guesses a version from fields.

### Offer snapshots

`parseOfferSnapshotV1` validates the frozen V1 object and verifies its original
V1 hash before migration. `parseOfferSnapshotV2` validates V2 directly.
`parsePersistedOfferSnapshot` performs strict union dispatch and returns the
validated version it read. `migrateOfferSnapshot` returns the closed migration
status union and is idempotent for V2.

V1-to-V2 mapping is:

| V1 value | V2 value |
| --- | --- |
| Required region/currency/package/boolean scalar | `{ state: "known", value }` |
| Known lifecycle value | `{ state: "known", value }` |
| Lifecycle `"unknown"` | `{ state: "unknown", reason: "legacy_unknown" }` |
| Known lifecycle source | `{ state: "known", value }` |
| Lifecycle source `"unknown"` | `{ state: "unknown", reason: "legacy_unknown" }` |
| Present lead days | `{ state: "known", value }` |
| Absent lead days | `{ state: "unknown", reason: "legacy_unknown" }` |
| Present known lead kind | `{ state: "known", value }` |
| Absent or `"unknown"` lead kind | `{ state: "unknown", reason: "legacy_unknown" }` |
| Snapshot evaluation eligibility | `"legacy_audit_only"` |

All exact part identity, request, provider, representable SKU/quantity/price/
URL/timestamp, persistence, and status fields are retained. V1 timestamps with
up to nine fractional digits and numeric offsets are representable byte-for-
byte under the shared exact parser. A V1 provider error keeps only its
closed code and retryable flag and adds `catalogVersion: 1`; its free-form
message is discarded before V2 canonicalization and never enters warnings or
hashes. The verified V1 snapshot
ref is retained only in `lineage`. The migrated object is canonically sorted,
receives a V2 hash over its ID-excluding payload, and receives the derived V2
content-addressed ID. The V1 ID is never copied into V2 `id`.

A V1 source may be structurally and hash-valid yet outside V2's tightened
domain. HTTP/credentialed/noncanonical product URLs, control-bearing SKUs,
non-safe-integer stock/MOQ/multiple/price-break quantities, derived quantity
overflow, and any other value that cannot be represented without invention
return `unsupported_v1_value` with closed sanitized issues. They are not called
`invalid_source`, silently dropped, clamped, or repaired. Candidate audit
migration returns the same distinct status if any referenced snapshot is
unsupported; its original V1 artifact remains parseable for audit. The
acceptance matrix covers every tightened V1→V2 invariant exhaustively.

A concrete V1 value is preserved as “known as serialized”; it is not
retroactively downgraded based on provider. This is an unavoidable provenance
limit for audit display only. `evaluationEligibility: "legacy_audit_only"`
prevents those known wrappers from satisfying live V2 policy or ranking. The
current providers are disabled and no production normalization is claimed,
which bounds the repository's present risk. Any external V1 snapshot requiring
commercial evaluation must be refreshed from an approved V2 adapter.

### Candidate metrics and saved results

V1 candidate metrics cannot reconstruct all selected-offer observations, hashes,
or a complete tri-state decision. Migration therefore accepts an explicit
optional set of verified source V1 snapshots; it never resolves a bare ID from
ambient cache state.

Migration uses these exact catalog warnings:

```ts
export const V1_REEVALUATION_WARNING =
  "Migrated V1 sourcing data requires V2 policy re-evaluation";
export const V1_SOURCE_UNAVAILABLE_WARNING =
  "Migrated V1 sourcing source snapshots were unavailable or ambiguous";

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
  | {
      status: "migrated";
      audit: LegacyCandidateSourcingAuditV2;
      migratedSnapshots: OfferSnapshotV2[];
    }
  | {
      status: "invalid_v1_source";
      issues: ValidationIssue[];
    }
  | {
      status: "unsupported_v1_value";
      issues: ValidationIssue[];
    };

export function migrateCandidateSourcingMetricsV1ToAuditV2(
  sourceCandidateId: string,
  metrics: Readonly<CandidateSourcingMetricsV1>,
  verifiedV1Snapshots?: readonly OfferSnapshotV1[],
): LegacyCandidateSourcingAuditMigrationV2;

export function canonicalLegacyCandidateSourcingAuditV2Payload(
  audit: Omit<LegacyCandidateSourcingAuditV2, "contentHash">
    | LegacyCandidateSourcingAuditV2,
): string;

export function calculateLegacyCandidateSourcingAuditV2ContentHash(
  audit: Omit<LegacyCandidateSourcingAuditV2, "contentHash">
    | LegacyCandidateSourcingAuditV2,
): Sha256ContentHash;

export function parseLegacyCandidateSourcingAuditV2(
  input: unknown,
): LegacyCandidateSourcingAuditV2;
```

The audit payload excludes only top-level `contentHash`, uses the shared
canonical finite-number/key rules, sorts full snapshot refs by their canonical
tuple, constraints by `(bomLineId-or-empty, code)`, and warnings code-unit
lexically; all three reject duplicates. Parsing is structural and verifies the
hash, but deliberately offers no V2 candidate/design binding API. A malformed
or hash-invalid supplied V1 source returns `invalid_v1_source`; absent or
ambiguous-but-well-formed source snapshots take the conservative migrated audit
path below. The friendly catalog warning is stored in `warnings`; constraint
`explanation` remains the exact rule-renderer canonical JSON. Neither may
substitute for the other.

When every V1 `snapshotId` resolves to exactly one supplied, hash-verified V1
snapshot, migration first migrates those snapshots to V2, then:

- includes in `snapshotLineage` exactly the sorted unique referenced V1 full
  refs; valid supplied snapshots not referenced by the metrics are ignored;
- returns in `migratedSnapshots` exactly those referenced migrated V2 documents,
  all marked `evaluationEligibility: "legacy_audit_only"`;
- replaces `snapshotIds` with sorted, unique V2 `snapshotRefs`;
- replaces `selectedOffer.snapshotId` with the exact migrated V2 ref and renames
  the field to `evaluatedOffer`;
- verifies the referenced provider/SKU/part against that exact snapshot;
- populates the line observation wrappers from that exact migrated V2 offer,
  and refuses a V1 line whose duplicated scalar values conflict with the
  verified source offer;
- sets every resolved evaluated line to `status: "unknown"`, removes its
  purchase/buildable/cost derived fields, and adds `V1_REEVALUATION_WARNING`;
- converts a V1 non-sourced line that has no offer reference to `unavailable`
  with the same warning rather than preserving a V1 pass/fail line status;
- creates deterministic unknown `sourcing.migration` constraints carrying each
  `bomLineId`, plus an unknown candidate-level `sourcing.data_status`
  constraint whose exact input is `{code:"data_status",dataStatus:"unavailable"}`;
  sets `metrics.status: "unavailable"` even when the historical V1 transport
  said complete, because the source is not V2-evaluation eligible; all are
  rendered through the exact rule renderer; the catalog warning remains
  a separate advisory string;
- sets `warningCatalogVersion` to the sourcing-schema export, candidate
  `policyStatus: "unknown"`, computes
  `unknownObservationCount`, and adds the exact warning to candidate metrics;
  and
- computes mandatory `lifecycleCounts` deterministically from the populated
  migrated line observations (known value increments its bucket; unknown or no
  evaluated offer increments `unknown`), removes every *optional* candidate
  sourcing aggregate, and marks the audit metrics unproven until fresh V2
  candidate evaluation.

If source snapshots are absent, a bare ID is duplicated across otherwise valid
supplied V1 snapshots, or any referenced offer cannot be proven, the
whole migrated metrics object degrades conservatively: `status: "unavailable"`,
the exported V2 `warningCatalogVersion`, `policyStatus: "unknown"`,
`snapshotRefs: []`, top-level `snapshotLineage: []`, returned
`migratedSnapshots: []`, every BOM line
`status: "unavailable"`, `lifecycleCounts.unknown` equal to the BOM line count
with every other lifecycle count zero, and no evaluated offer or sourcing
optional aggregate. It retains electrical part identities, build quantity, and
evaluation timestamp, adds `V1_SOURCE_UNAVAILABLE_WARNING`, and creates the
corresponding deterministic unknown data/line constraints so status aggregation
remains authoritative.
It does not persist the unresolved V1 IDs or fabricate hashes. The original V1
metrics remain separately parseable through the frozen V1 API.
Any supplied V1 metrics or snapshot with an invalid structural/content hash
returns `invalid_v1_source` before degradation; migration never repairs it.

Migrated candidate metrics are never a `CommercialCandidateOverlayV1`. The
explicit migration helper returns a closed unattached
`LegacyCandidateSourcingAuditV2` containing source V1 candidate ID, migrated
metrics/constraints, exact snapshot lineage, and migration warnings, with no
V2 candidate ID or design-result ref field. After electrical regeneration, only
the verified policy may be reused. Migrated snapshots remain audit-only and
must not enter `evaluateCommercialViewV2`, `generateCommercialOverlayV1`, or
their contextual validators. Once an approved provider refresh produces native
V2 snapshots, `generateCommercialOverlayV1` freshly evaluates every new V2
candidate.
No old ID, BOM equality, or same-part heuristic can attach this audit artifact.

Saved `SourcingPolicy` and `DesignRequest` documents do not need a shape
migration. V1's allowed-lifecycle entry `"unknown"` remains parseable for
backward compatibility, but it never changes an unknown observation into a
policy pass. New UI must not offer unknown as an allow-list value.

## UI and export

Track D3 surfaces must show transport state and semantic policy state
separately. A `complete` provider response can still have unknown observations.
V2 UI joins a context-validated commercial overlay to an electrical result by
exact candidate ID; it never reads an inline `candidate.sourcing` field.

- Candidate comparison shows one chip for snapshot status/freshness and one for
  sourcing policy: compliant, unproven, or rejected.
- A value renders only after checking `state === "known"`. Unknown renders
  “Unknown — not reported”, “not supported”, “unmapped”, “conflicting”, or
  “legacy data”; it never renders “No”, `0`, “Active”, or the requested value.
- Unknown lifecycle is not presented as manufacturer lifecycle. Lifecycle source
  is shown independently.
- Lead time displays value and kind only when both are known; partial knowledge
  is shown as such and is excluded from the maximum-lead aggregate.
- An `evaluatedOffer` may be shown for traceability on unknown/rejected lines,
  but its purchase action must not imply policy compliance.
- A product URL is clickable only when
  `isVerifiedDistributorProductUrlV2` returns true; synthetic, unknown-host,
  HTTP, credentialed, or malformed URLs remain inert.
- Every required verified provider-policy attribution label is visible beside
  the commercial data and present in commercial JSON/BOM output; electrical-
  only output contains no provider attribution claim.
- Ephemeral commercial views are visibly current-session-only and have no
  save/share/download action. User-local overlays may be restored locally but
  are not transferable; only fully context-validated exportable overlays can
  enrich an exported BOM or bundle.
- The current transport copy for `SourcingDataStatus.complete` is revised to say
  the lookup completed, not that every observation was known.

BOM CSV V2 adds `sourcing_policy_status` and
`unknown_observation_count`, exact evaluated-offer `snapshot_id`,
`snapshot_schema_version`, and `snapshot_content_hash`, then state/value/reason
columns for region, currency, packaging, marketplace, backorder, lifecycle,
lifecycle source, lead days, and lead kind. It does not collapse unknown reasons
into a blank cell. Standalone snapshot JSON preserves observation objects,
lineage, and schema version. Overlay and bundle JSON preserve only exact V2
snapshot refs and require the external exact snapshot pool for contextual
verification; they do not pretend to embed lineage documents. V1 CSV remains available only as an
explicitly lossy legacy export with a warning; it must not default unknown
values or present a bare V1 ID as a V2 ref.

## Acceptance tests

All fixtures are hand-authored synthetic data. No API, network, credential, or
copied live response is used.

### Schema and hashing

- Parse known `false` for marketplace/backorder and preserve it through
  round-trip JSON.
- Parse each unknown reason for every observation-bearing field.
- Reject null, omitted required observations, mixed known/unknown keys, unknown
  reasons, wrong known value types, and unknown keys at every nested level.
- Reject a missing or wrong `warningCatalogVersion`; render every exported
  sourcing-schema advisory code/input to the exact catalog message.
- Reject `apiKey`, `rawProviderResponse`, and engineering fields inside known and
  unknown branches.
- Reject free-form provider error messages, wrong error-catalog versions,
  duplicate errors, and any raw/secret/provider-specific error field; render
  each closed error code to the independent catalog golden.
- Reverse same-code provider errors whose retryable Booleans differ and require
  the sole canonical `false`-then-`true` order and identical snapshot bytes.
- Reject unknown lifecycle/lead sentinels inside a known V2 observation.
- Reject unrequested exact-MPN identities, case-changed MPNs, provider mismatch,
  duplicate identity/SKU offers, invalid timestamps, and invalid hashes.
- Preserve and safely JSON/CSV-escape an exact control-bearing MPN identity
  across design-library and sourcing joins, while rejecting control-bearing
  distributor SKUs. Permit two distinct SKUs for one exact part but reject one
  distributor/SKU resolving twice or to different parts.
- Require requested parts sorted/unique by exact part tuple, offers by the exact
  four-field tuple, and price breaks strictly quantity-sorted/unique; reject
  reversed/duplicate persisted arrays rather than locale-normalizing them.
- Reject timestamp precision beyond nine fractional digits, timezone-less
  values, year 0000/expanded years, leap seconds, 24:00, invalid Gregorian
  dates, and offsets beyond ±14:00,
  offer/snapshot retrieval-instant mismatch, non-increasing expiry, unsafe
  product URLs, unsafe link hosts, unsafe integer quantities, derived integer
  overflow, and freshness timestamp overflow. Prove 1 ns, sub-millisecond
  ordering, offset-equivalent instants, more-than-104-day ages, range edges,
  exact rational rounding, and derived nine-digit-Z formatting follow the
  frozen rules and original-string/full-ref ties.
- Reject a V2 snapshot whose ID is not exactly
  `snapshot:v2:${contentHash}`, and reject metrics whose snapshot ref differs
  from the supplied snapshot by ID, schema version, or hash.
- Mutate only `known false` to `unknown`; assert the canonical payload, SHA-256,
  and derived V2 ID change and match a standard SHA-256 implementation.
- Assert deterministic hash equality for semantically identical sorted inputs.
- Assert V2 canonical bytes exclude `id`/`contentHash`, include sorted lineage,
  and cannot be resolved through a bare-ID or matching-hash-only lookup.
- Compile and structurally reject a V1 ref in native V2 metrics/evaluated offers/
  overlays; allow the lineage union only in snapshot lineage and V1 audit refs.

### Context and commercial overlay

- Call `generateCommercialOverlayV1` with two electrical candidates and prove
  the frozen evaluator receives exactly one call per candidate in lexical ID
  order with only ID/part/quantity component fields. With no evaluator, prove
  no overlay is created; with an empty snapshot set, prove explicit
  unavailable/unknown output cannot become pass.
- Reverse the same unique snapshot set and prove the evaluator receives the
  same full-ref-sorted frozen array and the complete overlay bytes stay equal;
  reject duplicate refs/documents before the first callback.
- Give `evaluateCommercialViewV2`, `generateCommercialOverlayV1`, and the
  contextual validator a `legacy_audit_only` snapshot and require rejection
  before callback/rank. Prove only the ephemeral branded view accepts ephemeral
  permission, user-local accepts user-local/exportable, exportable accepts only
  exportable, and tampered/mixed insufficient permissions reject.
- Flip audit-only to native or ephemeral to exportable, re-finalize the snapshot
  and recompute every self-hash, and prove the old authorization no longer
  matches and no evaluation/persistence/export occurs. Reject unsigned,
  wrong-key, wrong-policy-hash, wrong-execution-mode, untrusted-key, duplicate,
  missing, and extra authorizations. Verify an independent Ed25519 golden over
  canonical claim bytes and prove disabled provider manifests cannot issue a
  production authorization.
- Table-drive the V2 provider-policy issuance matrix for both execution modes
  and every persistence/use combination. Mutating any policy byte must change
  its standard hash/ref and invalidate the prior authorization. Reject issue
  time before snapshot retrieval, evaluation before issue, operation after a
  finite deadline, mismatched claimed/effective permission, and wrong signer
  issuer ID. Require exact derived nine-digit-Z deadlines, earliest ephemeral-
  view deadline, null persisted-overlay deadline, browser-storage refusal for
  finite retention, and
  `perpetual_approved` before any download/public-share authorization.
- Issue and reissue the same ephemeral snapshot before, at, and after its
  retrieval-anchored retention cutoff; require one invariant `notAfter`, accept
  only issue time before it, and prove later issuance cannot extend display or
  deletion authority.
- Bind snapshot expiry to the signed policy cache TTL: accept the exact bound
  and an offset-equivalent instant, reject one nanosecond over, overflow, and
  any attempt to use `staleIfErrorSeconds` as fresh lifetime in both issuer and
  verifier.
- Attempt live evaluation years later with a caller-invented historical time;
  prove the API has no such clock input, uses the verifier token's current
  `checkedAt`, and cannot create a fresh/pass overlay. Persisted historical
  output must display its exact “as of” time and never restore as current
  without a fresh evaluation.
- Reverse every allowed-use subset and prove only the code-unit-sorted form is
  accepted and hashes to the independent golden. Cross-call tokens for
  `display`, `user_local_storage`, `download_export`, and `public_share` and
  prove every wrong-use/verifier/ref-set combination rejects before callback or
  bytes. Prove a forged old `checkedAt`/plain token cannot revive an expired
  authorization.
- Give a two-line DigiKey BOM two one-part snapshots at different retrieval
  instants and prove both per-part cells remain active. Add overlapping Mouser
  batch snapshots and prove each `(distributor,part)` cell independently picks
  latest instant/full-ref tie, while old inactive refs do not alter freshness.
- Table-drive transport precedence and exact freshness equality across every
  `SourcingDataStatus`, missing cells, all-error, stale/partial overlaps,
  future retrieval, age, and earliest-expiry ties. In single-distributor mode,
  prove a complete/pass DigiKey all-line plan remains complete/pass when the
  allowed Mouser plan is entirely missing; reverse the providers and prove
  missing non-selected cells still prevent an all-plans-fail conclusion.
- Table-drive every offer comparator tier and every single-distributor plan
  tier, including mixed-provider complete-negative proof, distributor-local
  negative proof, selected/observed distributor inputs, equal-cost/buildable/
  lead ties, reversed offer/plan input, and near-rounding plan sums in reversed
  BOM-line order for pass, unknown, and failed plans.
- Table-drive safe-integer quantity boundaries, required/MOQ/multiple purchase
  quantities, price-break edges, exact line costs, staged BOM-line-ID sum,
  buildability, lifecycle/split counts, lead-kind/line-ID tie, mandatory versus
  forbidden aggregates, and reachable/omitted bottlenecks. Mutating exact cost
  below any epsilon or reversing metric lines must reject or normalize to the
  one canonical projection as specified.
- For pass, unknown, and failed evaluated offers, omit each mandatory line
  purchase/stock/buildability/cost field in turn and invent each non-derivable
  field in turn; require exact contextual rejection and identical presence
  semantics across statuses.
- Give a structurally valid metrics object the wrong evaluated timestamp, build
  quantity, candidate line, snapshot tuple, and evaluated offer in turn; prove
  structural parsing succeeds where appropriate and contextual validation
  rejects each exact mismatch.
- Return structurally valid but context-invalid metrics from an evaluator;
  assert the exact typed `evaluator_contract_invalid` throw carries only stable
  sanitized issues and does not persist/rank an overlay, delete the candidate,
  mutate the electrical result, or create an electrical rejection.
- Throw a secret-bearing error, mutate frozen evaluator input, and return a
  toggling accessor/Proxy in turn; require sanitized `evaluator_threw`, one-read
  detachment, and no partial overlay/cache persistence.
- Return `undefined`, a function, symbol, Promise/thenable, NaN, and a plain
  structurally invalid object in turn; require exact sanitized
  `evaluator_contract_invalid` rather than `evaluator_threw`.
- Table-drive the public error precedence for malformed result, malformed
  context, engineering-regeneration mismatch/inner design error, evaluator
  throw, and evaluator invalid return; require exact sanitized code/path bytes.
- Table-drive constraint sets for fail-over-unknown-over-pass aggregation and
  reject empty constraints, duplicate `(bomLineId, ruleId)` pairs, and any
  mismatch among metrics, evaluation, overlay, and derived status.
- Reject missing/non-deterministic warning projections, a warning-only policy
  failure, arbitrary warning text, unknown catalog codes, and
  unsorted/duplicate warnings.
- Validate exactly one overlay entry per electrical candidate, the exact
  candidate-set hash, full design-result content hash/ref, contiguous order,
  exact commercial status mapping, overlay hash/ID, and the absence of
  `sourcing.` data from the electrical result.
- Mutate one circuit node/value, electrical constraint, or electrical metric in
  turn without changing candidate IDs/request/library hashes; recompute the
  design-result hash and prove the prior overlay is rejected. Also reject a
  design result whose stored content hash does not match its canonical bytes.
- Keep candidate IDs and `candidateSetHash` unchanged while changing electrical
  result bytes; prove those query keys cannot substitute for
  `designResultContentHash`.
- Assert `canonicalDesignResultV2ContentHash` is deterministic and agrees with a
  standard SHA-256 implementation over the specified canonical payload.
- Prove unknown/fail overlay states never remove a candidate, mutate its circuit
  or electrical constraints, or enter electrical rejections/Pareto/rank.
- Validate two overlays with disjoint snapshot refs against the exact union
  pool and one union-bound token for each allowed set use; prove the module-
  private subset path succeeds while either standalone overlay rejects that
  union token. Cross-call download and public-share tokens and require exact
  rejection. Reject a pool/token with a missing, duplicate, wrong-hash,
  subset-only, or wholly unreferenced snapshot/ref.
- Prove every scheMAGIC serializer/store/export/share/UI persistence seam rejects
  an ephemeral view and no package JSON/canonical helper accepts it; do not
  claim that global JavaScript copying/`JSON.stringify` is preventable. Prove a
  user-local overlay can use only the local-storage seam, and transferable
  overlay/bundle/commercial BOM exports reject it. Prove exportable snapshots
  may deliberately produce user-local storage, while an exportable output
  requires all-exportable inputs. Golden-test exact JSON LF and both exact CSV
  headers/rows, including formula prefixes after whitespace, quotes, CR/LF,
  Unicode, known false, and every unknown reason.
- Golden-test reversible BOM text escaping for backslash, NUL, all C0/C1/DEL
  families, U+2028/U+2029, a control-bearing exact MPN, and every collision pair
  among formula prefixes, original apostrophe+prefix, repeated apostrophes, and
  leading SP/HT variants;
  assert no raw control reaches CSV and required provider attribution appears
  both in its exact per-line policy columns and the complete attribution-union
  JSON column. Include quote/backslash/control-bearing evidence and attribution
  values and prove each JSON column parses directly after RFC-4180 decoding,
  with no text-layer double escaping. Reject an empty commercial BOM rather
  than emitting an attribution-free header.
- Serialize one native snapshot/authorization envelope through local, download,
  and public-share paths and golden-test the complete canonical document plus
  one LF, including lineage and signature. On a separate verifier instance,
  parse the envelope, resolve the trusted issuer/policy, reconstruct the exact
  context pool, and fully validate the dependent overlay/bundle. Reject
  ephemeral permission, wrong persistence/use, a non-singleton
  snapshot/authorization context, and every unsigned/wrong-ref authorization
  before bytes; prove no ungated standalone snapshot serializer exists.
- Export an engineering-context-verified offline electrical BOM with no
  evaluator/overlay and prove it contains no sourcing columns or fabricated
  blanks; separately gate commercial enrichment on full context verification.

### Migration

- Verify a V1 hash before migration, migrate every mapping row above, retain
  exact part identities, preserve the full V1 ref in lineage, derive rather than
  copy the version-qualified content-addressed V2 ID, and verify that the V1 and
  V2 full refs are distinct with the new V2 hash.
- Assert V2 migration is idempotent and V1/V2 parsing is version-dispatched.
- Reject a well-formed V1 object with a wrong V1 hash rather than “repairing” it.
- Give separately hash-valid V1 snapshots a weak HTTP URL, credentialed URL,
  control-bearing SKU, unsafe integer, and derived quantity overflow; require
  the distinct `unsupported_v1_value` branch with no fabricated V2 snapshot.
  Prove nine-digit fractional/offset timestamps migrate byte-for-byte.
- Give a V1 snapshot a V2-looking ID and prove the V1 ref and migrated V2 ref
  cannot collide because version and hash are mandatory.
- Give two verified V1 snapshots the same bare ID but different hashes and prove
  V1 metrics migration refuses to choose one.
- Migrate V1 metrics without source snapshots and assert the exact unavailable
  degradation: no snapshot refs, evaluated offers, optional aggregates, or persisted
  bare IDs; `lifecycleCounts.unknown` equals the BOM line count, other lifecycle
  counts are zero, and policy is unknown. Repeat with a mixed-resolution input
  where one referenced snapshot resolves and another is absent/ambiguous;
  require both `snapshotLineage` and `migratedSnapshots` to be empty rather than
  retaining a misleading partial proof.
- Migrate V1 metrics with exact verified snapshots and prove every audit line
  ref resolves to the migrated V2 `(id, schemaVersion, contentHash)` tuple,
  never an ID-only or hash-only match. Assert every resolved line remains
  `unknown`, exact migration warnings/constraints are present, optional derived
  line/candidate aggregates are absent, mandatory lifecycle counts exactly
  project the populated migrated lifecycle observations, and the artifact has no V2 candidate or
  result binding. Assert `snapshotLineage` contains only referenced V1 refs,
  `migratedSnapshots` contains only their audit-only V2 documents, unreferenced
  supplied snapshots are ignored, and even a source `complete` status becomes
  exact audit `unavailable` with the matching unknown data-status constraint.
- Parse a V1 design result with inline sourcing as V1 and require ADR-0005's
  `regeneration_required` plan; assert no candidate, rank, rejection, circuit,
  or inline sourcing field is copied into a fabricated V2 result.
- Regenerate from an explicit engineering objective and exact V2
  catalog/ranking/recipe context, migrate the verified policy and audit-only
  snapshot history, require a native provider refresh, then freshly generate an overlay for every regenerated
  candidate. Assert new deterministic V2 candidate IDs, no old-ID/BOM join, no
  inline sourcing constraint/metric/rejection, and no copied V1
  `ConstraintResult` evidence.
- Use a V1 result that had a sourcing-deleted candidate; assert the regenerated
  electrical pipeline, rather than migration, decides the complete candidate
  set and the migration audit retains the exact lossy-V1 diagnostics.

### Source compatibility

- Compile a V1 consumer against the compatibility release and prove the current
  unsuffixed scalar aliases and V1 functions have not widened or changed.
- Compile explicit V1 and V2 consumers side by side using suffixed exports.
- Compile sourcing-schema in isolation and prove
  `SourcingPolicyConstraintV2`/its parsers have no design-schema import. Reject
  unknown keys, `evidence`, `actual`, `limit`, `margin`, warning status, invalid
  rule namespaces, and duplicate `(bomLineId, ruleId)` pairs.
- Compile the V1 callback with design-schema `ConstraintResult[]` and the V2
  callback with sourcing-schema `SourcingPolicyConstraintV2[]`; prove neither
  API accepts the other constraint type through a widened union.
- Prove `parsePersistedOfferSnapshot` dispatches only on `schemaVersion`, while
  standalone offer validators remain version-specific.
- At the declared alias-flip package boundary, prove old source fails clearly
  where it assumes V1 scalars and that suffixed V1 parsers/hashes remain
  callable and byte-compatible.
- Compile/round-trip named `DesignCandidateV1`/`DesignResultV1`, electrical-only
  V2 candidate/result, `CommercialOverlayV1`, and `DesignExportBundleV2` in
  parallel; prove the dispatcher does not merge commercial data into V2
  candidates.

### Provider normalization

- DigiKey missing boolean and unfamiliar package/lifecycle/lead fields become
  reasoned unknown observations rather than dropped offers or defaults.
- DigiKey known `BackOrderNotAllowed: true` maps to known
  `backorderAvailable: false`.
- A synthetic Mouser draft preserves strictly parsed quantity, MOQ, multiple,
  currency, price, SKU, URL, and exact part identity while emitting the unknown
  observations listed above.
- Mouser `Reeling`, `LifecycleStatus`, `LeadTime`, and `AvailableOnOrder` do not
  silently become normalized package, lifecycle, numeric days/kind, or boolean.
- Sanitized partial/provider errors contain no raw response values.

### Evaluation and ranking

- Table-drive every row in the policy matrix, including known `false` versus
  unknown booleans and irrelevant-policy unknown observations.
- Prove explicit fail wins over unknown and unknown never becomes pass through
  offer/distributor ordering.
- Prove unknown region/currency/package/lifecycle/lead/backorder cannot satisfy
  the corresponding restriction.
- Prove unknown or missing price is omitted, never zero.
- Prove only the policy-pass subset enters commercial sourcing Pareto/ranking;
  unknown and fail remain visible but the comparator is never called for them.
- Give an unknown candidate a numerically cheaper known partial price and prove
  it is not compared against, cannot outrank, and cannot dominate a policy-pass
  candidate.
- Tie two policy-pass candidates on every explicit criterion with different
  unknown counts and prove the existing stable candidate-ID tie-break alone
  determines order.
- Prove an empty policy-pass subset stays empty rather than promoting an unknown
  or failed candidate for commercial ranking.
- Give a policy-pass candidate one missing requested aggregate; prove it remains
  visible with exact `missing_requested_metric` Pareto/rank states and is never
  passed to that criterion's numeric comparator.
- With multiple criteria, prove only pass candidates with every requested
  Pareto aggregate enter commercial Pareto and only frontier candidates with
  every requested ranking aggregate enter rank; dominated and missing-value
  candidates remain visible in their exact deterministic order groups.
- Prove electrical candidate ID, circuit, electrical feasibility, and
  electrical-only rank are identical with and without V2 offer observations.
- Prove an unknown commercial result remains visible as sourcing unproven and is
  not labeled as an electrical rejection.

### UI and export

- Render every unknown reason and known `false`; assert no false default wording.
- Show transport `complete` alongside policy `unknown` without contradiction.
- Export CSV state/value/reason and full snapshot-ref columns; standalone
  snapshot JSON preserves observation/lineage objects while overlay/bundle JSON
  preserves refs only. Reject an ID-only round trip and validate refs against
  the external exact snapshot/authorization pool.
- Round-trip electrical result, commercial overlay, and the V2 export bundle as
  separate versioned artifacts; reject inline V2 candidate sourcing.
- Assert evaluated but unknown/rejected offers are not labeled selected or
  policy-compliant.

## Required implementation seams and blockers

The following current seams must change before V2 can be accepted:

1. [`sourcing-schema`](../../packages/sourcing-schema/src/offer.ts) has only V1
   scalar offer fields, V1 snapshot/metrics versions, scalar validators, V1
   canonical hashing that includes the caller-supplied ID, and metrics with bare
   snapshot IDs rather than version/hash-qualified refs.
2. [`sourcing-core`](../../packages/sourcing-core/src/evaluate.ts) has tri-state
   decisions but assumes concrete offer values, treats unknown as Boolean
   eligible at its candidate adapter, emits a V1 design-constraint-compatible
   shape instead of closed sourcing constraints, and omits the evaluated offer
   reference from unknown/rejected line metrics.
3. [`design-engine` ranking](../../packages/design-engine/src/ranking.ts) does not
   implement a separate policy-pass commercial overlay before consuming
   sourcing aggregates, while generation uses the V1 Boolean eligibility
   boundary and only ad hoc contextual checks.
4. [`design-schema`](../../packages/design-schema/src/candidate.ts) V1 embeds the
   unsuffixed sourcing metrics and combined constraints directly in candidates;
   it has no electrical-only V2 result or separately versioned commercial
   overlay contract, and no canonical full-result content hash to which an
   overlay can bind.
5. [`sourcing-service` normalization](../../apps/sourcing-service/src/providers/normalization.ts)
   drops a draft when required V1 facts are unknown. Its Mouser provider remains
   correctly partial-only under V1.
6. [`SourcingStatus`](../../apps/web/src/features/designer/SourcingStatus.ts) and
   [`bom-csv`](../../packages/design-export/src/bom-csv.ts) consume scalar fields
   and do not preserve reasoned unknown state or separate electrical/commercial
   serialization.
7. Current package exports have no parallel named V1/V2 source-compatibility
   phase or declared coordinated alias-flip boundary.
8. Provider availability, exact-MPN confirmation for Mouser, attribution,
   caching/persistence, and public/self-hosted approval remain blocked by the
   checked-in provider policy manifests. This ADR does not remove those blockers.
9. No V2 provider-policy hash/ref registry, server-only Ed25519 issuer/key-
   rotation path, execution-mode-separated production trust store,
   browser-safe authorization verifier, authorization persistence/deadline
   deletion path, or overlay/export authorization join exists yet. Disabled
   manifests must remain unable to issue. These seams are required before even
   an ephemeral live V2 commercial view may ship; synthetic test keys are never
   production trust anchors.

Implementation must land as a coordinated schema/evaluator/engine/service/UI/
export migration. A provider normalizer must not emit V2 offers before the
version-dispatched parser, canonical hash, conservative evaluator, and display
surfaces are ready.

## Consequences

Positive consequences:

- Provider-neutral partial observations become representable and inspectable.
- Known `false` is preserved without falsely defaulting missing fields.
- Policy and ranking become conservative by construction.
- Hashes record uncertainty and its cause.
- Future approved providers can participate without matching DigiKey's exact
  response vocabulary.

Costs and tradeoffs:

- Consumers must unwrap observation values and handle reasons.
- Snapshot and candidate-metrics migrations are required.
- CSV becomes wider, and V1 CSV cannot remain lossless.
- Some currently “eligible” unknown candidates move to an explicit unproven
  commercial state.
- V1 concrete defaults cannot be proven or repaired retrospectively.
