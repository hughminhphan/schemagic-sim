# ADR-0003: Neutral design-library profile and admission contract

- Status: Accepted; core contract implemented
- Date: 2026-08-23
- Decision scope: the persisted engineering-profile and admission boundary implemented by `@opencircuit/design-library`
- Authority: [`docs/DESIGNER_V1_HANDOFF.md`](../DESIGNER_V1_HANDOFF.md) and [`docs/designer-v1-data-manifest.json`](../designer-v1-data-manifest.json)
- Implementation status: `packages/design-library` implements the closed profile,
  registry, admission, release, validation, hashing, migration, and reviewed-
  loader boundary. The checked-in production release intentionally contains
  zero reviewed profiles; part admission remains separate evidence/review work.

## Context

scheMAGIC Motor Designer and scheMAGIC Power Designer currently use synthetic, application-local TypeScript catalogs. They prove the compiler and circuit-generation paths, but they are not persisted production contracts:

- Motor profiles use `id`, `kind`, `state`, `packageName`, and `boardAreaM2`; Power profiles use `profileId`, `profileKind`, `displayName`, and `areaM2`.
- The applications name overlapping MOSFET, capacitor, resistor, thermal, and voltage facts differently. Each application also has facts the other does not yet carry.
- Motor performs semantic checks over already typed fixture objects. Power freezes its fixture objects but has no untrusted persisted-profile parser. Neither boundary recursively rejects unknown JSON fields as a production catalog must.
- Both catalogs correctly use `ManufacturerPartIdentity { manufacturerId, manufacturerPartNumber }`, evidence references, and synthetic-only markers. Their test data must not acquire reviewed status merely by being moved.

The checked-in data manifest establishes twelve V1 part classes, a one-exact-MPN-per-profile rule, class ownership tracks, independent review, recursively closed persisted contracts, and this path shape:

```text
packages/design-library/parts/<part-class>/<manufacturer-id>/<mpn>.json
```

It defines a reviewed profile as schema-valid engineering facts with primary-source locators, compatible publication rights, declared valid ranges, completed independent review, and all required deterministic checks passing. It also says that manufacturer identity cannot affect admission or ranking, unknown data cannot become advantageous, and a reviewed design profile does not imply a reviewed or redistributable simulation model.

The existing packages already define two boundaries that this package must respect:

- `@opencircuit/design-schema` owns canonical SI `Quantity`, `EvidenceRef`, unknown/evidence states, requests, constraints, and results.
- `@opencircuit/sourcing-schema` owns stable `ManufacturerPartIdentity` and volatile offer, stock, price, lead-time, lifecycle, distributor-SKU, and retrieval data.

The existing `packages/component-schema` and `packages/model-library` validate simulation-model packages. Those packages own SPICE pin mapping, model fidelity, supported analyses, model operating regions, fitting evidence, benches, and model admission. A design profile instead supplies reviewed facts for deterministic selection, sizing, constraints, and analytic estimates. The two artifacts may describe the same MPN, but neither is evidence that the other exists or has passed review.

## Decision

### 1. Add a separate, strict `@opencircuit/design-library` package

Use this source layout:

```text
packages/design-library/
  package.json
  README.md
  admission.json
  manufacturers.json
  schema/
    profile-envelope.v1.schema.json
    admission.v1.schema.json
    manufacturer-registry.v1.schema.json
    facts/
      <part-class>.v1.schema.json
  src/
    profile.ts
    admission.ts
    manufacturer.ts
    codec.ts
    validation.ts
    migration.ts
    canonical.ts
    index.ts
    facts/
      <part-class>.ts
  parts/
    <part-class>/
      <manufacturer-id>/
        <mpn-path-token>.json
  test/
    fixtures/
    profile.test.ts
    admission.test.ts
    manufacturer.test.ts
    neutrality.test.ts
    sourcing-separation.test.ts
    staged-adapters.test.ts
  validate-library.mjs
```

The JSON schemas are the language-neutral persisted contract. TypeScript types and runtime parsers mirror them, with tests preventing drift. `validate-library.mjs` is the repository and CI entrypoint; it validates every profile, the manufacturer registry, the admission ledger, cross-file identity/path/hash rules, and the reviewed runtime projection.

This is separate from `packages/component-schema` and `packages/model-library`. The design library may depend on the public design and sourcing schemas. Neither design profile validation nor a Designer application may import offers, provider adapters, or model-library internals.

`manufacturers.json` is a closed, versioned registry of stable manufacturer identities and official evidence hosts:

```ts
interface ManufacturerRegistryEntryV1 {
  manufacturerId: ManufacturerId;
  displayName: string;
  primaryEvidenceHosts: string[];
}
```

For `manufacturer_datasheet` and `manufacturer_product_page` evidence, the validator parses the URL with a standards-compliant URL parser, requires HTTPS with no embedded credentials, normalizes the hostname to its lowercase ASCII form, and requires exact membership in `primaryEvidenceHosts` on the registry entry whose `manufacturerId` exactly equals `profile.part.manufacturerId`. A parent-domain, suffix, substring, redirect-target assumption, or host registered to another manufacturer is not a match. Every permitted subdomain must therefore be listed explicitly. Distributor, marketplace, catalog-provider, and document-mirror hosts fail this rule even when they serve an authentic PDF or exact-MPN page. `independent_measurement` and `authored_derivation` use their own closed provenance rules and do not masquerade as manufacturer evidence.

The manufacturer registry is admission infrastructure, not a ranking input. Its display names and evidence hosts cannot create a feasibility or ranking preference. Registry changes are reviewed and versioned as catalog inputs because they can change whether future evidence is admissible.

### 2. Store one closed engineering profile for one exact part

The V1 persisted envelope is conceptually:

```ts
interface DesignProfileV1<Facts> {
  format: "schemagic-design-profile";
  schemaVersion: "1.0.0";
  partClass: PartClassId;
  part: ManufacturerPartIdentity;
  factsSchemaVersion: "1.0.0";
  commonFacts: {
    packageName: ProfileFact<string>;
    boardArea: ProfileFact<Quantity<"m2">>;
    maximumHeight: ProfileFact<Quantity<"m">>;
  };
  facts: Facts;
}

interface ProfileFact<Value> {
  value: Value | null;
  state: "reviewed" | "calculated" | "estimated" | "unknown";
  evidence: ProfileEvidenceRef[];
  validFor: OperatingRange[];
  explanation: string;
}

interface OperatingRange {
  parameterId: string;
  minimum: Quantity | null;
  maximum: Quantity | null;
  evidence: ProfileEvidenceRef[];
}

interface ProfileEvidenceRef extends EvidenceRef {
  kind:
    | "manufacturer_datasheet"
    | "manufacturer_product_page"
    | "independent_measurement"
    | "authored_derivation";
  url: string;
  revision: string;
  retrievedAt: string;
  contentHash: `sha256:${string}`;
  publicationBasis: "public_facts" | "licensed_redistribution" | "original_measurement";
}
```

This block is the frozen facts-schema-V1 contract. For facts schema `2.0.0`
inside the same persisted profile envelope,
[ADR-0006](0006-design-profile-v2-geometry-and-bound-semantics.md) adds a
basis-bearing mounted-footprint projection and explicit Power bound kinds. It
does not reinterpret V1 envelope/facts bytes, hashes, fixtures, releases, or
migration behavior.

The implemented schema may use JSON `$defs`, but it must preserve these semantics:

- `partClass` is one of the manifest's twelve exact IDs.
- `part` is the stable lowercase manufacturer registry ID plus the exact manufacturer part number. MPN alone is never an identity.
- `commonFacts` contains only facts needed by every V1 component selection: package name, board-area contribution, and maximum height. Missing values are explicit `unknown`, never omitted or defaulted.
- Every other electrical, thermal, control, or role-specific fact belongs to the closed schema selected by `partClass` and `factsSchemaVersion`.
- Canonical physical values use `Quantity` and canonical SI units. Field names do not encode units in the persisted contract.
- A non-null fact has non-empty evidence and an explanation. An `unknown` fact has a null value and an explanation; it cannot carry a fabricated range or improve eligibility or ranking.
- A numeric range has at least one bound, uses compatible canonical units, and has `minimum <= maximum` when both exist. Its `parameterId` and permitted unit are closed by the part-class codec; it is not an open bag of conditions.
- Evidence records a precise locator, retrieval time and source SHA-256 through the inherited `EvidenceRef` fields, as well as source kind, URL, revision, publication basis, and license note. The profile contract makes retrieval time and content hash mandatory even though the more general `EvidenceRef` type permits their omission. Manufacturer evidence additionally passes the exact registry-host rule in Section 1. The repository stores those references and public facts, not vendor PDFs or proprietary model files.
- Class admission rules decide which facts must be `reviewed`, which may be `calculated` or `estimated`, and which declared ranges are required. A structurally valid profile is not automatically eligible.

All objects are recursively closed. There is no `metadata`, `extensions`, `raw`, `properties`, or other arbitrary object escape hatch. New persisted fields require a schema-version decision.

`profileId` is derived, not freely authored. It is the profile's canonical repository-relative POSIX path. The `<mpn>` placeholder in the manifest means a reversible `mpn-path-token`: preserve the exact MPN's case and UTF-8 bytes, and percent-encode every byte outside `[A-Za-z0-9_-]`, including `.`, `/`, `\\`, `%`, spaces, and control characters. Validation decodes the token and requires byte-for-byte equality with `part.manufacturerPartNumber`; it also rejects case-folded path collisions for cross-platform checkouts.

The library rejects duplicate `ManufacturerPartIdentity` pairs globally, not merely within a part-class directory. Two manufacturers may legitimately use the same MPN. One exact part may satisfy both application targets through the same shared profile; it is not copied into two files.

### 3. Use class codecs, not a premature universal fact union

A twelve-way `AllComponentFacts` union is premature. The staged catalogs already disagree on semantics that must be resolved with evidence rather than by renaming fields:

- Motor `drainSourceMaximumV`, `rdsOnOhm`, `rdsOnGateVoltageV`, and `thetaJaKPerW` overlap Power `drainSourceVoltageV`, `resistanceOhm`, `resistanceGateVoltageV`, and `thermalResistanceKPerW`.
- The Motor MOSFET fixture has pulsed-current data that the Power fixture lacks; the Power fixture has rise/fall-time data that the Motor fixture lacks.
- Motor capacitors require an effective value, while Power explicitly allows an unknown effective value or a stated fixture derating estimate.
- A Power capacitor's `input` or `output` role does not prove whether the physical part belongs to `shared.mlcc-capacitor` or `shared.bulk-capacitor`.

Instead, register one closed codec per admitted part class:

```ts
interface DesignProfileCodec<ClassId extends PartClassId, Facts> {
  partClass: ClassId;
  factsSchemaVersion: string;
  validateFacts(input: unknown): ValidationIssue[];
  parseFacts(input: unknown): Facts;
  validateAdmission(profile: DesignProfileV1<Facts>): ValidationIssue[];
}
```

The common parser first validates the envelope, resolves the exact known codec, and then validates `facts` recursively. An unknown part class or facts version fails closed. Consumers needing typed facts call a codec-bound parser; they do not cast a root `Record<string, unknown>`.

This registry is the simpler alternative to a universal fact union. Add a class module only when its required facts, conditions, evidence, and deterministic checks are understood. Shared physical classes such as the N-channel power MOSFET have one codec used by both applications. Application-specific IC classes keep their own codecs without adding Motor or Power branches to the generic compiler.

The first shared codecs must preserve the conditions attached to the concrete facts already required by the application tracks:

- `shared.n-channel-power-mosfet`: drain-source voltage rating; continuous and pulsed drain-current ratings with their test conditions; on-resistance at declared gate voltage, current, and temperature; total gate charge with its voltage/current conditions; switching time and reverse-recovery claims only where evidenced; maximum junction temperature; thermal resistance with board/footprint assumptions; and package/body area.
- `shared.current-sense-resistor`: resistance, tolerance, temperature coefficient, continuous power, pulse power with duration/waveform, thermal/package limits, and Kelvin-terminal capability where applicable.
- `shared.mlcc-capacitor` and `shared.bulk-capacitor`: nominal capacitance, effective capacitance at declared bias and temperature when known, rated voltage, and ESR/ripple-current facts where relevant to the physical class and recipe.
- `shared.general-purpose-resistor`: resistance, tolerance, temperature coefficient, power rating, working-voltage rating, and package limits. Gate and pull-down are recipe roles, not separate physical profile classes.
- `motor.supply-tvs-diode`: stand-off voltage, breakdown range, clamping voltage at a declared pulse current and waveform, and pulse-energy capability under declared conditions.

These are typed claims with `ProfileFact` evidence and `OperatingRange` conditions, not optional names in a common map. The remaining class owners define equally closed schemas before their first admission. In particular, an application-local role such as input capacitor, output capacitor, bootstrap capacitor, gate resistor, or pull-down resistor remains in the recipe/component requirement; it does not split or weaken physical part identity.

### 4. Keep review workflow in one admission ledger

`admission.json` is the single authored source for identity ownership and review state. It has one recursively closed entry per planned or present exact part:

```ts
interface DesignProfileAdmissionEntryV1 {
  partClass: PartClassId;
  part: ManufacturerPartIdentity;
  profilePath: string;
  ownerTrack: "motor" | "power" | "integration-data-review";
  reviewerTrack: "motor" | "power" | "integration-data-review";
  state:
    | "planned"
    | "researching"
    | "authored"
    | "in_independent_review"
    | "reviewed"
    | "blocked";
  authoredBy: string | null;
  authoredAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  profileContentHash: string | null;
  checks: Array<{
    checkId: string;
    status: "pass" | "fail" | "not_run";
  }>;
}
```

The ledger's exact JSON field names may follow repository camel-case convention, but the ownership and invariants are fixed:

1. Reserve the exact identity, class, owner track, and different reviewer track in the ledger before creating the profile file. The class owner must agree with the data manifest unless the manifest's shared-owner rule applies.
2. The owner authors normalized facts, evidence, ranges, and publication basis. All submission sources—manufacturer, distributor, community, sponsor, or maintainer—use this same path.
3. CI validates schema closure, identity/path agreement, source locators, publication metadata, class rules, and deterministic checks. Authored and in-review profiles remain excluded from the runtime catalog.
4. A person from `reviewerTrack`, not the owner track, verifies the cited facts and ranges. Vendor-submitted data receives the same independent review.
5. State becomes `reviewed` only when the profile hash matches the canonical file, required facts and ranges satisfy the class codec, every required check passes, and reviewer identity/time are present.
6. The runtime catalog loader includes only matching `reviewed` ledger entries. A profile file existing under `parts/` is not admission.
7. Any engineering-profile content change changes its SHA-256, resets it to `authored` or `in_independent_review`, and produces a new catalog release after review. An old pinned catalog release remains immutable.

The design library is greenfield, so it does not copy the model library's legacy exemption list. There is one strict path for every design profile from the first release.

### 5. Version profiles and releases independently

Use three explicit version layers:

- `schemaVersion` versions the common profile envelope.
- `factsSchemaVersion` versions the selected part-class facts schema.
- The published catalog release has its own semantic version and SHA-256 over the canonical manufacturer registry, canonical reviewed admission projection, and canonical profile bytes.

The stable logical profile ID derives from class and exact identity/path, not content. The admission entry pins the profile content hash. A saved design pins the catalog release version and content hash, so later fact corrections cannot change an old result silently.

Public language-neutral API signatures are:

```text
validateDesignProfile(input: unknown): ValidationIssue[]
assertValidDesignProfile(input: unknown): asserts input is DesignProfileV1
parseDesignProfileFor(codec, input): DesignProfileV1<CodecFacts>
migrateDesignProfileFor(codec, input): DesignProfileV1<CodecFacts>

validateDesignProfileAdmission(input: unknown): ValidationIssue[]
validateManufacturerRegistry(input: unknown): ValidationIssue[]
parseManufacturerRegistry(input: unknown): ManufacturerRegistryEntryV1[]
validateDesignLibrary(root): ValidationIssue[]
loadReviewedDesignLibrary(root): ReviewedDesignLibrary

canonicalDesignProfile(profile): string
designProfileContentHash(profile): `sha256:${string}`
designProfilePath(partClass, part): string
designProfileId(partClass, part): string
```

Validation returns all actionable `{ path, code, message }` issues. Parse returns a detached validated value. It never strips unknown keys or spreads unvalidated input.

Migration is explicit and lossless for supported persisted versions. A migrator reconstructs only declared fields, validates its output, rejects unknown future versions, and preserves `unknown` rather than inventing values. Envelope and class-facts migrations are separate so changing one class does not force unrelated profiles to change. Migration creates a new reviewed catalog release; it never rewrites data inside an already pinned release.

### 6. Keep sourcing and simulation outside engineering facts

The engineering pipeline ends before sourcing begins. Its inputs are the normalized electrical projection of the request, pinned design-library release, and deterministic recipe implementation. In this order it performs profile validation, admission, catalog materialization and hashing, electrical enumeration and checks, electrical estimates, deduplication, electrical Pareto pruning, stable electrical ranking, and candidate materialization. None of those steps receives a `SourcingPolicy`, `OfferSnapshot`, provider policy, provider terms, provider adapter, or `CandidateSourcingMetrics`.

That relative late-stage order describes the V1 foundation. For Designer V2
only, [`ADR-0005`](0005-designer-v2-result-and-circuit-boundary.md) supersedes it
with candidate materialization plus structural circuit/coverage/BOM validation
before dedupe, electrical Pareto, and electrical rank. The sourcing-free inputs
and frozen electrical-before-commercial boundary in this section remain
authoritative for both versions.

[`ADR-0001`](0001-deterministic-designer-and-sourcing-boundary.md)'s sourcing pass starts only after the complete pre-sourcing candidate set and electrical order have been frozen. It produces a separate commercial evaluation and commercial ordering joined by stable candidate and `ManufacturerPartIdentity` keys. A sourcing policy may mark or omit a candidate from a policy-compliant commercial view, but it does not erase or rewrite the electrical baseline. In particular, the catalog version/hash, normalized electrical request bytes, candidate IDs, selected components, circuits, electrical constraints and metrics, rejection trace, Pareto membership, and electrical rank bytes are identical when offer snapshots, provider policies, or provider terms are changed or absent. Only the separately labelled sourcing status, commercial metrics, commercial diagnostics, and commercial ordering may differ. ADR-0001's “final ranking” is therefore a commercial overlay, not a replacement for the reproducible electrical ranking.

The persisted contract is recursively closed against commercial/provider state. Forbidden fields include distributor or provider IDs and SKUs; offers, stock, price breaks, currency, lifecycle observations, and lead times; marketplace or backorder state; snapshot IDs, expiry, retrieval failures, and provider errors; provider attribution; cache or TTL controls; persistence, export, authorization, or provider-terms policy; credentials and API keys; and raw response, request, or payload fields. These fields are forbidden in profile envelopes, facts, evidence, the manufacturer registry, admission entries, migration inputs and outputs, and class-codec persisted shapes.

This rule is path-sensitive, not a text blacklist. `ProfileEvidenceRef.retrievedAt` and `ProfileEvidenceRef.contentHash` are required engineering-source provenance, while `DesignProfileAdmissionEntryV1.profileContentHash` and catalog release hashes are required integrity pins. Evidence `publicationBasis` and its closed source-license note record whether cited engineering facts may be used; they are not provider cache/export/authorization policy. The repository guard parses persisted documents and schemas, walks declared persisted paths recursively, and reports the exact offending path and boundary category. It also tests codec declarations and migration fixtures. It must not reject legitimate provenance merely because a field name contains `hash`, `retrieved`, or `publication`, and it must not rely on grep that can be bypassed by nesting or alternate casing. Runtime closed-object validation remains authoritative for arbitrary untrusted values.

Lifecycle, stock, price, and lead time remain in immutable `OfferSnapshot` and `CandidateSourcingMetrics` values from scheMAGIC Sourcing. A current offer may join a reviewed profile only through the exact `ManufacturerPartIdentity`. It cannot alter engineering facts or admission state.

Simulation remains a sibling artifact:

- `packages/design-library` owns selection and analytic facts.
- `packages/component-schema` and `packages/model-library` own simulation-model metadata, content, fidelity, evidence, benches, and admission.
- A future profile may contain a closed, optional content-addressed model-package reference after a separate schema decision. It must not embed SPICE text or infer model review from profile review.
- A profile with no simulation model remains eligible for analytic generation when its application checks permit it, with simulation coverage reported separately as `unavailable` or `behavioral` as appropriate.

### 7. Migrate staged application catalogs with explicit adapters

The current Motor and Power fixture types are not `schemaVersion: 0` and must not be accepted by the public migrator. They are internal synthetic inputs. Move them through explicit, temporary, type-specific adapters tested beside the new package:

| Staged source | Target decision |
| --- | --- |
| `id` or `profileId` | Do not persist it; derive the stable profile ID/path from class and exact identity. |
| `state` or `profileKind` | Preserve as synthetic fixture provenance; never map it to `reviewed`. |
| `boardAreaM2` or `areaM2` | Convert to `commonFacts.boardArea` in square metres with its synthetic evidence. |
| Motor `packageName` | Convert to the common package-name fact. |
| Missing Power package name or any missing height | Emit an explicit unknown fact; do not supply a default. |
| Unit-suffixed numeric fields | Convert to canonical `Quantity` inside the exact class schema. |
| Motor/Power MOSFET name overlaps | Map explicitly into the shared codec and preserve absent pulsed-current or switching facts as unknown. |
| Capacitor `role` | Treat as recipe usage metadata, not physical class evidence. Require an explicit MLCC/bulk class decision; do not infer it from `input`, `output`, or `bootstrap`. |
| Existing synthetic `EvidenceRef[]` | Preserve for fixture tests, but fail production admission because it is not primary reviewed part evidence. |

Recipes may consume adapter output while reviewed profiles are being authored. After each class reaches parity, both applications switch to the class codec and the duplicate local profile shape is removed in a coordinated change. Do not maintain two production sources of truth.

## Neutrality invariants

- Every manufacturer and submitter uses the same schemas, review states, required checks, and runtime loader.
- Manufacturer identity is permitted only for exact joins, display/filtering, coverage reporting, and the final stable tie-break. It is not an admission exception, feasibility input, Pareto objective, score, or hidden weight.
- Manufacturer display aliases belong to the manufacturer registry, not the engineering profile and not the stable identity.
- Sponsorship or partnership cannot buy admission, exclusion of competitors, ranking weight, a faster review state, or reduced evidence requirements.
- Default generation loads every reviewed profile in the pinned library. Any manufacturer allow/prefer/exclude policy is explicit user input outside the profile.
- Missing or lower-confidence facts never improve feasibility, admission confidence, Pareto membership, or rank.
- Rejections remain machine-readable and identify missing evidence, invalid ranges, failed checks, or schema errors rather than promotional reasons.

## Acceptance tests for implementation

The package is not complete until automated tests prove all of the following:

1. A valid fixture for every registered part-class codec parses and round-trips to byte-stable canonical JSON.
2. Unknown keys are rejected recursively at the profile root, identity, common facts, class facts, fact wrapper, quantity, range, evidence, admission entry, and check result.
3. The path-sensitive boundary guard allows evidence `retrievedAt`/`contentHash`, admission `profileContentHash`, catalog hashes, `publicationBasis`, and the closed source-license note. It rejects provider/distributor IDs and SKUs, currency, marketplace/backorder state, snapshot IDs/expiry/errors, provider attribution, cache/TTL, persistence/export/authorization/provider-terms policy, credentials, and raw payload fields at the root and at arbitrary depths in profiles, admissions, registry entries, migration inputs/outputs, and codec-declared persisted shapes. The same injections fail runtime validation or migration rather than being stripped.
4. A manufacturer datasheet and product page on an exact registered `primaryEvidenceHosts` hostname pass. The same evidence on DigiKey, Mouser, LCSC, a generic provider or mirror, another manufacturer's official host, an unregistered subdomain, or an attacker hostname such as `<official-host>.example.invalid` fails at the evidence URL path, even when the MPN and content hash otherwise agree.
5. The decoded MPN path token, manufacturer directory, part-class directory, profile identity, admission identity, and admission path agree exactly. Duplicate exact identities and case-folded path collisions fail; the same MPN under two different manufacturers passes.
6. A known value without evidence, an unknown value with a non-null value, an invalid or unit-mismatched range, and a required reviewed fact marked estimated all fail with precise paths.
7. An unknown part class or facts version fails closed. Reordering codec registration or filesystem enumeration does not change catalog bytes or hash.
8. An entry cannot become reviewed when owner and reviewer tracks match, reviewer metadata is missing, a required check is not `pass`, profile SHA-256 disagrees, or class ownership disagrees with the manifest.
9. The runtime loader returns only reviewed, hash-matching profiles and orders them by stable profile ID. Authored, in-review, blocked, orphaned, and unregistered files are not eligible and produce diagnostics.
10. Editing any engineering byte or manufacturer-registry byte changes the profile or catalog hash as applicable and requires renewed review; loading a prior pinned catalog release remains byte-stable.
11. Repeating one generation with no offers, with two byte-distinct offer snapshots, and with changed provider policy or terms produces byte-identical pre-sourcing request, catalog, candidate, electrical rejection/trace, Pareto-membership, and electrical-order projections. The test requires identical candidate IDs, components, circuits, constraints, metrics, and electrical ranks; only the separately serialized commercial evaluation/order may change.
12. Anonymizing or permuting manufacturer display aliases leaves admission, electrical feasibility, Pareto membership, score, and ordering unchanged. Adding a manufacturer can affect results only through reviewed facts or explicit user filters.
13. A design profile can validate and be selected without any model package. Model admission alone cannot make a design profile reviewed, and profile admission alone cannot claim simulation coverage.
14. Explicit staged adapters preserve every existing synthetic numeric value, null, identity, and evidence marker without hidden defaults. Ambiguous capacitor class mapping fails rather than guessing. Adapter output remains non-reviewed.

## Consequences

### Benefits

- Motor and Power share exact identities, common evidence semantics, review workflow, and release pinning without forcing unlike IC facts into one abstraction.
- The catalog can accept any manufacturer under the same public, inspectable rules while remaining deterministic and useful offline.
- Volatile commercial observations cannot contaminate reproducible electrical results.
- Shared parts are authored and reviewed once, then consumed by both applications.
- Greenfield strict admission avoids carrying the simulator library's historical exceptions into the new catalog.

### Costs

- Each part class needs a deliberately reviewed facts codec and semantic checks before real profiles can be admitted.
- Existing synthetic catalogs need explicit adapters and a coordinated cutover rather than a broad mechanical rename.
- Exact evidence and valid-range capture is more work than copying headline datasheet values, but it is required for trustworthy constraint decisions.
- Profile corrections require a new catalog release and independent review.

## Rejected alternatives

- **One open `facts: Record<string, unknown>` object:** defeats recursive closure, typed application consumption, migration, and evidence requirements.
- **Freeze all twelve fact shapes into one universal union now:** turns current fixture naming accidents and missing data into a public contract. The class-codec registry provides typed closure without that commitment.
- **Use the Motor or Power fixture type as the common schema:** privileges one application, silently drops facts from the other, and promotes synthetic test assumptions into production.
- **Put stock, price, lifecycle, or lead time in profiles:** makes pinned electrical results stale and mixes provider terms with public engineering facts.
- **Reuse simulation component metadata as the design profile:** model fidelity/pin mapping and design selection facts have different review claims and availability. Coupling them would exclude analytically useful parts without redistributable models.
- **Treat every file under `parts/` as admitted:** bypasses single-writer assignment, independent review, deterministic checks, and reviewed content hashes.
- **Add a model-library-style legacy exemption:** the design library has no legacy production inventory and therefore has no reason to weaken its first contract.
- **Normalize or fuzzy-match MPNs:** can merge different orderable parts. Aliases may assist search but never replace exact identity.

## Follow-up decisions

Separate versioned decisions are required before adding an arbitrary extension mechanism, embedding or redistributing source artifacts, linking simulation models from profiles, changing exact-part identity semantics, or admitting a new part class outside the V1 manifest.
