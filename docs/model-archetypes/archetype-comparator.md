# Archetype: comparator (analog behavioral subcircuit)

Family: `comparator`. Model type: `subckt`. Fidelity ceiling **F2**.

Parts: LM393, LM339, LM311, TLV3702, MCP6561.

A comparator is not an opamp with more gain. It has a bounded internal gain node, a propagation delay that is a real datasheet quantity, an output stage that is usually open collector, and sometimes built-in hysteresis. It is also the part most likely to be dropped into a beginner's oscillator, so its output stage must be numerically clean under capacitive load.

Two output variants, selected by the datasheet:

| Variant | Parts | Output stage |
|---|---|---|
| **OC** open collector / open drain | LM393, LM339, LM311 | Behavioral conductance to ground, needs an external pull-up |
| **PP** push-pull | TLV3702, MCP6561 | Transconductance output with rail drops and current limit |

## 1. Subcircuit templates and node order

**Node order is `INP INN OUT VCC GND`** for both variants. Fixed across the library.

### Variant OC

```spice
* OpenCircuit original-from-facts model
* <MPN> (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: archetype-comparator.md, variant OC. Fit run: <run-id>
* Node order: X<ref> inp inn out vcc gnd OC_<MPN>
* External pull-up REQUIRED: this output can only sink.
.subckt OC_<MPN> INP INN OUT VCC GND
+ PARAMS: AOL=<V/V> VOS=<V> IBIAS=<A> IOS=<A> TPD=<s>
+ ROL=<ohm> ROFF=1e9 VCLAMP=1 KSW=20 VHYST=<V> IQ=<A> CD=10p
IBP GND INP DC {IBIAS+IOS/2}
IBN GND INN DC {IBIAS-IOS/2}
CDIF INP INN 1p
BC c GND V = VCLAMP*tanh((AOL/VCLAMP)*(v(INP,INN)+VOS+VHYST*v(cd)/VCLAMP))
RC c cd {TPD/0.693/CD}
CC cd GND {CD}
ROC OUT GND R={1/((1/ROL)*0.5*(1-tanh(KSW*v(cd)/VCLAMP))+1/ROFF)}
IQD VCC GND DC {IQ}
.ends OC_<MPN>
```

### Variant PP

```spice
.subckt OC_<MPN> INP INN OUT VCC GND
+ PARAMS: AOL=<V/V> VOS=<V> IBIAS=<A> IOS=<A> TPD=<s>
+ ROUT=<ohm> ILIM=<A> VDRP_H=<V> VDRP_L=<V>
+ VCLAMP=1 KSW=20 VHYST=<V> IQ=<A> CD=10p
IBP GND INP DC {IBIAS+IOS/2}
IBN GND INN DC {IBIAS-IOS/2}
CDIF INP INN 1p
BC c GND V = VCLAMP*tanh((AOL/VCLAMP)*(v(INP,INN)+VOS+VHYST*v(cd)/VCLAMP))
RC c cd {TPD/0.693/CD}
CC cd GND {CD}
BQ q GND V = VDRP_L + (v(VCC,GND)-VDRP_H-VDRP_L)*0.5*(1+tanh(KSW*v(cd)/VCLAMP))
RQ q GND 1meg
BOUT GND OUT I = ILIM*tanh((v(q)-v(OUT,GND))/(ROUT*ILIM))
IQD VCC GND DC {IQ}
.ends OC_<MPN>
```

Structural notes that are not optional:

- **`BC` is bounded to `+/-VCLAMP`.** An unbounded high-gain node feeding an RC makes the propagation delay depend on the input overdrive in a way that has nothing to do with the real device, because the RC then has to traverse a range set by `AOL * overdrive`. Bounding it makes the delay a genuine model parameter. `VCLAMP = 1` is an internal scale, not a datasheet quantity; do not fit it.
- **The hysteresis term is positive feedback from the post-delay node `cd`**, not from the output. Taking it from the output would make hysteresis depend on the external pull-up.
- **`VHYST` is half the datasheet hysteresis.** The term shifts the trip point by `+/-VHYST`, so the total window is `2*VHYST`. Verified: `VHYST = 20 mV` produced trip points at 2.518 V and 2.478 V, a 40.0 mV window.
- `CD = 10p` is an internal scale; `RC` is written in terms of it. Do not fit it.

## 2. Required datasheet inputs

| Symbol | Unit | Typical datasheet location | Conditions that MUST be recorded |
|---|---|---|---|
| `AVD` / large-signal gain | V/mV or dB | Electrical characteristics, "Large-Signal Voltage Gain" | `VCC`, `RL` |
| `VIO` / `VOS` | V | "Input Offset Voltage" | `VCM`, `VCC`, Tamb |
| `IIB` | A | "Input Bias Current" | `VCM`, `VCC` |
| `IIO` | A | "Input Offset Current" | Same |
| `tPLH`, `tPHL` or `tpd` | s | "Response Time" or "Propagation Delay" | **The overdrive** (typically 5 mV and 100 mV), `RL`, `CL`, `VCC`. Record every published overdrive row |
| `VOL` | V | "Low-Level Output Voltage" | The sink current `IOL` at which it is specified |
| `IOL` / sink current | A | "Output Sink Current" | `VOL` |
| `IOH` / leakage (OC only) | A | "Output Leakage Current" | `VOH`, output off |
| `VOH` (PP only) | V | "High-Level Output Voltage" | The source current `IOH` |
| `Vhys` | V | "Hysteresis", present on MCP6561 and TLV3702 | `VCC` |
| `ICC` | A | "Supply Current" | Per comparator or per package. Record which |
| `VICR` | V | "Common-Mode Input Voltage Range" | `supported_operating_region` only |

## 3. Deterministic fitting procedure

Like the opamp, this archetype is dominated by direct transcription. There is no global optimisation.

### 3.1 Direct transcriptions

```python
AOL   = AVD_V_per_mV*1000.0 if quoted_in_V_per_mV else 10**(AVD_dB/20.0)
VOS   = VIO_typ
IBIAS = abs(IIB_typ)
IOS   = abs(IIO_typ)
IQ    = ICC_per_comparator
VHYST = Vhys_datasheet / 2.0 if Vhys_datasheet is not None else 0.0
```

`VHYST = 0.0` is the correct value for LM393, LM339 and LM311; those parts have no specified hysteresis and adding any would be an invented parameter. Record: `"No input hysteresis: the datasheet specifies none. Real devices have a small unspecified hysteresis, so this model will chatter on a slow input where a real part might not."`

### 3.2 Output stage

**Variant OC:**

```python
ROL  = VOL_spec / IOL_spec          # the sink resistance at the specified point
ROFF = 1e9                          # fixed; see numerical hygiene
ROL  = max(ROL, 1e-3)
```

Do not derive `ROFF` from the published output leakage. The leakage row is a maximum in the nanoamp range and would give a resistance above `1e9`, which is the region where the node depends on `gmin`. Record: `"Output leakage in the off state is fixed at a numerically safe 1e9 ohm rather than the datasheet leakage maximum."`

**Variant PP:**

```python
VDRP_H = VCC_test - VOH_spec        # at the specified source current
VDRP_L = VOL_spec                   # at the specified sink current
ROUT   = max(VDRP_H / IOH_spec, 1e-3)
ILIM   = max(IOH_spec, IOL_spec) * 1.2
```

The 1.2 factor on `ILIM` keeps the current limit clear of the specified drive point, so the specified `VOH`/`VOL` are set by `ROUT` and not clipped by `ILIM`. It is a fixed archetype constant, not a per-part choice.

### 3.3 Propagation delay

`TPD` is the one parameter that needs a calibration step, because the `tanh` shaping shifts the 50 percent crossing slightly and the shift differs between edges.

```python
TPD = tpd_datasheet_at_largest_published_overdrive
for _ in range(3):
    tplh_meas, tphl_meas = run_tpd_bench(TPD)          # section 4.2
    TPD *= tpd_datasheet / (0.5*(tplh_meas + tphl_meas))
```

Fit to the **largest** published overdrive. Reason: the large-overdrive number is the device's intrinsic delay, while the small-overdrive number includes the input stage's slewing, which this model does not represent. Fitting the 5 mV row would make the model slow at every overdrive.

Record, always: `"Propagation delay is a single fitted constant taken at the largest published overdrive. Real comparators are markedly slower at small overdrive (the datasheet's 5 mV row); this model's delay does not vary with overdrive."`

Three fixed iterations, as with the opamp. Assert the final average is within 5 percent of the datasheet.

## 4. Standard test benches

### 4.1 `dc_transfer.cir` (analysis_type `dc_sweep`)

```spice
* <MPN> DC trip point and output levels
.include ../model.cir
VCC vcc 0 DC <VCC_test>
VREF ref 0 DC <VREF_test>
VIN sig 0 DC 0
X1 sig ref out vcc 0 OC_<MPN>
RPU vcc out <RPU>            ; variant OC only; omit for PP
.save v(out)
.dc VIN <VREF-0.05> <VREF+0.05> 0.0001
.end
```

Checks: `v(out) at v(sig)=<VREF-0.05>` against `VOL` (relative 0.20, absolute 20 mV) and at `<VREF+0.05>` against `VOH`. Plus the trip point: `v(sig) at v(out)=<VCC/2>` against `VREF + VOS`, absolute tolerance equal to the datasheet `VIO` maximum.

### 4.2 `propagation_delay.cir` (analysis_type `transient`)

```spice
* <MPN> propagation delay at the datasheet overdrive and load
.include ../model.cir
VCC vcc 0 DC <VCC_test>
VREF ref 0 DC <VREF_test>
VIN sig 0 PULSE(<VREF-OD> <VREF+OD> 1u 10n 10n 10u 20u)
X1 sig ref out vcc 0 OC_<MPN>
RPU vcc out <RPU>            ; variant OC only
CL out 0 <CL_datasheet>
.save v(sig) v(out)
.tran 20n 30u
.end
```

`OD` is the datasheet overdrive. Checks: `tPLH` as `(time at v(out)=<VCC/2> rising) - (time at v(sig)=<VREF> rising)` against the datasheet, relative 0.20. `tPHL` likewise on the falling edge. Also hard bounds `min(v(out)) >= -0.05` and `max(v(out)) <= VCC + 0.05`, cited to the output voltage rows; these catch the overshoot failure described in section 6.

### 4.3 `hysteresis.cir` (analysis_type `transient`, parts with specified hysteresis only)

```spice
* <MPN> input hysteresis window, deliberately slow ramp
.include ../model.cir
VCC vcc 0 DC <VCC_test>
VREF ref 0 DC <VREF_test>
VRAMP sig 0 PWL(0 <VREF-0.2> 40m <VREF+0.2> 80m <VREF-0.2>)
X1 sig ref out vcc 0 OC_<MPN>
RPU vcc out <RPU>
CL out 0 15p
.save v(sig) v(out)
.tran 20u 80m
.end
```

**The ramp must be slow compared to `TPD`.** This is a bench requirement, not a stylistic one. A ramp of `dV/dt` adds an apparent hysteresis of `2 * TPD * dV/dt` on top of the real window. Verified: a 0.125 V/us ramp on a part with `TPD = 1.3 us` and a true 40 mV window reported **386 mV**, nearly ten times too much. The same model on a 0.0125 V/ms ramp reported **40.0 mV**, exact.

Rule: choose the ramp rate so that `2 * TPD * dV/dt < 0.02 * Vhys`. The template above uses 0.4 V over 40 ms.

Check: `(v(sig) at v(out)=<VCC/2> rising) - (v(sig) at v(out)=<VCC/2> falling)` against `Vhys`, relative 0.20.

### 4.4 `supply_current.cir` (analysis_type `operating_point`)

```spice
* <MPN> quiescent supply current
.include ../model.cir
VCC vcc 0 DC <VCC_test>
VREF ref 0 DC <VREF_test>
VIN sig 0 DC <VREF_test-0.1>
X1 sig ref out vcc 0 OC_<MPN>
.save i(VCC)
.op
.end
```

Note there is no pull-up in this bench, so the measured current is the quiescent current alone. Check `abs(i(vcc))` against `ICC` per comparator, relative 0.10.

## 5. `known_omissions` boilerplate

**Always:**
- `"Propagation delay is a single fitted constant taken at the largest published overdrive. The strong overdrive dependence that real comparators show (the datasheet's 5 mV versus 100 mV rows) is not modelled."`
- `"Input common-mode range is not enforced. The model does not phase-invert or lose gain when an input approaches a supply rail. VICR is metadata only."`
- `"No self-heating and no temperature coefficients: offset drift and delay drift are not modelled."`
- `"Quiescent current is a constant and does not vary with supply, temperature, or output state."`
- `"Input protection diodes and ESD structures are not modelled."`
- `"Noise is not modelled, so the model will not reproduce output chatter caused by input noise near the trip point."`
- `"Input offset voltage is set to the datasheet typical; a real part may sit anywhere inside the published maximum and the sign is arbitrary."`

**Conditional:**
- No specified hysteresis (LM393, LM339, LM311): `"No input hysteresis: the datasheet specifies none. This model will chatter on a slow or noisy input where a real part's small unspecified hysteresis might not."`
- Variant OC: `"Open-collector output: this model can only sink. A circuit without an external pull-up will float the output node."`
- Variant OC: `"Output leakage in the off state is fixed at a numerically safe 1e9 ohm rather than the datasheet leakage maximum."`
- LM311 only: `"The LM311 balance, strobe and separate emitter-ground pins are not modelled. Only the five-terminal core (INP, INN, OUT, VCC, GND) is provided; strobe and offset balancing are unavailable."`
- Single-supply parts: `"Fitted from the single-supply table. Split-supply operation is untested."`

## 6. `domain_coverage` defaults

| Domain | Rating | Condition |
|---|---|---|
| `dc` | `fitted` | Always for F2 |
| `ac` | `approx` | The model has a real pole but no published AC response to fit |
| `transient` | `fitted` | `TPD` calibrated and the delay bench passes |
| `noise` | `none` | Always |
| `thermal` | `none` | Always |
| `digital` | `none` | Never claim `digital` here. This is an analog part with an analog output |

`supported_analyses`: `["operating_point", "dc_sweep", "transient"]`. Add `"ac_small_signal"` only if the part publishes an AC response worth checking, which is rare.

## 7. Numerical hygiene

1. **Never switch a behavioral resistor abruptly.** `R={cond ? 1e9 : 60}` drove an open-collector output to **-0.29 V** against a 15 pF load, an unphysical negative excursion caused by the discontinuous conductance step. Blend the **conductance** with `tanh`, as `ROC` does. After the fix, the same bench reported `VOL = 29.8 mV` and no undershoot.
2. **Never switch a behavioral voltage abruptly into a capacitive node either.** The first push-pull draft used `BQ ... V = v(cd) > 0 ? VCC-VDRP_H : VDRP_L` and overshot to **5.159 V on a 5 V supply** and undershot to **-0.159 V**. The `tanh`-blended form lands on exactly `VCC - VDRP_H` and exactly `VDRP_L`. Ship the blended form. Include the hard bounds of section 4.2 so a regression cannot reintroduce this.
3. **`ROFF = 1e9`, never higher.** Above `1e9` the off-state output node relies on `gmin` alone and its voltage becomes a function of `.options gmin` rather than of the circuit.
4. **`ROL >= 1e-3` and `ROUT >= 1e-3`.** `BOUT` divides by `ROUT*ILIM`.
5. **`CDIF` between the inputs is mandatory.** Without it a user who leaves an input floating gets a singular matrix.
6. **`RQ` to ground on the `BQ` node is mandatory** in variant PP, for the same reason: a `B` voltage-source output node with no conductance to ground is singular.
7. **Bound the gain node.** `BC` must saturate. An unbounded `AOL * Vd` node feeding `RC`/`CC` makes the delay proportional to the log of the overdrive and can put a node at `1e5` volts, which wrecks the timestep control in any circuit that also contains a real capacitor.
8. **The hysteresis feedback must come from `cd`, after the delay, not from `c` or from `OUT`.** Feedback from `c` is an algebraic loop with no state and will not converge. Feedback from `OUT` makes the window depend on the user's pull-up resistor.
9. **`KSW = 20` is the fixed smoothing sharpness.** Raising it sharpens the switch toward the discontinuity that rules 1 and 2 exist to avoid; lowering it blurs the output levels. It is an archetype constant, not a fitting parameter.
