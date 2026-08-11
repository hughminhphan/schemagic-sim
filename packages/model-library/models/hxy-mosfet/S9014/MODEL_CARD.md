# S9014 model card

## Identity

- Manufacturer: HXY MOSFET
- Description: 1 NPN 100mA 100nA 150MHz 200mW 300 300mV 45V 5V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-9 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590440689554395136
- Revision: Not stated
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `3d7eeb39ede84c27cdddebd413d2fb03a4870559d4897e8915890d48351b4b43`
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
| CJE | 1.00000000e-12 | fitted or derived |
| CJC | 1.00000000e-12 | fitted or derived |
| TF | 1.00000000e-9 | fitted or derived |
| IS | 1.00000000e-14 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| BF | 3.48234103e+2 | fitted or derived |
| ISE | 3.69692025e-14 | fitted or derived |
| IKF | 1.39579351e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the source supplies no VBE(on) curve and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 230 and IC 0.0001 A | 1.000000e-4 | 9.812140e-5 | A | 1.879% | p. 2 hFE versus IC graph |
| collector current at IB for hFE 270 and IC 0.001 A | 1.000000e-3 | 1.046804e-3 | A | 4.680% | p. 2 hFE versus IC graph |
| collector current at IB for hFE 300 and IC 0.01 A | 1.000000e-2 | 1.004289e-2 | A | 0.429% | p. 2 hFE versus IC graph |
| collector current at IB for hFE 280 and IC 0.05 A | 5.000000e-2 | 4.596171e-2 | A | 8.077% | p. 2 hFE versus IC graph |
| collector current at IB for hFE 190 and IC 0.1 A | 1.000000e-1 | 1.054612e-1 | A | 5.461% | p. 2 hFE versus IC graph |

Worst fitting error: 8.077% for collector current at IB for hFE 280 and IC 0.05 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 4.246e-12 and worst absolute delta was 1.205e-12.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 DC current-gain fidelity is limited to the Ta = 25 degC hFE versus IC trace on p. 2 at VCE = 5 V, sampled from 0.0001 to 0.1 A collector current. Separate scalar table and saturation bounds do not extend the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
