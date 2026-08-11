# M6 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603067851838676992
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `03f2b9959f3611e4c90bdf6b79de906aebb1c9c6d573ad2d462d7456f381deb7`
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
| IS | 4.66521634e-7 | fitted or derived |
| N | 2.31680134e+0 | fitted or derived |
| RS | 2.39885567e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 6.000000e-1 | 5.978510e-1 | V | 0.358% | p. 2 Fig.3 |
| forward voltage at 0.03 A | 6.600000e-1 | 6.641620e-1 | V | 0.631% | p. 2 Fig.3 |
| forward voltage at 0.1 A | 7.200000e-1 | 7.379872e-1 | V | 2.498% | p. 2 Fig.3 |
| forward voltage at 0.3 A | 8.000000e-1 | 8.086179e-1 | V | 1.077% | p. 2 Fig.3 |
| forward voltage at 1 A | 8.800000e-1 | 8.975565e-1 | V | 1.995% | p. 2 Fig.3 |
| forward voltage at 2 A | 9.800000e-1 | 9.630811e-1 | V | 1.726% | p. 2 Fig.3 |
| forward voltage at 5 A | 1.100000e+0 | 1.089954e+0 | V | 0.913% | p. 2 Fig.3 |
| forward voltage at 10 A | 1.230000e+0 | 1.251433e+0 | V | 1.743% | p. 2 Fig.3 |

Worst fitting error: 2.498% for forward voltage at 0.1 A.

Native and WASM agreement: all 11 benches passed. Worst reported relative delta was 5.321e-15 and worst absolute delta was 3.553e-15.553e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
