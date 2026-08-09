# LMBT2222ALT1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 NPN 10uA 225mW 300MHz 300mV 35 40V 600mA 6V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586176093502390272
- Revision: Rev.B, Mar 2016
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `49cd7f6d63c4b8c8bd26ef1490ec4993b2a8a8f4a1db2e18a9d80b2163b77d77`
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
| IS | 6.53538066e-15 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| BF | 1.93128485e+2 | fitted or derived |
| ISE | 2.80540580e-14 | fitted or derived |
| IKF | 1.00000000e+3 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 6.53538066e-15 | undefined | derived from the cited VBE(on) curve at IC = 0.1 A, VBE = 0.78 V; hFE at forced base current does not constrain IS |
| IKF | 1.00000000e+3 | undefined | no high-injection roll-off is resolvable within the digitised range |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 160 and IC 0.0001 A | 1.000000e-4 | 9.808209e-5 | A | 1.918% | p. 3, DC Current Gain plot |
| collector current at IB for hFE 175 and IC 0.001 A | 1.000000e-3 | 1.042446e-3 | A | 4.245% | p. 3, DC Current Gain plot |
| collector current at IB for hFE 195 and IC 0.01 A | 1.000000e-2 | 1.007766e-2 | A | 0.777% | p. 3, DC Current Gain plot |
| collector current at IB for hFE 210 and IC 0.1 A | 1.000000e-1 | 9.705013e-2 | A | 2.950% | p. 3, DC Current Gain plot |

Worst fitting error: 4.245% for collector current at IB for hFE 175 and IC 0.001 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 3.985e-10 and worst absolute delta was 1.595e-12.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- The supplied datasheet has usable typical DC, saturation, VBE, fT, and output-characteristic plots, but no robust scalar Early-voltage extraction field; capacitance-versus-bias and collector-saturation-region plots were omitted because the required table rows provide the minimum model inputs. Temperature-dependent, reverse-operation, noise, thermal, and package-parasitic data are not represented by the strict schema.

- F2 fitting covers only the cited 25 degC DC current-gain curve at VCE = 10 V; base-emitter transfer, output-characteristic, and saturation-voltage curves were not fitted.
- Tabulated saturation maxima are hard-bound checks only and do not expand the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
