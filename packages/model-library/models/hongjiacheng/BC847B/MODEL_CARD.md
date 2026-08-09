# BC847B model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1 NPN 100MHz 100mA 100nA 200 200mW 45V 500mV 6V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879685864472576
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `2ecd6075421cf1e085d1e80ca35ed709241cf8a8896026b0da98745c03e12828`
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
| BF | 3.94732361e+2 | fitted or derived |
| ISE | 0.00000000e+0 | fitted or derived |
| IKF | 1.74919220e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the fit uses only the cited 25 degC hFE curve, which does not independently constrain IS; published VBE curves are outside the fitted claim |
| ISE | 0.00000000e+0 | undefined | no low-current roll-off is resolvable within the digitised range |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 420 and IC 0.001 A | 1.000000e-3 | 9.754757e-4 | A | 2.452% | p. 3, Fig. 2 DC Current Gain |
| collector current at IB for hFE 410 and IC 0.002 A | 2.000000e-3 | 1.987215e-3 | A | 0.639% | p. 3, Fig. 2 DC Current Gain |
| collector current at IB for hFE 395 and IC 0.005 A | 5.000000e-3 | 5.070665e-3 | A | 1.413% | p. 3, Fig. 2 DC Current Gain |
| collector current at IB for hFE 380 and IC 0.01 A | 1.000000e-2 | 1.025594e-2 | A | 2.559% | p. 3, Fig. 2 DC Current Gain |
| collector current at IB for hFE 360 and IC 0.02 A | 2.000000e-2 | 2.054887e-2 | A | 2.744% | p. 3, Fig. 2 DC Current Gain |
| collector current at IB for hFE 340 and IC 0.05 A | 5.000000e-2 | 4.791413e-2 | A | 4.172% | p. 3, Fig. 2 DC Current Gain |
| collector current at IB for hFE 300 and IC 0.08 A | 8.000000e-2 | 7.709273e-2 | A | 3.634% | p. 3, Fig. 2 DC Current Gain |
| collector current at IB for hFE 250 and IC 0.1 A | 1.000000e-1 | 1.045498e-1 | A | 4.550% | p. 3, Fig. 2 DC Current Gain |

Worst fitting error: 4.550% for collector current at IB for hFE 250 and IC 0.1 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 8.521e-11 and worst absolute delta was 3.989e-11.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No scalar Cobo or Cibo values are tabulated; the p. 3 Fig. 6 Cob and Cib curves are retained as digitized curves, but scalar capacitance fields remain null because the graph does not state a single exact value. No VAF scalar or temperature-coefficient data are provided.

- F2 fitting covers only the cited 25 degC DC current-gain curve at VCE = 5 V; base-emitter transfer, output-characteristic, and saturation-voltage curves were not fitted.
- Tabulated saturation maxima are hard-bound checks only and do not expand the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
