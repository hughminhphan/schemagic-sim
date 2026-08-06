# 2N3906 model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose PNP silicon transistor
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pub/Collateral/2N3906-D.PDF
- Revision: Rev. 4, February 2010
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 7, p. 8
- SHA-256: `103dbe9825c9aac50352bbe2d3cde611f6b9ae76967ca55548fccd5c6afdfc39`
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
| IS | 1.48357105e-14 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 6.33139756e+2 | fitted or derived |
| IKF | 3.03565547e-2 | fitted or derived |
| ISE | 7.74013006e-14 | fitted or derived |
| NE | 1.38499781e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 5.71522126e+0 | fitted or derived |
| RE | 1.00000012e-4 | fitted or derived |
| RC | 3.21829646e+0 | fitted or derived |
| CJE | 1.18361398e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 8.81318092e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 5.55202031e-10 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 1.100000e+2 | 8.327667e+1 | 1 | 24.294% | p. 7 fig. 13 |
| VBE at IC=0.0001 A | 6.000000e-1 | 5.781213e-1 | V | 3.646% | p. 7 fig. 13 |
| hFE at IC=0.001 A | 1.700000e+2 | 1.413824e+2 | 1 | 16.834% | p. 7 fig. 13 |
| VBE at IC=0.001 A | 6.500000e-1 | 6.407860e-1 | V | 1.418% | p. 7 fig. 13 |
| hFE at IC=0.01 A | 2.200000e+2 | 1.863121e+2 | 1 | 15.313% | p. 7 fig. 13 |
| VBE at IC=0.01 A | 7.000000e-1 | 7.067139e-1 | V | 0.959% | p. 7 fig. 13 |
| hFE at IC=0.05 A | 1.500000e+2 | 1.361200e+2 | 1 | 9.253% | p. 7 fig. 13 |
| VBE at IC=0.05 A | 7.600000e-1 | 7.691066e-1 | V | 1.198% | p. 7 fig. 13 |
| hFE at IC=0.1 A | 9.500000e+1 | 9.314163e+1 | 1 | 1.956% | p. 7 fig. 13 |
| VBE at IC=0.1 A | 8.100000e-1 | 8.068967e-1 | V | 0.383% | p. 7 fig. 13 |
| VCE(sat) at IC=0.01 A | 8.000000e-2 | 7.531608e-2 | V | 5.855% | p. 8 fig. 2 |
| VBE(sat) at IC=0.01 A | 7.500000e-1 | 7.276124e-1 | V | 2.985% | p. 8 fig. 2 |
| VCE(sat) at IC=0.05 A | 2.200000e-1 | 2.209368e-1 | V | 0.426% | p. 8 fig. 2 |
| VBE(sat) at IC=0.05 A | 8.600000e-1 | 8.082266e-1 | V | 6.020% | p. 8 fig. 2 |

Worst fitting error: 24.294% for hFE at IC=0.0001 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 4.590e-6 and worst absolute delta was 7.650e+1.

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
