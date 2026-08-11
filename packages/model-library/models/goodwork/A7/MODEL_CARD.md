# A7 model card

## Identity

- Manufacturer: GOODWORK
- Description: 1.1V@1A 1A 1kV 25A 5uA@1kV Independent SOD-123FL Diodes - General Purpose ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8757767510114746368
- Revision: REV 2.0 2025 JAN
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `1ac47154e40fc2d289ed94ec603ac0e5b13f7ab9cc8096c1351e30930c99366d`
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
| IS | 6.35679236e-8 | fitted or derived |
| N | 2.25014767e+0 | fitted or derived |
| RS | 1.90180340e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 7.000000e-1 | 6.966096e-1 | V | 0.484% | p. 2, Fig. 2 |
| forward voltage at 0.08 A | 8.000000e-1 | 8.189638e-1 | V | 2.370% | p. 2, Fig. 2 |
| forward voltage at 0.4 A | 9.000000e-1 | 9.187186e-1 | V | 2.080% | p. 2, Fig. 2 |
| forward voltage at 1.2 A | 1.000000e+0 | 9.978721e-1 | V | 0.213% | p. 2, Fig. 2 |
| forward voltage at 3 A | 1.100000e+0 | 1.085433e+0 | V | 1.324% | p. 2, Fig. 2 |
| forward voltage at 7 A | 1.200000e+0 | 1.210817e+0 | V | 0.901% | p. 2, Fig. 2 |
| forward voltage at 11 A | 1.300000e+0 | 1.313195e+0 | V | 1.015% | p. 2, Fig. 2 |

Worst fitting error: 2.370% for forward voltage at 0.08 A.

Native and WASM agreement: all 11 benches passed. Worst reported relative delta was 1.808e-14 and worst absolute delta was 1.266e-14.266e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No reverse-recovery or breakdown-voltage specification is published in the supplied datasheet.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
