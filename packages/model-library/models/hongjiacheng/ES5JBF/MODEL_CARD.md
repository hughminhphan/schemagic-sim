# ES5JBF model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925640601378816
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3
- SHA-256: `466f7db7f3979049eb24cab555219f507a5d707f1c3e91a3fe92e2c2cd5bdfe2`
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
| IS | 1.56639393e-8 | fitted or derived |
| N | 2.73563730e+0 | fitted or derived |
| RS | 1.89469999e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.05 A | 1.060000e+0 | 1.060617e+0 | V | 0.058% | 2 |
| forward voltage at 0.1 A | 1.100000e+0 | 1.110609e+0 | V | 0.964% | 2 |
| forward voltage at 0.2 A | 1.150000e+0 | 1.161549e+0 | V | 1.004% | 2 |
| forward voltage at 0.5 A | 1.220000e+0 | 1.232067e+0 | V | 0.989% | 2 |
| forward voltage at 1 A | 1.280000e+0 | 1.290586e+0 | V | 0.827% | 2 |
| forward voltage at 2 A | 1.350000e+0 | 1.358578e+0 | V | 0.635% | 2 |
| forward voltage at 5 A | 1.480000e+0 | 1.480253e+0 | V | 0.017% | 2 |
| forward voltage at 10 A | 1.620000e+0 | 1.624033e+0 | V | 0.249% | 2 |
| forward voltage at 15 A | 1.730000e+0 | 1.747457e+0 | V | 1.009% | 2 |

Worst fitting error: 1.009% for forward voltage at 15 A.

Native and WASM agreement: all 17 benches passed. Worst reported relative delta was 3.975e-15 and worst absolute delta was 4.219e-15.


F2 curve-fit fidelity is supported only for the selected 25 degC forward DC curve over 0.05 to 15 A: Typical instantaneous forward current vs instantaneous forward voltage, ES5JBF curve (Fig.3) (2). Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, breakdown, capacitance, recovery, switching, thermal, surge, and continuous-current fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
