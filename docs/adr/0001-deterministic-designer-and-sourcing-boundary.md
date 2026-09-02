# ADR-0001: Deterministic Designer and Sourcing boundary

- Status: Accepted for scheMAGIC Designer V1 foundation
- Date: 2026-08-23
- Decision scope: scheMAGIC Designer, scheMAGIC Motor Designer, scheMAGIC Power Designer, scheMAGIC Sourcing, and the scheMAGIC Component Library
- Authority: [`docs/DESIGNER_V1_HANDOFF.md`](../DESIGNER_V1_HANDOFF.md)

## Context

scheMAGIC Simulator is a local-first browser application with a typed circuit document and a pinned ngspice WebAssembly engine. scheMAGIC Designer adds a requirements-to-circuit workflow for two V1 applications developed in parallel:

- scheMAGIC Motor Designer for one brushed-DC motor and one H-bridge.
- scheMAGIC Power Designer for one non-isolated buck converter.

Both applications need the same normalization, enumeration, constraint, evidence, ranking, circuit-materialization, and export behavior. They must also be useful without a network connection.

Engineering component facts change on a reviewed catalog cadence. Distributor stock, prices, lead times, and lifecycle observations are volatile, may require credentials, and are governed by provider-specific terms. Mixing those kinds of data would make designs irreproducible and would force the electrical engine to depend on a service.

The public product name is scheMAGIC. Existing npm packages use the `@opencircuit/*` scope. That scope is an internal compatibility namespace in this decision, not the product brand, and is not renamed during the V1 foundation work.

> **Naming update, 2026-09-02.** The public product family was renamed to Robonyx. Everything this ADR calls scheMAGIC is now Robonyx: Robonyx Simulator, Robonyx Designer, Robonyx Motor Designer, Robonyx Power Designer, Robonyx Sourcing, and the Robonyx Component Library. The technical decisions below are unchanged, and no persisted identifier moves: the `@opencircuit/*` scope, the `opencircuit-circuit` document format and the `schemagic-*` format and storage identifiers stay exactly as recorded. See the naming section in the [root README](../../README.md).

## Decision

### 1. Use one application-neutral design compiler

Motor and Power recipes plug into one deterministic compiler. The compiler pipeline is:

1. Normalize the request into canonical SI values.
2. Enumerate compatible recipe and device combinations.
3. Solve named equations for ideal component values and operating points.
4. Match requirements to reviewed component profiles.
5. Check every hard constraint and retain every rejection reason.
6. Estimate supported metrics while preserving unknown evidence.
7. Deduplicate equivalent BOMs.
8. Pareto-prune dominated candidates.
9. Rank with documented objectives and stable tie-breakers.
10. Materialize full circuit documents only for surviving candidates.
11. Run named simulations on demand through scheMAGIC Simulator.

This is the frozen V1 foundation order. For Designer V2 only,
[`ADR-0005`](0005-designer-v2-result-and-circuit-boundary.md) supersedes steps
7-10 with materialization plus structural circuit/coverage/BOM validation before
dedupe, Pareto, and rank. That V2 change does not alter this ADR's
electrical-before-commercial boundary or any V1 API/result bytes.

Application equations, envelopes, circuit builders, and device predicates belong to recipes. They do not become `motor` or `power` branches in the generic compiler.

Every scheMAGIC Motor Designer request includes an explicit `MotorOperatingPoint` for analytic loss, efficiency, and thermal comparisons. It records `dutyCycle`, `loadCurrent`, `loadCurrentBasis`, and the supported V1 `loadProfile`. V1 accepts a steady-state profile and a duty cycle greater than zero and no greater than one. A continuous-rating basis must use the declared continuous motor current; a user-provided basis remains explicit. No recipe may silently assume full duty, rated current, or a hidden load profile.

No LLM, network request, current stock value, or manufacturer preference participates in electrical feasibility.

### 2. Keep stable engineering data separate from volatile offers

The scheMAGIC Component Library stores versioned engineering profiles, application limits, evidence references, review states, and authored behavioral-model metadata. A design request pins its library version. The same normalized request, library version, compiler version, and optional offer snapshot must produce the same candidate IDs and ordering.

Distributor offers are normalized into immutable, timestamped snapshots. Stock, price, lead time, lifecycle, distributor SKU, and retrieval metadata never become fields in an engineering component profile.

`canonicalOfferSnapshotPayload` serializes the complete snapshot except `contentHash`, with object keys in lexical order while preserving array order and numeric values exactly. `calculateOfferSnapshotContentHash` computes the browser-safe SHA-256 digest of those canonical bytes and prefixes it with `sha256:`. Snapshot validation recomputes this digest and rejects any mismatch. A syntactically valid hash string is not sufficient. Providers and fixtures must therefore establish deterministic array ordering before they create a snapshot.

Every component and sourcing join uses `ManufacturerPartIdentity`, composed of the stable normalized `ManufacturerId` field `manufacturerId` and the exact orderable field `manufacturerPartNumber`. A manufacturer part number alone is not globally unique. Human-readable manufacturer names and distributor spellings are aliases for display and normalization; they never replace the stable key.

All persisted scheMAGIC Designer and scheMAGIC Sourcing validators are closed recursively. They reject unknown keys with an actionable field path rather than preserving or silently ignoring them. New persisted fields require an explicit schema-version decision and, when prior documents exist, a migration. Parse and migration entrypoints reject unknown persisted fields, so raw provider responses, credentials, undeclared assumptions, and volatile offer objects cannot cross a typed boundary as extra properties.

Missing facts remain `unknown`. They are not converted to zero, a pass, or an advantageous score.

### 3. Make sourcing optional and credential-isolated

scheMAGIC Sourcing consists of provider-neutral schemas and evaluation logic plus an optional credentialed service. The browser and design compiler never receive distributor credentials.

The service:

- Accepts only bounded, validated lookups for electrically eligible exact manufacturer part numbers.
- Calls only enabled and authorized provider adapters.
- Applies provider-specific rate, cache, attribution, persistence, and export rules.
- Returns normalized offer snapshots with provenance and expiry.
- Canonicalizes every snapshot and verifies its declared content hash before returning or accepting it.
- Degrades provider errors into explicit partial, stale, or unavailable states.

The V1 live-provider targets are DigiKey and Mouser. LCSC support is exact-MPN link-out only. There is no LCSC adapter, scraping, copied response fixture, shared unofficial key, or claimed live LCSC data before an approved partnership.

### 4. Apply sourcing after electrical feasibility and before final ranking

The compiler first finds electrically valid parts. If sourcing is enabled, scheMAGIC Sourcing enriches only that bounded MPN set and evaluates the user's sourcing policy. A sourcing failure may cause the compiler to try the next electrically valid combination, but every changed BOM must pass the electrical checks again.

A refreshed offer snapshot may change sourcing eligibility or sourcing rank. It cannot change engineering facts, bypass a hard electrical constraint, or silently mutate a selected circuit.

Without an offer snapshot, electrical candidates are still generated and sourcing status is `unavailable`.

### 5. Enforce vendor neutrality as a testable invariant

Manufacturer identity is display and filter metadata, not a ranking input. Any manufacturer's component may enter the scheMAGIC Component Library through the same public schema, evidence, review, and test gates.

Neutrality tests must prove that anonymizing manufacturer names leaves feasibility, Pareto membership, scores, and ordering unchanged. Missing characterization cannot improve a result. Exact ties use a stable component identifier rather than a brand preference.

The checked-in [`docs/designer-v1-data-manifest.json`](../designer-v1-data-manifest.json) owns the V1 coverage targets and track assignments. Before an exact manufacturer-ID and MPN pair is added, that manifest must assign it one owning track and one independent review track.

### 6. Freeze contracts before application fan-out

Milestone 0 contract sources are:

- Design contract package: `@opencircuit/design-schema` in `packages/design-schema`.
- Design contract sources: `packages/design-schema/src/application.ts`, `packages/design-schema/src/quantity.ts`, `packages/design-schema/src/request.ts`, `packages/design-schema/src/evidence.ts`, `packages/design-schema/src/constraint.ts`, `packages/design-schema/src/candidate.ts`, `packages/design-schema/src/migration.ts`, `packages/design-schema/src/validation.ts`, and `packages/design-schema/src/index.ts`.
- Design contract exports include `DesignRequest`, `BrushedDcMotorDesignRequest`, `BuckDesignRequest`, `MotorOperatingPoint`, `DesignCandidate`, `DesignResult`, `Quantity`, `EvidenceRef`, `ConstraintResult`, `migrateDesignRequest`, `serializeDesignRequest`, `deserializeDesignRequest`, and `validateDesignRequest`.
- Reference design requests: `packages/design-schema/test/fixtures/requests/m1-compact.design-request.json`, `packages/design-schema/test/fixtures/requests/m2-power.design-request.json`, `packages/design-schema/test/fixtures/requests/p1-compact.design-request.json`, and `packages/design-schema/test/fixtures/requests/p2-high-voltage.design-request.json`.
- Design contract tests: `packages/design-schema/test/request.test.ts`.
- Sourcing contract package: `@opencircuit/sourcing-schema` in `packages/sourcing-schema`.
- Sourcing contract sources: `packages/sourcing-schema/src/ids.ts`, `packages/sourcing-schema/src/policy.ts`, `packages/sourcing-schema/src/offer.ts`, `packages/sourcing-schema/src/snapshot.ts`, `packages/sourcing-schema/src/metrics.ts`, `packages/sourcing-schema/src/canonical.ts`, `packages/sourcing-schema/src/validation.ts`, and `packages/sourcing-schema/src/index.ts`.
- Sourcing contract exports include `DistributorId`, `DistributorRegistryEntry`, `ManufacturerId`, `ManufacturerPartIdentity`, `SourcingPolicy`, `LifecycleStatus`, `AllowedLifecycleStatus`, `PackagingType`, `DistributorOffer`, `PriceBreak`, `OfferSnapshot`, `ProviderRequestStatus`, `ProviderError`, `SnapshotFreshness`, `BomLineSourcingMetrics`, `CandidateSourcingMetrics`, and `SourcingDataStatus`, plus their public validators, parsers, migrations, canonical snapshot payload, and snapshot content-hash functions.
- Synthetic sourcing fixtures: `packages/sourcing-schema/src/fixtures.ts`, exported only through `@opencircuit/sourcing-schema/fixtures`.
- Sourcing contract tests: `packages/sourcing-schema/test/schema.test.ts`.

`@opencircuit/design-schema` may import the public `SourcingPolicy` and `CandidateSourcingMetrics` types from `@opencircuit/sourcing-schema`. The sourcing package has no reverse dependency on design contracts, application code, a provider API, the sourcing service, or UI code.

After the contracts freeze, the planned implementation units are `packages/design-engine` for the generic compiler, `packages/design-library` for reviewed recipes and engineering profiles, `packages/sourcing-engine` for provider-neutral sourcing evaluation, and `apps/sourcing-service` for optional credentialed provider access. These units do not exist as part of this ADR change set and must not be folded into either application track.

Motor and Power implementation may fan out only against these versioned contracts and the data manifest. A shared contract change requires a schema-version change where serialized data changes, migration support where old persisted data would otherwise break, and contract tests for both application fixture families.

### 7. Preserve the existing simulation boundary

Surviving candidates materialize the existing `CircuitDocument` owned by `@opencircuit/circuit-schema`. Simulation stays in the current Worker and pinned ngspice WASM boundary. SPICE validates a design recipe; it does not replace design equations or make an unknown constraint pass.

## Data flow

```text
DesignRequest + pinned library version
                |
                v
       deterministic compiler <---- scheMAGIC Component Library
                |
        electrically valid MPNs
                |
                +---- no sourcing ----> sourcing unavailable
                |
                v
       optional sourcing service ----> DigiKey / Mouser
                |
                v
          OfferSnapshot
                |
                v
     sourcing policy + full-BOM metrics
                |
                v
     rechecked and ranked candidates
                |
                v
 CircuitDocument -> scheMAGIC Simulator -> exports
```

## Consequences

### Benefits

- Motor and Power teams can implement recipes concurrently without duplicating compiler behavior.
- Offline electrical design remains a first-class mode.
- Saved designs can pin stable engineering inputs while showing the age and limitations of volatile offers.
- Distributor credentials and provider terms stay outside the static browser bundle.
- Provider additions do not require application-recipe or saved-request schema changes.
- The project can prove catalog neutrality with data and regression tests.

### Costs

- Hosted live sourcing requires a separately operated service and provider approval.
- A sourcing refresh can legitimately change commercial ranking, so the UI must show snapshot time and staleness.
- Shared schema changes are slower because both application tracks must pass contract tests.
- Component data needs independent evidence review in addition to code review.

## Rejected alternatives

- **Separate Motor and Power engines:** duplicates normalization, evidence, ranking, and hashing and makes results drift.
- **Distributor calls from the browser:** exposes credentials and makes rate, cache, and provider-policy enforcement unreliable.
- **Stock and price inside component profiles:** couples reproducible engineering data to volatile observations.
- **Source first, design second:** lets availability prematurely hide electrically valid solutions and can expand provider queries to catalog scale.
- **Silent part substitution:** can invalidate voltage, current, thermal, control, or simulation assumptions.
- **Treat unknown data as zero or pass:** rewards poorly documented components.
- **Speculative LCSC integration or scraping:** conflicts with the deferred partnership decision and creates legal and operational risk before traction.
- **LLM-generated electrical decisions:** cannot satisfy the reproducibility and evidence contract.

## Verification

Milestone 0 is complete for this decision when:

- Design and sourcing fixtures validate against their owning package contracts.
- Valid versioned documents round-trip without data loss.
- Invalid units, ranges, lifecycle values, and snapshot metadata are rejected.
- Unknown fields are rejected at every persisted root and nested object; tests include credential-like and raw-provider extras.
- Both Motor fixtures declare `MotorOperatingPoint`, and no loss, efficiency, or thermal metric is generated without one.
- Component selections, requested sourcing parts, offers, and BOM-line sourcing metrics use the same manufacturer-ID and exact-MPN identity.
- Mutating any hashed snapshot field without recomputing `contentHash` fails validation; recomputing a canonical unchanged snapshot produces the same SHA-256 value.
- Synthetic snapshots contain no copied live provider response or credential.
- Volatile offer fields cannot be embedded in engineering component profiles.
- The data manifest parses as JSON, has unique class IDs, and assigns every class one ownership track.
- All exact manufacturer-ID and MPN profile additions are blocked until the manifest records one owner and a different reviewer.

## Follow-up decisions

Separate ADRs are required before:

- Enabling a hosted provider whose terms have not been approved for the intended display and caching behavior.
- Adding a live LCSC adapter after the traction and partnership gate.
- Changing the public serialized request, candidate, or offer-snapshot format incompatibly.
- Introducing boost, buck-boost, isolated power, stepper, or BLDC recipe abstractions.
