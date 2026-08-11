# BAS70W-05 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603186707466633216
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `89559c84208ddbfa90289ee29e1160898ad458968a95ad8c850a64074c21feae`
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
| IS | 6.54726396e-8 | fitted or derived |
| N | 1.54023447e+0 | fitted or derived |
| RS | 3.50750578e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1e-05 A | 2.000000e-1 | 2.006281e-1 | V | 0.314% | p. 2 Fig.1 |
| forward voltage at 0.0001 A | 2.900000e-1 | 2.924410e-1 | V | 0.842% | p. 2 Fig.1 |
| forward voltage at 0.001 A | 3.800000e-1 | 3.873049e-1 | V | 1.922% | p. 2 Fig.1 |
| forward voltage at 0.01 A | 5.000000e-1 | 5.106006e-1 | V | 2.120% | p. 2 Fig.1 |
| forward voltage at 0.015 A | 5.500000e-1 | 5.442910e-1 | V | 1.038% | p. 2 Fig.1 |
| forward voltage at 0.03 A | 6.400000e-1 | 6.245171e-1 | V | 2.419% | p. 2 Fig.1 |
| forward voltage at 0.06 A | 7.400000e-1 | 7.573558e-1 | V | 2.345% | p. 2 Fig.1 |

Worst fitting error: 2.419% for forward voltage at 0.03 A.

Native and WASM agreement: all 14 benches passed. Worst reported relative delta was 1.656e-13 and worst absolute delta was 3.431e-14.431e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
