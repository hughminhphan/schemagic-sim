# 20N06 model card

## Identity

- Manufacturer: UMW Youtai Semiconductor Co Ltd
- Description: -55℃~+150℃ 1 N-channel 1.562nF 1.6V 20A 23mΩ@10V、29mΩ@4.5V 25nC@10V 55W 60V 66.8pF 75.4pF N-Channel TO-252 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8755874484567838720
- Revision: Nov. 2024
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8, p. 9, p. 10
- SHA-256: `2d94cb14e13c42bfa28c18e599f0d705dccd98d9cf8b1115ea6e5ecbe0f3a428`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | 1.60000000e+0 | fitted or derived |
| KP | 6.34920635e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.73250000e-2 | fitted or derived |
| RS | 6.30000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.49520000e-9 | fitted or derived |
| CGDMAX | 6.68000000e-11 | fitted or derived |
| CGDMIN | 6.68000000e-11 | fitted or derived |
| CJO | 8.60000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 6.30000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 1.451e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 14.3507 exceeds gate 0.2; drain_current RMS relative error 7.7854 exceeds gate 0.12
- No omission for curve extraction; gate-charge, reverse-recovery charge/time, and thermal fields are not represented by the strict extraction schema.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
