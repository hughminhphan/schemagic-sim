# Archetype: power MOSFET (ngspice native `.model VDMOS`)

Families: `nmos`, `pmos`. Model type: `dot_model`. Fidelity ceiling **F2** (small-signal parts with no published curve family: **F1**, see section 9).

Parts: 2N7000, BS250P, AO3400A, AO3401A, IRLZ44N, IRLB8721PBF, IRF540N, IRF9540N, FQP30N06L, SI2302.

VDMOS is ngspice's native vertical-DMOS model. It carries its own body diode, its own nonlinear gate-drain capacitance, and an optional electrothermal network. **Never model a power MOSFET with a level-1/2/3 `.model NMOS`**; those are lateral IC models with `W`/`L` scaling and no body diode, and they cannot represent the `Crss` collapse that dominates switching.

## 1. Card template and node order

**Three-terminal node order is `drain gate source`.** `M1 d g s MODELNAME`.

**Five-terminal electrothermal order is `drain gate source tj tcase`** with a trailing `thermal` keyword: `M1 d g s tj tc MODELNAME thermal`. Verified working; `tj` settles to a real junction temperature in degrees C.

```spice
* scheMAGIC original-from-facts model
* <MPN> (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: archetype-vdmos.md. Fit run: <run-id>
* Node order: M<ref> drain gate source OC_<MPN>
.model OC_<MPN> VDMOS(
+ <pchan for p-channel; omit entirely for n-channel>
+ VTO=<V>      KP=<A/V^2>   LAMBDA=<1/V>  THETA=<1/V>
+ RD=<ohm>     RS=<ohm>     RG=<ohm>      RDS=<ohm>
+ CGS=<F>      CGDMAX=<F>   CGDMIN=<F>    A=<->
+ CJO=<F>      VJ=<V>       M=<->         FC=0.5
+ IS=<A>       N=<->        RB=<ohm>      TT=<s>    BV=<V>   IBV=<A>   NBV=<->
+ MU=<->       TEXP0=<->    TCVTH=<V/K>   TNOM=27
+)
```

Verified accepted parameters: `VTO KP LAMBDA PHI THETA RD RS RG RB RDS CGDMAX CGDMIN CGS A IS N TT BV IBV NBV CJO VJ M FC EG XTI MU TEXP0 TCVTH KSUBTHRES SUBSHIFT VDS RTHJC RTHCA CTHJ QG RQ VQ KF AF pchan nchan TNOM`.

Verified **rejected** (silently ignored, so a typo here costs you the parameter): `TKSUBTHRES`, `MTRIANGLE`, `GAMMA`, `ETA`, `M0`, `DELTA`.

Both `pchan` (bare flag) and `pchan=1` work and give identical p-channel behaviour. **Use the bare flag**; it is the documented form and it cannot be confused with a numeric parameter.

Device internals available to `.save`: `@m1[id] @m1[is] @m1[ig] @m1[vgs] @m1[vds] @m1[cgs] @m1[cgd] @m1[cds] @m1[idio] @m1[von] @m1[rs] @m1[rd] @m1[gm] @m1[gds]`.

## 2. Required datasheet inputs

| Symbol | Unit | Typical datasheet location | Conditions that MUST be recorded |
|---|---|---|---|
| `VGS(th)` min/typ/max | V | Electrical characteristics, "Gate Threshold Voltage" | The `ID` at which it is defined (usually 250 uA) and `VDS = VGS` |
| Transfer curve, `ID` vs `VGS`, 5 or more points | A at V | Figure, "Typical Transfer Characteristics" | The `VDS` the figure was taken at, and the temperature curve used (take 25 C) |
| `RDS(on)` | ohm | Electrical characteristics, "Static Drain-Source On-Resistance" | `VGS` and `ID` for that row. Record **every** published `VGS`/`ID` pair |
| Output curves, `ID` vs `VDS` at 3 or more `VGS` | A at V | Figure, "Typical Output Characteristics" | The `VGS` per curve |
| `Ciss`, `Coss`, `Crss` | F | Electrical characteristics, "Input/Output/Reverse Transfer Capacitance" | `VDS`, `VGS` (usually 0), test frequency (usually 1 MHz) |
| Capacitance vs `VDS` figure | F at V | Figure, "Typical Capacitance vs Drain-to-Source Voltage" | Needed for `CGDMAX`, `CGDMIN`, `A` |
| `V(BR)DSS` | V | Electrical characteristics, "Drain-Source Breakdown Voltage" | The `ID` at which breakdown is defined (usually 250 uA) |
| `IDSS` | A | Electrical characteristics, "Zero Gate Voltage Drain Current" | `VDS`, `VGS = 0`, temperature |
| `VSD` (body diode forward) | V at A | Electrical characteristics, "Diode Forward Voltage" | `IS` current, `VGS = 0` |
| `trr`, `Qrr` | s, C | Electrical characteristics, "Body Diode Reverse Recovery" | `IF`, `di/dt` |
| `Qg`, `Qgs`, `Qgd` | C | Electrical characteristics, "Total Gate Charge" | `VDS`, `ID`, `VGS` |
| `RthJC`, `RthJA` | K/W | Thermal characteristics table | Mounting condition |

## 3. Deterministic fitting procedure

Ordered. Later stages consume earlier results.

### 3.1 Stage 1: capacitances, in closed form

The datasheet publishes terminal capacitances; VDMOS wants branch capacitances. The mapping is exact:

```python
Cgd = Crss                       # at the stated VDS
Cgs = Ciss - Crss
Cds = Coss - Crss
```

`CGS` in VDMOS is a **constant**, so it takes `Cgs` directly:

```python
CGS = max(Ciss - Crss, 1e-15)
```

`Cgd` is the nonlinear one. From the capacitance-versus-`VDS` figure:

```python
CGDMAX = Crss_at_VDS_near_zero   # read the leftmost point of the Crss trace
CGDMIN = Crss_at_VDS_rated       # read the rightmost point, where Crss has flattened
```

`A` sets how fast `Cgd` transitions between them. Fit it alone against the digitised `Crss(VDS)` trace with `least_squares` over `A in [0.01, 10]`, everything else frozen. One free parameter against 8 or more points.

`Cds` is the body-diode junction capacitance:

```python
VJ, M = 0.8, 0.5                 # held; the figure does not separate them
CJO = Cds_at_VDS_test * (1.0 + VDS_test/VJ)**M
```

**When no capacitance-vs-VDS figure exists** (common on small SOT-23 parts): set `CGDMAX = CGDMIN = Crss` and record `"Gate-drain capacitance is constant: the datasheet publishes no capacitance-versus-VDS figure, so the Crss collapse during the Miller plateau is not modelled. Switching-loss and dV/dt results are approximate."` This is a significant omission and it must appear in `MODEL_CARD.md` prose as well.

### 3.2 Stage 2: on-resistance split

`RDS(on)` at the strongest published `VGS` is almost entirely channel plus `RD`. VDMOS `RD` and `RS` are bias-independent; the channel term is not.

```python
RS = 0.20 * RDSon_at_max_VGS     # source metallisation and bond wires
RD = 0.55 * RDSon_at_max_VGS     # drift region, the dominant fixed term
# the remaining ~25 percent is left to the channel and comes out of KP/THETA in stage 3
RS = max(RS, 1e-4); RD = max(RD, 1e-4)
```

The 20/55 split is a **fixed constant of this archetype**, not a per-part judgment. It is applied identically to every part so that the remaining resistance is absorbed consistently by the channel fit. Do not tune it per part.

`RG` comes from the datasheet gate resistance row if published; otherwise `RG = 1e-4` and record the omission. `RG` matters only for gate-drive transient benches.

`RDS` (the drain-source shunt) stays at its default. Never set `RDS` below `1e6`; it is a leakage path, and a low value silently destroys the off-state.

### 3.3 Stage 3: DC channel, ngspice in the loop

Free parameters: `VTO`, `KP`, `THETA`, `LAMBDA`, and `RD` (released from its stage-2 seed with tight bounds).

**Seed:**

```python
VTO0    = VGSth_typ if VGSth_typ is not None else 0.5*(VGSth_min + VGSth_max)
# KP from a saturation point on the transfer curve, ignoring THETA
KP0     = 2.0*ID_hi / (VGS_hi - VTO0)**2
THETA0  = 0.05
LAMBDA0 = 0.003
```

**Targets:** the digitised transfer curve, every published `RDS(on)` row, and 3 or more points off the output-curve family in saturation.

**Residual:**

```python
r_transfer = np.log(ID_model) - np.log(ID_target)         # log space, spans decades
r_rdson    = (RDSon_model - RDSon_target)/RDSon_target    # relative
r_output   = np.log(ID_model_sat) - np.log(ID_target_sat)
resid = np.concatenate([r_transfer, r_rdson, r_output])
```

**Model evaluation** is one ngspice process per residual evaluation, with every target point instantiated as its own device in one netlist:

```spice
* VDMOS fit probe
.model MFIT VDMOS( ...current parameter vector... )
* transfer points: forced VGS, forced VDS in saturation
M1 d1 g1 0 MFIT
VD1 d1 0 DC <VDS_transfer>
VG1 g1 0 DC <VGS_1>
* ... repeated per point ...
* Rds(on) points: forced VGS, forced ID, read v(drain)
MR1 dr1 gr1 0 MFIT
IDR1 0 dr1 DC <ID_rdson_1>
VGR1 gr1 0 DC <VGS_rdson_1>
.save @m1[id] v(dr1)
.op
.end
```

`RDSon_model = v(dr1)/ID_rdson_1`.

**Bounds:**

| Parameter | Lower | Upper |
|---|---|---|
| `VTO` | `VGSth_min` | `VGSth_max` |
| `KP` | 1e-3 | 1e3 |
| `THETA` | 0 | 1.0 |
| `LAMBDA` | 0 | 0.2 |
| `RD` | `0.3 * RD_seed` | `1.5 * RD_seed` |

`VTO` is bounded by the datasheet's own min and max threshold rows. This is the single most important bound in the archetype: an unbounded `VTO` will trade against `KP` and land outside the guaranteed threshold window, producing a model that a real part would never match.

For a p-channel part, the datasheet quotes `VGS(th)` and `RDS(on)` as negative or as magnitudes. **Fit in magnitudes and set `pchan`**; ngspice's `pchan` flag handles the sign. A negative `VTO` with `pchan` set is a double negation and is wrong.

**Solver:** `least_squares(..., method="trf", x_scale="jac", diff_step=1e-4, ftol=1e-10, xtol=1e-10, max_nfev=5000)`.

**Convergence:** `status > 0`, worst `|r_transfer| < 0.288` (33 percent, because transfer-curve figures are log-axis reads), worst `|r_rdson| < 0.15`.

**When only the table exists and no transfer figure is available:** you have `VGS(th)` and the `RDS(on)` rows. Fit `VTO` (pinned to the threshold window) and `KP` only. Freeze `THETA = 0` and `LAMBDA = 0.003`. Record: `"Transfer characteristics are not fitted: no ID-versus-VGS figure was available. KP is derived from the RDS(on) rows alone, mobility degradation (THETA) is disabled, and drain current in the saturation region is approximate."`

### 3.4 Stage 4: body diode

The body diode is fitted with the rules of `archetype-diode.md`, restricted to the parameters VDMOS exposes.

```python
# forward: one published VSD at ISD, so one free parameter
N  = 1.5                                    # held, no second point exists
IS = ISD_test * np.exp(-(VSD_test - ISD_test*RB_seed) / (N*Vt))
RB = max(0.2 * RDSon_at_max_VGS, 1e-4)      # body-diode series resistance
# breakdown, exactly as for a zener: BV and IBV are one pair from one row
BV  = V_BR_DSS
IBV = ID_at_which_V_BR_DSS_is_defined       # usually 250e-6
NBV = 1.0
# reverse recovery from the published trr
TT = trr / np.log(1.0 + IF_trr/IR_trr) if trr is not None else None
```

`BV`/`IBV` must come from the same datasheet row. Verified on the diode archetype: holding `BV` fixed and changing `IBV` moved the actual breakdown voltage by 13 percent. A `BV` without its defining current is not a fit.

If `trr` is unpublished, omit `TT` and record `"Body-diode reverse recovery is not modelled: the datasheet publishes no trr."`

### 3.5 Stage 5: gate charge cross-check (not a fit)

`Qg` is a **verification target, not a fitting target**. After stages 1 to 4, run the gate-charge bench of section 4.4 and compare the simulated `Qg` to the datasheet. If it is outside 30 percent, the capacitance stage is wrong (usually `CGDMAX` read at too high a `VDS`). Refit stage 1 and rerun. **Never adjust a capacitance to make `Qg` match**; that would make `Qg` a fitted quantity with no independent check left.

### 3.6 Stage 6: thermal parameters

Set `RTHJC = RthJC` and `RTHCA = RthJA - RthJC` from the thermal table. `CTHJ` is not published; leave it at default.

**Thermal parameters are set but the thermal domain is still not claimed as fitted.** Ship the three-terminal instance as the default; the five-terminal `thermal` form is available to users but is untested against datasheet data. `domain_coverage.thermal` is `approx` when `RTHJC`/`RTHCA` are set and `none` otherwise.

`MU`, `TEXP0`, `TCVTH` stay at defaults unless the `RDS(on)`-versus-temperature figure is digitised. If it is: fit `TEXP0` alone against that trace.

## 4. Standard test benches

### 4.1 `rdson.cir` (analysis_type `operating_point`)

```spice
* <MPN> static drain-source on-resistance at datasheet conditions
.include ../model.cir
M1 d g 0 OC_<MPN>
IDRV 0 d DC <ID_test>
VG g 0 DC <VGS_test>
.save v(d) @m1[id] @m1[vds]
.op
.end
```

```json
{
  "name": "rdson_vgs<VGS>_id<ID>",
  "expression_source": { "kind": "derived_expression", "expression": "v(d)/<ID_test>" },
  "expected_value": <RDSon>, "unit": "ohm",
  "tolerance": { "absolute": 0, "relative": 0.15 },
  "datasheet_citation": "<mfr> <MPN> rev <r> p.<n>, electrical characteristics, RDS(on) at VGS=<VGS>, ID=<ID>",
  "placeholder": false
}
```

Drive the drain with a **current source**, not a voltage source. In the on state the device is a few milliohms; a voltage-driven bench puts the whole supply across the solver's smallest conductance.

### 4.2 `transfer_curve.cir` (analysis_type `dc_sweep`)

```spice
* <MPN> transfer characteristics, ID vs VGS at the figure's VDS
.include ../model.cir
M1 d g 0 OC_<MPN>
VD d 0 DC <VDS_figure>
VG g 0 DC 0
.save i(VD) @m1[id] @m1[gm]
.dc VG 0 <VGS_max> 0.02
.end
```

Checks: `abs(i(vd)) at v(g)=<VGS_k>` against each digitised point, relative 0.33. Plus a hard bound: `abs(i(vd)) at v(g)=0` must be below `IDSS`, cited to the zero-gate-voltage drain current row.

### 4.3 `output_curve.cir` (analysis_type `dc_sweep`)

Nested `.dc` is supported and produces one plot of `N1*N2` points.

```spice
* <MPN> output characteristics
.include ../model.cir
M1 d g 0 OC_<MPN>
VD d 0 DC 0
VG g 0 DC 0
.save i(VD)
.dc VD 0 <VDS_max> 0.05 VG <VGS_lo> <VGS_hi> <VGS_step>
.end
```

### 4.4 `gate_charge.cir` (analysis_type `transient`)

The datasheet gate-charge circuit is a constant-current gate drive into the device switching a fixed load current.

```spice
* <MPN> gate charge at datasheet conditions
.include ../model.cir
M1 d g 0 OC_<MPN>
IG 0 g DC <IG_drive>
IL vsup d DC <ID_test>
VSUP vsup 0 DC <VDS_test>
.save v(g) v(d)
.ic v(g)=0
.tran 1n <t_stop>
.end
```

`Qg = IG_drive * t_at(v(g) = VGS_spec)`. Expression: `<IG_drive> * (time at v(g)=<VGS_spec>)`. Tolerance: relative 0.30. This is the cross-check of section 3.5 promoted to a shipped expectation.

### 4.5 `capacitance.cir` (analysis_type `ac_small_signal`)

```spice
* <MPN> terminal capacitances at the datasheet bias
.include ../model.cir
M1 d g 0 OC_<MPN>
VD d 0 DC <VDS_test> AC 1
VG g 0 DC 0
.save i(VD) i(VG)
.ac lin 1 1meg 1meg
.end
```

`Coss = abs(imag(i(vd)))/(2*pi*1e6)` and `Crss = abs(imag(i(vg)))/(2*pi*1e6)`. **Use `abs`**: the sign of the imaginary part follows the source's current convention, and a measured `Coss` came out as `-2.75e-10` before the `abs`. Tolerance: relative 0.20.

The gate must be held at a DC source (AC ground) for `Coss`, exactly as the datasheet does it. A floating gate gives a meaningless answer.

### 4.6 `body_diode.cir` (analysis_type `operating_point`)

```spice
* <MPN> body diode forward voltage
.include ../model.cir
M1 d g 0 OC_<MPN>
ISD d 0 DC <ISD_test>
VG g 0 DC 0
.save v(d)
.op
.end
```

Check `abs(v(d))` against `VSD`, relative 0.10, absolute 0.05 V.

## 5. `known_omissions` boilerplate

**Always:**
- `"Avalanche and unclamped inductive switching (UIS/EAS) are not modelled. The model conducts through BV as an ordinary diode breakdown; it does not fail."`
- `"Safe operating area is not enforced. Absolute maximum ratings are metadata; the model will happily dissipate a kilowatt."`
- `"No self-heating in the default three-terminal instance: junction temperature is fixed at TNOM. RDS(on) does not rise with dissipation."`
- `"Package and lead inductance are not modelled, so measured switching ringing will not reproduce."`
- `"Threshold-voltage spread is not modelled. VTO is fitted inside the datasheet's guaranteed VGS(th) window; a real part may sit anywhere in that window."`
- `"Gate oxide breakdown at VGS beyond the rated maximum is not modelled."`
- `"Flicker noise is not modelled: KF and AF are at defaults."`

**Conditional:**
- No capacitance-vs-VDS figure: `"Gate-drain capacitance is constant (CGDMAX = CGDMIN): no capacitance-versus-VDS figure was available, so the Crss collapse during the Miller plateau is not modelled."`
- No transfer figure: `"Transfer characteristics are not fitted: KP is derived from the RDS(on) rows alone and mobility degradation (THETA) is disabled."`
- No `trr`: `"Body-diode reverse recovery is not modelled: the datasheet publishes no trr."`
- No thermal table: `"Thermal resistances are not set; the electrothermal five-terminal instance form is unavailable."`
- Thermal set: `"RTHJC and RTHCA are transcribed from the thermal table but the electrothermal instance form is not validated against datasheet data. Junction temperature results are indicative only."`
- No `RDS(on)`-vs-temperature figure: `"Temperature coefficients (MU, TEXP0, TCVTH) are at defaults; only 25 C data was fitted."`

## 6. `domain_coverage` defaults

| Domain | Rating | Condition |
|---|---|---|
| `dc` | `fitted` | Always for F2 |
| `ac` | `fitted` | Capacitance stage completed against a figure; `approx` if `CGDMAX = CGDMIN` |
| `transient` | `fitted` | Capacitances and body diode fitted and the gate-charge check passed; else `approx` |
| `noise` | `none` | Always |
| `thermal` | `approx` if `RTHJC`/`RTHCA` set, else `none` | Never `fitted` under this archetype |
| `digital` | `none` | Always |

`supported_analyses`: `["operating_point", "dc_sweep", "ac_small_signal", "transient"]`.

## 7. Numerical hygiene

1. **Drive the drain with a current source in every on-state bench.** A milliohm device across a voltage source is the worst-conditioned circuit in the library.
2. **`RD >= 1e-4`, `RS >= 1e-4`, `RG >= 1e-4`.** A zero `RG` plus a large `CGS` creates a pure capacitive node with no series damping, and the transient timestep controller will chase it.
3. **`RDS >= 1e6`.** This parameter is a leakage shunt. A small value looks harmless and silently ruins the off state and every `IDSS` check.
4. **`CGS >= 1e-15` and `CJO >= 1e-15`.** Never zero.
5. **`LAMBDA <= 0.2`.** A large `LAMBDA` makes the saturation region rise steeply enough to produce a negative incremental output resistance in some solver paths.
6. **`THETA >= 0`.** A negative `THETA` inverts the mobility-degradation denominator and produces a pole in the drain current at a finite `VGS`.
7. **Fit p-channel parts in magnitudes and set the bare `pchan` flag.** Never combine `pchan` with a negative `VTO`.
8. **Never set `LEVEL` on a VDMOS card.** VDMOS has no `LEVEL`; the parameter belongs to the lateral MOS models.
9. **Do not rescue a fit probe with `.options gmin`.** A non-convergent probe means the parameter vector is unphysical. Tighten the bounds.
10. **Check the rejected-parameter list before shipping.** `TKSUBTHRES`, `MTRIANGLE`, `GAMMA`, `ETA`, `M0`, `DELTA` are silently ignored by ngspice-46. A card that sets one of them will simulate without complaint and without the intended effect. The factory must grep every generated card against the verified accepted list in section 1 and fail the build on any name outside it.

## 8. Logic-level versus standard-level parts

`IRLZ44N`, `IRLB8721PBF`, `FQP30N06L`, `AO3400A`, `SI2302` are logic-level: they specify `RDS(on)` at `VGS = 4.5 V` or `5 V`. `IRF540N` and `IRF9540N` specify it at `VGS = 10 V`.

This is not a modelling difference; it is a fitting-input difference. **Fit against every published `RDS(on)` row.** A logic-level part fitted only at 10 V will be wrong at 5 V, which is exactly the case a beginner's Arduino circuit exercises. If a logic-level part publishes only one `RDS(on)` row, record `"RDS(on) fitted at a single VGS; on-resistance at other gate drives is an extrapolation of the fitted channel model."`

## 9. Small-signal parts with no curve family

`2N7000` and `BS250P` datasheets sometimes publish only `VGS(th)`, `RDS(on)`, and `IDSS`, with no transfer or capacitance figures. These are legitimately **F1**, not F2:

- Fit `VTO` inside the threshold window and `KP` from the single `RDS(on)` row.
- Freeze `THETA = 0`, `LAMBDA = 0.003`, `CGDMAX = CGDMIN = Crss` if any `Crss` exists, otherwise omit all capacitances.
- Set `fidelity_tier` to `F1`, `domain_coverage.dc` to `approx`, and `ac`/`transient` to `none` if no capacitance exists.
- Record `"F1: fitted from tabulated rows only. No transfer, output, or capacitance figure was published for this part."`

Do not label such a part F2 because the archetype's ceiling is F2. The ceiling is a maximum.
