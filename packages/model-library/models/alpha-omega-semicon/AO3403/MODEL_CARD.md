# AO3403 model card

## Identity

- Manufacturer: Alpha Omega Semicon
- Description: -55℃~+150℃ 1 P-Channel 1.4V 1.4W 115mΩ@10V 2.6A 30V 315pF 7.2nC@10V SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586179461759053824
- Revision: Rev 10, Jan. 2011
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `e56d956986d4a3653212ede7bc624295fc804595eb8bf9e18b27ea41a5210aa5`
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
| KP | 2.27272727e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 4.84000000e-2 | fitted or derived |
| RS | 1.76000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.00000000e-15 | fitted or derived |
| CGDMAX | 2.00000000e-8 | fitted or derived |
| CGDMIN | 2.00000000e-8 | fitted or derived |
| CJO | 1.70000000e-8 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.76000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 3.013e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.4032 exceeds gate 0.2; drain_current RMS relative error 0.1794 exceeds gate 0.12; rds_on RMS relative error 0.1277 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
