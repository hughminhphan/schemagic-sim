# TPZXMP3A13FTA model card

## Identity

- Manufacturer: TECH PUBLIC
- Description: -50℃~+150℃ 1 P-Channel 1.25W 10nC@10V 126pF 1V 30V 3A 565pF 75mΩ@4.5V 75pF P-Channel SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590442898463219712
- Revision: Revision not stated on scanned datasheet; copyright/web document, 4 pages
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `551fa4dd67fc3098692a7372c22a3e3d040246e57776100dfcd971c57802fe5f`
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
| VTO | -3.00000000e+0 | fitted or derived |
| KP | 3.33333333e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 3.30000000e-2 | fitted or derived |
| RS | 1.20000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 4.90000000e-10 | fitted or derived |
| CGDMAX | 7.50000000e-11 | fitted or derived |
| CGDMIN | 7.50000000e-11 | fitted or derived |
| CJO | 5.10000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.20000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.578e-21 and worst absolute delta was 1.578e-30.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage)
- The strict schema does not represent gate charge, switching times, thermal resistances, or safe-operating-area data. No separate transfer-characteristic figure is published; output and capacitance curves are available and recorded.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
