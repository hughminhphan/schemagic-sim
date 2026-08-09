# FDV301N model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃ 1 N-channel 1.06V 1.3pF 220mA 25V 350mW 5Ω@2.7V 6pF 700pC@4.5V 9.5pF N-Channel SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586172171408719872
- Revision: Rev. F1, June 2009
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `61444360dd8a9c01d48f428b40aa9f186082b723bdef7c63619894496ef44e3c`
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
| VTO | 8.50000000e-1 | fitted or derived |
| KP | 5.26315789e-1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.09000000e+0 | fitted or derived |
| RS | 7.60000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 8.20000000e-12 | fitted or derived |
| CGDMAX | 1.30000000e-12 | fitted or derived |
| CGDMIN | 1.30000000e-12 | fitted or derived |
| CJO | 4.70000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 7.60000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.776e-3 and worst absolute delta was 1.776e-12.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.3729 exceeds gate 0.2; rds_on worst relative error 0.4437 exceeds gate 0.2; rds_on RMS relative error 0.2070 exceeds gate 0.12
- The supplied strict schema has no fields for several additional supported datasheet rows, including IDSS, IGSS, gate charge, switching times, thermal resistance, temperature coefficient, and maximum VSD; only schema-supported facts are included.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
