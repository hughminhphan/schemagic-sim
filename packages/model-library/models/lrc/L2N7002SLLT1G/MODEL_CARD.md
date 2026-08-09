# L2N7002SLLT1G model card

## Identity

- Manufacturer: LRC
- Description: mosfet from LRC
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603392942124527616
- Revision: Rev.O Sep. 2023
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7 (disclaimer)
- SHA-256: `f2804db7bed7f80942f63901d8c1300f005fc978b8a4d75a6789f5dfe19a4063`
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
| KP | 7.14285714e-1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.54000000e+0 | fitted or derived |
| RS | 5.60000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.00000000e-11 | fitted or derived |
| CGDMAX | 5.00000000e-12 | fitted or derived |
| CGDMIN | 5.00000000e-12 | fitted or derived |
| CJO | 5.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 5.60000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 2.060e-16 and worst absolute delta was 1.110e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: family parked after 2 consecutive F2 fit-gate failures with no F2 success; later parts staged F1 (mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage))
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
