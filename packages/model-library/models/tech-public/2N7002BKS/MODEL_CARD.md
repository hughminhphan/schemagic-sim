# 2N7002BKS model card

## Identity

- Manufacturer: TECH PUBLIC
- Description: -55℃~+150℃ 18pF 2 N-Channel 2.5V 2.5Ω@10V 27pF 2pF 300mA 350mW 3nC@10V 60V N-Channel SOT-363 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588947557644423168
- Revision: Revision not stated
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `2c4ad02d04d6e617e24f5a492fd7460276289af722501e13950bffb3461dd2ab`
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
| KP | 8.88888889e-1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.23750000e+0 | fitted or derived |
| RS | 4.50000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.50000000e-11 | fitted or derived |
| CGDMAX | 2.00000000e-12 | fitted or derived |
| CGDMIN | 2.00000000e-12 | fitted or derived |
| CJO | 1.60000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 4.50000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 1.010e-19 and worst absolute delta was 1.010e-28.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: No usable electrical characteristic curves are present; the supplied 3-page datasheet contains only ratings, electrical-characteristics tables, switching values, and package drawings.
- No usable electrical characteristic curves are present; the supplied 3-page datasheet contains only ratings, electrical-characteristics tables, switching values, and package drawings.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
