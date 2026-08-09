# B0540WS model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603009309819219968
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `e820f20f3c2a9ea5e6f5e6e778f4247ede3eef5cd48350c6efc41f5a1211f78f`
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
| IS | 3.32656981e-6 | fitted or derived |
| N | 1.05944661e+0 | fitted or derived |
| RS | 1.03840724e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 2.200000e-1 | 2.204977e-1 | V | 0.226% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.02 A | 2.380000e-1 | 2.405255e-1 | V | 1.061% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.05 A | 2.655000e-1 | 2.687466e-1 | V | 1.223% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.1 A | 2.914000e-1 | 2.929317e-1 | V | 0.526% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.2 A | 3.220000e-1 | 3.223093e-1 | V | 0.096% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.4 A | 3.606000e-1 | 3.620712e-1 | V | 0.408% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.6 A | 3.904000e-1 | 3.939500e-1 | V | 0.909% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.8 A | 4.205000e-1 | 4.226013e-1 | V | 0.500% | p. 2, Fig. 1, Ta = 25 degC curve |

Worst fitting error: 1.223% for forward voltage at 0.05 A.

Native and WASM agreement: all 18 benches passed. Worst reported relative delta was 7.583e-15 and worst absolute delta was 1.721e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- The F2 fitted curve spans 0.01 to 0.8 A. The separate 1 A maximum check is a hard bound only.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
