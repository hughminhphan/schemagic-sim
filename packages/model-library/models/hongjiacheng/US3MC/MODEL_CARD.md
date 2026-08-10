# US3MC model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925629151469568
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `27b5fbb073ae3916de9b8088d466cf6b182885efa4e67e5c969ead21d80dde5d`
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
| IS | 5.06254485e-8 | fitted or derived |
| N | 2.97471841e+0 | fitted or derived |
| RS | 7.56156318e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 9.600000e-1 | 9.382651e-1 | V | 2.264% | p. 2 Fig. 3 |
| forward voltage at 0.03 A | 1.000000e+0 | 1.022944e+0 | V | 2.294% | p. 2 Fig. 3 |
| forward voltage at 0.1 A | 1.080000e+0 | 1.116108e+0 | V | 3.343% | p. 2 Fig. 3 |
| forward voltage at 0.3 A | 1.180000e+0 | 1.202149e+0 | V | 1.877% | p. 2 Fig. 3 |
| forward voltage at 1 A | 1.300000e+0 | 1.300076e+0 | V | 0.006% | p. 2 Fig. 3 |
| forward voltage at 3 A | 1.420000e+0 | 1.399728e+0 | V | 1.428% | p. 2 Fig. 3 |
| forward voltage at 10 A | 1.550000e+0 | 1.545293e+0 | V | 0.304% | p. 2 Fig. 3 |
| forward voltage at 20 A | 1.650000e+0 | 1.674240e+0 | V | 1.469% | p. 2 Fig. 3 |

Worst fitting error: 3.343% for forward voltage at 0.1 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 9.331e-15 and worst absolute delta was 8.771e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
