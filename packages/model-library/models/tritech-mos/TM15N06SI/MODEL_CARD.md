# TM15N06SI model card

## Identity

- Manufacturer: Tritech MOS
- Description: 1 N-channel 1.148nF 1.6V 15A 20.3nC@10V 30mΩ@10V 49.4pF 60V SOT-89-3L MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590903799635009536
- Revision: 2018 datasheet; supplied PDF
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `67ae4b61001c0adb5ae18ebba2c67b3b6adaac72ab7387f30cb8c5fb672968cb`
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
| KP | 6.66666667e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.65000000e-2 | fitted or derived |
| RS | 6.00000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.09860000e-9 | fitted or derived |
| CGDMAX | 4.94000000e-11 | fitted or derived |
| CGDMIN | 4.94000000e-11 | fitted or derived |
| CJO | 9.10000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 6.00000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.143e-16 and worst absolute delta was 1.388e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 2.0280 exceeds gate 0.2; drain_current RMS relative error 0.7146 exceeds gate 0.12; rds_on worst relative error 0.5979 exceeds gate 0.2; rds_on RMS relative error 0.4417 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
