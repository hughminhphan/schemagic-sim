# MMBD7000LT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃@(Tj) 1 Pair Series Connection 1.6A 100V 100uA@50V 200mA 300mW 4ns 750mV@100mA SOT-23 Switching Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586175462753619968
- Revision: June 2017 - Rev. 8
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `6639d2102c7ddd0a49fff847ed6e15f53fe596e185be170a1bbba7174b490ea6`
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
| IS | 3.13648813e-9 | fitted or derived |
| N | 1.87249101e+0 | fitted or derived |
| RS | 1.03079112e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0001 A | 5.000000e-1 | 5.023337e-1 | V | 0.467% | p. 3, Figure 2, TA = 25 degC curve |
| forward voltage at 0.001 A | 6.100000e-1 | 6.147787e-1 | V | 0.783% | p. 3, Figure 2, TA = 25 degC curve |
| forward voltage at 0.01 A | 7.200000e-1 | 7.355741e-1 | V | 2.163% | p. 3, Figure 2, TA = 25 degC curve |
| forward voltage at 0.03 A | 8.200000e-1 | 8.093977e-1 | V | 1.293% | p. 3, Figure 2, TA = 25 degC curve |
| forward voltage at 0.1 A | 9.300000e-1 | 9.398637e-1 | V | 1.061% | p. 3, Figure 2, TA = 25 degC curve |

Worst fitting error: 2.163% for forward voltage at 0.01 A.

Native and WASM agreement: all 12 benches passed. Worst reported relative delta was 2.168e-14 and worst absolute delta was 1.099e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- An honest F2 attempt is supported by the three digitized characteristic curves, tabulated forward-voltage bounds, reverse leakage, capacitance, reverse recovery, and breakdown test point. Curve digitization remains approximate, the datasheet provides no typical numeric forward-voltage table, and surge-current behavior is not modeled by the diode card.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
