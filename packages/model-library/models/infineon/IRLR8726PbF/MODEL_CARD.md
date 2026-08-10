# IRLR8726PbF model card

## Identity

- Manufacturer: Infineon Technologies
- Description: -55℃~+175℃ 1 N-channel 1.8V 2.15nF 205pF 23nC 30V 5.8mΩ@10V 75W 86A TO-252 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588885320984748032
- Revision: PD-97146A, 11/23/09
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8, p. 9, p. 10, p. 11
- SHA-256: `80064cdee29ee78403d17235f02480702d0bfd2142fb9ab4bcb61b88843873e1`
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
| KP | 5.00000000e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.20000000e-3 | fitted or derived |
| RS | 8.00000000e-4 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.94500000e-9 | fitted or derived |
| CGDMAX | 2.05000000e-10 | fitted or derived |
| CGDMIN | 2.05000000e-10 | fitted or derived |
| CJO | 2.75000000e-10 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 8.00000000e-4 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.855e-16 and worst absolute delta was 1.388e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 5.0479 exceeds gate 0.2; drain_current RMS relative error 2.3889 exceeds gate 0.12; rds_on worst relative error 0.4197 exceeds gate 0.2; rds_on RMS relative error 0.2662 exceeds gate 0.12
- The datasheet does not publish a typical threshold value beyond the transfer curve, and the output and capacitance curves are digitized typical figures rather than tabulated guaranteed limits.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
