# MMBT3906 model card

## Identity

- Manufacturer: onsemi
- Description: General-purpose PNP silicon transistor
- Electrical family: bjt_pnp
- Fidelity tier: F2, datasheet-fitted
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
| IS | 2.53358942e-14 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 2.92399926e+2 | fitted or derived |
| IKF | 3.45743541e-2 | fitted or derived |
| ISE | 9.44505439e-14 | fitted or derived |
| NE | 1.36756922e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 1.02312825e+0 | fitted or derived |
| RE | 2.74880510e-1 | fitted or derived |
| RC | 5.53767769e+0 | fitted or derived |
| CJE | 1.18361398e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 8.81318092e-12 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 5.32339215e-10 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 6.000000e+1 | 7.993289e+1 | 1 | 33.221% | p. 2 electrical characteristics |
| hFE at IC=0.001 A | 8.000000e+1 | 1.183387e+2 | 1 | 47.923% | p. 2 electrical characteristics |
| hFE at IC=0.01 A | 1.000000e+2 | 1.250142e+2 | 1 | 25.014% | p. 2 electrical characteristics |
| hFE at IC=0.05 A | 6.000000e+1 | 7.500384e+1 | 1 | 25.006% | p. 2 electrical characteristics |
| hFE at IC=0.1 A | 3.000000e+1 | 4.239048e+1 | 1 | 41.302% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.01 A | 2.500000e-1 | 1.011617e-1 | V | 59.535% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.01 A | 6.500000e-1 | 7.142234e-1 | V | 9.881% | p. 2 electrical characteristics |
| VCE(sat) at IC=0.05 A | 4.000000e-1 | 3.510174e-1 | V | 12.246% | p. 2 electrical characteristics |
| VBE(sat) at IC=0.05 A | 9.500000e-1 | 7.865451e-1 | V | 17.206% | p. 2 electrical characteristics |

Worst fitting error: 59.535% for VCE(sat) at IC=0.01 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 3.224e-11 and worst absolute delta was 4.815e-11.

## Known omissions

- No self-heating: junction temperature is fixed at TNOM.
- Absolute maximum ratings are metadata only; PNP signs are preserved but breakdown is not modelled.
- Package parasitics are not modelled.
- Guaranteed MIN/MAX rows are retained as source semantics; no complete typical multi-point curve was used.
- Reverse operation, base-resistance modulation, transit-time bias dependence, temperature coefficients, flicker noise, and hFE spread are not modelled.
- Reviewer remains pending-review.
- Fidelity is capped at F1: the source provides guaranteed bounds rather than a complete typical multi-point PNP characterization.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
