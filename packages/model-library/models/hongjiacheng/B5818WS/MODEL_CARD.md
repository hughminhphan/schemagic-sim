# B5818WS model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603186697421139968
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `b461f5d86aea4f2ad2ecbf61b8f38ba0775aae76f1722f7f888f9de45b63a80b`
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
| IS | 1.58626380e-6 | fitted or derived |
| N | 9.92372738e-1 | fitted or derived |
| RS | 1.03979212e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0263973 A | 2.500000e-1 | 2.522264e-1 | V | 0.891% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.114771 A | 3.000000e-1 | 2.991374e-1 | V | 0.288% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.361403 A | 3.500000e-1 | 3.542239e-1 | V | 1.207% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.707997 A | 4.000000e-1 | 4.075226e-1 | V | 1.881% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 1.04968 A | 4.500000e-1 | 4.531584e-1 | V | 0.702% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 1.39465 A | 5.000000e-1 | 4.963218e-1 | V | 0.736% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 1.80233 A | 5.500000e-1 | 5.452941e-1 | V | 0.856% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 2.27116 A | 6.000000e-1 | 5.999773e-1 | V | 0.004% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 2.81061 A | 6.500000e-1 | 6.615390e-1 | V | 1.775% | p. 2 Fig. 1, Ta=25 degC curve |

Worst fitting error: 1.881% for forward voltage at 0.707997 A.

Native and WASM agreement: all 18 benches passed. Worst reported relative delta was 6.443e-16 and worst absolute delta was 2.220e-16.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
