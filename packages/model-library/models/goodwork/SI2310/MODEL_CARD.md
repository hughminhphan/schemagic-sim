# SI2310 model card

## Identity

- Manufacturer: GOODWORK
- Description: -55℃~+150℃ 1 N-channel 1.5W 125mΩ@4.5V 19.5pF 247pF 2V 3A 60V 6nC@4.5V N-Channel SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8757962829993926656
- Revision: Rev 2.0, January 2025
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `1c24a1225f3e3a17ba4f21301565cf23e8161616faca7441831845324475bcbe`
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
| VTO | 1.03000000e+0 | fitted or derived |
| KP | 2.56410256e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 4.29000000e-2 | fitted or derived |
| RS | 1.56000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.27500000e-10 | fitted or derived |
| CGDMAX | 1.95000000e-11 | fitted or derived |
| CGDMIN | 1.95000000e-11 | fitted or derived |
| CJO | 1.45000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.56000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.473e-16 and worst absolute delta was 2.776e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: THETA saturated its bound at 1; the residual is a constraint artefact; drain_current worst relative error 0.6749 exceeds gate 0.2; drain_current RMS relative error 0.3017 exceeds gate 0.12; rds_on worst relative error 0.3279 exceeds gate 0.2; rds_on RMS relative error 0.1893 exceeds gate 0.12
- No capacitance-versus-VDS curve or junction-to-case thermal resistance is published; those quantities cannot be extracted beyond the tabulated terminal capacitances and RthetaJA.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
