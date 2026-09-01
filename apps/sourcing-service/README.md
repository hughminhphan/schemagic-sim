# scheMAGIC Sourcing service

Optional server-side infrastructure for bounded exact-MPN distributor lookups.
The service validates closed requests, applies the provider policy supplied by
scheMAGIC Sourcing's internal `@opencircuit/sourcing-core` compatibility module,
rate-limits and times out calls, validates normalized snapshots, and caches only
for the permitted lifetime.
Native V2 construction requires an explicit `public_hosted` or `self_hosted`
execution mode. Each lookup uses the sourcing-core canonical operation-permission
validator before reading cache state or calling an adapter. An approved policy
still fails closed unless it carries a trimmed, bounded, control-free recorded
approval reference.
Policy-approved stale snapshots may cover upstream or local rate-limit failures,
but are never returned past the provider's deletion lifetime.

`createSourcingServiceV2` is the native commercial path. It accepts only
canonical, content-hash-pinned V2 provider policy manifests and returns only
content-addressed `OfferSnapshotV2` documents with
`evaluationEligibility: "native_v2"`. It rejects future-dated retrievals,
unapproved persistence, imported lineage, product links outside the provider's
verified host, expiry beyond the approved TTL/deletion deadline, and policy
hash drift. A returned snapshot can therefore be bound to the signed commercial
authorization contract. `createSourcingService` remains only as a legacy V1 API
compatibility and audit boundary. Every V1 lookup deterministically rejects with
`legacy_v1_sourcing_service_audit_only` before reading a clock, rate limiter, or
cache and before calling an adapter. V1 policies cannot represent the recorded,
content-addressed approval required by native V2 and therefore have no live
provider-execution authority.

Provider adapters are injected into the native V2 service after server startup.
Their factories are internal normalization/transport seams and are not exported
as public package subpaths. Credentials belong inside the adapter's server-only
closure or credential manager; they are not service request fields, adapter
method arguments, snapshots, logs, or browser code.

DigiKey and Mouser normalizers exist behind injected server-only transport
interfaces. The repository still contains no credentials, network transports,
live-response fixtures, scraping code, or LCSC adapter. Tests use hand-authored
synthetic wire shapes. DigiKey promotes only fully documented fields. The native
V2 Mouser adapter retains its documented SKU/stock/order/price facts while
representing region, packaging, marketplace, backorder, lead-time, and lifecycle
ambiguities as explicit unknown observations; its snapshot remains partial. See
`src/providers/OFFICIAL_FIELD_MAPPING.md` for the mapping and open ambiguities.

The checked-in DigiKey and Mouser policy manifests remain disabled pending
access and written approval for the intended display, normalization, caching,
persistence, export, and public/self-hosted behavior. The service checks those
blockers before cache access or an injected transport call.
