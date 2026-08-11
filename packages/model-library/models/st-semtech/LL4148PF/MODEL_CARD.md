# LL4148PF model card

## Identity

- Manufacturer: ST Semtech
- Description: 1 Independent 1V@10mA 200mA 25nA 4ns 500mW 75V LL-34 Switching Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8589836936899821568
- Revision: Rev. 02, dated 09/12/2021
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `e2ab3a38bc2c82fda9adce0cbb359063257d14d21e092d798b68997f5382456a`
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
| IS | 4.24588569e-9 | fitted or derived |
| N | 1.95190266e+0 | fitted or derived |
| RS | 4.76622788e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.05 A | 8.400000e-1 | 8.458199e-1 | V | 0.693% | p. 3, Fig. 1, Forward Characteristics |
| forward voltage at 0.1 A | 9.000000e-1 | 9.046451e-1 | V | 0.516% | p. 3, Fig. 1, Forward Characteristics |
| forward voltage at 0.2 A | 9.800000e-1 | 9.873015e-1 | V | 0.745% | p. 3, Fig. 1, Forward Characteristics |
| forward voltage at 0.3 A | 1.050000e+0 | 1.055434e+0 | V | 0.518% | p. 3, Fig. 1, Forward Characteristics |

Worst fitting error: 0.745% for forward voltage at 0.2 A.

Native and WASM agreement: all 9 benches passed. Worst reported relative delta was 2.670e-15 and worst absolute delta was 1.998e-15.998e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
