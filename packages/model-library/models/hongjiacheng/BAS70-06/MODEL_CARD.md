# BAS70-06 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603186701183700992
- Revision: Rev.1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2
- SHA-256: `0de8e09689f216a5e948e4a8740065d79164c74dfbea80ec348caf73a8b803ba`
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
| IS | 3.72198923e-7 | fitted or derived |
| N | 2.38115006e+0 | fitted or derived |
| RS | 0.00000000e+0 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| RS | 0.00000000e+0 | undefined | no series resistance is resolvable from the digitised forward range |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1e-05 A | 2.000000e-1 | 2.049310e-1 | V | 2.465% | p. 2 Fig.1 |
| forward voltage at 5e-05 A | 3.000000e-1 | 3.022604e-1 | V | 0.753% | p. 2 Fig.1 |
| forward voltage at 0.0002 A | 4.000000e-1 | 3.872978e-1 | V | 3.176% | p. 2 Fig.1 |
| forward voltage at 0.001 A | 5.000000e-1 | 4.863288e-1 | V | 2.734% | p. 2 Fig.1 |
| forward voltage at 0.008 A | 6.000000e-1 | 6.143779e-1 | V | 2.396% | p. 2 Fig.1 |
| forward voltage at 0.05 A | 7.000000e-1 | 7.272410e-1 | V | 3.892% | p. 2 Fig.1 |

Worst fitting error: 3.892% for forward voltage at 0.05 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 2.628e-16 and worst absolute delta was 1.110e-16.


F2 curve-fit fidelity is supported only for the selected 25 degC forward DC curve over 1e-05 to 0.05 A: Forward IV Characteristic (p. 2 Fig.1). Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, breakdown, capacitance, recovery, switching, thermal, surge, and continuous-current fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
