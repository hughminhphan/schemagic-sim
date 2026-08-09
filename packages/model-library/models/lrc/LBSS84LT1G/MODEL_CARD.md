# LBSS84LT1G model card

## Identity

- Manufacturer: LRC
- Description: -55℃~+150℃ 1 P-Channel 10pF 10Ω@5V 130mA 225mW 2V 30pF 50V 5pF 6nC P-Channel SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8579707737607241728
- Revision: Rev. A
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `4a0cddadbea0bf5ee41daf8bbe43a0132cb4c0de4684ad5f1260714fbfb6fb8c`
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
| KP | 4.00000000e-1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.75000000e+0 | fitted or derived |
| RS | 1.00000000e+0 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.50000000e-11 | fitted or derived |
| CGDMAX | 5.00000000e-12 | fitted or derived |
| CGDMIN | 5.00000000e-12 | fitted or derived |
| CJO | 5.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.203e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: family parked after 2 consecutive F2 fit-gate failures with no F2 success; later parts staged F1 (mosfet F2 gate failed: drain_current worst relative error 206.6953 exceeds gate 0.2; drain_current RMS relative error 45.8444 exceeds gate 0.12; rds_on worst relative error 2.1337 exceeds gate 0.2; rds_on RMS relative error 1.2249 exceeds gate 0.12)
- No capacitance-versus-VDS figure is present in the supplied datasheet; capacitance values are available only as table entries.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

All 1 applicable published RDS(on) maximum limit(s) at the represented bias points are enforced as hard-bound checks.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
