# 2N7002KT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃ 1 N-channel 2.3V 2.5Ω@4.5V 380mA 420mW 45pF 60V 700pC@4.5V N-Channel SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588880663197978624
- Revision: October 2016, Rev. 15
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `7b4149ae478ee068171aaa0a7299b51967efba29dbe27fb251568d25f71dbfb3`
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
| VTO | 2.30000000e+0 | fitted or derived |
| KP | 1.68067227e+0 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 6.54500000e-1 | fitted or derived |
| RS | 2.38000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.23000000e-11 | fitted or derived |
| CGDMAX | 2.20000000e-12 | fitted or derived |
| CGDMIN | 2.20000000e-12 | fitted or derived |
| CJO | 2.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.38000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.186e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.5023 exceeds gate 0.2; drain_current RMS relative error 0.1336 exceeds gate 0.12; rds_on worst relative error 0.4051 exceeds gate 0.2; rds_on RMS relative error 0.3687 exceeds gate 0.12
- No typical threshold value, body-diode reverse-recovery data, or junction-to-case thermal resistance is published. Transfer, output, and capacitance curve families are available and were digitized from the datasheet figures; the remaining omitted quantities are outside the required schema fields.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

All 2 applicable published RDS(on) maximum limit(s) at the represented bias points are enforced as hard-bound checks.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
