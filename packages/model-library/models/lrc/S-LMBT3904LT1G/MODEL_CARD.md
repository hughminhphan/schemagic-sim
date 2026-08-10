# S-LMBT3904LT1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 NPN 200mA 200mV 225mW 300MHz 40 40V 50nA 6V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8589838384102608896
- Revision: Rev.B Mar 2016
- Accessed: 2026-08-10
- Referenced pages: p. 1, features, device marking/ordering, maximum ratings, thermal characteristics, p. 2, electrical characteristics tables (off, on, small-signal, switching), Ta = 25 degC, p. 3, electrical characteristics curves: Capacitance, DC Current Gain, VCE(sat) vs IC, VBE(sat) vs IC, p. 4, electrical characteristics curves: VBE(on) vs IC, Collector Saturation Region, Rthja, p. 5, outline and dimensions, soldering footprint
- SHA-256: `129d127186ce1bbdc05e724c2e1ddc3237348daf253b78232afe7719f76468b9`
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
| IS | 4.57557661e-15 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| BF | 2.72238941e+2 | fitted or derived |
| ISE | 2.35032354e-14 | fitted or derived |
| IKF | 8.81200198e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 4.57557661e-15 | undefined | derived from the cited VBE(on) curve at IC = 0.01 A, VBE = 0.73 V; hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 190 and IC 0.0001 A | 1.000000e-4 | 9.522511e-5 | A | 4.775% | p. 3, figure DC Current Gain |
| collector current at IB for hFE 198 and IC 0.0003 A | 3.000000e-4 | 3.068885e-4 | A | 2.296% | p. 3, figure DC Current Gain |
| collector current at IB for hFE 205 and IC 0.001 A | 1.000000e-3 | 1.073597e-3 | A | 7.360% | p. 3, figure DC Current Gain |
| collector current at IB for hFE 215 and IC 0.003 A | 3.000000e-3 | 3.180761e-3 | A | 6.025% | p. 3, figure DC Current Gain |
| collector current at IB for hFE 232 and IC 0.01 A | 1.000000e-2 | 9.598319e-3 | A | 4.017% | p. 3, figure DC Current Gain |
| collector current at IB for hFE 225 and IC 0.03 A | 3.000000e-2 | 2.618374e-2 | A | 12.721% | p. 3, figure DC Current Gain |
| collector current at IB for hFE 110 and IC 0.1 A | 1.000000e-1 | 1.076555e-1 | A | 7.655% | p. 3, figure DC Current Gain |

Worst fitting error: 12.721% for collector current at IB for hFE 225 and IC 0.03 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 6.996e-12 and worst absolute delta was 8.901e-14.


F2 curve-fit fidelity is supported only for the 25 degC hFE-versus-collector-current residual set over 0.0001 to 0.1 A at VCE = 1 V. Selected evidence recorded in curves_used: hFE versus IC, 25 degC typical curve (p. 3, figure DC Current Gain); VBE(on) versus IC, 25 degC typical curve (p. 4, figure VBE(on) vs. IC). The cited VBE(on) curve contributes only the held IS derivation at IC = 0.01 A and VBE = 0.73 V; no general VBE curve-fidelity claim is made. Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Saturation, output-family, AC, switching, capacitance, thermal, SOA, and continuous-current fidelity are outside the F2 claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
