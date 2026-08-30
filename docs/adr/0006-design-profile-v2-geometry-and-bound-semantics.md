# ADR-0006: Design-profile facts V2 geometry and bound semantics

- Status: Accepted; core contract implemented and independently reviewed, with production admission still blocked
- Date: 2026-08-24
- Decision scope: additive class-facts semantics needed before real Motor or
  Power profile admission
- Depends on: [ADR-0003](0003-neutral-design-library-profile-and-admission-contract.md)
- Coordinates with: [ADR-0005](0005-designer-v2-result-and-circuit-boundary.md)

## Context

ADR-0003 and `@opencircuit/design-library` establish a strict V1 profile
envelope, evidence contract, admission ledger, catalog release, and exact-MPN
boundary. The checked-in production release intentionally contains zero reviewed
profiles.

Exact manufacturer-source research exposed two meanings that the first class-
facts schemas do not encode strongly enough for real admission:

1. `commonFacts.boardArea` does not say whether a number is package-body area,
   copper-pad sum, a recommended land-pattern bounding rectangle, or a reviewed
   assembly envelope. These are not interchangeable. None proves that a complete
   candidate can be placed or routed inside a board outline.
2. A scalar `ProfileFact<Quantity>` does not identify whether a datasheet value
   is a minimum, typical value, maximum, absolute rating, configurable endpoint,
   or recommended setting. Power feedback, current limit, timing, switching,
   loss, and thermal decisions require different bound directions. The current
   `numberFact()` helper erases those semantics and conditions.

These are active admission blockers. This ADR versions class facts inside the
already accepted profile envelope. It does not create a second profile envelope,
admission ledger, manufacturer registry, or catalog-release format.

## Decision

### 1. Freeze the envelope and version the selected class codec

The following remain byte- and source-compatible:

- `DesignProfileV1`, `DESIGN_PROFILE_SCHEMA_VERSION === "1.0.0"`, the V1
  envelope JSON Schema, canonical JSON, logical profile paths/IDs, and hashes;
- `ManufacturerRegistryV1`, `DesignProfileAdmissionLedgerV1`, and
  `DesignCatalogReleaseV1`, including their hash preimages and reviewed-loader
  rules;
- every facts schema `1.0.0`, V1 codec/parser/API alias, and synthetic adapter.

Add facts schema `2.0.0` under the same envelope:

```ts
export const FACTS_SCHEMA_VERSION_V2 = "2.0.0" as const;

export type DesignProfileWithFactsV2<
  ClassId extends PartClassId,
  Facts extends object,
> = Omit<DesignProfileV1<ClassId, Facts>, "factsSchemaVersion"> & {
  schemaVersion: "1.0.0";
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V2;
};

export type DesignProfileEnvelope =
  | DesignProfileV1
  | DesignProfileWithFactsV2<PartClassId, object>;
```

The existing `DesignProfileCodec<ClassId>`, `getDesignProfileCodec`, and
`DesignProfileFor<ClassId>` names remain the exact facts-V1 surface. Add this
facts-V2 surface rather than widening those aliases into an untyped union:

```ts
export type FactsV2For<ClassId extends PartClassId> =
  ClassId extends "power.integrated-synchronous-buck-regulator"
    ? PowerIntegratedSynchronousBuckFactsV2
    : ClassId extends "power.external-fet-synchronous-buck-controller"
      ? PowerExternalFetSynchronousBuckFactsV2
      : FactsFor<ClassId> & MountedGeometryFactsV2;

export interface DesignProfileFactsCodecV2<ClassId extends PartClassId> {
  partClass: ClassId;
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V2;
  validateFacts(
    input: unknown,
    manufacturer?: ManufacturerRegistryEntryV1,
  ): ValidationIssue[];
  parseFacts(
    input: unknown,
    manufacturer?: ManufacturerRegistryEntryV1,
  ): FactsV2For<ClassId>;
  validateAdmission(
    profile: DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>,
  ): ValidationIssue[];
}

export type VersionedDesignProfileCodec<ClassId extends PartClassId> =
  | DesignProfileCodec<ClassId>
  | DesignProfileFactsCodecV2<ClassId>;

export type DesignProfileForCodec<
  Codec extends VersionedDesignProfileCodec<PartClassId>,
> = Codec extends DesignProfileFactsCodecV2<infer ClassId>
  ? DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>
  : Codec extends DesignProfileCodec<infer ClassId>
    ? DesignProfileFor<ClassId>
    : never;

export function getDesignProfileCodecForVersion<
  ClassId extends PartClassId,
>(
  partClass: ClassId,
  factsSchemaVersion: "1.0.0",
): DesignProfileCodec<ClassId>;
export function getDesignProfileCodecForVersion<
  ClassId extends PartClassId,
>(
  partClass: ClassId,
  factsSchemaVersion: "2.0.0",
): DesignProfileFactsCodecV2<ClassId>;

export function parseDesignProfileEnvelope(
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileEnvelope;

export function validateDesignProfileEnvelope(
  input: unknown,
  registry?: ManufacturerRegistryV1,
): ValidationIssue[];

export function assertValidDesignProfileEnvelope(
  input: unknown,
  registry?: ManufacturerRegistryV1,
): asserts input is DesignProfileEnvelope;

export function canonicalDesignProfileEnvelope(
  profile: DesignProfileEnvelope,
): string;

export function designProfileEnvelopeContentHash(
  profile: DesignProfileEnvelope,
): `sha256:${string}`;

export function parseDesignProfileFor<ClassId extends PartClassId>(
  codec: DesignProfileCodec<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileFor<ClassId>;

export function parseDesignProfileForV2<ClassId extends PartClassId>(
  codec: DesignProfileFactsCodecV2<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>;

export interface ReviewedDesignLibraryEnvelope {
  version: string;
  contentHash: `sha256:${string}`;
  profiles: DesignProfileEnvelope[];
  diagnostics: string[];
}

export function loadReviewedDesignLibraryEnvelope(
  documents: DesignLibraryDocuments,
): ReviewedDesignLibraryEnvelope;
```

The first declaration above is the unchanged facts-V1 signature. The distinct
facts-V2 parser prevents a widened return type from breaking existing callers.
The facts-V2 codec registry has exactly twelve `(partClass, "2.0.0")` entries.
Callers cannot register codecs or ask a facts-V1 codec to parse facts-V2 bytes.

The checked-in V1 envelope/facts JSON Schemas remain byte-identical. Add the
language-neutral schema with `$id`
`https://schemas.schemagic.design/design-library/v1/profile-envelope.facts-v2.schema.json`
at `schema/profile-envelope.facts-v2.schema.json`, plus one schema with `$id`
`https://schemas.schemagic.design/design-library/v1/facts/<partClass>.v2.schema.json`
at `schema/facts/<partClass>.v2.schema.json` for every class. The additive
envelope has `schemaVersion: { const: "1.0.0" }` and
`factsSchemaVersion: { const: "2.0.0" }`; it may reference exact reusable
`$defs` inside the frozen V1 schema but never references or applies that
schema's root `factsSchemaVersion: 1.0.0` constraint. A descriptor-safe,
data-only snapshot reads the three dispatch fields once, selects the exact
tuple schema, and then performs full closed validation; it never tries schemas
until one passes.

The existing `loadReviewedDesignLibrary` return type and facts-V1 behavior
remain frozen. It rejects a release containing facts `2.0.0` as unsupported
rather than dropping or casting it. The additive
`loadReviewedDesignLibraryEnvelope` uses the same registry/ledger/release/hash/
chronology algorithm but the versioned profile parser, and it may return a
strictly profile-ID-sorted mix of reviewed facts versions. ADR-0005 uses this
additive loader.

Strict parsing dispatches on the exact tuple
`(schemaVersion, partClass, factsSchemaVersion)`. `schemaVersion` must remain
`"1.0.0"`; missing, unknown, mixed, or guessed facts versions fail. The versioned
codec registry is code-owned, closed, and independent of registration order.

The existing admission entry still pins the exact profile hash. Its existing
`class.<partClass>.facts_semantics` check is version-aware and covers all rules in
this ADR; no self-declared check IDs are added. The reviewed admission projection
and catalog hash algorithms are unchanged. A catalog ref resolves its profile
file, the loader parses that file with the tuple above, and the ref hash must
equal the parsed profile hash. Existing duplicate identity/path rules prevent
two facts versions of one logical profile in one ledger or release.

`ReviewedProfileCatalogV2.profiles` in ADR-0005 becomes
`DesignProfileEnvelope[]`. Its schema version and content-hash algorithm do not
change; each embedded profile is parsed by the versioned design-library codec.
No Motor/Power package may cast an open envelope to class facts.

The V1 manufacturer registry remains the exact evidence-host input for both
facts versions. Registry, admission, release, profile, and catalog chronology
checks remain authoritative.

### 2. Put typed mounted geometry inside facts schema V2

For all twelve classes, facts schema `2.0.0` contains one shared closed member:

```ts
export type BoardAreaBasisV2 =
  | "manufacturer_recommended_land_pattern_bounding_box"
  | "reviewed_assembly_footprint_bounding_box";

export interface BoardAreaDimensionTermV2 {
  axis: "x" | "y";
  dimensionId: string;
  multiplier: number;
  maximum: ProfileQuantity<"m">;
  evidence: ProfileEvidenceRef[];
}

export interface BoardAreaProjectionV2 {
  area: ProfileQuantity<"m2">;
  basis: BoardAreaBasisV2;
  calculation: "maximum_x_span_times_maximum_y_span";
  sourceDimensions: BoardAreaDimensionTermV2[];
}

export type MaximumHeightBasisV2 =
  | "manufacturer_package_maximum_in_surface_mount_orientation"
  | "reviewed_assembly_envelope_maximum";

export interface MaximumHeightProjectionV2 {
  height: ProfileQuantity<"m">;
  basis: MaximumHeightBasisV2;
}

export interface MountedGeometryFactsV2 {
  mountedGeometry: {
    boardArea: ProfileFact<BoardAreaProjectionV2>;
    maximumHeight: ProfileFact<MaximumHeightProjectionV2>;
  };
}
```

In a facts-V2 profile, legacy `commonFacts.packageName` remains a reviewed fact.
Legacy `commonFacts.boardArea` and `commonFacts.maximumHeight` must both be
explicit unknown facts. Production facts-V2 recipes read only
`facts.mountedGeometry`; a legacy scalar can neither pass nor rank.

The geometry grammar and arithmetic are exact:

- `dimensionId` matches `/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/`.
- `multiplier` is a positive safe integer.
- Every term maximum is finite and positive with unit `m` and a nonblank
  control-free `displayUnit`. Persisted area is finite and positive with unit
  `m2`; persisted height is finite and positive with unit `m`; both display
  units are nonblank and control-free.
- Terms are unique and strictly code-unit sorted by `(axis, dimensionId)`, with
  `x` before `y`; both axes have at least one term. Persisted reversed input is
  rejected, never normalized before hashing.
- `canonicalProfileNumberV2(value)` requires finite binary64, computes
  `Number(value.toPrecision(12))`, normalizes negative zero to zero, and rejects
  a non-finite input or result.
- Strict parsing preserves each already validated source quantity number exactly;
  it never rounds manufacturer observations. `canonicalProfileNumberV2` applies
  only at the derived arithmetic steps explicitly named by this ADR.
- For each axis execute `span = 0`, then for each term on that axis execute
  `product = canon(term.multiplier * term.maximum.value)` and
  `span = canon(span + product)`. Execute `area = canon(xSpan * ySpan)`. The
  persisted `area.value` must equal that result exactly.
- `boardArea.state` is `calculated`, `validFor` is empty, and its outer evidence
  is the strictly canonical-byte-sorted unique union of all term evidence. Every
  term has non-empty evidence. The parser validates both copies and exact union
  equality; it never invokes accessors or strips duplicates.
- `maximumHeight.state` is `reviewed`, `validFor` is empty, and its outer
  evidence is non-empty. A calculated, estimated, unknown, or ranged height is
  not admission-eligible.
- Manufacturer land-pattern basis accepts only exact-host manufacturer evidence
  for maximum recommended-land dimensions. Reviewed assembly basis accepts only
  trusted independent-measurement evidence fixing the exact footprint.
- Manufacturer package-height basis requires exact-host manufacturer evidence
  for a maximum dimension in the surface-mount placement orientation. Reviewed
  assembly-height basis requires trusted independent-measurement evidence fixing
  mounting, lead forming, and orientation. Nominal body dimensions, authored
  prose, wrong-host evidence, and unfixed axial mounting cannot pass.
- V2 evidence discovery recursively walks outer fact evidence, term evidence,
  height evidence, and every claim/condition evidence. URL/host/publication,
  content hash, retrieval time, review time, and release chronology checks apply
  at each exact nested path.

This supports deterministic per-part land-pattern proxy calculations such as TDK
`A + 2B` by `C`, Coilcraft gap plus two lands by width, and Vishay `X` by `Z`.
It does not prove placement or routing. The sum may be used only as a labelled
electrical-ranking proxy. A request with `maximumBoardArea` produces a hard
unknown constraint until a separately versioned candidate-level PCB placement
artifact proves outline, courtyard, keep-out, and routing fit; it cannot pass by
summing part rectangles.

### 3. Add conditioned, bound-bearing Power claims

```ts
export type QuantityClaimKindV2 =
  | "guaranteed_minimum"
  | "typical"
  | "guaranteed_maximum"
  | "absolute_maximum"
  | "recommended";

export type QuantityClaimBasisV2 =
  | "operating_range"
  | "production_spread"
  | "configurable_range"
  | "normal_operation_rating"
  | "absolute_rating"
  | "recommended_setting"
  | "test_characteristic";

export type ProfileConditionV2 =
  | {
      parameterId: string;
      kind: "quantity_range";
      minimum: ProfileQuantity | null;
      maximum: ProfileQuantity | null;
      evidence: ProfileEvidenceRef[];
    }
  | {
      parameterId: string;
      kind: "token_equals";
      value: string;
      evidence: ProfileEvidenceRef[];
    };

export interface ProfileQuantityClaimV2<Unit extends ProfileUnit> {
  claimKind: QuantityClaimKindV2;
  basis: QuantityClaimBasisV2;
  value: ProfileQuantity<Unit> | null;
  state: "reviewed" | "calculated" | "estimated" | "unknown";
  evidence: ProfileEvidenceRef[];
  validFor: ProfileConditionV2[];
  explanation: string;
}
```

Conditions are unique and strictly code-unit sorted by `parameterId`; one claim
cannot repeat a parameter. Quantity ranges use at least one bound, matching
units, and inclusive endpoints. Token values and parameter IDs match
`/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/`. Unknown claims have null value, no
evidence, and no conditions. Known claims require non-empty admissible outer
evidence, and every condition independently requires non-empty admissible
evidence for its applicability range or token. Known min/typ/max groups have
equal units, byte-identical conditions, and ordered values.

Power primary facts schema `2.0.0` contains `MountedGeometryFactsV2` plus these
exact required claim groups:

| Group | Required claim semantics |
| --- | --- |
| input/output voltage | guaranteed minimum and maximum, operating range |
| integrated output-current capability | guaranteed minimum usable capability, normal-operation rating |
| integrated current limit | minimum, typical, maximum, production spread |
| switching frequency | guaranteed minimum/maximum plus recommended setting |
| minimum on/off time | guaranteed maximum, production spread |
| feedback reference | minimum, typical, maximum, production spread |
| quiescent current | guaranteed maximum, production spread |
| thermal resistance | guaranteed maximum, test characteristic with required board/temperature conditions |
| maximum junction temperature | absolute maximum, absolute rating |
| integrated switch resistance | high/low-side guaranteed maxima with switch-current/junction-temperature conditions |
| integrated rise/fall time | optional guaranteed maxima; unknown is admissible but cannot prove switching loss |
| control evidence basis | reviewed text fact required for every claimed control/stability metric |

The versioned codec requires these exact condition parameter IDs. An empty list
means that the reviewed evidence must state the claim across its published
rating domain; it does not let an author omit a condition printed by the source.
Profiles may add further evidence-backed conditions. Every listed parameter must
occur exactly once, and all conditions remain strictly sorted.

The closed parameter vocabulary is:

| Parameter | Condition kind and unit |
| --- | --- |
| `ambient-temperature` | quantity range, `K` |
| `board-layout` | token equality |
| `input-voltage` | quantity range, `V` |
| `junction-temperature` | quantity range, `K` |
| `operating-mode` | token equality |
| `output-current` | quantity range, `A` |
| `output-voltage` | quantity range, `V` |
| `switch-current` | quantity range, `A` |
| `switching-frequency` | quantity range, `Hz` |

Temperature, voltage, output-voltage, and switching-frequency condition bounds
are finite positive numbers. Output-current and switch-current bounds are finite
non-negative numbers. Negative zero rejects in every persisted numeric domain.

| Claim fields | Required condition parameters |
| --- | --- |
| input-voltage minimum/maximum, maximum junction temperature | none |
| output-voltage minimum/maximum, current-limit min/typ/max, switching-frequency min/recommended/max | `input-voltage` |
| integrated output-current minimum | `input-voltage`, `output-voltage` |
| minimum on/off-time maxima | `input-voltage`, `junction-temperature` |
| feedback-reference min/typ/max | `junction-temperature` |
| quiescent-current maximum | `input-voltage`, `junction-temperature`, `operating-mode` |
| junction-to-ambient thermal-resistance maximum | `ambient-temperature`, `board-layout` |
| integrated high/low-side resistance maxima | `junction-temperature`, `switch-current` |
| integrated rise/fall-time maxima | `input-voltage`, `output-current` |
| external gate source/sink current minima | `input-voltage` |
| external gate pull-up/pull-down resistance maxima, dead-time maximum | `junction-temperature` |
| external controller-loss maximum | `input-voltage`, `output-current`, `switching-frequency` |
| every current-sense or gate-drive configured-spread min/typ/max | `input-voltage`, `junction-temperature` |

For an external controller, replace scalar current-sense claims with:

```ts
export interface ConfiguredProductionSpreadV2<Unit extends ProfileUnit> {
  settingId: string;
  setting: ProfileFact<string>;
  minimum: QuantityClaimV2<Unit, "guaranteed_minimum", "production_spread">;
  typical: QuantityClaimV2<Unit, "typical", "production_spread">;
  maximum: QuantityClaimV2<Unit, "guaranteed_maximum", "production_spread">;
}

currentSenseThresholdOptions: ConfiguredProductionSpreadV2<"V">[];
gateDriveVoltageOptions: ConfiguredProductionSpreadV2<"V">[];
```

Options are non-empty, unique, and code-unit sorted by `settingId`, which
matches `/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/`. Each `setting` fact is reviewed
with a non-null value using that same electrical-token grammar, non-empty admissible
evidence, and empty `validFor`; unknown, estimated, calculated, or ranged
settings reject. Every evidence ref on the setting must occur byte-identically
in each non-unknown minimum, typical, and maximum claim for that option. The
three contained claims satisfy the same required-condition and
production-spread group rules. The recipe enumerates an exact setting before
feasibility; `settingId`
enters option data, candidate identity, constraints, and evidence. A selectable
range is never relabeled as production spread. External facts also require switching/timing,
feedback, quiescent-current, thermal, maximum-junction, dead-time, and each of
the two reviewed source/sink capability OR groups below. Controller-loss claims are
optional unknown until an estimate uses them.

Admission state rules are exact:

- every geometry fact and every table row above other than explicitly optional
  timing/loss fields and the unused alternatives in the gate-capability OR
  groups below is required for admission;
- required claims and text facts are `reviewed`; `estimated` or `calculated`
  guaranteed bounds cannot enter a release;
- the sole calculated admission fact is mounted `boardArea`, whose reviewed
  inputs and fixed derivation are checked as above;
- optional unknown claims permit admission but can never produce a numeric
  accessor result or improve rank;
- external gate capability has two independent OR groups: source requires
  reviewed `gateSourceCurrentMinimum` or reviewed
  `gatePullupResistanceMaximum`; sink requires reviewed
  `gateSinkCurrentMinimum` or reviewed `gatePulldownResistanceMaximum`. The
  unused alternative may be explicit unknown. Current-only, resistance-only,
  and mixed source/sink representations are admissible; an all-unknown group is
  not;
- non-Power classes use their existing required V1 class-fact table plus required
  V2 mounted geometry. Motor scalar hard-limit fields retain the conservative
  meanings encoded by their names; typical-only capability data is inadmissible.

All Power claim values are finite and use the exact unit in the type table.
Voltage, frequency, capability/current-limit/gate-current, thermal-resistance,
and maximum-junction claims are positive. Quiescent current, switch resistance,
timing, dead time, and loss claims are non-negative. Negative zero rejects.

### 4. Make condition evaluation and semantic accessors closed

The design-library owns arithmetic, types, versioned codecs, condition checking,
and semantic claim accessors. It must not import `design-recipes` or
`design-engine`. `design-recipes` may import design-library and schemas;
`design-engine` composes both. A dependency-boundary test enforces this direction.

```ts
export type ClaimConditionValueV2 = Readonly<
  | {
      parameterId: string;
      kind: "quantity_range";
      minimum: ProfileQuantity;
      maximum: ProfileQuantity;
    }
  | { parameterId: string; kind: "token"; value: string }
>;

export interface ClaimEvaluationContextV2 {
  values: ClaimConditionValueV2[];
}

export interface PowerClaimCandidateConditionStateV2 {
  selectedSwitchingFrequency: ProfileQuantity<"Hz"> | null;
  switchCurrent: Readonly<{
    minimum: ProfileQuantity<"A">;
    maximum: ProfileQuantity<"A">;
  }> | null;
  operatingMode: string | null;
  boardLayout: null;
}

export declare function buildPowerClaimEvaluationContextV2(
  request: Readonly<BuckDesignRequestV2>,
  state: Readonly<PowerClaimCandidateConditionStateV2>,
): Readonly<ClaimEvaluationContextV2>;

export type ClaimResolutionV2<Unit extends ProfileUnit> =
  | Readonly<{
      status: "known";
      quantity: ProfileQuantity<Unit>;
      evidence: ProfileEvidenceRef[];
      conditions: ProfileConditionV2[];
    }>
  | Readonly<{
      status: "unknown";
      reason: "claim_unknown" | "claim_not_reviewed" | "missing_condition" | "condition_out_of_range";
      parameterId: string | null;
    }>;
```

Context values are unique and code-unit sorted by parameter ID. A quantity
context is a finite, unit-matched closed interval with `minimum <= maximum`; a
point is encoded with equal endpoints. The versioned class spec declares
required condition parameters for each field. The accessor requires every
declared condition interval and returns known only when the claim interval is
an inclusive superset: a non-null claim minimum is `<=` the requested minimum
and a non-null claim maximum is `>=` the requested maximum. Partial overlap,
wrong units/kinds, missing context, or a token mismatch returns the exact
closed unknown result.
It returns known only for `reviewed` claims of the exact required kind/basis.
There is no ambient boolean or profile-authored assumption override. A future
override requires a separately accepted, parsed, request-hash-bound assumption
contract.

Every Power recipe obtains context only through
`buildPowerClaimEvaluationContextV2`; it cannot hand-author a convenient point.
The projection is exact:

| Parameter | Projection |
| --- | --- |
| `ambient-temperature` | request ambient point as equal endpoints |
| `input-voltage` | request minimum through maximum |
| `junction-temperature` | request ambient through maximum allowed junction temperature; actual thermal feasibility remains a separate proof |
| `output-current` | zero through request maximum output current |
| `output-voltage` | request output point as equal endpoints |
| `switching-frequency` | selected candidate frequency as equal endpoints; omitted before selection |
| `switch-current` | derived candidate minimum/maximum; omitted until derived |
| `operating-mode` | exact selected candidate token; omitted before selection |
| `board-layout` | reserved for a future separately versioned placement-artifact capability; this version requires `null` and omits it |

An omitted derived entry makes a claim requiring it hard unknown. A non-null
bare `boardLayout` token rejects; no recipe may self-assert placement proof. The builder
validates units, finite/order domains, tokens, and request consistency, returns
a detached frozen sorted context, and is covered by request/candidate hashes
through its inputs; it does not persist a second authority field.

The exact public accessors are:

```ts
export declare function guaranteedLowerEndpoint<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit>;
export declare function guaranteedUpperEndpoint<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit>;
export declare function guaranteedMinimumCapability<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit>;
export declare function worstCaseProductionMaximum<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit>;
export declare function worstCaseProductionMinimum<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit>;
export declare function worstCaseCharacteristicMaximum<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit>;
export declare function typicalProductionTarget<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit>;
export declare function recommendedSettingTarget<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit>;
export declare function absoluteMaximumRating<Unit extends ProfileUnit>(claim: ProfileQuantityClaimV2<Unit>, context: Readonly<ClaimEvaluationContextV2>): ClaimResolutionV2<Unit>;
```

Wrong kind/basis is a codec error, not unknown. Configurable option selection is
performed first; its contained production-spread claims then use these accessors.

### 5. Freeze Power feedback-divider selection and corners

The code-owned tolerance is `POWER_OUTPUT_VOLTAGE_TOLERANCE_V2 = 0.01`. Candidate
resistor profiles are code-unit sorted by `designProfileId`. Enumerate every
ordered `(upper, lower)` pair, including the same profile in both roles.

For nominal resistance `R` and reviewed tolerance `t`, require finite
`0 <= t < 1`; `t >= 1`, a negative/non-finite tolerance, or non-positive
resistance hard-rejects before arithmetic. Then execute:

```text
oneMinusT = canon(1 - t)
onePlusT  = canon(1 + t)
Rmin      = canon(R * oneMinusT)
Rmax      = canon(R * onePlusT)
ratio     = canon(Rupper / Rlower)
gain      = canon(1 + ratio)
Vout      = canon(Vref * gain)
error     = canon(abs(canon(Vout - requestedVout)))
threshold = canon(max(canon(abs(requestedVout) * 0.01), 1e-9))
```

Nominal selection uses nominal resistances and feedback typical. Sort pairs by
`(nominalError ascending, upperProfileId code-unit ascending,
lowerProfileId code-unit ascending)` and take the first. If typical is unknown,
no pair is selected and the recipe emits a hard unknown.

For the selected pair, low corner uses feedback minimum, upper `Rmin`, and lower
`Rmax`; high corner uses feedback maximum, upper `Rmax`, and lower `Rmin`. Run
the exact operation sequence above. Both corner errors must be `<= threshold`.
Equality passes. Missing feedback minimum/maximum or reviewed resistor tolerance
is hard unknown; an exceeded corner rejects. Nominal pass alone never passes.

Current-limit feasibility uses only guaranteed minimum. Minimum on/off-time and
loss/thermal proof use the relevant worst-case maximum. Recommended switching
frequency cannot widen guaranteed endpoints.

### 6. Migration is an authored upgrade plan, not inference

```ts
export interface DesignProfileFactsV2AuthoringOverrides {
  mountedGeometry: MountedGeometryFactsV2["mountedGeometry"] | null;
  powerClaims:
    | Omit<PowerIntegratedSynchronousBuckFactsV2, "mountedGeometry">
    | Omit<PowerExternalFetSynchronousBuckFactsV2, "mountedGeometry">
    | null;
}

export type DesignProfileFactsV1ToV2MigrationPlan = Readonly<{
  status: "needs_evidence" | "ready_for_authored_v2";
  sourceProfileId: string;
  unresolvedPaths: string[];
  draft: DesignProfileWithFactsV2<PartClassId, object> | null;
}>;

export declare function planDesignProfileFactsV1ToV2(
  input: unknown,
  overrides: unknown,
  registry: ManufacturerRegistryV1,
): DesignProfileFactsV1ToV2MigrationPlan
```

The function strictly parses V1 first and strictly parses the closed override.
Overrides may supply only `mountedGeometry` and the exact class's facts-V2 claim
fields; they cannot replace identity, package name, evidence registry, or
admission metadata. Legacy numeric board area and prose-only height never acquire
a basis. Ambiguous Power scalar values never acquire a claim kind.

For a non-Power class, the function copies the already parsed facts-V1 class
fields byte-for-byte and accepts only the mounted-geometry override;
`powerClaims` must be null. For either Power class, `powerClaims` must match that
exact class and no scalar V1 Power field is copied into a V2 claim. Unknown or
cross-class override keys reject before a draft is constructed.

When non-null, the draft is a detached, strictly parsed facts-V2 profile with
explicit unknowns where the schema permits them. The draft is null whenever a
structurally mandatory value cannot be represented without invention, including
an absent configured option/setting for an external controller.
`unresolvedPaths` is exactly the unique RFC 6901 JSON
pointer for every admission-required geometry fact, claim, text fact, configured
option group, required condition, or evidence set that remains absent, unknown,
unreviewed, estimated, calculated where not explicitly allowed, or otherwise
inadmissible. It excludes the optional rise/fall/controller-loss fields whose
explicit unknown state is admission-permitted and an unused unknown gate-
capability alternative when its OR group is satisfied. If a source group is
unsatisfied, both `/facts/gateSourceCurrentMinimum` and
`/facts/gatePullupResistanceMaximum` occur; if a sink group is unsatisfied,
both `/facts/gateSinkCurrentMinimum` and
`/facts/gatePulldownResistanceMaximum` occur. The list is strictly
code-unit sorted. Status is `ready_for_authored_v2` iff `draft` is non-null and
the list is empty; otherwise it is `needs_evidence`. The helper returns no ledger mutation. Any
caller-created entry remains `authored` until the existing independent-review
and hash checks pass.

### 7. Compatibility inventory and release gates

Before implementation, check in a V1 compatibility inventory containing hashes
for every V1 schema file, canonical fixture/profile/release bytes, reviewed-loader
projection, and root public export name/signature golden. Existing names and
signatures are frozen; additive exports explicitly named in this ADR are allowed.
The same inventory runs
before and after every facts-V2 change.

Acceptance must also prove:

1. Tuple dispatch rejects missing, mixed, guessed, and unknown facts versions;
   codec-registration and filesystem order cannot change bytes.
2. Legacy common board-area/height values cannot pass or rank a facts-V2 profile.
3. TDK, Coilcraft, and Vishay geometry goldens use the exact accumulator above;
   reversed/duplicate terms, missing axes, `-0`, overflow, and a long-mantissa/
   large-safe-multiplier discriminator reject or match literal golden bytes and
   hashes as specified. Missing, duplicated, unsorted, or non-union outer
   board-area evidence rejects.
4. Nested term/height evidence wrong host, URL, hash, retrieval time, or review/
   release chronology fails at its exact path. Axial prose cannot create height.
5. Calculated geometry passes admission only with reviewed inputs; estimated
   bounds, one missing required claim, and all-unknown required groups fail;
   optional unknown timing/loss claims remain excluded from numeric access.
   Every claim unit, finite/domain/`-0` rule, min/typ/max order, and
   byte-identical condition-group rule is exercised.
   External gate-capability current-only, resistance-only, and mixed groups
   pass, while all-unknown source or sink groups fail with exact migration paths.
6. Condition order/duplicates, empty condition evidence, missing request
   context, unit mismatch, partial-overlap intervals, out-of-range intervals,
   and token mismatch fail or return the exact closed unknown result. Every
   accessor rejects its wrong kind/basis and returns the exact result for
   unknown/unreviewed claims. The request/candidate context projection is
   golden-tested, including malformed/non-finite/wrong-unit request and
   candidate values that do not happen to enter the final context.
7. A selectable current-sense option is enumerated and hash-bound; changing its
   setting changes candidate identity. Empty/duplicate/unsorted options, bad
   setting IDs or values, unreviewed/ranged settings, missing setting evidence
   in any non-unknown claim, unreviewed spread claims, inconsistent spread
   order/conditions, and configurable-range relabeling reject.
8. Feedback nominal, exact-one-percent boundary, min/max corner failure, missing
   typical/min/max, resistor-tolerance extremes, equal-error ties, and reversed
   catalog order produce fixed candidates, constraints, bytes, and hashes;
   tolerance `1` rejects before zero-resistance or division.
9. A V1 Power profile cannot pass the production facts-V2 recipe through
   `numberFact()` or a cast.
10. Migration rejects unknown and cross-class overrides, preserves exact
    identity, copies non-Power V1 facts byte-for-byte, never projects a Power
    scalar into a claim, and produces the exact sorted unique unresolved-path
    membership with `status` iff semantics. Prose-only geometry remains
    unresolved; absent external configured settings produce `draft: null`; no
    review/admission metadata is carried.
11. The unchanged V1 ledger/release resolves a reviewed facts-V2 profile only
    when path, identity, exact profile hash, class codec, registry hash, admission
    hash, chronology, and every existing admission check pass. The V1 loader
    rejects facts V2; the additive loader accepts a profile-ID-sorted mixed
    release with an independently recomputed stable catalog hash.
12. `maximumBoardArea` remains hard unknown without candidate-level placement;
    land-pattern sum is labelled only as a ranking proxy.
13. Dependency-boundary and full V1 compatibility inventories pass.
14. Commercial/provider/authorization/model/raw payload state remains forbidden
    exactly as in ADR-0003.

## Release consequence

This ADR does not unblock production by itself. The public Motor and Power
wrappers remain blocked while the bundled release has zero reviewed profiles.
The six researched passive identities remain reservations and the authored
Vishay diode remains excluded. Provider manifests stay disabled. A production-
ready claim requires implemented versioned codecs/accessors, independent
contract and profile review, a non-empty hash-pinned catalog, non-vacuous native
generation, and the existing UI/export/execution gates.

## Subsequent reviewed profile correction

Catalog release `2026-08-25.16` replaces only the exact reviewed bytes for
Bourns `CR0603-FX-1003ELF` and Vishay `CRCW0603732KFKEA`; the reviewed
profile count remains twenty. Each corrected facts-V2 profile claims 0.10 W
continuous power only from 25 °C through 70 °C ambient, with locators covering
both the applicable rating table and the flat manufacturer derating segment.
Pulse power remains unknown, no thermal extrapolation is created, and the
Vishay profile binds every evidence reference to the current official
Rev. 14-Apr-2026 PDF bytes. The envelope, facts-V2 schema, admission checks,
catalog hash algorithm, profile identities, and all other profile bytes remain
unchanged.
