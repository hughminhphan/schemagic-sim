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
- Referenced pages: p. 1, p. 2, p. 6
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
| IS | 1.46190354e-14 | fitted or derived |
| NF | 1.00000000e+00 | fitted or derived |
| BF | 2.22456609e+02 | fitted or derived |
| IKF | 9.17758146e-02 | fitted or derived |
| ISE | 1.20576638e-11 | fitted or derived |
| NE | 2.17091150e+00 | fitted or derived |
| VAF | 1.00000000e+02 | fitted or derived |
| BR | 4.00000000e+00 | fitted or derived |
| RB | 1.84063531e+01 | fitted or derived |
| RE | 1.00000000e-04 | fitted or derived |
| RC | 3.48673363e+00 | fitted or derived |
| CJE | 1.18361398e-11 | fitted or derived |
| VJE | 7.50000000e-01 | fitted or derived |
| MJE | 3.30000000e-01 | fitted or derived |
| CJC | 8.81318092e-12 | fitted or derived |
| VJC | 7.50000000e-01 | fitted or derived |
| MJC | 3.30000000e-01 | fitted or derived |
| XCJC | 1.00000000e+00 | fitted or derived |
| TF | 5.52836246e-10 | fitted or derived |
| TR | 0.00000000e+00 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 1.100000e+02 | 1.191304e+02 | 1 | 8.300% | p. 6 fig. 13 |
| VBE at IC=0.0001 A | 6.000000e-01 | 5.917394e-01 | V | 1.377% | p. 6 fig. 13 |
| hFE at IC=0.001 A | 1.700000e+02 | 1.756006e+02 | 1 | 3.294% | p. 6 fig. 13 |
| VBE at IC=0.001 A | 6.500000e-01 | 6.500466e-01 | V | 0.007% | p. 6 fig. 13 |
| hFE at IC=0.01 A | 2.200000e+02 | 1.891253e+02 | 1 | 14.034% | p. 6 fig. 13 |
| VBE at IC=0.01 A | 7.000000e-01 | 7.072465e-01 | V | 1.035% | p. 6 fig. 13 |
| hFE at IC=0.05 A | 1.500000e+02 | 1.428733e+02 | 1 | 4.751% | p. 6 fig. 13 |
| VBE at IC=0.05 A | 7.600000e-01 | 7.650209e-01 | V | 0.661% | p. 6 fig. 13 |
| hFE at IC=0.1 A | 9.500000e+01 | 1.012569e+02 | 1 | 6.586% | p. 6 fig. 13 |
| VBE at IC=0.1 A | 8.100000e-01 | 8.081169e-01 | V | 0.232% | p. 6 fig. 13 |
| VCE(sat) at IC=0.01 A | 8.000000e-02 | 7.318298e-02 | V | 8.521% | p. 6 fig. 15 |
| VBE(sat) at IC=0.01 A | 7.500000e-01 | 7.391624e-01 | V | 1.445% | p. 6 fig. 15 |
| VCE(sat) at IC=0.05 A | 2.200000e-01 | 2.213698e-01 | V | 0.623% | p. 6 fig. 15 |
| VBE(sat) at IC=0.05 A | 8.600000e-01 | 8.621567e-01 | V | 0.251% | p. 6 fig. 15 |

Worst fitting error: 14.034% for hFE at IC=0.01 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 8.439e-07 and worst absolute delta was 1.407e+01.

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
- NF, NR, IRB, RBM, XTF, VTF, ITF, XTB, EG, XTI, KF, AF, IKR, ISC, NC, and VAR are held at default because the datasheet does not characterise them.
- TR is held at default because no storage-time row is published for this part.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
