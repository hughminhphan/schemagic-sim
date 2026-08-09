# MMBT3904T-7-F model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -55℃~+150℃ 1 NPN 100 100MHz 150mW 200mA 200mV 40V 50nA 6V NPN SOT-523 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent re-reviewer (P6 proving-50 final)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588902298114805760
- Revision: DS30270 Rev. 10 - 2, April 2016
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `2cf3ed813df81c6e74755318e2a424a4a25f061f2fa0a63c811abacbc4ae5c9e`
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
| BF | 2.56586943e+2 | fitted or derived |
| ISE | 2.55354760e-14 | fitted or derived |
| IKF | 4.61855417e-2 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 1.00000000e-14 | undefined | held physical default; the source supplies no VBE(on) curve and hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 200 and IC 0.0001 A | 1.000000e-4 | 9.842826e-5 | A | 1.572% | p. 4, Typical DC Current Gain vs. Collector Current |
| collector current at IB for hFE 210 and IC 0.001 A | 1.000000e-3 | 1.053550e-3 | A | 5.355% | p. 4, Typical DC Current Gain vs. Collector Current |
| collector current at IB for hFE 210 and IC 0.01 A | 1.000000e-2 | 9.558720e-3 | A | 4.413% | p. 4, Typical DC Current Gain vs. Collector Current |
| collector current at IB for hFE 125 and IC 0.05 A | 5.000000e-2 | 4.866133e-2 | A | 2.677% | p. 4, Typical DC Current Gain vs. Collector Current |
| collector current at IB for hFE 75 and IC 0.1 A | 1.000000e-1 | 1.036602e-1 | A | 3.660% | p. 4, Typical DC Current Gain vs. Collector Current |

Worst fitting error: 5.355% for collector current at IB for hFE 210 and IC 0.001 A.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 1.805e-11 and worst absolute delta was 4.493e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- VBE(on) and VAF are omitted because the datasheet provides neither a VBE(on) electrical-characteristics row nor an output-characteristics IC-versus-VCE figure; the schema has no dedicated VBE(on) field.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
