# MPSA42 model card

## Identity

- Manufacturer: onsemi
- Description: 300 V high-voltage NPN transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/mpsa42-d.pdf
- Revision: February 2013 Rev. 8
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `83c386f606d306060d0fd7399a83de1416961cebb17881d6d9efddfd94e35df2`
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
| IS | 9.70355497e-12 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 3.45354799e+2 | fitted or derived |
| IKF | 6.23932916e-2 | fitted or derived |
| ISE | 8.94148703e-11 | fitted or derived |
| NE | 1.46478126e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 1.39114762e+2 | fitted or derived |
| RE | 2.13446472e+0 | fitted or derived |
| RC | 1.53788061e+1 | fitted or derived |
| CJE | 1.18361398e-15 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 8.97360629e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 3.00288311e-9 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.001 A | 2.500000e+1 | 4.125000e+1 | 1 | 65.000% | p. 2 electrical characteristics |
| hFE at IC=0.01 A | 4.000000e+1 | 6.600000e+1 | 1 | 65.000% | p. 2 electrical characteristics |
| hFE at IC=0.03 A | 4.000000e+1 | 6.600000e+1 | 1 | 65.000% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.02 A | 5.000000e-1 | 4.000000e-1 | V | 20.000% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.02 A | 9.000000e-1 | 9.000000e-1 | V | 0.000% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.02 A | 5.000000e-1 | 4.000000e-1 | V | 20.000% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.02 A | 9.000000e-1 | 9.000000e-1 | V | 0.000% | p. 2 electrical characteristics |

Worst fitting error: 65.000% for hFE at IC=0.001 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 4.738e-13 and worst absolute delta was 7.503e-12.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM.
- Absolute maximum ratings are metadata only; breakdown is not modelled.
- Package parasitics are not modelled.
- Guaranteed MIN/MAX rows are retained as source semantics; no typical hFE curve was published, so F1 targets use the stated minima as conservative table anchors.
- Only one VCE(sat) condition is published; the duplicated bench point is not an independent characterization.
- CJE is held at the numerical floor because Ceb is not published.
- Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.
- Reviewer remains pending-review.
- Fidelity is capped at F1 because the source provides incomplete typical multi-point characterization for the required BJT inputs.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
