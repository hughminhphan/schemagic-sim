# MMBD4148 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603005636062306305
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `4a8b1b0bd717a251b55840252e8a6c8bd490ab55a60c3bfa3e37efb698319634`
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
| IS | 2.92100826e-7 | fitted or derived |
| N | 2.80872826e+0 | fitted or derived |
| RS | 1.67492954e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0003 A | 5.000000e-1 | 5.038906e-1 | V | 0.778% | p. 2 Fig. 1, Ta = 25 degC trace |
| forward voltage at 0.0012 A | 6.000000e-1 | 6.046993e-1 | V | 0.783% | p. 2 Fig. 1, Ta = 25 degC trace |
| forward voltage at 0.0045 A | 7.000000e-1 | 7.012614e-1 | V | 0.180% | p. 2 Fig. 1, Ta = 25 degC trace |
| forward voltage at 0.018 A | 8.000000e-1 | 8.042298e-1 | V | 0.529% | p. 2 Fig. 1, Ta = 25 degC trace |
| forward voltage at 0.07 A | 9.000000e-1 | 9.116029e-1 | V | 1.289% | p. 2 Fig. 1, Ta = 25 degC trace |
| forward voltage at 0.19 A | 1.000000e+0 | 1.004243e+0 | V | 0.424% | p. 2 Fig. 1, Ta = 25 degC trace |

Worst fitting error: 1.289% for forward voltage at 0.07 A.

Native and WASM agreement: all 12 benches passed. Worst reported relative delta was 7.271e-14 and worst absolute delta was 3.697e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
