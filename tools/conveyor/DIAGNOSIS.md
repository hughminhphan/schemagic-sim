# Conveyor proving-50 diagnosis: why 0/50 parts reached F2

Tranche: `proving-50` (18 diodes, 16 BJTs, 16 MOSFETs).
Evidence: `data/staging/proving-50/factory-results.json`, `data/conveyor-state.sqlite3`,
the 50 preserved extraction JSON files, and `tools/model-factory/lib/bulk-adapter.mjs`.

## Verdict

**Cause (c), fitter defects in the generic multi-curve path, is what the evidence supports.**
It is not a close call. The bulk adapter never ran a fit worth gating:

- **MOSFET (16/16 parts): no F2 code path exists.** `mosfetFit()` opens with an
  unconditional `throw` whenever curves are usable. Zero MOSFETs were ever fitted.
- **BJT (16/16 parts): no F2 return path exists.** `bjtFit()` can only ever
  `return { fidelity: "F1", ... }`. Even a part that passes its gate is staged F1.
- **Diode (18 parts): the fitter selects curves by name substring** and ignores declared
  axis quantities, axis units, and test conditions. It also omits `RS`, which the
  checked-in diode archetype requires.

Cause (a), gates being too strict for sparse digitized curves, is **not** supported: the
diode gate is only reached after a fit so broken that the residual is meaningless, and
once the fitter is corrected the same 8% gate is passed comfortably by most parts
(table 4). Cause (b), extraction quality, is supported for **exactly 3 of 50 parts**
(section 5) and is a rounding error next to (c).

Only **6 of 50 parts were ever evaluated at all**. Family parking (2 failures parks a
family) fired on the first two parts of each family, so 44 parts were staged F1 without
any fit attempt. "0/50" is really "0/6 attempted, 44 never tried".

---

## 1. Where the failures concentrate

Demotion reasons from `factory-results.json`, all 50 rows, all `F1`:

| Count | Demotion reason (truncated) | Real meaning |
| ---: | --- | --- |
| 14 | `MOSFET F2 native multi-curve residual gate is not yet proven for generic conveyor inputs` | hardcoded refusal, no fit |
| 14 | `BJT F2 residual gate failed: constant-BF seed worst=...` | category error, see §3 |
| 18 | `diode F2 residual gate failed: N=..., IS=..., worst=...` | broken fit, see §2 |
| 2 | `cross-validation failed after one retry: vdmos.*` | false catalog discrepancy, see §5 |
| 1 | supplied datasheet has no curve for the unselected BC847 type | honest F1, correct |
| 44 of the above | also carry `family parked after two F2 fit-gate failures` | never attempted |

The failures do **not** concentrate in a quantity or a residual magnitude band. They
concentrate in *code paths*: one family throws, one family cannot return F2, one family
regresses the wrong data.

---

## 2. Diodes: the fitter regresses whatever curve happens to contain the word "forward"

`quantityValues(extraction, ["forward", "iv"])` returns the **first curve whose `name`
contains "forward" or "iv"**. It never reads `x_axis.quantity`, `y_axis.quantity`,
`*_axis.unit`, or `test_conditions`.

### 2.1 Wrong-curve selection

`SS36-E3/57T` (`C35722`) is the extreme case. Its first name match is:

```
Fig. 1 - Forward Current Derating Curve, SS32 through SS36
  x = lead temperature (degC, linear)  ->  y = average forward rectified current (A, linear)
  points: (0,3.0) (50,3.0) (100,3.0) (120,3.0) (135,1.5) (150,0.0)
```

That is a **thermal derating curve**, not an I-V curve. The fitter regressed junction
temperature against derated current and reported it as diode physics:

```
N = -2511.267091134278   IS = 11.999999999999996 A   worst = 0.7999999999999997
```

A negative ideality factor and a 12 A saturation current are not "barely over a gate";
they are proof that the input was never an I-V curve. The datasheet does carry the right
curve — `Fig. 3 - Typical Instantaneous Forward Characteristics ... TJ = 25 degC`, 7
points — three entries further down the list. The extraction was fine.

### 2.2 Declared units are ignored

`quantityValues()` reads `point.y` as a bare number. Two diodes declare their current
axis in **mA** and are read as **A**, a 1000x error in `IS`:

| Part | `y_axis.unit` | Effect |
| --- | --- | --- |
| `BAT54C,215` | `mA` | `IS` reported as 7.7e-3 (gate requires <= 1e-6) |
| `BAV99LT1G` | `mA` | `IS` reported as 1.7e-3 |

The extractions are honest: they *declare* the unit. The scale error is introduced by
the fitter.

### 2.3 No series resistance, so `N` absorbs `RS`

The checked-in archetype (`tools/model-factory/archetypes/diode.md`) says: *"Fit `IS`,
`N`, and `RS` to at least three forward current and voltage points at a stated
temperature."* The bulk adapter instead does an unweighted straight-line regression of
V on ln(I) and **hardcodes `RS = 1e-4`**.

Real forward curves span the exponential region *and* the resistive knee. With no `RS`
term the apparent ideality factor inflates to absorb the knee, pushing `N` out of the
`[0.8, 4]` band and inflating the residual. Fitting `IS`, `N`, `RS` to the *same
extracted points*, per the archetype (`V = N*Vt*ln1p(I/IS) + I*RS`), collapses the error:

| Part | old `N` | old worst | new `N` | new `RS` (ohm) | new worst | new RMS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BAS316,115 | 3.14 | 0.117 | 1.994 | 0.947 | **0.022** | 0.014 |
| BAS16H,115 | 8.37 | 0.053 | 0.800 | 1.73 | **0.030** | 0.017 |
| S1M-13-F | 4.07 | 0.127 | 2.027 | 0.041 | **0.020** | 0.014 |
| BAT54SLT1G | 1.79 | 0.764 | 1.372 | 0.857 | **0.001** | 0.001 |
| BAS321,115 | 5.58 | 0.074 | 1.104 | 0.808 | **0.001** | 0.001 |
| BAV99,215 | 3.86 | 0.043 | 3.027 | 0.810 | **0.042** | 0.022 |
| BAV70,215 | 4.24 | 0.133 | 2.277 | 0.773 | **0.009** | 0.006 |
| MMBD7000LT1G | 2.34 | 0.053 | 1.872 | 1.03 | **0.019** | 0.011 |
| **SS36-E3/57T** | **-2511** | **0.800** | **1.217** | **0.011** | **0.012** | **0.007** |
| BAT54C,215 | 3.29 | 0.091 | 3.390 | 0.018 | 0.105 | 0.047 |
| PMEG4010ESBYL | 1.04 | 0.276 | 0.800 | 0.126 | 0.295 | 0.140 |
| BAT54L,315 | 2.64 | 0.159 | 1.068 | 2.08 | **0.020** | 0.012 |
| 1N4148WS-7-F | 3.02 | 0.041 | 1.908 | 1.17 | **0.006** | 0.004 |
| LL4148-GS08 | 3.60 | 0.175 | 2.344 | 500 (pinned) | 0.049 | 0.028 |
| BAV70LT1G | 1.99 | 0.051 | 1.670 | 0.926 | **0.009** | 0.006 |
| BAV99LT1G | 2.52 | 0.117 | 2.092 | 0.140 | **0.051** | 0.027 |
| 1N5819HW-7-F | 1.01 | 0.028 | 0.808 | 0.247 | **0.000** | 0.000 |
| 1N4148W-7-F | 2.55 | 0.022 | 2.187 | 0.503 | **0.008** | 0.006 |

(`new` = semantic curve selection + declared-unit normalisation + 3-parameter archetype
fit, residual in volts, same extracted points.)

**13 of 18 diodes land under 5% worst voltage error on the identical extraction data
that produced a 0/18 pass rate.** This is the signature of cause (c), not (a): the gate
did not need loosening, the fit needed fixing. It is emphatically not the "broad
barely-over" pattern that cause (a) would produce — the old residuals span 2.2% to 80%
with no clustering near the 8% threshold.

Two of the remaining five (`LL4148-GS08` with `RS` pinned at its 500 ohm bound,
`BAS16H,115` with `N` pinned at 0.8) show a *new* defect class the old code could not
even expose: the optimizer parking a parameter on a bound is not a valid fit and must be
rejected as a physicality failure, not accepted because the residual looks small.

---

## 3. BJTs: the "gate" is a category error, and there is no F2 path behind it

```js
function bjtFit(part, extraction, forceF1 = false) {
  const gains = extraction?.specs?.gain_points?.map((p) => Number(p.hfe.value)) ?? [];
  if (!forceF1 && extraction?.usable_curves && gains.length >= 4) {
    const BF = Math.max(...gains);
    const worst = Math.max(...gains.map((gain) => Math.abs(BF - gain) / gain));
    if (worst >= 0.25) throw new Error(`BJT F2 residual gate failed: constant-BF seed worst=${worst}`);
  }
  const BF = ...;
  return { fidelity: "F1", ... };   // <-- the only return. F2 is unreachable.
}
```

Two independent defects:

1. **Unreachable F2.** There is no `fidelity: "F2"` anywhere in the function. Passing the
   gate changes nothing. `BC847,215` and `PBSS4160T,215` have fewer than 4 gain points,
   skip the gate entirely, and are *still* staged F1.

2. **The gate asks a question physics answers "no" to.** It measures the spread of hFE
   and demands it be under 25%, i.e. it demands hFE be constant. hFE is *not* constant in
   collector current — the roll-off is exactly what `IKF` and `ISE` exist to model.
   Worse, `gain_points` mixes `source_kind` values, so the residual compares a
   **minimum-spec** hFE against a **maximum-spec** hFE for a different bias:

| Part | `source_kind` values present | gains fed to the gate | reported worst |
| --- | --- | --- | ---: |
| MMBT4401LT1G | maximum, minimum | 20, 40, 80, 100, 300, 40 | 14 |
| BC817-40,215 | digitized_typical_curve, maximum, minimum | 375, 375, 370, 350, 120, 250, 600, 40 | 14 |
| PMBT4403,215 | digitized_typical_curve, maximum, minimum | 30, 60, 100, 100, 300, 20, 290, ... | 14 |
| MMBT2222ALT1G | digitized_typical_curve, maximum, minimum | 50, 100, 180, 100, 300, 40 | 6.5 |
| BC846B,215 | digitized_typical_curve, typical | 290, 290, 280, 270, 220, 145 | 1.0 |

`worst = 14` means "the max-spec hFE is 15x the min-spec hFE", which is a normal
datasheet spread, not a fit error. **14 of 16 BJTs fail this gate; all 16 stage F1
regardless.**

The extractions themselves carry exactly what a real fit needs — e.g. `MMBT4401LT1G`
has a digitized `DC current gain, VCE = 1.0 V, TA = 25 degC` curve with 8 points from
10 mA to 700 mA, plus VBE(on), VCE(sat) and capacitance curves.

---

## 4. MOSFETs: the F2 path is a hardcoded refusal

```js
function mosfetFit(part, extraction, forceF1 = false) {
  if (!forceF1 && extraction?.usable_curves)
    throw new Error("MOSFET F2 native multi-curve residual gate is not yet proven for generic conveyor inputs");
```

No residual is computed, because no fit is attempted. Every F1 MOSFET is built from
scalar table values with `KP = 2/rdson`, `THETA = 0`, `LAMBDA = 0.003` held constant.

The data that was thrown away, per part:

| Part | curves | transfer | output | cap | rdson |
| --- | ---: | ---: | ---: | ---: | ---: |
| SI2301CDS-T1-GE3 | 8 | 1 | 3 | 1 | 0 |
| DMP2035U-7 | 8 | 1 | 3 | 1 | 0 |
| 2N7002KT1G | 7 | 2 | 4 | 3 | 0 |
| DMP3098L-7 | 8 | 1 | 3 | 3 | 0 |
| FDV301N | 11 | 1 | 7 | 3 | 0 |
| 2N7002LT1G | 11 | 1 | 0 | 0 | 1 |
| STL90N10F7 | 10 | 1 | 3 | 1 | 1 |
| BSS84AKM,315 | 10 | 3 | 6 | 3 | 0 |
| 2N7002,215 | 7 | 1 | 3 | 3 | 0 |
| BSS123LT1G | 14 | 2 | 1 | 3 | 2 |
| 2N7002K-T1-GE3 | 7 | 1 | 3 | 1 | 0 |
| BSS138LT1G | 5 | 1 | 3 | 1 | 0 |
| **2N7002DW-7-F** | **3** | **0** | **0** | **0** | **0** |
| 2N7002K-7 | 4 | 1 | 3 | 0 | 0 |
| 2N7002-7-F | 4 | 1 | 3 | 0 | 0 |
| BSS84-7-F | 9 | 1 | 5 | 3 | 0 |

14 of 16 carry both a transfer curve and at least one output curve, which is the minimum
set the VDMOS archetype needs for a DC fit. Only `2N7002DW-7-F` genuinely lacks the data.

---

## 5. Where cause (b) *is* real: 3 parts

Extraction quality is a genuine but small contributor.

### 5.1 Non-monotonic digitised segments (2 parts)

`2N7002LT1G` (`C16338`), Fig. 1 ohmic-region traces. Drain current must be
non-decreasing in VDS at fixed VGS. Two traces violate that:

```
VGS = 3 V : (0,0) (2, 0.07) (5, 0.05) (10, 0.05)   <-- 0.07 -> 0.05 falling
VGS = 4 V : (0,0) (2, 0.18) (5, 0.15) (10, 0.15)   <-- 0.18 -> 0.15 falling
VGS = 5 V : (0,0) (2, 0.30) (5, 0.37) (10, 0.37)   ok
... VGS = 6..10 V all monotonic
```

The VGS = 3 V and 4 V traces are digitisation errors; the remaining six are usable. The
correct response is to **exclude the two bad traces and fit the rest**, not to reject the
part — and, critically, the current pipeline has no validator that would notice either
way.

`PMEG4010ESBYL` (`C478156`) has a non-monotonic forward I-V curve, which is why its
corrected fit still sits at 29.5% worst error (table in §2.3). That part is an honest
extraction failure and should be demoted to F1-from-parametrics with that reason stated.

### 5.2 Catalog cross-check false positives (2 parts, and this is a *pipeline* defect)

Both MOSFET "cross-validation failed" demotions are wrong.

**`DMP2035U-7` (`C110499`) — clear false positive.** Two catalog hints map to
`vdmos.rds_on`:

| hint attribute | `raw_value` | agrees with extracted `[0.023, 0.030, 0.041]`? |
| --- | --- | --- |
| `Drain Source On Resistance (RDS(on)@Vgs,Id)` | `45Ω@2.5V,4.0A` | no — 1097x |
| `RDS(on)` | `23mΩ@4.5V, 30mΩ@2.5V, 41mΩ@1.8V` | **exactly, all three** |

The catalog holds the same parameter twice and one copy has lost its milli prefix. The
extraction is corroborated to three significant figures by the other copy. `cross_check()`
flags **any** disagreeing hint, so one corrupt catalog row vetoes a perfectly
corroborated extraction. The fix is a corroboration rule: a target with at least one
agreeing hint is corroborated.

**`DMP3098L-7` (`C150492`) — decided by floating-point noise.** Catalog `147pF` vs
extracted `4.9e-11`:

```
1.47e-10 / 4.9e-11 = 3.0000000000000004   ->  > 3.0  -> FLAGGED
2.10e-10 / 7.0e-11 = 2.9999999999999996   ->  <= 3.0 -> not flagged   (Coss, same part)
```

Coss is off by the identical factor and escaped only through float representation. The
stated limit is 3.0x and neither ratio exceeds 3.0x in exact arithmetic; the gate needs a
relative epsilon so its behaviour matches its specification. (Independently: this part's
extracted Ciss 336 pF matches the catalog exactly while Coss and Crss are both off by
exactly 3.0x, which points at the catalog row, not the extraction. Crss remains recorded
as an open discrepancy for the review lane.)

---

## 6. Amplification: family parking hid the blast radius

`fit_command()` parks a family after two F2 gate failures. Because every family fails on
its first two parts *by construction*, parking fired immediately:

| Family | parts attempted | parts parked without any attempt |
| --- | ---: | ---: |
| diode | 2 | 16 |
| bjt | 2 | 13 (+1 honest no-curve F1) |
| mosfet | 2 | 12 (+2 cross-check demotions) |

Parking is a reasonable circuit breaker and is not itself the bug, but it means the
proving run produced **6 data points, not 50**. Any conclusion drawn from "0/50" without
reading the reasons would have been drawn from a sample of six.

---

## 7. What the diagnosis licenses

1. **Fix the fitters** (cause c). Semantic curve selection by axis quantity and unit,
   declared-unit normalisation, test-condition filtering, real multi-parameter fits for
   all three families against the checked-in archetypes, and residuals measured through
   native ngspice rather than through the fitter's own algebra.
2. **Add extraction validation** (cause b). Reject non-physical curve segments
   (non-monotonic where physics forbids it, non-positive currents) with a recorded
   reason; demote to F1-from-parametrics only when too little survives.
3. **Fix the cross-check**, not by weakening it: add the corroboration rule and the
   epsilon so it enforces the limit it documents.
4. **Do not loosen the residual gates to make parts pass.** The corrected diode fits
   already clear the existing 8% bar. Gate calibration is needed only to state, per
   family and per quantity kind, what digitisation reading error physically justifies —
   and must stay tight enough to keep demoting IRFZ44N and IRF3205 at 42-44% Crss error.
