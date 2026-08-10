# MM3Z3V6 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879401302728704
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
| IS | 5.27811105e-11 | fitted or derived |
| N | 1.51160470e+0 | fitted or derived |
| RS | 5.20616364e-1 | fitted or derived |
| BV | 3.60000000e+0 | fitted or derived |
| IBV | 5.00000000e-3 | fitted or derived |
| NBV | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.001 A | 6.500000e-1 | 6.556823e-1 | V | 0.874% | p. 3 Fig. 3, Typical Forward Voltage |
| forward voltage at 0.003 A | 7.000000e-1 | 6.996766e-1 | V | 0.046% | p. 3 Fig. 3, Typical Forward Voltage |
| forward voltage at 0.01 A | 7.400000e-1 | 7.503933e-1 | V | 1.404% | p. 3 Fig. 3, Typical Forward Voltage |
| forward voltage at 0.03 A | 8.000000e-1 | 8.037586e-1 | V | 0.470% | p. 3 Fig. 3, Typical Forward Voltage |
| forward voltage at 0.1 A | 8.800000e-1 | 8.872741e-1 | V | 0.827% | p. 3 Fig. 3, Typical Forward Voltage |
| forward voltage at 0.25 A | 1.000000e+0 | 1.001191e+0 | V | 0.119% | p. 3 Fig. 3, Typical Forward Voltage |
| forward voltage at 0.5 A | 1.150000e+0 | 1.158446e+0 | V | 0.734% | p. 3 Fig. 3, Typical Forward Voltage |

Worst fitting error: 1.404% for forward voltage at 0.01 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 1.398e-14 and worst absolute delta was 9.215e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
