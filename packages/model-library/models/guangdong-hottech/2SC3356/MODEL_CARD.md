# 2SC3356 model card

## Identity

- Manufacturer: Guangdong Hottech
- Description: 1 NPN 100mA 12V 1uA 200mW 300 3V 7GHz NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588918618939252736
- Revision: Not stated in PDF
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `2878dcdf31f8ed435655c110b8c60776312a12186dd5b865eb8748a67a855475`
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
| BF | 1.17396741e+2 | fitted or derived |
| ISE | 2.65788212e-14 | fitted or derived |
| IKF | 4.87841047e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; VBE evidence was not included in this hFE-only fit and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 118 and IC 0.0005 A | 5.000000e-4 | 4.999091e-4 | A | 0.018% | p. 2, Typical Characteristics, DC CURRENT GAIN vs. COLLECTOR CURRENT |
| collector current at IB for hFE 120 and IC 0.001 A | 1.000000e-3 | 9.986022e-4 | A | 0.140% | p. 2, Typical Characteristics, DC CURRENT GAIN vs. COLLECTOR CURRENT |
| collector current at IB for hFE 121 and IC 0.002 A | 2.000000e-3 | 2.003598e-3 | A | 0.180% | p. 2, Typical Characteristics, DC CURRENT GAIN vs. COLLECTOR CURRENT |
| collector current at IB for hFE 122 and IC 0.005 A | 5.000000e-3 | 5.008016e-3 | A | 0.160% | p. 2, Typical Characteristics, DC CURRENT GAIN vs. COLLECTOR CURRENT |
| collector current at IB for hFE 122 and IC 0.01 A | 1.000000e-2 | 1.000305e-2 | A | 0.031% | p. 2, Typical Characteristics, DC CURRENT GAIN vs. COLLECTOR CURRENT |
| collector current at IB for hFE 121 and IC 0.02 A | 2.000000e-2 | 1.993518e-2 | A | 0.324% | p. 2, Typical Characteristics, DC CURRENT GAIN vs. COLLECTOR CURRENT |
| collector current at IB for hFE 115 and IC 0.05 A | 5.000000e-2 | 5.005615e-2 | A | 0.112% | p. 2, Typical Characteristics, DC CURRENT GAIN vs. COLLECTOR CURRENT |

Worst fitting error: 0.324% for collector current at IB for hFE 121 and IC 0.02 A.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 3.202e-11 and worst absolute delta was 7.578e-11.

F2 fidelity is limited to the exact cited 25 degC hFE-versus-collector-current curve and VCE bias recorded in `component.json`. Other scalar checks do not extend the curve-fit claim.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
