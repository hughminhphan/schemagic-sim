# AO4882 model card

## Identity

- Manufacturer: TECH PUBLIC
- Description: -50℃~+150℃ 1.45nF 140pF 2 N-Channel 2.5V 21.6nC@10V 220pF 25mΩ@4.5V 2W 40V 8A SOP-8 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590234931319644160
- Revision: undated
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `b110fcf2068887432d33f8e527e7587e94b0003b8e2e899d2d47618634533963`
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
| VTO | 1.60000000e+0 | fitted or derived |
| KP | 1.11111111e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 9.90000000e-3 | fitted or derived |
| RS | 3.60000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 6.15000000e-10 | fitted or derived |
| CGDMAX | 1.09000000e-10 | fitted or derived |
| CGDMIN | 1.09000000e-10 | fitted or derived |
| CJO | 1.00000000e-15 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.60000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 2.091e-16 and worst absolute delta was 1.388e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage)
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
