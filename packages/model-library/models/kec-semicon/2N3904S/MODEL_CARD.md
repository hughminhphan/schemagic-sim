# 2N3904S model card

## Identity

- Manufacturer: KEC Semicon
- Description: 1 NPN 100 200mA 300MHz 300mV 350mW 40V 50nA 6V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586173324804706304
- Revision: Revision No. 3, dated 2003-02-25
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `349bb72e391ed0e645c40b05b032a0bc8a5083828549bc0980592777076fd8e3`
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
| BF | 2.78265380e+2 | fitted or derived |
| ISE | 7.41517719e-14 | fitted or derived |
| IKF | 3.45979853e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; VBE evidence was not included in this hFE-only fit and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 150 and IC 0.0001 A | 1.000000e-4 | 9.388888e-5 | A | 6.111% | p. 3, hFE - IC plot |
| collector current at IB for hFE 160 and IC 0.0003 A | 3.000000e-4 | 3.140006e-4 | A | 4.667% | p. 3, hFE - IC plot |
| collector current at IB for hFE 175 and IC 0.001 A | 1.000000e-3 | 1.082768e-3 | A | 8.277% | p. 3, hFE - IC plot |
| collector current at IB for hFE 190 and IC 0.003 A | 3.000000e-3 | 3.120447e-3 | A | 4.015% | p. 3, hFE - IC plot |
| collector current at IB for hFE 190 and IC 0.01 A | 1.000000e-2 | 9.636870e-3 | A | 3.631% | p. 3, hFE - IC plot |
| collector current at IB for hFE 170 and IC 0.03 A | 3.000000e-2 | 2.527932e-2 | A | 15.736% | p. 3, hFE - IC plot |
| collector current at IB for hFE 70 and IC 0.1 A | 1.000000e-1 | 9.799881e-2 | A | 2.001% | p. 3, hFE - IC plot |
| collector current at IB for hFE 22 and IC 0.3 A | 3.000000e-1 | 3.406216e-1 | A | 13.541% | p. 3, hFE - IC plot |

Worst fitting error: 15.736% for collector current at IB for hFE 170 and IC 0.03 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 1.892e-11 and worst absolute delta was 1.971e-13.

F2 fidelity is limited to the exact cited 25 degC hFE-versus-collector-current curve and VCE bias recorded in `component.json`. Other scalar checks do not extend the curve-fit claim.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- The strict BJT extraction schema does not represent the datasheet's VCBO, VEBO, maximum-current, base-current, power, thermal, VBE(on), switching-time, or other small-signal h-parameter rows.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
