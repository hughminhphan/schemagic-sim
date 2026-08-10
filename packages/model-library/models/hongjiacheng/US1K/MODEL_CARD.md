# US1K model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925621081493504
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `a35041a8ed9d8ddd02af14288567a5826d249ded1cf1afc8cc265c3638e9aa0a`
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
| IS | 5.96077918e-10 | fitted or derived |
| N | 2.66183858e+0 | fitted or derived |
| RS | 2.11797138e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 1.300000e+0 | 1.305970e+0 | V | 0.459% | p. 2, Fig. 3 |
| forward voltage at 0.5 A | 1.410000e+0 | 1.425249e+0 | V | 1.081% | p. 2, Fig. 3 |
| forward voltage at 1 A | 1.470000e+0 | 1.483561e+0 | V | 0.923% | p. 2, Fig. 3 |
| forward voltage at 2 A | 1.550000e+0 | 1.552463e+0 | V | 0.159% | p. 2, Fig. 3 |
| forward voltage at 5 A | 1.670000e+0 | 1.679087e+0 | V | 0.544% | p. 2, Fig. 3 |
| forward voltage at 10 A | 1.820000e+0 | 1.832707e+0 | V | 0.698% | p. 2, Fig. 3 |

Worst fitting error: 1.081% for forward voltage at 0.5 A.

Native and WASM agreement: all 14 benches passed. Worst reported relative delta was 1.871e-15 and worst absolute delta was 2.442e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
