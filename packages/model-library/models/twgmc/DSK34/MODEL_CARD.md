# DSK34 model card

## Identity

- Manufacturer: TWGMC
- Description: -55℃~+125℃ 3A 40V 500uA 520mV@3A 80A Independent SOD-123FL Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: independent-package-review-batch-10 (2026-08-12)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588893855869505536
- Revision: Not stated
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `67db086709a04e6c86fd47e5f89b1036c2c859f0506d6f8a7618f83abb3a73b7`
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
| IS | 1.34259135e-5 | fitted or derived |
| N | 1.73512114e+0 | fitted or derived |
| RS | 8.66972763e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 4.000000e-1 | 4.062448e-1 | V | 1.561% | p. 2 fig. 3 |
| forward voltage at 0.3 A | 4.500000e-1 | 4.569512e-1 | V | 1.545% | p. 2 fig. 3 |
| forward voltage at 1 A | 5.000000e-1 | 5.166916e-1 | V | 3.338% | p. 2 fig. 3 |
| forward voltage at 4 A | 6.000000e-1 | 6.045010e-1 | V | 0.750% | p. 2 fig. 3 |
| forward voltage at 10 A | 7.000000e-1 | 6.973673e-1 | V | 0.376% | p. 2 fig. 3 |
| forward voltage at 20 A | 8.000000e-1 | 8.149649e-1 | V | 1.871% | p. 2 fig. 3 |

Worst fitting error: 3.338% for forward voltage at 1 A.

Native and WASM agreement: all 8 checks passed. Worst reported relative delta was 5.466e-15 and worst absolute delta was 2.220e-15.220e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- Independent review approved this staged candidate for promotion eligibility; no promotion was performed during review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
