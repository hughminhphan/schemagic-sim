# BZX84-C2V7 model card

## Identity

- Manufacturer: Nexperia
- Description: 1 Independent 100Ω 2.5V~2.9V 2.7V 20uA@1V 250mW SOT-23(TO-236AB) Zener Diodes ROHS
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588893627758493696
- Revision: Rev. 7 — 1 January 2023
- Accessed: 2026-08-23
- Referenced pages: PDF p. 1, PDF p. 2, PDF p. 3, PDF p. 4, PDF p. 5, PDF p. 6, PDF p. 7, PDF p. 8, PDF p. 9, PDF p. 10, PDF p. 11, PDF p. 12, PDF p. 13, PDF p. 14
- SHA-256: `e6278027e055c1b077d2fb733903d60f3fd66724e45a310a7501c69edb99ddb9`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 6.01915576e-11 | derived from cited maximum bound |
| N | 1.80000000e+0 | declared fixed F1 policy constant |
| RS | 1.00000000e-4 | declared fixed F1 policy constant |
| BV | 2.50000000e+0 | fitted or derived |
| IBV | 5.00000000e-3 | fitted or derived |
| NBV | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 9.500e-12 and worst absolute delta was 8.391e-12.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.
- No unambiguous C2V7-specific electrical curve was retained: the published forward curves apply to other voltage variants, and the multi-type reverse-leakage overview does not isolate a sufficiently clear C2V7 trace for non-interpolated digitization.
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
