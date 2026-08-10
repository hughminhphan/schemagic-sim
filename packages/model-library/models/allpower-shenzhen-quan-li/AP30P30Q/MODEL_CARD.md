# AP30P30Q model card

## Identity

- Manufacturer: ALLPOWER ShenZhen Quan Li Semiconductor
- Description: -55℃~+150℃ 1 P-Channel 1.5W 10mΩ@5V 2.15nF 30A 30V 320pF 35nC@10V 800mV PDFN3333-8 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588920801022525440
- Revision: v1.0
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4
- SHA-256: `4350db66feb8fbee9f8ffdb9d6291bee32316bd4047eb36cf5b3526ca9261862`
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
| VTO | 2.00000000e+0 | fitted or derived |
| KP | 2.00000000e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 5.50000000e-3 | fitted or derived |
| RS | 2.00000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.83000000e-9 | fitted or derived |
| CGDMAX | 3.20000000e-10 | fitted or derived |
| CGDMIN | 3.20000000e-10 | fitted or derived |
| CJO | 1.10000000e-10 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.00000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 1.826e-16 and worst absolute delta was 1.388e-17.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 8.5767 exceeds gate 0.2; drain_current RMS relative error 3.5469 exceeds gate 0.12; rds_on worst relative error 0.3372 exceeds gate 0.2; rds_on RMS relative error 0.1973 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
