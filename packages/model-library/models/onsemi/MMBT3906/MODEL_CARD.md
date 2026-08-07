# MMBT3906 model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose PNP silicon transistor
- Electrical family: bjt_pnp
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/mmbt3906lt1-d.pdf
- Revision: October 2024 Rev. 14
- Accessed: 2026-08-06
- Referenced pages: p. 1, p. 2, p. 7, p. 8
- SHA-256: `6882fc82278c99b62b9d4af1cd263a5f49431aa371f3a250737f6ba7cb038951`
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
| IS | 4.77730376e-16 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 2.17657319e+2 | fitted or derived |
| IKF | 2.58301197e-2 | fitted or derived |
| ISE | 1.09117741e-13 | fitted or derived |
| NE | 1.37070839e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 4.52479710e+2 | fitted or derived |
| RE | 1.17485004e+0 | fitted or derived |
| RC | 4.39300708e+0 | fitted or derived |
| CJE | 1.18361398e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 8.81318092e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 5.34495810e-10 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 6.000000e+1 | 1.998518e+0 | 1 | 96.669% | p. 2 electrical characteristics |
| hFE at IC=0.001 A | 8.000000e+1 | 4.149599e+0 | 1 | 94.813% | p. 2 electrical characteristics |
| hFE at IC=0.01 A | 1.000000e+2 | 8.444175e+0 | 1 | 91.556% | p. 2 electrical characteristics |
| hFE at IC=0.05 A | 6.000000e+1 | 1.273616e+1 | 1 | 78.773% | p. 2 electrical characteristics |
| hFE at IC=0.1 A | 3.000000e+1 | 1.133586e+1 | 1 | 62.214% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.01 A | 2.500000e-1 | 1.386280e-1 | V | 44.549% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.01 A | 6.500000e-1 | 1.269413e+0 | V | 95.294% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.05 A | 4.000000e-1 | 4.222395e-1 | V | 5.560% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.05 A | 9.500000e-1 | 3.190512e+0 | V | 235.843% | p. 2 electrical characteristics |

Worst fitting error: 235.843% for VBE(sat) at IC=0.05 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 1.462e-7 and worst absolute delta was 2.437e+0.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM.
- Absolute maximum ratings are metadata only; PNP signs are preserved but breakdown is not modelled.
- Package parasitics are not modelled.
- Guaranteed MIN/MAX rows are retained as source semantics; no complete typical multi-point curve was used.
- Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
