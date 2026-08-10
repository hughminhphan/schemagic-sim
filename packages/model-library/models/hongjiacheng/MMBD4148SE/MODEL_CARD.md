# MMBD4148SE model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602890545010528256
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `c81b6f8e6d7d837d640987ac1f2a7fdf68c918d14a0900c06f449176ba1af73e`
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
| IS | 2.23789962e-8 | fitted or derived |
| N | 2.12202668e+0 | fitted or derived |
| RS | 8.97455500e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0002 A | 5.000000e-1 | 4.995360e-1 | V | 0.093% | p. 2 Fig. 1 |
| forward voltage at 0.0015 A | 6.000000e-1 | 6.112875e-1 | V | 1.881% | p. 2 Fig. 1 |
| forward voltage at 0.008 A | 7.000000e-1 | 7.089983e-1 | V | 1.285% | p. 2 Fig. 1 |
| forward voltage at 0.03 A | 8.000000e-1 | 8.012881e-1 | V | 0.161% | p. 2 Fig. 1 |
| forward voltage at 0.08 A | 9.000000e-1 | 8.999947e-1 | V | 0.001% | p. 2 Fig. 1 |
| forward voltage at 0.15 A | 1.000000e+0 | 9.973184e-1 | V | 0.268% | p. 2 Fig. 1 |
| forward voltage at 0.25 A | 1.100000e+0 | 1.115101e+0 | V | 1.373% | p. 2 Fig. 1 |

Worst fitting error: 1.881% for forward voltage at 0.0015 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 6.651e-14 and worst absolute delta was 3.353e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
