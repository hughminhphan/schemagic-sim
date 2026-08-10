# LH8550QLT1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 PNP 1.5A 100 100nA 225mW 500mV 50V 6V PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586180226141327360
- Revision: Rev.C
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `0a5d8504b1372d6c261ab737c2cee2325d11f9edd6aa75c0b345f7512f088333`
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
| BF | 2.53138581e+2 | fitted or derived |
| ISE | 6.50901389e-15 | fitted or derived |
| IKF | 5.70794342e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; VBE evidence was not included in this hFE-only fit and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 245 and IC 0.001 A | 1.000000e-3 | 9.994691e-4 | A | 0.053% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 245 and IC 0.01 A | 1.000000e-2 | 1.001905e-2 | A | 0.190% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 215 and IC 0.1 A | 1.000000e-1 | 9.973955e-2 | A | 0.260% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 165 and IC 0.3 A | 3.000000e-1 | 3.006518e-1 | A | 0.217% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 135 and IC 0.5 A | 5.000000e-1 | 4.990711e-1 | A | 0.186% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 105 and IC 0.8 A | 8.000000e-1 | 8.007408e-1 | A | 0.093% | p. 3, Electrical Characteristic Curves, HFE-IC plot |

Worst fitting error: 0.260% for collector current at IB for hFE 215 and IC 0.1 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 2.677e-12 and worst absolute delta was 5.141e-13.

F2 fidelity is limited to the exact cited 25 degC hFE-versus-collector-current curve and VCE bias recorded in `component.json`. Other scalar checks do not extend the curve-fit claim.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No numeric fT, Cobo, or Cibo values are published in the supplied datasheet. No VBE(sat) value or second saturation pair is published; additional absolute-rating fields beyond VCEO are not represented by this strict schema.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
