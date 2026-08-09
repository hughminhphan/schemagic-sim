# BCX56-10 model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1 NPN 100nA 130MHz 1A 40 500mV 500mW 5V 80V NPN SOT-89 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879693661683712
- Revision: Rev:1.1
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `4a5d574d5f0a9799f1a7b413713f532352e2effca38476a922d0893c0d9d6f36`
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
| BF | 1.57231715e+2 | fitted or derived |
| ISE | 2.15435032e-15 | fitted or derived |
| IKF | 7.47908782e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the fit uses only the cited 25 degC hFE curve, which does not independently constrain IS; published VBE curves are outside the fitted claim |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 160 and IC 0.001 A | 1.000000e-3 | 9.873584e-4 | A | 1.264% | p. 3 Fig. 2 |
| collector current at IB for hFE 150 and IC 0.01 A | 1.000000e-2 | 1.043742e-2 | A | 4.374% | p. 3 Fig. 2 |
| collector current at IB for hFE 145 and IC 0.1 A | 1.000000e-1 | 9.711849e-2 | A | 2.882% | p. 3 Fig. 2 |
| collector current at IB for hFE 100 and IC 0.5 A | 5.000000e-1 | 4.841609e-1 | A | 3.168% | p. 3 Fig. 2 |
| collector current at IB for hFE 65 and IC 1 A | 1.000000e+0 | 1.031851e+0 | A | 3.185% | p. 3 Fig. 2 |

Worst fitting error: 4.374% for collector current at IB for hFE 150 and IC 0.01 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 3.092e-12 and worst absolute delta was 2.855e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- Only one tabulated VCE(sat) bound is published, no tabulated VBE(sat) value is published, and non-DC fT/Cobo/Cibo evidence is outside the requested DC-only extraction scope.

- F2 fitting covers only the cited 25 degC DC current-gain curve at VCE = 2 V; base-emitter transfer, output-characteristic, and saturation-voltage curves were not fitted.
- Tabulated saturation maxima are hard-bound checks only and do not expand the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
