# 1SS226 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603007658832519168
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `f2e3f606612e89803e4017eae4c8d7356ebe80d8f755475148d7b9ad8d9bf20b`
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
| IS | 2.39297577e-10 | fitted or derived |
| N | 1.44238593e+0 | fitted or derived |
| RS | 1.46684484e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1e-05 A | 4.000000e-1 | 3.969771e-1 | V | 0.756% | p. 2 Fig. 1, 25 degC curve |
| forward voltage at 0.0001 A | 4.700000e-1 | 4.830126e-1 | V | 2.769% | p. 2 Fig. 1, 25 degC curve |
| forward voltage at 0.001 A | 5.600000e-1 | 5.702358e-1 | V | 1.828% | p. 2 Fig. 1, 25 degC curve |
| forward voltage at 0.01 A | 6.800000e-1 | 6.693404e-1 | V | 1.568% | p. 2 Fig. 1, 25 degC curve |
| forward voltage at 0.1 A | 8.800000e-1 | 8.872594e-1 | V | 0.825% | p. 2 Fig. 1, 25 degC curve |

Worst fitting error: 2.769% for forward voltage at 0.0001 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 2.553e-14 and worst absolute delta was 1.027e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
