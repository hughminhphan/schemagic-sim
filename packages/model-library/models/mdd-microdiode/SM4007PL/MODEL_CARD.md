# SM4007PL model card

## Identity

- Manufacturer: MDD Microdiode Semiconductor
- Description: -55℃~+150℃ 1.1V@1A 10uA@1kV 1A 1kV 25A Independent SOD-123FL Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586175619906613248
- Revision: Rev. 2024A3
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `7849a016afabf2017a5c4bf769a3134fcc66afb54c5749930c80074f8ff58e6c`
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
| IS | 6.15833053e-8 | fitted or derived |
| N | 2.17815810e+0 | fitted or derived |
| RS | 6.45173105e-4 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 8.000000e-1 | 8.057125e-1 | V | 0.714% | p. 2, Fig. 3, Typical Forward Characteristic |
| forward voltage at 0.2 A | 8.400000e-1 | 8.448275e-1 | V | 0.575% | p. 2, Fig. 3, Typical Forward Characteristic |
| forward voltage at 0.5 A | 8.900000e-1 | 8.966429e-1 | V | 0.746% | p. 2, Fig. 3, Typical Forward Characteristic |
| forward voltage at 1 A | 9.300000e-1 | 9.360159e-1 | V | 0.647% | p. 2, Fig. 3, Typical Forward Characteristic |

Worst fitting error: 0.746% for forward voltage at 0.5 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 6.689e-14 and worst absolute delta was 5.407e-14.407e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
