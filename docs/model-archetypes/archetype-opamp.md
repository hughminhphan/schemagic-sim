# Archetype: operational amplifier (Boyle-class behavioral macromodel)

Family: `opamp`. Model type: `subckt`. Fidelity ceiling **F2**.

Parts: TL071, TL072, TL074, TL081, LM358, LM324, LM741, NE5532, LM4562, OPA2134, MCP6002, MCP6004, TLV9062, LMV358, OP07C.

This is a **behavioral** Boyle-class macromodel, not the original 1974 Boyle transistor topology. It reproduces the same set of datasheet quantities (offset, bias, open-loop gain, dominant pole, slew, output impedance, current limit, rail saturation, CMRR, PSRR, quiescent current, broadband noise) with `B`-sources instead of a differential pair, because it must run on an ngspice-46 build with no XSPICE and it must converge from arbitrary user circuits drawn in a browser.

Every element below was validated as a single unit against native ngspice-46. Measured agreement is recorded in section 3.7.

## 1. Subcircuit template and node order

**Node order is `INP INN VCC VEE OUT`.** This order is fixed for every opamp package in the library so that `spice_pin_mapping` is uniform.

```spice
* scheMAGIC original-from-facts model
* <MPN> (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: archetype-opamp.md. Fit run: <run-id>
* Node order: X<ref> inp inn vcc vee out OC_<MPN>
.subckt OC_<MPN> INP INN VCC VEE OUT
+ PARAMS: AOL=<V/V> GBW=<Hz> SR=<V/s> IBIAS=<A> IOS=<A> VOS=<V>
+ ROUT=<ohm> ILIM=<A> VDRP_H=<V> VDRP_L=<V> CC=30p FP2=<Hz>
+ CMRR=<V/V> PSRR=<V/V> VSUP_NOM=<V> IQ=<A> EN=<V/rtHz>
* --- input bias and offset current ---
IBP 0 INP DC {IBIAS+IOS/2}
IBN 0 INN DC {IBIAS-IOS/2}
CDIF INP INN 1p
* --- summed input error: differential, offset, noise, common mode, supply ---
BERR e 0 V = v(INP,INN) + VOS + v(nz) + 0.5*(v(INP)+v(INN))/CMRR + (v(VCC,VEE)-VSUP_NOM)/PSRR
RE e 0 1meg
* --- broadband input noise, injected with no DC path (see 3.6) ---
RNZ nz 0 {EN*EN/(4*1.380649e-23*300.15)}
* --- transconductance into the compensation node, soft slew limit ---
BGM 0 p I = {SR*CC}*tanh({6.283185307*GBW/SR}*v(e))
CP p 0 {CC}
RP p 0 {AOL/(6.283185307*GBW*CC)}
* --- second pole for phase margin ---
RP2 p p2 {1/(6.283185307*FP2*1p)}
CP2 p2 0 1p
* --- rail saturation ---
BCLMP q 0 V = min(max(v(p2), v(VEE)+VDRP_L), v(VCC)-VDRP_H)
RQ q 0 1meg
* --- output stage: ROUT small-signal, ILIM large-signal, one element ---
BOUT 0 OUT I = ILIM*tanh((v(q)-v(OUT))/(ROUT*ILIM))
* --- quiescent supply current, per amplifier ---
IQVCC VCC VEE DC {IQ}
.ends OC_<MPN>
```

Design notes that are **not** optional:

- `CC = 30p` is an arbitrary internal scale, not a datasheet quantity. `BGM`, `RP` and `CP` are all written in terms of it, so the model's behaviour is independent of its value. Do not "fit" `CC`.
- `BOUT` is a transconductance, so it provides `ROUT` at small signal and `ILIM` at large signal from one element. `dI/dV` at zero deviation is exactly `1/ROUT`. This is why there is no separate series output resistor.
- `BERR` carries every input-referred error term additively. Adding a new error mechanism means adding a term here, never adding another stage.

## 2. Required datasheet inputs

| Symbol | Unit | Typical datasheet location | Conditions that MUST be recorded |
|---|---|---|---|
| `AVD` / `AOL` | V/mV or dB | Electrical characteristics, "Large-Signal Differential Voltage Amplification" | `VO` swing, `RL`, `VCC`/`VEE`, Tamb. **Convert V/mV to V/V by multiplying by 1000** |
| `GBW` / `BW` | Hz | Electrical characteristics, "Unity-Gain Bandwidth" or "Gain Bandwidth Product" | `RL`, `CL`, `VCC`/`VEE` |
| `SR` | V/us | Electrical characteristics, "Slew Rate at Unity Gain" | `RL`, `CL`, the closed-loop configuration |
| `VIO` / `VOS` typ and max | V | "Input Offset Voltage" | `VIC`, `RS`, Tamb |
| `IIB` / `IB` | A | "Input Bias Current" | `VIC`, Tamb. Note the separate high-temperature row and do NOT fit it |
| `IIO` / `IOS` | A | "Input Offset Current" | Same conditions as `IIB` |
| `VOM` / `VOPP` | V | "Maximum Peak Output Voltage Swing" | `RL` and the supply used. Record both the `RL=10k` and `RL=2k` rows if both exist |
| `IOS(sc)` / `IO` | A | "Output Current" or "Short-Circuit Output Current" | The supply used |
| `CMRR` / `kCMR` | dB | "Common-Mode Rejection Ratio" | `VIC` range used |
| `kSVR` / `PSRR` | dB | "Supply Voltage Rejection Ratio" | The supply range used |
| `ICC` / `IQ` | A | "Supply Current" | **Per amplifier or per package.** Record which. A dual quoting 2.8 mA total is 1.4 mA per amplifier |
| `Vn` / `en` | V/sqrt(Hz) | "Equivalent Input Noise Voltage" | The frequency (usually 1 kHz) |
| `phi_m` | degrees | "Phase Margin" | `RL`, `CL` |
| `zo` / `Ro` | ohm | "Output Impedance", present on some parts | Frequency, closed-loop gain |
| `VICR` | V | "Common-Mode Input Voltage Range" | `supported_operating_region` only; see omissions |

## 3. Deterministic fitting procedure

Almost every parameter is a **direct transcription** with a unit conversion. Only two need a calibration step. There is no global optimisation in this archetype and there must not be one: a least-squares fit across unrelated datasheet quantities would trade offset against bandwidth, and neither would then match.

### 3.1 Direct transcriptions

```python
AOL   = AVD_V_per_mV * 1000.0 if quoted_in_V_per_mV else 10**(AVD_dB/20.0)
VOS   = VIO_typ
IBIAS = abs(IIB_typ)
IOS   = abs(IIO_typ)
ILIM  = abs(IO_short_circuit)
CMRR  = 10**(kCMR_dB/20.0)
PSRR  = 10**(kSVR_dB/20.0)
VSUP_NOM = VCC_test - VEE_test          # the total supply the datasheet table was taken at
IQ    = ICC_per_amplifier               # divide a package total by the channel count
EN    = Vn_at_1kHz
```

`VOS` uses the **typical**, not the maximum. The maximum is a production limit, and a library where every opamp sits at its worst-case offset would teach beginners that offset always dominates. Record the max in `supported_operating_region.numeric_bounds` so it is not lost.

### 3.2 Rail drop from the output swing rows

```python
VDRP_H = (VCC_test - VOM_positive_at_RL2k)
VDRP_L = (VOM_negative_at_RL2k - VEE_test)     # both come out positive
VDRP_H = max(VDRP_H, 0.01); VDRP_L = max(VDRP_L, 0.01)
```

Use the heavier load row (`RL = 2k`) when both are published; the light-load row understates the drop for every realistic circuit. For a rail-to-rail part (MCP6002, MCP6004, TLV9062, LMV358) the drop is tens of millivolts and the floor of 0.01 V may bind. That is correct behaviour, not an error.

### 3.3 Output resistance

```python
ROUT = zo_published if zo_published is not None else (VDRP_H / ILIM)
```

The fallback treats the rail drop at the current limit as a resistive drop. Record when the fallback is used: `"ROUT derived from the output swing and short-circuit current rows: the datasheet publishes no open-loop output impedance."`

### 3.4 Second pole from the phase margin

```python
# a single-pole system has 90 degrees of margin; the deficit comes from the second pole
FP2 = GBW_nominal / np.tan(np.radians(phi_m))
```

If no phase margin is published, set `FP2 = 3.0 * GBW` and record: `"The second pole is placed at three times the gain-bandwidth product: the datasheet publishes no phase margin. Stability with capacitive loads is indicative only."` A model with no second pole at all is unconditionally stable and would teach beginners that opamps never oscillate, which is worse than an estimated pole.

### 3.5 The two calibrated parameters

The second pole and the `tanh` softening both pull the realised bandwidth and slew below their nominal parameter values. Verified: nominal `GBW = 3 MHz` realised 2.677 MHz (-10.8 percent), and nominal `SR = 13 V/us` realised 11.98 V/us (-7.8 percent).

Correct this with a **fixed-point calibration**, which is deterministic and takes three ngspice runs:

```python
GBW_param, SR_param = GBW_target, SR_target
for _ in range(3):
    f_meas  = run_ac_servo_bench(GBW_param, SR_param)     # section 4.1
    sr_meas = run_slew_bench(GBW_param, SR_param)         # section 4.3
    GBW_param *= GBW_target / f_meas
    SR_param  *= SR_target  / sr_meas
```

Three iterations, not "until converged". The map is a contraction with a ratio near 0.1, so three passes land inside 0.1 percent, and a fixed count keeps the run reproducible. Assert that the final measured values are within 2 percent of target; if not, the phase margin input is inconsistent with the bandwidth input and the part needs a written note.

### 3.6 Noise

`RNZ` sits between an otherwise unconnected node `nz` and ground, and `nz` is read by `BERR`. Because `BERR` is a voltage-source expression, it draws no current, so `RNZ` carries **no DC current** and contributes **no DC offset**. Its Johnson noise appears directly at the input-referred summing node.

```python
RNZ = EN**2 / (4 * 1.380649e-23 * 300.15)
```

**Do not put the noise resistor in series with an input pin.** That is the obvious construction and it is wrong: on a bipolar-input part like LM358 (`IIB = 45 nA`, `en = 40 nV/sqrt(Hz)`) the resistor comes out at 96.6 k and `IB * R = 4.3 mV`, which more than doubles the part's own 2 mV offset. The DC-free node avoids this entirely. Verified: with the noise node present, a gain-of-10 stage reported exactly `VOS * 10`, and the integrated output noise matched the analytic value to 0.4 percent.

Only broadband voltage noise is modelled. `1/f` and current noise are not. See omissions.

### 3.7 Validation of the template itself

Measured on the reference implementation against its own nominal parameters:

| Quantity | Nominal | Realised | Deviation |
|---|---|---|---|
| Input offset at the output, gain 10 | 10.000 mV | 9.999 mV | -0.01 percent |
| `IB`, `IOS` | 30 pA, 5 pA | 30 pA, 5 pA | exact |
| `AOL` | 106.02 dB | 105.60 dB | -0.42 dB |
| Unity-gain frequency | 3.000 MHz | 2.677 MHz | -10.8 percent, corrected by 3.5 |
| Phase margin | (from `FP2`) | 75.5 degrees | consistent |
| Slew rate | 13.0 V/us | 11.98 V/us | -7.8 percent, corrected by 3.5 |
| Short-circuit current | 40.0 mA | 39.9 mA | -0.25 percent |
| Quiescent current per amplifier | 1.400 mA | 1.400 mA | exact |
| Integrated output noise | analytic | +0.4 percent | resistor noise of the feedback network |

## 4. Standard test benches

### 4.1 `open_loop_gain.cir` (analysis_type `ac_small_signal`)

**This bench must use a DC servo. An open-loop AC bench on a saturated macromodel returns garbage.** See section 6, rule 1.

```spice
* <MPN> open-loop gain and bandwidth, DC-servo bench
.include ../model.cir
VCC vcc 0 DC <VCC_test>
VEE vee 0 DC <VEE_test>
VIN sig 0 DC 0 AC 1
X1 sig inn vcc vee out OC_<MPN>
LSERVO out inn 1G
CSERVO inn 0 1G
RL out 0 2k
.save v(out)
.ac dec 40 0.01 300meg
.end
```

The 1 GH inductor is a DC short and an AC open; the 1 GF capacitor is a DC open and an AC short. At DC the amplifier is a unity-gain follower and its output sits near zero, out of the rail clamp. At AC the loop is broken and `v(out)` is the open-loop response. Verified to return 105.60 dB and a 2.677 MHz crossing on a part whose direct open-loop bench returned **-404 dB**.

Checks:

```json
{
  "name": "open_loop_gain_db",
  "expression_source": { "kind": "derived_expression", "expression": "vdb(out) at frequency=0.01" },
  "expected_value": <AOL_dB>, "unit": "dB",
  "tolerance": { "absolute": 0.5, "relative": 0 },
  "datasheet_citation": "<mfr> <MPN> rev <r> p.<n>, electrical characteristics, large-signal differential voltage amplification",
  "placeholder": false
},
{
  "name": "unity_gain_bandwidth",
  "expression_source": { "kind": "derived_expression", "expression": "frequency at vdb(out)=0 falling" },
  "expected_value": <GBW>, "unit": "Hz",
  "tolerance": { "absolute": 0, "relative": 0.20 },
  "datasheet_citation": "<mfr> <MPN> rev <r> p.<n>, unity-gain bandwidth",
  "placeholder": false
}
```

### 4.2 `offset_and_bias.cir` (analysis_type `operating_point`)

```spice
* <MPN> input offset voltage and bias currents
.include ../model.cir
VCC vcc 0 DC <VCC_test>
VEE vee 0 DC <VEE_test>
X1 p1 n1 vcc vee out1 OC_<MPN>
VP1 p1 0 DC 0
VN1 n1 0 DC 0
RL1 out1 0 2k
X2 sig2 inn2 vcc vee out2 OC_<MPN>
VS2 sig2 0 DC 0
RF2 out2 inn2 9k
RG2 inn2 0 1k
RL2 out2 0 2k
.save i(VP1) i(VN1) v(out2) i(VCC)
.op
.end
```

Checks: `v(out2)/10` against `VOS`; `(abs(i(vp1)) + abs(i(vn1)))/2` against `IIB`; `abs(abs(i(vp1)) - abs(i(vn1)))` against `IIO`; `abs(i(vcc))/<n_amplifiers_in_bench>` against `ICC` per amplifier.

Tolerances: `VOS` relative 0.05 with absolute 0.1 mV; currents relative 0.05; `ICC` relative 0.10.

### 4.3 `slew_and_swing.cir` (analysis_type `transient`)

```spice
* <MPN> slew rate and output swing, unity-gain follower
.include ../model.cir
VCC vcc 0 DC <VCC_test>
VEE vee 0 DC <VEE_test>
VIN sig 0 PULSE(<VEE_test+1> <VCC_test-1> 1u 1n 1n 10u 20u)
X1 sig out vcc vee out OC_<MPN>
RL out 0 2k
.save v(out) v(sig)
.tran 5n 20u
.end
```

Checks: rising slew `(V2 - V1)/(t at v(out)=V2 rising - t at v(out)=V1 rising)` with `V1`, `V2` at 25 and 75 percent of the commanded step, against `SR`, relative 0.15. Falling slew separately against `SR` (or the negative slew row when published separately). `max(v(out))` against `VOM+`, and `min(v(out))` against `VOM-`, relative 0.05, absolute 0.1 V.

The input pulse deliberately overdrives to one volt inside each rail so the swing limits are actually exercised.

### 4.4 `short_circuit.cir` (analysis_type `operating_point`)

```spice
* <MPN> short-circuit output current
.include ../model.cir
VCC vcc 0 DC <VCC_test>
VEE vee 0 DC <VEE_test>
VIN sig 0 DC <VCC_test/2>
X1 sig inn vcc vee out OC_<MPN>
RF out inn 1meg
VSHORT out 0 DC 0
.save i(VSHORT)
.op
.end
```

Check `abs(i(vshort))` against `IO`, relative 0.10.

### 4.5 `noise.cir` (analysis_type `noise`)

```spice
* <MPN> equivalent input noise voltage
.include ../model.cir
VCC vcc 0 DC <VCC_test>
VEE vee 0 DC <VEE_test>
VIN sig 0 DC 0 AC 1
X1 sig inn vcc vee out OC_<MPN>
RF out inn 9k
RG inn 0 1k
RL out 0 2k
.noise v(out) VIN dec 10 100 100k 1
.end
```

Check `sqrt(onoise_spectrum at frequency=1k)/10` against `en` at 1 kHz, relative 0.30. The tolerance is loose because the feedback network contributes real thermal noise that the datasheet number excludes; note that in `MODEL_CARD.md`.

### 4.6 `cmrr.cir` (analysis_type `ac_small_signal`)

Drive both inputs together through the servo bench and check that the output response is `AOL/CMRR`. Tolerance relative 0.30.

## 5. `known_omissions` boilerplate

**Always:**
- `"Output-stage distortion is not modelled. THD, crossover distortion and slew-induced distortion do not appear; a sine through this model comes out a sine."`
- `"Input common-mode range is not enforced. The model does not phase-invert, latch, or lose gain when an input is driven outside VICR. VICR is recorded in supported_operating_region as metadata only."`
- `"PSRR is a single frequency-independent constant taken from the datasheet's DC row. Real supply rejection degrades with frequency; this model's does not."`
- `"CMRR is a single frequency-independent constant. Real common-mode rejection degrades with frequency; this model's does not."`
- `"The frequency response is a two-pole approximation (dominant pole plus one pole placed from the phase margin). Higher-order poles and zeros are not modelled, so gain and phase above the unity-gain frequency are not trustworthy."`
- `"Only broadband input voltage noise is modelled. Flicker (1/f) noise and input current noise are not."`
- `"No self-heating and no temperature coefficients: offset drift, bias-current doubling with temperature, and thermal feedback are not modelled."`
- `"Quiescent current is a constant. It does not vary with supply, temperature, or output loading."`
- `"Input offset voltage is set to the datasheet typical. A real part may sit anywhere inside the published maximum, and the sign is arbitrary."`
- `"Input protection diodes and ESD structures are not modelled. Inputs driven beyond the supplies do not clamp."`
- `"Settling time and overload recovery are consequences of the two-pole model, not fitted quantities."`

**Conditional:**
- No phase margin published: `"The second pole is placed at three times the gain-bandwidth product: the datasheet publishes no phase margin. Stability with capacitive loads is indicative only."`
- No `zo` published: `"ROUT derived from the output swing and short-circuit current rows: the datasheet publishes no open-loop output impedance."`
- No `en` published: `"Noise is not modelled: the datasheet publishes no equivalent input noise voltage."` and drop the `RNZ` element entirely.
- LM741 (heritage, F1): `"Fitted at F1 from a heritage datasheet with incomplete AC characterisation."`
- Rail-to-rail parts: `"Rail-to-rail output drop is fitted at the heavy-load row; light-load swing is pessimistic by the difference between the two published rows."`

## 6. `domain_coverage` defaults

| Domain | Rating | Condition |
|---|---|---|
| `dc` | `fitted` | Always for F2 |
| `ac` | `fitted` | `AOL`, `GBW` calibrated and a phase margin fitted or estimated |
| `transient` | `fitted` | Slew calibrated and swing checked |
| `noise` | `fitted` if `EN` published and the noise bench passes, else `none` | Never `validated`: only one frequency point exists |
| `thermal` | `none` | Always |
| `digital` | `none` | Always |

`supported_analyses`: `["operating_point", "dc_sweep", "ac_small_signal", "transient"]`, plus `"noise"` when `RNZ` is present.

## 7. Numerical hygiene

1. **A hard clamp has zero derivative inside the clamp, and AC analysis linearises about the operating point.** This is the single biggest trap in this archetype. An open-loop AC bench drives the output to a rail through `AOL * VOS`; the `min`/`max` in `BCLMP` then has a zero derivative and the reported small-signal gain collapses. Verified: **-404 dB** on an otherwise correct model. There are exactly two acceptable fixes and you must use the first:
   - **Use the DC-servo bench of section 4.1** for every AC measurement, so the operating point sits mid-rail and every clamp is in its linear interior.
   - Never "fix" it by deleting the rail clamp, and never by zeroing `VOS` in the shipped model.
2. **Use `min(max(x,lo),hi)` for clamps. `limit()` is banned.** ngspice-46 parses `limit()` without complaint and does not clamp: `limit(7,0,5)` returns 7. A macromodel using it has no rails at all and will silently output hundreds of volts.
3. **Slew limiting uses `tanh`, not `min`/`max`.** The `tanh` form `Islew*tanh(gm*v/Islew)` has the exact small-signal transconductance `gm` at `v = 0` and is differentiable everywhere, so it never produces a zero Jacobian column. A hard current clip on the same node makes the AC gain depend on the DC offset.
4. **`ROUT >= 1e-3`.** `BOUT` divides by `ROUT*ILIM`; a zero output resistance is a division by zero at netlist parse.
5. **`ILIM > 0` strictly.** A zero current limit makes `BOUT` identically zero and floats the output node.
6. **`CDIF` between the inputs is mandatory** even though no datasheet quantity sets it. Without it, `INP` and `INN` are driven only by ideal current sources and a user who leaves an input floating gets a singular matrix instead of a plausible answer. 1 pF is the standard value and is not fitted.
7. **`RE` and `RQ` to ground are mandatory.** Every `B` voltage-source output node in this template carries a 1 Meg resistor to ground. Without it, an internal node reachable only through `B`-source expressions has no conductance to ground and the matrix is singular.
8. **Never raise an off-resistance above `1e9`.** The servo bench's 1 GH and 1 GF are reactive and are fine; a 1e12 ohm resistor is not, because the node then depends on `gmin` alone.
9. **The noise resistor must not carry DC current.** See 3.6. Putting it in series with an input silently adds `IB * R` to the offset.
10. **`IQVCC` is drawn between `VCC` and `VEE`, not to ground.** A supply current to ground makes a single-supply circuit's ground node carry the amplifier's quiescent current, which is wrong and shows up as an offset in every single-supply teaching circuit.

## 8. Single-supply parts

LM358, LM324, MCP6002, MCP6004, LMV358 and TLV9062 are single-supply parts whose datasheet tables are taken at `VCC = 5 V`, `VEE = 0 V`. Set `VSUP_NOM = 5.0` and read `VDRP_H`/`VDRP_L` from the single-supply swing rows.

The template needs no structural change: `VEE` is a node, not an assumption. But the omission list gains one mandatory entry, because these parts' input range genuinely includes the negative rail and this model does not represent the boundary:

`"Input common-mode range includes the negative supply on this part. The model does not reproduce the gain loss or offset shift that occurs as an input approaches either supply."`
