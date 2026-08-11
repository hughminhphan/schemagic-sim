# SS120 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603067523324010496
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `084410db60775b4ccfceaf93f99c1ce2065e2fba09d9580a48ea3c1f5719a3a2`
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
| IS | 1.59240503e-6 | fitted or derived |
| N | 2.64417304e+0 | fitted or derived |
| RS | 9.04956758e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 6.000000e-1 | 5.981899e-1 | V | 0.302% | p. 2, Fig. 3 |
| forward voltage at 0.05 A | 7.000000e-1 | 7.086148e-1 | V | 1.231% | p. 2, Fig. 3 |
| forward voltage at 0.25 A | 8.000000e-1 | 8.204945e-1 | V | 2.562% | p. 2, Fig. 3 |
| forward voltage at 0.8 A | 9.000000e-1 | 9.050209e-1 | V | 0.558% | p. 2, Fig. 3 |
| forward voltage at 2.5 A | 1.000000e+0 | 9.983325e-1 | V | 0.167% | p. 2, Fig. 3 |
| forward voltage at 12 A | 1.200000e+0 | 1.191583e+0 | V | 0.701% | p. 2, Fig. 3 |
| forward voltage at 30 A | 1.400000e+0 | 1.417142e+0 | V | 1.224% | p. 2, Fig. 3 |

Worst fitting error: 2.562% for forward voltage at 0.25 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 9.588e-14 and worst absolute delta was 5.773e-14.773e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No reverse-recovery or breakdown-voltage specification is published in the supplied datasheet.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
