# MUR460 model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: -55℃~+150℃ 1.7V@4A 4A 50ns 5uA@600V 600V DO-201AD Fast Recovery / High Efficiency Diodes ROHS
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588887214075875328
- Revision: datasheet as supplied
- Accessed: 2026-08-23
- Referenced pages: p. 1
- SHA-256: `cb0ec4271754f5cfc44b1ddb5282c8adac82726ee5754fd9395bdfbd613795d3`
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
| IS | 8.50549866e-9 | derived from cited maximum bound |
| N | 1.80000000e+0 | declared fixed F1 policy constant |
| RS | 1.00000000e-4 | declared fixed F1 policy constant |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 2.633e-14 and worst absolute delta was 2.454e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.
- F2 evidence did not qualify; staged as F1: No non-invented curve coordinates or cited forward-voltage/current pair were available.
- No non-invented curve coordinates or cited forward-voltage/current pair were available.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
