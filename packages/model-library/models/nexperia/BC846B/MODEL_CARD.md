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
| IS | 2.82032786e-14 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 1.12331797e+3 | fitted or derived |
| IKF | 2.76996807e-3 | fitted or derived |
| ISE | 2.12307452e-15 | fitted or derived |
| NE | 1.20005607e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 1.16504178e+1 | fitted or derived |
| RE | 1.00000000e-4 | fitted or derived |
| RC | 6.39393846e-4 | fitted or derived |
| CJE | 1.30197538e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 7.22297033e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 1.53953531e-9 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=1e-05 A | 2.900000e+2 | 2.771289e+2 | 1 | 4.438% | p. 4 table 8 |
| hFE at IC=0.002 A | 2.900000e+2 | 3.078876e+2 | 1 | 6.168% | p. 4 table 8 |
| VBE at IC=0.002 A | 6.600000e-1 | 6.645140e-1 | V | 0.684% | p. 4 table 8 |
| VCE(sat) at IC=0.01 A | 9.000000e-2 | 8.894244e-2 | V | 1.175% | p. 4 table 8 |
| VBE(sat) at IC=0.01 A | 7.600000e-1 | 7.399167e-1 | V | 2.643% | p. 4 table 8 |
| VCE(sat) at IC=0.1 A | 2.000000e-1 | 2.017377e-1 | V | 0.869% | p. 4 table 8 |
| VBE(sat) at IC=0.1 A | 9.000000e-1 | 9.019835e-1 | V | 0.220% | p. 4 table 8 |

Worst fitting error: 6.168% for hFE at IC=0.002 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 4.759e-8 and worst absolute delta was 8.811e-11.

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
