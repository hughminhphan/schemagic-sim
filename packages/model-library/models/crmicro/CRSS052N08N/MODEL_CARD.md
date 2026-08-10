# CRSS052N08N model card

## Identity

- Manufacturer: CRMICRO
- Description: -55℃~+150℃ 1 N-channel 1.057nF 120A 174W 26pF 3.086nF 4V 5.5mΩ@10V 55nC@10V 85V N-Channel TO-263 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588885207272972288
- Revision: 3.0 (2019-05-31)
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- SHA-256: `841160c95f21601330dc55e7f0ae31825c8107c8eee3e2a4ca939d0ccb59b1bc`
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
| VTO | 3.00000000e+0 | fitted or derived |
| KP | 4.65116279e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.36500000e-3 | fitted or derived |
| RS | 8.60000000e-4 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.06000000e-9 | fitted or derived |
| CGDMAX | 2.60000000e-11 | fitted or derived |
| CGDMIN | 2.60000000e-11 | fitted or derived |
| CJO | 1.03100000e-9 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 8.60000000e-4 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 1.972e-22 and worst absolute delta was 1.972e-31.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 1.1433 exceeds gate 0.2; drain_current RMS relative error 0.4248 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
