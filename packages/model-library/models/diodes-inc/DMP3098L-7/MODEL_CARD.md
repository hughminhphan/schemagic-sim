# DMP3098L-7 model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -55℃~+150℃ 1 P-Channel 1.08W 120mΩ@4.5V 147pF 2.1V 210pF 3.8A 30V 336pF 8nC@4.5V SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586187872558845952
- Revision: DS31447 Rev. 8 - 2, October 2013
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `63ed7e3b1baeffab7278f50472161759e4c2db18f25bdf321e1ea2b05c51b215`
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
| VTO | 1.80000000e+0 | fitted or derived |
| KP | 3.57142857e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 3.08000000e-2 | fitted or derived |
| RS | 1.12000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.87000000e-10 | fitted or derived |
| CGDMAX | 4.90000000e-11 | fitted or derived |
| CGDMIN | 4.90000000e-11 | fitted or derived |
| CJO | 2.10000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.12000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.578e-21 and worst absolute delta was 1.578e-30.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.5242 exceeds gate 0.2; drain_current RMS relative error 0.2054 exceeds gate 0.12; rds_on worst relative error 0.2521 exceeds gate 0.2; rds_on RMS relative error 0.1697 exceeds gate 0.12
- The datasheet does not publish trr/Qrr or RthetaJC; those quantities cannot be extracted from this source.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
