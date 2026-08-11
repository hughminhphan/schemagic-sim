# DSS210 model card

## Identity

- Manufacturer: BORN
- Description: 100V 2A 40A 850mV@2A Independent SOD-123FL Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: independent-package-review-batch-10 (2026-08-12)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588905497655590912
- Revision: Revision 2018
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `abe803e3c97016c5fe220cc94df319c7fb21c77f8e9f6738747c87ad88c47045`
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
| IS | 1.14893289e-6 | fitted or derived |
| N | 1.80041100e+0 | fitted or derived |
| RS | 3.65513352e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 4.200000e-1 | 4.279040e-1 | V | 1.882% | p. 2, Fig. 3 |
| forward voltage at 0.03 A | 4.800000e-1 | 4.794507e-1 | V | 0.114% | p. 2, Fig. 3 |
| forward voltage at 0.1 A | 5.200000e-1 | 5.377007e-1 | V | 3.404% | p. 2, Fig. 3 |
| forward voltage at 0.3 A | 5.800000e-1 | 5.958294e-1 | V | 2.729% | p. 2, Fig. 3 |
| forward voltage at 0.8 A | 6.500000e-1 | 6.594753e-1 | V | 1.458% | p. 2, Fig. 3 |
| forward voltage at 2 A | 7.500000e-1 | 7.457219e-1 | V | 0.570% | p. 2, Fig. 3 |
| forward voltage at 5 A | 9.000000e-1 | 8.977610e-1 | V | 0.249% | p. 2, Fig. 3 |
| forward voltage at 10 A | 1.100000e+0 | 1.112581e+0 | V | 1.144% | p. 2, Fig. 3 |
| forward voltage at 15 A | 1.300000e+0 | 1.314093e+0 | V | 1.084% | p. 2, Fig. 3 |

Worst fitting error: 3.404% for forward voltage at 0.1 A.

Native and WASM agreement: all 11 checks passed. Worst reported relative delta was 1.297e-14 and worst absolute delta was 5.551e-15.551e-15.

## Known omissions

- F2 forward-current scope is limited to pulse width 300 us, 1% duty cycle at 25 degC; continuous-current and self-heating behavior are not claimed.

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No reverse-recovery or breakdown data are published; the forward and capacitance values are grouped-family specifications and curves.
- Independent review approved this staged candidate for promotion eligibility; no promotion was performed during review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
