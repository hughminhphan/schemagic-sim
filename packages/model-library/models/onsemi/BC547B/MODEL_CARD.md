# BC547B model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose NPN amplifier transistor, B gain bin
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pub/Collateral/BC546-D.PDF
- Revision: Rev. 8, August 2021
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `e35399eb895681ad76be6bf26563ac9515783e6adcbcfc97a75b18a03f646786`
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
| IS | 1.20010104e-13 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 2.00000000e+3 | fitted or derived |
| IKF | 8.52866719e-3 | fitted or derived |
| ISE | 5.16184351e-13 | fitted or derived |
| NE | 1.56457215e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 2.03711679e+1 | fitted or derived |
| RE | 1.00000024e-4 | fitted or derived |
| RC | 8.62607012e-1 | fitted or derived |
| CJE | 1.18361398e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 4.09301652e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 4.86059292e-10 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 1.000000e+2 | 5.100887e+2 | 1 | 410.089% | p. 3 fig. 1 |
| hFE at IC=0.001 A | 2.200000e+2 | 6.525192e+2 | 1 | 196.600% | p. 3 fig. 1 |
| hFE at IC=0.002 A | 2.900000e+2 | 6.446682e+2 | 1 | 122.299% | p. 2 electrical characteristics |
| VBE at IC=0.002 A | 6.500000e-1 | 6.389514e-1 | V | 1.700% | p. 2 electrical characteristics |
| hFE at IC=0.01 A | 1.500000e+2 | 3.775754e+2 | 1 | 151.717% | p. 2 electrical characteristics |
| VBE at IC=0.01 A | 7.000000e-1 | 7.092926e-1 | V | 1.328% | p. 2 electrical characteristics |
| hFE at IC=0.1 A | 1.800000e+2 | 1.593618e+2 | 1 | 11.466% | p. 3 fig. 1 |
| VBE at IC=0.1 A | 7.800000e-1 | 7.790220e-1 | V | 0.125% | p. 3 fig. 1 |
| VCE(sat) at IC=0.01 A | 9.000000e-2 | 7.664353e-2 | V | 14.841% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.01 A | 7.000000e-1 | 6.857876e-1 | V | 2.030% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.1 A | 2.000000e-1 | 2.013356e-1 | V | 0.668% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.1 A | 8.200000e-1 | 8.805608e-1 | V | 7.385% | p. 2 electrical characteristics |

Worst fitting error: 410.089% for hFE at IC=0.0001 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 2.299e-12 and worst absolute delta was 3.215e-10.

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

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.

## Fidelity note

The native fit did not meet the requested F2 gain threshold across the low-current gain-bin rows. The package is therefore honestly capped at F1 and withholds scalar acceptance checks for those rows.
