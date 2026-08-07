# LM4040A25 model card

## Identity

- Manufacturer: Texas Instruments
- Description: A-grade 2.5 V precision shunt voltage reference
- Electrical family: vreg_linear
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm4040-n.pdf
- Revision: SNOS633N, December 1991, revised August 2025
- Accessed: 2026-08-07
- Referenced pages: p. 3 Figure 4-1, p. 4 Table 4-1, p. 5 Sections 5.1 and 5.3, p. 11 Section 5.8, p. 12 Section 5.8
- SHA-256: `7c49c3d3c26fc75538a967bae38abaa08f6aee851e543c354185cc14e1efa29b`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VREF | 2.50000000e+0 | datasheet_typical |
| IKMIN | 4.50000000e-5 | datasheet_typical |
| IKMAX | 2.00000000e-2 | datasheet_absolute_maximum |
| ZKA | 3.00000000e-1 | datasheet_typical |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RKA | 1.00000000e+7 | ohm | archetype fixed shunt |
| smoothing_term | 1.00000000e-12 | V^2 | archetype fixed softplus smoothing |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |


Worst fitting error: 0.000% for pending native measurement.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 1.420e-14 and worst absolute delta was 4.269e-19.

## Known omissions

- Thermal shutdown and safe-operating-area behavior are not modelled.
- No self-heating and no temperature coefficients are modelled.
- AC behaviour is not modelled beyond the low-frequency dynamic-impedance scalar. Frequency dependence, noise, and transient response are absent.
- Cathode dynamic impedance is a single constant taken from the datasheet stated current range; its variation with frequency and current is not modelled.
- Start-up behavior is not modelled.
- The 1e7-ohm K-to-A shunt is held at the archetype default.
- The 1e-12 smoothing term is held at the archetype default.
- The physical SOT-23 pin 3 must float or connect to anode and is not an electrical symbol pin in this two-terminal subcircuit.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
