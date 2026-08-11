# ES2A model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603080179069964288
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `d0c8b65118a0ad631758c21f543007272f63cbc8913b901350d507265f357009`
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
| IS | 4.88784749e-7 | fitted or derived |
| N | 2.00475237e+0 | fitted or derived |
| RS | 5.11538564e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.001 A | 4.000000e-1 | 3.953805e-1 | V | 1.155% | p. 2, Fig. 3 |
| forward voltage at 0.01 A | 5.000000e-1 | 5.152135e-1 | V | 3.043% | p. 2, Fig. 3 |
| forward voltage at 0.1 A | 6.200000e-1 | 6.392104e-1 | V | 3.098% | p. 2, Fig. 3 |
| forward voltage at 1 A | 8.200000e-1 | 8.046441e-1 | V | 1.873% | p. 2, Fig. 3 |
| forward voltage at 5 A | 1.120000e+0 | 1.092713e+0 | V | 2.436% | p. 2, Fig. 3 |
| forward voltage at 10 A | 1.350000e+0 | 1.384424e+0 | V | 2.550% | p. 2, Fig. 3 |

Worst fitting error: 3.098% for forward voltage at 0.1 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 2.716e-14 and worst absolute delta was 1.088e-14.088e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
