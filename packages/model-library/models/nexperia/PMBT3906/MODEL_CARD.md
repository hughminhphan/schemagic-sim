# PMBT3906 model card

## Identity

- Manufacturer: Nexperia
- Description: -65℃~+150℃ 1 PNP 200mA 250MHz 250mV 250mW 40V 50nA 60 6V PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586172665128632320
- Revision: Rev. 06 — 2 March 2010
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `46ecf3679c70a3f1acd69c59e24cd5f5306218ee6acf7803517e37f0dbea3e6f`
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
| IS | 4.82254048e-15 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| BF | 2.23911121e+2 | fitted or derived |
| ISE | 1.30646532e-15 | fitted or derived |
| IKF | 1.44546864e-1 | fitted or derived |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| IS | 4.82254048e-15 | undefined | derived from the cited VBE(on) curve at IC = 0.05 A, VBE = 0.77 V; hFE at forced base current does not constrain IS |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| collector current at IB for hFE 220 and IC 0.0001 A | 1.000000e-4 | 9.989116e-5 | A | 0.109% | p. 4, Fig. 1 |
| collector current at IB for hFE 220 and IC 0.001 A | 1.000000e-3 | 1.003811e-3 | A | 0.381% | p. 4, Fig. 1 |
| collector current at IB for hFE 210 and IC 0.01 A | 1.000000e-2 | 9.956842e-3 | A | 0.432% | p. 4, Fig. 1 |
| collector current at IB for hFE 185 and IC 0.03 A | 3.000000e-2 | 3.004835e-2 | A | 0.161% | p. 4, Fig. 1 |

Worst fitting error: 0.432% for collector current at IB for hFE 210 and IC 0.01 A.

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 2.890e-11 and worst absolute delta was 5.017e-13.


F2 curve-fit fidelity is supported only for the 25 degC hFE-versus-collector-current residual set over 0.0001 to 0.03 A at VCE = 1 V. Selected evidence recorded in curves_used: DC current gain hFE versus collector current, 25 degC curve (p. 4, Fig. 1); Base-emitter voltage VBE versus collector current, 25 degC curve (p. 4, Fig. 3). The cited VBE curve contributes only the held IS derivation at IC = 0.05 A and VBE = 0.77 V; no general VBE curve-fidelity claim is made. Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- The strict schema has no fields for VBE(on), VCBO, VEBO, collector-current and power limits, thermal characteristics, switching times, noise figure, or hFE ranges beyond the separately retained -10 mA maximum.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Saturation, output-family, AC, switching, capacitance, thermal, SOA, and continuous-current fidelity are outside the F2 claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
