# APM4953 model card

## Identity

- Manufacturer: ElecSuper
- Description: -55℃~+150℃ 1.5V 100pF 2 P-Channel 3.2W 30V 40mΩ@10V、55mΩ@4.5V 5.8A 520pF 65pF 9.2nC@10V P-Channel SOP8 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8608745005884321792
- Revision: Rev-1.4
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `07cd6ad72700f92e7692ff50fa0ff43930dfcc2366392c2a5d7e6ef8bf77a0ba`
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
| VTO | 1.50000000e+0 | fitted or derived |
| KP | 5.00000000e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.20000000e-2 | fitted or derived |
| RS | 8.00000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.55000000e-10 | fitted or derived |
| CGDMAX | 6.50000000e-11 | fitted or derived |
| CGDMIN | 6.50000000e-11 | fitted or derived |
| CJO | 3.50000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 8.00000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 0.000e+00 and worst absolute delta was 0.000e+00.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.9795 exceeds gate 0.2; drain_current RMS relative error 0.2028 exceeds gate 0.12; rds_on worst relative error 0.2260 exceeds gate 0.2; rds_on RMS relative error 0.1636 exceeds gate 0.12
- The strict schema has no fields for thermal resistance, gate charge, gate resistance, IDSS, or RDS(on) maximums. The -VGS = -8 V and -10 V output traces are omitted because they clip at the 40 A plot ceiling and overlap near the origin.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
