# FDV303N model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃ 1 N-channel 2.3nC@4.5V 25V 350mW 450mΩ@4.5V 50pF 680mA SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586175325227397120
- Revision: Rev.D2, July 2014
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `d05c24db359501fcdd6c608d86095374f21ea1d2490f8b0ea1c4c5dc5b80bccf`
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
| VTO | 8.00000000e-1 | fitted or derived |
| KP | 4.44444444e+0 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.47500000e-1 | fitted or derived |
| RS | 9.00000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.10000000e-11 | fitted or derived |
| CGDMAX | 9.00000000e-12 | fitted or derived |
| CGDMIN | 9.00000000e-12 | fitted or derived |
| CJO | 1.90000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 9.00000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 9.734e-04 and worst absolute delta was 9.734e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.6696 exceeds gate 0.2; drain_current RMS relative error 0.1723 exceeds gate 0.12; rds_on worst relative error 0.5338 exceeds gate 0.2; rds_on RMS relative error 0.2773 exceeds gate 0.12
- No curve-family omission: transfer, output, capacitance, and body-diode curves were usable and digitized. Datasheet omissions include trr/Qrr, RθJC, and separate schema fields for gate charge and temperature-dependent curves.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
