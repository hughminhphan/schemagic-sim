# DL4007 model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: -55℃~+175℃ 1 Independent 1.1V@1A 1A 1kV 30A 5uA@1kV DO-213AB Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586175681742426112
- Revision: Rev:2024A2
- Accessed: 2026-08-23
- Referenced pages: p. 1, p. 2
- SHA-256: `a644bfe2027bc70656909da75a936bc45dbbc4f333903942a041bb116a3e6706`
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
| IS | 2.93839092e-8 | evidence-derived (curve-fitted) |
| N | 2.11324513e+0 | evidence-derived (curve-fitted) |
| RS | 4.37180840e-2 | evidence-derived (curve-fitted) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 7.000000e-1 | 6.999357e-1 | V | 0.009% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 0.1 A | 8.000000e-1 | 8.288884e-1 | V | 3.611% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 1 A | 1.000000e+0 | 9.932528e-1 | V | 0.675% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 4 A | 1.200000e+0 | 1.199676e+0 | V | 0.027% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 8 A | 1.400000e+0 | 1.412182e+0 | V | 0.870% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 10 A | 1.500000e+0 | 1.511734e+0 | V | 0.782% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |

Worst fitting error: 3.611% for forward voltage at 0.1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 1.697e-14 and worst absolute delta was 1.188e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.
- No reverse-recovery time is published. No junction breakdown voltage/current test point is published; the 1000 V entries are maximum blocking-voltage ratings and are not recorded as breakdown data.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
