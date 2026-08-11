# SS520B model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925387370545152
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `a178ee3c95547ba58e1026caa12a6232c0bd098dd637deef0de35d5a8c20b9d2`
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
| IS | 4.91029037e-6 | fitted or derived |
| N | 2.22643951e+0 | fitted or derived |
| RS | 1.92774224e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 4.500000e-1 | 4.389743e-1 | V | 2.450% | p. 2 Fig.3 |
| forward voltage at 0.03 A | 4.900000e-1 | 5.026065e-1 | V | 2.573% | p. 2 Fig.3 |
| forward voltage at 0.1 A | 5.500000e-1 | 5.732821e-1 | V | 4.233% | p. 2 Fig.3 |
| forward voltage at 0.3 A | 6.300000e-1 | 6.404011e-1 | V | 1.651% | p. 2 Fig.3 |
| forward voltage at 1 A | 7.300000e-1 | 7.232274e-1 | V | 0.928% | p. 2 Fig.3 |
| forward voltage at 3 A | 8.500000e-1 | 8.250475e-1 | V | 2.936% | p. 2 Fig.3 |
| forward voltage at 10 A | 1.010000e+0 | 1.029322e+0 | V | 1.913% | p. 2 Fig.3 |

Worst fitting error: 4.233% for forward voltage at 0.1 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 9.806e-15 and worst absolute delta was 5.662e-15.662e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
