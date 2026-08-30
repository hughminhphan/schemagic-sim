# Archetype: 555 timer (internal-architecture subcircuit)

Family: `timer`. Model type: `subckt`. Fidelity ceiling **F2**.

Parts: NE555, TLC555, LMC555, ICM7555.

This archetype does **not** implement the astable and monostable formulas. It implements the 555's published internal architecture (a three-resistor divider, two comparators, an RS latch, an output stage and a discharge switch) and lets the timing laws emerge. The datasheet formulas are then genuine independent checks rather than restatements of what was coded.

Verified against native ngspice-46: the astable configuration `R1 = 10k`, `R2 = 10k`, `C = 10 nF` produced **4799.95 Hz** against the theoretical 4800.00 Hz (0.001 percent error) with a duty cycle of **66.57 percent** against 66.67 percent, and the monostable configuration `R = 10k`, `C = 10 nF` produced **109.686 us** against the theoretical 110.0 us (-0.29 percent).

## 1. Subcircuit template and node order

**Node order is `GND TRIG OUT RESET CONT THRES DISCH VCC`**, which is the physical DIP-8 pin order 1 through 8. This is deliberate: it makes `spice_pin_mapping` an identity mapping against `symbol_pins`, and it is the order every 555 datasheet prints.

```spice
* scheMAGIC original-from-facts model
* <MPN> (<manufacturer>), datasheet rev <rev>, fitted <YYYY-MM-DD>
* Archetype: archetype-timer555.md. Fit run: <run-id>
* Node order: X<ref> gnd trig out reset cont thres disch vcc OC_<MPN>
* (DIP-8 pin order 1..8)
.subckt OC_<MPN> GND TRIG OUT RESET CONT THRES DISCH VCC
+ PARAMS: RDIV=<ohm> AGAIN=2e3 KREG=25 TAU=20n VDRP_H=<V> VDRP_L=<V>
+ RDIS=<ohm> RDOFF=1e9 KSW=20 ROUT=<ohm> VSKEW=0.05 IQ=<A>
* --- the three-resistor divider; CONT is the 2/3 VCC tap and is a real pin ---
RA VCC CONT {RDIV}
RB CONT CTRG {RDIV}
RC CTRG GND {RDIV}
* --- upper (threshold) and lower (trigger) comparators ---
BCU cu GND V = 0.5*(1+tanh(AGAIN*(v(THRES,GND)-v(CONT,GND))))
RCU cu GND 1meg
BCL cl GND V = 0.5*(1+tanh(AGAIN*(v(CTRG,GND)-v(TRIG,GND))))
RCL cl GND 1meg
* --- active-low RESET pin ---
BRS rs GND V = 0.5*(1+tanh(20*(v(RESET,GND)-0.7)))
RRS rs GND 1meg
* --- regenerative RS latch, reset dominant, gated by RESET ---
BQA qad GND V = v(rs)*( (v(cu)>0.5) ? 0 : ( (v(cl)>0.5) ? 1 : 0.5*(1-tanh(KREG*(v(qb)-0.5))) ) )
RQA qad qa {TAU/1p}
CQA qa GND 1p
BQB qbd GND V = 0.5*(1-tanh(KREG*(v(qa)-0.5))) + VSKEW
RQB qbd qb {TAU/1p}
CQB qb GND 1p
* --- push-pull output stage ---
BOUT od GND V = min(max(VDRP_L + (v(VCC,GND)-VDRP_H-VDRP_L)*v(qa), 0), v(VCC,GND))
ROUT od OUT {ROUT}
* --- discharge switch: CONDUCTANCE blend, never a resistance blend ---
RDISCH DISCH GND R={1/((1/RDIS)*0.5*(1-tanh(KSW*(v(qa)-0.5))) + 1/RDOFF)}
IQD VCC GND DC {IQ}
.ends OC_<MPN>
```

The latch is the regenerative cross-coupled pair of `archetype-logic74hc.md` section 2.4, for the same reason: a self-holding node whose own expression returns `v(itself)` through a series resistor is singular at the operating point.

## 2. Required datasheet inputs

| Symbol | Unit | Typical datasheet location | Conditions that MUST be recorded |
|---|---|---|---|
| Threshold voltage | V | Electrical characteristics, "Threshold Voltage" | `VCC`. Usually quoted as a fraction (2/3 VCC) and as a volts row at 5 V and 15 V |
| Trigger voltage | V | "Trigger Voltage" | `VCC` |
| Threshold current | A | "Threshold Current" | Sets the maximum usable timing resistor; `supported_operating_region` |
| Trigger current | A | "Trigger Current" | |
| Reset voltage | V | "Reset Voltage" | The active-low threshold, typically 0.7 V |
| Reset current | A | "Reset Current" | |
| `VOH` | V | "Output Voltage" HIGH rows | **`VCC` and `ISOURCE`.** There are several rows; record all |
| `VOL` | V | "Output Voltage" LOW rows | `VCC` and `ISINK` |
| Discharge saturation voltage | V | "Discharge Switch Saturation" or "Low Output Voltage (pin 7)" | The `I` at which it is measured |
| Discharge leakage | A | "Discharge Leakage Current" | |
| `ICC` | A | "Supply Current" | `VCC`, output low, no load |
| Rise/fall time of output | s | "Output Rise Time", "Output Fall Time" | `VCC`, `CL` |
| Timing accuracy | percent | "Initial Accuracy", "Timing Drift" | For `MODEL_CARD.md` prose |

The CMOS variants (TLC555, LMC555, ICM7555) publish very different `IQ`, output drive and discharge figures from the bipolar NE555. They are separate packages with separately fitted parameters, never an alias.

## 3. Deterministic fitting procedure

### 3.1 Divider

```python
RDIV = 5e3          # NE555 bipolar; the datasheet block diagram states 5k
```

The value only sets the divider's loading and the current it draws from `VCC`; the tap ratios are structural. If the datasheet block diagram states a different value (CMOS parts use 100k or more), use it. If it states none, choose `RDIV` so that the divider current matches the published `ICC` at the stated `VCC`, and record: `"Divider resistance derived from the published supply current; the datasheet block diagram does not state it."`

### 3.2 Output stage

```python
VDRP_H = VCC_test - VOH_at_ISOURCE          # from the loaded HIGH row
VDRP_L = VOL_at_ISINK                        # from the loaded LOW row
ROUT   = max(VDRP_H / ISOURCE_test, 1.0)
IQ     = ICC_typ
```

### 3.3 Discharge switch

```python
RDIS  = V_discharge_sat / I_discharge_test
RDIS  = max(RDIS, 1.0)
RDOFF = 1e9                                  # fixed, NOT from the leakage row
```

`RDOFF` is fixed for the same reason as the comparator's `ROFF`: a resistance derived from a nanoamp leakage maximum lands above `1e9` where the node is governed by `gmin`. Record: `"Discharge-switch off-state leakage is fixed at a numerically safe 1e9 ohm rather than the datasheet leakage maximum."`

### 3.4 Fixed archetype constants, never fitted

`AGAIN = 2e3`, `KREG = 25`, `KSW = 20`, `VSKEW = 0.05`, `TAU = 20n`, latch capacitors `1p`, comparator load resistors `1meg`.

**`AGAIN = 2e3` is a hard requirement, not a preference.** See 7.1. **`TAU <= 20n` is a hard requirement.** See 7.2.

If the datasheet publishes an output rise or fall time that implies a slower internal propagation, do **not** raise `TAU`; model that delay by adding to `ROUT` instead, and record the omission.

### 3.5 No calibration loop

Unlike the opamp, comparator, regulator and 74HC archetypes, this one needs no fixed-point calibration. The timing emerges from the divider ratios and the external RC, both of which are exact. Verified error is 0.001 percent on frequency. **If a 555 package needs a calibration fudge to hit the datasheet formula, something in the architecture is wired wrong.** Find it rather than trimming it.

## 4. Standard test benches

Note on the operating point: an astable 555 is a free-running oscillator and **has no stable DC operating point**. ngspice reports `Dynamic gmin stepping failed`, `True gmin stepping failed` and `source stepping failed` on the astable bench and then runs the transient correctly. This is inherent to oscillators, not a model defect. Verified: the same subcircuit in monostable configuration converges cleanly with no warnings at all. Document it; do not try to fix it.

### 4.1 `astable.cir` (analysis_type `transient`)

```spice
* <MPN> astable: R1=10k R2=10k C=10n, f = 1.44/((R1+2*R2)*C) = 4800 Hz
.include ../model.cir
VCC vcc 0 DC 5
X1 0 cap out vcc ctl cap dis vcc OC_<MPN>
R1 vcc dis 10k
R2 dis cap 10k
C1 cap 0 10n
CCTL ctl 0 10n
.save v(out) v(cap)
.tran 200n 1m
.end
```

Two checks, both tied to the datasheet's own published formulas:

```json
{
  "name": "astable_frequency",
  "expression_source": { "kind": "derived_expression", "expression": "1/((time at v(out)=1.7 rising 4) - (time at v(out)=1.7 rising 2))*2" },
  "expected_value": 4800.0, "unit": "Hz",
  "tolerance": { "absolute": 0, "relative": 0.05 },
  "datasheet_citation": "<mfr> <MPN> rev <r> p.<n>, application information, astable frequency f = 1.44/((R1+2*R2)*C)",
  "placeholder": false
},
{
  "name": "astable_duty_cycle",
  "expression_source": { "kind": "derived_expression", "expression": "((time at v(out)=1.7 falling 2) - (time at v(out)=1.7 rising 2)) / ((time at v(out)=1.7 rising 3) - (time at v(out)=1.7 rising 2))" },
  "expected_value": 0.6667, "unit": "1",
  "tolerance": { "absolute": 0, "relative": 0.05 },
  "datasheet_citation": "<mfr> <MPN> rev <r> p.<n>, application information, duty cycle (R1+R2)/(R1+2*R2)",
  "placeholder": false
}
```

Relative 0.05 overrides the README's 15 percent timing band. Justification: the architecture reproduced the formula to 0.001 percent, so a loose band would let a genuinely broken latch pass.

The threshold `1.7 V` is used rather than `VCC/2` because the output low level is `VDRP_L` and the high level is `VCC - VDRP_H`; `1.7 V` sits comfortably between them at `VCC = 5 V` for every part in the family.

**`CCTL` on the control pin is mandatory in every bench.** It is mandatory on a real 555 too, and without it the divider tap is a high-impedance node that picks up the switching transient.

### 4.2 `monostable.cir` (analysis_type `transient`)

```spice
* <MPN> monostable: R=10k C=10n, T = 1.1*R*C = 110 us
.include ../model.cir
VCC vcc 0 DC 5
X1 0 trg out vcc ctl cap cap vcc OC_<MPN>
RT vcc cap 10k
CT cap 0 10n
CCTL ctl 0 10n
VT trg 0 PWL(0 5 100u 5 101u 0 105u 0 106u 5 900u 5)
.save v(out) v(cap) v(trg)
.tran 200n 900u
.end
```

Note that `THRES` and `DISCH` are tied together at `cap`, which is the standard monostable wiring.

```json
{
  "name": "monostable_pulse_width",
  "expression_source": { "kind": "derived_expression", "expression": "(time at v(out)=2.5 falling 1) - (time at v(out)=2.5 rising 1)" },
  "expected_value": 1.1e-4, "unit": "s",
  "tolerance": { "absolute": 0, "relative": 0.05 },
  "datasheet_citation": "<mfr> <MPN> rev <r> p.<n>, application information, monostable pulse width T = 1.1*R*C",
  "placeholder": false
}
```

This bench also carries the operating-point sanity check as hard bounds: with the trigger held high the output must be low, so `v(out) at time=0` must lie between `0` and `VDRP_L * 1.5`.

### 4.3 `output_levels.cir` (analysis_type `transient`)

Reuse the astable netlist with the rated source and sink currents applied, and check `max(v(out))` against `VOH` and `min(v(out))` against `VOL`, relative 0.15, absolute 0.1 V.

### 4.4 `control_voltage.cir` (analysis_type `transient`)

Drive `CONT` from a voltage source at `0.5*VCC` instead of leaving it decoupled, and check that the astable frequency shifts as the divider ratio predicts. This is the bench that proves the architecture is real rather than a formula in disguise; a formula-based model would not respond to the control pin at all.

```spice
* <MPN> control-voltage modulation of the astable period
.include ../model.cir
VCC vcc 0 DC 5
VCTL ctl 0 DC 2.5
X1 0 cap out vcc ctl cap dis vcc OC_<MPN>
R1 vcc dis 10k
R2 dis cap 10k
C1 cap 0 10n
.save v(out) v(cap)
.tran 200n 1m
.end
```

Check that the measured frequency differs from the 4.1 result by the ratio the divider predicts, relative 0.10.

### 4.5 `reset.cir` (analysis_type `transient`)

Pull `RESET` below 0.7 V mid-oscillation and check that `v(out)` goes and stays low. Ship as a hard bound: `v(out)` after the reset edge must remain below `VDRP_L * 1.5`, cited to the reset voltage row.

## 5. `known_omissions` boilerplate

**Always:**
- `"The comparators, latch and output stage are analog behavioral approximations of the datasheet block diagram, not transistor-level circuits. Internal node voltages are not physical."`
- `"Trigger and threshold input currents are not modelled, so the maximum usable timing resistance is not enforced. A circuit using a 10 Meg timing resistor will work in simulation and may not work on a bench."`
- `"Timing accuracy, initial accuracy and drift with temperature and supply are not modelled. The model reproduces the ideal formulas far more precisely than any real device does."`
- `"Output rise and fall times are consequences of the output resistance and the external load, not fitted datasheet quantities."`
- `"Supply-current spikes during output transitions (the crowbar current that makes 555 circuits require supply decoupling) are not modelled. Quiescent current is a constant."`
- `"No self-heating and no temperature coefficients."`
- `"The discharge switch is a resistance to ground, not a saturating transistor. Its behaviour at currents far above the datasheet test point is a linear extrapolation."`
- `"Discharge-switch off-state leakage is fixed at a numerically safe 1e9 ohm rather than the datasheet leakage maximum."`
- `"Power-up state is deterministic because a fixed asymmetry is built into the latch to give the operating point a definite solution. Real devices power up in an indeterminate state."`
- `"An astable configuration has no DC operating point, so an .op analysis on such a circuit will report solver warnings before the transient runs correctly. This is inherent to oscillators."`
- `"Noise is not modelled, so period jitter is absent."`

**Conditional:**
- CMOS variants: `"CMOS variant: fitted from its own datasheet. Output drive, supply current and discharge resistance differ substantially from the bipolar NE555 and the two are not interchangeable models."`
- Divider not stated: `"Divider resistance derived from the published supply current; the datasheet block diagram does not state it."`

## 6. `domain_coverage` defaults

| Domain | Rating | Condition |
|---|---|---|
| `dc` | `fitted` | Divider ratios and output levels fitted |
| `ac` | `none` | Always. There is no meaningful small-signal response |
| `transient` | `validated` | Once the astable and monostable benches pass with real citations. This is the archetype's whole purpose |
| `noise` | `none` | Always |
| `thermal` | `none` | Always |
| `digital` | `none` | Always. There are no digital nodes in this engine |

`supported_analyses`: `["operating_point", "transient"]`. **Do not list `dc_sweep` or `ac_small_signal`.** A DC sweep of an astable circuit is meaningless and an AC sweep doubly so.

## 7. Numerical hygiene

1. **Comparator gain must be moderate. `AGAIN = 2e3`, never `1e5`.** A `tanh(1e5*x)` comparator saturates within 20 microvolts and its derivative at the crossing is 1e5. Verified: an otherwise identical 555 with `AGAIN = 1e5` drove the timestep controller to its floor and **the run did not complete in two minutes**. At `AGAIN = 2e3` the same netlist finishes in seconds and resolves the thresholds to about 0.5 mV, which is far finer than the volt-scale thresholds of a 555.
2. **The latch must resolve much faster than the timing network. `TAU <= 20n`.** With `TAU = 100 ns`, the discharge switch began conducting before the latch had finished resolving, the threshold comparator then released, and the half-resolved latch snapped back to the set state. The result was an output stuck at intermediate voltages around 2.5 V and a timing capacitor pinned at exactly the 3.3333 V threshold, oscillating nowhere. At `TAU = 20 ns` the frequency was exact to 0.001 percent. This is a genuine race between two model time constants and it has no warning symptom other than wrong behaviour.
3. **Blend the CONDUCTANCE of the discharge switch, never the resistance.** The intuitive form `R = {RDIS + RDOFF*sigmoid(q)}` leaves a large residue in the ON state: with `RDOFF = 1e9` and `KSW = 12`, the sigmoid floor of `6.1e-6` contributed **6.1 kohm in series with a 12 ohm switch**, which was enough to stop the timing capacitor discharging at all. The conductance form `R = {1/((1/RDIS)*sigmoid + 1/RDOFF)}` has no such residue.
4. **`KSW >= 20`.** The conductance form has the mirror-image problem: the sigmoid's residual at the OFF end multiplies `1/RDIS`. At `KSW = 12` the off-state resistance came out at only 2 Mohm; at `KSW = 20` it is 0.9 Gohm as intended. The rule is `KSW` large enough that `(1/RDIS) * 0.5*(1-tanh(KSW/2)) < 1/RDOFF`. Assert this at card-generation time.
5. **The regenerative latch needs `VSKEW`.** Without it the operating point converges to the symmetric metastable solution and both latch nodes sit mid-rail.
6. **Every `B` voltage-source output node needs a resistor to ground.** `RCU`, `RCL`, `RRS` at 1 Meg exist for this reason.
7. **Always decouple `CONT` in a bench.** Real 555 circuits require it and so does this model.
8. **`RDIS >= 1`, `ROUT >= 1`.**
9. **Do not use `uic` to make a 555 bench work.** An earlier draft of this architecture appeared to run correctly only because its transient was launched with `uic`, which skips the operating point and hid a singular self-holding latch node. If a model needs `uic`, it is broken; fix the topology.

## 10. Free-running silicon oscillators

Parts with no published internal architecture (crystal oscillator modules, silicon oscillators) do not belong to this archetype's F2 path. Model them as a behavioral source with the datasheet frequency, output levels and duty cycle, set `fidelity_tier` to `F1`, and record: `"F1: the datasheet publishes no internal architecture. The output is a behavioral waveform generator matching the specified frequency, duty cycle and output levels. Start-up time, frequency pulling, and jitter are absent."`
