# BZX84C5V1 model card

## Identity

- Manufacturer: onsemi
- Description: 5.1 V, 250 mW surface-mount Zener diode
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (P5)

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/bzx84c2v4lt1-d.pdf
- Revision: BZX84C2V4LT1/D Rev. 23, August 2021
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 5
- SHA-256: `1a22315120ae477c212df522f5610e4312030837dbd9b5ea8b7ea55ceaeb05df`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | approx |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 3.50439024e-13 | fitted |
| N | 1.21379068e+0 | fitted |
| RS | 1.55288886e-1 | fitted |
| CJO | 2.25000000e-10 | derived_or_held_default |
| BV | 5.10000000e+0 | datasheet_table |
| IBV | 5.00000000e-3 | datasheet_table |
| NBV | 1.00000000e+0 | datasheet_table |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1.000e-3 A | 6.800000e-1 | 6.791189e-1 | V | 0.130% | p. 5 fig. 4, manually digitized 25 degC family curve |
| forward voltage at 1.000e-2 A | 7.500000e-1 | 7.523236e-1 | V | 0.310% | p. 5 fig. 4, manually digitized 25 degC family curve |
| forward voltage at 1.000e-1 A | 8.400000e-1 | 8.381067e-1 | V | 0.225% | p. 5 fig. 4, manually digitized 25 degC family curve |
| forward voltage at 5.000e-1 A | 9.500000e-1 | 9.504132e-1 | V | 0.043% | p. 5 fig. 4, manually digitized 25 degC family curve |

Worst fitting error: 0.310% for forward voltage at 0.01 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 2.465e-14 and worst absolute delta was 1.665e-14.

## Known omissions

- The forward curve is a family-level typical curve, not a device-specific BZX84C5V1 trace, and the reverse knee is constrained by MIN/MAX table windows, so fidelity is capped at F1.
- NBV is held at a first-order default. Dynamic impedance, temperature coefficient, surge behavior, noise, and statistical Zener-voltage tolerance are not continuously modelled.
- Package pin 2 is no-connect and is represented only by the three-pin package metadata; the electrical SPICE model has anode and cathode terminals.
- Self-heating, process spread, package parasitics, ageing, and failure outside ratings are not modelled.
- P5 independent review passed F1: family forward data, part-specific Zener windows, an independent 10 mA reverse probe, and all nine native and WASM benches were verified.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
