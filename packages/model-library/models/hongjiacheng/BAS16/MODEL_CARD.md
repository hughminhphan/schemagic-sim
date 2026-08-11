# BAS16 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603005637479845888
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `df1c22c1e5eb01c87fa4759ee19c893e2908aa702bc9e63bc7f83a5d76af9956`
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
| IS | 1.16563298e-11 | fitted or derived |
| N | 1.31316406e+0 | fitted or derived |
| RS | 1.11848636e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1e-05 A | 4.720000e-1 | 4.640462e-1 | V | 1.685% | p. 2 Fig.1 |
| forward voltage at 0.0001 A | 5.270000e-1 | 5.423552e-1 | V | 2.914% | p. 2 Fig.1 |
| forward voltage at 0.001 A | 6.010000e-1 | 6.215691e-1 | V | 3.422% | p. 2 Fig.1 |
| forward voltage at 0.01 A | 7.120000e-1 | 7.098425e-1 | V | 0.303% | p. 2 Fig.1 |
| forward voltage at 0.1 A | 9.150000e-1 | 8.887133e-1 | V | 2.873% | p. 2 Fig.1 |
| forward voltage at 0.3 A | 1.128000e+0 | 1.149725e+0 | V | 1.926% | p. 2 Fig.1 |

Worst fitting error: 3.422% for forward voltage at 0.001 A.

Native and WASM agreement: all 17 benches passed. Worst reported relative delta was 5.910e-14 and worst absolute delta was 3.231e-14.231e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
