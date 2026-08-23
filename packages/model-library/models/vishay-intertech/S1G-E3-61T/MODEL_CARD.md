# S1G-E3/61T model card

## Identity

- Manufacturer: Vishay Intertech
- Description: -55℃~+150℃ 1 Independent 1.1V@1A 1A 1uA@400V 400V 40A SMA(DO-214AC) Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588936142682644480
- Revision: Revision: 31-Jul-2018, Document Number: 88711
- Accessed: 2026-08-23
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `7eb8c9e605317677d53c7d3a6b6ce34c40f9f160135e072b72465b81b515747c`
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
| IS | 2.16542278e-7 | evidence-derived (curve-fitted) |
| N | 2.40271242e+0 | evidence-derived (curve-fitted) |
| RS | 3.28771225e-2 | evidence-derived (curve-fitted) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 6.800000e-1 | 6.712608e-1 | V | 1.285% | p. 3, Fig. 3 |
| forward voltage at 0.02 A | 7.100000e-1 | 7.143783e-1 | V | 0.617% | p. 3, Fig. 3 |
| forward voltage at 0.05 A | 7.500000e-1 | 7.719286e-1 | V | 2.924% | p. 3, Fig. 3 |
| forward voltage at 0.1 A | 7.900000e-1 | 8.163616e-1 | V | 3.337% | p. 3, Fig. 3 |
| forward voltage at 0.2 A | 8.400000e-1 | 8.624385e-1 | V | 2.671% | p. 3, Fig. 3 |
| forward voltage at 0.5 A | 9.100000e-1 | 9.288659e-1 | V | 2.073% | p. 3, Fig. 3 |
| forward voltage at 1 A | 1.000000e+0 | 9.880937e-1 | V | 1.191% | p. 3, Fig. 3 |
| forward voltage at 2 A | 1.090000e+0 | 1.063760e+0 | V | 2.407% | p. 3, Fig. 3 |
| forward voltage at 5 A | 1.220000e+0 | 1.218956e+0 | V | 0.086% | p. 3, Fig. 3 |
| forward voltage at 10 A | 1.400000e+0 | 1.426131e+0 | V | 1.866% | p. 3, Fig. 3 |

Worst fitting error: 3.337% for forward voltage at 0.1 A.

Native and WASM agreement: all 11 benches passed. Worst reported relative delta was 9.002e-13 and worst absolute delta was 6.433e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
