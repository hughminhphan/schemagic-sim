# SS215 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603363983772966912
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `dd6685a75cdccbe3a6a290f916cb29ad27e9252703862dc167c4967c2ff12bf4`
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
| IS | 1.02889030e-7 | fitted or derived |
| N | 1.93694318e+0 | fitted or derived |
| RS | 2.59045005e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 5.800000e-1 | 5.753842e-1 | V | 0.796% | p. 2 Fig. 3 |
| forward voltage at 0.1 A | 6.700000e-1 | 6.909738e-1 | V | 3.130% | p. 2 Fig. 3 |
| forward voltage at 1 A | 8.000000e-1 | 8.086620e-1 | V | 1.083% | p. 2 Fig. 3 |
| forward voltage at 10 A | 9.600000e-1 | 9.473330e-1 | V | 1.319% | p. 2 Fig. 3 |
| forward voltage at 50 A | 1.120000e+0 | 1.131582e+0 | V | 1.034% | p. 2 Fig. 3 |

Worst fitting error: 3.130% for forward voltage at 0.1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 3.125e-13 and worst absolute delta was 1.811e-13.811e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
