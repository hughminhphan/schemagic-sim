# 50N06 model card

## Identity

- Manufacturer: HL
- Description: mosfet from HL
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603099024539480064
- Revision: Version 1.1
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4
- SHA-256: `ccc6c0cf6ce2c7d5c3a81b17e8061b02662e6ece372172e930ffbaa089bd84fc`
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
| VTO | 2.50000000e+0 | fitted or derived |
| KP | 2.32558140e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 4.73000000e-3 | fitted or derived |
| RS | 1.72000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.29500000e-9 | fitted or derived |
| CGDMAX | 1.16000000e-10 | fitted or derived |
| CGDMIN | 1.16000000e-10 | fitted or derived |
| CJO | 8.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.72000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.615e-16 and worst absolute delta was 6.939e-18.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.8192 exceeds gate 0.2; drain_current RMS relative error 0.3626 exceeds gate 0.12; rds_on worst relative error 0.3367 exceeds gate 0.2; rds_on RMS relative error 0.2198 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
