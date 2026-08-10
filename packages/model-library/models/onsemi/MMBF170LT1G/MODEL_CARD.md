# MMBF170LT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃ 1 N-channel 225mW 3V 500mA 5Ω@10V 60V 60pF N-Channel SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586177094799384576
- Revision: MMBF170LT1/D, Rev. 9, August 2013
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `4e5c97d889b54211e050855d5e894b3b357a68761b449d80008b7e3c52e3b7e5`
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
| KP | 4.44444444e-1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 2.47500000e+0 | fitted or derived |
| RS | 9.00000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 1.00000000e-11 | fitted or derived |
| CGDMAX | 5.00000000e-11 | fitted or derived |
| CGDMIN | 5.00000000e-11 | fitted or derived |
| CJO | 1.50000000e-10 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 9.00000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 2.019e-19 and worst absolute delta was 2.019e-28.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: LAMBDA saturated its bound at 0.2; the residual is a constraint artefact; drain_current worst relative error 1.5502 exceeds gate 0.2; drain_current RMS relative error 0.2985 exceeds gate 0.12
- The public datasheet provides only a maximum Ciss value at VDS = 10 V, VGS = 0 V, and 1 MHz. It does not publish Coss, Crss, or a capacitance-versus-VDS curve, so terminal-capacitance decomposition and nonlinear gate-drain capacitance extraction are omitted. It also provides no tabulated typical threshold or body-diode forward-voltage value; the transfer and diode figures are retained as digitized typical curves instead.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
