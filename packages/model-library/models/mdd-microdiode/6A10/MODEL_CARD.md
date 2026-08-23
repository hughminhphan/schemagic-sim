# 6A10 model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: -55℃~+150℃ 1 Independent 10uA@1kV 1V@6A 1kV 200A 6A R-6 Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588887223840215041
- Revision: Rev:2024A2
- Accessed: 2026-08-23
- Referenced pages: p. 1, p. 2
- SHA-256: `01a97e017eb02640b54bf3e4f2e6a0a8c558872cb70db6edbc484d6b8def3d82`
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
| IS | 7.45415758e-6 | evidence-derived (curve-fitted) |
| N | 2.53171647e+0 | evidence-derived (curve-fitted) |
| RS | 1.50648987e-3 | evidence-derived (curve-fitted) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.3 A | 7.000000e-1 | 6.980357e-1 | V | 0.281% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 2 A | 8.000000e-1 | 8.239962e-1 | V | 3.000% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 8 A | 9.000000e-1 | 9.232083e-1 | V | 2.579% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 20 A | 1.000000e+0 | 1.000887e+0 | V | 0.089% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 45 A | 1.100000e+0 | 1.091298e+0 | V | 0.791% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 85 A | 1.200000e+0 | 1.192926e+0 | V | 0.589% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 140 A | 1.300000e+0 | 1.308240e+0 | V | 0.634% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 200 A | 1.400000e+0 | 1.421830e+0 | V | 1.559% | p. 2, Fig. 3 Typical Instantaneous Forward Characteristics |

Worst fitting error: 3.000% for forward voltage at 2 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 2.593e-14 and worst absolute delta was 1.810e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.
- Reverse-recovery time is not published. No breakdown voltage or breakdown-current test point is published; the 1000 V entries are maximum blocking-voltage ratings, not measured breakdown-characteristic values.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
