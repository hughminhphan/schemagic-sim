# ADR-0014: Bound-typed facts-V3.5 fields

- Status: Accepted
- Date: 2026-09-02

## Context

Every facts contract up to `3.4.0` stores a single number per parameter with no way to say whether that number is a nominal, a nameplate rating, a typical observation, or a guaranteed production limit. The Power passive kernel therefore has to treat almost everything as an observation. Reviewed inductance is a nominal at one test point, not a minimum over tolerance, DC bias, temperature, and switching frequency. Reviewed MLCC capacitance is nameplate, not a minimum effective capacitance at the applied DC bias. Core loss and ESR are point characterizations, not maxima. Regulator minimum on-time, minimum off-time, and junction-to-ambient thermal resistance are published sometimes as guaranteed bounds and sometimes as typical or board-specific characteristics, and the `3.3.0` role fields record which without giving the kernel a separately typed bound to consume.

The consequence is visible in the release audit: rules that depend on a production bound stay `unknown`, and the Power buck fixture retains an exact BOM observation that can never become eligible. Closing those rules honestly requires evidence typed as a bound, not a looser reading of the evidence already present.

## Decision

Add exact facts schema `3.5.0` for three classes: `power.power-inductor`, `shared.mlcc-capacitor`, and `power.integrated-synchronous-buck-regulator`.

The outer profile envelope remains `schemaVersion: "1.0.0"`. Facts `3.5.0` adds optional bound-typed fields beside the predecessor observation fields, which keep their names, units, domains, admission states, and meanings:

| Class | Bound-typed field | Meaning |
| --- | --- | --- |
| `power.power-inductor` | `inductanceMinimum` | Guaranteed minimum inductance over tolerance, DC current bias, temperature, and switching frequency |
| `power.power-inductor` | `coreLossMaximum` | Guaranteed maximum core loss over the declared excitation |
| `shared.mlcc-capacitor` | `effectiveCapacitanceMinimum` | Guaranteed minimum effective capacitance at the declared DC bias and temperature |
| `shared.mlcc-capacitor` | `esrMaximum` | Guaranteed maximum ESR at the declared frequency |
| `power.integrated-synchronous-buck-regulator` | `minimumOnTimeMaximum` | Guaranteed maximum controllable on-time floor |
| `power.integrated-synchronous-buck-regulator` | `minimumOffTimeMaximum` | Guaranteed maximum enforced off-time floor |
| `power.integrated-synchronous-buck-regulator` | `thermalResistanceJunctionAmbient` | Junction-to-ambient thermal resistance, paired with the required `thermalResistanceJunctionAmbientBoard` qualifier (`jedec_2s2p` or `declared`) |

A bound is only a bound when its conditions are recorded, so each conditioned bound declares required operating ranges exactly as its observation predecessor does: `inductanceMinimum` requires `ambientTemperature`, `switchingFrequency`, and `testCurrent`; `coreLossMaximum` requires `switchingFrequency` and `testCurrent`; `effectiveCapacitanceMinimum` requires `ambientTemperature` and `dcBias`; `esrMaximum` requires `switchingFrequency`.

A bound-typed fact is either `reviewed` against published guaranteed evidence or `unknown`. `estimated` and `calculated` bounds are rejected, because a derived number must not be laundered into a guarantee. A bound may not contradict the observation it bounds: a declared minimum cannot exceed the reviewed nominal it derates from, and a declared maximum cannot fall below the reviewed point value it envelopes. A reviewed junction-to-ambient thermal resistance without a reviewed board qualifier fails closed, and a board qualifier without a thermal resistance is an orphan.

Every `3.3.0` role, pairing, and ordering rule for the regulator class and the `3.4.0` inclusive excitation policy for reviewed inductance carry forward unchanged.

## Migration policy

- Additive only. Every `3.5.0` field is optional; no predecessor field changes name, unit, domain, or meaning, and no bound-typed field is required for admission.
- No automatic migration. A `2.0.0` through `3.4.0` profile stays valid at its own version. Nothing rewrites it, and every predecessor validator keeps rejecting the `3.5.0` keys as unknown, so there is no silent upgrade. Adopting `3.5.0` is an explicit, independently reviewed re-authoring of one profile.
- Still closed. Unknown keys are rejected at `3.5.0` exactly as before, in both runtime validation and the generated JSON Schema.
- All 24 profiles in catalog release `2026-08-27.2` remain on their existing contracts and their bytes are unchanged. `3.5.0` admits no profile by itself.

The machine-readable form of this policy is `FACTS_V35_MIGRATION_POLICY` in `packages/design-library/src/v35-specs.ts`.

## Consumer boundary

The Power passive selection kernel consumes a bound-typed field as `condition_covering_bound` when it is present and its conditions cover the operating envelope. When the field is absent, behaviour is byte-for-byte unchanged: the predecessor nominal or point value is still projected as a `source_backed_observation`, and every downstream authority stays `observation`.

Adding a bound-typed field to a profile therefore changes what the kernel may prove about that exact part. It does not by itself prove candidate eligibility, stability, thermal suitability, sourcing, or selected-part simulation fidelity, and it grants no authority over parts that have not been re-authored at `3.5.0`.
