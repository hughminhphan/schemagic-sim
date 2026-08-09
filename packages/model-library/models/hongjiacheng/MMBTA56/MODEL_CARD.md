# MMBTA56 model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1 PNP 100 100nA 225mW 250mV 4V 500mA 50MHz 80V PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879429291319296
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `8165be6955c9aaf6bcd02718645e369aa2cea33533e399f3309c515c990482bf`
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
| IS | 2.31742480e-12 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| BF | 4.11685157e+2 | fitted or derived |
| ISE | 1.20965673e-11 | fitted or derived |
| IKF | 7.75040200e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 2.31742480e-12 | undefined | derived from the cited VBE(on) curve at IC = 0.01 A, VBE = 0.57 V; hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 160 and IC 0.01 A | 1.000000e-2 | 1.009765e-2 | A | 0.976% | p. 2, Fig. 2 DC Current Gain, sparse visual digitization |
| collector current at IB for hFE 155 and IC 0.03 A | 3.000000e-2 | 3.153898e-2 | A | 5.130% | p. 2, Fig. 2 DC Current Gain, sparse visual digitization |
| collector current at IB for hFE 145 and IC 0.1 A | 1.000000e-1 | 8.891874e-2 | A | 11.081% | p. 2, Fig. 2 DC Current Gain, sparse visual digitization |
| collector current at IB for hFE 75 and IC 0.3 A | 3.000000e-1 | 2.825765e-1 | A | 5.808% | p. 2, Fig. 2 DC Current Gain, sparse visual digitization |
| collector current at IB for hFE 38 and IC 0.5 A | 5.000000e-1 | 5.623823e-1 | A | 12.476% | p. 2, Fig. 2 DC Current Gain, sparse visual digitization |

Worst fitting error: 12.476% for collector current at IB for hFE 38 and IC 0.5 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 2.072e-12 and worst absolute delta was 2.354e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 fitting covers only the cited 25 degC DC current-gain curve at VCE = 1 V; base-emitter transfer, output-characteristic, and saturation-voltage curves were not fitted.
- Tabulated saturation maxima are hard-bound checks only and do not expand the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
