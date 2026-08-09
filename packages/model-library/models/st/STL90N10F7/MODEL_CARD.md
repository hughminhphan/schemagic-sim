# STL90N10F7 model card

## Identity

- Manufacturer: STMicroelectronics
- Description: -55℃~+175℃ 1 N-channel 100V 100W 4.03nF 4.5V 58pF 60nC@50V 70A 8mΩ@10V PowerFLAT-8(5x6) MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588911510403473408
- Revision: DocID024551 Rev 6, August 2017
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `ce63e4e0803c40481071ec6ab53ee4ca008b98d97b798ef4478105aab334d9a7`
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
| VTO | 3.50000000e+0 | fitted or derived |
| KP | 2.85714286e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 3.85000000e-3 | fitted or derived |
| RS | 1.40000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.05500000e-9 | fitted or derived |
| CGDMAX | 4.50000000e-11 | fitted or derived |
| CGDMIN | 4.50000000e-11 | fitted or derived |
| CJO | 6.55000000e-10 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.40000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 9.861e-23 and worst absolute delta was 9.861e-32.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.6780 exceeds gate 0.2; drain_current RMS relative error 0.3523 exceeds gate 0.12; rds_on worst relative error 0.3320 exceeds gate 0.2; rds_on RMS relative error 0.3320 exceeds gate 0.12
- The published transfer, output, capacitance, gate-charge, RDS(on), and source-drain diode curves are usable and are represented in curves. The supplied schema has no fields for leakage, switching times, reverse-recovery charge or time, avalanche energy, thermal resistance, maximum table limits beyond the required scalar fields, or temperature-normalized curves, so those values are omitted from structured specs.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

All 1 applicable published RDS(on) maximum limit(s) at the represented bias points are enforced as hard-bound checks.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
