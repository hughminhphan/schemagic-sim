# HL2310A model card

## Identity

- Manufacturer: hongjiacheng
- Description: mosfet from hongjiacheng
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879627077378048
- Revision: Rev. 1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `b85871218e306a86b529e7e0fb6444477690c805c56fefdfe9dd8d91b8ff4530`
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
| VTO | 2.00000000e+0 | fitted or derived |
| KP | 2.22222222e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 4.95000000e-2 | fitted or derived |
| RS | 1.80000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.27500000e-10 | fitted or derived |
| CGDMAX | 1.95000000e-11 | fitted or derived |
| CGDMIN | 1.95000000e-11 | fitted or derived |
| CJO | 1.45000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.80000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.265e-16 and worst absolute delta was 2.776e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: family parked after 2 consecutive F2 fit-gate failures with no F2 success; later parts staged F1 (mosfet F2 gate failed: drain_current worst relative error 206.6953 exceeds gate 0.2; drain_current RMS relative error 45.8444 exceeds gate 0.12; rds_on worst relative error 2.1337 exceeds gate 0.2; rds_on RMS relative error 1.2249 exceeds gate 0.12)
- The supplied schema has no dedicated fields for gate charge, reverse-recovery charge/time, leakage, maximum body-diode current, switching timing, thermal resistance, safe operating area, or transient thermal impedance; those published values are retained only in extraction_notes.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

All 2 applicable published RDS(on) maximum limit(s) at the represented bias points are enforced as hard-bound checks.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
