# 74HC02 model card

## Identity

- Manufacturer: Nexperia B.V.
- Description: Quad 2-input NOR gate
- Electrical family: logic_74hc
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://assets.nexperia.com/documents/data-sheet/74HC_HCT02.pdf
- Revision: Rev. 9, 15 February 2024
- Accessed: 2026-08-07
- Referenced pages: p. 3, p. 4, p. 5, p. 7
- SHA-256: `2773ea732403ff2a427153b8a0980ab6c6d8091df1ad8825a8b9711c1cf6b559`
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
| KVTC | 9.49473286e+00 | derived_closed_form |
| RINT | 1.00000000e+03 | held_default |
| CINT | 9.14811471e-12 | fitted |
| ROH | 4.50000000e+01 | derived_from_typical |
| ROL | 3.75000000e+01 | derived_from_typical |
| KSW | 1.20000000e+01 | held_default |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RINT | 1.00000000e+03 | ohm | held at default, fixed archetype internal delay resistance |
| KSW | 1.20000000e+01 | 1 | held at default, fixed archetype output-driver blend constant |
| RIN | 1.00000000e+11 | ohm | held at default, mandatory input leakage path |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| voh_loaded_typ | 4.32000000e+00 | 4.31932304e+00 | V | 0.016% | Nexperia 74HC02 Rev. 9, 15 February 2024, p. 4, Table 6 static characteristics, 25 degC TYP loaded VOH = 4.32 V and VOL = 0.15 V at 4 mA |
| vol_loaded_typ | 1.50000000e-01 | 1.50338746e-01 | V | 0.226% | Nexperia 74HC02 Rev. 9, 15 February 2024, p. 4, Table 6 static characteristics, 25 degC TYP loaded VOH = 4.32 V and VOL = 0.15 V at 4 mA |
| tphl_15p | 7.00000000e-09 | 6.99868000e-09 | s | 0.019% | Nexperia 74HC02 Rev. 9, 15 February 2024, p. 5, Table 7 dynamic characteristics, 25 degC TYP tpd = 7 ns, VCC = 5 V, CL = 15 pF; p. 7 tr = tf = 6 ns |
| tplh_15p | 7.00000000e-09 | 7.00067000e-09 | s | 0.010% | Nexperia 74HC02 Rev. 9, 15 February 2024, p. 5, Table 7 dynamic characteristics, 25 degC TYP tpd = 7 ns, VCC = 5 V, CL = 15 pF; p. 7 tr = tf = 6 ns |
| tphl_50p | 9.00000000e-09 | 8.57254000e-09 | s | 4.750% | Nexperia 74HC02 Rev. 9, 15 February 2024, p. 5, Table 7 dynamic characteristics, 25 degC TYP tpd = 9 ns, VCC = 4.5 V, CL = 50 pF; p. 7 tr = tf = 6 ns |
| tplh_50p | 9.00000000e-09 | 8.64227000e-09 | s | 3.975% | Nexperia 74HC02 Rev. 9, 15 February 2024, p. 5, Table 7 dynamic characteristics, 25 degC TYP tpd = 9 ns, VCC = 4.5 V, CL = 50 pF; p. 7 tr = tf = 6 ns |

Worst fitting error: 4.750% for tphl_50p.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 1.084e-09 and worst absolute delta was 8.793e-14.

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

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
