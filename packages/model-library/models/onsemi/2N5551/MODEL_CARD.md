# 2N5551 model card

## Identity

- Manufacturer: onsemi
- Description: High-voltage NPN epitaxial silicon transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
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
| IS | 1.70280539e-14 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 2.00000000e+3 | fitted or derived |
| IKF | 7.08132236e-4 | fitted or derived |
| ISE | 1.67238176e-18 | fitted or derived |
| NE | 3.99999974e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 1.00251651e+1 | fitted or derived |
| RE | 9.26648854e-1 | fitted or derived |
| RC | 1.03239264e-4 | fitted or derived |
| CJE | 1.18361398e-15 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 1.44459407e-11 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 1.54104324e-9 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.01 A | 8.000000e+1 | 1.074802e+2 | 1 | 34.350% | spec page |
| hFE at IC=0.05 A | 3.000000e+1 | 2.997667e+1 | 1 | 0.078% | spec page |
| VCE(sat) at IC=0.01 A | 1.500000e-1 | 1.119329e-1 | V | 25.378% | spec page |
| VBE(sat) at IC=0.01 A | 1.000000e+0 | 8.000003e-1 | V | 20.000% | spec page |
| VCE(sat) at IC=0.05 A | 2.500000e-1 | 2.016116e-1 | V | 19.355% | spec page |
| VBE(sat) at IC=0.05 A | 1.200000e+0 | 9.599999e-1 | V | 20.000% | spec page |

Worst fitting error: 34.350% for hFE at IC=0.01 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 8.256e-10 and worst absolute delta was 5.659e-11.

## Known omissions

- Official manufacturer PDF was unreachable; facts are limited to the manufacturer HTML specification table and fidelity is capped at F1.
- No self-heating, breakdown, package parasitics, reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, or hFE spread are modelled.
- Guaranteed MIN/MAX rows are retained as source semantics; they are not typical targets.
- Only one independent saturation characterization is available; high-current saturation is an anchored table point rather than a fitted curve.
- CJE is held at the numerical floor because Cibo is not published.
- Reviewer remains pending-review
- Source sha256 is a locator sentinel because the official HTML page was unreachable and no content was acquired; do not treat it as a downloaded datasheet hash.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
