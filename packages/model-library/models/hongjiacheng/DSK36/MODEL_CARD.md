# DSK36 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603186961897308160
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `e39eda5ed17f31ea54b97ae7a6626b4269b0cdab5fbf29cece112017a075e41b`
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
| IS | 3.98401183e-4 | fitted or derived |
| N | 2.38115075e+0 | fitted or derived |
| RS | 2.77413695e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.237 A | 4.000000e-1 | 4.001259e-1 | V | 0.031% | p. 2 Fig. 3, DSK35-DSK36 curve |
| forward voltage at 1.024 A | 5.000000e-1 | 5.120079e-1 | V | 2.402% | p. 2 Fig. 3, DSK35-DSK36 curve |
| forward voltage at 2.403 A | 6.000000e-1 | 6.027844e-1 | V | 0.464% | p. 2 Fig. 3, DSK35-DSK36 curve |
| forward voltage at 4.425 A | 7.000000e-1 | 6.964756e-1 | V | 0.503% | p. 2 Fig. 3, DSK35-DSK36 curve |
| forward voltage at 7.03 A | 8.000000e-1 | 7.972500e-1 | V | 0.344% | p. 2 Fig. 3, DSK35-DSK36 curve |
| forward voltage at 10.062 A | 9.000000e-1 | 9.034451e-1 | V | 0.383% | p. 2 Fig. 3, DSK35-DSK36 curve |
| forward voltage at 13.295 A | 1.000000e+0 | 1.010292e+0 | V | 1.029% | p. 2 Fig. 3, DSK35-DSK36 curve |
| forward voltage at 16.465 A | 1.100000e+0 | 1.111403e+0 | V | 1.037% | p. 2 Fig. 3, DSK35-DSK36 curve |
| forward voltage at 19.32 A | 1.200000e+0 | 1.200452e+0 | V | 0.038% | p. 2 Fig. 3, DSK35-DSK36 curve |

Worst fitting error: 2.402% for forward voltage at 1.024 A.

Native and WASM agreement: all 19 benches passed. Worst reported relative delta was 1.780e-15 and worst absolute delta was 7.216e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- The F2 current span is pulsed static-characteristic evidence and is not a continuous-current rating or safe-operating-area claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
