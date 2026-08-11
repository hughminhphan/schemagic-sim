# SS515B model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925388322922496
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
| IS | 4.18248274e-7 | fitted or derived |
| N | 2.03202251e+0 | fitted or derived |
| RS | 6.12450460e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 5.300000e-1 | 5.299552e-1 | V | 0.008% | p. 2, Fig. 3 |
| forward voltage at 0.1 A | 6.400000e-1 | 6.515239e-1 | V | 1.801% | p. 2, Fig. 3 |
| forward voltage at 1 A | 7.700000e-1 | 7.780553e-1 | V | 1.046% | p. 2, Fig. 3 |
| forward voltage at 10 A | 9.600000e-1 | 9.541953e-1 | V | 0.605% | p. 2, Fig. 3 |
| forward voltage at 40 A | 1.200000e+0 | 1.210791e+0 | V | 0.899% | p. 2, Fig. 3 |

Worst fitting error: 1.801% for forward voltage at 0.1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 1.288e-14 and worst absolute delta was 6.883e-15.883e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
