# Behavioral sensor archetype

Applies to sensors whose datasheet specifies a deterministic electrical transfer function from a non-electrical environmental quantity. P5 uses this archetype for LM35 temperature-to-voltage, NTCLE100E3103JB0 temperature-to-resistance, and GL5528 illuminance-to-resistance behavior.

## 1. Authority and fidelity ceiling

- Engine authority is native ngspice-46 with KLU.
- Use portable analog SPICE only: `B`, `E`, `G`, behavioral `R`, and passive elements. XSPICE is prohibited.
- The environmental stimulus is an explicit subcircuit parameter because standard SPICE has no portable illuminance input and the simulator ambient temperature is not a general behavioral voltage input.
- The default fidelity ceiling is **F2** only when the cited transfer curve or equation is fitted and independently exercised across its claimed environmental range.
- A table-only, bounds-only, single-point, or inherited characterization is **F1**.
- The model does not simulate the physical environment. It maps a caller-supplied parameter to electrical behavior.

## 2. Model forms and node order

### 2.1 Linear voltage-output sensor

Use node order `VS OUT GND`. The core transfer law is:

```spice
.param SCALE=10m OFFSET=0 TEMP_C=25 ROUT=0.1 IQ=60u VDROP=0.2
BIDEAL nideal GND V={OFFSET+SCALE*TEMP_C}
BOUT OUT GND V={min(max(v(nideal),v(GND)),v(VS)-VDROP)}
ROUT OUT nideal {max(ROUT,1e-4)}
IQ VS GND DC {IQ}
```

The generated package must use only parameters derived from cited datasheet quantities. If output impedance, quiescent current, rail headroom, curvature, or dynamic response is not published, omit that branch or hold it at a disclosed archetype default and cap fidelity accordingly.

### 2.2 B-parameter NTC

Use node order `P N`. For datasheet reference temperature `T0_C`, nominal resistance `R0`, and B parameter `BETA`, use:

```spice
.param TEMP_C=25 R0=10k T0_C=25 BETA=3977
RNTC P N R={max(R0*exp(BETA*(1/(TEMP_C+273.15)-1/(T0_C+273.15))),1e-4)}
```

`R0`, `T0_C`, and `BETA` must be direct cited facts. Do not infer `BETA` from a generic 10 kohm thermistor. A package may claim F2 only if the model is checked against independent resistance-versus-temperature facts that were not used merely by copying the same equation output.

### 2.3 Illuminance-dependent LDR

Use node order `P N`. Fit the power law in log space from cited resistance-versus-illuminance curve points:

`R(lux) = A * max(lux, LUX_FLOOR)^(-GAMMA)`

```spice
.param LUX=10 A=100k GAMMA=0.7 LUX_FLOOR=1m
RLDR P N R={max(A*pow(max(LUX,LUX_FLOOR),-GAMMA),1e-4)}
```

Fit `log(A)` and `GAMMA` with bounded least squares against digitized curve points. `LUX_FLOOR` is the lowest cited illuminance in the supported region, not an invented dark-resistance surrogate. If only light and dark resistance bounds are published, use an F1 bounded model and state that no continuous typical curve is claimed.

## 3. Typed facts

Every numeric fact carries `value`, `unit`, `conditions`, `page_reference`, and `source_kind`.

Required facts by variant:

| Variant | Required facts |
|---|---|
| Linear voltage output | transfer scale, offset or stated zero intercept, supply range, output range, claimed temperature range |
| B-parameter NTC | nominal resistance, reference temperature, B parameter with its stated temperature interval, claimed temperature range |
| LDR | at least three typical resistance-versus-illuminance curve points for F2, or explicit bounded rows for F1 |

Record response time, self-heating coefficient, dissipation factor, tolerance, hysteresis, long-term drift, spectral response, and package thermal data when published. Metadata does not imply that the electrical model implements it.

## 4. Fitting contract

1. Transcribe or digitize only cited manufacturer data. Never invent intermediate curve points.
2. Linear sensors fit scale and offset with bounded least squares when multiple curve points exist. A direct transfer coefficient and stated intercept may be transcribed, but this alone is F1 unless independent curve or error-band checks are available.
3. NTC packages transcribe `R0`, `T0_C`, and `BETA`; native ngspice evaluates the resulting resistance at every cited validation temperature.
4. LDR packages fit `log(A)` and `GAMMA` against cited points in log-resistance space.
5. Every fitter runs native ngspice-46 in the residual loop or deterministic calibration loop. A Python-only transfer-function fit is insufficient.
6. Use physical bounds, parameter floors, deterministic seeds, and the shared convergence rules in `README.md`.
7. Record fitted, transcribed, derived, inherited, and held-default status separately in `fitted.json` and `MODEL_CARD.md`.

## 5. Required benches

Each package has one analysis card per netlist and includes at least:

1. `transfer_low.cir`: low claimed environmental boundary.
2. `transfer_nominal.cir`: nominal condition.
3. `transfer_high.cir`: high claimed environmental boundary.
4. `supply_or_bias.cir`: cited electrical bias or supply boundary that materially affects behavior.
5. `dynamic.cir`: response-time check only when the model implements a cited time constant.

The NTC and LDR benches excite the element with a low-power current or voltage that stays below the cited self-heating limit. LM35-family benches use the cited supply and load conditions. Expectations are independently derived from cited facts and never copied from the generated model output.

## 6. Domain coverage defaults

| Domain | Default |
|---|---|
| DC | `fitted` only across cited environmental and electrical bounds |
| AC | `none` unless a cited small-signal or response-time model is implemented |
| Transient | `none` unless a cited response time is implemented |
| Noise | `none` unless cited noise data is implemented and validated |
| Thermal | `metadata_only`; the environmental parameter is not electrothermal simulation |
| Digital | `none` |

## 7. Required known omissions

Every package restates all applicable omissions in component metadata and the model card:

- The environmental parameter is caller supplied; heat flow, optical propagation, and the surrounding physical environment are not simulated.
- Self-heating is not modelled unless a cited electrothermal network is explicitly implemented and validated.
- Manufacturing tolerance and statistical spread are metadata only unless corner models are provided from cited limits.
- Hysteresis, aging, long-term drift, mounting stress, lead conduction, and package gradients are not modelled unless separately evidenced.
- Behavior outside the cited environmental and electrical bounds is unsupported even if the behavioral expression returns a finite value.
- For LDRs, spectral response and source spectrum are not represented by scalar illuminance.
- For NTCs, a single B-parameter law does not reproduce full Steinhart-Hart curvature outside its cited B interval.

## 8. ngspice-46 verified example

The following netlist exercises all three forms. It was executed in batch mode with a rawfile against `/opt/homebrew/bin/ngspice`, ngspice-46 with KLU, on 2026-08-09.

```spice
Behavioral sensor archetype verification
.subckt LINEAR_SENSOR VS OUT GND params: TEMP_C=25 SCALE=10m OFFSET=0 ROUT=0.1 IQ=60u VDROP=0.2
BIDEAL nideal GND V={OFFSET+SCALE*TEMP_C}
BOUT ndrive GND V={min(max(v(nideal),v(GND)),v(VS)-VDROP)}
ROUTER ndrive OUT {max(ROUT,1e-4)}
RDC nideal GND 1G
IQDRAW VS GND DC {IQ}
.ends LINEAR_SENSOR
.subckt BETA_NTC P N params: TEMP_C=25 R0=10k T0_C=25 BETA=3977
RNTC P N R={max(R0*exp(BETA*(1/(TEMP_C+273.15)-1/(T0_C+273.15))),1e-4)}
.ends BETA_NTC
.subckt POWER_LDR P N params: LUX=10 A=100k GAMMA=0.7 LUX_FLOOR=1m
RLDR P N R={max(A*pow(max(LUX,LUX_FLOOR),-GAMMA),1e-4)}
.ends POWER_LDR
VCC vs 0 DC 5
XLINEAR vs tempout 0 LINEAR_SENSOR TEMP_C=25
INTC 0 ntc DC 100u
XNTC ntc 0 BETA_NTC TEMP_C=25
ILDR 0 ldr DC 10u
XLDR ldr 0 POWER_LDR LUX=10
.op
.end
```

Expected nominal operating point: `v(tempout)` is 0.25 V, `v(ntc)` is 1 V, and `v(ldr)` is approximately 0.199526 V.
