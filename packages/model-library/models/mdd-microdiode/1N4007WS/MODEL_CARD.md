# 1N4007WS model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: 1.1V@1A 1A 1kV 5uA@1kV Independent SOD-323 Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588883633633431552
- Revision: Rev. 2024A2
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `5bd15ecf26151949ce9f40389005b589f65f55f995cda41f9c3cdafe94b1538a`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 1.10069104e-8 | fitted or derived |
| N | 1.93900060e+0 | fitted or derived |
| RS | 2.65561529e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 8.000000e-1 | 8.062003e-1 | V | 0.775% | p. 2, Fig. 3, Typical Forward Characteristic |
| forward voltage at 0.2 A | 8.400000e-1 | 8.436187e-1 | V | 0.431% | p. 2, Fig. 3, Typical Forward Characteristic |
| forward voltage at 0.5 A | 8.900000e-1 | 8.975394e-1 | V | 0.847% | p. 2, Fig. 3, Typical Forward Characteristic |
| forward voltage at 1 A | 9.400000e-1 | 9.455803e-1 | V | 0.594% | p. 2, Fig. 3, Typical Forward Characteristic |

Worst fitting error: 0.847% for forward voltage at 0.5 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 1.444e-15 and worst absolute delta was 1.221e-15.221e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
