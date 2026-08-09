# HL6042 model card

## Identity

- Manufacturer: hongjiacheng
- Description: mosfet from hongjiacheng
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879511792603136
- Revision: Rev. 1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `1c1606285393deeea16c354e5626f3e580f9576e9655f0bc7fb9547f6720554f`
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
| KP | 6.06060606e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.81500000e-2 | fitted or derived |
| RS | 6.60000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 6.60000000e-10 | fitted or derived |
| CGDMAX | 1.00000000e-10 | fitted or derived |
| CGDMIN | 1.00000000e-10 | fitted or derived |
| CJO | 2.50000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 6.60000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 4.441e-4 and worst absolute delta was 4.441e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 206.6953 exceeds gate 0.2; drain_current RMS relative error 45.8444 exceeds gate 0.12; rds_on worst relative error 2.1337 exceeds gate 0.2; rds_on RMS relative error 1.2249 exceeds gate 0.12
- The supplied schema has no fields for gate charge, reverse-recovery charge/time, leakage, transconductance, temperature coefficients, maximum body-diode current, switching timing, or thermal resistance; those published values are retained only in extraction_notes.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

All 4 applicable published RDS(on) maximum limit(s) at the represented bias points are enforced as hard-bound checks.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
