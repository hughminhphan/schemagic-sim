# 10A10 model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: 1 Independent 10A 10uA@1kV 1V@10A 1kV 400A R-6 Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588887223857532928
- Revision: Rev:2024A3
- Accessed: 2026-08-23
- Referenced pages: p. 1, p. 2
- SHA-256: `ba6192875d0571fe398726841db97eb25eb9b9ca439f5bd529ea4a00a23a3960`
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
| IS | 1.68178417e-7 | evidence-derived (curve-fitted) |
| N | 1.98124468e+0 | evidence-derived (curve-fitted) |
| RS | 1.65986280e-3 | evidence-derived (curve-fitted) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 6.900000e-1 | 6.848700e-1 | V | 0.743% | p. 2, Fig. 3 |
| forward voltage at 0.2 A | 7.200000e-1 | 7.203194e-1 | V | 0.044% | p. 2, Fig. 3 |
| forward voltage at 0.5 A | 7.500000e-1 | 7.674595e-1 | V | 2.328% | p. 2, Fig. 3 |
| forward voltage at 1 A | 7.800000e-1 | 8.035729e-1 | V | 3.022% | p. 2, Fig. 3 |
| forward voltage at 2 A | 8.200000e-1 | 8.405162e-1 | V | 2.502% | p. 2, Fig. 3 |
| forward voltage at 5 A | 8.700000e-1 | 8.921380e-1 | V | 2.545% | p. 2, Fig. 3 |
| forward voltage at 10 A | 9.300000e-1 | 9.357208e-1 | V | 0.615% | p. 2, Fig. 3 |
| forward voltage at 20 A | 1.000000e+0 | 9.876029e-1 | V | 1.240% | p. 2, Fig. 3 |
| forward voltage at 50 A | 1.100000e+0 | 1.084041e+0 | V | 1.451% | p. 2, Fig. 3 |
| forward voltage at 100 A | 1.200000e+0 | 1.202318e+0 | V | 0.193% | p. 2, Fig. 3 |
| forward voltage at 200 A | 1.380000e+0 | 1.403587e+0 | V | 1.709% | p. 2, Fig. 3 |

Worst fitting error: 3.022% for forward voltage at 1 A.

Native and WASM agreement: all 12 benches passed. Worst reported relative delta was 4.559e-13 and worst absolute delta was 3.123e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
