# Archetype: bipolar junction transistor (Gummel-Poon `.model NPN` / `.model PNP`)

Families: `bjt_npn`, `bjt_pnp`. Model type: `dot_model`. Fidelity ceiling **F2**.

Parts: 2N3904, 2N3906, PN2222A, BC547B, BC557B, BC337-40, BC327-40, 2N5551, MPSA42, TIP31C, TIP32C, TIP120, TIP125, BC846B, MMBT3904, MMBT3906, SS8050.

Darlingtons (TIP120, TIP125) are **not** a single Gummel-Poon device. See section 9.

## 1. Card template and node order

**Node order is `collector base emitter [substrate]`.** `Q1 c b e MODELNAME`. The substrate node is omitted for discrete parts.

```spice
* scheMAGIC original-from-facts model
* <MPN> (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: archetype-bjt.md. Fit run: <run-id>
* Node order: Q<ref> collector base emitter OC_<MPN>
.model OC_<MPN> <NPN|PNP> (
+ IS=<A>     NF=1.0    BF=<->     IKF=<A>    ISE=<A>    NE=<->
+ VAF=<V>
+ BR=<->     NR=1.0    IKR=<A>    ISC=<A>    NC=<->     VAR=<V>
+ RB=<ohm>   IRB=<A>   RBM=<ohm>  RE=<ohm>   RC=<ohm>
+ CJE=<F>    VJE=<V>   MJE=<->    CJC=<F>    VJC=<V>    MJC=<->   XCJC=<->
+ TF=<s>     XTF=<->   VTF=<V>    ITF=<A>    TR=<s>
+ FC=0.5     EG=1.11   XTI=3      XTB=<->    TNOM=27
+)
```

Verified accepted parameters beyond the above: `PTF CJS VJS MJS KF AF NKF QCO SUBS VBE_MAX VCE_MAX PD_MAX`. `ICRATING` is **rejected**.

`VBE_MAX`, `VCE_MAX`, `PD_MAX` parse but produced **no observable warning** in an ngspice-46 batch `.op` run that exceeded them (VCE 60 V against `VCE_MAX=40`). Do not rely on them as a safe-operating-area guard. Absolute maximum ratings belong in `component.json` under `supported_operating_region.numeric_bounds`.

`NF` and `NR` stay at 1.0 unless a Gummel plot is published, which for a jellybean part it never is. Fitting `NF` against an `hFE` table is how you produce a model that matches the table and nothing else.

## 2. Required datasheet inputs

| Symbol | Unit | Typical datasheet location | Conditions that MUST be recorded |
|---|---|---|---|
| `hFE` at 4 or more `IC` | dimensionless at A | Electrical characteristics table, "DC Current Gain" rows (one row per IC); and the "DC Current Gain vs Collector Current" figure | Each `IC`, the `VCE` used, Tamb |
| `VBE(on)` at 1 or more `IC` | V at A | Electrical characteristics, "Base-Emitter On Voltage" | `IC`, `VCE`, Tamb |
| `VCE(sat)` at 2 `IC`/`IB` pairs | V | Electrical characteristics, "Collector-Emitter Saturation Voltage" | Both `IC` and `IB` for each row |
| `VBE(sat)` at the same pairs | V | Same table, "Base-Emitter Saturation Voltage" | `IC`, `IB` |
| `fT` | Hz | Electrical characteristics, "Current Gain Bandwidth Product" | `IC`, `VCE`, the measurement frequency |
| `Cobo` (or `Ccb`) | F | Electrical characteristics, "Output Capacitance" | `VCB`, frequency (usually 1 MHz), `IE=0` |
| `Cibo` (or `Ceb`) | F | Electrical characteristics, "Input Capacitance" | `VEB`, frequency, `IC=0` |
| `VAF` (Early voltage) | V | **Rarely tabulated.** Read from the output characteristics figure | The `IB` curve used and the two `VCE` points |
| `V(BR)CEO`, `V(BR)CBO`, `V(BR)EBO` | V | Absolute maximum ratings | For `supported_operating_region` only |
| `IC` max, `PD` max | A, W | Absolute maximum ratings | For `supported_operating_region` only |

## 3. Deterministic fitting procedure

Fitting runs in a fixed order because later stages consume earlier results. **Do not reorder.**

The DC stage refines against **native ngspice itself**, not a Python reimplementation of Gummel-Poon. Measured cost is about 18 ms per ngspice process (55 runs/second), so a 5000-evaluation `least_squares` completes in about 90 seconds. Fitting against the engine that will ship the model removes any chance of a Python/ngspice model mismatch.

### 3.1 Stage 1: junction capacitances (no dependencies)

Datasheet capacitances are measured at a reverse bias; ngspice `CJC`/`CJE` are zero-bias values.

```python
VJC, MJC = 0.75, 0.33          # held; a discrete datasheet never gives C vs V for both junctions
VJE, MJE = 0.75, 0.33
CJC = Cobo * (1.0 + VCB_test/VJC)**MJC
CJE = Cibo * (1.0 + VEB_test/VJE)**MJE
XCJC = 1.0                      # no data splits CJC between internal and external base
```

Record: `"CJE and CJC derived from single tabulated capacitance points with VJE, VJC, MJE, MJC held at physical defaults; capacitance versus bias is approximate."` and `"XCJC held at 1.0: no data apportions the collector-base capacitance across the base resistance."`

If a "Capacitance vs Reverse Voltage" figure exists, digitise 5 or more points per junction and fit `CJx`, `VJx`, `MJx` with bounds `VJ in [0.4, 1.0]`, `MJ in [0.2, 0.6]`, and drop the omission entry for that junction.

### 3.2 Stage 2: parasitic resistances from saturation

Two `VCE(sat)` rows at different `IC`/`IB` give two equations. In deep saturation `VCE(sat)` is dominated by `RC + RE` plus the intrinsic offset:

```python
# closed-form seed from the two saturation rows
slope = (VCEsat2 - VCEsat1) / (IC2 - IC1)
RC_plus_RE = max(slope, 2e-4)
RE0 = 0.25 * RC_plus_RE          # emitters are the smaller share on small-signal parts
RC0 = RC_plus_RE - RE0
# base resistance seed from the VBE(sat) rows
RB0 = max((VBEsat2 - VBEsat1) / (IB2 - IB1), 1e-4)
```

`IRB` and `RBM` stay at defaults. Record: `"Base resistance modulation is not fitted (IRB, RBM at defaults): the datasheet publishes no base-resistance-versus-current data."`

For a power part (TIP31C, TIP32C) split `RE0 = 0.15 * RC_plus_RE`; power devices are collector-resistance dominated.

### 3.3 Stage 3: DC transport, ngspice in the loop

Free parameters: `log10(IS)`, `BF`, `log10(IKF)`, `log10(ISE)`, `NE`, `RE`, `RC`, `RB`, `VAF`.

**Seed:**

```python
BF0   = max(hFE_table)                      # peak of the tabulated gain
IKF0  = IC_at_peak_hFE * 3.0                # the knee sits above the peak
ISE0  = 1e-13
NE0   = 1.5
VAF0  = 100.0 if VAF_measured is None else VAF_measured
# IS from the VBE(on) row, backing out the emitter drop
IS0   = IC_vbeon * np.exp(-(VBE_on - IC_vbeon*RE0) / (1.0 * Vt))
```

**Targets and residuals.** Build one residual vector from three groups, each already dimensionless:

```python
r_gain = np.log(hFE_model) - np.log(hFE_target)          # one per tabulated IC
r_vbe  = (VBE_model - VBE_target) / 0.010                # normalised to a 10 mV scale
r_sat  = (VCEsat_model - VCEsat_target) / 0.020          # normalised to a 20 mV scale
resid  = np.concatenate([r_gain, W_VBE*r_vbe, W_SAT*r_sat])
```

`W_VBE = W_SAT = 1.0`. Do not tune weights per part; a per-part weight is a judgment call and is forbidden. If a group will not fit, the fix is to drop a parameter, not to reweight.

**Model evaluation.** For each residual evaluation, emit one netlist containing every operating point as an independent, separately biased device, and run it once:

```spice
* GP fit probe, one device per target point
.model QFIT <NPN|PNP> ( ...current parameter vector... )
* gain and VBE points: forced IB, forced VCE
VC1 c1 0 DC <VCE_test>
IB1 0 b1 DC <IB_1>
Q1 c1 b1 0 QFIT
* ... repeated per point ...
* saturation points: forced IB and forced IC
VCS1 cs1 0 DC 0
IBS1 0 bs1 DC <IB_sat1>
ICS1 0 cs1 DC <IC_sat1>
QS1 cs1 bs1 0 QFIT
.save @q1[ic] @q1[ib] @q1[vbe] v(cs1)
.op
.end
```

One process per residual evaluation, not one per point. Read `i(@q1[ic])`, `i(@q1[ib])`, `v(@q1[vbe])` from the rawfile. Note the name rewriting: `.save @q1[ic]` appears as `i(@q1[ic])` and `.save @q1[vbe]` as `v(@q1[vbe])`.

**Bounds:**

| Parameter | Lower | Upper |
|---|---|---|
| `log10(IS)` | -18 | -10 |
| `BF` | 1 | 2000 |
| `log10(IKF)` | -4 | 2 |
| `log10(ISE)` | -18 | -9 |
| `NE` | 1.2 | 4.0 |
| `RE` | 1e-4 | 20 |
| `RC` | 1e-4 | 100 |
| `RB` | 1e-4 | 1000 |
| `VAF` | 10 | 1000 |

**Solver:** `least_squares(..., method="trf", x_scale="jac", diff_step=1e-4, ftol=1e-10, xtol=1e-10, max_nfev=5000)`. `diff_step=1e-4` is required: the default step is too small against ngspice's convergence floor and produces a numerically zero Jacobian column.

**Convergence:** `status > 0`, worst `|r_gain| < 0.223` (25 percent), worst `|r_vbe| < 2.0` (20 mV), worst `|r_sat| < 3.0` (60 mV).

**When VAF cannot be measured** (no output-characteristics figure): freeze `VAF = 100` for small-signal parts and `VAF = 60` for power parts, fit the rest, and record `"VAF held at a family-typical default: the datasheet publishes no output characteristics figure, so the Early effect is not fitted. Output conductance and voltage gain in common-emitter stages are approximate."` This is the single most common degraded path in this archetype.

**When only 2 hFE rows exist:** fit `IS`, `BF`, `RE` only. Freeze `IKF` at `1e3` (effectively disabled), `ISE` at `0`, `NE` at `1.5`. Record `"High-current gain roll-off (IKF) and low-current recombination (ISE, NE) are not fitted: fewer than four tabulated hFE points."`

### 3.4 Stage 4: forward transit time from fT

`TF` is computed in closed form after the capacitances and resistances are known. Do not fit it.

```python
tau_T = 1.0/(2*np.pi*fT)
gm    = IC_fT / Vt
TF    = tau_T - (CJE + CJC)/gm - CJC*(RC + RE)
TF    = max(TF, 1e-12)          # floor; a negative TF means the capacitances dominate
```

If the floor binds, the published `fT` is inconsistent with the published capacitances at that bias. Record `"TF floored at 1 ps: the datasheet fT and capacitance rows are mutually inconsistent at the stated bias. High-frequency response is approximate."`

`XTF`, `VTF`, `ITF` stay at defaults. Record `"Transit-time bias dependence (XTF, VTF, ITF) is not fitted: fT is published at a single bias point."`

`TR` stays at default unless a storage-time row exists. If `ts` is published: `TR = ts / np.log(1 + IB_on/IB_off)`.

### 3.5 Stage 5: reverse parameters

`BR`, `IKR`, `ISC`, `NC`, `VAR` are almost never characterised on a jellybean datasheet. Set `BR = 4.0` for small-signal silicon and `BR = 2.0` for power parts, leave the rest defaulted, and record: `"Reverse (inverse-active) operation is not fitted: BR is a family-typical default and IKR, ISC, NC, VAR are at defaults. Reverse-biased and inverted-mode behaviour is not trustworthy."`

`XTB` stays at default unless an `hFE` versus temperature figure is digitised.

## 4. Standard test benches

### 4.1 `dc_gain.cir` (analysis_type `operating_point`)

One forced-`IB` device per tabulated `hFE` row, all in one netlist.

```spice
* <MPN> DC current gain at datasheet collector currents
.include ../model.cir
VC1 c1 0 DC <VCE_test>
IB1 0 b1 DC <IB_1>
Q1 c1 b1 0 OC_<MPN>
VC2 c2 0 DC <VCE_test>
IB2 0 b2 DC <IB_2>
Q2 c2 b2 0 OC_<MPN>
.save @q1[ic] @q1[ib] @q1[vbe] @q2[ic] @q2[ib]
.op
.end
```

Scalar check per row:

```json
{
  "name": "hfe_at_ic_<IC1>",
  "expression_source": { "kind": "derived_expression", "expression": "abs(i(@q1[ic]) / i(@q1[ib]))" },
  "expected_value": <hFE1>, "unit": "1",
  "tolerance": { "absolute": 0, "relative": 0.30 },
  "datasheet_citation": "<mfr> <MPN> rev <r> p.<n>, electrical characteristics, hFE at IC=<IC1>, VCE=<VCE>",
  "placeholder": false
}
```

Relative 0.30 overrides the README default. Reason: `hFE` is published as a min/max band that routinely spans 3:1 (2N3904 is 100 to 300 at 10 mA), so a tighter band on the typical would be false precision. Where the datasheet gives only min and max, use a `hard_bounds_checks` entry with those two numbers and no scalar check.

Hard bound on the same run: `v(@q1[vbe])` in [0.5, 0.95] V, cited to the VBE(on) rows.

### 4.2 `output_curve.cir` (analysis_type `dc_sweep`)

Nested `.dc` is supported and produces one plot of `N1*N2` points (verified: 101 x 5 = 505 rows).

```spice
* <MPN> output characteristics, IC vs VCE across IB
.include ../model.cir
VCE c 0 DC 0
IB 0 b DC 0
Q1 c b 0 OC_<MPN>
.save i(VCE) @q1[ic]
.dc VCE 0 10 0.05 IB <IB_start> <IB_stop> <IB_step>
.end
```

Checks: `IC` at a stated (`VCE`, `IB`) grid point against the figure; and the Early slope, `(IC(VCE=10) - IC(VCE=2))/(10-2)`, against the digitised figure slope. Tolerance for the slope: relative 0.50, because `VAF` is usually a defaulted parameter and this check is then a sanity bound rather than a fit target. State that in `MODEL_CARD.md`.

### 4.3 `saturation.cir` (analysis_type `operating_point`)

```spice
* <MPN> saturation voltages at datasheet IC/IB pairs
.include ../model.cir
VS1 s1 0 DC 0
IC1 0 cs1 DC <IC_sat1>
IBS1 0 bs1 DC <IB_sat1>
Q1 cs1 bs1 0 OC_<MPN>
RS1 cs1 s1 1e-6
.save v(cs1) v(bs1)
.op
.end
```

Check `v(cs1)` against `VCE(sat)` with tolerance relative 0.15, absolute 0.02 V, and `v(bs1)` against `VBE(sat)` with the same band.

### 4.4 `ft_bench.cir` (analysis_type `ac_small_signal`)

Measure `fT` as the frequency where the small-signal current gain magnitude reaches 1, from a common-emitter stage biased at the datasheet `IC`.

```spice
* <MPN> current gain bandwidth product at the datasheet bias
.include ../model.cir
VCC c 0 DC <VCE_fT>
IBDC 0 b DC <IB_bias>
IAC 0 b AC 1
Q1 c b 0 OC_<MPN>
.save @q1[ic]
.ac dec 20 1meg 10g
.end
```

`beta(f) = i(@q1[ic]) / 1A`. The check is `fT` = the frequency where `mag(i(@q1[ic]))` crosses 1. Tolerance: relative 0.20. The AC bias node must be driven by a **DC current source in parallel with the AC source**; driving the base from a voltage source makes the result dominated by the source impedance rather than the device.

### 4.5 `capacitance.cir` (analysis_type `ac_small_signal`)

```spice
* <MPN> output capacitance Cobo at the datasheet bias
.include ../model.cir
VCB c 0 DC <VCB_test> AC 1
Q1 c b 0 OC_<MPN>
VB b 0 DC 0
.save i(VCB)
.ac lin 1 1meg 1meg
.end
```

`Cobo = imag(i(vcb))/(2*pi*1e6)`. Tolerance: relative 0.20, absolute 0.5 pF.

## 5. `known_omissions` boilerplate

**Always:**
- `"No self-heating: junction temperature is fixed at TNOM. Safe-operating-area and thermal-runaway behaviour is not modelled."`
- `"Absolute maximum ratings are metadata only. The model conducts happily past V(BR)CEO; it does not break down or fail."`
- `"Package parasitics (lead inductance, package capacitance) are not modelled."`
- `"Reverse (inverse-active) operation is not fitted: BR is a family-typical default and IKR, ISC, NC, VAR are at defaults."`
- `"Base resistance modulation is not fitted (IRB, RBM at defaults)."`
- `"Transit-time bias dependence (XTF, VTF, ITF) is not fitted: fT is published at a single bias."`
- `"Flicker and burst noise are not modelled: KF and AF are at defaults."`
- `"hFE bin spread is not modelled. The fit targets the typical or the stated bin; a real part may sit anywhere in the published min-to-max band."`

**Conditional:**
- No Early figure: `"VAF held at a family-typical default: no output characteristics figure was available, so the Early effect is not fitted."`
- Fewer than 4 hFE rows: `"High-current gain roll-off (IKF) and low-current recombination (ISE, NE) are not fitted."`
- TF floored: `"TF floored at 1 ps: the published fT and capacitance rows are mutually inconsistent at the stated bias."`
- Single capacitance points: `"CJE and CJC derived from single tabulated points with VJ and MJ held at physical defaults."`
- Always unless a temperature figure was digitised: `"Temperature coefficients (XTB, EG, XTI) are at physical defaults; only 25 C data was fitted."`

## 6. `domain_coverage` defaults

| Domain | Rating | Condition |
|---|---|---|
| `dc` | `fitted` | Always for F2 |
| `ac` | `fitted` | Both capacitances and `TF` fitted; `approx` if `TF` was floored |
| `transient` | `fitted` | Same condition as `ac`; `approx` if `TR` defaulted and a switching bench exists |
| `noise` | `none` | `KF`/`AF` are never fitted from a discrete datasheet |
| `thermal` | `none` | Always |
| `digital` | `none` | Always |

`supported_analyses`: `["operating_point", "dc_sweep", "ac_small_signal", "transient"]`.

## 7. Numerical hygiene

1. **Bias the base with a current source in every fitting and test bench.** A voltage-driven base is exponentially stiff and its operating point depends on `.options reltol`. Every bench in section 4 is current-driven for this reason.
2. **`RE >= 1e-4`, `RC >= 1e-4`, `RB >= 1e-4`.** A zero emitter resistance removes the local negative feedback that damps the Newton iteration at high injection.
3. **`IKF` must be either fitted or effectively disabled at `1e3`, never left near the operating current by accident.** An `IKF` inside the normal operating range that was not fitted will silently halve the gain.
4. **Never set `ISE` and `NE` without at least two low-current gain points.** An unconstrained `ISE`/`NE` pair will absorb any residual and produce a model that is right at the fitted points and wrong everywhere between them.
5. **`CJE`, `CJC` floor at `1e-15` F** whenever a transient or AC bench exists.
6. **`TF` floor at `1e-12` s.** A negative or zero `TF` is unphysical and makes the excess phase term misbehave.
7. **Saturation benches must force both `IC` and `IB`.** Forcing `VCE` and `IB` instead puts the solution on the steep part of the output curve where a small parameter change moves `IC` by decades.
8. **Do not use `.options gmin` to rescue a non-convergent fit netlist.** If a fit probe fails to converge, the parameter vector is in an unphysical region; tighten the bounds instead. Silently loosening `gmin` changes the answer for every point in the residual.

## 8. Alias parts that share a die

`2N3904`/`MMBT3904`, `2N3906`/`MMBT3906`, `BC547B`/`BC846B` are separate `component.json` entries with distinct `package_variants`. They may share one fitted `model.cir` **only when both datasheets cite the same die and the same electrical table**. When they do, both packages record `licence.provenance_basis = "original_from_facts"`, both cite their own datasheet in `sources.json`, and each `MODEL_CARD.md` names the sibling. If the electrical tables differ in any fitted row, fit separately.

## 9. Darlington parts (TIP120, TIP125)

A Darlington is **not** a Gummel-Poon device and must not be fitted as one. Its `hFE` (1000 or more), its `VBE(on)` (about 1.4 V, two junctions), and its `VCE(sat)` (about 2 V, never below one diode drop) are all structurally outside the single-transistor model.

Ship a **subcircuit** containing two fitted `NPN` cards plus the datasheet's internal base-emitter resistors and the internal freewheeling diode:

```spice
.subckt OC_TIP120 C B E
Q1 C B  N1 OC_TIP120_DRV
Q2 C N1 E  OC_TIP120_OUT
R1 B  N1 <R1_datasheet>
R2 N1 E  <R2_datasheet>
D1 E C OC_TIP120_FWD
.ends OC_TIP120
```

`model_type` becomes `subckt`. `R1`, `R2` and the diode are read from the datasheet's internal schematic figure, which every Darlington datasheet publishes. Fit `OC_TIP120_OUT` from the composite `VCE(sat)` and `IC` rows, and give `OC_TIP120_DRV` the same card scaled to one tenth the current capability. Record: `"Darlington modelled as two Gummel-Poon devices plus the datasheet internal bias resistors and freewheel diode. The two dies are not independently characterised; only the composite terminal behaviour is fitted."` Fidelity ceiling for Darlingtons is **F2** on composite terminal behaviour and **F1** on internal node behaviour.
