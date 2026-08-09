# BAV70 model card

## Identity

- Manufacturer: Nexperia
- Description: 1 Pair Common Cathode 1.25V@150mA 100V 215mA 250mW 4A 4ns 500nA@80V SOT-23 Switching Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8579710807724523520
- Revision: BAV70 v0.9, 1 July 2022
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8, p. 9, p. 10
- SHA-256: `8af3a1214cc19d081bd8604ed1cdb98dc83dbb5a91bbdfba3663484a78450108`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 2.39118946e-8 | fitted or derived |
| N | 2.27734325e+0 | fitted or derived |
| RS | 7.73135175e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0007 A | 6.000000e-1 | 6.063317e-1 | V | 1.055% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.0035 A | 7.000000e-1 | 7.032961e-1 | V | 0.471% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.015 A | 8.000000e-1 | 7.979081e-1 | V | 0.261% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.055 A | 9.000000e-1 | 9.053655e-1 | V | 0.596% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.13 A | 1.000000e+0 | 1.014019e+0 | V | 1.402% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.32 A | 1.200000e+0 | 1.213974e+0 | V | 1.165% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.52 A | 1.400000e+0 | 1.397199e+0 | V | 0.200% | p. 4, Fig. 1, curve (3) |

Worst fitting error: 1.402% for forward voltage at 0.13 A.

Native and WASM agreement: all 12 benches passed. Worst reported relative delta was 1.565e-14 and worst absolute delta was 9.548e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No reverse-breakdown voltage/current pair is published, so breakdown data is omitted. No typical tabulated electrical values are provided; typical behavior is available only from the plotted curves.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
