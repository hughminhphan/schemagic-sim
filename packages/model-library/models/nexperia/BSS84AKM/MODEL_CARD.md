# BSS84AKM model card

## Identity

- Manufacturer: Nexperia
- Description: -55℃~+150℃ 1 P-Channel 1.1V 1.3pF 230mA 340mW 350pC@25V 36pF 50V 7.5Ω@10V SOT-883 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588929261571092480
- Revision: Rev. 1 - 23 May 2011
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 5, p. 6, p. 7, p. 8, p. 9
- SHA-256: `26fc53719fee3fba415d24eb26f5ac7ec11f409215bb8401b511b76d90814ee3`
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
| VTO | 1.60000000e+0 | fitted or derived |
| KP | 4.44444444e-1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.47500000e+0 | fitted or derived |
| RS | 9.00000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.27000000e-11 | fitted or derived |
| CGDMAX | 1.30000000e-12 | fitted or derived |
| CGDMIN | 1.30000000e-12 | fitted or derived |
| CJO | 3.20000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 9.00000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.524e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.4449 exceeds gate 0.2; drain_current RMS relative error 0.1682 exceeds gate 0.12; rds_on worst relative error 0.5567 exceeds gate 0.2; rds_on RMS relative error 0.3609 exceeds gate 0.12
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

All 2 applicable published RDS(on) maximum limit(s) at the represented bias points are enforced as hard-bound checks.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
