# BF256B model card

## Identity

- Manufacturer: Nexperia
- Description: N-channel low-noise JFET
- Electrical family: jfet_n
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.nexperia.com/product/BF256B
- Revision: Official Nexperia HTML product/specification table; accessed 2026-08-07
- Accessed: 2026-08-07
- Referenced pages: official HTML specification table
- SHA-256: `2ac2a29d67800d5de2828c2124e6767efea31e7217365e6d45b7417236581813`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | approx |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VTO | -4.00000000e+0 | derived from bin midpoint |
| BETA | 5.75000000e-4 | derived from bin midpoint |
| LAMBDA | 5.00000000e-3 | held at default |
| B | 1.00000000e+0 | held at default |
| RD | 1.00000000e-4 | held at default |
| RS | 1.00000000e-4 | held at default |
| CGS | 2.55000000e-12 | derived |
| CGD | 5.80947502e-12 | derived |
| PB | 1.00000000e+0 | held at default |
| M | 5.00000000e-1 | held at default |
| IS | 1.00000000e-20 | derived |
| N | 1.00000000e+0 | held at default |
| FC | 5.00000000e-1 | held at default |
| TNOM | 2.70000000e+1 | held at default |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| LAMBDA | 5.00000000e-3 | 1 | No accessible multi-point typical curve |
| B | 1.00000000e+0 | 1 | No accessible multi-point typical curve |
| RD | 1.00000000e-4 | 1 | No accessible multi-point typical curve |
| RS | 1.00000000e-4 | 1 | No accessible multi-point typical curve |
| PB | 1.00000000e+0 | 1 | No accessible multi-point typical curve |
| M | 5.00000000e-1 | 1 | No accessible multi-point typical curve |
| N | 1.00000000e+0 | 1 | No accessible multi-point typical curve |
| FC | 5.00000000e-1 | 1 | No accessible multi-point typical curve |
| TNOM | 2.70000000e+1 | 1 | No accessible multi-point typical curve |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| Ciss at 1 MHz | 4.000000e-12 | 3.998366e-12 | F | 0.041% | official HTML specification table TYP column |
| Crss at 1 MHz | 1.500000e-12 | 1.451703e-12 | F | 3.220% | official HTML specification table TYP column |

Worst fitting error: 3.220% for Crss at 1 MHz.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 0.000e+0 and worst absolute delta was 0.000e+0.

## Known omissions

- Nexperia PDF is challenge-gated; the official HTML specification table is used and fidelity is capped at F1.
- IDSS and VGS(off) production spread are represented by bounds, not a typical device.
- Noise is not fitted from a single-frequency figure.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
