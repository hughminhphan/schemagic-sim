# BAV70LT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃@(Tj) 1 Pair Common Cathode 1.25V@150mA 100V 1uA@100V 200mA 225mW 6ns SOT-23 Switching Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586177058720387072
- Revision: October 2016, Rev. 12
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `8fab066589d3d1a5ba610c7f2b76f34f78025174e097f61a6562b6400ea6e3bf`
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
| IS | 7.20611724e-10 | fitted or derived |
| N | 1.66963788e+0 | fitted or derived |
| RS | 9.26250719e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1e-05 A | 4.110000e-1 | 4.119093e-1 | V | 0.221% | p. 3, Figure 2 |
| forward voltage at 0.0001 A | 5.050000e-1 | 5.114287e-1 | V | 1.273% | p. 3, Figure 2 |
| forward voltage at 0.001 A | 6.040000e-1 | 6.116995e-1 | V | 1.275% | p. 3, Figure 2 |
| forward voltage at 0.01 A | 7.210000e-1 | 7.194730e-1 | V | 0.212% | p. 3, Figure 2 |
| forward voltage at 0.1 A | 8.960000e-1 | 9.022728e-1 | V | 0.700% | p. 3, Figure 2 |

Worst fitting error: 1.275% for forward voltage at 0.001 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 5.820e-13 and worst absolute delta was 2.428e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No temperature sweep or reverse-recovery waveform was digitized; the extraction uses the minimum 25 degC curve set plus the tabulated electrical limits needed for a signal-diode F2 attempt.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
