# AO4468 model card

## Identity

- Manufacturer: Alpha Omega Semicon
- Description: -55℃~+150℃ 1 N-channel 1.2V 10.5A 115pF 15nC@10V 17mΩ@10V 3.1W 30V 888pF SOIC-8 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586196556965535744
- Revision: Rev.7.0: July 2013
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `df26e06a8d4c952142981db54616700aaf9f010b020e69b1e264b144a16559c0`
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
| VTO | 1.80000000e+0 | fitted or derived |
| KP | 1.42857143e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 7.70000000e-3 | fitted or derived |
| RS | 2.80000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 6.58000000e-10 | fitted or derived |
| CGDMAX | 8.20000000e-11 | fitted or derived |
| CGDMIN | 8.20000000e-11 | fitted or derived |
| CJO | 2.80000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.80000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 0.000e+00 and worst absolute delta was 0.000e+00.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 3.3859 exceeds gate 0.2; drain_current RMS relative error 1.3522 exceeds gate 0.12; rds_on worst relative error 1.2754 exceeds gate 0.2; rds_on RMS relative error 1.2695 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
