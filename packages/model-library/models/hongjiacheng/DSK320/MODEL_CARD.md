# DSK320 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603373062914265088
- Revision: Rev. 1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `e39eda5ed17f31ea54b97ae7a6626b4269b0cdab5fbf29cece112017a075e41b`
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
| IS | 4.28884513e-5 | fitted or derived |
| N | 2.40671487e+0 | fitted or derived |
| RS | 8.42282809e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 4.800000e-1 | 4.835715e-1 | V | 0.744% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 0.3 A | 5.500000e-1 | 5.536264e-1 | V | 0.659% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 1 A | 6.300000e-1 | 6.344628e-1 | V | 0.708% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 3 A | 7.200000e-1 | 7.196947e-1 | V | 0.042% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 10 A | 8.400000e-1 | 8.536006e-1 | V | 1.619% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 20 A | 9.800000e-1 | 9.809768e-1 | V | 0.100% | p. 2, Fig. 3 Typical Forward Voltage |

Worst fitting error: 1.619% for forward voltage at 10 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 9.891e-15 and worst absolute delta was 4.829e-15.829e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
