# MMBT5551-E model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: bjt from MDD Microdiode Semiconductor
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8604433306284793856
- Revision: Rev:2024A1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `f9f768fff3119031a7444b7d53c5a412cdb028388e1db09c1d43f67990e33fb7`
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
| BF | 4.04592156e+2 | fitted or derived |
| ISE | 1.52795569e-13 | fitted or derived |
| IKF | 2.76865400e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; VBE evidence was not included in this hFE-only fit and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 175 and IC 0.001 A | 1.000000e-3 | 9.979788e-4 | A | 0.202% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 175 and IC 0.01 A | 1.000000e-2 | 1.126208e-2 | A | 12.621% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 170 and IC 0.03 A | 3.000000e-2 | 2.791446e-2 | A | 6.952% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 155 and IC 0.05 A | 5.000000e-2 | 4.268040e-2 | A | 14.639% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 95 and IC 0.1 A | 1.000000e-1 | 9.038844e-2 | A | 9.612% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 55 and IC 0.15 A | 1.500000e-1 | 1.570937e-1 | A | 4.729% | p. 2, Typical Characteristics, hFE versus IC |
| collector current at IB for hFE 35 and IC 0.2 A | 2.000000e-1 | 2.366799e-1 | A | 18.340% | p. 2, Typical Characteristics, hFE versus IC |

Worst fitting error: 18.340% for collector current at IB for hFE 35 and IC 0.2 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 3.560e-12 and worst absolute delta was 3.719e-14.

F2 fidelity is limited to the exact cited 25 degC hFE-versus-collector-current curve and VCE bias recorded in `component.json`. Other scalar checks do not extend the curve-fit claim.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- Not represented by the supplied schema: VAF/Early voltage, VCBO and VEBO as scalar spec fields, ICBO and IEBO, IC and power/thermal absolute ratings, hFE rank-bin metadata, and a tabulated VBE(on) scalar. Cibo has no exact table row and is therefore represented only by digitized typical curve evidence.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
