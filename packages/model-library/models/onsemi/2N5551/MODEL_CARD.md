# 2N5551 model card

## Identity

- Manufacturer: onsemi
- Description: High-voltage NPN epitaxial silicon transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, manufacturer HTML-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/products/discrete-power-modules/bipolar-transistors/2N5551
- Revision: Manufacturer HTML specification page; accessed 2026-08-07
- Accessed: 2026-08-07
- Referenced pages: spec page
- SHA-256: `e0fe0839debfc936a993def8b18c0a728dea449026aaae0cdba33f40ef22a377`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | approx |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 2.78280634e-16 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 2.22168431e+2 | fitted or derived |
| IKF | 8.19776688e-3 | fitted or derived |
| ISE | 6.11934592e-13 | fitted or derived |
| NE | 1.56247412e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 1.24601755e+2 | fitted or derived |
| RE | 5.38857847e-1 | fitted or derived |
| RC | 1.82154613e+0 | fitted or derived |
| CJE | 1.18361398e-15 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 1.44459407e-11 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 1.52033279e-9 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.01 A | 8.000000e+1 | 1.584067e+1 | 1 | 80.199% | spec page |
| hFE at IC=0.05 A | 3.000000e+1 | 1.515358e+1 | 1 | 49.488% | spec page |
| VCE(sat) at IC=0.01 A | 1.500000e-1 | 9.951177e-2 | V | 33.659% | spec page |
| VBE(sat) at IC=0.01 A | 1.000000e+0 | 9.624224e-1 | V | 3.758% | spec page |
| VCE(sat) at IC=0.05 A | 2.500000e-1 | 2.600886e-1 | V | 4.035% | spec page |
| VBE(sat) at IC=0.05 A | 1.200000e+0 | 1.553275e+0 | V | 29.440% | spec page |

Worst fitting error: 80.199% for hFE at IC=0.01 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 2.078e-12 and worst absolute delta was 3.894e-12.

## Known omissions

- Official manufacturer PDF was unreachable; facts are limited to the manufacturer HTML specification table and fidelity is capped at F1.
- No self-heating, breakdown, package parasitics, reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, or hFE spread are modelled.
- Guaranteed MIN/MAX rows are retained as source semantics; they are not typical targets.
- Only one independent saturation characterization is available; high-current saturation is an anchored table point rather than a fitted curve.
- CJE is held at the numerical floor because Cibo is not published.
- Reviewer remains pending-review

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
