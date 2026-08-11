# BAT54HT1G model card

## Identity

- Manufacturer: onsemi
- Description: 1 Independent 200mA 2uA@25V 30V 600mA 800mV@100mA SOD-323 Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: independent-package-review-batch-10 (2026-08-12)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586172785060155392
- Revision: October 2005 - Rev. 3
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `a984853684122f5eae211cd439b56aac24979499663cff729f8e785e27fe7df3`
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
| IS | 2.56999190e-8 | fitted or derived |
| N | 1.04243275e+0 | fitted or derived |
| RS | 1.13320151e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0001 A | 2.200000e-1 | 2.294281e-1 | V | 4.286% | p. 3, Fig. 2 |
| forward voltage at 0.001 A | 2.900000e-1 | 2.921131e-1 | V | 0.729% | p. 3, Fig. 2 |
| forward voltage at 0.01 A | 3.500000e-1 | 3.639811e-1 | V | 3.995% | p. 3, Fig. 2 |
| forward voltage at 0.03 A | 4.100000e-1 | 4.160690e-1 | V | 1.480% | p. 3, Fig. 2 |
| forward voltage at 0.1 A | 5.200000e-1 | 5.276388e-1 | V | 1.469% | p. 3, Fig. 2 |

Worst fitting error: 4.286% for forward voltage at 0.0001 A.

Native and WASM agreement: all 16 checks passed. Worst reported relative delta was 3.121e-14 and worst absolute delta was 7.161e-15.161e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No required field is omitted; the datasheet identifies the electrical device as BAT54HT1 and the order code as BAT54HT1G.
- Independent review approved this staged candidate for promotion eligibility; no promotion was performed during review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
