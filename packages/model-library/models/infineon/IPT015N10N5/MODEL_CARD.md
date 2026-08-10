# IPT015N10N5 model card

## Identity

- Manufacturer: Infineon Technologies
- Description: -55℃~+175℃ 1 N-channel 100V 140pF 16nF 2.3nF 211nC@10V 2mΩ@6V 3.8V 300A 375W N-Channel HSOF-8 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588886840707321856
- Revision: Rev. 2.2, 2016-10-13
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 3, p. 4, p. 5, p. 7, p. 8, p. 9
- SHA-256: `db68d3ca33e7cb7b353cf74c42b8d0eeda30d5571381d0312b40a6552bd1b1a1`
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
| VTO | 3.00000000e+0 | fitted or derived |
| KP | 1.53846154e+3 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 7.15000000e-4 | fitted or derived |
| RS | 2.60000000e-4 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.19200000e-8 | fitted or derived |
| CGDMAX | 8.00000000e-11 | fitted or derived |
| CGDMIN | 8.00000000e-11 | fitted or derived |
| CJO | 1.72000000e-9 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.60000000e-4 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 3.467e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.7030 exceeds gate 0.2; drain_current RMS relative error 0.1754 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
