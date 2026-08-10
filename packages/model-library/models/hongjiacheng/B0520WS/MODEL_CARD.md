# B0520WS model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602990819137626112
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3
- SHA-256: `e820f20f3c2a9ea5e6f5e6e778f4247ede3eef5cd48350c6efc41f5a1211f78f`
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
| IS | 3.28214064e-6 | fitted or derived |
| N | 1.06706136e+0 | fitted or derived |
| RS | 8.94344076e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.011 A | 2.250000e-1 | 2.250210e-1 | V | 0.009% | 2 (Fig.1) |
| forward voltage at 0.02 A | 2.400000e-1 | 2.423222e-1 | V | 0.968% | 2 (Fig.1) |
| forward voltage at 0.031 A | 2.530000e-1 | 2.554000e-1 | V | 0.949% | 2 (Fig.1) |
| forward voltage at 0.05 A | 2.670000e-1 | 2.702917e-1 | V | 1.233% | 2 (Fig.1) |
| forward voltage at 0.07 A | 2.790000e-1 | 2.813663e-1 | V | 0.848% | 2 (Fig.1) |
| forward voltage at 0.098 A | 2.910000e-1 | 2.931565e-1 | V | 0.741% | 2 (Fig.1) |
| forward voltage at 0.15 A | 3.080000e-1 | 3.095550e-1 | V | 0.505% | 2 (Fig.1) |
| forward voltage at 0.2 A | 3.210000e-1 | 3.219664e-1 | V | 0.301% | 2 (Fig.1) |
| forward voltage at 0.29 A | 3.400000e-1 | 3.402703e-1 | V | 0.080% | 2 (Fig.1) |
| forward voltage at 0.48 A | 3.700000e-1 | 3.711703e-1 | V | 0.316% | 2 (Fig.1) |
| forward voltage at 0.68 A | 3.950000e-1 | 3.986702e-1 | V | 0.929% | 2 (Fig.1) |
| forward voltage at 0.9 A | 4.230000e-1 | 4.260819e-1 | V | 0.729% | 2 (Fig.1) |
| forward voltage at 0.95 A | 4.300000e-1 | 4.320458e-1 | V | 0.476% | 2 (Fig.1) |

Worst fitting error: 1.233% for forward voltage at 0.05 A.

Native and WASM agreement: all 21 benches passed. Worst reported relative delta was 2.638e-15 and worst absolute delta was 6.106e-16.


F2 curve-fit fidelity is supported only for the selected 25 degC forward DC curve over 0.011 to 0.95 A: Typical instantaneous forward characteristics, Ta=25C (Fig.1) (2 (Fig.1)). Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, breakdown, capacitance, recovery, switching, thermal, surge, and continuous-current fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
