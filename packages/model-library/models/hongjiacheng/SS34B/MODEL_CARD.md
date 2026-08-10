# SS34B model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+125℃ 200uA@40V 3A 40V 550mV@3A 80A Independent SMB Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590905111176687616
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `0288550e2d59664f159097e9f903c9f2542e7493376be047ea12655fbf79aec5`
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
| IS | 1.58064751e-4 | fitted or derived |
| N | 1.71437401e+0 | fitted or derived |
| RS | 1.25637830e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.479 A | 3.600000e-1 | 3.614993e-1 | V | 0.416% | p. 2, Fig. 3 |
| forward voltage at 0.888 A | 3.900000e-1 | 3.940023e-1 | V | 1.026% | p. 2, Fig. 3 |
| forward voltage at 1.465 A | 4.200000e-1 | 4.234479e-1 | V | 0.821% | p. 2, Fig. 3 |
| forward voltage at 2.545 A | 4.600000e-1 | 4.615038e-1 | V | 0.327% | p. 2, Fig. 3 |
| forward voltage at 4.087 A | 5.000000e-1 | 5.018801e-1 | V | 0.376% | p. 2, Fig. 3 |
| forward voltage at 6.065 A | 5.400000e-1 | 5.442336e-1 | V | 0.784% | p. 2, Fig. 3 |

Worst fitting error: 1.026% for forward voltage at 0.888 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 6.950e-16 and worst absolute delta was 3.331e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
