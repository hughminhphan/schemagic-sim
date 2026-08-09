# MMBT5551 model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1 NPN 100 100MHz 150mV 160V 300mW 50nA 600mA 6V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590905108798922752
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `d4a70afeee466866d0b2ecf78ef4e958412531af454c336818bb1119f47875ac`
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
| BF | 8.02530329e+2 | fitted or derived |
| ISE | 1.25410537e-13 | fitted or derived |
| IKF | 1.74016408e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the fit uses only the cited 25 degC hFE curve, which does not independently constrain IS; published VBE curves are outside the fitted claim |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 245 and IC 0.001 A | 1.000000e-3 | 1.030881e-3 | A | 3.088% | p. 2, Fig.2 DC Current Gain |
| collector current at IB for hFE 285 and IC 0.01 A | 1.000000e-2 | 1.005255e-2 | A | 0.526% | p. 2, Fig.2 DC Current Gain |
| collector current at IB for hFE 220 and IC 0.05 A | 5.000000e-2 | 4.084555e-2 | A | 18.309% | p. 2, Fig.2 DC Current Gain |
| collector current at IB for hFE 100 and IC 0.1 A | 1.000000e-1 | 1.013446e-1 | A | 1.345% | p. 2, Fig.2 DC Current Gain |
| collector current at IB for hFE 45 and IC 0.2 A | 2.000000e-1 | 2.331049e-1 | A | 16.552% | p. 2, Fig.2 DC Current Gain |

Worst fitting error: 18.309% for collector current at IB for hFE 220 and IC 0.05 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 2.864e-12 and worst absolute delta was 4.452e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 fitting covers only the cited 25 degC DC current-gain curve; base-emitter transfer, output-characteristic, and saturation-voltage curves were not fitted.
- Tabulated saturation maxima are bound-checked but are not curve-fitted claims.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
