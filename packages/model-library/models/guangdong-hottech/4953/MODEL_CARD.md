# 4953 model card

## Identity

- Manufacturer: Guangdong Hottech
- Description: -55℃~+150℃ 1.1V 11nC@10V 2 P-Channel 2.5W 30V 5.1A 520pF 55mΩ@10V 70pF SO-8 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588905223956148224
- Revision: unspecified
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3
- SHA-256: `a3e9f47bdf109d50fab65d57d74e4fd696c4f2cb21f264177c172d20c6170676`
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
| KP | 4.65116279e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.36500000e-2 | fitted or derived |
| RS | 8.60000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.50000000e-10 | fitted or derived |
| CGDMAX | 7.00000000e-11 | fitted or derived |
| CGDMIN | 7.00000000e-11 | fitted or derived |
| CJO | 6.00000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 8.60000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.664e-16 and worst absolute delta was 2.776e-17.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 3.6162 exceeds gate 0.2; drain_current RMS relative error 2.2469 exceeds gate 0.12; rds_on worst relative error 0.4646 exceeds gate 0.2; rds_on RMS relative error 0.2449 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
