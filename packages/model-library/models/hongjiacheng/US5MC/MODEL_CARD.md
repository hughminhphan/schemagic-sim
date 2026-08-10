# US5MC model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602925638156775424
- Revision: Rev:1.1
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `72c025a3ed1929e640787e2277e9934b27e283da9ba7bd3c1e654296f973adc4`
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
| IS | 1.05507177e-8 | fitted or derived |
| N | 2.50117349e+0 | fitted or derived |
| RS | 2.06747710e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.01 A | 9.000000e-1 | 8.905006e-1 | V | 1.055% | p. 2 Fig. 3 |
| forward voltage at 0.1 A | 1.000000e+0 | 1.041322e+0 | V | 4.132% | p. 2 Fig. 3 |
| forward voltage at 0.9 A | 1.200000e+0 | 1.200006e+0 | V | 0.000% | p. 2 Fig. 3 |
| forward voltage at 4.5 A | 1.400000e+0 | 1.378554e+0 | V | 1.532% | p. 2 Fig. 3 |
| forward voltage at 13 A | 1.600000e+0 | 1.622920e+0 | V | 1.432% | p. 2 Fig. 3 |

Worst fitting error: 4.132% for forward voltage at 0.1 A.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 9.330e-15 and worst absolute delta was 8.327e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- No breakdown-voltage or breakdown-current test point is published; only reverse-blocking ratings are provided.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
