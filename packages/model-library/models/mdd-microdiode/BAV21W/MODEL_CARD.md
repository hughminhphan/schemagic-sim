# BAV21W model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: 1.25V@200mA 100nA@250V 200mA 250V 3A 500mW 50ns Independent SOD-123 Switching Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8757105908256256000
- Revision: Rev:2025A5
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `04d36cbd7e7a79ab2333f772f34571f349d0d60d3fb00f7d6609ad20d80684ab`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 2.07217033e-11 | fitted or derived |
| N | 1.54523317e+0 | fitted or derived |
| RS | 4.99137928e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.001 A | 7.000000e-1 | 7.076044e-1 | V | 1.086% | p. 2 Typical Characteristics |
| forward voltage at 0.003 A | 7.500000e-1 | 7.525113e-1 | V | 0.335% | p. 2 Typical Characteristics |
| forward voltage at 0.01 A | 8.000000e-1 | 8.041249e-1 | V | 0.516% | p. 2 Typical Characteristics |
| forward voltage at 0.03 A | 8.600000e-1 | 8.580162e-1 | V | 0.231% | p. 2 Typical Characteristics |
| forward voltage at 0.1 A | 9.200000e-1 | 9.410755e-1 | V | 2.291% | p. 2 Typical Characteristics |
| forward voltage at 0.2 A | 1.020000e+0 | 1.018692e+0 | V | 0.128% | p. 2 Typical Characteristics |
| forward voltage at 0.4 A | 1.140000e+0 | 1.146223e+0 | V | 0.546% | p. 2 Typical Characteristics |

Worst fitting error: 2.291% for forward voltage at 0.1 A.

Native and WASM agreement: all 13 benches passed. Worst reported relative delta was 1.250e-15 and worst absolute delta was 8.882e-16.882e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
