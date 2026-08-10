# US2MB model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602926041484836864
- Revision: Rev. 1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `6a13f492beee87b5b59ca9c41ac9dc9f86ed336d3a732a3b0806207f1225be98`
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
| IS | 8.67880439e-8 | fitted or derived |
| N | 3.32149716e+0 | fitted or derived |
| RS | 1.74086820e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 1.200000e+0 | 1.200808e+0 | V | 0.067% | p. 2, Fig. 3 |
| forward voltage at 0.3 A | 1.280000e+0 | 1.298672e+0 | V | 1.459% | p. 2, Fig. 3 |
| forward voltage at 1 A | 1.400000e+0 | 1.414292e+0 | V | 1.021% | p. 2, Fig. 3 |
| forward voltage at 3 A | 1.540000e+0 | 1.543491e+0 | V | 0.227% | p. 2, Fig. 3 |
| forward voltage at 10 A | 1.770000e+0 | 1.768786e+0 | V | 0.069% | p. 2, Fig. 3 |
| forward voltage at 15 A | 1.870000e+0 | 1.890663e+0 | V | 1.105% | p. 2, Fig. 3 |

Worst fitting error: 1.459% for forward voltage at 0.3 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 3.592e-15 and worst absolute delta was 4.663e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
