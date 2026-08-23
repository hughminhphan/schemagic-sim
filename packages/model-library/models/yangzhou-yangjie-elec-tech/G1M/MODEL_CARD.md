# G1M model card

## Identity

- Manufacturer: Yangzhou Yangjie Elec Tech
- Description: -55℃~+150℃ 1.1V@1A 1A 1kV 30A 5uA@1kV Independent SOD-123 Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588918623443935232
- Revision: S-S036 Rev. 2.4, 23-Apr-19
- Accessed: 2026-08-23
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `1469ce7fc01cba62a91a63b242c703317e2a06d0c149f9919809714854be4632`
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
| IS | 9.09069826e-11 | derived from cited maximum bound |
| N | 1.80000000e+0 | declared fixed F1 policy constant |
| RS | 1.00000000e-4 | declared fixed F1 policy constant |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 3.525e-14 and worst absolute delta was 3.797e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.
- The datasheet publishes no junction-capacitance value, reverse-recovery-time value, or paired breakdown-voltage/current measurement; those fields are null.
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
