# AP3404S model card

## Identity

- Manufacturer: ALLPOWER ShenZhen Quan Li Semiconductor
- Description: -55℃~+150℃ 1 N-channel 1.4W 2.5V 30V 32pF 34mΩ@4.5V 55pF 6.5A 690pF N-Channel SOT-23-3 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588945466666573824
- Revision: v1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `b924f642d3181abafa4ca0c51b4583e4936454f9eaa3f54b6ee0dcf7ad9eeb64`
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
| KP | 1.00000000e+2 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.10000000e-2 | fitted or derived |
| RS | 4.00000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.13000000e-10 | fitted or derived |
| CGDMAX | 3.20000000e-11 | fitted or derived |
| CGDMIN | 3.20000000e-11 | fitted or derived |
| CJO | 2.30000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 4.00000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.319e-16 and worst absolute delta was 1.388e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.8836 exceeds gate 0.2; drain_current RMS relative error 0.2896 exceeds gate 0.12; rds_on worst relative error 0.3748 exceeds gate 0.2; rds_on RMS relative error 0.3691 exceeds gate 0.12
- Maximum RDS(on) and Ciss values, switching timing values, and the multi-curve SOA limits are published but have no dedicated fields in the strict MOSFET schema; they are preserved in extraction notes. No single SOA trace was asserted.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
