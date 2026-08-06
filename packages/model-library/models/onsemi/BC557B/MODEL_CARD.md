# BC557B model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose PNP amplifier transistor, B gain bin
- Electrical family: bjt_pnp
- Fidelity tier: F1, datasheet-fitted
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
| dc | fitted |
| ac | fitted |
| transient | fitted |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 8.27955433e-14 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 2.00000000e+3 | fitted or derived |
| IKF | 8.53699980e-3 | fitted or derived |
| ISE | 4.20592168e-13 | fitted or derived |
| NE | 1.56447749e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 3.92597975e+1 | fitted or derived |
| RE | 1.00000060e-4 | fitted or derived |
| RC | 1.34279183e+0 | fitted or derived |
| CJE | 1.18361398e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 7.22297033e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 4.38691760e-10 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 1.000000e+2 | 4.938570e+2 | 1 | 393.857% | p. 3 fig. 1 |
| hFE at IC=0.001 A | 2.200000e+2 | 6.396636e+2 | 1 | 190.756% | p. 3 fig. 1 |
| hFE at IC=0.002 A | 2.900000e+2 | 6.339411e+2 | 1 | 118.600% | p. 2 electrical characteristics |
| VBE at IC=0.002 A | 6.600000e-1 | 6.481003e-1 | V | 1.803% | p. 2 electrical characteristics |
| hFE at IC=0.01 A | 1.500000e+2 | 3.751169e+2 | 1 | 150.078% | p. 2 electrical characteristics |
| VBE at IC=0.01 A | 7.100000e-1 | 7.198497e-1 | V | 1.387% | p. 2 electrical characteristics |
| hFE at IC=0.1 A | 1.800000e+2 | 1.588701e+2 | 1 | 11.739% | p. 3 fig. 1 |
| VBE at IC=0.1 A | 8.000000e-1 | 7.989658e-1 | V | 0.129% | p. 3 fig. 1 |
| VCE(sat) at IC=0.01 A | 7.500000e-2 | 8.144972e-2 | V | 8.600% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.01 A | 7.000000e-1 | 7.048209e-1 | V | 0.689% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.1 A | 2.500000e-1 | 2.493550e-1 | V | 0.258% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.1 A | 9.500000e-1 | 9.845849e-1 | V | 3.641% | p. 2 electrical characteristics |

Worst fitting error: 393.857% for hFE at IC=0.0001 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.462e-7 and worst absolute delta was 2.437e+0.

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
- Fidelity is capped at F1 because the source revision lacks a complete typical multi-point electrical characterization for every required archetype input.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
