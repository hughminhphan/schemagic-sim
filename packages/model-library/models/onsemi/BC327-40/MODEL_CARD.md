# BC327-40 model card

## Identity

- Manufacturer: onsemi
- Description: PNP epitaxial silicon transistor, gain class 40
- Electrical family: bjt_pnp
- Fidelity tier: F1, bounded / approximate
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pub/Collateral/BC327-D.PDF
- Revision: Rev. 2, January 2024
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `fae1e871277a16973f4aa162af131e3f97fde15fbde0441225d52e079b32175f`
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
| IS | 6.96334012e-14 | fitted or derived |
| NF | 1.00000000e+00 | fitted or derived |
| BF | 5.37705316e+02 | fitted or derived |
| IKF | 3.01245460e-01 | fitted or derived |
| ISE | 3.70049694e-10 | fitted or derived |
| NE | 4.00000000e+00 | fitted or derived |
| VAF | 1.00000000e+02 | fitted or derived |
| BR | 4.00000000e+00 | fitted or derived |
| RB | 1.37544941e+01 | fitted or derived |
| RE | 1.14969122e-01 | fitted or derived |
| RC | 3.50525988e-01 | fitted or derived |
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
| hFE at IC=0.1 A | 4.000000e+02 | 4.032838e+02 | 1 | 0.821% | p. 3 fig. 3 |
| hFE at IC=0.3 A | 2.600000e+02 | 2.663575e+02 | 1 | 2.445% | p. 3 fig. 3 |
| VCE(sat) at IC=0.5 A | 3.000000e-01 | 2.979629e-01 | V | 0.679% | p. 3 fig. 4 |

Worst fitting error: 2.445% for hFE at IC=0.3 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.340e-06 and worst absolute delta was 2.234e+01.

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

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
