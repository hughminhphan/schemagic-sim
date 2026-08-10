# AP9926 model card

## Identity

- Manufacturer: ALLPOWER ShenZhen Quan Li Semiconductor
- Description: -55℃~+150℃ 1.5V 10nC@4.5V 175pF 2 N-Channel 20V 24mΩ@4.5V 2W 6.5A 700pF 85pF N-Channel SOP-8 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588884285843779584
- Revision: v1.0
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4
- SHA-256: `e3641127732a645b7e89ed648ab234a8bb59fac91e3a81d5f84612955f3fbbee`
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
| KP | 9.30232558e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.18250000e-2 | fitted or derived |
| RS | 4.30000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 6.15000000e-10 | fitted or derived |
| CGDMAX | 8.50000000e-11 | fitted or derived |
| CGDMIN | 8.50000000e-11 | fitted or derived |
| CJO | 9.00000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 4.30000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.112e-16 and worst absolute delta was 1.388e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet extraction cannot support an F2 fit: only 4 usable transfer/output points after validation; 5 required
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
