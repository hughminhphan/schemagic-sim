# M7 model card

## Identity

- Manufacturer: Yangzhou Yangjie Elec Tech
- Description: -55℃~+150℃ 1.1V@1A 1A 1kV 30A 5uA@1kV Independent SMA(DO-214AC) Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: independent-package-review-batch-10 (2026-08-12)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588905132926898176
- Revision: Rev.1.3, 08-Nov-18
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `8d3bf7bc63a41254be4a7c4c5ba451fdf08b7ea2fa8aa716d71648031ce3c66c`
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
| IS | 4.67791389e-8 | fitted or derived |
| N | 2.10850354e+0 | fitted or derived |
| RS | 2.78400866e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.05 A | 7.500000e-1 | 7.613367e-1 | V | 1.512% | p. 3, Fig. 3 |
| forward voltage at 0.1 A | 8.000000e-1 | 8.002785e-1 | V | 0.035% | p. 3, Fig. 3 |
| forward voltage at 0.65 A | 9.000000e-1 | 9.169914e-1 | V | 1.888% | p. 3, Fig. 3 |
| forward voltage at 1.8 A | 1.000000e+0 | 1.004186e+0 | V | 0.419% | p. 3, Fig. 3 |
| forward voltage at 6.5 A | 1.200000e+0 | 1.204594e+0 | V | 0.383% | p. 3, Fig. 3 |
| forward voltage at 12.5 A | 1.400000e+0 | 1.407059e+0 | V | 0.504% | p. 3, Fig. 3 |
| forward voltage at 19 A | 1.600000e+0 | 1.610702e+0 | V | 0.669% | p. 3, Fig. 3 |

Worst fitting error: 1.888% for forward voltage at 0.65 A.

Native and WASM agreement: all 9 checks passed. Worst reported relative delta was 8.458e-15 and worst absolute delta was 6.439e-15.439e-15.

## Known omissions

- F2 forward-current scope is limited to pulse width 300 us, 1% duty cycle at 25 degC; continuous-current and self-heating behavior are not claimed.

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- Independent review approved this staged candidate for promotion eligibility; no promotion was performed during review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
