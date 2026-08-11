# ES1G model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603067493791510528
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `02dbfc778b960aff6fa782f758bdbe07de8e85cc4af52c7ed8194fb0f6f3ed30`
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
| IS | 1.68781226e-10 | fitted or derived |
| N | 1.77421054e+0 | fitted or derived |
| RS | 1.16907602e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 8.200000e-1 | 8.214182e-1 | V | 0.173% | p. 2 Fig. 3 |
| forward voltage at 0.1 A | 9.100000e-1 | 9.281355e-1 | V | 1.993% | p. 2 Fig. 3 |
| forward voltage at 1 A | 1.050000e+0 | 1.044322e+0 | V | 0.541% | p. 2 Fig. 3 |
| forward voltage at 10 A | 1.240000e+0 | 1.255204e+0 | V | 1.226% | p. 2 Fig. 3 |
| forward voltage at 20 A | 1.400000e+0 | 1.403920e+0 | V | 0.280% | p. 2 Fig. 3 |

Worst fitting error: 1.993% for forward voltage at 0.1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 3.881e-14 and worst absolute delta was 3.197e-14.197e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
