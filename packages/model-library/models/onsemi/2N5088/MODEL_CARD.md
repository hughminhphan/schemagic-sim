# 2N5088 model card

## Identity

- Manufacturer: onsemi (Fairchild legacy)
- Description: Low-noise high-gain NPN general-purpose amplifier transistor
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/2n5088-d.pdf
- Revision: 2N5088/2N5089/MMBT5088/MMBT5089 Rev. A, 2001
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `09f56fcc98024bef153eaf9c05b318e3ffc78fbb1b70e1f993a6d8ce8c4a28c7`
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
| IS | 6.92407089e-12 | native fitted |
| NF | 1.00000000e+0 | held default |
| BF | 5.03619021e+2 | native fitted |
| IKF | 3.88833508e-2 | native fitted |
| ISE | 1.19688332e-13 | native fitted |
| NE | 1.60854785e+0 | native fitted |
| VAF | 1.00000000e+2 | held at archetype default; no fitted output-curve family |
| BR | 4.00000000e+0 | held default |
| RB | 1.00072251e+1 | native fitted |
| RE | 5.81688428e+0 | native fitted |
| RC | 2.95275314e+1 | native fitted |
| CJE | 1.18361398e-11 | derived from cited capacitance |
| VJE | 7.50000000e-1 | held default |
| MJE | 3.30000000e-1 | held default |
| CJC | 7.83393860e-12 | derived from cited capacitance |
| VJC | 7.50000000e-1 | held default |
| MJC | 3.30000000e-1 | held default |
| XCJC | 1.00000000e+0 | held default |
| TF | 1.89546279e-9 | derived from cited fT |
| TR | 0.00000000e+0 | held at default; no cited storage time |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| hFE at IC=0.0001 A | 3.000000e+2 | 5.170416e+2 | 1 | 72.347% | p. 2 hFE MIN column |
| hFE at IC=0.001 A | 3.500000e+2 | 5.048434e+2 | 1 | 44.241% | p. 2 hFE MIN column |
| hFE at IC=0.01 A | 3.000000e+2 | 3.942115e+2 | 1 | 31.404% | p. 2 hFE MIN column |
| VBE at IC=0.01 A | 8.000000e-1 | 6.400000e-1 | V | 20.000% | p. 2 VBE(on) MAX column |
| VCE(sat) at IC=0.01 A | 5.000000e-1 | 4.000000e-1 | V | 20.000% | p. 2 VCE(sat) MAX column |
| VBE(sat) at IC=0.01 A | 8.000000e-1 | 6.400000e-1 | V | 20.000% | p. 2 VBE(on) MAX column |

Worst fitting error: 72.347% for hFE at IC=0.0001 A.

Native and WASM agreement: all 6 benches passed. Worst reported relative delta was 2.198e-11 and worst absolute delta was 8.640e-11.

## Known omissions

- The source provides guaranteed hFE minima and voltage maxima rather than a complete typical DC curve, so fidelity is capped at F1.
- The published noise figure is metadata only; flicker and broadband noise are not modelled.
- VAF, junction grading, reverse operation, temperature coefficients, process spread, self-heating, breakdown, and package parasitics are not fitted.
- VBE(on) is reused only as a conservative VBE(sat) upper bound at the same collector current; no typical saturation base voltage is claimed.
- Independent review remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
