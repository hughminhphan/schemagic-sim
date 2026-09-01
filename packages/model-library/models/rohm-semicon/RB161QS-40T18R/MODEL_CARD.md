# RB161QS-40T18R model card

## Identity

- Manufacturer: ROHM Semicon
- Description: 1 Independent 100uA@10V 1A 40V 600mV@1A 7A SMD1006 Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8589042142308683776
- Revision: 2016.02 - Rev.001
- Accessed: 2026-08-23
- Referenced pages: PDF p. 1, PDF p. 2, PDF p. 3, PDF p. 4, PDF p. 5, PDF p. 6
- SHA-256: `9e23cfa8d67137836a0331a09366ba66f3624e0b03d6e1412e757a57305cdac8`
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
| IS | 2.44231542e-7 | evidence-derived (curve-fitted) |
| N | 1.02752648e+0 | evidence-derived (curve-fitted) |
| RS | 7.82196296e-2 | evidence-derived (curve-fitted) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.001 A | 2.200000e-1 | 2.275721e-1 | V | 3.442% | PDF p. 2, VF-IF Characteristics |
| forward voltage at 0.01 A | 2.800000e-1 | 2.890596e-1 | V | 3.236% | PDF p. 2, VF-IF Characteristics |
| forward voltage at 0.1 A | 3.500000e-1 | 3.568867e-1 | V | 1.968% | PDF p. 2, VF-IF Characteristics |
| forward voltage at 1 A | 4.800000e-1 | 4.880721e-1 | V | 1.682% | PDF p. 2, VF-IF Characteristics |

Worst fitting error: 3.442% for forward voltage at 0.001 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 8.098e-14 and worst absolute delta was 1.843e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
