# CJE3134K model card

## Identity

- Manufacturer: Jiangsu Changjing Electronics Technology Co Ltd
- Description: -55℃~+150℃ 1 N-channel 120pF 150mW 15pF 20V 350mV 380mΩ@4.5V 750mA SOT-523 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588912679817777152
- Revision: Rev. - 1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `eb3d938b9ac47612380b41c29e21d1f84b35f8fd256c698d526abb2ad77d002f`
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
| VTO | 1.10000000e+0 | fitted or derived |
| KP | 5.26315789e+0 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.09000000e-1 | fitted or derived |
| RS | 7.60000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.05000000e-10 | fitted or derived |
| CGDMAX | 1.50000000e-11 | fitted or derived |
| CGDMIN | 1.50000000e-11 | fitted or derived |
| CJO | 5.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 7.60000000e-2 | fitted or derived |

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
- F2 evidence did not qualify; staged as F1: family parked after 2 consecutive F2 fit-gate failures with no F2 success; later parts staged F1 (mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage))
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
