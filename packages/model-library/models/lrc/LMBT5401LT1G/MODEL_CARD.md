# LMBT5401LT1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 PNP 150V 300MHz 300mW 50 500mA 500mV 50uA 5V PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-9 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586177526675230720
- Revision: Rev.0
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `820bf560795c69615f67f4a4d57fcfec23e25c2c4ef480a2eae19f8d985fb0fc`
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
| BF | 3.48045886e+2 | fitted or derived |
| ISE | 6.60939410e-13 | fitted or derived |
| IKF | 6.03778147e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the source supplies no VBE(on) curve and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 60 and IC 0.001 A | 1.000000e-3 | 9.903925e-4 | A | 0.961% | p. 3 Figure 1 DC Current Gain |
| collector current at IB for hFE 90 and IC 0.01 A | 1.000000e-2 | 1.091726e-2 | A | 9.173% | p. 3 Figure 1 DC Current Gain |
| collector current at IB for hFE 110 and IC 0.03 A | 3.000000e-2 | 2.780504e-2 | A | 7.317% | p. 3 Figure 1 DC Current Gain |
| collector current at IB for hFE 105 and IC 0.05 A | 5.000000e-2 | 4.602463e-2 | A | 7.951% | p. 3 Figure 1 DC Current Gain |
| collector current at IB for hFE 70 and IC 0.1 A | 1.000000e-1 | 1.084053e-1 | A | 8.405% | p. 3 Figure 1 DC Current Gain |

Worst fitting error: 9.173% for collector current at IB for hFE 90 and IC 0.01 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 4.839e-12 and worst absolute delta was 3.020e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 DC current-gain fidelity is limited to the Ta = 25 degC dashed hFE versus IC trace on p. 3 Figure 1 at VCE = -5 V, sampled from 0.001 to 0.1 A collector-current magnitude. Separate scalar table and saturation bounds do not extend the fitted curve claim.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
