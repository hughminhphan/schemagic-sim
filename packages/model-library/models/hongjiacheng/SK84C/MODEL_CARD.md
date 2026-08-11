# SK84C model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603186782599471104
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `2aed9318495912c0a4da07352dbdf57f0c224dcf8fc72876fd6e657e590754e7`
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
| IS | 2.84799690e-5 | fitted or derived |
| N | 1.42437725e+0 | fitted or derived |
| RS | 8.93461660e-4 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 3.000000e-1 | 3.008629e-1 | V | 0.288% | p. 2, Fig. 3 |
| forward voltage at 1 A | 3.800000e-1 | 3.864880e-1 | V | 1.707% | p. 2, Fig. 3 |
| forward voltage at 10 A | 4.800000e-1 | 4.793587e-1 | V | 0.134% | p. 2, Fig. 3 |
| forward voltage at 100 A | 6.400000e-1 | 6.446006e-1 | V | 0.719% | p. 2, Fig. 3 |
| forward voltage at 300 A | 8.600000e-1 | 8.637673e-1 | V | 0.438% | p. 2, Fig. 3 |

Worst fitting error: 1.707% for forward voltage at 1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 1.021e-13 and worst absolute delta was 3.131e-14.131e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
