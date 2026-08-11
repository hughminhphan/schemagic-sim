# M1F model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602926026712227840
- Revision: Rev.1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `638e5dc21198745acc0f6e832f464119c245f142a8156a4e01b662a44acab421`
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
| IS | 1.06282608e-6 | fitted or derived |
| N | 2.61941176e+0 | fitted or derived |
| RS | 3.40947598e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.010005 A | 6.232000e-1 | 6.202626e-1 | V | 0.471% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 0.190604 A | 7.932100e-1 | 8.260825e-1 | V | 4.144% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 1.26007 A | 9.967900e-1 | 9.905082e-1 | V | 0.630% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 4.1235 A | 1.195830e+0 | 1.168457e+0 | V | 2.289% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 9.48008 A | 1.378900e+0 | 1.407491e+0 | V | 2.073% | p. 2, Fig. 3 Typical Forward Voltage |

Worst fitting error: 4.144% for forward voltage at 0.190604 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 2.580e-14 and worst absolute delta was 1.610e-14.610e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
