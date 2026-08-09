# SI2301CDS-T1-GE3 model card

## Identity

- Manufacturer: Vishay Intertech
- Description: -55℃~+150℃ 1 P-Channel 1.6W 10nC@4.5V 142mΩ@2.5V 1V 20V 3.1A 405pF 55pF 75pF P-Channel SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8579707746213814272
- Revision: S10-2430-Rev. C, 25-Oct-10, Document Number 68741
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `54dbab870c4de746422a9ddefdd19d3d78acde5ace00d0f7239d665f3bb83387`
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
| KP | 2.22222222e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 4.95000000e-2 | fitted or derived |
| RS | 1.80000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.50000000e-10 | fitted or derived |
| CGDMAX | 5.50000000e-11 | fitted or derived |
| CGDMIN | 5.50000000e-11 | fitted or derived |
| CJO | 2.00000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.80000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.408e-16 and worst absolute delta was 2.776e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: LAMBDA saturated its bound at 0.2; the residual is a constraint artefact; drain_current worst relative error 0.8007 exceeds gate 0.2; drain_current RMS relative error 0.2231 exceeds gate 0.12
- The supplied schema has no fields for gate charge, reverse-recovery charge/time, leakage, transconductance, temperature coefficients, or thermal resistance, so those published values are retained only in extraction_notes.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

All 2 applicable published RDS(on) maximum limit(s) at the represented bias points are enforced as hard-bound checks.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
