# BSS84-7-F model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -55℃~+150℃ 1 P-Channel 130mA 2.8pF 24.6pF 2V 3.2Ω@5V 300mW 4.7pF 50V 590pC@10V SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8560107418433572864
- Revision: DS30149 Rev. 26 - 2, July 2024
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `5da6340385fbaf80034239336bf9af944ff20bb88e0369a0911354e626b3f01f`
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
| KP | 6.25000000e-1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.76000000e+0 | fitted or derived |
| RS | 6.40000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.18000000e-11 | fitted or derived |
| CGDMAX | 2.80000000e-12 | fitted or derived |
| CGDMIN | 2.80000000e-12 | fitted or derived |
| CJO | 1.90000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 6.40000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 0.000e+0 and worst absolute delta was 0.000e+0.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.3988 exceeds gate 0.2; drain_current RMS relative error 0.1466 exceeds gate 0.12; rds_on worst relative error 0.4980 exceeds gate 0.2; rds_on RMS relative error 0.4980 exceeds gate 0.12
- Body-diode forward-voltage and reverse-recovery data are not published in the supplied datasheet; IDSS, gate charge, and thermal ratings are not representable in the supplied extraction schema.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

All 1 applicable published RDS(on) maximum limit(s) at the represented bias points are enforced as hard-bound checks.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
