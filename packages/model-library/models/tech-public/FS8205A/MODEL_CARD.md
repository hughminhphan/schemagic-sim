# FS8205A model card

## Identity

- Manufacturer: TECH PUBLIC
- Description: -55℃~+150℃ 1.2V 1.5W 2 N-Channel 20V 31.5mΩ@2.5V 466pF 5.7nC@4.5V 58pF 65pF 6A SOT-23-6 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588904319429459968
- Revision: not stated in supplied datasheet
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `e4795f69f664a75065594f766b93ca0a30e5ed4da513f96b9dc4752c1f0f5d0b`
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
| VTO | 7.00000000e-1 | fitted or derived |
| KP | 1.02564103e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.07250000e-2 | fitted or derived |
| RS | 3.90000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.08000000e-10 | fitted or derived |
| CGDMAX | 5.80000000e-11 | fitted or derived |
| CGDMIN | 5.80000000e-11 | fitted or derived |
| CJO | 7.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.90000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.347e-16 and worst absolute delta was 6.939e-18.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: datasheet lacks usable characteristic curves: the supplied three-page PDF contains only tables, circuit diagram, and package drawings
- The three-page supplied FS8205A datasheet contains no plotted transfer, output, or capacitance curves. It contains only electrical-characteristic tables, a circuit diagram, and package drawings, so no curve points can be extracted without inventing data.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
