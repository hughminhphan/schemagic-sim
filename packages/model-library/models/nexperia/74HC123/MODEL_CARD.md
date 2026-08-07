# 74HC123 model card

## Identity

- Manufacturer: Nexperia B.V.
- Description: Dual retriggerable monostable multivibrator with reset
- Electrical family: logic_74hc
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://assets.nexperia.com/documents/data-sheet/74HC_HCT123.pdf
- Revision: Rev. 13, 21 February 2024
- Accessed: 2026-08-07
- Referenced pages: p. 4, p. 5, p. 6, p. 7, p. 8, p. 9, p. 10
- SHA-256: `0b5ba7a32cf4830a89516ecfaf47e80704e5205aa2fe3c07213fc927f104e0a6`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | validated |
| ac | none |
| transient | validated |
| noise | none |
| thermal | none |
| digital | approx |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| ROH | 4.50000000e+1 | fitted |
| ROL | 3.75000000e+1 | fitted |
| TAU | 1.20000000e-8 | fitted |
| VTH | 3.62372000e-1 | fitted |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| KIN | 2.00000000e+1 | 1 | held at default, fixed archetype input sigmoid constant |
| KREG | 2.50000000e+1 | 1 | held at default, fixed archetype regenerative latch constant |
| KSW | 1.20000000e+1 | 1 | held at default, fixed archetype output-driver blend constant |
| VSKEW | 5.00000000e-2 | 1 | held at default, fixed archetype symmetry-breaking constant |
| RIN | 1.00000000e+11 | ohm | held at default, mandatory input leakage path |
| CLATCH | 1.00000000e-12 | F | held at default, fixed latch capacitance |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |


Worst fitting error: 0.000% for pending validation measurement.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 2.082e-8 and worst absolute delta was 4.141e-14.

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
- Power-up state is deterministic in this model because a fixed asymmetry is built into the latch to give the DC operating point a definite solution. Real devices power up in an indeterminate state.
- RINT = 1 kohm is held at default where an explicit combinational delay stage is used.
- KIN = 20, KREG = 25, KSW = 12, VSKEW = 0.05, all 1 pF latch capacitors, and all 100 Gohm input leakage resistors are held at default.
- The monostable pulse width is fitted to the datasheet formula, not to a measured pulse-width figure. Retriggering and reset behaviour follow the internal latch, not a characterised timing path.
- External timing capacitance below 10 nF, trigger retrigger time, power-up pulse behaviour, and the package pin capacitance are not fitted.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
