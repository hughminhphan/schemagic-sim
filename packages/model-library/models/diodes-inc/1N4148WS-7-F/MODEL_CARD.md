# 1N4148WS-7-F model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -65℃~+150℃@(Tj) 1.25V@150mA 150mA 1uA@75V 4ns 75V Standalone SOD-323 Switching Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8560101323753480192
- Revision: DS30097 Rev. 28 - 2, September 2024
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `2b40c7950fc9b288430f7184ceb50b675d57f0a662b4c03307e55479f16d1d96`
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
| IS | 6.12704930e-9 | fitted or derived |
| N | 1.90832391e+0 | fitted or derived |
| RS | 1.17324494e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0015 A | 6.120000e-1 | 6.142150e-1 | V | 0.362% | p. 3 Fig. 2 |
| forward voltage at 0.003 A | 6.440000e-1 | 6.501876e-1 | V | 0.961% | p. 3 Fig. 2 |
| forward voltage at 0.012 A | 7.210000e-1 | 7.291723e-1 | V | 1.133% | p. 3 Fig. 2 |
| forward voltage at 0.03 A | 7.950000e-1 | 7.955176e-1 | V | 0.065% | p. 3 Fig. 2 |
| forward voltage at 0.12 A | 9.630000e-1 | 9.695352e-1 | V | 0.679% | p. 3 Fig. 2 |

Worst fitting error: 1.133% for forward voltage at 0.012 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 3.158e-15 and worst absolute delta was 1.887e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
