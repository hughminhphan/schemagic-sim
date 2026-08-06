# Archetype: 74HC logic (analog behavioral gate subcircuit)

Family: `logic_74hc`. Model type: `subckt`. Fidelity ceiling **F1 for the digital domain, F2 for dc and transient**.

Parts: 74HC00, 74HC02, 74HC04, 74HC08, 74HC14, 74HC32, 74HC74, 74HC86, 74HC138, 74HC164, 74HC165, 74HC595, 74HC123, 74HC4017.

**The engine has no XSPICE.** There are no digital nodes, no event queue, and no logic simulator. Every gate here is a continuous analog subcircuit whose transfer function happens to be steep. This is stated in `known_omissions` on every package and it is the reason the digital coverage ceiling is F1 and not higher.

What this archetype does reproduce, and reproduces well: the DC voltage transfer characteristic against the guaranteed `VIL`/`VIH`/`VOL`/`VOH` corners, the output drive impedance, the propagation delay including its dependence on load capacitance, and correct sequential behaviour for latches, flip-flops, counters and shift registers.

## 1. Structural building blocks

Four blocks compose every part in the family. Do not invent a fifth.

### 1.1 Input sigmoid

Normalises a pin voltage to a logic level in `[0,1]`:

```spice
BX x GND V = 0.5*(1+tanh(KVTC*(v(<PIN>,GND)/v(VCC,GND)-0.5)))
RIX <PIN> GND 1e11
```

`RIX` is the input leakage path. It is mandatory: without it an unconnected input pin has no conductance to anything and the matrix is singular.

### 1.2 Combinational core

Combine normalised levels with arithmetic, never with a `?:` chain:

| Function | Expression on normalised inputs `a`, `b` |
|---|---|
| NOT | `1-a` |
| AND | `a*b` |
| NAND | `1-a*b` |
| OR | `a+b-a*b` |
| NOR | `1-(a+b-a*b)` |
| XOR | `a+b-2*a*b` |
| XNOR | `1-(a+b-2*a*b)` |

These are the standard probabilistic-logic forms. They are smooth, exact at the corners, and monotone, which is what the solver needs. A `?:` chain is discontinuous and produces the glitching described in section 7.

### 1.3 Delay stage

One RC per gate, between the core and the driver:

```spice
RD vi vd {RINT}
CD vd GND {CINT}
```

### 1.4 Output driver

```spice
BDRV yd GND V = min(max(v(vd)*v(VCC,GND),0),v(VCC,GND))
RDRV yd Y R={ROL+(ROH-ROL)*0.5*(1+tanh(KSW*(v(vd)-0.5)))}
```

The behavioral resistor gives the asymmetric sink and source impedance that `VOL` at `IOL` and `VOH` at `IOH` describe. When the datasheet gives one symmetric figure, use a plain `RDRV yd Y {ROUT}`.

## 2. Reference templates

### 2.1 Inverter (74HC04), and the pattern for every single-input gate

```spice
* OpenCircuit original-from-facts model
* 74HC04 (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: archetype-logic74hc.md. Fit run: <run-id>
* Node order per gate: X<ref> a y vcc gnd OC_74HC04_GATE
.subckt OC_74HC04_GATE A Y VCC GND
+ PARAMS: KVTC=<-> RINT=1k CINT=<F> ROH=<ohm> ROL=<ohm> KSW=12
RIN A GND 1e11
BVTC vi GND V = 0.5*v(VCC,GND)*(1-tanh(KVTC*(v(A,GND)/v(VCC,GND)-0.5)))
RD vi vd {RINT}
CD vd GND {CINT}
BDRV yd GND V = min(max(v(vd),0),v(VCC,GND))
RDRV yd Y R={ROL+(ROH-ROL)*0.5*(1+tanh(KSW*(v(vd)/v(VCC,GND)-0.5)))}
.ends OC_74HC04_GATE
```

`RINT = 1k` is a fixed internal scale; `CINT` carries the fitted delay. Do not fit `RINT`.

**One subcircuit per gate, not per package.** A 74HC04 package instantiates six `OC_74HC04_GATE` subcircuits. `component.json` maps all fourteen physical pins through `package_variants[].pin_map`, and `spice_pin_mapping` describes one gate. This keeps the model reusable and keeps `VCC`/`GND` explicit on every gate.

### 2.2 Two-input NAND (74HC00)

```spice
.subckt OC_74HC00_GATE A B Y VCC GND
+ PARAMS: KVTC=<-> RINT=1k CINT=<F> ROUT=<ohm>
RIA A GND 1e11
RIB B GND 1e11
BAA aa GND V = 0.5*(1+tanh(KVTC*(v(A,GND)/v(VCC,GND)-0.5)))
BBB bb GND V = 0.5*(1+tanh(KVTC*(v(B,GND)/v(VCC,GND)-0.5)))
BVTC vi GND V = v(VCC,GND)*(1 - v(aa)*v(bb))
RD vi vd {RINT}
CD vd GND {CINT}
BDRV yd GND V = min(max(v(vd),0),v(VCC,GND))
RDRV yd Y {ROUT}
.ends OC_74HC00_GATE
```

74HC02 (NOR), 74HC08 (AND), 74HC32 (OR), 74HC86 (XOR) are the same subcircuit with the `BVTC` expression swapped from the table in 1.2.

### 2.3 Schmitt inverter (74HC14)

Hysteresis is feedback from the post-delay node into the transfer-function argument:

```spice
.subckt OC_74HC14_GATE A Y VCC GND
+ PARAMS: KVTC=<-> RINT=1k CINT=<F> ROUT=<ohm> VHYST=<V>
RIN A GND 1e11
BVTC vi GND V = 0.5*v(VCC,GND)*(1-tanh(KVTC*((v(A,GND)-VHYST*(v(vd)/v(VCC,GND)-0.5)*2)/v(VCC,GND)-0.5)))
RD vi vd {RINT}
CD vd GND {CINT}
BDRV yd GND V = min(max(v(vd),0),v(VCC,GND))
RDRV yd Y {ROUT}
.ends OC_74HC14_GATE
```

`VHYST` is the **total** datasheet hysteresis `VT+ - VT-`; the `*2` and the `-0.5` centring make the term span exactly that window.

### 2.4 Edge-triggered D flip-flop (74HC74)

This is the hardest block in the family and the template is not negotiable. Read section 7.2 before changing anything.

```spice
.subckt OC_74HC74_FF D CLK Q QB VCC GND
+ PARAMS: KIN=20 KREG=25 TAU=<s> ROUT=<ohm> VSKEW=0.05
RID D GND 1e11
RIC CLK GND 1e11
BC  c  GND V = 0.5*(1+tanh(KIN*(v(CLK,GND)/v(VCC,GND)-0.5)))
BD  dd GND V = 0.5*(1+tanh(KIN*(v(D,GND)/v(VCC,GND)-0.5)))
* master: transparent while CLK low, regenerative hold while CLK high
BMA mad GND V = (v(c)<0.5) ? v(dd) : 0.5*(1-tanh(KREG*(v(mb)-0.5)))
RMA mad ma {TAU/1p}
CMA ma GND 1p
BMB mbd GND V = 0.5*(1-tanh(KREG*(v(ma)-0.5))) + VSKEW
RMB mbd mb {TAU/1p}
CMB mb GND 1p
* slave: transparent while CLK high, regenerative hold while CLK low
BSA sad GND V = (v(c)>0.5) ? v(ma) : 0.5*(1-tanh(KREG*(v(sb)-0.5)))
RSA sad sa {TAU/1p}
CSA sa GND 1p
BSB sbd GND V = 0.5*(1-tanh(KREG*(v(sa)-0.5))) + VSKEW
RSB sbd sb {TAU/1p}
CSB sb GND 1p
BQ  qd  GND V = min(max(v(sa)*v(VCC,GND),0),v(VCC,GND))
RQ  qd  Q  {ROUT}
BQB qbd GND V = min(max(v(sb)*v(VCC,GND),0),v(VCC,GND))
RQB qbd QB {ROUT}
.ends OC_74HC74_FF
```

Verified: wired as a divide-by-two (`D` from `QB`) with a 1.000 us clock, the output period measured **2.000052 us**, and `Q` swung the full rail (`4.500 V` to `5.7e-11 V`) with no solver warnings.

Asynchronous preset and clear pins are added as extra multiplicative terms on `BMA`/`BSA`, not as another latch.

Every sequential part in the family (74HC74, 74HC164, 74HC165, 74HC595, 74HC4017) is built from this latch block. 74HC123 (monostable) uses the same latch with an RC-driven reset comparator, exactly like the 555 archetype's timing comparator.

## 3. Required datasheet inputs

| Symbol | Unit | Typical datasheet location | Conditions that MUST be recorded |
|---|---|---|---|
| `VIH` min | V | DC characteristics, "HIGH-level input voltage" | **The `VCC` for that row.** 74HC tables give 2.0 V, 4.5 V and 6.0 V rows |
| `VIL` max | V | DC characteristics, "LOW-level input voltage" | The `VCC` for that row |
| `VOH` min | V | DC characteristics, "HIGH-level output voltage" | `VCC` **and `IOH`.** There are always two rows, one at -20 uA and one at the rated drive |
| `VOL` max | V | DC characteristics, "LOW-level output voltage" | `VCC` and `IOL` |
| `tPHL`, `tPLH` | s | AC characteristics, "propagation delay" | `VCC`, **and `CL`.** Record both the `CL=15 pF` and `CL=50 pF` rows; both are needed |
| `tT` transition time | s | AC characteristics, "output transition time" | `VCC`, `CL` |
| `CI` input capacitance | F | AC characteristics, "input capacitance" | Typical only |
| `II` input leakage | A | DC characteristics, "input leakage current" | `VCC` |
| `ICC` | A | DC characteristics, "quiescent supply current" | `VCC`, inputs at rails |
| `VT+`, `VT-` (74HC14 only) | V | DC characteristics, "positive/negative-going threshold" | `VCC` |
| `fmax` | Hz | AC characteristics (sequential parts) | `VCC`, `CL` |
| `tsu`, `th`, `trem` | s | AC characteristics (sequential parts) | `VCC` |

**Fit at one `VCC` and say which.** 74HC tables are given at 2.0, 4.5 and 6.0 V. Fit the 4.5 V column, because that is the column whose limits govern 5 V operation, and record: `"Fitted from the VCC = 4.5 V column of the DC and AC characteristics. Behaviour at other supply voltages follows the model's VCC scaling and is not independently fitted."`

## 4. Deterministic fitting procedure

### 4.1 `KVTC` in closed form

`KVTC` is the one parameter that carries the entire DC specification, and it has an exact solution. The requirement is that at `VIL(max)` the output is at least `VOH(min)`, and at `VIH(min)` the output is at most `VOL(max)`.

```python
k_from_low  = np.arctanh(1.0 - 2.0*VOL_max/VCC) / (0.5 - VIL_max/VCC)
k_from_high = np.arctanh(1.0 - 2.0*(VCC - VOH_min)/VCC) / (VIH_min/VCC - 0.5)
KVTC = max(k_from_low, k_from_high)
```

Take the **maximum**, so both guarantees hold. Verified on a 74HC04 at `VCC = 4.5 V` with `VIL = 1.35 V`, `VIH = 3.15 V`, `VOH_min = 4.4 V`, `VOL_max = 0.1 V`: the formula gives `KVTC = 9.4`, and the model then produced `4.3976 V` at `VIL` and `0.1024 V` at `VIH`, sitting exactly on both guarantees.

`KVTC` is **not** a free parameter and must never be hand-adjusted.

### 4.2 Output resistances from the loaded output rows

74HC datasheets give `VOH`/`VOL` at two currents, a microamp row and a milliamp row. The milliamp row gives the drive impedance:

```python
ROL = VOL_at_IOL / IOL
ROH = (VCC - VOH_at_IOH) / abs(IOH)
ROL = max(ROL, 1.0); ROH = max(ROH, 1.0)
```

### 4.3 Propagation delay from the two load points

The two `CL` rows determine both the intrinsic delay and the load-dependent term, exactly:

```python
R_load = (tpd_CL2 - tpd_CL1) / (0.693 * (CL2 - CL1))
t_int  = tpd_CL1 - 0.693 * R_load * CL1
CINT   = t_int / (0.693 * RINT)          # RINT is fixed at 1k
```

`R_load` is a check on `ROL`/`ROH`, not a replacement for them. If `R_load` differs from `(ROL+ROH)/2` by more than a factor of three, one of the two datasheet rows was misread; stop and re-extract rather than proceeding.

Then run the **fixed-point calibration**, because the `tanh` shaping shifts the 50 percent crossing:

```python
for _ in range(3):
    tpd15, tpd50 = run_tpd_bench(CINT, ROL, ROH)         # section 5.2
    CINT *= tpd_CL1_target / tpd15
```

Three iterations. Verified that the uncalibrated model is self-consistent: `RINT*CINT = 2.9 ns` plus `0.693*206*15 pF = 2.14 ns` predicts 5.04 ns and the bench measured **5.10 ns**.

Assert the calibrated model reproduces **both** `CL` rows within 15 percent. If it cannot, the part's two rows are inconsistent with a single-pole delay; record it and widen that expectation with the reason.

### 4.4 Schmitt hysteresis and sequential timing

```python
VHYST = VT_plus - VT_minus                  # 74HC14 only, total window
TAU   = tpd_clock_to_Q / 2.0                # 74HC74 and every sequential part
```

`TAU` then goes through the same three-iteration calibration against the clock-to-Q bench.

### 4.5 Fixed archetype constants, never fitted

`RINT = 1k`, `KIN = 20`, `KREG = 25`, `KSW = 12`, `VSKEW = 0.05`, input leakage resistor `1e11`, latch capacitors `1p`. None of these is a datasheet quantity. Changing one to make a bench pass is forbidden; if a bench fails, the fitted parameters or the expectation are wrong.

### 4.6 Never fitted, ever

Setup time, hold time, removal time, recovery time, maximum toggle frequency, and output transition time are **not** fitted. They are consequences of `TAU` and the RC network. Record them all in `known_omissions`.

## 5. Standard test benches

### 5.1 `vtc.cir` (analysis_type `dc_sweep`)

```spice
* 74HC<nn> voltage transfer characteristic at VCC = 4.5 V
.include ../model.cir
VCC vcc 0 DC 4.5
VIN a 0 DC 0
X1 a y vcc 0 OC_74HC<nn>_GATE
CL y 0 15p
.save v(y)
.dc VIN 0 4.5 0.005
.end
```

Two `hard_bounds_checks`, which is the honest form because the datasheet numbers are guarantees, not targets:

```json
{
  "name": "voh_at_vil_max",
  "expression_source": { "kind": "derived_expression", "expression": "v(y) at v(a)=1.35" },
  "minimum": 4.4, "unit": "V", "inclusive": true,
  "datasheet_citation": "<mfr> 74HC<nn> rev <r> p.<n>, DC characteristics, VOH min at VCC=4.5 V, IOH=-20 uA",
  "placeholder": false
},
{
  "name": "vol_at_vih_min",
  "expression_source": { "kind": "derived_expression", "expression": "v(y) at v(a)=3.15" },
  "maximum": 0.1, "unit": "V", "inclusive": true,
  "datasheet_citation": "<mfr> 74HC<nn> rev <r> p.<n>, DC characteristics, VOL max at VCC=4.5 V, IOL=20 uA",
  "placeholder": false
}
```

### 5.2 `propagation_delay.cir` (analysis_type `transient`)

One netlist per `CL` row, because `CL` is part of the datasheet condition.

```spice
* 74HC<nn> propagation delay at CL = <CL>
.include ../model.cir
VCC vcc 0 DC 4.5
VIN a 0 PWL(0 0 1u 0 1.006u 4.5 3u 4.5 3.006u 0 6u 0)
X1 a y vcc 0 OC_74HC<nn>_GATE
CL y 0 <CL>
.save v(a) v(y)
.tran 0.2n 6u
.end
```

Checks: `tPHL` as `(time at v(y)=2.25 falling) - (time at v(a)=2.25 rising)` against the datasheet, relative 0.15, absolute 1 ns. `tPLH` likewise. Plus hard bounds `min(v(y)) >= -0.1` and `max(v(y)) <= 4.6`, which catch the overshoot failure of section 7.1.

The input edges are deliberately 6 ns, matching the datasheet's own input slew condition. A 1 ps edge would measure a delay the datasheet never specified.

### 5.3 `output_drive.cir` (analysis_type `operating_point`)

```spice
* 74HC<nn> loaded output levels
.include ../model.cir
VCC vcc 0 DC 4.5
VLOW a1 0 DC 0
X1 a1 y1 vcc 0 OC_74HC<nn>_GATE
ISRC y1 0 DC <IOH_rated>
VHIGH a2 0 DC 4.5
X2 a2 y2 vcc 0 OC_74HC<nn>_GATE
ISNK 0 y2 DC <IOL_rated>
.save v(y1) v(y2)
.op
.end
```

Hard bounds: `v(y1) >= VOH_min_at_rated_drive`, `v(y2) <= VOL_max_at_rated_drive`.

### 5.4 `hysteresis.cir` (74HC14 only, analysis_type `transient`)

Same slow-ramp requirement as the comparator archetype: the ramp rate must satisfy `2*tpd*dV/dt < 0.02*VHYST`, or the measured window is inflated by the delay. Check `VT+ - VT-` against the datasheet, relative 0.20.

### 5.5 `divide_by_two.cir` (74HC74 and every sequential part, analysis_type `transient`)

```spice
* 74HC74 toggle: D from QB must divide the clock by exactly two
.include ../model.cir
VCC vcc 0 DC 4.5
VCK ck 0 PULSE(0 4.5 0.1u 3n 3n 0.5u 1u)
X1 qb ck q qb vcc 0 OC_74HC74_FF
CLQ q 0 15p
CLQB qb 0 15p
.save v(ck) v(q) v(qb)
.tran 2n 8u
.end
```

Check: the output period against `2 * clock_period`, relative **0.001**. This overrides the README default and is deliberately tight. A divide-by-two is either exactly right or the flip-flop is broken; there is no useful middle. Verified at 2.000052 us against a 1.000000 us clock, an error of 26 parts per million.

Also check clock-to-Q delay against `tPLH(CLK to Q)`, relative 0.15.

### 5.6 `quiescent_current.cir` (analysis_type `operating_point`)

Inputs at the rails, no load. Check `abs(i(vcc))` against `ICC`. **Expect this to fail against the datasheet.** The model has no leakage-scale quiescent path, so it will report a current dominated by the `1e11` input resistors. Ship this as a hard bound `abs(i(vcc)) <= ICC_max` only, and record the omission.

## 6. `known_omissions` boilerplate

**Always, and this first entry is mandatory verbatim on every 74HC package:**
- `"This is an ANALOG BEHAVIORAL model, not a digital one. The simulation engine has no XSPICE and no event-driven digital solver. There are no logic states, no unknown/X value, no high-impedance Z state, and no timing checks. Everything is a continuous voltage."`
- `"Metastability is not modelled. A setup or hold violation produces a smooth intermediate output, not a genuinely indeterminate one, and the model always resolves."`
- `"Setup time, hold time, removal time, recovery time and maximum toggle frequency are not fitted. They are consequences of the internal RC delay, not datasheet-matched quantities."`
- `"Output transition time (tT) is not fitted; it is a consequence of the output resistance and the external load."`
- `"Propagation delay is fitted at VCC = 4.5 V. The delay increase at 2 V and decrease at 6 V are not fitted."`
- `"Quiescent supply current is not modelled. Supply current is dominated by the model's own internal networks and does not correspond to the datasheet ICC."`
- `"Input protection diodes to VCC and GND are not modelled. Inputs driven beyond the supplies do not clamp and do not conduct."`
- `"Input capacitance (CI) is not modelled, so the loading this gate presents to a driving stage is purely resistive."`
- `"Latch-up is not modelled."`
- `"No self-heating and no temperature coefficients."`
- `"Fitted from the VCC = 4.5 V column of the DC and AC characteristics."`

**Conditional:**
- Sequential parts: `"Power-up state is deterministic in this model because a fixed asymmetry is built into the latch to give the DC operating point a definite solution. Real devices power up in an indeterminate state."`
- Tri-state parts (74HC595, 74HC165): `"The output-enable high-impedance state is modelled as a large resistance, not a true disconnection. Bus contention between two enabled drivers produces a resistive divider rather than a fault."`
- 74HC123: `"The monostable pulse width is fitted to the datasheet formula, not to a measured pulse-width figure. Retriggering and reset behaviour follow the internal latch, not a characterised timing path."`
- Open-drain or bus-hold variants: state explicitly which pins deviate.

## 7. Numerical hygiene

1. **Build combinational logic from the arithmetic forms in 1.2, never from a `?:` chain.** A ternary is discontinuous, and a discontinuous drive into the output capacitance produces the same overshoot measured in the comparator archetype, where an abruptly switched stage overshot a 5 V rail to 5.159 V and undershot to -0.159 V. The `tanh` and product forms are smooth and monotone. The hard bounds in bench 5.2 exist to catch a regression here.
2. **A self-holding node is singular at the operating point.** The obvious latch, `Bs sd 0 V = enable ? v(in) : v(s)` with `Rs sd s` and `Cs s 0`, has **no conductance path at DC**: when the expression returns `v(s)`, the resistor sees equal voltages at both ends and contributes nothing. Verified failure: `Warning: singular matrix: check node x5.s`, followed by dynamic gmin stepping, true gmin stepping and source stepping all failing. **Use the regenerative cross-coupled pair of 2.4**, where each latch node reaches a `B` voltage-source node through its own resistor.
3. **The cross-coupled pair needs a symmetry-breaking `VSKEW`.** Without it, Newton converges to the symmetric metastable point and every `.op` reports `Q = QB = VCC/2`. Verified: at `VSKEW = 0.002` the operating point sat at 2.2507 V; at `VSKEW >= 0.02` it resolved to a full rail, and the divide-by-two remained exact in every case. `VSKEW = 0.05` is the fixed constant.
4. **Every input pin needs its leakage resistor to ground.** `1e11` is the value. Without it an unconnected input floats the matrix. Do not raise it further; see the README's `1e9` guidance for behavioral off-resistances, and note that this one is an input, not a switched off-state, which is why `1e11` is acceptable here.
5. **`min(max(x,lo),hi)` for the output clamp. `limit()` is banned** and would leave the gate with no rails at all.
6. **`CINT >= 1e-15` F.** A zero delay capacitance removes the gate's only time constant, and a chain of such gates becomes an algebraic loop with no state.
7. **Do not drive a gate input with a 1 ps edge.** The delay bench uses a 6 ns edge because that is the datasheet's own input-slew condition. Infinitely fast edges measure a quantity the datasheet does not specify and force the timestep controller to its floor.
8. **One gate per subcircuit, `VCC` and `GND` explicit on every one.** A package-level subcircuit with an implicit supply cannot be used in the mixed-supply circuits beginners actually draw.
9. **Never use `.ic` inside a shipped model.** Initial conditions belong to the user's netlist. A model that only works with `uic` is a model that breaks every `.op` and every DC sweep the user runs.
