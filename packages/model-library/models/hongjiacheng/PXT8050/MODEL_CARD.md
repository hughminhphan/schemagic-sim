# PXT8050 model card

## Identity

- Manufacturer: hongjiacheng
- Description: bjt from hongjiacheng
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: independent-package-review-batch-10 (2026-08-12)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879661869400064
- Revision: Rev:1.1
- Accessed: 2026-08-11
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `1f289cfb77b3a8593b4a6f69ad6f8f4cd208099ab18d200d4f23d53226043f49`
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
| IS | 1.00000000e-14 | held generic F1 default |
| BF | 8.58500000e+1 | evidence-derived from hFE minimum 85 with 1% headroom |
| VAF | 1.00000000e+2 | held generic F1 default |
| IKF | 1.00000000e+3 | held generic F1 default |
| RB | 1.00000000e+1 | held generic F1 default |
| RC | 1.00000000e-1 | held generic F1 default |
| RE | 5.00000000e-2 | held generic F1 default |
| CJE | 1.00000000e-12 | held generic default; AC none |
| CJC | 1.00000000e-12 | held generic default; AC none |
| TF | 1.00000000e-9 | held generic default; transient none |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

Only BF is evidence-derived from the published hFE minimum. All other numerical values are unchanged generic F1 defaults, not datasheet-fitted claims. No multi-point F2 residual claim is made.

Native and WASM agreement: all 4 checks passed. Worst reported relative delta was 3.786e-12 and worst absolute delta was 3.273e-13.

## Known omissions

- Saturation, breakdown, AC, and transient behavior are outside the approved F1 scope; only the cited 25 degC current-gain bounds at VCE = 1 V are claimed.

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Validation failed for PXT8050. See validation-results.json; failed package checks: vbe_sat_1_maximum observed 1.7015291830484092 (maximum 1.2)
- Saturation-voltage behavior is not covered by this F1 package; the supported region is limited to cited DC current-gain evidence.
- Independent review approved this staged candidate for promotion eligibility; no promotion was performed during review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
