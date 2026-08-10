# DMG2302UK model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -55℃~+150℃ 1 N-channel 1.4nC@4.5V 130pF 18pF 1V 2.8A 20V 660mW 90mΩ@4.5V SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588885238898024449
- Revision: Document number DS38439 Rev. 2 - 2, January 2016
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `cfba50cf0e4fadaf25d1815319c5c4e02216feb567ebc966aaccfad816658875`
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
| VTO | 6.00000000e-1 | fitted or derived |
| KP | 3.27868852e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 3.35500000e-2 | fitted or derived |
| RS | 1.22000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.12000000e-10 | fitted or derived |
| CGDMAX | 1.80000000e-11 | fitted or derived |
| CGDMIN | 1.80000000e-11 | fitted or derived |
| CJO | 8.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.22000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 2.876e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: THETA saturated its bound at 1; the residual is a constraint artefact; LAMBDA saturated its bound at 0.2; the residual is a constraint artefact; drain_current worst relative error 0.8003 exceeds gate 0.2; drain_current RMS relative error 0.2714 exceeds gate 0.12; rds_on worst relative error 0.3600 exceeds gate 0.2; rds_on RMS relative error 0.2102 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
