# SS315 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603067514503254016
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `6f4e0d4eb66ab3b0f99d80b337bfad75a949c03badc693dac1238d5961458d77`
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
| IS | 2.73273384e-6 | fitted or derived |
| N | 2.12534384e+0 | fitted or derived |
| RS | 2.77658539e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 4.500000e-1 | 4.510888e-1 | V | 0.242% | p. 2 fig. 3, SS315-SS320 dotted curve |
| forward voltage at 0.1 A | 5.700000e-1 | 5.779026e-1 | V | 1.386% | p. 2 fig. 3, SS315-SS320 dotted curve |
| forward voltage at 1 A | 7.000000e-1 | 7.069775e-1 | V | 0.997% | p. 2 fig. 3, SS315-SS320 dotted curve |
| forward voltage at 10 A | 8.600000e-1 | 8.585439e-1 | V | 0.169% | p. 2 fig. 3, SS315-SS320 dotted curve |
| forward voltage at 50 A | 1.050000e+0 | 1.058081e+0 | V | 0.770% | p. 2 fig. 3, SS315-SS320 dotted curve |

Worst fitting error: 1.386% for forward voltage at 0.1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 1.312e-13 and worst absolute delta was 5.984e-14.984e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
