# US1J model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925620263333888
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
| IS | 1.34222026e-7 | fitted or derived |
| N | 3.13449910e+0 | fitted or derived |
| RS | 2.29029999e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 9.000000e-1 | 9.097620e-1 | V | 1.085% | p. 2 Fig. 3 |
| forward voltage at 0.1 A | 1.100000e+0 | 1.098501e+0 | V | 0.136% | p. 2 Fig. 3 |
| forward voltage at 1 A | 1.300000e+0 | 1.305792e+0 | V | 0.446% | p. 2 Fig. 3 |
| forward voltage at 5 A | 1.500000e+0 | 1.527887e+0 | V | 1.859% | p. 2 Fig. 3 |
| forward voltage at 10 A | 1.700000e+0 | 1.698598e+0 | V | 0.082% | p. 2 Fig. 3 |

Worst fitting error: 1.859% for forward voltage at 5 A.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 6.187e-14 and worst absolute delta was 5.640e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
