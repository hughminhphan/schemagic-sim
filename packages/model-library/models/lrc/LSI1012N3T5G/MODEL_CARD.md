# LSI1012N3T5G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 N-channel 1.25Ω@1.8V 20V 250mW 43.5pF 5.8pF 5.8pF 500mA 750pC@4.5V 900mV N-Channel SOT-883-3 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8589040973859475456
- Revision: Rev.D May. 2021
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `db2d182a5f1f7f3590e2c026fe94605eb0e687ddeae1ce8501f0779cc7d3b29a`
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
| VTO | 9.00000000e-1 | fitted or derived |
| KP | 4.87804878e+0 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.25500000e-1 | fitted or derived |
| RS | 8.20000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.77000000e-11 | fitted or derived |
| CGDMAX | 5.80000000e-12 | fitted or derived |
| CGDMIN | 5.80000000e-12 | fitted or derived |
| CJO | 1.00000000e-15 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 8.20000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.262e-20 and worst absolute delta was 1.262e-29.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.6727 exceeds gate 0.2; drain_current RMS relative error 0.3458 exceeds gate 0.12; rds_on worst relative error 0.5608 exceeds gate 0.2; rds_on RMS relative error 0.3735 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
