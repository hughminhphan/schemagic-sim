# 2N7002-7-F model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -55℃~+150℃ 1 N-channel 2.5V 210mA 223pC@4.5V 370mW 50pF 5pF 60V 7.5Ω@5V SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8757233029595316224
- Revision: DS11303 Rev. 40-2, July 2024
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `ff8e1c98f93c7e3a2cdbe763d4ef6bd6028699bf005882871c00d2d5a398f6b1`
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
| VTO | 2.50000000e+0 | fitted or derived |
| KP | 6.25000000e-1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.76000000e+0 | fitted or derived |
| RS | 6.40000000e-1 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.00000000e-11 | fitted or derived |
| CGDMAX | 2.00000000e-12 | fitted or derived |
| CGDMIN | 2.00000000e-12 | fitted or derived |
| CJO | 9.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 6.40000000e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 1.822e-16 and worst absolute delta was 2.220e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage)
- No capacitance-versus-VDS curve or body-diode reverse-recovery data is published; capacitance extraction is limited to the tabulated single-bias values and reverse recovery is omitted.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
