# MMBT5401 model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1 PNP 100 100MHz 100nA 160V 200mV 300mW 5V 600mA PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590905108882403328
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `b828cd959843a9e7d4558e792dd23c9e3aa0cbe50508a8422541f10fbc7c3a95`
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
| BF | 2.30391228e+2 | fitted or derived |
| ISE | 6.11112424e-15 | fitted or derived |
| IKF | 4.79499420e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the fit uses only the cited 25 degC hFE curve, which does not independently constrain IS; published VBE curves are outside the fitted claim |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 230 and IC 0.0001 A | 1.000000e-4 | 9.802235e-5 | A | 1.978% | p. 2, Fig. 2 |
| collector current at IB for hFE 225 and IC 0.001 A | 1.000000e-3 | 1.034792e-3 | A | 3.479% | p. 2, Fig. 2 |
| collector current at IB for hFE 220 and IC 0.01 A | 1.000000e-2 | 1.054831e-2 | A | 5.483% | p. 2, Fig. 2 |
| collector current at IB for hFE 210 and IC 0.1 A | 1.000000e-1 | 9.539477e-2 | A | 4.605% | p. 2, Fig. 2 |
| collector current at IB for hFE 180 and IC 0.3 A | 3.000000e-1 | 2.614201e-1 | A | 12.860% | p. 2, Fig. 2 |
| collector current at IB for hFE 100 and IC 0.5 A | 5.000000e-1 | 5.621799e-1 | A | 12.436% | p. 2, Fig. 2 |

Worst fitting error: 12.860% for collector current at IB for hFE 180 and IC 0.3 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 1.812e-11 and worst absolute delta was 2.629e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 fitting covers only the cited 25 degC DC current-gain curve; base-emitter transfer, output-characteristic, and saturation-voltage curves were not fitted.
- Tabulated saturation maxima are bound-checked but are not curve-fitted claims.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
