# AP3003 model card

## Identity

- Manufacturer: ALLPOWER ShenZhen Quan Li Semiconductor
- Description: -55℃~+150℃ 1 N-Channel + 1 P-Channel 1.5V 1.7W 30V 38mΩ@4.5V 4.8nC@4.5V 5.8A 52pF 66pF 700pF N-Channel + P-Channel SOT-23-6 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588954565568319489
- Revision: V1.0, 2023/03/17
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8, p. 9, p. 10, p. 11
- SHA-256: `afc3cb3f080cf3a47b2988a0f0061bd35ed9e267c53043294d9983ac90f09df6`
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
| VTO | 1.00000000e+0 | fitted or derived |
| KP | 8.33333333e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.32000000e-2 | fitted or derived |
| RS | 4.80000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 6.48000000e-10 | fitted or derived |
| CGDMAX | 5.20000000e-11 | fitted or derived |
| CGDMIN | 5.20000000e-11 | fitted or derived |
| CJO | 1.40000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 4.80000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 0.000e+00 and worst absolute delta was 0.000e+00.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: THETA saturated its bound at 1; the residual is a constraint artefact; drain_current worst relative error 2.2616 exceeds gate 0.2; drain_current RMS relative error 1.2208 exceeds gate 0.12; rds_on worst relative error 0.6953 exceeds gate 0.2; rds_on RMS relative error 0.6072 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
