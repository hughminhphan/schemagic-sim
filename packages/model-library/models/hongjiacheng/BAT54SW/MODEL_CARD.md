# BAT54SW model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603186976149823488
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `47bb86fd13464d7bec5d5aae402b706d4eb6599f17afe9c64238e3634c063052`
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
| IS | 1.25576276e-7 | fitted or derived |
| N | 1.08380388e+0 | fitted or derived |
| RS | 9.44706778e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0001 A | 1.910000e-1 | 1.873870e-1 | V | 1.892% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.0002 A | 2.060000e-1 | 2.068946e-1 | V | 0.434% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.0005 A | 2.270000e-1 | 2.328534e-1 | V | 2.579% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.001 A | 2.460000e-1 | 2.527529e-1 | V | 2.745% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.002 A | 2.660000e-1 | 2.731264e-1 | V | 2.679% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.005 A | 2.980000e-1 | 3.016454e-1 | V | 1.223% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.01 A | 3.260000e-1 | 3.257993e-1 | V | 0.062% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.02 A | 3.590000e-1 | 3.546768e-1 | V | 1.204% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.05 A | 4.170000e-1 | 4.087038e-1 | V | 1.989% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.1 A | 4.740000e-1 | 4.753698e-1 | V | 0.289% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.199 A | 5.780000e-1 | 5.881859e-1 | V | 1.762% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |

Worst fitting error: 2.745% for forward voltage at 0.001 A.

Native and WASM agreement: all 20 benches passed. Worst reported relative delta was 1.639e-14 and worst absolute delta was 3.497e-15.


F2 curve-fit fidelity is supported only for the selected 25 degC forward DC curve over 0.0001 to 0.199 A: Typical instantaneous forward characteristics, Ta = 25 degC (p. 2, Fig. 1, Typical Instaneous Forward Characteristics). Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- The datasheet publishes no measured breakdown row (no V(BR) at a specified IR); only 30 V maximum-rating reverse voltages are given, so breakdown_voltage and breakdown_current remain null.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, breakdown, capacitance, recovery, switching, thermal, surge, and continuous-current fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
