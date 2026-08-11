# 1N4148WS-E model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: diode from MDD Microdiode Semiconductor
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8604432959844077568
- Revision: Rev:2024A1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `0e7a780941daf716efccb8e5b3ff81879235eaac6c8d59413c4a710ddd40c268`
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
| IS | 1.86361147e-12 | fitted or derived |
| N | 1.05416150e+0 | fitted or derived |
| RS | 1.46639282e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1e-05 A | 4.200000e-1 | 4.225129e-1 | V | 0.598% | p. 2 Typical Characteristics |
| forward voltage at 0.0001 A | 4.800000e-1 | 4.854277e-1 | V | 1.131% | p. 2 Typical Characteristics |
| forward voltage at 0.001 A | 5.500000e-1 | 5.495294e-1 | V | 0.086% | p. 2 Typical Characteristics |
| forward voltage at 0.01 A | 6.200000e-1 | 6.255088e-1 | V | 0.889% | p. 2 Typical Characteristics |
| forward voltage at 0.05 A | 7.200000e-1 | 7.280471e-1 | V | 1.118% | p. 2 Typical Characteristics |
| forward voltage at 0.1 A | 8.200000e-1 | 8.202659e-1 | V | 0.032% | p. 2 Typical Characteristics |
| forward voltage at 0.2 A | 9.800000e-1 | 9.858044e-1 | V | 0.592% | p. 2 Typical Characteristics |

Worst fitting error: 1.131% for forward voltage at 0.0001 A.

Native and WASM agreement: all 18 benches passed. Worst reported relative delta was 1.332e-13 and worst absolute delta was 5.695e-14.695e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
