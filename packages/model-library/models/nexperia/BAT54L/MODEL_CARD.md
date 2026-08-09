# BAT54L model card

## Identity

- Manufacturer: Nexperia
- Description: 1 Independent 200mA 2uA@25V 30V 600mA 800mV@100mA DFN1006-2 Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588912994449838080
- Revision: BAT54L v.2, 3 September 2018
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `fd038c4ed6854caad095b40b36e7b20a89830a1e7f6cfefe855fb6df291a8c92`
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
| IS | 4.35629090e-7 | fitted or derived |
| N | 1.06825085e+0 | fitted or derived |
| RS | 2.07727638e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.001 A | 2.130000e-1 | 2.159118e-1 | V | 1.367% | p. 3, Fig. 1 |
| forward voltage at 0.003 A | 2.510000e-1 | 2.504133e-1 | V | 0.234% | p. 3, Fig. 1 |
| forward voltage at 0.01 A | 3.000000e-1 | 2.982174e-1 | V | 0.594% | p. 3, Fig. 1 |
| forward voltage at 0.03 A | 3.610000e-1 | 3.701170e-1 | V | 2.525% | p. 3, Fig. 1 |
| forward voltage at 0.1 A | 5.500000e-1 | 5.487921e-1 | V | 0.220% | p. 3, Fig. 1 |

Worst fitting error: 2.525% for forward voltage at 0.03 A.

Native and WASM agreement: all 11 benches passed. Worst reported relative delta was 1.763e-15 and worst absolute delta was 2.776e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- Reverse recovery and reverse breakdown are not modelled because the supplied datasheet publishes no trr or breakdown voltage/current characteristic.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
