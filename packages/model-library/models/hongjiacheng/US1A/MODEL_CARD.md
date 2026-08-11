# US1A model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1 Independent 1A 1V@1A 30A 50V 50ns 5uA@50V SMA(DO-214AC) Fast Recovery / High Efficiency Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590908187099156480
- Revision: Rev. 1.1
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
| IS | 3.65789464e-12 | fitted or derived |
| N | 1.07128234e+0 | fitted or derived |
| RS | 1.14789389e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 6.000000e-1 | 6.021946e-1 | V | 0.366% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 0.1 A | 6.600000e-1 | 6.670291e-1 | V | 1.065% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 1 A | 7.300000e-1 | 7.411617e-1 | V | 1.529% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 3 A | 8.000000e-1 | 7.945606e-1 | V | 0.680% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 10 A | 9.000000e-1 | 9.082736e-1 | V | 0.919% | p. 2, Fig. 3 Typical Forward Voltage |

Worst fitting error: 1.529% for forward voltage at 1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 1.227e-14 and worst absolute delta was 7.438e-15.438e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
