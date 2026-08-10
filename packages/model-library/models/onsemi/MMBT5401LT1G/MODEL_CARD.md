# MMBT5401LT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃ 1 PNP 150V 200mV 300MHz 300mW 500mA 50nA 5V 60 PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586172884934922240
- Revision: Rev. 11, June 2012
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `617c73e42f9a6297d98416b8fb214d2690d267449cc64d604c83c863c7e69e14`
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
| IS | 3.20347084e-14 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| BF | 1.20854715e+2 | fitted or derived |
| ISE | 4.78567599e-13 | fitted or derived |
| IKF | 1.11652812e+0 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 3.20347084e-14 | undefined | derived from the cited VBE(on) curve at IC = 0.01 A, VBE = 0.68 V; hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 58 and IC 0.0001 A | 1.000000e-4 | 9.579947e-5 | A | 4.201% | p. 3 fig. 1 |
| collector current at IB for hFE 70 and IC 0.0005 A | 5.000000e-4 | 5.231577e-4 | A | 4.632% | p. 3 fig. 1 |
| collector current at IB for hFE 78 and IC 0.001 A | 1.000000e-3 | 1.024757e-3 | A | 2.476% | p. 3 fig. 1 |
| collector current at IB for hFE 92 and IC 0.005 A | 5.000000e-3 | 5.101884e-3 | A | 2.038% | p. 3 fig. 1 |
| collector current at IB for hFE 98 and IC 0.01 A | 1.000000e-2 | 1.005308e-2 | A | 0.531% | p. 3 fig. 1 |
| collector current at IB for hFE 108 and IC 0.03 A | 3.000000e-2 | 2.875221e-2 | A | 4.159% | p. 3 fig. 1 |
| collector current at IB for hFE 109 and IC 0.05 A | 5.000000e-2 | 4.794614e-2 | A | 4.108% | p. 3 fig. 1 |
| collector current at IB for hFE 100 and IC 0.1 A | 1.000000e-1 | 1.032701e-1 | A | 3.270% | p. 3 fig. 1 |

Worst fitting error: 4.632% for collector current at IB for hFE 70 and IC 0.0005 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 3.709e-11 and worst absolute delta was 2.596e-11.

F2 fidelity is limited to the exact cited 25 degC hFE-versus-collector-current curve and VCE bias recorded in `component.json`. Other scalar checks do not extend the curve-fit claim.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
