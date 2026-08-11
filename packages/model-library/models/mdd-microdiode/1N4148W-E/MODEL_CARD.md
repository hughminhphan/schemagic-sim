# 1N4148W-E model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: diode from MDD Microdiode Semiconductor
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8604432959751397376
- Revision: Rev:2024A1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `757312e334f92a0996e04b7354d8808ef46073ab6d0744132aec5f577319160c`
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
| IS | 2.49881357e-13 | fitted or derived |
| N | 1.17695247e+0 | fitted or derived |
| RS | 7.57294931e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0001 A | 6.000000e-1 | 6.030495e-1 | V | 0.508% | p. 2, Forward Characteristics |
| forward voltage at 0.003 A | 7.000000e-1 | 7.087844e-1 | V | 1.255% | p. 2, Forward Characteristics |
| forward voltage at 0.03 A | 8.000000e-1 | 7.993261e-1 | V | 0.084% | p. 2, Forward Characteristics |
| forward voltage at 0.12 A | 9.000000e-1 | 9.096839e-1 | V | 1.076% | p. 2, Forward Characteristics |
| forward voltage at 0.22 A | 1.000000e+0 | 1.003865e+0 | V | 0.387% | p. 2, Forward Characteristics |

Worst fitting error: 1.255% for forward voltage at 0.003 A.

Native and WASM agreement: all 16 benches passed. Worst reported relative delta was 5.762e-14 and worst absolute delta was 3.497e-14.497e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
