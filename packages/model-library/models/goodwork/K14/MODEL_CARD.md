# K14 model card

## Identity

- Manufacturer: GOODWORK
- Description: -65℃~+125℃ 1A 200uA@40V 30A 40V 550mV@1A Independent SOD-123FL Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: independent-package-review-batch-10 (2026-08-12)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8757769741031624704
- Revision: Rev. 2.0, 2025 JAN
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `32e49bb6b8c19c6bf207700a19596a126a14a564c84ed4e460fa63f8a9182c2c`
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
| IS | 5.41697200e-5 | fitted or derived |
| N | 2.04210118e+0 | fitted or derived |
| RS | 2.09800840e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 4.000000e-1 | 4.046268e-1 | V | 1.157% | p. 2, Fig. 2 |
| forward voltage at 0.65 A | 5.000000e-1 | 5.143527e-1 | V | 2.871% | p. 2, Fig. 2 |
| forward voltage at 2.2 A | 6.000000e-1 | 6.108388e-1 | V | 1.806% | p. 2, Fig. 2 |
| forward voltage at 5 A | 7.000000e-1 | 7.126567e-1 | V | 1.808% | p. 2, Fig. 2 |
| forward voltage at 8.5 A | 8.000000e-1 | 8.139271e-1 | V | 1.741% | p. 2, Fig. 2 |
| forward voltage at 15 A | 1.000000e+0 | 9.800979e-1 | V | 1.990% | p. 2, Fig. 2 |
| forward voltage at 23 A | 1.200000e+0 | 1.170365e+0 | V | 2.470% | p. 2, Fig. 2 |
| forward voltage at 40 A | 1.500000e+0 | 1.556061e+0 | V | 3.737% | p. 2, Fig. 2 |

Worst fitting error: 3.737% for forward voltage at 40 A.

Native and WASM agreement: all 10 checks passed. Worst reported relative delta was 3.116e-16 and worst absolute delta was 2.220e-16.220e-16.

## Known omissions

- F2 forward-current scope is limited to pulse width 300 us, 1% duty cycle at 25 degC; continuous-current and self-heating behavior are not claimed.

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No reverse-recovery, breakdown-voltage, or breakdown-current specification is published for this Schottky rectifier family.
- Independent review approved this staged candidate for promotion eligibility; no promotion was performed during review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
