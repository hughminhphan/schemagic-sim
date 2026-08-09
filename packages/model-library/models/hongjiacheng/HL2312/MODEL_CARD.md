# HL2312 model card

## Identity

- Manufacturer: hongjiacheng
- Description: mosfet from hongjiacheng
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879732451147776
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `dc9fbbd295ab338ef187e9bbe46e54562b5d5259dfb4805f59bdb1003c0b64b4`
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
| VTO | 6.20000000e-1 | fitted or derived |
| KP | 1.02564103e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.07250000e-2 | fitted or derived |
| RS | 3.90000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.48000000e-10 | fitted or derived |
| CGDMAX | 7.00000000e-11 | fitted or derived |
| CGDMIN | 7.00000000e-11 | fitted or derived |
| CJO | 1.20000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.90000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 4.441e-04 and worst absolute delta was 4.441e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 1.2095 exceeds gate 0.2; drain_current RMS relative error 0.4172 exceeds gate 0.12; rds_on RMS relative error 0.1242 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
