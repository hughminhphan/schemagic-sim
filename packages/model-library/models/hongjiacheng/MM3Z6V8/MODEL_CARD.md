# MM3Z6V8 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879404465233920
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `cc537a86da7714b2322122f522876343acdfa40bd213f643c959f51920fce06e`
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
| IS | 1.17549764e-10 | fitted or derived |
| N | 1.59025963e+0 | fitted or derived |
| RS | 5.42998251e-1 | fitted or derived |
| BV | 6.80000000e+0 | fitted or derived |
| IBV | 5.00000000e-3 | fitted or derived |
| NBV | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.005 A | 7.200000e-1 | 7.252320e-1 | V | 0.727% | p. 3 Fig.3 |
| forward voltage at 0.02 A | 7.860000e-1 | 7.903980e-1 | V | 0.560% | p. 3 Fig.3 |
| forward voltage at 0.05 A | 8.400000e-1 | 8.443767e-1 | V | 0.521% | p. 3 Fig.3 |
| forward voltage at 0.1 A | 8.920000e-1 | 9.000371e-1 | V | 0.901% | p. 3 Fig.3 |
| forward voltage at 0.2 A | 9.780000e-1 | 9.828474e-1 | V | 0.496% | p. 3 Fig.3 |

Worst fitting error: 0.901% for forward voltage at 0.1 A.

Native and WASM agreement: all 14 benches passed. Worst reported relative delta was 1.982e-15 and worst absolute delta was 1.443e-15.443e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
