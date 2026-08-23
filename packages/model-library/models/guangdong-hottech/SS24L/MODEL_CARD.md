# SS24L model card

## Identity

- Manufacturer: Guangdong Hottech
- Description: 2A 40V 500mV@2A 500uA@40V 50A Standalone SOD-123FL Schottky Diodes ROHS
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588918822799204352
- Revision: Not stated
- Accessed: 2026-08-23
- Referenced pages: PDF p. 1, PDF p. 2, PDF p. 3, PDF p. 4
- SHA-256: `61f09f11f7304db2dc1636a10d24b63b0a92ec57c5ed273b6efa493271a06da1`
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
| IS | 6.74166232e-8 | derived from cited maximum bound |
| N | 1.10000000e+0 | declared fixed F1 policy constant |
| RS | 1.00000000e-4 | declared fixed F1 policy constant |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 3.279e-14 and worst absolute delta was 1.621e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
