# US1M model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1 Independent 1.7V@1A 1A 1kV 2uA@1000V 30A 75ns SMA(DO-214AC) Fast Recovery / High Efficiency Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590905050347237376
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `a35041a8ed9d8ddd02af14288567a5826d249ded1cf1afc8cc265c3638e9aa0a`
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
| IS | 6.95062940e-10 | fitted or derived |
| N | 2.63925010e+0 | fitted or derived |
| RS | 2.08301913e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.03 A | 1.200000e+0 | 1.200737e+0 | V | 0.061% | p. 2 Fig. 3 |
| forward voltage at 0.1 A | 1.265000e+0 | 1.284383e+0 | V | 1.532% | p. 2 Fig. 3 |
| forward voltage at 1 A | 1.448000e+0 | 1.460314e+0 | V | 0.850% | p. 2 Fig. 3 |
| forward voltage at 3 A | 1.577000e+0 | 1.576970e+0 | V | 0.002% | p. 2 Fig. 3 |
| forward voltage at 10 A | 1.791000e+0 | 1.804969e+0 | V | 0.780% | p. 2 Fig. 3 |

Worst fitting error: 1.532% for forward voltage at 0.1 A.

Native and WASM agreement: all 11 benches passed. Worst reported relative delta was 2.034e-14 and worst absolute delta was 2.442e-14.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
