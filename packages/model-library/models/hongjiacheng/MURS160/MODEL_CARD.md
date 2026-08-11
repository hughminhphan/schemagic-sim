# MURS160 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925373495652352
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `3339f1d80c0d20c0547f0e1e7978caefa284db10f06c11409357bce4bdbf6ab3`
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
| IS | 1.93765189e-10 | fitted or derived |
| N | 2.06395711e+0 | fitted or derived |
| RS | 1.18285422e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 9.500000e-1 | 9.481770e-1 | V | 0.192% | p. 2, Fig. 3 |
| forward voltage at 0.1 A | 1.050000e+0 | 1.072163e+0 | V | 2.111% | p. 2, Fig. 3 |
| forward voltage at 0.5 A | 1.150000e+0 | 1.162813e+0 | V | 1.114% | p. 2, Fig. 3 |
| forward voltage at 2 A | 1.250000e+0 | 1.254562e+0 | V | 0.365% | p. 2, Fig. 3 |
| forward voltage at 5 A | 1.350000e+0 | 1.338963e+0 | V | 0.818% | p. 2, Fig. 3 |
| forward voltage at 12 A | 1.450000e+0 | 1.468498e+0 | V | 1.276% | p. 2, Fig. 3 |

Worst fitting error: 2.111% for forward voltage at 0.1 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 6.838e-14 and worst absolute delta was 6.495e-14.495e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
