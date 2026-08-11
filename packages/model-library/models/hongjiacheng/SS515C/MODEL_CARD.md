# SS515C model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603373070958804992
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `2eb1ce7a5bd16a12a5f7914b4cae9e38b34481b48af156d5957cdc8b52245950`
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
| IS | 7.22615339e-6 | fitted or derived |
| N | 2.14327565e+0 | fitted or derived |
| RS | 4.04879805e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 4.000000e-1 | 4.010262e-1 | V | 0.257% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 0.1 A | 5.200000e-1 | 5.289999e-1 | V | 1.731% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 1 A | 6.600000e-1 | 6.602855e-1 | V | 0.043% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 10 A | 8.200000e-1 | 8.243696e-1 | V | 0.533% | p. 2, Fig. 3 Typical Forward Voltage |
| forward voltage at 30 A | 9.600000e-1 | 9.662478e-1 | V | 0.651% | p. 2, Fig. 3 Typical Forward Voltage |

Worst fitting error: 1.731% for forward voltage at 0.1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 1.406e-13 and worst absolute delta was 5.712e-14.712e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
