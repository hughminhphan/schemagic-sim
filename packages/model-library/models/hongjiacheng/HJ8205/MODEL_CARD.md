# HJ8205 model card

## Identity

- Manufacturer: hongjiacheng
- Description: -55℃~+150℃ 1.25W 138pF 164pF 1V 2 N-Channel 20V 30mΩ@4V、46mΩ@2.5V 4.3A 550pF 6.2nC@4.5V N-Channel SOT-23-6L MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879692063789056
- Revision: Rev:1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `6325fe116ef81dde5ba54f5e05e36031407ab82ae59a811d30ba988ff2bb6288`
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
| VTO | 1.00000000e+0 | fitted or derived |
| KP | 6.66666667e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.65000000e-2 | fitted or derived |
| RS | 6.00000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.12000000e-10 | fitted or derived |
| CGDMAX | 1.38000000e-10 | fitted or derived |
| CGDMIN | 1.38000000e-10 | fitted or derived |
| CJO | 2.60000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 6.00000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 5.917e-16 and worst absolute delta was 8.327e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: family parked after 2 consecutive F2 fit-gate failures with no F2 success; later parts staged F1 (mosfet F2 gate failed: drain_current worst relative error 206.6953 exceeds gate 0.2; drain_current RMS relative error 45.8444 exceeds gate 0.12; rds_on worst relative error 2.1337 exceeds gate 0.2; rds_on RMS relative error 1.2249 exceeds gate 0.12)
- No transfer-characteristics curve, typical threshold value, RthetaJC value, or body-diode reverse-recovery time is provided in the datasheet; the available output and capacitance curves are usable.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
