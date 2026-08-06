# 74HC14 model card

## Identity

- Manufacturer: Nexperia B.V.
- Description: Hex inverting Schmitt trigger
- Electrical family: logic_74hc
- Fidelity tier: F2
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://assets.nexperia.com/documents/data-sheet/74HC_HCT14.pdf
- Revision: Rev. 10, 29 February 2024
- Accessed: 2026-08-07
- Referenced pages: p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `ab7028cdd8c5ce854e8f061a2eea568d4ff19d79c551646a8483f4f6835f5711`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Fit method

Closed-form single-input DC parameters or deterministic two-input corner solve with a 1 mV numerical guard, plus exactly three native ngspice-46 fixed-point CINT calibration iterations; 74HC14 KVTC is calibrated against the cited 25 degC typical thresholds; no vendor SPICE model used. All benches explicitly set 25 degC. Typical values are fitted only from TYP columns; MIN and MAX values are used as hard guarantees.

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | none |
| transient | fitted |
| noise | none |
| thermal | none |
| digital | approx |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| KVTC | 1.40000000e+01 | fitted |
| RINT | 1.00000000e+03 | held_default |
| CINT | 1.45570668e-11 | fitted |
| ROH | 4.50000000e+01 | derived_from_typical |
| ROL | 3.75000000e+01 | derived_from_typical |
| KSW | 1.20000000e+01 | held_default |
| VHYST | 9.80000000e-01 | derived_from_typical |
| VCTR | 1.89000000e+00 | derived_from_typical |
| VNOM | 4.50000000e+00 | held_default_fit_voltage |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RINT | 1.00000000e+03 | ohm | held at default, fixed archetype internal delay resistance |
| KSW | 1.20000000e+01 | 1 | held at default, fixed archetype output-driver blend constant |
| RIN | 1.00000000e+11 | ohm | held at default, mandatory input leakage path |
| VNOM | 4.50000000e+00 | V | held at default fit voltage selected by the archetype |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| voh_loaded_typ | 4.32000000e+00 | 4.32000011e+00 | V | 0.000% | Nexperia 74HC14 Rev. 10, 29 February 2024, p. 4, Table 6 static characteristics, 25 degC TYP loaded VOH = 4.32 V and VOL = 0.15 V at 4 mA |
| vol_loaded_typ | 1.50000000e-01 | 1.50000185e-01 | V | 0.000% | Nexperia 74HC14 Rev. 10, 29 February 2024, p. 4, Table 6 static characteristics, 25 degC TYP loaded VOH = 4.32 V and VOL = 0.15 V at 4 mA |
| tphl_15p | 1.20000000e-08 | 1.15189000e-08 | s | 4.009% | Nexperia 74HC14 Rev. 10, 29 February 2024, p. 5, Table 7 dynamic characteristics, 25 degC TYP tpd = 12 ns, VCC = 5 V, CL = 15 pF; p. 6 tr = tf = 6 ns |
| tplh_15p | 1.20000000e-08 | 1.24807000e-08 | s | 4.006% | Nexperia 74HC14 Rev. 10, 29 February 2024, p. 5, Table 7 dynamic characteristics, 25 degC TYP tpd = 12 ns, VCC = 5 V, CL = 15 pF; p. 6 tr = tf = 6 ns |
| tphl_50p | 1.50000000e-08 | 1.30831000e-08 | s | 12.779% | Nexperia 74HC14 Rev. 10, 29 February 2024, p. 5, Table 7 dynamic characteristics, 25 degC TYP tpd = 15 ns, VCC = 4.5 V, CL = 50 pF; p. 6 tr = tf = 6 ns |
| tplh_50p | 1.50000000e-08 | 1.40703000e-08 | s | 6.198% | Nexperia 74HC14 Rev. 10, 29 February 2024, p. 5, Table 7 dynamic characteristics, 25 degC TYP tpd = 15 ns, VCC = 4.5 V, CL = 50 pF; p. 6 tr = tf = 6 ns |
| vt_plus_typ | 2.38000000e+00 | 2.32384000e+00 | V | 2.360% | Nexperia 74HC14 Rev. 10, 29 February 2024, p. 7, Table 10 transfer characteristics, VCC = 4.5 V, 25 degC TYP VT+ = 2.38 V, VT- = 1.40 V, VH = 0.98 V |
| vt_minus_typ | 1.40000000e+00 | 1.45616000e+00 | V | 4.011% | Nexperia 74HC14 Rev. 10, 29 February 2024, p. 7, Table 10 transfer characteristics, VCC = 4.5 V, 25 degC TYP VT+ = 2.38 V, VT- = 1.40 V, VH = 0.98 V |
| hysteresis_typ | 9.80000000e-01 | 8.67674000e-01 | V | 11.462% | Nexperia 74HC14 Rev. 10, 29 February 2024, p. 7, Table 10 transfer characteristics, VCC = 4.5 V, 25 degC TYP VT+ = 2.38 V, VT- = 1.40 V, VH = 0.98 V |

Worst fitting error: 12.779% for tphl_50p.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 2.082e-08 and worst absolute delta was 7.816e-14.

## Known omissions

- This is an ANALOG BEHAVIORAL model, not a digital one. The simulation engine has no XSPICE and no event-driven digital solver. There are no logic states, no unknown/X value, no high-impedance Z state, and no timing checks. Everything is a continuous voltage.
- Metastability is not modelled. A setup or hold violation produces a smooth intermediate output, not a genuinely indeterminate one, and the model always resolves.
- Setup time, hold time, removal time, recovery time and maximum toggle frequency are not fitted. They are consequences of the internal RC delay, not datasheet-matched quantities.
- Output transition time (tT) is not fitted; it is a consequence of the output resistance and the external load.
- Propagation delay is fitted at VCC = 4.5 V. The delay increase at 2 V and decrease at 6 V are not fitted.
- Quiescent supply current is not modelled. Supply current is dominated by the model's own internal networks and does not correspond to the datasheet ICC.
- Input protection diodes to VCC and GND are not modelled. Inputs driven beyond the supplies do not clamp and do not conduct.
- Input capacitance (CI) is not modelled, so the loading this gate presents to a driving stage is purely resistive.
- Latch-up is not modelled.
- No self-heating and no temperature coefficients.
- Fitted from the VCC = 4.5 V column of the DC and AC characteristics.
- RINT = 1 kohm is held at default.
- KSW = 12 is held at default.
- All 100 Gohm input leakage resistors are held at default.
- VNOM = 4.5 V is held at default as the archetype fit-voltage reference.
- The 74HC14 threshold center and hysteresis are fitted at VCC = 4.5 V and scale proportionally with VCC elsewhere; the independently published 2.0 V and 6.0 V threshold typicals are not fitted.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
