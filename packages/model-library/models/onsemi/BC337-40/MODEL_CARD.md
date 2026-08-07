# BC337-40 model card

## Identity

- Manufacturer: onsemi
- Description: NPN epitaxial silicon transistor, gain class 40
- Electrical family: bjt_npn
- Fidelity tier: F1, bounded / approximate
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/products/discrete-semiconductors/bipolar-transistors/bc337
- Revision: Manufacturer product specification page, accessed 2026-08-07
- Accessed: 2026-08-06
- Referenced pages: manufacturer specification table
- SHA-256: `dcdb1dc4ed8548af5646efac69275f3742fa61f3761e6e30d104763af06016f8`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | approx |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 8.00000000e-14 | fitted or derived |
| NF | 1.00000000e+00 | fitted or derived |
| BF | 5.20000000e+02 | fitted or derived |
| IKF | 2.80000000e-01 | fitted or derived |
| ISE | 4.00000000e-10 | fitted or derived |
| NE | 4.00000000e+00 | fitted or derived |
| VAF | 1.00000000e+02 | fitted or derived |
| BR | 4.00000000e+00 | fitted or derived |
| RB | 1.20000000e+01 | fitted or derived |
| RE | 1.00000000e-01 | fitted or derived |
| RC | 3.00000000e-01 | fitted or derived |
| CJE | 1.42033678e-11 | fitted or derived |
| VJE | 7.50000000e-01 | fitted or derived |
| MJE | 3.30000000e-01 | fitted or derived |
| CJC | 2.88918813e-11 | fitted or derived |
| VJC | 7.50000000e-01 | fitted or derived |
| MJC | 3.30000000e-01 | fitted or derived |
| XCJC | 1.00000000e+00 | fitted or derived |
| TF | 1.46737759e-09 | fitted or derived |
| TR | 0.00000000e+00 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No typical-curve fit claimed | n/a | n/a | n/a | n/a | See guaranteed-bound checks |

Worst fitting error: 0.000% for not claimed for bounded F1 model.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 3.809e-12 and worst absolute delta was 3.672e-10.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM. Safe-operating-area and thermal-runaway behaviour is not modelled.
- Absolute maximum ratings are metadata only. The model does not model breakdown or failure at the rating boundary.
- Package parasitics (lead inductance, package capacitance) are not modelled.
- Reverse operation is not fitted: BR is a family-typical default and IKR, ISC, NC, VAR are at defaults.
- Base resistance modulation is not fitted: IRB and RBM are held at physical defaults because no base-resistance-versus-current data is published.
- Transit-time bias dependence is not fitted: XTF, VTF, and ITF are held at physical defaults because fT is published at a single bias.
- Flicker and burst noise are not modelled: KF and AF are held at physical defaults.
- CJE and CJC are derived from single tabulated capacitance points with VJE, VJC, MJE, and MJC held at physical defaults.
- Temperature coefficients XTB, EG, and XTI are held at physical defaults; only 25 degC data was fitted.
- NF, NR, IRB, RBM, XTF, VTF, ITF, XTB, EG, XTI, KF, AF, IKR, ISC, NC, and VAR are held at default because the datasheet does not characterise them.
- TR is held at default because no storage-time row is published for this part.
- VBE(sat) is explicitly unclaimed. The single Gummel-Poon model misses the published 500 mA forced-beta VBE(sat), which lies outside the supported 300 mA gain region.
- DC coverage is approximate and bounded, not a typical-curve fit. Gain is checked only at the published class-40 100 mA and 300 mA boundaries.
- The 500 mA VCE(sat) maximum is checked as an external guaranteed limit; it does not extend the supported current region beyond 300 mA.
- The official PDF remained unavailable after direct and regional URL attempts. This F1 model is independently calibrated to the BC337-40 manufacturer product specification limits and does not reuse the BC327-40 DC parameter card.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
