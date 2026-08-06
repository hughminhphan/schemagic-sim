# MPSA42 model card

## Identity

- Manufacturer: onsemi
- Description: 300 V high-voltage NPN transistor
- Electrical family: bjt_npn
- Fidelity tier: F2, datasheet-fitted
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
| IS | 2.82925424e-15 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 3.12900516e+1 | fitted or derived |
| IKF | 9.99999540e+1 | fitted or derived |
| ISE | 1.37480107e-18 | fitted or derived |
| NE | 3.70002610e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 3.80774829e+1 | fitted or derived |
| RE | 3.73462282e+0 | fitted or derived |
| RC | 1.86727820e+1 | fitted or derived |
| CJE | 1.18361398e-15 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 8.97360629e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 2.95896508e-9 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.001 A | 2.500000e+1 | 3.419198e+1 | 1 | 36.768% | p. 2 electrical characteristics |
| hFE at IC=0.01 A | 4.000000e+1 | 3.412443e+1 | 1 | 14.689% | p. 2 electrical characteristics |
| hFE at IC=0.03 A | 4.000000e+1 | 3.399072e+1 | 1 | 15.023% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.02 A | 5.000000e-1 | 5.000000e-1 | V | 0.000% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.02 A | 9.000000e-1 | 9.303665e-1 | V | 3.374% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.02 A | 5.000000e-1 | 5.000000e-1 | V | 0.000% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.02 A | 9.000000e-1 | 9.303665e-1 | V | 3.374% | p. 2 electrical characteristics |

Worst fitting error: 36.768% for hFE at IC=0.001 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 5.891e-13 and worst absolute delta was 2.194e-11.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM.
- Absolute maximum ratings are metadata only; breakdown is not modelled.
- Package parasitics are not modelled.
- Guaranteed MIN/MAX rows are retained as source semantics; no typical hFE curve was published, so F1 targets use the stated minima as conservative table anchors.
- Only one VCE(sat) condition is published; the duplicated bench point is not an independent characterization.
- CJE is held at the numerical floor because Ceb is not published.
- Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
