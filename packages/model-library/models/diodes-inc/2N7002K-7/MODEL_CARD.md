# 2N7002K-7 model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -55℃~+150℃ 1 N-channel 1.2Ω@10V、1.4Ω@5V 1.6V 2.9pF 300pC@4.5V 30pF 380mA 4.2pF 540mW 60V SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586181546256027648
- Revision: DS30896 Rev. 20 - 2, July 2024
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8
- SHA-256: `669e5d68d6458e0879d7396416bdcdb3ef9966ea60f054773d4c891d735aa818`
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
| VTO | 1.60000000e+0 | fitted or derived |
| KP | 1.66666667e+0 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 6.60000000e-1 | fitted or derived |
| RS | 2.40000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.71000000e-11 | fitted or derived |
| CGDMAX | 2.90000000e-12 | fitted or derived |
| CGDMIN | 2.90000000e-12 | fitted or derived |
| CJO | 1.30000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.40000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.142e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.9034 exceeds gate 0.2; drain_current RMS relative error 0.3019 exceeds gate 0.12; rds_on worst relative error 0.2821 exceeds gate 0.2; rds_on RMS relative error 0.2422 exceeds gate 0.12
- F2 curve extraction is usable for transfer and output behavior, but no capacitance-versus-VDS curve or body-diode reverse-recovery data is published. Capacitance collapse and reverse recovery therefore cannot be independently fitted; the available capacitance table supports only an approximate constant-capacitance transient model.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

All 2 applicable published RDS(on) maximum limit(s) at the represented bias points are enforced as hard-bound checks.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
