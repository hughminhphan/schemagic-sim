# 2SC2412K model card

## Identity

- Manufacturer: ROHM Semicon
- Description: -55℃~+150℃ 1 NPN 100nA 120 150mA 180MHz 200mW 400mV 50V 7V NPN TO-236-3(SOT-23-3) Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586202910383853568
- Revision: 20150824 - Rev.003
- Accessed: 2026-08-10
- Referenced pages: p. 1 (features, packaging specifications, hFE rank), p. 2 (absolute maximum ratings, electrical characteristics, hFE rank table), p. 3 (fig. 1-4), p. 4 (fig. 5-8), p. 5 (fig. 9, SOA fig. 10-12), p. 6 (SOA fig. 13-15), p. 7-12 (package dimensions, skimmed, no electrical data), p. 13-14 (distributor-appended part information, skimmed, no electrical data)
- SHA-256: `9c6937ffcbd4ef1ba062bebb96b4edc3d29a2407825fadc0b416af27c4f91959`
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
| BF | 2.59000000e+2 | fitted or derived |
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

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 1.855e-11 and worst absolute delta was 1.682e-13.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Validation failed for 2SC2412KT146R. See validation-results.json; failed package checks: vce_sat_2 observed 0.06611761046007927 (allowed error 0.02), vce_sat_3 observed 0.0671444467266149 (allowed error 0.02), vce_sat_6 observed 0.08517988540340245 (allowed error 0.026160000000000003), upper_current_boundary_voltage observed 6.662396390091058 (maximum 6)
- Saturation-voltage behavior is not covered by this F1 package; the supported region is limited to cited DC current-gain evidence.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
