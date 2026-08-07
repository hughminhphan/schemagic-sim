# BC547B model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose NPN amplifier transistor, B gain bin
- Electrical family: bjt_npn
- Fidelity tier: F1, bounded / approximate
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
| CJC | 4.09301652e-12 | fitted or derived |
| VJC | 7.50000000e-01 | fitted or derived |
| MJC | 3.30000000e-01 | fitted or derived |
| XCJC | 1.00000000e+00 | fitted or derived |
| TF | 4.85816297e-10 | fitted or derived |
| TR | 0.00000000e+00 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 1.000000e+02 | 1.253967e+02 | 1 | 25.397% | p. 3 fig. 1 |
| hFE at IC=0.001 A | 2.200000e+02 | 2.001176e+02 | 1 | 9.037% | p. 3 fig. 1 |
| hFE at IC=0.002 A | 2.900000e+02 | 2.203392e+02 | 1 | 24.021% | p. 2 electrical characteristics |
| VBE at IC=0.002 A | 6.500000e-01 | 6.339157e-01 | V | 2.475% | p. 2 electrical characteristics |
| hFE at IC=0.01 A | 1.500000e+02 | 2.284863e+02 | 1 | 52.324% | p. 2 electrical characteristics |
| VBE at IC=0.01 A | 7.000000e-01 | 7.117921e-01 | V | 1.685% | p. 2 electrical characteristics |
| hFE at IC=0.1 A | 1.800000e+02 | 1.339973e+02 | 1 | 25.557% | p. 3 fig. 1 |
| VBE at IC=0.1 A | 7.800000e-01 | 7.841300e-01 | V | 0.529% | p. 3 fig. 1 |
| VCE(sat) at IC=0.01 A | 9.000000e-02 | 7.484522e-02 | V | 16.839% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.01 A | 7.000000e-01 | 7.033640e-01 | V | 0.481% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.1 A | 2.000000e-01 | 2.015001e-01 | V | 0.750% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.1 A | 8.200000e-01 | 8.172879e-01 | V | 0.331% | p. 2 electrical characteristics |

Worst fitting error: 52.324% for hFE at IC=0.01 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.047e-11 and worst absolute delta was 2.117e-10.

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
- Low-current gain below 2 mA is unclaimed because the single Gummel-Poon model cannot reproduce the published BC547B curve there without violating the 2 mA B-bin boundary.
- DC behavior is approximate, not fitted coverage. The 2 mA hFE check enforces the published 200 to 450 B-bin range; intermediate typical gain is not guaranteed.
- Saturation checks cover the published 100 mA forced-beta point. VBE(sat) and VCE(sat) away from that point are unclaimed.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
