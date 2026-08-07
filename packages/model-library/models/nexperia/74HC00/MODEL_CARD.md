# 74HC00 model card

## Identity

- Manufacturer: Nexperia B.V.
- Description: Quad 2-input NAND gate
- Electrical family: logic_74hc
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://assets.nexperia.com/documents/data-sheet/74HC_HCT00.pdf
- Revision: Rev. 11, 29 April 2025
- Accessed: 2026-08-07
- Referenced pages: p. 3, p. 4, p. 5, p. 7
- SHA-256: `dd401970bc0520c2496dd2a8fb8d9c94f29585c61d5f49dab606257d6c92b22f`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

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
| KVTC | 9.46917299e+0 | derived_closed_form_with_second_input_finite_gain |
| RINT | 1.00000000e+3 | held_default |
| CINT | 9.14811471e-12 | fitted |
| ROH | 4.50000000e+1 | derived_from_typical |
| ROL | 3.75000000e+1 | derived_from_typical |
| KSW | 1.20000000e+1 | held_default |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RINT | 1.00000000e+3 | ohm | held at default, fixed archetype internal delay resistance |
| KSW | 1.20000000e+1 | 1 | held at default, fixed archetype output-driver blend constant |
| RIN | 1.00000000e+11 | ohm | held at default, mandatory input leakage path |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| VOL at VIH minimum | 1.000000e-1 | 9.997912e-2 | V | 0.021% | Nexperia 74HC00 Rev. 11 p. 4, VOL max at VCC = 4.5 V and VIH = 3.15 V |
| tPHL at CL = 15 pF | 7.000000e-9 | 7.000170e-9 | s | 0.002% | Nexperia 74HC00 Rev. 11 p. 5, tpd typical at VCC = 5 V and CL = 15 pF |
| tPLH at CL = 15 pF | 7.000000e-9 | 6.999370e-9 | s | 0.009% | Nexperia 74HC00 Rev. 11 p. 5, tpd typical at VCC = 5 V and CL = 15 pF |
| tPHL at CL = 50 pF | 9.000000e-9 | 8.574080e-9 | s | 4.733% | Nexperia 74HC00 Rev. 11 p. 5, tpd typical at VCC = 4.5 V and CL = 50 pF |
| tPLH at CL = 50 pF | 9.000000e-9 | 8.640920e-9 | s | 3.990% | Nexperia 74HC00 Rev. 11 p. 5, tpd typical at VCC = 4.5 V and CL = 50 pF |

Worst fitting error: 4.733% for tPHL at CL = 50 pF.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 6.914e-9 and worst absolute delta was 5.684e-14.

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
