# MMBT3906LT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃ 1 PNP 200mA 225mW 250MHz 250mV 40V 50nA 5V 60 PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent re-reviewer (P6 proving-50 final)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586176242927718400
- Revision: December 2013, Rev. 11
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `bb3250d13b4d90bc51100864f362463127d719b67f0d085d84510ae0161cd367`
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
| IS | 1.47079044e-14 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| BF | 3.22494984e+2 | fitted or derived |
| ISE | 1.41872893e-13 | fitted or derived |
| IKF | 3.40673319e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.47079044e-14 | undefined | derived from the cited VBE(on) curve at IC = 0.01 A, VBE = 0.7 V; hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 180 and IC 0.001 A | 1.000000e-3 | 9.942539e-4 | A | 0.575% | p. 5, fig. 13 |
| collector current at IB for hFE 175 and IC 0.01 A | 1.000000e-2 | 1.069358e-2 | A | 6.936% | p. 5, fig. 13 |
| collector current at IB for hFE 160 and IC 0.03 A | 3.000000e-2 | 2.772548e-2 | A | 7.582% | p. 5, fig. 13 |
| collector current at IB for hFE 125 and IC 0.05 A | 5.000000e-2 | 4.697658e-2 | A | 6.047% | p. 5, fig. 13 |
| collector current at IB for hFE 65 and IC 0.1 A | 1.000000e-1 | 1.083206e-1 | A | 8.321% | p. 5, fig. 13 |

Worst fitting error: 8.321% for collector current at IB for hFE 65 and IC 0.1 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 7.060e-13 and worst absolute delta was 2.276e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- VAF is omitted because the datasheet has no output-characteristics figure from which to extract an Early voltage; temperature-dependent parameters, reverse operation, noise, and full transient-curve digitization are also outside this minimum F2 extraction.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
