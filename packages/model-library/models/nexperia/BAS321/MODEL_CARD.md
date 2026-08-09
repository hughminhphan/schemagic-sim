# BAS321 model card

## Identity

- Manufacturer: Nexperia
- Description: 1.25V@200mA 100nA@200V 200V 250mA 9A Independent SOD-323 Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586175000180744192
- Revision: BAS321 v4, 1 July 2022
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8, p. 9, p. 10
- SHA-256: `ac1795c667591e2a4839810942e115ca200b6202723167cc45e253c020bc6930`
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
| IS | 4.18180034e-15 | fitted or derived |
| N | 1.10379827e+0 | fitted or derived |
| RS | 8.08380618e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.02 A | 8.440000e-1 | 8.497035e-1 | V | 0.676% | p. 4, Fig. 2 |
| forward voltage at 0.05 A | 8.950000e-1 | 9.001147e-1 | V | 0.571% | p. 4, Fig. 2 |
| forward voltage at 0.1 A | 9.540000e-1 | 9.603229e-1 | V | 0.663% | p. 4, Fig. 2 |
| forward voltage at 0.2 A | 1.054000e+0 | 1.060950e+0 | V | 0.659% | p. 4, Fig. 2 |
| forward voltage at 0.3 A | 1.148000e+0 | 1.153364e+0 | V | 0.467% | p. 4, Fig. 2 |
| forward voltage at 0.4 A | 1.238000e+0 | 1.242415e+0 | V | 0.357% | p. 4, Fig. 2 |
| forward voltage at 0.5 A | 1.322000e+0 | 1.329624e+0 | V | 0.577% | p. 4, Fig. 2 |

Worst fitting error: 0.676% for forward voltage at 0.02 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 3.691e-16 and worst absolute delta was 3.331e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No breakdown branch was extracted because the datasheet is for a general-purpose signal diode and publishes no zener breakdown-voltage/current pair.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
