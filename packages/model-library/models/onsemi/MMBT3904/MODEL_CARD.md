# MMBT3904 model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose NPN silicon transistor
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/mmbt3904lt1-d.pdf
- Revision: August 2021 Rev. 14
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 7, p. 8
- SHA-256: `8c3a7966cfbd09066d906c4e0e3dfedb7e13abb9dc2cb34c600d1f05736bbdb4`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 2.06664957e-14 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 4.76443061e+2 | fitted or derived |
| IKF | 1.97953306e-2 | fitted or derived |
| ISE | 3.67338204e-13 | fitted or derived |
| NE | 1.51755222e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 5.61746241e+0 | fitted or derived |
| RE | 1.00000009e-4 | fitted or derived |
| RC | 2.71915207e+0 | fitted or derived |
| CJE | 9.46891187e-12 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 7.83393860e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 4.64758538e-10 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 9.000000e+1 | 9.177826e+1 | 1 | 1.976% | p. 7 fig. 15, digitized |
| hFE at IC=0.001 A | 1.400000e+2 | 1.614905e+2 | 1 | 15.350% | p. 7 fig. 15, digitized |
| VBE at IC=0.001 A | 6.600000e-1 | 6.414437e-1 | V | 2.812% | p. 7 fig. 17, digitized |
| hFE at IC=0.01 A | 2.000000e+2 | 1.822849e+2 | 1 | 8.858% | p. 7 fig. 15, digitized |
| VBE at IC=0.01 A | 7.000000e-1 | 7.034842e-1 | V | 0.498% | p. 7 fig. 17, digitized |
| hFE at IC=0.05 A | 1.100000e+2 | 1.046916e+2 | 1 | 4.826% | p. 7 fig. 15, digitized |
| VBE at IC=0.05 A | 7.600000e-1 | 7.704425e-1 | V | 1.374% | p. 7 fig. 17, digitized |
| hFE at IC=0.1 A | 5.400000e+1 | 5.988636e+1 | 1 | 10.901% | p. 7 fig. 15, digitized |
| VBE at IC=0.1 A | 8.200000e-1 | 8.174144e-1 | V | 0.315% | p. 7 fig. 17, digitized |
| VCE(sat) at IC=0.01 A | 9.000000e-2 | 7.339433e-2 | V | 18.451% | p. 7 fig. 17, digitized |
| VBE(sat) at IC=0.01 A | 7.600000e-1 | 7.219407e-1 | V | 5.008% | p. 7 fig. 17, digitized |
| VCE(sat) at IC=0.05 A | 2.000000e-1 | 2.033211e-1 | V | 1.661% | p. 7 fig. 17, digitized |
| VBE(sat) at IC=0.05 A | 8.500000e-1 | 8.057210e-1 | V | 5.209% | p. 7 fig. 17, digitized |

Worst fitting error: 18.451% for VCE(sat) at IC=0.01 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 2.078e-12 and worst absolute delta was 3.035e-11.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM.
- Absolute maximum ratings are metadata only; breakdown is not modelled.
- Package parasitics are not modelled.
- Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.
- CJE and CJC are derived from single tabulated points with physical defaults.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
