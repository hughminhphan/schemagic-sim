# Archetype: junction FET (`.model NJF` / `.model PJF`)

Families: `jfet_n`, `jfet_p`. Model type: `dot_model`. Fidelity ceiling **F2**.

Parts: MMBF5457, MMBFJ201, J113, BF256B.

The level-1 SPICE JFET is a two-parameter square law. A JFET datasheet publishes three numbers that constrain those two parameters, so the model is over-determined. Section 3.2 states the fixed rule for resolving that; **it is not a judgment call.**

## 1. Card template and node order

**Node order is `drain gate source`.** `J1 d g s MODELNAME`.

```spice
* scheMAGIC original-from-facts model
* <MPN> (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: archetype-jfet.md. Fit run: <run-id>
* Node order: J<ref> drain gate source OC_<MPN>
.model OC_<MPN> <NJF|PJF> (
+ VTO=<V>    BETA=<A/V^2>   LAMBDA=<1/V>   B=1.0
+ RD=<ohm>   RS=<ohm>
+ CGS=<F>    CGD=<F>        PB=<V>         M=0.5    FC=0.5
+ IS=<A>     N=1.0
+ TNOM=27
+)
```

Verified accepted: `VTO BETA LAMBDA RD RS CGS CGD PB IS N FC KF AF B TNOM XTI EG M LEVEL VTOTC BETATCE`.

Verified **rejected** (silently ignored): `ISR NR ALPHA VK ACGAM DELTA HFETA`. In particular there is **no separate recombination branch** on the JFET gate diode, unlike the standalone `.model D`.

`LEVEL=2` (Parker-Skellern) parses but is not used by this archetype. It needs parameters no jellybean JFET datasheet publishes. **Never set `LEVEL`**; the default level-1 model is the fitted one.

`B` is the bulk doping profile exponent. `B = 1.0` is the pure square law. Fit `B` **only** when a transfer-characteristics figure with 5 or more points exists; from tabulated data alone it is unidentifiable.

`IS` is the gate junction saturation current. A JFET datasheet publishes `IGSS` (gate reverse current) but not a forward gate curve, so `IS` is set from `IGSS` and never fitted.

## 2. Required datasheet inputs

| Symbol | Unit | Typical datasheet location | Conditions that MUST be recorded |
|---|---|---|---|
| `IDSS` min/typ/max | A | Electrical characteristics, "Zero-Gate-Voltage Drain Current" | `VDS`, `VGS = 0`, Tamb |
| `VGS(off)` min/max | V | Electrical characteristics, "Gate-Source Cutoff Voltage" | `VDS`, and the `ID` at which cutoff is declared (usually 1 nA to 10 nA) |
| `gfs` or `|Yfs|` | S | Electrical characteristics, "Forward Transfer Admittance" | `VDS`, `VGS` (usually 0), test frequency (usually 1 kHz) |
| `IGSS` | A | Electrical characteristics, "Gate Reverse Current" | `VGS`, `VDS = 0`, Tamb |
| `Ciss` | F | Electrical characteristics, "Input Capacitance" | `VDS`, `VGS`, frequency |
| `Crss` | F | Electrical characteristics, "Reverse Transfer Capacitance" | `VDS`, `VGS`, frequency |
| `rds(on)` or `rDS(on)` | ohm | Present on switching parts (J113); "Drain-Source On Resistance" | `VGS = 0`, `ID` |
| Transfer figure, `ID` vs `VGS` | A at V | Figure, "Typical Transfer Characteristics" | The `VDS` used |
| `V(BR)GSS` | V | Absolute maximum ratings | `supported_operating_region` only |
| `en` (noise voltage) | V/sqrt(Hz) | Present on low-noise parts (BF256B, MMBFJ201) | Frequency, `ID` |

**Record which bin you are fitting.** MMBF5457 is the "5457" bin of a 5457/5458/5459 family and its `IDSS` and `VGS(off)` windows are bin-specific. Fitting the wrong bin's numbers produces a model with the right part number and the wrong device.

## 3. Deterministic fitting procedure

### 3.1 Stage 1: parasitic resistances

```python
if rds_on is not None:          # switching parts publish it
    RS = max(0.5*rds_on, 1e-4)
    RD = max(0.5*rds_on, 1e-4)
else:
    RS = RD = 1e-4              # floor; see numerical hygiene
```

When `rds(on)` is unpublished, record `"Channel series resistance is not fitted (RD and RS at the numerical floor): the datasheet publishes no on-resistance. Triode-region behaviour and source degeneration are not modelled."`

`RS` matters more than it looks. A verified probe with `RS = 50` ohm pulled `IDSS` from the ideal 5.375 mA down to 4.451 mA through self-biasing, a 17 percent shift. This is why stage 2 runs against ngspice rather than the closed-form square law.

### 3.2 Stage 2: the over-determined core, ngspice in the loop

Free parameters: `VTO`, `BETA`, `LAMBDA`. Targets: `IDSS`, `VGS(off)`, `gfs`, and `LAMBDA` from the output-curve slope if a figure exists.

The three published numbers satisfy the square law only approximately, because they come from different production tests. **The fixed rule is: fit all three targets simultaneously with equal relative weight. Never pick two and derive the third.**

**Seed (closed form, ignoring `RS` and `LAMBDA`):**

```python
VTO0  = -abs(VGSoff_typ)                       # NJF; use +abs for PJF, and set the PJF model type
BETA0 = IDSS_typ / VTO0**2
LAMBDA0 = 0.005
# consistency report, written to MODEL_CARD.md, never used to alter the fit
VTO_from_gfs = -2.0*IDSS_typ/gfs_typ
inconsistency = abs(VTO_from_gfs - VTO0) / abs(VTO0)
```

Report `inconsistency` in `MODEL_CARD.md`. A value above 0.25 means the datasheet's own three numbers cannot be reconciled by a square law; say so in prose and expect the fit residuals to reflect it.

**Residual:**

```python
resid = np.array([
    (IDSS_model  - IDSS_target)  / IDSS_target,
    (VGSoff_model - VGSoff_target) / abs(VGSoff_target),
    (gfs_model   - gfs_target)   / gfs_target,
])
```

**Model evaluation**, one ngspice process per residual evaluation:

```spice
* JFET fit probe
.model JFIT NJF( ...current parameter vector... )
* IDSS and gfs at VGS = 0
J1 d1 0 0 JFIT
VD1 d1 0 DC <VDS_test>
* cutoff: force the cutoff test current, read VGS
J2 d2 g2 0 JFIT
VD2 d2 0 DC <VDS_test>
ICUT 0 d2 DC <ID_cutoff_test>
VG2 g2 0 DC <sweep handled by the outer solver>
.save @j1[id] @j1[gm] v(g2)
.op
.end
```

`IDSS_model = i(@j1[id])`, `gfs_model = @j1[gm]`. For `VGS(off)`, bisect `VG2` in an inner loop until `i(@j2[id])` equals the datasheet cutoff current; 20 bisection steps on a bracketed interval is deterministic and needs no derivative.

**Bounds:**

| Parameter | Lower | Upper |
|---|---|---|
| `VTO` (NJF) | `-abs(VGSoff_max) * 1.05` | `-abs(VGSoff_min) * 0.95` |
| `BETA` | 1e-6 | 1e-1 |
| `LAMBDA` | 0 | 0.1 |

`VTO` is bounded by the datasheet's own cutoff window, widened 5 percent. This is the key bound: it stops `VTO` from trading against `BETA` into a region the part is guaranteed not to occupy.

**Solver:** `least_squares(..., method="trf", x_scale="jac", diff_step=1e-4, ftol=1e-12, xtol=1e-12, max_nfev=5000)`.

**Convergence:** `status > 0` and worst `|resid| < 0.20`. If the datasheet consistency report already exceeded 0.25, accept up to `0.30` and record the reason verbatim in `MODEL_CARD.md`.

**When a transfer figure exists:** add its digitised points to the residual in log space (`np.log(ID_model) - np.log(ID_target)`) and release `B` with bounds `[0.5, 1.5]`. Drop the `B` omission entry.

**When only two of the three numbers are published:** fit `VTO` and `BETA` to those two exactly, freeze `LAMBDA = 0.005`, and record `"LAMBDA held at a family-typical default: no output-characteristics figure was available, so channel-length modulation is not fitted and drain output resistance is approximate."`

### 3.3 Stage 3: capacitances, in closed form

```python
CGD_meas = Crss                                  # at the stated bias
CGS_meas = Ciss - Crss
PB, M = 1.0, 0.5                                 # held; no C-vs-V figure exists on these parts
CGD = CGD_meas * (1.0 + VGD_test/PB)**M
CGS = CGS_meas * (1.0 + VGS_test/PB)**M
CGD = max(CGD, 1e-15); CGS = max(CGS, 1e-15)
```

`VGD_test = VDS_test - VGS_test` from the capacitance test conditions. Record: `"CGS and CGD derived from single tabulated Ciss and Crss points with PB and M held at physical defaults; capacitance versus bias is approximate."`

### 3.4 Stage 4: gate leakage

```python
IS = abs(IGSS) / max(np.exp(abs(VGS_igss_test)/(1.0*Vt)) - 1.0, 1.0)
IS = max(IS, 1e-20)
```

In practice `IGSS` is measured at a reverse bias of many volts, so the exponential is saturated and `IS` collapses to `abs(IGSS)`. Use the floor. Record: `"Gate leakage is set from the tabulated IGSS maximum, not fitted. Gate current is a constant reverse saturation and does not follow the datasheet's temperature curve."`

### 3.5 BF256B evidence status

The currently admitted BF256B evidence supports only an F1 bound-centred projection. Native ngspice verifies the resulting NJF card, but the evidence set has no transfer-characteristic curve, no output-characteristic curve family, and no `gfs` row. Those three absences must remain explicit in the model card. BF256B must not be promoted to F2 until curve-backed evidence is admitted; capacitance rows and bin limits alone do not support that claim.

### 3.6 Not fitted, ever, under this archetype

`KF`, `AF`, `VTOTC`, `BETATCE`, `XTI`, `EG`, `N`, `FC`.

`KF`/`AF` deserve a specific note. BF256B and MMBFJ201 are marketed as low-noise parts and publish `en` at a stated frequency. **That single point does not determine a flicker-noise corner**, and fitting `KF` to it would produce a model whose noise is right at one frequency and arbitrary elsewhere. Leave them at defaults and record the omission. `domain_coverage.noise` is `none`.

## 4. Standard test benches

### 4.1 `idss.cir` (analysis_type `operating_point`)

```spice
* <MPN> zero-gate-voltage drain current
.include ../model.cir
J1 d 0 0 OC_<MPN>
VD d 0 DC <VDS_test>
.save @j1[id] @j1[gm]
.op
.end
```

```json
{
  "name": "idss",
  "expression_source": { "kind": "raw_variable", "expression": "i(@j1[id])" },
  "expected_value": <IDSS_typ>, "unit": "A",
  "tolerance": { "absolute": 0, "relative": 0.20 },
  "datasheet_citation": "<mfr> <MPN> rev <r> p.<n>, electrical characteristics, IDSS at VDS=<V>, VGS=0",
  "placeholder": false
}
```

When the datasheet gives only a min and a max for `IDSS` (the usual case), ship a `hard_bounds_checks` entry with those two numbers instead of a scalar check. A bin window is a bound, not a target.

Also check `@j1[gm]` against `gfs` with relative 0.20, cited to the forward transfer admittance row.

### 4.2 `cutoff.cir` (analysis_type `dc_sweep`)

```spice
* <MPN> gate-source cutoff voltage
.include ../model.cir
J1 d g 0 OC_<MPN>
VD d 0 DC <VDS_test>
VG g 0 DC 0
.save @j1[id]
.dc VG <VGS_min> 0 0.005
.end
```

Check: the `v(g)` at which `abs(i(@j1[id]))` first exceeds the datasheet cutoff current. Expression: `v(g) at abs(i(@j1[id]))=<ID_cutoff>`. Bound it between `VGS(off)` min and max, cited to the cutoff row.

### 4.3 `transfer_curve.cir` (analysis_type `dc_sweep`)

Same netlist as 4.2 with a finer step and one scalar check per digitised figure point, tolerance relative 0.25.

### 4.4 `output_curve.cir` (analysis_type `dc_sweep`)

```spice
* <MPN> output characteristics
.include ../model.cir
J1 d g 0 OC_<MPN>
VD d 0 DC 0
VG g 0 DC 0
.save i(VD)
.dc VD 0 <VDS_max> 0.05 VG <VGS_lo> 0 <VGS_step>
.end
```

### 4.5 `capacitance.cir` (analysis_type `ac_small_signal`)

```spice
* <MPN> input and reverse transfer capacitance
.include ../model.cir
J1 d g 0 OC_<MPN>
VD d 0 DC <VDS_test> AC 1
VG g 0 DC <VGS_test> AC 1
.save i(VG) i(VD)
.ac lin 1 1meg 1meg
.end
```

`Ciss = abs(imag(i(vg)))/(2*pi*1e6)`. Use `abs`; the sign follows the source convention. Tolerance relative 0.20, absolute 0.5 pF.

## 5. `known_omissions` boilerplate

**Always:**
- `"No self-heating: junction temperature is fixed at TNOM."`
- `"IDSS and VGS(off) bin spread is not modelled. The fit targets one bin's published window; a real part may sit anywhere inside it."`
- `"Gate leakage is set from the tabulated IGSS maximum, not fitted."`
- `"Flicker and thermal noise are not modelled: KF and AF are at defaults. Published en figures were not fitted because a single-frequency noise point cannot determine a noise corner."`
- `"Temperature coefficients (VTOTC, BETATCE, XTI) are at defaults; only 25 C data was fitted."`
- `"Gate-junction forward conduction is a simple diode with IS set from IGSS; forward gate drive is not characterised."`
- `"Package parasitics are not modelled."`
- `"Breakdown (V(BR)GSS) is not modelled; the model does not break down."`

**Conditional:**
- No `rds(on)` row: `"Channel series resistance is not fitted (RD and RS at the numerical floor)."`
- No output figure: `"LAMBDA held at a family-typical default; channel-length modulation is not fitted."`
- No transfer figure: `"B held at 1.0 (pure square law): no transfer-characteristics figure was available to fit the doping profile exponent."`
- Always for capacitance: `"CGS and CGD derived from single tabulated Ciss and Crss points with PB and M held at physical defaults."`
- Consistency above 0.25: `"The datasheet's own IDSS, VGS(off) and gfs values are mutually inconsistent with a square law by <x> percent. The fit splits the difference across all three; no single one is reproduced exactly."`

## 6. `domain_coverage` defaults

| Domain | Rating | Condition |
|---|---|---|
| `dc` | `fitted` | Always for F2 |
| `ac` | `fitted` | `Ciss` and `Crss` both published; `none` if neither is |
| `transient` | `approx` | Capacitances are single-point derived, so switching edges are indicative |
| `noise` | `none` | Always under this archetype |
| `thermal` | `none` | Always |
| `digital` | `none` | Always |

`supported_analyses`: `["operating_point", "dc_sweep", "ac_small_signal", "transient"]`.

## 7. Numerical hygiene

1. **`RD >= 1e-4` and `RS >= 1e-4`.** Exactly zero removes the source degeneration that damps the Newton step near pinch-off.
2. **`CGS >= 1e-15` and `CGD >= 1e-15`** whenever any AC or transient bench exists.
3. **`BETA > 0` strictly.** A zero `BETA` makes the device an open circuit and floats the drain.
4. **`LAMBDA <= 0.1`.** Large values tilt the saturation region enough to produce a negative incremental output resistance in the triode-to-saturation transition.
5. **Sign discipline.** For `NJF`, `VTO` is negative. For `PJF`, `VTO` is positive and the whole card is fitted in the mirrored sign convention. A `PJF` with a negative `VTO` is depletion-mode-inverted and will conduct when it should be off. The factory must assert `sign(VTO) == -1` for `NJF` and `+1` for `PJF` before writing the card.
6. **The cutoff bench must sweep `VG` toward zero from below**, as in section 4.2, so the first crossing is unambiguous. Sweeping the other way finds the same voltage but the "first exceeds" expression then picks the wrong end of the sweep.
7. **Never bias the gate forward in a bench.** A forward-biased JFET gate is a diode with `IS` set from a leakage row; the resulting current is meaningless and can be large enough to break convergence.
