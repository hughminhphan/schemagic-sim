# DSS26 model card

## Identity

- Manufacturer: BORN
- Description: -65℃~+150℃ 1 Independent 2A 500uA@60V 60V 700mV@2A SOD-123 Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588885146829262848
- Revision: Rev 8: Nov 2014
- Accessed: 2026-08-23
- Referenced pages: p. 1, p. 2
- SHA-256: `e0980b319008b3aeb8be073e180bb82c70b91f381401aa3eeea43d7e73d6a12c`
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
| IS | 7.09126064e-6 | evidence-derived (curve-fitted) |
| N | 1.60999364e+0 | evidence-derived (curve-fitted) |
| RS | 1.75096173e-2 | evidence-derived (curve-fitted) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 3.000000e-1 | 3.080674e-1 | V | 2.689% | p. 2, Fig. 3 |
| forward voltage at 0.1 A | 4.000000e-1 | 4.048676e-1 | V | 1.217% | p. 2, Fig. 3 |
| forward voltage at 1 A | 5.000000e-1 | 5.158702e-1 | V | 3.174% | p. 2, Fig. 3 |
| forward voltage at 2 A | 5.500000e-1 | 5.620517e-1 | V | 2.191% | p. 2, Fig. 3 |
| forward voltage at 5 A | 6.500000e-1 | 6.524827e-1 | V | 0.382% | p. 2, Fig. 3 |
| forward voltage at 10 A | 7.800000e-1 | 7.687027e-1 | V | 1.448% | p. 2, Fig. 3 |
| forward voltage at 20 A | 9.500000e-1 | 9.724708e-1 | V | 2.365% | p. 2, Fig. 3 |

Worst fitting error: 3.174% for forward voltage at 1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 2.702e-13 and worst absolute delta was 8.327e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
