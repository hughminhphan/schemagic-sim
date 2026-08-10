# US2M model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603080476215566336
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `95a330e49943c313d6828a36a0fb34addd63947c3eddc8b63b970ba0bbd4ae2a`
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
| IS | 6.20498488e-10 | fitted or derived |
| N | 2.47285253e+0 | fitted or derived |
| RS | 1.26857996e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.02 A | 1.100000e+0 | 1.106027e+0 | V | 0.548% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 0.1 A | 1.200000e+0 | 1.209981e+0 | V | 0.832% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 0.45 A | 1.300000e+0 | 1.310622e+0 | V | 0.817% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 1.6 A | 1.400000e+0 | 1.406345e+0 | V | 0.453% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 4.5 A | 1.500000e+0 | 1.509274e+0 | V | 0.618% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 9 A | 1.600000e+0 | 1.610693e+0 | V | 0.668% | p. 2, Fig. 3 Typical Forward Voltage |

Worst fitting error: 0.832% for forward voltage at 0.1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 4.214e-15 and worst absolute delta was 4.663e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
