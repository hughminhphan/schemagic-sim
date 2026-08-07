# BC557B model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose PNP amplifier transistor, B gain bin
- Electrical family: bjt_pnp
- Fidelity tier: F1, bounded / approximate
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pub/Collateral/BC556B-D.PDF
- Revision: Rev. 3, March 2007
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `6fb30a4dc7079587304ee8a08f5223cbe169350709d6536df9073c95d69dc20b`
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
| IS | 4.32062191e-14 | fitted or derived |
| NF | 1.00000000e+00 | fitted or derived |
| BF | 4.99999974e+03 | fitted or derived |
| IKF | 1.10688134e-02 | fitted or derived |
| ISE | 1.20821698e-13 | fitted or derived |
| NE | 1.36793631e+00 | fitted or derived |
| VAF | 1.00000000e+02 | fitted or derived |
| BR | 4.00000000e+00 | fitted or derived |
| RB | 3.13773990e+00 | fitted or derived |
| RE | 1.00000000e-04 | fitted or derived |
| RC | 9.21975274e-01 | fitted or derived |
| CJE | 1.18361398e-11 | fitted or derived |
| VJE | 7.50000000e-01 | fitted or derived |
| MJE | 3.30000000e-01 | fitted or derived |
| CJC | 7.22297033e-12 | fitted or derived |
| VJC | 7.50000000e-01 | fitted or derived |
| MJC | 3.30000000e-01 | fitted or derived |
| XCJC | 1.00000000e+00 | fitted or derived |
| TF | 4.38691760e-10 | fitted or derived |
| TR | 0.00000000e+00 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No typical-curve fit claimed | n/a | n/a | n/a | n/a | See guaranteed-bound checks |

Worst fitting error: 0.000% for not claimed for F1 bounded approximation.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.535e-06 and worst absolute delta was 2.558e+01.

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
- Low-current gain below 2 mA is unclaimed because the single Gummel-Poon model cannot reproduce the published BC557B curve there without violating the 2 mA B-bin boundary.
- DC behavior is approximate, not fitted coverage. The 2 mA hFE check enforces the published 180 to 460 B-bin range; intermediate typical gain is not guaranteed.
- Saturation checks cover the published 100 mA forced-beta point. VBE(sat) and VCE(sat) away from that point are unclaimed.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
