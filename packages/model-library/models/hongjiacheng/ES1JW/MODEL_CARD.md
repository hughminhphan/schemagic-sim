# ES1JW model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603067501190262784
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3
- SHA-256: `54add4ec6272851e0e7617457eae2ee8742aa6ad1d3bae43660e5ddada67cbe8`
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
| IS | 4.51992707e-11 | fitted or derived |
| N | 2.43424025e+0 | fitted or derived |
| RS | 4.06346579e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.05 A | 1.310000e+0 | 1.313153e+0 | V | 0.241% | 2 |
| forward voltage at 0.1 A | 1.350000e+0 | 1.358827e+0 | V | 0.654% | 2 |
| forward voltage at 0.2 A | 1.390000e+0 | 1.406532e+0 | V | 1.189% | 2 |
| forward voltage at 0.5 A | 1.460000e+0 | 1.476413e+0 | V | 1.124% | 2 |
| forward voltage at 1 A | 1.530000e+0 | 1.540372e+0 | V | 0.678% | 2 |
| forward voltage at 2 A | 1.620000e+0 | 1.624648e+0 | V | 0.287% | 2 |
| forward voltage at 3 A | 1.690000e+0 | 1.690811e+0 | V | 0.048% | 2 |
| forward voltage at 5 A | 1.790000e+0 | 1.804243e+0 | V | 0.796% | 2 |
| forward voltage at 9 A | 1.990000e+0 | 2.003790e+0 | V | 0.693% | 2 |

Worst fitting error: 1.189% for forward voltage at 0.2 A.

Native and WASM agreement: all 16 benches passed. Worst reported relative delta was 3.892e-15 and worst absolute delta was 5.107e-15.


F2 curve-fit fidelity is supported only for the selected 25 degC forward DC curve over 0.05 to 9 A: Typical instantaneous forward current vs instantaneous forward voltage, ES1JW curve (Fig.3) (2). Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, breakdown, capacitance, recovery, switching, thermal, surge, and continuous-current fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
