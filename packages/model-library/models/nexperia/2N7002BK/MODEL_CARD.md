# 2N7002BK model card

## Identity

- Manufacturer: Nexperia
- Description: -55℃~+150℃ 1 N-channel 1.6Ω@10V 2.1V 350mA 370mW 4pF 50pF 600pC@4.5V 60V N-Channel SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588884569717657600
- Revision: Rev. 1 — 17 June 2010
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 6, p. 7, p. 8, p. 9, p. 13
- SHA-256: `f6871b60a8a08e23dbe08ac657c903e1c85e6fb0e89e3e5a6298eda3568c7c4d`
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
| KP | 1.53846154e+0 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 7.15000000e-1 | fitted or derived |
| RS | 2.60000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.90000000e-11 | fitted or derived |
| CGDMAX | 4.00000000e-12 | fitted or derived |
| CGDMIN | 4.00000000e-12 | fitted or derived |
| CJO | 3.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.60000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.191e-16 and worst absolute delta was 6.939e-18.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.6996 exceeds gate 0.2; drain_current RMS relative error 0.2828 exceeds gate 0.12; rds_on worst relative error 0.4812 exceeds gate 0.2; rds_on RMS relative error 0.2896 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
