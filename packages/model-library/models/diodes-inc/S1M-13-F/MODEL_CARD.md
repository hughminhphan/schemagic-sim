# S1M-13-F model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -65℃~+150℃ 1 Independent 1.1V@1A 1A 1kV 5uA@1kV SMA(DO-214AC) Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588880487959416832
- Revision: Document number DS16003 Rev. 24-2, December 2014
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `b02c2d1278212e6ce4486762b4fef19cd2e933f0452272557adf1bfbefe97d59`
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
| IS | 8.87731588e-8 | fitted or derived |
| N | 2.02706633e+0 | fitted or derived |
| RS | 4.06702808e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.045 A | 7.000000e-1 | 6.905541e-1 | V | 1.349% | p. 2, Fig. 2 |
| forward voltage at 0.14 A | 7.400000e-1 | 7.539246e-1 | V | 1.882% | p. 2, Fig. 2 |
| forward voltage at 0.3 A | 7.800000e-1 | 8.003908e-1 | V | 2.614% | p. 2, Fig. 2 |
| forward voltage at 0.5 A | 8.200000e-1 | 8.353074e-1 | V | 1.867% | p. 2, Fig. 2 |
| forward voltage at 0.77 A | 8.600000e-1 | 8.689266e-1 | V | 1.038% | p. 2, Fig. 2 |
| forward voltage at 1.14 A | 9.000000e-1 | 9.045478e-1 | V | 0.505% | p. 2, Fig. 2 |
| forward voltage at 1.78 A | 9.600000e-1 | 9.539387e-1 | V | 0.631% | p. 2, Fig. 2 |
| forward voltage at 2.65 A | 1.020000e+0 | 1.010186e+0 | V | 0.962% | p. 2, Fig. 2 |
| forward voltage at 3.66 A | 1.080000e+0 | 1.068193e+0 | V | 1.093% | p. 2, Fig. 2 |
| forward voltage at 5.52 A | 1.160000e+0 | 1.165384e+0 | V | 0.464% | p. 2, Fig. 2 |
| forward voltage at 7.62 A | 1.240000e+0 | 1.267695e+0 | V | 2.233% | p. 2, Fig. 2 |

Worst fitting error: 2.614% for forward voltage at 0.3 A.

Native and WASM agreement: all 24 benches passed. Worst reported relative delta was 1.760e-15 and worst absolute delta was 1.221e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No breakdown voltage/current pair is available, and no reverse I-V curve is published. Capacitance has only one tabulated point, while reverse-recovery test threshold and load resistance are unspecified.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
