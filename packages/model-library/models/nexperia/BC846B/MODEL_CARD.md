# BC846B model card

## Identity

- Manufacturer: nexperia
- Description: 65 V, 100 mA NPN general-purpose transistor
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://assets.nexperia.com/documents/data-sheet/BC846_SER.pdf
- Revision: Rev. 9, 25 September 2012
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 3, p. 4, p. 5
- SHA-256: `045a6cc21de93ac634aad910567e882926bd6ef154cbd8c59d13201134642a97`
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
| IS | 9.97818317e-11 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 5.34355034e+2 | fitted or derived |
| IKF | 2.45517798e-3 | fitted or derived |
| ISE | 1.17348827e-13 | fitted or derived |
| NE | 1.71472915e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 9.80530928e+2 | fitted or derived |
| RE | 1.56028046e-4 | fitted or derived |
| RC | 2.28755445e-4 | fitted or derived |
| CJE | 1.30197538e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 7.22297033e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 1.53953787e-9 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=1e-05 A | 2.900000e+2 | 5.535291e+2 | 1 | 90.872% | p. 4 table 8 |
| hFE at IC=0.002 A | 2.900000e+2 | 3.063191e+2 | 1 | 5.627% | p. 4 table 8 |
| VBE at IC=0.002 A | 6.600000e-1 | 4.574373e-1 | V | 30.691% | p. 4 table 8 |
| VCE(sat) at IC=0.01 A | 9.000000e-2 | 9.320945e-2 | V | 3.566% | p. 4 table 8 |
| VBE(sat) at IC=0.01 A | 7.600000e-1 | 1.012067e+0 | V | 33.167% | p. 4 table 8 |
| VCE(sat) at IC=0.1 A | 2.000000e-1 | 2.597765e+1 | V | 12888.825% | p. 4 table 8 |
| VBE(sat) at IC=0.1 A | 9.000000e-1 | 5.523707e+0 | V | 513.745% | p. 4 table 8 |

Worst fitting error: 12888.825% for VCE(sat) at IC=0.1 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 4.547e-11 and worst absolute delta was 2.119e-10.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM.
- Absolute maximum ratings are metadata only; breakdown is not modelled.
- Package parasitics are not modelled.
- Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.
- CJE and CJC are derived from single tabulated points with physical defaults.
- Fidelity is capped at F1 because the source revision lacks a complete typical multi-point characterization.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
