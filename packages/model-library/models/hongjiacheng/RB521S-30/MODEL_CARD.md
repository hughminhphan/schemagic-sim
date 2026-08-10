# RB521S-30 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603007879490523136
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `3458db1e3f512fdef9e786d2021bf41f7df026970d78eca94f7123ae1412b652`
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
| IS | 1.04440658e-7 | fitted or derived |
| N | 9.31138523e-1 | fitted or derived |
| RS | 3.87818302e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1.403e-05 A | 1.200000e-1 | 1.182026e-1 | V | 1.498% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.00010158 A | 1.600000e-1 | 1.657604e-1 | V | 3.600% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.00118757 A | 2.200000e-1 | 2.253767e-1 | V | 2.444% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.0106131 A | 2.800000e-1 | 2.817782e-1 | V | 0.635% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.0356194 A | 3.200000e-1 | 3.206366e-1 | V | 0.199% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.0817371 A | 3.600000e-1 | 3.585262e-1 | V | 0.409% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.169155 A | 4.200000e-1 | 4.099447e-1 | V | 2.394% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.309249 A | 4.800000e-1 | 4.788065e-1 | V | 0.249% | p. 2 Fig. 1, Ta=25 degC curve |
| forward voltage at 0.432194 A | 5.200000e-1 | 5.345481e-1 | V | 2.798% | p. 2 Fig. 1, Ta=25 degC curve |

Worst fitting error: 3.600% for forward voltage at 0.00010158 A.

Native and WASM agreement: all 21 benches passed. Worst reported relative delta was 1.602e-13 and worst absolute delta was 2.007e-14.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
