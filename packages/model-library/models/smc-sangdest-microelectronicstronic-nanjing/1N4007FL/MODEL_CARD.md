# 1N4007FL model card

## Identity

- Manufacturer: SMC Sangdest Microelectronicstronic Nanjing
- Description: -65℃~+150℃ 1.1V@1A 1A 1kV 30A 5uA@1kV Independent SOD-123FL Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588906377209393152
- Revision: Data Sheet N1646, Rev. A
- Accessed: 2026-08-23
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `8face366b9dc82c43e6423ecbfd0fa3fe73f9a0c9eeb7b0b956c5c16d6b7f7de`
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
| IS | 5.88227249e-6 | evidence-derived (curve-fitted) |
| N | 3.10743726e+0 | evidence-derived (curve-fitted) |
| RS | 1.45165070e-2 | evidence-derived (curve-fitted) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.02 A | 6.600000e-1 | 6.574299e-1 | V | 0.389% | p. 2, Fig. 3 |
| forward voltage at 0.05 A | 7.200000e-1 | 7.310075e-1 | V | 1.529% | p. 2, Fig. 3 |
| forward voltage at 0.1 A | 7.700000e-1 | 7.870686e-1 | V | 2.217% | p. 2, Fig. 3 |
| forward voltage at 0.2 A | 8.300000e-1 | 8.438576e-1 | V | 1.670% | p. 2, Fig. 3 |
| forward voltage at 0.5 A | 9.000000e-1 | 9.213661e-1 | V | 2.374% | p. 2, Fig. 3 |
| forward voltage at 1 A | 9.800000e-1 | 9.839635e-1 | V | 0.404% | p. 2, Fig. 3 |
| forward voltage at 2 A | 1.060000e+0 | 1.053819e+0 | V | 0.583% | p. 2, Fig. 3 |
| forward voltage at 5 A | 1.170000e+0 | 1.170524e+0 | V | 0.045% | p. 2, Fig. 3 |
| forward voltage at 10 A | 1.300000e+0 | 1.298446e+0 | V | 0.120% | p. 2, Fig. 3 |
| forward voltage at 20 A | 1.480000e+0 | 1.498950e+0 | V | 1.280% | p. 2, Fig. 3 |

Worst fitting error: 2.374% for forward voltage at 0.5 A.

Native and WASM agreement: all 11 benches passed. Worst reported relative delta was 6.532e-13 and worst absolute delta was 4.296e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
