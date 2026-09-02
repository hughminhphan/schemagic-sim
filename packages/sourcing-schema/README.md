# Robonyx Sourcing schema

Provider-neutral TypeScript contracts for sourcing policies, normalized distributor
offers, immutable offer snapshots, and BOM/candidate sourcing metrics.

This package contains no provider API clients, credentials, live distributor data,
or electrical component facts. Synthetic test data is available from the explicit
`@opencircuit/sourcing-schema/fixtures` subpath and is not exported from the
production package root.

Persisted objects are closed contracts: runtime validation rejects unknown keys at
every nested level. An offer snapshot's `contentHash` is SHA-256 over UTF-8 canonical
JSON returned by `canonicalOfferSnapshotPayload`: `contentHash` is omitted, object
keys are sorted lexically, and array order and numeric values are preserved.

The compatibility release keeps every unsuffixed offer, snapshot, metrics, parser,
validator, and hash export on the frozen V1 contract. Parallel V2 consumers must use
the explicit `*V2` exports; V1 consumers that want a version-pinned import may use
the corresponding `*V1` aliases. V2 observations distinguish known values from
reasoned unknowns, snapshots use content-addressed schema-qualified IDs, and metrics
persist full snapshot references. `parsePersistedOfferSnapshot` dispatches only on
`schemaVersion` and returns a verified or migrated V2 snapshot.
