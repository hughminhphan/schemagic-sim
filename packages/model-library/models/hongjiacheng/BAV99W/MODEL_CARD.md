# BAV99W model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1 Pair Series Connection 1.25V@150mA 150mA 2.5uA 200mW 2A 4ns 75V SOT-323 Switching Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602998422597083136
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `bff988f7117d525f1ac017d1caebdccbcdd65ba52fcba97f82162ef4a60934e8`
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
| IS | 6.57108595e-10 | fitted or derived |
| N | 1.78626320e+0 | fitted or derived |
| RS | 1.14856026e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 3.2e-05 A | 5.000000e-1 | 4.987087e-1 | V | 0.258% | p. 2, Fig. 1 |
| forward voltage at 0.00036 A | 6.000000e-1 | 6.109099e-1 | V | 1.818% | p. 2, Fig. 1 |
| forward voltage at 0.0031 A | 7.000000e-1 | 7.135314e-1 | V | 1.933% | p. 2, Fig. 1 |
| forward voltage at 0.021 A | 8.200000e-1 | 8.224797e-1 | V | 0.302% | p. 2, Fig. 1 |
| forward voltage at 0.05 A | 9.000000e-1 | 8.958678e-1 | V | 0.459% | p. 2, Fig. 1 |
| forward voltage at 0.105 A | 1.000000e+0 | 9.933173e-1 | V | 0.668% | p. 2, Fig. 1 |
| forward voltage at 0.19 A | 1.100000e+0 | 1.118345e+0 | V | 1.668% | p. 2, Fig. 1 |

Worst fitting error: 1.933% for forward voltage at 0.0031 A.

Native and WASM agreement: all 12 benches passed. Worst reported relative delta was 5.028e-15 and worst absolute delta was 3.331e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
