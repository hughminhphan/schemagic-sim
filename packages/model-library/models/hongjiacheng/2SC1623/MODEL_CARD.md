# 2SC1623 model card

## Identity

- Manufacturer: hongjiacheng
- Description: bjt from hongjiacheng
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879617221033984
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `8104064ebdacf6293f29ee3e64485abe4c198a51424e770e9ec1c4175bb40de5`
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
| BF | 3.09400162e+2 | fitted or derived |
| ISE | 0.00000000e+0 | fitted or derived |
| IKF | 2.53547661e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the fit uses only the cited 25 degC hFE curve, which does not independently constrain IS; published VBE curves are outside the fitted claim |
| ISE | 0.00000000e+0 | undefined | no low-current roll-off is resolvable within the digitised range |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 340 and IC 0.0001 A | 1.000000e-4 | 9.588748e-5 | A | 4.113% | p. 2, Fig.2 |
| collector current at IB for hFE 300 and IC 0.001 A | 1.000000e-3 | 1.082065e-3 | A | 8.207% | p. 2, Fig.2 |
| collector current at IB for hFE 310 and IC 0.01 A | 1.000000e-2 | 1.012405e-2 | A | 1.241% | p. 2, Fig.2 |
| collector current at IB for hFE 310 and IC 0.05 A | 5.000000e-2 | 4.494575e-2 | A | 10.108% | p. 2, Fig.2 |
| collector current at IB for hFE 220 and IC 0.1 A | 1.000000e-1 | 1.059035e-1 | A | 5.903% | p. 2, Fig.2 |

Worst fitting error: 10.108% for collector current at IB for hFE 310 and IC 0.05 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 1.112e-10 and worst absolute delta was 3.077e-12.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 fitting covers only the cited 25 degC DC current-gain curve at VCE = 6 V; base-emitter transfer, output-characteristic, and saturation-voltage curves were not fitted.
- Tabulated saturation maxima are hard-bound checks only and do not expand the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
