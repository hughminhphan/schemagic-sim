# SS8050 model card

## Identity

- Manufacturer: onsemi
- Description: NPN epitaxial silicon transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/ss8050-d.pdf
- Revision: February 2022 Rev. 2
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `8ce240e375ec5b2441488929cffd1074ff687fc786d92e4455ceca0599f9e7e4`
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
| IS | 8.68607997e-15 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 4.16577357e+2 | fitted or derived |
| IKF | 1.20663994e-1 | fitted or derived |
| ISE | 1.95329219e-11 | fitted or derived |
| NE | 1.76759195e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 4.70570809e+0 | fitted or derived |
| RE | 8.39979309e-2 | fitted or derived |
| RC | 4.19591331e-1 | fitted or derived |
| CJE | 1.18361398e-15 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 2.16689110e-11 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 1.56950199e-9 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.005 A | 4.500000e+1 | 5.117900e+1 | 1 | 13.731% | p. 2 electrical characteristics |
| hFE at IC=0.1 A | 8.500000e+1 | 8.966030e+1 | 1 | 5.483% | p. 2 electrical characteristics |
| hFE at IC=0.8 A | 4.000000e+1 | 4.042711e+1 | 1 | 1.068% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.8 A | 5.000000e-1 | 5.000000e-1 | V | 0.000% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.8 A | 1.200000e+0 | 1.339790e+0 | V | 11.649% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.8 A | 5.000000e-1 | 5.000000e-1 | V | 0.000% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.8 A | 1.200000e+0 | 1.339790e+0 | V | 11.649% | p. 2 electrical characteristics |

Worst fitting error: 13.731% for hFE at IC=0.005 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 3.871e-12 and worst absolute delta was 6.501e-12.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM.
- Absolute maximum ratings are metadata only; breakdown is not modelled.
- Package parasitics are not modelled.
- Guaranteed MIN/MAX rows are retained as source semantics; no complete typical multi-point curve was used.
- Only one VCE(sat) condition is published; the duplicated bench point is not independent.
- CJE is held at the numerical floor because Cibo is not published.
- Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
