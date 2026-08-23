# DFLS1150Q-7 model card

## Identity

- Manufacturer: Diodes Incorporated
- Description: -55℃~+175℃ 150V 1A 820mV@1A Independent PowerDI-123 Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586197557579669504
- Revision: DS38627 Rev. 4 - 2, December 2024
- Accessed: 2026-08-23
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `436752a6304bf3a6ea0649f11e45b84f75d9fe620f12686ffb656f17358a4b22`
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
| IS | 5.70712119e-13 | derived from cited maximum bound |
| N | 1.10000000e+0 | declared fixed F1 policy constant |
| RS | 1.00000000e-4 | declared fixed F1 policy constant |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 3.752e-14 and worst absolute delta was 3.020e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.
- F2 evidence did not qualify; staged as F1: No non-invented curve coordinates were extracted from the rendered plots.
- No non-invented curve coordinates were extracted from the rendered plots.
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
