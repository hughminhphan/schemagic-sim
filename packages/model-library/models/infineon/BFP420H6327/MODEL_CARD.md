# BFP420H6327 model card

## Identity

- Manufacturer: Infineon Technologies
- Description: -55℃~+150℃ 1.5V 100nA 210mW 25GHz 4.5V 60 60mA Common Emitter NPN SOT-343 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-9 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8757970042510426112
- Revision: Revision 3.0, 2024-07-01
- Accessed: 2026-08-11
- Referenced pages: pp. 1-18
- SHA-256: `d8ef01d0f74643bfa942f1938fa2b42aeac4276b3847a8012b5dc1a5933e68cd`
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
| BF | 9.12550204e+1 | fitted or derived |
| ISE | 0.00000000e+0 | fitted or derived |
| IKF | 1.96973133e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the source supplies no VBE(on) curve and hFE at forced base current does not constrain IS |
| ISE | 0.00000000e+0 | undefined | no low-current roll-off is resolvable within the digitised range |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 95 and IC 0.0001 A | 1.000000e-4 | 9.831701e-5 | A | 1.683% | p. 8 Figure 6 |
| collector current at IB for hFE 92 and IC 0.001 A | 1.000000e-3 | 1.010066e-3 | A | 1.007% | p. 8 Figure 6 |
| collector current at IB for hFE 88 and IC 0.01 A | 1.000000e-2 | 1.009995e-2 | A | 1.000% | p. 8 Figure 6 |
| collector current at IB for hFE 75 and IC 0.05 A | 5.000000e-2 | 4.985082e-2 | A | 0.298% | p. 8 Figure 6 |

Worst fitting error: 1.683% for collector current at IB for hFE 95 and IC 0.0001 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 9.034e-12 and worst absolute delta was 2.010e-11.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 DC current-gain fidelity is limited to Figure 6 on p. 8 at Ta = 25 degC and VCE = 3 V, sampled from 0.0001 to 0.05 A collector current. The separate Table 3 hFE bounds at VCE = 4 V do not extend the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
