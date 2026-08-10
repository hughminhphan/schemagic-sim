# LMBT3946DW1T1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 100 150mW 2 NPN + 2 PNP 200mA 300MHz 400mV 40V 50nA 6V NPN+PNP SC-88 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586203794660577280
- Revision: Rev.B Mar 2016
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8
- SHA-256: `1e0a5e7f1410f8cedd935f9711eb906e1aabcb0946f3777ed45209516a9cb958`
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
| IS | 6.75275231e-15 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| BF | 3.07712835e+2 | fitted or derived |
| ISE | 3.62420080e-14 | fitted or derived |
| IKF | 4.49189346e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 6.75275231e-15 | undefined | derived from the cited VBE(on) curve at IC = 0.01 A, VBE = 0.72 V; hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 195 and IC 0.0001 A | 1.000000e-4 | 9.367319e-5 | A | 6.327% | p. 5, Electrical Characteristics Curves (NPN), DC Current Gain plot, digitized typical curve |
| collector current at IB for hFE 200 and IC 0.0002 A | 2.000000e-4 | 2.005690e-4 | A | 0.284% | p. 5, Electrical Characteristics Curves (NPN), DC Current Gain plot, digitized typical curve |
| collector current at IB for hFE 205 and IC 0.0005 A | 5.000000e-4 | 5.382791e-4 | A | 7.656% | p. 5, Electrical Characteristics Curves (NPN), DC Current Gain plot, digitized typical curve |
| collector current at IB for hFE 215 and IC 0.001 A | 1.000000e-3 | 1.076750e-3 | A | 7.675% | p. 5, Electrical Characteristics Curves (NPN), DC Current Gain plot, digitized typical curve |
| collector current at IB for hFE 230 and IC 0.005 A | 5.000000e-3 | 5.126991e-3 | A | 2.540% | p. 5, Electrical Characteristics Curves (NPN), DC Current Gain plot, digitized typical curve |
| collector current at IB for hFE 235 and IC 0.01 A | 1.000000e-2 | 9.521633e-3 | A | 4.784% | p. 5, Electrical Characteristics Curves (NPN), DC Current Gain plot, digitized typical curve |
| collector current at IB for hFE 225 and IC 0.02 A | 2.000000e-2 | 1.776084e-2 | A | 11.196% | p. 5, Electrical Characteristics Curves (NPN), DC Current Gain plot, digitized typical curve |
| collector current at IB for hFE 150 and IC 0.05 A | 5.000000e-2 | 4.704914e-2 | A | 5.902% | p. 5, Electrical Characteristics Curves (NPN), DC Current Gain plot, digitized typical curve |
| collector current at IB for hFE 75 and IC 0.1 A | 1.000000e-1 | 1.125608e-1 | A | 12.561% | p. 5, Electrical Characteristics Curves (NPN), DC Current Gain plot, digitized typical curve |

Worst fitting error: 12.561% for collector current at IB for hFE 75 and IC 0.1 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 1.179e-11 and worst absolute delta was 2.102e-13.

F2 fidelity is limited to the exact cited 25 degC hFE-versus-collector-current curve and VCE bias recorded in `component.json`. Other scalar checks do not extend the curve-fit claim.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- The supplied part contains both NPN and PNP sections, while this schema permits one polarity only; this object records the NPN section. VAF is not numerically published, and additional absolute-rating fields are not represented by the schema.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
