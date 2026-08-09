# PMBT4403 model card

## Identity

- Manufacturer: Nexperia
- Description: -65℃~+150℃ 1 PNP 100 200MHz 250mW 400mV 40V 50nA 5V 600mA PNP SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent re-reviewer (P6 proving-50 final)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586180188208582656
- Revision: PMBT4403 v.5, 5 March 2015
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 3, p. 5, p. 6, p. 7, p. 8, p. 11
- SHA-256: `dcece442ed928e3fa5f0596f102d462475b223edee1dbf32d6638f53ef7373f7`
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
| IS | 1.00000000e-14 | fitted or derived |
| BF | 3.00000000e+2 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| IKF | 1.00000000e+3 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| CJE | 1.00000000e-12 | fitted or derived |
| CJC | 1.00000000e-12 | fitted or derived |
| TF | 1.00000000e-9 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 4.234e-12 and worst absolute delta was 1.025e-12.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Validation failed for PMBT4403-215. See validation-results.json; failed package checks: vbe_sat_2_maximum observed 1.3151484220737057 (maximum 1.3)
- This minimum F2 extraction omits temperature coefficients, reverse-operation parameters, noise, switching-time curves, and capacitance-versus-bias curves. The output-characteristics curve is retained as digitized context, but no scalar VAF is emitted because the schema has no VAF field and the single representative curve is insufficient for a robust Early-voltage fit.
- Saturation-voltage behavior is not covered by this F1 package; the supported region is limited to cited DC current-gain evidence.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
