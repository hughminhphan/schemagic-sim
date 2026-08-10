# JSM2302A-A2SHB model card

## Identity

- Manufacturer: JSMSEMI
- Description: -55℃~+150℃ 1 N-channel 1V 20V 3A 60mΩ@4.5V 900mW N-Channel SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588945034095419392
- Revision: No revision stated; datasheet page footer www.jsmsemi.com
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `7af391bdaa4ce25b874254d96380afea37edd74ca1cd578998c0f69b213e6f01`
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
| KP | 3.70370370e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.97000000e-2 | fitted or derived |
| RS | 1.08000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 9.50000000e-10 | fitted or derived |
| CGDMAX | 5.00000000e-11 | fitted or derived |
| CGDMIN | 5.00000000e-11 | fitted or derived |
| CJO | 1.50000000e-10 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.08000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 1.598e-16 and worst absolute delta was 2.776e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 2.5609 exceeds gate 0.2; drain_current RMS relative error 0.9187 exceeds gate 0.12
- No capacitance data were published. The transfer figure does not state VDS, and the high-current output traces are clipped at the 10 A plot ceiling.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
