# OpenCircuit modelling archetypes

Authoritative, mechanical specifications for every model package OpenCircuit ships. One archetype per file. A Phase 3/4 model-author agent picks the archetype from the decision table below, then follows that file literally.

Every ngspice construct in this directory was verified by execution against the pinned native reference (`/opt/homebrew/bin/ngspice`, ngspice-46 with KLU) on 2026-08-06. Where a construct is banned, the ban is an observed failure, not a style preference.

## Scope and authority

- Engine class: ngspice-46. **No XSPICE.** Every digital, latching, or event-driven behaviour is an analog behavioral subcircuit built from `B`, `E`, `G`, behavioral `R`, and passives.
- Fitting is deterministic Python (`numpy`/`scipy`). Parameters are produced by a documented solver run against recorded datasheet numbers. Parameters are never estimated by eye, by analogy to a similar part, or by a language model.
- Validation authority is `tools/native-ngspice-reference`. A model is accepted when `compare.mjs` passes and the F2 expectations in `tests/expectations.json` pass. Looking right in the browser is not acceptance.
- Package contract is `spikes/component-schema/component.schema.json` and `expectations.schema.json`. Every archetype file states the `domain_coverage` defaults and the `known_omissions` boilerplate that the package MUST carry.

## Decision table

| `electrical_family` | Archetype file | `model_type` | Fidelity ceiling | Ceiling reason |
|---|---|---|---|---|
| `diode` | [archetype-diode.md](archetype-diode.md) | `dot_model` | **F2** | Datasheet gives full IV, C, and recovery data. |
| `led` | [archetype-diode.md](archetype-diode.md) (LED variant) | `dot_model` | **F2 electrical, F1 optical** | Luminous output is not a SPICE quantity. |
| `bjt_npn`, `bjt_pnp` | [archetype-bjt.md](archetype-bjt.md) | `dot_model` | **F2** | Gummel-Poon is fully determined by standard datasheet curves. |
| `nmos`, `pmos` (power) | [archetype-vdmos.md](archetype-vdmos.md) | `dot_model` | **F2** | VDMOS is native and datasheet-complete. |
| `nmos`, `pmos` (small-signal, no VDMOS data) | [archetype-vdmos.md](archetype-vdmos.md) sec. 9 | `dot_model` | **F1** | Vth window only, no curve family published. |
| `jfet_n`, `jfet_p` | [archetype-jfet.md](archetype-jfet.md) | `dot_model` | **F2** | IDSS/VGS(off)/gfs pin the level-1 model exactly. |
| `opamp` | [archetype-opamp.md](archetype-opamp.md) | `subckt` | **F2** | Macromodel, small-signal and slew fitted; distortion is not modelled. |
| `comparator` | [archetype-comparator.md](archetype-comparator.md) | `subckt` | **F2** | tpd and output stage fitted; overdrive dispersion is single-point. |
| `vreg_linear` | [archetype-vreg.md](archetype-vreg.md) | `subckt` | **F2** | Behavioral loop; regulation, dropout, current limit fitted. |
| `logic_74hc` | [archetype-logic74hc.md](archetype-logic74hc.md) | `subckt` | **F1 digital, F2 dc/transient** | No XSPICE, so no true event semantics. |
| `timer` (555) | [archetype-timer555.md](archetype-timer555.md) | `subckt` | **F2** | Internal architecture reproduces the datasheet timing laws. |
| `oscillator` | [archetype-timer555.md](archetype-timer555.md) sec. 10 | `subckt` | **F1** | Free-running silicon oscillators lack published internals. |
| `resistor`, `capacitor`, `inductor`, `potentiometer`, `switch`, `source` | not an archetype; primitive | `builtin_primitive` | **F1** | Ideal primitives with tolerance metadata only. |

A ceiling is a **maximum**. A package claims the tier it actually earned. A package with no fitted parameters is F1 regardless of archetype.

## Where judgment is FORBIDDEN

This applies to every archetype without exception.

1. **No invented parameters.** If a parameter cannot be computed from a recorded datasheet quantity, it stays at the ngspice default and the package gains a `known_omissions` entry naming the parameter and the missing data.
2. **No borrowed parameters.** Never copy a value from a similar part, a vendor `.lib`, or a textbook table. Cross-part reuse is legal only for a documented die-sharing alias (for example `2N3904` and `MMBT3904`), and only when both packages cite the same die datasheet.
3. **No tolerance widening to force a pass.** If an expectation fails, either the fit is wrong or the expectation is wrong. Fix one of them and say which in `MODEL_CARD.md`. A tolerance may only be widened with a written cause naming the physical or solver effect.
4. **No undocumented curve reading.** Every number extracted from a datasheet figure is recorded in `sources.json` with the figure identifier and the axis units. A digitised point set is committed as data, not retyped into a model card.
5. **Every `expectations.json` check carries a non-empty `datasheet_citation`.** F2 and above are rejected by `validate.mjs` without one.

## Shared numerical hygiene (verified)

These are engine facts, confirmed by execution. Archetype files restate the ones that bite them.

| Rule | Verified observation |
|---|---|
| The first line of a netlist is the **title**, never a card. | A netlist starting with `V1 a 0 DC 3` silently loses `V1`; downstream `v(a)` becomes 0 and the run either misreports or fails to converge. |
| **`limit()` is BANNED.** | ngspice-46 parses `limit()` without error but does not clamp: `limit(7,0,5)` returns `7`; `limit(v(a)*10,-2,2)` with `v(a)=3` returns `0`. Use `min(max(x,lo),hi)`. |
| `if(...)` and `table(...)` do not exist in B-sources. | Hard error `no such function`. Use the ternary `cond ? a : b`. |
| A hard `min`/`max` clamp has **zero derivative** inside the clamp. | An opamp whose DC operating point sits at the rail reported an AC open-loop gain of -404 dB. Fix the bench (DC servo) or soften the clamp. |
| An abruptly switched behavioral resistor glitches. | `R={cond ? 1e9 : 60}` drove an open-collector output to -0.29 V against a 15 pF load. Blend the **conductance** with `tanh`. |
| A hard `min()` inside a feedback loop breaks the DC solver. | A regulator using `min()` for dropout selection emitted `Dynamic gmin stepping failed`. The smooth min `0.5*(a+b) - 0.5*sqrt((a-b)^2 + eps)` converged with no warnings. |
| `.print` cannot report `.op` results. | `.print op v(n1)` warns `can't parse 'n1'`; `.print v(n1)` warns `no nodes given`. Operating-point benches must use `-r out.raw` plus `.save`. |
| Batch mode with no `-r` and no `.print` fails. | `Error: incomplete or empty netlist ... or no ".plot", ".print", or ".fourier" lines in batch mode`. Always run with `-r`. |
| One analysis card per test netlist. | Multiple analyses in one file produce multiple plots in one rawfile; `expectations.json` binds one `analysis_type` per `test_netlist`. |

### `.save` and rawfile vector names

`.save @dev[param]` works in batch mode with no `.control` block. ngspice rewrites the vector name by quantity type. Author `expectations.json` expressions against the **rewritten** names:

| Authored in `.save` | Vector name in the rawfile |
|---|---|
| `@q1[ic]` | `i(@q1[ic])` |
| `@q1[vbe]` | `v(@q1[vbe])` |
| `@q1[gm]` | `@q1[gm]` |

### Parameter floors

Never ship a zero or a negative where the solver divides. Floors applied at the end of every fit:

| Quantity | Floor | Reason |
|---|---|---|
| Any series resistance (`RS`, `RD`, `RE`, `RC`, `RG`) | `1e-4` ohm | Zero resistance collapses onto an ideal node and defeats damping. |
| Any junction capacitance (`CJO`, `CJE`, `CJC`, `CGS`) | `1e-15` F | Zero capacitance removes the local time constant that bounds the timestep. |
| Any emission coefficient (`N`, `NF`, `NR`, `NE`, `NC`, `NBV`) | `1e-1` | Below this the exponential argument overflows before the diode conducts. |
| Any saturation current (`IS`, `ISR`, `ISE`, `ISC`) | `1e-20` A | Exactly zero disables the branch and can float a node. |
| Any behavioral off-resistance | `1e9` ohm, never `1e12` or higher | Above `1e9` the node relies on `gmin` alone and gmin stepping starts failing. |

## Shared file layout

Every package produced from an archetype is exactly:

```text
models/<manufacturer>/<mpn>/
  component.json        # component.schema.json, schema_version 1.0.0
  model.cir             # the fitted card or subckt, original work
  sources.json          # datasheet URL, revision, access date, pages, SHA-256
  MODEL_CARD.md         # fit method, residuals, every omission restated in prose
  LICENSE
  tests/*.cir           # one analysis card per file
  tests/expectations.json
```

`model.cir` opens with a provenance header and never contains a vendor-supplied card:

```spice
* OpenCircuit original-from-facts model
* <MPN> (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: <archetype-file>. Fitting run: <tools/model-factory run id>
* Node order: <stated explicitly>
```

## Shared fitting contract

Every archetype's fitting procedure obeys the same outer contract.

1. **Record** every datasheet quantity into a typed input table with value, unit, and the test conditions that make it meaningful. A number without conditions is not an input.
2. **Initialise** from the archetype's closed-form seed. Seeds are analytic, not guessed.
3. **Residuals are relative and in log space for currents.** For any current target, minimise `log(I_model) - log(I_target)`; for voltages and capacitances, minimise `(x_model - x_target)/x_target`. This stops a single high-current point from owning the fit.
4. **Solver**: `scipy.optimize.least_squares(method="trf", bounds=..., x_scale="jac", ftol=1e-12, xtol=1e-12, max_nfev=5000)`. `trf` is mandatory because every archetype has physical bounds.
5. **Fit in transformed coordinates**: parameters that span decades (`IS`, `ISR`, `BETA`, `KP`) are fitted as `log10` of the parameter so the solver sees a well-conditioned Jacobian.
6. **Converged** means `least_squares` returned `status > 0` **and** the worst relative residual is within the archetype's stated acceptance band. A solver that stops on `max_nfev` is a failure, not a result.
7. **Seed sweep**: rerun from at least three seeds spanning the bound range. If the fitted vectors disagree by more than 1 percent, the problem is under-determined; drop a parameter to its default, record a `known_omissions` entry, and refit.
8. **Record** `worst_observed_relative_fitting_error` with the quantity that produced it. This is a ratio, so `0.05` is 5 percent.
9. **When only table points exist and the figure is unavailable**, follow the archetype's degraded path. Every degraded path reduces the number of free parameters; it never reduces the number of recorded conditions.

## Default F2 acceptance tolerances

Archetype files override these where physics demands it. An override carries a written reason.

| Quantity class | Relative | Absolute floor |
|---|---|---|
| Junction forward voltage | 3 percent | 20 mV |
| Terminal current on a log sweep | 25 percent | 1 pA |
| Saturation voltage | 15 percent | 20 mV |
| Small-signal gain (dB) | 1 dB | 0.5 dB |
| Bandwidth, unity-gain frequency | 20 percent | 0 |
| Propagation delay, timing period | 15 percent | 1 ns |
| Capacitance at a stated bias | 20 percent | 0.5 pF |
| Regulation (line or load) | 30 percent | 5 mV |

Rationale for the loose current band: a datasheet log-axis figure cannot be read better than about 20 percent, so a tighter expectation would encode reading error as truth.

## Reading order for a model-author agent

1. `docs/MPN-TARGETS.md` for the frozen family assignment of the MPN.
2. This README for the decision table and the shared contract.
3. The one archetype file.
4. `spikes/component-schema/README.md` for the package rules.
5. Nothing else. If the archetype file does not answer a question, the answer is "default the parameter and record a `known_omissions` entry".
