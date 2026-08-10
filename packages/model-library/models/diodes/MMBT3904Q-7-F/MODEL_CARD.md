# MMBT3904Q-7-F model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -55℃~+150℃ 1 NPN 100 200mA 200mV 300MHz 310mW 40V 50nA 6V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8560104975377186816
- Revision: DS45242 Rev. 1 - 2, November 2022
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `b47e45c900354d956a70f3b43fd48dc713fe0d6413e34cf30a3b2eab1fdc689c`
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
| BF | 1.06778234e+2 | fitted or derived |
| ISE | 5.84988412e-15 | fitted or derived |
| IKF | 1.94753694e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the source supplies no VBE(on) curve and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 105 and IC 0.0001 A | 1.000000e-4 | 9.916678e-5 | A | 0.833% | p. 5 Fig. 1 |
| collector current at IB for hFE 103 and IC 0.001 A | 1.000000e-3 | 1.021203e-3 | A | 2.120% | p. 5 Fig. 1 |
| collector current at IB for hFE 100 and IC 0.01 A | 1.000000e-2 | 1.011855e-2 | A | 1.186% | p. 5 Fig. 1 |
| collector current at IB for hFE 98 and IC 0.02 A | 2.000000e-2 | 1.974676e-2 | A | 1.266% | p. 5 Fig. 1 |
| collector current at IB for hFE 85 and IC 0.05 A | 5.000000e-2 | 4.995737e-2 | A | 0.085% | p. 5 Fig. 1 |
| collector current at IB for hFE 75 and IC 0.1 A | 1.000000e-1 | 9.552873e-2 | A | 4.471% | p. 5 Fig. 1 |
| collector current at IB for hFE 50 and IC 0.2 A | 2.000000e-1 | 2.071116e-1 | A | 3.556% | p. 5 Fig. 1 |

Worst fitting error: 4.471% for collector current at IB for hFE 75 and IC 0.1 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 7.625e-12 and worst absolute delta was 1.136e-13.


F2 curve-fit fidelity is supported only for the 25 degC hFE-versus-collector-current residual set over 0.0001 to 0.2 A at VCE = 1 V. Selected evidence recorded in curves_used: Typical DC current gain hFE vs collector current, TA = +25 degC (p. 5 Fig. 1). Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No fixed-base-current output-characteristics or Early-voltage curve is published; the p. 3 plot is a thermal/safe-operating-area limit. Datasheet facts outside this strict schema, including VCBO, VEBO, power dissipation, thermal limits, switching times, and noise figure, are omitted.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Saturation, output-family, AC, switching, capacitance, thermal, SOA, and continuous-current fidelity are outside the F2 claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
