# Archetype: linear voltage regulator and shunt reference (behavioral subcircuit)

Family: `vreg_linear`. Model type: `subckt`. Fidelity ceiling **F2**.

Parts: LM7805, LM7812, LM317T, LM337, AMS1117-3.3, LM1117-5.0, MCP1700-3302E, TL431, LM4040A25.

Three variants:

| Variant | Parts | Nodes |
|---|---|---|
| **FIXED** | LM7805, LM7812, AMS1117-3.3, LM1117-5.0, MCP1700-3302E | `IN OUT GND` |
| **ADJ** | LM317T, LM337 | `IN OUT ADJ` |
| **SHUNT** | TL431 (3-terminal), LM4040A25 (2-terminal) | `K A REF` or `K A` |

The regulator is the archetype where naive behavioral modelling breaks the DC solver hardest. Every construct below was chosen because the obvious alternative was measured to fail. See section 7.

## 1. Subcircuit templates and node order

### Variant FIXED, node order `IN OUT GND`

```spice
* OpenCircuit original-from-facts model
* <MPN> (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: archetype-vreg.md, variant FIXED. Fit run: <run-id>
* Node order: X<ref> in out gnd OC_<MPN>
.subckt OC_<MPN> IN OUT GND
+ PARAMS: VREF=<V> VDROP=<V> ILIM=<A> LOADREG=<V> DILOAD=<A>
+ LINEREG=<V> DVLINE=<V> VNOM=<V> IQ=<A> RNEG=1 EPS=1e-8
* regulation target, with the line-regulation slope
BTGT tgt GND V = VREF + (LINEREG/DVLINE)*(v(IN,GND)-VNOM)
* dropout headroom: the output can never exceed IN minus the dropout
BHDR hdr GND V = v(IN,GND) - VDROP
* SMOOTH minimum of the two. A hard min() here breaks the solver; see 7.1
BSEL sel GND V = 0.5*(v(tgt)+v(hdr)) - 0.5*sqrt((v(tgt)-v(hdr))*(v(tgt)-v(hdr))+EPS)
* one-sided error: the pass element sources only, it never sinks
BERR er GND V = 0.5*((v(sel)-v(OUT,GND)) + sqrt((v(sel)-v(OUT,GND))*(v(sel)-v(OUT,GND))+EPS))
RER er GND 1meg
* pass element: load regulation sets the gain, ILIM sets the fold-over
BPASS IN OUT I = ILIM*tanh({DILOAD/LOADREG}/ILIM*v(er))
RSER OUT GND 1e7
* substrate/protection diode: keeps an overloaded output physical. See 7.3
DNEG GND OUT DCLAMP_<MPN>
IQD IN GND DC {IQ}
.model DCLAMP_<MPN> D(IS=1e-12 N=1 RS={RNEG})
.ends OC_<MPN>
```

A `.model` card inside a `.subckt` is legal in ngspice-46 and is scoped to that subcircuit. Verified.

### Variant ADJ, node order `IN OUT ADJ`

Everything is referenced to `ADJ`, not to ground. **Every voltage in this subcircuit must be written as a two-node difference against `ADJ`.** Mixing a ground-referenced `v(sel)` with an `ADJ`-referenced `v(OUT,ADJ)` was measured to put the output at 40 V on a part that should have produced 5.04 V.

```spice
.subckt OC_<MPN> IN OUT ADJ
+ PARAMS: VREF=<V> VDROP=<V> ILIM=<A> LOADREG=<V> DILOAD=<A>
+ IADJ=<A> RNEG=1 EPS=1e-8
BTGT tgt ADJ V = VREF
BHDR hdr ADJ V = v(IN,ADJ) - VDROP
BSEL sel ADJ V = 0.5*(v(tgt,ADJ)+v(hdr,ADJ)) - 0.5*sqrt((v(tgt,ADJ)-v(hdr,ADJ))*(v(tgt,ADJ)-v(hdr,ADJ))+EPS)
BERR er ADJ V = 0.5*((v(sel,ADJ)-v(OUT,ADJ)) + sqrt((v(sel,ADJ)-v(OUT,ADJ))*(v(sel,ADJ)-v(OUT,ADJ))+EPS))
RER er ADJ 1meg
BPASS IN OUT I = ILIM*tanh({DILOAD/LOADREG}/ILIM*v(er,ADJ))
RSER OUT ADJ 1e7
DNEG ADJ OUT DCLAMP_<MPN>
IADJD IN ADJ DC {IADJ}
.model DCLAMP_<MPN> D(IS=1e-12 N=1 RS={RNEG})
.ends OC_<MPN>
```

Verified against the textbook LM317 law with `R1 = 240`, `R2 = 720`: analytic `1.25*(1 + R2/R1) + IADJ*R2 = 5.036 V`, model produced **5.0353 V**.

### Variant SHUNT, node order `K A REF`

```spice
.subckt OC_<MPN> K A REF
+ PARAMS: VREF=<V> IKMIN=<A> IKMAX=<A> ZKA=<ohm>
BK K A I = IKMIN + (IKMAX-IKMIN)*tanh({1/(ZKA*(IKMAX-IKMIN))}*0.5*((v(REF,A)-VREF)+sqrt((v(REF,A)-VREF)*(v(REF,A)-VREF)+1e-12)))
RKA K A 1e7
.ends OC_<MPN>
```

For a two-terminal reference (LM4040A25) the subcircuit is `K A` and `REF` is internally tied to `K`.

Verified: a TL431 in the standard two-terminal connection (`REF` tied to `K`) fed through 1 k from 12 V produced **2.4968 V** against `VREF = 2.495` and `ZKA = 0.2`, an offset of 1.83 mV which is exactly `Ik * ZKA`.

## 2. Required datasheet inputs

| Symbol | Unit | Typical datasheet location | Conditions that MUST be recorded |
|---|---|---|---|
| `VO` nominal | V | Electrical characteristics, "Output Voltage" | `IO`, `VI`, Tj |
| Line regulation | V or mV | "Line Regulation" | **The input voltage range it is measured over**, and `IO`. Both numbers are required |
| Load regulation | V or mV | "Load Regulation" | **The output current range it is measured over**, and `VI`. Both numbers are required |
| Dropout voltage | V | "Dropout Voltage" | `IO` and Tj. LDOs specify it at several currents; record all |
| `IQ` / quiescent or ground current | A | "Quiescent Current" or "Ground Current" | `IO`, `VI` |
| Current limit / peak output | A | "Peak Output Current" or "Short-Circuit Current" | `VI` |
| `VI` max | V | Absolute maximum ratings | `supported_operating_region` only |
| `IADJ` (ADJ variant) | A | "Adjustment Pin Current" | `VI - VO`, `IO` |
| `VREF` (ADJ variant) | V | "Reference Voltage" | Measured between OUT and ADJ |
| `Vref` (SHUNT) | V | "Reference Voltage" | `IK`, Tamb. Record the grade (A grade is tighter) |
| `IKmin` (SHUNT) | A | "Minimum Cathode Current for Regulation" | |
| `ZKA` (SHUNT) | ohm | "Dynamic Impedance" | The `IK` range it is measured over |
| `IKmax` (SHUNT) | A | "Cathode Current" absolute maximum | |

**Line and load regulation are useless without their measurement ranges.** A "10 mV" load regulation over 5 mA to 1.5 A and over 0 to 100 mA describe completely different parts. If the range is missing, the number cannot be used; record a `known_omissions` entry and default the parameter.

## 3. Deterministic fitting procedure

### 3.1 Direct transcriptions

```python
VREF    = VO_nominal                        # FIXED; for ADJ this is the OUT-to-ADJ reference
VDROP   = dropout_at_rated_IO
ILIM    = peak_output_current               # NOT the rated continuous current; see 3.3
LOADREG = load_regulation_volts
DILOAD  = load_regulation_current_range     # e.g. 1.5 - 0.005
LINEREG = line_regulation_volts
DVLINE  = line_regulation_voltage_range     # e.g. 25 - 7
VNOM    = the input voltage the VO row was measured at
IQ      = quiescent_current
IADJ    = adjustment_pin_current            # ADJ variant only
```

Note that `LOADREG` and `LINEREG` enter as a **pair with their range**. The template divides by the range internally, so the datasheet numbers go in verbatim and the units cancel.

### 3.2 The two calibrated parameters

The `tanh` in `BPASS` is not linear across the full load range, so the realised load regulation exceeds the nominal. Verified: nominal 10 mV realised **12.25 mV** over 5 mA to 1.5 A, a 22 percent excess.

Correct with the same fixed-point calibration used by the opamp archetype:

```python
LOADREG_param = LOADREG_target
LINEREG_param = LINEREG_target
for _ in range(3):
    lr_meas = run_load_reg_bench(LOADREG_param, LINEREG_param)     # section 4.2
    ln_meas = run_line_reg_bench(LOADREG_param, LINEREG_param)     # section 4.3
    LOADREG_param *= LOADREG_target / lr_meas
    LINEREG_param *= LINEREG_target / ln_meas
```

Three fixed iterations. Assert the final measured values land within 5 percent of the datasheet.

### 3.3 `ILIM` must exceed the rated current

`ILIM` is the asymptote of a `tanh`, so the model can approach it but never reach it. Setting `ILIM` equal to the rated continuous output current makes the regulator collapse at its own rating. Verified: with `ILIM = 1.5 A` and a 1.5 A load, the output fell to **1.6 mV**.

**Rule: `ILIM` is the datasheet's peak or short-circuit current, never the rated continuous current.** For an LM7805 that is about 2.2 A, not 1 A. If the datasheet publishes no current limit, set `ILIM = 2.0 * rated_continuous_current` and record: `"Current limit is estimated at twice the rated continuous output current: the datasheet publishes no current-limit or short-circuit figure. Overload behaviour is indicative only."`

### 3.4 Never fitted under this archetype

`RNEG = 1` and `EPS = 1e-8` are fixed archetype constants. `RSER = 1e7` is fixed. `RER = 1meg` is fixed. None of them correspond to a datasheet quantity and none may be adjusted to make a bench pass.

Thermal shutdown, safe-operating-area foldback, and the reverse-current path from OUT to IN are not modelled. See omissions.

### 3.5 Negative regulators (LM337)

`LM337` is the negative counterpart of `LM317`. Fit it in **mirrored sign convention**: `VREF = -1.25`, `IADJ` negative, dropout positive. The `sqrt` softmin becomes a soft **maximum** (flip the sign of the `sqrt` term) because the output is more negative than the input plus dropout. Assert `sign(VREF) == -1` before writing the card. The same applies to `LM7900`-series parts if they are ever added.

## 4. Standard test benches

### 4.1 `output_voltage.cir` (analysis_type `operating_point`)

```spice
* <MPN> output voltage at the datasheet test condition
.include ../model.cir
VIN in 0 DC <VNOM>
X1 in out 0 OC_<MPN>
ILOAD out 0 DC <IO_test>
.save v(out) i(VIN)
.op
.end
```

Checks: `v(out)` against `VO` with tolerance equal to the datasheet's own output-voltage tolerance (5 percent for a 7805, 1 percent for an AMS1117, 0.5 percent for a TL431 A-grade). `abs(i(vin)) - <IO_test>` against `IQ`, relative 0.20.

### 4.2 `load_regulation.cir` (analysis_type `dc_sweep`)

```spice
* <MPN> load regulation across the datasheet current range
.include ../model.cir
VIN in 0 DC <VNOM>
X1 in out 0 OC_<MPN>
ILOAD out 0 DC 0
.save v(out)
.dc ILOAD <IO_min> <IO_max> <step>
.end
```

Check: `(v(out) at i(iload)=<IO_min>) - (v(out) at i(iload)=<IO_max>)` against `LOADREG`, relative 0.30. The README's 30 percent regulation band applies; regulation figures are published as maxima and a typical part is better.

### 4.3 `line_regulation.cir` (analysis_type `dc_sweep`)

```spice
* <MPN> line regulation and dropout
.include ../model.cir
VIN in 0 DC 0
X1 in out 0 OC_<MPN>
RL out 0 <RL_test>
.save v(out) v(in)
.dc VIN 0 <VI_max> 0.02
.end
```

Two checks from one sweep:

- Line regulation: `(v(out) at v(in)=<V_hi>) - (v(out) at v(in)=<V_lo>)` against `LINEREG`, relative 0.30.
- Dropout: `(v(in) at v(out)=<0.98*VO>) - <0.98*VO>` against `VDROP`, relative 0.25.

**Do not place a measurement at the exact endpoint of a `.dc` sweep.** A `FIND ... AT=20` on a sweep declared `0 20 0.02` was measured to fail with `out of interval` because of floating-point accumulation on the sweep variable. Place endpoint checks at least one step inside the range.

### 4.4 `overload.cir` (analysis_type `operating_point`)

```spice
* <MPN> behaviour beyond the current limit
.include ../model.cir
VIN in 0 DC <VNOM>
X1 in out 0 OC_<MPN>
ILOAD out 0 DC <2.5*ILIM>
.save v(out)
.op
.end
```

This bench has no datasheet scalar to check against. It ships as a **hard bound only**: `v(out)` must lie between `-10` V and `VO`, cited to the absolute maximum ratings. Its purpose is to catch the runaway described in section 7.3, where an overloaded output reached -35 megavolts.

### 4.5 `shunt_reference.cir` (SHUNT variant, analysis_type `dc_sweep`)

```spice
* <MPN> reference voltage across the cathode current range
.include ../model.cir
VIN in 0 DC 12
RS in k <RS_test>
X1 k 0 k OC_<MPN>
.save v(k)
.dc VIN 3 30 0.05
.end
```

Check `v(k)` at two input voltages spanning the `IK` range, against `Vref`, with the datasheet's grade tolerance. The difference between them, divided by the `IK` change, is checked against `ZKA`, relative 0.30.

## 5. `known_omissions` boilerplate

**Always:**
- `"Thermal shutdown is not modelled. The regulator does not shut down or fold back when it overheats; it will dissipate arbitrary power indefinitely."`
- `"Safe-operating-area foldback is not modelled. The current limit is a constant, whereas a real regulator reduces it at high input-to-output differential."`
- `"No self-heating and no temperature coefficients. Output voltage drift, dropout increase, and quiescent-current change with temperature are not modelled."`
- `"Reverse current from OUT to IN is not modelled beyond a protective clamp. Discharging the output through the regulator does not reproduce the real part's behaviour."`
- `"AC behaviour is not modelled: there is no control-loop pole, no output impedance versus frequency, and no ripple rejection. PSRR and transient load-step response are absent."`
- `"Loop stability is not modelled. This model regulates with any output capacitor or none, whereas a real LDO oscillates outside its specified ESR window."`
- `"Start-up behaviour, soft-start and inrush are not modelled."`
- `"Noise is not modelled."`
- `"Output voltage is set to the datasheet nominal; a real part may sit anywhere inside the published tolerance band."`

**Conditional:**
- No current-limit row: `"Current limit is estimated at twice the rated continuous output current: the datasheet publishes no current-limit figure."`
- Missing regulation range: `"Load (or line) regulation is not fitted: the datasheet publishes the figure without its measurement range."`
- LDO parts: `"Dropout is a single constant taken at the rated current. Real LDO dropout rises with load current; this model's does not."`
- ADJ variant: `"The adjustment pin current is a constant. Its real variation with input-to-output differential and temperature is not modelled."`
- SHUNT variant: `"Cathode dynamic impedance is a single constant taken from the datasheet's stated current range; its variation with frequency and current is not modelled."`

## 6. `domain_coverage` defaults

| Domain | Rating | Condition |
|---|---|---|
| `dc` | `fitted` | Always for F2 |
| `ac` | `none` | Always. There is no control loop in this model |
| `transient` | `approx` | The model responds instantly; only large-signal DC behaviour is meaningful |
| `noise` | `none` | Always |
| `thermal` | `none` | Always |
| `digital` | `none` | Always |

`supported_analyses`: `["operating_point", "dc_sweep", "transient"]`. **Do not list `ac_small_signal`.** A user running an AC sweep on this model would get a flat, poleless response that looks like infinite ripple rejection, which is worse than refusing the analysis.

## 7. Numerical hygiene

1. **Never use a hard `min()` inside the regulation loop.** The dropout selector picks between the target and the input headroom, and a hard `min()` there is non-differentiable exactly where the solution sits during start-up. Verified: the hard-`min` version emitted `Dynamic gmin stepping failed` and `True gmin stepping failed`; the smooth form `0.5*(a+b) - 0.5*sqrt((a-b)^2 + eps)` converged with no warnings at all. Note the distinction: a `Note: ... completed` message is benign, a `Warning: ... failed` means the solver fell through to source stepping and the model is fragile.
2. **`EPS = 1e-8` in the softmin and softplus, and no larger.** Raising it to `1e-4` was measured to shift the regulated output from 5.000 V to **5.750 V**. The epsilon is a rounding radius, not a tuning knob.
3. **Use a real diode primitive for the overload clamp, not a behavioral one-sided B-source.** Without any clamp, a 5 A load on a 2.2 A regulator drove the output to **-3.5e7 V** through the 1e7 shunt. A behavioral `sqrt`-based clamp fixed the voltage but reintroduced `gmin stepping failed`. A `.model D` diode fixed both: the output clamped to a physical -3.54 V with **zero solver warnings**. ngspice has dedicated junction limiting and damping for diodes and none for B-sources; use the machinery that exists.
4. **The pass element must source current from `IN`, not from `GND`.** `BPASS GND OUT I = ...` compiles, regulates, and is wrong: the input terminal then supplies only the quiescent current and the load current appears from nowhere. Verify in every package by asserting that the `output_voltage.cir` bench reports `abs(i(vin)) == IO_test + IQ` within 1 percent.
5. **The error term must be one-sided.** A two-sided `tanh` centred on zero error makes the pass element idle at `ILIM/2`, which was measured to offset the output by **+16.8 mV** at light load. The `0.5*(x + sqrt(x^2+eps))` softplus form idles at zero.
6. **In the ADJ variant, every voltage is referenced to `ADJ`.** Mixing a ground-referenced `v(sel)` with an `ADJ`-referenced difference produced **40 V** on a part that should have produced 5.04 V. The factory must grep the ADJ template for any single-argument `v(` other than the permitted internal nodes.
7. **`RSER = 1e7`, not `1e9` or higher.** This is the shunt that gives the output node a DC path when the pass element is off.
8. **`RER` to ground (or to `ADJ`) is mandatory.** `BERR` is a voltage-source expression whose output node otherwise has no conductance and yields a singular matrix.
9. **`ILIM` strictly greater than the rated continuous current.** See 3.3.
10. **Do not measure at a `.dc` sweep endpoint.** Floating-point accumulation on the sweep variable makes the last point land just outside the requested value.
