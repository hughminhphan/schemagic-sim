# 4882 model card

## Identity

- Manufacturer: HL
- Description: -55℃~+150℃ 12nC@10V 17mΩ 2 N-Channel 2.5V 2.9W 40V 58pF 633pF 67pF 8A N-Channel SOP-8 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590908171483897856
- Revision: V2.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `35906e1155d562ddfd883afab85901885c93201f67a555950729ffad3df51af4`
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
| VTO | 1.50000000e+0 | fitted or derived |
| KP | 1.17647059e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 9.35000000e-3 | fitted or derived |
| RS | 3.40000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 5.75000000e-10 | fitted or derived |
| CGDMAX | 5.80000000e-11 | fitted or derived |
| CGDMIN | 5.80000000e-11 | fitted or derived |
| CJO | 9.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 3.40000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 0.000e+00 and worst absolute delta was 0.000e+00.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 18.5011 exceeds gate 0.2; drain_current RMS relative error 4.1664 exceeds gate 0.12; rds_on RMS relative error 0.1222 exceeds gate 0.12
- No reverse-recovery time is published. The transfer, output, body-diode, gate-charge, and capacitance figures are usable; the datasheet does not provide a separate capacitance test bias for Ciss and Crss beyond the stated 1 MHz characteristic family.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
