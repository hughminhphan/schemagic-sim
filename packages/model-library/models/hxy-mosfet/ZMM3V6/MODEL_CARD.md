# ZMM3V6 model card

## Identity

- Manufacturer: HXY MOSFET
- Description: 1 Independent 2uA@1V 3.4V~3.8V 3.6V 500mW 600Ω 85Ω LL-34 Zener Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590905485262872576
- Revision: Not stated in datasheet
- Accessed: 2026-08-23
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `100680ae1448abd548854f89810b37060806f39ea7c10ee215668bb874b89e9b`
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
| IS | 7.98820585e-14 | evidence-derived (curve-fitted) |
| N | 1.05616213e+0 | evidence-derived (curve-fitted) |
| RS | 1.26147104e+0 | evidence-derived (curve-fitted) |
| BV | 3.60000000e+0 | fitted or derived |
| IBV | 5.00000000e-3 | fitted or derived |
| NBV | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1e-06 A | 4.500000e-1 | 4.513687e-1 | V | 0.304% | p. 4, Forward characteristics |
| forward voltage at 1e-05 A | 5.000000e-1 | 5.138727e-1 | V | 2.775% | p. 4, Forward characteristics |
| forward voltage at 0.0001 A | 5.600000e-1 | 5.764693e-1 | V | 2.941% | p. 4, Forward characteristics |
| forward voltage at 0.001 A | 6.300000e-1 | 6.400867e-1 | V | 1.601% | p. 4, Forward characteristics |
| forward voltage at 0.01 A | 7.200000e-1 | 7.139218e-1 | V | 0.844% | p. 4, Forward characteristics |
| forward voltage at 0.1 A | 8.800000e-1 | 8.899360e-1 | V | 1.129% | p. 4, Forward characteristics |

Worst fitting error: 2.941% for forward voltage at 0.0001 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 4.492e-13 and worst absolute delta was 2.308e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
