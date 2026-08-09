# BAT54SLT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃ 1 Pair Series Connection 200mA 2uA@25V 30V 800mV@100mA SOT-23 Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586171992684285952
- Revision: November 2011, Rev. 15
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `11fae56a6a0cc832074bdc224af5bb8fdca2d57aeb19c2f560c35a7354056212`
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
| IS | 1.76490877e-8 | fitted or derived |
| N | 9.93662474e-1 | fitted or derived |
| RS | 5.91409452e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0001 A | 2.210000e-1 | 2.221778e-1 | V | 0.533% | p. 3, Figure 2 |
| forward voltage at 0.001 A | 2.790000e-1 | 2.818848e-1 | V | 1.034% | p. 3, Figure 2 |
| forward voltage at 0.01 A | 3.450000e-1 | 3.463858e-1 | V | 0.402% | p. 3, Figure 2 |
| forward voltage at 0.1 A | 4.560000e-1 | 4.587914e-1 | V | 0.612% | p. 3, Figure 2 |

Worst fitting error: 1.034% for forward voltage at 0.001 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 1.060e-14 and worst absolute delta was 3.053e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
