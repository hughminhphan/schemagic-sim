# MM3Z5V6 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879402900082688
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
| IS | 2.32418089e-10 | fitted or derived |
| N | 1.65270134e+0 | fitted or derived |
| RS | 5.51270022e-1 | fitted or derived |
| BV | 5.60000000e+0 | fitted or derived |
| IBV | 5.00000000e-3 | fitted or derived |
| NBV | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.005 A | 7.200000e-1 | 7.245035e-1 | V | 0.625% | p. 3 Fig. 3 Typical Forward Voltage, Ta = 25 degC trace |
| forward voltage at 0.01 A | 7.500000e-1 | 7.568898e-1 | V | 0.919% | p. 3 Fig. 3 Typical Forward Voltage, Ta = 25 degC trace |
| forward voltage at 0.02 A | 7.900000e-1 | 7.920325e-1 | V | 0.257% | p. 3 Fig. 3 Typical Forward Voltage, Ta = 25 degC trace |
| forward voltage at 0.05 A | 8.400000e-1 | 8.477392e-1 | V | 0.921% | p. 3 Fig. 3 Typical Forward Voltage, Ta = 25 degC trace |
| forward voltage at 0.1 A | 9.000000e-1 | 9.049327e-1 | V | 0.548% | p. 3 Fig. 3 Typical Forward Voltage, Ta = 25 degC trace |

Worst fitting error: 0.921% for forward voltage at 0.05 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 7.306e-16 and worst absolute delta was 5.551e-16.551e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
