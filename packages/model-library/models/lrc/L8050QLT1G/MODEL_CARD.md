# L8050QLT1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 NPN 100 150nA 225mW 25V 500mV 5V 800mA NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-9 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586178864515330048
- Revision: Rev.O
- Accessed: 2026-08-11
- Referenced pages: PDF page 1, PDF page 2, PDF page 3, PDF page 4
- SHA-256: `0ec0d9f04eaf2214217fec557b75d372fe49044b691dfff04ff78a302d344875`
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
| BF | 1.95283639e+2 | fitted or derived |
| ISE | 2.44574449e-14 | fitted or derived |
| IKF | 9.56867934e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the source supplies no VBE(on) curve and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 135 and IC 1e-05 A | 1.000000e-5 | 9.809411e-6 | A | 1.906% | PDF page 3, Fig. 1 |
| collector current at IB for hFE 155 and IC 0.0001 A | 1.000000e-4 | 1.037327e-4 | A | 3.733% | PDF page 3, Fig. 1 |
| collector current at IB for hFE 175 and IC 0.001 A | 1.000000e-3 | 1.014552e-3 | A | 1.455% | PDF page 3, Fig. 1 |
| collector current at IB for hFE 190 and IC 0.01 A | 1.000000e-2 | 9.735453e-3 | A | 2.645% | PDF page 3, Fig. 1 |
| collector current at IB for hFE 175 and IC 0.1 A | 1.000000e-1 | 9.920083e-2 | A | 0.799% | PDF page 3, Fig. 1 |
| collector current at IB for hFE 105 and IC 0.8 A | 8.000000e-1 | 8.023957e-1 | A | 0.299% | PDF page 3, Fig. 1 |

Worst fitting error: 3.733% for collector current at IB for hFE 155 and IC 0.0001 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 4.458e-11 and worst absolute delta was 3.125e-11.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 DC current-gain fidelity is limited to the 25 degC hFE versus IC curve on PDF p. 3 Figure 1 at VCE = 1 V, sampled from 0.00001 to 0.8 A collector current. The Q gain-rank and saturation bounds are separate scalar checks and do not extend the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
