# ADR-0005: Designer v2 result and circuit boundary

- Status: Accepted; implementation in progress
- Date: 2026-08-23
- Scope: `@opencircuit/design-schema`, `@opencircuit/design-engine`, Motor and Power recipe adapters, `@opencircuit/design-export`, and scheMAGIC Designer
- Coordinates: [ADR-0001](0001-deterministic-designer-and-sourcing-boundary.md), [ADR-0002](0002-circuit-document-v2-design-blocks-and-scenarios.md), [ADR-0003](0003-neutral-design-library-profile-and-admission-contract.md), and [ADR-0004](0004-sourcing-offer-v2-unknown-provider-semantics.md)

## Context

ADR-0002 deliberately kept the current design-schema candidate on
`CircuitDocument` v1 until a separate persisted-result decision existed.
ADR-0004 then reserved `DesignCandidateV2` and `DesignResultV2` for an
electrical-only result with commercial sourcing stored in a separately hashed
overlay, but its illustrative candidate still carried a v1 circuit.

Implementing those two contracts independently would immediately require a
third Designer result version merely to attach the already-defined v2 circuit.
It would also leave the current commercial objectives inside an electrical-only
request and permit sourcing ranking criteria in the pre-sourcing library. Both
would undermine the electrical/commercial boundary.

The coordinated breaking boundary has not shipped. The smallest coherent
release is therefore one explicit Designer v2 boundary that adopts
`CircuitDocumentV2`, separates engineering and commercial objectives, and
preserves every current v1 API under its existing or explicit v1 name.

## Decision

### 1. Preserve v1 and make Designer v2 use CircuitDocument v2

The existing `DesignRequest`, `DesignCandidate`, `DesignResult`,
`generateDesign`, and application generator functions remain v1. Their source
types and serialized bytes do not widen through an alias.

Design-schema adds explicit `DesignRequestV1`, `DesignCandidateV1`, and
`DesignResultV1` aliases. The v2 candidate defined by ADR-0004 is refined at
this coordinated boundary to carry `CircuitDocumentV2`:

```ts
export type CandidateIdV2 = `candidate:v2:${Sha256ContentHash}`;

export interface CandidateMetricV2 extends Omit<CandidateMetric, "state"> {
  state: Extract<EvidenceState, "calculated" | "estimated" | "unknown">;
}

export interface CandidateMetricsV2 extends Omit<CandidateMetrics, "values"> {
  values: CandidateMetricV2[];
}

export type CircuitInstanceClassificationV2 =
  | {
      circuitId: string;
      componentId: string;
      kind: "physical";
      selectedComponentId: string;
      representedQuantityPerAssembly: number;
      reason?: never;
    }
  | {
      circuitId: string;
      componentId: string;
      kind: "behavioral";
      selectedComponentId: string;
      representedQuantityPerAssembly?: never;
      reason: string;
    }
  | {
      circuitId: string;
      componentId: string;
      kind: "non_bom";
      selectedComponentId?: never;
      representedQuantityPerAssembly?: never;
      reason: string;
    };

export interface CircuitBomNonRepresentationV2 {
  circuitId: string;
  selectedComponentId: string;
  reason: string;
}

export type DesignDiagnosticCodeV2 = "design.no_supported_recipe";

// Exact derived projection for candidate.metrics:
// warningCount = count(candidate.constraints.status === "warning")
// estimateCount = count(values.state === "estimated")
// unknownCount = count(candidate.constraints.status === "unknown")
//   + count(values.state === "unknown")

export interface DesignCandidateV2 {
  schemaVersion: 2;
  id: CandidateIdV2;
  requestHash: Sha256ContentHash;
  recipeId: string;
  libraryVersion: string;
  components: SelectedComponent[];
  derivedValues: DerivedValue[];
  constraints: ConstraintResult[];
  metrics: CandidateMetricsV2;
  simulationCoverage: SimulationCoverageV2[];
  circuit: CircuitDocumentV2;
  circuitInstanceClassifications: CircuitInstanceClassificationV2[];
  circuitBomNonRepresentations: CircuitBomNonRepresentationV2[];
  warnings: string[];
}

export interface RejectedCandidateV2 {
  recipeId: string;
  componentProfileIds: string[];
  constraints: ConstraintResult[];
}

export interface DesignResultV2 {
  format: "schemagic-design-result";
  schemaVersion: 2;
  request: ElectricalDesignRequestV2;
  requestHash: Sha256ContentHash;
  libraryVersion: string;
  libraryContentHash: Sha256ContentHash;
  candidates: DesignCandidateV2[];
  rejectedCandidates: RejectedCandidateV2[];
  diagnostics: DesignDiagnosticCodeV2[];
  contentHash: Sha256ContentHash;
}

export interface SimulationCoverageV2 {
  scenarioId: string;
  modelTier: "behavioral" | "unavailable";
  limitations: string[];
}

export function canonicalDesignResultV2Payload(
  result: Omit<DesignResultV2, "contentHash"> | DesignResultV2,
): string;

export function canonicalDesignResultV2ContentHash(
  result: Omit<DesignResultV2, "contentHash"> | DesignResultV2,
): Sha256ContentHash;

export function parseDesignResultV2(input: unknown): DesignResultV2;
export function serializeDesignResultV2(
  result: Readonly<DesignResultV2>,
): string;
```

This ADR controls the exact `DesignCandidateV2` and `DesignResultV2` shapes and
supersedes ADR-0004's earlier illustrative candidate/result field types where
they differ. ADR-0004 is updated in the same contract freeze to import these
exact types. This satisfies ADR-0002's required separate design-schema decision.
The SHA-256 result identity and `CommercialOverlayV1` retain ADR-0004's
electrical/commercial separation.

No persisted candidate accepts `AnyCircuitDocument`. V1 candidates contain
exactly a v1 circuit; V2 candidates contain exactly a v2 circuit. A parser
dispatches on the enclosing result's `schemaVersion` before parsing its
candidate circuits.

`circuitInstanceClassifications` and `circuitBomNonRepresentations` form one
typed, exhaustive circuit-to-BOM boundary. The classification array is sorted
by `(circuitId, componentId)` and contains exactly one record for every circuit
component instance in every graph, including MPN-free primitives, sources,
grounds, and design blocks. It contains no
record for a nonexistent instance. Thus no instance is silently outside the
boundary.

Every `physical` record exact-joins one selected component, carries a positive
safe-integer represented quantity, and points to a circuit instance whose `mpn`
exactly equals that selected component's exact MPN. For each
`(circuitId, selectedComponentId)` with physical records, their represented
quantities sum exactly to the selected component's `quantityPerAssembly`.
Every `behavioral` record exact-joins one selected component, carries a non-empty
control-free reason, and points to an instance that omits `mpn`; it never
presents an internal switch, source, primitive, or design block as an orderable
part. Every `non_bom` record has no selected-component or represented-quantity
field, carries a non-empty control-free reason, and points to an instance that
omits `mpn`.

For every graph/selected-component pair exactly one converse state holds:
one-or-more `physical` records with the exact quantity sum; one-or-more
`behavioral` records; or exactly one sorted
`CircuitBomNonRepresentationV2` record with a non-empty control-free reason.
Physical and behavioral records cannot mix for that pair, and a non-
representation record cannot coexist with either. The non-representation array
is sorted and unique by `(circuitId, selectedComponentId)`. Conversely, every
circuit component carrying `mpn` is classified `physical`, while every
MPN-free component is explicitly classified `behavioral` or `non_bom`. Labels,
annotations, component type, and MPN text alone are never classification or join
fields. These invariants make both directions complete without adding
commercial data to the circuit schema.

V2 does not persist the unprovable `reviewed` or `user_imported` coverage tiers.
Those require a later closed, content-addressed provenance contract that binds
the exact model, bench, reviewer, and engine result. A successfully generated
netlist alone proves neither tier. Until then, executable V2 coverage is
`behavioral`; absent or incomplete coverage is `unavailable`.
For the same reason, V2 metrics cannot use V1's extra `simulated` state. A
metric remains calculated, estimated, or unknown until a later
content-addressed simulation-result provenance contract can bind its exact
scenario, engine, model assets, and output bytes.
`CandidateMetricV2.value` is null if and only if its state is `unknown`;
calculated and estimated metrics carry a finite canonical quantity.
The three candidate metric counts are mandatory derived projections exactly as
shown in the type comment. Both engine and parser recompute them from the same
candidate constraints/values; changing any one count without its source data
is invalid.

### 2. Make the v2 request explicitly electrical

The v2 electrical request excludes sourcing and commercial-only objectives:

```ts
export type ElectricalDesignObjectiveV2 =
  | "area"
  | "balanced"
  | "efficiency"
  | "temperature";

type ElectricalRequestV2<Request extends DesignRequestV1> =
  Request extends DesignRequestV1
    ? Omit<Request, "schemaVersion" | "sourcing" | "objective"> & {
        schemaVersion: 2;
        objective: ElectricalDesignObjectiveV2;
      }
    : never;

export type ElectricalDesignRequestV2 =
  ElectricalRequestV2<DesignRequestV1>;

export type BrushedDcMotorDesignRequestV2 =
  Extract<ElectricalDesignRequestV2, { application: "motor.brushed-dc" }>;
export type BuckDesignRequestV2 =
  Extract<ElectricalDesignRequestV2, { application: "power.buck" }>;
```

Commercial intent is expressed only by the `policy`, `paretoCriteria`, and
`rankingCriteria` persisted in `CommercialOverlayV1`. The existing v1 objective
values `availability`, `bom_cost`, and `lead_time` remain valid only in v1.

An explicit v1-to-v2 request migration requires a caller-supplied engineering
objective when the v1 objective is commercial. It never silently chooses
`balanced`. The helper returns both the electrical request and a suggested
commercial criterion, which the caller may accept when creating an overlay:

```ts
export type DesignRequestV2Migration =
  | {
      status: "migrated";
      request: ElectricalDesignRequestV2;
      suggestedCommercialRankingCriteria: CommercialRankingCriterionV1[];
    }
  | {
      status: "engineering_objective_required";
      sourceObjective: "availability" | "bom_cost" | "lead_time";
      suggestedCommercialRankingCriteria: CommercialRankingCriterionV1[];
    }
  | {
      status: "engineering_objective_conflict";
      sourceObjective: ElectricalDesignObjectiveV2;
      suppliedObjective: ElectricalDesignObjectiveV2;
    };

export type DesignRequestV2Migrated = Extract<
  DesignRequestV2Migration,
  { status: "migrated" }
>;
export type DesignRequestV2MigrationBlock = Exclude<
  DesignRequestV2Migration,
  DesignRequestV2Migrated
>;

export function migrateDesignRequestV1ToV2(
  request: DesignRequestV1,
  targetLibraryVersion: string,
  engineeringObjective?: ElectricalDesignObjectiveV2,
): DesignRequestV2Migration;
```

The suggestions are exact: availability maps to buildable quantity maximize,
BOM cost to extended BOM cost minimize, and lead time to maximum lead time days
minimize. An electrical source objective has an exactly empty suggestion array.
Suggestions are data, not an implicit policy or evaluation.
For an electrical V1 objective, an absent or equal supplied objective migrates
that objective exactly. A different supplied objective returns the closed
`engineering_objective_conflict` branch with both values; it never throws an
`invalid_context` error and never silently overrides the persisted request.
After strict V1 request parsing, objective-required/conflict selection precedes
target-pin validation or context access; only the migrated branch consumes a
target library version.
`targetLibraryVersion` is required, non-empty, and replaces the V1 pin; it is
never copied from the legacy request by assumption. For every generated result,
`request.libraryVersion`, `result.libraryVersion`, every candidate
`libraryVersion`, and `context.manifest.version` are exactly equal.

### 3. Keep the v2 engineering pipeline sourcing-free

The engineering context binds three distinct inputs: the reviewed component
catalog release from ADR-0003, a closed ranking policy, and the exact recipe
implementations. Ranking policy is not part-profile data, and recipes are not
silently implied by a catalog version.

```ts
export interface ElectricalMetricDeclarationV2 {
  id: string;
  unit: SIUnit;
}

export interface ElectricalRankingCriterionV2 {
  source: "metric";
  metricId: string;
  direction: "maximize" | "minimize";
}

export interface ElectricalRankingPolicyV2 {
  format: "schemagic-electrical-ranking-policy";
  schemaVersion: 2;
  version: string;
  application: DesignApplication;
  paretoCriteria: readonly ElectricalRankingCriterionV2[];
  rankingProfiles: Record<
    ElectricalDesignObjectiveV2,
    ElectricalRankingCriterionV2[]
  >;
  contentHash: Sha256ContentHash;
}

export interface DesignRecipeRefV2 {
  id: string;
  version: string;
  contentHash: Sha256ContentHash;
  applications: DesignApplication[];
  metricDeclarations: ElectricalMetricDeclarationV2[];
}

export interface CompilerImplementationRefV2 {
  id: "@opencircuit/design-engine";
  version: string;
  contentHash: Sha256ContentHash;
}

export function getInstalledCompilerImplementationRefV2():
  Readonly<CompilerImplementationRefV2>;

export interface ReviewedProfileCatalogV2 {
  format: "schemagic-reviewed-profile-catalog";
  schemaVersion: 2;
  version: string;
  sourceRelease: { version: string; contentHash: Sha256ContentHash };
  profiles: DesignProfileEnvelope[];
  contentHash: Sha256ContentHash;
}

export function getReviewedProfilesForV2<
  ClassId extends PartClassId,
  Codec extends VersionedDesignProfileCodec<ClassId>,
>(
  catalog: Readonly<ReviewedProfileCatalogV2>,
  codec: Readonly<Codec>,
): readonly DesignProfileForCodec<Codec>[];

export class InstalledRecipeRegistryCapabilityV2 {
  #engineBrand: void;
  readonly compiler: Readonly<CompilerImplementationRefV2>;
  readonly manifestContentHash: Sha256ContentHash;
  private constructor();
}

export interface ElectricalDesignContextManifestV2 {
  format: "schemagic-electrical-design-context";
  schemaVersion: 2;
  version: string;
  application: DesignApplication;
  compiler: CompilerImplementationRefV2;
  catalog: {
    version: string;
    contentHash: Sha256ContentHash;
    sourceReleaseContentHash: Sha256ContentHash;
  };
  rankingPolicy: { version: string; contentHash: Sha256ContentHash };
  recipes: DesignRecipeRefV2[];
  contentHash: Sha256ContentHash;
}

export function resolveInstalledRecipeRegistryV2(
  manifest: Readonly<ElectricalDesignContextManifestV2>,
): InstalledRecipeRegistryCapabilityV2 | undefined;

export interface GenerateElectricalContextV2 {
  manifest: Readonly<ElectricalDesignContextManifestV2>;
  catalogDocuments: Readonly<DesignLibraryDocuments>;
  rankingPolicy: Readonly<ElectricalRankingPolicyV2>;
  installedRecipeRegistry: InstalledRecipeRegistryCapabilityV2;
}

export type DesignValidationIssueCode =
  | "invalid_type"
  | "unknown_key"
  | "invalid_value"
  | "invalid_hash"
  | "invalid_reference"
  | "invalid_order"
  | "resource_limit"
  | "context_mismatch"
  | "recipe_contract"
  | "coverage_contract"
  | "circuit_bom_binding";

export interface DesignValidationIssue {
  code: DesignValidationIssueCode;
  path: string;
  message: string;
}

export const DESIGN_VALIDATION_ISSUE_MESSAGE_PREFIX = {
  invalid_type: "Invalid type",
  unknown_key: "Unknown key",
  invalid_value: "Invalid value",
  invalid_hash: "Invalid content hash",
  invalid_reference: "Invalid reference",
  invalid_order: "Invalid canonical order",
  resource_limit: "Resource limit exceeded",
  context_mismatch: "Engineering context mismatch",
  recipe_contract: "Recipe contract violation",
  coverage_contract: "Coverage contract violation",
  circuit_bom_binding: "Circuit/BOM binding violation",
} as const satisfies Record<DesignValidationIssueCode, string>;

export function renderDesignValidationIssueMessage(
  issue: Readonly<Pick<DesignValidationIssue, "code" | "path">>,
): string;

export type RecipeHookStageV2 =
  | "supports" | "enumerate" | "solve" | "match"
  | "check" | "estimate" | "materialize";

export type DesignEngineResourceStageV2 =
  | "enumerate"
  | "solve"
  | "match"
  | "check"
  | "dedupe"
  | "pareto"
  | "rank"
  | "result"
  | "report";

export type DesignGenerationErrorDetailV2 =
  | { code: "invalid_request"; stage: "request"; recipeId?: never }
  | { code: "invalid_context"; stage: "context"; recipeId?: never }
  | {
      code: "recipe_hook_threw";
      stage: RecipeHookStageV2;
      recipeId: string;
    }
  | {
      code: "recipe_contract_invalid";
      stage: RecipeHookStageV2 | "coverage";
      recipeId: string;
    }
  | {
      code: "resource_limit";
      stage: DesignEngineResourceStageV2;
      recipeId?: never;
    };

export type DesignGenerationErrorCodeV2 =
  DesignGenerationErrorDetailV2["code"];
export type DesignGenerationErrorStageV2 =
  DesignGenerationErrorDetailV2["stage"];

export class DesignGenerationErrorV2 extends Error {
  readonly detail: DesignGenerationErrorDetailV2;
  readonly issues: readonly DesignValidationIssue[];
}

export type DesignParseArtifactV2 =
  | "electrical_request"
  | "electrical_ranking_policy"
  | "reviewed_profile_catalog"
  | "electrical_context_manifest"
  | "candidate_identity"
  | "design_result"
  | "persisted_design_result"
  | "execution_report";

export type DesignParseErrorDetailV2 =
  | {
      code: "invalid_document";
      stage: "parse";
      artifact: DesignParseArtifactV2;
    }
  | {
      code: "resource_limit";
      stage: "parse";
      artifact: DesignParseArtifactV2;
    };

export class DesignParseErrorV2 extends Error {
  readonly detail: DesignParseErrorDetailV2;
  readonly issues: readonly DesignValidationIssue[];
}

export function generateElectricalDesignV2(
  request: ElectricalDesignRequestV2,
  context: GenerateElectricalContextV2,
): DesignGenerationV2;

export function canonicalElectricalRankingPolicyV2Payload(
  policy: Omit<ElectricalRankingPolicyV2, "contentHash">
    | ElectricalRankingPolicyV2,
): string;

export function calculateElectricalRankingPolicyV2ContentHash(
  policy: Omit<ElectricalRankingPolicyV2, "contentHash">
    | ElectricalRankingPolicyV2,
): Sha256ContentHash;

export function parseElectricalRankingPolicyV2(
  input: unknown,
): ElectricalRankingPolicyV2;

export function canonicalReviewedProfileCatalogV2Payload(
  catalog: Omit<ReviewedProfileCatalogV2, "contentHash">
    | ReviewedProfileCatalogV2,
): string;

export function calculateReviewedProfileCatalogV2ContentHash(
  catalog: Omit<ReviewedProfileCatalogV2, "contentHash">
    | ReviewedProfileCatalogV2,
): Sha256ContentHash;

export function buildReviewedProfileCatalogV2(
  documents: Readonly<DesignLibraryDocuments>,
): ReviewedProfileCatalogV2;

export function parseReviewedProfileCatalogV2(
  input: unknown,
): ReviewedProfileCatalogV2;

export function canonicalElectricalDesignContextManifestV2Payload(
  manifest: Omit<ElectricalDesignContextManifestV2, "contentHash">
    | ElectricalDesignContextManifestV2,
): string;

export function calculateElectricalDesignContextManifestV2ContentHash(
  manifest: Omit<ElectricalDesignContextManifestV2, "contentHash">
    | ElectricalDesignContextManifestV2,
): Sha256ContentHash;

export function parseElectricalDesignContextManifestV2(
  input: unknown,
): ElectricalDesignContextManifestV2;

export function designRequestHashV2(
  request: Readonly<ElectricalDesignRequestV2>,
): Sha256ContentHash;

export function projectElectricalDesignRequestIdentityV2(
  request: Readonly<ElectricalDesignRequestV2>,
): JsonObject;

export function canonicalElectricalDesignRequestIdentityV2Payload(
  request: Readonly<ElectricalDesignRequestV2>,
): string;

export function canonicalElectricalDesignRequestV2Payload(
  request: Readonly<ElectricalDesignRequestV2>,
): string;

export function parseElectricalDesignRequestV2(
  input: unknown,
): ElectricalDesignRequestV2;
```

The error detail is a correlated closed union, not three independently
selectable fields. Strict request parse or normalization failure is only
`invalid_request/request` without a recipe ID and occurs before context
validation. Context parsing/hash/installed-capability/manifest mismatch is only
`invalid_context/context` without a recipe ID. A recipe callback throw is only
`recipe_hook_threw` at that exact recipe hook. A malformed, undeclared, unsafe,
or accessor-backed hook result is only `recipe_contract_invalid` at its exact
recipe hook (or `coverage` for the recipe's persisted coverage projection).
An individual hook excess is a recipe-contract failure at that hook. An excess
in an otherwise valid engine-owned aggregate is only
`resource_limit/<enumerate|solve|match|check|dedupe|pareto|rank|result|report>` with no
recipe ID; the exact stage is the first engine-owned boundary that would exceed
its frozen ceiling. Result and report assembly occur in that order, and either
failure aborts the whole call with neither artifact returned.
Trusted scenario-asset resolution is not part of generation and therefore
cannot produce a generation error. The implementation renders a stable generic
message and sanitized issues from `detail`; arbitrary callback, registry, or
provider text never enters the error.

`DesignValidationIssue` is the single public issue type used by the V2 parsers,
context validators, generation errors, and exports. `path` is an RFC 6901 JSON
Pointer produced by trusted validation code, including `~0`/`~1` escaping; the
root is the empty string.
`renderDesignValidationIssueMessage` selects the exact phrase above for the
closed code and appends ` at <path>` (or ` at /` for the root). Parsers
recompute `message` and reject tampering. There is no caller-supplied detail,
provider text, thrown value, or localized text in a persisted or thrown issue.
Issue arrays are sorted and unique by the direct tuple `[path, code, message]`.
Every V2 parse, canonicalize, serialize, or import boundary throws
`DesignParseErrorV2`. An over-limit
raw object, transport string, nested circuit, or canonical payload is exactly
`resource_limit/parse/<artifact>`; other structural failures are exactly
`invalid_document/parse/<artifact>`. A parse error is never represented as a
recipe or engine-stage error, and parsing returns no partial value.
Where this ADR says `control-free`, the string is non-empty, is well-formed
Unicode with no unpaired UTF-16 surrogate, contains no U+0000-U+001F or
U+007F-U+009F, and obeys `DESIGN_V2_MAX_STRING_UTF8_BYTES`. Safe-token and
stricter circuit-schema rules continue to apply where specified.

The manifest hash is SHA-256 over its canonical payload excluding
`contentHash`. The engine first passes `catalogDocuments` through ADR-0006's
additive `loadReviewedDesignLibraryEnvelope` (which retains ADR-0003's exact admission
and release rules), recomputes the source release hash, then constructs a
detached runtime catalog containing only code-unit-sorted reviewed profiles.
The runtime catalog `contentHash` is SHA-256 over its canonical payload
excluding `contentHash`; its `sourceRelease` exactly binds the verified source
documents. Validation requires both runtime and source-release hashes to equal
the manifest catalog ref, and runtime catalog `version` exactly equals
`manifest.catalog.version`. Mutating any profile under a claimed catalog hash is
therefore rejected. Loader diagnostics and non-reviewed documents never enter
the runtime projection or recipe hooks.

The runtime `profiles` array contains only the closed common profile envelope;
it is deliberately not a twelve-class fact union or an open fact bag. Under
ADR-0006, that envelope may carry facts schema `1.0.0` or `2.0.0` without
changing this catalog's schema version or hash algorithm. Code-owned recipes
obtain facts only through `getReviewedProfilesForV2` and the exact versioned
design-library codec. That accessor rechecks the envelope's `partClass` and
`factsSchemaVersion`, parses each matching profile through the unchanged
`parseDesignProfileFor` for facts V1 or additive `parseDesignProfileForV2` for
facts V2, returns detached frozen
`DesignProfileForCodec<Codec>[]`, and code-unit sorts it by derived `profileId`.
A recipe cannot cast the root envelope to class facts or inspect a different
class or facts version through a universal union. Motor and Power compile-time
gates consume all of their mixed required classes through this accessor without
`as` casts.

Validation also recomputes the ranking-policy hash, ordered recipe refs, and
manifest hash before any recipe hook runs. The result's `libraryVersion` is the manifest version and its
`libraryContentHash` is the manifest content hash. Each candidate carries that
same manifest version.

Each engineering context is single-application. Request, manifest, ranking
policy, and every manifest recipe application declaration must include the same
exact application; recipes that do not declare it are invalid in that context.
A Motor policy cannot be reused for a Power request merely because metric IDs
or units happen to overlap.

The ranking-policy payload canonicalizes the closed policy using code-unit key
order and the shared finite 12-significant-digit projection, excluding only
top-level `contentHash`. Pareto criteria use their required set order; each
ranking profile preserves priority order. The content hash is browser-safe
SHA-256 over the payload's exact UTF-8 bytes and must agree with a standard SHA
implementation.

Every ranking criterion resolves to exactly one declared metric ID and its
canonical SI unit across every recipe that can participate in that application.
Unknown metric IDs, conflicting units, duplicate criteria, commercial metric
namespaces, `source: "sourcing"`, and extra manifest/policy keys are rejected.
Metric IDs match `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$`. The reserved
non-electrical prefixes are exactly `sourcing.`, `commercial.`, `offer.`,
`provider.`, and `distributor.`; declaration and criterion validators reject
them before recipe execution.
Every `rankingProfiles` key is required. Its array may be empty, which means
candidate-ID-only ordering for that objective; an absent objective is invalid.
Every participating recipe emits exactly one metric for every declaration,
with the exact ID and unit. Its value may be null only with `state: "unknown"`;
unknown is never encoded as zero or infinity. Extra, missing, duplicate, or
unit-mismatched emitted metrics abort with `recipe_contract_invalid` at
`estimate` before dedupe.
Compiler and recipe execution trust is engine-owned, not self-attested by the
caller. `getInstalledCompilerImplementationRefV2` returns a detached frozen
projection of the compiler identity embedded by the audited design-engine
release build. Context validation compares `manifest.compiler` byte-for-byte
with that embedded identity; it never accepts a compiler ref supplied by a
caller as proof of the executing compiler.

The design-engine release also contains a build-generated, static installed
recipe table keyed by the complete sorted manifest recipe refs. There is no
public runtime register, mint, constructor, callback-injection, or
`RecipeImplementationRegistryV2` input. `resolveInstalledRecipeRegistryV2`
strictly parses and hashes the manifest, exact-matches its compiler and complete
recipe-ref set against that table, and returns the corresponding opaque
`InstalledRecipeRegistryCapabilityV2`; a valid but uninstalled exact set returns
`undefined`, while an invalid/over-limit manifest throws its normal typed parse
error. The class has a private
runtime brand/internal slot and the engine additionally verifies capability
membership in its private `WeakMap`; copying its public fields, changing its
prototype, casting an object, or constructing a lookalike cannot pass. The
runtime constructor requires an engine-module-private token and throws when
called directly from JavaScript.
The capability is bound to the exact manifest content hash and compiler identity.

Only the engine can dereference a valid capability to recipe functions. Its
internal entry requires a one-to-one implementation for every manifest ref and
no extra implementation, and each installed recipe's declared ref,
applications, and metric declarations must exactly equal the build-generated
entry and manifest before hooks. Compiler and recipe hashes remain
release-build identities over audited source/build inputs; JavaScript closures
are not claimed to self-hash. Loading or registering untrusted runtime recipe
code is outside V2. Tests may use a non-published design-engine test entrypoint
with a distinct capability type and generation function; that type is not
assignable to or accepted by `generateElectricalDesignV2` and is absent from
production package exports.
`GenerateElectricalContextV2` is runtime-closed: legacy `recipeRegistry`,
`recipes`, resolver, callback, or compiler-function keys are rejected rather
than ignored, even when their declared refs/hashes match official values.

There is no offer snapshot, sourcing policy, evaluator, evaluated-at timestamp,
sourcing ranking source, trusted simulation registry, or executable model byte
in this context. Simulation assets belong only to the separate execution
context. Commercial evaluation is a second operation over the completed,
content-hashed `DesignResultV2`.
Provider inputs therefore cannot alter recipe enumeration, electrical
constraints, candidate identity, circuit materialization, electrical Pareto,
electrical rank, or the electrical result hash.

Design-schema owns `designRequestHashV2`, which is SHA-256 over
`canonicalElectricalDesignRequestIdentityV2Payload`. The identity projection is
the complete closed electrical request with only every recursively occurring
`Quantity.displayUnit` omitted; each quantity keeps its canonical finite `value`
and exact SI `unit`. No label, UI ordering, locale, formatting choice, or other
presentation field is added to that projection. The v2 recipe environment still
carries the complete parsed `ElectricalDesignRequestV2`, and persisted result
bytes retain its display units. All recipe hook inputs retain the v1 detached,
recursively frozen boundary. Returned materialization is strictly parsed as v2
before it enters a candidate.

The request parser validates the raw closed shape before numeric projection,
then returns one detached normalized object. The set-like request arrays
`allowedTopologyFamilies`, `allowedPackages`, Motor `operatingModes`, and every
assumption's `affects` are code-unit sorted and duplicate-free. Assumptions are
keyed/sorted by unique `id`; their order is not semantic. All other requirement
arrays, if a future request version adds them, require an explicit contract and
are not guessed. `canonicalElectricalDesignRequestV2Payload` serializes exactly
that complete parsed projection for persistence. The identity-payload function
first applies the presentation-free projection and then the same canonical
serializer; `designRequestHashV2` is browser-safe SHA-256 over its UTF-8 bytes.
Equivalent set permutations and display-unit-only changes hash identically;
duplicate set members and duplicate assumption IDs reject rather than disappear
silently.

Every hook result is closed-parsed, projected through the shared
12-significant-digit finite-number canonicalizer, detached, and recursively
frozen before it is supplied to a later hook, identity function, constraint
comparison, dedupe, Pareto, or rank operation. A raw value that is invalid
before normalization is rejected at its original hook boundary. No
sub-canonical difference can affect an intermediate decision and disappear
only during final serialization.

A recipe throw, accessor side effect, or malformed/unsafe/undeclared output is
not an ordinary candidate rejection. It aborts the whole call with a sanitized
`DesignGenerationErrorV2`; arbitrary thrown text is not propagated. This
applies to `supports`, `enumerate`, `solve`, `match`, `check`, `estimate`,
`materialize`, and structural coverage validation. Only an explicit `StageOutcomeV2:
rejected` or a valid hard/unknown constraint decision becomes an inspectable
candidate rejection. No invalid recipe can silently erase or dominate another
candidate.

Candidate identity is owned and exported by design-engine:

```ts
export type CandidateIdentitySelectedComponentV2 =
  Omit<SelectedComponent, "value"> & {
    value?: Omit<Quantity, "displayUnit">;
  };

export type CandidateIdentityDerivedValueV2 =
  Omit<DerivedValue, "value"> & {
    value: Omit<Quantity, "displayUnit">;
  };

export interface CandidateIdentityInputV2 {
  recipe: Pick<DesignRecipeRefV2, "id" | "version" | "contentHash">;
  context: { version: string; contentHash: Sha256ContentHash };
  requestHash: Sha256ContentHash;
  data: JsonObject;
  components: CandidateIdentitySelectedComponentV2[];
  derivedValues: CandidateIdentityDerivedValueV2[];
}

export function projectCandidateIdentitySelectedComponentsV2(
  components: readonly SelectedComponent[],
): CandidateIdentitySelectedComponentV2[];

export function projectCandidateIdentityDerivedValuesV2(
  values: readonly DerivedValue[],
): CandidateIdentityDerivedValueV2[];

export function canonicalCandidateIdentityV2(
  input: Readonly<CandidateIdentityInputV2>,
): CandidateIdV2;
```

It returns `candidate:v2:sha256:<64 lowercase hex>` where the digest is SHA-256
over canonical JSON of exactly
`{recipe,context,requestHash,data,components,derivedValues}` after the two
component/value identity projections have removed only every quantity
`displayUnit`.
Hook-boundary normalization has already sorted component and derived-value IDs
and projected all finite numbers. Option key/label, metrics, constraints,
circuit serialization, offers, and policy are excluded. The option key cannot
influence native materialization, and the adapter's required V1 key is already
inside the included data envelope. The
manifest ref transitively binds compiler, reviewed catalog, ranking policy, and
recipe release. The request hash binds request-only voltage, duty, load, and
model values that materialization may consume, so two different electrical
requests cannot share a candidate ID while producing different circuits.
Mutating any included engineering field changes the ID; changing only a
quantity `displayUnit` does not, and permuting an already-declared set-like input
does not. Adopting a v2 recipe or adapter changes the candidate ID explicitly
and deterministically, as ADR-0002 requires. No V1/V2 same-ID promise is made.

The complete public recipe seam is additive and does not widen v1:

```ts
export interface EnumeratedOptionV2 {
  optionKey: string;
  data: JsonObject;
}
export interface SolvedOptionV2 {
  data: JsonObject;
  derivedValues: DerivedValue[];
}
export interface MatchedOptionV2 extends SolvedOptionV2 {
  components: SelectedComponent[];
  simulationCoverage: SimulationCoverageV2[];
  warnings: string[];
}
export type StageOutcomeV2<T> =
  | { status: "ok"; value: T }
  | {
      status: "rejected";
      reason: string;
      constraints?: ConstraintResult[];
      componentProfileIds?: string[];
    };

export type ElectricalDesignRequestForEngineeringV2 =
  ElectricalDesignRequestV2;

export interface RecipeEnvironmentV2 {
  request: Readonly<ElectricalDesignRequestForEngineeringV2>;
  catalog: Readonly<ReviewedProfileCatalogV2>;
  manifest: Readonly<ElectricalDesignContextManifestV2>;
}

export interface CandidateForMaterializationV2 {
  id: CandidateIdV2;
  recipeId: string;
  libraryVersion: string;
  data: JsonObject;
  components: SelectedComponent[];
  derivedValues: DerivedValue[];
  constraints: ConstraintResult[];
  metrics: CandidateMetricsV2;
  simulationCoverage: SimulationCoverageV2[];
  warnings: string[];
}

export interface CandidateEstimateV2 {
  metrics: CandidateMetricV2[];
  warnings: string[];
}

export interface CandidateMaterializationV2 {
  circuit: CircuitDocumentV2;
  circuitInstanceClassifications: CircuitInstanceClassificationV2[];
  circuitBomNonRepresentations: CircuitBomNonRepresentationV2[];
}

export interface DesignRecipeV2 extends DesignRecipeRefV2 {
  supports(request: Readonly<ElectricalDesignRequestForEngineeringV2>): boolean;
  enumerate(environment: RecipeEnvironmentV2): readonly EnumeratedOptionV2[];
  solve(
    option: Readonly<Omit<EnumeratedOptionV2, "optionKey">>,
    environment: RecipeEnvironmentV2,
  ): StageOutcomeV2<SolvedOptionV2>;
  match(
    option: Readonly<SolvedOptionV2>,
    environment: RecipeEnvironmentV2,
  ): readonly StageOutcomeV2<MatchedOptionV2>[];
  check(
    option: Readonly<MatchedOptionV2>,
    environment: RecipeEnvironmentV2,
  ): readonly ConstraintResult[];
  estimate(
    option: Readonly<MatchedOptionV2>,
    constraints: readonly ConstraintResult[],
    environment: RecipeEnvironmentV2,
  ): CandidateEstimateV2;
  materialize(
    candidate: Readonly<CandidateForMaterializationV2>,
    environment: RecipeEnvironmentV2,
  ): CandidateMaterializationV2;
}
```

`applications` is sorted, unique, non-empty, and part of the pinned recipe
contract. Context validation uses it before any hook: every recipe declaring the
request application must expose compatible declarations for each ranking metric.
Only after that static validation may `supports()` apply request-range or
topology-specific filtering. A recipe cannot hide an incompatible metric unit
by returning `false` dynamically.

The engineering request is a value-level projection of the parsed persisted
request: it has the same static request type and fields, but every
`Quantity.displayUnit` is replaced with that quantity's exact canonical SI
`unit` before any recipe hook receives it. It is detached and recursively
frozen. Thus changing only a persisted display preference cannot affect support,
enumeration, component selection, constraints, metrics, materialization,
candidate identity, electrical order, scenario identity, or netlist bytes.
Native and adapted materializers return the circuit, exhaustive instance
classifications, and complete BOM non-representation table atomically; all
three validate or the whole generation aborts at
`recipe_contract_invalid/materialize`.
`optionKey` is deterministic execution-report bookkeeping, not engineering
identity or a presentation label. The engine validates and stores it after
enumeration, but strips it from the native `solve` input; it is absent from all
later native hook values and from `CandidateForMaterializationV2`. A native hook
can therefore depend only on data bound by candidate/context/request identity.
An adapter that must preserve a V1 option key uses the exact identity-bound data
envelope below rather than a hidden side channel.

Native and adapted recipes have the same output-admission boundary. Before
checks or candidate identity, every selected component must exact-join one
reviewed runtime-catalog entry on both derived `profileId` and
`ManufacturerPartIdentity`; a matching ID with a different manufacturer/MPN is
invalid. Every component-profile ID cited by a rejected hook outcome must also
exist in that catalog. No recipe can fabricate or retain an authored, blocked,
missing, or stale profile merely because it received the reviewed catalog.

Motor and Power expose explicit v2 entrypoints without changing their v1 roots:

```ts
export function getMotorDesignContextManifestV2():
  Readonly<ElectricalDesignContextManifestV2>;
export function getMotorDesignContextV2():
  Readonly<GenerateElectricalContextV2>;
export function generateMotorDesignV2(
  request: BrushedDcMotorDesignRequestV2,
): DesignGenerationV2;

export function getPowerDesignContextManifestV2():
  Readonly<ElectricalDesignContextManifestV2>;
export function getPowerDesignContextV2():
  Readonly<GenerateElectricalContextV2>;
export function generateBuckDesignV2(
  request: BuckDesignRequestV2,
): DesignGenerationV2;
```

These are package-owned bundled-context wrappers. Each package pins its current
manifest and exposes both a newly detached recursively frozen manifest
projection and a public bundled context usable by the generic generation,
engineering-validation, commercial-overlay, BOM, and export APIs. A context
getter returns newly detached recursively frozen data fields plus the exact
opaque installed-registry capability resolved by design-engine; it exposes no
recipe callback or registry mutation method. The wrapper constructs the same
exact verified catalog documents/ranking policy/engine-resolved capability and
rejects a request whose `libraryVersion` differs from that manifest version.
A historical or custom context is never guessed by version string; callers use
`generateElectricalDesignV2(request, explicitContext)` instead. Here `custom`
may select different verified catalog/ranking data or an installed historical
recipe set; it never means caller-supplied executable closures. Acceptance
requires each wrapper to be byte-identical to that generic call with its exact
bundled context and to reject a wrong or unavailable historical pin. Mutating a
returned manifest/context projection throws or has no effect and never changes
later wrapper bytes; wrappers use inaccessible internal frozen state. Every
example and compile-time consumer uses only these public package exports; no
private catalog document, recipe function, registry table, or source-tree import
is required to verify or export a wrapper result.

### 4. Provide a narrow, honest v1 recipe adapter

Existing Motor and Power recipes may transition through an explicit adapter:

```ts
export function adaptDesignRecipeV1ToV2(
  recipe: DesignRecipe,
  options: {
    applications: readonly DesignApplication[];
    metricDeclarations: readonly ElectricalMetricDeclarationV2[];
  },
): DesignRecipeV2;
```

The adapter ref is exact: it preserves `recipe.id`, sets version to
`<v1-version>+schemagic-v2-adapter.1`, and sets content hash to SHA-256 over the
canonical tuple `{ adapterContractVersion: 1, v1RecipeRef,
applications, metricDeclarations }`. It never reuses the v1 recipe ref or
candidate ID. The adapter rejects empty, duplicate, unsorted, or dynamically
incompatible application declarations.

At its first hook boundary the adapter replaces V1 option data with the closed
identity-bound envelope
`{adapterContractVersion:1,v1OptionKey:<exact optionKey>,v1Data:<normalized
closed V1 data>}`. Every delegated V1 hook receives a detached unwrapped copy;
every returned V2 stage value carries the revalidated envelope. V1
materialization obtains its required option key only from that envelope. The
envelope participates in candidate identity and dedupe, so no option key or V1
data capable of changing a circuit is excluded from identity.

The adapter:

1. maps the canonical engineering-request projection, not the persisted
   display preferences, to the same v1 electrical fields with
   `schemaVersion: 1` and no sourcing;
2. delegates the deterministic engineering hooks through an exact inert V1
   library shim without adding commercial data;
3. requires every selected component profile ID and exact manufacturer identity
   to resolve to the same reviewed profile in the supplied catalog, then
   upgrades the returned v1 circuit through
   `upgradeCircuitV1ToV2`;
4. creates both exhaustive per-graph circuit/BOM tables: it classifies physical
   instances
   only when one selected MPN is unique within the candidate and the exact count
   of same-MPN instances in that graph equals its positive safe-integer assembly
   quantity; every such bound V1 instance receives
   `representedQuantityPerAssembly: 1`; otherwise it removes those circuit
   `mpn` values; it emits `behavioral` only for explicit code-owned adapter
   mappings, never by reading labels or annotations; every remaining circuit
   instance is `non_bom` with exact reason
   `v1_adapter_non_bom_or_unproven_instance`; and every graph/selected-component
   pair lacking physical or behavioral records receives one BOM
   non-representation with exact reason
   `v1_adapter_cannot_prove_selected_component_representation`;
5. replaces the upgrader's synthetic `default` scenario with deterministic
   scenario records for every non-unavailable coverage entry; and
6. rejects the adapter result when structural coverage, circuit, and BOM
   representation invariants cannot be represented honestly.

Each non-unavailable coverage entry must resolve to an exact same-ID scenario.
Every executable circuit scenario must have exactly one coverage entry. An
unavailable coverage entry may intentionally have no scenario. Non-unavailable
coverage must bind a structurally complete same-ID circuit scenario. Trusted
asset resolution and successful `generateScenarioNetlist` are deliberately not
adapter or engineering-generation operations; they are checked only by the
separate execution-context validator.

The v1 adapter accepts only `behavioral` or `unavailable` coverage. A v1 result
cannot prove a `reviewed` or `user_imported` simulation asset through the
adapter; those tiers require an application-owned v2 materializer and the exact
trusted-asset context that establishes them.

The V1 hook environment is exactly `{request: mappedV1Request, library:
{version: manifest.version, contentHash: manifest.contentHash, paretoCriteria:
[], rankingProfiles: {}}}`. The shim is detached and recursively frozen. It is
not caller-supplied, contains no sourcing criteria, and never performs V1
ranking; V2 ranking occurs only after hook outputs under the validated V2
policy. This exact shim is part of `adapterContractVersion: 1`, so any future
shim change requires a new adapter version/hash. Existing recipes that cannot
operate with this closed inert shim are not adapter-compatible and require a
native V2 recipe.

When a v1 candidate has multiple non-unavailable coverage entries but only one
v1 graph/config, the adapter may create multiple named scenario records that
reference the same upgraded graph and explicit config. It may not imply a
different stimulus, model, or fidelity; the original coverage limitations are
retained byte-for-byte. Application-owned v2 materializers should replace this
transition once they can express distinct scenarios.

The mapping is exact. The adapter rejects duplicate/unsafe coverage IDs, sorts
coverage by the code-unit comparator, and sorts/deduplicates each limitations
array without changing any string. It keeps the upgrader's sole `main` circuit
and explicit `default` config, removes the synthetic `default` scenario, and
creates one scenario for each behavioral coverage record with
`{id: coverage.scenarioId, title: coverage.scenarioId, circuitId: "main",
config: <detached explicit default config>}`. Scenarios are sorted by ID.
Unavailable records create no adapter scenario. `defaultCircuitId` is `main`;
`defaultScenarioId` is the first behavioral scenario ID or `null` when there
are none. Thus a zero-behavioral adapter result has an empty scenario array and
cannot accidentally execute the upgrader's synthetic default.

The v1 ranking library is not an adapter input. V2 always uses the separately
validated electrical ranking policy, whose type has no sourcing criterion. A
synthetic fixture catalog may exercise the adapter in tests, but the production
loader admits only reviewed, hash-matching ADR-0003 profiles.

### 5. Freeze v2 result ordering, validation, and migration

V2 freezes explicit resource ceilings rather than relying on host memory:

```ts
export const DESIGN_REQUEST_V2_MAX_CANONICAL_BYTES = 1 * 1024 * 1024;
export const DESIGN_RESULT_V2_MAX_CANONICAL_BYTES = 64 * 1024 * 1024;
export const DESIGN_EXECUTION_REPORT_V2_MAX_CANONICAL_BYTES = 32 * 1024 * 1024;
export const DESIGN_CONTEXT_V2_MAX_CANONICAL_BYTES = 256 * 1024 * 1024;
export const DESIGN_V2_MAX_HOOK_VALUE_CANONICAL_BYTES = 1 * 1024 * 1024;
export const DESIGN_V2_MAX_STRING_UTF8_BYTES = 16 * 1024;
export const DESIGN_V2_MAX_OBJECT_DEPTH = 64;
export const DESIGN_V2_MAX_VISITED_NODES = 1_000_000;
export const DESIGN_V2_MAX_VALIDATION_ISSUES = 4_096;
export const DESIGN_V2_MAX_RECIPES = 256;
export const DESIGN_V2_MAX_REVIEWED_PROFILES = 100_000;
export const DESIGN_V2_MAX_RANKING_CRITERIA = 4_096;
export const DESIGN_V2_MAX_OPTIONS_PER_RECIPE = 4_096;
export const DESIGN_V2_MAX_MATCH_OUTCOMES_PER_OPTION = 4_096;
export const DESIGN_V2_MAX_DRAFTS = 65_536;
export const DESIGN_V2_MAX_CANDIDATES = 256;
export const DESIGN_V2_MAX_REJECTIONS = 16_384;
export const DESIGN_V2_MAX_COMPONENTS_PER_CANDIDATE = 4_096;
export const DESIGN_V2_MAX_DERIVED_VALUES_PER_CANDIDATE = 4_096;
export const DESIGN_V2_MAX_CONSTRAINTS_PER_CANDIDATE = 4_096;
export const DESIGN_V2_MAX_METRICS_PER_CANDIDATE = 4_096;
export const DESIGN_V2_MAX_COVERAGE_PER_CANDIDATE = 64;
export const DESIGN_V2_MAX_WARNINGS_PER_CANDIDATE = 4_096;
export const DESIGN_V2_MAX_CIRCUIT_INSTANCE_CLASSIFICATIONS = 65_536;
export const DESIGN_V2_MAX_CIRCUIT_BOM_NON_REPRESENTATIONS = 65_536;
export const DESIGN_V2_MAX_ASSUMPTIONS = 256;
export const DESIGN_V2_MAX_SET_MEMBERS = 256;
```

Circuit documents additionally retain every ADR-0002 document/graph/annotation
ceiling. The context byte ceiling covers its manifest, reviewed-catalog
projection, catalog source documents, and ranking policy; the opaque capability
is non-serializable and contributes no caller-controlled bytes.
Request/result/report parsers perform a bounded raw-object walk before
canonicalization, reject accessors, cycles, excessive depth, strings, arrays,
and node counts, then enforce the canonical UTF-8 byte cap. String transport
helpers enforce the same byte cap before JSON parsing. Generation enforces
recipe/option/match/draft caps before allocating the next stage. A
manifest/catalog/capability excess is `invalid_context/context`; an individual
recipe return excess is `recipe_contract_invalid/<hook>`; an otherwise valid
cross-recipe option or match aggregate excess is respectively
`resource_limit/enumerate` or `resource_limit/match`. Dedupe/Pareto/rank
working-set excesses are `resource_limit/dedupe`, `/pareto`, or `/rank`.
The global rejection ceiling is checked before appending each valid rejection;
an excess is `resource_limit/<solve|match|check|dedupe|pareto>` at the
rejection's stage with no recipe ID. After ranking,
candidate/rejection/total-result construction is `resource_limit/result`; only
after a valid result exists is execution-report
construction attempted, and its excess is `resource_limit/report`. An
over-limit request passed to generation is `invalid_request/request`; the same
request passed to a parser is `resource_limit/parse/electrical_request`. An
over-limit materialized candidate is `recipe_contract_invalid/materialize`.
Counts are safe integers, and no truncation, sampling, partial result, or silent
candidate drop is allowed.
Every individual hook return also obeys the hook-value byte, depth, node, and
string caps. Validation collects at most 4,095 ordinary issues; if further work
would exceed the issue ceiling it adds one root `resource_limit` issue and stops,
so the caller is explicitly told the issue set is incomplete rather than seeing
silent truncation.

Design-schema structurally parses every v2 candidate and result as recursively
closed. In addition to ADR-0004's rules:

- every candidate request hash equals the result request hash;
- the result request hash equals `designRequestHashV2(result.request)` and the
  result/request library versions are exactly equal;
- every candidate library version equals the result library version;
- candidate IDs are unique and candidate order is the engine's deterministic
  electrical rank order;
- every selected component `quantityPerAssembly` is a positive safe integer;
- constraint rule IDs reject all reserved non-electrical prefixes:
  `sourcing.`, `commercial.`, `offer.`, `provider.`, and `distributor.`;
- candidate objects reject an inline `sourcing` field;
- each circuit passes `validateCircuitV2` after canonical numeric projection;
- each circuit-instance classification and BOM non-representation table passes
  the exact bidirectional completeness, quantity, MPN, and no-masquerading
  invariants in Section 1;
- coverage IDs are unique; every circuit scenario ID has exactly one coverage
  record; every behavioral record has a same-ID scenario; an unavailable
  record may omit its scenario or bind exactly one same-ID incomplete scenario
  whose referenced graph contains at least one `schematic_only` design block and
  whose limitations contain the exact complete static omission projection;
  a behavioral scenario's referenced graph contains no `schematic_only` block;
  orphan scenarios, duplicate coverage, and any other cross-reference reject;
- rejected candidates contain only electrical failures; and
- the result content hash includes complete v2 circuit bytes, exhaustive
  instance classifications, BOM non-representations, and coverage.

V2 uses the same locale-independent code-unit comparator as ADR-0002:
`left === right ? 0 : left < right ? -1 : 1`. It never calls
`localeCompare`. Producers and validators require:

- recipe refs sorted by `(id, version, contentHash)`, with unique recipe IDs;
- each recipe's applications sorted/unique by application ID and metric
  declarations sorted by `(id, unit)`, with unique declaration IDs;
- exact one-to-one equality between manifest recipe refs and the engine-owned
  installed entries behind the validated capability;
- candidate `components`, `derivedValues`, metric values, and coverage sorted by
  ID, with each ID unique;
- circuit-instance classifications sorted and unique by
  `(circuitId, componentId)`, and BOM non-representations sorted and unique by
  `(circuitId, selectedComponentId)`;
- constraints sorted by `(ruleId, canonicalConstraintBytes)`, with duplicate
  rule IDs rejected in one candidate;
- coverage limitations, candidate warnings, component-profile IDs, and result
  diagnostics sorted and unique;
- rejected candidates sorted by the code-unit comparison of canonical JSON
  tuples `[recipeId, componentProfileIds, constraints]`; no delimiter join is
  used;
- Pareto criteria sorted by `(metricId, direction)` and reject duplicate
  `metricId` regardless of direction; and
- each ranking-profile criterion array preserved in explicit priority order,
  with duplicate metric IDs rejected.

`diagnostics` is not arbitrary presentation text. When no recipe declares
support for the otherwise valid request, generation succeeds with zero
candidates, zero rejected candidates, and diagnostics exactly
`["design.no_supported_recipe"]`; the execution report has
`supportedRecipes === 0` and all later counts zero. For any generation with at
least one supported recipe that diagnostic is absent. A supported run in which
all valid drafts are explicitly rejected is also a successful zero-candidate
result, with an empty diagnostic array and the exact rejections projected below.
A supported recipe may also validly enumerate zero options; that likewise yields
an empty candidate/rejection/diagnostic result with `supportedRecipes > 0` and
`enumerated === 0`.
An invalid request never produces either empty result: it aborts with
`invalid_request/request` before context or recipe access.

Candidate array order is semantic electrical rank order and is never resorted
by the serializer. Ranking compares declared criteria in order, requires equal
declared units, and uses candidate ID as the final tie-break. The canonicalizer
preserves all other semantic arrays, including evidence lists, wire points,
block pins, pin order, and annotation arrays.

V2 dedupe, Pareto, and rank are exact:

- `candidateDedupeKeyV2` is SHA-256 over the same canonical
  `{recipe,context,requestHash,data,components,derivedValues}` presentation-free
  payload used by candidate identity. It never collapses different
  topology/control data or different
  recipe/context refs merely because BOM and derived values match. Candidates
  are considered for each key in `(candidateId, recipeId, optionKey)` order;
  the first survives and every later entry is a deterministic duplicate
  rejection.
- A candidate participates in Pareto comparison only when every Pareto metric
  is present, finite, non-null, and in its declared unit. Incomplete candidates
  neither dominate nor are dominated and remain visible with a stable
  `electrical.metric_unknown:<metricId>` warning.
- Among complete candidates, dominance means no worse on every criterion and
  strictly better on at least one. If several candidates dominate one entry,
  the code-unit-smallest candidate ID is the recorded dominator. Pareto
  decisions are computed against the complete pre-prune set, not incrementally.
- Rank first considers Pareto-complete frontier survivors. Those complete on
  ranking criteria compare the requested priorities and then candidate ID;
  those missing a ranking metric follow that group and sort by candidate ID.
  Pareto-incomplete candidates are never ranked and form a final visible tail
  sorted by candidate ID, after every Pareto-complete frontier candidate. Thus
  missing Pareto evidence cannot improve order. Unknown never becomes zero or
  infinity. With no Pareto criteria every candidate is Pareto-complete; with no
  ranking criteria that frontier sorts by candidate ID.

Recipe enumeration arrays and match outcome arrays are canonicalized before the
next stage. Each recipe's enumerated options are sorted by the direct tuple
`[optionKey, canonicalJson(normalizedData)]`; `optionKey` is unique within that
recipe and a duplicate rejects the entire recipe output as
`recipe_contract_invalid/enumerate`. The engine retains that key out of band for
counts/rejections/sort while passing
only normalized `data` to the native solve hook; no later native value may add
an `optionKey` field.
For each solved option, the non-empty match-outcome array is sorted by the
direct tuple `[status, canonicalJson(normalized closed outcome)]`, where
`status` order is `ok` then `rejected`; duplicate canonical outcomes reject the
entire callback result. No delimiter join, locale collation, insertion order,
label, or object identity participates. All later stage decisions use those
normalized arrays. Reversing recipe, option, match, or candidate input order
cannot change survivors, selected dominator, persisted candidate order, or
rejection bytes.

Detailed execution information is not smuggled into the closed persisted
result:

```ts
export type GenerationStageV2 =
  | "solve"
  | "match"
  | "check"
  | "dedupe"
  | "pareto";

export type GenerationRejectionReasonV2 =
  | "recipe_rejected"
  | "hard_constraint_failed"
  | "unknown_constraint_disallowed"
  | "warning_disallowed"
  | "duplicate_candidate"
  | "pareto_dominated";

export interface GenerationRejectionBaseV2 {
  recipeId: string;
  optionKey: string;
  componentProfileIds: string[];
  constraints: ConstraintResult[];
  message: string;
}

export type GenerationRejectionV2 = GenerationRejectionBaseV2 & (
  | {
      stage: "solve" | "match";
      reasonCode: "recipe_rejected";
      candidateId?: never;
      recipeReason: string;
    }
  | {
      stage: "check";
      reasonCode:
        | "hard_constraint_failed"
        | "unknown_constraint_disallowed"
        | "warning_disallowed";
      candidateId: CandidateIdV2;
    }
  | {
      stage: "dedupe";
      reasonCode: "duplicate_candidate";
      candidateId: CandidateIdV2;
      kept: {
        candidateId: CandidateIdV2;
        recipeId: string;
        optionKey: string;
      };
    }
  | {
      stage: "pareto";
      reasonCode: "pareto_dominated";
      candidateId: CandidateIdV2;
      dominatedByCandidateId: CandidateIdV2;
  }
);

type WithoutGenerationRejectionMessageV2<T> =
  T extends { message: string } ? Omit<T, "message"> : never;

export type GenerationRejectionMessageInputV2 =
  WithoutGenerationRejectionMessageV2<GenerationRejectionV2>;

export function renderGenerationRejectionMessageV2(
  rejection: Readonly<GenerationRejectionMessageInputV2>,
): string;

export function projectGenerationRejectionV2(
  rejection: Readonly<GenerationRejectionV2>,
): RejectedCandidateV2;

export interface GenerationCountsV2 {
  recipes: number;
  supportedRecipes: number;
  enumerated: number;
  solved: number;
  matchOutcomes: number;
  matched: number;
  checked: number;
  estimated: number;
  deduped: number;
  pareto: number;
  materialized: number;
  coverageValidated: number;
  rejected: number;
}

export interface DesignExecutionReportV2 {
  pipeline: readonly [
    "normalize", "enumerate", "solve", "match", "check", "estimate",
    "materialize", "coverage", "dedupe", "pareto", "rank",
  ];
  counts: GenerationCountsV2;
  rejections: GenerationRejectionV2[];
}

export interface DesignGenerationV2 {
  result: DesignResultV2;
  execution: DesignExecutionReportV2;
}

export function canonicalDesignExecutionReportV2Payload(
  report: Readonly<DesignExecutionReportV2>,
): string;

export function parseDesignExecutionReportV2(
  input: unknown,
): DesignExecutionReportV2;

export function validateDesignExecutionReportContextV2(
  report: Readonly<DesignExecutionReportV2>,
  result: Readonly<DesignResultV2>,
  context: Readonly<GenerateElectricalContextV2>,
): DesignValidationIssue[];
```

`execution` is deterministic, strictly validated, and serializable through an
explicit debug-export function, but it is not part of `DesignResultV2` and does
not enter its content hash. The persisted `rejectedCandidates` remains the
closed electrical-only projection frozen by design-schema. It is exactly the
element-for-element mapping of `execution.rejections` through
`projectGenerationRejectionV2`, which retains only
`{recipeId, componentProfileIds, constraints}`, followed by the frozen result
sort. Projection collisions are not deduplicated: if two distinct execution
rejections produce identical closed result records, both records remain. There
is no extra persisted rejection, and no execution rejection may disappear.
The contextual report validator recomputes this projection and requires exact
array equality; structural result parsing can enforce only its shape and order.

The pipeline tuple is literal and immutable. Counts are closed non-negative
integers. Their meanings are exact: `recipes` is the number of manifest recipe
refs after engine-owned installed-capability equality; `supportedRecipes` is the number whose valid
`supports` call returned true; `enumerated` is the total normalized enumerate
outputs of those recipes; `solved` is the count of `solve` ok outcomes;
`matchOutcomes` is the total normalized outcomes returned by `match` for solved
options; `matched` is the count of match ok outcomes; `checked` is the number
of matched options whose check callback returned a valid closed constraint
array; `estimated` is the checked count minus check-stage rejections;
`materialized` is the number of valid materializations; `coverageValidated` is
the number whose circuit, exhaustive instance classification, BOM converse, and
structural coverage cross-check completed without resolving any simulation
asset; `deduped` is the survivor
count after dedupe; and `pareto` is the survivor count after dominance pruning,
including Pareto-incomplete visible-tail candidates. On a successful call,
`solved + solveRejections === enumerated`,
`matched + matchRejections === matchOutcomes`, `checked === matched`,
`estimated + checkRejections === checked`, `materialized === estimated`,
`coverageValidated === materialized`,
`deduped + dedupeRejections === coverageValidated`,
`pareto + paretoRejections === deduped`, `result.candidates.length === pareto`,
and `rejected === rejections.length`. A hook-contract abort returns no report,
so partial counts are never serialized.

Each rejection union member permits only its correlated fields. Recipe
rejections preserve one normalized control-free `recipeReason`; check
rejections require the exact candidate ID; duplicate rejections require the
exact surviving `{candidateId,recipeId,optionKey}` draft ref (the candidate ID
may intentionally equal the rejected duplicate's ID); and dominance rejections
require the distinct `dominatedByCandidateId` selected by the frozen rules. `message` is
not free text: `renderGenerationRejectionMessageV2` returns canonical JSON of
the complete correlated rejection excluding `message`, using the shared key
and number rules. Parsing recomputes it and rejects tampering, forbidden union
fields, self-references, unsafe strings, or impossible stage/reason pairs.
Rejections are unique and sorted by the canonical JSON tuple
`[pipelineStageIndex, recipeId, optionKey, candidateIdOrNull,
componentProfileIds, constraints, reasonCode, correlatedDecisionFields,
message]`, where nested arrays
already obey their V2 rules. `canonicalDesignExecutionReportV2Payload` returns
canonical UTF-8 JSON text of the closed report; the parser rejects reordered,
duplicated, sourcing-stage, wrong-rejected-count, and extra-key inputs. A
standalone parser cannot prove the other aggregate counts. The contextual
validator verifies the exact engineering context, regenerates the result and
execution report, and requires canonical byte equality for both; it rejects any
plausible but false count. This is the sole debug-export byte contract.

Materialization and structural coverage/BOM validation deliberately precede
dedupe, Pareto, and rank in V2. A contract-invalid circuit, dishonest structural
coverage, or invalid circuit/BOM binding aborts with the typed generation error
before it can deduplicate or dominate another candidate. Those late engineering
stages operate only on fully materialized, structurally valid candidates, so no
re-run or hidden promotion rule is needed. This step validates graph/scenario
references, design-block declarations, exact coverage cross-references, and the
exhaustive instance-classification/BOM-converse tables. It never resolves a trusted subcircuit asset or
generates a netlist.

For Designer V2 this literal pipeline and its count equations supersede the V1
late-materialization order described by ADR-0001 and the earlier generalized
ordering sentence in ADR-0003. Their electrical-before-commercial boundary
continues unchanged. The supersession is version-specific: no V1 engine trace,
result byte, or unsuffixed API changes.

Structural parsing and engineering generation cannot prove trusted model
availability. Execution coverage therefore has a separate contextual validator:

```ts
export interface DesignResultExecutionContextV2 {
  trustedSubcircuitRegistry?: TrustedSubcircuitRegistry;
}

export function validateDesignResultExecutionContextV2(
  result: Readonly<DesignResultV2>,
  context: Readonly<DesignResultExecutionContextV2>,
): DesignValidationIssue[];

export function validateDesignResultEngineeringContextV2(
  result: Readonly<DesignResultV2>,
  context: Readonly<GenerateElectricalContextV2>,
): DesignValidationIssue[];
```

It calls `generateScenarioNetlist` for every same-ID scenario. A behavioral
scenario must succeed with zero omissions. An unavailable same-ID scenario must
succeed in ADR-0002's explicit incomplete mode with at least one
`SCHEMATIC_ONLY_BLOCK_OMITTED` diagnostic and no other asset-resolution or
generation error; its sorted unique omission messages must equal the required
machine-rendered entries in `limitations`, while additional limitations remain
advisory. An unavailable scenario with zero omissions is invalid and must be
persisted as behavioral instead. Missing, hash-invalid, or unsafe trusted
assets are coverage-context failures, never allowed omissions. These failures
do not become electrical constraints or silent tier downgrades.
`generateElectricalDesignV2` never calls this validator and succeeds offline
without a model registry. An offline parser or generator may inspect and rank a
structurally valid electrical result, but UI and export must not label any
same-ID scenario executable or run it until the explicit execution-context
validator succeeds for that result/context. They still display the persisted
`behavioral` or `unavailable` claim and limitations as unverified engineering
data.

Structural parsing also cannot prove that a self-consistent result was produced
by the claimed compiler/catalog/ranking/recipe context. The engineering-context
validator verifies that exact context, deterministically regenerates from the
persisted electrical request, and requires byte equality with the supplied
canonical result. This regeneration is the same pure, offline engineering
pipeline and performs no execution-context validation or asset lookup. A
recomputed result hash alone is not engineering trust.
Designer and design-export label an imported V2 result `structurally_valid`
until this validator succeeds; only then may they call it
`engineering_context_verified`, expose engineering rank as verified, or create
a new commercial overlay. The execution-context validator remains a separate
model-availability check.

Parsing and regeneration are separate APIs:

```ts
export type GenerationStageV1 =
  | "solve"
  | "match"
  | "check"
  | "sourcing"
  | "dedupe"
  | "pareto";

export interface GenerationRejectionV1 {
  stage: GenerationStageV1;
  recipeId: string;
  optionKey: string;
  candidateId?: string;
  componentProfileIds: string[];
  constraints: ConstraintResult[];
  reason: string;
}

export interface GenerationCountsV1 {
  recipes: number;
  enumerated: number;
  solved: number;
  matched: number;
  checked: number;
  estimated: number;
  sourced: number;
  deduped: number;
  pareto: number;
  materialized: number;
  rejected: number;
}

export interface GenerationTraceV1 {
  pipeline: readonly [
    "normalize", "enumerate", "solve", "match", "check", "estimate",
    "dedupe", "pareto", "rank", "materialize",
  ];
  counts: GenerationCountsV1;
}

export interface LegacyDesignGenerationArtifactV1 extends DesignResultV1 {
  rejections: GenerationRejectionV1[];
  trace: GenerationTraceV1;
}

export type PersistedDesignResultV1 =
  | DesignResultV1
  | LegacyDesignGenerationArtifactV1;

export type ParsedPersistedDesignResult =
  | PersistedDesignResultV1
  | DesignResultV2;

// New strict design-schema parser; no prior V1 parser is claimed.
export function parseDesignResultV1(
  input: unknown,
): PersistedDesignResultV1;

export function parsePersistedDesignResult(
  input: unknown,
): ParsedPersistedDesignResult;

// design-export: existing name remains V1; suffixed alias is byte-identical.
export function serializeDesignResult(
  result: Readonly<PersistedDesignResultV1>,
): string;
export function serializeDesignResultV1(
  result: Readonly<PersistedDesignResultV1>,
): string;

export type DesignResultV1RegenerationPlan =
  | {
      status: "regeneration_required";
      reason: "v1_result_is_lossy";
      requestMigration: DesignRequestV2Migrated;
      diagnostics: readonly [
        "legacy_v1_rejections_are_lossy",
        "legacy_v1_sourcing_rejection_requires_regeneration",
        "legacy_v1_rank_requires_regeneration",
      ];
    }
  | DesignRequestV2MigrationBlock;

export function planDesignResultV1Regeneration(
  result: PersistedDesignResultV1,
  targetLibraryVersion: string,
  engineeringObjective?: ElectricalDesignObjectiveV2,
): DesignResultV1RegenerationPlan;

export type DesignResultV1Regeneration =
  | { status: "generated"; generation: DesignGenerationV2 }
  | DesignRequestV2MigrationBlock;

export function regenerateDesignResultV1AsV2(
  result: PersistedDesignResultV1,
  context: GenerateElectricalContextV2,
  engineeringObjective?: ElectricalDesignObjectiveV2,
): DesignResultV1Regeneration;
```

The dispatcher strictly validates and returns the version it read. For
`schemaVersion: 1`, it accepts either the closed `DesignResultV1` or the exact
legacy `DesignGeneration` extension that the current Motor/Power web path has
already serialized with top-level `rejections` and `trace`. Both extension
fields must be present together and strictly match the frozen V1 engine shape;
other extra keys remain invalid. `serializeDesignResultV1` preserves whichever
of those two exact shapes it receives and produces the same bytes as the
existing unsuffixed design-export `serializeDesignResult`; the unsuffixed API
does not flip versions. The strict V1 parser and dispatcher are new
design-schema APIs, not falsely described as prior behavior. Design-schema owns the structural legacy
artifact types to avoid a dependency on design-engine, while compile-time tests
require the current engine `DesignGeneration` to be assignable to them.

The dispatcher never
implicitly migrates V1, never asks for context, and lets Designer open V1
directly. Persisted V1 bytes cannot prove electrical-only rank or reconstruct
candidates deleted by sourcing; their projected rejection records omit stage,
reason, option key, and candidate ID. Consequently there is no pure
`migrateDesignResultV1ToV2`.

Regeneration validates the V1 result for audit, migrates its embedded request
using `context.manifest.version` as the target library pin, and runs the V2
electrical pipeline from the supplied, hash-verified catalog, ranking, and
recipe context. It does not copy V1 candidate IDs, order,
rejections, or coverage claims. Legacy inline sourcing may be separately
migrated only through ADR-0004's conservative snapshot-resolved path. That path
may recover a verified legacy policy and exact source snapshots, then freshly
calls `generateCommercialOverlayV1` for every regenerated V2 candidate. It
never joins or copies a V1 candidate metric by old ID, BOM similarity, or exact
BOM equality: IDs deliberately change, a regenerated candidate set may differ,
and equal BOMs are not unique identities. Legacy candidate metrics may be kept
only as an unattached audit artifact. They never enter the regenerated result
or its new overlay.

For an already-electrical V1 objective, migration and regeneration preserve it
exactly; the optional argument may be absent or equal. A different value returns
the same closed `engineering_objective_conflict` branch from request migration,
the regeneration plan, and direct regeneration before context validation or
recipe invocation. For a commercial
V1 objective, the argument is required and direct regeneration returns the
closed `engineering_objective_required` branch before validating or invoking
any recipe. A successful call returns `{status:"generated",generation}`.
`planDesignResultV1Regeneration` exposes the exact same two shared block union
members, so callers may obtain a requirement, conflict, or suggestions without
attempting generation. Only a migrated request is wrapped in
`regeneration_required`.

V2 serialization uses the canonical SHA-256 result functions frozen by
ADR-0004. Its canonicalizer applies the shared finite 12-significant-digit
number projection and embeds each circuit's `canonicalizeCircuitV2(document,
true)` JSON projection. Views, labels, titles, annotations, defaults, unselected
graphs, and unselected scenarios therefore enter the enclosing result hash.
Only the top-level result `contentHash` is excluded.

`parseDesignResultV2` validates the canonical numeric projection and returns
that normalized projection. Raw numeric differences below the canonical
precision intentionally produce the same parsed bytes, result hash, scenario
hash, and netlist; a view edit changes the result hash but not scenario hash or
netlist. Circuit v2's annotation-free `scenarioHash` remains execution identity.

### 6. UI, Simulator, and export use version-specific paths

Designer may open v1 and v2 results, but generation selects an explicit engine
entrypoint. It never infers a result version from candidate fields.

For a v2 candidate:

- the schematic opens `defaultCircuitId`;
- Simulator selects `defaultScenarioId` or an explicitly chosen scenario and
  calls `generateScenarioNetlist`;
- an unavailable coverage record with no same-ID scenario is display-only and
  has no simulation action;
- an unavailable record with a same-ID scenario is an inspectable incomplete
  scenario only after contextual generation proves at least one exact
  schematic-only omission and no other generation error: Designer may offer an
  explicit `Run incomplete model` action with
  the limitations and omissions visible, but it is never labeled available,
  validated, reviewed, or used for numerical ranking;
- a behavioral record is executable only after the execution-context
  validator succeeds with zero omissions;
- behavioral limitations remain visible verbatim; and
- commercial status appears only after a context-validated overlay is joined.

`defaultScenarioId` remains a presentation selection under ADR-0002. It may
point at an unavailable incomplete scenario, but Designer must not auto-run it.
If any structurally valid behavioral scenario exists, application materializers
set the default to the code-unit-smallest such scenario ID; execution validity
is checked later and does not rewrite that persisted presentation choice. There
is no fallback from a missing/unavailable coverage record to another scenario.

Design-export retains its v1 JSON/BOM/SPICE functions. Its v2 SPICE function
requires an explicit scenario ID and delegates to `generateScenarioNetlist`.
For unavailable incomplete coverage it requires an explicit
`allowIncomplete: true` option and emits prominent limitation/omission comments;
without that option it rejects. It never changes the persisted coverage tier.
Its v2 bundle/BOM behavior remains the separately validated design-plus-overlay
contract in ADR-0004. A v2 export never downgrades to v1 implicitly.

The public SPICE seam is exact:

```ts
export type CandidateScenarioSpiceExportErrorCodeV2 =
  | "invalid_result"
  | "engineering_context_unverified"
  | "candidate_not_found"
  | "scenario_not_found"
  | "coverage_unavailable"
  | "execution_context_invalid"
  | "generation_failed";

export class CandidateScenarioSpiceExportErrorV2 extends Error {
  readonly code: CandidateScenarioSpiceExportErrorCodeV2;
  readonly issues: readonly DesignValidationIssue[];
}

export function exportDesignResultScenarioSpiceV2(
  result: Readonly<DesignResultV2>,
  candidateId: CandidateIdV2,
  scenarioId: string,
  options: Readonly<{
    engineeringContext: GenerateElectricalContextV2;
    executionContext: DesignResultExecutionContextV2;
    allowIncomplete?: boolean;
  }>,
): string;

export function encodeSpiceCommentLinesV2(
  label: string,
  value: string,
): string[];
```

Export first requires engineering-context verification. Behavioral coverage
also requires execution-context verification. Unavailable coverage rejects
unless the exact same-ID incomplete scenario exists and `allowIncomplete` is
true. Every generated metadata, warning, limitation, and omission comment goes
through `encodeSpiceCommentLinesV2`: it splits CRLF, CR, LF, U+0085, U+2028, and
U+2029; escapes every remaining C0/C1/DEL code point as ASCII `\\u{HEX}`; and
prefixes every physical output line with `* <safe-label> `. Labels are closed
ASCII tokens. User-controlled text is never concatenated into a raw SPICE line.

## Acceptance gates

1. Compile existing v1 design-schema, engine, Motor, Power, web, and export
   consumers unchanged; prove named v1 aliases are identical to the current
   unsuffixed types.
2. Round-trip a v1 result and a v2 result through a strict version dispatcher
   that returns the version read; reject a v1 envelope with a v2 circuit and a
   v2 envelope with a v1 circuit, and prove parsing never triggers migration.
   Golden-test actual Motor and Power browser exports carrying the legacy V1
   `rejections`/`trace` extension and preserve their bytes exactly; reject only
   one extension field or any other extra key.
   Directly parse/hash V2 requests, prove every declared set permutation has
   identical bytes/hash, and reject duplicate allowed values, operating modes,
   assumption IDs, and `affects` entries.
3. Ask to migrate a persisted V1 result and require
   `regeneration_required`. Regenerate with an exact V2 context and prove no V1
   candidate order, rejection projection, inline sourcing, or candidate ID is
   copied. A commercial V1 objective without an engineering objective returns
   `engineering_objective_required` with the exact suggested criterion. For an
   electrical V1 objective, pass a different electrical objective and require
   the identical `engineering_objective_conflict` branch from request migration,
   planning, and regeneration before context or recipe access.
4. Validate manifest, reviewed catalog, ranking policy, and recipe refs before
   hooks. Mutate each independently and reject the hash mismatch. Reject
   authored/planned profiles, undeclared/conflicting metric units, commercial
   metric namespaces, duplicate criteria, and any sourcing ranking source.
   Prove source documents -> reviewed runtime projection -> manifest hashes,
   mutate profiles under an unchanged claimed hash, and reject. Reject compiler
   drift, missing/extra installed recipes, absent objective profiles, and
   adapter application/hash drift. Under an official compiler/recipe ref and
   hash, inject forged functions, a caller registry object, a copied capability,
   a prototype lookalike, and a test-only capability; every production call must
   reject before any forged callback runs. Resolve the exact installed manifest
   and prove only its engine-minted capability reaches hooks.
   Reject a Motor policy/manifest used with a Power request and independently
   verify ranking-policy canonical bytes/hash with a standard SHA-256.
   Prove Motor/Power wrapper output equals the exact generic bundled-context
   call using only `getMotorDesignContextV2` or `getPowerDesignContextV2`, wrong
   pins reject, and mutating a returned manifest or public context cannot change
   a later wrapper result. Compile the real web, export, BOM, and commercial
   consumers using only package-root public imports and the public installed
   resolver; private catalog/registry paths are a release failure.
5. Generate M1, M2, P1, and P2 through the v2 adapter twice; require identical
   canonical result bytes, result hash, V2 candidate IDs, circuits, scenarios,
   coverage, electrical rank, and separate execution-report bytes. Require each
   adapted V2 candidate ID to differ from its V1 identity and remain stable on
   repeated V2 runs. The fixture gate is non-vacuous: M1 has exactly two
   survivors, M2 exactly four, P1 at least three, P2 at least two, every request
   has at least one inspectable rejection, and every survivor reaches structural
   coverage validation. Mutate every canonical candidate-identity engineering
   input one at a time and require an ID change; mutate
   request/component/derived-value `displayUnit` fields and require unchanged
   request hash, candidate IDs, selection, constraints, metrics,
   circuit/BOM binding, rank, scenario hash, and netlist bytes while persisted
   display preferences remain round-trippable. Mutate each other excluded field
   and require no identity change.
   Require every hook-boundary object to be detached/frozen and prove
   sub-canonical raw values cannot change checks, dedupe, Pareto, rank, or bytes.
6. Prove each behavioral coverage record resolves to a successfully generated
   same-ID netlist with zero omissions. Prove unavailable-without-scenario has
   no action, unavailable-with-scenario requires the explicit incomplete-run
   path, neither state is relabeled, and no fallback scenario is selected.
   Reject `reviewed` and `user_imported` until their provenance contract exists.
   In a native V2 recipe, reject orphan scenarios, duplicate coverage IDs, and
   behavioral coverage without a same-ID scenario. Prove engineering generation
   and engineering-context verification are byte-identical with no
   `TrustedSubcircuitRegistry` and make zero asset lookups; then prove execution
   verification alone fails missing/hash-invalid assets and succeeds with the
   exact registry.
7. Vary or remove every snapshot, provider, policy, price, stock, lifecycle,
   lead-time, permission, and terms input; require byte-identical v2 electrical
   results and prove the v2 generation API cannot accept those inputs.
8. Reject inline sourcing fields, commercial ranking sources, all five reserved
   constraint prefixes, `simulated` metrics, unknown keys, non-finite numbers,
   hash mismatches, duplicate IDs, request/library mismatches, and invalid
   coverage/scenario references. Reject a native or adapted selected component
   unless both profile ID and exact part identity join the reviewed catalog;
   reject nonexistent rejection-profile IDs. Tamper each metrics count and
   reject it unless the exact source constraints/values change consistently.
   Classify every circuit instance exactly once as physical, behavioral, or
   non-BOM, including every MPN-free primitive and design block; reject an
   unclassified/duplicate/nonexistent instance, wrong selected ID, physical
   quantity mismatch, MPN mismatch, unbound MPN, MPN on behavioral/non-BOM, or
   label/annotation inference. For every graph/selected-component pair require
   exactly one physical, behavioral, or explicit non-representation converse
   state and reject mixing or omission. Verify the conservative V1 adapter emits
   the two exact non-BOM/non-representation reasons.
   Exercise every `DesignValidationIssueCode`, RFC-6901-escaped path, exact
   message prefix, sort, duplicate, and issue-ceiling rule; reject a tampered
   message.
9. Run V2 generation and canonicalization under different host locales and
   numeric-collation settings; require identical ordering and bytes. Adversarial
   fixtures cover every sorted/unique array and every semantic-order array.
   Reverse recipe/option/match input order and require identical dedupe,
   unknown-metric handling, Pareto survivors, smallest-ID dominator, final rank,
   and rejection bytes.
   Make the otherwise-best draft fail or throw in each hook boundary and prove
   the exact sanitized typed generation error aborts before dedupe/rank; no
   partial result or arbitrary thrown text escapes. Invalid requests abort as
   `invalid_request/request` before context access. A valid request with zero
   supporting recipes returns the exact empty result/diagnostic/count contract;
   a supported all-rejected request returns no no-support diagnostic.
10. Bind a valid `CommercialOverlayV1` to a v2 result, then mutate one circuit
   annotation, component, scenario, or limitation and prove overlay context
   validation rejects the changed result hash. A view mutation changes result
   hash but not scenario hash/netlist; sub-canonical-precision numeric changes
   produce the same normalized result and execution bytes.
   Separately mutate candidate facts, order, or ID, recompute the self-consistent
   result hash while retaining the claimed manifest ref, and require
   engineering-context verification to reject it by deterministic regeneration.
11. Prove persisted result bytes exclude the execution report while an explicit
   debug export round-trips deterministic stage/count/rejection data. Reject
   sourcing stages or constraints from both projections. Permute or duplicate
   rejections and require the exact parser to reject them; corrupt each
   otherwise-plausible count and require contextual regeneration to reject it.
   Reject every impossible stage/reason pairing in the correlated union. Prove
   `rejectedCandidates` is the exact multiplicity-preserving projection of all
   execution rejections, including two distinct rejections whose projections
   are byte-identical, and reject a missing or added projection.
12. Open every v2 Motor/Power candidate in Designer and Simulator; verify the
   selected graph/scenario, exact coverage tier and limitations, engine-ready
   state for executable scenarios, and absence of horizontal overflow at phone
   and desktop widths.
13. Export v2 electrical JSON, commercial overlay JSON, bundle JSON, BOM CSV,
    and per-scenario SPICE twice; require deterministic bytes and reject missing
    or mismatched overlay/scenario context. Incomplete SPICE export requires the
    explicit opt-in and includes exact limitation/omission comments.
14. Exercise every request/result/report, recipe/option/match/draft, per-candidate
    collection, string, classification/non-representation, and circuit ceiling
    at exactly the limit and one over. The limit passes. Prove individual hook
    excess remains `recipe_contract_invalid/<hook>`; cross-recipe aggregate,
    dedupe, Pareto, rank, final-result, and report excesses produce exactly their
    correlated no-recipe `resource_limit/<stage>` branch. Direct parser/import
    excess produces exactly `resource_limit/parse/<artifact>` and never a
    generation union member. Reject every impossible resource
    code/stage/recipe-ID combination. All failures occur before unbounded
    canonicalization/allocation with no truncation or partial artifact. Repeat
    adversarial nested-object tests for cycles, accessors, depth, node count,
    pre-parse transport bytes, and total canonical bytes.
15. Do not release either production wrapper on synthetic or empty catalogs.
    For each application, load only independently reviewed, hash-matching
    ADR-0003 profiles through the public bundled context, run at least one
    production request with `supportedRecipes > 0`, `candidates.length > 0`, and
    all survivors structurally materialized, then complete the UI/export smoke.
    Synthetic adapter fixtures remain test-only and cannot satisfy this gate.

## Consequences

One coordinated v2 boundary is larger than independently shipping circuit and
sourcing changes, but it avoids an immediate result v3 and makes the trust
boundary auditable. Current v1 callers remain functional. New v2 callers get
editable multi-graph circuits and scenarios, an electrical-only deterministic
result, and a commercially useful overlay without allowing volatile offers to
rewrite engineering facts.

The production Motor and Power V2 wrappers are also blocked until their bundled
contexts contain independently reviewed, hash-matching ADR-0003 profiles and
pass non-vacuous gate 15; an empty result or synthetic fixture is not a wrapper
milestone. The production trusted subcircuit registry remains a separate blocker
for executable scenarios, and live distributor permissions remain a separate
commercial blocker. None is weakened or implied by this schema decision.
