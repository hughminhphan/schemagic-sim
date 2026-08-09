# SS36-E3/57T model card

## Identity

- Manufacturer: Vishay Intertech
- Description: -55℃~+150℃ 1 Independent 100A 3A 500uA@60V 60V 750mV@3A SMC(DO-214AB) Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8579707595575525376
- Revision: 04-Aug-15
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `218ec1c8c9977510a599e00b97da1475544f4a1c1db7ef1f678bb6591108e9e5`
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
| IS | 3.37243176e-6 | fitted or derived |
| N | 1.21731513e+0 | fitted or derived |
| RS | 1.06543726e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 2.500000e-1 | 2.518365e-1 | V | 0.735% | p. 3, Fig. 3 |
| forward voltage at 0.05 A | 3.000000e-1 | 3.029286e-1 | V | 0.976% | p. 3, Fig. 3 |
| forward voltage at 0.2 A | 3.500000e-1 | 3.481737e-1 | V | 0.522% | p. 3, Fig. 3 |
| forward voltage at 1 A | 4.000000e-1 | 4.073711e-1 | V | 1.843% | p. 3, Fig. 3 |
| forward voltage at 5 A | 5.000000e-1 | 5.006629e-1 | V | 0.133% | p. 3, Fig. 3 |
| forward voltage at 12 A | 6.000000e-1 | 6.028083e-1 | V | 0.468% | p. 3, Fig. 3 |
| forward voltage at 20 A | 7.000000e-1 | 7.041270e-1 | V | 0.590% | p. 3, Fig. 3 |

Worst fitting error: 1.843% for forward voltage at 1 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 5.205e-14 and worst absolute delta was 1.343e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
