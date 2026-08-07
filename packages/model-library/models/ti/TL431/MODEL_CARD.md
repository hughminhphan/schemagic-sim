# TL431 model card

## Identity

- Manufacturer: Texas Instruments
- Description: A-grade precision programmable shunt reference
- Electrical family: vreg_linear
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/tl431.pdf
- Revision: SLVS543S, August 2004, revised May 2024
- Accessed: 2026-08-07
- Referenced pages: p. 4 Table 5-1, p. 5 Sections 6.1 and 6.4, p. 9 Section 6.8
- SHA-256: `32d5c43016e8ecf5267c4e12d82a5bb5a7344e2f435b619525381b9321bb3cc8`
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
| VREF | 2.49500000e+0 | datasheet_typical |
| IKMIN | 4.00000000e-4 | datasheet_typical |
| IKMAX | 1.50000000e-1 | datasheet_absolute_maximum |
| ZKA | 2.00000000e-1 | datasheet_typical |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RKA | 1.00000000e+7 | ohm | archetype fixed shunt |
| smoothing_term | 1.00000000e-12 | V^2 | archetype fixed softplus smoothing |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |


Worst fitting error: 0.000% for pending native measurement.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 0.000e+0 and worst absolute delta was 0.000e+0.

## Known omissions

- Thermal shutdown and safe-operating-area behavior are not modelled.
- No self-heating and no temperature coefficients are modelled.
- AC behaviour is not modelled beyond the low-frequency dynamic-impedance scalar. Frequency dependence, noise, and transient response are absent.
- Cathode dynamic impedance is a single constant taken from the datasheet stated current range; its variation with frequency and current is not modelled.
- Start-up behavior is not modelled.
- The 1e7-ohm K-to-A shunt is held at the archetype default.
- The 1e-12 smoothing term is held at the archetype default.
- The archetype tanh current limiter increases effective cathode impedance as current approaches its 150 mA asymptote. The model is therefore limited to 0.6 mA to 50 mA and is downgraded to F1 rather than claiming the full 1 mA to 100 mA datasheet dynamic-impedance range.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
