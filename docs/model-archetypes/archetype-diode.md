# Archetype: diode (`.model D`), with zener and LED variants

Families: `diode`, `led`. Model type: `dot_model`. Fidelity ceiling **F2** (LED optical claims capped at **F1**).

Covers three variants that share one card and differ only in which parameters are fitted:

| Variant | Parts | Distinguishing fit |
|---|---|---|
| **S** signal / rectifier | 1N4148, 1N4001, 1N4007, 1N5408, BAV99, LL4148 | Forward IV, `CJO`, `TT` from trr |
| **K** Schottky | 1N5817, 1N5819, BAT54, BAT41 | Low `N`, large `ISR`, `TT` forced to 0 |
| **Z** zener | 1N4728A, 1N4733A, 1N4742A, BZX79C5V1 | Reverse `BV`/`IBV`/`NBV` from Vz, Izt, Zzt |
| **L** LED | WP7113xx, LTST-C170Kxxxx, IR333A | High `N`, `EG` from emission wavelength |

## 1. Card template and node order

**Node order is `anode cathode`.** `D1 anode cathode MODELNAME`. This is fixed by ngspice and is not negotiable.

```spice
* scheMAGIC original-from-facts model
* <MPN> (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: archetype-diode.md, variant <S|K|Z|L>. Fit run: <run-id>
* Node order: D<ref> anode cathode OC_<MPN>
.model OC_<MPN> D(
+ IS=<A>        N=<->        RS=<ohm>
+ ISR=<A>       NR=<->       IKF=<A>
+ CJO=<F>       VJ=<V>       M=<->        FC=0.5
+ TT=<s>
+ BV=<V>        IBV=<A>      NBV=<->
+ EG=<eV>       XTI=<->      TNOM=27
+)
```

Omit any line whose parameters were not fitted. **Do not write a parameter at its default just to look complete**; an absent parameter and a defaulted parameter behave identically, and an absent one cannot be mistaken for a fitted one.

Verified engine facts for this card:

- `IBVL` and `NBVL` are **rejected** by ngspice-46 (`unrecognized parameter ... ignored`). There is one breakdown knee, not two.
- `ISR`, `NR`, and `IKF` are active at the default `LEVEL=1`. A LEVEL=1 and a LEVEL=3 card with identical parameters produced bit-identical currents. **Never set `LEVEL`.**
- Accepted and available if a datasheet justifies them: `TT CJO VJ M FC BV IBV NBV IKF ISR NR EG XTI TNOM KF AF JTUN TLEV TRS1 TRS2 CTA CTP TCV ISW`.

## 2. Required datasheet inputs

Record each into the fitting input table with value, unit, and conditions. **A number without its conditions is not an input and must not be used.**

| Symbol | Unit | Typical datasheet location | Conditions that MUST be recorded |
|---|---|---|---|
| `VF` at 3 or more `IF` | V at A | Electrical characteristics table, "Forward Voltage" rows; and the "Forward Current vs Forward Voltage" figure | Each IF, and Tamb (usually 25 C) |
| `IR` at 1 or more `VR` | A at V | Electrical characteristics table, "Reverse Current" rows | VR, Tamb; note the separate high-temperature row and do NOT fit to it |
| `CT` or `CJ` at `VR` | F at V | Electrical characteristics table, "Diode Capacitance"; or the "Capacitance vs Reverse Voltage" figure | VR, test frequency (usually 1 MHz) |
| `trr` | s | Electrical characteristics table, "Reverse Recovery Time" | `IF`, `IR`, `RL`, and the recovery measurement threshold (`0.1 IR` etc.) |
| `VRRM` / `VR` max | V | Absolute maximum ratings | Used only for `supported_operating_region`, never fitted |
| `IF(AV)` / `IFM` | A | Absolute maximum ratings | Used only for `supported_operating_region` |

Variant Z additionally requires:

| Symbol | Unit | Typical datasheet location | Conditions |
|---|---|---|---|
| `VZ` at `IZT` | V at A | Electrical characteristics, "Zener Voltage" (nominal, min, max) | `IZT`, Tamb; record which of nom/min/max is used |
| `ZZT` | ohm | Electrical characteristics, "Maximum Zener Impedance" | at `IZT` |
| `ZZK` at `IZK` | ohm at A | Same table, knee impedance column | at `IZK` |
| `IR` at `VR` | A at V | "Reverse Leakage Current" row | `VR` is below the knee |

Variant L additionally requires:

| Symbol | Unit | Typical datasheet location | Conditions |
|---|---|---|---|
| `VF` at `IF` | V at A | Electrical characteristics, "Forward Voltage" (typ and max) | `IF`, usually 20 mA |
| `lambda_peak` or `lambda_dom` | nm | Electrical characteristics, "Peak Wavelength" / "Dominant Wavelength" | `IF` |
| `IV` (luminous intensity) | mcd | Electrical characteristics, "Luminous Intensity" | `IF`, viewing angle |

`IV` and `lambda` are recorded as **metadata only**. They enter `component.json` and `MODEL_CARD.md`. They never enter `model.cir` except that `lambda` sets `EG`.

## 3. Deterministic fitting procedure

All steps run in `tools/model-factory` with `numpy`/`scipy`. `Vt = k*T/q = 0.025852` V at 300.15 K; use the exact constant, never 0.026.

### 3.1 Forward branch (variants S, K, L)

**Initialisation (closed form, two lowest-current points that are still above 10x the leakage):**

```python
N0  = (V2 - V1) / (Vt * np.log(I2 / I1))
IS0 = I1 * np.exp(-V1 / (N0 * Vt))
RS0 = max((Vhi - N0*Vt*np.log(Ihi/IS0)) / Ihi, 1e-4)   # from the highest-current point
```

**Residual.** Currents are compared in log space so a 1 mA point and a 1 A point carry equal weight:

```python
def resid(theta, V_meas, I_meas):
    logIS, N, RS, logISR, NR, logIKF = theta
    Vd = V_meas - I_meas*RS                       # explicit, drive is current
    Ifwd = 10**logIS * np.expm1(Vd/(N*Vt))
    Irec = 10**logISR * np.expm1(Vd/(NR*Vt))
    Khi  = np.sqrt(10**logIKF / (10**logIKF + np.maximum(Ifwd, 1e-30)))
    return np.log(np.maximum(Khi*Ifwd + Irec, 1e-30)) - np.log(I_meas)
```

`IS`, `ISR`, `IKF` are fitted as `log10` of the parameter. `N`, `NR`, `RS` are fitted directly.

**Bounds:**

| Parameter | Lower | Upper | Note |
|---|---|---|---|
| `log10(IS)` | -20 | -6 | |
| `N` | 0.8 | 2.2 (S, K), 1.2 to 4.0 (L) | LEDs are wide-bandgap and routinely exceed 2 |
| `RS` | 1e-4 | 100 | Floor is mandatory; see README |
| `log10(ISR)` | -20 | -6 | |
| `NR` | 1.5 | 4.0 | |
| `log10(IKF)` | -3 | 3 | |

**Solver:** `least_squares(resid, x0, bounds=..., method="trf", x_scale="jac", ftol=1e-12, xtol=1e-12, max_nfev=5000)`.

**Free-parameter budget.** Never fit more parameters than you have points minus one.

| Points available | Fit | Default the rest |
|---|---|---|
| 2 | `IS`, `N` | `RS=1e-4`, `ISR`, `NR`, `IKF` all defaulted; 3 omission entries |
| 3 to 4 | `IS`, `N`, `RS` | `ISR`, `NR`, `IKF` defaulted; 2 omission entries |
| 5 or more spanning 4 decades | `IS`, `N`, `RS`, `ISR`, `NR` | `IKF` defaulted unless a high-injection roll-off is visible |
| 5 or more with visible roll-off above 100 mA | all six | |

**Convergence:** `status > 0` and max absolute log residual `< 0.223` (25 percent in current). Otherwise drop the highest-index parameter to its default, record an omission, and refit.

**When only the table exists and no figure is available:** a typical signal-diode table gives 2 to 4 `VF`/`IF` rows. Take the "3 to 4 points" row of the budget table. **Do not synthesise intermediate points by interpolation.** Record a `known_omissions` entry: `"Forward IV fitted from N tabulated points only; the datasheet IV figure was not available, so low-current recombination (ISR/NR) is not modelled."`

### 3.2 Reverse leakage (variants S, K, L)

`IR` at `VR` is a single point in almost every datasheet, so it determines one parameter. Fit `ISR` to it **only if** `ISR` was not already consumed by the forward fit. If it was, do not refit; instead check the reverse-leakage expectation with a widened tolerance and record: `"Reverse leakage is a consequence of the forward fit, not an independent target."`

Schottky parts (variant K) always have `ISR` reverse-dominated. For variant K, fit `ISR`/`NR` to the reverse point **first**, freeze them, then fit `IS`/`N`/`RS` forward.

### 3.3 Junction capacitance (all variants)

```
C(VR) = CJO / (1 + VR/VJ)**M
```

- **Figure available (C vs VR):** digitise 5 or more points and fit `CJO`, `VJ`, `M` with bounds `CJO in [1e-15, 1e-8]`, `VJ in [0.2, 1.2]`, `M in [0.2, 0.6]`.
- **Single table point only:** you have one equation and three unknowns. Fix `VJ = 0.7` (silicon) or `VJ = 0.5` (Schottky), fix `M = 0.33` (graded), then solve `CJO = CT * (1 + VR/VJ)**M` in closed form. Record: `"CJO derived from a single tabulated capacitance point with VJ and M held at physical defaults; capacitance versus reverse bias is approximate."`
- **No capacitance data at all:** omit `CJO` entirely and record the omission. Set `domain_coverage.ac` to `none`.

### 3.4 Transit time `TT` (variant S only)

From the datasheet `trr` at its stated `IF` and `IR`:

```python
TT = trr / np.log(1.0 + IF/IR)
```

This inverts the standard charge-control recovery relation for the stated test circuit. It is an approximation with a documented basis, so it is permitted; the resulting omission entry is mandatory regardless.

- **Variant K (Schottky): set `TT = 0` and record** `"Schottky majority-carrier device: no minority-carrier storage, TT is zero by construction."` Never fit `TT` for a Schottky.
- **Variant L (LED): omit `TT`** unless the datasheet publishes a switching time, which is rare.
- **No trr published:** omit `TT` and record `"Reverse recovery is not modelled: the datasheet publishes no trr."` Set `domain_coverage.transient` to `approx`.

### 3.5 Zener reverse branch (variant Z)

ngspice's breakdown branch is `I = IBV * exp((VR - BV)/(NBV*Vt))`, so `I = IBV` exactly at `VR = BV`. This gives an exact, non-iterative assignment:

```python
IBV = IZT              # the datasheet zener test current, verbatim
BV  = VZ_at_IZT        # the zener voltage measured at that same current
```

**This pairing is mandatory.** Verified: with `BV=5.1` held fixed, changing `IBV` from 20 mA to 1 nA to the ngspice default moved the actual regulated voltage from 5.19 V to 5.88 V to 5.32 V. `IBV` is not a leakage fudge; it is the current at which `BV` is defined.

`NBV` sets the knee sharpness, from the knee impedance:

```python
# Zzt = NBV*Vt/IZT + RS  and  Zzk = NBV*Vt/IZK + RS   -> two equations, two unknowns
NBV = (ZZK - ZZT) * IZT * IZK / (Vt * (IZT - IZK))
RS  = max(ZZT - NBV*Vt/IZT, 1e-4)
```

If only `ZZT` is published, set `NBV = 1.0` and solve `RS = max(ZZT - Vt/IZT, 1e-4)`. Record: `"Zener knee sharpness not fitted (NBV held at 1.0): the datasheet publishes no knee impedance at IZK."`

The forward branch of a zener is fitted normally from any forward `VF` row; if none exists, default `IS=1e-14`, `N=1.6` and record the omission.

### 3.6 LED bandgap (variant L)

```python
EG = 1239.84193 / lambda_nm      # photon energy in eV
```

`EG` in ngspice controls the temperature scaling of `IS`. Setting it from the emission wavelength is physically correct for the emitting junction and is the only defensible source. Record: `"EG derived from the datasheet peak emission wavelength; no temperature-sweep data was fitted."`

**LED optical output is not modelled.** The package records `IV` at `IF` in `component.json` and `MODEL_CARD.md`. The application layer maps diode current to on-screen brightness. This is why the LED optical claim is capped at F1.

## 4. Standard test benches

One analysis card per file. Run with `-r out.raw`; never rely on `.print` for `.op`.

### 4.1 `forward_iv.cir` (analysis_type `transient`, quasi-static staircase)

`.dc` in ngspice-46 is **linear only**; `.dc IDRIVE 1u 200m dec 20` is a hard parse error. To hit exact datasheet currents without interpolation error, drive a PWL staircase and sample on the flat segments. Verified: a staircase sample and an independent `.op` at the same current agree to 7 significant figures.

```spice
* <MPN> forward characteristic at datasheet currents
.include ../model.cir
IDRIVE 0 anode PWL(0 1u 0.9m 1u 1m <IF1> 1.9m <IF1> 2m <IF2> 2.9m <IF2> 3m <IF3> 3.9m <IF3> 4m <IF4> 4.9m <IF4>)
D1 anode 0 OC_<MPN>
.save v(anode)
.tran 10u 5m
.end
```

Each datasheet point becomes one scalar check sampled at the end of its flat segment:

```json
{
  "name": "vf_at_<IF2>",
  "expression_source": { "kind": "derived_expression", "expression": "v(anode) at time=2.9m" },
  "expected_value": <VF2>, "unit": "V",
  "tolerance": { "absolute": 0.02, "relative": 0.03 },
  "datasheet_citation": "<mfr> <MPN> rev <r> p.<n>, electrical characteristics, VF at IF=<IF2>",
  "placeholder": false
}
```

Hard bounds on the same run: `v(anode)` between 0 and `VRRM`, cited to absolute maximum ratings.

### 4.2 `reverse_leakage.cir` (analysis_type `operating_point`)

```spice
* <MPN> reverse leakage at VR
.include ../model.cir
VR cathode 0 DC <VR>
D1 0 cathode OC_<MPN>
.save i(VR) @d1[id]
.op
.end
```

Check `abs(i(VR))` against `IR`. Tolerance: relative 1.0 with absolute floor 1e-12. **Leakage is fitted against a maximum-rated number, not a typical, so a one-sided hard bound is more honest than a two-sided scalar check.** Prefer a `hard_bounds_checks` entry with `maximum: IR_max` over a `scalar_checks` entry whenever the datasheet row is a max.

### 4.3 `junction_capacitance.cir` (analysis_type `ac_small_signal`)

```spice
* <MPN> junction capacitance at VR, 1 MHz
.include ../model.cir
VR cathode 0 DC <VR> AC 1
D1 0 cathode OC_<MPN>
.save i(VR)
.ac lin 1 1meg 1meg
.end
```

`C = imag(i(VR)) / (2*pi*f)` with the 1 V AC drive. Expression: `imag(i(vr))/(6.283185307*1e6)`. Tolerance: relative 0.20, absolute 0.5e-12.

### 4.4 `zener_regulation.cir` (variant Z, analysis_type `transient`)

```spice
* <MPN> zener voltage across the datasheet current range
.include ../model.cir
IZ 0 cathode PWL(0 <IZK> 0.9m <IZK> 1m <IZT> 1.9m <IZT> 2m <IZM> 2.9m <IZM>)
D1 0 cathode OC_<MPN>
.save v(cathode)
.tran 10u 3m
.end
```

Checks: `v(cathode) at time=0.9m` against Vz at IZK; `at time=1.9m` against Vz at IZT with relative 0.03; `at time=2.9m` against Vz at IZM. Citation slot: "electrical characteristics, zener voltage row at IZT".

### 4.5 `reverse_recovery.cir` (variant S with fitted `TT`, analysis_type `transient`)

Reproduce the datasheet trr circuit: forward `IF`, then a step to reverse through `RL`.

```spice
* <MPN> reverse recovery, datasheet trr conditions
.include ../model.cir
V1 drv 0 PWL(0 <VFWD> 1u <VFWD> 1.001u <VREV> 5u <VREV>)
R1 drv anode <RL>
D1 anode 0 OC_<MPN>
.save i(V1)
.tran 1n 5u
.end
```

Check the time from the zero crossing of `i(V1)` to the point where it recovers to 10 percent of peak reverse current, against `trr`. Tolerance: relative 0.30. Widened from the default 0.15 because `TT` was derived analytically from a single published `trr`, so this bench is close to a self-check; state that in `MODEL_CARD.md`.

## 5. `known_omissions` boilerplate

Ship every line that applies. Never ship an empty list; the schema forbids it.

**Always:**
- `"No self-heating: junction temperature is fixed at TNOM. Thermal derating from the datasheet is not modelled."`
- `"Package parasitics (lead inductance, package capacitance) are not modelled."`
- `"Fitted at 25 C only. Temperature coefficients XTI and EG are at physical defaults unless a temperature sweep was fitted."`

**Conditional:**
- No `TT` fitted: `"Reverse recovery is not modelled: TT is absent, so switching transients recover instantaneously."`
- Variant K: `"Schottky majority-carrier device: no minority-carrier storage, TT is zero by construction."`
- No `CJO`: `"Junction capacitance is not modelled: the datasheet publishes no capacitance value. AC and fast-transient results are not meaningful."`
- Single capacitance point: `"CJO derived from a single tabulated capacitance point with VJ and M held at physical defaults."`
- No breakdown fitted (variants S, K, L): `"Reverse breakdown is not modelled: BV is absent, so the model conducts only leakage above the rated VRRM."`
- Variant Z with only `ZZT`: `"Zener knee sharpness not fitted (NBV held at 1.0)."`
- Variant L: `"Optical output is not simulated. Luminous intensity and wavelength are metadata; the application layer maps diode current to displayed brightness."`
- Variant L: `"LED forward voltage bin spread is not modelled; the fit targets the typical bin."`
- Fewer than 5 IV points: `"Forward IV fitted from N tabulated points only; low-current recombination (ISR/NR) is not modelled."`
- Always for noise: `"Flicker noise is not modelled: KF and AF are at defaults (no noise data published)."`

## 6. `domain_coverage` defaults

| Domain | Variant S | Variant K | Variant Z | Variant L |
|---|---|---|---|---|
| `dc` | `fitted` | `fitted` | `fitted` | `fitted` |
| `ac` | `fitted` if `CJO` fitted, else `none` | same | `approx` | `approx` |
| `transient` | `fitted` if `TT` fitted, else `approx` | `approx` | `approx` | `approx` |
| `noise` | `none` | `none` | `none` | `none` |
| `thermal` | `none` | `none` | `none` | `none` |
| `digital` | `none` | `none` | `none` | `none` |

`supported_analyses`: `["operating_point", "dc_sweep", "transient"]`, plus `"ac_small_signal"` only when `CJO` was fitted.

Promote a rating from `fitted` to `validated` only when that domain has a passing expectation with a real (non-placeholder) datasheet citation.

## 7. Numerical hygiene

1. **Drive the forward IV with a current source, never a voltage source.** A voltage-driven exponential is the classic non-convergent SPICE bench; a current-driven one is unconditionally well posed.
2. **`RS >= 1e-4`.** A zero series resistance turns the diode into an ideal exponential with unbounded conductance and defeats the `gmin` ramp.
3. **`CJO >= 1e-15` whenever a transient bench exists.** A capacitance-free diode in a fast transient has no local time constant, and the timestep controller has nothing to hold onto.
4. **Never set `IS = 0`.** Use the `1e-20` floor. An exactly zero `IS` disconnects the branch and can float the anode.
5. **Never set `BV` without `IBV`.** The default `IBV` will silently relocate the breakdown knee. If you cannot pair them from one datasheet row, omit both.
6. **Do not push `N` below 0.8.** Values under about 0.5 make `exp(Vd/(N*Vt))` overflow at ordinary forward voltages.
7. **The `.dc` card is linear only.** `dec` and `oct` are parse errors. Use the staircase transient bench of section 4.1 for logarithmically spaced points.
8. **Reverse-bias benches must reference the cathode to a source**, as in section 4.2, so the leakage current has a measurement branch. A floating cathode gives a `gmin`-dependent answer that changes with `.options gmin`.
