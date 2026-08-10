# IRFR9024NPbF model card

## Identity

- Manufacturer: Infineon Technologies
- Description: -55℃~+150℃ 1 P-Channel 11A 175mΩ@10V 19nC@10V 350pF 38W 4V 55V 92pF P-Channel DPAK(TO-252AA) MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8579710840196960256
- Revision: PD-95015A, 12/14/04
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8, p. 9, p. 10, p. 11, p. 12
- SHA-256: `5154a243ec9715b5fa86a84d6ef332921dcb4833696f88816262c3cc664a2feb`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | -4.00000000e+0 | fitted or derived |
| KP | 1.26984127e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 8.66250000e-2 | fitted or derived |
| RS | 3.15000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.58000000e-10 | fitted or derived |
| CGDMAX | 9.20000000e-11 | fitted or derived |
| CGDMIN | 9.20000000e-11 | fitted or derived |
| CJO | 7.80000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.15000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 6.311e-21 and worst absolute delta was 6.311e-30.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 1.4116 exceeds gate 0.2; drain_current RMS relative error 0.5137 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
