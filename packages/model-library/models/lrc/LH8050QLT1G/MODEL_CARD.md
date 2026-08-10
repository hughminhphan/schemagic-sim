# LH8050QLT1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 NPN 1.5A 100 100nA 225mW 500mV 50V 6V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586182845882634240
- Revision: Rev.B
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `1104db6f6f5db648d30355ff2d845a372f8e37a2e66cb9513e6ede2f863a482d`
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
| BF | 3.09879091e+2 | fitted or derived |
| ISE | 4.32871792e-14 | fitted or derived |
| IKF | 5.52948998e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; VBE evidence was not included in this hFE-only fit and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 245 and IC 0.001 A | 1.000000e-3 | 9.813850e-4 | A | 1.861% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 255 and IC 0.01 A | 1.000000e-2 | 1.057359e-2 | A | 5.736% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 250 and IC 0.1 A | 1.000000e-1 | 9.943489e-2 | A | 0.565% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 215 and IC 0.3 A | 3.000000e-1 | 2.776650e-1 | A | 7.445% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 165 and IC 0.5 A | 5.000000e-1 | 4.859908e-1 | A | 2.802% | p. 3, Electrical Characteristic Curves, HFE-IC plot |
| collector current at IB for hFE 110 and IC 0.8 A | 8.000000e-1 | 8.618786e-1 | A | 7.735% | p. 3, Electrical Characteristic Curves, HFE-IC plot |

Worst fitting error: 7.735% for collector current at IB for hFE 110 and IC 0.8 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 2.769e-12 and worst absolute delta was 3.610e-13.

F2 fidelity is limited to the exact cited 25 degC hFE-versus-collector-current curve and VCE bias recorded in `component.json`. Other scalar checks do not extend the curve-fit claim.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No fT, Cobo, Cibo, VBE(sat), or second saturation pair is numerically published in the supplied datasheet. Early voltage and other absolute-rating fields beyond VCEO are not represented by this schema.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
