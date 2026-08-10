# BCX53-16 model card

## Identity

- Manufacturer: Jiangsu Changjing Electronics Technology Co Ltd
- Description: -55℃~+150℃ 1 PNP 100nA 1A 500mV 500mW 50MHz 5V 63 80V PNP SOT-89-3L Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586172158997909504
- Revision: E, Nov 2015
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `7a4729270f3eed6b8af7a6dea44eccfcb893bfeca33db7c521f472a64d01b4eb`
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
| BF | 2.43660224e+2 | fitted or derived |
| ISE | 2.45447265e-14 | fitted or derived |
| IKF | 1.78003243e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; VBE evidence was not included in this hFE-only fit and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 220 and IC 0.001 A | 1.000000e-3 | 9.881648e-4 | A | 1.184% | p. 3, Typical Characteristics, hFE — IC |
| collector current at IB for hFE 210 and IC 0.01 A | 1.000000e-2 | 1.049628e-2 | A | 4.963% | p. 3, Typical Characteristics, hFE — IC |
| collector current at IB for hFE 170 and IC 0.1 A | 1.000000e-1 | 9.326014e-2 | A | 6.740% | p. 3, Typical Characteristics, hFE — IC |
| collector current at IB for hFE 35 and IC 1 A | 1.000000e+0 | 1.033842e+0 | A | 3.384% | p. 3, Typical Characteristics, hFE — IC |

Worst fitting error: 6.740% for collector current at IB for hFE 170 and IC 0.1 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 2.601e-12 and worst absolute delta was 6.961e-14.

F2 fidelity is limited to the exact cited 25 degC hFE-versus-collector-current curve and VCE bias recorded in `component.json`. Other scalar checks do not extend the curve-fit claim.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
