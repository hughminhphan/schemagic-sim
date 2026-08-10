# LP2301BLT1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 P-Channel 100mΩ@4.5V 15.23nC@6V 2.8A 20V 400mV 570mW 882.51pF 97.26pF SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586176653705269248
- Revision: Rev. O
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `c2202879fe0519f7f857dd856c35f56e1feebb5a0cc0507dc9e73d292e6554c5`
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
| VTO | 9.00000000e-1 | fitted or derived |
| KP | 2.89855072e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 3.79500000e-2 | fitted or derived |
| RS | 1.38000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 7.85250000e-10 | fitted or derived |
| CGDMAX | 9.72600000e-11 | fitted or derived |
| CGDMIN | 9.72600000e-11 | fitted or derived |
| CJO | 4.82800000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.38000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.881e-16 and worst absolute delta was 2.776e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 2.6085 exceeds gate 0.2; drain_current RMS relative error 0.8641 exceeds gate 0.12; rds_on worst relative error 0.2837 exceeds gate 0.2; rds_on RMS relative error 0.1422 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
