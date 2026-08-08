# PN2222A model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose NPN silicon transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pub/Collateral/PN2222A-D.PDF
- Revision: Rev. 1.1.0, July 2014
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `f1eda8482f5f227f5c80c8ba750ae28ff2159139e268158bd656bc8f0db0a6d2`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | fitted |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 2.89621973e-14 | fitted or derived |
| NF | 1.00000000e+00 | fitted or derived |
| BF | 2.00000000e+03 | fitted or derived |
| IKF | 6.89199041e-01 | fitted or derived |
| ISE | 3.55570821e-14 | fitted or derived |
| NE | 1.20724478e+00 | fitted or derived |
| VAF | 1.00000000e+02 | fitted or derived |
| BR | 4.00000000e+00 | fitted or derived |
| RB | 3.50000000e+00 | fitted or derived |
| RE | 1.29629578e-04 | fitted or derived |
| RC | 1.65000000e+00 | fitted or derived |
| CJE | 2.95903496e-11 | fitted or derived |
| VJE | 7.50000000e-01 | fitted or derived |
| MJE | 3.30000000e-01 | fitted or derived |
| CJC | 1.92612542e-11 | fitted or derived |
| VJC | 7.50000000e-01 | fitted or derived |
| MJC | 3.30000000e-01 | fitted or derived |
| XCJC | 1.00000000e+00 | fitted or derived |
| TF | 4.35976726e-10 | fitted or derived |
| TR | 0.00000000e+00 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 3.500000e+01 | 3.793798e+01 | 1 | 8.394% | p. 3 electrical characteristics |
| VBE at IC=0.0001 A | 5.800000e-01 | 5.719531e-01 | V | 1.387% | p. 3 electrical characteristics |
| hFE at IC=0.001 A | 5.000000e+01 | 5.609372e+01 | 1 | 12.187% | p. 3 electrical characteristics |
| VBE at IC=0.001 A | 6.300000e-01 | 6.321053e-01 | V | 0.334% | p. 3 electrical characteristics |
| hFE at IC=0.01 A | 7.500000e+01 | 8.080732e+01 | 1 | 7.743% | p. 3 electrical characteristics |
| VBE at IC=0.01 A | 6.900000e-01 | 6.909683e-01 | V | 0.140% | p. 3 electrical characteristics |
| hFE at IC=0.15 A | 1.000000e+02 | 1.078791e+02 | 1 | 7.879% | p. 3 electrical characteristics |
| VBE at IC=0.15 A | 7.800000e-01 | 7.701052e-01 | V | 1.269% | p. 3 electrical characteristics |
| VCE(sat) at IC=0.15 A | 3.000000e-01 | 2.894416e-01 | V | 3.519% | p. 3 electrical characteristics |
| VBE(sat) at IC=0.15 A | 8.500000e-01 | 8.271697e-01 | V | 2.686% | p. 3 electrical characteristics |
| VCE(sat) at IC=0.5 A | 1.000000e+00 | 8.757064e-01 | V | 12.429% | p. 3 electrical characteristics |
| VBE(sat) at IC=0.5 A | 1.050000e+00 | 9.890147e-01 | V | 5.808% | p. 3 electrical characteristics |

Worst fitting error: 12.429% for VCE(sat) at IC=0.5 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.738e-11 and worst absolute delta was 8.669e-12.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM. Safe-operating-area and thermal-runaway behaviour is not modelled.
- Absolute maximum ratings are metadata only. The model does not model breakdown or failure at the rating boundary.
- Package parasitics (lead inductance, package capacitance) are not modelled.
- Reverse operation is not fitted: BR is a family-typical default and IKR, ISC, NC, VAR are at defaults.
- Base resistance modulation is not fitted: IRB and RBM are held at physical defaults because no base-resistance-versus-current data is published.
- Transit-time bias dependence is not fitted: XTF, VTF, and ITF are held at physical defaults because fT is published at a single bias.
- Flicker and burst noise are not modelled: KF and AF are held at physical defaults.
- hFE bin spread is not modelled. The published minima are enforced as guaranteed bounds; no typical gain distribution is claimed.
- CJE and CJC are derived from single tabulated capacitance points with VJE, VJC, MJE, and MJC held at physical defaults.
- Temperature coefficients XTB, EG, and XTI are held at physical defaults; only 25 degC data was fitted.
- The source publishes minimum and maximum rows rather than typical values. Acceptance uses hard guaranteed bounds, and the fidelity tier remains capped at F1.
- Saturation calibration is guaranteed-bound-only at IC = 150 mA, IB = 15 mA and IC = 500 mA, IB = 50 mA. No typical VBE(sat) or VCE(sat) curve is claimed between or beyond those points.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
