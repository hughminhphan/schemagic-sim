# 1N4007G model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: -65℃~+150℃ 1 Independent 1.1V@1A 1A 1kV 30A 5uA@1kV DO-41 Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: independent-package-review-batch-10 (2026-08-12)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588887223848603648
- Revision: Rev: 2024A2
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2
- SHA-256: `64db856803cb6fdac9f6ef2df119b71098d5e4dfe2adf102378f10c5746cfe28`
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
| IS | 6.04432642e-6 | fitted or derived |
| N | 3.17987747e+0 | fitted or derived |
| RS | 1.76142562e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 6.000000e-1 | 6.136235e-1 | V | 2.271% | p. 2, Fig. 3 |
| forward voltage at 0.03 A | 7.000000e-1 | 7.037017e-1 | V | 0.529% | p. 2, Fig. 3 |
| forward voltage at 0.1 A | 8.000000e-1 | 8.032879e-1 | V | 0.411% | p. 2, Fig. 3 |
| forward voltage at 0.3 A | 9.000000e-1 | 8.965635e-1 | V | 0.382% | p. 2, Fig. 3 |
| forward voltage at 1 A | 1.000000e+0 | 1.007256e+0 | V | 0.726% | p. 2, Fig. 3 |
| forward voltage at 3 A | 1.100000e+0 | 1.132240e+0 | V | 2.931% | p. 2, Fig. 3 |
| forward voltage at 5 A | 1.200000e+0 | 1.209203e+0 | V | 0.767% | p. 2, Fig. 3 |
| forward voltage at 8 A | 1.300000e+0 | 1.300444e+0 | V | 0.034% | p. 2, Fig. 3 |
| forward voltage at 12 A | 1.400000e+0 | 1.404027e+0 | V | 0.288% | p. 2, Fig. 3 |

Worst fitting error: 2.931% for forward voltage at 3 A.

Native and WASM agreement: all 10 checks passed. Worst reported relative delta was 3.257e-14 and worst absolute delta was 1.998e-14.998e-14.

## Known omissions

- F2 forward-current scope is limited to pulse width 300 us, 1% duty cycle at 25 degC; continuous-current and self-heating behavior are not claimed.

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- Independent review approved this staged candidate for promotion eligibility; no promotion was performed during review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
