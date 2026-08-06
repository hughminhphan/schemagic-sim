# BC327-40 model card

## Identity

- Manufacturer: onsemi
- Description: PNP epitaxial silicon transistor, gain class 40
- Electrical family: bjt_pnp
- Fidelity tier: F1, datasheet-fitted
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
| dc | fitted |
| ac | fitted |
| transient | fitted |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 6.96334012e-14 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 5.37705316e+2 | fitted or derived |
| IKF | 3.01245460e-1 | fitted or derived |
| ISE | 3.70049694e-10 | fitted or derived |
| NE | 4.00000000e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 1.37544941e+1 | fitted or derived |
| RE | 1.14969122e-1 | fitted or derived |
| RC | 3.50525988e-1 | fitted or derived |
| CJE | 1.42033678e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 2.88918813e-11 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 1.46737759e-9 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.001 A | 5.000000e+2 | 5.036154e+2 | 1 | 0.723% | p. 3 fig. 3 |
| VBE at IC=0.001 A | 6.000000e-1 | 6.052370e-1 | V | 0.873% | p. 3 fig. 3 |
| hFE at IC=0.01 A | 5.200000e+2 | 5.161181e+2 | 1 | 0.747% | p. 3 fig. 3 |
| VBE at IC=0.01 A | 6.700000e-1 | 6.664435e-1 | V | 0.531% | p. 3 fig. 3 |
| hFE at IC=0.1 A | 4.000000e+2 | 4.032838e+2 | 1 | 0.821% | p. 3 fig. 3 |
| VBE at IC=0.1 A | 7.500000e-1 | 7.467008e-1 | V | 0.440% | p. 3 fig. 3 |
| hFE at IC=0.3 A | 2.600000e+2 | 2.663575e+2 | 1 | 2.445% | p. 3 fig. 3 |
| VBE at IC=0.3 A | 8.200000e-1 | 8.225680e-1 | V | 0.313% | p. 3 fig. 3 |
| hFE at IC=0.5 A | 2.100000e+2 | 2.050536e+2 | 1 | 2.355% | p. 3 fig. 3 |
| VBE at IC=0.5 A | 8.800000e-1 | 8.791263e-1 | V | 0.099% | p. 3 fig. 3 |
| VCE(sat) at IC=0.1 A | 8.000000e-2 | 9.018561e-2 | V | 12.732% | p. 3 fig. 4 |
| VBE(sat) at IC=0.1 A | 7.400000e-1 | 8.920363e-1 | V | 20.545% | p. 3 fig. 4 |
| VCE(sat) at IC=0.5 A | 3.000000e-1 | 2.979629e-1 | V | 0.679% | p. 3 fig. 4 |
| VBE(sat) at IC=0.5 A | 8.600000e-1 | 1.550538e+0 | V | 80.295% | p. 3 fig. 4 |

Worst fitting error: 80.295% for VBE(sat) at IC=0.5 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.340e-6 and worst absolute delta was 2.234e+1.

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
