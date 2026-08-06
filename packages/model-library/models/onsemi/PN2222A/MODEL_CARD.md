# PN2222A model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose NPN silicon transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-fitted
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
| NF | 1.00000000e+0 | fitted or derived |
| BF | 2.00000000e+3 | fitted or derived |
| IKF | 6.89199041e-1 | fitted or derived |
| ISE | 3.55570821e-14 | fitted or derived |
| NE | 1.20724478e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 1.20865502e+1 | fitted or derived |
| RE | 1.29629578e-4 | fitted or derived |
| RC | 1.88309779e+0 | fitted or derived |
| CJE | 2.95903496e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 1.92612542e-11 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 4.31486970e-10 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 3.500000e+1 | 3.793941e+1 | 1 | 8.398% | p. 3 electrical characteristics |
| VBE at IC=0.0001 A | 5.800000e-1 | 5.678496e-1 | V | 2.095% | p. 3 electrical characteristics |
| hFE at IC=0.001 A | 5.000000e+1 | 5.609550e+1 | 1 | 12.191% | p. 3 electrical characteristics |
| VBE at IC=0.001 A | 6.300000e-1 | 6.285521e-1 | V | 0.230% | p. 3 electrical characteristics |
| hFE at IC=0.01 A | 7.500000e+1 | 8.080792e+1 | 1 | 7.744% | p. 3 electrical characteristics |
| VBE at IC=0.01 A | 6.900000e-1 | 6.887803e-1 | V | 0.177% | p. 3 electrical characteristics |
| hFE at IC=0.15 A | 1.000000e+2 | 1.078446e+2 | 1 | 7.845% | p. 3 electrical characteristics |
| VBE at IC=0.15 A | 7.800000e-1 | 7.801508e-1 | V | 0.019% | p. 3 electrical characteristics |
| VCE(sat) at IC=0.15 A | 3.000000e-1 | 3.246867e-1 | V | 8.229% | p. 3 electrical characteristics |
| VBE(sat) at IC=0.15 A | 8.500000e-1 | 9.531989e-1 | V | 12.141% | p. 3 electrical characteristics |
| VCE(sat) at IC=0.5 A | 1.000000e+0 | 9.925940e-1 | V | 0.741% | p. 3 electrical characteristics |
| VBE(sat) at IC=0.5 A | 1.050000e+0 | 1.415837e+0 | V | 34.842% | p. 3 electrical characteristics |

Worst fitting error: 34.842% for VBE(sat) at IC=0.5 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.757e-12 and worst absolute delta was 3.996e-11.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM. Safe-operating-area and thermal-runaway behaviour is not modelled.
- Absolute maximum ratings are metadata only. The model does not model breakdown or failure at the rating boundary.
- Package parasitics (lead inductance, package capacitance) are not modelled.
- Reverse operation is not fitted: BR is a family-typical default and IKR, ISC, NC, VAR are at defaults.
- Base resistance modulation is not fitted: IRB and RBM are held at physical defaults because no base-resistance-versus-current data is published.
- Transit-time bias dependence is not fitted: XTF, VTF, and ITF are held at physical defaults because fT is published at a single bias.
- Flicker and burst noise are not modelled: KF and AF are held at physical defaults.
- hFE bin spread is not modelled. The fit targets the typical curve or stated bin; a real part may sit anywhere in the published band.
- CJE and CJC are derived from single tabulated capacitance points with VJE, VJC, MJE, and MJC held at physical defaults.
- Temperature coefficients XTB, EG, and XTI are held at physical defaults; only 25 degC data was fitted.
- The source publishes minimum and maximum DC gain and saturation rows rather than typical values; those column semantics remain explicitly recorded in facts.json and the fidelity tier is capped at F1.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
