# 1SMA4746A model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879675979173888
- Revision: Rev1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `a66d0e20d37b19b6776d33e5d234d792d89e30813774a7dde79429c97d6773dd`
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
| IS | 2.77075204e-7 | fitted or derived |
| N | 2.58457402e+0 | fitted or derived |
| RS | 2.58026742e-2 | fitted or derived |
| BV | 1.80000000e+1 | fitted or derived |
| IBV | 1.40000000e-2 | fitted or derived |
| NBV | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 7.000000e-1 | 7.017687e-1 | V | 0.253% | p. 3, Fig. 3 Typical Zener Breakdown Characteristics |
| forward voltage at 0.1 A | 8.500000e-1 | 8.580166e-1 | V | 0.943% | p. 3, Fig. 3 Typical Zener Breakdown Characteristics |
| forward voltage at 1 A | 1.000000e+0 | 1.035166e+0 | V | 3.517% | p. 3, Fig. 3 Typical Zener Breakdown Characteristics |
| forward voltage at 3 A | 1.200000e+0 | 1.160214e+0 | V | 3.316% | p. 3, Fig. 3 Typical Zener Breakdown Characteristics |
| forward voltage at 10 A | 1.400000e+0 | 1.421318e+0 | V | 1.523% | p. 3, Fig. 3 Typical Zener Breakdown Characteristics |

Worst fitting error: 3.517% for forward voltage at 1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 3.291e-14 and worst absolute delta was 2.320e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
