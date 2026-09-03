# ADR-0002: CircuitDocument v2 design blocks and executable scenarios

> Superseded for persisted-format versioning by [ADR-0013](0013-separate-simulator-v3-and-designer-v4-circuit-formats.md). The unpublished multi-circuit draft described here is released as Designer V4 so Simulator's legacy flat V2 remains unambiguous.

> **2026-09-04 historical clarification:** ADR-0013 supersedes this ADR's version assignment. The multi-circuit document shipped as Designer V4, while flat Simulator V1 and V2 documents migrate to Simulator V3; all V2 API and future-implementation statements below are historical. In particular, the exact single-card `Ioc_<hexId> ... PULSE(...)` and `@ioc_<hexId>[i]` assertions are historical: shipped V3/V4 netlisting inserts a private zero-volt current sensor and reads its branch vector while preserving positive current direction from pin 0 to pin 1.

- Status: Accepted; core schema, validation, netlist, and test-registry boundary implemented
- Date: 2026-08-23
- Scope: `@opencircuit/circuit-schema`, `@opencircuit/sim-engine`, the future `@opencircuit/design-schema` version seam, scheMAGIC Designer materializers, and simulation consumers
- Supersedes: no v1 behavior; this adds an explicitly versioned v2 document

## Context

The frozen [`CircuitDocument` v1 type](../../packages/circuit-schema/src/types.ts) stores one graph and one `SimConfig`. Its component geometry comes from a fixed primitive catalog, and its generic `CircuitComponent.params` is an open record. The current [`generateNetlist`](../../packages/circuit-schema/src/netlist.ts) supports those primitives, sorts components and wires deterministically, and emits one analysis command. [`@opencircuit/sim-engine`](../../packages/sim-engine/src/netlist.ts) currently re-exports that same circuit-schema netlist boundary rather than maintaining a second implementation.

That contract is sufficient for the current honest behavioral fixtures, but it leaves three shared gaps:

1. A selected multi-pin IC or authored functional block cannot be represented as itself. Motor materialization currently decomposes an H-bridge into static switches in [`materialize.ts`](../../packages/motor-designer/src/materialize.ts). Power materialization explicitly says the selected regulator or controller is not representable and substitutes generic switches and gate pulses in [`circuit.ts`](../../packages/power-designer/src/circuit.ts).
2. One engineering candidate cannot carry several named executable circuits and configurations. Motor therefore exposes only one averaged operating-point graph, while Power stores one transient configuration and marks load-step and line-step unavailable.
3. There is no pulsed current primitive for a deterministic electronic-load step.

There is also a security defect that must not be copied into v2. The v1 netlist helper accepts string component values and selected string `params`, trims them, and interpolates them into SPICE lines. V1 validation neither rejects control characters/newlines nor closes `params`. A shared document can therefore attempt to inject extra SPICE lines through a value or recognized parameter.

The minimal shared answer is a new circuit document version. It must remain application-neutral. Motor names, Power names, protection modes, control-loop facts, BOM roles, and design equations do not belong in this schema.

## Decision

### 1. Keep v1 exact and add a discriminated v2

The existing exported `CircuitDocument` name remains the current v1-only shape so current callers may continue to access root `.components`, `.probes`, `.sim`, and `.view` without a source break. `CircuitDocumentV1` is a new alias for that exact type. New code may opt into `CircuitDocumentV2` or the explicitly named union `AnyCircuitDocument`:

```ts
export interface CircuitDocument {
  format: "opencircuit-circuit";
  version: 1;
  meta: CircuitMeta;
  components: CircuitComponentV1[];
  wires: CircuitWire[];
  probes: CircuitProbeV1[];
  sim: SimConfigV1;
  view?: CircuitView;
}

export type CircuitDocumentV1 = CircuitDocument;
export type AnyCircuitDocument = CircuitDocumentV1 | CircuitDocumentV2;

export interface CircuitDocumentV2 {
  format: "opencircuit-circuit";
  version: 2;
  meta: CircuitMeta;
  designBlocks: DesignBlockDefinition[];
  circuits: CircuitGraphV2[];
  scenarios: SimulationScenarioV2[];
  defaultCircuitId: string;
  defaultScenarioId: string | null;
}

export interface CircuitGraphV2 {
  id: string;
  title: string;
  components: CircuitComponentV2[];
  wires: CircuitWire[];
  probes: CircuitProbeV2[];
  view?: CircuitView;
}

export interface CircuitView {
  pan: Point;
  zoom: number;
}

export type CircuitProbeTargetV2 =
  | { node: string; wire?: never; componentPin?: never }
  | { wire: string; node?: never; componentPin?: never }
  | { componentPin: [componentId: string, pin: number | string]; node?: never; wire?: never };

export interface CircuitProbeV2 {
  id: string;
  kind: "voltage" | "current" | "diff";
  target: CircuitProbeTargetV2;
  color?: string;
}
```

`defaultCircuitId` selects the graph shown when a document opens. It may be a presentation-quality schematic containing a schematic-only block. `defaultScenarioId` selects the initial executable scenario and may be `null` when the document intentionally has no executable scenario.

This separation is necessary. A visible selected IC and a behavioral simulation decomposition are not necessarily the same graph and must not masquerade as each other.

### 2. Add document-level pinned design block definitions

A design block is a generic multi-pin symbol definition. Instances reference the exact definition by ID, version, and content hash.

```ts
export type Sha256ContentHash = `sha256:${string}`;

export interface DesignBlockRef {
  id: string;
  version: string;
  contentHash: Sha256ContentHash;
}

export interface DesignBlockPin {
  id: string;
  name: string;
  offset: Point;
}

export interface TrustedSubcircuitRef {
  assetId: string;
  contentHash: Sha256ContentHash;
  entrypoint: string;
}

export type DesignBlockNetlistBehavior =
  | {
    kind: "schematic_only";
    reason: string;
  }
  | {
    kind: "spice_subcircuit";
    asset: TrustedSubcircuitRef;
    pinOrder: string[];
  };

export interface DesignBlockDefinition {
  id: string;
  version: string;
  contentHash: Sha256ContentHash;
  title: string;
  pins: DesignBlockPin[];
  netlist: DesignBlockNetlistBehavior;
}

export interface DesignBlockComponent extends CircuitComponentBaseV2 {
  type: "design_block";
  block: DesignBlockRef;
}
```

`contentHash` is SHA-256 over canonical JSON of the complete definition except `contentHash`. Every SHA-256 field matches `^sha256:[0-9a-f]{64}$`. Validation recomputes the definition hash. A well-formed hash string without matching content is invalid. SHA-256 is used here because this is a trust and asset-integrity boundary; the existing FNV-1a document hash remains a reproducibility/cache identifier, not a security primitive.

The hash API is explicit and uses UTF-8 bytes of the canonical payload:

```ts
export function canonicalDesignBlockPayload(
  definition: Omit<DesignBlockDefinition, "contentHash">,
): string;

export function calculateDesignBlockContentHash(
  definition: Omit<DesignBlockDefinition, "contentHash">,
): Sha256ContentHash;
```

`pins` is an ordered array for stable UI and `componentNodes` compatibility. Pin IDs are unique and are the durable reference. Pin offsets are integer grid points transformed by the existing rotation and mirror rules. `pinOrder` must be an exact permutation of the definition's pin IDs and gives the SPICE subcircuit node order.

Example definition and instance:

```json
{
  "definition": {
    "id": "control-module",
    "version": "1",
    "contentHash": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "title": "Control module",
    "pins": [
      { "id": "vin", "name": "VIN", "offset": [-2, -2] },
      { "id": "gnd", "name": "GND", "offset": [-2, 2] },
      { "id": "out", "name": "OUT", "offset": [2, 0] }
    ],
    "netlist": {
      "kind": "schematic_only",
      "reason": "No reviewed executable model is pinned"
    }
  },
  "instance": {
    "id": "u1",
    "type": "design_block",
    "block": {
      "id": "control-module",
      "version": "1",
      "contentHash": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    },
    "pos": [20, 16],
    "rot": 0,
    "mirror": false
  }
}
```

The placeholder hash in this example illustrates the required serialization pattern; a real definition must contain its calculated digest.

#### Netlist behavior

- `schematic_only` emits no component line and no model text. It is never silently replaced by a resistor, switch, generic semiconductor, or similarly shaped primitive. The generated result records an omission diagnostic containing scenario ID, circuit ID, component ID, block ID, and the authored reason. It has no `componentCurrents` entry.
- `spice_subcircuit` emits one `X...` instance with nodes in `pinOrder`. Its model text is not stored in the circuit document. A registry resolves an admitted asset by the exact requested ref, but every returned byte and metadata field is still untrusted until the netlist generator verifies it.
- Missing, mismatched, unsafe, or wrong-pin-count registry assets fail closed. There is no generic-model fallback.
- Verified model text is deduplicated by `contentHash` and emitted once in content-hash order before component instances. Two registry asset IDs may alias the same exact bytes, but they do not emit duplicate definitions.

The runtime boundary is synchronous and contains no URL or network behavior:

```ts
export interface RegistrySubcircuitAsset {
  ref: TrustedSubcircuitRef;
  canonicalText: string;
}

export interface TrustedSubcircuitRegistry {
  resolve(ref: TrustedSubcircuitRef): RegistrySubcircuitAsset | undefined;
}

export const DESIGN_BLOCK_MODEL_VERIFICATION = {
  maxInputBytes: 1_048_576,
  maxIncludeDepth: 0,
  maxSubcktDepth: 32,
  preserveComments: false,
} as const;
```

`generateScenarioNetlist` owns verification. For every distinct requested ref it performs these steps in order:

1. Require the returned `asset.ref` to equal the requested `{ assetId, contentHash, entrypoint }` field for field. Extra registry metadata has no authority.
2. Reject unpaired UTF-16 surrogates, then encode `canonicalText` as UTF-8 with no BOM. The text must use LF only, contain no CR or NUL, and end in exactly one LF. These encoded bytes are the canonical pre-namespace bytes used below.
3. Enforce the 1 MiB byte cap, then parse with `maxIncludeDepth: 0` and `maxSubcktDepth: 32` and sanitize with `preserveComments: false`.
4. Require zero parser warnings, zero removed statements, zero blocked reasons, and byte-for-byte equality between `canonicalText` and the sanitizer's `cleanText`. Registry text is therefore already canonical sanitized model text; the generator does not trust a provider claim that it is sanitized.
5. Derive the entrypoint and pin count from the parsed result. There must be exactly one top-level `.subckt`, its case-sensitive name must equal `ref.entrypoint`, and its derived pin count must equal the design block's `pinOrder.length`. No registry-supplied pin count is accepted.
6. Calculate SHA-256 over the exact pre-namespace UTF-8 bytes and require equality with `ref.contentHash`.
7. Only then namespace through the existing model-import emitter. The namespace is `ocblk_` followed by all 64 lowercase hash hex characters. The pre-namespace hash avoids a circular hash/name dependency.

After verification, assets are grouped by `contentHash`. Equal hashes must also have byte-identical canonical text and the same derived entrypoint; otherwise generation fails as a hash collision. One namespaced definition is emitted per verified hash. Asset IDs act only as registry lookup aliases and never enter the namespace or emission order.

A document cannot embed `sourceText`, `emittedText`, `.include`, a URL, a host path, or arbitrary raw netlist text.

This runtime registry seam does not put model text or a model-package reference into an engineering component profile. A reviewed design profile does not imply that a simulation asset exists, and a simulation asset does not upgrade profile evidence or review state. Linking component-library admission to model packages remains a separate schema decision.

### 3. Store named scenarios as references to graphs plus closed configs

One v2 document may contain several graphs and several scenarios. A scenario points to one graph and owns one explicit executable configuration:

```ts
export interface SimulationScenarioV2 {
  id: string;
  title: string;
  circuitId: string;
  config: ExecutableSimConfigV2;
}

export type ExecutableSimConfigV2 =
  | { mode: "op" }
  | {
    mode: "tran";
    tran: {
      tstop: number;
      tstep: number;
      maxstep: number;
    };
  }
  | {
    mode: "ac";
    ac: {
      fstart: number;
      fstop: number;
      pointsPerDecade: number;
      sweep: "dec";
    };
  }
  | {
    mode: "dc-sweep";
    dcSweep: DCSweepConfig;
  }
  | {
    mode: "noise";
    noise: NoiseConfig;
  };
```

`live` is editor state, not a persisted executable scenario mode. V2 has no top-level `sim`; there is one source of truth per scenario and no conflict between a root config and a scenario config.

Example scenario fields:

```json
{
  "circuits": [
    {
      "id": "main-schematic",
      "title": "Main schematic",
      "components": [
        { "id": "gnd", "type": "ground", "pos": [0, 0], "rot": 0, "mirror": false }
      ],
      "wires": [],
      "probes": []
    },
    {
      "id": "behavioral-load-step",
      "title": "Behavioral load-step graph",
      "components": [
        { "id": "gnd", "type": "ground", "pos": [0, 0], "rot": 0, "mirror": false }
      ],
      "wires": [],
      "probes": []
    }
  ],
  "scenarios": [
    {
      "id": "load_step",
      "title": "Load step",
      "circuitId": "behavioral-load-step",
      "config": {
        "mode": "tran",
        "tran": { "tstop": 0.01, "tstep": 0.00001, "maxstep": 0.00002 }
      }
    }
  ],
  "defaultCircuitId": "main-schematic",
  "defaultScenarioId": "load_step"
}
```

After the required design-schema version decision, one v2 document will still belong to one candidate; scenarios will not create or clone candidates. Scenario IDs align with `simulationCoverage[].scenarioId`. A coverage entry may remain `unavailable` without a scenario. A Designer result must reject a claim of `behavioral`, `reviewed`, or `user_imported` coverage unless a same-ID scenario generates successfully with zero schematic-only omissions. A same-ID scenario that produces `SCHEMATIC_ONLY_BLOCK_OMITTED` may still be inspected or run as an incomplete behavioral graph, but its coverage remains `unavailable` and exposes the omission reason.

The new entrypoint is separate from the v1 API to avoid treating an arbitrary scenario ID as the existing `requestedMode` string:

```ts
export interface ScenarioNetlistOptions {
  registry?: TrustedSubcircuitRegistry;
}

export interface NetlistOmission {
  code: "SCHEMATIC_ONLY_BLOCK_OMITTED";
  scenarioId: string;
  circuitId: string;
  componentId: string;
  blockId: string;
  reason: string;
}

export interface GeneratedScenarioNetlist extends GeneratedNetlist {
  scenarioId: string;
  circuitId: string;
  scenarioHash: string;
  serializationHash: string;
  componentPinNodes: Record<string, Record<string, string>>;
  omissions: NetlistOmission[];
}

export function generateScenarioNetlist(
  document: CircuitDocumentV2,
  scenarioId: string,
  options?: ScenarioNetlistOptions,
): GeneratedScenarioNetlist;
```

The existing `generateNetlist(documentV1, requestedMode?)` remains the v1 entrypoint. It does not guess a v2 scenario.

For a v2 result, the inherited `documentHash` field equals `scenarioHash` so existing execution plumbing receives the execution identity, not the editable-document identity. `serializationHash` identifies the complete saved v2 document. Only `scenarioHash` is emitted in the v2 netlist header.

### 4. Add an exact pulsed current primitive

V2 adds `isource_pulse`, the current-source analogue of `vsource_pulse`. It is sufficient for a deterministic electronic-load step without adding a Power-specific load component.

```ts
export interface PulsedCurrentParams {
  i1: number;
  i2: number;
  delay: number;
  rise: number;
  fall: number;
  width: number;
  period: number;
}

export interface PulsedCurrentSourceComponent extends CircuitComponentBaseV2 {
  type: "isource_pulse";
  params: PulsedCurrentParams;
}
```

All numbers are finite SI values: amperes and seconds. There are no string forms and no defaults. The emitted line is exactly:

```text
Ioc_<hexId> <positive-node> <negative-node> PULSE(i1 i2 delay rise fall width period)
```

`hexId` is the injective full component-ID encoding frozen in the determinism section below. The positive current direction is from pin 0 to pin 1, matching the existing `isource` node order. `componentCurrents[id]` uses `@ioc_<hexId>[i]`. Validation requires `delay >= 0`, `rise >= 0`, `fall >= 0`, `width > 0`, `period > 0`, and `rise + width + fall <= period`. A scenario referencing a graph containing `isource_pulse` must use `mode: "tran"` and must have `tstop > delay`.

Example:

```json
{
  "id": "load-step-source",
  "type": "isource_pulse",
  "params": {
    "i1": 0.3,
    "i2": 3,
    "delay": 0.002,
    "rise": 0.000001,
    "fall": 0.000001,
    "width": 0.003,
    "period": 0.008
  },
  "pos": [46, 20],
  "rot": 90,
  "mirror": false
}
```

### 5. Make v2 component simulation fields closed and keep annotations inert

V2 does not carry the open v1 `Record<string, unknown>` simulation boundary forward. Components use a discriminated union and only these simulation fields:

| Component type | Allowed simulation fields |
| --- | --- |
| `resistor`, `capacitor`, `inductor` | required `value: number | EngineeringLiteral` |
| `vsource`, `isource` | required `value: number | EngineeringLiteral`; `vsource.params.ac` is the only optional source parameter |
| `vsource_pulse` | required numeric or `EngineeringLiteral` `v1`, `v2`, `delay`, `rise`, `fall`, `width`, `period` |
| `vsource_sine` | required `value` amplitude and required `offset`/`frequency`; optional allowlisted `ac` |
| `isource_pulse` | required finite numeric `i1`, `i2`, `delay`, `rise`, `fall`, `width`, `period` as defined above |
| `switch_spst` | required `params.closed: boolean` |
| `potentiometer` | required `value`; required finite `params.t` with `0 < t < 1` |
| `diode`, `led`, `bjt_npn`, `bjt_pnp`, `nmos`, `pmos`, `opamp_ideal`, `ground` | no simulation `params` |
| `design_block` | required `block`; no simulation `params`, raw model, or override fields |

Application display metadata moves to an optional `annotations` field that is never inspected or emitted by the netlist generator:

```ts
export type JsonAnnotation =
  | null
  | boolean
  | number
  | string
  | JsonAnnotation[]
  | { [key: string]: JsonAnnotation };

export interface CircuitComponentBaseV2 {
  id: string;
  type: string;
  pos: Point;
  rot: Rotation;
  mirror: boolean;
  mpn?: string;
  label?: ComponentLabel;
  annotations?: { [key: string]: JsonAnnotation };
}

export type EngineeringLiteral = string;
export type EngineeringValue = number | EngineeringLiteral;

export interface PassiveComponentV2 extends CircuitComponentBaseV2 {
  type: "resistor" | "capacitor" | "inductor";
  value: EngineeringValue;
  params?: never;
}

export interface DcVoltageSourceComponentV2 extends CircuitComponentBaseV2 {
  type: "vsource";
  value: EngineeringValue;
  params?: { ac?: EngineeringValue };
}

export interface DcCurrentSourceComponentV2 extends CircuitComponentBaseV2 {
  type: "isource";
  value: EngineeringValue;
  params?: never;
}

export interface PulsedVoltageSourceComponentV2 extends CircuitComponentBaseV2 {
  type: "vsource_pulse";
  params: {
    v1: EngineeringValue;
    v2: EngineeringValue;
    delay: EngineeringValue;
    rise: EngineeringValue;
    fall: EngineeringValue;
    width: EngineeringValue;
    period: EngineeringValue;
  };
}

export interface SineVoltageSourceComponentV2 extends CircuitComponentBaseV2 {
  type: "vsource_sine";
  value: EngineeringValue;
  params: {
    offset: EngineeringValue;
    frequency: EngineeringValue;
    ac?: EngineeringValue;
  };
}

export interface SwitchComponentV2 extends CircuitComponentBaseV2 {
  type: "switch_spst";
  params: { closed: boolean };
}

export interface PotentiometerComponentV2 extends CircuitComponentBaseV2 {
  type: "potentiometer";
  value: EngineeringValue;
  params: { t: number };
}

export interface FixedModelComponentV2 extends CircuitComponentBaseV2 {
  type:
    | "diode"
    | "led"
    | "bjt_npn"
    | "bjt_pnp"
    | "nmos"
    | "pmos"
    | "opamp_ideal"
    | "ground";
  params?: never;
}

export type CircuitComponentV2 =
  | PassiveComponentV2
  | DcVoltageSourceComponentV2
  | DcCurrentSourceComponentV2
  | PulsedVoltageSourceComponentV2
  | SineVoltageSourceComponentV2
  | PulsedCurrentSourceComponent
  | SwitchComponentV2
  | PotentiometerComponentV2
  | FixedModelComponentV2
  | DesignBlockComponent;
```

`EngineeringLiteral` is an ASCII token matching:

```text
^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+|[TtGgKk]|[Mm][Ee][Gg]|[munpf])?$
```

All persisted v2 strings reject `U+0000` through `U+001F` and `U+007F`, including CR and LF. Token-like fields additionally reject all whitespace. IDs, block versions, pin IDs, registry IDs, entrypoints, string component values, and string simulation parameters must match their field allowlist. Registry `entrypoint` additionally matches `^[A-Za-z_][A-Za-z0-9_]{0,63}$`.

V2 objects are recursively closed. Unknown fields are validation errors with exact paths. Numbers must be finite. `annotations` values are inert JSON, limited to depth 16 and 64 KiB of canonical UTF-8 per component. They cannot affect connectivity, model lookup, pin order, `scenarioHash`, omission records, or emitted netlist text. They do affect the saved document's canonical bytes and `serializationHash`, so annotation edits are preserved and share/export integrity remains observable without changing execution identity.

The same strict token check is added to recognized v1 netlist values and parameters as a security hardening. Unsafe v1 documents fail validation/netlist generation with `UNSAFE_SPICE_TOKEN`; valid existing engineering literals remain byte-compatible. Unknown v1 `params` remain ignored for compatibility and never become netlist text.

### 6. Validate references and configurations before execution

V2 validation is recursive and fail-closed:

- The document is at most 4 MiB in canonical UTF-8.
- At most 64 circuits, 64 scenarios, and 256 design block definitions are allowed.
- A design block has 1 through 128 pins. A graph has at most 10,000 combined components, wires, and probes.
- IDs are non-empty safe tokens, unique in their scope, and no component/wire/probe ID is ambiguous within a graph.
- `defaultCircuitId` resolves. `defaultScenarioId` is `null` only when `scenarios` is empty; otherwise it resolves to exactly one scenario.
- Every scenario's `circuitId` resolves. Every component block ref resolves by exact `(id, version, contentHash)`.
- Definition hashes are recomputed. Pin IDs and pin offsets are valid; subcircuit `pinOrder` is a bijection over the pins.
- Probe targets use exactly one of node, wire, or component pin. Primitive pins may retain numeric indices; design block pins use stable string pin IDs.
- Each graph applies the current grid, orthogonal-wire, ground, DC sweep, and noise checks. Scenario configuration references are validated against that scenario's graph.
- `ExecutableSimConfigV2` is a closed discriminated union. Irrelevant config branches, hidden defaults, and `live` are rejected. Transient `tstop`, `tstep`, and `maxstep` are all required, finite, and greater than zero; `tstep` and `maxstep` cannot exceed `tstop`. AC frequencies are finite and positive with `fstart < fstop`, and `pointsPerDecade` is a positive integer. DC-sweep and noise retain their existing explicit direction and point-limit checks.
- Existing execution ceilings remain: generated netlists at most 1 MiB, DC sweep at most 50,000 points, noise at most 200,000 points, default rawfile at most 128 MiB, and default parsed samples at most 1,000,000. Trusted model input remains at most 1 MiB with the existing include and subcircuit-depth limits.

No validation rule infers an application. Whether a graph is a motor bridge, converter, filter, or another circuit is outside this package.

## Serialization, migration, and compatibility

### V1 read and write behavior

- V1 serialization remains `version: 1` with its existing root `components`, `wires`, `probes`, `sim`, and optional `view`.
- `canonicalizeCircuit(v1)` and safe v1 `generateNetlist` output remain byte-for-byte compatible.
- Existing `deserializeCircuit`, `migrateCircuit`, `validateCircuit`, `assertValidCircuit`, `canonicalizeCircuit`, and `generateNetlist` signatures remain v1-only and continue to return or accept `CircuitDocument`/`CircuitDocumentV1` exactly.
- V2 adds `deserializeCircuitV2`, `validateCircuitV2`, `assertValidCircuitV2`, and `canonicalizeCircuitV2`. The explicitly union-aware read helpers are named `deserializeAnyCircuit` and `canonicalizeAnyCircuit`; no existing API is widened silently.
- Old clients reject v2 rather than partially loading it. A version bump is honest; there is no implicit lossy downgrade.

```ts
export function deserializeCircuitV2(source: string): CircuitDocumentV2;
export function validateCircuitV2(document: CircuitDocumentV2): CircuitContractIssue[];
export function assertValidCircuitV2(document: CircuitDocumentV2): void;
export function canonicalizeCircuitV2(document: CircuitDocumentV2, includeView?: boolean): string;
export function deserializeAnyCircuit(source: string): AnyCircuitDocument;
export function canonicalizeAnyCircuit(document: AnyCircuitDocument, includeView?: boolean): string;
```

Current `DesignCandidate` and `DesignResult` schema version 1 continue to persist only the v1 `CircuitDocument`. Circuit-schema v2 may be implemented and tested independently, but no Designer candidate may serialize a v2 circuit until a separate `@opencircuit/design-schema` version/migration decision defines that persisted boundary. This ADR does not widen the frozen candidate field by type alias side effect.

### Explicit v1 to v2 upgrade

An explicit `upgradeCircuitV1ToV2` performs this deterministic mapping:

```ts
export function upgradeCircuitV1ToV2(input: CircuitDocumentV1): CircuitDocumentV2;
```

```json
{
  "designBlocks": [],
  "circuits": [
    {
      "id": "main",
      "title": "<v1 meta.title>",
      "components": "<v1 components after safe-field conversion>",
      "wires": "<v1 wires>",
      "probes": "<v1 probes>",
      "view": "<v1 view when present>"
    }
  ],
  "scenarios": [
    {
      "id": "default",
      "title": "Default",
      "circuitId": "main",
      "config": "<v1 sim after explicit-default expansion>"
    }
  ],
  "defaultCircuitId": "main",
  "defaultScenarioId": "default"
}
```

The angle-bracket strings above describe copied values; they are not literal upgrade output.

The upgrader expands every v1 netlist default into an explicit v2 value. The frozen conversions are:

| Omitted v1 field | Explicit v2 value |
| --- | --- |
| resistor/capacitor/inductor `value` | `1000` / `1e-7` / `1e-3` |
| DC voltage/current source `value` | `5` / `0.001` |
| voltage pulse fields | `v1: 0`, `v2: component.value ?? 5`, `delay: 0.001`, `rise: 0.00001`, `fall: 0.00001`, `width: 0.004`, `period: 0.01` |
| sine source fields | amplitude `component.value ?? 1`, `offset: 0`, `frequency: 1000` |
| switch `closed` | `false` |
| potentiometer `value` / `t` | `10000` / `0.5` |
| transient config | `tstop: 0.01`, `tstep: 0.00002`, `maxstep: 0.00005` for each missing field |
| AC config | `fstart: 10`, `fstop: 1000000`, `pointsPerDecade: 30`, `sweep: "dec"` |

For a v1 AC workspace, each voltage source gets explicit `params.ac` equal to its safe parsed v1 value or `1` when absent. Noise input amplitude remains the explicit fixed `AC 1` rule of `NoiseConfig.inputSourceId`, not a component default. Existing DC-sweep and noise migration helpers supply their already-frozen explicit configs.

V1 potentiometer conversion preserves current safe behavior exactly: a missing `t` becomes `0.5`; a finite number or control-free ASCII decimal string is converted with `Number`, then clamped to `[0.005, 0.995]`. Non-finite values, engineering suffixes, whitespace, and other strings reject the upgrade. Directly authored v2 `t` is never clamped and must satisfy `0 < t < 1`.

The upgrader keeps only the allowlisted simulation parameters. Other JSON-safe v1 `params` move to `annotations`; they cannot affect netlisting. Unsafe recognized values or parameters reject the upgrade instead of being trimmed, projected, or emitted. V1 `live` maps to an explicit `op` scenario because `live` has no standalone execution semantics.

There is no general v2 to v1 migration. An exporter may offer a separately named lossy operation only when the user selects one graph and one scenario and the graph contains neither `design_block` nor `isource_pulse`; it must otherwise refuse.

## Canonicalization and determinism

All v2 IDs match `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`. V2 ordering uses one total, locale-independent UTF-16 code-unit comparator for object keys and all ID/hash tuples:

```ts
export function compareCircuitV2Tokens(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}
```

The comparator is total for every persisted object key. For the ASCII-only ID, version, and hash tokens, it is also ASCII byte order. V2 does not call `localeCompare` and does not inherit host locale or numeric-collation behavior. V1 retains its current comparator and golden bytes.

V2 canonicalization keeps the current 12-significant-digit finite-number rule. It additionally:

- sorts object keys with `compareCircuitV2Tokens`;
- sorts `designBlocks` by `(id, version, contentHash)` using that comparator at each position;
- sorts `circuits` and `scenarios` by ID;
- sorts components, wires, and probes by ID inside each graph;
- preserves semantic array order for wire points, design block pins, `pinOrder`, and annotation arrays;
- removes every `CircuitGraphV2.view` when `includeView` is false.

`serializationHash` is FNV-1a over the complete canonical v2 document without views. It includes metadata, labels, annotations, default selections, and every graph/scenario so saved-document edits remain observable. It is returned as metadata but never emitted into a v2 netlist.

`scenarioHash` is FNV-1a over an explicit simulation projection containing:

1. the selected scenario ID and config;
2. the selected graph's ID, connectivity, wires, and probe semantics;
3. for each selected component, only `id`, `type`, `pos`, `rot`, `mirror`, `mpn`, allowlisted simulation `value`/`params`, and block ref;
4. every referenced design block's `(id, version, contentHash)`, pins, and netlist behavior;
5. every verified trusted subcircuit `contentHash`, derived entrypoint, and derived pin count.

The projection excludes document/graph/scenario titles, labels, colors, views, defaults, annotations, unselected graphs, and unselected scenarios. `GeneratedScenarioNetlist.documentHash` equals `scenarioHash`. The v2 title/header lines are exactly `scheMAGIC Simulator scenario <scenarioHash>` and `* scenario-hash <scenarioHash>`; no serialization hash or editable metadata enters emitted bytes.

Unrelated graphs, scenarios, display fields, and annotations do not change `scenarioHash`. Input order of the set-like arrays sorted above does not change either hash or generated netlist bytes; reordering a semantic array such as wire points, pins, `pinOrder`, or annotation values changes the hash whose projection includes it. Registry return order and asset-ID aliases do not affect model emission order.

V2 component element names use an injective encoding, not the v1 digit suffix. Let `hexId` be the two-lowercase-hex-digit UTF-8 encoding of every byte of the validated component ID. The emitted base name is `<SPICE-prefix>oc_<hexId>`, where the prefix is the existing element-class letter (`R`, `C`, `L`, `V`, `I`, `D`, `Q`, `M`, or `X`). A potentiometer's two internal elements append `_t` and `_b`. The generator derives every element name before emission and rejects any collision, including collisions with names introduced by a trusted namespaced asset. Because IDs are unique and ASCII and the full byte sequence is encoded, distinct component IDs cannot collapse as `r1` and `foo1` do under the v1 suffix helper.

Once a separate design-schema version permits v2 persistence, adding scenarios will not duplicate the candidate or its engineering facts. Adopting v2 changes the owning recipe's version/content hash, so any resulting candidate-ID change is explicit and deterministic under the existing design-engine identity rules.

## Failure modes

Validators and netlist entrypoints return or throw typed failures with stable codes and precise paths/IDs:

```ts
export type CircuitContractFailureCode =
  | "UNSUPPORTED_CIRCUIT_VERSION"
  | "UNKNOWN_FIELD"
  | "DUPLICATE_ID"
  | "INVALID_REFERENCE"
  | "BLOCK_HASH_MISMATCH"
  | "BLOCK_PIN_MAPPING_INVALID"
  | "UNSAFE_SPICE_TOKEN"
  | "INVALID_PULSE"
  | "INVALID_SIM_CONFIG"
  | "SCENARIO_NOT_FOUND"
  | "TRUSTED_MODEL_NOT_FOUND"
  | "TRUSTED_MODEL_REF_MISMATCH"
  | "TRUSTED_MODEL_NOT_CANONICAL"
  | "TRUSTED_MODEL_HASH_MISMATCH"
  | "TRUSTED_MODEL_HASH_COLLISION"
  | "TRUSTED_MODEL_ENTRYPOINT_INVALID"
  | "TRUSTED_MODEL_UNSAFE"
  | "TRUSTED_MODEL_PIN_MISMATCH"
  | "TRUSTED_MODEL_RESOLUTION_FAILED"
  | "EMITTED_NAME_COLLISION"
  | "EXECUTION_LIMIT";

export interface CircuitContractIssue {
  code: CircuitContractFailureCode;
  path: string;
  message: string;
  circuitId?: string;
  scenarioId?: string;
  componentId?: string;
  blockId?: string;
}

export class CircuitNetlistError extends Error {
  readonly issue: CircuitContractIssue;
}
```

| Code | Meaning |
| --- | --- |
| `UNSUPPORTED_CIRCUIT_VERSION` | The format/version discriminant is unsupported |
| `UNKNOWN_FIELD` | A v2 object contains a field outside its closed shape |
| `DUPLICATE_ID` | An ID is duplicated in its scope |
| `INVALID_REFERENCE` | A default, scenario, circuit, probe, pin, or block ref does not resolve |
| `BLOCK_HASH_MISMATCH` | A design block definition does not match its canonical SHA-256 |
| `BLOCK_PIN_MAPPING_INVALID` | Pins or `pinOrder` are missing, duplicated, or inconsistent |
| `UNSAFE_SPICE_TOKEN` | A netlisted token contains controls, whitespace, invalid syntax, or a non-finite value |
| `INVALID_PULSE` | Pulsed-source timing is incomplete or inconsistent |
| `INVALID_SIM_CONFIG` | A scenario config is incomplete, irrelevant to its mode, or incompatible with its graph |
| `SCENARIO_NOT_FOUND` | `generateScenarioNetlist` cannot find the requested scenario |
| `TRUSTED_MODEL_NOT_FOUND` | The exact registry asset is absent |
| `TRUSTED_MODEL_REF_MISMATCH` | Returned registry ref metadata differs from the exact requested ref |
| `TRUSTED_MODEL_NOT_CANONICAL` | Registry bytes are not strict UTF-8/LF or do not equal a clean fixed-option sanitizer round trip |
| `TRUSTED_MODEL_HASH_MISMATCH` | Registry bytes do not match the pinned SHA-256 |
| `TRUSTED_MODEL_HASH_COLLISION` | Equal claimed SHA-256 values resolve to different verified bytes or entrypoints |
| `TRUSTED_MODEL_ENTRYPOINT_INVALID` | The asset lacks exactly one matching top-level subcircuit |
| `TRUSTED_MODEL_UNSAFE` | The generator's fixed-option parse/sanitize or resource-limit checks fail |
| `TRUSTED_MODEL_PIN_MISMATCH` | The generator-derived subcircuit pin count does not match the block mapping |
| `TRUSTED_MODEL_RESOLUTION_FAILED` | Registry access throws, mutates an immutable request ref, or returns metadata that cannot be snapshotted safely |
| `EMITTED_NAME_COLLISION` | Two generated elements or a trusted model asset would emit the same SPICE identifier |
| `EXECUTION_LIMIT` | Document, netlist, sweep, rawfile, sample, or model limits are exceeded |

`SCHEMATIC_ONLY_BLOCK_OMITTED` is a structured omission diagnostic, not an emitted placeholder and not a trusted-model success. Consumers must display it with scenario limitations. Numerical convergence remains a separate sim-engine result and must not be confused with schema validity.

## Motor and Power reconciliation

The contract supports both tracks without application fields:

- Motor may use a design block for the selected integrated bridge or gate-driver boundary and keep its current averaged circuit as one named behavioral scenario. Additional stall, brake, or startup scenarios require honest graphs and models. V2 does not by itself create speed-coupled back-EMF, torque dynamics, protection, or a reviewed silicon model, so current unavailable claims remain unavailable until those models exist.
- Power may show the selected regulator/controller as a pinned schematic-only or trusted-subcircuit block in the default graph. Steady-state and startup may reference one behavioral graph with distinct configs. Load-step may reference an alternate graph using `isource_pulse`; line-step may reference an alternate graph using the existing voltage pulse. All scenarios remain inside the same engineering candidate.
- Both tracks use the same block, graph, scenario, pulse, validation, hash, and execution APIs. Recipe-owned IDs and limitations stay outside circuit-schema.

## Rejected alternatives

- **Add optional scenarios to v1:** makes old readers silently ignore electrical behavior and leaves ambiguous root `sim` precedence.
- **Store scenarios as separate candidates:** duplicates engineering facts, destabilizes comparisons, and lets simulation presentation alter candidate cardinality.
- **Inline a full circuit inside every scenario:** removes stable graph references and repeats common graphs/configuration.
- **Embed arbitrary SPICE text in a design block:** crosses an untrusted document directly into the simulator and duplicates the existing model-import security boundary.
- **Infer a generic primitive from pin count or symbol shape:** can produce a plausible but electrically false simulation.
- **Silently omit a schematic-only block without a diagnostic:** hides a modeling gap from the user.
- **Add `motor`, `buck`, `load_step`, or controller-specific component types:** couples a shared circuit contract to one recipe family.
- **Treat `live` as an executable persisted scenario:** conflates editor scheduling state with an analysis command.

## Acceptance tests required before implementation is called complete

### Circuit schema and migration

- All existing v1 canonical and netlist golden tests remain byte-identical.
- Type-level compatibility tests prove `CircuitDocument` and every existing v1 parser, validator, canonicalizer, migrator, and netlist entrypoint retain their v1-only signatures; only the newly named `AnyCircuitDocument` helpers accept the union.
- Valid v1 and v2 documents round-trip through the explicitly named union helpers without data loss, while old clients reject v2 rather than partially reading it.
- Design-schema version 1 continues to accept only a v1 nested circuit. A compile-time and runtime test prevents a v2 document from being persisted in `DesignCandidate`/`DesignResult` until the separate design-schema version decision lands.
- Explicit v1 to v2 upgrade produces the exact `main` graph and `default` scenario mapping, expands every frozen passive/source/pulse/sine/switch/potentiometer/transient/AC default, quarantines inert metadata, and rejects unsafe tokens.
- Potentiometer upgrade tests cover missing `t`, numeric and ASCII-decimal inputs, exact `[0.005, 0.995]` clamping, and rejection of whitespace, engineering suffixes, non-finite values, and other strings. Direct v2 values outside `0 < t < 1` reject rather than clamp.
- V2 recursively rejects unknown fields, non-finite values, duplicate IDs, bad refs, hash mismatches, bad pins, irrelevant config branches, control characters, CR/LF injection, and over-limit payloads.
- Transient scenarios reject a missing or non-positive `tstop`, `tstep`, or `maxstep`, and reject `tstep` or `maxstep` greater than `tstop`; there are no runtime transient defaults.
- Reordering definitions, graphs, scenarios, components, wires, or probes leaves canonical bytes, hashes, and netlists unchanged. Reordering pins or `pinOrder` changes the appropriate hash because it changes semantics.
- Comparator tests run under different host locales and numeric-collation settings and produce identical canonical bytes. IDs such as `r1` and `foo1` produce distinct injective v2 element names, and a pre-emission identifier collision fails with `EMITTED_NAME_COLLISION`.

### Design blocks and trusted models

- Arbitrary 2-pin, 3-pin, and 10-pin blocks have correct rotated/mirrored pin coordinates and stable pin-node lookup.
- A schematic-only instance emits no component/model line, returns exactly one omission diagnostic, and never acquires a generic substitute.
- A trusted subcircuit emits one namespaced model and one correctly ordered `X` line. Multiple instances and multiple asset-ID aliases for the same verified content hash emit the model text exactly once.
- When distinct block definitions reuse one exact trusted-asset ref, every definition independently matches its `pinOrder` length to the cached generator-derived pin count; ref deduplication cannot bypass `TRUSTED_MODEL_PIN_MISMATCH`.
- The generator, not the registry, enforces strict UTF-8/LF canonical bytes, independently re-parses and re-sanitizes with the frozen options, derives exactly one entrypoint and its pin count, verifies the pre-namespace SHA-256, and only then namespaces the model.
- Missing registry entries, returned-ref mismatch, noncanonical bytes, content mutation under an old well-formed hash, unsafe model content, zero/multiple/wrong entrypoints, and derived pin-count mismatch fail with the exact stable codes.
- A registry closure cannot mutate the caller document or the request ref after validation. Throwing resolvers, mutating resolvers, stateful getters, and unsnapshotable return values fail as `TRUSTED_MODEL_RESOLUTION_FAILED` without exposing untrusted thrown text.
- Two registry resolutions claiming one content hash but returning different canonical bytes or derived entrypoints fail as `TRUSTED_MODEL_HASH_COLLISION`; registry metadata and return order cannot change emitted bytes.
- Persisted raw netlist/model fields, URLs, includes, host paths, and command/control text are rejected.

### Scenarios and pulse source

- Two scenarios may reference the same graph with different configs; another scenario may reference a different graph. Each produces the intended analysis command and stable `scenarioHash` without cloning a candidate.
- Selecting a scenario never mutates the document, graph, config, registry, or caller input. Repeated runs are byte-stable.
- Editing labels, titles, colors, defaults, or annotations changes the full saved canonical bytes and `serializationHash`; editing a view changes only `includeView: true` serialization because views are excluded from that hash. Every such edit leaves the selected scenario's simulation projection, `scenarioHash`, header, omission records, and netlist bytes unchanged.
- Missing/default scenario behavior and `null` for a document with no scenarios are validated exactly.
- `isource_pulse` produces the exact ordered PULSE line, expected node connectivity/current vector, and deterministic transient output.
- Zero/negative timing, non-finite current, an overlong pulse, non-transient use, and `tstop <= delay` are rejected.

### Designer integration

- Every non-unavailable `SimulationCoverage.scenarioId` resolves to one same-ID scenario for which `generateScenarioNetlist` succeeds with zero omissions. A scenario with any `SCHEMATIC_ONLY_BLOCK_OMITTED` diagnostic can only support explicitly `unavailable` coverage carrying that limitation.
- A Motor candidate and a Power candidate each retain one candidate ID and one BOM while carrying multiple graphs/scenarios.
- Motor does not gain a startup/dynamic claim merely by moving to v2.
- Power load-step uses the generic pulsed current primitive and line-step uses generic source behavior; neither adds Power-specific circuit-schema fields.
- Native and browser/WASM runs consume the same generated scenario netlist and apply the existing convergence/tolerance gates before any numerical-validation claim.
- Simulator diagnostics recover the complete validated component comment ID, including safe spaces, punctuation, and Unicode, rather than truncating attribution to an ASCII prefix.

## Consequences

This decision is intentionally small in capability but strict at the boundary. It adds one document version, one generic block abstraction, one graph/scenario indirection, and one current pulse primitive. The core circuit-schema and sim-engine boundary is implemented. It preserves safe v1 behavior and does not claim that production models, Motor dynamics, Power control loops, Designer v2 persistence, or numerical validation are implemented.

Implementation updates circuit-schema first, then the sim-engine re-export/runner, then Designer materializers and coverage checks. The first two steps are complete; Designer v2 persistence and application materializers are governed by ADR-0005. No application track may invent a parallel serialized scenario or block format.

Schematic-only blocks, scenarios, and `isource_pulse` have no external dependency. Production use of `spice_subcircuit` additionally requires a trusted registry provider and a separate decision assigning ownership and packaging for sanitized content-addressed model assets. That dependency does not block the v2 schema or test-registry implementation and must not be resolved by embedding model text or adding model-package fields to engineering profiles.
