# SS33 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-7 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603186785955049472
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `6f4e0d4eb66ab3b0f99d80b337bfad75a949c03badc693dac1238d5961458d77`
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
| IS | 1.88633336e-6 | fitted or derived |
| N | 1.26392095e+0 | fitted or derived |
| RS | 2.32325335e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 2.800000e-1 | 2.803796e-1 | V | 0.136% | p. 2 Fig. 3 |
| forward voltage at 0.1 A | 3.500000e-1 | 3.558574e-1 | V | 1.674% | p. 2 Fig. 3 |
| forward voltage at 1 A | 4.300000e-1 | 4.332221e-1 | V | 0.749% | p. 2 Fig. 3 |
| forward voltage at 10 A | 5.300000e-1 | 5.294056e-1 | V | 0.112% | p. 2 Fig. 3 |
| forward voltage at 50 A | 6.700000e-1 | 6.749502e-1 | V | 0.739% | p. 2 Fig. 3 |

Worst fitting error: 1.674% for forward voltage at 0.1 A.

Native and WASM agreement: all 8 benches passed. Worst reported relative delta was 1.016e-13 and worst absolute delta was 2.909e-14.909e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, axes, conditions, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
