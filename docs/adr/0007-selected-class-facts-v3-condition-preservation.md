# ADR-0007: Selected-class facts-V3 condition preservation

- Status: Accepted
- Date: 2026-08-24

## Context

The frozen facts-V2 MOSFET and supply-TVS contracts cannot retain several common primary-source conditions without changing their meaning. MOSFET continuous-current and on-resistance ratings may be qualified by ambient or case temperature rather than junction temperature. Pulsed current needs both duration and duty cycle. TVS current, clamp voltage, and waveform must identify one exact test point; a manufacturer may publish no joule rating. Snapback devices can also have a maximum clamp voltage below maximum breakdown voltage without being semantically invalid.

Relabeling those conditions, combining facts from different test points, or deriving pulse energy as rectangular `V × I × t` would create unsupported engineering claims. Changing facts-V2 in place would break its frozen language-neutral contract.

## Decision

Add facts schema `3.0.0` only for:

- `shared.n-channel-power-mosfet`
- `motor.supply-tvs-diode`

The outer profile envelope remains `schemaVersion: "1.0.0"`. All other part classes remain on their existing facts versions.

MOSFET facts-V3:

- retains the published ambient, case, or junction temperature basis for on-resistance;
- requires drain current and gate voltage for on-resistance;
- requires pulse duration and duty cycle for pulsed drain current;
- leaves unrepresentable optional timing and recovery facts explicitly unknown.

TVS facts-V3:

- distinguishes `avalanche` and `snapback` clamping behavior;
- requires clamp voltage, pulse current, and waveform to share byte-identical ambient-temperature, pulse-duration, and test-current conditions and one primary-source content hash;
- accepts reviewed source pulse energy or explicit unknown only, never calculated or estimated energy;
- applies the breakdown/clamp ordering rule to avalanche devices but not snapback devices.

Mixed-version recipes must parse and bind each selected profile through its exact `(partClass, factsSchemaVersion)` codec. They cannot project, cast, or mutate V3 bytes into V2 shapes. V1 and V2 schemas and runtime behavior remain frozen.

## Compatibility locks

The frozen facts-V2 roots remain byte-identical:

- envelope: `sha256:d5d577bc81da5fe9904a7454845889a6dbc6902dcb2df0d51f8f8d26e058eaa4`
- profile: `sha256:374f075a13dc5ad4f3fef0a8191706779fb11d6b01c06a4c720151612c3d604e`

The checked-in facts-V3 roots are content addressed:

- envelope: `sha256:357ca04198194c1bc8435a9f1e51ed404486df2a7d2a88e7aff9f451cc39b830`
- profile: `sha256:e98cc6577456d8bbf815446e4a9b5c8be2a530c37962e7c9eecdfb78fff9e9e3`
- MOSFET class: `sha256:7eb61930d6fa96be5533d8acdc0afd4e5c745ff44d2cae5416f1c34c028e078c`
- TVS class: `sha256:1c03f24682b2c599e63f030f90134f2b60491270c00e2cfe9296c534e800331d`

Runtime/schema parity tests, exact-version dispatch tests, and release admission hashes lock the boundary.

## Consequences

- Primary-source conditions can be represented without semantic laundering.
- Facts-V2 consumers continue to receive unchanged bytes and behavior.
- Recipe coverage becomes explicitly mixed-version and per class.
- A reviewed V3 profile establishes evidence and selection eligibility only. It does not establish system TVS coordination, MOSFET SOA, gate-drive adequacy, provider availability, or selected-part simulation fidelity.
