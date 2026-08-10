# ST3422A model card

## Identity

- Manufacturer: STANSON Tech
- Description: -55℃~+150℃ 1 N-channel 10nC@10V 243pF 28mΩ@10V、38mΩ@4.5V 2W 38pF 3V 455pF 60V 6A N-Channel SOT-23-3L MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588907496194904064
- Revision: STN3422A 2009. V1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `4cc35a120bb955b7e2fefe976005b81a0278dc2e3855c49381475d2906b130a2`
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
| KP | 7.14285714e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.54000000e-2 | fitted or derived |
| RS | 5.60000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.17000000e-10 | fitted or derived |
| CGDMAX | 3.80000000e-11 | fitted or derived |
| CGDMIN | 3.80000000e-11 | fitted or derived |
| CJO | 2.05000000e-10 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 5.60000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 5.478e-16 and worst absolute delta was 4.163e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: THETA saturated its bound at 1; the residual is a constraint artefact; drain_current worst relative error 1.1694 exceeds gate 0.2; drain_current RMS relative error 0.4764 exceeds gate 0.12; rds_on worst relative error 0.2022 exceeds gate 0.2
- No omission for the required MOSFET fields; threshold_typ is null because the datasheet provides only MIN and MAX, and body-diode reverse recovery is not published.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
