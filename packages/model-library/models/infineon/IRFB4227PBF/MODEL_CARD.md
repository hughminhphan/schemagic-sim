# IRFB4227PBF model card

## Identity

- Manufacturer: Infineon Technologies
- Description: -40℃~+175℃ 1 N-channel 200V 24mΩ@10V 330W 4.6nF 5V 65A 91pF 98nC@10V TO-220AB MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588887123156353024
- Revision: 09/10/07
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4, 5
- SHA-256: `24c25a389825ead7e9595904bbab8daa71ef8a67002d6bdc19b7f674814998f0`
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
| VTO | 5.00000000e+0 | fitted or derived |
| KP | 1.01522843e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.08350000e-2 | fitted or derived |
| RS | 3.94000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.50900000e-9 | fitted or derived |
| CGDMAX | 9.10000000e-11 | fitted or derived |
| CGDMIN | 9.10000000e-11 | fitted or derived |
| CJO | 3.69000000e-10 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.94000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.435e-16 and worst absolute delta was 1.110e-16.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 1.7576 exceeds gate 0.2; drain_current RMS relative error 1.0090 exceeds gate 0.12; rds_on RMS relative error 0.1283 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
