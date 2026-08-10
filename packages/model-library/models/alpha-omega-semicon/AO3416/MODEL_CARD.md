# AO3416 model card

## Identity

- Manufacturer: Alpha Omega Semicon
- Description: -55℃~+150℃ 1 N-channel 1.1V 1.4W 1.65nF 10nC@4.5V 20V 22mΩ@4.5V 6.5A 87pF SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586176348385103872
- Revision: Rev 5: July 2010
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `c8626ad2b6989041f20f84e7fab8e394bc7dc6a618ce9396dce1453cbdb6bd2b`
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
| VTO | 7.00000000e-1 | fitted or derived |
| KP | 1.25000000e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 8.80000000e-3 | fitted or derived |
| RS | 3.20000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.20800000e-9 | fitted or derived |
| CGDMAX | 8.70000000e-11 | fitted or derived |
| CGDMIN | 8.70000000e-11 | fitted or derived |
| CJO | 7.30000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.20000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 4.441e-04 and worst absolute delta was 4.441e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: THETA saturated its bound at 1; the residual is a constraint artefact; drain_current worst relative error 3.8575 exceeds gate 0.2; drain_current RMS relative error 0.9434 exceeds gate 0.12; rds_on worst relative error 0.5260 exceeds gate 0.2; rds_on RMS relative error 0.2733 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
