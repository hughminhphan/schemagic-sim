# NCE3407 model card

## Identity

- Manufacturer: Wuxi NCE Power Semiconductor
- Description: -55℃~+150℃ 1 P-Channel 1.4W 1.5V 105pF 12.5nC@10V 30V 4.1A 650pF 65pF 95mΩ@4.5V P-Channel SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586181025684316160
- Revision: v1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7
- SHA-256: `f1e8ea7558dc8e67a0fd60044fed557390c7f135febbec07fd309742dea25038`
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
| KP | 4.16666667e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.64000000e-2 | fitted or derived |
| RS | 9.60000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 5.85000000e-10 | fitted or derived |
| CGDMAX | 6.50000000e-11 | fitted or derived |
| CGDMIN | 6.50000000e-11 | fitted or derived |
| CJO | 4.00000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 9.60000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 3.155e-21 and worst absolute delta was 3.155e-30.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 4.6959 exceeds gate 0.2; drain_current RMS relative error 0.8461 exceeds gate 0.12; rds_on worst relative error 0.3248 exceeds gate 0.2; rds_on RMS relative error 0.1629 exceeds gate 0.12
- The strict extraction schema has no dedicated fields for IDSS, gate leakage, switching times, gate-charge components, thermal resistance, or transconductance; those published values are preserved in extraction notes.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
