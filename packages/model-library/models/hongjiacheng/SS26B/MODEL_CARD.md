# SS26B model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925665608495104
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `19e0b773decbc57128ac33e6cfe3e953b0bc6a1599fab81d5d906acfdf507cf2`
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
| IS | 2.09024054e-4 | fitted or derived |
| N | 2.10654387e+0 | fitted or derived |
| RS | 1.84110052e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 3.400000e-1 | 3.381569e-1 | V | 0.542% | p. 2 Fig.3 |
| forward voltage at 0.2 A | 3.710000e-1 | 3.777076e-1 | V | 1.808% | p. 2 Fig.3 |
| forward voltage at 0.5 A | 4.260000e-1 | 4.331214e-1 | V | 1.672% | p. 2 Fig.3 |
| forward voltage at 1 A | 4.760000e-1 | 4.800821e-1 | V | 0.858% | p. 2 Fig.3 |
| forward voltage at 2 A | 5.380000e-1 | 5.362539e-1 | V | 0.325% | p. 2 Fig.3 |
| forward voltage at 5 A | 6.440000e-1 | 6.414081e-1 | V | 0.402% | p. 2 Fig.3 |
| forward voltage at 10 A | 7.620000e-1 | 7.712286e-1 | V | 1.211% | p. 2 Fig.3 |

Worst fitting error: 1.808% for forward voltage at 0.2 A.

Native and WASM agreement: all 17 benches passed. Worst reported relative delta was 2.608e-15 and worst absolute delta was 9.992e-16.992e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
