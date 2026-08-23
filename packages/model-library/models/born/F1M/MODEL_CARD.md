# F1M model card

## Identity

- Manufacturer: BORN
- Description: diode from BORN
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603356969197985792
- Revision: Revision 2018
- Accessed: 2026-08-23
- Referenced pages: PDF p. 1, PDF p. 2, PDF p. 3, PDF p. 4
- SHA-256: `50adaf79fe73b4bc4c63438de9ccfd0c84d0baf9c27da080bfb71b0715424abd`
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
| IS | 2.50070365e-20 | evidence-derived (curve-fitted) |
| N | 9.92575533e-1 | evidence-derived (curve-fitted) |
| RS | 1.34818008e-2 | evidence-derived (curve-fitted) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 1.040000e+0 | 1.041634e+0 | V | 0.157% | PDF p. 2, Typical Forward Characteristic |
| forward voltage at 0.1 A | 1.080000e+0 | 1.101567e+0 | V | 1.997% | PDF p. 2, Typical Forward Characteristic |
| forward voltage at 1 A | 1.170000e+0 | 1.172421e+0 | V | 0.207% | PDF p. 2, Typical Forward Characteristic |
| forward voltage at 2 A | 1.200000e+0 | 1.203580e+0 | V | 0.298% | PDF p. 2, Typical Forward Characteristic |
| forward voltage at 8 A | 1.310000e+0 | 1.319823e+0 | V | 0.750% | PDF p. 2, Typical Forward Characteristic |

Worst fitting error: 1.997% for forward voltage at 0.1 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 3.006e-14 and worst absolute delta was 3.131e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
