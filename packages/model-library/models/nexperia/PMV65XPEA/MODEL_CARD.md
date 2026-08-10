# PMV65XPEA model card

## Identity

- Manufacturer: Nexperia
- Description: -55℃~+150℃ 1 P-Channel 1.25V 2.8A 20V 58pF 618pF 78mΩ@4.5V 80pF 890mW 9nC@4.5V P-Channel SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588945576406343680
- Revision: PMV65XPEA v.1, 27 November 2014 (20141127), Product data sheet, (c) Nexperia B.V. 2017
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13
- SHA-256: `5b87ee8e4ee50701d1e06efdbc6e4758f236992bb0e9d41414c9bd1ccf6c4558`
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
| VTO | -1.00000000e+0 | fitted or derived |
| KP | 2.98507463e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 3.68500000e-2 | fitted or derived |
| RS | 1.34000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 5.60000000e-10 | fitted or derived |
| CGDMAX | 5.80000000e-11 | fitted or derived |
| CGDMIN | 5.80000000e-11 | fitted or derived |
| CJO | 2.20000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.34000000e-2 | fitted or derived |

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
- F2 evidence did not qualify; staged as F1: mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage)
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
