# MMST5551 model card

## Identity

- Manufacturer: hongjiacheng
- Description: bjt from hongjiacheng
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-9 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8604448564001193984
- Revision: Rev:1.1
- Accessed: 2026-08-11
- Referenced pages: pp. 1-3
- SHA-256: `1368b3f7c24ca204362af682e5ed1a18ee5a91107f6e932b6a860a554f5254b9`
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
| BF | 8.08000000e+1 | fitted or derived |
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

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 2.024e-12 and worst absolute delta was 1.315e-13.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Validation failed for MMST5551. See validation-results.json; failed package checks: hfe_maximum_at_0.01_a observed 317.0363148139011 (maximum 300)
- Saturation-voltage behavior is not covered by this F1 package; the supported region is limited to cited DC current-gain evidence.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
