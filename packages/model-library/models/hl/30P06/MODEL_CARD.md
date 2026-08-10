# 30P06 model card

## Identity

- Manufacturer: HL
- Description: -55℃~+175℃ 1 P-Channel 1.8V 134pF 24mΩ@10V、30.4mΩ@4.5V 30A 4.026nF 60V 68nC@10V 79W 98pF P-Channel TO-252 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590910825551523840
- Revision: Version 1.1
- Accessed: 2026-08-10
- Referenced pages: 1, 2, 3
- SHA-256: `17ee4fb1585b0b74b0b9f7f8b46b4ec0001538aafbffcda7be2bf123826fbaee`
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
| VTO | -1.80000000e+0 | fitted or derived |
| KP | 8.33333333e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.32000000e-2 | fitted or derived |
| RS | 4.80000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 3.92800000e-9 | fitted or derived |
| CGDMAX | 9.80000000e-11 | fitted or derived |
| CGDMIN | 9.80000000e-11 | fitted or derived |
| CJO | 3.60000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 4.80000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.426e-16 and worst absolute delta was 2.776e-17.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage)
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
