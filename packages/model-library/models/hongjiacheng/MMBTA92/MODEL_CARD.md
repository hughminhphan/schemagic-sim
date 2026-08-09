# MMBTA92 model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1 PNP 100nA 200mV 300V 350mW 500mA 50MHz 5V 60 PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879428506714112
- Revision: Rev.1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `3bec02b77bf03782f0a6abb22ec8d31897a69103b4246504aa8a15a304d9ba48`
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
| BF | 1.55252168e+2 | fitted or derived |
| ISE | 1.20291312e-14 | fitted or derived |
| IKF | 9.14628518e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the fit uses only the cited 25 degC hFE curve, which does not independently constrain IS; published VBE curves are outside the fitted claim |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 160 and IC 0.0001 A | 1.000000e-4 | 9.729190e-5 | A | 2.708% | p. 2, Fig. 2 |
| collector current at IB for hFE 150 and IC 0.001 A | 1.000000e-3 | 1.076307e-3 | A | 7.631% | p. 2, Fig. 2 |
| collector current at IB for hFE 145 and IC 0.01 A | 1.000000e-2 | 1.040645e-2 | A | 4.064% | p. 2, Fig. 2 |
| collector current at IB for hFE 140 and IC 0.03 A | 3.000000e-2 | 2.803129e-2 | A | 6.562% | p. 2, Fig. 2 |
| collector current at IB for hFE 120 and IC 0.06 A | 6.000000e-2 | 5.438497e-2 | A | 9.358% | p. 2, Fig. 2 |
| collector current at IB for hFE 90 and IC 0.1 A | 1.000000e-1 | 9.556754e-2 | A | 4.432% | p. 2, Fig. 2 |
| collector current at IB for hFE 55 and IC 0.15 A | 1.500000e-1 | 1.700662e-1 | A | 13.377% | p. 2, Fig. 2 |

Worst fitting error: 13.377% for collector current at IB for hFE 55 and IC 0.15 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 1.461e-10 and worst absolute delta was 2.872e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 fitting covers only the cited 25 degC DC current-gain curve; base-emitter transfer, output-characteristic, and saturation-voltage curves were not fitted.
- Tabulated saturation maxima are bound-checked but are not curve-fitted claims.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
