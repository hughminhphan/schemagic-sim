# BC856B model card

## Identity

- Manufacturer: UMW Youtai Semiconductor Co Ltd
- Description: -65℃~+150℃ 1 PNP 100MHz 100mA 100nA 200mW 220 500mV 5V 65V PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588907071035490304
- Revision: Not stated in supplied datasheet
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `9f713fe8f90f5c21db8f2adba9a94dd6273791b09233eca4847048b9b6c908da`
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
| BF | 3.34200616e+2 | fitted or derived |
| ISE | 0.00000000e+0 | fitted or derived |
| IKF | 1.30945479e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; VBE evidence was not included in this hFE-only fit and hFE at forced base current does not constrain IS |
| ISE | 0.00000000e+0 | undefined | no low-current roll-off is resolvable within the digitised range |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 350 and IC 0.0001 A | 1.000000e-4 | 9.962117e-5 | A | 0.379% | p. 3, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 350 and IC 0.001 A | 1.000000e-3 | 9.891960e-4 | A | 1.080% | p. 3, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 340 and IC 0.002 A | 2.000000e-3 | 2.021053e-3 | A | 1.053% | p. 3, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 320 and IC 0.01 A | 1.000000e-2 | 1.013833e-2 | A | 1.383% | p. 3, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 290 and IC 0.03 A | 3.000000e-2 | 2.961609e-2 | A | 1.280% | p. 3, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 200 and IC 0.1 A | 1.000000e-1 | 1.003334e-1 | A | 0.333% | p. 3, Typical Characteristics, hFE versus IC |

Worst fitting error: 1.383% for collector current at IB for hFE 320 and IC 0.01 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 1.248e-10 and worst absolute delta was 2.095e-11.

F2 fidelity is limited to the exact cited 25 degC hFE-versus-collector-current curve and VCE bias recorded in `component.json`. Other scalar checks do not extend the curve-fit claim.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
