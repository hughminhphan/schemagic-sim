# RB501V-40 model card

## Identity

- Manufacturer: hongjiacheng
- Description: 100mA 1A 30uA 40V 550mV@100mA Independent SOD-323 Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590910669883449344
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `38bb2f6f1cc614b8bbf9dc29bec4ebcbd699ca52f3615e0accd003c9addef794`
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
| IS | 1.49859342e-7 | fitted or derived |
| N | 1.07948697e+0 | fitted or derived |
| RS | 4.56231443e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.001 A | 2.469000e-1 | 2.463261e-1 | V | 0.232% | p. 2, Fig. 1 Typical Instantaneous Forward Characteristics, Ta=25 degC curve |
| forward voltage at 0.002585 A | 2.691000e-1 | 2.735638e-1 | V | 1.659% | p. 2, Fig. 1 Typical Instantaneous Forward Characteristics, Ta=25 degC curve |
| forward voltage at 0.006555 A | 2.968000e-1 | 3.013545e-1 | V | 1.535% | p. 2, Fig. 1 Typical Instantaneous Forward Characteristics, Ta=25 degC curve |
| forward voltage at 0.016385 A | 3.303000e-1 | 3.314182e-1 | V | 0.339% | p. 2, Fig. 1 Typical Instantaneous Forward Characteristics, Ta=25 degC curve |
| forward voltage at 0.040567 A | 3.698000e-1 | 3.677634e-1 | V | 0.551% | p. 2, Fig. 1 Typical Instantaneous Forward Characteristics, Ta=25 degC curve |
| forward voltage at 0.1 A | 4.155000e-1 | 4.200691e-1 | V | 1.100% | p. 2, Fig. 1 Typical Instantaneous Forward Characteristics, Ta=25 degC curve |

Worst fitting error: 1.659% for forward voltage at 0.002585 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 2.637e-15 and worst absolute delta was 6.661e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
