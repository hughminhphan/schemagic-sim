# MMBT2222A model card

## Identity

- Manufacturer: onsemi
- Description: SOT-23 general-purpose NPN transistor, documented PN2222A die sibling
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/mmbt2222lt1-d.pdf
- Revision: MMBT2222LT1/D Rev. 12, August 2021
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `de8239f4a6cd91d4952158be99cd767bf34436adc8c87607b4302443f5f81e24`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | fitted |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 2.89621973e-14 | fitted or derived |
| NF | 1.00000000e+0 | fitted or derived |
| BF | 2.00000000e+3 | fitted or derived |
| IKF | 6.89199041e-1 | fitted or derived |
| ISE | 3.55570821e-14 | fitted or derived |
| NE | 1.20724478e+0 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| BR | 4.00000000e+0 | fitted or derived |
| RB | 3.50000000e+0 | fitted or derived |
| RE | 1.29629578e-4 | fitted or derived |
| RC | 1.65000000e+0 | fitted or derived |
| CJE | 2.95903496e-11 | fitted or derived |
| VJE | 7.50000000e-1 | fitted or derived |
| MJE | 3.30000000e-1 | fitted or derived |
| CJC | 1.92612542e-11 | fitted or derived |
| VJC | 7.50000000e-1 | fitted or derived |
| MJC | 3.30000000e-1 | fitted or derived |
| XCJC | 1.00000000e+0 | fitted or derived |
| TF | 4.35976726e-10 | fitted or derived |
| TR | 0.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 3.500000e+1 | 3.793798e+1 | 1 | 8.394% | p. 3 electrical characteristics |
| VBE at IC=0.0001 A | 5.800000e-1 | 5.719531e-1 | V | 1.387% | p. 3 electrical characteristics |
| hFE at IC=0.001 A | 5.000000e+1 | 5.609372e+1 | 1 | 12.187% | p. 3 electrical characteristics |
| VBE at IC=0.001 A | 6.300000e-1 | 6.321053e-1 | V | 0.334% | p. 3 electrical characteristics |
| hFE at IC=0.01 A | 7.500000e+1 | 8.080732e+1 | 1 | 7.743% | p. 3 electrical characteristics |
| VBE at IC=0.01 A | 6.900000e-1 | 6.909683e-1 | V | 0.140% | p. 3 electrical characteristics |
| hFE at IC=0.15 A | 1.000000e+2 | 1.078791e+2 | 1 | 7.879% | p. 3 electrical characteristics |
| VBE at IC=0.15 A | 7.800000e-1 | 7.701052e-1 | V | 1.269% | p. 3 electrical characteristics |
| VCE(sat) at IC=0.15 A | 3.000000e-1 | 2.894416e-1 | V | 3.519% | p. 3 electrical characteristics |
| VBE(sat) at IC=0.15 A | 8.500000e-1 | 8.271697e-1 | V | 2.686% | p. 3 electrical characteristics |
| VCE(sat) at IC=0.5 A | 1.000000e+0 | 8.757064e-1 | V | 12.429% | p. 3 electrical characteristics |
| VBE(sat) at IC=0.5 A | 1.050000e+0 | 9.890147e-1 | V | 5.808% | p. 3 electrical characteristics |

Worst fitting error: 12.429% for VCE(sat) at IC=0.5 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 2.135e-12 and worst absolute delta was 8.669e-12.

## Known omissions

- The electrical parameter vector is intentionally inherited from the existing fitted PN2222A die model. The MMBT2222A retains separate manufacturer datasheet provenance, SOT-23 package metadata, aliases, pin mapping, tests, and validation artifacts.
- The source publishes guaranteed MIN/MAX rows rather than a complete independent typical curve family, so this sibling package remains F1.
- SOT-23 package parasitics and thermal impedance are metadata only; the shared die card does not model package-specific inductance, capacitance, or self-heating.
- Breakdown, failure, statistical spread, temperature coefficients, reverse operation, and noise are not fitted.
- Independent review remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
