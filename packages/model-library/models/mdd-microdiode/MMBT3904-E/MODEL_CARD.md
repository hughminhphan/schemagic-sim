# MMBT3904-E model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: bjt from MDD Microdiode Semiconductor
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8604434048337133568
- Revision: Rev:2024A1
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `f58ab3457a23b7cec668f3dd2ea58c4e59ff7da0030d4488d863e5a6e748afa1`
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
| BF | 2.81001764e+2 | fitted or derived |
| ISE | 2.46036687e-14 | fitted or derived |
| IKF | 3.02613607e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the fit uses only the cited 25 degC hFE curve, which does not independently constrain IS; published VBE curves are outside the fitted claim |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 220 and IC 0.0001 A | 1.000000e-4 | 9.649461e-5 | A | 3.505% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 223 and IC 0.0003 A | 3.000000e-4 | 3.078702e-4 | A | 2.623% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 225 and IC 0.001 A | 1.000000e-3 | 1.057917e-3 | A | 5.792% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 225 and IC 0.003 A | 3.000000e-3 | 3.102798e-3 | A | 3.427% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 220 and IC 0.01 A | 1.000000e-2 | 9.222851e-3 | A | 7.771% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 155 and IC 0.03 A | 3.000000e-2 | 2.749920e-2 | A | 8.336% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 55 and IC 0.1 A | 1.000000e-1 | 1.091701e-1 | A | 9.170% | p. 2, Typical Characteristics, hFE versus IC |

Worst fitting error: 9.170% for collector current at IB for hFE 55 and IC 0.1 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 1.841e-11 and worst absolute delta was 2.180e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 fitting covers only the cited 25 degC DC current-gain curve at VCE = 1 V; base-emitter transfer, output-characteristic, and saturation-voltage curves were not fitted.
- Tabulated saturation maxima are hard-bound checks only and do not expand the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
